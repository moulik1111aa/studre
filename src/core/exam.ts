// Exam practice (MN ×): a test-style round a parent sets up. The child answers a set number of
// questions from the topics the parent picked, with an optional time limit, and sees no right
// or wrong until the end. Then a score sheet: the score, the time, how each topic went and the
// questions to look at again.

import { forAge, isPassed, isSkipped, type Level, type Progress } from './path.ts';
import type { Rng } from './rng.ts';

export const EXAM_SIZES = [10, 20, 30] as const;
/** Seconds allowed per question (0: no time limit). */
export const EXAM_PACES = [0, 60, 30] as const;
/** Results kept per child. */
export const EXAM_KEEP = 20;

export interface ExamRecord {
  /** When it finished (ms) and the local day. */
  t: number;
  d: string;
  n: number;
  ok: number;
  /** Seconds taken, and the limit (0: none). */
  sec: number;
  limit: number;
  /** Skill id → [asked, right]. */
  skills: Record<string, [number, number]>;
}

/** Skills a child has learned on their path (passed, or placed past), in path order. */
export function learnedSkills(path: Level[], p: Progress): string[] {
  const out: string[] = [];
  for (const l of path) if (l.kind === 'skill' && (isPassed(p, l) || isSkipped(p, l)) && !out.includes(l.skillId)) out.push(l.skillId);
  return out;
}

/** What's ticked when the exam screen opens: the last few skills learned. */
export const defaultPick = (learned: string[], n = 5): string[] => learned.slice(-n);

/**
 * The questions: the chosen skills taken in turn (shuffled), so each gets a fair share, at a
 * test-like difficulty that rises a little through the paper.
 */
export function examPlan(skillIds: string[], n: number, rng: Rng, age?: number, stageOf: (id: string) => number = () => 1): { skillId: string; d: number }[] {
  if (!skillIds.length) return [];
  const order = rng.shuffle([...skillIds]);
  const out: { skillId: string; d: number }[] = [];
  for (let k = 0; k < n; k++) {
    const id = order[k % order.length];
    const d = 0.55 + (0.35 * k) / Math.max(1, n - 1);
    out.push({ skillId: id, d: Math.round(forAge(d, age, stageOf(id)) * 100) / 100 });
  }
  // Mixed up, but easier ones a little earlier.
  return out.map((x, i) => ({ x, r: i + rng.int(0, Math.max(1, Math.floor(n / 4))) })).sort((a, b) => a.r - b.r).map((y) => y.x);
}

/** Score a finished paper. `given[i]` is null when skipped or out of time. */
export function scoreExam(asked: { skillId: string }[], right: boolean[]): { ok: number; skills: Record<string, [number, number]> } {
  const skills: Record<string, [number, number]> = {};
  let ok = 0;
  asked.forEach((q, i) => {
    const row = (skills[q.skillId] ??= [0, 0]);
    row[0]++;
    if (right[i]) {
      row[1]++;
      ok++;
    }
  });
  return { ok, skills };
}

/** Plain-words verdict for the score sheet (no promises, just what happened). */
export function examVerdict(ok: number, n: number): string {
  const p = n ? ok / n : 0;
  if (p >= 0.9) return 'Excellent work!';
  if (p >= 0.75) return 'Great work!';
  if (p >= 0.5) return 'Good effort. A few to practise.';
  return 'Good try. These topics need more practice.';
}
