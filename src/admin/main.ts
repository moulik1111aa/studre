// MN Access: the owner's web page for approving who can use MN, from any browser (an iPhone
// too; it can be added to the home screen). Signs in with Google (Firebase's popup), then
// uses the same cloud client as the app (platform/cloudapi.ts). Only the owner's account can
// read or change the lists; the cloud's rules check that too.

import { CloudError, FirebaseRest, MemoryCloud, OWNER_EMAIL, type AccessEntry, type AccessRequest, type CheckIn, type CloudBackend, type OwnerKey, type Session } from '../platform/cloudapi.ts';
import { dayNo, dayOf, makeKey, signingKey, tidyPhone } from '../core/access.ts';

interface AdminConfig {
  apiKey: string;
  projectId: string;
  webClientId: string;
  authDomain: string;
}
/** Firebase's sign-in, loaded by the page as a module (see scripts/site.mjs). */
interface FirebaseSignIn {
  googleIdToken(): Promise<string>;
  signOut(): Promise<void>;
}
const w = window as unknown as { __ADMIN__?: AdminConfig; __fbSignIn?: FirebaseSignIn };
const cfg = w.__ADMIN__;
const params = new URLSearchParams(location.search);
const mock = params.has('mock');

const DAY = 86_400_000;
const LENGTHS: [number, string][] = [[0, 'No end date'], [30, '30 days'], [90, '90 days'], [365, '1 year']];

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private browsing: nothing kept */
    }
  },
};
const SESSION = 'mnadmin.session';
const saved = (() => {
  try {
    return JSON.parse(store.get(SESSION) ?? 'null') as Session | null;
  } catch {
    return null;
  }
})();
const keep = (s: Session | null) => (s ? store.set(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION));

let be: CloudBackend | null = mock ? new MemoryCloud(store, saved, keep) : cfg?.apiKey ? new FirebaseRest({ apiKey: cfg.apiKey, projectId: cfg.projectId, webClientId: cfg.webClientId }, saved, keep) : null;

const root = document.getElementById('admin')!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const html = (s: string) => {
  const t = document.createElement('template');
  t.innerHTML = s.trim();
  return t.content.firstElementChild as HTMLElement;
};

let toastTimer = 0;
function toast(text: string) {
  document.querySelector('.toast')?.remove();
  const t = html(`<div class="toast" role="status">${esc(text)}</div>`);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 3500);
}

const ago = (t: number, now = Date.now()) => {
  const m = Math.round((now - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const lengthPicker = (cls: string) => `<select class="${cls}" aria-label="How long">${LENGTHS.map(([d, t]) => `<option value="${d}">${t}</option>`).join('')}</select>`;
const untilFrom = (days: number) => (days ? Date.now() + days * DAY : 0);
const why = (e: unknown) => (e instanceof CloudError ? e.message : 'Something went wrong. Please try again.');

let tab: 'accounts' | 'keys' = location.hash === '#keys' ? 'keys' : 'accounts';
const header = (s: Session | null) => `<header>
  <div class="brand"><img src="../assets/icon-512.png" alt=""><div><h1>MN Access</h1><small>Who can use MN</small></div></div>
  ${s ? `<div class="who"><span>Signed in as <b>${esc(s.email)}</b></span><button class="btn out">Sign out</button></div>` : ''}
</header>
${s && s.email === OWNER_EMAIL ? `<nav class="tabs" role="tablist"><button role="tab" data-tab="accounts" aria-selected="${tab === 'accounts'}">Google accounts</button><button role="tab" data-tab="keys" aria-selected="${tab === 'keys'}">Phone keys</button></nav>` : ''}`;

/** The tab buttons and Sign out, on every signed-in page. */
function wireHeader() {
  root.querySelector('.out')?.addEventListener('click', () => void signOut());
  root.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab as typeof tab;
      history.replaceState(null, '', tab === 'keys' ? '#keys' : location.pathname + location.search);
      void dashboard();
    }),
  );
}

