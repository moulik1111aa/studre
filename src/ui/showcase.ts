// Every few levels: a big, celebratory look at both rewards — how full each jar is, how many
// perfect levels are left, and how much more a perfect score pays than a scraped pass.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { jarProgress, coinsForLevel, SCORE_MULT, TREAT_SHARE } from '../core/economy.ts';
import { rewardById, costOf, type Reward } from '../core/rewards.ts';
import { coinSvg } from './icons.ts';
import { countUp, stagger, wait, reducedMotion, EASE_OUT } from '../render/motion.ts';

/** How many levels after which the big progress screen appears. */
export const SHOWCASE_EVERY = 3;

export function showcaseScreen(child: Child, stage: number, then: () => void) {
  return (app: App): Screen => {
    const w = child.wallet;
    const treat = w.treat.rewardId ? rewardById(w.treat.rewardId) : undefined;
    const goal = w.goal.rewardId ? rewardById(w.goal.rewardId) : undefined;
    const perfect = coinsForLevel('skill', 1, true, false, stage);
    const toGo = (r: Reward | undefined, coins: number, share: number) => (r ? Math.max(0, Math.ceil((costOf(r) - coins) / (perfect * share))) : 0);
    const tp = jarProgress(w.treat);
    const gp = jarProgress(w.goal);
    const ladder = SCORE_MULT.slice(0, 4).map(([at]) => {
      const c = coinsForLevel('skill', at, true, false, stage);
      return `<div class="sc-rung"><span>${at >= 1 ? '10/10 💯' : `${Math.round(at * 10)}/10`}</span><i style="--w:${Math.max(6, (100 * c) / perfect)}%"></i><b>${coinSvg}+${c}</b></div>`;
    }).join('');
    const el = html(`<section class="screen showcase" aria-label="Your rewards">
      <div class="sc-glow" aria-hidden="true"></div>
      <h1 class="title center">Look how far you’ve come, ${esc(child.name)}!</h1>
      ${treat ? `<div class="card sc-card">
        <div class="sc-head"><span class="sc-icon">${treat.icon}</span><div><small>Your treat</small><b>${esc(treat.name)}</b></div><span class="sc-pct" data-to="${Math.floor(tp * 100)}">0%</span></div>
        <div class="sc-bar"><i style="--to:${Math.max(3, tp * 100)}%"></i></div>
        <p class="sc-note">${Math.floor(w.treat.coins)} of ${costOf(treat)} coins · about <b>${toGo(treat, w.treat.coins, TREAT_SHARE)}</b> perfect levels to go</p>
      </div>` : ''}
      ${goal ? `<div class="card sc-card goal">
        <div class="sc-head"><span class="sc-icon">${goal.icon}</span><div><small>Big goal</small><b>${esc(goal.name)}</b></div><span class="sc-pct" data-to="${Math.floor(gp * 100)}">0%</span></div>
        <div class="sc-bar"><i style="--to:${Math.max(3, gp * 100)}%"></i></div>
        <p class="sc-note">Saving up slowly · about <b>${toGo(goal, w.goal.coins, 1 - TREAT_SHARE)}</b> perfect levels to go</p>
      </div>` : ''}
      <div class="card sc-ladder"><p><b>Perfect scores fill it fastest!</b></p>${ladder}</div>
      <button class="btn sc-go">Keep going!</button>
    </section>`);
    el.querySelector('.sc-go')!.addEventListener('click', then);
    return {
      el,
      mounted: async () => {
        stagger(el.querySelectorAll('.title, .sc-card, .sc-ladder, .sc-go'), { gap: 140 });
        app.sfx.whoosh();
        await wait(reducedMotion() ? 0 : 450);
        el.querySelectorAll<HTMLElement>('.sc-bar i').forEach((bar, k) => {
          const to = bar.style.getPropertyValue('--to');
          if (reducedMotion()) bar.style.width = to;
          else bar.animate([{ width: '0%' }, { width: to }], { duration: 1400, delay: k * 300, easing: EASE_OUT, fill: 'forwards' });
        });
        el.querySelectorAll<HTMLElement>('.sc-pct').forEach((p, k) => setTimeout(() => countUp(p, 0, Number(p.dataset.to), 1300, (n) => `${Math.round(n)}%`), k * 300));
        el.querySelectorAll<HTMLElement>('.sc-rung i').forEach((r, k) => {
          if (!reducedMotion()) r.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 700, delay: 900 + k * 120, easing: EASE_OUT, fill: 'backwards' });
        });
        await wait(1500);
        const c = el.querySelector('.sc-card')?.getBoundingClientRect();
        if (c) app.fx.sparkle(c.x + c.width * Math.min(0.95, 0.05 + tp), c.y + c.height * 0.55, 16);
      },
    };
  };
}
