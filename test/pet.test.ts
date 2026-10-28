// The Adventure pet: the egg hatches after 3 levels or the first chest, the pet grows with XP
// earned after hatching, snacks cost gems and give hearts that unlock tricks, it is never
// sad, and undo, phone-merge and report-card backups all keep it right.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { logPlay } from '../src/core/stats.ts';
import { BADGES, freshAdventure, gemsEarned, mergeAdventure, newBadges, xpOf } from '../src/core/adventure.ts';
import { cleanName, ensureEgg, feed, hatch, hatchReady, levelsToHatch, moodOf, petStage, petXp } from '../src/core/pet.ts';
import { HATCH_LEVELS, STAGES, heartsOf, stageFor, tricksFor, treatGems } from '../src/core/petdata.ts';
import { gemBalance } from '../src/core/wardrobe.ts';
import { remember, rollback } from '../src/core/undo.ts';
import { makeBackup, mergeChild, readBackup } from '../src/core/backup.ts';

const DAY = '2026-10-28';
const kid = () => {
  const c = newChild('Riya', 8, 0, '2026-10-01');
  c.undo = [];
  c.adventure = freshAdventure();
  return c;
};
const level = (c: ReturnType<typeof kid>, t: number) => logPlay(c, { t, d: DAY, id: `l${t}`, k: 'skill', st: 3, tier: 1, sc: 10, of: 10, s: 3, sec: 100, c: 5, a: { 's3.x2': [10, 10, 30000] } });
const ctx = (c: ReturnType<typeof kid>) => ({ c, today: DAY, path: [], strandOf: () => undefined, skillIds: [] });

test('the egg hatches after 3 levels since it turned up, or after the first chest', () => {
  const c = kid();
  level(c, 50); // before the egg: doesn't count
  ensureEgg(c.adventure, 100);
  ensureEgg(c.adventure, 999); // only once
  assert.equal(c.adventure!.eggAt, 100);
  assert.equal(levelsToHatch(c), HATCH_LEVELS);
  for (let k = 1; k < HATCH_LEVELS; k++) level(c, 100 + k);
  assert.equal(hatchReady(c), false);
  assert.equal(hatch(c, 'fox', 'Pip', 200), false);
  level(c, 150);
  assert.equal(hatchReady(c), true);
  // Or a chest, whichever comes first.
  const d = kid();
  ensureEgg(d.adventure, 100);
  d.adventure!.claimed['d:2026-10-28'] = 300;
  assert.equal(hatchReady(d), true);
  // Adventure off: no hatching.
  d.adventure!.on = false;
  assert.equal(hatchReady(d), false);
});

test('hatching: one of four pets, a name of up to 12 letters, a badge', () => {
  const c = kid();
  ensureEgg(c.adventure, 1);
  c.adventure!.claimed['d:2026-10-28'] = 2;
  assert.equal(hatch(c, 'fox', '   ', 10), false);
  assert.equal(hatch(c, 'unicorn' as never, 'Pip', 10), false);
  assert.equal(cleanName('  Captain   Fluffington  '), 'Captain Fluf');
  assert.equal(hatch(c, 'owl', '  Hoot  ', 10), true);
  assert.equal(c.adventure!.pet!.name, 'Hoot');
  assert.equal(c.adventure!.pet!.xpAtHatch, xpOf(c));
  assert.equal(hatch(c, 'fox', 'Again', 11), false); // only one pet
  assert.ok(newBadges(ctx(c)).some((b) => b.id === 'pet-parent'));
  assert.ok(['pet-parent', 'pet-friends', 'pet-legend'].every((id) => BADGES.some((b) => b.id === id)));
});

