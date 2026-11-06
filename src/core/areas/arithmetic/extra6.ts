// Stage 6 (ages 13–14): Pythagoras, quadrilateral facts, circle area, surface area, cylinder
// volume, Heron's formula, straight-line graphs, angles in circles, mean from a frequency
// table, two events, similar shapes, km/h and m/s.

import { extraSkills, made } from './extra.ts';
import { PicLesson, withWays, pickN } from '../../teach/pics.ts';
import { frac, nearNumbers, num } from '../../question.ts';
import type { MathVisual, Pt } from '../../vis.ts';
import type { Rng } from '../../rng.ts';
import type { Lesson } from '../../teach/types.ts';

const { list, add } = extraSkills(6, { format: 'pad', speedSec: 40 });
export const EXTRA6 = list;

const nums = (r: Rng, a: number, extra: number[] = []) => nearNumbers(r, a, extra, { min: 0 });
const rad = (d: number) => (d * Math.PI) / 180;
export const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29], [9, 40, 41], [12, 16, 20], [15, 20, 25]];

/** A right triangle (right angle at the bottom left) with side labels. */
export function rightTri(a: number, b: number, la: string, lb: string, lc: string, extra: Partial<Extract<MathVisual, { kind: 'geo' }>> = {}): MathVisual {
  const s = Math.min(9 / b, 6 / a);
  const A: Pt = [0.5, 0.5], B: Pt = [0.5 + b * s, 0.5], C: Pt = [0.5, 0.5 + a * s];
  return { kind: 'geo', w: b * s + 2, h: a * s + 1.2, segs: [{ a: A, b: B }, { a: B, b: C }, { a: C, b: A }], arcs: [{ at: A, a0: 0, a1: 90, right: true }], labels: [{ at: [0.5 + (b * s) / 2, -0.15], t: lb }, { at: [-0.35, 0.5 + (a * s) / 2], t: la }, { at: [0.9 + (b * s) / 2, 0.9 + (a * s) / 2], t: lc }], ...extra };
}

// ── Pythagoras ────────────────────────────────────────────────────────────
add('s6.cbrt', 'pythag', 'shape', 'Pythagoras', (r, d) => {
  const [a, b, c] = r.pick(d < 0.5 ? TRIPLES.slice(0, 5) : TRIPLES);
  const leg = d >= 0.5 && r.chance(0.5);
  if (leg) {
    const v = rightTri(a, b, `${a}`, '?', `${c}`);
    return made(`A right triangle has a longest side of ${c} cm and one short side of ${a} cm. How long is the other short side? (cm)`, b, nums(r, b, [c - a, Math.round(Math.sqrt(c * c + a * a))]), {
      visual: v,
      hint: 'a² + b² = c², so b² = c² − a².',
      teach: () => {
        const L = new PicLesson();
        L.show(v);
        L.say('The longest side (hypotenuse) is opposite the right angle. The two squares on the short sides fill the square on the longest side.');
        L.say('So the missing short side squared is the longest squared take away the other short side squared.', `${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b}`);
        L.say('Square root:', `√${b * b} = ${b}`);
        return L.end(b, `So the other side is ${b} cm.`);
      },
    });
  }
  const v = rightTri(a, b, `${a}`, `${b}`, '?');
  const squares = (): Lesson => {
    const L = new PicLesson();
    L.show(v);
    L.say('Build a square on each side: the two small squares together fill the big one.', `${a}² + ${b}² = c²`);
    L.say('Work out the squares and add.', `${a * a} + ${b * b} = ${c * c}`);
    L.say('Square root to undo the square.', `√${c * c} = ${c}`);
    return L.end(c, `So the longest side is ${c} cm.`);
  };
  const triple = (): Lesson => {
    const L = new PicLesson();
    L.show({ kind: 'table', head: ['triple', `× k`, 'sides'], rows: TRIPLES.slice(0, 4).map((t) => { const k = a / t[0]; const ok = Number.isInteger(k) && b === k * t[1]; return [t.join(', '), ok ? `× ${k}` : '', ok ? `${a}, ${b}, ${c}` : '']; }), hl: TRIPLES.slice(0, 4).flatMap((t, i) => (a / t[0] === b / t[1] && Number.isInteger(a / t[0]) ? [[i, 2] as [number, number]] : [])) });
    const base = TRIPLES.find(([x, y, z]) => a % x === 0 && b % y === 0 && c % z === 0 && a / x === b / y && b / y === c / z && x < a)
      ?? null;
    if (base) {
      const k = a / base[0];
      L.say(`${a} and ${b} are ${k} × ${base[0]} and ${k} × ${base[1]}: the ${base.join('-')} triangle made ${k} times bigger.`, `${k} × ${base[2]} = ${c}`);
    } else L.say(`${a}, ${b}, ${c} is a Pythagorean triple worth remembering.`, `${a}² + ${b}² = ${c * c} = ${c}²`);
    return L.end(c, `So the longest side is ${c} cm.`);
  };
  return made(`A right triangle has short sides of ${a} cm and ${b} cm. How long is the longest side? (cm)`, c, nums(r, c, [a + b, a * a + b * b]), {
    visual: v,
    hint: 'a² + b² = c².',
    teach: () => withWays(squares(), 'Squares on the sides', 'pythag', [['Spot the triple', triple]]),
  });
});

