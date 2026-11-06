// New branches on the one road (Measure & time, Shapes & space, Data & chance, and a few more
// Numbers and Algebra skills): each skill names the skill it goes after. arithmetic/index.ts
// slots them in after the age moves.

import { stageSkills, type Skill, type SkillOptions } from '../../skill.ts';
import { spoken, type Made, type Strand, type Visual } from '../../question.ts';
import type { MathVisual } from '../../vis.ts';
import type { Lesson } from '../../teach/types.ts';

export interface Extra {
  skill: Skill;
  after: string;
}

export function extraSkills(stage: number, defaults: Required<SkillOptions>) {
  const { list: skills, add: addSkill } = stageSkills('arithmetic', stage, defaults);
  const list: Extra[] = [];
  /** Add a skill that goes after `after` (a skill id, or an earlier new one). */
  const add = (after: string, id: string, strand: Strand, name: string, make: Skill['make'], opts: SkillOptions = {}): void => {
    const little = stage <= 2;
    addSkill(id, strand, name, little ? (r, d) => withSpeech(make(r, d)) : make, opts);
    list.push({ skill: skills[skills.length - 1], after });
  };
  return { list, add };
}

const withSpeech = (m: Made): Made => (m.speak ? m : { ...m, speak: spoken(m.prompt) });

/** A question with its picture, options and lesson. */
export function made(
  prompt: string,
  answer: string | number,
  wrong: (string | number)[],
  o: { visual?: Visual; options?: Record<string, MathVisual>; hint?: string; speak?: string; teach?: () => Lesson; exact?: boolean } = {},
): Made {
  const a = String(answer);
  const seen = new Set([a]);
  const distractors: string[] = [];
  for (const w of wrong) {
    const s = String(w);
    if (!seen.has(s)) {
      seen.add(s);
      distractors.push(s);
    }
  }
  return {
    prompt,
    answer: a,
    distractors,
    ...(o.visual ? { visual: o.visual } : {}),
    ...(o.options ? { optionVisuals: o.options } : {}),
    ...(o.hint ? { hint: o.hint } : {}),
    ...(o.speak ? { speak: o.speak } : {}),
    ...(o.teach ? { teach: o.teach } : {}),
    ...(o.exact ? { exactForm: true } : {}),
  };
}
