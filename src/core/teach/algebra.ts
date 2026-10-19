// Algebra (Stages 5–7): substituting, collecting like terms, expanding with a grid, solving
// equations by doing the same to both sides, inequalities, sequences, factorising,
// quadratics, simultaneous equations and rearranging formulas.

import { clean } from '../question.ts';
import { LessonBuilder, f } from './build.ts';
import type { Bar, Lesson, TableBoard } from './types.ts';

/** "3x + 4" with tidy signs and coefficients (as the questions write it). */
export function lin(a: number, b: number, v = 'x'): string {
  const head = a === 0 ? '' : a === 1 ? v : a === -1 ? `−${v}` : `${a < 0 ? '−' : ''}${Math.abs(a)}${v}`;
  if (b === 0) return head || '0';
  if (!head) return b < 0 ? `−${-b}` : String(b);
  return `${head} ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;
}
export const signed = (n: number): string => (n < 0 ? `−${-n}` : String(n));
const sgn = (n: number): string => (n < 0 ? `− ${-n}` : `+ ${n}`);
/** "x² + 5x + 6" with tidy signs. */
export function quad(a: number, b: number, c: number, v = 'x'): string {
  const parts: string[] = [];
  parts.push(a === 1 ? `${v}²` : a === -1 ? `−${v}²` : `${a}${v}²`);
  if (b) parts.push(`${b < 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}${v}`);
  if (c) parts.push(sgn(c));
  return parts.join(' ');
}
export const bracket = (k: number, v = 'x'): string => `(${v} ${sgn(k)})`;
/** A term with its sign: first terms have no "+". */
function term(c: number, v: string, first: boolean): string {
  const mag = v ? (Math.abs(c) === 1 ? v : `${Math.abs(c)}${v}`) : String(Math.abs(c));
  if (first) return c < 0 ? `−${mag}` : mag;
  return `${c < 0 ? '−' : '+'} ${mag}`;
}
const br = (n: number): string => (n < 0 ? `(${f(n)})` : f(n));

// ── Substituting ───────────────────────────────────────────────────────────

/** If x = v, a·x + b = ? */
export function substLinear(a: number, b: number, x: number): Lesson {
  const L = new LessonBuilder();
  const ax = a * x;
  L.say(`Replace x with ${br(x)}. ${a}x means ${a} × x.`, `${a} × ${br(x)} ${sgn(b)}`);
  L.say('Multiply first.', `${a} × ${br(x)} = ${f(ax)}`);
  L.say(`Then ${b < 0 ? 'take away' : 'add'} ${Math.abs(b)}.`, `${f(ax)} ${sgn(b)} = ${f(ax + b)}`);
  L.slip(a + x + b, `${a}x means ${a} × x, not ${a} + x.`);
  if (b) L.slip(ax - b, `Keep the sign: it is ${sgn(b)}.`);
  return L.end(f(ax + b));
}

/** If x = v, x² + a = ? */
export function substSquare(x: number, a: number): Lesson {
  const L = new LessonBuilder();
  L.say(`Replace x with ${br(x)}. x² means x × x.`, `${br(x)}² + ${a}`);
  L.say(x < 0 ? 'A negative times a negative is positive.' : 'Square it first.', `${br(x)} × ${br(x)} = ${x * x}`);
  L.say(`Then add ${a}.`, `${x * x} + ${a} = ${x * x + a}`);
  L.slip(2 * x + a, 'x² is x × x, not 2 × x.');
  if (x < 0) L.slip(-(x * x) + a, `${br(x)}² is positive: ${br(x)} × ${br(x)} = ${x * x}.`);
  return L.end(x * x + a);
}

/** If a = p and b = q, 3a − 2b = ? */
export function subst2(p: number, q: number): Lesson {
  const L = new LessonBuilder();
  L.say(`Replace a with ${p} and b with ${q}. 3a means 3 × a.`, `3 × ${p} − 2 × ${q}`);
  L.say('Multiply first.', `3 × ${p} = ${3 * p}`, `2 × ${q} = ${2 * q}`);
  L.say('Then take away.', `${3 * p} − ${2 * q} = ${f(3 * p - 2 * q)}`);
  L.slip(3 * p + 2 * q, 'It is − 2b: take it away.');
  return L.end(f(3 * p - 2 * q));
}

// ── Like terms and expanding ───────────────────────────────────────────────

/** (a x + b) + c x + d. */
export function likeTerms(a: number, b: number, c: number, d: number): Lesson {
  const L = new LessonBuilder();
  const ans = lin(a + c, b + d);
  L.board = { kind: 'table', head: ['x terms', 'numbers'], rows: [{ cells: [`${term(a, 'x', true)} ${term(c, 'x', false)}`, `${term(b, '', true)} ${term(d, '', false)}`] }, { at: 2, cells: [{ v: lin(a + c, 0), tone: 'good' as const }, { v: f(b + d), tone: 'good' as const }] }] };
  L.say('Like terms are the same kind: x terms go together, and plain numbers go together. Keep each sign with its term.');
  L.say('Collect the x terms and the numbers.', `${term(a, 'x', true)} ${term(c, 'x', false)} = ${lin(a + c, 0)}`, `${term(b, '', true)} ${term(d, '', false)} = ${f(b + d)}`);
  L.say('Put them together.', ans);
  L.slip(lin(a + c + b + d, 0), 'x terms and numbers are different kinds: they can’t be added together.');
  L.slip(lin(a - c, b + d), `Keep the sign in front of ${Math.abs(c)}x: it is ${c < 0 ? '−' : '+'}.`);
  return L.end(ans, `So the answer is ${ans}.`);
}

/** k(a x + b): multiply each term inside. */
export function expandSingle(k: number, a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const ans = lin(k * a, k * b);
  L.board = { kind: 'table', head: ['×', term(a, 'x', true), term(b, '', false)], label: true, rows: [{ cells: [signed(k), { v: term(k * a, 'x', true), at: 1 }, { v: term(k * b, '', false), at: 1 }] }] };
  L.say(`Multiply every term inside the bracket by ${signed(k)}. A grid keeps track.`);
  L.say('Multiply each one.', `${signed(k)} × ${term(a, 'x', true)} = ${term(k * a, 'x', true)}`, `${signed(k)} × ${br(b)} = ${f(k * b)}`);
  L.slip(lin(k * a, b), `Multiply both terms by ${signed(k)}, not just the first.`);
  if (k < 0) L.slip(lin(k * a, -k * b), 'A negative times a negative is positive: watch the signs.');
  return L.end(ans, `So the answer is ${ans}.`);
}

/** (v + p)(v + s), using a grid. */
export function expandPair(p: number, s: number, v = 'x'): Lesson {
  const L = new LessonBuilder();
  const ans = quad(1, p + s, p * s, v);
  L.board = {
    kind: 'table',
    head: ['×', v, term(s, '', false)],
    label: true,
    rows: [
      { cells: [v, { v: `${v}²`, at: 1 }, { v: term(s, v, false), at: 1 }] },
      { cells: [term(p, '', false), { v: term(p, v, false), at: 2 }, { v: term(p * s, '', false), at: 2 }] },
    ],
  };
  L.say(`Multiply every term in the first bracket by every term in the second. A grid keeps track.`);
  L.say(`${v} times each term:`, `${v} × ${v} = ${v}²`, `${v} × ${br(s)} = ${term(s, v, true)}`);
  L.say(`${signed(p)} times each term:`, `${br(p)} × ${v} = ${term(p, v, true)}`, `${br(p)} × ${br(s)} = ${f(p * s)}`);
  if (p + s) L.say(`Collect the two ${v} terms.`, `${term(s, v, true)} ${term(p, v, false)} = ${term(p + s, v, true)}`);
  else L.say(`The two ${v} terms cancel out: ${term(s, v, true)} ${term(p, v, false)} = 0.`);
  if (p + s) L.slip(quad(1, 0, p * s, v), `Don't forget the middle terms from the grid: ${term(s, v, true)} and ${term(p, v, true)}.`);
  if (p === s) L.slip(quad(1, p, p * s, v), `The middle term is ${term(p, v, true)} twice: ${term(2 * p, v, true)}.`);
  return L.end(ans, `So the answer is ${ans}.`);
}

