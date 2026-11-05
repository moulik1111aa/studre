// Google sign-in on the phone: the grown-up signs in (behind the grown-up check, or on the
// lock screen), the owner approves the account, and then the app unlocks and keeps the
// family's progress backed up and in sync. All the deciding is in core/cloud.ts and
// core/gate.ts; the talking to Google is in platform/cloudapi.ts.

import { esc, type App } from './app.ts';
import { FIREBASE } from '../platform/firebase-config.ts';
import { CloudError, FirebaseRest, MemoryCloud, OWNER_EMAIL, type CloudBackend, type Session } from '../platform/cloudapi.ts';
import { familyRules, freshMemo, planSync, POLICY_VERSION, type SyncMemo } from '../core/cloud.ts';
import { confirmGate, gateState, seen, type GateState } from '../core/gate.ts';
import { myPhone } from './access.ts';
import type { Child } from '../storage/save.ts';

const SESSION_KEY = 'studyhard.cloud.session';
const MEMO_KEY = 'studyhard.cloud.memo';

const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: nothing kept */
    }
  },
  del(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing to do */
    }
  },
};
const readJson = <T>(k: string): T | null => {
  try {
    return JSON.parse(ls.get(k) ?? 'null') as T | null;
  } catch {
    return null;
  }
};

/** Test runs and debug builds use a stand-in cloud. */
const mock = (app: App): boolean => app.debug && new URLSearchParams(location.search).has('cloudmock');

/** Is Google sign-in available in this build? */
export const cloudOn = (app: App): boolean => !!FIREBASE || mock(app);

let be: CloudBackend | null = null;
export function backend(app: App): CloudBackend | null {
  if (be) return be;
  if (!cloudOn(app)) return null;
  const saved = readJson<Session>(SESSION_KEY);
  const keep = (s: Session | null) => (s ? ls.set(SESSION_KEY, JSON.stringify(s)) : ls.del(SESSION_KEY));
  be = FIREBASE ? new FirebaseRest(FIREBASE, saved, keep) : new MemoryCloud(ls, saved, keep);
  return be;
}

export const account = (app: App): Session | null => backend(app)?.session ?? null;
export const isOwnerAccount = (app: App): boolean => account(app)?.email === OWNER_EMAIL;

const memo = (): SyncMemo => ({ ...freshMemo(), ...(readJson<SyncMemo>(MEMO_KEY) ?? {}) });
const saveMemo = (m: SyncMemo) => ls.set(MEMO_KEY, JSON.stringify(m));

/** This phone's id and label in the family document. */
async function device(app: App): Promise<{ id: string; label: string; phone: string }> {
  const phone = await myPhone(app);
  return { id: `d${phone.replace(/[^A-Za-z0-9]/g, '')}`, label: `Phone ${phone}`, phone };
}

// ── unlocking with Google ───────────────────────────────────────────────────

/** Unlocked by an approved Google account on this phone? (Works offline for 14 days.) */
export function googleGate(app: App): GateState {
  const g = app.save.data.access?.google;
  const now = Date.now();
  const st = gateState(g, now);
  if (g && st.ok && now > g.maxSeen + 60_000) app.save.update((d) => (d.access!.google = seen(d.access!.google, now)));
  return st;
}

export type AccessAnswer = 'approved' | 'waiting' | 'offline' | 'signed-out' | 'error';

/** Ask the cloud whether this account is approved; ask the owner if not. */
export async function checkAccess(app: App): Promise<AccessAnswer> {
  const b = backend(app);
  const s = b?.session;
  if (!b || !s) return 'signed-out';
  try {
    const e = await b.myAccess();
    const now = Date.now();
    const d = await device(app);
    const ok = !!e && (!e.until || e.until > now);
    app.save.update((data) => {
      data.access ??= {};
      data.access.google = confirmGate(data.access.google, s.email, ok ? e!.until : null, now);
    });
    if (ok) {
      await b.checkIn(d.id, { phone: d.phone, label: d.label, version: appVersion(), at: now }).catch(() => undefined);
      return 'approved';
    }
    await b.requestAccess({ phone: d.phone, device: d.label, version: appVersion(), at: now });
    return 'waiting';
  } catch (e) {
    return e instanceof CloudError ? (e.kind === 'offline' ? 'offline' : e.kind === 'signed-out' ? 'signed-out' : 'error') : 'error';
  }
}

