// Ratio and proportion (Stages 5–7): simplifying, sharing in a ratio (bar model), the
// unitary method (ratio tables), inverse proportion, speed–distance–time and averages.

import { clean, gcd, num } from '../question.ts';
import { LessonBuilder, f, list, rs } from './build.ts';
import type { Bar, Lesson, TableBoard } from './types.ts';

const m = (x: number, money: boolean) => (money ? rs(x) : f(x));

/** a·k : b·k → a : b. */
export function ratioSimplify(A: number, B: number): Lesson {
  const L = new LessonBuilder();
  const g = gcd(A, B);
  L.say(`Find the biggest number that divides both ${A} and ${B}: ${g}.`, `${A} = ${g} × ${A / g}`, `${B} = ${g} × ${B / g}`);
  L.say(`Divide both sides by ${g}. Keep them in the same order.`, `${A} : ${B} = ${A / g} : ${B / g}`);
  L.slip(`${B / g}:${A / g}`, `Keep the order: ${A} comes first, so ${A / g} comes first.`);
  return L.end(`${A / g}:${B / g}`, `So ${A} : ${B} simplifies to ${A / g} : ${B / g}.`);
}

/** Share a total in a ratio; ask for one share (by index) or the biggest. */
export function shareRatio(total: number, ratio: number[], want: number, o: { money?: boolean; names?: string[]; what?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const money = !!o.money;
  const parts = ratio.reduce((p, c) => p + c, 0);
  const unit = clean(total / parts);
  const names = o.names ?? ratio.map((_, i) => ['first', 'second', 'third'][i]);
  const big = Math.max(...ratio);
  const bars: Bar[] = ratio.map((r, i) => ({ label: names[i], len: r / big, parts: Array.from({ length: r }, () => ({ text: m(unit, money), textAt: 1, ...(i === want ? { tone: 2 as const, on: 2 } : { tone: 1 as const, on: 0 }) })) }));
  L.board = { kind: 'bars', bars };
  L.say(`The ratio ${ratio.join(' : ')} means ${list(ratio.map(String))} equal parts: ${parts} parts in all.`, `${ratio.join(' + ')} = ${parts}`);
  L.say(`${parts} parts make ${m(total, money)}, so one part is:`, `${m(total, money)} ÷ ${parts} = ${m(unit, money)}`);
  const ans = clean(ratio[want] * unit);
  L.say(`${o.what ?? `The ${names[want]} share`} is ${ratio[want]} part${ratio[want] === 1 ? '' : 's'}.`, `${ratio[want]} × ${m(unit, money)} = ${m(ans, money)}`);
  L.slip(unit, `That is one part. The share is ${ratio[want]} parts.`);
  if (ratio.length === 2) L.slip(clean(total / 2), 'Shares in a ratio are not equal halves: count the parts.');
  return L.end(m(ans, money), `So ${o.what ? o.what.toLowerCase() : `the ${names[want]} share`} is ${m(ans, money)}.`);
}

/** n things cost C; find the cost of k (a ratio table through 1). */
export function unitaryLesson(n: number, C: number, k: number, o: { item?: string; unitWord?: string; money?: boolean } = {}): Lesson {
  const L = new LessonBuilder();
  const money = o.money ?? true;
  const one = clean(C / n);
  const ans = clean(one * k);
  const item = o.item ?? 'things';
  const unitWord = o.unitWord ?? '1';
  const table: TableBoard = { kind: 'table', head: [item, money ? 'cost' : 'amount'], rows: [{ cells: [String(n), m(C, money)] }, { at: 1, cells: [unitWord, { v: m(one, money), tone: 'key' as const, hl: 1 }] }, { at: 2, cells: [String(k), { v: m(ans, money), tone: 'good' as const }] }] };
  L.board = table;
  L.say(`Go through 1: first find the ${money ? 'cost' : 'amount'} for ${unitWord}, then for ${k}.`, `${n} → ${m(C, money)}`);
  L.say(`For ${unitWord}: divide by ${n}.`, `${m(C, money)} ÷ ${n} = ${m(one, money)}`);
  L.say(`For ${k}: multiply by ${k}.`, `${k} × ${m(one, money)} = ${m(ans, money)}`);
  L.slip(one, `That is for ${unitWord}. Now multiply by ${k}.`);
  return L.end(m(ans, money), `So ${k} ${money ? `cost ${m(ans, money)}` : `need ${m(ans, money)}`}.`);
}

/** A recipe for s uses g grams; how much for w people? */
export function recipeLesson(s: number, g: number, w: number): Lesson {
  const L = new LessonBuilder();
  const one = clean(g / s);
  const ans = clean(one * w);
  const k = clean(w / s);
  if (Number.isInteger(k) && k > 1) {
    L.board = { kind: 'table', head: ['people', 'rice (g)'], rows: [{ cells: [String(s), f(g)] }, { at: 1, cells: [num(w), { v: f(ans), tone: 'good' as const }] }] };
    L.say(`${num(w)} people is ${k} times as many as ${s}, so you need ${k} times the rice.`, `${num(w)} ÷ ${s} = ${k}`);
    L.say(`Multiply the rice by ${k}.`, `${g} × ${k} = ${f(ans)} g`);
    L.slip(g + w, 'Scale by multiplying: more people need more of every ingredient, in the same proportion.');
    return L.end(f(ans), `So you need ${f(ans)} g.`);
  }
  L.board = { kind: 'table', head: ['people', 'rice (g)'], rows: [{ cells: [String(s), f(g)] }, { at: 1, cells: ['1', { v: f(one), tone: 'key' as const, hl: 1 }] }, { at: 2, cells: [num(w), { v: f(ans), tone: 'good' as const }] }] };
  L.say(`Find the rice for 1 person first: share ${g} g between ${s}.`, `${g} ÷ ${s} = ${f(one)} g`);
  L.say(`Then for ${num(w)} people:`, `${f(one)} × ${num(w)} = ${f(ans)} g`);
  L.slip(g + w, 'Scale by multiplying: more people need more of every ingredient, in the same proportion.');
  return L.end(f(ans), `So you need ${f(ans)} g.`);
}

/** w workers take d days; how long for w2? (inverse proportion) */
export function inverseLesson(w: number, d: number, w2: number): Lesson {
  const L = new LessonBuilder();
  const total = w * d;
  const ans = clean(total / w2);
  L.board = { kind: 'table', head: ['painters', 'days'], rows: [{ cells: [String(w), String(d)] }, { at: 1, cells: ['1', { v: String(total), tone: 'key' as const, hl: 1 }] }, { at: 2, cells: [String(w2), { v: num(ans), tone: 'good' as const }] }] };
  L.say('More painters finish faster: this is inverse proportion. When one doubles, the other halves.');
  L.say(`The whole job is ${w} painters × ${d} days. One painter alone would take:`, `${w} × ${d} = ${total} days`);
  L.say(`${w2} painters share that work:`, `${total} ÷ ${w2} = ${num(ans)} days`);
  L.slip(clean((d * w2) / w), 'More painters means fewer days, not more: this is inverse proportion.');
  return L.end(num(ans), `So ${w2} painters take ${num(ans)} days.`);
}

/** Speed, distance and time. */
export function sdtLesson(kind: 'd' | 's' | 't', s: number, t: number): Lesson {
  const L = new LessonBuilder();
  const d = clean(s * t);
  L.board = { kind: 'table', head: ['speed', 'time', 'distance'], rows: [{ cells: [{ v: kind === 's' ? '?' : `${s} km/h`, tone: kind === 's' ? 'good' : undefined }, { v: kind === 't' ? '?' : `${num(t)} h`, tone: kind === 't' ? 'good' : undefined }, { v: kind === 'd' ? '?' : `${num(d)} km`, tone: kind === 'd' ? 'good' : undefined }] }] };
  if (kind === 'd') {
    L.say(`${s} km/h means ${s} km in every hour. Distance = speed × time.`);
    const w = Math.floor(t);
    if (t === w) L.say(`${num(t)} hours at ${s} km each hour:`, `${s} × ${num(t)} = ${num(d)}`);
    else if (!w) L.say(`Half an hour goes half as far as 1 hour:`, `${s} ÷ 2 = ${num(d)}`);
    else L.say(`${num(t)} hours is ${w} hour${w === 1 ? '' : 's'} and a half:`, `${s} × ${w} = ${s * w}`, `half an hour: ${s} ÷ 2 = ${num(s / 2)}`, `${s * w} + ${num(s / 2)} = ${num(d)}`);
    L.slip(num(s / t), 'Distance = speed × time, not ÷.');
    return L.end(num(d), `So it goes ${num(d)} km.`);
  }
  if (kind === 's') {
    L.say('Speed is how far in 1 hour: speed = distance ÷ time.');
    L.say(`${num(d)} km in ${num(t)} h:`, `${num(d)} ÷ ${num(t)} = ${s}`);
    L.slip(num(d * t), 'Speed = distance ÷ time, not ×.');
    return L.end(s, `So the speed is ${s} km/h.`);
  }
  L.say(`At ${s} km/h it goes ${s} km each hour. Time = distance ÷ speed.`);
  L.say(`How many lots of ${s} km in ${num(d)} km?`, `${num(d)} ÷ ${s} = ${num(t)}`);
  return L.end(num(t), `So it takes ${num(t)} hours.`);
}

/** a : b, and one group has `diff` more; find the total. */
export function ratioDiffLesson(a: number, b: number, diff: number, who: [string, string]): Lesson {
  const L = new LessonBuilder();
  const gap = Math.abs(b - a);
  const unit = diff / gap;
  const total = (a + b) * unit;
  const big = Math.max(a, b);
  L.board = { kind: 'bars', bars: [{ label: who[0], len: a / big, parts: Array.from({ length: a }, (_, i) => ({ text: f(unit), textAt: 1, ...(a > b && i >= b ? { tone: 2 as const, on: 0 } : {}) })) }, { label: who[1], len: b / big, parts: Array.from({ length: b }, (_, i) => ({ text: f(unit), textAt: 1, ...(b > a && i >= a ? { tone: 2 as const, on: 0 } : {}) })) }] };
  L.say(`${who[0]} have ${a} parts and ${who[1]} have ${b} parts. The difference is ${gap} part${gap === 1 ? '' : 's'}.`);
  L.say(`${gap} part${gap === 1 ? '' : 's'} = ${diff}, so one part is:`, `${diff} ÷ ${gap} = ${f(unit)}`);
  L.say(`Altogether there are ${a} + ${b} = ${a + b} parts.`, `${a + b} × ${f(unit)} = ${f(total)}`);
  L.slip(unit * a, `That is only the ${who[0].toLowerCase()}. Count all ${a + b} parts.`);
  return L.end(total, `So there are ${f(total)} children.`);
}

/** y ∝ x²: find k, then y. */
export function squareProportion(x1: number, y1: number, x2: number): Lesson {
  const L = new LessonBuilder();
  const k = clean(y1 / (x1 * x1));
  const y2 = clean(k * x2 * x2);
  L.say('y is proportional to x² means y = k × x² for some number k.');
  L.say(`Use x = ${x1}, y = ${y1} to find k.`, `${y1} = k × ${x1}²`, `k = ${y1} ÷ ${x1 * x1} = ${f(k)}`);
  L.say(`So y = ${f(k)}x². Now put in x = ${x2}.`, `y = ${f(k)} × ${x2}² = ${f(k)} × ${x2 * x2} = ${f(y2)}`);
  L.slip(clean((y1 / x1) * x2), 'y goes with x², not x: square x before multiplying by k.');
  return L.end(y2);
}

/** The mean of some numbers. */
export function meanLesson(vals: number[]): Lesson {
  const L = new LessonBuilder();
  const sum = vals.reduce((p, c) => p + c, 0);
  const n = vals.length;
  L.say('The average (mean) shares the total out equally: add them all, then divide by how many there are.');
  L.say('Add them up.', `${vals.join(' + ')} = ${sum}`);
  L.say(`There are ${n} numbers, so ÷ ${n}.`, `${sum} ÷ ${n} = ${f(sum / n)}`);
  L.slip(sum, `That is the total. Share it between the ${n} numbers.`);
  return L.end(f(sum / n));
}

/** Mean known; one value missing. */
export function missingMeanLesson(n: number, mean: number, known: number[]): Lesson {
  const L = new LessonBuilder();
  const total = mean * n;
  const s = known.reduce((p, c) => p + c, 0);
  const miss = total - s;
  L.say(`An average of ${mean} for ${n} numbers means they add up to:`, `${mean} × ${n} = ${total}`);
  L.say(`The ${n - 1} you know add up to:`, `${known.join(' + ')} = ${s}`);
  L.say('The last one makes up the rest.', `${total} − ${s} = ${f(miss)}`);
  L.slip(mean, `The average is ${mean}, but the missing number makes the total ${total}.`);
  return L.end(f(miss));
}

/** Average speed over two equal-time legs. */
export function averageSpeed(t: number, s1: number, s2: number): Lesson {
  const L = new LessonBuilder();
  const d1 = s1 * t;
  const d2 = s2 * t;
  L.say('Average speed = total distance ÷ total time.');
  L.say('Distance of each part:', `${t} × ${s1} = ${d1} km`, `${t} × ${s2} = ${d2} km`);
  L.say('Total distance and total time:', `${d1} + ${d2} = ${d1 + d2} km`, `${t} + ${t} = ${2 * t} h`);
  L.say('Divide:', `${d1 + d2} ÷ ${2 * t} = ${f((d1 + d2) / (2 * t))}`);
  L.slip(s1 + s2, 'Don’t add the speeds: divide the total distance by the total time.');
  return L.end(f((d1 + d2) / (2 * t)), `So the average speed is ${f((d1 + d2) / (2 * t))} km/h.`);
}
