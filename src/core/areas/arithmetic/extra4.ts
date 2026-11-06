// Stage 4 (ages 9–10): units with decimals, area and perimeter, L-shapes, volume, 24-hour
// clock and timetables, time units, map scale, bills; angles, protractors, quadrilaterals,
// coordinates and moves, nets, mirror pictures; line graphs, picture graphs with a key, chance.

import { extraSkills, made } from './extra.ts';
import { PicLesson, withWays, pickN } from '../../teach/pics.ts';
import { LessonBuilder, Line, lead } from '../../teach/build.ts';
import * as A from '../../teach/addsub.ts';
import * as M from '../../teach/muldiv.ts';
import { nearNumbers, num, uniqueWrong } from '../../question.ts';
import type { MathVisual, Pt, ShapeName } from '../../vis.ts';
import type { Rng } from '../../rng.ts';
import type { Lesson } from '../../teach/types.ts';
import { hm, addMin } from './extra3.ts';

const { list, add } = extraSkills(4, { format: 'choice', speedSec: 25 });
export const EXTRA4 = list;

const nums = (r: Rng, a: number, extra: number[] = []) => nearNumbers(r, a, extra, { min: 0 });
const pt = (p: Pt) => `(${p[0]}, ${p[1]})`;
const two = (n: number) => String(n).padStart(2, '0');

// ── Units with decimals ───────────────────────────────────────────────────
add('s4.dec10', 'unitdec', 'measure', 'Units with decimals', (r, d) => {
  const [big, small, k] = r.pick([['kg', 'g', 1000], ['l', 'ml', 1000], ['km', 'm', 1000], ['m', 'cm', 100], ['cm', 'mm', 10]] as [string, string, number][]);
  const back = d >= 0.5 && r.chance(0.4);
  const x = k === 10 ? r.int(11, 99) / 10 : r.pick([r.int(11, 99) / 10, r.int(101, 999) / 100]);
  const ans = Math.round(x * k);
  if (back) {
    return made(`${ans} ${small} = ? ${big}`, num(x), [num(ans / (k / 10)), num(ans / (k * 10)), num(x + 1)], {
      hint: `${k} ${small} = 1 ${big}, so divide by ${k}.`,
      teach: () => lead(`${k} ${small} make 1 ${big}, so divide by ${k}: every digit moves ${Math.log10(k)} places to the right.`, M.divTen(ans, k)),
    });
  }
  return made(`${num(x)} ${big} = ? ${small}`, ans, nums(r, ans, [Math.round(x * k / 10), Math.round(x * k * 10), Math.floor(x) * k + Math.round((x % 1) * 10)]), {
    hint: `1 ${big} = ${k} ${small}, so multiply by ${k}.`,
    teach: () => lead(`1 ${big} = ${k} ${small}, so multiply by ${k}: every digit moves ${Math.log10(k)} places to the left.`, M.timesTen(x, k)),
  }) as ReturnType<typeof made>;
}, { format: 'pad-ext' });

// ── Rectangles ────────────────────────────────────────────────────────────
add('s4.m22', 'rectpa', 'measure', 'Rectangle perimeter and area', (r, d) => {
  const w = r.int(3, d < 0.5 ? 9 : 15), h = r.int(2, d < 0.5 ? 7 : 12);
  const area = r.chance(0.5);
  const pts: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const v: MathVisual = { kind: 'poly', pts, labels: [String(w), String(h), null, null], unit: 'cm' };
  if (area) {
    return made(`A rectangle is ${w} cm long and ${h} cm wide. What is its area? (cm²)`, w * h, nums(r, w * h, [2 * (w + h), w + h]), {
      visual: v,
      hint: 'Area = rows × squares in each row.',
      teach: () => withWays((() => {
        const L = new PicLesson();
        L.show(w * h <= 60 ? { ...v, grid: true, squares: true } : v);
        L.say(`Cover it with 1 cm squares: ${h} rows of ${w}.`);
        L.say('Rows × squares in each row.', `${h} × ${w} = ${w * h}`);
        return L.end(w * h, `So the area is ${w * h} cm².`);
      })(), 'Rows of squares', 'area', []),
    });
  }
  const p = 2 * (w + h);
  return made(`A rectangle is ${w} cm long and ${h} cm wide. What is its perimeter? (cm)`, p, nums(r, p, [w * h, w + h]), {
    visual: v,
    hint: 'Add all four sides.',
    teach: () => withWays((() => {
      const L = new PicLesson();
      L.show({ ...v, labels: [String(w), String(h), String(w), String(h)], walk: true });
      L.say('Walk round the edge: the opposite sides are equal.', `${w} + ${h} + ${w} + ${h} = ${p}`);
      return L.end(p, `So the perimeter is ${p} cm.`);
    })(), 'Walk the edge', 'perim', [['2 × (length + width)', () => {
      const L = new PicLesson();
      L.show({ ...v, labels: [String(w), String(h), null, null] } as MathVisual);
      L.say('One long side and one short side go half way round.', `${w} + ${h} = ${w + h}`);
      L.show({ kind: 'bar', rows: [{ parts: [{ v: w + h, t: `${w} + ${h}`, tone: 0 }, { v: w + h, t: `${w} + ${h}`, tone: 1, new: true }], total: `2 × ${w + h} = ${p}` }] });
      L.say('Double it for all the way round.', `2 × ${w + h} = ${p}`);
      return L.end(p, `So the perimeter is ${p} cm.`);
    }]]),
  });
}, { format: 'pad' });

