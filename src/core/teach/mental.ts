// Mental shortcuts (Stages 5–7): × 9 / 99 / 999, compensation, estimating, × 5 / 25 / 125,
// ÷ 5 / 25, × 11, squares near 50 and 100 and ending in 5, the base method, the cross
// method, and roots of big perfect squares and cubes.

import { clean } from '../question.ts';
import { LessonBuilder, Line, f } from './build.ts';
import type { Lesson } from './types.ts';

/** n × (10ᵏ − 1) = n × 10ᵏ − n. */
export function nearPowerTimes(n: number, m: number): Lesson {
  const L = new LessonBuilder();
  const up = m + 1;
  L.say(`${m} is 1 less than ${up}. So ${n} × ${m} is ${n} × ${up}, take away one ${n}.`);
  L.say(`Multiply by ${up}: add ${String(up).length - 1} zero${up > 10 ? 's' : ''}.`, `${n} × ${up} = ${n * up}`);
  L.say(`Take away one ${n}.`, `${n * up} − ${n} = ${n * m}`);
  L.slip(n * up, `That is ${n} × ${up}. Take away one ${n}.`);
  L.slip(n * m + n, `Take ${n} away, don't add it.`);
  return L.end(n * m, undefined, `${n} × ${m} = ${n * m}`);
}

/** a ± near, where near is close to a hundred. */
export function compensate(a: number, near: number, sub: boolean): Lesson {
  const L = new LessonBuilder();
  const H = Math.round(near / 100) * 100;
  const d = near - H;
  const mid = sub ? a - H : a + H;
  const ans = sub ? a - near : a + near;
  const line = new Line('even');
  L.board = line.b;
  line.pt(a, 0, { tone: 'start' });
  L.say(`${near} is close to ${H}: it is ${H} ${d > 0 ? '+' : '−'} ${Math.abs(d)}.`);
  line.hop(a, mid, L.i).pt(mid, L.i, { tone: 'mark' });
  L.say(`${sub ? 'Take away' : 'Add'} ${H} first: that is easy.`, `${a} ${sub ? '−' : '+'} ${H} = ${mid}`);
  line.hop(mid, ans, L.i).pt(ans, L.i, { tone: 'end', hl: L.i + 1 });
  const fix = sub ? -d : d;
  L.say(fix > 0 ? `You ${sub ? 'took away' : 'added'} ${Math.abs(d)} too ${sub ? 'much' : 'little'}, so add ${Math.abs(fix)}.` : `You ${sub ? 'took away' : 'added'} ${Math.abs(d)} too ${sub ? 'little' : 'much'}, so take away ${Math.abs(fix)}.`, `${mid} ${fix > 0 ? '+' : '−'} ${Math.abs(fix)} = ${ans}`);
  L.slip(mid - fix, 'Adjust the other way: undo the change you made to make it round.');
  return L.end(ans, undefined, `${a} ${sub ? '−' : '+'} ${near} = ${ans}`);
}

