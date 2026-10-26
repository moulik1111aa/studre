// Gems and Plus's wardrobe: gems come from saved progress, buying needs enough gems and the
// level, undo takes a purchase back, phones combine, and every third chest has a surprise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { GEMS, freshAdventure, gemsEarned, levelOf, mergeAdventure, xpOf } from '../src/core/adventure.ts';
import { ITEMS, chestsToSurprise, gemBalance, itemById, outfitOf, surpriseFor, tapItem } from '../src/core/wardrobe.ts';
import { remember, rollback } from '../src/core/undo.ts';

const kid = (correct = 0) => {
  const c = newChild('Riya', 8, 0, '2026-10-01');
  c.undo = [];
  c.adventure = freshAdventure();
  c.stats.correct = correct;
  return c;
};

test('gems: 10 a level, 5 and 15 a chest, more for badges; never from gem badges', () => {
  const c = kid(100); // 1,000 XP
  const level = levelOf(xpOf(c)).level;
  assert.equal(gemsEarned(c), (level - 1) * GEMS.level);
  c.adventure!.claimed['d:2026-10-20'] = 1;
  c.adventure!.claimed['w:2026-10-19'] = 2;
  const withChests = gemsEarned(c);
  c.adventure!.badges['gems-500'] = 3;
  assert.equal(gemsEarned(c), withChests);
  c.adventure!.badges['levels-1'] = 4; // bronze
  assert.ok(gemsEarned(c) >= withChests + GEMS.badge[1]);
});

test('buying: enough gems and the level, one tap buys and wears, another takes it off', () => {
  const c = kid(0);
  assert.equal(gemBalance(c), 0);
  const short = tapItem(c, 'party-hat', 1)!;
  assert.equal(short.kind, 'short');
  c.stats.correct = 300; // plenty of levels and gems
  const locked = tapItem(c, 'space-helmet', 1)!;
  assert.equal(locked.kind, 'locked');
  const before = gemBalance(c);
  assert.equal(tapItem(c, 'party-hat', 5)!.kind, 'bought');
  assert.equal(gemBalance(c), before - itemById('party-hat')!.price);
  assert.equal(outfitOf(c.adventure).hat, 'party-hat');
  assert.equal(tapItem(c, 'party-hat', 6)!.kind, 'off');
  assert.equal(outfitOf(c.adventure).hat, undefined);
  assert.equal(tapItem(c, 'party-hat', 7)!.kind, 'worn');
  assert.ok(gemBalance(c) >= 0);
  // Switched off: Plus wears nothing special.
  c.adventure!.on = false;
  assert.deepEqual(outfitOf(c.adventure), {});
});

test('undo takes a purchase back, and the gems with it', () => {
  const c = kid(300);
  const before = gemBalance(c);
  remember(c, [], 1000, '2026-10-26');
  tapItem(c, 'cap', 1000);
  assert.ok(gemBalance(c) < before);
  rollback(c, 900);
  assert.equal(gemBalance(c), before);
  assert.equal(outfitOf(c.adventure).hat, undefined);
});

test('two phones: every item from both, the earlier time of each', () => {
  const a = freshAdventure();
  const b = freshAdventure();
  a.owned = { cap: 20 };
  b.owned = { cap: 10, scarf: 30 };
  b.gifted = { mint: 40 };
  b.equipped = { neck: 'scarf' };
  a.equipped = { hat: 'cap' };
  const m = mergeAdventure(a, b)!;
  assert.deepEqual(m.owned, { cap: 10, scarf: 30 });
  assert.deepEqual(m.gifted, { mint: 40 });
  assert.deepEqual(m.equipped, { neck: 'scarf', hat: 'cap' });
});

test('every third chest has a surprise: the cheapest item not owned yet, free', () => {
  const c = kid(0);
  const a = c.adventure!;
  a.claimed['d:2026-10-20'] = 1;
  assert.equal(chestsToSurprise(a), 2);
  assert.equal(surpriseFor(c, 2), null);
  a.claimed['d:2026-10-21'] = 2;
  a.claimed['d:2026-10-22'] = 3;
  const gift = surpriseFor(c, 3)!;
  const cheapest = [...ITEMS].filter((i) => i.level <= 1).sort((p, q) => p.price - q.price)[0];
  assert.equal(gift.id, cheapest.id);
  assert.ok(a.gifted![gift.id]);
  // Surprise items cost nothing.
  assert.equal(gemBalance(c), gemsEarned(c));
  assert.equal(tapItem(c, gift.id, 4)!.kind, 'worn');
});
