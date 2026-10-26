// Level complete: stars draw in, coins fly into the treat jar, then Next or the map.

import { adventureNews, adventureScreen, levelUpCheck } from './adventure.ts';
import { html, esc, type App, type Screen } from './app.ts';
import { progressMoment, MILESTONES, type Moment } from '../core/moment.ts';
import { rewardById } from '../core/rewards.ts';
import type { Child } from '../storage/save.ts';
import type { Level } from '../core/path.ts';
import { frontier } from '../core/path.ts';
import { ICONS, coinSvg } from './icons.ts';
import { JarBar } from './jars.ts';
import { worldVars, ambientHtml } from './worlds.ts';
import { countUp, flyArc, popIn, stagger, wait, EASE_SPRING, EASE_OUT, reducedMotion } from '../render/motion.ts';
import { enterChild, playLevel } from './flow.ts';
import { unlockScreen } from './unlock.ts';
import { timesUpScreen } from './timesup.ts';
import { showcaseScreen, SHOWCASE_EVERY } from './showcase.ts';
import { lineAfterMiss, levelName } from './pep.ts';
import { TIER_NAMES } from '../core/path.ts';
import { bossFor } from '../core/boss.ts';

import { plusFaceSvg } from './plus.ts';

/** A short name for a level: "× 7 · Speed", "Minion fight", or the boss. */
function levelLabel(l: Level): string {
  if (l.kind === 'skill') return `${levelName(l)} · ${TIER_NAMES[l.tier]}`;
  if (l.kind === 'review') return 'Minion fight';
  return `Boss: ${bossFor(l.stage, l.boss).name}`;
}

export interface ResultInfo {
  stars: 0 | 1 | 2 | 3;
  score: number;
  total: number;
  coins: number;
  unlocked: ('treat' | 'goal')[];
  timeUp: boolean;
  title?: string;
  /** Whether the score was perfect, and what a perfect score pays here (to aim for next time). */
  perfect?: boolean;
  perfectCoins?: number;
}

const pct = (p: number): string => `${Math.floor(p * 100 + 1e-9)}%`;
const plusPct = (p: number): string => `+${Math.max(1, Math.round(p * 100))}%`;

/** The progress moment: where the treat was, what this level added, what perfect adds. */
function momentHtml(m: Moment, r: ResultInfo): string {
  const reward = rewardById(m.rewardId)!;
  const ticks = MILESTONES.slice(0, -1).map((t) => `<span class="mo-tick${m.after >= t ? ' passed' : ''}" style="left:${t * 100}%"></span>`).join('');
  const rows = r.perfect
    ? `<div class="mo-row best"><span>${r.score}/${r.total}</span><i style="--w:100%"></i><b>${plusPct(m.gain)}</b></div>`
    : `<div class="mo-row"><span>${r.score}/${r.total}</span><i style="--w:${Math.max(6, (100 * m.gain) / m.perfectGain)}%"></i><b>${plusPct(m.gain)}</b></div>
       <div class="mo-row best"><span>${r.total}/${r.total}</span><i style="--w:100%"></i><b>${plusPct(m.perfectGain)}</b></div>`;
  const levels = `${m.perfectLevels} perfect level${m.perfectLevels === 1 ? '' : 's'}`;
  const next = m.after >= 1 ? `Your ${esc(reward.name.toLowerCase())} is ready!` : m.next >= 1 ? `<b>${levels}</b> to your ${esc(reward.name.toLowerCase())}` : `<b>${levels}</b> to reach ${pct(m.next)}`;
  return `<div class="moment card" role="group" aria-label="${esc(reward.name)}: ${pct(m.before)} to ${pct(m.after)}">
    <div class="mo-head"><span class="mo-icon" aria-hidden="true">${reward.icon}</span><b>${esc(reward.name)}</b><span class="mo-pct">${pct(m.before)}</span></div>
    <div class="mo-bar"><i class="mo-was" style="width:${m.before * 100}%"></i><i class="mo-new" style="left:${m.before * 100}%;--to:${(m.after - m.before) * 100}%"></i>${ticks}</div>
    <div class="mo-sub"><span>was ${pct(m.before)}</span><span>${r.perfect ? 'Perfect score: the biggest step' : 'Perfect scores fill it fastest'}</span></div>
    <div class="mo-rows">${rows}</div>
    <p class="mo-next"><span aria-hidden="true">🏁</span><span>${next}</span></p>
  </div>`;
}

