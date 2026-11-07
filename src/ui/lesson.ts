// The "learn how" lesson after a wrong answer: the question, what was given and the right
// answer, a picture that builds up, and short steps shown one at a time and read aloud.
// Next goes on; the last step's button is "Got it!". Closing (or Android back) skips it.

import { html, type App } from './app.ts';
import { isCorrect, spoken, valueOf, type Question } from '../core/question.ts';
import { lessonOf } from '../core/teach/index.ts';
import type { Board, Lesson, Step } from '../core/teach/types.ts';
import { boardHtml, setBoardStep } from './boards.ts';
import { mathHtml } from './mathtext.ts';
import { plusFaceSvg } from './plus.ts';
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
    // "5 / 2" with spaces is a division; "5/2" is a fraction.
    .replace(/([\d)])\s+\/\s+(?=[\d(])/g, '$1 divided by ')
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

/**
 * A step read aloud, line by line: the explanation, each working line, then the follow-on.
 * Working lines that only repeat what was just said aloud are skipped.
 */
const stepLines = (s: Step): string[] => {
  const out: string[] = [];
  const plain = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const line of [s.say, ...(s.math ?? []), s.after ?? '']) {
    const t = speech(line).replace(/[.\s]+$/, '');
    if (!t) continue;
    const prev = out.length ? plain(out[out.length - 1]) : '';
    if (prev && (prev === plain(t) || prev.endsWith(` ${plain(t)}`))) continue;
    out.push(t);
  }
  return out;
};

/** Whether a wrong answer to this question opens a lesson (it has one, and lessons are on). */
export const lessonFor = (app: App, q: Question): boolean => !!q.teach && app.save.data.settings.teach !== false;

/** The child's answer as a row under a column sum (the digits that differ light up). */
function withYouRow(b: Board | undefined, given: string | null, at: number): Board | undefined {
  if (!b || !given || !/^\d+$/.test(given)) return b;
  if (b.kind === 'stack') return { ...b, boards: b.boards.map((x) => withYouRow(x, given, at)!) };
  if (b.kind !== 'cols') return b;
  const ansRow = b.rows.indexOf('ans');
  if (ansRow < 0 || b.cells.some((c) => c.ch === '.')) return b;
  if (given.length > b.width) return b;
  const r = b.rows.length;
  const ans = new Map(b.cells.filter((c) => c.r === ansRow).map((c) => [c.c, c.ch]));
  const cells = given.split('').map((ch, j) => {
    const c = b.width - given.length + j;
    return { r, c, ch, at, tone: (ans.get(c) === ch ? 'you' : 'bad') as 'you' | 'bad' };
  });
  return { ...b, rows: [...b.rows, 'you'], ops: [...(b.ops ?? []), { r, ch: 'you' }], cells: [...b.cells, ...cells] };
}

