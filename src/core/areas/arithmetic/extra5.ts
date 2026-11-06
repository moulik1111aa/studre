// Stage 5 (ages 11–12): angles in triangles, parallel lines and polygons, circles, areas of
// triangles and parallelograms, cuboids, four-quadrant coordinates, congruence, turning
// symmetry; median, mode and range, pie charts, probability; matchstick patterns; same area,
// different perimeter; better buys.

import { extraSkills, made } from './extra.ts';
import { PicLesson, withWays, pickN } from '../../teach/pics.ts';
import { LessonBuilder } from '../../teach/build.ts';
import { frac, nearNumbers, num } from '../../question.ts';
import type { GeoArc, MathVisual, Pt } from '../../vis.ts';
import type { Rng } from '../../rng.ts';
import type { Lesson } from '../../teach/types.ts';

const { list, add } = extraSkills(5, { format: 'pad', speedSec: 30 });
export const EXTRA5 = list;

const nums = (r: Rng, a: number, extra: number[] = []) => nearNumbers(r, a, extra, { min: 0 });
const pt = (p: Pt) => `(${String(p[0]).replace('-', '−')}, ${String(p[1]).replace('-', '−')})`;
const rad = (d: number) => (d * Math.PI) / 180;

/** A triangle with base angles a and b on a base of 10. */
function triangle(a: number, b: number): [Pt, Pt, Pt] {
  const ta = Math.tan(rad(a)), tb = Math.tan(rad(b));
  const x = (10 * tb) / (ta + tb);
  return [[0, 0], [10, 0], [x, x * ta]];
}

// ── Angles ────────────────────────────────────────────────────────────────
add('s5.intdiv', 'triang', 'shape', 'Angles in a triangle', (r) => {
  const a = r.int(30, 80), b = r.int(30, 150 - a);
  const x = 180 - a - b;
  const [A, B, C] = triangle(a, b);
  const arcs: GeoArc[] = [{ at: A, a0: 0, a1: a, label: `${a}°`, r: 1.1 }, { at: B, a0: 180 - b, a1: 180, label: `${b}°`, r: 1.1 }, { at: C, a0: 180 + a, a1: 360 - b, label: 'x', ask: true, r: 0.8 }];
  const v: MathVisual = { kind: 'geo', w: 10, h: Math.max(3, C[1]), segs: [{ a: A, b: B }, { a: B, b: C }, { a: C, b: A }], arcs };
  const tear = (): Lesson => {
    const L = new PicLesson();
    L.show(v);
    L.say('Tear off the three corners of any triangle and put them side by side: they make a straight line.');
    L.show({ kind: 'geo', w: 10, h: 4, segs: [{ a: [0.5, 1], b: [9.5, 1] }], arcs: [{ at: [5, 1], a0: 0, a1: a, label: `${a}°`, r: 1.4 }, { at: [5, 1], a0: a, a1: a + x, label: 'x', ask: true, r: 1.4 }, { at: [5, 1], a0: a + x, a1: 180, label: `${b}°`, r: 1.4 }], dots: [[5, 1]] });
    L.say('So the angles of a triangle add up to 180°.', `${a} + ${b} + x = 180`);
    L.say('Take the two you know away from 180.', `180 − ${a} − ${b} = ${x}`);
    return L.end(x, `So x = ${x}°.`);
  };
  return made('Find the angle x. (degrees)', x, nums(r, x, [360 - a - b, 90 - a > 0 ? 90 - a : x + 10]), {
    visual: v,
    hint: 'The three angles of a triangle add up to 180°.',
    teach: () => withWays(tear(), 'Tear off the corners', 'angles', []),
  });
});

