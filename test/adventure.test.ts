// Adventure mode: quests read from the play log, chests open once, badges, undo and merging.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { logPlay } from '../src/core/stats.ts';
import { remember, rollback } from '../src/core/undo.ts';
import { mergeChild } from '../src/core/backup.ts';
import { BADGES, MAX_LEVEL, XP, awardBadges, claimChest, chestCoins, dailyQuests, freshAdventure, levelOf, newBadges, nextRank, questStreak, rankOf, status, weekDays, weekStart, weeklyChallenge, xpOf, xpToReach, type BadgeContext } from '../src/core/adventure.ts';

const DAY = '2026-10-25';
const kid = (age = 8) => {
  const c = newChild('Riya', age, 2, '2026-10-01');
  c.undo = [];
  c.adventure = freshAdventure();
  return c;
};
const play = (c: ReturnType<typeof kid>, t: number, sc = 10, d = DAY) => {
  logPlay(c, { t, d, id: `s3.x2#${t}`, k: 'skill', st: 3, tier: 1, sc, of: 10, s: sc === 10 ? 3 : sc >= 7 ? 1 : 0, sec: 300, c: 10, a: { 's3.x2': [10, sc, 30000] } });
  c.stats.secondsByDay[d] = (c.stats.secondsByDay[d] ?? 0) + 300;
  c.stats.answered += 10;
  c.stats.correct += sc;
};
const ctx = (c: ReturnType<typeof kid>): BadgeContext => ({ c, today: DAY, path: [], strandOf: () => 'muldiv', skillIds: ['s3.x2'] });

test('three different quests a day, the same all day, changing day to day', () => {
  const c = kid();
  const a = dailyQuests(c, DAY, 30).map((q) => q.id);
  assert.equal(new Set(a).size, 3);
  assert.deepEqual(dailyQuests(c, DAY, 30).map((q) => q.id), a);
  const week = Array.from({ length: 7 }, (_, i) => dailyQuests(c, `2026-10-${10 + i}`, 30).map((q) => q.id).join());
  assert.ok(new Set(week).size > 1);
  // Little ones get smaller targets.
  const small = dailyQuests(kid(5), DAY, 30).find((q) => q.id === 'levels');
  if (small) assert.equal(small.target, 2);
});

test('quest progress comes from today’s play only', () => {
  const c = kid();
  play(c, 1, 10, '2026-10-24');
  const q = dailyQuests(c, DAY, 30);
  assert.ok(q.every((x) => status(c, x, [DAY]).value === 0));
  for (let t = 2; t <= 6; t++) play(c, t);
  c.stats.secondsByDay[DAY] = 1200;
  assert.ok(q.every((x) => status(c, x, [DAY]).done), q.map((x) => `${x.id} ${status(c, x, [DAY]).value}/${x.target}`).join());
});

test('a chest opens once, and only when its quests are done', () => {
  const a = freshAdventure();
  assert.equal(claimChest(a, `d:${DAY}`, false, 5), false);
  assert.equal(claimChest(a, `d:${DAY}`, true, 5), true);
  assert.equal(claimChest(a, `d:${DAY}`, true, 6), false);
  a.on = false;
  assert.equal(claimChest(a, `d:2026-10-26`, true, 7), false);
  assert.equal(chestCoins(12, 'daily'), 12);
  assert.equal(chestCoins(12, 'weekly'), 36);
});