add('s4.rectpa', 'lshape', 'measure', 'Area of L-shapes', (r) => {
  const W = r.int(6, 12), H = r.int(5, 10), cw = r.int(2, W - 3), ch = r.int(2, H - 2);
  const pts: Pt[] = [[0, 0], [W, 0], [W, H - ch], [W - cw, H - ch], [W - cw, H], [0, H]];
  const labels = [String(W), String(H - ch), String(cw), String(ch), String(W - cw), String(H)];
  const v: MathVisual = { kind: 'poly', pts, labels, unit: 'cm' };
  const area = W * H - cw * ch;
  const a1 = W * (H - ch), a2 = (W - cw) * ch;
  const cut = (): Lesson => {
    const L = new PicLesson();
    L.show({ ...v, cut: [[0, H - ch], [W - cw, H - ch]], rects: [{ a: [0, 0], b: [W, H - ch], tone: 0 }, { a: [0, H - ch], b: [W - cw, H], tone: 1 }] });
    L.say('One straight cut makes two rectangles.');
    L.say('Blue part:', `${W} × ${H - ch} = ${a1}`);
    L.say(`Pink part: its sides are ${W - cw} and ${ch}.`, `${W - cw} × ${ch} = ${a2}`);
    L.say('Add the two parts.', `${a1} + ${a2} = ${area}`);
    return L.end(area, `So the area is ${area} cm².`);
  };
  const minus = (): Lesson => {
    const L = new PicLesson();
    L.show({ ...v, rects: [{ a: [W - cw, H - ch], b: [W, H], tone: 1 }] });
    L.say(`Fill in the missing corner to make one big ${W} by ${H} rectangle.`, `${W} × ${H} = ${W * H}`);
    L.say(`Take away the corner that isn't there: ${cw} by ${ch}.`, `${W * H} − ${cw * ch} = ${area}`);
    return L.end(area, `So the area is ${area} cm².`);
  };
  return made('What is the area of this shape? (cm²)', area, nums(r, area, [W * H, 2 * (W + H), area + cw * ch]), {
    visual: v,
    hint: 'Cut it into two rectangles.',
    teach: () => withWays(cut(), 'Cut into two', 'area', [['Big rectangle minus the corner', minus]]),
  });
}, { format: 'pad' });

add('s4.lshape', 'volcubes', 'measure', 'Volume by counting cubes', (r, d) => {
  const l = r.int(2, d < 0.5 ? 4 : 5), b = r.int(2, 3), h = r.int(2, d < 0.5 ? 3 : 4);
  const vol = l * b * h;
  return made(`How many cubes make this box? (${l} long, ${b} deep, ${h} high)`, vol, nums(r, vol, [l * b + h, l * b, 2 * (l * b + b * h + l * h)]), {
    visual: { kind: 'cuboid', l, b, h, cubes: true },
    hint: 'Count one layer, then times by the number of layers.',
    teach: () => withWays((() => {
      const L = new PicLesson();
      L.show({ kind: 'cuboid', l, b, h: 1, cubes: true, layers: true });
      L.say(`One layer is ${l} by ${b}.`, `${l} × ${b} = ${l * b}`);
      L.show({ kind: 'cuboid', l, b, h, cubes: true, layers: true });
      L.say(`Stack ${h} layers.`, `${l * b} × ${h} = ${vol}`);
      return L.end(vol, `So it takes ${vol} cubes.`);
    })(), 'Layers', 'volume', [['length × width × height', () => {
      const L = new PicLesson();
      L.show({ kind: 'cuboid', l, b, h, cubes: true, labels: [`${l} long`, `${b} deep`, `${h} high`] });
      L.say('Volume of a box = length × width × height.', `${l} × ${b} × ${h} = ${vol}`);
      return L.end(vol, `So it takes ${vol} cubes.`);
    }]]),
  });
}, { format: 'pad' });

