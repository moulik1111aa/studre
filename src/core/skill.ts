// A skill: one small, precisely scoped piece of maths that can make endless questions.

import type { Rng } from './rng.ts';
import type { AnswerFormat, Made, Strand } from './question.ts';

export interface Skill {
  /** Stable id, e.g. "s3.add2d2d.carry". Saved in progress — never rename. */
  id: string;
  area: string;
  stage: number;
  strand: Strand;
  name: string;
  /** How the child answers by default (Face-off always uses 4 choices). */
  format: AnswerFormat;
  /** Seconds per question on Speed levels. */
  speedSec: number;
  /** difficulty d in [0, 1]: 0 is the easy end of the skill, 1 the hard end. */
  make(rng: Rng, d: number): Made;
}

export interface SkillOptions {
  format?: AnswerFormat;
  speedSec?: number;
}

/** Stage-local helper so skill tables stay compact. */
export function stageSkills(area: string, stage: number, defaults: Required<SkillOptions>) {
  const list: Skill[] = [];
  const add = (id: string, strand: Strand, name: string, make: Skill['make'], opts: SkillOptions = {}): void => {
    list.push({
      id: `s${stage}.${id}`,
      area,
      stage,
      strand,
      name,
      format: opts.format ?? defaults.format,
      speedSec: opts.speedSec ?? defaults.speedSec,
      make,
    });
  };
  return { list, add };
}

/** Things to count in pictures (the renderer draws each one). */
export const OBJECTS = ['mango', 'balloon', 'duck', 'star', 'car', 'flower', 'apple', 'fish', 'ball', 'cookie', 'butterfly', 'kite'] as const;
export type ObjectName = (typeof OBJECTS)[number];
export const PLURAL: Record<ObjectName, string> = {
  mango: 'mangoes',
  balloon: 'balloons',
  duck: 'ducks',
  star: 'stars',
  car: 'cars',
  flower: 'flowers',
  apple: 'apples',
  fish: 'fish',
  ball: 'balls',
  cookie: 'cookies',
  butterfly: 'butterflies',
  kite: 'kites',
};
export const thing = (o: ObjectName, n: number): string => (n === 1 ? o : PLURAL[o]);

export const NAMES = ['Riya', 'Aarav', 'Meera', 'Kabir', 'Anaya', 'Vihaan', 'Isha', 'Arjun', 'Zara', 'Dev', 'Sara', 'Rohan', 'Tara', 'Ishaan', 'Myra', 'Neil'];
