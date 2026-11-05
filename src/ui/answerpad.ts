// The answer area under a question: a number pad (with − . / and "and" when the answer
// needs them) or big choice buttons. Shared by levels and Fix-it rounds.

import type { App } from './app.ts';
import type { Question } from '../core/question.ts';
import { ICONS } from './icons.ts';
import { optionHtml, prettyAnswer } from './visuals.ts';
import { stagger } from '../render/motion.ts';
import { wireChoices } from './confirm.ts';

/**
 * Fill `answers` for `q`. `submit` gets the typed or picked value (and the button, for a
 * choice). Returns what is typed or picked but not yet sent (it counts if time runs out).
 */
export function mountAnswers(app: App, answers: HTMLElement, q: Question, isDone: () => boolean, submit: (value: string, btn?: HTMLElement) => void): () => string | undefined {
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
      if (!k || isDone()) return;
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
      if (typed) submit(typed);
    });
    stagger(answers.querySelectorAll('.key, .ok'), { gap: 18, y: 8 });
    return () => typed || undefined;
  }
  answers.innerHTML = q.choices
    .map((c) => `<button type="button" class="choice" data-v="${encodeURIComponent(c)}" aria-label="${c}">${optionHtml(c, q.optionObject)}</button>`)
    .join('');
  const wired = wireChoices(app, answers, (v, b) => {
    if (!isDone()) submit(v, b);
  });
  stagger(answers.children, { gap: 70, y: 16 });
  return wired.picked;
}

/** A question's words for the card: a real minus sign, and a/b as a small stacked fraction. */
export function escPrompt(p: string): string {
  return p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(^|[^\w])-(?=\d)/g, '$1−').replace(/(\d+)\/(\d+)/g, (_, a, b) => `<span class="frac"><sup>${a}</sup><sub>${b}</sub></span>`);
}
