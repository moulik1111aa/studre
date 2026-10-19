// Fraction operations (Stages 5–7): simplifying, comparing and adding with different bottoms,
// mixed numbers, multiplying and dividing, fractions of amounts, negative fractions.

import { frac, gcd, lcm } from '../question.ts';
import { LessonBuilder, f, rs } from './build.ts';
import { fracBar, pieces } from './fractions.ts';
import type { Bar, Lesson } from './types.ts';

/** A fraction in lowest terms, with a real minus sign. */
export const fr = (n: number, d: number): string => frac(n, d).replace('-', '−');
/** A fraction as written in a sum: negative ones in brackets. */
const frb = (n: number, d: number): string => (n < 0 ? `(−${-n}/${d})` : `${n}/${d}`);

/** A positive fraction n/d as a mixed number ("2 1/3"), or a whole number. */
export function mixed(n: number, d: number): string {
  const g = gcd(n, d);
  n /= g;
  d /= g;
  const w = Math.floor(n / d);
  const r = n % d;
  if (r === 0) return String(w);
  return w ? `${w} ${r}/${d}` : `${r}/${d}`;
}

/** "Simplify: divide the top and the bottom by g." when it can be simplified. */
function simplifyStep(L: LessonBuilder, n: number, d: number): void {
  const g = gcd(n, d);
  if (g > 1 && n !== 0 && g === d) L.say(`The bottom goes into the top exactly, so it is a whole number.`, `${f(n)} ÷ ${d} = ${f(n / d)}`);
  else if (g > 1 && n !== 0) L.say(`Simplify: divide the top and the bottom by ${g}.`, `${n < 0 ? '−' : ''}${Math.abs(n)}/${d} = ${fr(n, d)}`);
}

/** N/D in its simplest form. */
export function simplifyLesson(N: number, D: number): Lesson {
  const L = new LessonBuilder();
  const g = gcd(N, D);
  const a = N / g;
  const b = D / g;
  if (D <= 30) L.board = { kind: 'bars', bars: [fracBar(N, D, { label: `${N}/${D}` }), fracBar(a, b, { label: `${a}/${b}`, at: 1, tone: 2 })] };
  L.say(`Divide the top and the bottom by the same number. Use the biggest number that goes into both ${N} and ${D}: ${g}.`, `${N} = ${g} × ${a}`, `${D} = ${g} × ${b}`);
  L.say(`Divide both by ${g}.`, `${N} ÷ ${g} = ${a}`, `${D} ÷ ${g} = ${b}`);
  L.say(`${a} and ${b} have no common factor except 1, so ${a}/${b} is as simple as it gets. The bars show it is the same amount.`);
  for (const k of [2, 3, 5]) if (k < g && g % k === 0) L.slip(`${N / k}/${D / k}`, `That is simpler, but not the simplest: ${N / k} and ${D / k} can still both be divided by ${g / k}.`);
  return L.end(`${a}/${b}`, `So ${N}/${D} = ${a}/${b}.`);
}

/** Which is bigger, a/b or c/d? Make the bottoms the same. */
export function compareUnlike(a: number, b: number, c: number, d: number): Lesson {
  const L = new LessonBuilder();
  const m = lcm(b, d);
  const A = (a * m) / b;
  const C = (c * m) / d;
  const big = A > C ? `${a}/${b}` : `${c}/${d}`;
  L.board = { kind: 'bars', bars: [fracBar(a, b, { label: `${a}/${b}` }), fracBar(c, d, { label: `${c}/${d}` })] };
  L.say(`The pieces are different sizes (${pieces(b)} and ${pieces(d)}), so make the bottoms the same. ${m} is in both the ${b} and the ${d} times tables.`);
  if (m === b) L.say(`${a}/${b} already has the bottom ${m}.`);
  else L.say(`Multiply the top and the bottom of ${a}/${b} by ${m / b}.`, `${a}/${b} = ${A}/${m}`);
  if (m === d) L.say(`${c}/${d} already has the bottom ${m}.`);
  else L.say(`Multiply the top and the bottom of ${c}/${d} by ${m / d}.`, `${c}/${d} = ${C}/${m}`);
  L.say(`Now the pieces match. Compare the tops: ${A} and ${C}.`, `${A}/${m} ${A > C ? '>' : '<'} ${C}/${m}`);
  L.slip(A > C ? `${c}/${d}` : `${a}/${b}`, 'A bigger number on the bottom means smaller pieces. Make the bottoms the same, then compare.');
  return L.end(big, `So ${big} is bigger.`);
}