function signInPage(message = '') {
  root.innerHTML = `${header(null)}<div class="card signin">
    <h2>Sign in</h2>
    <p>Use the owner’s Google account to see requests and approve people.</p>
    <div class="gbtn"><button class="gsi-btn" type="button"><span class="gsi-icon"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg></span><span>Sign in with Google</span></button></div>
    <p class="msg" role="alert">${esc(message)}</p>
  </div>`;
  root.querySelector<HTMLButtonElement>('.gsi-btn')!.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    try {
      await signIn();
    } catch (err) {
      signInPage(err instanceof Error && err.message ? err.message : 'Sign-in didn’t work. Please try again.');
      return;
    }
    void dashboard();
  });
}

async function signIn() {
  if (!be) throw new Error('This page is missing its setup. Please tell Claude.');
  if (mock) {
    await be.signIn(params.get('mock') || `${OWNER_EMAIL}|Moulik`);
    return;
  }
  if (!w.__fbSignIn) throw new Error('Google sign-in is still loading. Try again in a moment.');
  const token = await w.__fbSignIn.googleIdToken().catch((e: { code?: string }) => {
    if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') throw new Error('');
    if (e?.code === 'auth/popup-blocked') throw new Error('The sign-in window was blocked. Allow pop-ups for this page and try again.');
    throw new Error('Google sign-in didn’t work. Please try again.');
  });
  await be.signIn(token);
}

async function signOut() {
  if (be) be.session = null;
  keep(null);
  await w.__fbSignIn?.signOut().catch(() => undefined);
  signInPage();
}