/** Show the lesson for a question; resolves when it is closed. */
export function showLesson(app: App, q: Question, given: string | null): Promise<void> {
  const first = lessonOf(q);
  const note = slipNote(first, q, given);
  const timeout = given === '__timeout__';
  const child = app.child;
  // The main way and the other ways; a way that helped this child before comes first.
  let ways: Lesson[] = [first];
  try {
    ways = [first, ...(first.alts?.() ?? [])];
  } catch (e) {
    console.error('other ways failed', e);
  }
  const liked = first.family ? child?.methods?.[first.family] : undefined;
  const likedAt = liked ? ways.findIndex((w) => w.method === liked) : -1;
  if (likedAt > 0) ways = [ways[likedAt], ...ways.filter((_, k) => k !== likedAt)];
  const prompt = mathHtml(q.prompt);
  const said = given && !timeout ? `<span class="ls-you">You said <b>${shown(given)}</b></span>` : timeout ? '<span class="ls-you">Time ran out</span>' : '';
  const ov = html(`<div class="overlay lesson-ov" role="dialog" aria-modal="true" aria-label="Learn how">
    <div class="sheet lesson">
      <header class="ls-head">
        <span class="ls-coach">${plusFaceSvg({ cls: given && !timeout ? 'oops' : 'alive' })}</span>
        <div class="ls-titles"><p class="ls-kicker">${given ? 'Let’s learn how' : 'Here’s how'}</p><h2 class="ls-q">${prompt}</h2></div>
        <button class="icon-btn ls-close" data-back aria-label="Close">${ICONS.cross}</button>
      </header>
      <div class="ls-said">${said}<span class="ls-ans">Answer <b>${shown(q.answer)}</b></span><span class="ls-way" hidden></span></div>
      <div class="ls-stage"></div>
      <div class="ls-dots" role="tablist" aria-label="Steps"></div>
      <div class="ls-now" aria-live="polite"></div>
      <footer class="ls-foot"><button class="icon-btn ls-say-btn" aria-label="Read it again">${ICONS.speaker}</button><button class="ls-alt" hidden><small>↻ Another way</small><b></b></button><button class="btn ls-next">Next</button></footer>
    </div>
  </div>`);
  const FAST = app.debug && new URLSearchParams(location.search).has('fast');
  const sheet = ov.querySelector<HTMLElement>('.sheet.lesson')!;
  const stage = ov.querySelector<HTMLElement>('.ls-stage')!;
  const dots = ov.querySelector<HTMLElement>('.ls-dots')!;
  const now = ov.querySelector<HTMLElement>('.ls-now')!;
  const next = ov.querySelector<HTMLButtonElement>('.ls-next')!;
  const altBtn = ov.querySelector<HTMLButtonElement>('.ls-alt')!;
  const wayChip = ov.querySelector<HTMLElement>('.ls-way')!;
  let w = 0;
  let lesson = ways[0];
  let steps = lesson.steps;
  let i = -1;
  let reached = 0;
  let lockUntil = 0;
  let turnDone = true;

  // Shrink a tall picture (blocks above a column sum, say) to fit the space, never clip it.
  const fitBoard = () => {
    const board = stage.querySelector<HTMLElement>('.ls-board');
    const inner = board?.firstElementChild as HTMLElement | null;
    if (!board || !inner) return;
    inner.style.zoom = '';
    const cs = getComputedStyle(board);
    const room = parseFloat(cs.maxHeight) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const need = inner.scrollHeight;
    if (room > 0 && need > room) inner.style.zoom = String(Math.max(0.5, room / need));
  };
  const mount = (k: number) => {
    w = k;
    lesson = ways[k];
    steps = lesson.steps;
    i = -1;
    reached = 0;
    const board = withYouRow(lesson.board, given && !timeout ? given : null, steps.length - 1);
    stage.innerHTML = board ? `<div class="ls-board">${boardHtml(board)}</div>` : '';
    stage.hidden = !board;
    dots.innerHTML = steps.map((_, j) => `<button class="ls-dot" role="tab" aria-label="Step ${j + 1}" data-j="${j}"></button>`).join('');
    wayChip.hidden = ways.length < 2 || !lesson.method;
    wayChip.textContent = lesson.method ? `Way: ${lesson.method}` : '';
    const other = ways[(k + 1) % ways.length];
    altBtn.querySelector('b')!.textContent = k + 1 < ways.length ? other.method ?? 'Another way' : `First way: ${ways[0].method ?? ''}`;
    altBtn.querySelector('small')!.textContent = k + 1 < ways.length ? '↻ Another way' : '↺ Back to';
  };

  return new Promise<void>((resolve) => {
    const close = (done: boolean) => {
      app.voice.stop();
      // Remember the way that helped (an other way the child finished with "Got it!").
      if (done && w > 0 && child && lesson.family && lesson.method) {
        const fam = lesson.family;
        const name = lesson.method;
        app.save.update(() => ((child.methods ??= {})[fam] = name));
      }
      if (reducedMotion()) ov.remove();
      else ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => ov.remove());
      resolve();
    };
    const go = (k: number) => {
      const prev = i;
      i = k;
      reached = Math.max(reached, k);
      const st = steps[k];
      const board = stage.querySelector<HTMLElement>('.ls-board');
      if (board) setBoardStep(board, k, prev);
      dots.querySelectorAll<HTMLButtonElement>('.ls-dot').forEach((d, j) => {
        d.classList.toggle('done', j < k);
        d.classList.toggle('now', j === k);
        d.disabled = j > reached;
      });
      const last = k === steps.length - 1;
      const slip = last && note && w === 0 ? `<p class="ls-slip"><b>Here’s the slip.</b> ${mathHtml(note)}</p>` : '';
      now.innerHTML = `<p class="ls-say${st.end ? ' end' : ''}">${mathHtml(st.say)}</p>
        ${st.math ? `<div class="ls-math${st.end ? ' end' : ''}">${st.math.map((m) => `<span>${mathHtml(m)}</span>`).join('')}</div>` : ''}
        ${st.after ? `<p class="ls-after">${mathHtml(st.after)}</p>` : ''}
        ${st.turn && k === reached && prev < k ? `<div class="ls-turn"><p class="ls-turn-ask"><b>Your turn:</b> ${mathHtml(st.turn.ask)}</p><div class="ls-turn-opts">${st.turn.choices.map((c) => `<button class="ls-opt" data-v="${c}">${mathHtml(c)}</button>`).join('')}</div></div>` : ''}
        ${slip}`;
      turnDone = !(st.turn && k === reached && prev < k);
      sheet.classList.toggle('has-turn', !turnDone);
      fitBoard();
      if (!turnDone) {
        let misses = 0;
        now.querySelectorAll<HTMLButtonElement>('.ls-opt').forEach((b) =>
          b.addEventListener('click', () => {
            if (turnDone) return;
            if (b.dataset.v === st.turn!.answer) {
              b.classList.add('right');
              app.sfx.correct(1);
              turnDone = true;
              next.disabled = false;
            } else {
              b.classList.add('wrong');
              app.sfx.tap();
              if (++misses >= 2) {
                now.querySelector<HTMLElement>(`.ls-opt[data-v="${st.turn!.answer}"]`)?.classList.add('right');
                turnDone = true;
                next.disabled = false;
              }
            }
          }),
        );
      }
      next.disabled = !turnDone;
      if (!reducedMotion()) now.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE_OUT });
      next.textContent = last ? 'Got it!' : turnDone ? 'Next' : 'Your turn';
      next.classList.toggle('mint', last);
      altBtn.hidden = ways.length < 2 || k < 1;
      // A short lock stops a double tap skipping a step (browser tests can turn it off with &fast).
      lockUntil = performance.now() + (FAST ? 0 : 600);
      app.voice.sayParts([k === 0 && note && w === 0 ? speech(note) : '', ...stepLines(st), st.turn && !turnDone ? speech(st.turn.ask) : '']);
    };
    next.addEventListener('click', () => {
      if (performance.now() < lockUntil || !turnDone) return;
      if (i >= steps.length - 1) close(true);
      else go(i + 1);
    });
    dots.addEventListener('click', (e) => {
      const d = (e.target as HTMLElement).closest<HTMLButtonElement>('.ls-dot');
      if (!d || d.disabled) return;
      const j = Number(d.dataset.j);
      if (j === i) return;
      const board = stage.querySelector<HTMLElement>('.ls-board');
      // Going back redraws the picture up to that step.
      if (j < i && board) {
        mountBoardOnly();
      }
      go(j);
    });
    const mountBoardOnly = () => {
      const board = withYouRow(lesson.board, given && !timeout ? given : null, steps.length - 1);
      if (board) stage.innerHTML = `<div class="ls-board">${boardHtml(board)}</div>`;
      i = -1;
    };
    altBtn.addEventListener('click', () => {
      app.voice.stop();
      mount((w + 1) % ways.length);
      if (!reducedMotion()) stage.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE_OUT });
      go(0);
    });
    ov.querySelector('.ls-say-btn')!.addEventListener('click', () => app.voice.sayParts(stepLines(steps[Math.max(0, i)])));
    ov.querySelector('.ls-close')!.addEventListener('click', () => close(false));
    app.root.appendChild(ov);
    if (!reducedMotion()) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      ov.querySelector('.sheet')!.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(-6px)', offset: 0.75 }, { transform: 'none' }], { duration: 520, easing: EASE_OUT });
    }
    mount(0);
    go(0);
  });
}
