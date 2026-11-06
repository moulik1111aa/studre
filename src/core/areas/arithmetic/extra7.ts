// Stage 7 (ages 15–16): trigonometry, special angles, heights and distances, distance and
// midpoint, arithmetic progressions, nature of roots, zeros of quadratics, similar triangles,
// tangents, sectors, cones and spheres, grouped data, cards and dice, average speed.

import { extraSkills, made } from './extra.ts';
import { PicLesson, withWays, pickN } from '../../teach/pics.ts';
import { LessonBuilder } from '../../teach/build.ts';
import { frac, nearNumbers, num } from '../../question.ts';
import type { MathVisual, Pt } from '../../vis.ts';
import type { Rng } from '../../rng.ts';
import type { Lesson } from '../../teach/types.ts';
import { TRIPLES, rightTri } from './extra6.ts';

const { list, add } = extraSkills(7, { format: 'pad', speedSec: 45 });
export const EXTRA7 = list;

const nums = (r: Rng, a: number, extra: number[] = []) => nearNumbers(r, a, extra, { min: 0 });
const m = (n: number) => String(n).replace('-', '−');
const pt = (p: Pt) => `(${m(p[0])}, ${m(p[1])})`;

// ── Trigonometry ──────────────────────────────────────────────────────────
add('s7.rearrange', 'trig', 'shape', 'sin, cos and tan', (r) => {
  const [a, b, c] = r.pick(TRIPLES.slice(0, 4));
  const fn = r.pick(['sin', 'cos', 'tan'] as const);
  // Angle A sits at the right-hand corner: opposite = a (the upright side), adjacent = b.
  const ans = fn === 'sin' ? frac(a, c) : fn === 'cos' ? frac(b, c) : frac(a, b);
  const v = rightTri(a, b, `${a}`, `${b}`, `${c}`, { labels: [{ at: [0.5 + Math.min(9 / b, 6 / a) * b / 2, -0.15], t: `${b}` }, { at: [-0.35, 0.5 + Math.min(9 / b, 6 / a) * a / 2], t: `${a}` }, { at: [0.9 + Math.min(9 / b, 6 / a) * b / 2, 0.9 + Math.min(9 / b, 6 / a) * a / 2], t: `${c}` }, { at: [Math.min(9 / b, 6 / a) * b - 0.6, 0.9], t: 'A', hl: true }] });
  return made(`In this right triangle, what is ${fn} A? (as a fraction)`, ans, [frac(a, c), frac(b, c), frac(a, b), frac(b, a)].filter((x) => x !== ans), {
    visual: v,
    hint: 'SOH CAH TOA: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say(`Name the sides from A: the hypotenuse is the longest, ${c}. Opposite A is ${a}. Next to A (adjacent) is ${b}.`);
      L.say(fn === 'sin' ? 'SOH: sin = opposite ÷ hypotenuse.' : fn === 'cos' ? 'CAH: cos = adjacent ÷ hypotenuse.' : 'TOA: tan = opposite ÷ adjacent.', fn === 'sin' ? `${a}/${c}` : fn === 'cos' ? `${b}/${c}` : `${a}/${b}`);
      return L.end(ans, `So ${fn} A = ${ans}.`);
    },
  });
}, { format: 'pad-ext' });

