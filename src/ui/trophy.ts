// Trophy room: defeated bosses, skill badges per stage, rewards earned.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { BOSSES } from '../core/boss.ts';
import { AREAS } from '../core/areas/index.ts';
import { isMastered } from '../core/path.ts';
import { rewardById } from '../core/rewards.ts';
import { ICONS } from './icons.ts';
import { BOSS_EMOJI } from './bosses.ts';
import { stagger } from '../render/motion.ts';
import { goHome } from './flow.ts';

export function trophyScreen(child: Child) {
  return (app: App): Screen => {
    const built = AREAS[0].skills.filter((s) => s.length);
    const el = html(`<section class="screen trophy" aria-label="Trophy room">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Trophy room</span><span style="width:50px"></span></header>
      <div class="scroll pa-body">
        <h2 class="pa-h">Defeated bosses</h2>
        <div class="boss-grid">${BOSSES.map((b) => {
          const beaten = child.bossesBeaten.includes(b.id);
          return `<div class="boss-tile card${beaten ? ' beaten' : ''}"><span class="be">${beaten ? BOSS_EMOJI[b.id] : '❔'}</span><b>${beaten ? esc(b.name) : '???'}</b><small>Stage ${b.stage}</small></div>`;
        }).join('')}</div>
        <h2 class="pa-h">Skill badges</h2>
        ${built.map((skills, i) => `<div class="card badge-stage"><b>Stage ${i + 1} · ${AREAS[0].stages[i].name}</b><div class="badges">${skills.map((s) => `<span class="badge${isMastered(child.progress, s.id) ? ' on' : ''}" title="${esc(s.name)}">${ICONS.star}</span>`).join('')}</div></div>`).join('')}
        <h2 class="pa-h">Rewards earned</h2>
        <div class="earned">${child.wallet.earned.map((e) => `<span class="earned-r card">${rewardById(e.rewardId)?.icon ?? '🎁'}<small>${esc(rewardById(e.rewardId)?.name ?? '')}</small></span>`).join('') || '<p class="subtitle">Your rewards will appear here.</p>'}</div>
      </div>
    </section>`);
    el.querySelector('.back-btn')!.addEventListener('click', () => goHome(app));
    return { el, mounted: () => stagger(el.querySelectorAll('.boss-tile, .badge-stage, .earned-r'), { gap: 30 }) };
  };
}
