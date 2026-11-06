// Lessons drawn with pictures (clocks, rulers, shapes, charts…): each step can show a new
// frame; motion hints in a frame play when its step appears. And a helper to offer other ways.

import { LessonBuilder } from './build.ts';
import type { Lesson, PicBoard } from './types.ts';
import type { Visual } from '../question.ts';

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

/** Pick n different items. */
export function pickN<T>(r: { int(a: number, b: number): number }, list: readonly T[], n: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  return out;
}
