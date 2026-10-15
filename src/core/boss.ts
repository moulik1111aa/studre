// Boss fights (spec §5): a state machine the fight screen drives.
// Correct answers attack; every third question the boss attacks and a quick "defend"
// question appears; three phases change which skills are asked.

export type BossSlot = 'mid' | 'final';

export interface BossDef {
  id: string;
  stage: number;
  slot: BossSlot;
  name: string;
  /** One-line taunt on entry. */
  intro: string;
  /** Defeat line. */
  outro: string;
}

export const BOSSES: BossDef[] = [
  { id: 'bubbles', stage: 1, slot: 'mid', name: 'Mr Bubbles', intro: 'Pop! Pop! Can you count my bubbles?', outro: 'Pfffft… *pop*' },
  { id: 'gobble', stage: 1, slot: 'final', name: 'Gobble the Sock Monster', intro: 'I took ALL the socks! Count them if you can!', outro: 'Achoo! Take your socks back…' },
  { id: 'hoot', stage: 2, slot: 'mid', name: 'Professor Hoot', intro: 'Hoo-hoo! Let us test those number facts.', outro: 'Zzz… hoo… zzz…' },
  { id: 'tenbeard', stage: 2, slot: 'final', name: 'Captain Tenbeard', intro: 'Arr! Make ten or walk the plank!', outro: 'Abandon ship! Paddle, paddle!' },
  { id: 'gloop', stage: 3, slot: 'mid', name: 'Gloop the Slime King', intro: 'Bow before the Slime King… and his sums!', outro: 'I’m… melting… my crown!' },
  { id: 'blaze', stage: 3, slot: 'final', name: 'Blaze the Carry Dragon', intro: 'My fireballs carry the ten! Can you?', outro: 'I’m just a little lizard now…' },
  { id: 'crab', stage: 4, slot: 'mid', name: 'Clockwork Crab', intro: 'Tick-tock-SNAP! Times tables, quick!', outro: 'Sproing! Clank… clank…' },
  { id: 'multiplex', stage: 4, slot: 'final', name: 'Robo-Multiplex', intro: 'TWELVE PLATES OF ARMOUR. COMPUTE.', outro: 'ERROR 404: ROBOT NOT FOUND' },
  { id: 'fractio', stage: 5, slot: 'mid', name: 'Chef Fractio', intro: 'Ze pie is sliced! But into how many pieces?', outro: 'Into ze soup I go…' },
  { id: 'pizzawizard', stage: 5, slot: 'final', name: 'The Pizza Wizard', intro: 'Abracada-crust! Fractions or be trapped!', outro: 'Noooo, not the mouse!' },
  { id: 'volt', stage: 6, slot: 'mid', name: 'Volt the Storm Cloud', intro: 'Powers and roots, crackling with lightning!', outro: 'Drip… drip… a rainbow?' },
  { id: 'kraken', stage: 6, slot: 'final', name: 'Kraken of Powers', intro: 'Eight tentacles, eight powers. Solve them all!', outro: 'My tentacles… are tied in a knot…' },
  { id: 'mirror', stage: 7, slot: 'mid', name: 'Mirror Mage', intro: 'Which of you is real? Only the right answer knows.', outro: '*crack* …a thousand sparkles.' },
  { id: 'sensei', stage: 7, slot: 'final', name: 'Shadow Sensei', intro: 'Match my speed, student.', outro: 'You have earned this black belt.' },
];

export const bossFor = (stage: number, slot: BossSlot): BossDef => BOSSES.find((b) => b.stage === stage && b.slot === slot)!;

export const FIGHT = {
  hp: 100,
  hit: 5,
  critical: 8,
  /** Fraction of the time limit under which a hit is critical. */
  criticalUnder: 0.4,
  special: 25,
  streakForSpecial: 5,
  hearts: 3,
  defendEvery: 3,
  phaseAt: [66, 33] as const,
};

export type FightEvent =
  | { type: 'hit'; damage: number; critical: boolean }
  | { type: 'special'; damage: number }
  | { type: 'miss' }
  | { type: 'block' }
  | { type: 'hurt'; hearts: number }
  | { type: 'phase'; phase: number }
  | { type: 'win' }
  | { type: 'lose' };

export class Fight {
  hp = FIGHT.hp;
  hearts = FIGHT.hearts;
  phase = 0;
  streak = 0;
  /** Attack questions since the boss last attacked. */
  sinceDefend = 0;
  status: 'fighting' | 'won' | 'lost' = 'fighting';
  readonly boss: BossDef;

  constructor(boss: BossDef) {
    this.boss = boss;
  }

  /** What the next question is for. */
  get mode(): 'attack' | 'defend' {
    return this.sinceDefend >= FIGHT.defendEvery ? 'defend' : 'attack';
  }

  /** Feed one answer. `fraction` = time used / time allowed (0..1+; ≥1 means it timed out). */
  answer(correct: boolean, fraction: number): FightEvent[] {
    if (this.status !== 'fighting') return [];
    const ev: FightEvent[] = [];
    const inTime = fraction < 1;
    if (this.mode === 'defend') {
      this.sinceDefend = 0;
      if (correct && inTime) ev.push({ type: 'block' });
      else {
        this.hearts--;
        this.streak = 0;
        ev.push({ type: 'hurt', hearts: this.hearts });
        if (this.hearts <= 0) {
          this.status = 'lost';
          ev.push({ type: 'lose' });
        }
      }
      return ev;
    }
    this.sinceDefend++;
    if (!(correct && inTime)) {
      this.streak = 0;
      ev.push({ type: 'miss' });
      return ev;
    }
    this.streak++;
    let damage: number;
    if (this.streak >= FIGHT.streakForSpecial) {
      this.streak = 0;
      damage = FIGHT.special;
      ev.push({ type: 'special', damage });
    } else {
      const critical = fraction < FIGHT.criticalUnder;
      damage = critical ? FIGHT.critical : FIGHT.hit;
      ev.push({ type: 'hit', damage, critical });
    }
    const before = this.hp;
    this.hp = Math.max(0, this.hp - damage);
    for (const [i, at] of FIGHT.phaseAt.entries()) {
      if (before > at && this.hp <= at && this.hp > 0 && this.phase < i + 1) {
        this.phase = i + 1;
        ev.push({ type: 'phase', phase: this.phase });
      }
    }
    if (this.hp <= 0) {
      this.status = 'won';
      ev.push({ type: 'win' });
    }
    return ev;
  }
}

/** Time allowed per fight question: generous for little ones; defend questions get half. */
export function fightTime(speedSec: number, stage: number, mode: 'attack' | 'defend'): number {
  const base = Math.max(6, Math.round(speedSec * (stage <= 2 ? 2 : 1.5)));
  return mode === 'defend' ? Math.max(4, Math.round(base / 2)) : base;
}