add('s6.ineq', 'quadfacts', 'shape', 'Quadrilateral facts', (r) => {
  const a = 5 * r.int(9, 26);
  const kind = r.int(0, 2);
  const sl = 2.2 / Math.tan(rad(a > 90 ? 180 - a : a));
  const P: Pt[] = a < 90 ? [[0.5, 0.5], [7, 0.5], [7 + sl, 3], [0.5 + sl, 3]] : [[0.5 + sl, 0.5], [7 + sl, 0.5], [7, 3], [0.5, 3]];
  const segs = P.map((p, i) => ({ a: p, b: P[(i + 1) % 4], par: i % 2 ? 2 : 1 }));
  if (kind === 2) {
    return made('In a rhombus, at what angle do the two diagonals cross? (degrees)', 90, [45, 60, 180], {
      visual: { kind: 'shape', shape: 'rhombus', color: 'teal' },
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'shape', shape: 'rhombus', color: 'teal', fold: 'v' });
        L.say('A rhombus has 4 equal sides, so each diagonal is a line of symmetry: it folds onto itself.');
        L.say('The diagonals cut each other in half at right angles.');
        return L.end(90, 'So they cross at 90°.');
      },
    });
  }
  const x = kind === 0 ? 180 - a : a;
  const v: MathVisual = { kind: 'geo', w: 8 + sl, h: 3.6, segs, arcs: [{ at: P[0], a0: 0, a1: a, label: `${a}°`, r: 0.6 }, kind === 0 ? { at: P[1], a0: a, a1: 180, label: 'x', ask: true, r: 0.6 } : { at: P[2], a0: 180, a1: 180 + a, label: 'x', ask: true, r: 0.6 }] };
  return made('This is a parallelogram. Find x. (degrees)', x, nums(r, x, [kind === 0 ? a : 180 - a, 360 - a]), {
    visual: v,
    hint: kind === 0 ? 'Angles next to each other on the same side add up to 180°.' : 'Opposite angles of a parallelogram are equal.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say(kind === 0 ? 'Neighbouring angles of a parallelogram sit between parallel sides (co-interior), so they add up to 180°.' : 'Opposite angles of a parallelogram are equal: turn it half way round and it fits on itself.', kind === 0 ? `180 − ${a} = ${x}` : `x = ${a}`);
      return L.end(x, `So x = ${x}°.`);
    },
  });
});