const SPECIAL: Record<string, Record<number, string>> = {
  sin: { 0: '0', 30: '1/2', 45: '1/√2', 60: '√3/2', 90: '1' },
  cos: { 0: '1', 30: '√3/2', 45: '1/√2', 60: '1/2', 90: '0' },
  tan: { 0: '0', 30: '1/√3', 45: '1', 60: '√3' },
};
add('s7.trig', 'special', 'shape', 'Special angles', (r) => {
  const fn = r.pick(['sin', 'cos', 'tan'] as const);
  const angle = r.pick(Object.keys(SPECIAL[fn]).map(Number));
  const ans = SPECIAL[fn][angle];
  const pool = ['0', '1/2', '1/√2', '√3/2', '1', '√3', '1/√3'].filter((x) => x !== ans);
  const triangle = (): Lesson => {
    const L = new PicLesson();
    if (angle === 45) {
      L.show(rightTri(1, 1, '1', '1', '√2'));
      L.say('Cut a square of side 1 along its diagonal: a right triangle with two 45° angles, sides 1 and 1, and hypotenuse √2.');
    } else if (angle === 30 || angle === 60) {
      L.show(rightTri(Math.sqrt(3), 1, '√3', '1', '2'));
      L.say('Cut an equilateral triangle of side 2 in half: sides 1, √3 and 2, with angles 30°, 60° and 90°.');
    } else L.say(angle === 0 ? 'At 0° the opposite side has shrunk to nothing; the adjacent side equals the hypotenuse.' : 'At 90° the opposite side equals the hypotenuse; the adjacent side has shrunk to nothing.');
    L.say(`${fn} ${angle}° = ${fn === 'sin' ? 'opposite ÷ hypotenuse' : fn === 'cos' ? 'adjacent ÷ hypotenuse' : 'opposite ÷ adjacent'}.`, `${fn} ${angle}° = ${ans}`);
    return L.end(ans, `So ${fn} ${angle}° = ${ans}.`);
  };
  return made(`${fn} ${angle}° = ?`, ans, pickN(r, pool, 3), {
    hint: 'Half a square gives 45°; half an equilateral triangle gives 30° and 60°.',
    teach: () => withWays(triangle(), 'Draw the triangle', 'trig', []),
    exact: true,
  });
}, { format: 'choice' });

add('s7.special', 'heights', 'shape', 'Heights and distances', (r) => {
  const ang = r.pick([30, 45, 60]);
  const dist = r.pick([10, 20, 30, 40, 50]) * (ang === 30 ? 3 : 1);
  const ans = ang === 45 ? `${dist}` : ang === 60 ? `${dist}√3` : `${dist / 3}√3`;
  const wrong = ang === 45 ? [`${dist}√3`, `${dist / 2}`, `${dist * 2}`] : ang === 60 ? [`${dist}`, `${dist / 3}√3`, `${dist}/√3`.replace('/√3', '√3 ÷ 3')] : [`${dist}√3`, `${dist}`, `${dist / 3}`];
  const v: MathVisual = { kind: 'geo', w: 10, h: 6, segs: [{ a: [0.5, 0.5], b: [9, 0.5] }, { a: [9, 0.5], b: [9, 5.5], style: 'bold' }, { a: [0.5, 0.5], b: [9, 5.5], style: 'dash' }], arcs: [{ at: [0.5, 0.5], a0: 0, a1: 30, label: `${ang}°`, r: 1.4 }, { at: [9, 0.5], a0: 90, a1: 180, right: true }], labels: [{ at: [4.7, -0.2], t: `${dist} m` }, { at: [9.6, 3], t: 'h', ask: true }] };
  return made(`From ${dist} m away, the top of a tower is seen at an angle of ${ang}° above the ground. How tall is the tower? (m)`, ans, wrong, {
    visual: v,
    hint: 'tan(angle) = height ÷ distance.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('The ground, the tower and the line of sight make a right triangle. The height is opposite the angle; the distance is next to it.');
      L.say('So tan(angle) = height ÷ distance, and height = distance × tan(angle).', `h = ${dist} × tan ${ang}° = ${dist} × ${SPECIAL.tan[ang]}`);
      if (ang === 30) L.say('1/√3 = √3/3, so', `h = ${dist}√3 ÷ 3 = ${dist / 3}√3`);
      return L.end(ans, `So the tower is ${ans} m tall.`);
    },
    exact: true,
  });
}, { format: 'choice' });

