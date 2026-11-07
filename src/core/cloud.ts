// Google sign-in for parents: backup, restore and sync (first version, decided 5 Nov).
//
// In the cloud (Firestore, asia-south1), each family has:
//   families/{uid}                     consent, devices, when each child last changed, removed
//                                      children, and the family's rules (limits, bedtime…)
//   families/{uid}/children/{childId}  one child: the checked report-card backup, gzipped
// A phone and the cloud combine exactly like two phones do (mergeChild). Question history and
// undo notes stay on the phone. Children never sign in.
//
// This file is pure: it decides what to send and what to keep. platform/firebase.ts talks to
// Google, ui/cloud.ts runs it.

import { newChild, type Child, type Settings } from '../storage/save.ts';
import { makeBackup, mergeChild, readBackup, type Backup } from './backup.ts';

/** Which version of the privacy policy a parent agrees to when signing in. */
export const POLICY_VERSION = '2026-11-05';

// ── a child in the cloud ────────────────────────────────────────────────────

/** A child as stored: the backup without this phone's question history, gzipped. */
export interface CloudChild {
  childId: string;
  updatedAt: number;
  device: string;
  /** gzipped JSON of the Backup, base64. */
  data: string;
}

const toB64 = (u8: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** What goes up: no question history (rebuilt on each phone), no undo notes. */
export function forCloud(child: Child): Child {
  const c = JSON.parse(JSON.stringify(child)) as Child;
  c.progress.history = {};
  delete c.undo;
  // When this phone last saved a backup is this phone's own business (the reminder).
  delete c.backupAt;
  delete c.backupDays;
  return c;
}

export async function encodeChild(child: Child, device: string, now: number): Promise<CloudChild> {
  const backup = await makeBackup(forCloud(child), new Date(now));
  return { childId: child.id, updatedAt: now, device, data: toB64(await gzip(JSON.stringify(backup))) };
}

export type Decoded = { ok: true; child: Child; backup: Backup } | { ok: false; reason: string };

export async function decodeChild(doc: CloudChild): Promise<Decoded> {
  let text: string;
  try {
    text = await gunzip(fromB64(doc.data));
  } catch {
    return { ok: false, reason: 'The online backup could not be read.' };
  }
  const r = await readBackup(text);
  if (!r.ok) return r;
  if (r.backup.child.id !== doc.childId) return { ok: false, reason: 'A different child.' };
  return { ok: true, child: complete(r.backup.child), backup: r.backup };
}

/** Fill in anything an older copy didn't have (as a restored progress file is). */
export function complete(c: Child): Child {
  const base = newChild(c.name, c.age ?? 6, c.avatar ?? 0, c.createdDay ?? '');
  return { ...base, ...c, id: c.id, progress: { ...base.progress, ...c.progress }, wallet: { ...base.wallet, ...c.wallet }, stats: { ...base.stats, ...c.stats }, undo: c.undo ?? [] };
}

/** The same child in the merge's own shape, for "did anything change?" (it fills in empty fields). */
const shape = (c: Child): string => JSON.stringify(mergeChild(forCloud(c), forCloud(c), false));
export const sameChild = (a: Child, b: Child): boolean => shape(a) === shape(b);

/**
 * Combine the phone's copy with the cloud's. The newer side gives name, age and picture; the
 * rest takes the best of both. This phone's question history and undo notes stay.
 */
export function combine(local: Child, remote: Child, remoteNewer: boolean): Child {
  const out = mergeChild(local, remote, remoteNewer);
  out.progress.history = local.progress.history;
  out.undo = local.undo ?? [];
  return out;
}

// ── the family document ─────────────────────────────────────────────────────

/** The family's rules, shared by every phone. Look, sound and voice stay with each phone. */
export const FAMILY_KEYS = ['limitMinutes', 'timeUpMode', 'treatPace', 'goalPace', 'holiday', 'hiddenCategories', 'timerSeconds', 'confirmAnswers', 'teach', 'ownRewards', 'quiet'] as const;
export type FamilyKey = (typeof FAMILY_KEYS)[number];
export type FamilyRules = Partial<Pick<Settings, FamilyKey>>;

export const familyRules = (s: Settings): FamilyRules => {
  const out: Record<string, unknown> = {};
  for (const k of FAMILY_KEYS) if (s[k] !== undefined) out[k] = JSON.parse(JSON.stringify(s[k]));
  return out as FamilyRules;
};
export const sameRules = (a: FamilyRules, b: FamilyRules): boolean => FAMILY_KEYS.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));

