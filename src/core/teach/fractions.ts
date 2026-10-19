// Fractions: bars split into equal parts, fractions of amounts (bar model), equivalent
// fractions, comparing, the four operations, mixed numbers and simplifying.

import { frac, gcd, lcm } from '../question.ts';
import { LessonBuilder, f } from './build.ts';
import type { Bar, BarPart, Lesson } from './types.ts';

/** A bar of d equal parts with the first n shaded (from step `on`). */
export function fracBar(n: number, d: number, o: { at?: number; on?: number; tone?: 1 | 2 | 3; label?: string; total?: string; texts?: string[] } = {}): Bar {
  const parts: BarPart[] = Array.from({ length: d }, (_, i) => ({ ...(i < n ? { tone: o.tone ?? 1, on: o.on ?? o.at ?? 0 } : {}), ...(o.texts ? { text: o.texts[i] } : {}) }));
  return { at: o.at ?? 0, parts, ...(o.label ? { label: o.label } : {}), ...(o.total ? { total: o.total } : {}) };
}

/** n/d of a whole amount, with a bar model: split into d parts, then take n of them. */
export function fracOf(n: number, d: number, whole: number, show = `${n}/${d} of ${f(whole)} = ${f((whole * n) / d)}`): Lesson {
  const one = whole / d;
  const L = new LessonBuilder();
  const bar = fracBar(0, d, { total: f(whole), texts: Array.from({ length: d }, () => f(one)) });
  bar.parts.forEach((p) => (p.textAt = 1));
  L.board = { kind: 'bars', bars: [bar] };
  L.say(`The whole bar is ${f(whole)}. The bottom number, ${d}, says: split it into ${d} equal parts.`);
  if (n === 1) {
    bar.parts[0].tone = 2;
    bar.parts[0].on = 1;
  }
  L.say(`Each part is ${f(whole)} ÷ ${d}.`, `${f(whole)} ÷ ${d} = ${f(one)}`);
  if (n === 1) {
    L.slip(whole - one, `1/${d} is just one of the ${d} parts.`);
    return L.end(one, undefined, show);
  }
  bar.parts.slice(0, n).forEach((p) => {
    p.tone = 2;
    p.on = L.i;
  });
  L.say(`The top number, ${n}, says: take ${n} of those parts.`, `${n} × ${f(one)} = ${f(n * one)}`);
  L.slip(one, `That is 1/${d}. We need ${n} parts, so × ${n}.`);
  L.slip(whole / n, `Split into ${d} parts (the bottom number), then take ${n}.`);
  return L.end(n * one, undefined, show);
}


