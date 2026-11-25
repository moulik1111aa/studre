// Google sign-in on the phone: the parent signs in (behind the parent check, or on the
// lock screen), and the family's progress is backed up and kept in sync. On the app shared by
// link, signing in also opens MN (no approval since 25 Nov), and a parent may ask the owner
// for MN × (none of that is in the Play build, where MN × is bought). All the deciding is in
// core/cloud.ts and core/gate.ts; the talking to Google is in platform/cloudapi.ts.

import { cleanRules } from '../core/clean.ts';
import { escv, esc, type App } from './app.ts';
import { FIREBASE } from '../platform/firebase-config.ts';
import { CloudError, FirebaseRest, type CloudBackend, type Session } from '../platform/cloudapi.ts';
// #unless play
import { MemoryCloud, OWNER_EMAIL } from '../platform/cloudapi.ts';
import { confirmGate, gateState, seen, type GateState } from '../core/gate.ts';
import { plusChanged } from './pluschange.ts';
// #end
import { decodeChild, familyRules, freshMemo, planSync, POLICY_VERSION, sameRules, type SyncMemo } from '../core/cloud.ts';
import type { Backup } from '../core/backup.ts';
import { familyFileOf } from '../core/familyfile.ts';
import { familyFileHtml, familyFileName } from './familyfile.ts';
import { saveTextFile } from '../platform/files.ts';
import { myPhone } from './access.ts';
import type { Child } from '../storage/save.ts';
import { freeSyncDue } from '../core/membership.ts';
import { giveThanks } from '../core/wardrobe.ts';

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

/** Browser test runs use a stand-in cloud (never in the Play build). */
const mock = (app: App): boolean => {
  // #unless play
  if (app.debug && new URLSearchParams(location.search).has('cloudmock')) return true;
  // #end
  return false;
};

/** Is Google sign-in available in this build? */
export const cloudOn = (app: App): boolean => !!FIREBASE || mock(app);

let be: CloudBackend | null = null;
export function backend(app: App): CloudBackend | null {
  if (be) return be;
  if (!cloudOn(app)) return null;
  const saved = readJson<Session>(SESSION_KEY);
  const keep = (s: Session | null) => (s ? ls.set(SESSION_KEY, JSON.stringify(s)) : ls.del(SESSION_KEY));
  // #unless play
  if (mock(app)) return (be = new MemoryCloud(ls, saved, keep));
  // #end
  be = FIREBASE ? new FirebaseRest(FIREBASE, saved, keep) : null;
  return be;
}

export const account = (app: App): Session | null => backend(app)?.session ?? null;
// #unless play
export const isOwnerAccount = (app: App): boolean => account(app)?.email === OWNER_EMAIL;
// #end

const memo = (): SyncMemo => ({ ...freshMemo(), ...(readJson<SyncMemo>(MEMO_KEY) ?? {}) });
const saveMemo = (m: SyncMemo) => ls.set(MEMO_KEY, JSON.stringify(m));

/** This phone's id and label in the family document. */
async function device(app: App): Promise<{ id: string; label: string; phone: string }> {
  const phone = await myPhone(app);
  return { id: `d${phone.replace(/[^A-Za-z0-9]/g, '')}`, label: `Phone ${phone}`, phone };
}

// ── MN × from the owner (the app shared by link) ────────────────────────────

// #unless play
/** MN × the owner gave the signed-in account, as this phone last heard (works offline for 14 days). */
export function plusGrant(app: App): GateState {
  const g = app.save.data.access?.google;
  const now = Date.now();
  // Another account signed in on this phone: its MN × is its own.
  const who = account(app)?.email;
  if (g && who && g.email !== who) return { ok: false, reason: 'none' };
  const st = gateState(g, now);
  if (g && st.ok && now > g.maxSeen + 60_000) app.save.update((d) => (d.access!.google = seen(d.access!.google, now)));
  return st;
}

/** What this phone knows about asking for MN × (per account): when it last checked, the open
 *  request's time (0: none), and when MN × last ended (0: it didn't). */
interface AskNote {
  uid: string;
  checkedAt: number;
  askedAt: number;
  endedAt: number;
}
const ASK_KEY = 'studyhard.mnx.ask';
export function askNote(app: App): AskNote {
  const uid = account(app)?.uid ?? '';
  const n = readJson<AskNote>(ASK_KEY);
  return n && n.uid === uid ? n : { uid, checkedAt: 0, askedAt: 0, endedAt: 0 };
}
const saveAsk = (n: AskNote) => ls.set(ASK_KEY, JSON.stringify(n));

/** How often MN checks the owner's answer: often while a request is open, else a few times a day. */
const CHECK_ASKED = 10 * 60_000;
const CHECK_EVERY = 6 * 3_600_000;

