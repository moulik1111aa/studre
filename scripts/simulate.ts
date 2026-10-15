// Economy simulation (spec §4/§10): simulated children play 30 minutes a day for 120 days.
// Checks: levels per day, days to a Small treat, days to a Toy · big.
//   node scripts/simulate.ts
import { freshWallet, addCoins, chooseReward, markGiven, coinsForLevel, addPlayTime, applyMelt, addDays } from '../src/core/economy.ts';
import { REWARDS } from '../src/core/rewards.ts';
import { createRng } from '../src/core/rng.ts';

const LIMIT = 30;
const rng = createRng('simulate');
const choc = REWARDS.find((r) => r.tier === 'small')!;
const bigToy = REWARDS.find((r) => r.tier === 'toyB')!;

interface Kid { name: string; stage: number; secPerQuestion: number; accuracy: number; skipChance: number }
const kids: Kid[] = [
  // seconds per question include reading/listening, answering and the 2–3 s feedback animation
  { name: 'age 4', stage: 1, secPerQuestion: 20, accuracy: 0.8, skipChance: 0.1 },
  { name: 'age 8', stage: 3, secPerQuestion: 15, accuracy: 0.85, skipChance: 0.1 },
  { name: 'age 13', stage: 6, secPerQuestion: 18, accuracy: 0.8, skipChance: 0.1 },
];

let ok = true;
for (const k of kids) {
  const w = freshWallet();
  chooseReward(w, choc.id);
  chooseReward(w, bigToy.id);
  let day = '2026-01-01';
  const treatDays: number[] = [];
  let goalDay = 0;
  let lastTreat = 0;
  let levels = 0;
  let played = 0;
  for (let d = 1; d <= 120; d++) {
    day = addDays(day, 1);
    applyMelt(w, day, false);
    if (rng.chance(k.skipChance)) continue;
    played++;
    let secs = 0;
    // Each level: ~10 questions plus ~30 s of intro/result screens; replay on fail.
    while (secs < LIMIT * 60) {
      const t = 10 * k.secPerQuestion + 30;
      const inside = addPlayTime(w, day, t, LIMIT);
      secs += t;
      if (!inside) break;
      const correct = Array.from({ length: 10 }, () => rng.chance(k.accuracy)).filter(Boolean).length;
      const passed = correct >= 8;
      if (passed) levels++;
      const { unlocked } = addCoins(w, coinsForLevel(levels % 14 === 0 ? 'review' : 'skill', correct / 10, passed, false, k.stage));
      if (unlocked.includes('treat')) {
        treatDays.push(d - lastTreat);
        lastTreat = d;
        markGiven(w, 'treat', day);
        chooseReward(w, choc.id);
      }
      if (unlocked.includes('goal') && !goalDay) goalDay = d;
    }
  }
  const perDay = levels / played;
  const avgTreat = treatDays.reduce((a, b) => a + b, 0) / treatDays.length;
  const pass = perDay >= 5 && perDay <= 10 && avgTreat >= 6 && avgTreat <= 9 && goalDay >= 45 && goalDay <= 75;
  ok &&= pass;
  console.log(`${pass ? '✓' : '✗'} ${k.name}: ${perDay.toFixed(1)} levels/day · treat every ${avgTreat.toFixed(1)} days · big toy on day ${goalDay}`);
}
process.exit(ok ? 0 : 1);
