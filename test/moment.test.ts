import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressMoment, coinsAt } from '../src/core/moment.ts';
import { freshWallet, chooseReward, addCoins } from '../src/core/economy.ts';
import { rewardById, costOf } from '../src/core/rewards.ts';

test('progress moment: before, after, perfect gain and next milestone', () => {
  const w = freshWallet();
  chooseReward(w, 'sweets.milk-chocolate-bar');
  const cost = costOf(rewardById('sweets.milk-chocolate-bar')!);
  w.treat.coins = cost * 0.4;
  addCoins(w, 10);
  const m = progressMoment(w, 10, 30)!;
  assert.ok(Math.abs(m.before - 0.4) < 1e-9);
  assert.ok(m.after > m.before);
  assert.ok(m.perfectGain > m.gain);
  assert.equal(m.next, 0.5);
  assert.ok(m.perfectLevels >= 1);
});

test('progress moment: none without a treat or coins', () => {
  const w = freshWallet();
  assert.equal(progressMoment(w, 10, 30), null);
  chooseReward(w, 'sweets.milk-chocolate-bar');
  assert.equal(progressMoment(w, 0, 30), null);
});

test('coinsAt follows the score ladder', () => {
  assert.equal(coinsAt(30, 1), 30);
  assert.equal(coinsAt(30, 0.9), 15);
  assert.equal(coinsAt(30, 0.8), 9);
});