export type PlusCheck = 'on' | 'asked' | 'off' | 'offline' | 'signed-out' | 'error';

/**
 * Ask the cloud for this account's MN × (and whether a request is open). Not more often than
 * every few hours (every 10 minutes while a request is open) unless `force`.
 */
export async function checkPlus(app: App, force = false): Promise<PlusCheck> {
  const b = backend(app);
  const s = b?.session;
  if (!b || !s) return 'signed-out';
  const before = plusGrant(app).ok;
  const n = askNote(app);
  const now = Date.now();
  if (!force && now - n.checkedAt < (n.askedAt ? CHECK_ASKED : CHECK_EVERY) && now >= n.checkedAt) return before ? 'on' : n.askedAt ? 'asked' : 'off';
  try {
    const [e, r] = await Promise.all([b.myAccess(), b.myRequest()]);
    const at = Date.now();
    const ok = !!e && (!e.until || e.until > at);
    app.save.update((data) => {
      data.access ??= {};
      data.access.google = confirmGate(data.access.google, s.email, ok ? e!.until : null, at);
    });
    saveAsk({ uid: s.uid, checkedAt: at, askedAt: !ok && r ? r.at || at : 0, endedAt: !ok && e?.until ? e.until : 0 });
    if (ok) {
      const d = await device(app);
      await b.checkIn(d.id, { phone: d.phone, label: d.label, version: appVersion(), at }).catch(() => undefined);
      // The request has its answer: tidy it away.
      if (r) await b.dropMyRequest().catch(() => undefined);
    }
    if (ok !== before) plusChanged();
    return ok ? 'on' : r ? 'asked' : 'off';
  } catch (e) {
    return e instanceof CloudError ? (e.kind === 'offline' ? 'offline' : e.kind === 'signed-out' ? 'signed-out' : 'error') : 'error';
  }
}

/** Ask the owner for MN × (requests/{uid}: the parent's email and name, this phone's code and label). */
export async function askForPlus(app: App): Promise<'sent' | 'offline' | 'signed-out' | 'error'> {
  const b = backend(app);
  const s = b?.session;
  if (!b || !s) return 'signed-out';
  const d = await device(app);
  const at = Date.now();
  try {
    await b.requestAccess({ phone: d.phone, device: d.label, version: appVersion(), at });
  } catch (e) {
    return e instanceof CloudError ? (e.kind === 'offline' ? 'offline' : e.kind === 'signed-out' ? 'signed-out' : 'error') : 'error';
  }
  saveAsk({ ...askNote(app), uid: s.uid, askedAt: at, endedAt: 0 });
  return 'sent';
}

const appVersion = (): string => (globalThis as { MN_VERSION?: string }).MN_VERSION ?? 'web';
// #end

// ── signing in ──────────────────────────────────────────────────────────────

/** The parent agrees to what is kept in the cloud (shown before the first sign-in on a phone). */
async function consent(app: App): Promise<boolean> {
  if (ls.get('studyhard.cloud.consent') === POLICY_VERSION) return true;
  const { result } = app.sheet(
    `<h2>Sign in with Google</h2>
     <p>For parents only. MN keeps a private copy of your family’s progress in your own space in Google’s cloud (Mumbai), so it is backed up and the same on every phone:</p>
     <ul class="cl-list"><li>your Google email and name</li><li>each child’s first name, age and avatar</li><li>levels, stars, rewards and play times</li><li>your family’s settings, like time limits and bedtime</li><li>a label for each phone you sign in on, like “Phone K7Q4-MZ2P”, and when it last synced</li></ul>
     <p>No photos, location or contacts, and no ads. You can delete the online backup any time in the Parent area.</p>
     <p class="fine" style="overflow-wrap:anywhere">Privacy policy: mn-mission-next.web.app/privacy</p>`,
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
  // #unless play
  if (!FIREBASE || mock(app)) return { token: (window as { __mockGoogle?: string }).__mockGoogle ?? 'parent@example.com|Parent' };
  // #end
  if (!FIREBASE) return { error: 'Google sign-in isn’t available in this version of MN.' };
  if (!app.native?.googleSignIn) return { error: 'Update MN to the newest version to sign in with Google.' };
  const r = await app.native.googleSignIn({ webClientId: FIREBASE.webClientId });
  if (r.idToken) return { token: r.idToken };
  if (r.cancelled) return { cancelled: true };
  return { error: r.error ?? 'Google sign-in didn’t work.' };
}

export type SignInResult = 'signed-in' | 'cancelled' | 'offline' | 'error';

/** Consent, the account sheet, Firebase, then the first backup. */
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
    const offline = e instanceof CloudError && e.kind === 'offline';
    app.toast(offline ? 'No internet connection. Connect and try again.' : 'Google sign-in didn’t work. Please try again.', 5000);
    return offline ? 'offline' : 'error';
  }
  // The app shared by link: does the owner already give this account MN ×? (Quickly; it carries on regardless.)
  // #unless play
  if (!app.store) await Promise.race([checkPlus(app, true), new Promise((r) => setTimeout(r, 4000))]);
  // #end
  await syncNow(app, true);
  // A thank-you for the children: Plus gets a Cloud cape (shown to each child once).
  let got: Child[] = [];
  app.save.update((d) => (got = giveThanks(d.children, Date.now())));
  if (got.length) setTimeout(() => app.toast(`Thank you! ${got.length === 1 ? got[0].name : 'Each child'} will find a present for Plus next time they play.`, 5000), 5200);
  return 'signed-in';
}