add('s5.triang', 'parangles', 'shape', 'Angles with parallel lines', (r) => {
  const a = 5 * r.int(8, 28);
  const kind = r.int(0, 3);
  // Two parallel lines y = 1 and y = 4, cut by a line through (3,1) and (3 + 3/tan a, 4).
  const P: Pt = [3.5, 1];
  const dx = 3 / Math.tan(rad(a));
  const Q: Pt = [3.5 + dx, 4];
  const ext = (p: Pt, k: number): Pt => [p[0] + k * dx / 3, p[1] + k];
  const segs = [{ a: [0, 1] as Pt, b: [10, 1] as Pt, par: 1 }, { a: [0, 4] as Pt, b: [10, 4] as Pt, par: 1 }, { a: ext(P, -0.9), b: ext(Q, 0.9) }];
  const known: GeoArc = { at: P, a0: 0, a1: a, label: `${a}°`, r: 0.8 };
  const names = ['vertically opposite', 'corresponding', 'alternate', 'co-interior'];
  const ask: GeoArc = kind === 0 ? { at: P, a0: 180, a1: 180 + a, label: 'x', ask: true, r: 0.8 }
    : kind === 1 ? { at: Q, a0: 0, a1: a, label: 'x', ask: true, r: 0.8 }
      : kind === 2 ? { at: Q, a0: 180, a1: 180 + a, label: 'x', ask: true, r: 0.8 }
        : { at: Q, a0: 180 + a, a1: 360, label: 'x', ask: true, r: 0.8 };
  const x = kind === 3 ? 180 - a : a;
  const v: MathVisual = { kind: 'geo', w: 10, h: 5, segs, arcs: [known, ask], dots: [P, Q] };
  const why = ['Vertically opposite angles (an X shape) are equal.', 'Corresponding angles (an F shape) are equal.', 'Alternate angles (a Z shape) are equal.', 'Co-interior angles (a C shape) add up to 180°.'][kind];
  return made('The two lines with arrows are parallel. Find x. (degrees)', x, nums(r, x, [kind === 3 ? a : 180 - a, 90 - a > 0 ? 90 - a : a + 10]), {
    visual: v,
    hint: 'Look for an X, F, Z or C shape.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say(`These are ${names[kind]} angles.`);
      L.say(why, kind === 3 ? `180 − ${a} = ${x}` : `x = ${a}`);
      return L.end(x, `So x = ${x}°.`);
    },
  });
});

const REG: [number, string][] = [[5, 'pentagon'], [6, 'hexagon'], [8, 'octagon'], [9, 'nonagon'], [10, 'decagon'], [12, 'dodecagon']];
add('s5.parangles', 'polyang', 'shape', 'Inside angles of polygons', (r, d) => {
  const [n, name] = r.pick(REG);
  const sum = (n - 2) * 180;
  const each = d >= 0.5 && r.chance(0.5);
  const pts = Array.from({ length: n }, (_, i) => [5 + 4.4 * Math.cos(rad(90 + (360 * i) / n)), 4.6 + 4.4 * Math.sin(rad(90 + (360 * i) / n))] as Pt);
  const segs = pts.map((p, i) => ({ a: p, b: pts[(i + 1) % n] }));
  const diag = pts.slice(2, n - 1).map((p) => ({ a: pts[0], b: p, style: 'dash' as const }));
  const tris = (): Lesson => {
    const L = new PicLesson();
    L.show({ kind: 'geo', w: 10, h: 9.2, segs });
    L.say(`Pick one corner and draw lines to every other corner. A ${n}-sided shape splits into ${n - 2} triangles.`);
    L.show({ kind: 'geo', w: 10, h: 9.2, segs: [...segs, ...diag], dots: [pts[0]] });
    L.say('Each triangle has 180°.', `${n - 2} × 180 = ${sum}`);
    if (each) L.say(`All ${n} angles of a regular ${name} are equal.`, `${sum} ÷ ${n} = ${sum / n}`);
    return L.end(each ? sum / n : sum, each ? `So each angle is ${sum / n}°.` : `So the inside angles add up to ${sum}°.`);
  };
  if (each) return made(`What is each inside angle of a regular ${name} (${n} sides)? (degrees)`, sum / n, nums(r, sum / n, [360 / n, sum]), { hint: 'Find the total first, then share it equally.', teach: () => withWays(tris(), 'Cut into triangles', 'angles', []) });
  return made(`What do the inside angles of a ${name} (${n} sides) add up to? (degrees)`, sum, nums(r, sum, [n * 180, (n - 1) * 180]), {
    hint: 'Cut it into triangles from one corner.',
    teach: () => withWays(tris(), 'Cut into triangles', 'angles', [['(n − 2) × 180', () => {
      const L = new LessonBuilder();
      L.say(`For any polygon with n sides, the inside angles add up to (n − 2) × 180°. Here n = ${n}.`, `(${n} − 2) × 180 = ${sum}`);
      return L.end(sum, `So they add up to ${sum}°.`);
    }]]),
  });
});

