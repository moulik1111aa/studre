// Stage 2 (ages 5–6): measuring with cubes and rulers, o'clock and half past, days and months,
// money, shapes and solids, symmetry, turns and routes, tallies and picture graphs, patterns.

import { extraSkills, made } from './extra.ts';
import { PicLesson, withWays, pickN } from '../../teach/pics.ts';
import { nearNumbers } from '../../question.ts';
import type { MathVisual, Pt, ShapeName, SolidName } from '../../vis.ts';
import type { Rng } from '../../rng.ts';

const { list, add } = extraSkills(2, { format: 'choice', speedSec: 12 });
export const EXTRA2 = list;

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const OBJ = ['pencil', 'crayon', 'ribbon', 'leaf', 'key', 'spoon'] as const;
const nums = (r: Rng, a: number, extra: number[] = []) => nearNumbers(r, a, extra, { min: 0 });

// ── Measure with cubes ────────────────────────────────────────────────────
add('s2.count20', 'mcubes', 'measure', 'Measure with cubes', (r, d) => {
  const len = r.int(3, d < 0.5 ? 7 : 12);
  const obj = r.pick(OBJ);
  const v: MathVisual = { kind: 'cubes', len, obj };
  return made(`How many cubes long is the ${obj}?`, len, nums(r, len), {
    visual: v,
    hint: 'Count the cubes from one end of it to the other.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say(`The cubes start where the ${obj} starts.`);
      L.show({ ...v, count: true });
      L.say('Count each cube under it.', Array.from({ length: len }, (_, i) => i + 1).join(', '));
      return L.end(len, `The ${obj} is ${len} cubes long.`);
    },
  });
});

// ── Read a ruler ──────────────────────────────────────────────────────────
add('s2.line20', 'ruler', 'measure', 'Read a ruler (cm)', (r, d) => {
  const shift = d >= 0.55 && r.chance(0.7);
  const from = shift ? r.int(1, 4) : 0;
  const len = r.int(2, 15 - from - 1);
  const obj = r.pick(OBJ);
  const color = r.pick(['orange', 'pink', 'green', 'purple']);
  const v: MathVisual = { kind: 'ruler', max: 15, items: [{ from, to: from + len, color, name: obj }] };
  const ways: [string, () => import('../../teach/types.ts').Lesson][] = [];
  const read = () => {
    const L = new PicLesson();
    L.show(v);
    if (!from) {
      L.say(`The ${obj} starts at 0.`);
      L.say(`Its end is at ${len}.`);
      return L.end(len, `So the ${obj} is ${len} cm long.`);
    }
    L.say(`The ${obj} starts at ${from}, not at 0.`);
    L.say(`It ends at ${from + len}. Take away the start.`, `${from + len} − ${from} = ${len}`);
    return L.end(len, `So the ${obj} is ${len} cm long.`);
  };
  const count = () => {
    const L = new PicLesson();
    L.show(v);
    L.say(`Count the centimetre gaps under the ${obj}, not the marks.`);
    L.show({ ...v, count: len });
    L.say(`From ${from} to ${from + len} there are ${len} gaps.`);
    return L.end(len, `So the ${obj} is ${len} cm long.`);
  };
  ways.push(['Count the gaps', count]);
  return made(`How long is the ${obj}? (cm)`, len, nums(r, len, from ? [from + len, len + 1] : [len + 1]), {
    visual: v,
    hint: from ? 'It does not start at 0. Count the centimetres from its start.' : 'Read the number at its end.',
    teach: () => withWays(read(), 'Read the end', 'units', ways),
  });
});

add('s2.ruler', 'longerby', 'measure', 'Longer by how much?', (r, d) => {
  const a = r.int(4, 14);
  let b = r.int(2, a - 1);
  if (d < 0.5 && a - b > 6) b = a - r.int(1, 5);
  const [ca, cb] = pickN(r, ['red', 'blue', 'green', 'purple', 'orange'], 2);
  const v: MathVisual = { kind: 'ruler', max: 15, items: [{ from: 0, to: a, color: ca, name: 'ribbon' }, { from: 0, to: b, color: cb, name: 'ribbon' }] };
  const diff = a - b;
  return made(`How much longer is the ${ca} ribbon than the ${cb} ribbon? (cm)`, diff, nums(r, diff, [a, b, a + b]), {
    visual: v,
    hint: 'Both start at 0. Count on from the end of the short one to the end of the long one.',
    teach: () =>
      withWays(
        (() => {
          const L = new PicLesson();
          L.show(v);
          L.say(`Both ribbons start at 0. The ${ca} one ends at ${a}, the ${cb} one at ${b}.`);
          L.show({ ...v, gap: true });
          L.say(`Count on from ${b} to ${a}.`, `${b} → ${a}: ${diff} more`);
          return L.end(diff, `So the ${ca} ribbon is ${diff} cm longer.`);
        })(),
        'Count on',
        'units',
        [['Take away', () => {
          const L = new PicLesson();
          L.show({ ...v, gap: true });
          L.say('The extra bit is the long one take away the short one.', `${a} − ${b} = ${diff}`);
          return L.end(diff, `So it is ${diff} cm longer.`);
        }]],
      ),
  });
});

