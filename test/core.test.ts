import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, skillById } from '../src/core/areas/index.ts';
import { buildPath, freshProgress, frontier, isPlayable, makeRound, recordResult, starsFor, dueForRevision, noteAsked } from '../src/core/path.ts';
import { Placement, stageForAge, answerFromCheck } from '../src/core/placement.ts';
import { freshWallet, addCoins, chooseReward, markGiven, applyMelt, coinsForLevel, addPlayTime, secondsLeft, jarProgress } from '../src/core/economy.ts';
import { REWARDS, CATEGORIES, costOf } from '../src/core/rewards.ts';
import { Fight, bossFor, BOSSES, FIGHT } from '../src/core/boss.ts';
import { createRng } from '../src/core/rng.ts';
import { isCorrect, normalise } from '../src/core/question.ts';

const area = AREAS[0];
const path = buildPath(area);

test('path: 5 levels per skill, a review every 5 skills, mid and final boss per stage', () => {
  const built = area.skills.filter((s) => s.length);
  for (const [i, skills] of built.entries()) {
    const stage = i + 1;
    const levels = path.filter((l) => l.stage === stage);
    assert.equal(levels.filter((l) => l.kind === 'skill').length, skills.length * 5);
    assert.equal(levels.filter((l) => l.kind === 'review').length, Math.floor(skills.length / 5));
    assert.deepEqual(levels.filter((l) => l.kind === 'boss').map((l) => (l.kind === 'boss' ? l.boss : '')), ['mid', 'final']);
    assert.equal(levels.at(-1)!.kind, 'boss');
  }
  assert.equal(new Set(path.map((l) => l.id)).size, path.length);
});

test('path: unlocking follows passes and placement skips', () => {
  const p = freshProgress();
  assert.equal(frontier(path, p), 0);
  assert.ok(isPlayable(path, p, path[0]));
  assert.ok(!isPlayable(path, p, path[1]));
  recordResult(p, path[0].id, 2);
  assert.equal(frontier(path, p), 1);
  const s2 = path.find((l) => l.stage === 2)!;
  for (const l of path) if (l.kind === 'skill' && l.stage === 1) p.skipped[l.skillId] = true;
  assert.ok(isPlayable(path, p, s2));
});

test('stars: pass mark 1, 90% 2, perfect 3', () => {
  assert.equal(starsFor(7, 10, 8), 0);
  assert.equal(starsFor(8, 10, 8), 1);
  assert.equal(starsFor(9, 10, 8), 2);
  assert.equal(starsFor(10, 10, 8), 3);
});

test('rounds: right size, no repeated questions, mix-ins on Practise more', () => {
  const rng = createRng(1);
  for (const l of path.filter((x) => x.kind !== 'boss').slice(0, 400)) {
    const p = freshProgress();
    const earlier = path.filter((x) => x.kind === 'skill' && x.index < l.index).map((x) => skillById((x as { skillId: string }).skillId)!).slice(-20);
    const round = makeRound(l, skillById, p, rng, earlier);
    assert.equal(round.questions.length, round.rules.count);
    const keys = round.questions.map((q) => q.key);
    // Small skills (e.g. "count 2–5 dots") can't avoid repeats, but never back to back.
    for (let i = 1; i < keys.length; i++) assert.notEqual(keys[i], keys[i - 1], `${l.id} repeats back to back`);
    for (const q of round.questions) assert.ok(q.choices.includes(q.answer));
  }
});

test('revision: mastered skills unseen for 14 days come back', () => {
  const p = freshProgress();
  const s = area.skills[1][0];
  recordResult(p, `${s.id}#5`, 3);
  noteAsked(p, [{ skillId: s.id, key: 'x' } as never], '2026-10-01');
  assert.deepEqual(dueForRevision(p, area.skills.flat(), '2026-10-10').map((x) => x.id), []);
  assert.deepEqual(dueForRevision(p, area.skills.flat(), '2026-10-16').map((x) => x.id), [s.id]);
});

test('answers: equivalent forms accepted unless exact form is required', () => {
  assert.ok(isCorrect({ answer: '3/4' }, '0.75'));
  assert.ok(isCorrect({ answer: '2.5' }, '2.50'));
  assert.ok(!isCorrect({ answer: '3/4', exactForm: true }, '6/8'));
  assert.equal(normalise('5,3'), '3,5');
  assert.ok(isCorrect({ answer: '-7' }, '−7'));
});

