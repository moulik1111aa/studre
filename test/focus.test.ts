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
