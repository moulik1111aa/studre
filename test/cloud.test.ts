// Google sign-in, first version: a child goes up gzipped without question history; two phones
// and the cloud combine like two phones do; a removed child goes everywhere; family rules
// follow whoever changed them; unchanged children aren't sent again; the parent's nudge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild, freshSettings, type Child } from '../src/storage/save.ts';
import { combine, decodeChild, encodeChild, familyRules, freshMemo, nudgeFor, planSync, type CloudChild, type FamilyDoc, type FamilyRules, type SyncMemo } from '../src/core/cloud.ts';
import { logPlay } from '../src/core/stats.ts';

const kid = (name = 'Riya') => {
  const c = newChild(name, 8, 0, '2026-10-01');
  c.undo = [];
  return c;
};
const play = (c: Child, t: number, id = 's1.count5#1', stars = 3) => {
  c.progress.levels[id] = { stars: stars as 0 | 1 | 2 | 3, passes: 1 };
  logPlay(c, { t, d: '2026-11-01', id, k: 'skill', st: 1, tier: 1, sc: 8, of: 8, s: stars, sec: 60, c: 5, a: { [id.split('#')[0]]: [8, 8, 9000] } });
  c.stats.secondsByDay['2026-11-01'] = (c.stats.secondsByDay['2026-11-01'] ?? 0) + 60;
};

interface Phone {
  id: string;
  children: Child[];
  memo: SyncMemo;
  rules: FamilyRules;
}
interface Cloud {
  family: FamilyDoc | null;
  kids: Map<string, CloudChild>;
  reads: number;
  writes: number;
}
const phone = (id: string, children: Child[] = []): Phone => ({ id, children, memo: freshMemo(), rules: familyRules(freshSettings()) });
const cloud = (): Cloud => ({ family: null, kids: new Map(), reads: 0, writes: 0 });

async function sync(ph: Phone, cl: Cloud, now: number, combineWith?: (a: Child, b: Child) => Promise<boolean>) {
  cl.reads++;
  const r = await planSync({
    local: ph.children,
    rules: ph.rules,
    memo: ph.memo,
    family: cl.family,
    fetchChild: async (id) => (cl.reads++, cl.kids.get(id) ?? null),
    device: ph.id,
    label: `${ph.id}'s phone`,
    now,
    combineWith,
  });
  for (const d of r.put) (cl.kids.set(d.childId, d), cl.writes++);
  for (const id of r.del) cl.kids.delete(id);
  cl.family = r.family;
  cl.writes++;
  ph.children = r.children;
  ph.memo = r.memo;
  if (r.rules) ph.rules = { ...ph.rules, ...r.rules };
  return r;
}

test('a child in the cloud: gzipped, checked, without question history or undo notes', async () => {
  const c = kid();
  play(c, 100);
  c.progress.history['s1.count5'] = Array.from({ length: 50 }, (_, i) => `key-${i}-${'x'.repeat(30)}`);
  const doc = await encodeChild(c, 'p1', 500);
  assert.equal(doc.childId, c.id);
  const raw = JSON.stringify(c).length;
  assert.ok(doc.data.length < raw / 2, `${doc.data.length} vs ${raw}`);
  const d = await decodeChild(doc);
  assert.ok(d.ok);
  if (d.ok) {
    assert.deepEqual(d.child.progress.history, {});
    assert.deepEqual(d.child.progress.levels, c.progress.levels);
    assert.equal(d.child.log!.length, 1);
  }
  // A wrong id, or damaged data, is refused.
  assert.equal((await decodeChild({ ...doc, childId: 'other' })).ok, false);
  assert.equal((await decodeChild({ ...doc, data: 'bm90IGd6aXA=' })).ok, false);
  // Combining keeps this phone's own history.
  const back = combine(c, (d as { child: Child }).child, true);
  assert.equal(back.progress.history['s1.count5'].length, 50);
});

test('first sync uploads; a new phone restores; both phones then combine their play', async () => {
  const cl = cloud();
  const a = phone('A', [kid('Riya'), kid('Kabir')]);
  play(a.children[0], 1000);
  const r1 = await sync(a, cl, 2000);
  assert.equal(r1.put.length, 2);
  assert.equal(Object.keys(cl.family!.kids).length, 2);
  assert.ok(cl.family!.devices.A);
  // A new phone, no children: both come down.
  const b = phone('B');
  const r2 = await sync(b, cl, 3000);
  assert.deepEqual(r2.added.sort(), a.children.map((c) => c.id).sort());
  assert.equal(r2.put.length, 0);
  assert.equal(b.children.find((c) => c.name === 'Riya')!.progress.levels['s1.count5#1'].stars, 3);
  // Each phone plays a different level of Riya; after syncing both, both have both.
  play(a.children[0], 4000, 's1.count5#2', 2);
  play(b.children.find((c) => c.name === 'Riya')!, 4100, 's1.count5#3', 1);
  await sync(a, cl, 5000);
  await sync(b, cl, 6000);
  await sync(a, cl, 7000);
  for (const ph of [a, b]) assert.deepEqual(Object.keys(ph.children.find((c) => c.name === 'Riya')!.progress.levels).sort(), ['s1.count5#1', 's1.count5#2', 's1.count5#3']);
  assert.equal(a.children.find((c) => c.name === 'Riya')!.log!.length, 3);
});

test('nothing new: nothing is sent, and only the family document is read', async () => {
  const cl = cloud();
  const a = phone('A', [kid()]);
  await sync(a, cl, 1000);
  const before = { reads: cl.reads, writes: cl.writes };
  const r = await sync(a, cl, 2000);
  assert.equal(r.put.length, 0);
  assert.equal(cl.reads - before.reads, 1); // just the family document
  // New play: that child goes up again.
  play(a.children[0], 2500);
  assert.equal((await sync(a, cl, 3000)).put.length, 1);
});

