// MN × given by the owner to a Google account, on the app shared by link (decided 25 Nov: anyone
// may sign in with Google and use MN; MN × is asked for, and the owner gives it, with an end date
// or none). The phone remembers the owner's answer and checks it again whenever it is online.
// Without a check for 14 days (or with the clock turned back) MN × waits for the next check.
// (Before 25 Nov this unlocked the app itself; the save keeps the same shape, so accounts approved
// then keep MN ×.)

export const OFFLINE_DAYS = 14;
const DAY = 86_400_000;

/** What this phone remembers about the owner's MN × for the signed-in account (kept in the save). */
export interface GoogleGate {
  email: string;
  /** MN × until (ms); 0 = no end date. */
  until: number;
  /** The last time the cloud confirmed it (ms), and the latest time this phone has seen. */
  checkedAt: number;
  maxSeen: number;
}

export type GateState =
  | { ok: true; email: string; until: number; checkBy: number }
  | { ok: false; reason: 'none' | 'ended' | 'stale' | 'clock'; email?: string };

export function gateState(g: GoogleGate | undefined, now: number): GateState {
  if (!g?.email) return { ok: false, reason: 'none' };
  // The clock going back more than a day: someone turned it back.
  if (now < g.maxSeen - DAY) return { ok: false, reason: 'clock', email: g.email };
  if (g.until && now >= g.until) return { ok: false, reason: 'ended', email: g.email };
  const checkBy = g.checkedAt + OFFLINE_DAYS * DAY;
  if (now >= checkBy) return { ok: false, reason: 'stale', email: g.email };
  return { ok: true, email: g.email, until: g.until, checkBy };
}

/** After the cloud answers: given (until), or not (null clears it). */
export function confirmGate(g: GoogleGate | undefined, email: string, givenUntil: number | null, now: number): GoogleGate | undefined {
  if (givenUntil === null) return undefined;
  return { email, until: givenUntil, checkedAt: now, maxSeen: Math.max(now, g?.maxSeen ?? 0) };
}

/** Keep the latest time seen moving forward (for the clock check). */
export function seen(g: GoogleGate | undefined, now: number): GoogleGate | undefined {
  return g && now > g.maxSeen ? { ...g, maxSeen: now } : g;
}
