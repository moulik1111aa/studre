// Unlocking MN with an approved Google account (decided 5 Nov): the owner approves each
// account; the phone remembers the approval and re-checks whenever it is online. Without a
// check for 14 days (or with the clock turned back) it asks to connect again. Guests without
// Google use the phone-code keys (core/access.ts).

export const OFFLINE_DAYS = 14;
const DAY = 86_400_000;

/** What this phone remembers about its Google approval (kept in the save, on this phone). */
export interface GoogleGate {
  email: string;
  /** Approved until (ms); 0 = no end date. */
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

/** After the cloud answers: approved (until), or not (null clears it). */
export function confirmGate(g: GoogleGate | undefined, email: string, approvedUntil: number | null, now: number): GoogleGate | undefined {
  if (approvedUntil === null) return undefined;
  return { email, until: approvedUntil, checkedAt: now, maxSeen: Math.max(now, g?.maxSeen ?? 0) };
}

/** Keep the latest time seen moving forward (for the clock check). */
export function seen(g: GoogleGate | undefined, now: number): GoogleGate | undefined {
  return g && now > g.maxSeen ? { ...g, maxSeen: now } : g;
}