// ── Coordinate geometry ───────────────────────────────────────────────────
add('s7.simul', 'distance', 'shape', 'Distance and midpoint', (r, d) => {
  const [a, b, c] = r.pick(TRIPLES.slice(0, 5).filter(([x, y]) => x <= 8 && y <= 12));
  const A: Pt = [r.int(-4, 0), r.int(-3, 0)];
  const flip = r.chance(0.5);
  const B: Pt = flip ? [A[0] + a, A[1] + b] : [A[0] + b, A[1] + a];
  const mid = d >= 0.5 && r.chance(0.5);
  const big = Math.max(...B.map(Math.abs), ...A.map(Math.abs)) + 1;
  const v: MathVisual = { kind: 'coord', min: -Math.max(5, big), max: Math.max(5, big), pts: [{ at: A, label: 'A' }, { at: B, label: 'B' }], seg: [A, B] };
  if (mid) {
    const M: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const ans = pt(M);
    return made(`Find the midpoint of A${pt(A)} and B${pt(B)}.`, ans, [pt([B[0] - A[0], B[1] - A[1]]), pt([(A[0] + B[1]) / 2, (A[1] + B[0]) / 2]), pt([M[0] + 1, M[1]])].filter((x) => x !== ans), {
      visual: v,
      hint: 'Average the x values, and average the y values.',
      teach: () => {
        const L = new PicLesson();
        L.show({ ...v, pts: [...(v.kind === 'coord' ? v.pts ?? [] : []), { at: M, label: 'M', hl: true }] } as MathVisual);
        L.say('The midpoint is halfway along: average the x values, then the y values.', `x: (${m(A[0])} + ${m(B[0])}) ÷ 2 = ${m(M[0])},  y: (${m(A[1])} + ${m(B[1])}) ÷ 2 = ${m(M[1])}`);
        return L.end(ans, `So the midpoint is ${ans}.`);
      },
      exact: true,
    });
  }
  const dx = B[0] - A[0], dy = B[1] - A[1];
  return made(`How far apart are A${pt(A)} and B${pt(B)}?`, c, nums(r, c, [dx + dy, dx * dx + dy * dy]), {
    visual: v,
    hint: 'Draw the right triangle under the line, then use Pythagoras.',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, tri: [A, [B[0], A[1]], B] } as MathVisual);
      L.say('Draw a right triangle under AB: across, then up.', `across: ${m(B[0])} − ${m(A[0])} = ${dx},  up: ${m(B[1])} − ${m(A[1])} = ${dy}`);
      L.say('Pythagoras:', `AB² = ${dx}² + ${dy}² = ${dx * dx + dy * dy}`);
      L.say('Square root:', `AB = √${dx * dx + dy * dy} = ${c}`);
      return L.end(c, `So they are ${c} units apart.`);
    },
  });
}, { format: 'choice' });

add('s7.distance', 'tangents', 'shape', 'Tangents', (r) => {
  const [a, b, c] = r.pick(TRIPLES.slice(0, 5));
  // radius a, tangent length b, distance from centre c.
  const O: Pt = [3, 4];
  const s = 2.6 / a;
  const P: Pt = [O[0] + c * s, O[1]];
  const ang = Math.atan2(b, a);
  const T: Pt = [O[0] + a * s * Math.cos(ang), O[1] + a * s * Math.sin(ang)];
  const v: MathVisual = { kind: 'geo', w: Math.max(10, P[0] + 1), h: 8, segs: [{ a: O, b: T, style: 'dash' }, { a: T, b: P, style: 'bold' }, { a: O, b: P }], circles: [{ c: O, r: a * s }], dots: [O, T, P], labels: [{ at: [(O[0] + T[0]) / 2 - 0.4, (O[1] + T[1]) / 2 + 0.3], t: `${a}` }, { at: [(O[0] + P[0]) / 2, O[1] - 0.6], t: `${c}` }, { at: [(T[0] + P[0]) / 2 + 0.4, (T[1] + P[1]) / 2 + 0.4], t: '?', ask: true }] };
  return made(`A circle has radius ${a} cm. A point P is ${c} cm from the centre. How long is the tangent from P to the circle? (cm)`, b, nums(r, b, [c - a, c + a]), {
    visual: v,
    hint: 'A tangent meets the radius at a right angle.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('A tangent touches the circle at one point, at right angles to the radius. So the radius, the tangent and the line to the centre make a right triangle.');
      L.say('The line to the centre is the hypotenuse.', `tangent² = ${c}² − ${a}² = ${c * c - a * a}`);
      L.say('Square root:', `√${c * c - a * a} = ${b}`);
      return L.end(b, `So the tangent is ${b} cm long.`);
    },
  });
});

