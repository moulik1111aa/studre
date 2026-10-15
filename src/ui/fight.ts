// Fights: minion reviews (10 questions, a minion loses a slice per right answer) and boss
// battles driven by the Fight engine — attack questions hit the boss, every third question
// the boss attacks and a quick "block" question decides whether you lose a heart.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { type Level, makeRound, makeQuestion, recordResult, starsFor, noteAsked } from '../core/path.ts';
import { skillById } from '../core/areas/index.ts';
import { createRng } from '../core/rng.ts';
import { isCorrect, spoken, type Question } from '../core/question.ts';
import { addCoins, addPlayTime, coinsForLevel, bossFraction } from '../core/economy.ts';
import { Fight, FIGHT, bossFor, fightTime, type FightEvent } from '../core/boss.ts';
import { BossView, minionFor, projectile } from './bosses.ts';
import { visualHtml, optionHtml, prettyAnswer } from './visuals.ts';
import { ICONS } from './icons.ts';
import { ambientHtml, worldVars } from './worlds.ts';
import { popIn, shake, stagger, wait, EASE_OUT, reducedMotion, screenShake, fitCard } from '../render/motion.ts';
import { resultScreen } from './result.ts';
import { goHome, timeState } from './flow.ts';
import { remember } from '../core/undo.ts';
import { avatarHtml } from './icons.ts';

type FightLevel = Exclude<Level, { kind: 'skill' }>;

export function fightScreen(child: Child, level: FightLevel) {
  return (app: App): Screen => (level.kind === 'boss' ? bossScreen(app, child, level) : minionScreen(app, child, level));
}

// ── shared answer UI ───────────────────────────────────────────────────────

function promptHtml(p: string): string {
  return p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(\d+)\/(\d+)/g, (_, a, b) => `<span class="frac"><sup>${a}</sup><sub>${b}</sub></span>`);
}