/** x1/y1 ± x2/y2 with different bottoms. */
export function addUnlike(x1: number, y1: number, x2: number, y2: number, sub: boolean): Lesson {
  const L = new LessonBuilder();
  const m = lcm(y1, y2);
  const n1 = (x1 * m) / y1;
  const n2 = (x2 * m) / y2;
  const top = sub ? n1 - n2 : n1 + n2;
  const op = sub ? '−' : '+';
  if (m <= 24) {
    const bars: Bar[] = [fracBar(x1, y1, { label: `${x1}/${y1}` }), fracBar(n1, m, { label: `${n1}/${m}`, at: 1 }), fracBar(x2, y2, { label: `${x2}/${y2}`, tone: sub ? 3 : 2 }), fracBar(n2, m, { label: `${n2}/${m}`, at: 2, tone: sub ? 3 : 2 })];
    L.board = { kind: 'bars', bars };
  }
  L.say(`The bottoms are different, so first make them the same. ${m} is in both the ${y1} and the ${y2} times tables.`);
  if (m === y1) L.say(`${x1}/${y1} already has the bottom ${m}.`);
  else L.say(`Multiply the top and the bottom of ${x1}/${y1} by ${m / y1}.`, `${x1}/${y1} = ${n1}/${m}`);
  if (m === y2) L.say(`${x2}/${y2} already has the bottom ${m}.`);
  else L.say(`Multiply the top and the bottom of ${x2}/${y2} by ${m / y2}.`, `${x2}/${y2} = ${n2}/${m}`);
  L.say(`Now ${sub ? 'take away' : 'add'} the tops. The bottom stays ${m}.`, `${n1}/${m} ${op} ${n2}/${m} = ${top}/${m}`);
  simplifyStep(L, top, m);
  if (top > m && gcd(top, m) === 1) L.say(`That is more than 1 whole: ${top}/${m} = ${mixed(top, m)}.`);
  L.slip(fr(sub ? x1 - x2 : x1 + x2, sub ? Math.abs(y1 - y2) || 1 : y1 + y2), `Don't ${sub ? 'take away' : 'add'} the bottoms. Make the bottoms the same first, then ${sub ? 'take away' : 'add'} only the tops.`);
  return L.end(fr(top, m), undefined, `${x1}/${y1} ${op} ${x2}/${y2} = ${fr(top, m)}`);
}