// ── Factorising ────────────────────────────────────────────────────────────

/** k a x + k b = k(a x + b). */
export function factorCommon(k: number, a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const inner = `${a === 1 ? '' : a}x + ${b}`;
  const ans = `${k}(${inner})`;
  L.say(`Find the biggest number that goes into both ${k * a} and ${k * b}: ${k}.`);
  L.say(`Divide each term by ${k}. That goes inside the bracket.`, `${k * a}x ÷ ${k} = ${a === 1 ? '' : a}x`, `${k * b} ÷ ${k} = ${b}`);
  L.say('Check by multiplying out.', `${k} × ${a === 1 ? '' : a}x + ${k} × ${b} = ${k * a}x + ${k * b} ✓`);
  L.slip(`${k}(${a === 1 ? '' : a}x + ${k * b})`, `Divide both terms by ${k}.`);
  return L.end(ans, `So the answer is ${ans}.`);
}

/** Pairs of numbers that multiply to C, signed to match B. Stops at the pair that adds to B. */
function pairsFor(B: number, C: number): [number, number][] {
  const out: [number, number][] = [];
  const A = Math.abs(C);
  for (let u = 1; u * u <= A; u++) {
    if (A % u) continue;
    const w = A / u;
    let pair: [number, number];
    if (C > 0) pair = B > 0 ? [u, w] : [-u, -w];
    else pair = B > 0 ? [-u, w] : [u, -w];
    out.push(pair);
    if (pair[0] + pair[1] === B) break;
  }
  return out;
}

