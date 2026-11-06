// Word problems (Stages 3–4): find the steps in the story, then do them one at a time.

import { LessonBuilder, f } from './build.ts';
import type { Lesson } from './types.ts';
import type { BarPart, BarRow, MathVisual } from '../vis.ts';

// Bar models: each story is drawn as bars, so the steps can be seen.
const P = (v: number, t: string, tone: BarPart['tone'] = 0, more: Partial<BarPart> = {}): BarPart => ({ v, t, tone, ...more });
const bars = (...rows: BarRow[]): MathVisual => ({ kind: 'bar', rows });
/** n equal parts of size each (shown as one long part when there are too many). */
const lots = (n: number, each: number, t = f(each), tone: BarPart['tone'] = 0, more: Partial<BarPart> = {}): BarPart[] =>
  n <= 8 ? Array.from({ length: n }, () => P(each, t, tone, more)) : [P(n * each, `${n} × ${t}`, tone, more)];

/** A short hint for a product that is not a times-table fact: split the bigger number. */
function mulHow(a: number, b: number): string | undefined {
  if (a <= 12 && b <= 12) return undefined;
  const [big, small] = a >= b ? [a, b] : [b, a];
  if (small > 12 || big >= 100) return undefined;
  const t = Math.floor(big / 10) * 10;
  const o = big - t;
  return o ? `${t} × ${small} = ${t * small} and ${o} × ${small} = ${o * small}.` : undefined;
}

/** Got more, then gave some away: add, then take away. */
export function addThenTake(a: number, b: number, c: number, things = 'cards'): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'pic', frames: [
    { step: 0, v: bars({ parts: [P(a, f(a)), P(b, f(b), 1, { new: true })], total: `${a} + ${b} = ${a + b}` }) },
    { step: 1, v: bars({ parts: [P(a + b - c, '?', 2), P(c, `${c} away`, 0, { x: true })], total: `${a + b} − ${c} = ${a + b - c}` }) },
  ] };
  L.say(`Two steps. First, how many ${things} after getting ${b} more?`, `${a} + ${b} = ${a + b}`);
  L.you(`${a} + ${b} = ?`, a + b, [a + b + 10, a + b - 1, a + b + 1]);
  L.say(`Then ${c} are given away.`, `${a + b} − ${c} = ${a + b - c}`);
  L.slip(a + b, `That is before giving any away. Take away ${c} too.`);
  L.slip(a - c, `Add the ${b} first.`);
  return L.end(a + b - c);
}

/** p packs of n, g given away. */
export function packsGiveAway(p: number, n: number, g: number): Lesson {
  const L = new LessonBuilder();
  const how = mulHow(p, n);
  L.board = { kind: 'pic', frames: [
    { step: 0, v: bars({ name: `${p} packs`, parts: lots(p, n), total: `${p} × ${n} = ${p * n}` }) },
    { step: 1, v: bars({ parts: [P(p * n - g, '?', 2), P(g, `${g} away`, 0, { x: true })], total: `${p * n} − ${g} = ${p * n - g}` }) },
  ] };
  if (how) L.sayThen(`First, how many stickers? ${p} packs of ${n} is ${p} × ${n}.`, `${p} × ${n} = ${p * n}`, how);
  else L.say(`First, how many stickers? ${p} packs of ${n} is ${p} × ${n}.`, `${p} × ${n} = ${p * n}`);
  L.say(`Then take away the ${g} given away.`, `${p * n} − ${g} = ${p * n - g}`);
  L.slip(p * n, `That is all of them. ${g} were given away.`);
  return L.end(p * n - g);
}

/** k books at a price, paid with a note: change. */
export function booksChange(k: number, price: number, note: number): Lesson {
  const L = new LessonBuilder();
  const cost = k * price;
  const how = mulHow(k, price);
  L.board = { kind: 'pic', frames: [
    { step: 0, v: bars({ name: 'paid', parts: [P(note, `₹${note}`, 3)] }, { name: 'cost', parts: lots(k, price, `₹${price}`), total: `₹${cost}` }) },
    { step: 1, v: bars({ name: 'paid', parts: [P(note, `₹${note}`, 3)] }, { name: 'cost', parts: [P(cost, `₹${cost}`), P(note - cost, 'change', 2, { new: true })], total: `${note} − ${cost} = ${note - cost}` }) },
  ] };
  if (how) L.sayThen(`First the cost: ${k} books at ₹${price} each.`, `${k} × ${price} = ${cost}`, how);
  else L.say(`First the cost: ${k} books at ₹${price} each.`, `${k} × ${price} = ${cost}`);
  L.say(`Change is what was paid take away the cost.`, `${note} − ${cost} = ${note - cost}`);
  L.slip(cost, 'That is the cost. The change is what you get back.');
  return L.end(note - cost, `So the change is ₹${note - cost}.`);
}

