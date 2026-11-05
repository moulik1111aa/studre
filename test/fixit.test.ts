// Fix-it: a missed skill comes back after 1, 3 and 7 days; wrong again starts over;
// undo takes steps back; two phones keep every step; backups keep the bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { FIXED, FIX_MAX, addDays, dueFix, fixCounts, isFixed, mergeFix, noteMiss, noteMisses, noteTry, rollbackFix, stepOf } from '../src/core/fixit.ts';
import { remember, rollback } from '../src/core/undo.ts';
import { makeBackup, mergeChild, readBackup } from '../src/core/backup.ts';

const D0 = '2026-11-05';
const kid = () => {
  const c = newChild('Riya', 8, 0, '2026-10-01');
  c.undo = [];
  return c;
};

test('days add across months', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
});

test('a miss is due tomorrow, then after 3 days, then a week, then fixed', () => {
  const c = kid();
  noteMiss(c, 's3.x4', 0.62, 1, D0);
  assert.deepEqual(dueFix(c, D0), []);
  const d1 = addDays(D0, 1);
  assert.deepEqual(dueFix(c, d1), [{ skillId: 's3.x4', d: 0.62, step: 0 }]);
  assert.equal(noteTry(c, 's3.x4', true, 2, d1), 'next');
  assert.equal(stepOf(c.fixit!['s3.x4'])[2], addDays(d1, 3));
  assert.deepEqual(dueFix(c, addDays(d1, 2)), []);
  const d2 = addDays(d1, 3);
  assert.equal(noteTry(c, 's3.x4', true, 3, d2), 'next');
  const d3 = addDays(d2, 7);
  assert.equal(dueFix(c, d3).length, 1);
  assert.equal(noteTry(c, 's3.x4', true, 4, d3), 'fixed');
  assert.ok(isFixed(c.fixit!['s3.x4']));
  assert.equal(stepOf(c.fixit!['s3.x4'])[1], FIXED);
  assert.deepEqual(dueFix(c, addDays(d3, 30)), []);
  assert.deepEqual(fixCounts(c, d3), { due: 0, waiting: 0, fixed: 1, nextDay: '' });
  assert.equal(noteTry(c, 's3.x4', true, 5, d3), undefined); // already fixed
});

test('wrong again starts over from tomorrow, at the harder difficulty', () => {
  const c = kid();
  noteMiss(c, 's2.add', 0.3, 1, D0);
  const d1 = addDays(D0, 1);
  noteTry(c, 's2.add', true, 2, d1);
  noteMiss(c, 's2.add', 0.8, 3, d1); // missed in a level before its next turn
  assert.equal(c.fixit!['s2.add'].d, 0.8);
  assert.equal(c.fixit!['s2.add'].n, 2);
  const d2 = addDays(d1, 1);
  assert.equal(dueFix(c, d2)[0].step, 0);
  assert.equal(noteTry(c, 's2.add', false, 4, d2), 'again');
  assert.equal(stepOf(c.fixit!['s2.add'])[2], addDays(d2, 1));
  // Missed after it was fixed: it comes back.
  const f = kid();
  noteMiss(f, 'a', 0.5, 1, D0);
  for (let k = 0; k < 3; k++) noteTry(f, 'a', true, 2 + k, addDays(D0, 20 * (k + 1)));
  assert.ok(isFixed(f.fixit!.a));
  noteMiss(f, 'a', 0.4, 10, addDays(D0, 90));
  assert.equal(isFixed(f.fixit!.a), false);
  assert.equal(f.fixit!.a.d, 0.4);
});

test('due list: oldest first, at most 5, unknown skills left out', () => {
  const c = kid();
  noteMisses(c, [{ skillId: 'b', d: 0.5 }, { skillId: 'a' }, { skillId: 'gone', d: 0.2 }], 5, D0);
  noteMiss(c, 'c', 0.5, 1, addDays(D0, -2));
  for (const id of ['d', 'e', 'f', 'g']) noteMiss(c, id, 0.5, 6, D0);
  const due = dueFix(c, addDays(D0, 1), (id) => id !== 'gone');
  assert.equal(due.length, 5);
  assert.equal(due[0].skillId, 'c');
  assert.ok(!due.some((x) => x.skillId === 'gone'));
  assert.equal(c.fixit!.a.d, 0.5); // no difficulty given: the middle
  assert.equal(fixCounts(c, addDays(D0, 1)).due, 8);
});

test(`at most ${FIX_MAX} skills wait; the oldest drop off`, () => {
  const c = kid();
  for (let k = 0; k < FIX_MAX + 5; k++) noteMiss(c, `s${k}`, 0.5, 100 + k, D0);
  assert.equal(Object.keys(c.fixit!).length, FIX_MAX);
  assert.ok(!c.fixit!.s0 && c.fixit![`s${FIX_MAX + 4}`]);
});

test('undo takes back the steps after a moment, and the misses', () => {
  const c = kid();
  noteMiss(c, 'a', 0.5, 100, D0);
  const d1 = addDays(D0, 1);
  remember(c, [], 200, d1);
  noteTry(c, 'a', true, 200, d1);
  noteMiss(c, 'b', 0.5, 201, d1);
  rollback(c, 200);
  assert.equal(stepOf(c.fixit!.a)[1], 0);
  assert.equal(c.fixit!.b, undefined);
  rollbackFix(c, 0);
  assert.deepEqual(c.fixit, {});
});

test('two phones: every step from both; backups keep the bank', async () => {
  const a = kid();
  const b = kid();
  noteMiss(a, 'x', 0.4, 10, D0);
  noteMiss(b, 'x', 0.6, 10, D0);
  noteTry(b, 'x', true, 20, addDays(D0, 1));
  noteMiss(b, 'y', 0.5, 30, D0);
  const m = mergeFix(a.fixit, b.fixit)!;
  assert.equal(m.x.d, 0.6);
  assert.equal(stepOf(m.x)[1], 1);
  assert.ok(m.y);
  assert.equal(mergeFix(undefined, undefined), undefined);
  assert.equal(stepOf(mergeChild(a, b, false).fixit!.x)[1], 1);
  const back = await readBackup(JSON.stringify(await makeBackup(b)));
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(back.backup.child.fixit, b.fixit);
});
