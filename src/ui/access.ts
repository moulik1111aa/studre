// Access keys on screen: the lock screen (phone code + paste a key). The owner's area, where
// keys are made, is in ui/owner.ts (left out of the Play Store build). See core/access.ts.

import { html, esc, type App, type Screen } from './app.ts';
import { checkKey, dayNo, dayOf, isOwnerCode, phoneCode, signingKey, type KeyCheck } from '../core/access.ts';
import type { Access } from '../storage/save.ts';
import { plusFaceSvg } from './plus.ts';
import { ICONS } from './icons.ts';
import { stagger, popIn } from '../render/motion.ts';
import { account, checkAccess, cloudOn, googleGate, signIn, signOut } from './cloud.ts';

import { googleButton } from './gbutton.ts';
export { GOOGLE_G, googleButton } from './gbutton.ts';

export { isOwnerCode };

const DEVICE_KEY = 'studyhard.device';
let phoneCache: string | null = null;

/** This phone's code (from Android's device id, or a saved random id in a browser). */
export async function myPhone(app: App): Promise<string> {
  if (phoneCache) return phoneCache;
  let id = '';
  try {
    id = (await app.native?.deviceId?.())?.id ?? '';
  } catch {
    id = '';
  }
  if (!id) {
    try {
      id = localStorage.getItem(DEVICE_KEY) ?? '';
      if (!id) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(DEVICE_KEY, id);
      }
    } catch {
      id = 'no-storage';
    }
  }
  phoneCache = await phoneCode(id);
  return phoneCache;
}