/** Steps to factorise x² + Bx + C into (x + p)(x + s). */
function factorSteps(L: LessonBuilder, p: number, s: number): void {
  const B = p + s;
  const C = p * s;
  const pairs = pairsFor(B, C);
  L.board = { kind: 'table', head: ['pair', 'multiply', 'add'], rows: pairs.map(([u, w]) => { const ok = u + w === B; return { at: 1, cells: [{ v: `${f(u)}, ${f(w)}`, tone: ok ? 'good' as const : undefined }, f(u * w), { v: f(u + w), tone: ok ? 'good' as const : 'dim' as const }] }; }) };
  L.say(`Find two numbers that multiply to ${f(C)} and add to ${f(B)}.`);
  L.say(C > 0 ? `They multiply to a positive number, so both have the same sign: ${B > 0 ? 'both +' : 'both −'}. Try the pairs.` : 'They multiply to a negative number, so one is + and one is −. Try the pairs.');
  L.say(`${f(p)} and ${f(s)} work.`, `${br(p)} × ${br(s)} = ${f(C)}`, `${f(p)} ${s < 0 ? '−' : '+'} ${Math.abs(s)} = ${f(B)}`);
}

/** x² + Bx + C = (x + p)(x + s). */
export function factorQuad(p: number, s: number): Lesson {
  const L = new LessonBuilder();
  factorSteps(L, p, s);
  const ans = `${bracket(p)}${bracket(s)}`;
  L.slip(`${bracket(-p)}${bracket(-s)}`, 'Check the signs: multiply the brackets back out.');
  return L.end(ans, `So the answer is ${ans}.`);
}

/** a²x² − b² = (ax + b)(ax − b). */
export function diffSquares(a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const ax = a === 1 ? 'x' : `${a}x`;
  const lhs = a === 1 ? `x² − ${b * b}` : `${a * a}x² − ${b * b}`;
  L.say(`Both parts are squares: ${a === 1 ? 'x²' : `${a * a}x² = (${ax})²`} and ${b * b} = ${b}².`, `${lhs} = ${a === 1 ? 'x²' : `(${ax})²`} − ${b}²`);
  L.say('A difference of two squares always splits like this: A² − B² = (A + B)(A − B).');
  const mid = `${a * b}x`;
  L.say('Check: multiply out. The middle terms cancel.', `(${ax} + ${b})(${ax} − ${b}) = ${a === 1 ? 'x²' : `${a * a}x²`} − ${mid} + ${mid} − ${b * b} ✓`);
  L.slip(`(${ax} − ${b})²`, `(${ax} − ${b})² has a middle term. A difference of squares is (A + B)(A − B).`);
  return L.end(`(${ax} + ${b})(${ax} − ${b})`, `So the answer is (${ax} + ${b})(${ax} − ${b}).`);
}