// ── Time ──────────────────────────────────────────────────────────────────
add('s4.round1000', 'clock24', 'measure', '24-hour clock', (r) => {
  const H = r.int(0, 23), m = 5 * r.int(0, 11);
  const to12 = r.chance(0.6);
  const h12 = H % 12 === 0 ? 12 : H % 12;
  const ap = H < 12 ? 'am' : 'pm';
  const t24 = `${two(H)}:${two(m)}`;
  const t12 = `${h12}:${two(m)} ${ap}`;
  const lesson = (): Lesson => {
    const L = new PicLesson();
    L.show({ kind: 'digital', text: t24, sub: '24-hour clock' });
    L.say('The 24-hour clock counts the hours from midnight: 00:00 to 23:59.');
    if (H === 0) L.say('00 is the hour after midnight, so it is 12 am.');
    else if (H < 12) L.say(`${two(H)} is before 12, so it is the morning: am.`);
    else if (H === 12) L.say('12 is midday, so it is 12 pm.');
    else L.say(`${H} is after 12: take away 12 for the afternoon or evening time.`, `${H} − 12 = ${h12}`);
    L.show({ kind: 'digital', text: t12 });
    return L.end(to12 ? t12 : t24, `So ${t24} is ${t12}.`);
  };
  if (to12) {
    const wrong = [`${h12}:${two(m)} ${ap === 'am' ? 'pm' : 'am'}`, `${(H + 2) % 12 || 12}:${two(m)} ${ap}`, `${H}:${two(m)} ${ap}`];
    return made(`${t24} on a 24-hour clock is what time?`, t12, wrong.filter((x) => x !== t12), { teach: lesson });
  }
  const wrong = [`${two(h12)}:${two(m)}`, `${two((H + 12) % 24)}:${two(m)}`, `${two((H + 1) % 24)}:${two(m)}`];
  return made(`Write ${t12} on a 24-hour clock.`, t24, wrong.filter((x) => x !== t24), { teach: lesson, exact: true });
});

add('s4.clock24', 'timetable', 'measure', 'Timetables', (r) => {
  const stops = pickN(r, ['Indore', 'Ujjain', 'Dewas', 'Bhopal', 'Sehore', 'Ratlam'], 4);
  const start = 6 * 60 + 5 * r.int(0, 36);
  const gaps = [5 * r.int(5, 14), 5 * r.int(4, 12), 5 * r.int(5, 15)];
  const times = [start];
  gaps.forEach((g) => times.push(times[times.length - 1] + g));
  const fmt = (t: number) => `${two(Math.floor(t / 60))}:${two(t % 60)}`;
  const rows = stops.map((s, i) => [s, fmt(times[i])]);
  const v: MathVisual = { kind: 'table', head: ['Bus stop', 'Time'], rows, title: 'Morning bus' };
  const [i, j] = pickN(r, [0, 1, 2, 3], 2).sort((a, b) => a - b);
  const dur = times[j] - times[i];
  const line = (): Lesson => {
    const L = new LessonBuilder();
    const ln = new Line('even');
    L.board = ln.b;
    const t0 = times[i], t1 = times[j];
    ln.pt(t0, 0, { label: fmt(t0), tone: 'start' });
    L.say(`The bus is at ${stops[i]} at ${fmt(t0)} and at ${stops[j]} at ${fmt(t1)}.`);
    const nextHour = Math.ceil(t0 / 60) * 60;
    if (nextHour > t0 && nextHour < t1) {
      ln.pt(nextHour, L.i, { label: fmt(nextHour) });
      ln.hop(t0, nextHour, L.i, `+${nextHour - t0}`);
      L.say(`Jump to the next hour, ${fmt(nextHour)}.`, `${nextHour - t0} minutes`);
      ln.pt(t1, L.i, { label: fmt(t1), tone: 'end' });
      ln.hop(nextHour, t1, L.i, `+${t1 - nextHour}`);
      L.say(`Then on to ${fmt(t1)}.`, `${nextHour - t0} + ${t1 - nextHour} = ${dur}`);
    } else {
      ln.pt(t1, L.i, { label: fmt(t1), tone: 'end' });
      ln.hop(t0, t1, L.i, `+${dur}`);
      L.say(`Count on from ${fmt(t0)} to ${fmt(t1)}.`, `${dur} minutes`);
    }
    return L.end(dur, `So the bus takes ${dur} minutes.`);
  };
  return made(`How many minutes does the bus take from ${stops[i]} to ${stops[j]}?`, dur, nums(r, dur, [dur + 40, Math.abs((times[j] % 60) - (times[i] % 60))]), {
    visual: v,
    hint: 'Find both times, then count on from the first to the second.',
    teach: () => withWays(line(), 'Time line', 'howlong', []),
  });
}, { format: 'pad' });