/** Sign out on this phone. Progress stays on the phone. */
export async function signOut(app: App): Promise<void> {
  const b = backend(app);
  if (b) {
    b.session = null;
    ls.del(SESSION_KEY);
  }
  ls.del(MEMO_KEY);
  ls.del(OTHER_KEY);
  await app.native?.googleSignOut?.().catch(() => undefined);
  // #unless play
  const had = plusGrant(app).ok;
  ls.del(ASK_KEY);
  // #end
  app.save.update((d) => {
    if (d.access) delete d.access.google;
  });
  // #unless play
  if (had) plusChanged();
  // #end
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

/** Delete the family's online backup and the MN sign-in account, then sign out. */
export async function deleteCloudAccount(app: App): Promise<boolean> {
  const b = backend(app);
  if (!b?.session) return true;
  try {
    await b.deleteAccount();
  } catch {
    return false;
  }
  await signOut(app);
  return true;
}

// ── syncing ─────────────────────────────────────────────────────────────────

export type SyncOutcome = { ok: true; added: Child[]; dropped: string[]; sent: number; at: number } | { ok: false; why: 'signed-out' | 'offline' | 'busy' | 'error' | 'other-phone'; message: string };

/**
 * Without MN × the backup is an online backup from one phone: the phone that last backed up.
 * Another phone signing in takes it over (bringing the family's progress with it); the first
 * phone then stops until a parent takes it back.
 */
export const onePhone = (app: App): boolean => !app.plus();
const OTHER_KEY = 'studyhard.cloud.other';
/** The other phone that keeps the online backup now (one-phone backup), if any. */
export const otherPhone = (): string | null => ls.get(OTHER_KEY);

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

/** Back up and sync now. Only one at a time. `takeOver`: this phone keeps the online backup from now on. */
export function syncNow(app: App, asking = false, takeOver = false): Promise<SyncOutcome> {
  running ??= doSync(app, asking, takeOver).finally(() => (running = null));
  return running;
}

async function doSync(app: App, asking: boolean, takeOver: boolean): Promise<SyncOutcome> {
  const b = backend(app);
  if (!b?.session) return { ok: false, why: 'signed-out', message: 'Not signed in.' };
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
        return { ok: false, why: 'signed-out', message: 'The online backup was deleted on another phone, so this phone signed out.' };
      }
      family = null;
    }
    // One-phone backup: another phone took over the online backup since this one last backed up.
    if (onePhone(app) && family?.primary && family.primary !== d.id && m.lastSync && !takeOver) {
      const label = family.devices[family.primary]?.label ?? 'another phone';
      ls.set(OTHER_KEY, label);
      return { ok: false, why: 'other-phone', message: `The online backup now comes from ${label}.` };
    }
    const r = await planSync({ local: app.save.data.children, rules: familyRules(app.save.data.settings), memo: m, family, fetchChild: (id) => b.getChild(id), device: d.id, label: d.label, now, combineWith: asking ? (here, there) => askCombine(app, here, there) : undefined });
    // Something was saved while we worked (a level finished): try again in a moment.
    if (saves !== startedAt) return { ok: false, why: 'busy', message: 'Busy, trying again soon.' };
    for (const doc of r.put) await b.putChild(doc);
    for (const id of r.del) await b.deleteChild(id);
    await b.putFamily(r.family, { kids: r.put.map((x) => x.childId), removed: Object.keys(r.family.removed).filter((id) => !family?.removed?.[id]), resets: r.resets, device: d.id, gone: r.gonePhones });
    if (saves !== startedAt) return { ok: false, why: 'busy', message: 'Busy, trying again soon.' };
    applying = true;
    const rulesBefore = familyRules(app.save.data.settings);
    app.save.update((data) => {
      // Combined with the same child from another phone: it takes that child's id.
      for (const [old, id] of Object.entries(r.renamed)) {
        const here = data.children.find((x) => x.id === old);
        if (here) here.id = id;
        if (data.activeChildId === old) data.activeChildId = id;
      }
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
      // The cloud's rules are checked like a file's: only the shared rules, each in range.
      if (r.rules) Object.assign(data.settings, cleanRules(r.rules));
      if (r.added.length) data.setupDone = true;
      // The cloud now holds every child: that counts as backed up (the reminder can rest).
      for (const c of data.children) {
        c.backupAt = now;
        c.backupDays = Object.values(c.stats.secondsByDay).filter((x) => x > 0).length;
      }
    });
    // New rules from the cloud take effect at once, and the open screen shows them (still
    // "applying", so this save isn't sent straight back up).
    if (!sameRules(rulesBefore, familyRules(app.save.data.settings))) app.applySettings({ redraw: true });
    applying = false;
    saveMemo(r.memo);
    ls.del(OTHER_KEY);
    return { ok: true, added: r.children.filter((c) => r.added.includes(c.id)), dropped: r.dropped, sent: r.put.length, at: now };
  } catch (e) {
    applying = false;
    const ce = e instanceof CloudError ? e : null;
    if (ce?.kind === 'signed-out') return { ok: false, why: 'signed-out', message: 'Please sign in again.' };
    if (ce?.kind === 'offline') return { ok: false, why: 'offline', message: 'No internet connection.' };
    return { ok: false, why: 'error', message: ce?.message ?? 'Couldn’t back up just now.' };
  }
}

