// The opening: a staged loader where each step's drawing draws itself line by line with a
// caption, then the Study Hard logo draws in outline and fills with colour (spec §8).
// The full sequence plays on the first launch of the day; later launches show just the logo.

import { html, type App, type Screen } from './app.ts';
import { dogSvg } from './dog.ts';
import { drawOn, wait, frame, reducedMotion, EASE_OUT } from '../render/motion.ts';

const ST = 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"';

const STAGES: { caption: string; svg: string }[] = [
  {
    caption: 'Sharpening pencils',
    svg: `<svg viewBox="0 0 64 64"><path data-draw ${ST} d="M14 50 L44 20 L52 28 L22 58 Z"/><path data-draw ${ST} d="M44 20 L49 15 C51 13 53 13 55 15 L57 17 C59 19 59 21 57 23 L52 28"/><path data-draw ${ST} d="M14 50 L10 62 L22 58"/><path data-draw ${ST} d="M18 46 L48 16"/><path data-fill fill="#FFD25A" d="M14 50 L44 20 L52 28 L22 58 Z" opacity="0"/><path data-fill fill="#FF7AA8" d="M44 20 L49 15 C51 13 53 13 55 15 L57 17 C59 19 59 21 57 23 L52 28 Z" opacity="0"/></svg>`,
  },
  {
    caption: 'Counting the stars',
    svg: `<svg viewBox="0 0 64 64"><path data-draw ${ST} d="M32 8 L38.5 23 L54.5 24.5 L42.5 35 L46 51 L32 42.5 L18 51 L21.5 35 L9.5 24.5 L25.5 23 Z"/><path data-draw ${ST} d="M52 6 L52 12 M49 9 L55 9"/><path data-draw ${ST} d="M10 48 L10 54 M7 51 L13 51"/><path data-fill fill="#FFD25A" d="M32 8 L38.5 23 L54.5 24.5 L42.5 35 L46 51 L32 42.5 L18 51 L21.5 35 L9.5 24.5 L25.5 23 Z" opacity="0"/></svg>`,
  },
  {
    caption: 'Waking up the numbers',
    svg: `<svg viewBox="0 0 64 64"><rect data-draw ${ST} x="8" y="34" width="22" height="22" rx="5"/><rect data-draw ${ST} x="34" y="34" width="22" height="22" rx="5"/><rect data-draw ${ST} x="21" y="10" width="22" height="22" rx="5"/><path data-draw ${ST} d="M17 40 L19 38 L19 50"/><path data-draw ${ST} d="M41 40 C41 37 49 37 49 41 C49 44 41 47 41 50 L49 50"/><path data-draw ${ST} d="M28 16 C30 14 36 14 36 18 C36 20 32 21 32 21 C32 21 37 21 37 25 C37 29 29 29 28 26"/><rect data-fill fill="#5CC8FF" x="8" y="34" width="22" height="22" rx="5" opacity="0"/><rect data-fill fill="#43E0A8" x="34" y="34" width="22" height="22" rx="5" opacity="0"/><rect data-fill fill="#FF7AA8" x="21" y="10" width="22" height="22" rx="5" opacity="0"/></svg>`,
  },
  {
    caption: 'Ready, set, learn!',
    svg: `<svg viewBox="0 0 64 64"><path data-draw ${ST} d="M32 6 C42 14 46 26 42 42 L22 42 C18 26 22 14 32 6 Z"/><circle data-draw ${ST} cx="32" cy="22" r="5"/><path data-draw ${ST} d="M22 34 L14 42 L14 50 L22 44"/><path data-draw ${ST} d="M42 34 L50 42 L50 50 L42 44"/><path data-draw ${ST} d="M27 46 C27 52 32 58 32 58 C32 58 37 52 37 46"/><path data-fill fill="#A879FF" d="M32 6 C42 14 46 26 42 42 L22 42 C18 26 22 14 32 6 Z" opacity="0"/><path data-fill fill="#FF8A5C" d="M27 46 C27 52 32 58 32 58 C32 58 37 52 37 46 Z" opacity="0"/></svg>`,
  },
];

/** The Study Hard mark: Biscuit, a very round dog (see dog.ts). */
export const LOGO_MARK = dogSvg({ cls: 'logo-mark' });

export function loaderScreen(next: () => void, full: boolean): (app: App) => Screen {
  return () => {
    const el = html(`<section class="screen loader" aria-label="Loading">
      <div class="ld-center">
        <div class="ld-icon" aria-hidden="true"></div>
        <p class="ld-caption" aria-live="polite"></p>
        <div class="ld-logo" hidden>${LOGO_MARK}<h1 class="wordmark"><span>Study</span> <span>Hard</span></h1></div>
      </div>
    </section>`);
    const icon = el.querySelector<HTMLElement>('.ld-icon')!;
    const caption = el.querySelector<HTMLElement>('.ld-caption')!;
    const logo = el.querySelector<HTMLElement>('.ld-logo')!;
    let cancelled = false;
    const run = async () => {
      await Promise.race([document.fonts?.ready, wait(800)]);
      if (full && !reducedMotion()) {
        for (const st of STAGES) {
          if (cancelled) return;
          icon.innerHTML = st.svg;
          caption.textContent = st.caption;
          caption.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT, fill: 'both' });
          await Promise.all([drawOn(icon.querySelector('svg')!, { duration: 650, stagger: 90 }), wait(1100)]);
          await caption.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 300, fill: 'forwards' }).finished;
          icon.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
          await wait(260);
          icon.getAnimations().forEach((a) => a.cancel());
        }
        icon.remove();
        caption.remove();
      } else {
        icon.remove();
        caption.remove();
      }
      if (cancelled) return;
      logo.hidden = false;
      await frame();
      const words = logo.querySelectorAll('.wordmark span');
      words.forEach((w, i) =>
        (w as HTMLElement).animate([{ opacity: 0, transform: 'translateY(16px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 700, delay: 700 + i * 160, easing: EASE_OUT, fill: 'backwards' }),
      );
      const mark = logo.querySelector<SVGElement>('svg')!;
      await drawOn(mark, { duration: 600, stagger: 32 });
      mark.classList.add('alive', 'hop');
      await wait(reducedMotion() ? 0 : 450);
      if (!cancelled) next();
    };
    return {
      el,
      mounted: () => void run(),
      destroy: () => {
        cancelled = true;
      },
    };
  };
}
