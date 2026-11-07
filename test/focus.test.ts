// Focus plan: the week's three hardest skills, worked out from answers before that week.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusId, focusPlan, pickFocus } from '../src/core/focus.ts';
import type { PlayEntry, Tally } from '../src/core/stats.ts';

const entry = (d: string, id: string, a: Tally): PlayEntry => ({ t: 0, d, id, k: 'review', st: 1, sc: 0, of: 0, s: 0, sec: 60, c: 0, a });

test('hardest first, then slowest; skills answered too few times or nearly mastered are left out', () => {
  const t: Tally = { a: [10, 5, 10000], b: [10, 5, 30000], c: [10, 9, 10000], d: [3, 0, 3000], e: [20, 14, 10000], f: [10, 8, 10000] };
  assert.deepEqual(pickFocus(t), ['b', 'a', 'e']);
  assert.deepEqual(pickFocus(t, (id) => id !== 'b'), ['a', 'e', 'f']);
});

test('the plan uses answers from before this week, and shows this week beside them', () => {
  const day = '2026-11-04'; // a Wednesday; the week starts on Monday 2 Nov
  const thisWeek: Tally = { a: [6, 6, 6000] };
  const c = { tally: { a: [16, 10, 20000], b: [10, 8, 10000] } as Tally, log: [entry('2026-10-30', 'x', { a: [10, 4, 14000] }), entry('2026-11-03', focusId('2026-11-02'), thisWeek), entry('2026-11-04', 'y', {})] };
  const p = focusPlan(c, day);
  assert.equal(p.week, '2026-11-02');
  assert.equal(p.rounds, 1);
  assert.deepEqual(p.skills.map((s) => s.id), ['a', 'b']);
  assert.equal(p.skills[0].before, 40);
  assert.equal(p.skills[0].now, 100);
  assert.equal(p.skills[1].now, null);
});

test('a new child has no plan yet', () => {
  assert.deepEqual(focusPlan({}, '2026-11-04').skills, []);
});

test('week change: last 7 days against the 7 before, coloured up, down or steady', async () => {
  const { weekChange, trend } = await import('../src/core/focus.ts');
  const log = [entry('2026-10-25', 'x', { a: [10, 5, 0] }), entry('2026-11-03', 'y', { a: [10, 8, 0] })];
  const c = weekChange(log, '2026-11-04', 'a');
  assert.deepEqual(c, { now: 80, before: 50 });
  assert.equal(trend(c), 'up');
  assert.equal(trend({ now: 60, before: 62 }), 'same');
  assert.equal(trend({ now: 40, before: 60 }), 'down');
  assert.equal(weekChange(log, '2026-11-04', 'b'), null);
});

test('the voice says MN letter by letter, and MN × as M N Times', async () => {
  const { sayable } = await import('../src/platform/voice.ts');
  assert.equal(sayable('Welcome to MN!'), 'Welcome to M N!');
  assert.equal(sayable('MN × is on'), 'M N Times is on');
  assert.equal(sayable('MNOP and AMNESIA'), 'MNOP and AMNESIA');
});

test('a spaced slash is read as divided by; a fraction is still a fraction', async () => {
  const { sayable } = await import('../src/platform/voice.ts');
  const { spoken } = await import('../src/core/question.ts');
  assert.equal(sayable('5 / 2 = 2.5'), '5 divided by 2 = 2.5');
  assert.equal(sayable('(8 + 4) / 3'), '(8 + 4) divided by 3');
  assert.match(spoken('15 / 3 = ?'), /15 divided by 3/);
  assert.match(spoken('3/4 of 20'), /3 over 4/);
});

test('the MN today widget gets the last 14 days of play, so the phone can draw the week itself', async () => {
  const { recentDays } = await import('../src/core/reminders.ts');
  const r = recentDays({ '2026-11-07': 610.4, '2026-11-01': 300, '2026-10-20': 900 }, '2026-11-07');
  assert.deepEqual(r, { '2026-11-07': 610, '2026-11-01': 300 });
});