// ── Days, months and the calendar ─────────────────────────────────────────
add('s2.ordinal', 'days', 'measure', 'Days of the week', (r) => {
  const t = r.int(0, 6);
  const after = r.chance(0.5);
  const ans = DAYS[(t + (after ? 1 : 6)) % 7];
  const wrong = [DAYS[(t + (after ? 6 : 1)) % 7], DAYS[t], DAYS[(t + (after ? 2 : 5)) % 7]];
  return made(`Which day comes ${after ? 'after' : 'before'} ${DAYS[t]}?`, ans, wrong, {
    hint: 'Say the days in order: Sunday, Monday, Tuesday…',
    teach: () => {
      const L = new PicLesson();
      const cells = DAYS.map((x) => x.slice(0, 3));
      L.show({ kind: 'strip', cells, hl: t });
      L.say('Say the days in order: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday.');
      L.show({ kind: 'strip', cells, hl: t, to: (t + (after ? 1 : 6)) % 7 });
      L.say(after ? `One step on from ${DAYS[t]}.` : `One step back from ${DAYS[t]}.${t === 0 ? ' Before Sunday comes Saturday (the week goes round).' : ''}`);
      return L.end(ans, `So the answer is ${ans}.`);
    },
  });
});

add('s2.days', 'months', 'measure', 'Months of the year', (r) => {
  const kind = r.int(0, 3);
  const cells = MONTHS.map((x) => x.slice(0, 3));
  if (kind === 0) {
    return made('How many months are in a year?', 12, [10, 7, 30], {
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'strip', cells });
        L.say('January, February, March … all the way to December.');
        return L.end(12, 'Count them: there are 12 months in a year.');
      },
    });
  }
  const m = r.int(0, 11);
  const after = kind !== 2;
  const step = after ? 1 : 11;
  const ans = MONTHS[(m + step) % 12];
  return made(`Which month comes ${after ? 'after' : 'before'} ${MONTHS[m]}?`, ans, [MONTHS[(m + 12 - step) % 12], MONTHS[(m + 2 * step) % 12], MONTHS[m]], {
    hint: 'Say the months in order, starting with January.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'strip', cells, hl: m });
      L.say('The months go January, February, March, April, May, June, July, August, September, October, November, December.');
      L.show({ kind: 'strip', cells, hl: m, to: (m + step) % 12 });
      L.say(`${after ? 'One step on' : 'One step back'} from ${MONTHS[m]}.${after && m === 11 ? ' After December the new year starts with January.' : ''}${!after && m === 0 ? ' Before January comes December of the year before.' : ''}`);
      return L.end(ans, `So the answer is ${ans}.`);
    },
  });
});

/** "3 o'clock" / "half past 3". */
export const clockWords = (h: number, m: number) => (m === 0 ? `${h} o'clock` : `half past ${h}`);

add('s2.months', 'oclock', 'measure', "O'clock and half past", (r, d) => {
  const h = r.int(1, 12);
  const m = d < 0.4 ? 0 : r.pick([0, 30]);
  const ans = clockWords(h, m);
  const next = (h % 12) + 1;
  const wrong = m === 0 ? [`half past ${h}`, `12 o'clock`, `${next} o'clock`] : [`${h} o'clock`, `half past ${next}`, `6 o'clock`];
  const v: MathVisual = { kind: 'clock', h, m };
  return made('What time is it?', ans, wrong.filter((x) => x !== ans), {
    visual: v,
    hint: m === 0 ? 'The long hand is on 12: it is something o’clock.' : 'The long hand is on 6: it is half past.',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, hl: 'min' });
      L.say(m === 0 ? 'Look at the long hand first. It points straight up at 12, so it is an o’clock time.' : 'Look at the long hand first. It points down at 6: half way round, so it is half past.');
      L.show({ ...v, hl: 'hour' });
      L.say(m === 0 ? `The short hand points at ${h}.` : `The short hand has just gone past ${h}.`);
      return L.end(ans, `So it is ${ans}.`);
    },
  });
});

