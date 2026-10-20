// Side quest: 100 quick questions against a 300-second clock. No waiting between questions —
// tap, a flash of green or red, and the next one is already there.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { skillById } from '../core/areas/index.ts';
import { makeQuestion, recordResult, noteAsked, forAge } from '../core/path.ts';
import { createRng } from '../core/rng.ts';
import { isCorrect, type Question } from '../core/question.ts';
import { addCoins, addPlayTime, coinsForLevel } from '../core/economy.ts';
import { QUEST, questStars, type SideQuest } from '../core/quest.ts';
import { remember } from '../core/undo.ts';
import { ICONS, coinSvg } from './icons.ts';
import { visualHtml, optionHtml } from './visuals.ts';
import { ambientHtml, worldVars } from './worlds.ts';
import { countUp, fitCard, popIn, stagger, wait, reducedMotion, EASE_OUT } from '../render/motion.ts';
import { JarBar } from './jars.ts';
import { goHome, timeState } from './flow.ts';
import { unlockScreen } from './unlock.ts';
import { timesUpScreen } from './timesup.ts';

export function questScreen(child: Child, quest: SideQuest) {
  return (app: App): Screen => {
    const skills = quest.skillIds.map((id) => skillById(id)!).filter(Boolean);
    const rng = createRng(`${child.id}:${quest.id}:${Date.now()}`);
    const seen = new Set<string>();
    const asked: Question[] = [];
    const best = child.progress.questBest?.[quest.id] ?? 0;
    let correct = 0;
    let streak = 0;
    let over = false;
    let started = 0;
    let pausedAt = 0;
    let pausedTotal = 0;
    let tick = 0;
    let current: Question | null = null;

    const el = html(`<section class="screen quest" style="${worldVars(quest.stage)}" aria-label="Side quest">
      ${ambientHtml(quest.stage, 5)}
      <header class="play-top">
        <button class="icon-btn quit" aria-label="Pause">${ICONS.pause}</button>
        <div class="play-title"><b>Side quest · Stage ${quest.stage}</b><span>100 questions · 5 minutes</span></div>
        <div class="q-clock" aria-label="Time left"><b>5:00</b></div>
      </header>
      <div class="q-meter"><i class="q-time"></i></div>
      <div class="q-stats"><span class="q-right">✅ <b>0</b></span><span class="q-count"><b>0</b>/100</span><span class="q-best">🏆 Best ${best}</span></div>
      <main class="qwrap" aria-live="polite"></main>
      <footer class="answers fmt-choice"></footer>
    </section>`);
    const qwrap = el.querySelector<HTMLElement>('.qwrap')!;
    const answers = el.querySelector<HTMLElement>('.answers')!;
    const clock = el.querySelector<HTMLElement>('.q-clock b')!;
    const timeBar = el.querySelector<HTMLElement>('.q-time')!;

    const elapsed = () => (performance.now() - started - pausedTotal) / 1000;
    const next = () => {
      if (over) return;
      if (asked.length >= QUEST.questions) return void finish();
      const skill = rng.pick(skills);
      const q = makeQuestion(skill, rng, forAge(0.3 + 0.4 * rng.next(), child.age, skill.stage), seen, skill.format === 'picture' ? 3 : 4, current?.key, asked.slice(-8));
      seen.add(q.key);
      current = q;
      qwrap.innerHTML = `<article class="qcard quick">${q.visual ? visualHtml(q.visual, q.key) : ''}<h2 class="prompt">${q.prompt.replace(/</g, '&lt;')}</h2></article>`;
      const card = qwrap.firstElementChild as HTMLElement;
      if (app.debug) card.dataset.answer = q.answer;
      answers.innerHTML = q.choices.map((c) => `<button type="button" class="choice" data-v="${encodeURIComponent(c)}" aria-label="${esc(c)}">${optionHtml(c, q.optionObject)}</button>`).join('');
      fitCard(card, qwrap);
      if (!reducedMotion()) card.animate([{ opacity: 0.2, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: EASE_OUT });
    };

    answers.addEventListener('pointerdown', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.choice');
      if (!btn || !current || over || pausedAt) return;
      e.preventDefault();
      const q = current;
      current = null;
      asked.push(q);
      const ok = isCorrect(q, decodeURIComponent(btn.dataset.v!));
      if (ok) {
        correct++;
        streak++;
        app.sfx.correct(Math.min(streak, 8));
        app.haptics.tap();
        btn.classList.add('right');
      } else {
        streak = 0;
        app.sfx.wrong();
        btn.classList.add('wrong');
        answers.querySelectorAll<HTMLElement>('.choice').forEach((b) => {
          if (isCorrect(q, decodeURIComponent(b.dataset.v!))) b.classList.add('right');
        });
      }
      el.querySelector('.q-right b')!.textContent = String(correct);
      el.querySelector('.q-count b')!.textContent = String(asked.length);
      el.classList.toggle('on-fire', streak >= 10);
      setTimeout(next, ok ? 140 : 650);
    });

    const runClock = () => {
      const left = Math.max(0, QUEST.seconds - elapsed());
      clock.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      timeBar.style.transform = `scaleX(${left / QUEST.seconds})`;
      el.classList.toggle('hurry', left <= 30);
      if (left <= 0) return void finish();
      tick = requestAnimationFrame(runClock);
    };

    const finish = async (ended = false) => {
      if (over) return;
      over = true;
      cancelAnimationFrame(tick);
      const seconds = Math.round(Math.min(QUEST.seconds, elapsed()));
      const stars = questStars(correct);
      let coins = 0;
      let unlocked: ('treat' | 'goal')[] = [];
      app.save.update(() => {
        remember(child, [quest.id], Date.now(), app.today);
        const inside = addPlayTime(child.wallet, app.today, seconds, app.save.data.settings.limitMinutes);
        child.stats.secondsByDay[app.today] = (child.stats.secondsByDay[app.today] ?? 0) + seconds;
        child.stats.answered += asked.length;
        child.stats.correct += correct;
        noteAsked(child.progress, asked, app.today);
        const replay = (child.progress.levels[quest.id]?.passes ?? 0) > 0;
        recordResult(child.progress, quest.id, stars);
        const qb = (child.progress.questBest ??= {});
        qb[quest.id] = Math.max(qb[quest.id] ?? 0, correct);
        if (inside && stars) {
          coins = coinsForLevel('skill', correct / QUEST.questions, true, replay, quest.stage);
          unlocked = addCoins(child.wallet, coins).unlocked;
        }
      });
      const record = correct > best;
      const jar = new JarBar(child);
      const ov = html(`<div class="quest-end overlay" role="dialog" aria-modal="true" aria-label="Side quest result"><div class="sheet">
        <p class="chip">${asked.length >= QUEST.questions ? 'All 100 done!' : ended ? 'Quest ended' : 'Time’s up!'}</p>
        <h2 class="qe-score"><b>0</b> right</h2>
        <p>${record ? '🏆 New best score!' : `Best: ${best}`} · ${asked.length} answered in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</p>
        <div class="res-stars small">${[1, 2, 3].map((n) => `<span class="rstar${n <= stars ? ' on' : ''}">${ICONS.star}</span>`).join('')}</div>
        ${coins ? `<p class="res-coins">${coinSvg}<b>+${coins}</b></p>` : stars ? '' : '<p>Reach 40 to earn stars and coins.</p>'}
        <div class="jar-slot"></div>
        <div class="actions"><button class="btn again">Play again</button><button class="btn ghost" data-back>Map</button></div>
      </div></div>`);
      ov.querySelector('.jar-slot')!.appendChild(jar.el);
      el.appendChild(ov);
      popIn(ov.querySelector('.sheet')!, 0, 0.8);
      countUp(ov.querySelector<HTMLElement>('.qe-score b')!, 0, correct, 900);
      if (stars) {
        app.sfx.fanfare();
        const r = ov.querySelector('.sheet')!.getBoundingClientRect();
        app.fx.confetti(r.x + r.width / 2, r.y + 40, record ? 120 : 60);
      } else app.sfx.sad();
      stagger(ov.querySelectorAll('.rstar'), { delay: 500, gap: 200, scale: 0.2 });
      if (coins) {
        await wait(900);
        jar.update(true);
      }
      const after = (fn: () => void) => {
        if (unlocked.length) return void app.show(unlockScreen(child, unlocked[0]));
        if (timeState(app, child) === 'stop') return void app.show(timesUpScreen(child));
        fn();
      };
      ov.querySelector('.again')!.addEventListener('click', () => after(() => void app.show(questScreen(child, quest))));
      ov.querySelector('[data-back]')!.addEventListener('click', () => after(() => goHome(app)));
    };

    const pause = () => {
      if (over || pausedAt) return;
      pausedAt = performance.now();
      cancelAnimationFrame(tick);
      el.classList.add('paused');
      const { result } = app.sheet(`<h2>Paused</h2><p>The clock is stopped.</p>`, [
        { label: 'Keep going', value: 'resume', kind: 'mint', back: true },
        { label: 'End the quest', value: 'end', kind: 'ghost' },
      ], 'Paused');
      void result.then((v) => {
        pausedTotal += performance.now() - pausedAt;
        pausedAt = 0;
        el.classList.remove('paused');
        if (v === 'end') return void finish(true);
        // The question was on screen during the pause: ask a fresh one instead.
        if (current) next();
        tick = requestAnimationFrame(runClock);
      });
    };
    el.querySelector('.quit')!.addEventListener('click', pause);

    return {
      el,
      keepAwake: true,
      mounted: async () => {
        const go = html(`<div class="fight-banner">GO!</div>`);
        el.appendChild(go);
        app.sfx.whoosh();
        if (!reducedMotion()) await go.animate([{ transform: 'translate(-50%,-50%) scale(3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.4 }, { transform: 'translate(-50%,-50%) scale(.7)', opacity: 0 }], { duration: 800, easing: EASE_OUT }).finished;
        go.remove();
        started = performance.now();
        next();
        tick = requestAnimationFrame(runClock);
      },
      back: () => {
        pause();
        return true;
      },
      pause,
      destroy: () => {
        over = true;
        cancelAnimationFrame(tick);
      },
    };
  };
}

