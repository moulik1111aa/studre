// Word problems (Stages 3–4): find the steps in the story, then do them one at a time.

import { LessonBuilder, f } from './build.ts';
import type { Lesson } from './types.ts';

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
  L.say(`Two steps. First, how many ${things} after getting ${b} more?`, `${a} + ${b} = ${a + b}`);
  L.say(`Then ${c} are given away.`, `${a + b} − ${c} = ${a + b - c}`);
  L.slip(a + b, `That is before giving any away. Take away ${c} too.`);
  L.slip(a - c, `Add the ${b} first.`);
  return L.end(a + b - c);
}

/** p packs of n, g given away. */
export function packsGiveAway(p: number, n: number, g: number): Lesson {
  const L = new LessonBuilder();
  const how = mulHow(p, n);
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
  L.say(`First take away the ${extra} left over: those are not shared.`, `${total} − ${extra} = ${shared}`);
  L.say(`Then share ${shared} between ${kids}.`, `${shared} ÷ ${kids} = ${shared / kids}`, `(${kids} × ${shared / kids} = ${shared})`);
  return L.end(shared / kids, `So each child gets ${shared / kids}.`);
}

/** rows × cols chairs, some empty: how many people are sitting. */
export function chairsSitting(rows: number, cols: number, empty: number): Lesson {
  const L = new LessonBuilder();
  const all = rows * cols;
  L.say(`First, how many chairs? ${rows} rows of ${cols}.`, `${rows} × ${cols} = ${all}`);
  L.say(`Take away the ${empty} empty chairs.`, `${all} − ${empty} = ${all - empty}`);
  L.slip(all, `That is all the chairs. ${empty} are empty.`);
  return L.end(all - empty);
}

export { f };