add('s7.simpsurd', 'simtri', 'shape', 'Similar triangles (basic proportionality)', (r) => {
  const ad = r.int(2, 6), db = r.int(2, 6), k = r.int(1, 3);
  const ae = ad * k, ec = db * k;
  const A: Pt = [3, 6], B: Pt = [0.5, 0.5], C: Pt = [9, 0.5];
  const t = ad / (ad + db);
  const D: Pt = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  const E: Pt = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
  const v: MathVisual = { kind: 'geo', w: 10, h: 6.8, segs: [{ a: A, b: B }, { a: B, b: C, par: 1 }, { a: C, b: A }, { a: D, b: E, par: 1 }], dots: [A, B, C, D, E], labels: [{ at: [A[0], A[1] + 0.5], t: 'A', small: true }, { at: [B[0] - 0.3, B[1] - 0.4], t: 'B', small: true }, { at: [C[0] + 0.3, C[1] - 0.4], t: 'C', small: true }, { at: [D[0] - 0.5, D[1]], t: 'D', small: true }, { at: [E[0] + 0.5, E[1]], t: 'E', small: true }] };
  return made(`In triangle ABC, DE is parallel to BC. AD = ${ad} cm, DB = ${db} cm and AE = ${ae} cm. Find EC. (cm)`, ec, nums(r, ec, [ae + db - ad, db]), {
    visual: v,
    hint: 'A line parallel to one side cuts the other two sides in the same ratio.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('A line parallel to BC cuts AB and AC in the same ratio.', `AD/DB = AE/EC`);
      L.say('Put the numbers in.', `${ad}/${db} = ${ae}/EC`);
      L.say('Cross-multiply.', `EC = ${ae} × ${db} ÷ ${ad} = ${ec}`);
      return L.end(ec, `So EC = ${ec} cm.`);
    },
  });
});

// ── Algebra ───────────────────────────────────────────────────────────────
add('s7.evalpoly', 'ap', 'algebra', 'Arithmetic progressions', (r, d) => {
  const a = r.int(-5, 12), dd = r.pick([2, 3, 4, 5, 7, -2, -3]);
  const terms = [a, a + dd, a + 2 * dd, a + 3 * dd];
  const seq = terms.map(m).join(', ');
  const sum = d >= 0.5 && r.chance(0.5);
  const n = r.int(10, 30);
  const nth = a + (n - 1) * dd;
  if (sum) {
    const S = (n * (2 * a + (n - 1) * dd)) / 2;
    return made(`Find the sum of the first ${n} terms of ${seq}, …`, S, nearNumbers(r, S, [n * nth, S + nth]), {
      hint: 'Pair the first and last terms.',
      teach: () => withWays((() => {
        const L = new LessonBuilder();
        L.say(`The ${n}th term is a + (n − 1)d.`, `${m(a)} + ${n - 1} × ${m(dd)} = ${m(nth)}`);
        L.say('Pair the first and last, the second and second-last…: every pair has the same total.', `${m(a)} + ${m(nth)} = ${m(a + nth)}`);
        L.say(`${n} terms make ${n / 2} pairs.`, `${n} ÷ 2 × ${m(a + nth)} = ${m(S)}`);
        return L.end(S, `So the sum is ${m(S)}.`);
      })(), 'Pair them up', 'ap', [['The formula', () => {
        const L = new LessonBuilder();
        L.say('S = n/2 × (2a + (n − 1)d).', `${n}/2 × (2 × ${m(a)} + ${n - 1} × ${m(dd)}) = ${m(S)}`);
        return L.end(S, `So the sum is ${m(S)}.`);
      }]]),
    });
  }
  return made(`What is the ${n}th term of ${seq}, …?`, nth, nearNumbers(r, nth, [a + n * dd, n * dd]), {
    hint: 'nth term = first term + (n − 1) × the common difference.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'strip', cells: [...terms.map(m), '…'], hl: 0, to: 3 });
      L.say(`It starts at ${m(a)} and goes up by ${m(dd)} each time.`);
      L.say(`To reach term ${n} you make ${n - 1} jumps of ${m(dd)}.`, `${m(a)} + ${n - 1} × ${m(dd)} = ${m(nth)}`);
      return L.end(nth, `So the ${n}th term is ${m(nth)}.`);
    },
  });
}, { format: 'pad-ext' });

