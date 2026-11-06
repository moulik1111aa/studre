// The new branches (Measure, Shapes, Data and the extra Numbers/Algebra skills): each answer is
// worked out a second, independent way from the question's own picture or words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillById } from '../src/core/areas/index.ts';
import { EXTRAS } from '../src/core/areas/arithmetic/index.ts';
import { createRng } from '../src/core/rng.ts';
import { buildChoices, valueOf, type Made } from '../src/core/question.ts';
import type { MathVisual } from '../src/core/vis.ts';
import { branchOf } from '../src/core/branches.ts';
import { catchUp, ROAD_VERSION } from '../src/core/catchup.ts';
import { buildPath, frontier } from '../src/core/path.ts';
import { AREAS } from '../src/core/areas/index.ts';
import { newChild } from '../src/storage/save.ts';

const SEEDS = 200;
const each = (id: string, fn: (q: Made, ctx: string) => void) => {
  const s = skillById(id);
  assert.ok(s, `no skill ${id}`);
  for (let i = 0; i < SEEDS; i++) for (const d of [0, 0.5, 1]) {
    const q = s!.make(createRng(`${id}:${i}:${d}`), d);
    fn(q, `${id} #${i} d${d}: "${q.prompt}" → ${q.answer}`);
  }
};
const vis = <K extends MathVisual['kind']>(q: Made, kind: K) => q.visual as Extract<MathVisual, { kind: K }>;
const numsIn = (s: string) => (s.replace(/−/g, '-').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const fr = (n: number, d: number) => (d / gcd(n, d) === 1 ? `${n / gcd(n, d)}` : `${n / gcd(n, d)}/${d / gcd(n, d)}`);

test('every new skill: options with pictures have one per choice, and the branch is not Numbers by mistake', () => {
  for (const { skill } of EXTRAS) {
    for (let i = 0; i < 60; i++) {
      const q = skill.make(createRng(`${skill.id}:${i}`), i % 3 / 2);
      const choices = buildChoices(createRng(i), q.answer, q.distractors, skill.format === 'picture' ? 3 : 4);
      if (q.optionVisuals) for (const c of choices) assert.ok(q.optionVisuals[c], `${skill.id}: no picture for option "${c}" in "${q.prompt}"`);
      assert.ok(q.teach, `${skill.id}: no lesson`);
    }
    if (['measure', 'shape', 'data'].includes(skill.strand)) assert.notEqual(branchOf(skill.strand), 'num');
  }
  assert.ok(EXTRAS.length >= 100, `only ${EXTRAS.length} new skills`);
});

test('clocks: the time read from the hands', () => {
  for (const id of ['s3.clock5', 's3.clockmin']) each(id, (q, ctx) => {
    const c = vis(q, 'clock');
    assert.ok(q.answer.startsWith(`${c.h}:${String(c.m).padStart(2, '0')}`), ctx);
  });
  each('s2.oclock', (q, ctx) => {
    const c = vis(q, 'clock');
    assert.equal(q.answer, c.m === 0 ? `${c.h} o'clock` : `half past ${c.h}`, ctx);
  });
});

test('rulers, cubes, tallies, scales and area squares', () => {
  each('s2.ruler', (q, ctx) => { const v = vis(q, 'ruler'); assert.equal(Number(q.answer), v.items[0].to - v.items[0].from, ctx); });
  each('s2.longerby', (q, ctx) => { const v = vis(q, 'ruler'); assert.equal(Number(q.answer), Math.abs(v.items[0].to - v.items[1].to), ctx); });
  each('s2.mcubes', (q, ctx) => assert.equal(Number(q.answer), vis(q, 'cubes').len, ctx));
  each('s2.tally', (q, ctx) => assert.equal(Number(q.answer), vis(q, 'tally').n, ctx));
  each('s3.readscale', (q, ctx) => assert.equal(Number(q.answer), vis(q, 'scale').value, ctx));
  each('s3.areasq', (q, ctx) => assert.equal(Number(q.answer), vis(q, 'cells').on.length, ctx));
  each('s3.perim', (q, ctx) => assert.equal(Number(q.answer), (vis(q, 'poly').labels ?? []).reduce((s, l) => s + Number(l), 0), ctx));
  each('s4.volcubes', (q, ctx) => { const v = vis(q, 'cuboid'); assert.equal(Number(q.answer), v.l * v.b * v.h, ctx); });
  each('s4.protractor', (q, ctx) => assert.equal(Number(q.answer), vis(q, 'protractor').deg, ctx));
});

test('L-shapes: area counted square by square', () => {
  each('s4.lshape', (q, ctx) => {
    const pts = vis(q, 'poly').pts;
    // Shoelace formula.
    let a = 0;
    for (let i = 0; i < pts.length; i++) a += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1];
    assert.equal(Number(q.answer), Math.abs(a) / 2, ctx);
  });
});