async function dashboard() {
  const s = be?.session;
  if (!be || !s) return signInPage();
  if (s.email !== OWNER_EMAIL) {
    root.innerHTML = `${header(s)}<div class="card signin"><h2>Not the owner’s account</h2><p>${esc(s.email)} can’t approve people. Sign out and use ${esc(OWNER_EMAIL)}.</p></div>`;
    root.querySelector('.out')!.addEventListener('click', () => void signOut());
    return;
  }
  if (tab === 'keys') return keysPage(s);
  if (!root.querySelector('.stats')) {
    root.innerHTML = `${header(s)}<p class="loading">Loading…</p>`;
    wireHeader();
  }
  let requests: AccessRequest[];
  let approved: AccessEntry[];
  let checkins: CheckIn[];
  try {
    [requests, approved, checkins] = await Promise.all([be.listRequests(), be.listAccess(), be.listCheckins()]);
  } catch (e) {
    if (e instanceof CloudError && e.kind === 'signed-out') return signInPage('Please sign in again.');
    root.innerHTML = `${header(s)}<div class="card signin"><h2>Couldn’t load the lists</h2><p>${esc(why(e))}</p><button class="btn primary again">Try again</button></div>`;
    root.querySelector('.again')!.addEventListener('click', () => void dashboard());
    wireHeader();
    return;
  }
  const known = new Set(approved.map((a) => a.email));
  const waiting = requests.filter((r) => !known.has(r.email)).sort((a, b) => b.at - a.at);
  const phonesOf = (email: string) => checkins.filter((c) => c.email === email).flatMap((c) => Object.values(c.devices)).sort((a, b) => b.at - a.at);
  const allPhones = new Set(checkins.flatMap((c) => Object.values(c.devices).map((d) => d.phone)));
  const now = Date.now();
  approved.sort((a, b) => b.addedAt - a.addedAt);

  root.innerHTML = `${header(s)}
    <div class="stats">
      <div class="card stat"><b>${waiting.length}</b><span>Waiting</span></div>
      <div class="card stat"><b>${approved.length}</b><span>Approved</span></div>
      <div class="card stat"><b>${allPhones.size}</b><span>Phones</span></div>
    </div>
    <section><h2>Waiting for approval <button class="btn refresh">Refresh</button></h2>
      <div class="card list">${
        waiting.length
          ? waiting
              .map(
                (r) => `<div class="row req" data-uid="${esc(r.uid)}">
          <div class="id"><b>${esc(r.name || r.email)}</b><span>${esc(r.email)}</span><div class="phones"><span class="chip">📱 ${esc(r.phone)}</span><span class="chip">Asked ${ago(r.at)}</span></div></div>
          <div class="acts">${lengthPicker('len')}<button class="btn primary ok">Approve</button><button class="btn danger no">Deny</button></div></div>`,
              )
              .join('')
          : '<p class="empty">No one is waiting.</p>'
      }</div></section>
    <section><h2>Approved <small>${approved.length} ${approved.length === 1 ? 'account' : 'accounts'}</small></h2>
      <div class="card list">${
        approved.length
          ? approved
              .map((a) => {
                const phones = phonesOf(a.email);
                const ended = a.until && a.until <= now;
                return `<div class="row acc" data-email="${esc(a.email)}">
          <div class="id"><b>${esc(a.name || a.email)}</b><span>${esc(a.email)}</span><div class="phones">
            <span class="chip ${ended ? 'end' : 'ok'}">${!a.until ? 'No end date' : ended ? `Ended ${day(a.until)}` : `Until ${day(a.until)}`}</span>
            ${phones.length ? phones.map((p) => `<span class="chip">📱 ${esc(p.phone)} · seen ${ago(p.at)}</span>`).join('') : '<span class="chip">Not opened yet</span>'}
          </div></div>
          <div class="acts">${lengthPicker('len')}<button class="btn change">Change end date</button><button class="btn danger rm">Remove</button></div></div>`;
              })
              .join('')
          : '<p class="empty">No one yet.</p>'
      }</div></section>
    <section><h2>Approve an email</h2>
      <div class="card"><form class="add"><input type="email" class="email" placeholder="name@gmail.com" autocomplete="off" autocapitalize="none" spellcheck="false" required aria-label="Email address">${lengthPicker('len')}<button class="btn primary">Approve</button></form></div>
      <p class="note">Approved people can sign in on their phone straight away. A removed account locks the next time that phone goes online (within 14 days at most). Phone-code keys keep working as before.</p>
    </section>`;

  const busy = async (b: HTMLButtonElement, fn: () => Promise<void>, done: string) => {
    b.disabled = true;
    try {
      await fn();
      toast(done);
      await dashboard();
    } catch (e) {
      toast(why(e));
      b.disabled = false;
    }
  };
  const lenOf = (row: Element) => Number(row.querySelector<HTMLSelectElement>('.len')!.value);
  wireHeader();
  root.querySelector('.refresh')!.addEventListener('click', () => void dashboard());
  root.querySelectorAll<HTMLElement>('.req').forEach((row) => {
    const r = waiting.find((x) => x.uid === row.dataset.uid)!;
    row.querySelector<HTMLButtonElement>('.ok')!.addEventListener('click', (e) =>
      void busy(e.currentTarget as HTMLButtonElement, async () => {
        await be!.approve({ email: r.email, name: r.name, until: untilFrom(lenOf(row)), addedAt: Date.now() });
        await be!.dropRequest(r.uid);
      }, `${r.name || r.email} is approved.`),
    );
    row.querySelector<HTMLButtonElement>('.no')!.addEventListener('click', (e) => void busy(e.currentTarget as HTMLButtonElement, () => be!.dropRequest(r.uid), 'Request removed.'));
  });
  root.querySelectorAll<HTMLElement>('.acc').forEach((row) => {
    const a = approved.find((x) => x.email === row.dataset.email)!;
    row.querySelector<HTMLButtonElement>('.change')!.addEventListener('click', (e) =>
      void busy(e.currentTarget as HTMLButtonElement, () => be!.approve({ ...a, until: untilFrom(lenOf(row)) }), 'End date changed.'),
    );
    row.querySelector<HTMLButtonElement>('.rm')!.addEventListener('click', (e) => {
      if (!confirm(`Remove ${a.name || a.email}? MN locks on their phones the next time they go online.`)) return;
      void busy(e.currentTarget as HTMLButtonElement, () => be!.removeAccess(a.email), `${a.name || a.email} is removed.`);
    });
  });
  root.querySelector<HTMLFormElement>('.add')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const email = form.querySelector<HTMLInputElement>('.email')!.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Type a whole email address.');
    void busy(form.querySelector('button')!, () => be!.approve({ email, name: '', until: untilFrom(lenOf(form)), addedAt: Date.now() }), `${email} is approved.`);
  });
}