add('s4.mtens', 'hms', 'measure', 'Hours, minutes, seconds', (r) => {
  const kind = r.int(0, 2);
  const [big, small, k] = kind === 0 ? ['min', 's', 60] : kind === 1 ? ['h', 'min', 60] : ['day', 'h', 24];
  const a = r.int(1, kind === 2 ? 4 : 9), b = r.int(1, k - 1);
  const ans = a * k + b;
  return made(`${a} ${big} ${b} ${small} = ? ${small}`, ans, nums(r, ans, [a * 100 + b, a + b, a * 10 + b]), {
    hint: `1 ${big} = ${k} ${small}.`,
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'table', head: [big, small], rows: [['1', String(k)], [String(a), String(a * k)]] });
      L.say(`1 ${big} is ${k} ${small} (not 100!).`, `${a} × ${k} = ${a * k}`);
      L.say(`Add the extra ${b} ${small}.`, `${a * k} + ${b} = ${ans}`);
      return L.end(ans, `So it is ${ans} ${small}.`);
    },
  });
}, { format: 'pad' });

add('s4.hms', 'ymwd', 'measure', 'Years, months, weeks, days', (r) => {
  const kind = r.int(0, 2);
  const [big, small, k] = kind === 0 ? ['weeks', 'days', 7] : kind === 1 ? ['years', 'months', 12] : ['weeks', 'days', 7];
  const a = r.int(2, 9), b = r.int(1, k - 1);
  if (kind === 2) {
    const tot = a * k + b;
    return made(`${tot} days = ? weeks and ${b} days`, a, nums(r, a, [Math.round(tot / 10)]), {
      hint: 'How many 7s go into it?',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'bar', rows: [{ name: 'days', parts: [...Array.from({ length: a }, () => ({ v: 7, t: '7', sub: 'week', tone: 0 as const })), { v: b, t: String(b), tone: 1 as const }], total: `${tot} days` }] });
        L.say('A week is 7 days. Count how many whole 7s fit.', `${a} × 7 = ${a * 7}`);
        L.say('The days left over:', `${tot} − ${a * 7} = ${b}`);
        return L.end(a, `So ${tot} days = ${a} weeks and ${b} days.`);
      },
    });
  }
  const ans = a * k + b;
  return made(`${a} ${big} ${b} ${small} = ? ${small}`, ans, nums(r, ans, [a * 10 + b, a + b]), {
    hint: `1 ${big.slice(0, -1)} = ${k} ${small}.`,
    teach: () => {
      const L = new PicLesson();
      const one = big.slice(0, -1);
      const blocks = (n: boolean) => [...Array.from({ length: a }, () => ({ v: k, t: String(k), sub: `1 ${one}`, tone: 0 as const })), ...(n ? [{ v: b, t: String(b), tone: 1 as const, new: true }] : [])];
      L.show({ kind: 'bar', rows: [{ name: small, parts: blocks(false), total: `${a} × ${k} = ${a * k}` }] });
      L.say(`1 ${one} = ${k} ${small}.`, `${a} × ${k} = ${a * k}`);
      L.show({ kind: 'bar', rows: [{ name: small, parts: blocks(true), total: `${ans} ${small}` }] });
      L.say(`Add the ${b} ${small}.`, `${a * k} + ${b} = ${ans}`);
      return L.end(ans, `So it is ${ans} ${small}.`);
    },
  });
}, { format: 'pad' });

add('s4.ymwd', 'mapscale', 'measure', 'Map scale', (r) => {
  const k = r.pick([2, 5, 10, 20, 25, 50]);
  const cm = r.int(2, 12);
  const ans = cm * k;
  const town = pickN(r, ['Indore', 'Ujjain', 'Dewas', 'Mhow', 'Dhar'], 2);
  return made(`On a map, 1 cm stands for ${k} km. ${town[0]} and ${town[1]} are ${cm} cm apart on the map. How far apart are they really? (km)`, ans, nums(r, ans, [cm + k, ans / 10]), {
    hint: 'Each centimetre is the same number of kilometres.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'table', head: ['map', 'real'], rows: [['1 cm', `${k} km`], [`${cm} cm`, `${ans} km`]] });
      L.say(`Every 1 cm on the map is ${k} km for real.`);
      L.say(`${cm} cm is ${cm} lots of ${k} km.`, `${cm} × ${k} = ${ans}`);
      return L.end(ans, `So they are ${ans} km apart.`);
    },
  });
}, { format: 'pad' });

add('s4.paise', 'bills', 'measure', 'Bills and budgets with paise', (r, d) => {
  const a = r.int(1200, 9900) / 100, b = r.int(500, 4900) / 100;
  const pa = Math.round(a * 4) / 4, pb = Math.round(b * 4) / 4;
  const sub = d >= 0.5 && r.chance(0.5);
  if (sub) {
    const pay = pa + pb > 100 ? 200 : 100;
    const cost = pa;
    const ch = Math.round((pay - cost) * 100) / 100;
    return made(`A bill is ₹${cost.toFixed(2)}. You pay with ₹${pay}. How much change? (₹)`, num(ch), [num(ch + 1), num(Math.round((pay - Math.floor(cost)) * 100) / 100), num(ch - 0.5)], {
      hint: 'Change = what you pay − the bill.',
      teach: () => lead('Change is what you pay take away the bill. Line up the points.', A.columnSub(pay, cost, { money: true })),
    });
  }
  const tot = Math.round((pa + pb) * 100) / 100;
  return made(`A school bag costs ₹${pa.toFixed(2)} and a box of pens costs ₹${pb.toFixed(2)}. How much for both? (₹)`, num(tot), [num(tot + 1), num(tot - 1), num(Math.floor(pa) + Math.floor(pb) + ((pa % 1) + (pb % 1)) / 10)], {
    hint: 'Line up the decimal points, then add.',
    teach: () => lead('Line up the points: rupees under rupees, paise under paise.', A.columnAdd([pa, pb], { money: true })),
  });
}, { format: 'pad-ext' });

