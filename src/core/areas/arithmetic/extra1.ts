// Stage 1 (ages 3–4): first measuring, shapes, position, time words and sorting.
// Every question is read aloud and answered by tapping a picture.

import { extraSkills, made } from './extra.ts';
import { PicLesson, withWays, pickN } from '../../teach/pics.ts';
import type { MathVisual, ShapeName } from '../../vis.ts';
import type { Rng } from '../../rng.ts';

const { list, add } = extraSkills(1, { format: 'picture', speedSec: 12 });
export const EXTRA1 = list;

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;

/** Sizes that are clearly different (more alike as d grows). */
function sizes(r: Rng, n: number, d: number): number[] {
  const gap = d < 0.5 ? 0.28 : 0.16;
  for (let t = 0; t < 200; t++) {
    const s = Array.from({ length: n }, () => Math.round((0.15 + r.next() * 0.85) * 100) / 100);
    const sorted = [...s].sort((a, b) => a - b);
    if (sorted.every((x, i) => i === 0 || x - sorted[i - 1] >= gap)) return s;
  }
  return n === 2 ? [0.3, 0.9] : [0.2, 0.55, 0.95];
}
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));
const argmin = (xs: number[]) => xs.indexOf(Math.min(...xs));

// ── Longer or shorter ─────────────────────────────────────────────────────
add('s1.same', 'longer', 'measure', 'Longer or shorter', (r, d) => {
  const n = d < 0.5 ? 2 : 3;
  const s = sizes(r, n, d);
  const cols = pickN(r, COLORS, n);
  const long = r.chance(0.5);
  const k = long ? argmax(s) : argmin(s);
  const word = n === 2 ? (long ? 'longer' : 'shorter') : long ? 'longest' : 'shortest';
  const name = (i: number) => `${cols[i]} pencil`;
  const items = s.map((size, i) => ({ size, color: cols[i] }));
  const options: Record<string, MathVisual> = {};
  items.forEach((it, i) => (options[name(i)] = { kind: 'compare', mode: 'long', items: [it] }));
  return made(`Which pencil is ${word}?`, name(k), items.map((_, i) => name(i)).filter((x) => x !== name(k)), {
    visual: { kind: 'compare', mode: 'long', items },
    options,
    hint: 'Line them up at one end, then look at the other end.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'compare', mode: 'long', items, tip: k });
      L.say('Line the pencils up at the same start.');
      L.show({ kind: 'compare', mode: 'long', items: items.map((it, i) => ({ ...it, hl: i === k })), tip: k });
      L.say(long ? `Now look at the other end. The ${name(k)} goes furthest.` : `Now look at the other end. The ${name(k)} stops first.`);
      return L.end(name(k), `So the ${word} one is the ${name(k)}.`);
    },
  });
});

// ── Big, small, tall, short ───────────────────────────────────────────────
add('s1.longer', 'tallbig', 'measure', 'Big, small, tall, short', (r, d) => {
  const n = 3;
  const s = sizes(r, n, d);
  const trees = r.chance(0.5);
  const cols = trees ? pickN(r, ['green', 'orange', 'pink', 'teal'], n) : pickN(r, COLORS, n);
  const most = r.chance(0.5);
  const k = most ? argmax(s) : argmin(s);
  const thing = trees ? 'tree' : 'ball';
  const word = trees ? (most ? 'tallest' : 'shortest') : most ? 'biggest' : 'smallest';
  const name = (i: number) => `${cols[i]} ${thing}`;
  const items = s.map((size, i) => ({ size, color: cols[i] }));
  const mode = trees ? 'tall' : 'big';
  const options: Record<string, MathVisual> = {};
  items.forEach((it, i) => (options[name(i)] = { kind: 'compare', mode, items: [it] }));
  return made(`Tap the ${word} ${thing}.`, name(k), items.map((_, i) => name(i)).filter((x) => x !== name(k)), {
    visual: { kind: 'compare', mode, items },
    options,
    hint: trees ? 'Stand them on the same ground and look at the tops.' : 'Look at how much room each one takes.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'compare', mode, items });
      L.say(trees ? 'All the trees stand on the same ground. Look at the tops.' : 'Look at each ball. Which takes up the most room?');
      L.show({ kind: 'compare', mode, items: items.map((it, i) => ({ ...it, hl: i === k })) });
      L.say(trees ? (most ? `The ${name(k)} reaches highest.` : `The ${name(k)} is the lowest.`) : most ? `The ${name(k)} is the biggest round.` : `The ${name(k)} is the tiniest.`);
      return L.end(name(k), `So the ${word} is the ${name(k)}.`);
    },
  });
});

