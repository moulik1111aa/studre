// Stage 3 (ages 7–8): clocks to the minute, how long, units, scales, perimeter and area,
// right angles and parallel lines, faces and edges, Roman numerals, bar charts and tables.

import { extraSkills, made } from './extra.ts';
import { PicLesson, withWays, pickN } from '../../teach/pics.ts';
import { Line, LessonBuilder, shiftBoard } from '../../teach/build.ts';
import { columnAdd } from '../../teach/addsub.ts';
import { nearNumbers } from '../../question.ts';
import type { BarPart, BarRow, MathVisual, Pt, SolidName } from '../../vis.ts';
import type { Rng } from '../../rng.ts';
import type { ColsBoard, ColsCell, Lesson, PicBoard } from '../../teach/types.ts';
import { MONTHS, notesFor } from './extra2.ts';

const { list, add } = extraSkills(3, { format: 'choice', speedSec: 20 });
export const EXTRA3 = list;
void notesFor;

const nums = (r: Rng, a: number, extra: number[] = []) => nearNumbers(r, a, extra, { min: 0 });
const two = (n: number) => String(n).padStart(2, '0');
export const hm = (h: number, m: number) => `${h}:${two(m)}`;
/** 12-hour clock hour after adding minutes. */
export const addMin = (h: number, m: number, add: number): [number, number] => {
  const t = (h % 12) * 60 + m + add;
  const hh = Math.floor(t / 60) % 12;
  return [hh === 0 ? 12 : hh, t % 60];
};

// ── Roman numerals ────────────────────────────────────────────────────────
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
add('s3.ba1000', 'roman', 'number', 'Roman numerals I–XX', (r, d) => {
  const n = r.int(1, d < 0.5 ? 12 : 20);
  const toRoman = r.chance(0.4);
  const parts = n >= 10 ? ['X', ROMAN[n - 10]].filter(Boolean) : [ROMAN[n]];
  const lesson = (): Lesson => {
    const L = new PicLesson();
    L.show({ kind: 'table', head: ['I', 'V', 'X'], rows: [['1', '5', '10']] });
    L.say('I is 1, V is 5 and X is 10.');
    const sub = /IV|IX/.test(ROMAN[n % 10] ?? '') || n === 9 || n === 4 || n === 14 || n === 19;
    L.say(sub ? 'A smaller letter before a bigger one is taken away: IV is 5 − 1 = 4, and IX is 10 − 1 = 9.' : 'Letters side by side are added: VI is 5 + 1, and XII is 10 + 1 + 1.');
    if (n > 10) L.say(`${n} is 10 and ${n - 10}.`, `${parts.join(' + ')} → ${ROMAN[n]}`);
    return L.end(toRoman ? ROMAN[n] : n, toRoman ? `So ${n} is ${ROMAN[n]}.` : `So ${ROMAN[n]} is ${n}.`);
  };
  if (toRoman) {
    const wrong = [ROMAN[n + 1] ?? 'XXI', ROMAN[Math.max(1, n - 1)], n === 4 ? 'IIII' : n === 9 ? 'VIIII' : ROMAN[(n + 5) % 21 || 1]];
    return { ...made(`Write ${n} in Roman numerals.`, ROMAN[n], wrong, { hint: 'I = 1, V = 5, X = 10.', teach: lesson, exact: true }), };
  }
  return made(`${ROMAN[n]} = ?`, n, nums(r, n, n === 4 || n === 9 || n === 14 || n === 19 ? [n + 2] : []), { hint: 'I = 1, V = 5, X = 10. A smaller letter in front is taken away.', teach: lesson });
}, { format: 'choice' });