// ── Circles and solids ────────────────────────────────────────────────────
add('s6.sqrt', 'circarea', 'measure', 'Area of circles', (r, d) => {
  const rr = 7 * r.int(1, 4);
  const semi = d >= 0.5 && r.chance(0.4);
  const full = (22 / 7) * rr * rr;
  const ans = semi ? full / 2 : full;
  const v: MathVisual = { kind: 'geo', w: 10, h: semi ? 5.4 : 10, segs: [{ a: [5, semi ? 0.5 : 5], b: [9.2, semi ? 0.5 : 5], style: 'bold' }, ...(semi ? [{ a: [0.8, 0.5] as Pt, b: [9.2, 0.5] as Pt }] : [])], circles: semi ? [] : [{ c: [5, 5], r: 4.2, style: 'fill' }], fill: semi ? Array.from({ length: 25 }, (_, i) => [5 + 4.2 * Math.cos((Math.PI * i) / 24), 0.5 + 4.2 * Math.sin((Math.PI * i) / 24)] as Pt) : undefined, labels: [{ at: [7.1, semi ? 1.1 : 5.7], t: `r = ${rr}` }] };
  return made(`Take π = 22/7. What is the area of a ${semi ? 'semicircle' : 'circle'} with radius ${rr} cm? (cm²)`, ans, nums(r, ans, [(22 / 7) * 2 * rr, semi ? full : full / 2, rr * rr]), {
    visual: v,
    hint: 'Area = π × r × r.',
    teach: () => withWays((() => {
      const L = new PicLesson();
      L.show(v);
      L.say('Slice the circle like a pizza and lay the slices top-to-tail: they make a near-rectangle, half the circumference long (π × r) and r tall.');
      L.say('So area = π × r × r.', `22/7 × ${rr} × ${rr} = 22 × ${rr / 7} × ${rr} = ${full}`);
      if (semi) L.say('A semicircle is half of that.', `${full} ÷ 2 = ${ans}`);
      return L.end(ans, `So the area is ${ans} cm².`);
    })(), 'Slice into a rectangle', 'circle', []),
  });
});

add('s6.circarea', 'surfarea', 'measure', 'Surface area of cuboids', (r) => {
  const l = r.int(3, 12), b = r.int(2, 9), h = r.int(2, 9);
  const sa = 2 * (l * b + b * h + l * h);
  const v: MathVisual = { kind: 'cuboid', l: Math.min(l, 6), b: Math.min(b, 4), h: Math.min(h, 4), labels: [`${l}`, `${b}`, `${h}`] };
  return made(`What is the surface area of a box ${l} cm long, ${b} cm wide and ${h} cm tall? (cm²)`, sa, nums(r, sa, [l * b * h, sa / 2, l * b + b * h + l * h]), {
    visual: v,
    hint: 'Six faces in three matching pairs.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('Unfold the box: it has 6 faces in 3 matching pairs.');
      L.show({ kind: 'table', head: ['pair', 'one face', 'two faces'], rows: [['top & bottom', `${l} × ${b} = ${l * b}`, `${2 * l * b}`], ['front & back', `${l} × ${h} = ${l * h}`, `${2 * l * h}`], ['left & right', `${b} × ${h} = ${b * h}`, `${2 * b * h}`]] });
      L.say('Add all six faces.', `${2 * l * b} + ${2 * l * h} + ${2 * b * h} = ${sa}`);
      return L.end(sa, `So the surface area is ${sa} cm².`);
    },
  });
});

add('s6.surfarea', 'cylvol', 'measure', 'Volume of a cylinder', (r) => {
  const rr = 7 * r.int(1, 3), h = r.int(2, 20);
  const base = (22 / 7) * rr * rr;
  const vol = base * h;
  return made(`Take π = 22/7. A cylinder has radius ${rr} cm and height ${h} cm. What is its volume? (cm³)`, vol, nums(r, vol, [base, 2 * (22 / 7) * rr * h]), {
    visual: { kind: 'cylinder', r: `${rr}`, h: `${h}` },
    hint: 'Volume = area of the circle on the bottom × height.',
    teach: () => withWays((() => {
      const L = new PicLesson();
      L.show({ kind: 'cylinder', r: `${rr}`, h: `${h}`, coins: true });
      L.say('A cylinder is a stack of coins: each coin is a circle.');
      L.say('Area of the circle on the bottom:', `22/7 × ${rr} × ${rr} = ${base}`);
      L.say(`Stack it ${h} high.`, `${base} × ${h} = ${vol}`);
      return L.end(vol, `So the volume is ${vol} cm³.`);
    })(), 'Stack of coins', 'volume', []),
  });
});

