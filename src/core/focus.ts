// Focus plan (MN ×): each Monday MN picks the three skills a child finds hardest, from
// everything answered before that week (answered at least a few times, under 90% right,
// lowest first, then slowest). The child plays them as short Focus rounds on the map, and the
// parent sees each skill's accuracy before the week and during it.
//
// Nothing is stored: the plan is worked out from the answer tally and the play log, so it is
// the same on every phone and can't go out of step.

import { weekStart } from './adventure.ts';
import { pct, type PlayEntry, type Tally } from './stats.ts';

/** Skills in a week's plan, Focus rounds a week, and answers needed before a skill can be picked. */
export const FOCUS_SKILLS = 3;
export const FOCUS_GOAL = 3;
export const FOCUS_MIN = 4;
/** Skills at or above this accuracy don't need focus. */
export const FOCUS_OK = 90;

export interface FocusSkill {
  id: string;
  /** Accuracy before this week, and answers behind it. */
  before: number;
  beforeN: number;
  /** This week so far (null until answered this week). */
  now: number | null;
  nowN: number;
}

export interface FocusPlan {
  /** Monday of the plan's week. */
  week: string;
  skills: FocusSkill[];
  /** Focus rounds played this week. */
  rounds: number;
}

/** A Focus round's level id for a week. */
export const focusId = (week: string): string => `focus:${week}`;
export const isFocus = (id: string): boolean => id.startsWith('focus:');

const sum = (into: Tally, a: Tally, sign: 1 | -1): void => {
  for (const [id, [n, ok, ms]] of Object.entries(a)) {
    const t = (into[id] ??= [0, 0, 0]);
    t[0] += sign * n;
    t[1] += sign * ok;
    t[2] += sign * ms;
  }
};

/** The skills to focus on, from a tally: hardest first, then slowest. */
export function pickFocus(t: Tally, known: (id: string) => boolean = () => true, n = FOCUS_SKILLS): string[] {
  return Object.entries(t)
    .filter(([id, [a, ok]]) => a >= FOCUS_MIN && pct(ok, a) < FOCUS_OK && known(id))
    .sort(([, [a1, ok1, ms1]], [, [a2, ok2, ms2]]) => ok1 / a1 - ok2 / a2 || ms2 / a2 - ms1 / a1)
    .slice(0, n)
    .map(([id]) => id);
}

export function focusPlan(c: { tally?: Tally; log?: PlayEntry[] }, day: string, known?: (id: string) => boolean): FocusPlan {
  const week = weekStart(day);
  const thisWeek = (c.log ?? []).filter((e) => e.d >= week);
  const before: Tally = {};
  sum(before, c.tally ?? {}, 1);
  const recent: Tally = {};
  for (const e of thisWeek) sum(recent, e.a ?? {}, 1);
  sum(before, recent, -1);
  const skills = pickFocus(before, known).map((id): FocusSkill => {
    const [bn, bok] = before[id];
    const [nn, nok] = recent[id] ?? [0, 0, 0];
    return { id, before: pct(bok, bn), beforeN: bn, now: nn ? pct(nok, nn) : null, nowN: nn };
  });
  const rounds = thisWeek.filter((e) => e.id === focusId(week)).length;
  return { week, skills, rounds };
}

/** A skill's accuracy over the last 7 days and the 7 before (from the play log), to colour the change. */
export function weekChange(log: PlayEntry[] | undefined, day: string, id: string): { now: number; before: number } | null {
  const end = new Date(`${day}T12:00:00`).getTime();
  const span = (from: number, to: number): [number, number] => {
    let n = 0, ok = 0;
    for (const e of log ?? []) {
      const t = new Date(`${e.d}T12:00:00`).getTime();
      if (t > end - from * 86_400_000 && t <= end - to * 86_400_000) {
        const a = e.a?.[id];
        if (a) { n += a[0]; ok += a[1]; }
      }
    }
    return [n, ok];
  };
  const [n1, ok1] = span(7, 0);
  const [n0, ok0] = span(14, 7);
  if (n1 < 3 || n0 < 3) return null;
  return { now: pct(ok1, n1), before: pct(ok0, n0) };
}

/** Up, down or steady: 5 points either way counts as a change. */
export const trend = (c: { now: number; before: number } | null): 'up' | 'down' | 'same' | null => (!c ? null : c.now - c.before >= 5 ? 'up' : c.before - c.now >= 5 ? 'down' : 'same');