// ── Clocks ────────────────────────────────────────────────────────────────
function clockLesson(h: number, m: number, ans: string): Lesson {
  const v: MathVisual = { kind: 'clock', h, m };
  const L = new PicLesson();
  L.show({ ...v, hl: 'hour' });
  L.say(`The short hand tells the hour. It is just past ${h}${m >= 45 ? `, nearly ${(h % 12) + 1}` : ''}.`);
  L.show({ ...v, hl: 'min', fives: true, sweep: [0, m] });
  const fives = Math.floor(m / 5);
  L.say(m % 5 ? `The long hand: count in fives to ${fives * 5}, then ${m % 5} more minutes.` : `The long hand: count round in fives from 12.`, m ? `${Array.from({ length: Math.min(fives, 6) }, (_, i) => (i + 1) * 5).join(', ')}${fives > 6 ? ' … ' + fives * 5 : ''}${m % 5 ? ` + ${m % 5} = ${m}` : ''}` : '0 minutes');
  return L.end(ans, `So the time is ${ans}.`);
}
function toLesson(h: number, m: number, ans: string): Lesson {
  const [nh] = addMin(h, m, 60 - m);
  const L = new PicLesson();
  L.show({ kind: 'clock', h, m, hl: 'min', sweep: [m, 60] });
  L.say(`The long hand is ${60 - m} minutes from 12. That is ${60 - m} minutes to ${nh}.`);
  L.say(`${60 - m} minutes to ${nh} is the same as ${h}:${two(m)}.`);
  return L.end(ans, `So the time is ${ans}.`);
}
add('s3.skip34', 'clock5', 'measure', 'Time to 5 minutes', (r) => {
  const h = r.int(1, 12);
  const m = 5 * r.int(1, 11);
  const ans = hm(h, m);
  const nh = (h % 12) + 1;
  const wrong = [hm(nh, m), hm(h, m + 5 > 55 ? m - 5 : m + 5), hm(m / 5 || 12, (h * 5) % 60)];
  return made('What time does the clock show?', ans, wrong.filter((x) => x !== ans), {
    visual: { kind: 'clock', h, m },
    hint: 'The short hand gives the hour. Count the long hand in fives from 12.',
    teach: () => withWays(clockLesson(h, m, ans), 'Count in fives', 'time', m > 30 ? [['Minutes to the hour', () => toLesson(h, m, ans)]] : []),
  });
}, { format: 'choice' });

// Clear clues only (morning, midday, evening), so am or pm comes from the words, not a guess.
const DAYTIME: [string, number, number, 'am' | 'pm'][] = [
  ['wakes up early in the morning', 5, 7, 'am'], ['eats breakfast in the morning', 7, 9, 'am'], ['has a maths class in the morning', 9, 11, 'am'], ['eats lunch just after midday', 12, 13, 'pm'],
  ['does homework in the afternoon', 3, 5, 'pm'], ['eats dinner in the evening', 7, 9, 'pm'], ['goes to bed at night', 8, 10, 'pm'],
];
add('s2.oddeven', 'clockmin', 'measure', 'Time to the minute; am and pm', (r, d) => {
  if (d >= 0.5 && r.chance(0.5)) {
    const [what, h0, h1, ap] = r.pick(DAYTIME);
    const h = r.int(h0, h1 - 1), m = r.int(0, 59);
    const name = r.pick(['Riya', 'Kabir', 'Meera', 'Arjun']);
    const ans = `${hm(h, m)} ${ap}`;
    const other = `${hm(h, m)} ${ap === 'am' ? 'pm' : 'am'}`;
    return made(`${name} ${what}. This clock shows the time. Write it with am or pm.`, ans, [other, `${hm((h % 12) + 1, m)} ${ap}`, `${hm(h, (m + 10) % 60)} ${ap}`], {
      visual: { kind: 'clock', h, m },
      hint: 'am is from midnight to midday; pm is from midday to midnight.',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'clock', h, m, hl: 'min', fives: true });
        L.say(`Read the clock: ${hm(h, m)}.`);
        L.show({ kind: 'clock', h, m, ampm: ap });
        L.say(ap === 'am' ? `The words say it is in the morning: before midday is am.` : `The words say it is after midday: from midday to midnight is pm.`);
        return L.end(ans, `So it is ${ans}.`);
      },
    });
  }
  const h = r.int(1, 12);
  let m = r.int(1, 59);
  if (m % 5 === 0) m++;
  const ans = hm(h, m);
  return made('What time does the clock show?', ans, [hm(h, (m + 5) % 60), hm((h % 12) + 1, m), hm(h, Math.max(1, m - 1))].filter((x) => x !== ans), {
    visual: { kind: 'clock', h, m },
    hint: 'Count the long hand in fives to the last big number, then count on in ones.',
    teach: () => withWays(clockLesson(h, m, ans), 'Fives then ones', 'time', m > 30 ? [['Minutes to the hour', () => toLesson(h, m, ans)]] : []),
  });
}, { format: 'choice' });

