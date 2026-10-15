// App shell: shared services (save, sound, voice, haptics, photos), screen switching with
// premium transitions, the Android back button, toasts and the grown-up check.

import { SaveStore, browserStorage, type Child, type StorageAdapter } from '../storage/save.ts';
import { Sfx } from '../audio/sfx.ts';
import { Voice } from '../platform/voice.ts';
import { Haptics } from '../platform/haptics.ts';
import { quietly, setSystemBarStyle, type StudyHardPlugin } from '../platform/native.ts';
import { Photos } from '../storage/photos.ts';
import { Fx } from '../render/fx.ts';
import { liquidWipe, reducedMotion, EASE_OUT } from '../render/motion.ts';
import { dayKey } from '../core/economy.ts';
import { AREAS } from '../core/areas/index.ts';
import { buildPath, type Level } from '../core/path.ts';
import { setPace } from '../core/rewards.ts';

export interface Screen {
  el: HTMLElement;
  /** World colours for the liquid transition into this screen. */
  colors?: [string, string];
  mounted?(): void;
  destroy?(): void;
  /** Android back. Return true if handled. */
  back?(): boolean;
  /** App went to the background. */
  pause?(): void;
  keepAwake?: boolean;
}

export type ScreenMaker = (app: App) => Screen;

export class App {
  readonly root: HTMLElement;
  readonly save: SaveStore;
  readonly sfx: Sfx;
  readonly voice: Voice;
  readonly haptics: Haptics;
  readonly photos: Photos;
  readonly native: StudyHardPlugin | null;
  readonly debug: boolean;
  readonly fx: Fx;
  readonly path: Level[];
  private current: Screen | null = null;
  private exitUntil = -Infinity;
  private busy = false;
  /** A screen asked for during a transition: shown as soon as the transition ends. */
  private pending: { make: ScreenMaker; how: 'fade' | 'liquid' } | null = null;

  constructor(root: HTMLElement, storage: StorageAdapter = browserStorage(), native: StudyHardPlugin | null = null) {
    this.root = root;
    this.native = native;
    this.save = new SaveStore(storage);
    this.debug = new URLSearchParams(location.search).has('debug');
    const st = this.save.data.settings;
    setPace(st.treatPace, st.goalPace);
    this.sfx = new Sfx(st.sound);
    this.voice = new Voice(st.voice, native, st.voiceName, st.voiceRate);
    this.haptics = new Haptics(st.vibration, native);
    this.photos = new Photos(native);
    this.path = buildPath(AREAS[0]);
    this.fx = new Fx(document.body);
    addEventListener('resize', () => this.fx.resize());
    if (native) {
      setSystemBarStyle(true);
      try {
        native.addListener('back', () => this.back());
      } catch {
        /* older shell */
      }
    }
    const unlock = () => this.sfx.unlock();
    for (const t of ['pointerdown', 'keydown'] as const) document.addEventListener(t, unlock, { capture: true });
    document.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) {
        this.sfx.tap();
        this.haptics.tap();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.current?.pause?.();
        this.save.save();
        this.sfx.suspend();
        this.voice.stop();
      } else this.sfx.resume();
    });
    if (this.save.loadedFrom === 'backup') this.toast('Progress was restored from a backup copy.');
    if (this.save.loadedFrom === 'reset') this.toast('Saved progress could not be read, so the app started fresh.');
  }

  get today(): string {
    return dayKey();
  }

  get child(): Child | undefined {
    return this.save.child();
  }

  /** Show a screen. `liquid` pours the next screen's colours over the old one. */
  async show(make: ScreenMaker, how: 'fade' | 'liquid' = 'fade'): Promise<void> {
    if (this.busy) {
      this.pending = { make, how };
      return;
    }
    this.busy = true;
    try {
      const next = make(this);
      const swap = () => {
        this.current?.destroy?.();
        this.current?.el.remove();
        this.voice.stop();
        this.current = next;
        this.root.appendChild(next.el);
        if (this.native) quietly(this.native.keepAwake({ on: !!next.keepAwake }));
      };
      if (how === 'liquid' && this.current) {
        const [a, b] = next.colors ?? ['#5CC8FF', '#2457C9'];
        await liquidWipe(this.root, a, b, swap);
      } else {
        swap();
        if (!reducedMotion()) next.el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE_OUT });
      }
      next.mounted?.();
    } finally {
      this.busy = false;
    }
    const queued = this.pending;
    this.pending = null;
    if (queued) await this.show(queued.make, 'fade');
  }

  /** Android back: close a sheet, let the screen decide, use its back arrow, or press-twice to leave. */
  back(): void {
    const sheets = this.root.querySelectorAll<HTMLElement>('.overlay');
    const top = sheets[sheets.length - 1];
    if (top) {
      top.querySelector<HTMLButtonElement>('[data-back]')?.click();
      return;
    }
    if (this.current?.back?.()) return;
    const arrow = this.current?.el.querySelector<HTMLButtonElement>('.back-btn');
    if (arrow) {
      arrow.click();
      return;
    }
    const now = performance.now();
    if (now < this.exitUntil) {
      this.exitUntil = -Infinity;
      this.save.save();
      if (this.native) quietly(this.native.exit());
      return;
    }
    this.exitUntil = now + this.toast('Press back again to leave', 3200);
  }

  toast(text: string, ms = 3200): number {
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    this.root.appendChild(t);
    if (!reducedMotion()) t.animate([{ opacity: 0, transform: 'translate(-50%,12px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 300, easing: EASE_OUT });
    setTimeout(() => t.remove(), ms);
    return ms;
  }

  /** A sheet that slides up; resolves with the chosen action's value. */
  sheet<T>(body: string, actions: { label: string; value: T; kind?: 'primary' | 'ghost' | 'mint'; back?: boolean }[], label: string): { el: HTMLElement; result: Promise<T> } {
    const ov = html(`<div class="overlay" role="dialog" aria-modal="true" aria-label="${label}"><div class="sheet">${body}<div class="actions"></div></div></div>`);
    const list = ov.querySelector('.actions')!;
    let done!: (v: T) => void;
    const result = new Promise<T>((r) => (done = r));
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = `btn ${a.kind === 'ghost' ? 'ghost' : a.kind === 'mint' ? 'mint' : ''}`;
      b.textContent = a.label;
      if (a.back) b.dataset.back = '';
      b.addEventListener('click', () => {
        close();
        done(a.value);
      });
      list.appendChild(b);
    }
    const close = () => {
      if (reducedMotion()) return ov.remove();
      ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished.then(() => ov.remove());
    };
    this.root.appendChild(ov);
    if (!reducedMotion()) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      ov.querySelector('.sheet')!.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(-6px)', offset: 0.75 }, { transform: 'none' }], { duration: 520, easing: EASE_OUT });
    }
    return { el: ov, result };
  }

  /** The grown-up check: type the answer to a 2-digit × 1-digit sum. Three misses lock it for 30 s. */
  grownUp(reason = 'For grown-ups'): Promise<boolean> {
    return grownUpCheck(this, reason);
  }
}

