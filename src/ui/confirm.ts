// Answer choices: a tap answers straight away, or — when a parent turned on "Confirm
// answers" — a tap picks (and can be changed), and the Check button answers. If time runs
// out with an answer picked, the picked answer counts.

import { html, type App } from './app.ts';
import { ICONS } from './icons.ts';

export interface Wired {
  /** The picked (not yet checked) answer, if any. */
  picked(): string | undefined;
}

export function wireChoices(app: App, box: HTMLElement, onAnswer: (value: string, btn: HTMLElement) => void): Wired {
  const choices = [...box.querySelectorAll<HTMLElement>('.choice')];
  let done = false;
  let picked: HTMLElement | null = null;
  let check: HTMLButtonElement | null = null;
  const answer = (b: HTMLElement) => {
    if (done) return;
    done = true;
    if (check) check.disabled = true;
    onAnswer(decodeURIComponent(b.dataset.v!), b);
  };
  if (!app.save.data.settings.confirmAnswers) {
    for (const b of choices) b.addEventListener('click', () => answer(b));
    return { picked: () => undefined };
  }
  check = html(`<button type="button" class="btn mint check-btn" disabled>Check ${ICONS.check}</button>`) as HTMLButtonElement;
  box.appendChild(check);
  for (const b of choices) {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      if (done) return;
      picked?.classList.remove('picked');
      picked?.setAttribute('aria-pressed', 'false');
      picked = b;
      b.classList.add('picked');
      b.setAttribute('aria-pressed', 'true');
      check!.disabled = false;
    });
  }
  check.addEventListener('click', () => picked && answer(picked));
  return { picked: () => (picked && !done ? decodeURIComponent(picked.dataset.v!) : undefined) };
}