/**
 * Download the family's online backup as a backup file: the very same checked backups the cloud
 * keeps, so the file restores on any phone just like the cloud does.
 */
export async function downloadCloudCopy(app: App): Promise<'saved' | 'empty' | 'cancelled' | 'offline' | 'error'> {
  const b = backend(app);
  if (!b?.session) return 'error';
  try {
    const family = await b.getFamily();
    if (!family || family.deletedAt) return 'empty';
    const backups: Backup[] = [];
    for (const id of Object.keys(family.kids)) {
      if (family.removed?.[id]) continue;
      const doc = await b.getChild(id);
      if (!doc) continue;
      const d = await decodeChild(doc);
      if (d.ok) backups.push(d.backup);
    }
    if (!backups.length) return 'empty';
    const f = familyFileOf(backups, family.rules ?? {}, 'cloud');
    return (await saveTextFile(app, familyFileName(app.today, 'cloud'), 'text/html', familyFileHtml(f))) ? 'saved' : 'cancelled';
  } catch (e) {
    return e instanceof CloudError && e.kind === 'offline' ? 'offline' : 'error';
  }
}

/** The same name on this phone and in the family's backup: one child or two? */
async function askCombine(app: App, here: Child, there: Child): Promise<boolean> {
  const stars = (c: Child) => Object.values(c.progress.levels).reduce((n, l) => n + l.stars, 0);
  const { result } = app.sheet(
    `<h2>Combine ${esc(here.name)}?</h2>
     <p>Your family’s backup already has <b>${esc(there.name)}</b> (age ${escv(there.age)}, ${escv(stars(there))} ⭐) from another phone. This phone has <b>${esc(here.name)}</b> (age ${here.age}, ${stars(here)} ⭐).</p>
     <p>Combine them into one? Stars, coins, rewards and play from both phones are all kept.</p>`,
    [
      { label: `Yes, it’s the same child`, value: true, kind: 'mint' },
      { label: 'No, keep both', value: false, kind: 'ghost', back: true },
    ],
    `Combine ${here.name}`,
  );
  return (await result) === true;
}

/** Keep the cloud up to date: at start, a little after changes, and back from the background. */
export function startCloud(app: App): void {
  if (!cloudOn(app) || !backend(app)) return;
  let timer = 0;
  const later = (ms: number) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!account(app)) return;
      // One-phone backup: an online backup every few hours (and never from a phone that handed it on).
      if (onePhone(app) && (otherPhone() || !freeSyncDue(lastSync(), Date.now(), false))) return;
      void syncNow(app).then((r) => {
        if (!r.ok && r.why === 'busy') later(20_000);
      });
    }, ms);
  };
  // Tests (debug only, never in the Play build): sync now instead of waiting.
  // #unless play
  if (app.debug) Object.assign(window, { __syncNow: () => syncNow(app) });
  // #end
  app.save.onSaved(() => {
    if (applying) return;
    saves++;
    if (account(app)) later(45_000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && account(app) && Date.now() - lastSync() > 5 * 60_000) later(1500);
  });
  if (account(app)) later(2500);
  // The app shared by link: the owner's answer about MN × (a few times a day; every 10 minutes
  // while a request is open), when MN opens and when it comes back.
  // #unless play
  if (!app.store) {
    const check = () => void (account(app) && checkPlus(app));
    check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  }
  // #end
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