add('s2.add20b', 'calendar', 'measure', 'Calendar: days later', (r, d) => {
  const t = r.int(0, 6);
  const n = d < 0.5 ? r.int(2, 6) : r.pick([7, 8, 9, 10, 14, 15]);
  const ans = DAYS[(t + n) % 7];
  const cells = DAYS.map((x) => x.slice(0, 3));
  const wrong = [DAYS[(t + n + 1) % 7], DAYS[(t + n + 6) % 7], DAYS[t]];
  const countOn = () => {
    const L = new PicLesson();
    L.show({ kind: 'strip', cells, hl: t });
    L.say(`Start on ${DAYS[t]}.`);
    const rest = n % 7;
    if (n >= 7) L.say(`${n >= 14 ? '14 days is two weeks' : '7 days is one week'}: a week later is ${DAYS[t]} again.`);
    if (rest) {
      L.show({ kind: 'strip', cells, hl: t, to: (t + rest) % 7 });
      L.say(`Then count on ${rest} more ${rest === 1 ? 'day' : 'days'}.`);
    }
    return L.end(ans, `So it will be ${ans}.`);
  };
  const dayByDay = () => {
    const L = new PicLesson();
    const strip = Array.from({ length: n + 1 }, (_, i) => DAYS[(t + i) % 7].slice(0, 2));
    L.show({ kind: 'strip', cells: strip, hl: 0, to: n });
    L.say(`Count on ${n} days, one at a time.`);
    return L.end(ans, `Day ${n} is ${ans}.`);
  };
  return made(`Today is ${DAYS[t]}. What day will it be in ${n} days?`, ans, wrong, {
    hint: n >= 7 ? 'A week later is the same day again.' : 'Count on day by day.',
    teach: () => withWays(countOn(), n >= 7 ? 'Jump a week' : 'Count on', 'calendar', n >= 7 && n <= 10 ? [['Day by day', dayByDay]] : []),
  });
});

