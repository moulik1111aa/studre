// The dragon map: the path never runs along the same edge twice, every turn is a
// right angle given by the paper-folding rule, chapters double, and the unfold animation
// starts folded and ends exactly on the next chapter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterOf, dragonPoints, FIRST_CHAPTER, levelMid, pow2AtLeast, turnAt, unfolding } from '../src/core/dragon.ts';

test('the dragon is a grid path that never repeats an edge', () => {
  const p = dragonPoints(2048);
  assert.ok(p.length >= 2049);
  const edges = new Set<string>();
  for (let i = 1; i <= 2048; i++) {
    const [ax, ay] = p[i - 1];
    const [bx, by] = p[i];
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, `segment ${i} is one grid step`);
    const key = ax < bx || (ax === bx && ay < by) ? `${ax},${ay}-${bx},${by}` : `${bx},${by}-${ax},${ay}`;
    assert.ok(!edges.has(key), `edge ${key} used twice`);
    edges.add(key);
  }
});

test('every corner turns by a right angle, as the paper-folding rule says', () => {
  const p = dragonPoints(1024);
  for (let n = 1; n < 1024; n++) {
    const a = [p[n][0] - p[n - 1][0], p[n][1] - p[n - 1][1]];
    const b = [p[n + 1][0] - p[n][0], p[n + 1][1] - p[n][1]];
    assert.equal(a[0] * b[1] - a[1] * b[0], turnAt(n), `corner ${n}`);
  }
});

test('growing the curve keeps every earlier point', () => {
  const small = dragonPoints(64).slice(0, 65).map((x) => x.join());
  const big = dragonPoints(512).slice(0, 65).map((x) => x.join());
  assert.deepEqual(big, small);
});

test('chapters: 8 levels, then the map doubles', () => {
  assert.equal(FIRST_CHAPTER, 8);
  assert.deepEqual(chapterOf(0), { no: 1, start: 1, end: 8 });
  assert.deepEqual(chapterOf(7), { no: 1, start: 1, end: 8 });
  assert.deepEqual(chapterOf(8), { no: 2, start: 9, end: 16 });
  assert.deepEqual(chapterOf(16), { no: 3, start: 17, end: 32 });
  assert.deepEqual(chapterOf(300), { no: 7, start: 257, end: 512 });
  assert.equal(pow2AtLeast(1681), 2048);
});

test('an unfold starts folded on itself and ends on the next chapter', () => {
  const from = 32;
  const shut = unfolding(from, 0);
  const open = unfolding(from, 1);
  const p = dragonPoints(64);
  for (let j = 0; j <= from; j++) assert.deepEqual(shut[from + j].map((v) => Math.round(v * 1e9) / 1e9), [...p[from - j]].map((v) => v + 0));
  for (let i = 0; i <= 2 * from; i++) assert.deepEqual(open[i].map((v) => Math.round(v)), [...p[i]]);
});

test('a level sits in the middle of its segment', () => {
  const p = dragonPoints(4);
  assert.deepEqual(levelMid(1), [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]);
});