/** Solve x² + Bx + C = 0 by factorising. */
export function solveQuad(p: number, s: number): Lesson {
  const L = new LessonBuilder();
  factorSteps(L, p, s);
  L.say('So the equation is:', `${bracket(p)}${bracket(s)} = 0`);
  L.say('If two things multiply to 0, one of them must be 0.', `x ${sgn(p)} = 0, so x = ${f(-p)}`, `x ${sgn(s)} = 0, so x = ${f(-s)}`);
  L.slip([p, s].sort((x, y) => x - y).join(','), 'Those are the numbers in the brackets. x makes a bracket 0, so change the signs.');
  const [lo, hi] = [-p, -s].sort((x, y) => x - y);
  return L.end([lo, hi].join(','), `So x = ${f(lo)} or x = ${f(hi)}.`);
}

// ── Equations ──────────────────────────────────────────────────────────────

/** One-step equations: x + a, x − a, ax, x ÷ a. */
export function eqOneStep(kind: 0 | 1 | 2 | 3, a: number, x: number): Lesson {
  const L = new LessonBuilder();
  const sides: [string, number, string, string][] = [
    [`x + ${a} = ${f(x + a)}`, x, `Take ${a} from both sides.`, `x = ${f(x + a)} − ${a} = ${f(x)}`],
    [`x − ${a} = ${f(x - a)}`, x, `Add ${a} to both sides.`, `x = ${f(x - a)} + ${a} = ${f(x)}`],
    [`${a}x = ${f(a * x)}`, x, `${a}x means ${a} × x. Divide both sides by ${a}.`, `x = ${f(a * x)} ÷ ${a} = ${f(x)}`],
    [`x ÷ ${a} = ${f(x)}`, a * x, `Multiply both sides by ${a}.`, `x = ${f(x)} × ${a} = ${f(a * x)}`],
  ];
  const [eq, ans, how, work] = sides[kind];
  L.say('An equation is a balance: do the same to both sides to get x on its own. Undo what is done to x.', eq);
  L.say(how, work);
  const checks = [`${f(ans)} + ${a} = ${f(x + a)} ✓`, `${f(ans)} − ${a} = ${f(x - a)} ✓`, `${a} × ${br(ans)} = ${f(a * x)} ✓`, `${f(ans)} ÷ ${a} = ${f(x)} ✓`];
  L.say('Check it in the equation.', checks[kind]);
  const wrong = [x + 2 * a, x - 2 * a, a * x - a, x][kind];
  L.slip(wrong, ['Undo + by taking away.', 'Undo − by adding.', 'Undo × by dividing.', 'Undo ÷ by multiplying.'][kind]);
  return L.end(f(ans), `So x = ${f(ans)}.`);
}

/** a x + b = R. */
export function eqTwoStep(a: number, b: number, R: number, o: { intro?: string } = {}): Lesson {
  const L = new LessonBuilder();
  const x = clean((R - b) / a);
  L.say(o.intro ?? `Undo in reverse order: first the ${b < 0 ? '− ' + -b : '+ ' + b}, then the × ${a}.`, `${lin(a, b)} = ${f(R)}`);
  L.say(b < 0 ? `Add ${-b} to both sides.` : `Take ${b} from both sides.`, `${a}x = ${f(R)} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${f(R - b)}`);
  L.say(`Divide both sides by ${a}.`, `x = ${f(R - b)} ÷ ${a} = ${f(x)}`);
  L.say('Check it.', `${a} × ${br(x)} ${sgn(b)} = ${f(R)} ✓`);
  L.slip(Math.round((R + b) / a), `Undo ${sgn(b)} with the opposite: ${b < 0 ? 'add' : 'take away'} ${Math.abs(b)}.`);
  return L.end(f(x), `So x = ${f(x)}.`);
}

/** a x + b = c x + d. */
export function eqBoth(a: number, b: number, c: number, d: number): Lesson {
  const L = new LessonBuilder();
  const k = a - c;
  const x = clean((d - b) / k);
  L.say('Get the x terms on one side. Take the smaller x term from both sides.', `${lin(a, b)} = ${lin(c, d)}`);
  L.say(`Take ${c === 1 ? '' : c}x from both sides.`, `${lin(k, b)} = ${f(d)}`);
  L.say(b < 0 ? `Add ${-b} to both sides.` : b ? `Take ${b} from both sides.` : 'Nothing to move.', `${k === 1 ? '' : k}x = ${f(d - b)}`);
  if (k !== 1) L.say(`Divide both sides by ${k}.`, `x = ${f(d - b)} ÷ ${k} = ${f(x)}`);
  L.say('Check both sides match.', `${a} × ${br(x)} ${sgn(b)} = ${f(a * x + b)}`, `${c} × ${br(x)} ${sgn(d)} = ${f(c * x + d)} ✓`);
  L.slip(-x, 'Watch the signs when you move a number across.');
  return L.end(f(x), `So x = ${f(x)}.`);
}