const HERON: [number, number, number][] = [[13, 14, 15], [5, 5, 6], [5, 5, 8], [6, 8, 10], [9, 10, 17], [10, 13, 13], [7, 15, 20], [13, 20, 21], [10, 17, 21], [12, 17, 25]];
add('s6.sqrt', 'heron', 'measure', "Heron's formula", (r) => {
  const [a, b, c] = r.pick(HERON);
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  return made(`A triangle has sides ${a} cm, ${b} cm and ${c} cm. What is its area? (cm²)`, area, nums(r, area, [s * (s - a), a * b / 2]), {
    hint: 's = half the perimeter; area = √(s(s − a)(s − b)(s − c)).',
    teach: () => {
      const L = new PicLesson();
      // The triangle drawn to scale: base a, then b and c meet at the top.
      const x = (a * a + c * c - b * b) / (2 * a);
      const y = Math.sqrt(Math.max(0.5, c * c - x * x));
      const tri: MathVisual = { kind: 'poly', pts: [[0, 0], [a, 0], [x, y]], labels: [`${a}`, `${b}`, `${c}`], unit: 'cm' };
      const four = (note?: string): MathVisual => ({ kind: 'chain', groups: [{ items: [String(s)], label: 's', tone: 0 }, { items: [String(s - a)], label: `s − ${a}`, tone: 1 }, { items: [String(s - b)], label: `s − ${b}`, tone: 2 }, { items: [String(s - c)], label: `s − ${c}`, tone: 3 }], ops: ['×', '×', '×'], ...(note ? { note } : {}) });
      L.show(tri);
      L.say('Find s, half the perimeter.', `s = (${a} + ${b} + ${c}) ÷ 2 = ${s}`);
      L.show(four());
      L.say('Take each side away from s.', `${s} − ${a} = ${s - a}, ${s} − ${b} = ${s - b}, ${s} − ${c} = ${s - c}`);
      L.show(four(`= ${s * (s - a) * (s - b) * (s - c)}`));
      L.say('Multiply s by those three.', `${s} × ${s - a} × ${s - b} × ${s - c} = ${s * (s - a) * (s - b) * (s - c)}`);
      L.show({ kind: 'area', cols: [String(area)], rows: [String(area)], cells: [[`${area} × ${area} = ${s * (s - a) * (s - b) * (s - c)}`]], tone: [[2]], rh: [1.6] });
      L.say('Square root:', `√${s * (s - a) * (s - b) * (s - c)} = ${area}`);
      return L.end(area, `So the area is ${area} cm².`);
    },
  });
});