add('s3.make100', 'howlong', 'measure', 'How long?', (r, d) => {
  const h = r.int(1, 11);
  const m = 5 * r.int(d < 0.5 ? 0 : 2, 11);
  const dur = 5 * r.int(d < 0.5 ? 2 : 4, d < 0.5 ? 9 : 15);
  const [eh, em] = addMin(h, m, dur);
  const start = hm(h, m), end = hm(eh, em);
  const toHour = (60 - m) % 60;
  const lineWay = (): Lesson => {
    const L = new LessonBuilder();
    const ln = new Line('even');
    const t0 = h * 60 + m;
    const label = (t: number) => hm(Math.floor(t / 60) % 12 || 12, t % 60);
    ln.pt(t0, 0, { label: start, tone: 'start' });
    L.board = ln.b;
    L.say(`Put ${start} on a time line.`);
    if (toHour && toHour < dur) {
      ln.pt(t0 + toHour, L.i, { label: label(t0 + toHour) });
      ln.hop(t0, t0 + toHour, L.i, `+${toHour}`);
      L.say(`Jump to the next o'clock, ${label(t0 + toHour)}: that is ${toHour} minutes.`);
      ln.pt(t0 + dur, L.i, { label: end, tone: 'end' });
      ln.hop(t0 + toHour, t0 + dur, L.i, `+${dur - toHour}`);
      L.say(`Then on to ${end}: ${dur - toHour} more minutes.`, `${toHour} + ${dur - toHour} = ${dur}`);
    } else {
      ln.pt(t0 + dur, L.i, { label: end, tone: 'end' });
      ln.hop(t0, t0 + dur, L.i, `+${dur}`);
      L.say(`Count on from ${start} to ${end}.`, `${two(m)} → ${two(em)}: ${dur} minutes`);
    }
    return L.end(dur, `So it takes ${dur} minutes.`);
  };
  const clockWay = (): Lesson => {
    const L = new PicLesson();
    L.show({ kind: 'clock', h: eh, m: em, sweep: [m, m + dur > 60 ? em + 60 : em], fives: true });
    L.say(`Watch the long hand go from ${start} to ${end}, counting in fives.`);
    return L.end(dur, `It moves ${dur} minutes.`);
  };
  return made(`A film starts at ${start} and ends at ${end}. How many minutes long is it?`, dur, nums(r, dur, [Math.abs(em - m), dur + 40, 60 - dur]), {
    visual: { kind: 'pair', a: { kind: 'clock', h, m }, b: { kind: 'clock', h: eh, m: em }, la: 'Start', lb: 'End' },
    hint: 'Jump to the next o’clock first, then count on.',
    teach: () => withWays(lineWay(), 'Time line', 'howlong', dur <= 55 ? [['Watch the clock', clockWay]] : []),
  });
});

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const monthLen = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
add('s3.howlong', 'monthdays', 'measure', 'Days in each month', (r, d) => {
  const feb = d >= 0.5 && r.chance(0.4);
  const m = feb ? 1 : r.pick([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const y = feb ? r.int(2025, 2040) : 2027;
  const n = monthLen(y, m);
  const what = feb ? `February ${y}` : MONTHS[m];
  const knuckles = (): Lesson => {
    const L = new PicLesson();
    L.show({ kind: 'fist', hl: m });
    L.say('Make a fist. Say the months along your knuckles and the dips between them.');
    L.say(m === 1 ? 'February lands in a dip, and it is the short month: 28 days, or 29 in a leap year.' : n === 31 ? `${MONTHS[m]} lands on a knuckle: 31 days.` : `${MONTHS[m]} lands in a dip: 30 days.`);
    if (feb) L.say(isLeap(y) ? `${y} divides by 4, so it is a leap year.` : `${y} does not divide by 4, so it is not a leap year.`, `${y} ÷ 4 = ${(y / 4).toFixed(2).replace(/\.00$/, '')}`);
    return L.end(n, `So ${what} has ${n} days.`);
  };
  const rhyme = (): Lesson => {
    const L = new PicLesson();
    const short = [8, 3, 5, 10];
    const grp = (label: string, ms: number[], tone: 0 | 1 | 2 | 3) => ({ label, items: ms.map((k) => MONTHS[k].slice(0, 3)), tone, hl: ms.flatMap((k, i) => (k === m ? [i] : [])) });
    L.show({ kind: 'chain', rows: true, groups: [grp('30', short, 0), grp('31', [0, 2, 4, 6, 7, 9, 11], 2), grp('28/29', [1], 3)] });
    L.say('Thirty days has September, April, June and November.');
    L.say('All the rest have thirty-one, except February: 28, and 29 each leap year.');
    return L.end(n, `So ${what} has ${n} days.`);
  };
  return made(`How many days are in ${what}?`, n, [28, 29, 30, 31].filter((x) => x !== n), {
    hint: 'Knuckle months have 31 days.',
    teach: () => withWays(knuckles(), 'Knuckles', 'calendar', [['The rhyme', rhyme]]),
  }) as ReturnType<typeof made>;
}, { format: 'choice' });

// ── Units and scales ──────────────────────────────────────────────────────
const UNITS: [string, string, number, string][] = [['m', 'cm', 100, 'length'], ['kg', 'g', 1000, 'weight'], ['l', 'ml', 1000, 'capacity'], ['km', 'm', 1000, 'length'], ['cm', 'mm', 10, 'length']];
add('s3.a3hund', 'units', 'measure', 'cm and m, kg and g, l and ml', (r, d) => {
  const [big, small, k] = r.pick(d < 0.5 ? UNITS.slice(0, 3) : UNITS);
  const n = r.int(1, 9);
  const kind = d < 0.4 ? 0 : r.int(0, 2);
  const table = (): MathVisual => ({ kind: 'table', head: [big, small], rows: [['1', String(k)], [String(n), String(n * k)]] });
  if (kind === 0) {
    const ans = n * k;
    return made(`${n} ${big} = ? ${small}`, ans, nums(r, ans, [n * (k === 100 ? 1000 : 100), n * 10, n + k]), {
      hint: `1 ${big} = ${k} ${small}.`,
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'table', head: [big, small], rows: [['1', String(k)]] });
        L.say(`1 ${big} is ${k} ${small}.`);
        L.show(table());
        L.say(`So ${n} ${big} is ${n} lots of ${k}.`, `${n} × ${k} = ${ans}`);
        return L.end(ans, `So ${n} ${big} = ${ans} ${small}.`);
      },
    });
  }
  if (kind === 1) {
    return made(`${n * k} ${small} = ? ${big}`, n, nums(r, n, [n * 10]), {
      hint: `${k} ${small} make 1 ${big}.`,
      teach: () => {
        const L = new PicLesson();
        L.show(table());
        L.say(`${k} ${small} make 1 ${big}. How many lots of ${k} are in ${n * k}?`, `${n * k} ÷ ${k} = ${n}`);
        return L.end(n, `So ${n * k} ${small} = ${n} ${big}.`);
      },
    });
  }
  const extra = k === 10 ? r.int(1, 9) : k === 100 ? r.int(5, 95) : 50 * r.int(1, 19);
  const ans = n * k + extra;
  return made(`${n} ${big} ${extra} ${small} = ? ${small}`, ans, nums(r, ans, [n + extra, n * 100 + extra, n * 10 + extra]), {
    hint: `Change the ${big} to ${small} first.`,
    teach: () => {
      const L = new PicLesson();
      L.show(table());
      L.say(`Change ${n} ${big} to ${small}.`, `${n} × ${k} = ${n * k}`);
      L.say(`Then add the ${extra} ${small}.`, `${n * k} + ${extra} = ${ans}`);
      return L.end(ans, `So it is ${ans} ${small}.`);
    },
  });
}, { format: 'pad' });

