// The Adventure pet's plain data (no other game logic, so core/adventure.ts can use it for
// the pet badges without an import loop): the four pets, growth stages, snacks and tricks.
// The rules that need XP and gems live in core/pet.ts.

export type Species = 'fox' | 'turtle' | 'owl' | 'dragon';

export const SPECIES: { id: Species; name: string; blurb: string; names: string[] }[] = [
  { id: 'fox', name: 'Fox', blurb: 'Quick and curious', names: ['Pip', 'Ember', 'Rusty'] },
  { id: 'turtle', name: 'Turtle', blurb: 'Calm and steady', names: ['Shelly', 'Moss', 'Tank'] },
  { id: 'owl', name: 'Owl', blurb: 'Wise and watchful', names: ['Hoot', 'Luna', 'Sage'] },
  { id: 'dragon', name: 'Little dragon', blurb: 'Brave and sparkly', names: ['Spark', 'Blaze', 'Ziggy'] },
];
export const speciesOf = (id: string) => SPECIES.find((s) => s.id === id);

export interface PetState {
  species: Species;
  name: string;
  /** When it hatched (ms), and the child's XP at that moment: it grows with XP earned after. */
  hatchedAt: number;
  xpAtHatch: number;
  /** Snacks given: "<snack>:<ms>" → ms (gems spent and hearts come from these, so undo works). */
  treats?: Record<string, number>;
  /** The growth stage last celebrated. */
  seenStage?: number;
}

export const PET_NAME_MAX = 12;
/** The egg hatches after this many levels (or the first chest), whichever comes first. */
export const HATCH_LEVELS = 3;

export interface Stage {
  n: 1 | 2 | 3 | 4 | 5;
  name: string;
  /** Pet XP (XP earned since hatching) to reach it. */
  xp: number;
}
export const STAGES: Stage[] = [
  { n: 1, name: 'Baby', xp: 0 },
  { n: 2, name: 'Little', xp: 500 },
  { n: 3, name: 'Big', xp: 2000 },
  { n: 4, name: 'Super', xp: 5000 },
  { n: 5, name: 'Legendary', xp: 10000 },
];

export function stageFor(petXp: number): { stage: Stage; next?: Stage; into: number; need: number } {
  const stage = [...STAGES].reverse().find((s) => petXp >= s.xp) ?? STAGES[0];
  const next = STAGES[stage.n];
  return { stage, next, into: petXp - stage.xp, need: next ? next.xp - stage.xp : 0 };
}

export const SNACKS = [
  { id: 'berries', name: 'Berries', icon: '🫐', price: 5, hearts: 1 },
  { id: 'cookie', name: 'Cookie', icon: '🍪', price: 10, hearts: 2 },
  { id: 'cake', name: 'Cake', icon: '🍰', price: 20, hearts: 4 },
] as const;
export type SnackId = (typeof SNACKS)[number]['id'];
const snackOf = (key: string) => SNACKS.find((s) => key.startsWith(`${s.id}:`));

export const TRICKS = [
  { id: 'wave', name: 'Wave', hearts: 5 },
  { id: 'spin', name: 'Spin', hearts: 15 },
  { id: 'dance', name: 'Dance', hearts: 30 },
] as const;
export type TrickId = (typeof TRICKS)[number]['id'];

/** Friendship hearts from snacks. */
export const heartsOf = (p: PetState | undefined): number => Object.keys(p?.treats ?? {}).reduce((n, k) => n + (snackOf(k)?.hearts ?? 0), 0);
/** Gems spent on snacks. */
export const treatGems = (p: PetState | undefined): number => Object.keys(p?.treats ?? {}).reduce((n, k) => n + (snackOf(k)?.price ?? 0), 0);
export const tricksFor = (hearts: number) => TRICKS.filter((t) => hearts >= t.hearts);

/** Undo: a pet hatched in the undone time goes back into its egg; snacks given then come back. */
export function rollbackPet(a: { pet?: PetState } | undefined, since: number): void {
  const pet = a?.pet;
  if (!a || !pet) return;
  if (pet.hatchedAt >= since) {
    delete a.pet;
    return;
  }
  for (const [k, t] of Object.entries(pet.treats ?? {})) if (t >= since) delete pet.treats![k];
}

/** Two phones together: the pet that hatched first, with every snack from both. */
export function mergePet(x: PetState | undefined, y: PetState | undefined): PetState | undefined {
  if (!x || !y) return x ?? y;
  const first = y.hatchedAt < x.hatchedAt ? y : x;
  return { ...first, treats: { ...(y.treats ?? {}), ...(x.treats ?? {}) }, seenStage: Math.max(x.seenStage ?? 1, y.seenStage ?? 1) };
}
