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
  /** Never below this index: the first skill at the child's age. */
  floor: number;
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
      // Levels follow age: a strand never starts below the child's own stage. A strand with
      // nothing at this age is skipped up to here, like the mental and word skills.
      const floor = skills.findIndex((s) => s.stage >= stage);
      if (floor < 0) continue;
      const inStage = skills.map((s, k) => [s, k] as const).filter(([s]) => s.stage === stage);
      const pos = inStage.length ? inStage[Math.floor(inStage.length / 2)][1] : floor;
      this.walks.push({ strand, skills, pos, floor, asked: 0, last: null, placed: null });
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
        w.placed = Math.max(w.floor, w.pos - 2);
        return;
      }
      if (w.pos <= w.floor) {
        w.placed = w.floor;
        return;
      }
      w.pos = Math.max(w.floor, w.pos - 2);
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
    // Everything below the child's age is open on the map but not in the way.
    for (const s of this.all) if (s.stage < stage) skipped.add(s.id);
    return { skipped: [...skipped], startAt };
  }
}

/** "Let them try": 6 questions answered by the child turn into a parent-style answer. */
export function answerFromCheck(correct: number, total = 6): ParentAnswer {
  if (correct >= total - 1) return 'yes';
  if (correct >= Math.ceil(total / 2)) return 'effort';
  return 'not';
}

/** The child's age stage: skills below it are skipped (open on the map, not in the way). */
export function belowAge(age: number, skills: Skill[]): string[] {
  const stage = stageForAge(age);
  return skills.filter((s) => s.stage < stage).map((s) => s.id);
}
