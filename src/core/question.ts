// Questions, answers and grading — shared by every skill, level, boss and Face-off.
//
// Answers are canonical strings so every kind of maths fits one shape:
//   integers "42", "-7"   decimals "2.5"   fractions "3/4" (lowest terms)
//   two answers "3,5" (sorted ascending, e.g. quadratic roots)   ratios "2:3"
// Skills compute answers; nothing is hand-written.

import type { Rng } from './rng.ts';
import type { Lesson } from './teach/types.ts';

export type AnswerFormat = 'picture' | 'choice' | 'pad' | 'pad-ext';

export type Strand = 'number' | 'addsub' | 'muldiv' | 'fdp' | 'algebra' | 'mental' | 'word';

/** A counting picture: groups of the same object (Stage 1–2). */
export interface PictureVisual {
  kind: 'objects';
  /** Each group: an object name from OBJECTS and how many. Rendered side by side. */
  groups: { object: string; count: number; crossed?: number }[];
  /** "+", "−" or "or" between groups (for stories and comparisons). */
  joiner?: '+' | '−' | 'or';
}
/** A ten frame / dot pattern. */
export interface DotsVisual {
  kind: 'dots' | 'tenframe';
  count: number;
}
/** A pattern row: shows items, the last is a "?" slot. */
export interface PatternVisual {
  kind: 'pattern';
  items: string[];
}
/** A fraction of a shape: n of d parts shaded. */
export interface ShapeFractionVisual {
  kind: 'shape-fraction';
  shaded: number;
  parts: number;
  shape: 'circle' | 'bar';
}
/** A row of coins / notes (₹). */
export interface MoneyVisual {
  kind: 'money';
  values: number[];
}
export type Visual = PictureVisual | DotsVisual | PatternVisual | ShapeFractionVisual | MoneyVisual;

/** What a skill generator produces. */
export interface Made {
  prompt: string;
  /** Spoken version (Stage 1–2, or any question with a picture). */
  speak?: string;
  visual?: Visual;
  answer: string;
  /** Wrong options; at least 3 distinct, none equal to the answer. */
  distractors: string[];
  /** Short worked hint shown on Learn/Practice levels. */
  hint?: string;
  /** For a picture-choice question, each option rendered as an object group. */
  optionObject?: string;
  /** When true, equivalent forms are not accepted (e.g. "simplify this fraction"). */
  exactForm?: boolean;
  /** How to work it out, step by step (built from this question's own numbers). */
  teach?: () => Lesson;
}

export interface Question extends Made {
  skillId: string;
  format: AnswerFormat;
  /** Options (answer + distractors, shuffled): 3 for pictures, 4 otherwise. */
  choices: string[];
  /** Identity for repeat detection. */
  key: string;
  /** Difficulty it was made at (so a paused question can be swapped for a like one). */
  d?: number;
}

// ── numbers ────────────────────────────────────────────────────────────────

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
export const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);

/** Round away floating error (0.1 + 0.2 → 0.3). */
export function clean(n: number): number {
  const r = Math.round(n * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
}

/** Canonical string for a number. */
export function num(n: number): string {
  return String(clean(n));
}

/** Canonical fraction string in lowest terms ("6/8" → "3/4", "4/2" → "2"). */
export function frac(n: number, d: number): string {
  if (d === 0) throw new Error('zero denominator');
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}

/** Numeric value of a canonical or typed answer; NaN if not a single number. */
export function valueOf(s: string): number {
  const t = s.trim().replace(/\s+/g, '').replace(/^\+/, '').replace(/−/g, '-');
  if (/^-?\d+(\.\d+)?$/.test(t) || /^-?\.\d+$/.test(t)) return Number(t);
  const m = /^(-?\d+)\/(-?\d+)$/.exec(t);
  if (m && Number(m[2]) !== 0) return Number(m[1]) / Number(m[2]);
  const mixed = /^(-?)(\d+)\s*(\d+)\/(\d+)$/.exec(s.trim());
  if (mixed && Number(mixed[4]) !== 0) {
    const v = Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4]);
    return mixed[1] ? -v : v;
  }
  return NaN;
}

/** Normalise typed input: trims, unifies minus signs, strips trailing zeros of decimals. */
export function normalise(s: string): string {
  // A mixed number "1 3/4" becomes the improper fraction "7/4" (before spaces are dropped).
  const mixed = /^\s*(-?)(\d+)\s+(\d+)\/(\d+)\s*$/.exec(s.replace(/−/g, '-'));
  if (mixed) {
    const d = Number(mixed[4]);
    return `${mixed[1]}${Number(mixed[2]) * d + Number(mixed[3])}/${d}`;
  }
  let t = s.trim().replace(/\s+/g, '').replace(/−/g, '-').replace(/^\+/, '');
  if (/^-?\d*\.\d+$/.test(t)) t = num(Number(t));
  if (/^-?\d+$/.test(t)) t = String(Number(t));
  if (t.includes(',')) {
    const parts = t.split(',').filter(Boolean).map((p) => normalise(p));
    parts.sort((a, b) => valueOf(a) - valueOf(b));
    t = parts.join(',');
  }
  return t;
}