export interface FamilyDoc {
  v: 1;
  consentAt: number;
  policy: string;
  /** childId → when its online backup last changed (ms). */
  kids: Record<string, number>;
  /** childId → when a parent removed that child (it is removed on every phone). */
  removed: Record<string, number>;
  /** childId → when a phone replaced the online backup (undo, starting over): other phones take it as it is. */
  resets: Record<string, number>;
  /** deviceId → its label and last sync (ms). */
  devices: Record<string, { label: string; at: number }>;
  rules: FamilyRules;
  rulesAt: number;
  /** The phone that last synced. Without MN Premium (Play build) only this phone keeps the online backup. */
  primary?: string;
  /** A parent deleted the online backup then (only this is left; phones that synced before sign out). */
  deletedAt?: number;
}

// ── what this phone remembers about syncing (kept on the phone, never in a backup) ──

export interface SyncMemo {
  /** childId → the cloud's updatedAt this phone last had in hand, and a fingerprint of what it sent. */
  kidsAt: Record<string, number>;
  hash: Record<string, number>;
  /** Children removed on this phone, not yet told to the cloud. */
  removed: Record<string, number>;
  /** Children whose copy here replaces the cloud's next time (after undo or starting over). */
  force?: Record<string, true>;
  /** childId → the latest replacement this phone has taken. */
  resets?: Record<string, number>;
  /** The family rules as last synced, and when they changed. */
  rules?: FamilyRules;
  rulesAt: number;
  lastSync: number;
}
export const freshMemo = (): SyncMemo => ({ kidsAt: {}, hash: {}, removed: {}, rulesAt: 0, lastSync: 0 });

// ── one sync, decided ───────────────────────────────────────────────────────

export interface SyncInput {
  local: Child[];
  rules: FamilyRules;
  memo: SyncMemo;
  family: FamilyDoc | null;
  /** Fetches a child's online backup (only called for children that changed in the cloud). */
  fetchChild: (id: string) => Promise<CloudChild | null>;
  device: string;
  label: string;
  now: number;
  /**
   * A child on this phone that isn't in the cloud yet, and a different child in the cloud with
   * the same name (set up separately on another phone): combine them into one? Left out, both are kept.
   */
  combineWith?: (here: Child, there: Child) => Promise<boolean>;
}

/** "Riya", " riya " and "RIYA" are the same name. */
export const sameName = (a: string, b: string): boolean => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

export interface SyncResult {
  /** The children this phone should have now (same order, new ones at the end). */
  children: Child[];
  /** Ids added to this phone from the cloud, and ids removed here because they were removed elsewhere. */
  added: string[];
  dropped: string[];
  /** What to send: child copies to write, child copies to delete, and the new family document. */
  put: CloudChild[];
  del: string[];
  /** Children whose online backup this phone just replaced. */
  resets: string[];
  family: FamilyDoc;
  /** Family rules to apply here (when another phone changed them later). */
  rules?: FamilyRules;
  memo: SyncMemo;
  /** Children whose online backup couldn't be read (kept as they are on this phone). */
  skipped: string[];
  /** Children combined with a same-named child from the cloud: id here → the cloud's id (which they now use). */
  renamed: Record<string, string>;
}