test('units, time units and map scale from the words', () => {
  const k: Record<string, number> = { 'm-cm': 100, 'kg-g': 1000, 'l-ml': 1000, 'km-m': 1000, 'cm-mm': 10, 'min-s': 60, 'h-min': 60, 'day-h': 24, 'weeks-days': 7, 'years-months': 12 };
  each('s3.units', (q, ctx) => {
    const m = /^(\d+) (\w+)(?: (\d+) (\w+))? = \? (\w+)$/.exec(q.prompt)!;
    assert.ok(m, ctx);
    const [, a, u1, b, , u2] = m;
    if (k[`${u1}-${u2}`]) assert.equal(Number(q.answer), Number(a) * k[`${u1}-${u2}`] + Number(b ?? 0), ctx);
    else assert.equal(Number(q.answer) * k[`${u2}-${u1}`], Number(a), ctx);
  });
  each('s4.hms', (q, ctx) => {
    const [, a, u1, b, u2] = /^(\d+) (\w+) (\d+) (\w+) = \?/.exec(q.prompt)!;
    assert.equal(Number(q.answer), Number(a) * k[`${u1}-${u2}`] + Number(b), ctx);
  });
  each('s4.mapscale', (q, ctx) => { const [, k1, cm] = numsIn(q.prompt); assert.equal(Number(q.answer), k1 * cm, ctx); });
  each('s6.kmhms', (q, ctx) => { const [x] = numsIn(q.prompt); assert.equal(Number(q.answer), q.prompt.includes('km/h =') ? (x * 5) / 18 : (x * 18) / 5, ctx); });
});

test('days and the calendar', () => {
  const D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  each('s2.calendar', (q, ctx) => {
    const t = D.findIndex((x) => q.prompt.includes(`Today is ${x}`));
    const [n] = numsIn(q.prompt);
    assert.equal(q.answer, D[(t + n) % 7], ctx);
  });
  each('s3.monthdays', (q, ctx) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const m = months.findIndex((x) => q.prompt.includes(x));
    const y = numsIn(q.prompt)[0] ?? 2027;
    assert.equal(Number(q.answer), new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), ctx);
  });
});

test('geometry: angles, Pythagoras, Heron, polygons, circles', () => {
  each('s4.angline', (q, ctx) => {
    const g = vis(q, 'geo');
    const known = (g.arcs ?? []).filter((a) => !a.ask).map((a) => Number(a.label!.replace('°', '')));
    assert.equal(Number(q.answer), (known.length === 2 ? 360 : 180) - known.reduce((a, b) => a + b, 0), ctx);
  });
  each('s5.triang', (q, ctx) => {
    const known = (vis(q, 'geo').arcs ?? []).filter((a) => !a.ask).map((a) => Number(a.label!.replace('°', '')));
    assert.equal(Number(q.answer), 180 - known[0] - known[1], ctx);
  });
  each('s6.pythag', (q, ctx) => {
    const [a, b] = numsIn(q.prompt);
    const x = Number(q.answer);
    assert.ok(q.prompt.includes('longest side of') ? a * a === b * b + x * x : a * a + b * b === x * x, ctx);
  });
  each('s6.heron', (q, ctx) => {
    const [a, b, c] = numsIn(q.prompt);
    const s = (a + b + c) / 2;
    assert.ok(Math.abs(Number(q.answer) - Math.sqrt(s * (s - a) * (s - b) * (s - c))) < 1e-9, ctx);
  });
  each('s5.polyang', (q, ctx) => {
    const n = numsIn(q.prompt)[0];
    assert.equal(Number(q.answer), q.prompt.includes('each') ? ((n - 2) * 180) / n : (n - 2) * 180, ctx);
  });
  each('s6.circarea', (q, ctx) => {
    const r = numsIn(q.prompt).at(-1)!;
    const area = (22 / 7) * r * r;
    assert.ok(Math.abs(Number(q.answer) - (q.prompt.includes('semicircle') ? area / 2 : area)) < 1e-9, ctx);
  });
  each('s7.tangents', (q, ctx) => { const [r, d] = numsIn(q.prompt); assert.equal(Number(q.answer) ** 2, d * d - r * r, ctx); });
  each('s7.distance', (q, ctx) => {
    const [x1, y1, x2, y2] = numsIn(q.prompt);
    if (q.prompt.startsWith('Find the midpoint')) assert.equal(q.answer, `(${String((x1 + x2) / 2).replace('-', '−')}, ${String((y1 + y2) / 2).replace('-', '−')})`, ctx);
    else assert.equal(Number(q.answer), Math.hypot(x2 - x1, y2 - y1), ctx);
  });
});

