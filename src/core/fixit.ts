// Fix-it: a question the child got wrong comes back later, with new numbers, after 1 day,
// then 3 days, then a week (spaced practice). Right each time, and it is fixed. Wrong
// again, and it starts over from tomorrow.
//
// One entry per skill. Each entry keeps a short history of its steps, so undo can take
// back what happened after a moment, and two phones can be merged step by step.

/** Days before the next try, by step (0 = just missed). Step 3 = fixed. */
export const FIX_GAPS = [1, 3, 7] as const;
export const FIXED = FIX_GAPS.length;
/** Questions in one Fix-it round. */
export const FIX_ROUND = 5;
/** Skills waiting at most (the oldest drop off), and fixed ones remembered. */
export const FIX_MAX = 40;
const KEEP_FIXED = 120;
const HISTORY = 8;

/** A step: when it happened (ms), the step it moved to, and the day it is due next. */
export type FixStep = [t: number, step: number, due: string];

export interface FixItem {
  /** Difficulty of the question that was missed (already adjusted for age). */
  d: number;
  /** Times it was missed in all. */
  n: number;
  h: FixStep[];
}

/** Skill id → its Fix-it entry. */
export type FixBank = Record<string, FixItem>;

export interface FixHolder {
  fixit?: FixBank;
}

export const addDays = (day: string, n: number): string => {
  const t = new Date(`${day}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export const stepOf = (it: FixItem): FixStep => it.h[it.h.length - 1];
export const isFixed = (it: FixItem): boolean => stepOf(it)[1] >= FIXED;

/** A first-try miss: the skill joins (or goes back to the start of) Fix-it, due tomorrow. */
export function noteMiss(c: FixHolder, skillId: string, d: number, now: number, today: string): void {
  const bank = (c.fixit ??= {});
  const it = bank[skillId];
  const step: FixStep = [now, 0, addDays(today, FIX_GAPS[0])];
  if (!it) bank[skillId] = { d: round2(d), n: 1, h: [step] };
  else {
    // Missed again (before or after it was fixed): start over, at the harder of the two.
    it.d = isFixed(it) ? round2(d) : Math.max(it.d, round2(d));
    it.n++;
    if (stepOf(it)[2] !== step[2] || stepOf(it)[1] !== 0) push(it, step);
  }
  trim(bank);
}

/** Every first-try miss of a finished (or left) round. */
export function noteMisses(c: FixHolder, missed: { skillId: string; d?: number }[], now: number, today: string): void {
  for (const q of missed) noteMiss(c, q.skillId, q.d ?? 0.5, now, today);
}

/** A Fix-it question answered (first try): one step on, or back to the start. */
export function noteTry(c: FixHolder, skillId: string, ok: boolean, now: number, today: string): 'fixed' | 'next' | 'again' | undefined {
  const it = c.fixit?.[skillId];
  if (!it || isFixed(it)) return undefined;
  if (!ok) {
    it.n++;
    push(it, [now, 0, addDays(today, FIX_GAPS[0])]);
    return 'again';
  }
  const step = stepOf(it)[1] + 1;
  push(it, [now, step, step >= FIXED ? '' : addDays(today, FIX_GAPS[step])]);
  return step >= FIXED ? 'fixed' : 'next';
}

export interface FixDue {
  skillId: string;
  d: number;
  step: number;
}

/** What is due today (oldest first), at most `max`. Only skills the child can still be asked. */
export function dueFix(c: FixHolder, today: string, known: (id: string) => boolean = () => true, max = FIX_ROUND): FixDue[] {
  return Object.entries(c.fixit ?? {})
    .filter(([id, it]) => !isFixed(it) && stepOf(it)[2] <= today && known(id))
    .sort((a, b) => stepOf(a[1])[2].localeCompare(stepOf(b[1])[2]) || stepOf(a[1])[0] - stepOf(b[1])[0])
    .slice(0, max)
    .map(([skillId, it]) => ({ skillId, d: it.d, step: stepOf(it)[1] }));
}

export interface FixCounts {
  /** Due now, waiting for a later day, and fixed. */
  due: number;
  waiting: number;
  fixed: number;
  /** The next day something comes back ('' when nothing is waiting). */
  nextDay: string;
}

export function fixCounts(c: FixHolder, today: string): FixCounts {
  let due = 0;
  let waiting = 0;
  let fixed = 0;
  let nextDay = '';
  for (const it of Object.values(c.fixit ?? {})) {
    if (isFixed(it)) fixed++;
    else if (stepOf(it)[2] <= today) due++;
    else {
      waiting++;
      if (!nextDay || stepOf(it)[2] < nextDay) nextDay = stepOf(it)[2];
    }
  }
  return { due, waiting, fixed, nextDay };
}

/** Undo: forget every step at or after `since` (an entry with no steps left goes). */
export function rollbackFix(c: FixHolder, since: number): void {
  for (const [id, it] of Object.entries(c.fixit ?? {})) {
    const before = it.h.length;
    it.h = it.h.filter((s) => s[0] < since);
    if (!it.h.length) delete c.fixit![id];
    else if (it.h.length < before) it.n = Math.max(1, it.n - (before - it.h.length));
  }
}

/** Two phones: every step from both, in time order. */
export function mergeFix(a: FixBank | undefined, b: FixBank | undefined): FixBank | undefined {
  if (!a && !b) return undefined;
  const out: FixBank = JSON.parse(JSON.stringify(a ?? {}));
  for (const [id, theirs] of Object.entries(b ?? {})) {
    const mine = out[id];
    if (!mine) {
      out[id] = JSON.parse(JSON.stringify(theirs));
      continue;
    }
    const seen = new Set(mine.h.map((s) => s.join('|')));
    const h = [...mine.h, ...theirs.h.filter((s) => !seen.has(s.join('|')))].sort((x, y) => x[0] - y[0]);
    out[id] = { d: Math.max(mine.d, theirs.d), n: Math.max(mine.n, theirs.n), h: h.slice(-HISTORY) };
  }
  trim(out);
  return out;
}

function push(it: FixItem, s: FixStep): void {
  it.h.push(s);
  if (it.h.length > HISTORY) it.h.splice(0, it.h.length - HISTORY);
}

function trim(bank: FixBank): void {
  const entries = Object.entries(bank);
  const open = entries.filter(([, it]) => !isFixed(it)).sort((a, b) => stepOf(b[1])[0] - stepOf(a[1])[0]);
  const fixed = entries.filter(([, it]) => isFixed(it)).sort((a, b) => stepOf(b[1])[0] - stepOf(a[1])[0]);
  for (const [id] of open.slice(FIX_MAX)) delete bank[id];
  for (const [id] of fixed.slice(KEEP_FIXED)) delete bank[id];
}

const round2 = (d: number): number => Math.round(Math.min(1, Math.max(0, d)) * 100) / 100;