// ── Heavier or lighter ────────────────────────────────────────────────────
const WEIGHTS: [string, string, number][] = [
  ['ant', '🐜', 1], ['mouse', '🐭', 2], ['bird', '🐦', 3], ['cat', '🐱', 4], ['dog', '🐶', 5], ['sheep', '🐑', 6], ['horse', '🐴', 7], ['cow', '🐄', 8], ['elephant', '🐘', 9],
];
add('s1.tallbig', 'heavier', 'measure', 'Heavier or lighter', (r, d) => {
  const gap = d < 0.5 ? 4 : 1;
  let a = r.pick(WEIGHTS);
  let b = r.pick(WEIGHTS);
  for (let t = 0; t < 50 && Math.abs(a[2] - b[2]) < gap; t++) [a, b] = [r.pick(WEIGHTS), r.pick(WEIGHTS)];
  if (a[2] === b[2]) b = WEIGHTS[(WEIGHTS.indexOf(a) + 3) % WEIGHTS.length];
  const heavy = r.chance(0.5);
  const ans = (heavy ? a[2] > b[2] : a[2] < b[2]) ? a : b;
  const other = ans === a ? b : a;
  const big = a[2] > b[2] ? a : b;
  // Always on a balance: the child reads which way it tips (not what they know about animals).
  const v: MathVisual = { kind: 'seesaw', left: a[1], right: b[1], tip: a[2] > b[2] ? -1 : 1 };
  return made(`Look at the see-saw. Which is ${heavy ? 'heavier' : 'lighter'}: the ${a[0]} or the ${b[0]}?`, ans[0], [other[0]], {
    visual: v,
    options: { [a[0]]: { kind: 'emoji', e: a[1] }, [b[0]]: { kind: 'emoji', e: b[1] } },
    hint: 'On a see-saw, the heavier side goes down.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'seesaw', left: a[1], right: b[1], tip: 0 });
      L.say(`The ${a[0]} and the ${b[0]} sit on a see-saw.`);
      L.show({ kind: 'seesaw', left: a[1], right: b[1], tip: a[2] > b[2] ? -1 : 1 });
      L.say(`The heavier side goes down: the ${big[0]} is heavier.`);
      return L.end(ans[0], heavy ? `So the heavier one is the ${ans[0]}.` : `The side that goes up is lighter. So the lighter one is the ${ans[0]}.`);
    },
  });
});

// ── Holds more ────────────────────────────────────────────────────────────
add('s1.heavier', 'holds', 'measure', 'Holds more', (r, d) => {
  const n = d < 0.5 ? 2 : 3;
  const s = sizes(r, n, d);
  const cols = pickN(r, ['blue', 'pink', 'orange', 'green', 'purple'], n);
  const more = r.chance(0.6);
  const k = more ? argmax(s) : argmin(s);
  const name = (i: number) => `${cols[i]} jar`;
  const items = s.map((size, i) => ({ size, color: cols[i] }));
  const options: Record<string, MathVisual> = {};
  items.forEach((it, i) => (options[name(i)] = { kind: 'compare', mode: 'holds', items: [it] }));
  const word = n === 2 ? (more ? 'more' : 'less') : more ? 'the most' : 'the least';
  return made(`Which jar holds ${word} water?`, name(k), items.map((_, i) => name(i)).filter((x) => x !== name(k)), {
    visual: { kind: 'compare', mode: 'holds', items },
    options,
    hint: 'A wider and taller jar holds more.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'compare', mode: 'holds', items });
      L.say('Fill every jar with water.');
      L.show({ kind: 'compare', mode: 'holds', items: items.map((it, i) => ({ ...it, hl: i === k })) });
      L.say(more ? `The ${name(k)} is the widest and tallest, so it fits the most water.` : `The ${name(k)} is the smallest, so it fits the least water.`);
      return L.end(name(k), `So the ${name(k)} holds ${word}.`);
    },
  });
});

