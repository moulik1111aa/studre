// The treat bar and big goal jar, pinned to the top of every child screen (spec §4, §8).

import { html } from './app.ts';
import type { Child } from '../storage/save.ts';
import { jarProgress } from '../core/economy.ts';
import { rewardById, costOf } from '../core/rewards.ts';
import { reducedMotion, EASE_OUT } from '../render/motion.ts';

export class JarBar {
  readonly el: HTMLElement;
  private child: Child;
  private lastTreat = -1;
  private lastGoal = -1;

  constructor(child: Child) {
    this.child = child;
    this.el = html(`<div class="jarbar" role="group" aria-label="Rewards">
      <div class="treat" role="progressbar" aria-valuemin="0" aria-valuemax="100">
        <span class="tr-icon" aria-hidden="true"></span>
        <div class="tr-track"><div class="tr-fill"><span class="tr-glint"></span></div></div>
        <span class="tr-pct"></span>
      </div>
      <div class="goal" role="progressbar" aria-valuemin="0" aria-valuemax="100" title="Big goal">
        <svg class="goal-jar" viewBox="0 0 40 48" aria-hidden="true">
          <defs><clipPath id="jarclip"><path d="M9 10 h22 v4 c4 3 6 7 6 12 v12 c0 5-4 8-9 8 H12 c-5 0-9-3-9-8 V26 c0-5 2-9 6-12 z"/></clipPath></defs>
          <g clip-path="url(#jarclip)">
            <rect class="goal-liquid" x="0" y="48" width="40" height="48" fill="url(#goalgrad)"/>
            <circle class="bub b1" cx="14" cy="44" r="1.6" fill="#fff" opacity=".7"/>
            <circle class="bub b2" cx="24" cy="44" r="1.2" fill="#fff" opacity=".6"/>
            <circle class="bub b3" cx="30" cy="44" r="1.4" fill="#fff" opacity=".5"/>
          </g>
          <defs><linearGradient id="goalgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9A6FF"/><stop offset="1" stop-color="#7B4BFF"/></linearGradient></defs>
          <path d="M9 10 h22 v4 c4 3 6 7 6 12 v12 c0 5-4 8-9 8 H12 c-5 0-9-3-9-8 V26 c0-5 2-9 6-12 z" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2"/>
          <rect x="7" y="4" width="26" height="7" rx="3" fill="#fff" fill-opacity=".9"/>
        </svg>
        <span class="goal-icon" aria-hidden="true"></span>
      </div>
    </div>`);
    this.update(false);
  }

  /** Re-read the child's jars and animate to the new levels. */
  update(animate = true): void {
    const w = this.child.wallet;
    const t = this.el.querySelector<HTMLElement>('.treat')!;
    const tr = w.treat.rewardId ? rewardById(w.treat.rewardId) : undefined;
    const tp = jarProgress(w.treat);
    t.querySelector('.tr-icon')!.textContent = tr?.icon ?? '🎁';
    t.querySelector('.tr-pct')!.textContent = tr ? `${Math.floor(tp * 100)}%` : 'Pick a treat';
    t.setAttribute('aria-valuenow', String(Math.floor(tp * 100)));
    t.setAttribute('aria-label', tr ? `${tr.name}: ${Math.floor(tp * 100)} percent, ${Math.floor(w.treat.coins)} of ${costOf(tr)} coins` : 'No treat chosen');
    t.classList.toggle('ready', w.treat.waiting);
    const fill = t.querySelector<HTMLElement>('.tr-fill')!;
    const to = `${Math.max(3, tp * 100)}%`;
    if (animate && !reducedMotion() && this.lastTreat >= 0 && this.lastTreat !== tp) {
      fill.animate([{ width: `${Math.max(3, this.lastTreat * 100)}%` }, { width: to }], { duration: 900, easing: EASE_OUT });
    }
    fill.style.width = to;
    this.lastTreat = tp;

    const g = this.el.querySelector<HTMLElement>('.goal')!;
    const gr = w.goal.rewardId ? rewardById(w.goal.rewardId) : undefined;
    const gp = jarProgress(w.goal);
    g.querySelector('.goal-icon')!.textContent = gr?.icon ?? '🧸';
    g.setAttribute('aria-valuenow', String(Math.floor(gp * 100)));
    g.setAttribute('aria-label', gr ? `Big goal ${gr.name}: ${Math.floor(gp * 100)} percent` : 'No big goal chosen');
    const liquid = g.querySelector<SVGRectElement>('.goal-liquid')!;
    const y = 46 - gp * 36;
    if (animate && !reducedMotion() && this.lastGoal >= 0) liquid.animate([{ transform: `translateY(${46 - this.lastGoal * 36 - 48}px)` }, { transform: `translateY(${y - 48}px)` }], { duration: 900, easing: EASE_OUT });
    liquid.style.transform = `translateY(${y - 48}px)`;
    this.lastGoal = gp;
  }

  /** Screen point where flying coins should land. */
  target(): DOMRect {
    return this.el.querySelector('.tr-track')!.getBoundingClientRect();
  }
}