function renderQuestion(app: App, qwrap: HTMLElement, answers: HTMLElement, q: Question, onAnswer: (value: string, btn?: HTMLElement) => void, little: boolean, mode: 'attack' | 'defend' = 'attack'): void {
  qwrap.innerHTML = `<article class="qcard fight-q ${mode}${q.visual ? ' has-vis' : ''}">
    ${mode === 'defend' ? '<p class="defend-tag">🛡️ Quick — block it!</p>' : ''}
    ${q.visual ? visualHtml(q.visual, q.key) : ''}
    <h2 class="prompt${q.prompt.length > 34 ? ' long' : ''}${q.prompt.length > 70 ? ' xlong' : ''}">${promptHtml(q.prompt)}</h2>
    <div class="q-tools"><button class="icon-btn say" aria-label="Read it again">${ICONS.speaker}</button></div>
  </article>`;
  const card = qwrap.firstElementChild as HTMLElement;
  if (app.debug) card.dataset.answer = q.answer;
  if (!reducedMotion()) card.animate([{ opacity: 0, transform: 'scale(.9) translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE_OUT });
  stagger(card.querySelectorAll('.obj, .dots circle, .cell, .note, .coin-piece'), { gap: 30, y: 8, scale: 0.6 });
  card.querySelector('.say')!.addEventListener('click', () => app.voice.say(q.speak ?? spoken(q.prompt)));
  if (little || q.speak) app.voice.say(q.speak ?? spoken(q.prompt));
  answers.className = `answers fight-answers fmt-${q.format === 'picture' ? 'picture' : 'choice'}`;
  answers.innerHTML = q.choices.map((c) => `<button type="button" class="choice" data-v="${encodeURIComponent(c)}" aria-label="${esc(c)}">${optionHtml(c, q.optionObject)}</button>`).join('');
  let locked = false;
  answers.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) =>
    b.addEventListener('click', () => {
      if (locked) return;
      locked = true;
      onAnswer(decodeURIComponent(b.dataset.v!), b);
    }),
  );
  stagger(answers.children, { gap: 50, y: 12 });
  fitCard(card, qwrap);
}

function markAnswers(answers: HTMLElement, q: Question, btn: HTMLElement | undefined, ok: boolean): void {
  if (btn) btn.classList.add(ok ? 'right' : 'wrong');
  if (!ok) {
    if (btn) shake(btn);
    answers.querySelectorAll<HTMLElement>('.choice').forEach((b) => {
      if (isCorrect(q, decodeURIComponent(b.dataset.v!))) b.classList.add('right');
    });
  }
}

/** Time bookkeeping shared by both fights. */
class Clock {
  private since = performance.now();
  ms = 0;
  accrue(): void {
    this.ms += performance.now() - this.since;
    this.since = performance.now();
  }
  resume(): void {
    this.since = performance.now();
  }
  get seconds(): number {
    return Math.round(this.ms / 1000);
  }
}

function settle(app: App, child: Child, level: FightLevel, asked: Question[], correct: number, stars: 0 | 1 | 2 | 3, seconds: number, fraction: number, beaten?: string): { coins: number; unlocked: ('treat' | 'goal')[] } {
  let coins = 0;
  let unlocked: ('treat' | 'goal')[] = [];
  app.save.update(() => {
    remember(child, [level.id], Date.now(), app.today);
    const inside = addPlayTime(child.wallet, app.today, seconds, app.save.data.settings.limitMinutes);
    child.stats.secondsByDay[app.today] = (child.stats.secondsByDay[app.today] ?? 0) + seconds;
    child.stats.answered += asked.length;
    child.stats.correct += correct;
    noteAsked(child.progress, asked, app.today);
    const wasPassed = (child.progress.levels[level.id]?.stars ?? 0) >= 1;
    recordResult(child.progress, level.id, stars);
    if (beaten && stars > 0 && !child.bossesBeaten.includes(beaten)) child.bossesBeaten.push(beaten);
    if (inside && stars > 0) {
      coins = coinsForLevel(level.kind, fraction, stars > 0, wasPassed, level.stage);
      unlocked = addCoins(child.wallet, coins).unlocked;
    }
  });
  return { coins, unlocked };
}

function pauseSheet(app: App, child: Child, clock: Clock, onResume: () => void, onLeave: () => void): void {
  clock.accrue();
  const { result } = app.sheet(`<h2>Paused</h2><p>The battle will wait for you.</p>`, [
    { label: 'Keep fighting', value: 'resume', kind: 'mint', back: true },
    { label: 'Run away', value: 'leave', kind: 'ghost' },
  ], 'Paused');
  void result.then((v) => {
    if (v === 'leave') {
      onLeave();
      app.save.update(() => {
        remember(child, [], Date.now(), app.today);
        addPlayTime(child.wallet, app.today, clock.seconds, app.save.data.settings.limitMinutes);
      });
      clock.ms = 0;
      goHome(app);
      return;
    }
    clock.resume();
    onResume();
  });
}

// ── minion review ──────────────────────────────────────────────────────────

function minionScreen(app: App, child: Child, level: Extract<Level, { kind: 'review' }>): Screen {
  const rng = createRng(`${child.id}:${level.id}:${Date.now()}`);
  const round = makeRound(level, skillById, child.progress, rng, [], [], child.challenge ?? 0);
  const first = skillById(level.skillIds[0])!;
  const little = first.stage <= 2;
  const minion = minionFor(level.stage, level.n);
  // Reviews are asked as big choices so the fight keeps its pace.
  const questions = round.questions;
  const el = html(`<section class="screen fight minion-fight" style="${worldVars(level.stage)}" aria-label="Minion battle">
    ${ambientHtml(level.stage, 6)}
    <header class="play-top">
      <button class="icon-btn quit" aria-label="Pause">${ICONS.pause}</button>
      <div class="play-title"><b>Minion battle</b><span>Get all 10 right!</span></div>
      <span style="width:50px"></span>
    </header>
    <div class="arena">
      <div class="minion"><span class="m-body">${minion}</span><div class="m-hp" aria-label="Minion health">${questions.map(() => '<i></i>').join('')}</div></div>
    </div>
    <main class="qwrap" aria-live="polite"></main>
    <footer class="answers"></footer>
    <div class="hero-spot">${avatarHtml(child.avatar, 56)}</div>
  </section>`);
  const qwrap = el.querySelector<HTMLElement>('.qwrap')!;
  const answers = el.querySelector<HTMLElement>('.answers')!;
  const body = el.querySelector<HTMLElement>('.m-body')!;
  const pips = [...el.querySelectorAll<HTMLElement>('.m-hp i')];
  const clock = new Clock();
  let i = 0;
  let correct = 0;
  let over = false;

  const next = () => renderQuestion(app, qwrap, answers, questions[i], (v, b) => void answer(v, b), little);

  const answer = async (value: string, btn?: HTMLElement) => {
    const q = questions[i];
    const ok = isCorrect(q, value);
    app.voice.stop();
    markAnswers(answers, q, btn, ok);
    if (ok) {
      correct++;
      app.sfx.correct(correct);
      app.haptics.match(correct);
      const from = (btn ?? qwrap).getBoundingClientRect();
      const to = body.getBoundingClientRect();
      await projectile('⭐', { x: from.x + from.width / 2, y: from.y }, { x: to.x + to.width / 2, y: to.y + to.height / 2 }, 'arc', 420);
      app.sfx.hit(false);
      app.fx.burst(to.x + to.width / 2, to.y + to.height / 2, '#FFD25A', 16);
      pips[i]?.classList.add('gone');
      if (!reducedMotion()) body.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'translateX(10px) rotate(8deg) scale(.9)', filter: 'brightness(2)' }, { transform: 'none', filter: 'brightness(1)' }], { duration: 380, easing: EASE_OUT });
      await wait(350);
    } else {
      app.sfx.wrong();
      pips[i]?.classList.add('miss');
      if (!reducedMotion()) body.animate([{ transform: 'none' }, { transform: 'translateY(-18px) scale(1.1)' }, { transform: 'none' }], { duration: 500, easing: EASE_OUT });
      const reveal = html(`<div class="reveal">The answer is <b>${prettyAnswer(q.answer)}</b></div>`);
      qwrap.firstElementChild!.appendChild(reveal);
      popIn(reveal);
      if (little) app.voice.say(`The answer is ${q.answer}.`);
      await wait(1600);
    }
    i++;
    if (i >= questions.length) return finish();
    next();
  };

  const finish = async () => {
    over = true;
    clock.accrue();
    const stars = starsFor(correct, questions.length, round.rules.passMark);
    if (stars > 0) {
      app.sfx.fanfare();
      if (!reducedMotion()) await body.animate([{ transform: 'none' }, { transform: 'rotate(720deg) scale(0)', opacity: 0 }], { duration: 900, easing: EASE_OUT, fill: 'forwards' }).finished;
      const r = body.getBoundingClientRect();
      app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 60);
    } else {
      app.sfx.sad();
      if (!reducedMotion()) await body.animate([{ transform: 'none' }, { transform: 'translateX(-30px) rotate(-10deg)' }, { transform: 'translateX(400px)', opacity: 0 }], { duration: 900, easing: EASE_OUT, fill: 'forwards' }).finished;
    }
    const { coins, unlocked } = settle(app, child, level, questions, correct, stars, clock.seconds, correct / questions.length);
    void app.show(resultScreen(child, level, { stars, score: correct, total: questions.length, coins, unlocked, timeUp: timeState(app, child) !== 'ok', title: stars ? 'Minion beaten!' : 'The minion ran away!' }));
  };

  const pause = () => {
    if (over) return;
    pauseSheet(app, child, clock, () => undefined, () => (over = true));
  };
  el.querySelector('.quit')!.addEventListener('click', pause);
  return {
    el,
    keepAwake: true,
    mounted: () => {
      popIn(el.querySelector('.minion')!, 100, 0.3);
      clock.resume();
      next();
    },
    back: () => {
      pause();
      return true;
    },
    pause,
    destroy: () => app.voice.stop(),
  };
}

