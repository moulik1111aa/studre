// The reward catalogue: picture-card rewards you buy or pay for, by category (spec §4).
// Treats go in the treat jar; toys and dream goals in the big goal jar.

export type PriceTier = 'small' | 'medium' | 'large' | 'toyS' | 'toyM' | 'toyB' | 'dream';
export type Jar = 'treat' | 'goal';

export const PRICES: Record<PriceTier, { coins: number; jar: Jar; about: string }> = {
  small: { coins: 480, jar: 'treat', about: 'about 10 days' },
  medium: { coins: 820, jar: 'treat', about: 'about 2–3 weeks' },
  large: { coins: 1200, jar: 'treat', about: 'about 1 month' },
  toyS: { coins: 500, jar: 'goal', about: 'about 1½ months' },
  toyM: { coins: 680, jar: 'goal', about: 'about 2 months' },
  toyB: { coins: 900, jar: 'goal', about: 'about 3 months' },
  dream: { coins: 1900, jar: 'goal', about: 'about 6 months' },
};

export interface Reward {
  id: string;
  name: string;
  category: string;
  tier: PriceTier;
  /** Emoji used as the drawing's base (rendered large on a styled card). */
  icon: string;
  /** Retired from the catalogue: still resolves for children who already chose it. */
  hidden?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

/** Only things you buy or pay for: food, stationery, toys, paid outings and big days out. */
export const CATEGORIES: Category[] = [
  { id: 'sweets', name: 'Chocolate & sweets', icon: '🍫' },
  { id: 'snacks', name: 'Snacks', icon: '🍟' },
  { id: 'drinks', name: 'Drinks', icon: '🥤' },
  { id: 'desserts', name: 'Ice cream & desserts', icon: '🍦' },
  { id: 'meals', name: 'Treat meals', icon: '🍕' },
  { id: 'little', name: 'Little things', icon: '🎈' },
  { id: 'stationery', name: 'Stationery', icon: '✏️' },
  { id: 'books', name: 'Books & kits', icon: '📚' },
  { id: 'minitoys', name: 'Small toys', icon: '🪀' },
  { id: 'outings', name: 'Outings', icon: '🎟️' },
  { id: 'toys', name: 'Toys', icon: '🧸' },
  { id: 'days', name: 'Big days out', icon: '🎢' },
  { id: 'dream', name: 'Dream goals', icon: '🚲' },
  { id: 'own', name: 'Your own', icon: '✨' },
];

type Row = [name: string, icon: string];
const R: Reward[] = [];
const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function group(category: string, tier: PriceTier, rows: Row[], hidden = false): void {
  for (const [name, icon] of rows) {
    const r: Reward = { id: `${category}.${slug(name)}`, name, category, tier, icon, ...(hidden ? { hidden } : {}) };
    const at = R.findIndex((x) => x.id === r.id);
    if (at >= 0) R[at] = r;
    else R.push(r);
  }
}

// Retired rewards (earlier catalogue): kept so a reward already chosen still shows.
group('meals', 'medium', [['Choose tonight’s dinner', '🍽️'], ['Pancake breakfast', '🥞']], true);
group('screen', 'small', [['15 extra minutes of cartoons', '📺'], ['Choose the car music', '🎵']], true);
group('screen', 'medium', [['30 extra minutes of cartoons', '📺'], ['30 minutes of video games', '🎮'], ['Pick the family movie', '🎬'], ['Movie night with popcorn', '🍿']], true);
group('outings', 'medium', [['Park', '🌳'], ['Playground', '🛝'], ['Cycling ride', '🚴'], ['Picnic', '🧺'], ['Swimming', '🏊'], ['Museum', '🏛️'], ['Fair', '🎡']], true);
group('outings', 'large', [['Zoo', '🦁'], ['Aquarium', '🐠'], ['Beach', '🏖️'], ['Trampoline park', '🤸'], ['Bowling', '🎳'], ['Arcade', '🕹️'], ['Cinema', '🎟️']], true);
group('family', 'small', [['Extra bedtime story', '📖'], ['Stay up 30 minutes late', '🌙'], ['Board game with Mummy or Papa', '🎲'], ['Paint together', '🎨']], true);
group('family', 'medium', [['Bake together', '🧁'], ['Blanket fort', '🏰'], ['Living-room camping', '⛺'], ['Choose the weekend plan', '🗓️'], ['Kite flying', '🪁'], ['Sleepover with a cousin', '🛏️']], true);
group('little', 'small', [['Fancy pencil', '✏️'], ['Eraser set', '🧽'], ['Balloons', '🎈'], ['Bubble wand', '🫧'], ['Stamp set', '🔖']], true);
group('little', 'medium', [['Colouring book', '📘'], ['Crayons', '🖍️'], ['Sketch pens', '🖊️'], ['Notebook', '📓'], ['Slime', '🟢'], ['Play-dough', '🟣']], true);
group('books', 'medium', [['Comic book', '💥'], ['Story book', '📗'], ['Puzzle book', '🧩']], true);
group('books', 'large', [['Jigsaw puzzle', '🧩'], ['Science kit', '🔬'], ['Magic kit', '🎩']], true);
group('toys', 'toyS', [['Toy car', '🚗'], ['Yo-yo', '🪀'], ['Puzzle cube', '🟥'], ['Skipping rope', '➰'], ['Water gun', '🔫'], ['Football', '⚽'], ['Doll', '🪆']], true);
group('toys', 'toyM', [['Action figure', '🦸'], ['Teddy bear', '🧸'], ['Board game', '🎲'], ['Art kit', '🎨'], ['Badminton set', '🏸'], ['Cricket bat', '🏏']], true);
group('toys', 'toyB', [['Building-brick set', '🧱'], ['Remote-control car', '🏎️'], ['Train set', '🚂'], ['Toy kitchen', '🍳'], ['Doctor set', '🩺'], ['Dollhouse', '🏠'], ['Music keyboard', '🎹'], ['Walkie-talkies', '📻'], ['Roller skates', '⛸️']], true);
group('dream', 'dream', [['Play tent', '⛺']], true);
group('drinks', 'small', [['Coconut water', '🥥'], ['Lemonade', '🍋'], ['Iced tea', '🧋'], ['Hot chocolate', '☕'], ['Smoothie', '🍓']], true);
group('snacks', 'small', [['Masala puffs', '🥐'], ['Sandwich', '🥪'], ['Noodles', '🍜']], true);
group('sweets', 'small', [['Candy buttons', '🍬'], ['Toffees', '🍬'], ['Jelly sweets', '🍬'], ['Ladoo', '🟠']], true);

// Treat jar: small, about 10 days.
group('sweets', 'small', [
  ['Milk chocolate bar', '🍫'], ['Chocolate wafer', '🍫'], ['Surprise chocolate egg', '🥚'], ['Chocolate gems', '🍬'], ['Gummy bears', '🧸'], ['Lollipop', '🍭'],
  ['Toffee pack', '🍬'], ['Cotton candy', '🍭'], ['Gulab jamun', '🍮'], ['Rasgulla', '⚪'], ['Jalebi', '🥨'], ['Kaju katli', '🔷'],
]);
group('snacks', 'small', [
  ['Chips', '🥔'], ['Nachos with dip', '🌮'], ['Popcorn', '🍿'], ['Pani puri', '🥣'], ['Momos', '🥟'], ['French fries', '🍟'],
  ['Vada pav', '🍔'], ['Pav bhaji', '🍛'], ['Cheese sandwich', '🥪'], ['Samosa', '🥟'],
]);
group('drinks', 'small', [['Cold drink', '🥤'], ['Mango shake', '🥭'], ['Chocolate milkshake', '🥛'], ['Bubble tea', '🧋'], ['Fresh juice', '🧃'], ['Lassi', '🥛']]);
group('desserts', 'small', [['Ice-cream cone', '🍦'], ['Choco-bar', '🍫'], ['Kulfi', '🍡'], ['Ice lolly', '🍧'], ['Ice-cream cup', '🍨']]);
group('little', 'small', [
  ['Sticker pack', '⭐'], ['Scented eraser set', '🧽'], ['Keychain', '🔑'], ['Bouncy ball', '🔴'], ['Bubble bottle', '🫧'], ['Hair clips', '🎀'],
  ['Trading cards pack', '🃏'], ['Mini slime tub', '🟢'], ['Temporary tattoos', '🦋'],
]);

// Treat jar: medium, about two weeks.
group('desserts', 'medium', [['Sundae', '🍨'], ['Brownie with ice cream', '🟫'], ['Waffle', '🧇'], ['Cupcake', '🧁'], ['Pastry', '🍰'], ['Doughnut box', '🍩'], ['Falooda', '🥤']]);
group('meals', 'medium', [['Pizza night', '🍕'], ['Burger meal', '🍔'], ['Pasta night', '🍝'], ['Dosa outing', '🥞'], ['Momos platter', '🥟'], ['Chinese takeaway', '🥡']]);
group('stationery', 'medium', [
  ['Gel pen set', '🖊️'], ['24 crayons', '🖍️'], ['Sketch pens', '🖍️'], ['Colouring book', '📘'], ['Fancy notebook', '📓'], ['Pencil box', '✏️'],
  ['Cartoon water bottle', '🍶'], ['Cartoon lunch box', '🍱'],
]);
group('books', 'medium', [['Comic book', '💥'], ['Story book', '📗'], ['Activity book', '🧩'], ['Sticker book', '📒']]);
group('minitoys', 'medium', [['Die-cast toy car', '🚗'], ['Yo-yo', '🪀'], ['Puzzle cube', '🟥'], ['Fidget toy', '🌀'], ['Slime kit', '🧪'], ['Play-dough set', '🟣'], ['Mini figurine', '🦖']]);

// Treat jar: large, about three weeks.
group('meals', 'large', [['Restaurant dinner', '🍽️']]);
group('outings', 'large', [['Cinema with popcorn', '🎬'], ['Soft-play area at the mall', '🛝'], ['Swimming pool session', '🏊']]);
group('books', 'large', [['Card game set', '🃏'], ['300-piece jigsaw', '🧩'], ['Small brick set', '🧱'], ['Magic kit', '🎩'], ['Science kit', '🔬'], ['Art set', '🎨']]);

// Big goal jar: toys.
group('toys', 'toyS', [
  ['Action figure', '🦸'], ['Doll', '🪆'], ['Small remote-control car', '🚙'], ['Water blaster', '🔫'], ['Kite with charkhi', '🪁'], ['Badminton set', '🏸'],
  ['Cricket bat', '🏏'], ['Football', '⚽'], ['Board game', '🎲'], ['Walkie-talkies', '📻'],
]);
group('toys', 'toyM', [
  ['Building-brick set', '🧱'], ['Train set', '🚂'], ['Doctor set', '🩺'], ['Toy kitchen', '🍳'], ['Mini keyboard', '🎹'], ['Foam-dart blaster', '🎯'],
  ['Basketball and hoop', '🏀'], ['Wooden chess set', '♟️'], ['Robotics kit', '🤖'], ['Mega art kit', '🎨'], ['Mini drone', '🚁'],
]);
group('toys', 'toyB', [
  ['Large brick set', '🏗️'], ['Stunt remote-control car', '🏎️'], ['Racing track set', '🏁'], ['Dollhouse', '🏠'], ['Inline skates', '⛸️'], ['Skateboard', '🛹'],
  ['Microscope', '🔬'], ['Kids’ headphones', '🎧'], ['New console game', '🎮'],
]);

// Big goal jar: big days out (paid).
group('days', 'toyB', [
  ['Game zone day at the mall', '🕹️'], ['Trampoline park', '🤸'], ['Bowling and arcade', '🎳'], ['Laser tag', '🔫'], ['VR games', '🥽'], ['Go-karting', '🏎️'],
  ['Ice skating', '⛸️'], ['Snow park', '❄️'],
]);
group('dream', 'dream', [
  ['Mall day: movie, dinner and game zone', '🎢'], ['Amusement park day', '🎡'], ['Water park day', '🌊'], ['Game-zone party with 3 friends', '🎉'],
  ['Bicycle', '🚲'], ['Gear cycle', '🚵'], ['Kick scooter', '🛴'], ['Giant brick castle', '🏰'], ['Kids’ smartwatch', '⌚'], ['Cricket kit', '🏏'], ['Football boots and jersey', '👟'],
]);

/** A reward a parent adds themselves (name, size, picture). */
export interface OwnReward {
  id: string;
  name: string;
  icon: string;
  tier: PriceTier;
}
const OWN: Reward[] = [];
/** Load the family's own rewards (from settings) into the catalogue. */
export function setOwnRewards(list: OwnReward[]): void {
  OWN.length = 0;
  for (const o of list) OWN.push({ id: o.id, name: o.name, icon: o.icon, tier: o.tier, category: 'own' });
}
export const ownRewards = (): readonly Reward[] => OWN;

/** Every reward that resolves (catalogue, retired and the family's own). */
export const REWARDS: readonly Reward[] = R;
/** What a child can pick from now. */
export const pickable = (): Reward[] => [...R.filter((r) => !r.hidden), ...OWN];
export const rewardById = (id: string): Reward | undefined => R.find((r) => r.id === id) ?? OWN.find((r) => r.id === id);
export const jarOf = (r: Reward): Jar => PRICES[r.tier].jar;

/**
 * How fast rewards come, set by a parent (spec §4): a multiplier on every price in a jar.
 * 1 = the calibrated pace (a small treat about every 10 days, a big toy in about 3 months).
 */
export const PACE: Record<Jar, number> = { treat: 1, goal: 1 };
export function setPace(treat: number, goal: number): void {
  PACE.treat = treat > 0 ? treat : 1;
  PACE.goal = goal > 0 ? goal : 1;
}
/** Price before the parent's pace setting (used for melting, which follows earning speed). */
export const baseCostOf = (r: Reward): number => PRICES[r.tier].coins;
/** Price in coins at the current pace (rounded to 10). */
export const costOf = (r: Reward): number => Math.max(10, Math.round((PRICES[r.tier].coins * PACE[jarOf(r)]) / 10) * 10);

const BASE_DAYS: Record<PriceTier, number> = { small: 7, medium: 14, large: 21, toyS: 30, toyM: 45, toyB: 60, dream: 135 };
/** Rough time to earn a reward when playing daily, e.g. "about 2 weeks". */
export function aboutOf(r: Reward): string {
  const days = BASE_DAYS[r.tier] * PACE[jarOf(r)];
  if (days < 10) return `about ${Math.max(2, Math.round(days))} days`;
  if (days < 26) return `about ${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'}`;
  const m = Math.round((days / 30) * 2) / 2;
  const txt = Number.isInteger(m) ? String(m) : `${Math.floor(m) || ''}½`;
  return `about ${txt} month${m <= 1 ? '' : 's'}`;
}
