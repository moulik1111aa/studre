// MN Swipe: an endless, full-screen feed of quick maths for anyone (no child profile, no coins).
// Swipe up for the next card. A right answer builds a streak (and the music); a wrong one brings
// the same question back, solved, on the next card. Every few cards there's a fun fact.
// Parents switch it on in the Parent area (App → MN Swipe); until then it isn't on the home screen.

import { html, esc, type App, type Screen } from './app.ts';
import { AREAS, allSkills } from '../core/areas/index.ts';
import { makeQuestion } from '../core/path.ts';
import { createRng } from '../core/rng.ts';
import { isCorrect, type Question } from '../core/question.ts';
import type { Skill } from '../core/skill.ts';
import { FACTS } from '../core/facts/index.ts';
import { visualHtml, optionHtml } from './visuals.ts';
import { ICONS } from './icons.ts';
import { Music, TRACKS } from '../audio/music.ts';
import { reducedMotion } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';

type Band = 'all' | 'young' | 'mid' | 'old';
const BANDS: { id: Band; label: string; stages: number[] }[] = [
  { id: 'all', label: 'All ages', stages: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'young', label: '3–6', stages: [1, 2] },
  { id: 'mid', label: '7–10', stages: [3, 4] },
  { id: 'old', label: '11–16', stages: [5, 6, 7] },
];
const AGES = ['', '3–4', '5–6', '7–8', '9–10', '11–12', '13–14', '15–16'];
/** The film's three styles plus two solid colours: each question card takes the next one. */
const LOOKS = ['cobalt', 'paper', 'print', 'tomato', 'ink'] as const;
/** A stretch break is offered once, after this long. */
const BREAK_MS = 15 * 60_000;

const SKILLS = allSkills();
const stageOf = new Map<string, number>();
AREAS.forEach((a) => a.skills.forEach((list, i) => list.forEach((s) => stageOf.set(s.id, i + 1))));
const stageFor = (s: Skill) => stageOf.get(s.id) ?? s.stage ?? 1;

const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.6 3.2-1.6 4.9-3 6.6C7.6 10.9 7 12.4 7 14a5 5 0 0 0 10 0c0-2.3-1.2-3.7-2-4.6.1 1.4-.4 2.4-1.3 2.9.4-3.8-.9-7.3-1.7-9.8z" fill="currentColor"/></svg>';
const NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5V6l11-2.5v12.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18.5" r="2.6" fill="currentColor"/><circle cx="17.5" cy="16" r="2.6" fill="currentColor"/></svg>';
const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Whether MN Swipe is on the home screen (a parent switches it on). */
export const swipeOn = (app: App): boolean => !!app.save.data.settings.swipeOn;

/** The home-screen button. */
export const swipeEntryHtml = (): string =>
  `<button class="sw-entry"><span class="sw-e-stack" aria-hidden="true"><i></i><i></i><i>${UP}</i></span><span class="sw-e-t"><b>MN Swipe</b><small>Endless quick maths with music. Swipe up and beat your streak.</small></span></button>`;

interface QCard {
  kind: 'q';
  q: Question;
  skill: Skill;
  done: boolean;
}