export async function planSync(p: SyncInput): Promise<SyncResult> {
  const fam: FamilyDoc = p.family
    ? JSON.parse(JSON.stringify(p.family))
    : { v: 1, consentAt: p.now, policy: POLICY_VERSION, kids: {}, removed: {}, resets: {}, devices: {}, rules: {}, rulesAt: 0 };
  fam.resets ??= {};
  const memo: SyncMemo = { ...freshMemo(), ...JSON.parse(JSON.stringify(p.memo)) };
  memo.resets ??= {};
  const resets: string[] = [];
  // Removed anywhere is removed everywhere.
  const removed = { ...fam.removed, ...memo.removed };
  fam.removed = removed;
  memo.removed = {};
  const dropped = p.local.filter((c) => removed[c.id]).map((c) => c.id);
  const del = Object.keys(fam.kids).filter((id) => removed[id]);
  for (const id of del) delete fam.kids[id];

  const children: Child[] = [];
  const put: CloudChild[] = [];
  const skipped: string[] = [];
  const added: string[] = [];

  // The same child set up separately on two phones: offer to combine them (the cloud's id wins).
  const renamed: Record<string, string> = {};
  const cloudCopies = new Map<string, Child>();
  if (p.combineWith) {
    const here = new Set(p.local.map((c) => c.id));
    const newcomers = p.local.filter((c) => !removed[c.id] && fam.kids[c.id] === undefined);
    const strangers = Object.keys(fam.kids).filter((id) => !here.has(id) && !removed[id]);
    if (newcomers.length && strangers.length) {
      for (const id of strangers) {
        const doc = await p.fetchChild(id);
        const d = doc ? await decodeChild(doc) : null;
        if (d?.ok) cloudCopies.set(id, d.child);
      }
      for (const c of newcomers) {
        const taken = new Set(Object.values(renamed));
        const match = [...cloudCopies.entries()].find(([id, there]) => !taken.has(id) && sameName(c.name, there.name));
        if (match && (await p.combineWith(c, match[1]))) renamed[c.id] = match[0];
      }
    }
  }

  for (const here of p.local) {
    if (removed[here.id]) continue;
    const pair = renamed[here.id];
    if (pair) {
      const c = combine({ ...here, id: pair }, cloudCopies.get(pair)!, fam.kids[pair] > lastPlayed(here));
      children.push(c);
      const doc = await encodeChild(c, p.device, p.now);
      put.push(doc);
      fam.kids[pair] = doc.updatedAt;
      memo.kidsAt[pair] = doc.updatedAt;
      memo.hash[pair] = hashOf(c);
      if (fam.resets[pair]) memo.resets[pair] = fam.resets[pair];
      continue;
    }
    const cloudAt = fam.kids[here.id];
    let c = here;
    let send = cloudAt === undefined || !!memo.force?.[here.id];
    if (memo.force?.[here.id]) {
      // Undo or starting over on this phone: this copy replaces the cloud's, everywhere.
      fam.resets[here.id] = p.now;
      resets.push(here.id);
    } else if ((fam.resets[here.id] ?? 0) > (memo.resets[here.id] ?? 0)) {
      // Another phone replaced the online backup: take it as it is (keeping this phone's history).
      const doc = await p.fetchChild(here.id);
      const d = doc ? await decodeChild(doc) : null;
      if (!d?.ok) {
        skipped.push(here.id);
        children.push(here);
        continue;
      }
      c = { ...d.child, progress: { ...d.child.progress, history: here.progress.history }, undo: [] };
      send = false;
    } else if (cloudAt !== undefined && cloudAt !== memo.kidsAt[here.id]) {
      // Changed in the cloud since this phone last looked: bring it in.
      const doc = await p.fetchChild(here.id);
      const d = doc ? await decodeChild(doc) : null;
      if (d?.ok) {
        c = combine(here, d.child, cloudAt > lastPlayed(here));
        send = !sameChild(c, d.child);
      } else {
        skipped.push(here.id);
        children.push(here);
        continue;
      }
    } else if (cloudAt !== undefined) {
      // Same online backup as last time: send only if this phone has new play (or changes).
      send = memo.hash[here.id] !== hashOf(here);
    }
    children.push(c);
    if (send) {
      const doc = await encodeChild(c, p.device, p.now);
      put.push(doc);
      fam.kids[c.id] = doc.updatedAt;
    }
    memo.kidsAt[c.id] = fam.kids[c.id];
    memo.hash[c.id] = hashOf(c);
    if (fam.resets[c.id]) memo.resets[c.id] = fam.resets[c.id];
  }
  // Children only in the cloud: restore them here.
  for (const id of Object.keys(fam.kids)) {
    if (children.some((c) => c.id === id) || removed[id] || skipped.includes(id)) continue;
    let child = cloudCopies.get(id);
    if (!child) {
      const doc = await p.fetchChild(id);
      const d = doc ? await decodeChild(doc) : null;
      if (!d?.ok) {
        skipped.push(id);
        continue;
      }
      child = d.child;
    }
    children.push(child);
    added.push(id);
    memo.kidsAt[id] = fam.kids[id];
    memo.hash[id] = hashOf(child);
    if (fam.resets[id]) memo.resets[id] = fam.resets[id];
  }

  // Family rules. A phone joining a family takes the family's; after that, the side that
  // changed since the last sync wins (this phone, if both did: it is the one syncing now).
  let rules: FamilyRules | undefined;
  const changedHere = !!memo.rules && !sameRules(memo.rules, p.rules);
  const changedThere = fam.rulesAt > memo.rulesAt;
  if (!fam.rulesAt || changedHere) {
    fam.rules = p.rules;
    fam.rulesAt = p.now;
  } else if (changedThere || !memo.rules) rules = fam.rules;
  memo.rules = rules ?? fam.rules;
  memo.rulesAt = fam.rulesAt;

  memo.force = {};
  fam.devices[p.device] = { label: p.label, at: p.now };
  fam.primary = p.device;
  memo.lastSync = p.now;
  return { children, added, dropped, put, del, resets, family: fam, rules, memo, skipped, renamed };
}

