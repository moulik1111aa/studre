// The grown-up lock: the phone's own screen lock (PIN, pattern or fingerprint) or a parent
// PIN set during setup. Children who can multiply can't get past it. Only when neither
// exists does it fall back to a times question. The owner's 7-digit code, typed into the
// pad, opens the hidden owner area instead (see core/access.ts).

import { html, type App, type Screen, type ScreenMaker } from './app.ts';
import { isOwnerCode } from '../core/access.ts';
import { ICONS } from './icons.ts';
import { stagger } from '../render/motion.ts';

let lockedUntil = 0;
let misses = 0;

const enc = new TextEncoder();
const b64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));

/** "salt:hash" for a PIN (SHA-256; the PIN only has to keep children out). */
export async function hashPin(pin: string, salt = b64(crypto.getRandomValues(new Uint8Array(12)))): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`studyhard-pin:${salt}:${pin}`)));
  return `${salt}:${b64(h)}`;
}
export async function pinMatches(pin: string, stored: string): Promise<boolean> {
  const [salt] = stored.split(':');
  try {
    return (await hashPin(pin, salt)) === stored;
  } catch {
    return false;
  }
}
/** A parent PIN is 4 to 6 digits (7 digits is the owner code). */
export const validPin = (pin: string): boolean => /^\d{4,6}$/.test(pin);

/** Does this phone have a screen lock the app can ask for? */
export async function phoneLockAvailable(app: App): Promise<boolean> {
  if (!app.native?.deviceSecure || !app.native.confirmDevice) return false;
  try {
    return !!(await app.native.deviceSecure()).secure;
  } catch {
    return false;
  }
}

async function askPhone(app: App, reason: string): Promise<boolean> {
  try {
    return !!(await app.native!.confirmDevice!({ title: 'Grown-ups only', text: reason })).ok;
  } catch {
    return false;
  }
}

export async function grownUpCheck(app: App, reason: string): Promise<boolean> {
  if (Date.now() < lockedUntil) {
    app.toast(`Please wait ${Math.ceil((lockedUntil - Date.now()) / 1000)} seconds and try again.`);
    return false;
  }
  const pin = app.save.data.settings.parentPin;
  const phone = await phoneLockAvailable(app);
  // No PIN and no screen lock: a times question, as before.
  const a = 12 + Math.floor(Math.random() * 87);
  const b = 3 + Math.floor(Math.random() * 7);
  const maths = !pin && !phone;
  const title = pin ? 'Enter the parent PIN' : phone ? 'Grown-ups only' : `What is ${a} × ${b}?`;
  const note = pin
    ? phone
      ? 'Or use this phone’s screen lock.'
      : ''
    : phone
      ? 'Unlock with this phone’s screen lock.'
      : 'Tip: set a parent PIN in the parent area so children can’t answer this.';
  return new Promise((resolve) => {
    const ov = html(`<div class="overlay" role="dialog" aria-modal="true" aria-label="Grown-up check"><div class="sheet grownup${maths ? ' gu-maths' : ''}">
      <p class="chip">🔒 ${reason}</p>
      <h2>${title}</h2>
      ${note ? `<p class="gu-note">${note}</p>` : ''}
      ${phone ? `<button type="button" class="btn gu-phone">${ICONS.lock} Use phone screen lock</button>` : ''}
      <div class="gu-input${maths ? '' : ' dots'}" aria-live="polite">&nbsp;</div>
      <div class="pad gu-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => (k === '' ? '<span></span>' : `<button type="button" class="key" data-k="${k}">${k}</button>`)).join('')}</div>
      <div class="actions"><button class="btn mint ok">Check</button><button class="btn ghost" data-back>Cancel</button></div>
    </div></div>`);
    const input = ov.querySelector<HTMLElement>('.gu-input')!;
    let typed = '';
    const paint = () => (input.textContent = maths ? typed || ' ' : typed ? '•'.repeat(typed.length) : ' ');
    ov.querySelector('.gu-pad')!.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
      if (!k) return;
      typed = k === '⌫' ? typed.slice(0, -1) : (typed + k).slice(0, 7);
      paint();
    });
    let open = true;
    const finish = (ok: boolean) => {
      if (!open) return;
      open = false;
      ov.remove();
      resolve(ok);
    };
    const miss = () => {
      misses++;
      if (misses >= 3) {
        misses = 0;
        lockedUntil = Date.now() + 30_000;
        app.toast('Too many tries. Locked for 30 seconds.');
        finish(false);
        return;
      }
      typed = '';
      paint();
      input.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 300 });
    };
    ov.querySelector('.gu-phone')?.addEventListener('click', async () => {
      if (await askPhone(app, reason)) {
        misses = 0;
        finish(true);
      }
    });
    ov.querySelector('.ok')!.addEventListener('click', async () => {
      // The owner code opens the hidden area instead (it never matches a PIN or an answer).
      if (typed.length === 7 && app.ownerHook && (await isOwnerCode(typed))) {
        misses = 0;
        finish(false);
        app.ownerHook();
        return;
      }
      const ok = maths ? Number(typed) === a * b : !!pin && validPin(typed) && (await pinMatches(typed, pin));
      if (ok) {
        misses = 0;
        finish(true);
      } else if (typed) miss();
    });
    ov.querySelector('[data-back]')!.addEventListener('click', () => finish(false));
    app.root.appendChild(ov);
  });
}

