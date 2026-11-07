// The owner's hidden area (opened by typing the owner code into any parent check): access
// keys are made, renewed, copied and deleted here, plus the owner's Google account and the
// Play Store preview. The Play Store build swaps this file for owner.play.ts, so none of it
// is in the app on Google Play.

import { html, esc, type App, type Screen } from './app.ts';
import { dayNo, dayOf, makeKey, signingKey, tidyPhone } from '../core/access.ts';
import type { IssuedKey } from '../storage/save.ts';
import { ICONS } from './icons.ts';
import { stagger, popIn } from '../render/motion.ts';
import { access, copy, niceDay } from './access.ts';
import { mountOwnerGoogle } from './ownergoogle.ts';
import { previewCard } from './membership.ts';

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

    const google = () => {
      const g = document.createElement('div');
      g.className = 'ow-google';
      body.prepend(g);
      mountOwnerGoogle(app, g);
    };

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
      google();
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
      body.append(previewCard(app, () => paint()));
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
      google();
    };

    const message = (k: IssuedKey) => `Your MN key for ${k.name} (works until ${niceDay(k.until)}):\n${k.key}`;

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
    return {
      el,
      // Paint once on screen: the entrance animation on a detached list left it invisible.
      mounted: () => (a.master ? paint() : paintSetup()),
      back: () => {
        leave();
        return true;
      },
    };
  };
}
