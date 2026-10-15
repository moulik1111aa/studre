// The reward catalogue: 128 picture-card rewards in 12 categories (spec §4).
// Treats go in the treat jar; toys and dream goals in the big goal jar.

export type PriceTier = 'small' | 'medium' | 'large' | 'toyS' | 'toyM' | 'toyB' | 'dream';
export type Jar = 'treat' | 'goal';

export const PRICES: Record<PriceTier, { coins: number; jar: Jar; about: string }> = {
  small: { coins: 350, jar: 'treat', about: 'about 1 week' },
  medium: { coins: 600, jar: 'treat', about: 'about 2 weeks' },
  large: { coins: 900, jar: 'treat', about: 'about 3 weeks' },
  toyS: { coins: 400, jar: 'goal', about: 'about 1 month' },
  toyM: { coins: 550, jar: 'goal', about: 'about 1½ months' },
  toyB: { coins: 700, jar: 'goal', about: 'about 2 months' },
  dream: { coins: 1500, jar: 'goal', about: 'about 4–5 months' },
};

export interface Reward {
  id: string;
  name: string;
  category: string;
  tier: PriceTier;
  /** Emoji used as the drawing's base (rendered large on a styled card). */
  icon: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: 'sweets', name: 'Sweets', icon: '🍬' },
  { id: 'snacks', name: 'Snacks', icon: '🍟' },
  { id: 'drinks', name: 'Drinks', icon: '🥤' },
  { id: 'desserts', name: 'Ice cream & desserts', icon: '🍦' },
  { id: 'meals', name: 'Treat meals', icon: '🍕' },
  { id: 'screen', name: 'Screen time', icon: '📺' },
  { id: 'outings', name: 'Outings', icon: '🎡' },
  { id: 'family', name: 'Family time', icon: '👨‍👩‍👧' },
  { id: 'little', name: 'Little things', icon: '✏️' },
  { id: 'books', name: 'Books & kits', icon: '📚' },
  { id: 'toys', name: 'Toys', icon: '🧸' },
  { id: 'dream', name: 'Dream goals', icon: '🚲' },
];

