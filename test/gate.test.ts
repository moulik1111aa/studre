// Unlocking with an approved Google account: works offline for 14 days after the last check,
// respects an end date, notices the clock being turned back, and is cleared when removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFLINE_DAYS, confirmGate, gateState, seen } from '../src/core/gate.ts';

const DAY = 86_400_000;
const T = Date.parse('2026-11-05T10:00:00Z');

test('approved: unlocked for 14 days after the last check, then asks to connect', () => {
  assert.deepEqual(gateState(undefined, T), { ok: false, reason: 'none' });
  const g = confirmGate(undefined, 'a@b.com', 0, T);
  assert.equal(gateState(g, T + 13 * DAY).ok, true);
  assert.deepEqual(gateState(g, T + OFFLINE_DAYS * DAY), { ok: false, reason: 'stale', email: 'a@b.com' });
  // A fresh check starts the 14 days again.
  assert.equal(gateState(confirmGate(g, 'a@b.com', 0, T + 13 * DAY), T + 20 * DAY).ok, true);
});

test('an end date, the clock turned back, and removal', () => {
  const g = confirmGate(undefined, 'a@b.com', T + 5 * DAY, T);
  assert.equal(gateState(g, T + 4 * DAY).ok, true);
  assert.equal((gateState(g, T + 5 * DAY) as { reason: string }).reason, 'ended');
  const later = seen(confirmGate(undefined, 'a@b.com', 0, T), T + 3 * DAY);
  assert.equal((gateState(later, T + DAY) as { reason: string }).reason, 'clock');
  assert.equal(gateState(later, T + 2.5 * DAY).ok, true); // a few hours back is fine
  assert.equal(confirmGate(g, 'a@b.com', null, T), undefined);
});
