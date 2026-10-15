// Arithmetic: the first maths area. Each stage file holds its ordered skills.
import type { Skill } from '../../skill.ts';
import { STAGE1 } from './stage1.ts';
import { STAGE2 } from './stage2.ts';
import { STAGE3 } from './stage3.ts';
import { STAGE4 } from './stage4.ts';
import { STAGE5 } from './stage5.ts';

export interface StageInfo {
  n: number;
  name: string;
  ages: string;
  world: string;
}

export const ARITHMETIC_STAGES: StageInfo[] = [
  { n: 1, name: 'Tiny Counters', ages: '3–4', world: 'meadow' },
  { n: 2, name: 'Number Friends', ages: '5–6', world: 'sea' },
  { n: 3, name: 'Big Numbers', ages: '7–8', world: 'volcano' },
  { n: 4, name: 'Times Master', ages: '9–10', world: 'city' },
  { n: 5, name: 'Fraction Explorer', ages: '11–12', world: 'kitchen' },
  { n: 6, name: 'Power Up', ages: '13–14', world: 'storm' },
  { n: 7, name: 'Maths Ninja', ages: '15–16', world: 'mountain' },
];

/** Skills per stage, in path order. Stages not yet built are empty. */
export const ARITHMETIC_SKILLS: Skill[][] = [STAGE1, STAGE2, STAGE3, STAGE4, STAGE5];