type Row = [name: string, icon: string];
const R: Reward[] = [];
function group(category: string, tier: PriceTier, rows: Row[]): void {
  for (const [name, icon] of rows) R.push({ id: `${category}.${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, name, category, tier, icon });
}

group('sweets', 'small', [
  ['Milk chocolate bar', '🍫'], ['Chocolate wafer', '🍫'], ['Candy buttons', '🍬'], ['Lollipop', '🍭'], ['Toffees', '🍬'], ['Jelly sweets', '🍬'],
  ['Cotton candy', '🍭'], ['Gulab jamun', '🍮'], ['Jalebi', '🥨'], ['Ladoo', '🟠'], ['Rasgulla', '⚪'], ['Kaju katli', '🔷'],
]);
group('snacks', 'small', [
  ['Chips', '🥔'], ['Nachos', '🌮'], ['Popcorn', '🍿'], ['Masala puffs', '🥐'], ['Samosa', '🥟'], ['Pani puri', '🥣'],
  ['Momos', '🥟'], ['French fries', '🍟'], ['Sandwich', '🥪'], ['Noodles', '🍜'], ['Pav bhaji', '🍛'], ['Vada pav', '🍔'],
]);
group('drinks', 'small', [
  ['Cold drink', '🥤'], ['Mango shake', '🥭'], ['Chocolate milkshake', '🥛'], ['Fresh juice', '🧃'], ['Lassi', '🥛'], ['Coconut water', '🥥'],
  ['Lemonade', '🍋'], ['Iced tea', '🧋'], ['Hot chocolate', '☕'], ['Smoothie', '🍓'],
]);
group('desserts', 'small', [['Ice-cream cone', '🍦'], ['Ice-cream cup', '🍨'], ['Kulfi', '🍡'], ['Ice lolly', '🍧']]);
group('desserts', 'medium', [['Sundae', '🍨'], ['Brownie', '🟫'], ['Cupcake', '🧁'], ['Pastry', '🍰'], ['Doughnut', '🍩'], ['Falooda', '🥤']]);
group('meals', 'medium', [
  ['Pizza night', '🍕'], ['Burger meal', '🍔'], ['Pasta night', '🍝'], ['Dosa outing', '🥞'], ['Pancake breakfast', '🥞'], ['Choose tonight’s dinner', '🍽️'],
  ['Chinese takeaway', '🥡'],
]);
group('meals', 'large', [['Restaurant dinner', '🍽️']]);
group('screen', 'small', [['15 extra minutes of cartoons', '📺'], ['Choose the car music', '🎵']]);
group('screen', 'medium', [['30 extra minutes of cartoons', '📺'], ['30 minutes of video games', '🎮'], ['Pick the family movie', '🎬'], ['Movie night with popcorn', '🍿']]);
group('outings', 'medium', [['Park', '🌳'], ['Playground', '🛝'], ['Cycling ride', '🚴'], ['Picnic', '🧺'], ['Swimming', '🏊'], ['Museum', '🏛️'], ['Fair', '🎡']]);
group('outings', 'large', [['Zoo', '🦁'], ['Aquarium', '🐠'], ['Beach', '🏖️'], ['Trampoline park', '🤸'], ['Bowling', '🎳'], ['Arcade', '🕹️'], ['Cinema', '🎟️']]);
group('family', 'small', [['Extra bedtime story', '📖'], ['Stay up 30 minutes late', '🌙'], ['Board game with Mummy or Papa', '🎲'], ['Paint together', '🎨']]);
group('family', 'medium', [['Bake together', '🧁'], ['Blanket fort', '🏰'], ['Living-room camping', '⛺'], ['Choose the weekend plan', '🗓️'], ['Kite flying', '🪁'], ['Sleepover with a cousin', '🛏️']]);
group('little', 'small', [['Sticker pack', '⭐'], ['Fancy pencil', '✏️'], ['Eraser set', '🧽'], ['Balloons', '🎈'], ['Bubble wand', '🫧'], ['Temporary tattoos', '🦋'], ['Keychain', '🔑'], ['Stamp set', '🔖']]);
group('little', 'medium', [['Colouring book', '📘'], ['Crayons', '🖍️'], ['Sketch pens', '🖊️'], ['Notebook', '📓'], ['Slime', '🟢'], ['Play-dough', '🟣']]);
group('books', 'medium', [['Comic book', '💥'], ['Story book', '📗'], ['Puzzle book', '🧩']]);
group('books', 'large', [['Jigsaw puzzle', '🧩'], ['Science kit', '🔬'], ['Magic kit', '🎩']]);
group('toys', 'toyS', [['Toy car', '🚗'], ['Yo-yo', '🪀'], ['Puzzle cube', '🟥'], ['Skipping rope', '➰'], ['Water gun', '🔫'], ['Football', '⚽'], ['Doll', '🪆']]);
group('toys', 'toyM', [['Action figure', '🦸'], ['Teddy bear', '🧸'], ['Board game', '🎲'], ['Art kit', '🎨'], ['Badminton set', '🏸'], ['Cricket bat', '🏏']]);
group('toys', 'toyB', [
  ['Building-brick set', '🧱'], ['Remote-control car', '🏎️'], ['Train set', '🚂'], ['Toy kitchen', '🍳'], ['Doctor set', '🩺'], ['Dollhouse', '🏠'],
  ['Music keyboard', '🎹'], ['Walkie-talkies', '📻'], ['Roller skates', '⛸️'],
]);
group('dream', 'dream', [['Bicycle', '🚲'], ['Kick scooter', '🛴'], ['Giant brick castle', '🏰'], ['Play tent', '⛺']]);

export const REWARDS: readonly Reward[] = R;
export const rewardById = (id: string): Reward | undefined => R.find((r) => r.id === id);
export const jarOf = (r: Reward): Jar => PRICES[r.tier].jar;

/**
 * How fast rewards come, set by a parent (spec §4): a multiplier on every price in a jar.
 * 1 = the calibrated pace (a small treat about weekly, a big toy in about 2 months).
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