let lockedUntil = 0;
let misses = 0;

function grownUpCheck(app: App, reason: string): Promise<boolean> {
  if (Date.now() < lockedUntil) {
    app.toast(`Please wait ${Math.ceil((lockedUntil - Date.now()) / 1000)} seconds and try again.`);
    return Promise.resolve(false);
  }
  const a = 12 + Math.floor(Math.random() * 87);
  const b = 3 + Math.floor(Math.random() * 7);
  return new Promise((resolve) => {
    const ov = html(`<div class="overlay" role="dialog" aria-modal="true" aria-label="Grown-up check"><div class="sheet grownup">
      <p class="chip">🔒 ${reason}</p>
      <h2>What is ${a} × ${b}?</h2>
      <div class="gu-input" aria-live="polite">&nbsp;</div>
      <div class="pad gu-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => (k === '' ? '<span></span>' : `<button type="button" class="key" data-k="${k}">${k}</button>`)).join('')}</div>
      <div class="actions"><button class="btn mint ok">Check</button><button class="btn ghost" data-back>Cancel</button></div>
    </div></div>`);
    const input = ov.querySelector<HTMLElement>('.gu-input')!;
    let typed = '';
    const paint = () => (input.textContent = typed || ' ');
    ov.querySelector('.gu-pad')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (!k) return;
      typed = k === '⌫' ? typed.slice(0, -1) : (typed + k).slice(0, 4);
      paint();
    });
    const finish = (ok: boolean) => {
      ov.remove();
      resolve(ok);
    };
    ov.querySelector('.ok')!.addEventListener('click', () => {
      if (Number(typed) === a * b) {
        misses = 0;
        finish(true);
      } else {
        misses++;
        if (misses >= 3) {
          misses = 0;
          lockedUntil = Date.now() + 30_000;
          app.toast('Too many tries. Locked for 30 seconds.');
          finish(false);
        } else {
          typed = '';
          paint();
          input.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 300 });
        }
      }
    });
    ov.querySelector('[data-back]')!.addEventListener('click', () => finish(false));
    app.root.appendChild(ov);
  });
}

/** Build an element from an HTML string. */
export function html(markup: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as HTMLElement;
}

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
