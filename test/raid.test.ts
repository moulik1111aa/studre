// The weekly raid: hits come from this week's play, beating it opens one raid chest, undo and
// phone-merge follow, and the children's Adventure tips wait for 3 levels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { logPlay } from '../src/core/stats.ts';
import { ADV_TIPS_AFTER, BADGES, GEMS, advTipsDue, claimChest, freshAdventure, gemsEarned, mergeAdventure, newBadges } from '../src/core/adventure.ts';
import { HIT, ROSTER, damageOn, monsterFor, raidFor, raidHp } from '../src/core/raid.ts';
import { raidItem } from '../src/core/wardrobe.ts';
import { remember, rollback } from '../src/core/undo.ts';

const MON = '2026-10-26';
const kid = (age = 8) => {
  const c = newChild('Riya', age, 0, '2026-10-01');
  c.undo = [];
  c.adventure = freshAdventure();
  return c;
};
const level = (c: ReturnType<typeof kid>, d: string, sc: number, s: number, t = Date.now()) =>
  logPlay(c, { t, d, id: `l${t}`, k: 'skill', st: 3, tier: 1, sc, of: 10, s, sec: 100, c: 5, a: { 's3.x2': [10, sc, 30000] } });

test('a different monster each week, the same all week, round the roster', () => {
  assert.equal(monsterFor('2026-10-26').id, monsterFor('2026-11-01').id);
  assert.notEqual(monsterFor('2026-10-26').id, monsterFor('2026-11-02').id);
  const eight = Array.from({ length: 8 }, (_, k) => monsterFor(new Date(Date.UTC(2026, 9, 26 + k * 7)).toISOString().slice(0, 10)).id);
  assert.equal(new Set(eight).size, ROSTER.length);
  assert.equal(raidHp(5), 150);
  assert.equal(raidHp(9), 250);
});

test('hits: right answers, perfect and 3-star levels, and daily chests this week only', () => {
  const c = kid();
  level(c, '2026-10-25', 10, 3, 1); // last week: no hits
  level(c, MON, 8, 1, 2);
  level(c, '2026-10-27', 10, 3, 3);
  c.adventure!.claimed['d:2026-10-27'] = 4;
  assert.equal(damageOn(c, MON), 8 * HIT.right);
  assert.equal(damageOn(c, '2026-10-27'), 10 * HIT.right + HIT.perfect + HIT.stars3 + HIT.chest);
  const r = raidFor(c, '2026-10-27');
  assert.equal(r.damage, 8 + 10 + 5 + 3 + 20);
  assert.equal(r.left, 250 - r.damage);
  assert.equal(r.defeated, false);
  assert.equal(r.byDay.length, 2);
});

test('beaten: one raid chest, 40 gems, its own item, a badge; undo and merge follow', () => {
  const c = kid(5); // 150 HP
  remember(c, [], 1000, MON);
  for (let k = 0; k < 15; k++) level(c, MON, 10, 3, 1000 + k);
  const r = raidFor(c, MON);
  assert.ok(r.defeated);
  const gems = gemsEarned(c);
  assert.equal(claimChest(c.adventure!, r.key, r.defeated, 1100), true);
  assert.equal(claimChest(c.adventure!, r.key, r.defeated, 1200), false);
  assert.ok(gemsEarned(c) >= gems + GEMS.raid); // (its XP can bring a new level too)
  const item = raidItem(c, r.monster.id, 1100)!;
  assert.equal(item.raid, r.monster.id);
  assert.equal(raidItem(c, r.monster.id, 1300), null);
  assert.ok(newBadges({ c, today: MON, path: [], strandOf: () => undefined, skillIds: [] }).some((b) => b.id === 'raid-1'));
  assert.ok(BADGES.some((b) => b.id === 'raid-12'));
  // Two phones: the chest from either.
  const other = freshAdventure();
  assert.ok(mergeAdventure(other, c.adventure)!.claimed[r.key]);
  // Undo: the chest and item go back.
  rollback(c, 900);
  assert.equal(c.adventure!.claimed[r.key], undefined);
  assert.equal(c.adventure!.gifted?.[item.id], undefined);
  assert.equal(raidFor(c, MON).defeated, false);
});

test('children see the Adventure tips only after 3 levels, and once', () => {
  const c = kid();
  for (let k = 0; k < ADV_TIPS_AFTER - 1; k++) level(c, MON, 8, 1, k + 1);
  assert.equal(advTipsDue(c), false);
  level(c, MON, 8, 1, 99);
  assert.equal(advTipsDue(c), true);
  c.adventure!.toured = true;
  assert.equal(advTipsDue(c), false);
  c.adventure!.toured = false;
  c.adventure!.on = false;
  assert.equal(advTipsDue(c), false);
});