add('s3.units', 'readscale', 'measure', 'Read a scale', (r, d) => {
  const step = r.pick(d < 0.5 ? [2, 5, 10] : [2, 5, 10, 20, 25]);
  const every = step === 25 ? 100 : step === 20 ? 100 : step === 2 ? 10 : step * 5 > 50 ? 50 : step * 5;
  const to = step <= 5 ? every * 4 : every * 4;
  const marks = to / step;
  let k = r.int(1, marks - 1);
  if ((k * step) % every === 0) k++;
  const value = k * step;
  const unit = r.pick(['g', 'ml', 'cm', '°C']);
  const v: MathVisual = { kind: 'scale', from: 0, to, step, every, value, unit };
  const base = Math.floor(value / every) * every;
  return made(`What does the arrow point to? (${unit})`, value, nums(r, value, [base + (value - base) / step, value + step, value - step]), {
    visual: v,
    hint: 'Find how much each small mark is worth first.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say(`From 0 to ${every} there are ${every / step} gaps. So each gap is ${step}.`, `${every} ÷ ${every / step} = ${step}`);
      L.show({ ...v, count: true });
      L.say(`Start at ${base} and count on in ${step}s.`, Array.from({ length: (value - base) / step }, (_, i) => base + (i + 1) * step).join(', '));
      return L.end(value, `So the arrow points to ${value} ${unit}.`);
    },
  });
});

