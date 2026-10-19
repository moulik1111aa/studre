// Percentages (Stages 5–7): converting, finding a percent of an amount (10% and 1% building
// blocks), increase and decrease, reverse percentages, profit and loss, interest, GST, and
// chains of changes. A bar shows the whole as 100%.

import { clean, frac, gcd, num } from '../question.ts';
import { LessonBuilder, f, rs } from './build.ts';
import type { Bar, BarPart, Lesson, TableBoard } from './types.ts';

const pc = (p: number): string => `${num(p)}%`;

/** A bar for the whole (100%) with p% shaded. */
function pctBar(p: number, o: { at?: number; on?: number; total?: string; label?: string; tone?: 1 | 2 | 3 } = {}): Bar {
  const parts: BarPart[] = [{ w: p, tone: o.tone ?? 2, on: o.on ?? o.at ?? 0, text: pc(p) }];
  if (p < 100) parts.push({ w: 100 - p, text: pc(100 - p) });
  return { at: o.at ?? 0, parts, ...(o.total ? { total: o.total } : {}), ...(o.label ? { label: o.label } : {}) };
}

/** A bar of ten 10% parts, k of them shaded (plus half a part for an extra 5%). */
function tensBar(k: number, half: boolean, each: string, total: string, textAt: number, on: number): Bar {
  const parts: BarPart[] = [];
  for (let i = 0; i < 10; i++) {
    if (half && i === k) {
      parts.push({ w: 0.5, tone: 2, on }, { w: 0.5 });
      continue;
    }
    parts.push({ text: each, textAt: textAt, ...(i < k ? { tone: 2 as const, on } : {}) });
  }
  return { parts, total };
}

/**
 * Steps that work out p% of n (with money if `money`): halves and quarters as fractions,
 * multiples of 5 from 10%, anything else from 1%. Returns the value. Sets a board if none.
 */
export function pctOfSteps(L: LessonBuilder, p: number, n: number, money = false): number {
  const m = (x: number) => (money ? rs(x) : f(x));
  const v = clean((n * p) / 100);
  const FR: Record<number, [number, number, string]> = { 50: [1, 2, 'half'], 25: [1, 4, 'a quarter'], 75: [3, 4, 'three quarters'] };
  if (p === 100) {
    L.say(`100% is the whole amount: ${m(n)}.`);
    return n;
  }
  if (FR[p]) {
    const [a, b, word] = FR[p];
    if (!L.board) L.board = { kind: 'bars', bars: [{ total: m(n), parts: Array.from({ length: b }, (_, i) => ({ text: m(n / b), ...(i < a ? { tone: 2 as const, on: L.i } : {}) })) }] };
    if (a === 1) L.say(`${pc(p)} is ${word}: ÷ ${b}.`, `${m(n)} ÷ ${b} = ${m(v)}`);
    else L.say(`${pc(p)} is ${word}: ÷ ${b}, then × ${a}.`, `${m(n)} ÷ ${b} = ${m(n / b)}`, `${m(n / b)} × ${a} = ${m(v)}`);
    return v;
  }
  const ten = clean(n / 10);
  if (p % 5 === 0 && Number.isInteger(clean(ten * 2 * (money ? 100 : 1)))) {
    const k = Math.floor(p / 10);
    const half = p % 10 === 5;
    if (!L.board) L.board = { kind: 'bars', bars: [tensBar(Math.max(k, p === 10 ? 1 : 0), half, m(ten), m(n), L.i, p === 10 ? L.i : L.i + 1)] };
    L.say(`Find 10% first: 10% is 1/10, so ÷ 10.`, `10% of ${m(n)} = ${m(ten)}`);
    if (p === 10) return v;
    if (p === 5) {
      L.say('5% is half of 10%.', `${m(ten)} ÷ 2 = ${m(v)}`);
      return v;
    }
    if (!half) L.say(`${pc(p)} is ${k} lots of 10%.`, `${k} × ${m(ten)} = ${m(v)}`);
    else L.say(`${pc(p)} is ${k} lots of 10%, and 5% more (half of 10%).`, `${k} × ${m(ten)} = ${m(k * ten)}`, `${m(k * ten)} + ${m(ten / 2)} = ${m(v)}`);
    return v;
  }
  const one = clean(n / 100);
  if (!L.board) L.board = { kind: 'bars', bars: [pctBar(p, { total: m(n), on: L.i + 1 })] };
  L.say('Find 1% first: 1% is 1/100, so ÷ 100.', `1% of ${m(n)} = ${m(one)}`);
  L.say(`${pc(p)} is ${num(p)} lots of 1%.`, `${num(p)} × ${m(one)} = ${m(v)}`);
  return v;
}