const appVersion = (): string => (globalThis as { MN_VERSION?: string }).MN_VERSION ?? 'web';

// ── signing in ──────────────────────────────────────────────────────────────

/** The grown-up agrees to what is kept in the cloud (shown before the first sign-in on a phone). */
async function consent(app: App): Promise<boolean> {
  if (ls.get('studyhard.cloud.consent') === POLICY_VERSION) return true;
  const { result } = app.sheet(
    `<h2>Sign in with Google</h2>
     <p>For grown-ups only. MN keeps a private copy of your family’s progress in your own space in Google’s cloud (Mumbai), so it is backed up and the same on every phone:</p>
     <ul class="cl-list"><li>your Google email and name</li><li>each child’s first name, age and avatar</li><li>levels, stars, rewards and play times</li><li>your family’s settings, like time limits and quiet hours</li></ul>
     <p>No photos, location or contacts, and no ads. You can delete the cloud copy any time in the Parent area.</p>
     <p class="fine" style="overflow-wrap:anywhere">Privacy policy: moulik1111aa.github.io/studre/privacy.html</p>`,
    [
      { label: 'I agree, sign in', value: true, kind: 'mint' },
      { label: 'Not now', value: false, kind: 'ghost', back: true },
    ],
    'Sign in with Google',
  );
  const ok = (await result) === true;
  if (ok) ls.set('studyhard.cloud.consent', POLICY_VERSION);
  return ok;
}

/** The Google ID token from the phone's account sheet (a stand-in in test runs). */
async function googleIdToken(app: App): Promise<{ token: string } | { cancelled: true } | { error: string }> {
  if (!FIREBASE) return { token: (window as { __mockGoogle?: string }).__mockGoogle ?? 'parent@example.com|Grown-up' };
  if (!app.native?.googleSignIn) return { error: 'Update MN to the newest version to sign in with Google.' };
  const r = await app.native.googleSignIn({ webClientId: FIREBASE.webClientId });
  if (r.idToken) return { token: r.idToken };
  if (r.cancelled) return { cancelled: true };
  return { error: r.error ?? 'Google sign-in didn’t work.' };
}

export type SignInResult = AccessAnswer | 'cancelled';

/** Consent, the account sheet, Firebase, then the approval check. */
export async function signIn(app: App): Promise<SignInResult> {
  const b = backend(app);
  if (!b) return 'error';
  if (!(await consent(app))) return 'cancelled';
  const t = await googleIdToken(app);
  if ('cancelled' in t) return 'cancelled';
  if ('error' in t) {
    app.toast(t.error, 5000);
    return 'error';
  }
  try {
    await b.signIn(t.token);
  } catch (e) {
    app.toast(e instanceof CloudError && e.kind === 'offline' ? 'No internet connection. Connect and try again.' : 'Google sign-in didn’t work. Please try again.', 5000);
    return 'error';
  }
  const a = await checkAccess(app);
  if (a === 'approved') await syncNow(app);
  return a;
}

/** Sign out on this phone. Progress stays on the phone. */
export async function signOut(app: App): Promise<void> {
  const b = backend(app);
  if (b) {
    b.session = null;
    ls.del(SESSION_KEY);
  }
  ls.del(MEMO_KEY);
  await app.native?.googleSignOut?.().catch(() => undefined);
  app.save.update((d) => {
    if (d.access) delete d.access.google;
  });
}

/** Delete everything this family has in the cloud, then sign out. */
export async function deleteCloudCopy(app: App): Promise<boolean> {
  const b = backend(app);
  if (!b?.session) return false;
  try {
    await b.deleteAll();
  } catch {
    return false;
  }
  await signOut(app);
  return true;
}

// ── syncing ─────────────────────────────────────────────────────────────────

export type SyncOutcome = { ok: true; added: Child[]; dropped: string[]; sent: number; at: number } | { ok: false; why: 'signed-out' | 'not-approved' | 'offline' | 'busy' | 'error'; message: string };

let running: Promise<SyncOutcome> | null = null;
let saves = 0;
let applying = false;

/** Children removed on this phone: the cloud (and other phones) remove them too. */
export function noteRemoved(id: string): void {
  const m = memo();
  m.removed[id] = Date.now();
  saveMemo(m);
}

/** After undo or starting over: this phone's copy replaces the cloud's (and every phone takes it). */
export function noteReplaced(id: string): void {
  const m = memo();
  (m.force ??= {})[id] = true;
  saveMemo(m);
}

