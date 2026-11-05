// Google sign-in for grown-ups (groundwork; switched on once the Firebase project exists).
// The cloud keeps one document per child, families/{uid}/children/{childId}, holding the
// same checked backup as a report card. Syncing reuses the two-phone merge (mergeChild), so
// a phone and the cloud combine exactly like two phones do.
//
// Children never sign in. Everything a child learns with works the same without Google;
// signing in adds backup, sync and the parent's own phone (see claude/study-hard-google-login.md).

import type { Child } from '../storage/save.ts';
import { makeBackup, mergeChild, readBackup, type Backup } from './backup.ts';

/** Off until the Firebase config is in the app. */
export const GOOGLE_LOGIN = false;

/** What a family without Google keeps (shown to grown-ups; nothing a child plays with). */
export const LOCAL_LIMITS = { children: 3, logDays: 90 } as const;

export interface CloudChildDoc {
  v: 1;
  backup: Backup;
  /** When this phone last changed it (ms), and which phone. */
  updatedAt: number;
  device: string;
}

export async function toCloud(child: Child, device: string, now = Date.now()): Promise<CloudChildDoc> {
  return { v: 1, backup: await makeBackup(child, new Date(now)), updatedAt: now, device };
}

export type FromCloud = { ok: true; child: Child; changed: boolean } | { ok: false; reason: string };

/**
 * Bring a cloud copy into this phone: checked like a report card, then combined with the
 * phone's own copy of that child (if any). `localAt` is when this phone last synced it.
 */
export async function fromCloud(local: Child | undefined, doc: CloudChildDoc, localAt = 0): Promise<FromCloud> {
  const r = await readBackup(JSON.stringify(doc.backup));
  if (!r.ok) return r;
  const remote = r.backup.child;
  if (!local) return { ok: true, child: { ...remote, undo: [] }, changed: true };
  if (local.id !== remote.id) return { ok: false, reason: 'A different child.' };
  const merged = mergeChild(local, remote, doc.updatedAt > localAt);
  // Changed: compare both in the merge's own shape (it fills in empty fields).
  const shape = (c: Child) => JSON.stringify({ ...mergeChild(c, c, false), undo: 0 });
  return { ok: true, child: merged, changed: shape(merged) !== shape(local) };
}

/** Which children go up, come down, or both (a child on both sides is merged, then sent up). */
export function syncPlan(localIds: string[], cloudIds: string[]): { up: string[]; down: string[]; both: string[] } {
  const here = new Set(localIds);
  const there = new Set(cloudIds);
  return {
    up: localIds.filter((id) => !there.has(id)),
    down: cloudIds.filter((id) => !here.has(id)),
    both: localIds.filter((id) => there.has(id)),
  };
}

// ── gentle nudges (grown-ups only) ─────────────────────────────────────────

export interface NudgeState {
  /** Last time the grown-up was asked (ms), and "don't ask again". */
  askedAt?: number;
  never?: boolean;
}

const WEEK = 7 * 86_400_000;
const stars = (c: Child) => Object.values(c.progress.levels).reduce((n, l) => n + l.stars, 0);

/**
 * The grown-up's sign-in suggestion, or null. Only after something worth keeping (a reward
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

/** Shown under Backup in the parent area while not signed in. */
export const LOCAL_NOTE = 'Saved on this phone only';