/** p% of n. */
export function pctOfLesson(p: number, n: number, o: { money?: boolean; intro?: string; show?: string; end?: string } = {}): Lesson {
  const L = new LessonBuilder();
  if (o.intro) L.say(o.intro);
  const v = pctOfSteps(L, p, n, o.money);
  if (p !== 10) L.slip(clean(n / 10), `That is 10%. ${pc(p)} is a different amount.`);
  if (p !== 50) L.slip(clean(n / 2), 'That is 50% (half).');
  L.slip(clean(n * p / 10), 'Percent means out of 100: divide by 100, not 10.');
  return L.end(o.money ? rs(v) : f(v), o.end, o.show ?? `${pc(p)} of ${o.money ? rs(n) : f(n)} = ${o.money ? rs(v) : f(v)}`);
}

/** p% as a decimal, a fraction, or a decimal as a percent. */
export function pctConvert(p: number, to: 'dec' | 'frac' | 'pct'): Lesson {
  const L = new LessonBuilder();
  L.board = { kind: 'bars', bars: [pctBar(Math.min(100, p))] };
  if (to === 'dec') {
    L.say('Percent means out of 100.', `${pc(p)} = ${num(p)}/100`);
    L.say('÷ 100 moves the digits 2 places to the right of the point.', `${num(p)} ÷ 100 = ${num(p / 100)}`);
    L.slip(num(p / 10), '÷ 100 moves the digits 2 places, not 1.');
    return L.end(num(p / 100));
  }
  if (to === 'pct') {
    L.say('A percent is out of 100, so × 100.', `${num(p / 100)} × 100 = ${num(p)}`);
    L.slip(num(p / 10), '× 100 moves the digits 2 places, not 1.');
    return L.end(num(p), `So ${num(p / 100)} = ${pc(p)}.`);
  }
  const top = Number.isInteger(p) ? p : p * 10;
  const bottom = Number.isInteger(p) ? 100 : 1000;
  L.say('Percent means out of 100.', `${pc(p)} = ${num(p)}/100`);
  if (!Number.isInteger(p)) L.say('No decimals in a fraction: × 10 on the top and the bottom.', `${num(p)}/100 = ${top}/${bottom}`);
  const g = gcd(top, bottom);
  if (g > 1) L.say(`Simplify: divide the top and the bottom by ${g}.`, `${top}/${bottom} = ${frac(top, bottom)}`);
  return L.end(frac(top, bottom));
}

