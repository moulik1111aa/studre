// Lessons drawn with pictures (clocks, rulers, shapes, charts…): each step can show a new
// frame; motion hints in a frame play when its step appears. And a helper to offer other ways.

import { LessonBuilder } from './build.ts';
import type { Lesson, PicBoard } from './types.ts';
import type { Visual } from '../question.ts';
import type { MathVisual } from '../vis.ts';

export class PicLesson extends LessonBuilder {
  private readonly frames: PicBoard['frames'] = [];
  constructor() {
    super();
    this.board = { kind: 'pic', frames: this.frames };
  }
  /** Show this picture from the next step on. */
  show(v: Visual): this {
    const at = this.i;
    const last = this.frames[this.frames.length - 1];
    if (last && last.step === at) last.v = v;
    else this.frames.push({ step: at, v });
    return this;
  }
  override lesson(): Lesson {
    const l = super.lesson();
    return this.frames.length ? l : { ...l, board: undefined };
  }
}

/**
 * Give an existing lesson pictures: frames[i] shows from step i (null/undefined keeps the
 * one before). A lesson that already has a board keeps it, with the pictures above it.
 */
export function illustrate(l: Lesson, frames: (Visual | null | undefined)[]): Lesson {
  const fr: PicBoard['frames'] = [];
  frames.forEach((v, i) => {
    if (v && i < l.steps.length) fr.push({ step: i, v });
  });
  if (!fr.length) return l;
  const pic: PicBoard = { kind: 'pic', frames: fr };
  return { ...l, board: l.board ? { kind: 'stack', boards: [pic, l.board] } : pic };
}

/** A lesson with a method name and other ways to see it (each built only when asked for). */
export function withWays(main: Lesson, method: string, family: string, others: [string, () => Lesson][]): Lesson {
  return {
    ...main,
    method,
    family,
    ...(others.length
      ? { alts: () => others.map(([name, mk]) => ({ ...mk(), method: name, family, alts: undefined })).filter((x) => x.steps.length > 0) }
      : {}),
  };
}

/**
 * The digits of x with its decimal point hopping k places (right for ×10s, left for ÷10s),
 * padded with zeros where the point needs room.
 */
export function pvShift(x: number | string, k: number, note?: string): MathVisual {
  const str = typeof x === 'string' ? x : String(x);
  let [int, dec = ''] = str.replace('-', '').split('.');
  if (int === '0' && dec) int = '0';
  if (k > 0 && dec.length < k) dec = dec.padEnd(k, '0');
  let digits = int + dec;
  let from = int.length;
  let to = from + k;
  if (to < 1) {
    digits = '0'.repeat(1 - to) + digits;
    from += 1 - to;
    to = 1;
  }
  return { kind: 'pv', digits, point: to, from, ...(note ? { note } : {}) };
}

/** Pick n different items. */
export function pickN<T>(r: { int(a: number, b: number): number }, list: readonly T[], n: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  return out;
}
