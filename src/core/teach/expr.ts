// Order of operations, step by step: brackets, powers, × and ÷ (left to right), then + and −
// (left to right). Works on whole numbers, decimals and negatives.

import { clean } from '../question.ts';
import { LessonBuilder, f } from './build.ts';
import type { Lesson, PicBoard } from './types.ts';
import type { ExprPart } from '../vis.ts';

type Op = '+' | '−' | '×' | '÷' | '^';
type Tok = { t: 'n'; v: number } | { t: 'o'; v: Op } | { t: '(' } | { t: ')' };

/** Read "3 + 4 × (2 − 5)²" into tokens; ² ³ become ^2 ^3; a minus after an operator or "(" is a sign. */
export function tokens(src: string): Tok[] {
  const s = src.replace(/²/g, '^2').replace(/³/g, '^3').replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const prev = out[out.length - 1];
    const signPos = !prev || prev.t === 'o' || prev.t === '(';
    if ((c === '−' || c === '-') && signPos) {
      const m = /^[−-](\d+(?:\.\d+)?)/.exec(s.slice(i));
      // −3² is −(3²): a sign binds less tightly than a power.
      if (m && s[i + m[0].length] === '^') {
        out.push({ t: 'n', v: -1 }, { t: 'o', v: '×' });
        i++;
        continue;
      }
      if (m) {
        out.push({ t: 'n', v: -Number(m[1]) });
        i += m[0].length;
        continue;
      }
      // −(…) or −x² : treat as −1 × …
      out.push({ t: 'n', v: -1 }, { t: 'o', v: '×' });
      i++;
      continue;
    }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (m) {
      out.push({ t: 'n', v: Number(m[0]) });
      i += m[0].length;
    } else if (c === '(') {
      out.push({ t: '(' });
      i++;
    } else if (c === ')') {
      out.push({ t: ')' });
      i++;
    } else if ('+−-×÷^*/x'.includes(c)) {
      const v = (c === '-' ? '−' : c === '*' || c === 'x' ? '×' : c === '/' ? '÷' : c) as Op;
      out.push({ t: 'o', v });
      i++;
    } else throw new Error(`bad character ${c}`);
  }
  return out;
}

/** A "−1 ×" the reader put in for a leading minus sign (−2², −(3 + 1)). */
const isSignOne = (ts: Tok[], k: number) => {
  const t = ts[k], nx = ts[k + 1], pv = ts[k - 1];
  return t?.t === 'n' && t.v === -1 && nx?.t === 'o' && nx.v === '×' && (!pv || pv.t === 'o' || pv.t === '(') && ts[k + 2] && (ts[k + 2].t === '(' || (ts[k + 3]?.t === 'o' && (ts[k + 3] as { v: Op }).v === '^'));
};

function show(ts: Tok[]): string {
  return ts
    .map((t, k) => {
      if (isSignOne(ts, k)) return '−';
      if (k > 0 && isSignOne(ts, k - 1)) return '';
      if (t.t === 'n') {
        const prev = ts[k - 1];
        const next = ts[k + 1];
        const pow = next?.t === 'o' && next.v === '^';
        return t.v < 0 && ((prev && prev.t === 'o') || pow) ? `(${f(t.v)})` : f(t.v);
      }
      if (t.t === 'o') return t.v === '^' ? '^' : ` ${t.v} `;
      return t.t;
    })
    .join('')
    .replace(/\^(\d+)/g, (_, e: string) => e.split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join(''))
    .replace(/\(\s/g, '(')
    .replace(/\s\)/g, ')');
}

const apply = (a: number, op: Op, b: number): number => clean(op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : op === '÷' ? a / b : a ** b);

/** Find the next operation in a run of tokens with no brackets: index of its operator. */
function nextOp(ts: Tok[], from: number, to: number): number {
  const ops = (set: Op[]) => {
    for (let k = from; k < to; k++) {
      const t = ts[k];
      if (t.t === 'o' && set.includes(t.v)) return k;
    }
    return -1;
  };
  const p = ops(['^']);
  if (p >= 0) return p;
  const md = ops(['×', '÷']);
  if (md >= 0) return md;
  return ops(['+', '−']);
}

/** Chips for the expression strip: tokens lo..hi (inclusive) are boxed as one chip. */
function partsOf(ts: Tok[], lo = -1, hi = -1): ExprPart[] {
  const out: ExprPart[] = [];
  for (let k = 0; k < ts.length; k++) {
    if (k === lo) {
      out.push({ t: show(ts.slice(lo, hi + 1)), box: true });
      k = hi;
      continue;
    }
    const t = ts[k];
    const nx = ts[k + 1];
    if (isSignOne(ts, k) && k + 1 !== lo && k !== lo) {
      out.push({ t: '−', sign: true });
      k++;
      continue;
    }
    if (t.t === 'n' && nx?.t === 'o' && nx.v === '^' && ts[k + 2]?.t === 'n' && k + 2 !== lo) {
      out.push({ t: show(ts.slice(k, k + 3)) });
      k += 2;
    } else if (t.t === 'n') out.push({ t: show([t]) });
    else if (t.t === 'o') out.push({ t: t.v === '^' ? '^' : t.v, sign: true });
    else out.push({ t: t.t, sign: true });
  }
  return out;
}