test('weeks start on Monday; the weekly challenge counts the whole week', () => {
  assert.equal(weekStart('2026-10-25'), '2026-10-19'); // a Sunday
  assert.equal(weekStart('2026-10-19'), '2026-10-19');
  assert.deepEqual(weekDays('2026-10-21'), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  const c = kid();
  const w = weeklyChallenge(c, DAY);
  assert.equal(w.id, weeklyChallenge(c, '2026-10-20').id);
  for (let i = 0; i < 7; i++) for (let k = 0; k < 6; k++) play(c, i * 10 + k + 1, 10, weekDays(DAY)[i]);
  assert.ok(status(c, w, weekDays(DAY)).done);
});

test('badges: earned once, with progress for the rest', () => {
  const c = kid();
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
  assert.ok(BADGES.length >= 75);
  assert.equal(newBadges(ctx(c)).length, 0);
  c.progress.levels['s3.x2#1'] = { stars: 3, passes: 1 };
  play(c, 1);
  const got = awardBadges(ctx(c), 100).map((b) => b.id);
  assert.ok(got.includes('levels-1') && got.includes('perfect-1'), got.join());
  assert.equal(awardBadges(ctx(c), 200).length, 0);
  // Switched off: nothing new is noted.
  c.adventure!.on = false;
  c.bossesBeaten = ['gloop'];
  assert.equal(awardBadges(ctx(c), 300).length, 0);
});

test('undo takes back chests and badges with the play', () => {
  const c = kid();
  remember(c, ['s3.x2#1'], 1000, DAY);
  c.progress.levels['s3.x2#1'] = { stars: 3, passes: 1 };
  play(c, 1000);
  awardBadges(ctx(c), 1000);
  claimChest(c.adventure!, `d:${DAY}`, true, 1000);
  assert.ok(c.adventure!.badges['levels-1']);
  rollback(c, 900);
  assert.equal(c.adventure!.badges['levels-1'], undefined);
  assert.equal(c.adventure!.claimed[`d:${DAY}`], undefined);
});

test('quest streak counts days with the daily chest opened', () => {
  const c = kid();
  for (const d of ['2026-10-22', '2026-10-23', '2026-10-24']) c.adventure!.claimed[`d:${d}`] = 1;
  assert.equal(questStreak(c, DAY), 3);
  c.adventure!.claimed[`d:${DAY}`] = 2;
  assert.equal(questStreak(c, DAY), 4);
});

test('combining two phones keeps every chest and badge', () => {
  const a = kid();
  const b = JSON.parse(JSON.stringify(a)) as ReturnType<typeof kid>;
  a.adventure!.badges['levels-1'] = 50;
  b.adventure!.badges['levels-1'] = 40;
  b.adventure!.badges['bosses-1'] = 60;
  b.adventure!.claimed[`d:${DAY}`] = 70;
  const m = mergeChild(a, b, true);
  assert.equal(m.adventure!.badges['levels-1'], 40);
  assert.equal(m.adventure!.badges['bosses-1'], 60);
  assert.equal(m.adventure!.claimed[`d:${DAY}`], 70);
});

test('XP comes from saved progress, and levels need a little more each time', () => {
  assert.equal(xpToReach(1), 0);
  assert.equal(xpToReach(2), 200);
  assert.equal(xpToReach(3), 450);
  assert.equal(levelOf(199).level, 1);
  assert.deepEqual(levelOf(200), { level: 2, into: 0, need: 250, xp: 200 });
  assert.equal(levelOf(10_000_000).level, MAX_LEVEL);
  assert.equal(levelOf(10_000_000).need, 0);
  const c = kid();
  c.stats.correct = 30;
  c.progress.levels['s3.x2#1'] = { stars: 3, passes: 1 };
  c.progress.levels['s3.x2#2'] = { stars: 1, passes: 1 };
  c.bossesBeaten = ['gloop'];
  c.adventure!.claimed[`d:${DAY}`] = 5;
  c.adventure!.claimed['w:2026-10-19'] = 6;
  c.adventure!.badges['levels-1'] = 7; // bronze
  c.adventure!.badges['plevel-5'] = 8; // level badges give no XP
  assert.equal(xpOf(c), 30 * XP.right + 4 * XP.star + XP.boss + XP.daily + XP.weekly + XP.badge[1]);
});

test('ranks every few levels, and combo badges from the best run in a level', () => {
  assert.equal(rankOf(1).name, 'Rookie');
  assert.equal(rankOf(4).name, 'Rookie');
  assert.equal(rankOf(5).name, 'Number Scout');
  assert.equal(rankOf(99).name, 'Infinity Master');
  assert.equal(nextRank(14)!.from, 15);
  assert.equal(nextRank(95), undefined);
  const c = kid();
  logPlay(c, { t: 1, d: DAY, id: 'a', k: 'skill', st: 3, tier: 1, sc: 10, of: 10, s: 3, sec: 100, c: 5, a: { 's3.x2': [10, 10, 9000] }, cb: 10 });
  const got = newBadges(ctx(c)).map((b) => b.id);
  assert.ok(got.includes('combo-5') && got.includes('combo-10') && !got.includes('combo-20'), got.join());
});