const CHEERS = ['Brilliant!', 'Super work!', 'Fantastic!', 'You did it!', 'Amazing!', 'Well done!'];

export function resultScreen(child: Child, level: Level, r: ResultInfo) {
  return (app: App): Screen => {
    const passed = r.stars > 0;
    const title = r.title ?? (passed ? CHEERS[(r.score + level.index) % CHEERS.length] : 'So close!');
    // Replaying an earlier level: carry on from here, or jump back to where they were.
    const front = app.path[frontier(app.path, child.progress)];
    const after = app.path[level.index + 1];
    const twoWays = passed && !!after && !!front && after.id !== front.id && after.index < front.index;
    const moment = r.coins > 0 ? progressMoment(child.wallet, r.coins, r.perfectCoins ?? r.coins) : null;
    const news = adventureNews(app, child);
    const el = html(`<section class="screen result" style="${worldVars(level.stage)}" aria-label="Level result">
      ${ambientHtml(level.stage, 8)}
      ${moment ? '' : '<div class="jar-slot"></div>'}
      <div class="scroll res-body">
      <div class="res-card card">
        <h1 class="res-title">${title}</h1>
        <div class="res-stars" aria-label="${r.stars} of 3 stars">${[1, 2, 3].map((n) => `<span class="rstar${n <= r.stars ? ' on' : ''}${n === 2 ? ' mid' : ''}">${ICONS.star}</span>`).join('')}</div>
        <p class="res-score">${r.score} / ${r.total} right</p>
        ${r.coins ? `<p class="res-coins">${coinSvg}<b class="coin-count">+0</b></p>` : r.timeUp && passed ? `<p class="res-note">Time’s up for today, so no coins this time.</p>` : ''}
        ${moment ? '' : r.perfect ? `<p class="res-perfect">💯 Perfect score — the biggest prize!</p>` : r.perfectCoins && !r.timeUp ? `<p class="res-aim">Aim for perfect: ${coinSvg} <b>+${r.perfectCoins}</b> for ${r.total}/${r.total}</p>` : ''}
        ${passed ? '' : `<p class="res-note">You need ${level.kind === 'skill' && level.tier === 5 ? '10 in a row' : 'a few more right'} to pass.</p><div class="res-plus"><span class="ps-plus">${plusFaceSvg({ cls: 'oops' })}</span><p>${lineAfterMiss(child, r.score, r.total)}</p></div>`}
      </div>
      ${news}
      ${moment ? momentHtml(moment, r) : ''}
      </div>
      <div class="res-actions">
        ${
          twoWays
            ? `<div class="tw-row"><button class="btn next">Next ${ICONS.play}</button><button class="tw-q" aria-label="Where Next goes" data-tip="Next: ${esc(levelLabel(after!))}">?</button></div>
               <div class="tw-row"><button class="btn ghost resume">My level ↩</button><button class="tw-q" aria-label="Where My level goes" data-tip="Your level: ${esc(levelLabel(front!))}">?</button></div>
               <p class="tw-tip" role="status" hidden></p>`
            : `<button class="btn next">${passed ? `Next ${ICONS.play}` : 'Try again'}</button>`
        }
        <button class="btn ghost home">Map</button>
      </div>
    </section>`);
    const jar = new JarBar(child);
    el.querySelector('.jar-slot')?.appendChild(jar.el);
    if (moment) el.classList.add('has-moment');
    if (r.coins > 0) app.save.update(() => (child.sinceShowcase = (child.sinceShowcase ?? 0) + 1));
    app.save.update(() => (child.lastPlay = { day: app.today, levelId: level.id, name: levelName(level), score: r.score, total: r.total, stars: r.stars }));
    const proceed = (fn: () => void) => {
      if (r.unlocked.length) return void app.show(unlockScreen(child, r.unlocked[0]));
      if (r.timeUp && app.save.data.settings.timeUpMode === 'stop') return void app.show(timesUpScreen(child));
      if ((child.sinceShowcase ?? 0) >= SHOWCASE_EVERY) {
        app.save.update(() => (child.sinceShowcase = 0));
        return void app.show(showcaseScreen(child, level.stage, fn), 'liquid');
      }
      fn();
    };
    el.querySelector('.next')!.addEventListener('click', () =>
      proceed(() => {
        const target = passed ? (twoWays ? after : app.path[frontier(app.path, child.progress)]) : level;
        if (target) playLevel(app, child, target);
        else enterChild(app, child);
      }),
    );
    el.querySelector('.adv-open')?.addEventListener('click', () => proceed(() => void app.show(adventureScreen(child))));
    el.querySelector('.resume')?.addEventListener('click', () => proceed(() => playLevel(app, child, front!)));
    // The little ? beside each button says which level it goes to.
    const tip = el.querySelector<HTMLElement>('.tw-tip');
    let tipTimer = 0;
    el.querySelectorAll<HTMLElement>('.tw-q').forEach((q) =>
      q.addEventListener('click', () => {
        if (!tip) return;
        const same = !tip.hidden && tip.dataset.from === q.dataset.tip;
        clearTimeout(tipTimer);
        tip.hidden = same;
        tip.textContent = q.dataset.tip ?? '';
        tip.dataset.from = q.dataset.tip ?? '';
        if (!same) {
          popIn(tip, 0, 0.9);
          tipTimer = window.setTimeout(() => (tip.hidden = true), 4000);
        }
      }),
    );
    el.querySelector('.home')!.addEventListener('click', () => proceed(() => enterChild(app, child, 'fade', false)));

    const celebrate = async () => {
      const card = el.querySelector('.res-card')!;
      popIn(card, 0, 0.94);
      const stars = [...el.querySelectorAll<HTMLElement>('.rstar')];
      stars.forEach((s, k) => {
        if (reducedMotion()) return;
        s.animate(
          [
            { transform: `${k === 1 ? 'translateY(-14px) ' : ''}scale(.7)`, opacity: 0 },
            { transform: `${k === 1 ? 'translateY(-14px) ' : ''}scale(1)`, opacity: 1 },
          ],
          { duration: 480, delay: 300 + k * 160, easing: EASE_SPRING, fill: 'backwards' },
        );
      });
      stagger(el.querySelectorAll('.res-actions .btn'), { delay: 900 });
      if (passed) {
        app.sfx.fanfare();
        await wait(300);
        // One quiet celebration per level; confetti only for a perfect score.
        if (r.perfect) {
          const r0 = card.getBoundingClientRect();
          app.fx.confetti(r0.x + r0.width / 2, r0.y + 40, 48);
        }
      } else app.sfx.sad();
      const momentEl = el.querySelector<HTMLElement>('.moment');
      const fillMoment = () => {
        if (!momentEl || !moment) return;
        const seg = momentEl.querySelector<HTMLElement>('.mo-new')!;
        const to = getComputedStyle(seg).getPropertyValue('--to');
        seg.style.width = to;
        if (!reducedMotion()) seg.animate([{ width: '0%' }, { width: to }], { duration: 900, easing: EASE_OUT });
        countUp(momentEl.querySelector<HTMLElement>('.mo-pct')!, moment.before * 100, moment.after * 100, 900, (n) => `${Math.floor(n + 1e-9)}%`);
        momentEl.classList.add('filled');
      };
      if (r.coins) {
        await wait(reducedMotion() ? 0 : 1000);
        const counter = el.querySelector<HTMLElement>('.coin-count')!;
        countUp(counter, 0, r.coins, 700, (n) => `+${Math.round(n)}`);
        const from = counter.getBoundingClientRect();
        const n = Math.min(10, Math.max(4, Math.round(r.coins / 2)));
        const target = (): DOMRect => {
          if (!momentEl || !moment) return jar.target();
          const b = momentEl.querySelector('.mo-bar')!.getBoundingClientRect();
          return new DOMRect(b.x + b.width * moment.after - 14, b.y, 28, b.height);
        };
        const flights: Promise<void>[] = [];
        for (let k = 0; k < n; k++) {
          const c = html(`<span class="flying-coin">${coinSvg}</span>`);
          document.body.appendChild(c);
          flights.push(flyArc(c, from, target(), 760, k * 70).then(() => {
            c.remove();
            app.sfx.coin(k);
          }));
        }
        if (momentEl) setTimeout(fillMoment, 500);
        await Promise.all(flights);
        if (!momentEl) jar.update(true);
      }
    };
    return {
      el,
      mounted: () =>
        void celebrate().then(async () => {
          // A new player level (Adventure): celebrate once the coins have landed.
          await wait(reducedMotion() ? 0 : 500);
          if (el.isConnected) await levelUpCheck(app, child);
        }),
    };
  };
}
