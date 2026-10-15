// The opening: a staged loader where each step's drawing draws itself line by line with a
// caption, then the Study Hard logo draws in outline and fills with colour (spec §8).
// The full sequence plays on the first launch of the day; later launches show just the logo.

import { html, type App, type Screen } from './app.ts';
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

/** The Study Hard mark: an open book whose pages fan into a rising star. */
export const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="lgA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE58A"/><stop offset="1" stop-color="#F5A524"/></linearGradient>
    <linearGradient id="lgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FD6FF"/><stop offset="1" stop-color="#5A6CFF"/></linearGradient>
    <linearGradient id="lgC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9FC2"/><stop offset="1" stop-color="#C64CFF"/></linearGradient>
  </defs>
  <path data-fill fill="url(#lgB)" d="M60 92 C46 82 30 80 14 82 L14 40 C30 38 46 40 60 50 Z" opacity="0"/>
  <path data-fill fill="url(#lgC)" d="M60 92 C74 82 90 80 106 82 L106 40 C90 38 74 40 60 50 Z" opacity="0"/>
  <path data-fill fill="url(#lgA)" d="M60 8 L66.5 22.5 L82 24 L70.5 34.5 L74 50 L60 42 L46 50 L49.5 34.5 L38 24 L53.5 22.5 Z" opacity="0"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path data-draw d="M60 92 C46 82 30 80 14 82 L14 40 C30 38 46 40 60 50"/>
    <path data-draw d="M60 92 C74 82 90 80 106 82 L106 40 C90 38 74 40 60 50"/>
    <path data-draw d="M60 50 L60 92"/>
    <path data-draw d="M60 8 L66.5 22.5 L82 24 L70.5 34.5 L74 50 L60 42 L46 50 L49.5 34.5 L38 24 L53.5 22.5 Z"/>
    <path data-draw d="M24 52 C34 51 44 53 52 58 M24 64 C34 63 44 65 52 70 M96 52 C86 51 76 53 68 58 M96 64 C86 63 76 65 68 70"/>
  </g>
</svg>`;

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
      await drawOn(logo.querySelector('svg')!, { duration: 900, stagger: 110 });
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