// ── Money ─────────────────────────────────────────────────────────────────
const TOYS: [string, string][] = [['toy car', '🚗'], ['ball', '⚽'], ['kite', '🪁'], ['teddy', '🧸'], ['book', '📘'], ['top', '🪀'], ['sweet', '🍬'], ['ice cream', '🍦'], ['pencil', '✏️'], ['banana', '🍌']];
add('s2.coins20', 'shop', 'measure', 'Shopping with ₹', (r, d) => {
  const [a, b] = pickN(r, TOYS, 2);
  const pa = d < 0.5 ? r.int(2, 10) : r.int(10, 25);
  const pb = d < 0.5 ? r.int(1, 20 - pa > 1 ? Math.min(9, 20 - pa) : 1) : r.int(3, 20);
  const sum = pa + pb;
  return made(`A ${a[0]} costs ₹${pa} and a ${b[0]} costs ₹${pb}. How much for both?`, sum, nums(r, sum, [Math.abs(pa - pb)]), {
    visual: { kind: 'row', items: [a[1], b[1]], labels: [`₹${pa}`, `₹${pb}`] },
    hint: 'Add the two prices.',
    teach: () => {
      const L = new PicLesson();
      const big = Math.max(pa, pb), small = Math.min(pa, pb);
      L.show({ kind: 'row', items: [a[1], b[1]], labels: [`₹${pa}`, `₹${pb}`] });
      L.say('Both means add the prices.', `₹${pa} + ₹${pb}`);
      const tens = Math.floor(big / 10) * 10;
      L.show({ kind: 'money', values: [...(tens ? Array(tens / 10).fill(10) : []), ...(big % 10 ? coins(big % 10) : []), ...coins(small)] });
      L.say(`Start at the bigger price, ₹${big}, and count on ${small}.`, `₹${big} + ₹${small} = ₹${sum}`);
      return L.end(sum, `So both cost ₹${sum}.`);
    },
  });
});
/** Coins and notes for a small amount, biggest first (5, 2, 1). */
function coins(n: number): number[] {
  const out: number[] = [];
  for (const c of [5, 2, 1]) while (n >= c) { out.push(c); n -= c; }
  return out;
}
export function notesFor(n: number): number[] {
  const out: number[] = [];
  for (const c of [50, 20, 10, 5, 2, 1]) while (n >= c) { out.push(c); n -= c; }
  return out;
}
add('s2.shop', 'makeamt', 'measure', 'Make an amount', (r, d) => {
  const n = r.int(d < 0.5 ? 6 : 12, d < 0.5 ? 20 : 49);
  const ps = notesFor(n);
  if (ps.length < 2 || r.chance(0.4)) {
    const shown = r.shuffle([...ps]);
    return made('How much money is this?', n, nums(r, n, [ps.length]), {
      visual: { kind: 'money', values: shown },
      hint: 'Start with the biggest note, then count on.',
      teach: () => {
        const L = new PicLesson();
        L.show({ kind: 'money', values: ps });
        L.say('Put the biggest note first.', ps.map((x) => `₹${x}`).join(' + '));
        L.say('Count on from the biggest.', ps.map((_, i) => `₹${ps.slice(0, i + 1).reduce((s, x) => s + x, 0)}`).join(', '));
        return L.end(n, `So it is ₹${n}.`);
      },
    });
  }
  const last = ps[ps.length - 1];
  const head = ps.slice(0, -1);
  return made(`Make ₹${n}: ${head.map((x) => `₹${x}`).join(' + ')} + ₹? = ₹${n}`, last, nums(r, last, [n - head[0]]), {
    visual: { kind: 'money', values: head },
    hint: 'Count up what you have, then how much more you need.',
    teach: () => {
      const L = new PicLesson();
      const have = head.reduce((s, x) => s + x, 0);
      L.show({ kind: 'money', values: head });
      L.say('Add up the notes you have.', `${head.map((x) => `₹${x}`).join(' + ')} = ₹${have}`);
      L.show({ kind: 'money', values: ps });
      L.say(`How much more to reach ₹${n}?`, `₹${have} + ₹${last} = ₹${n}`);
      return L.end(last, `So the missing coin is ₹${last}.`);
    },
  });
});

// ── Shapes and solids ─────────────────────────────────────────────────────
const POLYS: [ShapeName, number][] = [['triangle', 3], ['square', 4], ['rectangle', 4], ['pentagon', 5], ['hexagon', 6], ['octagon', 8], ['rhombus', 4], ['star', 10]];
add('s2.compare100', 'sides', 'shape', 'Sides and corners', (r, d) => {
  const [shape, n] = r.pick(d < 0.5 ? POLYS.slice(0, 3) : POLYS.slice(0, 7));
  const what = r.chance(0.5) ? 'sides' : 'corners';
  const v: MathVisual = { kind: 'shape', shape, color: r.pick(['yellow', 'pink', 'teal', 'orange']) };
  return made(`How many ${what} does this shape have?`, n, nums(r, n, [n - 1, n + 1]), {
    visual: v,
    hint: what === 'sides' ? 'Count each straight edge once.' : 'Count each pointy corner once.',
    teach: () => {
      const L = new PicLesson();
      L.show({ ...v, ...(what === 'sides' ? { sides: true } : { corners: true }) });
      L.say(what === 'sides' ? 'Go round the edge and count each straight side.' : 'Go round and touch each corner.');
      L.say(`A ${shape} has ${n} sides and ${n} corners.`);
      return L.end(n, `So it has ${n} ${what}.`);
    },
  });
});