// ── Angles ────────────────────────────────────────────────────────────────
add('s4.d21r', 'angletype', 'shape', 'Acute, obtuse, reflex', (r) => {
  const kind = r.int(0, 4);
  const deg = [r.int(20, 80), 90, r.int(100, 170), 180, r.int(200, 330)][kind];
  const name = ['acute', 'right angle', 'obtuse', 'straight', 'reflex'][kind];
  return made('What kind of angle is this?', name, ['acute', 'right angle', 'obtuse', 'straight', 'reflex'].filter((x) => x !== name).slice(0, 3), {
    visual: { kind: 'angle', deg, rot: r.pick([0, 10, 30]) },
    hint: 'Compare with a right angle (90°) and a straight line (180°).',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'angle', deg, rot: 0, ref: deg !== 90 });
      L.say('Compare it with a right angle, 90°, the square corner.');
      L.say(['Smaller than a right angle: acute.', 'Exactly a square corner: a right angle.', 'Between a right angle and a straight line: obtuse.', 'A straight line is 180°: a straight angle.', 'More than a straight line (180°): reflex.'][kind]);
      return L.end(name, ['So it is an acute angle.', 'So it is a right angle.', 'So it is an obtuse angle.', 'So it is a straight angle.', 'So it is a reflex angle.'][kind]);
    },
  });
});

add('s4.angletype', 'protractor', 'shape', 'Read a protractor', (r) => {
  const deg = 5 * r.int(3, 33);
  return made('What angle does the protractor show? (degrees)', deg, nums(r, deg, [180 - deg, deg + 10]), {
    visual: { kind: 'protractor', deg },
    hint: 'Start from 0 on the arm along the bottom, then count round.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'protractor', deg, read: true });
      L.say('Put the centre on the corner and one arm on 0.');
      L.say(`Count round from 0 in tens, then fives: the other arm is at ${deg}.`);
      L.say(deg < 90 ? 'Check: it is smaller than a right angle, so the answer is below 90.' : deg > 90 ? 'Check: it is wider than a right angle, so the answer is above 90.' : 'Check: it is a square corner, 90.');
      return L.end(deg, `So the angle is ${deg}°.`);
    },
  });
}, { format: 'pad' });

add('s4.protractor', 'angline', 'shape', 'Angles on a line and at a point', (r, d) => {
  const atPoint = d >= 0.5 && r.chance(0.5);
  if (atPoint) {
    const a = 5 * r.int(10, 30), b = 5 * r.int(10, 30);
    const x = 360 - a - b;
    const c: Pt = [5, 4];
    const ray = (deg: number): Pt => [c[0] + 3.6 * Math.cos((deg * Math.PI) / 180), c[1] + 3.6 * Math.sin((deg * Math.PI) / 180)];
    const v: MathVisual = { kind: 'geo', w: 10, h: 8, segs: [{ a: c, b: ray(0), style: 'ray' }, { a: c, b: ray(a), style: 'ray' }, { a: c, b: ray(a + b), style: 'ray' }], arcs: [{ at: c, a0: 0, a1: a, label: `${a}°`, r: 0.9 }, { at: c, a0: a, a1: a + b, label: `${b}°`, r: 0.9 }, { at: c, a0: a + b, a1: 360, label: 'x', ask: true, r: 0.7 }], dots: [c] };
    return made('Find the angle x. (degrees)', x, nums(r, x, [180 - a - b, x + 10].filter((y) => y > 0)), {
      visual: v,
      hint: 'Angles all the way round a point make 360°.',
      teach: () => {
        const L = new PicLesson();
        L.show(v);
        L.say('All the way round a point is a full turn: 360°.');
        L.say('Take the angles you know away from 360.', `360 − ${a} − ${b} = ${x}`);
        return L.end(x, `So x = ${x}°.`);
      },
    });
  }
  const a = 5 * r.int(5, 31);
  const x = 180 - a;
  const c: Pt = [5, 1];
  const ray: Pt = [c[0] + 4 * Math.cos((a * Math.PI) / 180), c[1] + 4 * Math.sin((a * Math.PI) / 180)];
  const v: MathVisual = { kind: 'geo', w: 10, h: 5.4, segs: [{ a: [0.4, 1], b: [9.6, 1] }, { a: c, b: ray, style: 'ray' }], arcs: [{ at: c, a0: 0, a1: a, label: `${a}°`, r: 0.9 }, { at: c, a0: a, a1: 180, label: 'x', ask: true, r: 0.7 }], dots: [c] };
  return made('Find the angle x. (degrees)', x, nums(r, x, [360 - a, 90 - a > 0 ? 90 - a : a + 10]), {
    visual: v,
    hint: 'Angles on a straight line make 180°.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('A straight line is a half turn: 180°.');
      L.say(`So x and ${a}° make 180° together.`, `180 − ${a} = ${x}`);
      return L.end(x, `So x = ${x}°.`);
    },
  });
}, { format: 'pad' });