// ── Circles ───────────────────────────────────────────────────────────────
add('s5.fxwhole', 'circle', 'shape', 'Radius, diameter, circumference', (r, d) => {
  const kind = d < 0.4 ? r.int(0, 1) : r.int(0, 3);
  const rr = 7 * r.int(1, 6);
  const dd = 2 * rr;
  const v = (lab: string): MathVisual => ({ kind: 'geo', w: 10, h: 10, segs: [{ a: [5, 5], b: [9.2, 5], style: 'bold' }], circles: [{ c: [5, 5], r: 4.2, style: 'fill' }], dots: [[5, 5]], labels: [{ at: [7.1, 5.7], t: lab }] });
  if (kind === 0) return made(`A circle has a radius of ${rr} cm. What is its diameter? (cm)`, dd, nums(r, dd, [rr / 2, rr]), { visual: v(`r = ${rr}`), hint: 'The diameter goes right across: two radii.', teach: () => { const L = new PicLesson(); L.show(v(`r = ${rr}`)); L.say('The radius goes from the centre to the edge. The diameter goes right across, through the centre: two radii.', `2 × ${rr} = ${dd}`); return L.end(dd, `So the diameter is ${dd} cm.`); } });
  if (kind === 1) return made(`A circle has a diameter of ${dd} cm. What is its radius? (cm)`, rr, nums(r, rr, [dd * 2, dd]), { hint: 'The radius is half the diameter.', teach: () => { const L = new PicLesson(); L.show(v(`d = ${dd}`)); L.say('The radius is half of the diameter.', `${dd} ÷ 2 = ${rr}`); return L.end(rr, `So the radius is ${rr} cm.`); } });
  const fromR = kind === 3;
  const c = (22 / 7) * dd;
  const roll = (): Lesson => {
    const L = new PicLesson();
    L.show(v(fromR ? `r = ${rr}` : `d = ${dd}`));
    if (fromR) L.say('Find the diameter first.', `2 × ${rr} = ${dd}`);
    L.say('Roll the circle once along a line: it goes a little over 3 diameters. That number is π, about 22/7.');
    L.say('Circumference = π × diameter.', `22/7 × ${dd} = 22 × ${dd / 7} = ${c}`);
    return L.end(c, `So the circumference is ${c} cm.`);
  };
  return made(`Take π = 22/7. A circle has a ${fromR ? 'radius' : 'diameter'} of ${fromR ? rr : dd} cm. What is its circumference? (cm)`, c, nums(r, c, [fromR ? (22 / 7) * rr : c / 2, 3 * dd]), { hint: 'Circumference = π × diameter.', teach: () => withWays(roll(), 'Roll the wheel', 'circle', []) });
});