export function swipeScreen(app: App): Screen {
  const st = app.save.data.settings;
  const rng = createRng(Date.now() % 2147483647);
  const seen = new Set<string>();
  let band: Band = (st.swipeBand as Band) ?? 'all';
  let streak = 0;
  let best = st.swipeBest ?? 0;
  let made = 0;
  let looks = Math.floor(rng.next() * LOOKS.length);
  let nextFact = 4 + Math.floor(rng.next() * 3);
  let started = 0;
  let breakShown = false;
  const music = new Music();
  let musicOn = st.swipeMusic !== false && st.sound !== false;
  music.setMuted(!musicOn);
  const cards = new Map<HTMLElement, QCard>();

  const el = html(`<section class="screen swipe" aria-label="MN Swipe">
    <div class="sw-feed" role="feed" aria-label="Questions"></div>
    <div class="sw-hud">
      <button class="sw-btn sw-x" aria-label="Close">${ICONS.cross}</button>
      <div class="sw-bands" role="radiogroup" aria-label="Ages">${BANDS.map((b) => `<button class="sw-band${b.id === band ? ' on' : ''}" role="radio" aria-checked="${b.id === band}" data-b="${b.id}">${b.label}</button>`).join('')}</div>
    </div>
    <div class="sw-rail">
      <div class="sw-streak" aria-live="polite"><span class="sw-flame">${FLAME}</span><b>0</b><small>Best ${best}</small></div>
      <button class="sw-btn sw-track" aria-label="Change the music"><span>${NOTE}</span><small>${TRACKS[st.swipeTrack ?? 0]?.name ?? TRACKS[0].name}</small></button>
      <button class="sw-btn sw-mute" aria-label="${musicOn ? 'Music off' : 'Music on'}">${musicOn ? SOUND_ON : SOUND_OFF}</button>
    </div>
  </section>`);
  const feed = el.querySelector<HTMLElement>('.sw-feed')!;
  const streakEl = el.querySelector<HTMLElement>('.sw-streak')!;
  music.setTrack(st.swipeTrack ?? 0);

  // ── making cards ───────────────────────────────────────────────────────
  const pool = () => {
    const stages = BANDS.find((b) => b.id === band)!.stages;
    return SKILLS.filter((s) => stages.includes(stageFor(s)));
  };
  const pickQuestion = (): QCard | null => {
    const list = pool();
    for (let tries = 0; tries < 12; tries++) {
      const skill = list[Math.floor(rng.next() * list.length)];
      try {
        const q = makeQuestion(skill, rng, 0.15 + rng.next() * 0.7, seen, 4);
        if (q.prompt.length > 120 || q.choices.length < 3) continue;
        seen.add(q.key);
        return { kind: 'q', q, skill, done: false };
      } catch {
        // A rare skill that can't make a 4-choice question: try another.
      }
    }
    return null;
  };
  // In debug builds the right option is marked, so browser tests can play.
  const debugRight = app.debug;
  const questionHtml = (c: QCard, look: string) => {
    const q = c.q;
    const age = AGES[stageFor(c.skill)] ?? '';
    return `<article class="sw-card sw-q look-${look}" aria-label="Question">
      <div class="sw-in">
        <p class="sw-tag">${esc(c.skill.name)}${age ? ` · age ${age}` : ''}</p>
        ${q.visual ? `<div class="sw-plate">${visualHtml(q.visual, q.key)}</div>` : ''}
        <h2 class="sw-prompt${q.prompt.length > 60 ? ' long' : ''}">${esc(q.prompt)}</h2>
        <div class="sw-choices${q.optionObject || q.optionVisuals ? ' pics' : ''}">${q.choices.map((ch) => `<button class="sw-c" data-v="${encodeURIComponent(ch)}"${debugRight && isCorrect(q, ch) ? ' data-right' : ''} aria-label="${esc(ch)}">${optionHtml(ch, q.optionObject, q.optionVisuals)}</button>`).join('')}</div>
      </div>
    </article>`;
  };
  /** After a wrong answer: the same question, solved, in a different layout. */
  const answerHtml = (q: Question, picked: string) => {
    let how: string[] = [];
    try {
      const lesson = q.teach?.();
      how = (lesson?.steps ?? []).slice(0, 3).map((s) => `${esc(s.say)}${s.math?.length ? `<span class="sw-math">${s.math.map(esc).join('<br>')}</span>` : ''}`);
    } catch {
      how = [];
    }
    if (!how.length && q.hint) how = [esc(q.hint)];
    return `<article class="sw-card sw-a" aria-label="The answer">
      <div class="sw-in">
        <p class="sw-tag">Here’s the answer</p>
        <div class="sw-a-q">${q.visual ? `<div class="sw-plate small">${visualHtml(q.visual, `${q.key}-a`)}</div>` : ''}<p>${esc(q.prompt)}</p></div>
        <div class="sw-a-big"><span>${optionHtml(q.answer, q.optionObject, q.optionVisuals)}</span></div>
        <p class="sw-yours">You picked <s>${esc(picked)}</s></p>
        ${how.length ? `<ol class="sw-how">${how.map((h) => `<li>${h}</li>`).join('')}</ol>` : ''}
        <p class="sw-next">${UP} Swipe up for the next one</p>
      </div>
    </article>`;
  };
  const factHtml = (t: string) => `<article class="sw-card sw-fact" aria-label="Fun fact"><div class="sw-in"><p class="sw-tag">Did you know?</p><p class="sw-fact-t">${esc(t)}</p><p class="sw-next">${UP} Swipe up</p></div></article>`;
  const streakHtml = (n: number) => `<article class="sw-card sw-win" aria-label="${n} in a row"><div class="sw-in"><p class="sw-win-n">${n}</p><p class="sw-win-t">in a row!</p><p class="sw-win-b">${n >= best ? 'Your best yet' : `Best: ${best}`}</p><p class="sw-next">${UP} Keep going</p></div></article>`;
  const breakHtml = () => `<article class="sw-card sw-break" aria-label="A break"><div class="sw-in"><p class="sw-tag">15 minutes of maths</p><p class="sw-fact-t">Time to stretch? Stand up, roll your shoulders, look out of a window.</p><div class="sw-break-b"><button class="sw-pill sw-done">Done for now</button><button class="sw-pill ghost sw-more">Keep going</button></div></div></article>`;
  const introHtml = () => `<article class="sw-card sw-intro" aria-label="MN Swipe"><div class="sw-in"><p class="sw-logo">MN <span>Swipe</span></p><p class="sw-intro-t">Quick maths, one card at a time. Tap an answer. Swipe up for the next.</p><p class="sw-intro-s">Get a streak going and the music builds with it.</p><p class="sw-next big">${UP} Swipe up to start</p></div></article>`;

  const add = (markup: string, after?: HTMLElement): HTMLElement => {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    const card = t.content.firstElementChild as HTMLElement;
    if (after) after.after(card);
    else feed.appendChild(card);
    observer.observe(card);
    return card;
  };
  const addNext = (after?: HTMLElement): void => {
    made++;
    if (made >= nextFact) {
      nextFact = made + 5 + Math.floor(rng.next() * 3);
      add(factHtml(FACTS[Math.floor(rng.next() * FACTS.length)]), after);
      return;
    }
    const c = pickQuestion();
    if (!c) return;
    const look = LOOKS[looks++ % LOOKS.length];
    const card = add(questionHtml(c, look), after);
    cards.set(card, c);
  };
  const current = (): HTMLElement | null => feed.querySelector('.sw-card.now');
  const ensureAhead = () => {
    const cur = current();
    let ahead = 0;
    for (let n = cur?.nextElementSibling; n; n = n.nextElementSibling) ahead++;
    for (; ahead < 3; ahead++) addNext();
  };
  const goNext = () => {
    const nx = current()?.nextElementSibling as HTMLElement | null;
    if (nx) feed.scrollTo({ top: nx.offsetTop, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  // ── which card is on screen ────────────────────────────────────────────
  let lastIdx = 0;
  let lastAt = performance.now();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
        const card = e.target as HTMLElement;
        feed.querySelectorAll('.sw-card.now').forEach((c) => c !== card && c.classList.remove('now'));
        card.classList.add('now');
        const idx = [...feed.children].indexOf(card);
        if (idx > lastIdx) {
          const dt = performance.now() - lastAt;
          music.swipe(Math.min(1, 900 / Math.max(200, dt)));
          if (!started) started = Date.now();
        }
        lastIdx = idx;
        lastAt = performance.now();
        if (!breakShown && started && Date.now() - started > BREAK_MS && card.classList.contains('sw-q')) {
          breakShown = true;
          add(breakHtml(), card);
        }
        ensureAhead();
      }
    },
    { root: feed, threshold: [0.6] },
  );

  // ── answering ──────────────────────────────────────────────────────────
  const setStreak = (n: number) => {
    streak = n;
    if (n > best) {
      best = n;
      app.save.update((d) => (d.settings.swipeBest = best));
    }
    streakEl.querySelector('b')!.textContent = String(n);
    streakEl.querySelector('small')!.textContent = `Best ${best}`;
    streakEl.classList.toggle('hot', n >= 3);
    streakEl.classList.remove('pop');
    void streakEl.offsetWidth;
    if (n) streakEl.classList.add('pop');
    music.setStreak(n);
  };
  const burst = (from: HTMLElement) => {
    if (reducedMotion()) return;
    const r = from.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('i');
      p.className = 'sw-bit';
      const a = (i / 14) * Math.PI * 2;
      const d = 60 + Math.random() * 60;
      p.style.cssText = `left:${r.left - box.left + r.width / 2}px;top:${r.top - box.top + r.height / 2}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--c:${['#2140FF', '#FF4B2B', '#FFC21A', '#00B386', '#FF9EC4'][i % 5]}`;
      el.appendChild(p);
      window.setTimeout(() => p.remove(), 700);
    }
  };
  feed.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.sw-c');
    if (b) {
      const card = b.closest<HTMLElement>('.sw-card')!;
      const c = cards.get(card);
      if (!c || c.done) return;
      c.done = true;
      card.classList.add('answered');
      const v = decodeURIComponent(b.dataset.v!);
      const right = isCorrect(c.q, v);
      if (right) {
        b.classList.add('right');
        burst(b);
        setStreak(streak + 1);
        if (musicOn) music.right();
        else app.sfx.correct(Math.min(5, streak));
        if (streak > 0 && streak % 5 === 0) add(streakHtml(streak), card);
        window.setTimeout(goNext, 700);
      } else {
        b.classList.add('wrong');
        card.querySelectorAll<HTMLElement>('.sw-c').forEach((x) => isCorrect(c.q, decodeURIComponent(x.dataset.v!)) && x.classList.add('was'));
        setStreak(0);
        if (musicOn) music.wrong();
        else app.sfx.wrong();
        add(answerHtml(c.q, v), card);
        window.setTimeout(goNext, 800);
      }
      return;
    }
    if ((e.target as HTMLElement).closest('.sw-more')) goNext();
    if ((e.target as HTMLElement).closest('.sw-done')) leave();
  });
  // Music starts with the first touch (phones only play sound after one).
  const firstTouch = () => {
    if (!music.playing) music.start(music.trackIndex);
  };
  el.addEventListener('pointerdown', firstTouch);
  feed.addEventListener('scroll', firstTouch, { passive: true });

  // ── the controls ───────────────────────────────────────────────────────
  el.querySelectorAll<HTMLButtonElement>('.sw-band').forEach((b) =>
    b.addEventListener('click', () => {
      band = b.dataset.b as Band;
      app.save.update((d) => (d.settings.swipeBand = band));
      el.querySelectorAll<HTMLElement>('.sw-band').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
      // The cards ahead are made again for the new ages.
      const cur = current();
      for (let n = cur?.nextElementSibling; n; ) {
        const nx = n.nextElementSibling;
        observer.unobserve(n);
        cards.delete(n as HTMLElement);
        n.remove();
        n = nx;
      }
      ensureAhead();
    }),
  );
  el.querySelector('.sw-track')!.addEventListener('click', (e) => {
    const i = (music.trackIndex + 1) % TRACKS.length;
    music.setTrack(i);
    if (!musicOn) {
      musicOn = true;
      music.setMuted(false);
      el.querySelector('.sw-mute')!.innerHTML = SOUND_ON;
    }
    music.start(i);
    (e.currentTarget as HTMLElement).querySelector('small')!.textContent = TRACKS[i].name;
    app.save.update((d) => {
      d.settings.swipeTrack = i;
      d.settings.swipeMusic = true;
    });
  });
  el.querySelector('.sw-mute')!.addEventListener('click', (e) => {
    musicOn = !musicOn;
    music.setMuted(!musicOn);
    if (musicOn) music.start(music.trackIndex);
    const b = e.currentTarget as HTMLElement;
    b.innerHTML = musicOn ? SOUND_ON : SOUND_OFF;
    b.setAttribute('aria-label', musicOn ? 'Music off' : 'Music on');
    app.save.update((d) => (d.settings.swipeMusic = musicOn));
  });
  const leave = () => {
    music.close();
    observer.disconnect();
    void app.show(whosPlayingScreen, 'liquid');
  };
  el.querySelector('.sw-x')!.addEventListener('click', leave);

  add(introHtml()).classList.add('now');
  ensureAhead();

  if (app.debug) Object.assign(window, { __swipe: { music, next: goNext } });

  return {
    el,
    keepAwake: true,
    pause: () => music.stop(),
    destroy: () => {
      music.close();
      observer.disconnect();
    },
    back: () => {
      leave();
      return true;
    },
  };
}