// ── Shapes ────────────────────────────────────────────────────────────────
const FLAT: [ShapeName, string, string][] = [
  ['circle', 'round all the way, no corners', 'yellow'], ['square', '4 sides all the same, 4 corners', 'blue'], ['triangle', '3 sides and 3 corners', 'pink'], ['rectangle', '4 sides, 2 long and 2 short', 'green'],
  ['star', '5 points', 'orange'], ['heart', 'two bumps at the top and a point at the bottom', 'red'], ['oval', 'round like a stretched circle, an egg shape', 'purple'], ['hexagon', '6 sides, like a honeycomb', 'teal'],
];
add('s1.pattern', 'shapename', 'shape', 'Name the shape', (r, d) => {
  const pool = d < 0.5 ? FLAT.slice(0, 4) : FLAT;
  const [ans, ...rest] = pickN(r, pool, 3);
  const options: Record<string, MathVisual> = {};
  for (const [s, , c] of [ans, ...rest]) options[s] = { kind: 'shape', shape: s, color: c };
  return made(`Tap the ${ans[0]}.`, ans[0], rest.map((x) => x[0]), {
    options,
    hint: `A ${ans[0]} has ${ans[1]}.`,
    teach: () => {
      const L = new PicLesson();
      const pts = ['circle', 'oval', 'heart'].includes(ans[0]);
      L.show({ kind: 'shape', shape: ans[0], color: ans[2], ...(pts ? {} : { sides: true }) });
      L.say(`A ${ans[0]} has ${ans[1]}.`);
      if (!pts && ans[0] !== 'star') {
        L.show({ kind: 'shape', shape: ans[0], color: ans[2], corners: true });
        L.say('Touch each corner.');
      }
      return L.end(ans[0], `This is the ${ans[0]}.`);
    },
  });
});

const ROUND: [string, string][] = [['cookie', '🍪'], ['ball', '⚽'], ['moon', '🌕'], ['orange', '🍊'], ['doughnut', '🍩'], ['coin', '🪙']];
const TRI: [string, string][] = [['pizza slice', '🍕'], ['tent', '⛺'], ['cone sign', '🔺']];
const BOXY: [string, string][] = [['gift box', '🎁'], ['book', '📘'], ['phone', '📱'], ['door', '🚪'], ['TV', '📺'], ['window', '🪟']];
add('s1.shapename', 'shapesaround', 'shape', 'Shapes around us', (r) => {
  const which = r.int(0, 2);
  const [group, word, others] = which === 0 ? [ROUND, 'round like a roti', [TRI, BOXY]] : which === 1 ? [TRI, 'shaped like a triangle', [ROUND, BOXY]] : [BOXY, 'shaped like a rectangle', [ROUND, TRI]];
  const ans = r.pick(group);
  const w1 = r.pick(others[0]);
  const w2 = r.pick(others[1]);
  const options: Record<string, MathVisual> = {};
  for (const [n, e] of [ans, w1, w2]) options[n] = { kind: 'emoji', e };
  const shape: ShapeName = which === 0 ? 'circle' : which === 1 ? 'triangle' : 'rectangle';
  return made(`Which one is ${word}?`, ans[0], [w1[0], w2[0]], {
    options,
    hint: `Look for the ${shape} shape.`,
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'shape', shape, color: 'yellow', ...(which === 0 ? {} : { corners: true }) });
      L.say(which === 0 ? 'Round things have no corners.' : which === 1 ? 'A triangle has 3 corners.' : 'A rectangle has 4 corners and straight sides.');
      L.show({ kind: 'pair', a: { kind: 'emoji', e: ans[1], big: true }, b: { kind: 'shape', shape, color: 'yellow' }, op: '=' });
      L.say(`The ${ans[0]} has that shape.`);
      return L.end(ans[0], `So the answer is the ${ans[0]}.`);
    },
  });
});