// ── Areas ─────────────────────────────────────────────────────────────────
add('s5.circle', 'triarea', 'measure', 'Area of triangles and parallelograms', (r) => {
  const tri = r.chance(0.6);
  const b = r.int(4, 16), h = r.int(3, 12);
  const bb = tri && (b * h) % 2 ? b + 1 : b;
  const area = tri ? (bb * h) / 2 : bb * h;
  const top = r.int(1, bb - 1);
  const s = Math.min(10 / bb, 6 / h);
  const P = (x: number, y: number): Pt => [x * s, y * s];
  const v: MathVisual = tri
    ? { kind: 'geo', w: bb * s, h: h * s, segs: [{ a: P(0, 0), b: P(bb, 0) }, { a: P(bb, 0), b: P(top, h) }, { a: P(top, h), b: P(0, 0) }, { a: P(top, 0), b: P(top, h), style: 'dash' }], fill: [P(0, 0), P(bb, 0), P(top, h)], arcs: [{ at: P(top, 0), a0: 90, a1: 180, right: true }], labels: [{ at: P(bb / 2, -0.9 / s), t: `${bb} cm` }, { at: P(top + 0.9 / s, h / 2), t: `${h} cm` }] }
    : { kind: 'geo', w: (bb + 3) * s, h: h * s, segs: [{ a: P(0, 0), b: P(bb, 0) }, { a: P(bb, 0), b: P(bb + 3, h) }, { a: P(bb + 3, h), b: P(3, h) }, { a: P(3, h), b: P(0, 0) }, { a: P(3, 0), b: P(3, h), style: 'dash' }], fill: [P(0, 0), P(bb, 0), P(bb + 3, h), P(3, h)], labels: [{ at: P(bb / 2, -0.9 / s), t: `${bb} cm` }, { at: P(3 + 0.9 / s, h / 2), t: `${h} cm` }] };
  const half = (): Lesson => {
    const L = new PicLesson();
    L.show(v);
    if (tri) {
      L.say(`Draw a rectangle around the triangle: ${bb} by ${h}. The triangle is exactly half of it.`, `${bb} × ${h} = ${bb * h}`);
      L.say('Half of that:', `${bb * h} ÷ 2 = ${area}`);
    } else {
      L.say('Cut the slanted end off and slide it to the other side: it becomes a rectangle.');
      L.say('Area = base × height (straight up, not the slant).', `${bb} × ${h} = ${area}`);
    }
    return L.end(area, `So the area is ${area} cm².`);
  };
  return made(`What is the area of this ${tri ? 'triangle' : 'parallelogram'}? (cm²)`, area, nums(r, area, [tri ? bb * h : area / 2, bb + h]), {
    visual: v,
    hint: tri ? 'Area = ½ × base × height.' : 'Area = base × height.',
    teach: () => withWays(half(), tri ? 'Half a rectangle' : 'Slide into a rectangle', 'area', []),
  });
});

add('s6.eq2', 'cuboidvol', 'measure', 'Volume of cuboids', (r, d) => {
  const l = r.int(3, 12), b = r.int(2, 8), h = r.int(2, 10);
  const vol = l * b * h;
  const miss = d >= 0.5 && r.chance(0.5);
  const v: MathVisual = { kind: 'cuboid', l: Math.min(l, 6), b: Math.min(b, 4), h: Math.min(h, 4), labels: [`${l} cm`, `${b} cm`, miss ? '? cm' : `${h} cm`] };
  if (miss) return made(`A box holds ${vol} cm³. It is ${l} cm long and ${b} cm wide. How tall is it? (cm)`, h, nums(r, h, [vol / l]), {
    visual: v,
    hint: 'Volume = length × width × height. Find the base first.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('One layer (the base) is length × width.', `${l} × ${b} = ${l * b}`);
      L.say(`How many layers of ${l * b} make ${vol}?`, `${vol} ÷ ${l * b} = ${h}`);
      return L.end(h, `So it is ${h} cm tall.`);
    },
  });
  return made(`What is the volume of a box ${l} cm long, ${b} cm wide and ${h} cm tall? (cm³)`, vol, nums(r, vol, [l + b + h, l * b, 2 * (l * b + b * h + l * h)]), {
    visual: v,
    hint: 'Volume = length × width × height.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'cuboid', l: Math.min(l, 6), b: Math.min(b, 4), h: Math.min(h, 4), cubes: true, layers: true });
      L.say('One layer is length × width.', `${l} × ${b} = ${l * b}`);
      L.say(`There are ${h} layers.`, `${l * b} × ${h} = ${vol}`);
      return L.end(vol, `So the volume is ${vol} cm³.`);
    },
  });
});

