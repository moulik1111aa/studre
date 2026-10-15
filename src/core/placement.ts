// Placement (spec §3): a short walk along each strand, asking the parent whether the child
// can easily do a real example. "Yes" jumps ahead, "Not yet" steps back, "With a little
// effort" places the child right there.

import type { Skill } from './skill.ts';
import type { Strand } from './question.ts';

export type ParentAnswer = 'yes' | 'effort' | 'not';

/** Stage that matches an age (3–4 → 1 … 15–16 → 7). */
export const stageForAge = (age: number): number => Math.max(1, Math.min(7, Math.floor((age - 1) / 2)));

/** The strands the parent is asked about. Mental and word skills follow the stage they sit in. */
export const PLACEMENT_STRANDS: Strand[] = ['number', 'addsub', 'muldiv', 'fdp', 'algebra'];

interface Walk {
  strand: Strand;
  skills: Skill[]; // this strand's skills in path order
  pos: number;
  asked: number;
  last: ParentAnswer | null;
  placed: number | null; // index in `skills` where the child starts
}

export interface PlacementPlan {
  /** Skill ids to mark skipped. */
  skipped: string[];
  /** Strand → id of the first skill the child will play in it. */
  startAt: Partial<Record<Strand, string>>;
}

export class Placement {
  readonly age: number;
  private readonly walks: Walk[];
  private readonly all: Skill[];
  private i = 0;

  constructor(age: number, pathSkills: Skill[]) {
    this.age = age;
    this.all = pathSkills;
    const stage = stageForAge(age);
    this.walks = [];
    if (stage <= 1) return; // 3–4 year olds simply start at the beginning
    for (const strand of PLACEMENT_STRANDS) {
      const skills = pathSkills.filter((s) => s.strand === strand && s.stage <= Math.min(7, stage + 1));
      const inStage = skills.map((s, k) => [s, k] as const).filter(([s]) => s.stage === stage);
      const near = inStage.length ? inStage : skills.map((s, k) => [s, k] as const).filter(([s]) => s.stage === stage - 1);
      if (!near.length) continue;
      const pos = near[Math.floor(near.length / 2)][1];
      this.walks.push({ strand, skills, pos, asked: 0, last: null, placed: null });
    }
  }

  /** The next skill to ask about, or null when placement is complete. */
  next(): { strand: Strand; skill: Skill } | null {
    while (this.i < this.walks.length && this.walks[this.i].placed !== null) this.i++;
    const w = this.walks[this.i];
    return w ? { strand: w.strand, skill: w.skills[w.pos] } : null;
  }

  answer(a: ParentAnswer): void {
    const w = this.walks[this.i];
    if (!w) return;
    w.asked++;
    const max = w.skills.length - 1;
    const prev = w.last;
    w.last = a;
    if (a === 'effort') {
      w.placed = w.pos;
      return;
    }
    if (a === 'yes') {
      if (prev === 'not') {
        w.placed = Math.min(max, w.pos + 1);
        return;
      }
      if (w.pos >= max) {
        w.placed = max;
        return;
      }
      w.pos = Math.min(max, w.pos + (prev === 'effort' ? 2 : 5));
    } else {
      if (prev === 'yes') {
        w.placed = Math.max(0, w.pos - 2);
        return;
      }
      if (w.pos === 0) {
        w.placed = 0;
        return;
      }
      w.pos = Math.max(0, w.pos - 2);
    }
    if (w.asked >= 3) w.placed = w.pos;
  }

  /** How many questions are left at most (for a progress indicator). */
  get remainingEstimate(): number {
    return this.walks.filter((w) => w.placed === null).length * 2;
  }

  result(): PlacementPlan {
    const skipped = new Set<string>();
    const startAt: PlacementPlan['startAt'] = {};
    const stage = stageForAge(this.age);
    for (const w of this.walks) {
      const placed = w.placed ?? w.pos;
      for (let k = 0; k < placed; k++) skipped.add(w.skills[k].id);
      startAt[w.strand] = w.skills[placed]?.id;
    }
    // Strands not walked (and mental/word skills): skip whatever sits in stages below the child's.
    const walked = new Set(this.walks.map((w) => w.strand));
    for (const s of this.all) {
      if (!walked.has(s.strand) && s.stage < stage) skipped.add(s.id);
    }
    return { skipped: [...skipped], startAt };
  }
}

/** "Let them try": 6 questions answered by the child turn into a parent-style answer. */
export function answerFromCheck(correct: number, total = 6): ParentAnswer {
  if (correct >= total - 1) return 'yes';
  if (correct >= Math.ceil(total / 2)) return 'effort';
  return 'not';
}
