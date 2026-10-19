// Helpers for writing lessons: a builder for the steps, number formatting, and board builders.
// Board items are timed with the index of the step they belong to (see types.ts), so a method
// adds an item with `L.i` (the step about to be written) and then writes that step.

import { clean, num } from '../question.ts';
import { STEP_KEYS, type Board, type Lesson, type LineBoard, type LineHop, type LinePoint, type Slip, type Step } from './types.ts';

/** A number for display: real minus sign, no float noise. */
export const f = (n: number): string => {
  const c = clean(n);
  return c < 0 ? `−${num(-c)}` : num(c);
};
/** A signed term for working: "+ 5" / "− 5". */
export const pm = (n: number): string => (n < 0 ? `− ${f(-n)}` : `+ ${f(n)}`);
/** A number in brackets when negative: (−3). */
export const br = (n: number): string => (n < 0 ? `(${f(n)})` : f(n));
/** Rupees: ₹45 or ₹12.50 when there are paise. */
export const rs = (n: number): string => (Number.isInteger(clean(n)) ? `₹${f(n)}` : `₹${clean(n).toFixed(2)}`);
/** "1 ten", "3 tens". */
export const plural = (n: number, one: string, many = `${one}s`): string => `${f(n)} ${Math.abs(n) === 1 ? one : many}`;
/** The place names, ones first. */
export const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'lakhs', 'ten lakhs'];
export const PLACE_ONE = ['one', 'ten', 'hundred', 'thousand', 'ten thousand', 'lakh', 'ten lakh'];
export const DEC_PLACES = ['tenths', 'hundredths', 'thousandths'];
/** Short column headings, ones first. */
export const HEADS = ['O', 'T', 'H', 'Th', 'TTh', 'L'];

/** Writes a lesson step by step. */
export class LessonBuilder {
  readonly steps: Step[] = [];
  board?: Board;
  private readonly slipList: Slip[] = [];

  /** The index the next step will have (time board items with this). */
  get i(): number {
    return this.steps.length;
  }

  /** Add a step: one sentence, then any working lines. */
  say(text: string, ...math: (string | false | null | undefined)[]): this {
    const m = math.filter((x): x is string => !!x);
    this.steps.push(m.length ? { say: text, math: m } : { say: text });
    return this;
  }

  /** Add a step with a line after the working: sentence, working, then `after`. */
  sayThen(text: string, math: string | string[], after: string): this {
    this.steps.push({ say: text, math: Array.isArray(math) ? math : [math], after });
    return this;
  }

  /** A note for a likely wrong answer. */
  slip(answer: string | number, note: string): this {
    const a = typeof answer === 'number' ? num(clean(answer)) : answer;
    if (!this.slipList.some((s) => s.answer === a)) this.slipList.push({ answer: a, note });
    return this;
  }

  /** Finish with the answer step ("So the answer is 58."). */
  end(answer: string | number, text?: string, ...math: (string | false | null | undefined)[]): Lesson {
    const a = typeof answer === 'number' ? f(answer) : answer;
    const m = math.filter((x): x is string => !!x);
    this.steps.push({ say: text ?? `So the answer is ${a}.`, ...(m.length ? { math: m } : {}), end: true });
    return this.lesson();
  }

  /**
   * Copy another lesson's working steps (not its answer step) into this one, with its picture
   * re-timed to start at this point. Its picture is used only if this lesson has none yet.
   */
  take(inner: Lesson): this {
    const k = this.i;
    for (const s of inner.steps) {
      if (s.end) continue;
      this.steps.push({ say: s.say, ...(s.math ? { math: s.math } : {}), ...(s.after ? { after: s.after } : {}) });
    }
    if (inner.board && !this.board) this.board = shiftBoard(inner.board, k);
    for (const s of inner.slips ?? []) this.slip(s.answer, s.note);
    return this;
  }

  lesson(): Lesson {
    return { ...(this.board ? { board: this.board } : {}), steps: this.steps, ...(this.slipList.length ? { slips: this.slipList } : {}) };
  }
}

/** A number line builder. */
export class Line {
  readonly b: LineBoard;
  constructor(scale: 'linear' | 'even', range?: { min: number; max: number; tick?: number; labelEvery?: number }) {
    this.b = { kind: 'line', scale, points: [], hops: [], ...(range ?? {}) };
  }
  pt(v: number, at = 0, opts: Partial<Omit<LinePoint, 'v' | 'at'>> = {}): this {
    const old = this.b.points.find((p) => p.v === v);
    if (old) {
      // A point already shown keeps its first appearance; later options can still highlight it.
      if (opts.hl !== undefined) old.hl = opts.hl;
      if (opts.tone) old.tone = opts.tone;
      if (opts.label !== undefined) old.label = opts.label;
      return this;
    }
    this.b.points.push({ v, at, ...opts });
    return this;
  }
  hop(from: number, to: number, at = 0, label?: string, opts: Partial<LineHop> = {}): this {
    const d = to - from;
    this.b.hops.push({ from, to, at, label: label ?? (d >= 0 ? `+${f(d)}` : `−${f(-d)}`), ...opts });
    return this;
  }
}

/** Digits of a whole number, most significant first. */
export const digits = (n: number): number[] => String(Math.abs(Math.round(n))).split('').map(Number);

/** Split a whole number into place parts: 347 → [300, 40, 7] (zero parts dropped unless all zero). */
export function parts(n: number): number[] {
  const ds = digits(n);
  const out = ds.map((d, i) => d * 10 ** (ds.length - 1 - i)).filter((x) => x !== 0);
  return out.length ? out : [0];
}

/** "a, b and c". */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Ordinal words for small numbers. */
export const ORDINAL = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

/** A copy of a board with every step number moved on by k. */
export function shiftBoard<T>(b: T, k: number): T {
  const keys = new Set<string>(STEP_KEYS);
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(v)) out[key] = keys.has(key) && typeof val === 'number' ? val + k : walk(val);
      return out;
    }
    return v;
  };
  return (k ? walk(b) : b) as T;
}

/** The same lesson with its answer step showing different working (e.g. the question's own order). */
export function reshow(l: Lesson, show: string): Lesson {
  const steps = l.steps.map((s) => (s.end ? { ...s, math: [show] } : s));
  return { ...l, steps };
}

/** A lesson that starts with an extra sentence (e.g. how a story turns into a sum). */
export function lead(intro: string, inner: Lesson, end?: { answer: string | number; text?: string; show?: string }): Lesson {
  const L = new LessonBuilder();
  L.say(intro);
  L.take(inner);
  const last = inner.steps[inner.steps.length - 1];
  if (end) return L.end(end.answer, end.text, end.show ?? last.math?.[0]);
  L.steps.push({ ...last });
  return L.lesson();
}