const QUADS: [ShapeName, string, string][] = [
  ['square', 'square', '4 equal sides and 4 right angles'], ['rectangle', 'rectangle', '4 right angles, opposite sides equal'], ['rhombus', 'rhombus', '4 equal sides, but no right angles'],
  ['parallelogram', 'parallelogram', 'two pairs of parallel sides, slanting'], ['trapezium', 'trapezium', 'just one pair of parallel sides'], ['kite', 'kite', 'two pairs of equal sides next to each other'],
];
add('s4.lakh', 'quads', 'shape', 'Triangles and quadrilaterals', (r) => {
  const [ans, ...rest] = pickN(r, QUADS, 3);
  const options: Record<string, MathVisual> = {};
  for (const q of [ans, ...rest]) options[q[1]] = { kind: 'shape', shape: q[0], color: r.pick(['yellow', 'teal', 'pink', 'orange']) };
  return made(`Which shape is a ${ans[1]}?`, ans[1], rest.map((x) => x[1]), {
    options,
    hint: `A ${ans[1]} has ${ans[2]}.`,
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'shape', shape: ans[0], color: 'yellow', sides: true });
      L.say(`A ${ans[1]} has ${ans[2]}.`);
      L.say(`Check each shape for that. Only one fits: ${rest.map((x) => `a ${x[1]} has ${x[2]}`).join('; ')}.`);
      return L.end(ans[1], `So the answer is the ${ans[1]}.`);
    },
  });
});

// ── Coordinates ───────────────────────────────────────────────────────────
add('s4.cmpbig', 'coords', 'shape', 'Coordinates', (r) => {
  const p: Pt = [r.int(1, 8), r.int(1, 8)];
  const e = r.pick(['⭐', '🍎', '🚗', '🏠']);
  const v: MathVisual = { kind: 'coord', min: 0, max: 9, pts: [{ at: p, e }] };
  const ans = pt(p);
  return made(`What are the coordinates of the ${e}?`, ans, [pt([p[1], p[0]]), pt([p[0] + 1, p[1]]), pt([p[0], p[1] - 1 || 2])].filter((x) => x !== ans), {
    visual: v,
    hint: 'Along the corridor first (x), then up the stairs (y).',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, walk: p });
      L.say(`Start at 0. Go along the corridor first: ${p[0]} across.`);
      L.say(`Then up the stairs: ${p[1]} up.`);
      return L.end(ans, `So the ${e} is at ${ans}: across first, then up.`);
    },
    exact: true,
  });
});

add('s4.coords', 'translate', 'shape', 'Move a shape on a grid', (r) => {
  const a: Pt = [r.int(1, 3), r.int(1, 3)];
  const tri: Pt[] = [a, [a[0] + 2, a[1]], [a[0], a[1] + 2]];
  const dx = r.int(1, 4), dy = r.int(-1, 3);
  const moved = tri.map(([x, y]) => [x + dx, y + dy] as Pt);
  const ans = pt(moved[0]);
  const v: MathVisual = { kind: 'coord', min: 0, max: 9, poly: tri, pts: [{ at: a, label: 'A' }] };
  const how = `${dx} right${dy ? ` and ${Math.abs(dy)} ${dy > 0 ? 'up' : 'down'}` : ''}`;
  return made(`The triangle moves ${how}. Where does corner A end up?`, ans, [pt([a[0] + dy, a[1] + dx]), pt([a[0] + dx, a[1]]), pt([a[0] - dx > 0 ? a[0] - dx : a[0] + dx + 1, a[1] + dy])].filter((x) => x !== ans), {
    visual: v,
    hint: 'Add to x for right, add to y for up.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say(`A starts at ${pt(a)}.`);
      L.show({ ...v, poly2: moved, pts: [{ at: a, label: 'A' }, { at: moved[0], label: 'A′', hl: true }] });
      L.say(`Right ${dx}: add ${dx} to x.${dy ? ` ${dy > 0 ? 'Up' : 'Down'} ${Math.abs(dy)}: ${dy > 0 ? 'add' : 'take'} ${Math.abs(dy)} ${dy > 0 ? 'to' : 'from'} y.` : ''}`, `(${a[0]} + ${dx}, ${a[1]}${dy ? (dy > 0 ? ` + ${dy}` : ` − ${-dy}`) : ''}) = ${ans}`);
      return L.end(ans, `So A ends up at ${ans}.`);
    },
    exact: true,
  });
});