// ── Straight-line graphs ──────────────────────────────────────────────────
const sgn = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);
add('s6.nth', 'lineq', 'algebra', 'Straight-line graphs', (r, d) => {
  const m = r.pick([1, 2, 3, -1, -2, 1, 2]);
  const c = r.int(-3, 4);
  const eq = `y = ${m === 1 ? '' : m === -1 ? '−' : m < 0 ? `−${-m}` : m}x ${c ? sgn(c) : ''}`.replace(/\s+$/, '');
  const kind = d < 0.4 ? 0 : r.int(0, 2);
  const v: MathVisual = { kind: 'coord', min: -6, max: 6, line: { m, c } };
  if (kind === 0) {
    const x = r.int(-2, 3);
    const y = m * x + c;
    return made(`On the line ${eq}, what is y when x = ${x}?`.replace(/-/g, '−'), y, nearNumbers(r, y, [m * x, x + c]), {
      visual: v,
      hint: 'Put the x value into the equation.',
      teach: () => {
        const L = new PicLesson();
        L.show({ ...v, pts: [{ at: [x, y], hl: true }] });
        L.say(`Put x = ${x} into ${eq}.`.replace(/-/g, '−'), `y = ${m} × ${x < 0 ? `(${x})` : x} ${c ? sgn(c) : ''} = ${y}`.replace(/-/g, '−'));
        return L.end(y, `So y = ${y}.`.replace('-', '−'));
      },
    });
  }
  if (kind === 1) {
    return made(`What is the gradient of the line ${eq}?`, m, nearNumbers(r, m, [c, -m]), {
      visual: v,
      hint: 'In y = mx + c, m is the gradient.',
      teach: () => {
        const L = new PicLesson();
        L.show({ ...v, pts: [{ at: [0, c] }, { at: [1, m + c], hl: true }] });
        L.say('In y = mx + c, the number in front of x is the gradient: how far y goes up for each 1 across.');
        L.say(`Check on the graph: from x = 0 to x = 1, y goes from ${c} to ${m + c}.`.replace(/-/g, '−'), `${m + c} − ${c < 0 ? `(${c})` : c} = ${m}`.replace(/-/g, '−'));
        return L.end(m, `So the gradient is ${m}.`.replace('-', '−'));
      },
    });
  }
  return made(`Where does the line ${eq} cross the y-axis? (the value of y)`, c, nearNumbers(r, c, [m, -c]), {
    visual: v,
    hint: 'On the y-axis, x = 0.',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, pts: [{ at: [0, c], hl: true }] });
      L.say('On the y-axis, x = 0. Put x = 0 in:', `y = ${m} × 0 ${c ? sgn(c) : ''} = ${c}`.replace(/-/g, '−'));
      return L.end(c, `So it crosses at y = ${c}.`.replace('-', '−'));
    },
  });
}, { format: 'pad-ext' });

// ── Angles in circles ─────────────────────────────────────────────────────
add('s6.ratio3', 'circang', 'shape', 'Angles in circles', (r) => {
  const kind = r.int(0, 1);
  const C: Pt = [5, 5];
  const on = (deg: number): Pt => [C[0] + 4 * Math.cos(rad(deg)), C[1] + 4 * Math.sin(rad(deg))];
  if (kind === 0) {
    const a = 5 * r.int(5, 13);
    const A = on(180), B = on(0), P = on(180 - 2 * (90 - a) + 0);
    const x = 90 - a;
    const v: MathVisual = { kind: 'geo', w: 10, h: 10, segs: [{ a: A, b: B, style: 'dash' }, { a: A, b: P }, { a: P, b: B }], circles: [{ c: C, r: 4 }], dots: [C, A, B, P], arcs: [{ at: A, a0: 0, a1: a, label: `${a}°`, r: 0.9 }, { at: B, a0: 180 - x, a1: 180, label: 'x', ask: true, r: 0.9 }] };
    return made('AB is a diameter. Find x. (degrees)', x, nums(r, x, [180 - a, a, 90]), {
      visual: v,
      hint: 'The angle in a semicircle is a right angle.',
      teach: () => {
        const L = new PicLesson();
        L.show(v);
        L.say('An angle standing on a diameter, at the circle’s edge, is always 90°.');
        L.say('The triangle’s angles add up to 180°.', `180 − 90 − ${a} = ${x}`);
        return L.end(x, `So x = ${x}°.`);
      },
    });
  }
  const t = 5 * r.int(5, 16);
  const A = on(250), B = on(-70), P = on(110);
  const v: MathVisual = { kind: 'geo', w: 10, h: 10, segs: [{ a: A, b: P }, { a: B, b: P }, { a: A, b: C, style: 'dash' }, { a: B, b: C, style: 'dash' }], circles: [{ c: C, r: 4 }], dots: [C, A, B, P], labels: [{ at: [P[0], P[1] - 1.2], t: `${t}°` }, { at: [C[0], C[1] - 1], t: 'x', ask: true }] };
  return made(`The angle at the edge of the circle is ${t}°. Both angles stand on the same arc. What is the angle x at the centre? (degrees)`, 2 * t, nums(r, 2 * t, [t, 180 - t]), {
    visual: v,
    hint: 'The angle at the centre is twice the angle at the edge.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('An angle at the centre is twice the angle at the edge standing on the same arc.', `2 × ${t} = ${2 * t}`);
      return L.end(2 * t, `So x = ${2 * t}°.`);
    },
  });
});