/** The latest moment this child played (ms). */
export function lastPlayed(c: Child): number {
  return c.log?.length ? c.log[c.log.length - 1].t : 0;
}

/** A short fingerprint of what would go up, so an unchanged child isn't sent again. */
export function hashOf(c: Child): number {
  const s = shape(c);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ── gentle nudges (parents only) ─────────────────────────────────────────

export interface NudgeState {
  /** Last time the parent was asked (ms), and "don't ask again". */
  askedAt?: number;
  never?: boolean;
}

const WEEK = 7 * 86_400_000;
const stars = (c: Child) => Object.values(c.progress.levels).reduce((n, l) => n + l.stars, 0);

/**
 * The parent's sign-in suggestion, or null. Only after something worth keeping (a reward
 * reached, or a week of play days), at most once a week, never after "don't ask again".
 */
export function nudgeFor(state: NudgeState | undefined, kids: Child[], signedIn: boolean, now: number): string | null {
  if (signedIn || state?.never || !kids.length) return null;
  if (state?.askedAt && now - state.askedAt < WEEK) return null;
  const worth = kids
    .map((c) => ({ c, stars: stars(c), days: Object.values(c.stats.secondsByDay).filter((s) => s > 0).length, rewarded: c.wallet.earned.length > 0 || c.wallet.treat.waiting || c.wallet.goal.waiting }))
    .filter((k) => k.rewarded || k.days >= 7)
    .sort((a, b) => b.stars - a.stars)[0];
  if (!worth) return null;
  return `${worth.c.name} has ${worth.stars.toLocaleString('en-IN')} stars. Keep them safe with Google, in one tap.`;
}