// ── Coordinates ───────────────────────────────────────────────────────────
add('s5.numline', 'coord4', 'shape', 'Coordinates in four quadrants', (r, d) => {
  const p: Pt = [r.int(-5, 5) || 3, r.int(-5, 5) || -2];
  const reflect = d >= 0.5 && r.chance(0.6);
  if (reflect) {
    const axis = r.pick(['x', 'y'] as const);
    const q: Pt = axis === 'x' ? [p[0], -p[1]] : [-p[0], p[1]];
    const ans = pt(q);
    const v: MathVisual = { kind: 'coord', min: -6, max: 6, pts: [{ at: p, label: 'P' }], mirror: axis };
    return made(`Reflect P ${pt(p)} in the ${axis}-axis. Where does it land?`, ans, [pt([-p[0], -p[1]]), pt(axis === 'x' ? [-p[0], p[1]] : [p[0], -p[1]]), pt([p[1], p[0]])].filter((x) => x !== ans), {
      visual: v,
      hint: axis === 'x' ? 'Reflecting in the x-axis flips up and down: y changes sign.' : 'Reflecting in the y-axis flips left and right: x changes sign.',
      teach: () => {
        const L = new PicLesson();
        L.show(v);
        L.say(`The ${axis}-axis is the mirror. P is ${Math.abs(axis === 'x' ? p[1] : p[0])} ${axis === 'x' ? (p[1] > 0 ? 'above' : 'below') : p[0] > 0 ? 'right of' : 'left of'} it.`);
        L.show({ ...v, pts: [{ at: p, label: 'P' }, { at: q, label: 'P′', hl: true }] });
        L.say(`Its image is the same distance on the other side, so ${axis === 'x' ? 'y' : 'x'} changes sign.`);
        return L.end(ans, `So P lands at ${ans}.`);
      },
      exact: true,
    });
  }
  const ans = pt(p);
  const v: MathVisual = { kind: 'coord', min: -6, max: 6, pts: [{ at: p, e: '⭐' }] };
  return made('What are the coordinates of the star?', ans, [pt([p[1], p[0]]), pt([-p[0], p[1]]), pt([p[0], -p[1]])].filter((x) => x !== ans), {
    visual: v,
    hint: 'Across first (x), then up or down (y). Left and down are negative.',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, walk: p });
      L.say(`From 0, go ${Math.abs(p[0])} ${p[0] >= 0 ? 'right' : 'left'}: x = ${p[0]}.`.replace('-', '−'));
      L.say(`Then ${Math.abs(p[1])} ${p[1] >= 0 ? 'up' : 'down'}: y = ${p[1]}.`.replace('-', '−'));
      return L.end(ans, `So the star is at ${ans}.`);
    },
    exact: true,
  });
}, { format: 'choice' });

add('s5.polyang', 'congruent', 'shape', 'Congruent triangles', (r) => {
  const tests: [string, string, string][] = [
    ['SSS', 'AB = PQ, BC = QR and CA = RP', 'All three sides match: SSS (side, side, side).'],
    ['SAS', 'AB = PQ, angle B = angle Q and BC = QR', 'Two sides and the angle between them match: SAS.'],
    ['ASA', 'angle A = angle P, AB = PQ and angle B = angle Q', 'Two angles and the side between them match: ASA.'],
    ['RHS', 'angle B = angle Q = 90°, AC = PR and AB = PQ', 'A right angle, the longest side (hypotenuse) and one other side match: RHS.'],
  ];
  const [ans, given, why] = r.pick(tests);
  return made(`In triangles ABC and PQR: ${given}. Which test shows they are congruent?`, ans, tests.map((t) => t[0]).filter((x) => x !== ans), {
    hint: 'S is a side, A is an angle; the middle letter sits between the other two.',
    teach: () => {
      const L = new LessonBuilder();
      L.say('Congruent means exactly the same size and shape. Four tests: SSS, SAS, ASA and RHS.');
      L.say(`Here: ${given}.`);
      L.say(why);
      return L.end(ans, `So the test is ${ans}.`);
    },
  });
}, { format: 'choice' });