test('data and chance', () => {
  each('s5.mmr', (q, ctx) => {
    const xs = numsIn(q.prompt.split(':')[1]).sort((a, b) => a - b);
    const n = xs.length;
    const want = q.prompt.includes('median') ? (n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2) : q.prompt.includes('range') ? xs[n - 1] - xs[0] : xs.find((x) => xs.filter((y) => y === x).length > 1);
    assert.equal(valueOf(q.answer), want, ctx);
  });
  each('s5.prob', (q, ctx) => { const [k, rest] = numsIn(q.prompt); assert.equal(q.answer, fr(k, k + rest), ctx); });
  each('s5.pie', (q, ctx) => { const [total, deg] = numsIn(q.prompt); assert.equal(Number(q.answer), (deg / 360) * total, ctx); });
  each('s2.picgraph', (q, ctx) => {
    const rows = vis(q, 'picgraph').rows;
    const by = (l: string) => rows.find((r) => q.prompt.includes(r.label) && r.label === l);
    if (q.prompt.startsWith('How many children were')) assert.equal(Number(q.answer), rows.reduce((s, r) => s + r.n, 0), ctx);
    else if (q.prompt.includes('more')) {
      const [a, b] = rows.filter((r) => q.prompt.includes(r.label)).sort((x, y) => q.prompt.indexOf(x.label) - q.prompt.indexOf(y.label));
      assert.equal(Number(q.answer), a.n - b.n, ctx);
    } else assert.equal(Number(q.answer), rows.find((r) => q.prompt.includes(r.label))!.n, ctx);
    void by;
  });
  each('s3.barscale', (q, ctx) => {
    const bars = vis(q, 'bars').bars;
    const named = bars.filter((b) => q.prompt.includes(b.label)).sort((x, y) => q.prompt.indexOf(x.label) - q.prompt.indexOf(y.label));
    assert.equal(Number(q.answer), named.length === 2 ? named[0].v - named[1].v : named[0].v, ctx);
  });
  each('s4.likely', (q, ctx) => {
    const balls = vis(q, 'bag').balls;
    const col = /to be (\w+)\?/.exec(q.prompt)![1];
    const k = balls.filter((b) => b === col).length;
    assert.equal(q.answer, k === 0 ? 'impossible' : k === balls.length ? 'certain' : 2 * k === balls.length ? 'even chance' : 2 * k < balls.length ? 'unlikely' : 'likely', ctx);
  });
  each('s6.freqmean', (q, ctx) => {
    const rows = vis(q, 'table').rows.map((r) => r.map(Number));
    assert.equal(Number(q.answer), rows.reduce((s, [x, f]) => s + x * f, 0) / rows.reduce((s, [, f]) => s + f, 0), ctx);
  });
});

test('algebra: progressions, roots, zeros, matchsticks', () => {
  each('s7.ap', (q, ctx) => {
    const t = numsIn(q.prompt.split('of ').slice(-1)[0]);
    const n = numsIn(q.prompt)[0];
    const [a, b] = q.prompt.startsWith('Find the sum') ? [t[0], t[1]] : [t[0], t[1]];
    const d = b - a;
    const nth = a + (n - 1) * d;
    assert.equal(Number(q.answer), q.prompt.startsWith('Find the sum') ? (n * (a + nth)) / 2 : nth, ctx);
  });
  each('s5.matchstick', (q, ctx) => {
    const n = numsIn(q.prompt);
    const [s1, s2, k] = [n[1], n[3], n[6]];
    assert.equal(Number(q.answer), s1 + (s2 - s1) * (k - 1), ctx);
  });
});

test('new skills never send a child back: catch-up skips new stops behind them', () => {
  const path = buildPath(AREAS[0]);
  const c = newChild('Test', 10, 0, '2026-11-06');
  // Pretend the child passed every Numbers level of stages 1–4 (as if before the new branches).
  const extraIds = new Set(EXTRAS.map((x) => x.skill.id));
  const stage5 = path.findIndex((l) => l.stage === 5);
  for (const l of path.slice(0, stage5)) if (l.kind === 'skill' && !extraIds.has(l.skillId)) c.progress.levels[l.id] = { stars: 3, passes: 1 };
  c.progress.levels[path[stage5].id] = { stars: 3, passes: 1 };
  assert.ok(frontier(path, c.progress) < stage5, 'before catch-up the new stops are in the way');
  catchUp(c, path);
  assert.equal(c.roadV, ROAD_VERSION);
  assert.ok(frontier(path, c.progress) > stage5, 'after catch-up the child carries on where they were');
});
