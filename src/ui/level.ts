// Playing a skill level: questions one at a time, pictures and voice for little ones,
// a number pad or big choices for older children, a timer on Speed and Master levels.

import { html, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { type Level, makeRound, recordResult, starsFor, noteAsked, dueForRevision, TIER_NAMES, type Round } from '../core/path.ts';
import { skillById, AREAS } from '../core/areas/index.ts';
import { createRng } from '../core/rng.ts';
import { isCorrect, spoken, type Question } from '../core/question.ts';
import { addCoins, addPlayTime, coinsForLevel } from '../core/economy.ts';
import { visualHtml, optionHtml, prettyAnswer } from './visuals.ts';
import { ICONS } from './icons.ts';
import { JarBar } from './jars.ts';
import { ambientHtml, worldVars } from './worlds.ts';
import { popIn, shake, stagger, wait, EASE_OUT, reducedMotion } from '../render/motion.ts';
import { resultScreen } from './result.ts';
import { goHome, timeState } from './flow.ts';
import { stepBackAfterPlacement } from './placement.ts';

export function levelScreen(child: Child, level: Extract<Level, { kind: 'skill' }>) {
  return (app: App): Screen => {
    const skill = skillById(level.skillId)!;
    const rng = createRng(`${child.id}:${level.id}:${Date.now()}`);
    const earlier = app.path
      .filter((l) => l.kind === 'skill' && l.index < level.index && l.tier === 1)
      .map((l) => skillById((l as { skillId: string }).skillId)!)
      .slice(-12);
    const warm = level.tier === 1 && !child.stats.secondsByDay[app.today] ? dueForRevision(child.progress, AREAS[0].skills.flat(), app.today) : [];
    const round: Round = makeRound(level, skillById, child.progress, rng, earlier, warm);
    const { rules, questions } = round;
    const little = skill.stage <= 2;
    const el = html(`<section class="screen play" style="${worldVars(level.stage)}" aria-label="${skill.name}">
      ${ambientHtml(level.stage, 6)}
      <header class="play-top">
        <button class="icon-btn quit" aria-label="Pause">${ICONS.pause}</button>
        <div class="play-title"><b>${TIER_NAMES[level.tier]}</b><span>${skill.name}</span></div>
        <div class="dots" aria-hidden="true"></div>
      </header>
      <div class="jar-slot"></div>
      <div class="timer" hidden><i></i></div>
      <main class="qwrap" aria-live="polite"></main>
      <footer class="answers"></footer>
    </section>`);
    const jar = new JarBar(child);
    el.querySelector('.jar-slot')!.appendChild(jar.el);
    const qwrap = el.querySelector<HTMLElement>('.qwrap')!;
    const answers = el.querySelector<HTMLElement>('.answers')!;
    const dots = el.querySelector<HTMLElement>('.dots')!;
    const timerEl = el.querySelector<HTMLElement>('.timer')!;
    const total = rules.streak ? rules.streak : questions.length;
    dots.innerHTML = Array.from({ length: total }, () => '<i></i>').join('');

    let i = 0;
    let correct = 0;
    let streak = 0;
    let done = false;
    let activeSince = performance.now();
    let activeMs = 0;
    let timer: Animation | null = null;
    let timeout = 0;
    const asked: Question[] = [];

    const accrue = () => {
      activeMs += performance.now() - activeSince;
      activeSince = performance.now();
    };

    const show = (q: Question) => {
      asked.push(q);
      const prompt = q.prompt;
      qwrap.innerHTML = `<article class="qcard${q.visual ? ' has-vis' : ''}">
        ${q.visual ? visualHtml(q.visual, q.key) : ''}
        <h2 class="prompt${prompt.length > 34 ? ' long' : ''}${prompt.length > 70 ? ' xlong' : ''}">${escPrompt(prompt)}</h2>
        <div class="q-tools">
          <button class="icon-btn say" aria-label="Read it again">${ICONS.speaker}</button>
          ${rules.hints && q.hint ? `<button class="icon-btn hint" aria-label="Hint">${ICONS.bulb}</button>` : ''}
        </div>
        <p class="hint-text" hidden>${q.hint ?? ''}</p>
      </article>`;
      const card = qwrap.firstElementChild as HTMLElement;
      if (app.debug) card.dataset.answer = q.answer;
      if (!reducedMotion()) card.animate([{ opacity: 0, transform: 'perspective(800px) rotateX(-18deg) translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE_OUT });
      stagger(card.querySelectorAll('.obj, .dots circle, .cell, .note, .coin-piece'), { gap: 45, y: 10, scale: 0.6 });
      card.querySelector('.say')!.addEventListener('click', () => app.voice.say(q.speak ?? spoken(q.prompt)));
      card.querySelector('.hint')?.addEventListener('click', () => {
        const h = card.querySelector<HTMLElement>('.hint-text')!;
        h.hidden = false;
        popIn(h);
      });
      if (little || q.speak) app.voice.say(q.speak ?? spoken(q.prompt));
      renderAnswers(q);
      startTimer();
    };

    const renderAnswers = (q: Question) => {
      answers.className = `answers fmt-${q.format}`;
      if (q.format === 'pad' || q.format === 'pad-ext') {
        const ext = q.format === 'pad-ext' || /[./,-]/.test(q.answer);
        const keys = [7, 8, 9, 4, 5, 6, 1, 2, 3, ext ? '−' : '', 0, '⌫'];
        const extra = ext ? ['.', '/', ','] : [];
        answers.innerHTML = `<div class="entry" aria-live="polite"><span class="typed"></span><span class="caret"></span></div>
          <div class="pad">${keys.map((k) => (k === '' ? '<span></span>' : `<button type="button" class="key" data-k="${k}">${k === '⌫' ? ICONS.backspace : k}</button>`)).join('')}</div>
          <div class="pad-row">${extra.map((k) => `<button type="button" class="key small" data-k="${k}">${k === ',' ? 'and' : k}</button>`).join('')}<button type="button" class="btn mint ok">OK ${ICONS.check}</button></div>`;
        let typed = '';
        const out = answers.querySelector<HTMLElement>('.typed')!;
        const paint = () => (out.innerHTML = typed ? prettyAnswer(typed.replace(/−/g, '-')) : '');
        answers.querySelector('.pad')!.addEventListener('pointerdown', (e) => {
          const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
          if (!k || done) return;
          e.preventDefault();
          app.sfx.key();
          app.haptics.tap();
          if (k === '⌫') typed = typed.slice(0, -1);
          else if (k === '−') typed = typed.startsWith('-') ? typed.slice(1) : '-' + typed;
          else if (typed.length < 9) typed += k;
          paint();
        });
        answers.querySelector('.pad-row')!.addEventListener('pointerdown', (e) => {
          const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
          if (!k) return;
          e.preventDefault();
          if (typed.length < 9) typed += k;
          paint();
        });
        answers.querySelector('.ok')!.addEventListener('click', () => {
          if (typed) submit(q, typed);
        });
        stagger(answers.querySelectorAll('.key, .ok'), { gap: 18, y: 8 });
        return;
      }
      answers.innerHTML = q.choices
        .map((c) => `<button type="button" class="choice" data-v="${encodeURIComponent(c)}" aria-label="${c}">${optionHtml(c, q.optionObject)}</button>`)
        .join('');
      answers.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) =>
        b.addEventListener('click', () => {
          if (!done) submit(q, decodeURIComponent(b.dataset.v!), b);
        }),
      );
      stagger(answers.children, { gap: 70, y: 16 });
    };

    const startTimer = () => {
      timer?.cancel();
      clearTimeout(timeout);
      if (!rules.timer) return;
      timerEl.hidden = false;
      const bar = timerEl.querySelector('i')!;
      timer = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: rules.timer * 1000, easing: 'linear', fill: 'forwards' });
      timeout = window.setTimeout(() => submit(asked[asked.length - 1], '__timeout__'), rules.timer * 1000);
    };

    const submit = async (q: Question, value: string, btn?: HTMLElement) => {
      if (done) return;
      done = true;
      timer?.pause();
      clearTimeout(timeout);
      const ok = value !== '__timeout__' && isCorrect(q, value);
      const card = qwrap.firstElementChild as HTMLElement;
      const dot = dots.children[rules.streak ? Math.min(streak, total - 1) : i] as HTMLElement | undefined;
      app.voice.stop();
      if (ok) {
        correct++;
        streak++;
        app.sfx.correct(streak);
        app.haptics.match(streak);
        card.classList.add('right');
        btn?.classList.add('right');
        const r = (btn ?? card).getBoundingClientRect();
        app.fx.burst(r.x + r.width / 2, r.y + r.height / 2, '#FFD25A', 20);
        dot?.classList.add('on');
        if (!reducedMotion()) card.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 360, easing: EASE_OUT });
        await wait(650);
      } else {
        streak = 0;
        app.sfx.wrong();
        btn?.classList.add('wrong');
        shake(btn ?? card);
        if (rules.streak) dots.querySelectorAll('i').forEach((d) => d.classList.remove('on'));
        else dot?.classList.add('miss');
        const reveal = html(`<div class="reveal">${value === '__timeout__' ? 'Time’s up! ' : ''}The answer is <b>${prettyAnswer(q.answer)}</b></div>`);
        card.appendChild(reveal);
        popIn(reveal);
        answers.querySelectorAll<HTMLElement>('.choice').forEach((b) => {
          if (isCorrect(q, decodeURIComponent(b.dataset.v!))) b.classList.add('right');
        });
        if (little) app.voice.say(`The answer is ${q.answer}.`);
        await wait(1800);
      }
      i++;
      const finished = rules.streak ? streak >= rules.streak || i >= rules.count : i >= questions.length;
      if (finished) return finish();
      done = false;
      show(questions[i]);
    };

    const finish = () => {
      accrue();
      const seconds = Math.round(activeMs / 1000);
      const passMark = rules.streak ?? rules.passMark;
      const score = rules.streak ? (streak >= rules.streak ? rules.streak : Math.min(streak, rules.streak - 1)) : correct;
      const scoreTotal = rules.streak ?? questions.length;
      const stars = starsFor(score, scoreTotal, passMark);
      let coins = 0;
      let unlocked: ('treat' | 'goal')[] = [];
      app.save.update(() => {
        const inside = addPlayTime(child.wallet, app.today, seconds, app.save.data.settings.limitMinutes);
        child.stats.secondsByDay[app.today] = (child.stats.secondsByDay[app.today] ?? 0) + seconds;
        child.stats.answered += asked.length;
        child.stats.correct += correct;
        noteAsked(child.progress, asked, app.today);
        const wasPassed = (child.progress.levels[level.id]?.stars ?? 0) >= 1;
        recordResult(child.progress, level.id, stars);
        if (inside) {
          coins = coinsForLevel('skill', stars, wasPassed, level.stage);
          unlocked = addCoins(child.wallet, coins).unlocked;
        }
        if (child.placementChecks > 0) {
          child.placementChecks--;
          if (score / scoreTotal < 0.6) stepBackAfterPlacement(child, skill);
        }
      });
      void app.show(resultScreen(child, level, { stars, score, total: scoreTotal, coins, unlocked, timeUp: timeState(app, child) !== 'ok' }));
    };

    const pause = () => {
      if (!document.body.contains(el)) return;
      accrue();
      timer?.pause();
      clearTimeout(timeout);
      const { result } = app.sheet(`<h2>Paused</h2><p>Take a breath. Your level is waiting.</p>`, [
        { label: 'Keep going', value: 'resume', kind: 'mint', back: true },
        { label: 'Leave level', value: 'leave', kind: 'ghost' },
      ], 'Paused');
      void result.then((v) => {
        if (v === 'leave') {
          app.save.update(() => addPlayTime(child.wallet, app.today, Math.round(activeMs / 1000), app.save.data.settings.limitMinutes));
          activeMs = 0;
          goHome(app);
          return;
        }
        activeSince = performance.now();
        if (timer && !done) {
          const left = (timer.effect?.getComputedTiming().duration as number) - (timer.currentTime as number);
          timer.play();
          timeout = window.setTimeout(() => submit(asked[asked.length - 1], '__timeout__'), Math.max(0, left));
        }
      });
    };
    el.querySelector('.quit')!.addEventListener('click', pause);

    return {
      el,
      keepAwake: true,
      mounted: () => {
        stagger([el.querySelector('.play-top')!, jar.el], { gap: 80 });
        activeSince = performance.now();
        show(questions[0]);
      },
      back: () => {
        pause();
        return true;
      },
      pause,
      destroy: () => {
        clearTimeout(timeout);
        timer?.cancel();
        app.voice.stop();
      },
    };
  };
}

function escPrompt(p: string): string {
  return p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(\d+)\/(\d+)/g, (_, a, b) => `<span class="frac"><sup>${a}</sup><sub>${b}</sub></span>`);
}
