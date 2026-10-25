// Play statistics for the parent report. Every finished level adds one entry to a play log
// (score, stars, time, coins and the answers per skill), and running tallies per skill keep
// lifetime totals. Undo (undo.ts) removes log entries and subtracts their answers again.
// Everything else here is pure analysis over the child's saved data.

import { addDays, dayDiff } from './economy.ts';
import { isSkipped, type Level, type Progress } from './path.ts';

/** Per skill: [answers, right answers, total thinking time in ms]. */
export type Tally = Record<string, [number, number, number]>;

export type PlayKind = 'skill' | 'review' | 'boss' | 'quest';

export interface PlayEntry {
  /** When it finished (ms since epoch) and on which local day. */
  t: number;
  d: string;
  /** Level id, kind, stage and (skill levels) tier 1–5. */
  id: string;
  k: PlayKind;
  st: number;
  tier?: number;
  /** Score out of total, stars won, seconds played and coins earned. */
  sc: number;
  of: number;
  s: number;
  sec: number;
  c: number;
  /** Played with a grown-up (practice together or assisted mode). */
  g?: boolean;
  /** First-try answers per skill in this level. */
  a: Tally;
}

export interface StatsHolder {
  log?: PlayEntry[];
  tally?: Tally;
}

/** The log keeps about a year of normal play. */
export const LOG_MAX = 2000;

export function addAnswer(t: Tally, skillId: string, ok: boolean, ms: number): void {
  const row = (t[skillId] ??= [0, 0, 0]);
  row[0]++;
  if (ok) row[1]++;
  row[2] += Math.max(0, Math.min(ms, 120_000));
}

/** Save a finished level: the log entry and its answers in the lifetime tallies. */
export function logPlay(c: StatsHolder, e: PlayEntry): void {
  const log = (c.log ??= []);
  log.push(e);
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  const tally = (c.tally ??= {});
  for (const [id, [n, ok, ms]] of Object.entries(e.a)) {
    const row = (tally[id] ??= [0, 0, 0]);
    row[0] += n;
    row[1] += ok;
    row[2] += ms;
  }
}

/** Undo: drop entries at or after `since` and take their answers back out of the tallies. */
export function unlog(c: StatsHolder, since: number): void {
  if (!c.log?.length) return;
  const gone = c.log.filter((e) => e.t >= since);
  c.log = c.log.filter((e) => e.t < since);
  const tally = (c.tally ??= {});
  for (const e of gone)
    for (const [id, [n, ok, ms]] of Object.entries(e.a)) {
      const row = tally[id];
      if (!row) continue;
      row[0] = Math.max(0, row[0] - n);
      row[1] = Math.max(0, row[1] - ok);
      row[2] = Math.max(0, row[2] - ms);
      if (!row[0]) delete tally[id];
    }
}

// ── analysis ───────────────────────────────────────────────────────────────

export const pct = (a: number, b: number): number => (b ? Math.round((100 * a) / b) : 0);

export interface DayFigures {
  minutes: number;
  answers: number;
  right: number;
  levels: number;
}

/** Minutes (from play time) and answers and levels (from the log) for one day. */
export function dayFigures(secondsByDay: Record<string, number>, log: PlayEntry[], day: string): DayFigures {
  const f: DayFigures = { minutes: Math.round((secondsByDay[day] ?? 0) / 60), answers: 0, right: 0, levels: 0 };
  for (const e of log)
    if (e.d === day) {
      f.levels++;
      for (const [n, ok] of Object.values(e.a)) {
        f.answers += n;
        f.right += ok;
      }
    }
  return f;
}

/** Totals over a run of days ending on `end`. */
export function spanFigures(secondsByDay: Record<string, number>, log: PlayEntry[], end: string, days: number): DayFigures & { activeDays: number } {
  const out = { minutes: 0, answers: 0, right: 0, levels: 0, activeDays: 0 };
  for (let i = 0; i < days; i++) {
    const f = dayFigures(secondsByDay, log, addDays(end, -i));
    out.minutes += f.minutes;
    out.answers += f.answers;
    out.right += f.right;
    out.levels += f.levels;
    if (f.minutes > 0 || f.levels > 0) out.activeDays++;
  }
  return out;
}

/** Current streak (days in a row up to today or yesterday) and the best ever. */
export function streaks(secondsByDay: Record<string, number>, today: string): { current: number; best: number } {
  const played = Object.keys(secondsByDay)
    .filter((d) => secondsByDay[d] > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of played) {
    run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  let d = secondsByDay[today] ? today : addDays(today, -1);
  while (secondsByDay[d] > 0) {
    current++;
    d = addDays(d, -1);
  }
  return { current, best };
}

export interface SkillFigure {
  id: string;
  answers: number;
  right: number;
  accuracy: number;
  /** Average seconds per answer. */
  speed: number;
}

export function skillFigures(tally: Tally): SkillFigure[] {
  return Object.entries(tally).map(([id, [n, ok, ms]]) => ({ id, answers: n, right: ok, accuracy: pct(ok, n), speed: n ? ms / n / 1000 : 0 }));
}

/** Strongest (80%+ right) and weakest (under 80%) skills, among those answered often enough to tell. */
export function strengths(tally: Tally, min = 8): { best: SkillFigure[]; practise: SkillFigure[] } {
  const enough = skillFigures(tally).filter((s) => s.answers >= min);
  const best = enough
    .filter((s) => s.accuracy >= 80)
    .sort((a, b) => b.accuracy - a.accuracy || b.answers - a.answers)
    .slice(0, 3);
  const practise = enough
    .filter((s) => s.accuracy < 80)
    .sort((a, b) => a.accuracy - b.accuracy || b.answers - a.answers)
    .slice(0, 3);
  return { best, practise };
}

/** When in the day they play: morning, afternoon, evening, night (share of levels). */
export function timeOfDay(log: PlayEntry[]): { label: string; levels: number }[] {
  const out = [
    { label: 'Morning', levels: 0 },
    { label: 'Afternoon', levels: 0 },
    { label: 'Evening', levels: 0 },
    { label: 'Night', levels: 0 },
  ];
  for (const e of log) {
    const h = new Date(e.t).getHours();
    out[h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 21 ? 2 : 3].levels++;
  }
  return out;
}

/** Levels passed (and skipped at placement) per stage, passed per tier, and stars on a path. */
export function pathProgress(path: Level[], p: Progress): { stages: { stage: number; passed: number; skipped: number; total: number }[]; tiers: number[]; stars: number; maxStars: number } {
  const stages = new Map<number, { stage: number; passed: number; skipped: number; total: number }>();
  const tiers = [0, 0, 0, 0, 0];
  let stars = 0;
  for (const l of path) {
    const row = stages.get(l.stage) ?? { stage: l.stage, passed: 0, skipped: 0, total: 0 };
    row.total++;
    const best = p.levels[l.id]?.stars ?? 0;
    if (best >= 1) {
      row.passed++;
      if (l.kind === 'skill') tiers[l.tier - 1]++;
    } else if (isSkipped(p, l)) row.skipped++;
    stars += best;
    stages.set(l.stage, row);
  }
  return { stages: [...stages.values()].sort((a, b) => a.stage - b.stage), tiers, stars, maxStars: path.length * 3 };
}

/** The busiest day so far (by minutes). */
export function bestDay(secondsByDay: Record<string, number>): { day: string; minutes: number } | null {
  let best: { day: string; minutes: number } | null = null;
  for (const [day, s] of Object.entries(secondsByDay)) if (!best || s / 60 > best.minutes) best = { day, minutes: Math.round(s / 60) };
  return best && best.minutes > 0 ? best : null;
}