export const lastSync = (): number => memo().lastSync;

/** Back up and sync now. Only one at a time. */
export function syncNow(app: App): Promise<SyncOutcome> {
  running ??= doSync(app).finally(() => (running = null));
  return running;
}

async function doSync(app: App): Promise<SyncOutcome> {
  const b = backend(app);
  if (!b?.session) return { ok: false, why: 'signed-out', message: 'Not signed in.' };
  if (!googleGate(app).ok && !isOwnerAccount(app)) {
    const a = await checkAccess(app);
    if (a !== 'approved') return { ok: false, why: a === 'offline' ? 'offline' : 'not-approved', message: a === 'waiting' ? 'Waiting for approval.' : 'Couldn’t check the account.' };
  }
  const startedAt = saves;
  const d = await device(app);
  try {
    let family = await b.getFamily();
    const now = Date.now();
    const m = memo();
    if (family?.deletedAt) {
      // Deleted on another phone after this one last synced: stop here.
      if (m.lastSync && m.lastSync < family.deletedAt) {
        await signOut(app);
        return { ok: false, why: 'signed-out', message: 'The cloud copy was deleted on another phone, so this phone signed out.' };
      }
      family = null;
    }
    const r = await planSync({ local: app.save.data.children, rules: familyRules(app.save.data.settings), memo: m, family, fetchChild: (id) => b.getChild(id), device: d.id, label: d.label, now });
    // Something was saved while we worked (a level finished): try again in a moment.
    if (saves !== startedAt) return { ok: false, why: 'busy', message: 'Busy, trying again soon.' };
    for (const doc of r.put) await b.putChild(doc);
    for (const id of r.del) await b.deleteChild(id);
    await b.putFamily(r.family, { kids: r.put.map((x) => x.childId), removed: Object.keys(r.family.removed).filter((id) => !family?.removed?.[id]), resets: r.resets, device: d.id });
    if (saves !== startedAt) return { ok: false, why: 'busy', message: 'Busy, trying again soon.' };
    applying = true;
    app.save.update((data) => {
      for (const c of r.children) {
        const here = data.children.find((x) => x.id === c.id);
        if (!here) data.children.push(c);
        else if (here !== c) {
          // Keep the same object (screens hold on to it), with the combined contents.
          for (const k of Object.keys(here)) if (!(k in c)) delete (here as unknown as Record<string, unknown>)[k];
          Object.assign(here, c);
        }
      }
      data.children = data.children.filter((c) => !r.dropped.includes(c.id));
      if (data.activeChildId && r.dropped.includes(data.activeChildId)) data.activeChildId = data.children[0]?.id ?? null;
      if (r.rules) Object.assign(data.settings, r.rules);
      if (r.added.length) data.setupDone = true;
    });
    applying = false;
    saveMemo(r.memo);
    return { ok: true, added: r.children.filter((c) => r.added.includes(c.id)), dropped: r.dropped, sent: r.put.length, at: now };
  } catch (e) {
    applying = false;
    const ce = e instanceof CloudError ? e : null;
    if (ce?.kind === 'signed-out') return { ok: false, why: 'signed-out', message: 'Please sign in again.' };
    if (ce?.kind === 'offline') return { ok: false, why: 'offline', message: 'No internet connection.' };
    return { ok: false, why: 'error', message: ce?.message ?? 'Couldn’t back up just now.' };
  }
}

/** Keep the cloud up to date: at start, a little after changes, and back from the background. */
export function startCloud(app: App): void {
  if (!cloudOn(app) || !backend(app)) return;
  let timer = 0;
  const later = (ms: number) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!account(app)) return;
      void syncNow(app).then((r) => {
        if (!r.ok && r.why === 'busy') later(20_000);
      });
    }, ms);
  };
  app.save.onSaved(() => {
    if (applying) return;
    saves++;
    if (account(app)) later(45_000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && account(app) && Date.now() - lastSync() > 5 * 60_000) later(1500);
  });
  if (account(app)) later(2500);
}

/** "Last backed up 5 min ago". */
export function syncText(at: number, now = Date.now()): string {
  if (!at) return 'Not backed up yet';
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return 'Backed up just now';
  if (m < 60) return `Backed up ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Backed up ${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.round(h / 24);
  return `Backed up ${days} day${days === 1 ? '' : 's'} ago`;
}

export const escEmail = (app: App): string => esc(account(app)?.email ?? '');