/** k(x + b) = R. */
export function eqBracket(k: number, b: number, R: number): Lesson {
  const L = new LessonBuilder();
  const inner = R / k;
  const x = inner - b;
  L.say(`The bracket is multiplied by ${k}. Divide both sides by ${k} first.`, `${k}(${lin(1, b)}) = ${f(R)}`, `${lin(1, b)} = ${f(R)} ÷ ${k} = ${f(inner)}`);
  L.say(b < 0 ? `Add ${-b} to both sides.` : `Take ${b} from both sides.`, `x = ${f(inner)} ${b < 0 ? '+' : '−'} ${Math.abs(b)} = ${f(x)}`);
  L.say('Check it.', `${k} × (${f(x)} ${sgn(b)}) = ${k} × ${br(inner)} = ${f(R)} ✓`);
  L.slip(inner, `That is x ${sgn(b)}. Now undo the ${sgn(b)}.`);
  L.slip(k * x, `Divide by ${k}, don't multiply.`);
  return L.end(f(x), `So x = ${f(x)}.`);
}

/** x/a + b = R. */
export function eqDivide(a: number, b: number, R: number): Lesson {
  const L = new LessonBuilder();
  const y = R - b;
  L.say(`Undo in reverse order: first the ${sgn(b)}, then the ÷ ${a}.`, `x/${a} ${sgn(b)} = ${f(R)}`);
  L.say(b < 0 ? `Add ${-b} to both sides.` : `Take ${b} from both sides.`, `x/${a} = ${f(y)}`);
  L.say(`Multiply both sides by ${a}.`, `x = ${f(y)} × ${a} = ${f(y * a)}`);
  L.slip(y, `That is x ÷ ${a}. Multiply by ${a} to get x.`);
  return L.end(f(y * a), `So x = ${f(y * a)}.`);
}

/** a x + b > R. */
export function ineqLesson(a: number, b: number, R: number): Lesson {
  const L = new LessonBuilder();
  const x = (R - b) / a;
  const ans = `x > ${signed(x)}`;
  L.say('Solve it like an equation, keeping the > sign.', `${lin(a, b)} > ${f(R)}`);
  L.say(b < 0 ? `Add ${-b} to both sides.` : b ? `Take ${b} from both sides.` : 'Nothing to move yet.', `${a}x > ${f(R - b)}`);
  L.say(`Divide both sides by ${a}. ${a} is positive, so the sign stays the same way round.`, `x > ${f(x)}`);
  L.say(`So any number bigger than ${f(x)} works. Check one: x = ${f(x + 1)}.`, `${a} × ${br(x + 1)} ${sgn(b)} = ${f(a * (x + 1) + b)} > ${f(R)} ✓`);
  L.slip(`x < ${signed(x)}`, `Dividing by a positive number keeps the sign the same way round.`);
  L.slip(`x > ${signed(R)}`, 'Solve for x: undo the + and the × first.');
  return L.end(ans, `So ${ans}.`);
}

/** Think of a number: × k, + p, gives R. */
export function thinkNumber(k: number, p: number, R: number): Lesson {
  const L = new LessonBuilder();
  const n = (R - p) / k;
  const bar: Bar = { total: f(R), parts: [...Array.from({ length: k }, () => ({ text: 'n', tone: 1 as const, on: 0 })), { w: Math.max(0.6, (p / Math.max(1, n)) * 1), text: f(p), tone: 2 as const, on: 0 }] };
  L.board = { kind: 'bars', bars: [bar] };
  L.say('Call the number n and write what happens to it.', `${k}n + ${p} = ${R}`);
  L.say(`Work backwards. Undo + ${p}: take ${p}.`, `${k}n = ${R} − ${p} = ${R - p}`);
  L.say(`Undo × ${k}: divide by ${k}.`, `n = ${R - p} ÷ ${k} = ${f(n)}`);
  L.say('Check it.', `${f(n)} × ${k} + ${p} = ${R} ✓`);
  L.slip(R - p, `That is ${k} lots of the number. Divide by ${k}.`);
  return L.end(f(n), `So the number is ${f(n)}.`);
}

