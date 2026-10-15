// Registry of maths areas. Arithmetic first; Geometry, Measurement & Time and Data can join later
// with their own stages and skills, sharing profiles, coins and rewards.
import type { Skill } from '../skill.ts';
import { ARITHMETIC_SKILLS, ARITHMETIC_STAGES, type StageInfo } from './arithmetic/index.ts';

export interface Area {
  id: string;
  name: string;
  stages: StageInfo[];
  skills: Skill[][];
}

export const AREAS: Area[] = [{ id: 'arithmetic', name: 'Arithmetic', stages: ARITHMETIC_STAGES, skills: ARITHMETIC_SKILLS }];

const byId = new Map<string, Skill>();
for (const a of AREAS) for (const st of a.skills) for (const s of st) {
  if (byId.has(s.id)) throw new Error(`duplicate skill id ${s.id}`);
  byId.set(s.id, s);
}
export const skillById = (id: string): Skill | undefined => byId.get(id);
export const allSkills = (): Skill[] => [...byId.values()];