/** part out of total as a percent. */
export function pctOfTotal(part: number, total: number, o: { intro?: string; end?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const p = clean((part / total) * 100);
  if (o.intro) L.say(o.intro);
  L.board = { kind: 'bars', bars: [{ total: f(total), parts: [{ w: part, tone: 2, on: 0, text: f(part) }, ...(part < total ? [{ w: total - part, text: f(total - part) }] : [])] }] };
  L.say(`${f(part)} out of ${f(total)} is the fraction ${part}/${total}.`);
  let [a, b] = [part, total];
  const g = gcd(a, b);
  if (100 % b !== 0 && g > 1) {
    [a, b] = [a / g, b / g];
    L.say(`Simplify it first: divide the top and the bottom by ${g}.`, `${part}/${total} = ${a}/${b}`);
  }
  if (b !== 100) L.say(`Make the bottom 100: ${b < 100 ? `multiply the top and the bottom by ${num(100 / b)}` : `divide the top and the bottom by ${num(b / 100)}`}.`, `${a}/${b} = ${num(p)}/100`);
  L.slip(num(part), `${f(part)} is the part. Turn ${part}/${total} into a number out of 100.`);
  return L.end(num(p), o.end ?? `So it is ${pc(p)}.`);
}

/** price goes up or down by p%. */
export function pctChangePrice(price: number, p: number, up: boolean, o: { what?: string; label?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const what = o.what ?? (up ? 'the increase' : 'the decrease');
  L.say(`First find ${what}: ${pc(p)} of ${rs(price)}.`);
  const c = pctOfSteps(L, p, price, true);
  const nw = clean(up ? price + c : price - c);
  L.say(up ? 'Add it on.' : 'Take it off.', `${rs(price)} ${up ? '+' : '−'} ${rs(c)} = ${rs(nw)}`);
  L.slip(c, `${rs(c)} is the ${p}% on its own. ${up ? 'Add it to' : 'Take it from'} the price.`);
  L.slip(clean(up ? price - c : price + c), up ? 'Going up means add.' : 'Going down means take away.');
  return L.end(rs(nw), `So the ${o.label ?? 'new price'} is ${rs(nw)}.`);
}

/** Percentage change from old to new (base = old). */
export function pctChangeLesson(old: number, nw: number, o: { base?: string; word?: string; money?: boolean } = {}): Lesson {
  const L = new LessonBuilder();
  const m = (x: number) => (o.money ? rs(x) : f(x));
  const ch = Math.abs(clean(nw - old));
  const p = clean((ch / old) * 100);
  const word = o.word ?? (nw > old ? 'rise' : 'fall');
  L.board = { kind: 'bars', bars: [{ label: 'start', total: m(old), parts: [{ tone: 1, on: 0, text: m(old) }] }, { label: 'change', at: 1, len: ch / old, parts: [{ tone: nw > old ? 2 : 3, on: 1, text: m(ch) }] }] };
  L.say(`Percentage change compares the change with the ${o.base ?? 'starting amount'}, ${m(old)}.`);
  L.say(`The ${word}:`, `${m(Math.max(old, nw))} − ${m(Math.min(old, nw))} = ${m(ch)}`);
  L.say(`As a fraction of ${m(old)}, then × 100:`, `${num(ch)}/${num(old)} × 100 = ${num(p)}`);
  L.slip(Math.round((ch / nw) * 100), `Divide by the ${o.base ?? 'starting amount'}, ${m(old)}, not the new one.`);
  return L.end(num(p), `So the ${word} is ${pc(p)}.`);
}

/** After a p% change the price is now; find the original. */
export function reversePctLesson(now: number, p: number, up: boolean): Lesson {
  const L = new LessonBuilder();
  const pct = up ? 100 + p : 100 - p;
  const g = gcd(pct, 100);
  const unit = clean(now / (pct / g));
  const orig = clean(unit * (100 / g));
  const cnt = pct / g;
  L.board = {
    kind: 'bars',
    bars: [
      { label: 'now', total: `${rs(now)} = ${pct}%`, parts: Array.from({ length: cnt }, () => ({ text: `${g}%`, tone: 2 as const, on: 0 })) },
      { label: 'before', at: 2, len: 100 / pct, total: '100%', parts: Array.from({ length: 100 / g }, () => ({ text: rs(unit), tone: 1 as const, on: 2 })) },
    ],
  };
  L.say(`The original price is 100%. After a ${p}% ${up ? 'increase' : 'decrease'}, the price is ${100}% ${up ? '+' : '−'} ${p}% = ${pct}% of it.`, `${pct}% = ${rs(now)}`);
  L.say(`Find ${g}%: ${pct}% is ${cnt} lots of ${g}%.`, `${g}% = ${rs(now)} ÷ ${cnt} = ${rs(unit)}`);
  L.say(`100% is ${100 / g} lots of ${g}%.`, `100% = ${100 / g} × ${rs(unit)} = ${rs(orig)}`);
  L.slip(Math.round(now * (1 + ((up ? -1 : 1) * p) / 100)), `The ${p}% was of the original price, not of ${rs(now)}. Work back from ${pct}%.`);
  return L.end(rs(orig), `So the original price was ${rs(orig)}.`);
}

/** Simple interest: R% of P each year, for T years. */
export function simpleInterestLesson(P: number, R: number, T: number): Lesson {
  const L = new LessonBuilder();
  L.say('Simple interest is the same every year: R% of the amount you start with.');
  const y = pctOfSteps(L, R, P, true);
  const I = clean(y * T);
  if (T > 1) L.say(`That is for 1 year. For ${T} years:`, `${T} × ${rs(y)} = ${rs(I)}`);
  L.slip(clean(P + I), `${rs(clean(P + I))} is the total in the bank. The interest is just the extra.`);
  if (T > 1) L.slip(y, `That is 1 year of interest. Multiply by ${T} years.`);
  return L.end(rs(I), `So the interest is ${rs(I)}.`, `${rs(P)} × ${R} × ${T} ÷ 100 = ${rs(I)}`);
}

/** Compound growth (interest) or decay (depreciation), year by year. */
export function compoundLesson(P: number, R: number, T: number, down = false): Lesson {
  const L = new LessonBuilder();
  const rows: TableBoard['rows'] = [];
  let a = P;
  L.say(down ? `Each year it loses ${R}% of what it is worth at the start of that year.` : `Each year earns ${R}% of the amount at the start of that year, so the interest grows.`);
  for (let y = 1; y <= T; y++) {
    const c = clean((a * R) / 100);
    const nxt = clean(down ? a - c : a + c);
    rows.push({ at: L.i, cells: [`${y}`, rs(a), `${down ? '−' : '+'} ${rs(c)}`, { v: rs(nxt), tone: y === T ? 'good' : undefined }] });
    L.say(`Year ${y}: ${R}% of ${rs(a)} is ${rs(c)}.`, `${rs(a)} ${down ? '−' : '+'} ${rs(c)} = ${rs(nxt)}`);
    a = nxt;
  }
  L.board = { kind: 'table', head: ['year', 'start', down ? 'loss' : 'interest', 'end'], rows };
  const simple = clean(down ? P - (P * R * T) / 100 : P + (P * R * T) / 100);
  if (T > 1 && simple !== a) L.slip(simple, down ? `That takes ${R}% of the first value every year. Each year's loss is ${R}% of the new value.` : `That is simple interest. With compound interest, each year earns interest on the new amount.`);
  if (!down) L.slip(clean(a - P), `${rs(clean(a - P))} is the interest only. The question asks for the final amount.`);
  return L.end(rs(a), down ? `So it is worth ${rs(a)}.` : `So the final amount is ${rs(a)}.`);
}

/** Up and down changes one after another, starting from 100. Returns where it ends. */
function successiveSteps(L: LessonBuilder, changes: number[]): number {
  let v = 100;
  const rows: TableBoard['rows'] = [];
  L.say('Pretend the price starts at 100. Then every amount is also a percent of the start.');
  for (const ch of changes) {
    const c = clean((v * Math.abs(ch)) / 100);
    const nxt = clean(ch > 0 ? v + c : v - c);
    rows.push({ at: L.i, cells: [`${ch > 0 ? 'up' : 'down'} ${Math.abs(ch)}%`, num(v), `${ch > 0 ? '+' : '−'} ${num(c)}`, num(nxt)] });
    L.say(`${ch > 0 ? 'Up' : 'Down'} ${Math.abs(ch)}% of ${num(v)}: that is ${num(c)}.`, `${num(v)} ${ch > 0 ? '+' : '−'} ${num(c)} = ${num(nxt)}`);
    v = nxt;
  }
  L.board = { kind: 'table', head: ['change', 'start', '', 'end'], rows };
  return v;
}

/** Overall % change after several changes. */
export function netChangeLesson(changes: number[]): Lesson {
  const L = new LessonBuilder();
  const v = successiveSteps(L, changes);
  const net = clean(v - 100);
  L.say(`From 100 to ${num(v)} is a change of ${f(net)}.`, `${num(v)} − 100 = ${f(net)}`);
  L.slip(num(changes.reduce((p, c) => p + c, 0)), 'Percentages don’t simply add: the second change is a percent of the new amount.');
  return L.end(f(net), `So the overall change is ${f(net)}%.`);
}

/** The final value as a % of the start after a chain of changes. */
export function chainLesson(changes: number[]): Lesson {
  const L = new LessonBuilder();
  const v = successiveSteps(L, changes);
  const r = clean(Math.round(v * 10) / 10);
  L.slip(num(100 + changes.reduce((p, c) => p + c, 0)), 'Each change is a percent of the new amount, so you can’t just add them.');
  return L.end(num(r), `So the final price is ${r !== v ? `about ` : ''}${num(r)}% of the start.`);
}

/** Price after two discounts, one after the other. */
export function twoDiscounts(price: number, a: number, b: number): Lesson {
  const L = new LessonBuilder();
  L.say(`First ${a}% off ${rs(price)}.`);
  const c1 = pctOfSteps(L, a, price, true);
  const p1 = clean(price - c1);
  L.say('Take it off.', `${rs(price)} − ${rs(c1)} = ${rs(p1)}`);
  const c2 = clean((p1 * b) / 100);
  const p2 = clean(p1 - c2);
  L.say(`Then ${b}% off the new price, ${rs(p1)}.`, `${b}% of ${rs(p1)} = ${rs(c2)}`, `${rs(p1)} − ${rs(c2)} = ${rs(p2)}`);
  L.slip(clean(price * (1 - (a + b) / 100)), `The second discount is ${b}% of the new price, not of ${rs(price)}.`);
  return L.end(rs(p2), `So the final price is ${rs(p2)}.`);
}

/** Discount, then GST on the new price. */
export function discountThenGst(price: number, disc: number, gst: number): Lesson {
  const L = new LessonBuilder();
  L.say(`First the discount: ${disc}% of ${rs(price)}.`);
  const c = pctOfSteps(L, disc, price, true);
  const p1 = clean(price - c);
  L.say('Take it off.', `${rs(price)} − ${rs(c)} = ${rs(p1)}`);
  const g = clean((p1 * gst) / 100);
  const p2 = clean(p1 + g);
  L.say(`Then add ${gst}% GST on the new price, ${rs(p1)}.`, `${gst}% of ${rs(p1)} = ${rs(g)}`, `${rs(p1)} + ${rs(g)} = ${rs(p2)}`);
  L.slip(clean(price * (1 + (gst - disc) / 100)), 'GST is added to the price after the discount, so do it in two steps.');
  return L.end(rs(p2), `So the final price is ${rs(p2)}.`);
}

/** a% of b = b% of a. */
export function pctSwapLesson(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  L.say(`${a}% of ${b} is the same as ${b}% of ${a}: both are ${a} × ${b} ÷ 100.`);
  L.say(`${b}% of ${a} is easier.`);
  const v = pctOfSteps(L, b, a);
  L.slip(clean((a * b) / 10), 'Percent means out of 100: divide by 100.');
  return L.end(f(v), undefined, `${a}% of ${b} = ${b}% of ${a} = ${f(v)}`);
}

export { pc };
