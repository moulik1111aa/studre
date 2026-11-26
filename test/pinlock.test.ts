// The parent check's lock after wrong tries (review fix 15): kept on the phone, longer each
// time, and a clock turned back neither shortens nor stretches it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCK_STEPS, TRIES, freshLock, miss, passed, readLock, tick, waitText, type PinLock } from '../src/core/pinlock.ts';

const T = Date.parse('2026-11-26T10:00:00Z');
const wrong = (l: PinLock, now: number, n = TRIES) => {
  for (let i = 0; i < n; i++) l = miss(l, now);
  return l;
};

test('three wrong tries lock it; each lock in a row is longer; a right answer starts again', () => {
  let l = miss(freshLock(), T);
  assert.equal(l.left, 0);
  l = miss(l, T);
  assert.equal(l.left, 0);
  l = miss(l, T);
  assert.equal(l.left, 30_000);
  assert.equal(TRIES, 3);
  // Wait it out, then three more: a minute; then 5 and 15 minutes; then an hour each time.
  let now = T;
  const lengths: number[] = [l.left];
  for (let i = 0; i < 5; i++) {
    now += l.left;
    l = tick(l, now);
    assert.equal(l.left, 0);
    l = wrong(l, now);
    lengths.push(l.left);
  }
  assert.deepEqual(lengths, [...LOCK_STEPS, LOCK_STEPS.at(-1)]);
  // The right PIN: back to the start.
  l = passed(now + l.left);
  assert.equal(wrong(l, now + 3_600_000).left, 30_000);
});

test('the lock counts down while the clock moves forward, and a clock turned back doesn’t shorten or stretch it', () => {
  let l = wrong(freshLock(), T);
  l = tick(l, T + 10_000);
  assert.equal(l.left, 20_000);
  // Turned back a day: no time passes for that jump...
  l = tick(l, T - 86_400_000);
  assert.equal(l.left, 20_000);
  // ...and from there it counts down as usual (not a day longer).
  l = tick(l, T - 86_400_000 + 15_000);
  assert.equal(l.left, 5_000);
  l = tick(l, T - 86_400_000 + 25_000);
  assert.equal(l.left, 0);
});

test('a stored lock: checked, never longer than the longest step', () => {
  assert.deepEqual(readLock(null), freshLock());
  assert.deepEqual(readLock('junk'), freshLock());
  assert.deepEqual(readLock({ misses: 99, locks: -1, left: 1e12, at: 'x' }), { misses: TRIES - 1, locks: 0, left: LOCK_STEPS.at(-1), at: 0 });
  // Through JSON and back, as the phone keeps it.
  const l = wrong(freshLock(), T);
  assert.deepEqual(readLock(JSON.parse(JSON.stringify(l))), l);
});

test('after a day without a try, the next lock is short again', () => {
  let l = wrong(freshLock(), T);
  l = wrong(tick(l, T + 30_000), T + 30_000);
  assert.equal(l.left, 60_000);
  l = tick(l, T + 90_000);
  l = tick(l, T + 90_000 + 25 * 3_600_000);
  assert.equal(wrong(l, T + 90_000 + 25 * 3_600_000).left, 30_000);
});

test('how long to wait, in words', () => {
  assert.equal(waitText(30_000), '30 seconds');
  assert.equal(waitText(1_000), '1 second');
  assert.equal(waitText(200), '1 second');
  assert.equal(waitText(60_000), '1 minute');
  assert.equal(waitText(61_000), '2 minutes');
  assert.equal(waitText(15 * 60_000), '15 minutes');
  assert.equal(waitText(3_600_000), '1 hour');
});
