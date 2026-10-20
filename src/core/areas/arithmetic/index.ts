// Arithmetic: the first maths area. Each stage file holds its ordered skills.
import type { Skill } from '../../skill.ts';
import { STAGE1 } from './stage1.ts';
import { STAGE2 } from './stage2.ts';
import { STAGE3 } from './stage3.ts';
import { STAGE4 } from './stage4.ts';
import { STAGE5 } from './stage5.ts';
import { STAGE6 } from './stage6.ts';
import { STAGE7 } from './stage7.ts';

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

/**
 * Skills that suit a younger age than the file they are written in (checked against the
 * school year for each age: NCERT class ≈ age − 5). Ids never change, so progress stays;
 * only the stage they are played in does. Each goes in after `after`, in this order.
 */
export const MOVES: { id: string; after: string }[] = [
  // Stage 5 → 4 (ages 9–10): small-number puzzles and strategies.
  { id: 's5.compens', after: 's4.estimate' },
  { id: 's5.inverse', after: 's4.d10100' },
  { id: 's5.missingop', after: 's4.bodmas0' },
  // Stage 6 → 5 (ages 11–12): class 7 work on profit, interest, HCF/LCM, algebra and powers.
  { id: 's6.profit', after: 's5.pctinc' },
  { id: 's6.simpleint', after: 's6.profit' },
  { id: 's6.subst', after: 's5.brackets' },
  { id: 's6.liketerms', after: 's6.subst' },
  { id: 's6.eq1', after: 's6.liketerms' },
  { id: 's6.eq2', after: 's6.eq1' },
  { id: 's6.hcflcmword', after: 's5.lcm' },
  { id: 's6.pow2310', after: 's5.sq20' },
  { id: 's6.powmul', after: 's6.pow2310' },
  { id: 's6.powdiv', after: 's6.powmul' },
  { id: 's6.powpow', after: 's6.powdiv' },
  // Stage 7 → 6 (ages 13–14): class 8 identities and first factorising.
  { id: 's7.sqplus', after: 's6.expand1' },
  { id: 's7.sqminus', after: 's7.sqplus' },
  { id: 's7.dots', after: 's7.sqminus' },
  { id: 's7.expand2', after: 's7.dots' },
  { id: 's7.factcommon', after: 's7.expand2' },
  { id: 's7.diffsq', after: 's7.factcommon' },
];

function arrange(stages: Skill[][]): Skill[][] {
  const out = stages.map((st) => [...st]);
  for (const m of MOVES) {
    const from = out.findIndex((st) => st.some((s) => s.id === m.id));
    const to = out.findIndex((st) => st.some((s) => s.id === m.after));
    if (from < 0 || to < 0) throw new Error(`skill move ${m.id} → after ${m.after}: not found`);
    const skill = out[from].find((s) => s.id === m.id)!;
    out[from] = out[from].filter((s) => s !== skill);
    const at = out[to].findIndex((s) => s.id === m.after);
    out[to].splice(at + 1, 0, { ...skill, stage: to + 1 });
  }
  return out;
}

/** Skills per stage, in path order. */
export const ARITHMETIC_SKILLS: Skill[][] = arrange([STAGE1, STAGE2, STAGE3, STAGE4, STAGE5, STAGE6, STAGE7]);