add('s5.recipe', 'rotsym', 'shape', 'Turning symmetry', (r) => {
  const style = r.pick(['star', 'polygon', 'flower', 'pinwheel'] as const);
  const n = r.int(3, 8);
  const v: MathVisual = { kind: 'rotsym', n, style };
  return made('What is the order of turning (rotational) symmetry of this shape?', n, nums(r, n, [n * 2, n - 1, 1]), {
    visual: v,
    hint: 'Count how many times it looks the same in one full turn.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('Turn the shape about its centre. Count the times it fits on its outline in one full turn.');
      L.show({ ...v, turned: true });
      L.say(`It fits after every ${360 / n === Math.round(360 / n) ? 360 / n : (360 / n).toFixed(1)}° turn.`, `360 ÷ ${360 / n === Math.round(360 / n) ? 360 / n : (360 / n).toFixed(1)} = ${n}`);
      return L.end(n, `So the order of turning symmetry is ${n}.`);
    },
  });
}, { format: 'choice' });

// ── Data and chance ───────────────────────────────────────────────────────
add('s5.average', 'mmr', 'data', 'Median, mode and range', (r, d) => {
  const n = r.pick(d < 0.5 ? [5, 7] : [5, 6, 7]);
  const what = r.pick(['median', 'mode', 'range'] as const);
  const pool = r.shuffle(Array.from({ length: 29 }, (_, i) => i + 2));
  const vals = pool.slice(0, n);
  if (what === 'mode') vals[1] = vals[0];
  if (what === 'mode' && n >= 6) vals[3] = vals[0];
  r.shuffle(vals);
  const s2 = [...vals].sort((x, y) => x - y);
  const t2 = what === 'mode' ? vals.filter((x) => x === s2.find((y) => vals.filter((z) => z === y).length > 1)).length : 1;
  const mode = [s2.find((y) => vals.filter((z) => z === y).length > 1) ?? s2[0]];
  const median = n % 2 ? s2[(n - 1) / 2] : (s2[n / 2 - 1] + s2[n / 2]) / 2;
  const ans = what === 'mode' ? mode[0] : what === 'range' ? s2[n - 1] - s2[0] : median;
  const list = vals.join(', ');
  const lesson = (): Lesson => {
    const L = new PicLesson();
    const cells = s2.map(String);
    L.show({ kind: 'strip', cells });
    L.say('Put them in order first.', cells.join(', '));
    if (what === 'median') {
      L.show({ kind: 'strip', cells, hl: n % 2 ? (n - 1) / 2 : n / 2 - 1 });
      L.say('Cross off one from each end, again and again, until the middle is left.', n % 2 ? `middle: ${median}` : `two in the middle: ${s2[n / 2 - 1]} and ${s2[n / 2]}, halfway is ${num(median)}`);
    } else if (what === 'mode') L.say(`The mode is the one that comes up most often: ${mode[0]} appears ${t2} times.`);
    else L.say('The range is the biggest take away the smallest.', `${s2[n - 1]} − ${s2[0]} = ${ans}`);
    return L.end(ans, `So the ${what} is ${num(ans)}.`);
  };
  return made(`Find the ${what} of: ${list}`, num(ans), nums(r, ans, [vals[Math.floor(n / 2)], Math.round(vals.reduce((a, b) => a + b, 0) / n)]).map(String), {
    hint: what === 'median' ? 'Order them, then find the middle one.' : what === 'mode' ? 'The most common value.' : 'Biggest − smallest.',
    teach: lesson,
  });
}, { format: 'pad-ext' });