export const access = (app: App): Access => (app.save.data.access ??= {});
/** "20 Nov 2026". */
export const niceDay = (n: number): string => new Date(`${dayOf(n)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export type AccessState = { locked: false; owner: boolean; until?: number; phone: string; via?: 'google' } | { locked: true; reason: 'none' | 'bad' | 'expired' | 'revoked' | 'clock' | 'old' | 'google-stale' | 'google-ended'; until?: number; phone: string };

let ownerCache: { master: string; ok: boolean } | null = null;
async function isOwnerPhone(app: App): Promise<boolean> {
  const master = access(app).master;
  if (!master) return false;
  if (ownerCache?.master !== master) ownerCache = { master, ok: !!(await signingKey(master)) };
  return ownerCache.ok;
}

/** Is the app unlocked on this phone today? Also keeps the latest day seen (for the clock check). */
export async function accessState(app: App): Promise<AccessState> {
  // Keys need the phone's built-in crypto (missing only in very old web engines).
  if (!globalThis.crypto?.subtle) return { locked: true, reason: 'old', phone: '—' };
  const phone = await myPhone(app);
  const a = access(app);
  const today = app.today;
  if (await isOwnerPhone(app)) return { locked: false, owner: true, phone };
  // The date going back more than a day means the clock was turned back.
  if (a.maxDay && dayNo(today) < dayNo(a.maxDay) - 1) return { locked: true, reason: 'clock', phone };
  if (!a.maxDay || dayNo(today) > dayNo(a.maxDay)) app.save.update(() => (access(app).maxDay = today));
  // An approved Google account (checked online at least every 14 days).
  let google = googleGate(app);
  if (!google.ok && google.reason === 'stale' && account(app)) {
    // Due a check: ask now (quickly), and carry on if the answer is yes.
    const answer = await Promise.race([checkAccess(app), new Promise<'slow'>((r) => setTimeout(() => r('slow'), 6000))]);
    if (answer !== 'slow') google = googleGate(app);
  }
  if (google.ok) return { locked: false, owner: false, phone, via: 'google' };
  if (a.key) {
    const r: KeyCheck = await checkKey(a.key, phone, today);
    if (r.ok) return { locked: false, owner: false, until: r.until, phone };
    return { locked: true, reason: r.reason === 'other-phone' ? 'bad' : r.reason, until: r.until, phone };
  }
  if (google.reason === 'stale' || google.reason === 'clock') return { locked: true, reason: google.reason === 'clock' ? 'clock' : 'google-stale', phone };
  if (google.reason === 'ended') return { locked: true, reason: 'google-ended', phone };
  return { locked: true, reason: 'none', phone };
}

export async function copy(app: App, text: string, what = 'Copied'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    app.toast(`${what}.`);
    return;
  } catch {
    /* fall back below */
  }
  const t = document.createElement('textarea');
  t.value = text;
  t.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(t);
  t.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  t.remove();
  app.toast(ok ? `${what}.` : 'Press and hold to copy it.');
}

const REASON: Record<string, (until?: number) => string> = {
  none: () => 'This app needs a key to start. Send your phone code to the person who gave you MN, and they’ll send you a key.',
  bad: () => 'That key doesn’t work on this phone. Make sure you copied all of it, and that it was made for the phone code below.',
  expired: (u) => `Your key ran out${u !== undefined ? ` on ${niceDay(u)}` : ''}. Ask for a new one. All progress is safe on this phone and carries on with the new key.`,
  revoked: () => 'This key has been switched off. Ask for a new one. All progress is safe on this phone.',
  clock: () => 'This phone’s date looks wrong. Set the correct date and time in your phone’s settings, then try again.',
  old: () => 'This phone’s web engine is too old to check keys. Update “Android System WebView” from the Play Store, then open MN again.',
  'google-stale': () => 'MN needs to check your Google account. Connect to the internet, then tap “Check again”.',
  'google-ended': () => 'Your access has ended. Ask the person who gave you MN, or use a key.',
};

/** The lock screen (or, with `renew`, the "enter a new key" screen from the parent area). */
export function lockScreen(state: AccessState, then: () => void, o: { renew?: boolean; back?: () => void } = {}) {
  return (app: App): Screen => {
    const reason = state.locked ? state.reason : 'none';
    const google = !o.renew && cloudOn(app);
    const who = account(app);
    const el = html(`<section class="screen lock" aria-label="${o.renew ? 'New key' : 'Unlock MN'}">
      ${o.back ? `<header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Access key</span><span style="width:50px"></span></header>` : ''}
      <div class="scroll lk-body">
        <div class="lk-coach">${plusFaceSvg({ cls: 'alive' })}</div>
        <h1 class="lk-title">${o.renew ? 'Enter a new key' : 'Unlock MN'}</h1>
        <p class="lk-why">${o.renew ? `${!state.locked && state.until !== undefined ? `Your key works until ${niceDay(state.until)}. ` : ''}Got a new key? Paste it here. Progress carries on as it is.` : google && reason === 'none' ? 'Sign in with an approved Google account. No Google account? Send your phone code to the person who gave you MN, and they’ll send you a key.' : esc(REASON[reason](state.until))}</p>
        ${google ? `<div class="card lk-google">
          ${who ? '<button class="btn lk-g">Check again</button>' : googleButton('lk-g')}
          <p class="lk-gmsg" aria-live="polite">${who ? `Signed in as <b>${esc(who.email)}</b>. Waiting for approval.` : 'For parents. Your account needs to be approved once.'}</p>
          ${who ? '<button class="linkish lk-other">Use another account</button>' : ''}
        </div>
        <p class="lk-or"><span>or use a key</span></p>` : ''}
        <div class="card lk-phone"><small>Your phone code</small><b>${esc(state.phone)}</b><button class="btn ghost small lk-copy">Copy code</button></div>
        <label class="field lk-field"><span>Your key</span><textarea class="lk-key" rows="3" placeholder="Paste the key here (it starts with SH-)" autocomplete="off" autocapitalize="characters" spellcheck="false"></textarea></label>
        <p class="lk-msg" aria-live="polite"></p>
        <button class="btn mint lk-go">Unlock</button>
        ${o.renew ? '' : '<button class="btn ghost small lk-adult">Parents</button>'}
      </div>
    </section>`);
    const msg = el.querySelector<HTMLElement>('.lk-msg')!;
    const gmsg = el.querySelector<HTMLElement>('.lk-gmsg');
    const unlocked = () => {
      const rect = el.querySelector('.lk-g')!.getBoundingClientRect();
      app.fx.confetti(rect.x + rect.width / 2, rect.y, 60);
      app.toast('Unlocked with Google.');
      then();
    };
    const answer = (a: string) => {
      if (!gmsg) return;
      if (a === 'approved') return unlocked();
      const email = esc(account(app)?.email ?? '');
      gmsg.innerHTML =
        a === 'waiting'
          ? `Signed in as <b>${email}</b>. We’ve asked for your account to be approved. Tap “Check again” once you hear back.`
          : a === 'offline'
            ? 'No internet connection. Connect and try again.'
            : a === 'cancelled'
              ? 'For parents. Your account needs to be approved once.'
              : 'That didn’t work. Please try again.';
      const old = el.querySelector('.lk-g')!;
      const fresh = html(account(app) ? '<button class="btn lk-g">Check again</button>' : googleButton('lk-g'));
      old.replaceWith(fresh);
      fresh.addEventListener('click', () => void go(fresh as HTMLButtonElement));
      popIn(gmsg, 0, 0.95);
    };
    const go = async (b: HTMLButtonElement) => {
      b.disabled = true;
      try {
        answer(account(app) ? await checkAccess(app) : await signIn(app));
      } finally {
        b.disabled = false;
      }
    };
    el.querySelector('.lk-g')?.addEventListener('click', (e) => void go(e.currentTarget as HTMLButtonElement));
    el.querySelector('.lk-other')?.addEventListener('click', async () => {
      await signOut(app);
      answer(await signIn(app));
    });
    el.querySelector('.lk-copy')!.addEventListener('click', () => void copy(app, state.phone, 'Phone code copied'));
    el.querySelector('.back-btn')?.addEventListener('click', () => o.back?.());
    el.querySelector('.lk-adult')?.addEventListener('click', async () => {
      if (await app.grownUp('For parents')) app.toast('Unlock the app with a key first.');
    });
    el.querySelector('.lk-go')!.addEventListener('click', async () => {
      const key = el.querySelector<HTMLTextAreaElement>('.lk-key')!.value.trim();
      if (!key) {
        msg.textContent = 'Paste the key first.';
        return;
      }
      const r = await checkKey(key, state.phone, app.today);
      if (!r.ok) {
        msg.textContent = r.reason === 'expired' ? `That key ran out on ${niceDay(r.until!)}. Ask for a new one.` : r.reason === 'revoked' ? 'That key has been switched off. Ask for a new one.' : 'That key doesn’t work on this phone. Check you copied all of it.';
        popIn(msg, 0, 0.9);
        return;
      }
      app.save.update(() => (access(app).key = key.replace(/\s+/g, '')));
      app.toast(`Unlocked until ${niceDay(r.until)}.`);
      const rect = el.querySelector('.lk-go')!.getBoundingClientRect();
      app.fx.confetti(rect.x + rect.width / 2, rect.y, 60);
      then();
    });
    return {
      el,
      mounted: () => stagger(el.querySelectorAll('.lk-body > *'), { gap: 60 }),
      back: () => {
        if (o.back) o.back();
        return true;
      },
    };
  };
}

/** A reminder for the "Who's playing?" screen when the key runs out soon (null if not). */
export function keyReminder(state: AccessState, today: string): string | null {
  if (state.locked || state.owner || state.until === undefined) return null;
  const left = state.until - dayNo(today);
  if (left > 5) return null;
  return left <= 0 ? 'Your key runs out today. Ask for a new one to keep playing tomorrow.' : `Your key runs out in ${left} day${left === 1 ? '' : 's'}. Ask for a new one (your phone code: ${state.phone}).`;
}
