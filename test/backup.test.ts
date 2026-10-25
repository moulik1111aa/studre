// Report-card backups: a round trip, edited files refused, and combining two phones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, readBackup, backupJson, mergeChild } from '../src/core/backup.ts';
import { newChild } from '../src/storage/save.ts';
import { logPlay } from '../src/core/stats.ts';

const kid = () => {
  const c = newChild('Riya', 8, 2, '2026-10-01');
  c.progress.levels['s3.x2#1'] = { stars: 2, passes: 1 };
  c.stats.secondsByDay['2026-10-20'] = 600;
  c.stats.answered = 40;
  c.stats.correct = 30;
  c.wallet.lifetime = 120;
  c.undo = [];
  logPlay(c, { t: 1, d: '2026-10-20', id: 's3.x2#1', k: 'skill', st: 3, tier: 1, sc: 8, of: 10, s: 2, sec: 300, c: 12, a: { 's3.x2': [10, 8, 30000] } });
  return c;
};

test('a backup inside a report card reads back the same child', async () => {
  const c = kid();
  const b = await makeBackup(c, new Date('2026-10-25T10:00:00Z'));
  const page = `<html><body><h1>Report</h1><script type="application/json" id="mn-backup">${backupJson(b)}</script></body></html>`;
  const r = await readBackup(page);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.backup.child.name, 'Riya');
    assert.equal(r.backup.child.undo, undefined);
    assert.deepEqual(r.backup.child.tally, { 's3.x2': [10, 8, 30000] });
  }
});

test('a file edited by hand, or not a report card, is refused', async () => {
  const b = await makeBackup(kid());
  const edited = backupJson(b).replace('"lifetime":120', '"lifetime":99999');
  const r = await readBackup(edited);
  assert.equal(r.ok, false);
  assert.equal((await readBackup('<html>hello</html>')).ok, false);
  assert.equal((await readBackup('{"format":"other"}')).ok, false);
});

test('combining two phones keeps the best of both', () => {
  const a = kid();
  const b = JSON.parse(JSON.stringify(a)) as ReturnType<typeof kid>;
  // Phone B played more: a better result, a new level, another day and more coins.
  b.progress.levels['s3.x2#1'] = { stars: 3, passes: 2 };
  b.progress.levels['s3.x5#1'] = { stars: 1, passes: 1 };
  b.stats.secondsByDay['2026-10-21'] = 900;
  b.wallet.lifetime = 300;
  b.bossesBeaten = ['gloop'];
  logPlay(b, { t: 2, d: '2026-10-21', id: 's3.x5#1', k: 'skill', st: 3, tier: 1, sc: 9, of: 10, s: 2, sec: 300, c: 14, a: { 's3.x5': [10, 9, 20000] } });
  // Phone A also had a level B never saw.
  a.progress.levels['s3.x10#1'] = { stars: 3, passes: 1 };
  const m = mergeChild(a, b, true);
  assert.deepEqual(m.progress.levels['s3.x2#1'], { stars: 3, passes: 2 });
  assert.ok(m.progress.levels['s3.x5#1'] && m.progress.levels['s3.x10#1']);
  assert.equal(m.stats.secondsByDay['2026-10-21'], 900);
  assert.equal(m.wallet.lifetime, 300);
  assert.deepEqual(m.bossesBeaten, ['gloop']);
  assert.equal(m.log!.length, 2);
  assert.deepEqual(m.tally!['s3.x2'], [10, 8, 30000]);
  assert.deepEqual(m.tally!['s3.x5'], [10, 9, 20000]);
  // Combining again changes nothing.
  const again = mergeChild(m, b, true);
  assert.equal(again.log!.length, 2);
  assert.deepEqual(again.tally, m.tally);
});