const quad = (a: number, b: number, c: number) => `${a === 1 ? '' : a === -1 ? '−' : m(a)}x² ${b < 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x ${c < 0 ? '−' : '+'} ${Math.abs(c)}`;
add('s7.solvequad', 'roots', 'algebra', 'Nature of roots', (r) => {
  const kind = r.int(0, 2);
  let a = r.int(1, 3), b = r.int(-9, 9), c = r.int(-9, 9);
  if (kind === 1) { const p = r.int(1, 5) * (r.chance(0.5) ? 1 : -1); a = 1; b = -2 * p; c = p * p; }
  for (let t = 0; t < 100 && (kind === 0 ? b * b - 4 * a * c <= 0 : kind === 2 ? b * b - 4 * a * c >= 0 : false); t++) { b = r.int(-9, 9); c = r.int(-9, 9); }
  if (b === 0) b = 1;
  const D = b * b - 4 * a * c;
  const ans = D > 0 ? 'two different real roots' : D === 0 ? 'two equal real roots' : 'no real roots';
  return made(`How many real roots does ${quad(a, b, c)} = 0 have?`, ans, ['two different real roots', 'two equal real roots', 'no real roots'].filter((x) => x !== ans), {
    hint: 'Work out the discriminant, b² − 4ac.',
    teach: () => {
      const L = new LessonBuilder();
      L.say(`Here a = ${m(a)}, b = ${m(b)}, c = ${m(c)}. The discriminant b² − 4ac decides.`, `${m(b)}² − 4 × ${m(a)} × ${c < 0 ? `(${m(c)})` : c} = ${m(D)}`);
      L.say(D > 0 ? 'Positive: the square root exists and ± gives two different roots.' : D === 0 ? 'Zero: ± 0 gives the same root twice.' : 'Negative: there is no real square root.');
      return L.end(ans, `So it has ${ans}.`);
    },
  });
}, { format: 'choice' });

add('s7.roots', 'zeros', 'algebra', 'Zeros of a quadratic', (r) => {
  const p = r.int(-6, 6) || 2, q = r.int(-6, 6) || -3, a = r.pick([1, 1, 2, 3]);
  const b = -a * (p + q), c = a * p * q;
  const sum = r.chance(0.5);
  const ans = sum ? frac(-b, a) : frac(c, a);
  return made(`For ${quad(a, b === 0 ? 1 : b, c)}, what is the ${sum ? 'sum' : 'product'} of the zeros?`.replace(/\+ 0\b/, ''), b === 0 && sum ? frac(-1, a) : ans, [frac(b, a), frac(-c, a), frac(c, 1)].filter((x) => x !== ans), {
    hint: 'Sum of zeros = −b/a; product = c/a.',
    teach: () => {
      const bb = b === 0 ? 1 : b;
      const res = sum ? frac(-bb, a) : frac(c, a);
      const L = new LessonBuilder();
      L.say(`For ax² + bx + c, the zeros add up to −b/a and multiply to c/a. Here a = ${a}, b = ${m(bb)}, c = ${m(c)}.`);
      L.say(sum ? 'Sum:' : 'Product:', sum ? `−(${m(bb)}) ÷ ${a} = ${res.replace('-', '−')}` : `${m(c)} ÷ ${a} = ${res.replace('-', '−')}`);
      return L.end(res, `So the ${sum ? 'sum' : 'product'} is ${res.replace('-', '−')}.`);
    },
  });
}, { format: 'pad-ext' });

