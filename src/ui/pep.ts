// Plus talks to the child: a short line before a level (welcome back, last time's score, a
// streak, the jar, a retry, or just a bit of chat) and a pep talk after a low score.
// Lines are picked from what the child actually did, so it feels like someone is with them.

import { FACTS } from '../core/facts/index.ts';
import { html, esc, type App } from './app.ts';
import type { Child } from '../storage/save.ts';
import type { Level } from '../core/path.ts';
import { skillById } from '../core/areas/index.ts';
import { rewardById, costOf } from '../core/rewards.ts';
import { dayDiff, addDays } from '../core/economy.ts';
import { plusFaceSvg, type Outfit } from './plus.ts';

export function levelName(level: Level): string {
  if (level.kind === 'skill') return skillById(level.skillId)?.name ?? 'that level';
  if (level.kind === 'review') return 'the review';
  return 'the boss';
}

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Days in a row the child has played, ending today or yesterday. */
function streak(child: Child, today: string): number {
  const days = child.stats.secondsByDay;
  let d = days[today] ? today : addDays(today, -1);
  let n = 0;
  while (days[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

const FACT_OPENERS = ['Fun fact!', 'Did you know?', 'Plus fact!', 'Here’s a cool one:', 'Guess what?'];

const CHAT = [
  'Fun fact: a day has 86,400 seconds. Let’s make a few of them count!',
  'Did you know? Bees build their honeycomb out of hexagons, shapes with 6 sides.',
  'I tried counting the stars last night. I got to 3 and fell asleep.',
  'Fun fact: zero was invented after the other numbers. It’s the newest one!',
  'Did you know? An octopus has 8 arms. That’s a lot of high fives.',
  'My favourite number is 8. It looks like a snowman!',
  'Fun fact: if you fold a paper in half 7 times, it has 128 layers.',
  'I did a little warm-up dance. Your turn: shake out those fingers!',
  'Did you know? A pizza cut into 8 slices is the same as 4 slices cut in half.',
  'Plus fact: put me on my side and I become a times sign. Two jobs!',
  'Fun fact: a spider has 8 legs, and 8 + 8 is 16 shoes it would need.',
  'Did you know? The word “hundred” used to mean 120 in old English.',
];
const GO = ['You’ve got this!', 'Let’s do it!', 'Ready? Let’s go!', 'Nice and steady. You can do it!', 'Show me what you know!'];

/** Plus's line before a level, or null to stay quiet this time (so it's not every level). */
export function lineBeforeLevel(child: Child, level: Level, today: string): string | null {
  const name = esc(child.name);
  const last = child.lastPlay;
  const playedToday = !!child.stats.secondsByDay[today];
  // Trying again after not passing.
  if (last && last.levelId === level.id && last.stars === 0) {
    return pick([
      `Round two! Last time you got ${last.score} out of ${last.total}. I know you can beat that.`,
      `Back for another go? That’s what champions do. Take your time on each one.`,
      `You were so close last time, ${name}. Slow and careful wins this one!`,
    ]);
  }
  // First level today: welcome back, with something from last time.
  if (!playedToday && last) {
    const gap = dayDiff(last.day, today);
    const days = streak(child, today);
    if (gap >= 3) return `I missed you, ${name}! It’s been ${gap} days. Let’s warm up together.`;
    if (days >= 2) return `${days + 1} days in a row, ${name}! You’re on fire 🔥 Let’s keep it going.`;
    if (last.stars === 3) return `Welcome back, ${name}! Last time you got ${last.score} out of ${last.total} on ${esc(last.name)}. Amazing! Let’s do it again.`;
    return `Welcome back, ${name}! Last time you practised ${esc(last.name)} and got ${last.score} right. Let’s beat it today!`;
  }
  if (!last) return `Hi ${name}! I’m Plus. I’ll be right here with you. ${pick(GO)}`;
  // Otherwise, now and then: the jar, a boss, or a bit of chat.
  if (Math.random() < 0.45) return null;
  const jar = child.wallet.treat;
  const reward = jar.rewardId ? rewardById(jar.rewardId) : null;
  const pct = reward ? Math.floor((100 * jar.coins) / costOf(reward)) : 0;
  // Mostly a fun fact from the big list (science, nature, space…), sometimes Plus's own chat.
  if (Math.random() < 0.6) return `${pick(FACT_OPENERS)} ${esc(pick(FACTS))}`;
  const options: string[] = [...CHAT, ...CHAT];
  if (reward && pct >= 50 && pct < 100) options.push(`Your ${esc(reward.name.toLowerCase())} jar is ${pct}% full! Perfect scores fill it fastest.`);
  if (level.kind !== 'skill') options.push(`A big one! Remember: read each question twice. ${pick(GO)}`);
  if (last.stars === 3) options.push(`That last one was perfect. Can you do it twice in a row?`);
  const pet = child.adventure?.on ? child.adventure.pet : undefined;
  if (pet) options.push(`${esc(pet.name)} is proud of you! Let’s make ${esc(pet.name)} grow.`, `${esc(pet.name)} is watching. Show ${esc(pet.name)} your best maths!`);
  return pick(options);
}

/** Plus's pep talk after a level that wasn't passed. */
export function lineAfterMiss(child: Child, score: number, total: number): string {
  const name = esc(child.name);
  return pick([
    `Don’t give up, ${name}! ${score} out of ${total} is a start. Try again and you’ll get even more.`,
    `Every mistake teaches your brain something. Let’s try that one more time!`,
    `So close! Take it slowly this time. I’ll be cheering for you.`,
    `Tricky one! Even I get them wrong sometimes. Let’s have another go.`,
    ...(child.adventure?.on && child.adventure.pet ? [`${esc(child.adventure.pet.name)} believes in you! One more try.`] : []),
  ]);
}

/** Plus pops up with a speech bubble. Resolves when it closes (tap, or after a few seconds). */
export function plusSays(app: App, text: string, ms = 4200, outfit?: Outfit): Promise<void> {
  const el = html(`<div class="plus-says" role="status"><span class="ps-plus">${plusFaceSvg({ cls: 'alive', outfit })}</span><p class="ps-text">${text}</p><button class="ps-ok">OK!</button></div>`);
  // Lives on the current screen, so it goes away with it.
  (app.screen?.el ?? document.getElementById('app')!).appendChild(el);
  app.voice.say(el.querySelector('.ps-text')!.textContent ?? '');
  return new Promise((resolve) => {
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
      resolve();
    };
    const t = setTimeout(close, ms + text.length * 25);
    el.addEventListener('click', close);
  });
}