add('s3.a33c', 'addmeas', 'measure', 'Adding measures in stories', (r) => {
  const kg = r.int(1, 4);
  const g = 50 * r.int(1, 15);
  const more = 50 * r.int(2, 18);
  const tot = kg * 1000 + g + more;
  const item = r.pick(['rice', 'flour', 'sugar', 'dal']);
  const name = r.pick(['Riya', 'Kabir', 'Meera', 'Arjun', 'Zara']);
  const kgs = (n: number, tone: 0 | 3 = 0): BarPart[] => Array.from({ length: n }, () => ({ v: 1000, t: '1 kg', sub: '1000 g', tone }));
  const bar = (parts: BarPart[], total?: string, more: Partial<BarRow> = {}): MathVisual => ({ kind: 'bar', rows: [{ parts: parts.filter((p) => p.v > 0), total, ...more }] });
  const start = kg * 1000 + g;
  const plain = (): Lesson => {
    // Blocks show the change to grams; then the grams are added in columns.
    const L = new LessonBuilder();
    const frames: PicBoard['frames'] = [{ step: 0, v: bar([...kgs(kg), { v: g, t: `${g} g`, tone: 1 }], `${start} g`) }];
    L.say(`Change everything to grams. 1 kg = 1000 g.`, `${kg} kg ${g} g = ${start} g`);
    const cols = columnAdd([start, more]);
    frames.push({ step: 1, v: bar([...kgs(kg), { v: g, t: `${g} g`, tone: 1 }, { v: more, t: `${more} g`, tone: 2, new: true }], `${start} g + ${more} g`) });
    L.take(cols);
    frames.push({ step: L.i, v: bar([...kgs(kg), { v: g, t: `${g} g`, tone: 1 }, { v: more, t: `${more} g`, tone: 2 }], `${tot} g`) });
    L.board = { kind: 'stack', boards: [{ kind: 'pic', frames }, shiftBoard(cols.board!, 1)] };
    return L.end(tot, `So there are ${tot} g.`);
  };
  const carry = (): Lesson => {
    // kg | g columns: add the grams, 1000 g becomes a carried 1 kg, then add the kg.
    const L = new LessonBuilder();
    const gs = g + more;
    const over = gs >= 1000;
    const K = kg + (over ? 1 : 0);
    const cells: ColsCell[] = [
      { r: 1, c: 0, ch: String(kg) }, { r: 1, c: 1, ch: String(g) },
      { r: 2, c: 1, ch: String(more) },
    ];
    const board: ColsBoard = { kind: 'cols', width: 2, heads: ['kg', 'g'], widths: [1.6, 2.6], rows: ['small', 'num', 'num', 'ans'], rules: [2], ops: [{ r: 2, ch: '+' }], cells, focus: [{ c: 1, at: 0, until: over ? 2 : 1 }] };
    L.board = board;
    cells.push({ r: 3, c: 1, ch: String(gs), tone: over ? 'new' : 'ans', at: 0, ...(over ? { until: 1 } : {}) });
    L.say('Add the grams first.', `${g} g + ${more} g = ${gs} g`);
    if (over) {
      cells.push({ r: 3, c: 1, ch: String(gs - 1000), tone: 'ans', at: 1 }, { r: 0, c: 0, ch: '1', tone: 'carry', at: 1 });
      L.sayThen('1000 g make 1 kg: carry it to the kg.', `${gs} g = 1 kg ${gs - 1000} g`, `Write ${gs - 1000} g, carry 1 kg.`);
    }
    board.focus!.push({ c: 0, at: L.i, until: L.i + 1 });
    cells.push({ r: 3, c: 0, ch: String(K), tone: 'ans', at: L.i });
    L.say(over ? 'Add the kg, with the carried 1.' : 'Now the kg.', over ? `${kg} + 1 = ${K} kg` : `${kg} kg`);
    L.say(`That is ${K} kg ${gs % 1000} g. Change it to grams.`, `${K} × 1000 + ${gs % 1000} = ${tot}`);
    return L.end(tot, `So there are ${tot} g.`);
  };
  return made(`A bag of ${item} weighs ${kg} kg ${g} g. ${name} adds ${more} g more. How many grams is that now?`, tot, nums(r, tot, [kg * 1000 + g, kg * 100 + g + more, kg + g + more]), {
    hint: '1 kg = 1000 g. Change to grams, then add.',
    teach: () => withWays(plain(), 'All in grams', 'units', [['Grams, then carry', carry]]),
  });
}, { format: 'pad' });

