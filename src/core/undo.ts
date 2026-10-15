// "Remove the last hour / all of today" for parents (e.g. a grown-up tested the app on a
// child's profile). Before every saved result we note what it is about to change; rolling
// back replays those notes newest-first. History of asked questions is left alone.

import type { LevelResult, Progress } from './path.ts';
import type { Wallet } from './economy.ts';

export interface UndoEntry {
  /** When (ms since epoch) and on which local day the change happened. */
  t: number;
  day: string;
  /** Previous result of each level the change touched (null = it had none). */
  levels: Record<string, LevelResult | null>;
  skippedLevels: Record<string, true | null>;
  wallet: Wallet;
  answered: number;
  correct: number;
  secondsByDay: Record<string, number>;
  bosses: string[];
}

interface Undoable {
  progress: Progress;
  wallet: Wallet;
  stats: { answered: number; correct: number; secondsByDay: Record<string, number> };
  bossesBeaten: string[];
  undo?: UndoEntry[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Note the state that a change to `levelIds` (and the wallet/stats) is about to overwrite. */
export function remember(c: Undoable, levelIds: string[], now: number, day: string): void {
  const levels: UndoEntry['levels'] = {};
  const skipped: UndoEntry['skippedLevels'] = {};
  for (const id of levelIds) {
    levels[id] = c.progress.levels[id] ? { ...c.progress.levels[id] } : null;
    skipped[id] = c.progress.skippedLevels?.[id] ?? null;
  }
  const list = (c.undo ??= []);
  list.push({ t: now, day, levels, skippedLevels: skipped, wallet: clone(c.wallet), answered: c.stats.answered, correct: c.stats.correct, secondsByDay: { ...c.stats.secondsByDay }, bosses: [...c.bossesBeaten] });
  // Keep today's notes and anything from the last 65 minutes (covers midnight).
  c.undo = list.filter((e) => e.day === day || now - e.t <= 65 * 60_000);
}

/** How many saved results happened at or after `since`. */
export const changesSince = (c: Undoable, since: number): number => (c.undo ?? []).filter((e) => e.t >= since).length;

/** Undo every change made at or after `since`. Returns how many were undone. */
export function rollback(c: Undoable, since: number): number {
  const list = c.undo ?? [];
  const keep = list.filter((e) => e.t < since);
  const undo = list.filter((e) => e.t >= since).sort((a, b) => b.t - a.t);
  for (const e of undo) {
    for (const [id, prev] of Object.entries(e.levels)) {
      if (prev) c.progress.levels[id] = prev;
      else delete c.progress.levels[id];
    }
    for (const [id, prev] of Object.entries(e.skippedLevels)) {
      if (!c.progress.skippedLevels) continue;
      if (prev) c.progress.skippedLevels[id] = prev;
      else delete c.progress.skippedLevels[id];
    }
    c.wallet = e.wallet;
    c.stats.answered = e.answered;
    c.stats.correct = e.correct;
    c.stats.secondsByDay = e.secondsByDay;
    c.bossesBeaten = e.bosses;
  }
  c.undo = keep;
  return undo.length;
}