/**
 * Choose how grown-ups unlock the parent area: this phone's screen lock, or a parent PIN.
 * Shown once during setup, and from the parent area to change it.
 */
export function lockSetupScreen(next: ScreenMaker, firstRun = false) {
  return (app: App): Screen => {
    const el = html(`<section class="screen gu-setup" aria-label="Grown-up lock">
      <header class="topbar">${firstRun ? '<span style="width:50px"></span>' : `<button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button>`}<span class="t">Grown-up lock</span><span style="width:50px"></span></header>
      <div class="scroll gs-body">
        <p class="gs-lead">The parent area, prizes and settings need a grown-up. Choose how a grown-up unlocks them, so children can’t.</p>
        <div class="gs-options"></div>
      </div>
    </section>`);
    const body = el.querySelector<HTMLElement>('.gs-options')!;
    const done = (msg: string) => {
      app.toast(msg);
      void app.show(next);
    };

    const choose = async () => {
      const phone = await phoneLockAvailable(app);
      const hasPin = !!app.save.data.settings.parentPin;
      body.innerHTML = `
        ${phone ? `<button class="card gs-opt gs-phone"><b>${ICONS.lock} This phone’s screen lock</b><span>Your usual PIN, pattern or fingerprint. Nothing new to remember.</span></button>` : '<p class="fine">This phone has no screen lock, so make a parent PIN.</p>'}
        <button class="card gs-opt gs-pin"><b>🔢 ${hasPin ? 'Change the parent PIN' : 'A parent PIN'}</b><span>4 to 6 digits that only grown-ups know.</span></button>
        ${hasPin && phone ? '<button class="btn ghost small gs-nopin">Remove the PIN (use the screen lock only)</button>' : ''}`;
      stagger(body.children, { gap: 70 });
      body.querySelector('.gs-phone')?.addEventListener('click', async () => {
        // Prove it works before relying on it.
        if (!(await askPhone(app, 'Check the screen lock'))) return void app.toast('The screen lock wasn’t confirmed.');
        app.save.update((d) => delete d.settings.parentPin);
        done('The phone’s screen lock now guards the parent area.');
      });
      body.querySelector('.gs-pin')!.addEventListener('click', () => enterPin());
      body.querySelector('.gs-nopin')?.addEventListener('click', () => {
        app.save.update((d) => delete d.settings.parentPin);
        done('PIN removed. The screen lock guards the parent area.');
      });
    };

    const enterPin = (first?: string) => {
      body.innerHTML = `<div class="card gs-pinbox">
        <h2>${first ? 'Type it again' : 'Choose a parent PIN'}</h2>
        <p class="fine">${first ? 'To make sure.' : '4 to 6 digits. Don’t use a birthday the children know.'}</p>
        <div class="gu-input dots" aria-live="polite">&nbsp;</div>
        <div class="pad gu-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => (k === '' ? '<span></span>' : `<button type="button" class="key" data-k="${k}">${k}</button>`)).join('')}</div>
        <button class="btn mint gs-next">${first ? 'Save PIN' : 'Next'}</button>
        <button class="btn ghost small gs-cancel">Back</button>
      </div>`;
      const input = body.querySelector<HTMLElement>('.gu-input')!;
      let typed = '';
      const paint = () => (input.textContent = typed ? '•'.repeat(typed.length) : ' ');
      body.querySelector('.gu-pad')!.addEventListener('click', (e) => {
        const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k;
        if (!k) return;
        typed = k === '⌫' ? typed.slice(0, -1) : (typed + k).slice(0, 6);
        paint();
      });
      body.querySelector('.gs-cancel')!.addEventListener('click', () => void choose());
      body.querySelector('.gs-next')!.addEventListener('click', async () => {
        if (!validPin(typed)) return void app.toast('Use 4 to 6 digits.');
        if (!first) return enterPin(typed);
        if (typed !== first) {
          app.toast('Those didn’t match. Try again.');
          return enterPin();
        }
        const stored = await hashPin(typed);
        app.save.update((d) => (d.settings.parentPin = stored));
        done('Parent PIN saved.');
      });
    };

    el.querySelector('.back-btn')?.addEventListener('click', () => void app.show(next));
    return { el, mounted: () => void choose(), back: () => (firstRun ? true : (void app.show(next), true)) };
  };
}