// ── Mensuration ───────────────────────────────────────────────────────────
add('s7.ratioadv', 'sector', 'measure', 'Sectors and arcs', (r) => {
  const ang = r.pick([90, 60, 45, 180, 120]);
  const rr = ang === 45 ? 14 : ang === 120 ? 21 : 7 * r.int(1, 3) * (ang === 60 ? 3 : 1);
  const area = r.chance(0.5);
  const fracs = frac(ang, 360);
  const full = area ? (22 / 7) * rr * rr : 2 * (22 / 7) * rr;
  const ans = (ang / 360) * full;
  const C: Pt = [5, 5];
  const v: MathVisual = { kind: 'geo', w: 10, h: 10, segs: [{ a: C, b: [9.2, 5] }, { a: C, b: [5 + 4.2 * Math.cos((ang * Math.PI) / 180), 5 + 4.2 * Math.sin((ang * Math.PI) / 180)] }], circles: [{ c: C, r: 4.2, style: 'dash' }], arcs: [{ at: C, a0: 0, a1: ang, r: 4.2, hl: true }, { at: C, a0: 0, a1: ang, label: `${ang}°`, r: 0.8 }], labels: [{ at: [7.1, 4.4], t: `r = ${rr}` }] };
  if (!Number.isInteger(ans)) return made(`Take π = 22/7. Find the area of a quarter circle of radius 14 cm. (cm²)`, 154, [616, 22, 44], { teach: () => { const L = new LessonBuilder(); L.say('Quarter of 22/7 × 14 × 14 = 616.', '616 ÷ 4 = 154'); return L.end(154, 'So it is 154 cm².'); } });
  return made(`Take π = 22/7. A sector has radius ${rr} cm and angle ${ang}°. What is its ${area ? 'area (cm²)' : 'arc length (cm)'}?`, ans, nums(r, ans, [full, (ang / 360) * (area ? 2 * (22 / 7) * rr : (22 / 7) * rr * rr)]), {
    visual: v,
    hint: `The sector is ${ang}/360 of the whole circle.`,
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say(`${ang}° out of 360° is ${fracs} of the whole circle.`);
      L.say(area ? 'Area of the whole circle:' : 'Circumference of the whole circle:', area ? `22/7 × ${rr} × ${rr} = ${full}` : `2 × 22/7 × ${rr} = ${full}`);
      L.say(`Take ${fracs} of it.`, `${full} × ${fracs} = ${ans}`);
      return L.end(ans, `So the ${area ? 'area' : 'arc length'} is ${ans} ${area ? 'cm²' : 'cm'}.`);
    },
  });
});

add('s7.sector', 'solids', 'measure', 'Cones, spheres and hemispheres', (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const rr = 7 * r.int(1, 2), h = 3 * r.int(2, 8);
    const vol = (1 / 3) * (22 / 7) * rr * rr * h;
    return made(`Take π = 22/7. A cone has radius ${rr} cm and height ${h} cm. What is its volume? (cm³)`, Math.round(vol), nums(r, Math.round(vol), [Math.round(vol * 3), Math.round(vol / 2)]), {
      visual: { kind: 'cone', solid: 'cone', r: `${rr}`, h: `${h}` },
      hint: 'A cone is one third of the cylinder it fits in.',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'cone', solid: 'cone', r: `${rr}`, h: `${h}` });
        L.say('A cone holds exactly one third of the cylinder with the same base and height: three cones of water fill it.');
        L.say('V = ⅓ × π r² h', `⅓ × 22/7 × ${rr} × ${rr} × ${h} = ${Math.round(vol)}`);
        return L.end(Math.round(vol), `So the volume is ${Math.round(vol)} cm³.`);
      },
    });
  }
  const rr = 7 * r.int(1, 2);
  if (kind === 1) {
    const sa = 4 * (22 / 7) * rr * rr;
    return made(`Take π = 22/7. What is the surface area of a sphere of radius ${rr} cm? (cm²)`, sa, nums(r, sa, [sa / 4, sa / 2]), {
      visual: { kind: 'cone', solid: 'sphere', r: `${rr}`, h: '' },
      hint: 'A sphere’s surface is 4 circles of the same radius: 4πr².',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'cone', solid: 'sphere', r: `${rr}`, h: '' });
        L.say('Peel an orange: its skin exactly covers 4 circles as wide as the orange.', `4 × 22/7 × ${rr} × ${rr} = ${sa}`);
        return L.end(sa, `So the surface area is ${sa} cm².`);
      },
    });
  }
  if (kind === 2) {
    const rr2 = 21;
    const vol = (2 / 3) * (22 / 7) * rr2 ** 3;
    return made(`Take π = 22/7. What is the volume of a hemisphere of radius ${rr2} cm? (cm³)`, vol, nums(r, vol, [vol * 2, vol / 2]), {
      visual: { kind: 'cone', solid: 'hemisphere', r: `${rr2}`, h: '' },
      hint: 'Half of a sphere: ⅔ π r³.',
      teach: () => {
        const L = new LessonBuilder();
        L.say('A sphere is 4/3 π r³; a hemisphere is half of it: 2/3 π r³.');
        L.say('Put in r = 21.', `2/3 × 22/7 × 21 × 21 × 21 = ${vol}`);
        return L.end(vol, `So the volume is ${vol} cm³.`);
      },
    });
  }
  const l = r.pick([10, 15, 25]);
  const csa = (22 / 7) * rr * l;
  return made(`Take π = 22/7. A cone has radius ${rr} cm and slant height ${l} cm. What is its curved surface area? (cm²)`, csa, nums(r, csa, [csa * 2, (22 / 7) * rr * rr]), {
    visual: { kind: 'cone', solid: 'cone', r: `${rr}`, h: '', l: `${l}` },
    hint: 'Curved surface of a cone = π r l.',
    teach: () => {
      const L = new LessonBuilder();
      L.say('Unroll the cone’s side: it is a sector of a circle of radius l. Its area works out to π r l.', `22/7 × ${rr} × ${l} = ${csa}`);
      return L.end(csa, `So the curved surface area is ${csa} cm².`);
    },
  });
});