// ── Perimeter and area ────────────────────────────────────────────────────
add('s3.a3x2d', 'perim', 'measure', 'Perimeter', (r, d) => {
  const kind = d < 0.4 ? 0 : r.int(0, 2);
  let pts: Pt[];
  let labels: string[];
  let sides: number[];
  if (kind === 0) {
    const w = r.int(3, 12), h = r.int(2, 9);
    pts = [[0, 0], [w, 0], [w, h], [0, h]];
    sides = [w, h, w, h];
    labels = sides.map(String);
  } else if (kind === 1) {
    const a = r.int(3, 9), b = r.int(3, 9);
    const c = r.int(Math.abs(a - b) + 1, a + b - 1);
    // Draw a triangle with sides a (base), b, c (roughly).
    const x = (a * a + c * c - b * b) / (2 * a);
    const y = Math.sqrt(Math.max(1, c * c - x * x));
    pts = [[0, 0], [a, 0], [x, y]];
    sides = [a, b, c];
    labels = sides.map(String);
  } else {
    const W = r.int(5, 10), H = r.int(4, 8), cw = r.int(1, W - 2), ch = r.int(1, H - 2);
    pts = [[0, 0], [W, 0], [W, H - ch], [W - cw, H - ch], [W - cw, H], [0, H]];
    sides = [W, H - ch, cw, ch, W - cw, H];
    labels = sides.map(String);
  }
  const tot = sides.reduce((s, x) => s + x, 0);
  const v: MathVisual = { kind: 'poly', pts, labels, unit: 'cm' };
  const walk = (): Lesson => {
    const L = new PicLesson();
    L.show(v);
    L.say('Perimeter is the distance all the way round the edge.');
    L.show({ ...v, walk: true });
    L.say('Walk round, adding each side.', `${sides.join(' + ')} = ${tot}`);
    return L.end(tot, `So the perimeter is ${tot} cm.`);
  };
  const ways: [string, () => Lesson][] = kind === 0 ? [['2 × (long + short)', () => {
    const L = new PicLesson();
    L.show(v);
    L.say('A rectangle has two long sides and two short sides.', `${sides[0]} + ${sides[1]} = ${sides[0] + sides[1]}`);
    L.say('Double it for the other two sides.', `2 × ${sides[0] + sides[1]} = ${tot}`);
    return L.end(tot, `So the perimeter is ${tot} cm.`);
  }]] : [];
  return made('What is the perimeter of this shape? (cm)', tot, nums(r, tot, [kind === 0 ? sides[0] * sides[1] : tot - sides[0], sides[0] + sides[1]]), {
    visual: v,
    hint: 'Add up every side.',
    teach: () => withWays(walk(), 'Walk the edge', 'perim', ways),
  });
});

add('s3.arrays', 'areasq', 'measure', 'Area by counting squares', (r, d) => {
  const w = r.int(2, d < 0.5 ? 5 : 7), h = r.int(2, d < 0.5 ? 4 : 5);
  const cells: Pt[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
  let on = cells;
  const lshape = d >= 0.4 && r.chance(0.6) && w > 2 && h > 2;
  if (lshape) {
    const cw = r.int(1, w - 1), ch = r.int(1, h - 1);
    on = cells.filter(([x, y]) => !(x >= w - cw && y < ch));
  }
  const n = on.length;
  const v: MathVisual = { kind: 'cells', w: w + 1, h: h + 1, on: on.map(([x, y]) => [x, y + 1] as Pt), color: 'teal' };
  const count = (): Lesson => {
    const L = new PicLesson();
    L.show(v);
    L.say('Area is how many squares cover the shape.');
    L.show({ ...v, count: true });
    L.say('Count them row by row.');
    return L.end(n, `So the area is ${n} squares.`);
  };
  const rows = (): Lesson => {
    const L = new PicLesson();
    L.show({ ...v, count: true });
    L.say(`There are ${h} rows of ${w} squares.`, `${h} × ${w} = ${n}`);
    return L.end(n, `So the area is ${n} squares.`);
  };
  return made('What is the area of the shaded shape? (squares)', n, nums(r, n, [2 * (w + h), n + w]), {
    visual: v,
    hint: lshape ? 'Count the squares row by row.' : 'Count the rows, and the squares in each row.',
    teach: () => withWays(count(), 'Count the squares', 'area', lshape ? [] : [['Rows × columns', rows]]),
  });
});

// ── Angles and lines ──────────────────────────────────────────────────────
add('s3.areasq', 'rightang', 'shape', 'Right angles', (r) => {
  const kind = r.int(0, 2);
  const deg = kind === 1 ? 90 : kind === 0 ? r.int(25, 75) : r.int(105, 160);
  const rot = r.pick([0, 0, 20, -15, 35]);
  const ans = kind === 1 ? 'a right angle' : kind === 0 ? 'less than a right angle' : 'more than a right angle';
  const opts = ['less than a right angle', 'a right angle', 'more than a right angle'];
  return made('Is this angle less than, equal to or more than a right angle?', ans, opts.filter((x) => x !== ans), {
    visual: { kind: 'angle', deg, rot },
    hint: 'A right angle is a square corner, like the corner of a page.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'angle', deg, rot });
      L.say('A right angle is a square corner, like the corner of a book.');
      L.show({ kind: 'angle', deg, rot, ref: true });
      L.say(kind === 1 ? 'Put the corner of a page in it: it fits exactly.' : kind === 0 ? 'Put the corner of a page in it: the angle is narrower, it fits inside.' : 'Put the corner of a page in it: the angle opens wider than the page.');
      return L.end(ans, `So it is ${ans}.`);
    },
  });
}, { format: 'choice' });