// ── phone keys (the same keys as the owner area in the app) ──────────────────

const MASTER = 'mnadmin.master';
const LOCAL_KEYS = 'mnadmin.keys';
const KEY_LENGTHS: [number, string][] = [[7, '1 week'], [30, '30 days'], [90, '90 days'], [365, '1 year']];
const today = () => new Date().toLocaleDateString('en-CA');
const niceDay = (n: number) => new Date(`${dayOf(n)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const keyMessage = (k: OwnerKey) => `Your MN key for ${k.name} (works until ${niceDay(k.until)}):\n${k.key}`;
const keyStatus = (k: OwnerKey) => {
  const left = k.until - dayNo(today());
  return left < 0 ? `Ran out ${-left} day${left === -1 ? '' : 's'} ago` : left === 0 ? 'Last day today' : `${left + 1} days left · until ${niceDay(k.until)}`;
};
const readLocal = (): OwnerKey[] => {
  try {
    return JSON.parse(store.get(LOCAL_KEYS) ?? '[]') as OwnerKey[];
  } catch {
    return [];
  }
};

async function share(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(text).then(() => toast('Copied, ready to paste.'), () => toast('Couldn’t copy. Press and hold the key to copy it.'));
}

/** The signing key from the master key (test runs with `?mock` may use "TEST": a throwaway key). */
async function signerFor(master: string): Promise<CryptoKey | null> {
  if (mock && master === 'TEST') return (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])).privateKey;
  return signingKey(master);
}

async function keysPage(s: Session) {
  const master = store.get(MASTER);
  if (!master) {
    root.innerHTML = `${header(s)}<section><div class="card pad">
      <h2 class="h">Phone keys</h2>
      <p class="soft">Make keys for people without Google, the same keys as the owner area in the app. Paste your master key (it starts with SHMK-) once. It stays only in this browser and is never sent anywhere.</p>
      <textarea class="master" rows="3" placeholder="SHMK-…" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Master key"></textarea>
      <p class="msg" role="alert"></p>
      <button class="btn primary save-master">Save master key</button>
    </div></section>`;
    wireHeader();
    root.querySelector('.save-master')!.addEventListener('click', async () => {
      const m = root.querySelector<HTMLTextAreaElement>('.master')!.value.trim();
      if (!(await signerFor(m))) return void (root.querySelector('.msg')!.textContent = 'That isn’t MN’s master key. Check you copied all of it.');
      store.set(MASTER, m);
      toast('Master key saved in this browser.');
      void keysPage(s);
    });
    return;
  }
  // The list: the cloud's copy (shared with the app's owner area later) plus this browser's.
  let cloudOk = true;
  let cloud: OwnerKey[] = [];
  try {
    cloud = (await be!.ownerKeys()) ?? [];
  } catch {
    cloudOk = false;
  }
  const byId = new Map<string, OwnerKey>();
  for (const k of [...cloud, ...readLocal()]) byId.set(k.id, k);
  let list = [...byId.values()];
  const save = async () => {
    store.set(LOCAL_KEYS, JSON.stringify(list));
    if (!cloudOk) return;
    try {
      await be!.saveOwnerKeys(list);
    } catch {
      cloudOk = false;
    }
  };
  if (cloudOk && list.length !== cloud.length) await save();
  let signer: CryptoKey | null = null;
  const issue = async (name: string, phone: string, until: number, replaces?: string) => {
    signer ??= await signerFor(master);
    if (!signer) throw new Error('The saved master key doesn’t work. Remove it and paste it again.');
    const { key, id } = await makeKey(signer, phone, until);
    const k: OwnerKey = { id, name, phone, until, key, made: today() };
    list = [...list.filter((x) => x.id !== replaces), k];
    await save();
    return k;
  };

  const paint = (made?: OwnerKey) => {
    const keys = [...list].sort((a, b) => b.until - a.until);
    const t = dayNo(today());
    root.innerHTML = `${header(s)}
      <section><h2>New key</h2><div class="card">
        <form class="newkey">
          <label><span>Name (who is it for?)</span><input class="kname" maxlength="30" placeholder="e.g. Riya’s mum" autocomplete="off" required></label>
          <label><span>Their phone code</span><input class="kphone" maxlength="12" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>
          <label><span>Works for</span><select class="klen">${KEY_LENGTHS.map(([d, x]) => `<option value="${d}"${d === 30 ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
          <button class="btn primary">Make key</button>
        </form>
        ${made ? `<div class="made"><p>Key for <b>${esc(made.name)}</b>, until ${niceDay(made.until)}</p><code>${esc(made.key)}</code><button class="btn primary share-made">Send key</button></div>` : ''}
      </div></section>
      <section><h2>Keys you made <small>${keys.length}</small></h2><div class="card list">${
        keys.length
          ? keys
              .map(
                (k) => `<div class="row key${k.until < t ? ' gone' : ''}" data-id="${esc(k.id)}">
          <div class="id"><b>${esc(k.name)}</b><span>${esc(k.phone)} · id ${esc(k.id)}</span><div class="phones"><span class="chip ${k.until < t ? 'end' : 'ok'}">${keyStatus(k)}</span></div></div>
          <div class="acts"><button class="btn send">Send</button><select class="len" aria-label="Renew for">${KEY_LENGTHS.map(([d, x]) => `<option value="${d}"${d === 30 ? ' selected' : ''}>${x}</option>`).join('')}</select><button class="btn renew">Renew</button><button class="btn danger del">Delete</button></div></div>`,
              )
              .join('')
          : '<p class="empty">No keys yet.</p>'
      }</div>
      <p class="note">${cloudOk ? 'This list is kept in your private cloud space, so it’s the same on any browser you sign in on.' : 'This list is saved in this browser only for now (the cloud list needs the updated database rules).'} A key works only on its phone, until its date, even offline. Deleting takes it off your list, but it keeps working until its date, so prefer short keys and renew them. The master key stays only in this browser.</p>
      <p class="note"><button class="btn danger forget">Remove master key from this browser</button></p></section>`;
    wireHeader();
    root.querySelector<HTMLFormElement>('.newkey')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = root.querySelector<HTMLInputElement>('.kname')!.value.trim();
      const phone = tidyPhone(root.querySelector<HTMLInputElement>('.kphone')!.value);
      const days = Number(root.querySelector<HTMLSelectElement>('.klen')!.value);
      if (!name) return toast('Type a name, so you know whose key it is.');
      if (!phone) return toast('The phone code has 8 letters and numbers, like K7Q4-MZ2P.');
      try {
        paint(await issue(name, phone, dayNo(today()) + days - 1));
      } catch (err) {
        toast((err as Error).message);
      }
    });
    root.querySelector('.share-made')?.addEventListener('click', () => void share(keyMessage(made!)));
    root.querySelectorAll<HTMLElement>('.key').forEach((row) => {
      const k = list.find((x) => x.id === row.dataset.id)!;
      row.querySelector('.send')!.addEventListener('click', () => void share(keyMessage(k)));
      row.querySelector('.renew')!.addEventListener('click', async () => {
        const days = Number(row.querySelector<HTMLSelectElement>('.len')!.value);
        try {
          paint(await issue(k.name, k.phone, dayNo(today()) + days - 1, k.id));
        } catch (err) {
          toast((err as Error).message);
        }
      });
      row.querySelector('.del')!.addEventListener('click', async () => {
        if (!confirm(`Delete ${k.name}’s key from your list? It keeps working on their phone until ${niceDay(k.until)}.`)) return;
        list = list.filter((x) => x.id !== k.id);
        await save();
        paint();
      });
    });
    root.querySelector('.forget')!.addEventListener('click', () => {
      if (!confirm('Remove the master key from this browser? You can paste it again any time.')) return;
      localStorage.removeItem(MASTER);
      void keysPage(s);
    });
  };
  paint();
}

// Back to the page: fresh lists.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && be?.session?.email === OWNER_EMAIL && tab === 'accounts') void dashboard();
});

if (!be) signInPage('This page is missing its setup.');
else void dashboard();