add('s7.solids', 'avgspeed', 'measure', 'Average speed for a round trip', (r) => {
  const pairs: [number, number][] = [[30, 60], [40, 60], [20, 30], [60, 90], [30, 45], [40, 120], [45, 90]];
  const [a, b] = r.pick(pairs);
  const D = (a * b) / gcdN(a, b) * r.int(1, 2);
  const t1 = D / a, t2 = D / b;
  const avg = (2 * D) / (t1 + t2);
  return made(`A bus goes ${D} km to a town at ${a} km/h and comes back at ${b} km/h. What is its average speed for the whole trip? (km/h)`, num(avg), [num((a + b) / 2), num(avg + 2), num(b)].filter((x) => x !== num(avg)), {
    visual: { kind: 'speed', dist: `${D} km each way`, legs: [{ label: 'There:', time: `${a} km/h` }, { label: 'Back:', time: `${b} km/h` }] },
    hint: 'Average speed = total distance ÷ total time (not the middle of the two speeds).',
    teach: () => withWays((() => {
      const L = new LessonBuilder();
      L.say('Find the time for each way.', `${D} ÷ ${a} = ${num(t1)} h,  ${D} ÷ ${b} = ${num(t2)} h`);
      L.say('Total distance ÷ total time.', `${2 * D} ÷ ${num(t1 + t2)} = ${num(avg)}`);
      L.say(`It is less than ${(a + b) / 2}: the bus spends longer at the slower speed.`);
      return L.end(num(avg), `So the average speed is ${num(avg)} km/h.`);
    })(), 'Total ÷ total', 'speed', [['2ab ÷ (a + b)', () => {
      const L = new LessonBuilder();
      L.say('For the same distance both ways, average speed = 2ab ÷ (a + b).', `2 × ${a} × ${b} ÷ (${a} + ${b}) = ${num(avg)}`);
      return L.end(num(avg), `So it is ${num(avg)} km/h.`);
    }]]),
  });
}, { format: 'pad-ext' });
function gcdN(a: number, b: number): number { return b ? gcdN(b, a % b) : a; }