add('s3.rightang', 'parallel', 'shape', 'Parallel and perpendicular', (r) => {
  const want = r.pick(['parallel', 'perpendicular'] as const);
  const rot = r.pick([0, 30, -25, 60, 90]);
  const options: Record<string, MathVisual> = {
    parallel: { kind: 'lines', type: 'parallel', rot },
    perpendicular: { kind: 'lines', type: 'perp', rot: r.pick([0, 20, -30]) },
    crossing: { kind: 'lines', type: 'cross', rot: r.pick([0, 15]) },
  };
  return made(want === 'parallel' ? 'Which lines are parallel (they never meet)?' : 'Which lines are perpendicular (they meet at a right angle)?', want, ['parallel', 'perpendicular', 'crossing'].filter((x) => x !== want), {
    options,
    hint: want === 'parallel' ? 'Parallel lines stay the same distance apart, like train tracks.' : 'Perpendicular lines make a square corner where they meet.',
    teach: () => {
      const L = new PicLesson();
      L.show(options.crossing);
      L.say('These lines cross, but not at a square corner.');
      L.show({ ...options[want], marks: true } as MathVisual);
      L.say(want === 'parallel' ? 'Parallel lines are like train tracks: always the same distance apart, so they never meet.' : 'Perpendicular lines meet at a right angle: a square corner.');
      return L.end(want, `So the ${want} lines are the ones marked ${want}.`);
    },
  });
}, { format: 'choice' });

const FEC: Record<string, [number, number, number]> = { cube: [6, 12, 8], cuboid: [6, 12, 8], pyramid: [5, 8, 5], prism: [5, 9, 6] };
add('s3.misssub2', 'faces', 'shape', 'Faces, edges, corners', (r, d) => {
  const solid = r.pick(d < 0.5 ? ['cube', 'cuboid'] : ['cube', 'cuboid', 'pyramid', 'prism']) as SolidName;
  const which = r.int(0, 2);
  const word = ['faces', 'edges', 'corners'][which];
  const n = FEC[solid][which];
  const name = solid === 'prism' ? 'triangular prism' : solid === 'pyramid' ? 'square pyramid' : solid;
  return made(`How many ${word} does a ${name} have?`, n, nums(r, n, FEC[solid].filter((x) => x !== n)), {
    visual: { kind: 'solid', solid, color: 'orange' },
    hint: which === 0 ? 'Faces are the flat sides.' : which === 1 ? 'Edges are where two faces meet.' : 'Corners are where edges meet.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'solid', solid, color: 'orange', hl: (['faces', 'edges', 'corners'] as const)[which] });
      L.say(which === 0 ? 'Faces are the flat sides. Count the ones you can see.' : which === 1 ? 'Edges are the lines where two faces meet.' : 'Corners (vertices) are the points where edges meet.');
      L.say('The dashed lines show the ones hidden at the back. Count those too.');
      const extra = solid === 'cube' || solid === 'cuboid' ? ['6 faces: front, back, top, bottom, left, right', '4 edges on top, 4 at the bottom, 4 going up', '4 corners on top, 4 at the bottom'][which]
        : solid === 'pyramid' ? ['1 square base and 4 triangles', '4 round the base and 4 up to the point', '4 round the base and 1 at the top'][which]
          : ['2 triangle ends and 3 rectangles', '3 on each triangle end and 3 joining them', '3 on each triangle end'][which];
      L.say(extra + '.');
      return L.end(n, `So a ${name} has ${n} ${word}.`);
    },
  });
});