// ── Data and chance ───────────────────────────────────────────────────────
add('s6.avgmissing', 'freqmean', 'data', 'Mean from a frequency table', (r) => {
  for (let t = 0; t < 200; t++) {
    const xs = [r.int(0, 3)];
    while (xs.length < 4) xs.push(xs[xs.length - 1] + 1);
    const fs = xs.map(() => r.int(1, 9));
    const sf = fs.reduce((a, b) => a + b, 0);
    const sfx = xs.reduce((a, x, i) => a + x * fs[i], 0);
    if (sfx % sf) continue;
    const mean = sfx / sf;
    const rows = xs.map((x, i) => [String(x), String(fs[i])]);
    return made('This table shows how many pets each child in a class has. What is the mean number of pets?', mean, nums(r, mean, [Math.round(sf / 4), xs[1] + 1]), {
      visual: { kind: 'table', head: ['Pets', 'Children'], rows },
      hint: 'Mean = total of (value × frequency) ÷ total frequency.',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'table', head: ['Pets', 'Children', 'Pets × children'], rows: xs.map((x, i) => [String(x), String(fs[i]), String(x * fs[i])]) });
        L.say('Add a column: value × how many. It counts every pet.', `${xs.map((x, i) => x * fs[i]).join(' + ')} = ${sfx}`);
        L.say('Count the children.', `${fs.join(' + ')} = ${sf}`);
        L.say('Share the pets out equally:', `${sfx} ÷ ${sf} = ${mean}`);
        return L.end(mean, `So the mean is ${mean}.`);
      },
    });
  }
  return made('The mean of 2, 4 and 6 is?', 4, [3, 5, 6]);
});

