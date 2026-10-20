// The home map: one world per stage, a winding path of skill nodes (each with its 5 levels),
// minion and boss stops, the treat bar on top and a big Play button for the next level.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS, skillById } from '../core/areas/index.ts';
import { frontier, isDone, isPassed, isSkipped, isPlayable, TIER_NAMES, type Level } from '../core/path.ts';
import { bossFor } from '../core/boss.ts';
import { secondsLeft } from '../core/economy.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { JarBar } from './jars.ts';
import { WORLDS, worldVars } from './worlds.ts';
import { drawOn, stagger, popIn, reducedMotion, EASE_OUT } from '../render/motion.ts';
import { playLevel, timeState } from './flow.ts';
import { questsFor, questUnlocked } from '../core/quest.ts';
import { questScreen } from './quest.ts';
import { timesUpScreen } from './timesup.ts';
import { whosPlayingScreen } from './whos.ts';
import { trophyScreen } from './trophy.ts';
import { BOSS_EMOJI } from './bosses.ts';
import { remember } from '../core/undo.ts';
import { showMapTips } from './tour.ts';

interface Node {
  kind: 'skill' | 'review' | 'boss' | 'quest';
  stage: number;
  levels: Level[];
  label: string;
  id: string;
}

function nodesFor(path: Level[]): Node[] {
  const out: Node[] = [];
  for (const l of path) {
    if (l.kind === 'skill') {
      const last = out[out.length - 1];
      if (last && last.kind === 'skill' && last.id === l.skillId) last.levels.push(l);
      else out.push({ kind: 'skill', stage: l.stage, levels: [l], label: skillById(l.skillId)!.name, id: l.skillId });
    } else if (l.kind === 'review') out.push({ kind: 'review', stage: l.stage, levels: [l], label: 'Minion fight', id: l.id });
    else out.push({ kind: 'boss', stage: l.stage, levels: [l], label: bossFor(l.stage, l.boss).name, id: l.id });
  }
  return out;
}