/** Pen costs p more than a pencil; together T. */
export function penPencil(p: number, T: number): Lesson {
  const L = new LessonBuilder();
  const x = (T - p) / 2;
  L.board = { kind: 'bars', bars: [{ label: 'pencil', len: x / (x + p), parts: [{ text: 'x', tone: 1, on: 0 }] }, { label: 'pen', parts: [{ w: x, text: 'x', tone: 1, on: 0 }, { w: Math.max(p, x * 0.35), text: `₹${p}`, tone: 2, on: 0 }] }] };
  L.say(`Call the pencil's price x. The pen is x + ${p}.`, `x + (x + ${p}) = ${T}`);
  L.say('Collect the x terms.', `2x + ${p} = ${T}`);
  L.say(`Take ${p} from both sides, then divide by 2.`, `2x = ${T - p}`, `x = ${T - p} ÷ 2 = ${f(x)}`);
  L.say('Check it: pencil and pen together.', `₹${f(x)} + ₹${f(x + p)} = ₹${T} ✓`);
  L.slip(x + p, `₹${f(x + p)} is the pen. The pencil is ₹${p} less.`);
  return L.end(f(x), `So the pencil costs ₹${f(x)}.`);
}

// ── Sequences ──────────────────────────────────────────────────────────────

function ruleSteps(L: LessonBuilder, terms: number[], d: number, c: number): void {
  L.board = { kind: 'table', head: ['n', ...terms.map((_, i) => String(i + 1))], label: true, rows: [{ cells: [`${d === 1 ? '' : d === -1 ? '−' : signed(d)}n`, ...terms.map((_, i) => ({ v: f(d * (i + 1)), at: 1 }))] }, { cells: ['term', ...terms.map((t) => ({ v: f(t), tone: 'key' as const, hl: 2 }))] }] };
  L.say(`The terms ${d > 0 ? 'go up' : 'go down'} by ${Math.abs(d)} each time, so the rule starts with ${lin(d, 0, 'n')}: the ${signed(d)} times table.`, `${f(terms[1])} − ${br(terms[0])} = ${f(d)}`);
  L.say(`Write out ${lin(d, 0, 'n')} for n = 1, 2, 3, 4.`, terms.map((_, i) => f(d * (i + 1))).join(', '));
  L.say(c === 0 ? `The terms match ${lin(d, 0, 'n')} exactly.` : `Each term is ${Math.abs(c)} ${c > 0 ? 'more' : 'less'} than ${lin(d, 0, 'n')}.`, `${f(terms[0])} − ${br(d)} = ${f(c)}`);
}

/** The nth term of an arithmetic sequence. */
export function nthRule(terms: number[], d: number, c: number): Lesson {
  const L = new LessonBuilder();
  ruleSteps(L, terms, d, c);
  const ans = lin(d, c, 'n');
  L.slip(lin(c, d, 'n'), `The number in front of n is the jump, ${f(d)}.`);
  L.slip(lin(d, terms[0], 'n'), `The first term is ${lin(d, 0, 'n')} ${sgn(c)} when n = 1, so the extra is ${f(c)}, not ${f(terms[0])}.`);
  return L.end(ans, `So the nth term is ${ans}.`);
}

/** Term n of an arithmetic sequence. */
export function nthValue(terms: number[], d: number, c: number, n: number): Lesson {
  const L = new LessonBuilder();
  ruleSteps(L, terms, d, c);
  const v = d * n + c;
  L.say(`The rule is ${lin(d, c, 'n')}. Put in n = ${n}.`, c ? `${f(d)} × ${n} ${sgn(c)} = ${f(v)}` : `${f(d)} × ${n} = ${f(v)}`);
  L.slip(d * n, `Don't forget the ${sgn(c)} at the end.`);
  return L.end(f(v));
}

// ── Simultaneous equations, formulas, polynomials ─────────────────────────

