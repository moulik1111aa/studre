// Plus's wardrobe (Adventure): hats, glasses, things to wear round the neck, body colours and
// map trails, bought with gems. Gems are earned (core/adventure.ts gemsEarned) and only buy
// these fun things: they never turn into coins, so real rewards cost parents the same.
// Every fifth chest also holds a surprise item, chosen in a fixed order (no random loot).

import { chestsOpened, gemsEarned, levelOf, xpOf, type AdvChild, type AdventureState } from './adventure.ts';
import { treatGems } from './petdata.ts';

export type Slot = 'hat' | 'face' | 'neck' | 'colour' | 'trail';
export const SLOTS: { id: Slot; name: string }[] = [
  { id: 'hat', name: 'Hats' },
  { id: 'face', name: 'Glasses' },
  { id: 'neck', name: 'Neck and back' },
  { id: 'colour', name: 'Colours' },
  { id: 'trail', name: 'Map trails' },
];

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  icon: string;
  price: number;
  /** Player level needed to buy it (1 = from the start). */
  level: number;
  /** Raid-only: found in a raid monster's chest, never sold (core/raid.ts). */
  raid?: string;
}

export const ITEMS: Item[] = [
  { id: 'party-hat', slot: 'hat', name: 'Party hat', icon: '🥳', price: 30, level: 1 },
  { id: 'cap', slot: 'hat', name: 'Cap', icon: '🧢', price: 40, level: 1 },
  { id: 'flower-crown', slot: 'hat', name: 'Flower crown', icon: '🌸', price: 60, level: 1 },
  { id: 'chef-hat', slot: 'hat', name: 'Chef’s hat', icon: '🍳', price: 70, level: 3 },
  { id: 'headphones', slot: 'hat', name: 'Headphones', icon: '🎧', price: 80, level: 4 },
  { id: 'bunny-ears', slot: 'hat', name: 'Bunny ears', icon: '🐰', price: 90, level: 5 },
  { id: 'pirate-hat', slot: 'hat', name: 'Pirate hat', icon: '🏴‍☠️', price: 120, level: 8 },
  { id: 'wizard-hat', slot: 'hat', name: 'Wizard hat', icon: '🪄', price: 150, level: 10 },
  { id: 'crown', slot: 'hat', name: 'Crown', icon: '👑', price: 300, level: 15 },
  { id: 'space-helmet', slot: 'hat', name: 'Space helmet', icon: '🚀', price: 400, level: 25 },
  { id: 'round-glasses', slot: 'face', name: 'Round glasses', icon: '👓', price: 40, level: 1 },
  { id: 'sunglasses', slot: 'face', name: 'Sunglasses', icon: '🕶️', price: 60, level: 2 },
  { id: 'heart-glasses', slot: 'face', name: 'Heart glasses', icon: '💖', price: 75, level: 4 },
  { id: 'star-glasses', slot: 'face', name: 'Star glasses', icon: '⭐', price: 90, level: 6 },
  { id: 'monocle', slot: 'face', name: 'Monocle', icon: '🧐', price: 110, level: 9 },
  { id: 'bow-tie', slot: 'neck', name: 'Bow tie', icon: '🎀', price: 35, level: 1 },
  { id: 'scarf', slot: 'neck', name: 'Scarf', icon: '🧣', price: 50, level: 1 },
  { id: 'flower-lei', slot: 'neck', name: 'Flower necklace', icon: '🌺', price: 55, level: 3 },
  { id: 'medal', slot: 'neck', name: 'Medal', icon: '🏅', price: 150, level: 8 },
  { id: 'cape', slot: 'neck', name: 'Hero cape', icon: '🦸', price: 200, level: 12 },
  { id: 'mint', slot: 'colour', name: 'Mint', icon: '🟢', price: 60, level: 1 },
  { id: 'sky', slot: 'colour', name: 'Sky', icon: '🔵', price: 60, level: 2 },
  { id: 'snow', slot: 'colour', name: 'Snow', icon: '⚪', price: 70, level: 4 },
  { id: 'bubblegum', slot: 'colour', name: 'Bubblegum', icon: '🩷', price: 80, level: 5 },
  { id: 'grape', slot: 'colour', name: 'Grape', icon: '🟣', price: 100, level: 7 },
  { id: 'sunset', slot: 'colour', name: 'Sunset', icon: '🌅', price: 150, level: 20 },
  { id: 'sparkles', slot: 'trail', name: 'Sparkle trail', icon: '✨', price: 80, level: 2 },
  { id: 'bubbles', slot: 'trail', name: 'Bubble trail', icon: '🫧', price: 100, level: 5 },
  { id: 'stars', slot: 'trail', name: 'Starlight trail', icon: '🌟', price: 120, level: 9 },
  { id: 'rainbow', slot: 'trail', name: 'Rainbow trail', icon: '🌈', price: 250, level: 18 },
  // Raid chests only.
  { id: 'dino-spikes', slot: 'hat', name: 'Dino spikes', icon: '🦖', price: 0, level: 1, raid: 'grumblesaur' },
  { id: 'nightcap', slot: 'hat', name: 'Sleepy nightcap', icon: '🦥', price: 0, level: 1, raid: 'snoozer' },
  { id: 'pixel-shades', slot: 'face', name: 'Pixel shades', icon: '👾', price: 0, level: 1, raid: 'glitch' },
  { id: 'dragon-wings', slot: 'neck', name: 'Dragon wings', icon: '🐉', price: 0, level: 1, raid: 'fizzle' },
  { id: 'octo-purple', slot: 'colour', name: 'Octo purple', icon: '🐙', price: 0, level: 1, raid: 'muddle' },
  { id: 'stone', slot: 'colour', name: 'Stone', icon: '🪨', price: 0, level: 1, raid: 'rumble' },
  { id: 'jelly', slot: 'colour', name: 'Jelly pink', icon: '🪼', price: 0, level: 1, raid: 'wobbler' },
  { id: 'ghost-trail', slot: 'trail', name: 'Ghost trail', icon: '👻', price: 0, level: 1, raid: 'gus' },
];
export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);

