// A child's backup, carried inside the exported report card (an .html file that opens in any
// browser). Importing the file in MN on another phone adds the child there, or, if the same
// child is already on that phone, combines both: best stars, all play days, the play log
// from both, and the jars from whichever phone earned more. A check value stops a file that
// was edited by hand (say, to add coins) from being imported.

import type { Child } from '../storage/save.ts';
import type { LevelResult } from './path.ts';
import { logPlay, type PlayEntry, type Tally } from './stats.ts';

export const BACKUP_FORMAT = 'mn-child-backup';
export const BACKUP_VERSION = 1;
const SALT = 'MN Mission Next · child backup · v1';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  child: Child;
  check: string;
}

async function sha256(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const body = (b: Pick<Backup, 'format' | 'version' | 'exportedAt' | 'child'>) => JSON.stringify({ format: b.format, version: b.version, exportedAt: b.exportedAt, child: b.child });

/** Pack a child for export (without the undo notes, which only make sense on this phone). */
export async function makeBackup(child: Child, now = new Date()): Promise<Backup> {
  const copy = JSON.parse(JSON.stringify(child)) as Child;
  delete copy.undo;
  const b = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), child: copy } as const;
  return { ...b, check: await sha256(SALT + body(b)) };
}

/** The backup as text that is safe inside an HTML <script> element. */
export const backupJson = (b: Backup): string => JSON.stringify(b).replace(/</g, '\\u003c');

export type ReadResult = { ok: true; backup: Backup } | { ok: false; reason: string };

/** Read a backup from an exported report card (or its bare JSON) and check it is intact. */
export async function readBackup(text: string): Promise<ReadResult> {
  const m = /<script[^>]*id="mn-backup"[^>]*>([\s\S]*?)<\/script>/.exec(text);
  const raw = (m ? m[1] : text).trim();
  let b: Backup;
  try {
    b = JSON.parse(raw) as Backup;
  } catch {
    return { ok: false, reason: 'This file isn’t an MN report card.' };
  }
  if (b?.format !== BACKUP_FORMAT || !b.child) return { ok: false, reason: 'This file isn’t an MN report card.' };
  if (b.version > BACKUP_VERSION) return { ok: false, reason: 'This file comes from a newer MN. Update the app, then try again.' };
  if (b.check !== (await sha256(SALT + body(b)))) return { ok: false, reason: 'This file has been changed since it was saved, so it can’t be imported.' };
  const c = b.child;
  if (typeof c.id !== 'string' || typeof c.name !== 'string' || !c.progress?.levels || !c.wallet || !c.stats) return { ok: false, reason: 'This report card is missing some of its data.' };
  return { ok: true, backup: b };
}

const total = (t: Tally | undefined) => Object.values(t ?? {}).reduce((a, r) => a + r[0], 0);

/**
 * Combine the same child from two phones. Progress takes the best of both; the jars and
 * rewards come from whichever side has earned more coins (mixing two jars could double a
 * treat); the play log is merged without duplicates. Name, age and picture come from the
 * newer side (`incomingNewer`).
 */
export function mergeChild(here: Child, incoming: Child, incomingNewer: boolean): Child {
  const out = JSON.parse(JSON.stringify(incomingNewer ? incoming : here)) as Child;
  const other = incomingNewer ? here : incoming;
  // Levels: the better result of each.
  const levels: Record<string, LevelResult> = { ...here.progress.levels };
  for (const [id, r] of Object.entries(incoming.progress.levels)) {
    const mine = levels[id];
    levels[id] = mine ? { stars: Math.max(mine.stars, r.stars) as LevelResult['stars'], passes: Math.max(mine.passes, r.passes) } : r;
  }
  out.progress.levels = levels;
  out.progress.skipped = { ...here.progress.skipped, ...incoming.progress.skipped };
  out.progress.skippedLevels = { ...(here.progress.skippedLevels ?? {}), ...(incoming.progress.skippedLevels ?? {}) };
  const seen = { ...here.progress.lastSeen };
  for (const [id, d] of Object.entries(incoming.progress.lastSeen)) if (!seen[id] || d > seen[id]) seen[id] = d;
  out.progress.lastSeen = seen;
  const qb = { ...(here.progress.questBest ?? {}) };
  for (const [id, n] of Object.entries(incoming.progress.questBest ?? {})) qb[id] = Math.max(qb[id] ?? 0, n);
  out.progress.questBest = qb;
  // Time: the longer of the two for each day (the same day may have been played on one phone only).
  const days = { ...here.stats.secondsByDay };
  for (const [d, s] of Object.entries(incoming.stats.secondsByDay)) days[d] = Math.max(days[d] ?? 0, s);
  out.stats = { answered: Math.max(here.stats.answered, incoming.stats.answered), correct: Math.max(here.stats.correct, incoming.stats.correct), secondsByDay: days };
  // Jars and rewards: from whoever has earned more.
  out.wallet = JSON.parse(JSON.stringify(here.wallet.lifetime >= incoming.wallet.lifetime ? here.wallet : incoming.wallet));
  out.bossesBeaten = [...new Set([...here.bossesBeaten, ...incoming.bossesBeaten])];
  out.placed = here.placed || incoming.placed;
  // Play log: both, once each, oldest first; tallies from the side with more answers, then
  // topped up with log entries only the other side had.
  const key = (e: PlayEntry) => `${e.t}|${e.id}`;
  const base = total(here.tally) >= total(incoming.tally) ? here : incoming;
  const extra = base === here ? incoming : here;
  const known = new Set((base.log ?? []).map(key));
  const holder = { log: [...(base.log ?? [])], tally: JSON.parse(JSON.stringify(base.tally ?? {})) as Tally };
  for (const e of (extra.log ?? []).filter((x) => !known.has(key(x))).sort((a, b) => a.t - b.t)) logPlay(holder, e);
  holder.log.sort((a, b) => a.t - b.t);
  out.log = holder.log;
  out.tally = holder.tally;
  // Undo notes stay with this phone's own play.
  out.undo = here.undo ?? [];
  if (!out.lastPlay || (other.lastPlay && other.lastPlay.day > out.lastPlay.day)) out.lastPlay = other.lastPlay ?? out.lastPlay;
  return out;
}