const SOLIDS: [SolidName, string, string, string][] = [
  ['sphere', 'ball', '⚽', 'round all over, it rolls'], ['cube', 'dice', '🎲', '6 square faces, all the same'], ['cylinder', 'tin can', '🥫', 'two round ends and a curved side'],
  ['cone', 'ice-cream cone', '🍦', 'a round end and a point'], ['cuboid', 'box', '📦', '6 rectangle faces'], ['pyramid', 'tent', '⛺', 'a flat base and sloping sides up to a point'],
];
add('s2.sides', 'solids', 'shape', '3-D shapes around us', (r, d) => {
  const pool = d < 0.5 ? SOLIDS.slice(0, 4) : SOLIDS;
  const [ans, ...rest] = pickN(r, pool, 3);
  const names: Record<string, string> = { sphere: 'sphere', cube: 'cube', cylinder: 'cylinder', cone: 'cone', cuboid: 'cuboid', pyramid: 'pyramid' };
  const options: Record<string, MathVisual> = {};
  for (const s of [ans, ...rest]) options[names[s[0]]] = { kind: 'solid', solid: s[0], color: r.pick(['blue', 'orange', 'green', 'purple']) };
  return made(`A ${ans[1]} ${ans[2]} is shaped like which one?`, names[ans[0]], rest.map((s) => names[s[0]]), {
    options,
    hint: `Think of the ${ans[1]}: ${ans[3]}.`,
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'pair', a: { kind: 'emoji', e: ans[2], big: true }, b: { kind: 'solid', solid: ans[0], color: 'teal' }, op: '→' });
      L.say(`A ${ans[1]} is ${ans[3]}.`);
      L.show({ kind: 'solid', solid: ans[0], color: 'teal', hl: ans[0] === 'sphere' ? undefined : 'faces' });
      return L.end(names[ans[0]], `That shape is a ${names[ans[0]]}.`);
    },
  });
});

// ── Fold it in half ───────────────────────────────────────────────────────
function halfPattern(r: Rng, w: number, h: number): Pt[] {
  const cells: Pt[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (r.chance(0.45)) cells.push([x, y]);
  if (cells.length < 3) cells.push([w - 1, 0], [w - 2, 1], [w - 1, h - 1]);
  return cells;
}
const mirrorX = (cells: Pt[], line: number): Pt[] => cells.map(([x, y]) => [2 * line - 1 - x, y] as Pt);
const key = (c: Pt) => `${c[0]},${c[1]}`;
add('s2.doubles5', 'fold', 'shape', 'Fold it in half', (r) => {
  const w = 3, h = 4;
  const left = halfPattern(r, w, h);
  const good = [...left, ...mirrorX(left, w)];
  const spoil = (k: number): Pt[] => {
    const right = mirrorX(left, w);
    const set = new Set(right.map(key));
    // Move or drop k squares on the right half.
    const out = [...right];
    for (let i = 0; i < k; i++) {
      const c: Pt = [w + r.int(0, w - 1), r.int(0, h - 1)];
      if (set.has(key(c))) { out.splice(out.findIndex((x) => key(x) === key(c)), 1); set.delete(key(c)); }
      else { out.push(c); set.add(key(c)); }
    }
    if (out.length === right.length && out.every((c) => right.some((x) => key(x) === key(c)))) out.push([w + ((left[0]?.[0] ?? 0) % w), (left[0][1] + 1) % h]);
    return [...left, ...out];
  };
  const labels = r.shuffle(['A', 'B', 'C']);
  const pics: Record<string, MathVisual> = {};
  const col = r.pick(['teal', 'pink', 'orange', 'purple']);
  pics[labels[0]] = { kind: 'cells', w: 2 * w, h, on: good, mirror: { x: w }, color: col };
  pics[labels[1]] = { kind: 'cells', w: 2 * w, h, on: spoil(1), mirror: { x: w }, color: col };
  pics[labels[2]] = { kind: 'cells', w: 2 * w, h, on: spoil(2), mirror: { x: w }, color: col };
  const ans = labels[0];
  return made('Which picture is the same on both sides of the fold line?', ans, [labels[1], labels[2]], {
    options: pics,
    hint: 'Each coloured square needs a partner the same distance from the line on the other side.',
    teach: () => {
      const L = new PicLesson();
      L.show(pics[ans]);
      L.say('Fold along the dashed line, like closing a book.');
      L.show({ ...pics[ans], ghost: mirrorX(left, w) } as MathVisual);
      L.say('Every square lands on a partner on the other side.');
      return L.end(ans, `So picture ${ans} is the same on both sides.`);
    },
  });
});

// ── Turns ─────────────────────────────────────────────────────────────────
const DIRS = ['up', 'right', 'down', 'left'];
add('s2.skip10', 'turns', 'shape', 'Quarter and half turns', (r, d) => {
  const start = r.int(0, 3);
  const q = r.pick(d < 0.5 ? [1, 2] : [1, 2, 3, 4]);
  const cw = d < 0.5 || r.chance(0.6);
  const end = (start + (cw ? q : 4 - (q % 4))) % 4;
  const turn = q === 1 ? 'a quarter turn' : q === 2 ? 'a half turn' : q === 3 ? 'three quarter turns' : 'a full turn';
  const dir = cw ? 'clockwise' : 'anticlockwise';
  const options: Record<string, MathVisual> = {};
  DIRS.forEach((x, i) => (options[x] = { kind: 'arrow', dir: i * 90 }));
  return made(`The arrow points ${DIRS[start]}. It makes ${turn} ${dir}. Where does it point now?`, DIRS[end], DIRS.filter((_, i) => i !== end), {
    visual: { kind: 'arrow', dir: start * 90 },
    options,
    hint: 'Clockwise turns the way a clock’s hands go. A quarter turn is one step round.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'arrow', dir: start * 90 });
      L.say(`Start pointing ${DIRS[start]}. ${cw ? 'Clockwise goes the way clock hands go.' : 'Anticlockwise goes the other way to clock hands.'}`);
      L.show({ kind: 'arrow', dir: end * 90 + (q === 4 ? 0 : 0), turn: (cw ? 1 : -1) * q * 90, ghost: true });
      L.say(`${turn.charAt(0).toUpperCase() + turn.slice(1)} is ${q} ${q === 1 ? 'step' : 'steps'} of a quarter turn.`);
      return L.end(DIRS[end], `So it points ${DIRS[end]}.`);
    },
  });
});

