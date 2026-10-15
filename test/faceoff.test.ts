import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FaceoffMatch, FACEOFF, showdownAllowed, recordPair, pairScore, childSkillIndex } from '../src/core/faceoff.ts';
import { buildPath, freshProgress } from '../src/core/path.ts';
import { AREAS, allSkills } from '../src/core/areas/index.ts';

test('tug of war: 7 notches to win, opposite pulls cancel', () => {
  const m = new FaceoffMatch('tug', 10, 10, 320);
  let t = 0;
  m.answer(0, true, (t += 2000));
  m.answer(1, true, (t += 2000));
  assert.equal(m.rope, 0);
  for (let i = 0; i < 6; i++) m.answer(0, true, (t += 2000));
  assert.equal(m.winner, null);
  const ev = m.answer(0, true, (t += 2000));
  assert.equal(m.winner, 0);
  assert.ok(ev.some((e) => e.type === 'win' && e.side === 0));
  assert.deepEqual(m.answer(1, true, (t += 2000)), [], 'no answers after the end');
});

test('a wrong tap freezes only that side for a second', () => {
  const m = new FaceoffMatch('race', 5, 5, 320);
  m.answer(1, false, 1000);
  assert.ok(m.frozen(1, 1500));
  assert.deepEqual(m.answer(1, true, 1500), []);
  assert.equal(m.answer(0, true, 1500).length > 0, true);
  assert.equal(m.answer(1, true, 1000 + FACEOFF.freezeMs).length > 0, true);
});

test('race to 10, with auto-balance after 3 in a row', () => {
  const m = new FaceoffMatch('race', 0, 0, 320);
  let t = 0;
  const harder: number[] = [];
  for (let i = 0; i < 10; i++) for (const e of m.answer(0, true, (t += 10))) if (e.type === 'harder') harder.push(e.skill);
  assert.deepEqual(harder, [3, 6, 9]);
  assert.equal(m.winner, 0);
});

test('showdown only for close players; first correct takes the point', () => {
  assert.equal(showdownAllowed(10, 20), true);
  assert.equal(showdownAllowed(10, 21), false);
  assert.throws(() => new FaceoffMatch('showdown', 0, 50, 320));
  const m = new FaceoffMatch('showdown', 12, 15, 320);
  assert.equal(m.sharedSkill, 12);
  m.answer(1, true, 1);
  assert.equal(m.sides[1].score, 1);
});

test('pair scoreboard is order-independent', () => {
  const board: Record<string, [number, number]> = {};
  recordPair(board, 'kid', 'guest', 0);
  recordPair(board, 'guest', 'kid', 0);
  recordPair(board, 'kid', 'guest', 0);
  assert.deepEqual(pairScore(board, 'kid', 'guest'), [2, 1]);
  assert.deepEqual(pairScore(board, 'guest', 'kid'), [1, 2]);
});

test('a new child starts Face-off at the first skill', () => {
  const path = buildPath(AREAS[0]);
  assert.equal(childSkillIndex(path, freshProgress(), allSkills()), 0);
});