// ── Data and chance ───────────────────────────────────────────────────────
add('s7.pctchain', 'grouped', 'data', 'Grouped data', (r) => {
  const width = 10;
  const starts = [0, 10, 20, 30, 40];
  const modal = r.chance(0.5);
  for (let t = 0; t < 300; t++) {
    const fs = starts.map(() => r.int(2, 12));
    const sf = fs.reduce((a, b) => a + b, 0);
    const mids = starts.map((s) => s + width / 2);
    const sfx = mids.reduce((a, x, i) => a + x * fs[i], 0);
    const rows = starts.map((s, i) => [`${s}–${s + width}`, String(fs[i])]);
    if (modal) {
      const top = Math.max(...fs);
      if (fs.filter((f) => f === top).length > 1) continue;
      const k = fs.indexOf(top);
      const ans = `${starts[k]}–${starts[k] + width}`;
      return made('Marks of a class are grouped in this table. Which is the modal class?', ans, rows.map((x) => x[0]).filter((x) => x !== ans).slice(0, 3), {
        visual: { kind: 'table', head: ['Marks', 'Students'], rows },
        hint: 'The modal class has the highest frequency.',
        teach: () => {
          const L = new PicLesson();
          L.show({ kind: 'table', head: ['Marks', 'Students'], rows, hl: [[k, 0], [k, 1]] });
          L.say(`The modal class is the group with the most students: ${top}.`);
          return L.end(ans, `So the modal class is ${ans}.`);
        },
        exact: true,
      });
    }
    if (sfx % sf) continue;
    const mean = sfx / sf;
    return made('Marks of a class are grouped in this table. Use the middle of each class to estimate the mean mark.', mean, nums(r, mean, [Math.round(sf / 5), 25]), {
      visual: { kind: 'table', head: ['Marks', 'Students'], rows },
      hint: 'Use each class’s midpoint: Σ(f × x) ÷ Σf.',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'table', head: ['Marks', 'Mid x', 'f', 'f × x'], rows: starts.map((s, i) => [`${s}–${s + width}`, String(mids[i]), String(fs[i]), String(mids[i] * fs[i])]) });
        L.say('Every student in a class is counted at its midpoint.', `Σ f × x = ${sfx}`);
        L.say('Divide by the number of students.', `${sfx} ÷ ${sf} = ${mean}`);
        return L.end(mean, `So the mean is about ${mean}.`);
      },
    });
  }
  return made('Which is the modal class of 0–10: 4, 10–20: 9, 20–30: 6?', '10–20', ['0–10', '20–30'], { exact: true });
}, { format: 'choice' });

const CARD_EVENTS: [string, number][] = [['a king', 4], ['a red card', 26], ['a heart', 13], ['a face card (J, Q or K)', 12], ['an ace', 4], ['a black queen', 2], ['a red king', 2], ['a spade', 13]];
add('s7.grouped', 'cards', 'data', 'Probability with cards and dice', (r) => {
  if (r.chance(0.6)) {
    const [what, n] = r.pick(CARD_EVENTS);
    const ans = frac(n, 52);
    return made(`One card is drawn from a full pack of 52. What is the probability it is ${what}?`, ans, [frac(n, 13), `1/${n}`, frac(n + 1, 52)].filter((x) => x !== ans), {
      visual: { kind: 'cards', cards: ['K♥', 'Q♠', 'A♦', '7♣'] },
      hint: '52 cards: 4 suits of 13, half red and half black.',
      teach: () => {
        const L = new LessonBuilder();
        L.say('A pack has 52 cards: 4 suits (♥ ♦ red, ♠ ♣ black), each with A, 2 … 10, J, Q, K.');
        L.say(`Count the cards that are ${what}: ${n}.`, `${n}/52${ans !== `${n}/52` ? ` = ${ans}` : ''}`);
        return L.end(ans, `So the probability is ${ans}.`);
      },
    });
  }
  const events: [string, number[]][] = [['an even number', [2, 4, 6]], ['a number greater than 4', [5, 6]], ['a prime number', [2, 3, 5]], ['a multiple of 3', [3, 6]], ['a number less than 3', [1, 2]]];
  const [what, hits] = r.pick(events);
  const ans = frac(hits.length, 6);
  return made(`A dice is rolled. What is the probability of ${what}?`, ans, [frac(hits.length + 1, 6), frac(Math.max(1, hits.length - 1), 6), `${hits.length}/5`].filter((x) => x !== ans), {
    visual: { kind: 'dice', faces: [1, 2, 3, 4, 5, 6] },
    hint: 'Six faces, all equally likely.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'dice', faces: hits });
      L.say(`Of the 6 faces, these are ${what}: ${hits.join(', ')}.`, `${hits.length}/6${ans !== `${hits.length}/6` ? ` = ${ans}` : ''}`);
      return L.end(ans, `So the probability is ${ans}.`);
    },
  });
}, { format: 'pad-ext' });