// ── boss battle ────────────────────────────────────────────────────────────

function bossScreen(app: App, child: Child, level: Extract<Level, { kind: 'boss' }>): Screen {
  const def = bossFor(level.stage, level.boss);
  const fight = new Fight(def);
  const rng = createRng(`${child.id}:${level.id}:${Date.now()}`);
  const phases = level.phases.map((ids) => ids.map((id) => skillById(id)!).filter(Boolean));
  const little = level.stage <= 2;
  const view = new BossView(def.id, app.fx);
  const el = html(`<section class="screen fight boss-fight" style="${worldVars(level.stage)}" aria-label="Boss battle: ${esc(def.name)}">
    ${ambientHtml(level.stage, 6)}
    <header class="play-top">
      <button class="icon-btn quit" aria-label="Pause">${ICONS.pause}</button>
      <div class="boss-hp"><b>${esc(def.name)}</b><div class="hp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i class="hp-lag"></i><i class="hp-fill"></i><span class="tick" style="left:66%"></span><span class="tick" style="left:33%"></span></div></div>
      <span style="width:50px"></span>
    </header>
    <div class="arena"><div class="speech" hidden></div></div>
    <div class="timer"><i></i></div>
    <main class="qwrap" aria-live="polite"></main>
    <footer class="answers"></footer>
    <div class="hero-bar"><span class="hero">${avatarHtml(child.avatar, 48)}</span><span class="hearts" aria-label="Hearts">${Array.from({ length: FIGHT.hearts }, () => `<i class="heart">❤️</i>`).join('')}</span><span class="streak" aria-label="Streak"></span></div>
  </section>`);
  const arena = el.querySelector<HTMLElement>('.arena')!;
  arena.appendChild(view.el);
  const qwrap = el.querySelector<HTMLElement>('.qwrap')!;
  const answers = el.querySelector<HTMLElement>('.answers')!;
  const fill = el.querySelector<HTMLElement>('.hp-fill')!;
  const lag = el.querySelector<HTMLElement>('.hp-lag')!;
  const hpBar = el.querySelector<HTMLElement>('.hp-bar')!;
  const timerBar = el.querySelector<HTMLElement>('.timer i')!;
  const heroBar = el.querySelector<HTMLElement>('.hero-bar')!;
  const speech = el.querySelector<HTMLElement>('.speech')!;
  const clock = new Clock();
  const asked: Question[] = [];
  const seen = new Set<string>();
  let correct = 0;
  let over = false;
  let timer: Animation | null = null;
  let timeout = 0;
  let askedAt = 0;
  let allowed = 10;
  let current: Question | null = null;

  const say = async (text: string, ms = 2200) => {
    speech.hidden = false;
    speech.textContent = text;
    popIn(speech, 0, 0.5);
    app.voice.say(text);
    await wait(ms);
    speech.hidden = true;
  };

  const paintHp = () => {
    fill.style.transform = `scaleX(${fight.hp / FIGHT.hp})`;
    hpBar.setAttribute('aria-valuenow', String(fight.hp));
    setTimeout(() => (lag.style.transform = `scaleX(${fight.hp / FIGHT.hp})`), 420);
  };
  const paintHearts = () => el.querySelectorAll('.heart').forEach((h, k) => h.classList.toggle('lost', k >= fight.hearts));
  const paintStreak = () => {
    const s = el.querySelector<HTMLElement>('.streak')!;
    s.innerHTML = fight.streak ? `${'⚡'.repeat(fight.streak)}<small>${FIGHT.streakForSpecial - fight.streak} to SUPER</small>` : '';
  };

  const nextQuestion = () => {
    const mode = fight.mode;
    const pool = phases[Math.min(fight.phase, phases.length - 1)].length ? phases[Math.min(fight.phase, phases.length - 1)] : phases.flat();
    const skill = rng.pick(pool);
    const d = (mode === 'defend' ? 0.4 : 0.5 + 0.15 * fight.phase + 0.2 * rng.next()) + 0.15 * (child.challenge ?? 0);
    const q = makeQuestion(skill, rng, Math.min(1, d), new Set([...seen, ...(child.progress.history[skill.id] ?? [])]), skill.format === 'picture' ? 3 : 4, asked.at(-1)?.key);
    seen.add(q.key);
    current = q;
    asked.push(q);
    el.classList.toggle('defending', mode === 'defend');
    renderQuestion(app, qwrap, answers, q, (v, b) => void answer(v, b), little, mode);
    allowed = fightTime(skill.speedSec, level.stage, mode);
    timer?.cancel();
    timer = timerBar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: allowed * 1000, easing: 'linear', fill: 'forwards' });
    clearTimeout(timeout);
    timeout = window.setTimeout(() => void answer('__timeout__'), allowed * 1000);
    askedAt = performance.now();
  };

  const answer = async (value: string, btn?: HTMLElement) => {
    if (over || !current) return;
    const q = current;
    current = null;
    clearTimeout(timeout);
    timer?.pause();
    const used = value === '__timeout__' ? 1 : (performance.now() - askedAt) / (allowed * 1000);
    const ok = value !== '__timeout__' && isCorrect(q, value);
    if (ok) correct++;
    app.voice.stop();
    markAnswers(answers, q, btn, ok);
    answers.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    const mode = fight.mode;
    const events = fight.answer(ok, Math.min(used, 1.5));
    await play(events, mode, btn);
    if (fight.status === 'won') return win();
    if (fight.status === 'lost') return lose(q);
    if (!ok) {
      const reveal = html(`<div class="reveal">${value === '__timeout__' ? 'Too slow! ' : ''}It was <b>${prettyAnswer(q.answer)}</b></div>`);
      qwrap.firstElementChild?.appendChild(reveal);
      popIn(reveal);
      await wait(1200);
    }
    nextQuestion();
  };

  const play = async (events: FightEvent[], mode: 'attack' | 'defend', btn?: HTMLElement) => {
    const from = (btn ?? answers).getBoundingClientRect();
    const hero = heroBar.getBoundingClientRect();
    for (const e of events) {
      switch (e.type) {
        case 'hit':
          app.sfx.hit(e.critical);
          app.haptics.match(e.critical ? 4 : 2);
          await view.hit(from, e.damage, e.critical, el);
          paintHp();
          break;
        case 'special':
          app.sfx.hit(true);
          app.sfx.fanfare();
          app.haptics.win();
          await view.special(el, e.damage);
          paintHp();
          break;
        case 'miss':
          app.sfx.wrong();
          view.miss();
          await wait(300);
          break;
        case 'block':
          await view.attack(hero);
          app.sfx.block();
          app.haptics.match(3);
          view.defend(true, hero, el);
          await wait(500);
          break;
        case 'hurt':
          await view.attack(hero);
          app.sfx.hurt();
          app.haptics.lose();
          view.defend(false, hero, el);
          paintHearts();
          await wait(600);
          break;
        case 'phase':
          screenShake(el, 1.6);
          view.phase(e.phase, el);
          await say(e.phase === 1 ? 'You think you can beat me? Watch this!' : 'This is my final form!', 1800);
          break;
        case 'win':
        case 'lose':
          break;
      }
    }
    paintStreak();
    void mode;
  };

  const win = async () => {
    over = true;
    clock.accrue();
    timer?.cancel();
    qwrap.innerHTML = '';
    answers.innerHTML = '';
    app.sfx.fanfare();
    app.haptics.win();
    await view.defeat(el);
    await say(def.outro, 2000);
    const r = arena.getBoundingClientRect();
    app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 120, 1.4);
    await wait(900);
    const stars = (fight.hearts >= 3 ? 3 : fight.hearts === 2 ? 2 : 1) as 1 | 2 | 3;
    const { coins, unlocked } = settle(app, child, level, asked, correct, stars, clock.seconds, bossFraction(fight.hearts), def.id);
    void app.show(resultScreen(child, level, { stars, score: correct, total: asked.length, coins, unlocked, timeUp: timeState(app, child) !== 'ok', title: `${def.name} defeated!` }));
  };

  const lose = async (q: Question) => {
    over = true;
    clock.accrue();
    timer?.cancel();
    app.sfx.sad();
    qwrap.innerHTML = `<article class="qcard"><h2 class="prompt">Out of hearts!</h2><p class="subtitle">The answer was <b>${prettyAnswer(q.answer)}</b>. Practise a little and come back stronger.</p></article>`;
    answers.innerHTML = '';
    await say('Ha! Come back when you are ready!', 2000);
    const { coins, unlocked } = settle(app, child, level, asked, correct, 0, clock.seconds, 0);
    void app.show(resultScreen(child, level, { stars: 0, score: correct, total: asked.length, coins, unlocked, timeUp: timeState(app, child) !== 'ok', title: 'The boss won this time' }));
  };

  const pause = () => {
    if (over) return;
    clearTimeout(timeout);
    timer?.pause();
    pauseSheet(
      app,
      child,
      clock,
      () => {
        if (!current || !timer) return;
        const left = (timer.effect?.getComputedTiming().duration as number) - (timer.currentTime as number);
        askedAt = performance.now() - (allowed * 1000 - left);
        timer.play();
        timeout = window.setTimeout(() => void answer('__timeout__'), Math.max(0, left));
      },
      () => (over = true),
    );
  };
  el.querySelector('.quit')!.addEventListener('click', pause);

  const intro = async () => {
    stagger([el.querySelector('.play-top')!, heroBar], { gap: 100 });
    await view.enter();
    await say(def.intro, 2600);
    const banner = html(`<div class="fight-banner">FIGHT!</div>`);
    el.appendChild(banner);
    app.sfx.whoosh();
    if (!reducedMotion()) await banner.animate([{ transform: 'translate(-50%,-50%) scale(3)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }], { duration: 1100, easing: EASE_OUT }).finished;
    banner.remove();
    clock.resume();
    if (!over) nextQuestion();
  };

  return {
    el,
    keepAwake: true,
    mounted: () => void intro(),
    back: () => {
      pause();
      return true;
    },
    pause,
    destroy: () => {
      over = true;
      clearTimeout(timeout);
      timer?.cancel();
      app.voice.stop();
    },
  };
}