add('s6.proportion', 'twoevents', 'data', 'Two events', (r) => {
  const kind = r.int(0, 3);
  const grid = (rowsL: string[], cols: string[], hit: (a: string, b: string) => boolean): MathVisual => ({ kind: 'table', head: ['', ...cols], rows: rowsL.map((a) => [a, ...cols.map((b) => (hit(a, b) ? '✓' : '·'))]) });
  if (kind === 0) {
    const want = r.pick(['two heads', 'two tails', 'one head and one tail']);
    const ans = want === 'one head and one tail' ? '1/2' : '1/4';
    const hit = (a: string, b: string) => (want === 'two heads' ? a === 'H' && b === 'H' : want === 'two tails' ? a === 'T' && b === 'T' : a !== b);
    return made(`You toss two coins. What is the probability of getting ${want}?`, ans, ['1/3', ans === '1/2' ? '1/4' : '1/2', '2/3'], {
      hint: 'List every outcome: HH, HT, TH, TT.',
      teach: () => {
        const L = new PicLesson();
        L.show(grid(['H', 'T'], ['H', 'T'], hit));
        L.say('Draw a grid of the first coin against the second: 4 outcomes, all equally likely.');
        const n = ['H', 'T'].flatMap((a) => ['H', 'T'].map((b) => hit(a, b))).filter(Boolean).length;
        L.say(`${n} of the 4 give ${want}.`, `${n}/4 = ${ans}`);
        return L.end(ans, `So the probability is ${ans}.`);
      },
    });
  }
  if (kind === 1) {
    const k = r.int(2, 11);
    const want = r.chance(0.5) ? 'more than' : 'exactly';
    const faces = ['1', '2', '3', '4', '5', '6'];
    const hit = (a: string, b: string) => (want === 'exactly' ? +a + +b === k : +a + +b > k);
    const n = faces.flatMap((a) => faces.map((b) => hit(a, b))).filter(Boolean).length;
    if (n === 0 || n === 36) return made('You roll two dice. What is the probability of a total of 7?', '1/6', ['1/12', '7/36', '1/36'], { teach: () => { const L = new PicLesson(); L.show(grid(faces, faces, (a, b) => +a + +b === 7)); L.say('6 of the 36 outcomes make 7.', '6/36 = 1/6'); return L.end('1/6', 'So it is 1/6.'); } });
    const ans = frac(n, 36);
    return made(`You roll two dice and add the numbers. What is the probability of a total ${want} ${k}?`, ans, [frac(n + 1, 36), frac(Math.max(1, n - 1), 36), `${n}/12`].filter((x) => x !== ans), {
      hint: 'There are 6 × 6 = 36 outcomes.',
      teach: () => {
        const L = new PicLesson();
        L.show(grid(faces, faces, hit));
        L.say('Make a 6 by 6 grid of totals: 36 outcomes, all equally likely. Tick the ones that work.');
        L.say(`${n} ticks.`, `${n}/36${ans !== `${n}/36` ? ` = ${ans}` : ''}`);
        return L.end(ans, `So the probability is ${ans}.`);
      },
    }) as ReturnType<typeof made>;
  }
  const evenD = r.chance(0.5);
  const ans = evenD ? '1/4' : '1/12';
  const what = evenD ? 'a head and an even number' : 'a tail and a 6';
  return made(`You toss a coin and roll a dice. What is the probability of ${what}?`, ans, evenD ? ['1/2', '1/3', '1/6'] : ['1/6', '1/2', '1/8'], {
    hint: 'Multiply the two probabilities, or list all 12 outcomes.',
    teach: () => withWays((() => {
      const L = new PicLesson();
      L.show({ kind: 'pair', a: { kind: 'chain', groups: [{ items: ['H', 'T'], tone: 0, hl: [evenD ? 0 : 1] }] }, b: { kind: 'dice', faces: evenD ? [2, 4, 6] : [6] }, op: '×', la: '1/2', lb: evenD ? '3/6 = 1/2' : '1/6' });
      L.say(evenD ? 'P(head) = 1/2 and P(even) = 3/6 = 1/2.' : 'P(tail) = 1/2 and P(6) = 1/6.');
      L.say('For both to happen, multiply.', evenD ? '1/2 × 1/2 = 1/4' : '1/2 × 1/6 = 1/12');
      return L.end(ans, `So the probability is ${ans}.`);
    })(), 'Multiply', 'prob', [['List the outcomes', () => {
      const L = new PicLesson();
      L.show(grid(['H', 'T'], ['1', '2', '3', '4', '5', '6'], (a, b) => (evenD ? a === 'H' && +b % 2 === 0 : a === 'T' && b === '6')));
      L.say('There are 2 × 6 = 12 outcomes.', evenD ? '3 ticks: 3/12 = 1/4' : '1 tick: 1/12');
      return L.end(ans, `So the probability is ${ans}.`);
    }]]),
  });
}, { format: 'pad-ext' });