/** w1 n1/d ± w2 n2/d (same bottom). */
export function mixedAddSub(w1: number, n1: number, w2: number, n2: number, d: number, sub: boolean): Lesson {
  const L = new LessonBuilder();
  const ans = mixed(sub ? w1 * d + n1 - (w2 * d + n2) : w1 * d + n1 + w2 * d + n2, d);
  if (!sub) {
    L.say('Add the wholes.', `${w1} + ${w2} = ${w1 + w2}`);
    const t = n1 + n2;
    L.say(`Add the fractions. The bottom stays ${d}.`, `${n1}/${d} + ${n2}/${d} = ${t}/${d}`);
    if (t >= d) {
      L.say(t === d ? `${t}/${d} is exactly 1 whole.` : `${t}/${d} is more than 1 whole (${d}/${d} = 1). Take out the whole.`, t === d ? `${t}/${d} = 1` : `${t}/${d} = 1 and ${t - d}/${d}`);
      L.say('Put it all together.', `${w1 + w2} + 1${t - d ? ` + ${t - d}/${d}` : ''} = ${mixed((w1 + w2 + 1) * d + t - d, d)}`);
    } else L.say('Put them together.', `${w1 + w2} + ${t}/${d} = ${mixed((w1 + w2) * d + t, d)}`);
    L.slip(mixed((w1 + w2) * d + (n1 + n2) % d, d), `${n1}/${d} + ${n2}/${d} makes more than a whole: carry 1 whole.`);
    return L.end(ans, `So the answer is ${ans}.`);
  }
  let a = w1;
  let top = n1;
  if (n1 < n2) {
    L.say(`${n1}/${d} is smaller than ${n2}/${d}, so change 1 whole into ${d}/${d}.`, `${w1} ${n1}/${d} = ${w1 - 1} ${n1 + d}/${d}`);
    a = w1 - 1;
    top = n1 + d;
  }
  L.say('Take away the wholes.', `${a} − ${w2} = ${a - w2}`);
  if (top === n2) L.say(`The fractions are the same, so they cancel: ${top}/${d} − ${n2}/${d} = 0. Only the wholes are left.`);
  else {
    L.say(`Take away the fractions. The bottom stays ${d}.`, `${top}/${d} − ${n2}/${d} = ${top - n2}/${d}`);
    const g = gcd(top - n2, d);
    if (g > 1) L.say(`Simplify: divide the top and the bottom by ${g}.`, `${top - n2}/${d} = ${fr(top - n2, d)}`);
    if (a - w2) L.say('Put them together.', `${a - w2} + ${fr(top - n2, d)} = ${ans}`);
  }
  if (n1 < n2) L.slip(mixed((w1 - w2) * d + (n2 - n1), d), `You can't take ${n2}/${d} from ${n1}/${d}: change a whole into ${d}/${d} first.`);
  return L.end(ans, `So the answer is ${ans}.`);
}

/** n/d × w. */
export function fracTimesWhole(n: number, d: number, w: number): Lesson {
  const L = new LessonBuilder();
  const top = n * w;
  if (w <= 4 && d <= 8) L.board = { kind: 'bars', bars: Array.from({ length: w }, (_, i) => fracBar(n, d, { label: i === 0 ? `${n}/${d}` : '+', at: i ? 1 : 0, tone: 2 })) };
  L.say(`${n}/${d} × ${w} means ${w} lots of ${n}/${d}.`, w <= 4 ? Array(w).fill(`${n}/${d}`).join(' + ') : null);
  L.say(`Multiply the top by ${w}. The bottom stays ${d}: the pieces are still ${pieces(d)}.`, `${n} × ${w} = ${top}`, `${top}/${d}`);
  simplifyStep(L, top, d);
  L.slip(fr(top, d * w), `Only the top is multiplied by ${w}: the pieces stay the same size.`);
  L.slip(fr(n + w, d), `× ${w} means ${w} lots of it, not + ${w}.`);
  return L.end(fr(top, d), undefined, `${n}/${d} × ${w} = ${fr(top, d)}`);
}

/** a/b × c/d. */
export function fracTimesFrac(a: number, b: number, c: number, d: number): Lesson {
  const L = new LessonBuilder();
  L.say(`To multiply fractions, multiply the tops together and the bottoms together.`);
  L.say('Tops:', `${a} × ${c} = ${a * c}`);
  L.say('Bottoms:', `${b} × ${d} = ${b * d}`, `${a * c}/${b * d}`);
  simplifyStep(L, a * c, b * d);
  L.slip(fr(a + c, b + d), 'For ×, multiply the tops and the bottoms. Adding them gives a different number.');
  L.slip(fr(a * d, b * c), 'That flips the second fraction: that is for ÷, not ×.');
  return L.end(fr(a * c, b * d), undefined, `${a}/${b} × ${c}/${d} = ${fr(a * c, b * d)}`);
}