export function mapScreen(child: Child) {
  return (app: App): Screen => {
    const path = app.path;
    const p = child.progress;
    const quests = questsFor(path);
    const nodes = nodesFor(path).flatMap((n) => {
      if (n.kind !== 'boss') return [n];
      const q = quests.find((x) => x.bossLevelId === n.levels[0].id)!;
      return child.tester || questUnlocked(path, p, q) ? [n, { kind: 'quest' as const, stage: n.stage, levels: [], label: 'Side quest', id: q.id }] : [n];
    });
    const front = frontier(path, p);
    const next = path[front];
    const stagesBuilt = AREAS[0].skills.filter((s) => s.length).length;
    const left = Math.ceil(secondsLeft(child.wallet, app.today, app.save.data.settings.limitMinutes) / 60);
    const limit = app.save.data.settings.limitMinutes;
    const el = html(`<section class="screen map" aria-label="Map">
      <header class="map-top">
        <button class="who" aria-label="Switch child">${avatarHtml(child.avatar, 46)}<span><b>${esc(child.name)}</b><small>${left > 0 ? `${left} min left today` : 'Time’s up for today'}</small></span></button>
        <div class="ring" style="--p:${Math.max(0, Math.min(1, left / limit))}" aria-hidden="true"><span>${Math.max(0, left)}</span></div>
        <button class="icon-btn help-btn" aria-label="How it works">?</button>
        <button class="icon-btn trophy-btn" aria-label="Trophy room">${ICONS.trophy}</button>
      </header>
      <div class="jar-slot"></div>
      <div class="worlds scroll"></div>
      <div class="play-bar">${next ? `<button class="icon-btn skip-btn" aria-label="Skip this level (grown-up)">${ICONS.skip}</button>` : ''}<button class="btn play-next">${next ? `${ICONS.play} ${next.kind === 'skill' ? 'Play' : next.kind === 'boss' ? 'Fight the boss!' : 'Minion fight!'}` : 'All done!'}</button></div>
    </section>`);
    const jar = new JarBar(child);
    el.querySelector('.jar-slot')!.appendChild(jar.el);
    const worlds = el.querySelector<HTMLElement>('.worlds')!;
    let currentNode: HTMLElement | null = null;

    for (let s = 1; s <= stagesBuilt; s++) {
      const info = AREAS[0].stages[s - 1];
      const sec = html(`<section class="world" style="${worldVars(s)}" data-stage="${s}">
        <div class="world-head"><span class="chip">Stage ${s} · Ages ${info.ages}</span><h2>${info.name}</h2><p>${WORLDS[s - 1].name}</p></div>
        <div class="track"><svg class="trail" aria-hidden="true"><path class="trail-bg"/><path class="trail-done"/></svg></div>
      </section>`);
      const track = sec.querySelector<HTMLElement>('.track')!;
      const stageNodes = nodes.filter((n) => n.stage === s);
      let skillNo = 0;
      stageNodes.forEach((n, k) => {
        if (n.kind === 'skill') skillNo++;
        const qbest = n.kind === 'quest' ? (p.questBest?.[n.id] ?? 0) : 0;
        const done = n.kind === 'quest' ? (p.levels[n.id]?.stars ?? 0) > 0 : n.levels.every((l) => isDone(p, l));
        const playable = n.kind === 'quest' || !!child.tester || n.levels.some((l) => isPlayable(path, p, l));
        const skipped = n.kind !== 'quest' && n.levels.every((l) => isSkipped(p, l)) && !n.levels.some((l) => isPassed(p, l));
        const isCurrent = n.levels.some((l) => l.index === front);
        const x = 50 + Math.sin(k * 0.9) * 30;
        const face =
          n.kind === 'boss'
            ? `<span class="nd-face boss">${BOSS_EMOJI[bossFor(s, (n.levels[0] as Extract<Level, { kind: 'boss' }>).boss).id] ?? '👾'}</span>`
            : n.kind === 'review'
              ? `<span class="nd-face minion">⚔️</span>`
              : n.kind === 'quest'
              ? `<span class="nd-face quest">🧭</span>`
              : `<span class="nd-face">${skillNo}</span>`;
        const pips = n.kind === 'skill' ? `<span class="pips">${n.levels.map((l) => `<i class="${isPassed(p, l) ? 'on' : ''}"></i>`).join('')}</span>` : '';
        const node = html(`<button class="node ${n.kind}${done ? ' done' : ''}${skipped ? ' skipped' : ''}${isCurrent ? ' current' : ''}${playable ? '' : ' locked'}" style="left:${x}%" data-node="${esc(n.id)}" aria-label="${esc(n.label)}${done ? ', done' : playable ? '' : ', locked'}">
          ${face}${pips}<span class="nd-label">${esc(n.label)}${n.kind === 'quest' ? `<small>${qbest ? `Best ${qbest}/100` : '100 in 5 min'}</small>` : ''}</span>${playable ? '' : `<span class="nd-lock">${ICONS.lock}</span>`}
        </button>`);
        if (isCurrent) currentNode = node;
        node.addEventListener('click', () => {
          if (!playable) {
            popIn(node, 0, 0.9);
            app.toast('Finish the levels before this one to open it.');
            return;
          }
          if (n.kind === 'quest') {
            if (timeState(app, child) === 'stop') return void app.show(timesUpScreen(child));
            return void app.show(questScreen(child, quests.find((x) => x.id === n.id)!), 'liquid');
          }
          if (n.kind !== 'skill') return playLevel(app, child, n.levels[0]);
          openSkill(app, child, n, path);
        });
        track.appendChild(node);
      });
      worlds.appendChild(sec);
    }
    if (stagesBuilt < 7) worlds.appendChild(html(`<section class="world soon" style="${worldVars(stagesBuilt + 1)}"><div class="world-head"><span class="chip">Stage ${stagesBuilt + 1}</span><h2>${AREAS[0].stages[stagesBuilt].name}</h2><p>Coming soon</p></div></section>`));

    const layoutTrails = () => {
      worlds.querySelectorAll<HTMLElement>('.world .track').forEach((track) => {
        const svg = track.querySelector('svg')!;
        const nodesEl = [...track.querySelectorAll<HTMLElement>('.node')];
        const tr = track.getBoundingClientRect();
        svg.setAttribute('viewBox', `0 0 ${tr.width} ${tr.height}`);
        svg.setAttribute('width', String(tr.width));
        svg.setAttribute('height', String(tr.height));
        const pts = nodesEl.map((n) => {
          const r = n.querySelector('.nd-face')!.getBoundingClientRect();
          return [r.x + r.width / 2 - tr.x, r.y + r.height / 2 - tr.y] as const;
        });
        const d = (list: readonly (readonly [number, number])[]) =>
          list.map(([x, y], i) => {
            if (i === 0) return `M${x},${y}`;
            const [px, py] = list[i - 1];
            const my = (py + y) / 2;
            return `C${px},${my} ${x},${my} ${x},${y}`;
          }).join(' ');
        svg.querySelector('.trail-bg')!.setAttribute('d', d(pts));
        const doneUpTo = nodesEl.findIndex((n) => !n.classList.contains('done'));
        const donePts = pts.slice(0, doneUpTo === -1 ? pts.length : doneUpTo + 1);
        const doneP = svg.querySelector<SVGPathElement>('.trail-done')!;
        doneP.setAttribute('d', donePts.length > 1 ? d(donePts) : '');
        doneP.setAttribute('data-draw', '');
      });
    };

    el.querySelector('.who')!.addEventListener('click', () => void app.show(whosPlayingScreen));
    el.querySelector('.trophy-btn')!.addEventListener('click', () => void app.show(trophyScreen(child)));
    el.querySelector('.help-btn')!.addEventListener('click', () => void showMapTips(app, child, el));
    el.querySelector('.play-next')!.addEventListener('click', () => {
      if (next) playLevel(app, child, next);
    });
    el.querySelector('.skip-btn')?.addEventListener('click', async () => {
      if (!next || !(await app.grownUp('Skip a level'))) return;
      const label = next.kind === 'skill' ? `${skillById(next.skillId)!.name} · ${TIER_NAMES[next.tier]}` : next.kind === 'boss' ? `the boss ${bossFor(next.stage, next.boss).name}` : 'this minion fight';
      const { result } = app.sheet(`<h2>Skip a level?</h2><p>Skip <b>${esc(label)}</b>? ${esc(child.name)} gets no stars or coins for it, and can still play it later from the map.</p>`, [
        { label: 'Skip it', value: true, kind: 'mint' },
        { label: 'Cancel', value: false, kind: 'ghost', back: true },
      ], 'Skip a level');
      if (!(await result)) return;
      app.save.update(() => {
        remember(child, [next.id], Date.now(), app.today);
        (child.progress.skippedLevels ??= {})[next.id] = true;
      });
      app.toast('Level skipped.');
      void app.show(mapScreen(child));
    });

    return {
      el,
      mounted: () => {
        layoutTrails();
        if (currentNode) {
          const cn = currentNode as HTMLElement;
          cn.scrollIntoView({ block: 'center' });
          if (!reducedMotion()) cn.animate([{ transform: 'translateX(-50%) scale(.6)', opacity: 0 }, { transform: 'translateX(-50%) scale(1)', opacity: 1 }], { duration: 700, easing: EASE_OUT });
        }
        const sec = currentNode ? (currentNode as HTMLElement).closest('.world') : null;
        if (sec) void drawOn(sec.querySelector('svg')!, { duration: 1400, fill: false });
        stagger([el.querySelector('.map-top')!, jar.el, el.querySelector('.play-bar')!], { gap: 90 });
        // First visit: Plus shows the child around.
        if (!child.toured) setTimeout(() => el.isConnected && !app.root.querySelector('.overlay') && void showMapTips(app, child, el), reducedMotion() ? 100 : 1100);
      },
    };
  };
}