const PLACES: [string, string][] = [['apple', '🍎'], ['flower', '🌸'], ['car', '🚗'], ['house', '🏠'], ['tree', '🌳'], ['star', '⭐'], ['fish', '🐟'], ['ball', '⚽']];
add('s2.turns', 'routes', 'shape', 'Left, right and routes', (r, d) => {
  const W = 5, H = 4;
  const start: Pt = [r.int(0, 1), r.int(0, 1)];
  const dx = r.int(1, W - 1 - start[0]);
  const dy = r.int(d < 0.5 ? 0 : 1, H - 1 - start[1]);
  const goal: Pt = [start[0] + dx, start[1] + dy];
  const things = pickN(r, PLACES, 4);
  const spots: Pt[] = [goal];
  const near: Pt[] = [[goal[0] - 1, goal[1]], [goal[0], goal[1] + (goal[1] + 1 < H ? 1 : -1)], [goal[0] + (goal[0] + 1 < W ? 1 : -2), goal[1]]];
  for (const p of near) if (p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H && !spots.some((s) => key(s) === key(p)) && key(p) !== key(start)) spots.push(p);
  const items = spots.slice(0, 4).map((at, i) => ({ at, e: things[i][1] }));
  const names = spots.slice(0, 4).map((_, i) => things[i][0]);
  const ask = `${dx} ${dx === 1 ? 'step' : 'steps'} right${dy ? `, then ${dy} up` : ''}`;
  const v: MathVisual = { kind: 'gridmap', w: W, h: H, items, start };
  const options: Record<string, MathVisual> = {};
  names.forEach((n, i) => (options[n] = { kind: 'emoji', e: things[i][1] }));
  // Always 4 options: things not on this map are wrong too.
  for (const [n, e] of PLACES) if (names.length < 4 && !names.includes(n)) { names.push(n); options[n] = { kind: 'emoji', e }; }
  const path: Pt[] = [start, [goal[0], start[1]], goal];
  return made(`Start at the child. Go ${ask}. What do you reach?`, names[0], names.slice(1), {
    visual: v,
    options,
    hint: 'Move one square for each step: first right, then up.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('Start on the child’s square.');
      L.show({ ...v, path: [start, [goal[0], start[1]]] });
      L.say(`Go ${dx} right, one square at a time.`);
      if (dy) {
        L.show({ ...v, path });
        L.say(`Then ${dy} up.`);
      }
      return L.end(names[0], `You reach the ${names[0]}.`);
    },
  });
});

// ── Data: tallies and picture graphs ──────────────────────────────────────
add('s2.skip5', 'tally', 'data', 'Tally marks', (r, d) => {
  const n = r.int(d < 0.5 ? 3 : 8, d < 0.5 ? 12 : 23);
  const v: MathVisual = { kind: 'tally', n };
  const fives = Math.floor(n / 5);
  return made('How many does this tally show?', n, nums(r, n, [n - fives, fives * 4 + (n % 5)]), {
    visual: v,
    hint: 'Each bundle with a line across is 5.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('Four sticks and one across make a bundle of 5.');
      L.show({ kind: 'tally', n, groups: true });
      L.say(fives ? 'Count the bundles in fives, then add the single sticks.' : 'Count the sticks.', fives ? `${Array.from({ length: fives }, (_, i) => 5 * (i + 1)).join(', ')}${n % 5 ? `, then ${n % 5} more` : ''}` : `${n}`);
      return L.end(n, `So the tally shows ${n}.`);
    },
  });
});