/** w ÷ n/d: how many n/d fit into w? */
export function wholeDivFrac(w: number, n: number, d: number): Lesson {
  const L = new LessonBuilder();
  const ans = fr(w * d, n);
  if (n === 1) {
    if (w <= 5 && d <= 8) L.board = { kind: 'bars', bars: Array.from({ length: w }, () => fracBar(d, d, { tone: 1 })) };
    L.say(`${w} ÷ 1/${d} asks: how many ${pieces(d)} fit into ${w}?`);
    L.say(`Each whole has ${d} ${pieces(d)}. ${w} wholes have ${w} lots of ${d}.`, `${w} × ${d} = ${w * d}`);
    L.slip(fr(w, d), `Dividing by 1/${d} counts how many ${pieces(d)} fit: it makes the number bigger.`);
    return L.end(ans, undefined, `${w} ÷ 1/${d} = ${ans}`);
  }
  L.say(`Dividing by a fraction is the same as multiplying by it flipped over: ${n}/${d} becomes ${d}/${n}.`, `${w} ÷ ${n}/${d} = ${w} × ${d}/${n}`);
  L.say(`Multiply the top by ${w}.`, `${w} × ${d} = ${w * d}`, `${w * d}/${n}`);
  simplifyStep(L, w * d, n);
  L.slip(fr(w * n, d), `Flip the fraction you divide by: × ${d}/${n}, not × ${n}/${d}.`);
  return L.end(ans, undefined, `${w} ÷ ${n}/${d} = ${ans}`);
}

/** a/b ÷ c/d: keep, change, flip. */
export function fracDivFrac(a: number, b: number, c: number, d: number): Lesson {
  const L = new LessonBuilder();
  L.say('Keep the first fraction, change ÷ to ×, and flip the second fraction.', `${a}/${b} ÷ ${c}/${d} = ${a}/${b} × ${d}/${c}`);
  L.say('Multiply the tops and the bottoms.', `${a} × ${d} = ${a * d}`, `${b} × ${c} = ${b * c}`, `${a * d}/${b * c}`);
  simplifyStep(L, a * d, b * c);
  L.slip(fr(a * c, b * d), 'That multiplies without flipping. For ÷, flip the second fraction first.');
  L.slip(fr(b * c, a * d), 'Flip only the second fraction, not the first.');
  return L.end(fr(a * d, b * c), undefined, `${a}/${b} ÷ ${c}/${d} = ${fr(a * d, b * c)}`);
}

/** ₹total; spend 1/d1, then 1/d2 of what is left. */
export function fractionSteps(total: number, d1: number, d2: number): Lesson {
  const L = new LessonBuilder();
  const spent = total / d1;
  const rest = total - spent;
  const lunch = rest / d2;
  const left = rest - lunch;
  const bar1: Bar = { total: rs(total), parts: Array.from({ length: d1 }, (_, i) => ({ text: rs(spent), ...(i === 0 ? { tone: 3 as const, on: 0, cross: 0 } : {}) })) };
  const bar2: Bar = { at: 1, len: rest / total, total: rs(rest), parts: Array.from({ length: d2 }, (_, i) => ({ text: rs(lunch), textAt: 2, ...(i === 0 ? { tone: 3 as const, on: 2, cross: 2 } : {}) })) };
  L.board = { kind: 'bars', bars: [bar1, bar2] };
  L.say(`The book costs 1/${d1} of ${rs(total)}.`, `${rs(total)} ÷ ${d1} = ${rs(spent)}`);
  L.say('What is left after the book:', `${rs(total)} − ${rs(spent)} = ${rs(rest)}`);
  L.say(`Lunch is 1/${d2} of what is left, ${rs(rest)}.`, `${rs(rest)} ÷ ${d2} = ${rs(lunch)}`);
  L.say('What is left after lunch:', `${rs(rest)} − ${rs(lunch)} = ${rs(left)}`);
  L.slip(rest, `That is what is left after the book. Lunch still takes 1/${d2} of it.`);
  L.slip(total - total / d2, `Take away the book first; lunch is 1/${d2} of what is left, not of ${rs(total)}.`);
  return L.end(left, `So ${rs(left)} is left.`);
}

