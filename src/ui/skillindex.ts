// Parent area → Skills list: every skill on the road, by stage and branch, with each child's
// stars. Tapping a skill shows an example question, how MN teaches it (the "Show me how"
// lesson, with its other ways), and the child's 5 levels.

import { esc, html, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS } from '../core/areas/index.ts';
import type { Skill } from '../core/skill.ts';
import { isPassed, makeQuestion, skillStars, TIER_NAMES, type Level, type Tier } from '../core/path.ts';
import { createRng } from '../core/rng.ts';
import { BRANCHES, branchInfo, branchOf, type Branch } from '../core/branches.ts';
import { BRANCH_ICON } from './branchicons.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { visualHtml, prettyAnswer } from './visuals.ts';
import { escPrompt } from './answerpad.ts';
import { lessonOf } from '../core/teach/index.ts';
import { showLesson } from './lesson.ts';
import { reducedMotion, EASE_OUT } from '../render/motion.ts';

let branchFilter: Branch | 'all' = 'all';
let query = '';
let childId: string | null = null;

export function skillsIndexScreen(back: (app: App) => Screen) {
  return (app: App): Screen => {
    const kids = app.save.data.children;
    const child: Child | undefined = kids.find((c) => c.id === (childId ?? app.save.data.activeChildId)) ?? kids[0];
    const path = app.agePath;
    const levelsOf = (id: string) => path.filter((l): l is Extract<Level, { kind: 'skill' }> => l.kind === 'skill' && l.skillId === id);
    const stages = AREAS[0].stages;
    const all = AREAS[0].skills;
    const total = all.flat().length;
    const el = html(`<section class="screen parent skill-index" aria-label="Skills list">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Skills list</span><span style="width:50px"></span></header>
      <div class="scroll pa-body">
        <p class="fine si-why">All ${total} skills on the road, in the order a child meets them. Tap one to see an example, how it’s taught, and ${child ? esc(child.name) + '’s' : 'the'} levels.</p>
        ${kids.length > 1 ? `<div class="si-kids" role="radiogroup" aria-label="Show progress for">${kids.map((c) => `<button class="si-kid${c === child ? ' on' : ''}" role="radio" aria-checked="${c === child}" data-kid="${esc(c.id)}">${avatarHtml(c.avatar, 26)}<span>${esc(c.name)}</span></button>`).join('')}</div>` : ''}
        <input class="si-search" type="search" placeholder="Find a skill (e.g. clock, fractions)" aria-label="Find a skill" value="${esc(query)}">
        <div class="si-branches" role="radiogroup" aria-label="Branch of maths">
          <button class="si-br${branchFilter === 'all' ? ' on' : ''}" data-br="all">All</button>
          ${BRANCHES.map((b) => `<button class="si-br${branchFilter === b.id ? ' on' : ''}" data-br="${b.id}"><i class="br-ic br-${b.id}" aria-hidden="true">${BRANCH_ICON[b.id]}</i>${esc(b.name)} <small>${all.flat().filter((s) => branchOf(s.strand) === b.id).length}</small></button>`).join('')}
        </div>
        <div class="si-list"></div>
      </div>
    </section>`);
    const list = el.querySelector<HTMLElement>('.si-list')!;
    const status = (s: Skill): string => {
      if (!child) return '';
      const lv = levelsOf(s.id);
      const passed = lv.filter((l) => isPassed(child.progress, l)).length;
      if (passed === lv.length && lv.length) return `<span class="si-st done">★ ${skillStars(child.progress, lv)}/7</span>`;
      if (passed) return `<span class="si-st part">${passed}/5 steps</span>`;
      if (child.progress.skipped[s.id]) return '<span class="si-st skip">skipped</span>';
      return '';
    };
    const paint = () => {
      const q = query.trim().toLowerCase();
      list.innerHTML = all
        .map((skills, si) => {
          const info = stages[si];
          const shown = skills.map((s, k) => ({ s, k })).filter(({ s }) => (branchFilter === 'all' || branchOf(s.strand) === branchFilter) && (!q || s.name.toLowerCase().includes(q)));
          if (!shown.length) return '';
          const here = child && skills.some((s) => levelsOf(s.id).some((l) => !isPassed(child.progress, l))) && !skills.every((s) => levelsOf(s.id).every((l) => !isPassed(child.progress, l)));
          return `<details class="card si-stage"${q || here || branchFilter !== 'all' ? ' open' : ''}><summary><b>Stage ${info.n} · ${esc(info.name)}</b><small>Ages ${info.ages} · ${shown.length} skill${shown.length === 1 ? '' : 's'}</small></summary>
            <ol class="si-skills">${shown.map(({ s, k }) => { const b = branchOf(s.strand); return `<li><button class="si-skill" data-id="${esc(s.id)}"><span class="si-n">${k + 1}</span><i class="br-ic br-${b}" title="${esc(branchInfo(b).name)}" aria-hidden="true">${BRANCH_ICON[b]}</i><span class="si-name">${esc(s.name)}</span>${status(s)}<span class="si-go" aria-hidden="true">›</span></button></li>`; }).join('')}</ol></details>`;
        })
        .join('') || '<p class="fine">No skills match that.</p>';
    };
    paint();
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(back));
    el.querySelector<HTMLInputElement>('.si-search')!.addEventListener('input', (e) => {
      query = (e.target as HTMLInputElement).value;
      paint();
    });
    el.querySelectorAll<HTMLButtonElement>('.si-br').forEach((b) =>
      b.addEventListener('click', () => {
        branchFilter = b.dataset.br as Branch | 'all';
        el.querySelectorAll('.si-br').forEach((x) => x.classList.toggle('on', x === b));
        paint();
      }),
    );
    el.querySelectorAll<HTMLButtonElement>('.si-kid').forEach((b) =>
      b.addEventListener('click', () => {
        childId = b.dataset.kid!;
        void app.show(skillsIndexScreen(back), 'fade');
      }),
    );
    list.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.si-skill');
      if (!b) return;
      const s = all.flat().find((x) => x.id === b.dataset.id);
      if (s) openSkillDetail(app, s, child, levelsOf(s.id));
    });
    return { el, back: () => (void app.show(back), true) };
  };
}

