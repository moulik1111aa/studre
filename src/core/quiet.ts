// Bedtime: bedtime and school time, set by a parent. While one is on, MN shows a calm
// "time to sleep" (or "school time") screen instead of levels. A parent can unlock it for a
// while. School time is skipped in pause rewards.

export interface QuietRange {
  on: boolean;
  /** "HH:MM", 24-hour, local time. Bedtime may run past midnight (from > to). */
  from: string;
  to: string;
}

export interface QuietSettings {
  bed: QuietRange;
  /** Days are 0 = Sunday … 6 = Saturday. */
  school: QuietRange & { days: number[] };
}

export const DEFAULT_QUIET: QuietSettings = {
  bed: { on: false, from: '21:00', to: '07:00' },
  school: { on: false, from: '08:00', to: '14:00', days: [1, 2, 3, 4, 5] },
};

/** Minutes a parent's unlock lasts. */
export const UNLOCK_MINUTES = 30;

export type QuietKind = 'bed' | 'school';
export interface QuietNow {
  kind: QuietKind;
  /** When it ends, "HH:MM". */
  until: string;
}

const mins = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export const quietOf = (q?: Partial<QuietSettings>): QuietSettings => ({
  bed: { ...DEFAULT_QUIET.bed, ...q?.bed },
  school: { ...DEFAULT_QUIET.school, ...q?.school },
});

/** Inside [from, to), which may wrap past midnight. */
function inside(r: QuietRange, m: number): boolean {
  const a = mins(r.from);
  const b = mins(r.to);
  if (!r.on || Number.isNaN(a) || Number.isNaN(b) || a === b) return false;
  return a < b ? m >= a && m < b : m >= a || m < b;
}

/** Is it bedtime or school time at `now`? (Unlocked by a parent until `unlockedUntil` ms.) */
export function quietAt(q: Partial<QuietSettings> | undefined, now: Date, holiday = false, unlockedUntil = 0): QuietNow | null {
  if (now.getTime() < unlockedUntil) return null;
  const s = quietOf(q);
  const m = now.getHours() * 60 + now.getMinutes();
  if (inside(s.bed, m)) return { kind: 'bed', until: s.bed.to };
  if (!holiday && s.school.days.includes(now.getDay())) {
    // School time doesn't run past midnight.
    const a = mins(s.school.from);
    const b = mins(s.school.to);
    if (s.school.on && a < b && m >= a && m < b) return { kind: 'school', until: s.school.to };
  }
  return null;
}

/** "21:00" → "9 pm", "07:30" → "7:30 am". */
export function niceTime(hhmm: string): string {
  const m = mins(hhmm);
  if (Number.isNaN(m)) return hhmm;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h % 12 || 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayShort = (d: number): string => DAY_SHORT[d];

/** One line for the parent area. */
export function quietSummary(q?: Partial<QuietSettings>): string {
  const s = quietOf(q);
  const parts: string[] = [];
  if (s.bed.on) parts.push(`Bedtime ${niceTime(s.bed.from)}–${niceTime(s.bed.to)}`);
  if (s.school.on) {
    const days = [...s.school.days].sort();
    const weekdays = days.join() === '1,2,3,4,5';
    parts.push(`School ${niceTime(s.school.from)}–${niceTime(s.school.to)}${weekdays ? ' on weekdays' : days.length ? ` · ${days.map(dayShort).join(', ')}` : ''}`);
  }
  return parts.length ? parts.join(' · ') : 'Off · set bedtime and school time';
}
