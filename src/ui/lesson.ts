// The "learn how" lesson after a wrong answer: the question, what was given and the right
// answer, a picture that builds up, and short steps shown one at a time and read aloud.
// Next goes on; the last step's button is "Got it!". Closing (or Android back) skips it.

import { html, type App } from './app.ts';
import { isCorrect, spoken, valueOf, type Question } from '../core/question.ts';
import { lessonOf } from '../core/teach/index.ts';
import type { Lesson, Step } from '../core/teach/types.ts';
import { boardHtml, setBoardStep } from './boards.ts';
import { mathHtml } from './mathtext.ts';
import { dogHeadSvg } from './dog.ts';
import { ICONS } from './icons.ts';
import { EMOJI, prettyAnswer } from './visuals.ts';
import { reducedMotion, EASE_OUT } from '../render/motion.ts';

/** How a value looks in the "You said / Answer" chips. */
const shown = (v: string): string => (EMOJI[v] ? EMOJI[v] : prettyAnswer(v));

/** The note for this wrong answer: a known slip, or "so close" when it is one away. */
export function slipNote(lesson: Lesson, q: Pick<Question, 'answer'>, given: string | null): string | null {
  if (!given || given === '__timeout__') return null;
  const hit = lesson.slips?.find((s) => isCorrect({ answer: s.answer }, given));
  if (hit) return hit.note;
  const a = valueOf(q.answer);
  const g = valueOf(given);
  if (Number.isFinite(a) && Number.isFinite(g) && Number.isInteger(a) && Math.abs(a - g) === 1) return 'So close — just 1 away!';
  return null;
}