/** x + y = S and a x − b y = R. */
export function simulLesson(x: number, y: number, a: number, b: number): Lesson {
  const L = new LessonBuilder();
  const S = x + y;
  const R = a * x - b * y;
  const ax = a === 1 ? 'x' : `${a}x`;
  const by = b === 1 ? 'y' : `${b}y`;
  L.say('Make the y terms cancel, so only x is left.', `x + y = ${f(S)}`, `${ax} − ${by} = ${f(R)}`);
  if (b > 1) L.say(`Multiply the first equation by ${b}, so it has + ${by}.`, `${b}x + ${by} = ${f(b * S)}`);
  L.say(`Add the two equations: + ${by} and − ${by} cancel.`, `${a + b}x = ${f(R + b * S)}`);
  L.say(`Divide by ${a + b}.`, `x = ${f(R + b * S)} ÷ ${a + b} = ${f(x)}`);
  L.say(`Put x = ${f(x)} into x + y = ${f(S)}.`, `y = ${f(S)} − ${br(x)} = ${f(y)}`);
  L.say('Check in the second equation.', `${a} × ${br(x)} − ${b} × ${br(y)} = ${f(R)} ✓`);
  L.slip(`x = ${y}; y = ${x}`, 'Check which is x and which is y: put them back into both equations.');
  return L.end(`x = ${x}; y = ${y}`, `So x = ${f(x)}; y = ${f(y)}.`);
}

const FORMULAS: Record<string, [string, [string, string][]]> = {
  'v = u + at': ['t', [['Take u from both sides.', 'v − u = at'], ['Divide both sides by a.', '(v − u) / a = t']]],
  'A = πr²': ['r', [['Divide both sides by π.', 'A / π = r²'], ['Take the square root of both sides.', '√(A / π) = r']]],
  'P = 2(l + w)': ['w', [['Divide both sides by 2.', 'P / 2 = l + w'], ['Take l from both sides.', 'P / 2 − l = w']]],
  'y = mx + c': ['x', [['Take c from both sides.', 'y − c = mx'], ['Divide both sides by m.', '(y − c) / m = x']]],
  'F = 9C/5 + 32': ['C', [['Take 32 from both sides.', 'F − 32 = 9C / 5'], ['Multiply both sides by 5.', '5(F − 32) = 9C'], ['Divide both sides by 9.', '5(F − 32) / 9 = C']]],
  's = d / t': ['t', [['Multiply both sides by t.', 'st = d'], ['Divide both sides by s.', 't = d / s']]],
  'A = lw': ['l', [['Divide both sides by w.', 'A / w = l']]],
  'C = 2πr': ['r', [['Divide both sides by 2π.', 'C / (2π) = r']]],
  'V = IR': ['R', [['Divide both sides by I.', 'V / I = R']]],
  'P = F / A': ['F', [['Multiply both sides by A.', 'PA = F']]],
  'E = mc²': ['m', [['Divide both sides by c².', 'E / c² = m']]],
  'y = 3x − 5': ['x', [['Add 5 to both sides.', 'y + 5 = 3x'], ['Divide both sides by 3.', '(y + 5) / 3 = x']]],
  'A = ½bh': ['h', [['Multiply both sides by 2.', '2A = bh'], ['Divide both sides by b.', '2A / b = h']]],
  'S = 180(n − 2)': ['n', [['Divide both sides by 180.', 'S / 180 = n − 2'], ['Add 2 to both sides.', 'S / 180 + 2 = n']]],
  'D = m / V': ['V', [['Multiply both sides by V.', 'DV = m'], ['Divide both sides by D.', 'V = m / D']]],
  'v² = u² + 2as': ['s', [['Take u² from both sides.', 'v² − u² = 2as'], ['Divide both sides by 2a.', '(v² − u²) / (2a) = s']]],
  'y = (x + 4) / 2': ['x', [['Multiply both sides by 2.', '2y = x + 4'], ['Take 4 from both sides.', '2y − 4 = x']]],
  'I = PRT / 100': ['R', [['Multiply both sides by 100.', '100I = PRT'], ['Divide both sides by PT.', '100I / (PT) = R']]],
};

/** Make a letter the subject of a formula. */
export function rearrangeLesson(formula: string, answer: string): Lesson {
  const L = new LessonBuilder();
  const [v, steps] = FORMULAS[formula] ?? ['x', []];
  L.say(`Get ${v} on its own. Undo what is done to ${v}, last thing first, doing the same to both sides.`, formula);
  for (const [say, math] of steps) L.say(say, math);
  return L.end(answer, `So ${answer}.`);
}