/** Is the given input a correct answer to the question? */
export function isCorrect(q: Pick<Made, 'answer' | 'exactForm'>, input: string): boolean {
  const a = normalise(q.answer);
  const b = normalise(input);
  if (a === b) return true;
  if (q.exactForm) return false;
  if (a.includes(',') || b.includes(',') || a.includes(':') || b.includes(':')) return false;
  const va = valueOf(a);
  const vb = valueOf(b);
  return Number.isFinite(va) && Number.isFinite(vb) && Math.abs(va - vb) < 1e-9;
}

// ── distractors ────────────────────────────────────────────────────────────

/** Plausible wrong whole numbers near an answer: off by 1/2, by 10, swapped digits, plus extras. */
export function nearNumbers(rng: Rng, answer: number, extras: number[] = [], opts: { min?: number; count?: number } = {}): string[] {
  const min = opts.min ?? (answer >= 0 ? 0 : -Infinity);
  const want = opts.count ?? 3;
  const pool: number[] = [];
  const a = answer;
  pool.push(a + 1, a - 1, a + 2, a - 2);
  if (Math.abs(a) >= 10) pool.push(a + 10, a - 10);
  if (Math.abs(a) >= 100) pool.push(a + 100, a - 100);
  const s = String(Math.abs(a));
  if (s.length >= 2 && s[0] !== s[s.length - 1]) {
    const swapped = Number(s.slice(-1) + s.slice(1, -1) + s[0]);
    pool.push(a < 0 ? -swapped : swapped);
  }
  pool.push(a + rng.int(3, 6), a - rng.int(3, 6));
  const out: string[] = [];
  const seen = new Set([num(a)]);
  for (const n of [...extras, ...rng.shuffle(pool)]) {
    const c = clean(n);
    const k = num(c);
    if (c < min || seen.has(k) || !Number.isFinite(c)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= Math.max(want, 3)) break;
  }
  // Guarantee enough options however small the range.
  let step = 3;
  while (out.length < want) {
    for (const c of [a + step, a - step]) {
      const k = num(c);
      if (c >= min && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
    step++;
  }
  return out;
}

/** Distinct wrong options from any candidate list (strings), topped up by a fallback. */
export function uniqueWrong(answer: string, candidates: string[], fallback: () => string, count = 3): string[] {
  const out: string[] = [];
  const seen = new Set([normalise(answer)]);
  for (const c of candidates) {
    const k = normalise(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
    if (out.length >= count) return out;
  }
  for (let i = 0; out.length < count && i < 200; i++) {
    const c = fallback();
    const k = normalise(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

/** Build the shuffled options for a question. */
export function buildChoices(rng: Rng, answer: string, distractors: string[], count: number): string[] {
  const wrong = distractors.filter((d) => normalise(d) !== normalise(answer));
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const w of wrong) {
    const k = normalise(w);
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(w);
    }
  }
  return rng.shuffle([answer, ...uniq.slice(0, count - 1)]);
}

/** Linear interpolation for difficulty-scaled ranges, rounded. */
export const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));

/** Indian-style digit grouping (1,00,000) used for display of big numbers. */
export function indian(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

/**
 * A written question read aloud: "10 + 3 = ?" → "10 plus 3 equals what?".
 * A "?" standing on its own is a blank ("what"); a "?" right after a word is just punctuation.
 */
export function spoken(prompt: string): string {
  const asks = /\?\s*$/.test(prompt);
  let s = prompt
    .replace(/(^|[\s(=+−×÷:,-])\?(?=$|[\s/),=+−×÷])/g, '$1 what ')
    .replace(/(\d)\/(\d)/g, '$1 over $2')
    .replace(/what\s*\/\s*(\d)/g, 'what over $1')
    .replace(/√/g, ' the square root of ')
    .replace(/∛/g, ' the cube root of ')
    .replace(/²/g, ' squared ')
    .replace(/³/g, ' cubed ')
    .replace(/\+/g, ' plus ')
    .replace(/(^|[\s(])[−-](?=\d)/g, '$1minus ')
    .replace(/−/g, ' minus ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/=/g, ' equals ')
    .replace(/\s+([?.,!])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (asks && !s.endsWith('?')) s += '?';
  return s;
}
