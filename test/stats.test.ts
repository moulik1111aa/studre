// Report statistics: the play log, undo, streaks, week figures, strengths and path progress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAnswer, logPlay, unlog, streaks, spanFigures, strengths, pathProgress, timeOfDay, bestDay, LOG_MAX, type PlayEntry, type StatsHolder, type Tally } from '../src/core/stats.ts';
import { buildPath, freshProgress } from '../src/core/path.ts';
import { AREAS } from '../src/core/areas/index.ts';

const entry = (t: number, d: string, a: Tally, extra: Partial<PlayEntry> = {}): PlayEntry => ({ t, d, id: 's3.x2#1', k: 'skill', st: 3, tier: 1, sc: 8, of: 10, s: 2, sec: 120, c: 10, a, ...extra });

test('answers add up per skill, and undo takes them back out', () => {
  const c: StatsHolder = {};
  const a: Tally = {};
  addAnswer(a, 's3.x2', true, 2000);
  addAnswer(a, 's3.x2', false, 4000);
  addAnswer(a, 's3.x5', true, 1000);
  logPlay(c, entry(1000, '2026-10-20', a));
  const b: Tally = {};
  addAnswer(b, 's3.x2', true, 3000);
  logPlay(c, entry(5000, '2026-10-21', b));
  assert.deepEqual(c.tally!['s3.x2'], [3, 2, 9000]);
  unlog(c, 5000);
  assert.equal(c.log!.length, 1);
  assert.deepEqual(c.tally!['s3.x2'], [2, 1, 6000]);
  unlog(c, 0);
  assert.deepEqual(c.tally, {});
});

test('a very long thought counts as two minutes at most', () => {
  const a: Tally = {};
  addAnswer(a, 'x', true, 10 * 60_000);
  assert.equal(a.x[2], 120_000);
});

test('the log keeps the newest entries when it is full', () => {
  const c: StatsHolder = {};
  for (let i = 0; i < LOG_MAX + 5; i++) logPlay(c, entry(i, '2026-10-20', {}));
  assert.equal(c.log!.length, LOG_MAX);
  assert.equal(c.log![0].t, 5);
});

test('streaks: current run up to today or yesterday, and the best ever', () => {
  const s = { '2026-10-01': 60, '2026-10-02': 60, '2026-10-03': 60, '2026-10-10': 60, '2026-10-11': 60, '2026-10-12': 0 };
  assert.deepEqual(streaks(s, '2026-10-12'), { current: 2, best: 3 });
  assert.deepEqual(streaks(s, '2026-10-13'), { current: 0, best: 3 });
  assert.deepEqual(streaks({}, '2026-10-13'), { current: 0, best: 0 });
});

test('week figures: minutes from play time, answers and levels from the log', () => {
  const a: Tally = { 's3.x2': [10, 8, 20000] };
  const log = [entry(1, '2026-10-20', a), entry(2, '2026-10-14', a), entry(3, '2026-10-13', a)];
  const secs = { '2026-10-20': 600, '2026-10-14': 300, '2026-10-13': 120 };
  const week = spanFigures(secs, log, '2026-10-20', 7);
  assert.deepEqual(week, { minutes: 15, answers: 20, right: 16, levels: 2, activeDays: 2 });
});

test('strengths are 80%+ right, practice is below, and both need enough answers', () => {
  const t: Tally = { a: [20, 20, 1], b: [20, 10, 1], c: [3, 0, 1], d: [10, 9, 1], e: [10, 5, 1] };
  const { best, practise } = strengths(t);
  assert.deepEqual(best.map((s) => s.id), ['a', 'd']);
  assert.deepEqual(practise.map((s) => s.id), ['b', 'e']);
});

test('path progress counts passed levels per stage and tier, and stars', () => {
  const path = buildPath(AREAS[0]);
  const p = freshProgress();
  p.levels[path[0].id] = { stars: 3, passes: 1 };
  p.levels[path[1].id] = { stars: 1, passes: 1 };
  const r = pathProgress(path, p);
  assert.equal(r.stages[0].passed, 2);
  assert.equal(r.stars, 4);
  assert.equal(r.tiers[0] + r.tiers[1], 2);
  assert.equal(r.maxStars, path.length * 3);
});

test('time of day and best day', () => {
  const at = (h: number) => new Date(2026, 9, 20, h).getTime();
  const tod = timeOfDay([entry(at(8), 'x', {}), entry(at(15), 'x', {}), entry(at(19), 'x', {}), entry(at(23), 'x', {}), entry(at(9), 'x', {})]);
  assert.deepEqual(tod.map((x) => x.levels), [2, 1, 1, 1]);
  assert.deepEqual(bestDay({ a: 60, b: 1800, c: 0 }), { day: 'b', minutes: 30 });
  assert.equal(bestDay({}), null);
});