/** If x = v, a x² + b x + c (or x³ + b x + c) = ? */
export function evalPoly(x: number, a: number, b: number, c: number, cubic: boolean): Lesson {
  const L = new LessonBuilder();
  const pow = cubic ? x ** 3 : x * x;
  const lead = cubic ? pow : a * pow;
  const bx = b * x;
  const val = lead + bx + c;
  const sub = [cubic ? `${br(x)}³` : `${a === 1 ? '' : `${a} × `}${br(x)}²`, b ? `${b < 0 ? '−' : '+'} ${Math.abs(b) === 1 ? '' : `${Math.abs(b)} × `}${br(x)}` : '', c ? sgn(c) : ''].filter(Boolean).join(' ');
  L.say(`Replace every x with ${br(x)}.`, sub);
  L.say('Powers first.', cubic ? `${br(x)}³ = ${br(x)} × ${br(x)} × ${br(x)} = ${f(pow)}` : `${br(x)}² = ${br(x)} × ${br(x)} = ${f(pow)}`);
  const muls = [!cubic && a !== 1 ? `${a} × ${f(pow)} = ${f(lead)}` : '', b && Math.abs(b) !== 1 ? `${f(b)} × ${br(x)} = ${f(bx)}` : ''].filter(Boolean);
  if (muls.length) L.say('Then multiply.', ...muls);
  const items = [lead, b ? bx : null, c || null].filter((t): t is number => t !== null);
  L.say('Add them up.', `${items.map((t, i) => (i ? `${t < 0 ? '−' : '+'} ${f(Math.abs(t))}` : f(t))).join(' ')} = ${f(val)}`);
  if (x < 0) L.slip(cubic ? -(x ** 3) + bx + c : -a * x * x + bx + c, cubic ? `A negative number cubed stays negative: ${br(x)}³ = ${f(pow)}.` : `A negative number squared is positive: ${br(x)}² = ${f(pow)}.`);
  return L.end(f(val));
}

/** Which sign makes A ? b = res? Try each option. */
export function missingSignLesson(A: number, b: number, res: number, answer: string, options: string[]): Lesson {
  const L = new LessonBuilder();
  const ev = (op: string) => (op === '+' ? A + b : op === '−' ? A - b : op === '×' ? A * b : A / b);
  const right = answer;
  L.board = { kind: 'table', head: ['try', 'gives', ''], rows: options.map((o) => ({ at: 1, cells: [`${A} ${o} ${b}`, f(clean(ev(o))), { v: clean(ev(o)) === res ? '✓' : '✗', tone: clean(ev(o)) === res ? 'good' as const : 'bad' as const }] })) };
  L.say(`Try each sign between ${A} and ${b}, and see which one makes ${res}.`);
  L.say('Work each one out.', ...options.map((o) => `${A} ${o} ${b} = ${f(clean(ev(o)))}`));
  return L.end(right, `Only ${right} makes ${res}, so the sign is ${right}.`, `${A} ${right} ${b} = ${res}`);
}

/** Which two signs make a ? b ? c = res? (× before + and −.) Try the options. */
export function missingSigns2Lesson(a: number, b: number, c: number, res: number, options: string[]): Lesson {
  const L = new LessonBuilder();
  const ev = (x: number, op: string, y: number) => (op === '+' ? x + y : op === '−' ? x - y : x * y);
  const val = (p: string, s: string) => (s === '×' && p !== '×' ? ev(a, p, b * c) : ev(ev(a, p, b), s, c));
  const rows = options.map((o) => {
    const [p, s] = o.split(' ');
    return { o, p, s, v: val(p, s) };
  });
  const right = rows.find((r) => r.v === res) ?? rows[0];
  L.board = { kind: 'table', head: ['try', 'gives', ''], rows: rows.map((r) => ({ at: 1, cells: [`${a} ${r.p} ${b} ${r.s} ${c}`, f(r.v), { v: r.v === res ? '✓' : '✗', tone: r.v === res ? 'good' as const : 'bad' as const }] })) };
  L.say('Try each pair of signs. Remember × comes before + and −.');
  L.say('Work each one out.', ...rows.map((r) => (r.s === '×' && r.p !== '×' ? `${a} ${r.p} (${b} × ${c}) = ${f(r.v)}` : `${a} ${r.p} ${b} ${r.s} ${c} = ${f(r.v)}`)));
  return L.end(right.o, `Only that one makes ${f(res)}, so the signs are ${right.o}.`, `${a} ${right.p} ${b} ${right.s} ${c} = ${f(res)}`);
}

export type { TableBoard };