// ── Nets and mirror pictures ──────────────────────────────────────────────
const GOOD_NETS: Pt[][] = [
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]], [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]], [[1, 0], [1, 1], [0, 1], [2, 1], [2, 2], [3, 2]], [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
];
const BAD_NETS: Pt[][] = [
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [2, 0]], [[0, 0], [1, 0], [1, 1], [2, 1], [1, 2], [0, 2]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3], [1, 4]].slice(0, 6) as Pt[], [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
];
add('s4.estimate', 'nets', 'shape', 'Which net makes a cube?', (r) => {
  const good = r.pick(GOOD_NETS);
  const bad = pickN(r, BAD_NETS, 2);
  const labels = r.shuffle(['A', 'B', 'C']);
  const options: Record<string, MathVisual> = { [labels[0]]: { kind: 'net', cells: good }, [labels[1]]: { kind: 'net', cells: bad[0] }, [labels[2]]: { kind: 'net', cells: bad[1] } };
  return made('Which net folds up into a cube?', labels[0], [labels[1], labels[2]], {
    options,
    hint: 'A cube needs 6 squares, and no two may land on the same face when folded.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'net', cells: good, fold: true });
      L.say('Pick one square to be the bottom. Fold the squares around it up to make the sides.');
      L.say('A cube net has 6 squares: each one becomes a different face, with no overlaps and no gaps.');
      L.show({ kind: 'solid', solid: 'cube', color: 'teal', hl: 'faces' });
      return L.end(labels[0], `So net ${labels[0]} makes a cube.`);
    },
  });
});

add('s4.nets', 'mirror', 'shape', 'Complete the mirror picture', (r) => {
  const w = 3, h = 4;
  const left: Pt[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (r.chance(0.45)) left.push([x, y]);
  if (left.length < 3) left.push([2, 0], [1, 1], [2, 3]);
  const mir = left.map(([x, y]) => [2 * w - 1 - x, y] as Pt);
  const copy = left.map(([x, y]) => [x + w, y] as Pt);
  const flipV = left.map(([x, y]) => [2 * w - 1 - x, h - 1 - y] as Pt);
  const same = (a: Pt[], b: Pt[]) => a.length === b.length && a.every((c) => b.some((x) => x[0] === c[0] && x[1] === c[1]));
  const toggle = (cells: Pt[], c: Pt): Pt[] => (cells.some(([x, y]) => x === c[0] && y === c[1]) ? cells.filter(([x, y]) => !(x === c[0] && y === c[1])) : [...cells, c]);
  const wrongs: Pt[][] = [];
  for (const c of [copy, flipV, toggle(mir, [w, 0]), toggle(mir, [2 * w - 1, h - 1]), toggle(toggle(mir, [w + 1, 1]), [w, 2])]) {
    if (!same(c, mir) && !wrongs.some((x) => same(x, c))) wrongs.push(c);
  }
  const labels = r.shuffle(['A', 'B', 'C']);
  const pic = (right: Pt[]): MathVisual => ({ kind: 'cells', w: 2 * w, h, on: [...left, ...right], mirror: { x: w }, color: 'pink' });
  const options: Record<string, MathVisual> = { [labels[0]]: pic(mir), [labels[1]]: pic(wrongs[0]), [labels[2]]: pic(wrongs[1]) };
  return made('The dashed line is a mirror. Which picture is finished correctly?', labels[0], [labels[1], labels[2]], {
    visual: { kind: 'cells', w: 2 * w, h, on: left, mirror: { x: w }, color: 'pink' },
    options,
    hint: 'Each square is the same distance from the mirror on the other side.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'cells', w: 2 * w, h, on: left, mirror: { x: w }, color: 'pink' });
      L.say('A square next to the mirror stays next to it. A square 2 away lands 2 away on the other side.');
      L.show({ kind: 'cells', w: 2 * w, h, on: left, ghost: mir, mirror: { x: w }, color: 'pink' });
      L.say('The picture flips over the line, like folding it.');
      return L.end(labels[0], `So picture ${labels[0]} is correct.`);
    },
  });
});