test('a child removed on one phone is removed on every phone and in the cloud', async () => {
  const cl = cloud();
  const a = phone('A', [kid('Riya'), kid('Kabir')]);
  await sync(a, cl, 1000);
  const b = phone('B');
  await sync(b, cl, 2000);
  const gone = a.children[1].id;
  a.children = a.children.filter((c) => c.id !== gone);
  a.memo.removed[gone] = 2500;
  const r = await sync(a, cl, 3000);
  assert.deepEqual(r.del, [gone]);
  assert.equal(cl.kids.has(gone), false);
  const rb = await sync(b, cl, 4000);
  assert.deepEqual(rb.dropped, [gone]);
  assert.equal(b.children.length, 1);
  // And it doesn't come back from the other phone.
  await sync(b, cl, 5000);
  assert.equal(cl.family!.kids[gone], undefined);
});

test('family rules: a joining phone takes the family\'s; then the side that changed wins', async () => {
  const cl = cloud();
  const a = phone('A', [kid()]);
  a.rules.limitMinutes = 45;
  await sync(a, cl, 1000);
  const b = phone('B');
  b.rules.limitMinutes = 20;
  await sync(b, cl, 2000);
  assert.equal(b.rules.limitMinutes, 45);
  // B changes bedtime; A picks it up.
  b.rules.quiet = { bed: { on: true, from: '20:30', to: '07:00' }, school: { on: false, from: '08:00', to: '14:00', days: [1, 2, 3, 4, 5] } };
  await sync(b, cl, 3000);
  await sync(a, cl, 4000);
  assert.equal(a.rules.quiet!.bed.from, '20:30');
  assert.equal(a.rules.limitMinutes, 45);
});

test('an online backup that cannot be read is skipped, and the phone keeps its own', async () => {
  const cl = cloud();
  const a = phone('A', [kid()]);
  await sync(a, cl, 1000);
  const id = a.children[0].id;
  cl.kids.set(id, { ...cl.kids.get(id)!, data: 'AAAA' });
  cl.family!.kids[id] = 1500;
  const r = await sync(a, cl, 2000);
  assert.deepEqual(r.skipped, [id]);
  assert.equal(a.children.length, 1);
});

test('the nudge: after a reward or a week of play, at most weekly, never after "don\'t ask"', () => {
  const now = Date.parse('2026-11-05T10:00:00Z');
  const c = kid();
  assert.equal(nudgeFor(undefined, [c], false, now), null);
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

test('after undo on this phone, its copy replaces the cloud\'s instead of merging back', async () => {
  const cl = cloud();
  const a = phone('A', [kid()]);
  play(a.children[0], 1000, 's1.count5#1', 3);
  await sync(a, cl, 2000);
  const b = phone('B');
  await sync(b, cl, 2500);
  play(b.children[0], 2600, 's1.count5#2', 3);
  await sync(b, cl, 2700); // the cloud now has #1 and #2
  // A parent undoes #1 on phone A. The app syncs first (A gets #2), then undoes, then A's
  // copy replaces the cloud's, and every phone takes it.
  await sync(a, cl, 2900);
  delete a.children[0].progress.levels['s1.count5#1'];
  a.memo.force = { [a.children[0].id]: true };
  const r = await sync(a, cl, 3000);
  assert.equal(r.put.length, 1);
  assert.deepEqual(r.resets, [a.children[0].id]);
  assert.deepEqual(Object.keys(a.children[0].progress.levels), ['s1.count5#2']);
  await sync(b, cl, 4000);
  assert.deepEqual(Object.keys(b.children[0].progress.levels).sort(), ['s1.count5#2']);
  // And B doesn't push #1 back.
  await sync(b, cl, 5000);
  await sync(a, cl, 6000);
  assert.deepEqual(Object.keys(a.children[0].progress.levels), ['s1.count5#2']);
});

test('an existing phone signs in: a child set up separately elsewhere can be combined into one', async () => {
  const cl = cloud();
  const a = phone('A', [kid('Riya')]);
  play(a.children[0], 1000, 's1.count5#1', 3);
  await sync(a, cl, 2000);
  // Phone B had its own Riya (a different id) and Kabir, from before signing in.
  const b = phone('B', [kid(' riya '), kid('Kabir')]);
  play(b.children[0], 1500, 's1.count5#2', 2);
  const oldId = b.children[0].id;
  const asked: string[] = [];
  const r = await sync(b, cl, 3000, async (here, there) => (asked.push(`${here.name.trim()}=${there.name}`), true));
  assert.deepEqual(asked, ['riya=Riya']);
  const cloudId = a.children[0].id;
  assert.deepEqual(r.renamed, { [oldId]: cloudId });
  assert.deepEqual(r.added, []);
  assert.equal(b.children.length, 2);
  const riya = b.children.find((c) => c.id === cloudId)!;
  assert.deepEqual(Object.keys(riya.progress.levels).sort(), ['s1.count5#1', 's1.count5#2']);
  assert.equal(riya.log!.length, 2);
  assert.equal(Object.keys(cl.family!.kids).length, 2);
  // Phone A gets the combined Riya, and Kabir.
  await sync(a, cl, 4000);
  assert.equal(a.children.length, 2);
  assert.deepEqual(Object.keys(a.children.find((c) => c.id === cloudId)!.progress.levels).sort(), ['s1.count5#1', 's1.count5#2']);
  // Said no: both are kept.
  const cl2 = cloud();
  const c = phone('C', [kid('Riya')]);
  await sync(c, cl2, 1000);
  const d = phone('D', [kid('Riya')]);
  await sync(d, cl2, 2000, async () => false);
  assert.equal(d.children.length, 2);
});
