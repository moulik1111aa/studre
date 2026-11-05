// Google sign-in groundwork: a child goes up as a checked backup and comes back merged with
// the phone's copy; the sync plan; the grown-up's nudge is rare and only after real progress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { GOOGLE_LOGIN, fromCloud, nudgeFor, syncPlan, toCloud } from '../src/core/cloud.ts';

const kid = (name = 'Riya') => {
  const c = newChild(name, 8, 0, '2026-10-01');
  c.undo = [];
  return c;
};

test('off until the Firebase project is connected', () => {
  assert.equal(GOOGLE_LOGIN, false);
});

test('up and back: a new phone gets the child; the same child is merged, best of both', async () => {
  const a = kid();
  a.progress.levels['s1.count5#1'] = { stars: 3, passes: 1 };
  a.undo = [{ t: 1, day: '2026-10-02', levels: {}, skippedLevels: {}, wallet: a.wallet, answered: 0, correct: 0, secondsByDay: {}, bosses: [] }];
  const doc = await toCloud(a, 'phone-a', 1000);
  assert.equal(doc.backup.child.undo, undefined); // undo notes stay on the phone
  const fresh = await fromCloud(undefined, doc);
  assert.ok(fresh.ok && fresh.changed && fresh.child.progress.levels['s1.count5#1'].stars === 3);
  // The same child on another phone with other progress.
  const b = JSON.parse(JSON.stringify(a));
  b.undo = [];
  b.progress.levels = { 's1.count5#2': { stars: 2, passes: 1 } };
  const merged = await fromCloud(b, doc, 500);
  assert.ok(merged.ok);
  if (merged.ok) {
    assert.equal(merged.changed, true);
    assert.deepEqual(Object.keys(merged.child.progress.levels).sort(), ['s1.count5#1', 's1.count5#2']);
  }
  // Nothing new: no change.
  const same = await fromCloud(a, doc, 2000);
  assert.ok(same.ok && !same.changed);
  // A changed or different file is refused.
  const bad = { ...doc, backup: { ...doc.backup, child: { ...doc.backup.child, name: 'Hacker' } } };
  assert.equal((await fromCloud(a, bad)).ok, false);
  assert.equal((await fromCloud(kid('Other'), doc)).ok, false);
});

test('sync plan: up, down, or both', () => {
  assert.deepEqual(syncPlan(['a', 'b'], ['b', 'c']), { up: ['a'], down: ['c'], both: ['b'] });
});

test('the nudge: after a reward or a week of play, at most weekly, never after "don\'t ask"', () => {
  const now = Date.parse('2026-11-05T10:00:00Z');
  const c = kid();
  assert.equal(nudgeFor(undefined, [c], false, now), null); // nothing worth keeping yet
  for (let d = 1; d <= 7; d++) c.stats.secondsByDay[`2026-10-0${d}`] = 300;
  c.progress.levels['x#1'] = { stars: 3, passes: 1 };
  assert.equal(nudgeFor(undefined, [c], false, now), 'Riya has 3 stars. Keep them safe with Google, in one tap.');
  assert.equal(nudgeFor(undefined, [c], true, now), null);
  assert.equal(nudgeFor({ askedAt: now - 86_400_000 }, [c], false, now), null);
  assert.ok(nudgeFor({ askedAt: now - 8 * 86_400_000 }, [c], false, now));
  assert.equal(nudgeFor({ never: true }, [c], false, now), null);
  const r = kid('Kabir');
  r.wallet.earned.push({ rewardId: 'x', day: '2026-10-10' });
  assert.match(nudgeFor(undefined, [r], false, now)!, /^Kabir/);
});