/** Estimate a × b by rounding each to the nearest 10 (or to 1 significant figure). */
export function estimateProduct(a: number, b: number, toA: number, toB: number, o: { div?: number; exact?: boolean; how?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const A = Math.round(a / toA) * toA;
  const B = Math.round(b / toB) * toB;
  const p = A * B;
  const ans = o.div ? clean(p / o.div) : p;
  L.say(o.how ?? 'Round each number to 1 significant figure (its first digit, then zeros).', `${f(a)} ≈ ${A}`, `${f(b)} ≈ ${B}`);
  const za = String(A).length - String(A).replace(/0+$/, '').length;
  const zb = String(B).length - String(B).replace(/0+$/, '').length;
  L.say('Multiply the first digits, then put back all the zeros.', `${A / 10 ** za} × ${B / 10 ** zb} = ${(A / 10 ** za) * (B / 10 ** zb)}`, `${A} × ${B} = ${p}`);
  if (o.div) L.say(`Then ÷ ${o.div}.`, `${p} ÷ ${o.div} = ${f(ans)}`);
  if (o.exact !== false) L.slip(clean(o.div ? (a * b) / o.div : a * b), 'That is the exact answer. An estimate rounds first, so it is quick.');
  L.slip(ans * 10, 'Count the zeros again.');
  return L.end(f(ans), `So it is about ${f(ans)}.`);
}

/** a × 5, 25, 125: a = k × q, and k × m is 10, 100 or 1000. */
export function timesFriendly(a: number, m: number): Lesson {
  const L = new LessonBuilder();
  const k = m === 5 ? 2 : m === 25 ? 4 : 8;
  const big = k * m;
  const q = a / k;
  L.say(`${k} × ${m} = ${big}. So split ${a} into ${k} × ${q}.`, `${a} × ${m} = ${q} × ${k} × ${m}`);
  L.say(`${k} × ${m} makes ${big}.`, `${q} × ${big} = ${q * big}`);
  L.slip(a * m * 2, `Split off a ${k}: ${k} × ${m} = ${big}.`);
  return L.end(a * m, undefined, `${a} × ${m} = ${a * m}`);
}

/** a ÷ 5 or ÷ 25: × 2 (or × 4), then ÷ 10 (or ÷ 100). */
export function divFriendly(a: number, m: number): Lesson {
  const L = new LessonBuilder();
  const k = 100 / m === 20 ? 2 : 4;
  const t = m === 5 ? 10 : 100;
  L.say(`÷ ${m} is the same as × ${k} then ÷ ${t}, because ${m} × ${k} = ${t}.`);
  L.say(`× ${k}:`, `${a} × ${k} = ${a * k}`);
  L.say(`÷ ${t}:`, `${a * k} ÷ ${t} = ${f(a / m)}`);
  L.slip(a / (m * 2), `Multiply by ${k}, then divide by ${t}.`);
  return L.end(f(a / m), undefined, `${a} ÷ ${m} = ${f(a / m)}`);
}

/** n × 11 for a 3-digit number: first digit, neighbour sums, last digit. */
export function times11Three(n: number): Lesson {
  const L = new LessonBuilder();
  const [a, b, c] = String(n).split('').map(Number);
  L.say(`× 11 = × 10 + × 1. A shortcut: keep the outside digits, and add neighbouring digits in between. Work from the right.`, `${a} | ${a} + ${b} | ${b} + ${c} | ${c}`);
  const ones = c;
  const s1 = b + c;
  const tens = s1 % 10;
  const c1 = Math.floor(s1 / 10);
  L.sayThen('Ones: the last digit.', `${c}`, `Write ${ones}.`);
  L.sayThen('Tens: add the last two digits.', `${b} + ${c} = ${s1}`, c1 ? `Write ${tens}, carry 1.` : `Write ${tens}.`);
  const s2 = a + b + c1;
  const hund = s2 % 10;
  const c2 = Math.floor(s2 / 10);
  L.sayThen('Hundreds: add the first two digits.', c1 ? `${a} + ${b} + 1 (carried) = ${s2}` : `${a} + ${b} = ${s2}`, c2 ? `Write ${hund}, carry 1.` : `Write ${hund}.`);
  const th = a + c2;
  L.sayThen('Thousands: the first digit.', c2 ? `${a} + 1 (carried) = ${th}` : `${a}`, `Write ${th}.`);
  L.slip(n * 10, `That is × 10. × 11 is one more ${n}.`);
  return L.end(n * 11, undefined, `${n} × 11 = ${n * 11}`);
}

/** (10t + 5)²: t × (t + 1), then 25. */
export function squareEnding5(n: number): Lesson {
  const L = new LessonBuilder();
  const t = (n - 5) / 10;
  L.say(`For a number ending in 5, take the part before the 5 (${t}) and multiply it by the next number up (${t + 1}).`, `${t} × ${t + 1} = ${t * (t + 1)}`);
  L.say('Then write 25 on the end.', `${t * (t + 1)} | 25 → ${n * n}`);
  L.say(`Why it works: ${n}² = (${t}0 + 5)² = ${t}0 × ${t + 1}0 + 25.`, `${t * 10} × ${(t + 1) * 10} + 25 = ${n * n}`);
  L.slip(t * t * 100 + 25, `Multiply ${t} by the next number up, ${t + 1}, not by itself.`);
  return L.end(n * n, undefined, `${n}² = ${n * n}`);
}

/** (50 + d)² = (25 + d) hundreds + d². */
export function squareNear50(n: number): Lesson {
  const L = new LessonBuilder();
  const d = n - 50;
  L.say(`${n} is 50 ${d > 0 ? '+' : '−'} ${Math.abs(d)}. 50² = 2500 is 25 hundreds.`);
  L.say(`Start from 25 ${d > 0 ? '+' : '−'} ${Math.abs(d)} hundreds.`, `25 ${d > 0 ? '+' : '−'} ${Math.abs(d)} = ${25 + d}`, `${25 + d} × 100 = ${(25 + d) * 100}`);
  L.say(`Add ${Math.abs(d)}² = ${d * d}.`, `${(25 + d) * 100} + ${d * d} = ${n * n}`);
  L.say(`Why: (50 ${d > 0 ? '+' : '−'} ${Math.abs(d)})² = 2500 ${d > 0 ? '+' : '−'} 100 × ${Math.abs(d)} + ${d * d}.`);
  L.slip((25 + d) * 100, `Don't forget to add ${Math.abs(d)}² = ${d * d}.`);
  return L.end(n * n, undefined, `${n}² = ${n * n}`);
}

/** (100 + d)² = (100 + 2d) hundreds + d². */
export function squareNear100(n: number): Lesson {
  const L = new LessonBuilder();
  const d = n - 100;
  const X = n + d;
  L.say(`${n} is 100 ${d > 0 ? '+' : '−'} ${Math.abs(d)}. ${d > 0 ? 'Add' : 'Take'} ${Math.abs(d)} ${d > 0 ? 'to' : 'from'} ${n} to get the hundreds.`, `${n} ${d > 0 ? '+' : '−'} ${Math.abs(d)} = ${X}`, `${X} × 100 = ${X * 100}`);
  L.say(`Add ${Math.abs(d)}² = ${d * d}.`, `${X * 100} + ${d * d} = ${n * n}`);
  L.say(`Why: (100 ${d > 0 ? '+' : '−'} ${Math.abs(d)})² = 10000 ${d > 0 ? '+' : '−'} 200 × ${Math.abs(d)} + ${d * d}.`);
  L.slip(X * 100, `Don't forget to add ${Math.abs(d)}² = ${d * d}.`);
  return L.end(n * n, undefined, `${n}² = ${n * n}`);
}

/** a × b with both near 100: cross-add, then multiply the differences. */
export function base100(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const p = a - 100;
  const s = b - 100;
  const cross = a + s;
  const ps = p * s;
  const pm = (x: number) => (x < 0 ? `− ${-x}` : `+ ${x}`);
  L.say(`How far is each from 100?`, `${a} = 100 ${pm(p)}`, `${b} = 100 ${pm(s)}`);
  L.say(`Cross: ${a} ${pm(s)} gives the hundreds.`, `${a} ${pm(s)} = ${cross}`, `${cross} × 100 = ${cross * 100}`);
  const br = (x: number) => (x < 0 ? `(${f(x)})` : f(x));
  L.say(`Multiply the two differences.`, `${br(p)} × ${br(s)} = ${f(ps)}`);
  L.say(ps < 0 ? 'It is negative, so take it away.' : 'Add it on.', `${cross * 100} ${pm(ps)} = ${a * b}`);
  L.slip(cross * 100, `Don't forget the differences multiplied: ${f(ps)}.`);
  return L.end(a * b, undefined, `${a} × ${b} = ${a * b}`);
}

/** 2-digit × 2-digit by the cross method. */
export function crossMultiply(x: number, y: number): Lesson {
  const L = new LessonBuilder();
  const [a, b] = [Math.floor(x / 10), x % 10];
  const [c, d] = [Math.floor(y / 10), y % 10];
  const u = b * d;
  L.board = { kind: 'table', head: ['', 'tens', 'ones'], label: true, rows: [{ cells: [String(x), String(a), String(b)] }, { cells: [String(y), String(c), String(d)] }] };
  L.sayThen('Ones × ones.', `${b} × ${d} = ${u}`, `Write ${u % 10}${u >= 10 ? `, carry ${Math.floor(u / 10)}` : ''}.`);
  const mid = a * d + b * c + Math.floor(u / 10);
  L.sayThen('Cross multiply and add (plus the carry).', `${a} × ${d} + ${b} × ${c}${u >= 10 ? ` + ${Math.floor(u / 10)}` : ''} = ${mid}`, `Write ${mid % 10}${mid >= 10 ? `, carry ${Math.floor(mid / 10)}` : ''}.`);
  const top = a * c + Math.floor(mid / 10);
  L.sayThen('Tens × tens (plus the carry).', `${a} × ${c}${mid >= 10 ? ` + ${Math.floor(mid / 10)}` : ''} = ${top}`, `Write ${top}.`);
  L.say('Read the digits you wrote, left to right.', `${top} | ${mid % 10} | ${u % 10}`);
  return L.end(x * y, undefined, `${x} × ${y} = ${x * y}`);
}

/** ∛ of a 6-digit perfect cube: last digit, then the thousands. */
export function cubeRootBig(c: number): Lesson {
  const L = new LessonBuilder();
  const n = Math.round(Math.cbrt(c));
  const last = c % 10;
  const LAST: Record<number, number> = { 0: 0, 1: 1, 2: 8, 3: 7, 4: 4, 5: 5, 6: 6, 7: 3, 8: 2, 9: 9 };
  const th = Math.floor(c / 1000);
  const t = Math.floor(n / 10);
  L.board = { kind: 'table', head: ['n', 'n³'], rows: [t, t + 1].map((k) => ({ cells: [String(k), { v: String(k ** 3), tone: 'key' as const, hl: 2 }] })) };
  L.say(`Split ${c.toLocaleString('en-US')} into the last three digits and the rest: ${th} | ${String(c % 1000).padStart(3, '0')}.`);
  L.say(`The ones digit: cubes of 0–9 all end differently. A cube ending in ${last} comes from a number ending in ${LAST[last]}.`, `${LAST[last]}³ = ${LAST[last] ** 3}`);
  L.say(`The tens digit: ${th} is between ${t}³ = ${t ** 3} and ${t + 1}³ = ${(t + 1) ** 3}, so the tens digit is ${t}.`);
  L.slip(n + 10, `${th} is less than ${t + 1}³ = ${(t + 1) ** 3}, so the tens digit is ${t}.`);
  return L.end(n, undefined, `∛${c} = ${n}`);
}

/** √ of a 4-digit perfect square: the tens, two possible ones digits, then pick. */
export function squareRootBig(c: number): Lesson {
  const L = new LessonBuilder();
  const n = Math.round(Math.sqrt(c));
  const t = Math.floor(n / 10);
  const last = c % 10;
  const ends = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (d * d) % 10 === last);
  const mid = (10 * t + 5) ** 2;
  L.board = { kind: 'table', head: ['n', 'n²'], rows: [10 * t, 10 * t + 5, 10 * t + 10].map((k) => ({ cells: [String(k), { v: String(k * k), tone: 'key' as const, hl: k === 10 * t + 5 ? 2 : 0 }] })) };
  L.say(`${c} is between ${10 * t}² = ${(10 * t) ** 2} and ${10 * t + 10}² = ${(10 * t + 10) ** 2}, so the root is in the ${10 * t}s.`);
  if (ends.length === 1) {
    L.say(`${c} ends in ${last}. Only numbers ending in ${ends[0]} make squares ending in ${last}.`);
  } else {
    L.say(`${c} ends in ${last}, so the root ends in ${ends[0]} or ${ends[1]}.`, `${10 * t + ends[0]} or ${10 * t + ends[1]}`);
    L.say(`Compare with ${10 * t + 5}² = ${mid}. ${c} is ${c < mid ? 'smaller' : 'bigger'}, so take the ${c < mid ? 'smaller' : 'bigger'} one.`);
  }
  L.slip(n + 10, `The root is in the ${10 * t}s: ${c} is less than ${(10 * t + 10) ** 2}.`);
  return L.end(n, undefined, `√${c} = ${n}`);
}

/** √x to the nearest whole number. */
export function nearestRoot(x: number): Lesson {
  const L = new LessonBuilder();
  const n = Math.floor(Math.sqrt(x));
  const lo = n * n;
  const hi = (n + 1) ** 2;
  L.board = { kind: 'table', head: ['n', 'n²'], rows: [n, n + 1].map((k) => ({ cells: [String(k), { v: String(k * k), tone: (x - lo <= hi - x ? k === n : k === n + 1) ? ('good' as const) : undefined, hl: 2 }] })) };
  L.say(`Find the squares either side of ${x}.`, `${n}² = ${lo}`, `${n + 1}² = ${hi}`);
  L.say(`${x} is ${x - lo} above ${lo} and ${hi - x} below ${hi}.`);
  const ans = x - lo <= hi - x ? n : n + 1;
  L.say(`It is closer to ${ans === n ? lo : hi}, so √${x} is closer to ${ans}.`);
  return L.end(ans, `So √${x} ≈ ${ans}.`);
}