function openSkill(app: App, child: Child, n: Node, path: Level[]): void {
  const p = child.progress;
  const rows = n.levels
    .map((l) => {
      const playable = !!child.tester || isPlayable(path, p, l);
      const stars = p.levels[l.id]?.stars ?? 0;
      const tier = (l as Extract<Level, { kind: 'skill' }>).tier;
      return `<button class="tier-row${playable ? '' : ' locked'}" data-l="${l.index}" ${playable ? '' : 'disabled'}>
        <span class="tier-n">${tier}</span><span class="tier-name">${TIER_NAMES[tier]}</span>
        <span class="tier-stars">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span>
      </button>`;
    })
    .join('');
  const ov = html(`<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(n.label)}"><div class="sheet skill-sheet" style="${worldVars(n.stage)}">
    <p class="chip">Stage ${n.stage}</p><h2>${esc(n.label)}</h2>
    <label class="toggle-row harder-row"><span><b>🔥 Play it harder</b><small>Same skill, tougher numbers, no hints</small></span><input type="checkbox" role="switch" class="harder"${(child.challenge ?? 0) >= 2 ? ' disabled checked' : ''}></label>
    <div class="tiers">${rows}</div>
    <div class="actions"><button class="btn ghost" data-back>Close</button></div></div></div>`);
  ov.querySelectorAll<HTMLButtonElement>('.tier-row').forEach((b) =>
    b.addEventListener('click', () => {
      const harder = ov.querySelector<HTMLInputElement>('.harder')!.checked && (child.challenge ?? 0) < 2;
      ov.remove();
      playLevel(app, child, path[Number(b.dataset.l)], harder);
    }),
  );
  ov.querySelector('[data-back]')!.addEventListener('click', () => ov.remove());
  app.root.appendChild(ov);
  if (!reducedMotion()) ov.querySelector('.sheet')!.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 480, easing: EASE_OUT });
  stagger(ov.querySelectorAll('.tier-row'), { gap: 60, delay: 150 });
}