const has = (a: AdventureState | undefined, id: string) => !!(a?.owned?.[id] || a?.gifted?.[id]);
export const ownsItem = has;

/** Gems spent: bought items (surprise items are free) and the pet's snacks. */
export const gemsSpent = (a: AdventureState | undefined): number => Object.keys(a?.owned ?? {}).reduce((n, id) => n + (itemById(id)?.price ?? 0), 0) + treatGems(a?.pet);
export const gemBalance = (c: AdvChild): number => Math.max(0, gemsEarned(c) - gemsSpent(c.adventure));

/** What Plus is wearing (only items the child has; an undo may have taken one back). */
export function outfitOf(a: AdventureState | undefined): Partial<Record<Slot, string>> {
  const out: Partial<Record<Slot, string>> = {};
  if (!a?.on) return out;
  for (const [slot, id] of Object.entries(a.equipped ?? {})) if (has(a, id) && itemById(id)?.slot === slot) out[slot as Slot] = id;
  return out;
}

export type TapResult = { kind: 'worn' | 'off' | 'bought' | 'raid'; item: Item } | { kind: 'locked' | 'short'; item: Item; need: number };

/**
 * One tap on an item: put on or take off one the child has, or buy and put on a new one.
 * Can't buy above the child's level or without enough gems.
 */
export function tapItem(c: AdvChild, id: string, now: number): TapResult | null {
  const a = c.adventure;
  const item = itemById(id);
  if (!a?.on || !item) return null;
  const eq = (a.equipped ??= {});
  if (has(a, id)) {
    if (eq[item.slot] === id) {
      delete eq[item.slot];
      return { kind: 'off', item };
    }
    eq[item.slot] = id;
    return { kind: 'worn', item };
  }
  if (item.raid) return { kind: 'raid', item };
  const level = levelOf(xpOf(c)).level;
  if (level < item.level) return { kind: 'locked', item, need: item.level };
  const balance = gemBalance(c);
  if (balance < item.price) return { kind: 'short', item, need: item.price - balance };
  (a.owned ??= {})[id] = now;
  eq[item.slot] = id;
  return { kind: 'bought', item };
}

/** A surprise wardrobe item comes in every SURPRISE_EVERY-th chest. */
export const SURPRISE_EVERY = 5;
/** Chests until the next surprise (5 … 1), counting the one being opened. */
export const chestsToSurprise = (a: AdventureState | undefined): number => SURPRISE_EVERY - (chestsOpened(a) % SURPRISE_EVERY);

/**
 * After a chest is claimed: every fifth chest gives the next item the child doesn't have
 * (cheapest first, among those open at their level), or nothing if they have them all.
 */
export function surpriseFor(c: AdvChild, now: number): Item | null {
  const a = c.adventure;
  if (!a?.on) return null;
  const n = chestsOpened(a);
  if (n === 0 || n % SURPRISE_EVERY !== 0) return null;
  const level = levelOf(xpOf(c)).level;
  const next = ITEMS.filter((i) => !i.raid && !has(a, i.id) && i.level <= Math.max(level, 1)).sort((p, q) => p.price - q.price || p.id.localeCompare(q.id))[0];
  if (!next) return null;
  (a.gifted ??= {})[next.id] = now;
  return next;
}

/** A raid chest's item: the monster's own wardrobe item (once). */
export function raidItem(c: AdvChild, monsterId: string, now: number): Item | null {
  const a = c.adventure;
  const item = ITEMS.find((i) => i.raid === monsterId);
  if (!a?.on || !item || has(a, item.id)) return null;
  (a.gifted ??= {})[item.id] = now;
  return item;
}