/** a/b + c/d or × with negatives. */
export function signedFracLesson(a: number, b: number, c: number, d: number, op: '+' | '×'): Lesson {
  const L = new LessonBuilder();
  if (op === '×') {
    const neg = (a < 0) !== (c < 0);
    L.say(`Multiply the sizes: tops together, bottoms together.`, `${Math.abs(a)}/${b} × ${Math.abs(c)}/${d} = ${Math.abs(a * c)}/${b * d}`);
    L.say(neg ? 'One fraction is negative and one is positive: different signs give a negative answer.' : 'The signs are the same, so the answer is positive.');
    simplifyStep(L, Math.abs(a * c), b * d);
    L.slip(fr(-a * c, b * d), 'Check the sign: same signs give +, different signs give −.');
    return L.end(fr(a * c, b * d), undefined, `${frb(a, b)} × ${frb(c, d)} = ${fr(a * c, b * d)}`);
  }
  const m = lcm(b, d);
  const A = (a * m) / b;
  const C = (c * m) / d;
  if (b === d) L.say(`The bottoms are already the same: ${m}.`);
  else L.say(`Make the bottoms the same: ${m}.`, b === m ? null : `${frb(a, b)} = ${frb(A, m)}`, d === m ? null : `${frb(c, d)} = ${frb(C, m)}`);
  L.say(`Now add the tops (keep their signs). The bottom stays ${m}.`, `${A < 0 ? f(A) : A} ${C < 0 ? '−' : '+'} ${Math.abs(C)} = ${f(A + C)}`, `${A + C < 0 ? '−' : ''}${Math.abs(A + C)}/${m}`);
  if (A + C !== 0) simplifyStep(L, A + C, m);
  L.slip(fr(a + c, b + d), "Don't add the bottoms: make them the same first.");
  return L.end(fr(A + C, m), undefined, `${frb(a, b)} + ${frb(c, d)} = ${fr(A + C, m)}`);
}

/** −a/b − c/d: both take you further below zero. */
export function negFracLesson(a: number, b: number, c: number, d: number): Lesson {
  const L = new LessonBuilder();
  const m = lcm(b, d);
  const A = (a * m) / b;
  const C = (c * m) / d;
  L.say(`Start at −${a}/${b} and go down another ${c}/${d}: both take you further below zero.`);
  if (b === d) L.say(`The bottoms are already the same: ${m}.`);
  else L.say(`Make the bottoms the same: ${m}.`, b === m ? null : `${a}/${b} = ${A}/${m}`, d === m ? null : `${c}/${d} = ${C}/${m}`);
  L.say('Add the sizes and keep the minus sign.', `−${A}/${m} − ${C}/${m} = −${A + C}/${m}`);
  simplifyStep(L, -(A + C), m);
  L.slip(fr(A + C, m), 'Going down from a negative number stays negative: keep the minus sign.');
  L.slip(fr(C - A, m), 'Both parts take you down, so add their sizes.');
  return L.end(fr(-(A + C), m), undefined, `−${a}/${b} − ${c}/${d} = ${fr(-(A + C), m)}`);
}

/** 1/a + 1/b = (a + b)/ab. */
export function unitFracSum(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  L.say(`Use ${a} × ${b} = ${a * b} as the common bottom.`, `1/${a} = ${b}/${a * b}`, `1/${b} = ${a}/${a * b}`);
  L.say('Add the tops. This is the shortcut: the top is a + b, the bottom is a × b.', `${b}/${a * b} + ${a}/${a * b} = ${a + b}/${a * b}`);
  simplifyStep(L, a + b, a * b);
  L.slip(fr(2, a + b), "Don't add the bottoms: 1/a + 1/b has the top a + b and the bottom a × b.");
  L.slip(fr(1, a + b), "Don't add the bottoms: 1/a + 1/b has the top a + b and the bottom a × b.");
  return L.end(fr(a + b, a * b), undefined, `1/${a} + 1/${b} = ${fr(a + b, a * b)}`);
}

export { f };