/** total sweets shared by kids with some left over: how many each. */
export function sweetsShare(total: number, kids: number, extra: number): Lesson {
  const L = new LessonBuilder();
  const shared = total - extra;
  L.board = { kind: 'pic', frames: [
    { step: 0, v: bars({ parts: [P(shared, f(shared)), P(extra, `${extra} left`, 0, { x: true })], total: `${total} − ${extra} = ${shared}` }) },
    { step: 1, v: bars({ name: `${kids} kids`, parts: lots(kids, shared / kids, '?', 2, { new: true }), total: `${shared} ÷ ${kids} = ${shared / kids} each` }) },
  ] };
  L.say(`First take away the ${extra} left over: those are not shared.`, `${total} − ${extra} = ${shared}`);
  L.say(`Then share ${shared} between ${kids}.`, `${shared} ÷ ${kids} = ${shared / kids}`, `(${kids} × ${shared / kids} = ${shared})`);
  return L.end(shared / kids, `So each child gets ${shared / kids}.`);
}

/** rows × cols chairs, some empty: how many people are sitting. */
export function chairsSitting(rows: number, cols: number, empty: number): Lesson {
  const L = new LessonBuilder();
  const all = rows * cols;
  L.board = { kind: 'pic', frames: [
    { step: 0, v: { kind: 'area', cols: [`${cols} chairs`], rows: [`${rows} rows`], cells: [[`${rows} × ${cols} = ${all}`]], tone: [[1]] } },
    { step: 1, v: bars({ parts: [P(all - empty, 'sitting', 2), P(empty, `${empty} empty`, 0, { x: true })], total: `${all} − ${empty} = ${all - empty}` }) },
  ] };
  L.say(`First, how many chairs? ${rows} rows of ${cols}.`, `${rows} × ${cols} = ${all}`);
  L.say(`Take away the ${empty} empty chairs.`, `${all} − ${empty} = ${all - empty}`);
  L.slip(all, `That is all the chairs. ${empty} are empty.`);
  return L.end(all - empty);
}

export { f };

/** boxes × per, then some sold: multiply, then take away. */
export function boxesLeft(boxes: number, per: number, sold: number): Lesson {
  const L = new LessonBuilder();
  const all = boxes * per;
  L.board = { kind: 'pic', frames: [
    { step: 0, v: bars({ name: `${boxes} boxes`, parts: lots(boxes, per), total: `${boxes} × ${per} = ${all}` }) },
    { step: 1, v: bars({ parts: [P(all - sold, '?', 2), P(sold, `${sold} sold`, 0, { x: true })], total: `${all} − ${sold} = ${all - sold}` }) },
  ] };
  L.say(`Two steps. First, how many chocolates in ${boxes} boxes of ${per}?`, `${boxes} × ${per} = ${all}`, mulHow(boxes, per));
  L.say(`Then ${sold} are sold.`, `${all} − ${sold} = ${all - sold}`);
  L.slip(all + sold, 'Selling takes chocolates away.');
  return L.end(all - sold, `So ${all - sold} are left.`);
}

/** boxes × per chocolates at ₹price each. */
export function takings(boxes: number, per: number, price: number): Lesson {
  const L = new LessonBuilder();
  const all = boxes * per;
  L.board = { kind: 'pic', frames: [
    { step: 0, v: bars({ name: `${boxes} boxes`, parts: lots(boxes, per), total: `${boxes} × ${per} = ${all}` }) },
    { step: 1, v: { kind: 'area', cols: [`₹${price} each`], rows: [`${all}`], cells: [[`₹${all * price}`]], tone: [[2]] } },
  ] };
  L.say(`Two steps. First, how many chocolates in ${boxes} boxes of ${per}?`, `${boxes} × ${per} = ${all}`, mulHow(boxes, per));
  L.say(`Each one sells for ₹${price}.`, `${all} × ₹${price} = ₹${all * price}`);
  L.slip(all, `That is the number of chocolates. Each one earns ₹${price}.`);
  return L.end(all * price, `So the takings are ₹${all * price}.`);
}

/** Area of an l × w room, then × the cost of a square metre. */
export function tilesCost(l: number, w: number, tile: number): Lesson {
  const L = new LessonBuilder();
  const area = l * w;
  L.board = { kind: 'pic', frames: [{ step: 0, v: { kind: 'poly', pts: [[0, 0], [l, 0], [l, w], [0, w]], labels: [`${l} m`, `${w} m`, null, null], grid: true, squares: l * w <= 120 } }] };
  L.say('Tiles cover the floor, so find the area first: length × width.', `${l} × ${w} = ${area} m²`);
  L.say(`Each square metre costs ₹${tile}.`, `${area} × ₹${tile} = ₹${area * tile}`);
  L.slip(2 * (l + w) * tile, 'That uses the distance around the room. Tiles cover the area.');
  return L.end(area * tile, `So the tiles cost ₹${area * tile}.`);
}