/** Step-by-step working for an expression; returns the steps and the value. */
export function evalLesson(expr: string, o: { intro?: string; show?: string } = {}): Lesson {
  let ts = tokens(expr);
  const L = new LessonBuilder();
  const frames: PicBoard['frames'] = [];
  const ruleOf = (inBr: boolean, op: Op) => (inBr ? 'B' : op === '^' ? 'O' : op === '×' || op === '÷' ? 'DM' : 'AS') as 'B' | 'O' | 'DM' | 'AS';
  let turned = false;
  const all = ts.filter((t) => t.t === 'o').map((t) => (t as { v: Op }).v);
  const hasBr = ts.some((t) => t.t === '(');
  L.say(o.intro ?? (hasBr ? 'Brackets first, then powers, then × and ÷, then + and −.' : all.some((v) => v === '×' || v === '÷') && all.some((v) => v === '+' || v === '−') ? '× and ÷ come before + and −.' : 'Work from left to right.'), show(ts));
  let guard = 0;
  while (ts.length > 1 && guard++ < 20) {
    // Innermost brackets first.
    const close = ts.findIndex((t) => t.t === ')');
    let from = 0;
    let to = ts.length;
    let inBr = false;
    if (close >= 0) {
      let open = close;
      while (open >= 0 && ts[open].t !== '(') open--;
      from = open + 1;
      to = close;
      inBr = true;
      if (to - from === 1) {
        // (n): drop the brackets (unless the number is negative and a power follows — keep as is).
        ts = [...ts.slice(0, open), ts[from], ...ts.slice(close + 1)];
        continue;
      }
    }
    const k = nextOp(ts, from, to);
    if (k < 0) throw new Error('no operator');
    const a = ts[k - 1] as { v: number };
    const op = (ts[k] as { v: Op }).v;
    const b = ts[k + 1] as { v: number };
    const r = apply(a.v, op, b.v);
    const left = ts.filter((t) => t.t === 'o').map((t) => (t as { v: Op }).v);
    const why = inBr ? 'Brackets first:' : op === '^' ? 'Powers next:' : op === '×' || op === '÷' ? (left.some((v) => v === '+' || v === '−') ? `${op} before + and −:` : left.length > 1 ? 'Left to right:' : 'Finally:') : left.length > 1 ? 'Now + and −, from left to right:' : 'Finally:';
    // Box the part being worked out (with its brackets, when they hold just this).
    const wrapBr = inBr && ts[k - 2]?.t === '(' && ts[k + 2]?.t === ')';
    if (!frames.length) frames.push({ step: 0, v: { kind: 'expr', parts: partsOf(ts), rule: ruleOf(inBr, op) } });
    frames.push({ step: L.i, v: { kind: 'expr', parts: partsOf(ts, wrapBr ? k - 2 : k - 1, wrapBr ? k + 2 : k + 1), rule: ruleOf(inBr, op), under: `= ${f(r)}` } });
    const calc = op === '^' ? `${a.v < 0 ? `(${f(a.v)})` : f(a.v)}${String(b.v).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('')} = ${f(r)}` : `${f(a.v)} ${op} ${b.v < 0 ? `(${f(b.v)})` : f(b.v)} = ${f(r)}`;
    ts = [...ts.slice(0, k - 1), { t: 'n', v: r }, ...ts.slice(k + 2)];
    // A bracket holding just one number is done: drop it.
    for (let j = 0; j + 2 < ts.length; j++) if (ts[j].t === '(' && ts[j + 1].t === 'n' && ts[j + 2].t === ')') ts.splice(j, 3, ts[j + 1]);
    const rest = ts.length > 1 ? show(ts) : null;
    if (rest) L.sayThen(why, calc, `Now: ${rest}`);
    else L.say(why, calc);
    if (!turned && rest && Number.isInteger(r) && Math.abs(r) < 10000) {
      turned = true;
      L.you(`${calc.split(' = ')[0]} = ?`, r, [r + 1, r - 1, a.v + b.v === r ? a.v * b.v : a.v + b.v]);
    }
  }
  const val = (ts[0] as { v: number }).v;
  if (frames.length) {
    frames.push({ step: L.i, v: { kind: 'expr', parts: [{ t: f(val), done: true }], ladder: false } });
    L.board = { kind: 'pic', frames };
  }
  return L.end(f(val), undefined, o.show ?? `${show(tokens(expr))} = ${f(val)}`);
}

/** The value of an expression (for checks). */
export function evaluate(expr: string): number {
  const l = evalLesson(expr);
  const last = l.steps[l.steps.length - 1].say;
  const m = /(−?\d+(?:\.\d+)?)\.$/.exec(last);
  return m ? Number(m[1].replace('−', '-')) : NaN;
}
