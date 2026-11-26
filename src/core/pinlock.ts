// The parent check's lock after wrong tries (review fix 15). It is kept on the phone (not in
// backups or the cloud), so closing and opening MN again doesn't clear it, and it grows when
// someone keeps guessing. It counts down only while the clock moves forward, so turning the
// clock back doesn't shorten it (or stretch it out).

export interface PinLock {
  /** Wrong tries since the last lock or the last right answer. */
  misses: number;
  /** Locks in a row (since the last right answer), which sets how long the next one is. */
  locks: number;
  /** How long it is still locked (ms); 0 = open. */
  left: number;
  /** When `left` was last counted down (ms, by this phone's clock). */
  at: number;
}

/** Wrong tries before it locks. */
export const TRIES = 3;
/** How long each lock in a row is: 30 seconds, then 1, 5 and 15 minutes, then an hour each time. */
export const LOCK_STEPS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
/** Locks in a row are forgotten after a day without a try. */
const FORGET = 24 * 3_600_000;

export const freshLock = (): PinLock => ({ misses: 0, locks: 0, left: 0, at: 0 });

/** A stored lock, checked: anything odd counts as no lock, and no lock is longer than the longest step. */
export function readLock(raw: unknown): PinLock {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
  return { misses: Math.floor(n(o.misses, TRIES - 1)), locks: Math.floor(n(o.locks, 1000)), left: n(o.left, LOCK_STEPS[LOCK_STEPS.length - 1]), at: n(o.at, 8.64e15) };
}

/** Count the lock down by the time that has passed (none if the clock went back). */
export function tick(l: PinLock, now: number): PinLock {
  const passed = now >= l.at ? now - l.at : 0;
  if (l.left) return { ...l, left: Math.max(0, l.left - passed), at: now };
  // A day without a try: the next lock is short again.
  if (l.locks && passed > FORGET) return { ...l, locks: 0, misses: 0, at: now };
  return { ...l, at: now };
}

/** A wrong try: after TRIES of them it locks, each lock in a row longer than the last. */
export function miss(l: PinLock, now: number): PinLock {
  const t = tick(l, now);
  if (t.misses + 1 < TRIES) return { ...t, misses: t.misses + 1 };
  const locks = t.locks + 1;
  return { misses: 0, locks, left: LOCK_STEPS[Math.min(locks, LOCK_STEPS.length) - 1], at: now };
}

/** A right answer: everything starts again. */
export const passed = (now: number): PinLock => ({ ...freshLock(), at: now });

/** "30 seconds", "1 minute", "15 minutes", "1 hour" (rounded up). */
export function waitText(ms: number): string {
  if (ms < 60_000) {
    const s = Math.max(1, Math.ceil(ms / 1000));
    return `${s} second${s === 1 ? '' : 's'}`;
  }
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.ceil(m / 60);
  return `${h} hour${h === 1 ? '' : 's'}`;
}