function openSkillDetail(app: App, s: Skill, child: Child | undefined, levels: Level[]): void {
  const b = branchOf(s.strand);
  const info = AREAS[0].stages[s.stage - 1];
  let seed = 0;
  const example = () => makeQuestion(s, createRng(`index:${s.id}:${seed}`), 0.5, new Set());
  let q = example();
  const ways = (): string[] => {
    try {
      const l = lessonOf(q);
      return [l.method, ...(l.alts?.() ?? []).map((a) => a.method)].filter((x): x is string => !!x);
    } catch {
      return [];
    }
  };
  const stepsOf = () => {
    try {
      return lessonOf(q).steps.length;
    } catch {
      return 0;
    }
  };
  const exampleHtml = () => `<div class="si-ex">${q.visual ? visualHtml(q.visual, q.key) : ''}<p class="si-q">${escPrompt(q.prompt)}</p><p class="si-a">Answer: <b>${prettyAnswer(q.answer)}</b></p></div>
    <p class="fine si-how">${(() => { const w = ways(); return w.length ? `Taught step by step (${stepsOf()} steps): ${w.map(esc).join(', then another way: ')}.` : `Taught step by step (${stepsOf()} steps).`; })()}</p>`;
  const tiers = levels
    .map((l) => {
      const stars = child ? (child.progress.levels[l.id]?.stars ?? 0) : 0;
      const tier = (l as Extract<Level, { kind: 'skill' }>).tier as Tier;
      return `<div class="si-tier"><span>Step ${tier}: ${TIER_NAMES[tier]}</span><span class="si-tstars">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span></div>`;
    })
    .join('');
  const seven = child ? skillStars(child.progress, levels) : 0;
  const ov = html(`<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(s.name)}"><div class="sheet si-sheet">
    <p class="chip"><i class="br-ic br-${b}" aria-hidden="true">${BRANCH_ICON[b]}</i>${esc(branchInfo(b).long)} · Stage ${s.stage} · ages ${info.ages}</p>
    <h2>${esc(s.name)}</h2>
    <div class="si-exwrap">${exampleHtml()}</div>
    <div class="si-btns"><button class="btn small mint si-show">▶ Show me how</button><button class="btn ghost small si-another">Another example</button></div>
    ${child ? `<h3 class="si-h">${esc(child.name)}: ${seven} of 7 stars</h3><div class="si-tiers">${tiers}</div>` : ''}
    <div class="actions"><button class="btn ghost" data-back>Close</button></div></div></div>`);
  ov.querySelector('.si-show')!.addEventListener('click', () => void showLesson(app, q, null));
  ov.querySelector('.si-another')!.addEventListener('click', () => {
    seed++;
    q = example();
    ov.querySelector('.si-exwrap')!.innerHTML = exampleHtml();
  });
  ov.querySelector('[data-back]')!.addEventListener('click', () => ov.remove());
  app.root.appendChild(ov);
  if (!reducedMotion()) ov.querySelector('.sheet')!.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 420, easing: EASE_OUT });
}