const DENOM = ['', '', 'half', 'third', 'quarter', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
/** Words for reading a lesson line aloud. */
export function speech(s: string): string {
  let t = s
    .replace(/₹\s?(\d+(?:\.\d+)?)/g, '$1 rupees')
    .replace(/(\d)\s?%/g, '$1 percent')
    .replace(/°C/g, ' degrees')
    .replace(/(\d) r (\d)/g, '$1 remainder $2')
    .replace(/(?<![\d.])(\d+)\/(\d+)(?!\d|\.\d)/g, (m, n: string, d: string) => {
      const dn = Number(d);
      if (dn < 2 || dn > 12) return m;
      const word = n === '1' ? DENOM[dn] : dn === 2 ? 'halves' : `${DENOM[dn]}s`;
      return `${n} ${word}`;
    })
    .replace(/([⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]{2,}|⁻[⁰¹²³⁴⁵⁶⁷⁸⁹]+|[⁰¹⁴⁵⁶⁷⁸⁹])/g, (m) => ` to the power of ${m.replace(/./g, (c) => ({ '⁻': 'minus ', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' })[c] ?? c)} `)
    .replace(/≈/g, ' is about ')
    .replace(/≠/g, ' is not equal to ')
    .replace(/≤/g, ' is less than or equal to ')
    .replace(/≥/g, ' is greater than or equal to ')
    .replace(/(\S)\s?<\s?(\S)/g, '$1 is less than $2')
    .replace(/(\S)\s?>\s?(\S)/g, '$1 is greater than $2')
    .replace(/(\d):(\d)/g, '$1 to $2')
    .replace(/π/g, 'pi')
    .replace(/→/g, ', then ')
    .replace(/[✓✗]/g, '');
  t = spoken(t);
  return t.replace(/\s+/g, ' ').trim();
}

const stepSpeech = (s: Step): string => [s.say, ...(s.math ?? []), s.after ?? ''].map(speech).filter(Boolean).join('. ').replace(/\.\./g, '.').replace(/([?!])\./g, '$1');

/** Whether a wrong answer to this question opens a lesson (it has one, and lessons are on). */
export const lessonFor = (app: App, q: Question): boolean => !!q.teach && app.save.data.settings.teach !== false;

/** Show the lesson for a question; resolves when it is closed. */
export function showLesson(app: App, q: Question, given: string | null): Promise<void> {
  const lesson = lessonOf(q);
  const note = slipNote(lesson, q, given);
  const steps = lesson.steps;
  const timeout = given === '__timeout__';
  const prompt = mathHtml(q.prompt);
  const said = given && !timeout ? `<span class="ls-you">You said <b>${shown(given)}</b></span>` : timeout ? '<span class="ls-you">Time ran out</span>' : '';
  const ov = html(`<div class="overlay lesson-ov" role="dialog" aria-modal="true" aria-label="Learn how">
    <div class="sheet lesson">
      <header class="ls-head">
        <span class="ls-coach">${dogHeadSvg()}</span>
        <div class="ls-titles"><p class="ls-kicker">${given ? 'Let’s learn how' : 'Here’s how'}</p><h2 class="ls-q">${prompt}</h2></div>
        <button class="icon-btn ls-close" data-back aria-label="Close">${ICONS.cross}</button>
      </header>
      <div class="ls-said">${said}<span class="ls-ans">Answer <b>${shown(q.answer)}</b></span></div>
      ${note ? `<p class="ls-note">${mathHtml(note)}</p>` : ''}
      ${lesson.board ? `<div class="ls-board">${boardHtml(lesson.board)}</div>` : ''}
      <ol class="ls-steps">${steps
        .map(
          (s, i) => `<li class="ls-step${s.end ? ' end' : ''}" data-i="${i}">
            <p class="ls-say">${mathHtml(s.say)}</p>
            ${s.math ? `<div class="ls-math">${s.math.map((m) => `<span>${mathHtml(m)}</span>`).join('')}</div>` : ''}
            ${s.after ? `<p class="ls-after">${mathHtml(s.after)}</p>` : ''}
          </li>`,
        )
        .join('')}</ol>
      <footer class="ls-foot"><button class="icon-btn ls-say-btn" aria-label="Read it again">${ICONS.speaker}</button><button class="btn ls-next">Next</button></footer>
    </div>
  </div>`);
  const board = ov.querySelector<HTMLElement>('.ls-board');
  const items = [...ov.querySelectorAll<HTMLElement>('.ls-step')];
  const next = ov.querySelector<HTMLButtonElement>('.ls-next')!;
  const list = ov.querySelector<HTMLElement>('.ls-steps')!;
  let i = -1;
  let lockUntil = 0;

  return new Promise<void>((resolve) => {
    const close = () => {
      app.voice.stop();
      if (reducedMotion()) ov.remove();
      else ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => ov.remove());
      resolve();
    };
    const go = (k: number) => {
      i = k;
      items.forEach((el, j) => {
        el.classList.toggle('on', j <= k);
        el.classList.toggle('now', j === k);
      });
      if (board) setBoardStep(board, k);
      const el = items[k];
      if (!reducedMotion()) el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE_OUT });
      requestAnimationFrame(() => list.scrollTo({ top: list.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' }));
      const last = k === steps.length - 1;
      next.textContent = last ? 'Got it!' : 'Next';
      next.classList.toggle('mint', last);
      lockUntil = performance.now() + 650;
      app.voice.say((k === 0 && note ? speech(note) + ' ' : '') + stepSpeech(steps[k]));
    };
    next.addEventListener('click', () => {
      if (performance.now() < lockUntil) return;
      if (i >= steps.length - 1) close();
      else go(i + 1);
    });
    ov.querySelector('.ls-say-btn')!.addEventListener('click', () => app.voice.say(stepSpeech(steps[Math.max(0, i)])));
    ov.querySelector('.ls-close')!.addEventListener('click', close);
    app.root.appendChild(ov);
    if (!reducedMotion()) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      ov.querySelector('.sheet')!.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(-6px)', offset: 0.75 }, { transform: 'none' }], { duration: 520, easing: EASE_OUT });
    }
    go(0);
  });
}