test('it grows with the XP earned after hatching: Baby, Little, Big, Super, Legendary', () => {
  assert.deepEqual(STAGES.map((s) => s.name), ['Baby', 'Little', 'Big', 'Super', 'Legendary']);
  assert.equal(stageFor(0).stage.name, 'Baby');
  assert.equal(stageFor(499).stage.name, 'Baby');
  assert.equal(stageFor(500).stage.name, 'Little');
  assert.equal(stageFor(2000).stage.name, 'Big');
  assert.equal(stageFor(5000).stage.name, 'Super');
  assert.equal(stageFor(10000).stage.name, 'Legendary');
  assert.equal(stageFor(10000).next, undefined);
  assert.deepEqual([stageFor(800).into, stageFor(800).need], [300, 1500]);
  const c = kid();
  c.stats.correct = 300; // 3,000 XP before the pet
  ensureEgg(c.adventure, 1);
  c.adventure!.claimed['d:x'] = 2;
  hatch(c, 'dragon', 'Spark', 10);
  assert.equal(petXp(c), 0);
  c.stats.correct += 50; // +500 XP
  assert.equal(petXp(c), 500);
  assert.equal(petStage(c).stage.name, 'Little');
  c.stats.correct = 0; // even if XP somehow drops, never below a baby
  assert.equal(petStage(c).stage.name, 'Baby');
});

test('never sad: sleepy before play today, bouncy after', () => {
  const c = kid();
  assert.equal(moodOf(c, DAY), 'sleepy');
  c.stats.secondsByDay[DAY] = 60;
  assert.equal(moodOf(c, DAY), 'bouncy');
});

test('snacks cost gems and give hearts; 5, 15 and 30 hearts teach tricks', () => {
  const c = kid();
  c.stats.correct = 400; // a few player levels, so some gems
  ensureEgg(c.adventure, 1);
  c.adventure!.claimed['d:x'] = 2;
  hatch(c, 'turtle', 'Moss', 10);
  const before = gemBalance(c);
  assert.ok(before >= 20, `gems: ${before}`);
  const r = feed(c, 'cake', 20);
  assert.deepEqual(r, { ok: true, hearts: 4, gained: 4 });
  assert.equal(gemBalance(c), before - 20);
  assert.equal(treatGems(c.adventure!.pet), 20);
  feed(c, 'berries', 20); // same moment: still counted
  assert.equal(heartsOf(c.adventure!.pet), 5);
  assert.deepEqual(tricksFor(5).map((t) => t.id), ['wave']);
  assert.deepEqual(tricksFor(30).map((t) => t.id), ['wave', 'spin', 'dance']);
  // Not enough gems: nothing happens.
  const poor = kid();
  ensureEgg(poor.adventure, 1);
  poor.adventure!.claimed['d:x'] = 2;
  hatch(poor, 'fox', 'Pip', 10);
  const got = feed(poor, 'cake', 30);
  assert.equal(got.ok, false);
  assert.equal(heartsOf(poor.adventure!.pet), 0);
  // Earned gems are untouched by snacks (they only add to "spent").
  assert.equal(gemsEarned(c), gemsEarned(c));
});

test('undo: snacks come back, and a pet hatched in the undone time goes back into its egg', () => {
  const c = kid();
  c.stats.correct = 400;
  ensureEgg(c.adventure, 1);
  c.adventure!.claimed['d:x'] = 2;
  hatch(c, 'fox', 'Pip', 10);
  remember(c, [], 1000, DAY);
  feed(c, 'cookie', 1000);
  feed(c, 'cookie', 1001);
  assert.equal(heartsOf(c.adventure!.pet), 4);
  rollback(c, 1000);
  assert.equal(heartsOf(c.adventure!.pet), 0);
  assert.equal(c.adventure!.pet!.name, 'Pip');
  remember(c, [], 5, DAY);
  rollback(c, 5);
  assert.equal(c.adventure!.pet, undefined);
  assert.equal(hatchReady(c), true); // the egg is back, ready again
});

test('two phones: the pet that hatched first, with every snack; backups keep it', async () => {
  const a = kid();
  const b = kid();
  for (const [c, at, sp] of [[a, 50, 'owl'], [b, 40, 'fox']] as const) {
    ensureEgg(c.adventure, 1);
    c.adventure!.claimed['d:x'] = 2;
    c.stats.correct = 400;
    hatch(c, sp, sp === 'owl' ? 'Hoot' : 'Pip', at);
  }
  feed(a, 'berries', 60);
  feed(b, 'cookie', 70);
  const m = mergeAdventure(a.adventure, b.adventure)!;
  assert.equal(m.pet!.name, 'Pip');
  assert.equal(heartsOf(m.pet), 3);
  assert.equal(mergeChild(a, b, false).adventure!.pet!.species, 'fox');
  // Report card: out and back in.
  const back = await readBackup(JSON.stringify(await makeBackup(a)));
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(back.backup.child.adventure!.pet, a.adventure!.pet);
});
