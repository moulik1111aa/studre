// Level complete: stars draw in, coins fly into the treat jar, then Next or the map.

import { html, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import type { Level } from '../core/path.ts';
import { frontier } from '../core/path.ts';
import { ICONS, coinSvg } from './icons.ts';
import { JarBar } from './jars.ts';
import { worldVars, ambientHtml } from './worlds.ts';
import { countUp, flyArc, popIn, stagger, wait, EASE_SPRING, reducedMotion } from '../render/motion.ts';
import { enterChild, playLevel } from './flow.ts';
import { unlockScreen } from './unlock.ts';
import { timesUpScreen } from './timesup.ts';
import { showcaseScreen, SHOWCASE_EVERY } from './showcase.ts';

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

const CHEERS = ['Brilliant!', 'Super work!', 'Fantastic!', 'You did it!', 'Amazing!', 'Well done!'];

export function resultScreen(child: Child, level: Level, r: ResultInfo) {
  return (app: App): Screen => {
    const passed = r.stars > 0;
    const title = r.title ?? (passed ? CHEERS[(r.score + level.index) % CHEERS.length] : 'So close!');
    const el = html(`<section class="screen result" style="${worldVars(level.stage)}" aria-label="Level result">
      ${ambientHtml(level.stage, 8)}
      <div class="jar-slot"></div>
      <div class="res-card card">
        <h1 class="res-title">${title}</h1>
        <div class="res-stars" aria-label="${r.stars} of 3 stars">${[1, 2, 3].map((n) => `<span class="rstar${n <= r.stars ? ' on' : ''}${n === 2 ? ' mid' : ''}">${ICONS.star}</span>`).join('')}</div>
        <p class="res-score">${r.score} / ${r.total} right</p>
        ${r.coins ? `<p class="res-coins">${coinSvg}<b class="coin-count">+0</b></p>` : r.timeUp && passed ? `<p class="res-note">Time’s up for today, so no coins this time.</p>` : ''}
        ${r.perfect ? `<p class="res-perfect">💯 Perfect score — the biggest prize!</p>` : r.perfectCoins && !r.timeUp ? `<p class="res-aim">Aim for perfect: ${coinSvg} <b>+${r.perfectCoins}</b> for ${r.total}/${r.total}</p>` : ''}
        ${passed ? '' : `<p class="res-note">You need ${level.kind === 'skill' && level.tier === 5 ? '10 in a row' : 'a few more right'} to pass. Let’s try again!</p>`}
      </div>
      <div class="res-actions">
        <button class="btn next">${passed ? `Next ${ICONS.play}` : 'Try again'}</button>
        <button class="btn ghost home">Map</button>
      </div>
    </section>`);
    const jar = new JarBar(child);
    el.querySelector('.jar-slot')!.appendChild(jar.el);
    if (r.coins > 0) app.save.update(() => (child.sinceShowcase = (child.sinceShowcase ?? 0) + 1));
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
        const target = passed ? app.path[frontier(app.path, child.progress)] : level;
        if (target) playLevel(app, child, target);
        else enterChild(app, child);
      }),
    );
    el.querySelector('.home')!.addEventListener('click', () => proceed(() => enterChild(app, child, 'fade', false)));

    const celebrate = async () => {
      const card = el.querySelector('.res-card')!;
      popIn(card, 0, 0.8);
      const stars = [...el.querySelectorAll<HTMLElement>('.rstar')];
      stars.forEach((s, k) => {
        if (reducedMotion()) return;
        s.animate(
          [
            { transform: `${k === 1 ? 'translateY(-14px) ' : ''}scale(0) rotate(-60deg)`, opacity: 0 },
            { transform: `${k === 1 ? 'translateY(-14px) ' : ''}scale(1.3) rotate(10deg)`, opacity: 1, offset: 0.6 },
            { transform: `${k === 1 ? 'translateY(-14px) ' : ''}scale(1) rotate(0)`, opacity: 1 },
          ],
          { duration: 560, delay: 320 + k * 220, easing: EASE_SPRING, fill: 'backwards' },
        );
      });
      stagger(el.querySelectorAll('.res-actions .btn'), { delay: 900 });
      if (passed) {
        app.sfx.fanfare();
        await wait(300);
        const r0 = card.getBoundingClientRect();
        app.fx.confetti(r0.x + r0.width / 2, r0.y + 40, 70);
        stars.filter((s) => s.classList.contains('on')).forEach((s, k) => setTimeout(() => {
          const b = s.getBoundingClientRect();
          app.fx.sparkle(b.x + b.width / 2, b.y + b.height / 2, 10);
        }, 500 + k * 220));
      } else app.sfx.sad();
      if (r.coins) {
        await wait(1000);
        const counter = el.querySelector<HTMLElement>('.coin-count')!;
        countUp(counter, 0, r.coins, 700, (n) => `+${Math.round(n)}`);
        const from = counter.getBoundingClientRect();
        const n = Math.min(10, Math.max(4, Math.round(r.coins / 2)));
        const flights: Promise<void>[] = [];
        for (let k = 0; k < n; k++) {
          const c = html(`<span class="flying-coin">${coinSvg}</span>`);
          document.body.appendChild(c);
          flights.push(flyArc(c, from, jar.target(), 760, k * 70).then(() => {
            c.remove();
            app.sfx.coin(k);
          }));
        }
        await Promise.all(flights);
        jar.update(true);
        const t = jar.target();
        app.fx.sparkle(t.x + t.width * Math.min(0.95, 0.1 + 0.85 * 0.5), t.y + t.height / 2, 12);
      }
    };
    return { el, mounted: () => void celebrate() };
  };
}