const FRUITS: [string, string][] = [['mangoes', '🥭'], ['apples', '🍎'], ['bananas', '🍌'], ['grapes', '🍇'], ['oranges', '🍊']];
add('s2.difference', 'picgraph', 'data', 'Picture graphs', (r, d) => {
  const rows = pickN(r, FRUITS, d < 0.5 ? 3 : 4).map(([label, e]) => ({ label, e, n: r.int(1, 8) }));
  for (let t = 0; t < 20 && new Set(rows.map((x) => x.n)).size < rows.length; t++) rows.forEach((x) => (x.n = r.int(1, 8)));
  const v: MathVisual = { kind: 'picgraph', rows };
  const kind = d < 0.4 ? 0 : r.int(0, 2);
  if (kind === 0) {
    const i = r.int(0, rows.length - 1);
    return made(`How many children like ${rows[i].label} best?`, rows[i].n, nums(r, rows[i].n), {
      visual: v,
      hint: 'Count the pictures in that row.',
      teach: () => {
        const L = new PicLesson();
        L.show({ ...v, hl: [i] });
        L.say(`Find the ${rows[i].label} row and count its pictures.`);
        return L.end(rows[i].n, `So ${rows[i].n} children like ${rows[i].label} best.`);
      },
    });
  }
  const [i, j] = pickN(r, rows.map((_, k) => k), 2).sort((a, b) => rows[b].n - rows[a].n);
  if (kind === 1) {
    const diff = rows[i].n - rows[j].n;
    return made(`How many more children like ${rows[i].label} than ${rows[j].label}?`, diff, nums(r, diff, [rows[i].n + rows[j].n, rows[i].n]), {
      visual: v,
      hint: 'Count both rows, then find the difference.',
      teach: () => {
        const L = new PicLesson();
        L.show({ ...v, hl: [i, j] });
        L.say(`${rows[i].label}: ${rows[i].n}. ${rows[j].label}: ${rows[j].n}.`);
        L.say('Line the rows up. The extra pictures are the difference.', `${rows[i].n} − ${rows[j].n} = ${diff}`);
        return L.end(diff, `So ${diff} more children like ${rows[i].label}.`);
      },
    });
  }
  const tot = rows.reduce((s, x) => s + x.n, 0);
  return made('How many children were asked altogether?', tot, nums(r, tot), {
    visual: v,
    hint: 'Add up every row.',
    teach: () => {
      const L = new PicLesson();
      L.show(v);
      L.say('Each picture is one child. Add the rows.', rows.map((x) => x.n).join(' + ') + ` = ${tot}`);
      return L.end(tot, `So ${tot} children were asked.`);
    },
  });
});

// ── Growing patterns ──────────────────────────────────────────────────────
add('s2.skip2', 'growpat', 'number', 'Growing patterns', (r, d) => {
  const kind = r.int(0, d < 0.5 ? 1 : 3);
  const style = (['L', 'dots', 'triangles', 'squares'] as const)[kind];
  const term = (k: number) => (style === 'L' ? 2 * k - 1 : style === 'dots' ? 2 * k : style === 'triangles' ? (k * (k + 1)) / 2 : k * k);
  const terms = [1, 2, 3].map(term);
  const next = term(4);
  const grow = ['+2 each time', '+2 each time', '+2, then +3, then +4', '+3, then +5, then +7'][kind];
  return made('How many dots will the next shape have?', next, nums(r, next, [terms[2] + (terms[2] - terms[1])]), {
    visual: { kind: 'growing', style, terms, ask: true },
    hint: 'See how many dots are added each time.',
    teach: () => {
      const L = new PicLesson();
      L.show({ kind: 'growing', style, terms, ask: true });
      L.say(`Count the dots: ${terms.join(', ')}.`);
      L.say(`It grows ${grow}.`);
      L.show({ kind: 'growing', style, terms: [...terms, next] });
      L.say(`Add on the next step: ${terms[2]} + ${next - terms[2]} = ${next}.`);
      return L.end(next, `So the next shape has ${next} dots.`);
    },
  });
});
