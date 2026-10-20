// Access keys on screen: the lock screen (phone code + paste a key), and the owner's hidden
// area (opened by typing the owner code into any grown-up check) where keys are made,
// renewed, copied and deleted. See core/access.ts for how keys work.

import { html, esc, type App, type Screen } from './app.ts';
import { checkKey, dayNo, dayOf, isOwnerCode, makeKey, phoneCode, signingKey, tidyPhone, type KeyCheck } from '../core/access.ts';
import type { Access, IssuedKey } from '../storage/save.ts';
import { dogHeadSvg } from './dog.ts';
import { ICONS } from './icons.ts';
import { stagger, popIn } from '../render/motion.ts';

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

const access = (app: App): Access => (app.save.data.access ??= {});
/** "20 Nov 2026". */
export const niceDay = (n: number): string => new Date(`${dayOf(n)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export type AccessState = { locked: false; owner: boolean; until?: number; phone: string } | { locked: true; reason: 'none' | 'bad' | 'expired' | 'revoked' | 'clock' | 'old'; until?: number; phone: string };

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
  if (!a.key) return { locked: true, reason: 'none', phone };
  const r: KeyCheck = await checkKey(a.key, phone, today);
  if (r.ok) return { locked: false, owner: false, until: r.until, phone };
  return { locked: true, reason: r.reason === 'other-phone' ? 'bad' : r.reason, until: r.until, phone };
}

async function copy(app: App, text: string, what = 'Copied'): Promise<void> {
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
  none: () => 'This app needs a key to start. Send your phone code to the person who gave you Study Hard, and they’ll send you a key.',
  bad: () => 'That key doesn’t work on this phone. Make sure you copied all of it, and that it was made for the phone code below.',
  expired: (u) => `Your key ran out${u !== undefined ? ` on ${niceDay(u)}` : ''}. Ask for a new one. All progress is safe on this phone and carries on with the new key.`,
  revoked: () => 'This key has been switched off. Ask for a new one. All progress is safe on this phone.',
  clock: () => 'This phone’s date looks wrong. Set the correct date and time in your phone’s settings, then try again.',
  old: () => 'This phone’s web engine is too old to check keys. Update “Android System WebView” from the Play Store, then open Study Hard again.',
};

/** The lock screen (or, with `renew`, the "enter a new key" screen from the parent area). */
export function lockScreen(state: AccessState, then: () => void, o: { renew?: boolean; back?: () => void } = {}) {
  return (app: App): Screen => {
    const reason = state.locked ? state.reason : 'none';
    const el = html(`<section class="screen lock" aria-label="${o.renew ? 'New key' : 'Unlock Study Hard'}">
      ${o.back ? `<header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Access key</span><span style="width:50px"></span></header>` : ''}
      <div class="scroll lk-body">
        <div class="lk-coach">${dogHeadSvg({ cls: 'alive' })}</div>
        <h1 class="lk-title">${o.renew ? 'Enter a new key' : 'Unlock Study Hard'}</h1>
        <p class="lk-why">${o.renew ? `${!state.locked && state.until !== undefined ? `Your key works until ${niceDay(state.until)}. ` : ''}Got a new key? Paste it here. Progress carries on as it is.` : esc(REASON[reason](state.until))}</p>
        <div class="card lk-phone"><small>Your phone code</small><b>${esc(state.phone)}</b><button class="btn ghost small lk-copy">Copy code</button></div>
        <label class="field lk-field"><span>Your key</span><textarea class="lk-key" rows="3" placeholder="Paste the key here (it starts with SH-)" autocomplete="off" autocapitalize="characters" spellcheck="false"></textarea></label>
        <p class="lk-msg" aria-live="polite"></p>
        <button class="btn mint lk-go">Unlock</button>
        ${o.renew ? '' : '<button class="btn ghost small lk-adult">Grown-ups</button>'}
      </div>
    </section>`);
    const msg = el.querySelector<HTMLElement>('.lk-msg')!;
    el.querySelector('.lk-copy')!.addEventListener('click', () => void copy(app, state.phone, 'Phone code copied'));
    el.querySelector('.back-btn')?.addEventListener('click', () => o.back?.());
    el.querySelector('.lk-adult')?.addEventListener('click', async () => {
      if (await app.grownUp('For grown-ups')) app.toast('Unlock the app with a key first.');
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

// ── The owner's area ───────────────────────────────────────────────────────

const DURATIONS: [number, string][] = [[1, '1 day'], [7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year']];

/** The owner's hidden area. */
export function ownerScreen(leave: () => void) {
  return (app: App): Screen => {
    const a = access(app);
    const el = html(`<section class="screen owner" aria-label="Owner area">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">${ICONS.lock} Owner area</span><span style="width:50px"></span></header>
      <div class="scroll ow-body"></div>
    </section>`);
    const body = el.querySelector<HTMLElement>('.ow-body')!;
    let signer: CryptoKey | null = null;

    const paintSetup = () => {
      body.innerHTML = `<div class="card ow-card">
        <h2>Set up your phone</h2>
        <p class="fine">Paste your master key once. It stays only on this phone and lets you make keys here. This phone is then always unlocked.</p>
        <textarea class="ow-master" rows="2" placeholder="SHMK-…" autocomplete="off" spellcheck="false"></textarea>
        <p class="lk-msg" aria-live="polite"></p>
        <button class="btn mint ow-save-master">Save master key</button>
      </div>`;
      body.querySelector('.ow-save-master')!.addEventListener('click', async () => {
        const m = body.querySelector<HTMLTextAreaElement>('.ow-master')!.value.trim();
        const s = await signingKey(m);
        if (!s) {
          body.querySelector('.lk-msg')!.textContent = 'That isn’t the master key for this app. Check you copied all of it.';
          return;
        }
        app.save.update(() => (access(app).master = m));
        signer = s;
        app.toast('Master key saved. This phone is the owner’s phone.');
        paint();
      });
    };

    const status = (k: IssuedKey): string => {
      const left = k.until - dayNo(app.today);
      return left < 0 ? `Ran out ${-left} day${left === -1 ? '' : 's'} ago` : left === 0 ? 'Last day today' : `${left + 1} days left · until ${niceDay(k.until)}`;
    };

    const paint = () => {
      const keys = [...(a.issued ?? [])].sort((x, y) => y.until - x.until);
      body.innerHTML = `
        <div class="card ow-card ow-new">
          <h2>New key</h2>
          <label class="field"><span>Name (who is it for?)</span><input class="ow-name" maxlength="30" placeholder="e.g. Riya’s mum" autocomplete="off"></label>
          <label class="field"><span>Their phone code</span><input class="ow-phone" maxlength="12" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
          <div class="field"><span>Works for</span><div class="seg ow-dur">${DURATIONS.map(([d, t], i) => `<button class="seg-b${i === 2 ? ' on' : ''}" data-d="${d}"><b>${t}</b></button>`).join('')}<button class="seg-b" data-d="custom"><b>Custom</b></button></div>
            <label class="ow-custom" hidden><input class="ow-days" type="number" min="1" max="3650" value="60" inputmode="numeric"> days</label></div>
          <p class="lk-msg" aria-live="polite"></p>
          <button class="btn mint ow-make">Make key</button>
          <div class="ow-made" hidden></div>
        </div>
        <h2 class="pa-h">Keys you made (${keys.length})</h2>
        ${keys.length ? `<div class="ow-list">${keys.map((k) => `<div class="card ow-key${k.until < dayNo(app.today) ? ' gone' : ''}" data-id="${esc(k.id)}">
            <div class="ow-key-top"><b>${esc(k.name)}</b><small>${esc(k.phone)} · id ${esc(k.id)}</small></div>
            <p class="ow-status">${status(k)}</p>
            <div class="ow-key-btns"><button class="btn ghost small ow-copy">Copy</button><button class="btn ghost small ow-renew">Renew</button><button class="btn ghost small warn ow-del">Delete</button></div>
          </div>`).join('')}</div>` : '<p class="fine">No keys yet.</p>'}
        <div class="card ow-card ow-notes">
          <p class="fine"><b>How deleting works.</b> Delete removes a key from your list. Because the app works offline, the key keeps working on that phone until its date runs out. So give short keys (like 30 days) and renew them. To stop a key sooner, its id can be blocked in the next app update.</p>
          <p class="fine"><b>Progress is never lost.</b> A renewed key is for the same phone code, so the child’s progress carries on.</p>
          <button class="btn ghost small ow-export">Copy all keys as text</button>
          <button class="btn ghost small warn ow-forget">Remove master key from this phone</button>
        </div>`;
      const seg = body.querySelector<HTMLElement>('.ow-dur')!;
      let days: number | 'custom' = 30;
      seg.querySelectorAll<HTMLElement>('.seg-b').forEach((b) =>
        b.addEventListener('click', () => {
          days = b.dataset.d === 'custom' ? 'custom' : Number(b.dataset.d);
          seg.querySelectorAll('.seg-b').forEach((x) => x.classList.toggle('on', x === b));
          body.querySelector<HTMLElement>('.ow-custom')!.hidden = days !== 'custom';
        }),
      );
      body.querySelector('.ow-make')!.addEventListener('click', async () => {
        const msg = body.querySelector<HTMLElement>('.ow-new .lk-msg')!;
        const name = body.querySelector<HTMLInputElement>('.ow-name')!.value.trim();
        const phone = tidyPhone(body.querySelector<HTMLInputElement>('.ow-phone')!.value);
        const n = days === 'custom' ? Math.round(Number(body.querySelector<HTMLInputElement>('.ow-days')!.value)) : days;
        if (!name) return void (msg.textContent = 'Type a name, so you know whose key it is.');
        if (!phone) return void (msg.textContent = 'The phone code has 8 letters and numbers, like K7Q4-MZ2P.');
        if (!(n >= 1 && n <= 3650)) return void (msg.textContent = 'Choose between 1 and 3650 days.');
        msg.textContent = '';
        const until = dayNo(app.today) + n - 1;
        const made = await issue(name, phone, until);
        paint();
        showMade(made);
      });
      body.querySelector('.ow-export')!.addEventListener('click', () => void copy(app, keys.map((k) => `${k.name} | ${k.phone} | id ${k.id} | until ${dayOf(k.until)} | ${k.key}`).join('\n') || 'No keys', 'All keys copied'));
      body.querySelector('.ow-forget')!.addEventListener('click', async () => {
        const { result } = app.sheet('<h2>Remove the master key?</h2><p>You won’t be able to make keys on this phone until you paste it again, and this phone will need a key to open. Your list of keys stays.</p>', [
          { label: 'Remove it', value: true, kind: 'danger' },
          { label: 'Cancel', value: false, kind: 'ghost', back: true },
        ], 'Remove master key');
        if (!(await result)) return;
        app.save.update(() => delete access(app).master);
        signer = null;
        paintSetup();
      });
      body.querySelectorAll<HTMLElement>('.ow-key').forEach((row) => {
        const k = (a.issued ?? []).find((x) => x.id === row.dataset.id)!;
        row.querySelector('.ow-copy')!.addEventListener('click', () => void copy(app, message(k), 'Key copied, ready to send'));
        row.querySelector('.ow-renew')!.addEventListener('click', async () => {
          const { result } = app.sheet(`<h2>Renew ${esc(k.name)}’s key</h2><p>A new key for the same phone (${esc(k.phone)}), so progress carries on. How long from today?</p>`, [...DURATIONS.map(([d, t]) => ({ label: t, value: d, kind: 'ghost' as const })), { label: 'Cancel', value: 0, kind: 'ghost', back: true }], 'Renew key');
          const d = await result;
          if (!d) return;
          const made = await issue(k.name, k.phone, dayNo(app.today) + d - 1, k.id);
          paint();
          showMade(made);
        });
        row.querySelector('.ow-del')!.addEventListener('click', async () => {
          const { result } = app.sheet(`<h2>Delete ${esc(k.name)}’s key?</h2><p>It leaves your list. It keeps working on their phone until ${niceDay(k.until)}, then stops. Key id: <b>${esc(k.id)}</b>.</p>`, [
            { label: 'Delete', value: true, kind: 'danger' },
            { label: 'Cancel', value: false, kind: 'ghost', back: true },
          ], 'Delete key');
          if (!(await result)) return;
          app.save.update(() => (access(app).issued = (access(app).issued ?? []).filter((x) => x.id !== k.id)));
          paint();
        });
      });
      stagger(body.children, { gap: 50 });
    };

    const message = (k: IssuedKey) => `Your Study Hard key for ${k.name} (works until ${niceDay(k.until)}):\n${k.key}`;

    /** Make a key (a renewed key replaces the old one in the list; the old one still runs to its date). */
    const issue = async (name: string, phone: string, until: number, replaces?: string): Promise<IssuedKey> => {
      signer ??= await signingKey(a.master!);
      const { key, id } = await makeKey(signer!, phone, until);
      const k: IssuedKey = { id, name, phone, until, key, made: app.today };
      app.save.update(() => (access(app).issued = [...(access(app).issued ?? []).filter((x) => x.id !== replaces), k]));
      return k;
    };

    const showMade = (k: IssuedKey) => {
      const box = body.querySelector<HTMLElement>('.ow-made');
      if (!box) return;
      box.hidden = false;
      box.innerHTML = `<p class="ow-made-h">Key for <b>${esc(k.name)}</b>, until ${niceDay(k.until)}</p><code class="ow-code">${esc(k.key)}</code><button class="btn small ow-copy-made">Copy key and message</button>`;
      box.querySelector('.ow-copy-made')!.addEventListener('click', () => void copy(app, message(k), 'Key copied, ready to send'));
      popIn(box, 0, 0.95);
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    el.querySelector('.back-btn')!.addEventListener('click', leave);
    if (a.master) paint();
    else paintSetup();
    return {
      el,
      back: () => {
        leave();
        return true;
      },
    };
  };
}
