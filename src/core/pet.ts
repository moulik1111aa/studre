// The Adventure pet: an egg that hatches after 3 levels or the first chest, one of four pets
// the child picks and names, growth from XP earned after hatching (so undo just works), a mood
// that is only ever sleepy (not played today) or bouncy (played), and snacks bought with gems
// that give friendship hearts and unlock tricks. Never sad, sick or lost.

import { chestsOpened, xpOf, type AdvChild, type AdventureState } from './adventure.ts';
import { gemBalance } from './wardrobe.ts';
import { HATCH_LEVELS, PET_NAME_MAX, SNACKS, heartsOf, speciesOf, stageFor, type SnackId, type Species } from './petdata.ts';

/** The egg turns up when Adventure is on; levels count from then. */
export function ensureEgg(a: AdventureState | undefined, now: number): void {
  if (a?.on && !a.pet && !a.eggAt) a.eggAt = now;
}

/** Levels finished since the egg turned up. */
export const levelsSinceEgg = (c: AdvChild): number => (c.log ?? []).filter((e) => e.t >= (c.adventure?.eggAt ?? Infinity)).length;

/** Ready to hatch: 3 levels since the egg, or a chest opened. */
export function hatchReady(c: AdvChild): boolean {
  const a = c.adventure;
  if (!a?.on || a.pet) return false;
  return levelsSinceEgg(c) >= HATCH_LEVELS || chestsOpened(a) >= 1;
}

/** Levels left before the egg can hatch (0 = ready). */
export const levelsToHatch = (c: AdvChild): number => (hatchReady(c) ? 0 : Math.max(0, HATCH_LEVELS - levelsSinceEgg(c)));

export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, PET_NAME_MAX);

/** Hatch the egg as `species` called `name`. False if it isn't ready or the name is empty. */
export function hatch(c: AdvChild, species: Species, name: string, now: number): boolean {
  const a = c.adventure;
  const n = cleanName(name);
  if (!a || !hatchReady(c) || !n || !speciesOf(species)) return false;
  a.pet = { species, name: n, hatchedAt: now, xpAtHatch: xpOf(c), seenStage: 1 };
  return true;
}

/** XP earned since hatching (the pet grows with it). */
export const petXp = (c: AdvChild): number => (c.adventure?.pet ? Math.max(0, xpOf(c) - c.adventure.pet.xpAtHatch) : 0);
export const petStage = (c: AdvChild) => stageFor(petXp(c));

/** Never sad: sleepy until the child plays today, then bouncy. */
export const moodOf = (c: AdvChild, today: string): 'sleepy' | 'bouncy' => ((c.stats.secondsByDay[today] ?? 0) > 0 ? 'bouncy' : 'sleepy');

export type FeedResult = { ok: true; hearts: number; gained: number } | { ok: false; need: number };

/** Give a snack: costs gems, gives hearts. */
export function feed(c: AdvChild, snackId: SnackId, now: number): FeedResult {
  const pet = c.adventure?.pet;
  const s = SNACKS.find((x) => x.id === snackId);
  if (!pet || !s) return { ok: false, need: 0 };
  const balance = gemBalance(c);
  if (balance < s.price) return { ok: false, need: s.price - balance };
  let at = now;
  while ((pet.treats ??= {})[`${s.id}:${at}`]) at++;
  pet.treats[`${s.id}:${at}`] = at;
  return { ok: true, hearts: heartsOf(pet), gained: s.hearts };
}
