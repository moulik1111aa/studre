// Worksheets: the last 3 or 4 skills a child played, mixed (an even share each, never the same
// skill twice in a row); before enough play, the skill they're on now and the ones before it.
// 12 questions for little ones, 20 otherwise; every one can be made into a question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newChild } from '../src/storage/save.ts';
import { AREAS, skillById } from '../src/core/areas/index.ts';
import { buildPath, makeQuestion, recordResult } from '../src/core/path.ts';
import { createRng } from '../src/core/rng.ts';
import type { PlayEntry } from '../src/core/stats.ts';
import { lastPlayedSkills, sheetSize, worksheetPlan } from '../src/core/worksheet.ts';

const path = buildPath(AREAS[0]);
const stageOf = (id: string) => skillById(id)?.stage;
const skillLevels = path.filter((l) => l.kind === 'skill') as Extract<(typeof path)[number], { kind: 'skill' }>[];
const skillIds = [...new Set(skillLevels.map((l) => l.skillId))];

const game = (t: number, a: Record<string, number>): PlayEntry => ({ t, d: '2026-11-05', id: 'x', k: 'skill', st: 1, sc: 0, of: 0, s: 1, sec: 60, c: 0, a: Object.fromEntries(Object.entries(a).map(([id, n]) => [id, [n, n, 0]])) });

test('the last skills played: newest game first, the most-answered skill first within a game', () => {
  const [a, b, c, d, e] = skillIds.slice(40, 45);
  const log = [game(1, { [e]: 9 }), game(2, { [d]: 5 }), game(3, { [c]: 2, [b]: 6 }), game(4, { [a]: 4 }), game(5, { [a]: 3 })];
  assert.deepEqual(lastPlayedSkills(log, () => true), [a, b, c, d]);
  assert.deepEqual(lastPlayedSkills(log, (id) => id !== b, 3), [a, c, d]);
});

test('a sheet mixes the last 4 skills played: an even share each, never one skill twice in a row', () => {
  const c = newChild('Riya', 9, 0, '2026-10-01');
  c.placed = true;
  const four = skillIds.slice(60, 64);
  c.log = four.map((id, i) => game(10 - i, { [id]: 5 }));
  recordResult(c.progress, `${four[0]}#1`, 3);
  recordResult(c.progress, `${four[0]}#2`, 3);
  const plan = worksheetPlan(c, path, '2026-11-05', createRng('x'), stageOf);
  assert.equal(plan.length, 20);
  assert.equal(sheetSize(9), 20);
  for (const id of four) assert.equal(plan.filter((p) => p.skillId === id).length, 5);
  assert.ok(plan.every((p) => four.includes(p.skillId)));
  for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i].skillId, plan[i - 1].skillId, `questions ${i} and ${i + 1}`);
  // Further along in a skill means harder questions from it.
  const avg = (id: string) => plan.filter((p) => p.skillId === id).reduce((s, p) => s + p.d, 0) / 5;
  assert.ok(avg(four[0]) > avg(four[1]));
  assert.ok(plan.every((p) => p.d >= 0 && p.d <= 1));
  const rng = createRng('q');
  for (const p of plan) assert.ok(makeQuestion(skillById(p.skillId)!, rng, p.d, new Set()).prompt);
});

test('little ones get 12; a brand-new child gets their first skills', () => {
  const c = newChild('Ana', 4, 0, '2026-10-01');
  const plan = worksheetPlan(c, path, '2026-11-05', createRng('y'), stageOf);
  assert.equal(plan.length, 12);
  assert.ok(plan.some((p) => p.skillId === skillLevels[0].skillId));
  assert.ok(plan.every((p) => (stageOf(p.skillId) ?? 0) === 1));
});

test('before their first play, an older child gets a sheet at the stage for their age, not the start of the map', () => {
  const c = newChild('Kabir', 8, 0, '2026-10-01');
  const plan = worksheetPlan(c, path, '2026-11-05', createRng('z'), stageOf);
  assert.equal(plan.length, 20);
  // Stage 3 is for ages 7 and 8; the skills just before it can come from stage 2.
  assert.ok(plan.every((p) => (stageOf(p.skillId) ?? 0) >= 2), plan.map((p) => p.skillId).join());
  assert.ok(plan.some((p) => stageOf(p.skillId) === 3));
  assert.ok(!plan.some((p) => p.skillId === skillLevels[0].skillId));
});