add('s6.ratio3', 'similar', 'shape', 'Similar shapes and scale factor', (r) => {
  const k = r.pick([2, 3, 4, 1.5, 2.5]);
  let sides = [6, 8, 10];
  for (let t = 0; t < 50; t++) {
    const c = [r.int(2, 6) * 2, r.int(2, 6) * 2, r.int(3, 8) * 2].sort((a, b) => a - b);
    if (c[0] + c[1] > c[2] && new Set(c).size === 3) { sides = c; break; }
  }
  const i = r.int(0, 2);
  const ans = sides[i] * k;
  const j = (i + 1) % 3;
  return made(`Two triangles are similar. The small one has sides ${sides.join(' cm, ')} cm. In the big one, the side matching ${sides[j]} cm is ${num(sides[j] * k)} cm. How long is the side matching ${sides[i]} cm? (cm)`, num(ans), [num(ans + sides[j] * (k - 1) - sides[i] * (k - 1)), num(sides[i] + sides[j] * k - sides[j]), num(ans * 2)].filter((x) => x !== num(ans)), {
    hint: 'Find the scale factor from the matching pair first.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'table', head: ['small', 'big'], rows: [[`${sides[j]}`, `${num(sides[j] * k)}`], [`${sides[i]}`, '?']] });
      L.say('Similar shapes are enlargements: every length is multiplied by the same scale factor.', `${num(sides[j] * k)} ÷ ${sides[j]} = ${num(k)}`);
      L.say('Multiply the other side by it.', `${sides[i]} × ${num(k)} = ${num(ans)}`);
      return L.end(num(ans), `So it is ${num(ans)} cm.`);
    },
  });
}, { format: 'pad-ext' });

add('s6.sdt', 'kmhms', 'measure', 'km/h and m/s', (r) => {
  const toMs = r.chance(0.6);
  const ms = r.int(1, 12) * 5;
  const kmh = (ms * 18) / 5;
  if (toMs) return made(`${kmh} km/h = ? m/s`, ms, nums(r, ms, [kmh / 3.6 * 2, Math.round(kmh / 60)]), {
    hint: '1 km/h = 1000 m in 3600 s, so × 5/18.',
    teach: () => withWays((() => {
      const L = new PicLesson();
      L.show({ kind: 'chain', rows: true, groups: [{ label: 'goes', items: [`${kmh} km`, `= ${kmh * 1000} m`], tone: 0 }, { label: 'in', items: ['1 h', '= 3600 s'], tone: 1 }], note: `${kmh * 1000} m ÷ 3600 s = ${ms} m/s` });
      L.say(`${kmh} km/h is ${kmh} × 1000 metres in 3600 seconds.`, `${kmh * 1000} ÷ 3600 = ${ms}`);
      return L.end(ms, `So ${kmh} km/h = ${ms} m/s.`);
    })(), 'Metres per second', 'units', [['× 5/18', () => {
      const L = new PicLesson();
      L.show({ kind: 'chain', groups: [{ items: ['1000/3600'], label: '÷ 200', tone: 0 }, { items: ['5/18'], tone: 2 }], ops: ['='], note: `${kmh} × 5/18 = ${ms}` });
      L.say('1000/3600 simplifies to 5/18, so multiply by 5/18.', `${kmh} × 5/18 = ${kmh / 18} × 5 = ${ms}`);
      return L.end(ms, `So it is ${ms} m/s.`);
    }]]),
  });
  return made(`${ms} m/s = ? km/h`, kmh, nums(r, kmh, [ms * 60, (ms * 5) / 18]), {
    hint: 'Multiply by 18/5 (that is × 3.6).',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'chain', rows: true, groups: [{ label: 'goes', items: [`${ms} m`, `→ ${ms * 3600} m`], tone: 0 }, { label: 'in', items: ['1 s', '→ 3600 s = 1 h'], tone: 1 }] });
      L.say(`${ms} m every second is ${ms} × 3600 m every hour.`, `${ms} × 3600 = ${ms * 3600} m`);
      L.show({ kind: 'pv', digits: String(ms * 3600), point: String(ms * 3600).length - 3, from: String(ms * 3600).length, note: `${ms * 3600} m = ${kmh} km` });
      L.say('Change metres to kilometres.', `${ms * 3600} ÷ 1000 = ${kmh}`);
      return L.end(kmh, `So ${ms} m/s = ${kmh} km/h.`);
    },
  });
});

void pickN;
