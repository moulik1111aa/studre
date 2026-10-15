// Face-off (spec §6): two players on one phone. Pure match logic — the screen draws it.
// Tug of War (rope, 7 notches), Race to 10, and Showdown (same question, first to 7).

import type { Skill } from './skill.ts';
import type { Progress, Level } from './path.ts';
import { frontier } from './path.ts';

export type FaceoffMode = 'tug' | 'race' | 'showdown';

export const FACEOFF = {
  tugNotches: 7,
  raceTarget: 10,
  showdownTarget: 7,
  freezeMs: 1000,
  balanceStreak: 3,
  balanceStep: 3,
  showdownGap: 10,
};

export const MODE_NAMES: Record<FaceoffMode, string> = { tug: 'Tug of War', race: 'Race to 10', showdown: 'Showdown' };

export interface FaceoffSide {
  /** Index into the flat skill list. */
  skill: number;
  score: number;
  streak: number;
  frozenUntil: number;
}

export type FaceoffEvent =
  | { type: 'point'; side: 0 | 1 }
  | { type: 'wrong'; side: 0 | 1; until: number }
  | { type: 'harder'; side: 0 | 1; skill: number }
  | { type: 'win'; side: 0 | 1 };

/** A player's skill position: a child's current frontier skill; a guest's slider value. */
export function childSkillIndex(path: Level[], p: Progress, skills: Skill[]): number {
  const at = frontier(path, p);
  const lvl = path[Math.min(at, path.length - 1)];
  const id = lvl.kind === 'skill' ? lvl.skillId : lvl.kind === 'review' ? lvl.skillIds[lvl.skillIds.length - 1] : lvl.phases.flat().at(-1)!;
  const i = skills.findIndex((s) => s.id === id);
  return Math.max(0, i);
}

export const showdownAllowed = (a: number, b: number): boolean => Math.abs(a - b) <= FACEOFF.showdownGap;

export class FaceoffMatch {
  readonly mode: FaceoffMode;
  readonly sides: [FaceoffSide, FaceoffSide];
  /** Tug of War rope: + towards side 0's line, − towards side 1's. */
  rope = 0;
  winner: 0 | 1 | null = null;
  private readonly maxSkill: number;

  constructor(mode: FaceoffMode, skillA: number, skillB: number, maxSkill: number) {
    if (mode === 'showdown' && !showdownAllowed(skillA, skillB)) throw new Error('showdown needs players within 10 skills');
    this.mode = mode;
    this.maxSkill = maxSkill;
    const side = (skill: number): FaceoffSide => ({ skill, score: 0, streak: 0, frozenUntil: 0 });
    this.sides = [side(skillA), side(skillB)];
  }

  get target(): number {
    return this.mode === 'tug' ? FACEOFF.tugNotches : this.mode === 'race' ? FACEOFF.raceTarget : FACEOFF.showdownTarget;
  }

  /** In Showdown both players answer the same question, pitched at the less advanced player. */
  get sharedSkill(): number {
    return Math.min(this.sides[0].skill, this.sides[1].skill);
  }

  frozen(side: 0 | 1, now: number): boolean {
    return now < this.sides[side].frozenUntil;
  }

  /** One tap from a side. Ignored while that side is frozen or once the match is over. */
  answer(side: 0 | 1, correct: boolean, now: number): FaceoffEvent[] {
    if (this.winner !== null || this.frozen(side, now)) return [];
    const me = this.sides[side];
    const ev: FaceoffEvent[] = [];
    if (!correct) {
      me.streak = 0;
      me.frozenUntil = now + FACEOFF.freezeMs;
      ev.push({ type: 'wrong', side, until: me.frozenUntil });
      return ev;
    }
    me.score++;
    me.streak++;
    const other = this.sides[side === 0 ? 1 : 0];
    if (this.mode === 'showdown') other.streak = 0;
    ev.push({ type: 'point', side });
    if (this.mode === 'tug') this.rope += side === 0 ? 1 : -1;
    if (me.streak > 0 && me.streak % FACEOFF.balanceStreak === 0 && this.mode !== 'showdown') {
      me.skill = Math.min(this.maxSkill, me.skill + FACEOFF.balanceStep);
      ev.push({ type: 'harder', side, skill: me.skill });
    }
    const won = this.mode === 'tug' ? Math.abs(this.rope) >= FACEOFF.tugNotches : me.score >= this.target;
    if (won) {
      this.winner = this.mode === 'tug' ? (this.rope > 0 ? 0 : 1) : side;
      ev.push({ type: 'win', side: this.winner });
    }
    return ev;
  }
}

/** Scoreboard key for a pair, order-independent; returns the key and whether a/b were swapped. */
export function pairKey(a: string, b: string): { key: string; swapped: boolean } {
  return a <= b ? { key: `${a}|${b}`, swapped: false } : { key: `${b}|${a}`, swapped: true };
}

export function recordPair(board: Record<string, [number, number]>, a: string, b: string, winner: 0 | 1): void {
  const { key, swapped } = pairKey(a, b);
  const row = (board[key] ??= [0, 0]);
  const idx = (winner === 0) !== swapped ? 0 : 1;
  row[idx]++;
}

export function pairScore(board: Record<string, [number, number]>, a: string, b: string): [number, number] {
  const { key, swapped } = pairKey(a, b);
  const row = board[key] ?? [0, 0];
  return swapped ? [row[1], row[0]] : [row[0], row[1]];
}
