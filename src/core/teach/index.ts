// Lessons for every question: the methods live in the files next to this one; skills attach a
// lesson to each question they make (Made.teach), and the app asks for it with lessonOf().

import { isCorrect, type Made } from '../question.ts';
import { LessonBuilder } from './build.ts';
import type { Lesson } from './types.ts';

export type { Lesson, Step, Board } from './types.ts';

/** The lesson for a question: its own, or (never expected) a short fallback from its hint. */
export function lessonOf(q: Pick<Made, 'answer' | 'hint' | 'teach' | 'prompt' | 'exactForm'>): Lesson {
  try {
    const l = q.teach?.();
    // A slip note never matches the right answer (it would be shown for a correct answer).
    if (l && l.steps.length) return l.slips ? { ...l, slips: l.slips.filter((s) => !isCorrect(q, s.answer)) } : l;
  } catch (e) {
    console.error('lesson failed', q.prompt, e);
  }
  return fallbackLesson(q);
}

export function fallbackLesson(q: Pick<Made, 'answer' | 'hint'>): Lesson {
  const L = new LessonBuilder();
  if (q.hint) L.say(q.hint);
  return L.end(q.answer);
}