// ── Data ──────────────────────────────────────────────────────────────────
add('s5.dec2as', 'linegraph', 'data', 'Line graphs', (r, d) => {
  const hours = ['8 am', '10 am', '12 pm', '2 pm', '4 pm', '6 pm'];
  const base = r.int(14, 22);
  const vals = hours.map((_, i) => base + [0, 3, 6, 8, 6, 3][i] + r.int(-1, 1) * 2);
  const pts = hours.map((label, i) => ({ label, v: vals[i] }));
  const min = Math.floor((Math.min(...vals) - 2) / 2) * 2;
  const max = min + 20;
  const v: MathVisual = { kind: 'lineg', pts, step: 2, min, max, unit: '°C' };
  const i = r.int(0, 5);
  if (d < 0.5 || r.chance(0.5)) {
    return made(`What was the temperature at ${hours[i]}? (°C)`, vals[i], nums(r, vals[i], [vals[i] + 2, vals[i] - 2]), {
      visual: v,
      hint: 'Go up from the time, then across to the scale.',
      teach: () => {
        const L = new PicLesson();
        L.show({ ...v, hl: i });
        L.say(`Find ${hours[i]} along the bottom. Go up to the line, then across to the scale.`);
        return L.end(vals[i], `So it was ${vals[i]} °C.`);
      },
    });
  }
  const [a, b] = pickN(r, [0, 1, 2, 3, 4, 5], 2).sort((x, y) => x - y);
  const diff = Math.abs(vals[b] - vals[a]);
  return made(`By how many degrees did the temperature change from ${hours[a]} to ${hours[b]}?`, diff, nums(r, diff, [vals[a] + vals[b]]), {
    visual: v,
    hint: 'Read both temperatures, then find the difference.',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, hl: a });
      L.say(`At ${hours[a]}: ${vals[a]} °C.`);
      L.show({ ...v, hl: b });
      L.say(`At ${hours[b]}: ${vals[b]} °C.`, `${Math.max(vals[a], vals[b])} − ${Math.min(vals[a], vals[b])} = ${diff}`);
      return L.end(diff, `So it changed by ${diff} degrees.`);
    },
  });
}, { format: 'pad' });

add('s4.fracof', 'picgraphkey', 'data', 'Picture graphs with a key', (r) => {
  const key = r.pick([2, 4, 10]);
  const rows = pickN(r, [['Mon', '🍎'], ['Tue', '🍎'], ['Wed', '🍎'], ['Thu', '🍎'], ['Fri', '🍎']], 4).map(([label, e]) => ({ label, e, n: r.int(1, 6) + (r.chance(0.4) ? 0.5 : 0) }));
  const i = r.int(0, 3);
  const ans = rows[i].n * key;
  const v: MathVisual = { kind: 'picgraph', rows, key };
  return made(`Each 🍎 stands for ${key} apples sold. How many apples were sold on ${rows[i].label}?`, ans, nums(r, ans, [rows[i].n, Math.floor(rows[i].n) * key, Math.ceil(rows[i].n) * key]), {
    visual: v,
    hint: `Count the pictures, then times by ${key}. Half a picture is ${key / 2}.`,
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, hl: [i] });
      const whole = Math.floor(rows[i].n);
      L.say(`${rows[i].label} has ${whole} whole ${whole === 1 ? 'picture' : 'pictures'}${rows[i].n % 1 ? ' and a half' : ''}.`);
      L.say(`Each one is ${key}.`, `${whole} × ${key} = ${whole * key}${rows[i].n % 1 ? `, and half of ${key} is ${key / 2}` : ''}`);
      if (rows[i].n % 1) L.say('Add the half.', `${whole * key} + ${key / 2} = ${ans}`);
      return L.end(ans, `So ${ans} apples were sold.`);
    },
  });
}, { format: 'pad' });

const CHANCE = ['impossible', 'unlikely', 'even chance', 'likely', 'certain'];
add('s4.twostep', 'likely', 'data', 'Likely or impossible?', (r) => {
  const col = pickN(r, ['red', 'blue', 'green', 'yellow'], 2);
  const kind = r.int(0, 4);
  const total = r.pick([4, 6, 8, 10]);
  const n = [0, r.int(1, Math.floor(total / 2) - 1), total / 2, r.int(total / 2 + 1, total - 1), total][kind];
  const balls = r.shuffle([...Array(n).fill(col[0]), ...Array(total - n).fill(col[1])]);
  const ans = CHANCE[kind];
  return made(`You pick one marble from the bag without looking. How likely is it to be ${col[0]}?`, ans, CHANCE.filter((x) => x !== ans).slice(0, 3), {
    visual: { kind: 'bag', balls },
    hint: `Count the ${col[0]} marbles and compare with the rest.`,
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'bag', balls, hl: col[0] });
      L.say(`There are ${n} ${col[0]} out of ${total} marbles.`);
      L.say(n === 0 ? `There are no ${col[0]} ones, so you can't pick one.` : n === total ? `Every marble is ${col[0]}, so it is sure to happen.` : n * 2 === total ? 'Exactly half are that colour: an even chance.' : n * 2 < total ? 'Fewer than half are that colour.' : 'More than half are that colour.');
      return L.end(ans, `So it is ${ans}.`);
    },
  });
});

void uniqueWrong; void addMin; void hm;