const DEN = ['', 'whole', 'half', 'third', 'quarter', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
/** "quarters", "eighths" (the size of the pieces). */
export const pieces = (d: number): string => (d === 2 ? 'halves' : d <= 12 ? `${DEN[d]}s` : `${d}ths`);

/** What fraction of the shape is shaded? */
export function shapeFraction(shaded: number, parts: number): Lesson {
  const L = new LessonBuilder();
  const ans = frac(shaded, parts);
  const g = gcd(shaded, parts);
  L.board = { kind: 'bars', bars: [fracBar(shaded, parts)] };
  L.say(`Count all the equal parts: ${parts}. That is the bottom number.`);
  L.say(`Count the shaded parts: ${shaded}. That is the top number.`, `${shaded}/${parts}`);
  if (g > 1) L.say(`${shaded}/${parts} can be made simpler: divide the top and the bottom by ${g}.`, `${shaded}/${parts} = ${ans}`);
  L.slip(frac(parts - shaded, parts), 'That counts the parts that are not shaded.');
  if (parts - shaded !== shaded) L.slip(frac(shaded, parts - shaded), 'The bottom number is all the parts, shaded or not.');
  return L.end(ans);
}

/** A quarter of n: halve, then halve again. */
export function quarterOf(n: number): Lesson {
  const L = new LessonBuilder();
  const bar = fracBar(1, 4, { tone: 2, on: 2, texts: [String(n / 4), String(n / 4), String(n / 4), String(n / 4)], total: String(n) });
  bar.parts.forEach((p) => (p.textAt = 2));
  L.board = { kind: 'bars', bars: [bar] };
  L.say('A quarter means 1 of 4 equal parts. That is half of a half.');
  L.say(`Halve ${n}.`, `half of ${n} = ${n / 2}`);
  L.say('Halve it again.', `half of ${n / 2} = ${n / 4}`);
  L.slip(n / 2, 'That is a half. A quarter is half again.');
  return L.end(n / 4, undefined, `A quarter of ${n} = ${n / 4}`);
}

/** Equivalent fractions: do the same to the top and the bottom. */
export function equivLesson(nu: number, dn: number, m: number, findTop: boolean): Lesson {
  const L = new LessonBuilder();
  const D = dn * m;
  const N = nu * m;
  if (D <= 36) L.board = { kind: 'bars', bars: [fracBar(nu, dn, { label: `${nu}/${dn}` }), fracBar(N, D, { label: `${N}/${D}`, at: findTop ? 2 : 0, tone: 2 })] };
  if (findTop) {
    L.say(`The bottom changed from ${dn} to ${D}.`, `${dn} × ${m} = ${D}`);
    L.say(`Do the same to the top: × ${m}.`, `${nu} × ${m} = ${N}`);
    L.slip(nu + (D - dn), `Multiply the top by ${m}, the same as the bottom — don't add.`);
    return L.end(N, `So ${nu}/${dn} = ${N}/${D}.`);
  }
  L.say(`The top changed from ${N} to ${nu}.`, `${N} ÷ ${m} = ${nu}`);
  L.say(`Do the same to the bottom: ÷ ${m}.`, `${D} ÷ ${m} = ${dn}`);
  L.slip(D, `Divide the bottom by ${m} too.`);
  return L.end(dn, `So ${N}/${D} = ${nu}/${dn}.`);
}

/** Compare fractions with the same denominator: more pieces of the same size is bigger. */
export function compareSameDen(a: number, b: number, dn: number): Lesson {
  const L = new LessonBuilder();
  const big = Math.max(a, b);
  L.board = { kind: 'bars', bars: [fracBar(a, dn, { label: `${a}/${dn}` }), fracBar(b, dn, { label: `${b}/${dn}` })] };
  L.say(`Both are cut into ${dn} equal pieces: ${pieces(dn)}.`);
  L.say(`${a} ${pieces(dn)} and ${b} ${pieces(dn)}: more pieces of the same size is more.`);
  return L.end(`${big}/${dn}`, `So ${big}/${dn} is bigger.`);
}

/** Add or subtract fractions with the same denominator. */
export function addSameDen(a: number, b: number, dn: number, sub: boolean): Lesson {
  const L = new LessonBuilder();
  const top = sub ? a - b : a + b;
  const ans = frac(top, dn);
  const parts = Array.from({ length: dn }, (_, i) => {
    if (sub) return i < a ? { tone: (i >= a - b ? 3 : 1) as 1 | 3, on: i >= a - b ? 1 : 0, cross: i >= a - b ? 1 : undefined } : {};
    return i < a ? { tone: 1 as const, on: 0 } : i < a + b ? { tone: 2 as const, on: 1 } : {};
  });
  L.board = { kind: 'bars', bars: [{ parts, total: `1 whole = ${dn}/${dn}` }] };
  L.say(`Both are ${pieces(dn)}: the bottom number, ${dn}, is the size of the pieces.`);
  L.say(sub ? `Take away the tops. The bottom stays ${dn}.` : `Add the tops. The bottom stays ${dn}.`, `${a} ${sub ? '−' : '+'} ${b} = ${top}`, `${top}/${dn}`);
  if (gcd(top, dn) > 1 && top) L.say(`Simplify: divide the top and the bottom by ${gcd(top, dn)}.`, `${top}/${dn} = ${ans}`);
  if (!sub) L.slip(frac(top, 2 * dn), "Don't add the bottoms: the pieces stay the same size.");
  return L.end(ans);
}

/** A mixed number as an improper fraction. */
export function toImproper(w: number, nu: number, dn: number): Lesson {
  const L = new LessonBuilder();
  const imp = w * dn + nu;
  L.board = { kind: 'bars', bars: [...Array.from({ length: w }, () => fracBar(dn, dn)), fracBar(nu, dn, { at: 1 })] };
  L.say(`Each whole is ${dn} ${pieces(dn)}. ${w} whole${w === 1 ? '' : 's'} make:`, `${w} × ${dn} = ${w * dn}`);
  L.say(`Add the ${nu} more.`, `${w * dn} + ${nu} = ${imp}`);
  L.slip(`${w * nu + dn}/${dn}`, `Multiply the whole number by the bottom (${w} × ${dn}), then add the top.`);
  return L.end(`${imp}/${dn}`, `So ${w} ${nu}/${dn} = ${imp}/${dn}.`);
}

/** An improper fraction as a mixed number. */
export function toMixed(imp: number, dn: number): Lesson {
  const L = new LessonBuilder();
  const w = Math.floor(imp / dn);
  const nu = imp % dn;
  L.board = { kind: 'bars', bars: [...Array.from({ length: w }, (_, i) => fracBar(dn, dn, { at: 1, label: i === 0 ? '' : undefined })), fracBar(nu, dn, { at: 1 })] };
  L.say(`How many wholes are in ${imp} ${pieces(dn)}? Each whole is ${dn}.`, `${imp} ÷ ${dn} = ${w} r ${nu}`);
  L.say(`That is ${w} whole${w === 1 ? '' : 's'}, with ${nu} ${pieces(dn)} left over.`);
  return L.end(`${w} ${nu}/${dn}`, `So ${imp}/${dn} = ${w} ${nu}/${dn}.`);
}

export { frac, gcd, lcm };
