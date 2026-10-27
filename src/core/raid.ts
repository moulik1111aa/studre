// The weekly boss raid (Adventure): each week (Monday to Sunday) a raid monster turns up, and
// every right answer that week hits it. Damage is worked out from the play log and the chests
// opened, so undoing play undoes the hits too. Beat it before Sunday ends to open a raid chest
// (gems and a wardrobe item of its own). A monster that isn't beaten just leaves on Monday.

import { weekDays, weekStart, type AdvChild } from './adventure.ts';

export interface RaidMonster {
  id: string;
  name: string;
  icon: string;
  colour: string;
  taunts: string[];
  /** The wardrobe item in its chest (core/wardrobe.ts). */
  item: string;
}

export const ROSTER: RaidMonster[] = [
  { id: 'grumblesaur', name: 'Grumblesaur', icon: '🦖', colour: '#4CAF6A', item: 'dino-spikes', taunts: ['I eat times tables for breakfast!', 'Rawr! Bet you can’t count my spikes.', 'Grumble grumble… you’re getting better at this.'] },
  { id: 'muddle', name: 'Captain Muddle', icon: '🐙', colour: '#8E5CF5', item: 'octo-purple', taunts: ['I’ll muddle up all your numbers!', 'Eight arms, zero answers right. Ha!', 'Hey! Stop un-muddling my sums!'] },
  { id: 'snoozer', name: 'Sir Snoozealot', icon: '🦥', colour: '#A1887F', item: 'nightcap', taunts: ['Zzz… maths is too sleepy for me…', 'Wake me up when you get one right. Zzz…', 'Yawn! You hit hard for someone so small.'] },
  { id: 'fizzle', name: 'Fizzle the Dragon', icon: '🐉', colour: '#FF7043', item: 'dragon-wings', taunts: ['My fire melts fractions!', 'Puff puff! Is that all you’ve got?', 'Ouch, those right answers are hot!'] },
  { id: 'glitch', name: 'Glitchbot', icon: '👾', colour: '#29B6F6', item: 'pixel-shades', taunts: ['Beep boop. Error: you can’t beat me.', 'Calculating… you need more practice!', 'Warning! Warning! Too many right answers!'] },
  { id: 'rumble', name: 'Rumble Rock', icon: '🪨', colour: '#90A4AE', item: 'stone', taunts: ['I’m solid rock. Numbers bounce off me!', 'Rumble rumble. You’ll never crack me.', 'Hey, that one chipped me!'] },
  { id: 'wobbler', name: 'The Wobbler', icon: '🪼', colour: '#F06292', item: 'jelly', taunts: ['Wibble wobble, you can’t catch me!', 'I’m too wobbly for your sums!', 'Eek! Stop wobbling me with right answers!'] },
  { id: 'gus', name: 'Ghostly Gus', icon: '👻', colour: '#9FB4C7', item: 'ghost-trail', taunts: ['Boo! Did I scare your numbers away?', 'Ooooh, you’ll never find me in these sums…', 'Hey! I’m see-through, not hit-through!'] },
];
export const monsterById = (id: string): RaidMonster | undefined => ROSTER.find((m) => m.id === id);

/** Damage rules (also shown to children on the raid screen). */
export const HIT = { right: 1, perfect: 5, stars3: 3, chest: 20 } as const;

/** Weeks since 5 Jan 2026 (a Monday), so the roster goes round in order. */
const weekNo = (monday: string) => Math.round((Date.parse(`${monday}T12:00:00Z`) - Date.parse('2026-01-05T12:00:00Z')) / (7 * 86_400_000));

export function monsterFor(day: string): RaidMonster {
  const n = weekNo(weekStart(day));
  return ROSTER[((n % ROSTER.length) + ROSTER.length) % ROSTER.length];
}

export interface RaidState {
  monster: RaidMonster;
  monday: string;
  /** Claim key for the raid chest. */
  key: string;
  hp: number;
  damage: number;
  left: number;
  defeated: boolean;
  claimed: boolean;
  /** Damage on each day of the week (Monday first). */
  byDay: { day: string; damage: number }[];
}

/** Damage on one day: right answers, perfect and 3-star levels, and the daily chest. */
export function damageOn(c: AdvChild, day: string): number {
  let n = 0;
  for (const e of c.log ?? []) {
    if (e.d !== day) continue;
    n += Object.values(e.a).reduce((x, r) => x + r[1], 0) * HIT.right;
    if (e.of > 0 && e.sc >= e.of) n += HIT.perfect;
    if (e.s >= 3) n += HIT.stars3;
  }
  if (c.adventure?.claimed[`d:${day}`]) n += HIT.chest;
  return n;
}

export const raidHp = (age: number): number => (age <= 6 ? 150 : 250);

export function raidFor(c: AdvChild, today: string): RaidState {
  const monday = weekStart(today);
  const byDay = weekDays(today)
    .filter((d) => d <= today)
    .map((day) => ({ day, damage: damageOn(c, day) }));
  const damage = byDay.reduce((n, d) => n + d.damage, 0);
  const hp = raidHp(c.age);
  const key = `r:${monday}`;
  return { monster: monsterFor(today), monday, key, hp, damage, left: Math.max(0, hp - damage), defeated: damage >= hp, claimed: !!c.adventure?.claimed[key], byDay };
}

/** Raid monsters beaten (raid chests opened). */
export const raidsWon = (c: AdvChild): number => Object.keys(c.adventure?.claimed ?? {}).filter((k) => k.startsWith('r:')).length;

/** A kind, funny line from the monster (changes through the week, and as it gets hurt). */
export function tauntFor(r: RaidState, today: string): string {
  const t = r.monster.taunts;
  if (r.defeated) return t[2];
  const day = new Date(`${today}T12:00:00`).getDay();
  return t[(day + (r.damage > r.hp / 2 ? 1 : 0)) % 2];
}