add('s5.pctany', 'pie', 'data', 'Pie charts', (r) => {
  const total = r.pick([36, 60, 72, 90, 120, 180, 360]);
  const degs = r.pick([[180, 90, 90], [120, 120, 60, 60], [90, 90, 120, 60], [150, 90, 60, 60], [180, 60, 120], [90, 30, 60, 180]]);
  const labels = ['Cricket', 'Football', 'Chess', 'Kabaddi'].slice(0, degs.length);
  const i = r.int(0, degs.length - 1);
  const ans = (degs[i] / 360) * total;
  if (!Number.isInteger(ans)) return made(`A pie chart shows ${total} children. Cricket is ${degs[0]}°. How many chose cricket?`, (degs[0] / 360) * total, nums(r, (degs[0] / 360) * total, [degs[0]]), { visual: { kind: 'pie', parts: degs.map((deg, k) => ({ label: labels[k], deg })) }, teach: () => pieLesson(degs[0], total, labels[0], degs, labels, 0) });
  return made(`This pie chart shows the favourite games of ${total} children. ${labels[i]} is ${degs[i]}°. How many children chose ${labels[i]}?`, ans, nums(r, ans, [degs[i], total - ans]), {
    visual: { kind: 'pie', parts: degs.map((deg, k) => ({ label: labels[k], deg })) },
    hint: 'The whole pie is 360° for all the children.',
    teach: () => pieLesson(degs[i], total, labels[i], degs, labels, i),
  });
});
function pieLesson(deg: number, total: number, label: string, degs: number[], labels: string[], i: number): Lesson {
  const L = new PicLesson();
  const ans = (deg / 360) * total;
  L.show({ kind: 'pie', parts: degs.map((d, k) => ({ label: labels[k], deg: d })), hl: i, sweep: true });
  L.say(`The whole circle, 360°, is all ${total} children. ${label} is ${deg}° of it.`, `${deg}/360 = ${frac(deg, 360)}`);
  L.say(`So find ${frac(deg, 360)} of ${total}.`, `${total} × ${deg} ÷ 360 = ${ans}`);
  return L.end(ans, `So ${ans} children chose ${label}.`);
}

add('s5.ratiosimp', 'prob', 'data', 'Probability as a fraction', (r) => {
  const total = r.pick([4, 5, 6, 8, 10, 12]);
  const k = r.int(1, total - 1);
  const [c1, c2] = pickN(r, ['red', 'blue', 'green', 'yellow'], 2);
  const balls = r.shuffle([...Array(k).fill(c1), ...Array(total - k).fill(c2)]);
  const ans = frac(k, total);
  return made(`A bag has ${k} ${c1} and ${total - k} ${c2} marbles. You pick one without looking. What is the probability it is ${c1}? (as a fraction)`, ans, [frac(total - k, total), frac(k, total - k === 0 ? 1 : total - k), `${k}/${total + 1}`].filter((x) => x !== ans), {
    visual: { kind: 'bag', balls },
    hint: 'Probability = ways it can happen ÷ all the ways.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'bag', balls, hl: c1 });
      L.say(`There are ${k} ${c1} out of ${total} marbles, and each is as likely to be picked.`);
      L.say('Probability = ways it can happen ÷ all the ways.', `${k}/${total}${frac(k, total) !== `${k}/${total}` ? ` = ${ans}` : ''}`);
      return L.end(ans, `So the probability is ${ans}.`);
    },
  });
}, { format: 'pad-ext' });

// ── Algebra: matchstick patterns ──────────────────────────────────────────
add('s6.subst', 'matchstick', 'algebra', 'Matchstick patterns', (r, d) => {
  const shape = r.pick(['squares', 'triangles'] as const);
  const per = shape === 'squares' ? 3 : 2;
  const first = shape === 'squares' ? 4 : 3;
  const k = r.int(d < 0.5 ? 5 : 8, d < 0.5 ? 10 : 25);
  const ans = first + per * (k - 1);
  const sticks = (n: number) => first + per * (n - 1);
  const v: MathVisual = { kind: 'sticks', shape, n: shape === 'squares' ? [1, 2, 3] : [1, 3, 5].map((x) => x) };
  return made(`Shape 1 uses ${sticks(1)} matchsticks, shape 2 uses ${sticks(2)} and shape 3 uses ${sticks(3)}. How many does shape ${k} use?`, ans, nums(r, ans, [first * k, per * k, ans + per]), {
    visual: shape === 'squares' ? v : undefined,
    hint: `Each new shape adds ${per} sticks.`,
    teach: () => withWays((() => {
      const L = new PicLesson();
      if (shape === 'squares') L.show(v);
      L.say(`It starts with ${first} and each new shape adds ${per} more.`, `${sticks(1)}, ${sticks(2)}, ${sticks(3)} … (+${per} each time)`);
      L.say(`Shape ${k} has ${k - 1} more steps after shape 1.`, `${first} + ${per} × ${k - 1} = ${ans}`);
      return L.end(ans, `So shape ${k} uses ${ans} matchsticks.`);
    })(), 'Start, then add', 'pattern', [['The rule', () => {
      const L = new LessonBuilder();
      L.say(`The rule for shape n is ${per}n + ${first - per}: check shape 1, ${per} × 1 + ${first - per} = ${first}.`);
      L.say(`Put n = ${k}.`, `${per} × ${k} + ${first - per} = ${ans}`);
      return L.end(ans, `So shape ${k} uses ${ans} matchsticks.`);
    }]]),
  });
});