// ── Sort and count ────────────────────────────────────────────────────────
const SORT_SHAPES: ShapeName[] = ['circle', 'triangle', 'square', 'star'];
const SORT_COLORS = ['red', 'blue', 'yellow', 'green'] as const;
const plural = (s: string) => `${s}s`;
add('s1.match10', 'sortcount', 'data', 'Sort and count', (r, d) => {
  const kinds = pickN(r, SORT_SHAPES, d < 0.5 ? 2 : 3);
  const cols = pickN(r, SORT_COLORS, 2);
  const counts = kinds.map(() => r.int(1, d < 0.5 ? 4 : 5));
  for (let t = 0; t < 20 && new Set(counts).size < counts.length; t++) counts.forEach((_, i) => (counts[i] = r.int(1, d < 0.5 ? 4 : 5)));
  const items = r.shuffle(kinds.flatMap((shape, i) => Array.from({ length: counts[i] }, (_, k) => ({ shape, color: cols[(i + k) % 2] }))));
  const groups = kinds.map((shape, i) => ({ label: plural(shape), items: items.filter((x) => x.shape === shape) }));
  const mixed: MathVisual = { kind: 'shapes', items };
  const sorted: MathVisual = { kind: 'sort', groups };
  const sortSteps = (L: PicLesson) => {
    L.show(mixed);
    L.say('Sort them first: put the same shapes together.');
    L.show(sorted);
    L.say('Now count each group.', groups.map((g) => `${g.label}: ${g.items.length}`).join(', '));
  };
  if (d >= 0.5 && r.chance(0.4)) {
    // Sort by colour instead.
    const byCol = cols.map((c) => ({ label: c, items: items.filter((x) => x.color === c) }));
    const c = r.int(0, 1);
    const n = byCol[c].items.length;
    return made(`How many ${cols[c]} shapes are there?`, n, [n + 1, Math.max(0, n - 1), items.length].filter((x) => x !== n), {
      visual: mixed,
      hint: 'Sort them by colour, then count.',
      teach: () => {
        const L = new PicLesson();
        L.show(mixed);
        L.say('This time sort by colour.');
        L.show({ kind: 'sort', groups: byCol });
        L.say(`Count the ${cols[c]} group.`, Array.from({ length: n }, (_, i) => i + 1).join(', '));
        return L.end(n, `So there are ${n} ${cols[c]} shapes.`);
      },
    });
  }
  if (r.chance(0.6)) {
    const i = r.int(0, kinds.length - 1);
    const n = counts[i];
    return made(`How many ${plural(kinds[i])} are there?`, n, [n + 1, Math.max(0, n - 1), items.length].filter((x) => x !== n), {
      visual: mixed,
      hint: 'Put the same shapes together, then count.',
      teach: () => {
        const L = new PicLesson();
        sortSteps(L);
        return L.end(n, `So there are ${n} ${plural(kinds[i])}.`);
      },
    });
  }
  const [x, y] = pickN(r, kinds.map((_, k) => k), 2);
  const more = counts[x] > counts[y] ? x : y;
  const options: Record<string, MathVisual> = { [plural(kinds[x])]: { kind: 'shape', shape: kinds[x], color: 'yellow' }, [plural(kinds[y])]: { kind: 'shape', shape: kinds[y], color: 'yellow' } };
  return made(`Are there more ${plural(kinds[x])} or ${plural(kinds[y])}?`, plural(kinds[more]), [plural(kinds[more === x ? y : x])], {
    visual: mixed,
    options,
    hint: 'Sort them into groups and compare the groups.',
    teach: () => {
      const L = new PicLesson();
      sortSteps(L);
      L.say(`${counts[more]} is more than ${counts[more === x ? y : x]}.`);
      return L.end(plural(kinds[more]), `So there are more ${plural(kinds[more])}.`);
    },
  });
});

void withWays;
