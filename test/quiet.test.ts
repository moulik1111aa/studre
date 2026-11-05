// Quiet hours: bedtime past midnight, school time on chosen days only, holiday mode skips
// school, a grown-up's unlock wins, and the parent-area line reads well.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_QUIET, niceTime, quietAt, quietSummary } from '../src/core/quiet.ts';

// 5 Nov 2026 is a Thursday.
const at = (hhmm: string, day = 5) => new Date(`2026-11-${String(day).padStart(2, '0')}T${hhmm}:00`);
const both = { bed: { ...DEFAULT_QUIET.bed, on: true }, school: { ...DEFAULT_QUIET.school, on: true } };

test('off by default', () => {
  assert.equal(quietAt(undefined, at('23:00')), null);
  assert.equal(quietAt(DEFAULT_QUIET, at('10:00')), null);
});

test('bedtime runs past midnight', () => {
  assert.equal(quietAt(both, at('20:59')), null);
  assert.deepEqual(quietAt(both, at('21:00')), { kind: 'bed', until: '07:00' });
  assert.deepEqual(quietAt(both, at('03:15')), { kind: 'bed', until: '07:00' });
  assert.equal(quietAt(both, at('07:00')), null);
  // A bedtime that doesn't cross midnight, and one that is empty.
  assert.ok(quietAt({ bed: { on: true, from: '19:30', to: '23:00' } }, at('20:00')));
  assert.equal(quietAt({ bed: { on: true, from: '19:30', to: '23:00' } }, at('23:30')), null);
  assert.equal(quietAt({ bed: { on: true, from: '20:00', to: '20:00' } }, at('20:00')), null);
});

test('school time on school days only, and not in holiday mode', () => {
  assert.deepEqual(quietAt(both, at('09:00')), { kind: 'school', until: '14:00' });
  assert.equal(quietAt(both, at('14:00')), null);
  assert.equal(quietAt(both, at('09:00', 7)), null); // Saturday
  assert.equal(quietAt(both, at('09:00'), true), null); // holiday
  assert.ok(quietAt({ school: { ...both.school, days: [6] } }, at('09:00', 7)));
});

test('a grown-up unlock wins until it runs out', () => {
  const now = at('22:00');
  assert.equal(quietAt(both, now, false, now.getTime() + 60_000), null);
  assert.ok(quietAt(both, now, false, now.getTime() - 1));
});

test('times and the summary read well', () => {
  assert.equal(niceTime('21:00'), '9 pm');
  assert.equal(niceTime('07:30'), '7:30 am');
  assert.equal(niceTime('00:05'), '12:05 am');
  assert.equal(niceTime('12:00'), '12 pm');
  assert.equal(quietSummary(undefined), 'Off · set bedtime and school time');
  assert.equal(quietSummary(both), 'Bedtime 9 pm–7 am · School 8 am–2 pm on weekdays');
  assert.equal(quietSummary({ school: { on: true, from: '08:00', to: '13:00', days: [6, 1] } }), 'School 8 am–1 pm · Mon, Sat');
});