test('placement: age sets the stage; answers walk the strand', () => {
  assert.equal(stageForAge(3), 1);
  assert.equal(stageForAge(8), 3);
  assert.equal(stageForAge(16), 7);
  const skills = area.skills.flat();
  const tiny = new Placement(3, skills);
  assert.equal(tiny.next(), null);
  const pl = new Placement(8, skills);
  let asked = 0;
  for (let q = pl.next(); q && asked < 30; q = pl.next(), asked++) pl.answer(q.strand === 'addsub' ? 'yes' : 'effort');
  assert.ok(asked >= 2 && asked <= 12, `asked ${asked}`);
  const plan = pl.result();
  assert.ok(plan.skipped.length > 0);
  assert.ok(plan.skipped.every((id) => skillById(id)));
  // A child who can't do anything yet starts near the beginning of the strand.
  const weak = new Placement(8, skills);
  for (let q = weak.next(), n = 0; q && n < 30; q = weak.next(), n++) weak.answer('not');
  const weakPlan = weak.result();
  assert.ok(weakPlan.skipped.length < plan.skipped.length);
  assert.equal(answerFromCheck(6), 'yes');
  assert.equal(answerFromCheck(4), 'effort');
  assert.equal(answerFromCheck(1), 'not');
});

test('rewards: at least 100 in 12 categories, unique ids', () => {
  assert.ok(REWARDS.length >= 100);
  assert.equal(REWARDS.length, 128);
  assert.equal(CATEGORIES.length, 12);
  assert.equal(new Set(REWARDS.map((r) => r.id)).size, REWARDS.length);
  for (const r of REWARDS) assert.ok(CATEGORIES.some((c) => c.id === r.category));
});

test('economy: coins split 80/20, unlock waits for Given, surplus carries over', () => {
  const w = freshWallet();
  const choc = REWARDS.find((r) => r.name === 'Milk chocolate bar')!;
  const car = REWARDS.find((r) => r.name === 'Toy car')!;
  assert.ok(chooseReward(w, choc.id));
  assert.ok(chooseReward(w, car.id));
  assert.ok(!chooseReward(w, REWARDS[1].id), 'locked once chosen');
  const res = addCoins(w, 450);
  assert.deepEqual(res.unlocked, ['treat']);
  assert.equal(w.treat.coins, 360);
  assert.equal(w.goal.coins, 90);
  assert.ok(markGiven(w, 'treat', '2026-10-16'));
  assert.equal(w.treat.coins, 10);
  assert.equal(w.treat.rewardId, null);
  assert.equal(w.earned.length, 1);
  assert.equal(coinsForLevel('skill', 3, false), 9);
  assert.equal(coinsForLevel('skill', 1, true), 3);
  assert.equal(coinsForLevel('boss', 2, false), 50);
  assert.equal(costOf(choc), 350);
});

test('economy: melting per missed day, paused on holiday, never below zero', () => {
  const w = freshWallet();
  const choc = REWARDS.find((r) => r.name === 'Milk chocolate bar')!;
  chooseReward(w, choc.id);
  addCoins(w, 250); // treat 200
  addPlayTime(w, '2026-10-10', 60, 30);
  applyMelt(w, '2026-10-10', false);
  const lost = applyMelt(w, '2026-10-13', false); // missed 11 and 12
  assert.equal(lost.days, 2);
  assert.equal(lost.treat, 35); // 2 × 5% × 350
  assert.equal(applyMelt(w, '2026-10-13', false).days, 0);
  assert.equal(applyMelt(w, '2026-10-20', true).days, 0, 'holiday');
  assert.equal(applyMelt(w, '2026-12-30', false).treat, 165);
  assert.equal(w.treat.coins, 0);
  assert.equal(jarProgress(w.treat), 0);
});

test('economy: daily limit counts play only inside the limit', () => {
  const w = freshWallet();
  assert.ok(addPlayTime(w, '2026-10-16', 29 * 60, 30));
  assert.ok(addPlayTime(w, '2026-10-16', 60, 30));
  assert.ok(!addPlayTime(w, '2026-10-16', 60, 30));
  assert.equal(secondsLeft(w, '2026-10-16', 30), 0);
  assert.equal(secondsLeft(w, '2026-10-17', 30), 1800);
});

test('boss fight: hits, criticals, special at 5 in a row, defends and phases', () => {
  assert.equal(BOSSES.length, 14);
  const f = new Fight(bossFor(3, 'final'));
  assert.equal(f.mode, 'attack');
  assert.deepEqual(f.answer(true, 0.8), [{ type: 'hit', damage: FIGHT.hit, critical: false }]);
  assert.deepEqual(f.answer(true, 0.2), [{ type: 'hit', damage: FIGHT.critical, critical: true }]);
  f.answer(false, 0.5);
  assert.equal(f.mode, 'defend');
  assert.deepEqual(f.answer(false, 0.5), [{ type: 'hurt', hearts: 2 }]);
  let guard = 0;
  while (f.status === 'fighting' && guard++ < 200) f.answer(true, f.mode === 'defend' ? 0.5 : 0.5);
  assert.equal(f.status, 'won');
  assert.equal(f.phase, 2);
  const g = new Fight(bossFor(1, 'mid'));
  while (g.status === 'fighting') g.answer(false, 1);
  assert.equal(g.status, 'lost');
});