// ── Same area, different perimeter; better buy ────────────────────────────
add('s5.sq20', 'samearea', 'measure', 'Same area, different perimeter', (r) => {
  const A = r.pick([12, 16, 18, 20, 24, 30, 36]);
  const pairs: [number, number][] = [];
  for (let a = 1; a * a <= A; a++) if (A % a === 0) pairs.push([a, A / a]);
  const small = r.chance(0.6);
  const per = pairs.map(([a, b]) => 2 * (a + b));
  const ans = small ? Math.min(...per) : Math.max(...per);
  return made(`Rectangles with whole-number sides all have an area of ${A} cm². What is the ${small ? 'smallest' : 'largest'} perimeter one can have? (cm)`, ans, nums(r, ans, per.filter((p) => p !== ans)), {
    hint: 'List every rectangle with that area.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'table', head: ['sides', 'perimeter'], rows: pairs.map(([a, b], i) => [`${a} × ${b}`, String(per[i])]), hl: [[per.indexOf(ans), 0], [per.indexOf(ans), 1]] });
      L.say(`List the rectangles with area ${A}: ${pairs.map(([a, b]) => `${a} × ${b}`).join(', ')}.`);
      L.say(small ? 'The squarest one has the shortest edge all round.' : 'The longest, thinnest one has the longest edge all round.');
      return L.end(ans, `So the ${small ? 'smallest' : 'largest'} perimeter is ${ans} cm.`);
    },
  });
});

add('s5.unitary', 'betterbuy', 'measure', 'Better buy', (r) => {
  for (let t = 0; t < 50; t++) {
    const ga = r.pick([250, 400, 500, 750]), gb = r.pick([500, 1000, 1500, 2000]);
    if (ga === gb) continue;
    const per100a = r.int(8, 30), per100b = r.int(8, 30);
    if (per100a === per100b) continue;
    const pa = (ga / 100) * per100a, pb = (gb / 100) * per100b;
    if (!Number.isInteger(pa) || !Number.isInteger(pb)) continue;
    const ans = per100a < per100b ? 'A' : 'B';
    const item = r.pick(['rice', 'atta', 'sugar', 'dal']);
    return made(`Which is the better buy? Pack A: ${ga} g of ${item} for ₹${pa}. Pack B: ${gb} g for ₹${pb}.`, ans, [ans === 'A' ? 'B' : 'A'], {
      visual: { kind: 'packs', packs: [{ label: 'A', amount: `${ga} g`, price: `₹${pa}`, color: 'yellow' }, { label: 'B', amount: `${gb} g`, price: `₹${pb}`, color: 'teal' }] },
      hint: 'Find the price for the same amount, like 100 g.',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'table', head: ['pack', 'price', 'per 100 g'], rows: [['A', `₹${pa} for ${ga} g`, `₹${per100a}`], ['B', `₹${pb} for ${gb} g`, `₹${per100b}`]], hl: [[ans === 'A' ? 0 : 1, 2]] });
        L.say('Compare the same amount: the price of 100 g.', `A: ₹${pa} ÷ ${ga / 100} = ₹${per100a}`);
        L.say('Then pack B:', `B: ₹${pb} ÷ ${gb / 100} = ₹${per100b}`);
        return L.end(ans, `100 g is cheaper in pack ${ans}, so ${ans} is the better buy.`);
      },
    });
  }
  return made('Which is the better buy? Pack A: 500 g for ₹60. Pack B: 1000 g for ₹100.', 'B', ['A'], { teach: () => { const L = new LessonBuilder(); L.say('Per 100 g: A is ₹12, B is ₹10.'); return L.end('B', 'So B is the better buy.'); } });
}, { format: 'choice' });