// ── Data ──────────────────────────────────────────────────────────────────
const SPORTS = ['Cricket', 'Football', 'Kabaddi', 'Hockey', 'Chess'];
add('s3.x10', 'barscale', 'data', 'Bar charts with a scale', (r, d) => {
  const step = r.pick(d < 0.5 ? [2, 5] : [2, 5, 10]);
  const labels = pickN(r, SPORTS, 4);
  const bars = labels.map((label) => ({ label, v: step * r.int(1, 9) }));
  for (let t = 0; t < 30 && new Set(bars.map((b) => b.v)).size < 4; t++) bars.forEach((b) => (b.v = step * r.int(1, 9)));
  const max = step * 10;
  const v: MathVisual = { kind: 'bars', bars, step, max, unit: 'children' };
  const i = r.int(0, 3);
  if (d < 0.4 || r.chance(0.4)) {
    return made(`How many children chose ${bars[i].label}?`, bars[i].v, nums(r, bars[i].v, [bars[i].v / step, bars[i].v + step]), {
      visual: v,
      hint: `Each line on the scale goes up in ${step}s.`,
      teach: () => {
        const L = new PicLesson();
        L.show(v);
        L.say(`The scale goes up in ${step}s.`);
        L.show({ ...v, hl: [i], read: i });
        L.say(`Go across from the top of the ${bars[i].label} bar to the scale.`);
        return L.end(bars[i].v, `So ${bars[i].v} children chose ${bars[i].label}.`);
      },
    });
  }
  const [a, b] = pickN(r, [0, 1, 2, 3], 2).sort((x, y) => bars[y].v - bars[x].v);
  const diff = bars[a].v - bars[b].v;
  return made(`How many more children chose ${bars[a].label} than ${bars[b].label}?`, diff, nums(r, diff, [bars[a].v + bars[b].v, diff / step]), {
    visual: v,
    hint: 'Read both bars, then take away.',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, hl: [a], read: a });
      L.say(`${bars[a].label}: ${bars[a].v}.`);
      L.show({ ...v, hl: [b], read: b });
      L.say(`${bars[b].label}: ${bars[b].v}.`, `${bars[a].v} − ${bars[b].v} = ${diff}`);
      return L.end(diff, `So ${diff} more chose ${bars[a].label}.`);
    },
  });
});

add('s3.d10', 'table', 'data', 'Read a table', (r) => {
  const names = pickN(r, ['Riya', 'Kabir', 'Meera', 'Arjun', 'Zara', 'Dev'], 3);
  const months = ['June', 'July', 'August'];
  const vals = names.map(() => months.map(() => r.int(2, 15)));
  const head = ['Books read', ...months];
  const rows = names.map((n, i) => [n, ...vals[i].map(String)]);
  const i = r.int(0, 2);
  if (r.chance(0.5)) {
    const tot = vals[i].reduce((s, x) => s + x, 0);
    return made(`How many books did ${names[i]} read in all three months?`, tot, nums(r, tot, [vals[i][0] + vals[i][1]]), {
      visual: { kind: 'table', head, rows },
      hint: `Add along ${names[i]}'s row.`,
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'table', head, rows, hl: [[i, 1], [i, 2], [i, 3]] });
        L.say(`Find ${names[i]}'s row and add along it.`, `${vals[i].join(' + ')} = ${tot}`);
        return L.end(tot, `So ${names[i]} read ${tot} books.`);
      },
    });
  }
  const [m1, m2] = pickN(r, [0, 1, 2], 2);
  const j = r.int(0, 2);
  const a = vals[j][m1], b = vals[j][m2];
  const diff = Math.abs(a - b);
  const more = a >= b ? months[m1] : months[m2];
  const less = a >= b ? months[m2] : months[m1];
  if (diff === 0) {
    const tot = vals[j][m1] + vals[(j + 1) % 3][m1];
    return made(`How many books did ${names[j]} and ${names[(j + 1) % 3]} read in ${months[m1]} together?`, tot, nums(r, tot), {
      visual: { kind: 'table', head, rows },
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'table', head, rows, hl: [[j, m1 + 1], [(j + 1) % 3, m1 + 1]] });
        L.say(`Find the ${months[m1]} column, then the two names.`, `${vals[j][m1]} + ${vals[(j + 1) % 3][m1]} = ${tot}`);
        return L.end(tot, `So they read ${tot} books together.`);
      },
    });
  }
  return made(`How many more books did ${names[j]} read in ${more} than in ${less}?`, diff, nums(r, diff, [a + b]), {
    visual: { kind: 'table', head, rows },
    hint: 'Find both numbers in the row, then take away.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'table', head, rows, hl: [[j, m1 + 1], [j, m2 + 1]] });
      L.say(`In ${names[j]}'s row: ${more} ${Math.max(a, b)}, ${less} ${Math.min(a, b)}.`, `${Math.max(a, b)} − ${Math.min(a, b)} = ${diff}`);
      return L.end(diff, `So ${diff} more books.`);
    },
  });
});
