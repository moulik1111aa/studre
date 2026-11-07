// The home map: one world per stage, a winding path of skill nodes (each with its 5 levels),
// minion and boss stops, the treat bar on top and a big Play button for the next level.

import { catchUp, ROAD_VERSION } from '../core/catchup.ts';
import { schoolLabel } from './school.ts';
import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS, skillById } from '../core/areas/index.ts';
import { frontier, isDone, isPassed, isSkipped, isPlayable, skillStars, TIER_NAMES, type Level } from '../core/path.ts';
import { branchOf, branchInfo } from '../core/branches.ts';
import { BRANCH_ICON } from './branchicons.ts';
import { bossFor } from '../core/boss.ts';
import { secondsLeft } from '../core/economy.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { JarBar } from './jars.ts';
import { WORLDS, worldVars } from './worlds.ts';
import { drawOn, stagger, popIn, reducedMotion, EASE_OUT } from '../render/motion.ts';
import { goHome, playLevel, timeState } from './flow.ts';
import { questsFor, questUnlocked } from '../core/quest.ts';
import { questScreen } from './quest.ts';
import { timesUpScreen } from './timesup.ts';
import { whosPlayingScreen } from './whos.ts';
import { trophyScreen } from './trophy.ts';
import { BOSS_EMOJI } from './bosses.ts';
import { remember } from '../core/undo.ts';
import { showMapTips } from './tour.ts';
import { adventureOn, adventureScreen, outfitFor, questBadge, showAdventureTips, whoLine } from './adventure.ts';
import { advTipsDue } from '../core/adventure.ts';
import { plusFaceSvg } from './plus.ts';
import { mapPetHtml } from './pets.ts';
import { MENU_ICON, openDrawer } from './drawer.ts';
import { parentScreen } from './parent.ts';
import { fixDueFor, startFixit } from './fixit.ts';
import { quietNow, quietScreen } from './quiet.ts';

interface Node {
  kind: 'skill' | 'review' | 'boss' | 'quest';
  stage: number;
  levels: Level[];
  label: string;
  id: string;
}

/** Stops shown past the current one before the clouds (five or six swipes of road). */
const CLOUD_AFTER = 30;
/** How tall the cloud sea below is (px): a few swipes of clouds, so the road is hidden, not cut off. */
const CLOUD_DEPTH = 1700;
const CLOUD_LOCK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 36a9 9 0 0 1-1-17.9A12 12 0 0 1 35 16a8.5 8.5 0 0 1 1 20Z" fill="#fff" stroke="#5B6B8C" stroke-width="2.5" stroke-linejoin="round"/><rect x="19" y="24" width="12" height="10" rx="2.5" fill="#FFB020" stroke="#7A4B00" stroke-width="2"/><path d="M21.5 24v-3a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="#7A4B00" stroke-width="2.2"/></svg>';

function branchFor(n: Node) {
  const l = n.levels[0];
  const sk = l && l.kind === 'skill' ? skillById(l.skillId) : undefined;
  return branchOf(sk?.strand ?? 'number');
}
function branchBadge(n: Node): string {
  if (n.kind !== 'skill') return '';
  const b = branchFor(n);
  return `<i class="br-badge br-${b}" title="${branchInfo(b).name}" aria-hidden="true">${BRANCH_ICON[b]}</i>`;
}
/** Seven star slots in an orb: one in the middle, six round it. */
const ORB_SLOTS: [number, number][] = [[50, 50], [50, 20], [76, 35], [76, 65], [50, 80], [24, 65], [24, 35]];
const STAR = 'M0,-1 L.29,-.4 .95,-.31 .47,.15 .59,.81 0,.5 -.59,.81 -.47,.15 -.95,-.31 -.29,-.4Z';
function orbStars(n: number): string {
  return `<svg class="orb-stars" viewBox="0 0 100 100">${ORB_SLOTS.map(([x, y], i) => `<path class="${i < n ? 'on' : ''}" d="${STAR}" transform="translate(${x} ${y}) scale(${i === 0 ? 14 : 11.5})"/>`).join('')}</svg>`;
}
/**
 * A sea of clouds: a billowing top edge, then rows of soft puffs all the way down. Each puff is
 * lit from above (white on top, a cool shade underneath), with a soft shadow beneath each row.
 */
function cloudSvg(depth: number): string {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let defs = '';
  let body = '';
  let k = 0;
  // One cloud bank: puffs along a line plus smaller ones on its shoulders, all filled with one
  // gradient for the row (lit from above, shaded underneath), so they merge into one shape.
  const bank = (y: number, rMin: number, rMax: number, step: number, light: string, dark: string, soft = false) => {
    const id = `clr${k++}`;
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${(y - rMax - 30).toFixed(0)}" x2="0" y2="${(y + rMax).toFixed(0)}"><stop offset="0" style="stop-color:var(${light})"/><stop offset=".55" style="stop-color:var(${light})"/><stop offset="1" style="stop-color:var(${dark})"/></linearGradient>`;
    let g = `<ellipse class="cl-shade" cx="195" cy="${(y + rMax * 0.7).toFixed(0)}" rx="260" ry="${(rMax * 0.4).toFixed(0)}"/><g fill="url(#${id})"${soft ? ' filter="url(#cl-soft)"' : ''}>`;
    for (let x = -50 + rnd() * 30; x < 450; x += step * (0.7 + rnd() * 0.6)) {
      const r = rMin + rnd() * (rMax - rMin);
      const cy = y + (rnd() - 0.5) * 24;
      g += `<circle cx="${x.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}"/>`;
      if (rnd() < 0.7) g += `<circle cx="${(x + (rnd() - 0.5) * r).toFixed(0)}" cy="${(cy - r * (0.55 + rnd() * 0.25)).toFixed(0)}" r="${(r * (0.42 + rnd() * 0.2)).toFixed(0)}"/>`;
    }
    body += `${g}</g>`;
  };
  // The top edge: a soft far bank, then nearer, bigger ones.
  bank(130, 40, 58, 56, '--cl-b', '--cl-e', true);
  bank(185, 56, 80, 70, '--cl-c', '--cl-d');
  bank(260, 66, 92, 80, '--cl-a', '--cl-d');
  // Below: bank after bank, so there is cloud all the way down.
  for (let y = 370, i = 0; y < depth + 140; y += 110 + rnd() * 30, i++) bank(y, 58, 90, 78, i % 2 ? '--cl-c' : '--cl-a', '--cl-d');
  return `<svg class="cb-svg" viewBox="0 0 390 ${depth}" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
    <defs>${defs}<filter id="cl-soft" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter><filter id="cl-blur" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="12"/></filter></defs>
    <rect class="cl-body" x="-100" y="230" width="590" height="${depth}"/>${body}</svg>`;
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
    if ((child.roadV ?? 1) < ROAD_VERSION) app.save.update(() => catchUp(child, app.agePath));
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
    const adv = adventureOn(child) ? questBadge(app, child) : null;
    // Fix-it: questions like ones missed before, back for another go.
    const fix = fixDueFor(app, child).length;
    // Adventure: Plus walks the map in his outfit, leaving his trail behind.
    const outfit = adv ? outfitFor(child) : {};
    const trailCls = outfit.trail ? ` trail-${outfit.trail}` : '';
    const el = html(`<section class="screen map${trailCls}" aria-label="Map">
      <header class="map-top">
        <button class="icon-btn map-menu" aria-label="Menu">${MENU_ICON}</button>
        <button class="who" aria-label="Switch child (${left > 0 ? `${left} min left today` : 'time’s up for today'})"><span class="who-av">${avatarHtml(child.avatar, 46)}${adv ? mapPetHtml(app, child) : ''}</span><span><b>${esc(child.name)}</b>${adv ? whoLine(child) : `<small>${left > 0 ? `${left} min left` : 'Time’s up'}</small>`}</span></button>
        <div class="ring" style="--p:${Math.max(0, Math.min(1, left / limit))}" aria-hidden="true"><span>${Math.max(0, left)}</span></div>
      </header>
      <div class="jar-slot"></div>
      <div class="worlds scroll"></div>
      <div class="play-bar">${next ? `<button class="icon-btn skip-btn" aria-label="Skip this level (grown-up)">${ICONS.skip}</button>` : ''}<button class="btn play-next">${next ? `${ICONS.play} ${next.kind === 'skill' ? 'Play' : next.kind === 'boss' ? 'Fight the boss!' : 'Minion fight!'}` : 'All done!'}</button>${fix ? `<button class="icon-btn fix-btn" aria-label="Fix-it: ${fix} tricky ${fix === 1 ? 'one' : 'ones'} from before"><span aria-hidden="true">🔧</span><i aria-hidden="true">${fix}</i></button>` : ''}${adv ? `<button class="icon-btn adv-btn${adv.ready ? ' ready' : ''}" aria-label="Quests and badges: ${adv.done} of 3 quests done today"><span aria-hidden="true">${adv.ready ? '🎁' : '📜'}</span><i aria-hidden="true">${adv.done}/3</i>${!adv.raid.claimed ? `<b class="raid-chip" title="${esc(adv.raid.monster.name)}" aria-hidden="true">${adv.raid.monster.icon}</b>` : ''}</button>` : ''}</div>
    </section>`);
    const jar = new JarBar(child);
    el.querySelector('.jar-slot')!.appendChild(jar.el);
    if (outfit.trail === 'rainbow') el.appendChild(html(`<svg class="trail-defs" width="0" height="0" aria-hidden="true"><defs><linearGradient id="mnRainbow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A5A"/><stop offset=".2" stop-color="#FFB13D"/><stop offset=".4" stop-color="#FFE45C"/><stop offset=".6" stop-color="#3DDC84"/><stop offset=".8" stop-color="#3D9BFF"/><stop offset="1" stop-color="#A879FF"/></linearGradient></defs></svg>`));
    const worlds = el.querySelector<HTMLElement>('.worlds')!;
    let currentNode: HTMLElement | null = null;

    const nodeState = (n: Node) => ({
      done: n.kind === 'quest' ? (p.levels[n.id]?.stars ?? 0) > 0 : n.levels.every((l) => isDone(p, l)),
      playable: n.kind === 'quest' || !!child.tester || n.levels.some((l) => isPlayable(path, p, l)),
      skipped: n.kind !== 'quest' && n.levels.every((l) => isSkipped(p, l)) && !n.levels.some((l) => isPassed(p, l)),
      isCurrent: n.levels.some((l) => l.index === front),
    });
    const tapNode = (n: Node, nodeEl: HTMLElement | null) => {
      if (!nodeState(n).playable) {
        if (nodeEl) popIn(nodeEl, 0, 0.9);
        app.toast('Finish the levels before this one to open it.');
        return;
      }
      if (n.kind === 'quest') {
        const quiet = child.tester ? null : quietNow(app);
        if (quiet) return void app.show(quietScreen(child, quiet, () => goHome(app)));
        if (timeState(app, child) === 'stop') return void app.show(timesUpScreen(child));
        return void app.show(questScreen(child, quests.find((x) => x.id === n.id)!), 'liquid');
      }
      if (n.kind !== 'skill') return playLevel(app, child, n.levels[0]);
      openSkill(app, child, n, path);
    };

    const school = child.school?.on ? child.school : null;
    if (school) worlds.appendChild(html(`<div class="school-chip card"><span>📚</span><b>${esc(schoolLabel(school))}</b><small>${school.skills.length} skills chosen by a grown-up</small></div>`));
    // Clouds ahead: the child sees the next few swipes of the road; the rest waits under a
    // cloud bank (grown-up testers see everything).
    const curAt = nodes.findIndex((n) => nodeState(n).isCurrent);
    const lastShown = child.tester || curAt < 0 ? nodes.length - 1 : Math.min(nodes.length - 1, curAt + CLOUD_AFTER);
    const hidden = nodes.length - 1 - lastShown;
    for (let s = 1; s <= stagesBuilt; s++) {
      const info = AREAS[0].stages[s - 1];
      // A school path only shows the stages it uses.
      if (school && !nodes.some((n) => n.stage === s)) continue;
      if (!nodes.some((n, k) => n.stage === s && k <= lastShown)) continue;
      const sec = html(`<section class="world" style="${worldVars(s)}" data-stage="${s}">
        <div class="world-head"><span class="chip">Stage ${s} · Ages ${info.ages}</span><h2>${info.name}</h2><p>${WORLDS[s - 1].name}</p></div>
        <div class="track"><svg class="trail" aria-hidden="true"><path class="trail-bg"/><path class="trail-done"/></svg></div>
      </section>`);
      const track = sec.querySelector<HTMLElement>('.track')!;
      const stageNodes = nodes.filter((n, k) => n.stage === s && k <= lastShown);
      let skillNo = 0;
      stageNodes.forEach((n, k) => {
        if (n.kind === 'skill') skillNo++;
        const qbest = n.kind === 'quest' ? (p.questBest?.[n.id] ?? 0) : 0;
        const { done, playable, skipped, isCurrent } = nodeState(n);
        const x = 50 + Math.sin(k * 0.9) * 30;
        const face =
          n.kind === 'boss'
            ? `<span class="nd-face boss">${BOSS_EMOJI[bossFor(s, (n.levels[0] as Extract<Level, { kind: 'boss' }>).boss).id] ?? '👾'}</span>`
            : n.kind === 'review'
              ? `<span class="nd-face minion">⚔️</span>`
              : n.kind === 'quest'
              ? `<span class="nd-face quest">🧭</span>`
              : `<span class="nd-face">${skillNo}${branchBadge(n)}</span>`;
        // A finished skill becomes an orb holding its stars out of 7 (no number on it).
        const orb = n.kind === 'skill' && n.levels.every((l) => isPassed(p, l));
        const stars = orb ? skillStars(p, n.levels) : 0;
        const faceHtml = orb ? `<span class="nd-face orb" aria-hidden="true">${orbStars(stars)}</span>` : face;
        const pips = n.kind === 'skill' && !orb ? `<span class="pips">${n.levels.map((l) => `<i class="${isPassed(p, l) ? 'on' : ''}"></i>`).join('')}</span>` : '';
        const br = n.kind === 'skill' ? branchFor(n) : null;
        const node = html(`<button class="node ${n.kind}${done ? ' done' : ''}${orb ? ' orbed' : ''}${skipped ? ' skipped' : ''}${isCurrent ? ' current' : ''}${playable ? '' : ' locked'}" style="left:${x}%" data-node="${esc(n.id)}"${br ? ` data-br="${br}"` : ''} aria-label="${esc(n.label)}${orb ? `, ${stars} of 7 stars` : done ? ', done' : playable ? '' : ', locked'}">
          ${faceHtml}${pips}<span class="nd-label">${orb && br ? `<i class="br-ic br-${br}" aria-hidden="true">${BRANCH_ICON[br]}</i>` : ''}${esc(n.label)}${n.kind === 'quest' ? `<small>${qbest ? `Best ${qbest}/100` : '100 in 5 min'}</small>` : ''}</span>${playable ? '' : `<span class="nd-lock">${ICONS.lock}</span>`}
        </button>`);
        if (isCurrent) currentNode = node;
        if (isCurrent && adv) node.appendChild(html(`<span class="map-buddy ${x < 50 ? 'right' : 'left'}" aria-hidden="true">${plusFaceSvg({ cls: 'alive', outfit })}</span>`));
        node.addEventListener('click', () => tapNode(n, node));
        track.appendChild(node);
      });
      worlds.appendChild(sec);
    }
    if (hidden > 0) {
      worlds.appendChild(html(`<section class="cloudbank" style="height:${CLOUD_DEPTH}px" aria-label="More stops are hidden in the clouds">${cloudSvg(CLOUD_DEPTH)}</section>`));
    }
    if (hidden <= 0 && stagesBuilt < 7 && !school) worlds.appendChild(html(`<section class="world soon" style="${worldVars(stagesBuilt + 1)}"><div class="world-head"><span class="chip">Stage ${stagesBuilt + 1}</span><h2>${AREAS[0].stages[stagesBuilt].name}</h2><p>Coming soon</p></div></section>`));

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
    // ☰: the child's menu, like a game's (the grown-ups' area sits behind the grown-up check).
    el.querySelector('.map-menu')!.addEventListener('click', () =>
      void openDrawer(app, {
        title: child.name,
        sub: adv ? undefined : `${Math.max(0, left)} min left today`,
        badge: avatarHtml(child.avatar, 44),
        items: [
          { id: 'map', icon: '🗺️', label: 'Map', current: true, onPick: () => undefined },
          ...(adv ? [{ id: 'adventure', icon: '🎮', label: 'Adventure', note: 'Quests, badges, wardrobe and your pet', onPick: () => void app.show(adventureScreen(child)) }] : []),
          { id: 'trophies', icon: '🏆', label: 'Trophy room', note: 'Rewards you’ve won', onPick: () => void app.show(trophyScreen(child)) },
          { id: 'tips', icon: '❓', label: 'How it works', note: 'Plus shows you around', onPick: () => void showMapTips(app, child, el) },
          { id: 'switch', icon: '👧', label: 'Switch child', onPick: () => void app.show(whosPlayingScreen) },
          { heading: 'Grown-ups' },
          { id: 'parent', icon: '🔒', label: 'Parent area', note: 'Settings, reports and backups', onPick: async () => (await app.grownUp('Parent area')) && void app.show(parentScreen) },
        ],
      }),
    );
    el.querySelector('.adv-btn')?.addEventListener('click', () => void app.show(adventureScreen(child)));
    el.querySelector('.fix-btn')?.addEventListener('click', () => startFixit(app, child));
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

    const showTips = () => {
      if (!el.isConnected || app.root.querySelector('.overlay')) return;
      // First visit: Plus shows the child around. Adventure: its own tips, after a few levels.
      if (!child.toured) void showMapTips(app, child, el);
      else if (advTipsDue(child)) void showAdventureTips(app, child, el, 'map');
    };
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
        if (!child.toured || advTipsDue(child)) setTimeout(showTips, reducedMotion() ? 100 : 1100);
        // Scrolling into the clouds: say what they are, once per visit.
        const bank = el.querySelector<HTMLElement>('.cloudbank');
        if (bank && 'IntersectionObserver' in window) {
          const io = new IntersectionObserver((es) => {
            if (!es.some((e) => e.isIntersecting)) return;
            io.disconnect();
            const pop = html(`<div class="cloud-pop" role="status"><div class="cp-ic">${CLOUD_LOCK}</div><div><b>More stops are in the clouds</b><span>Finish the stops above and the clouds will move to show new ones.</span></div></div>`);
            el.appendChild(pop);
            pop.addEventListener('click', () => pop.remove());
            setTimeout(() => {
              if (reducedMotion()) pop.remove();
              else pop.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(16px)' }], { duration: 300, fill: 'forwards' }).finished.then(() => pop.remove());
            }, 4200);
          }, { root: worlds, rootMargin: '0px 0px -40% 0px', threshold: 0 });
          io.observe(bank);
        }
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
    <div class="sk-stars" aria-label="${skillStars(child.progress, n.levels)} of 7 stars">${Array.from({ length: 7 }, (_, i) => `<i class="${i < skillStars(child.progress, n.levels) ? 'on' : ''}">${ICONS.star}</i>`).join('')}<small>${skillStars(child.progress, n.levels)} of 7 stars</small></div>
    <p class="fine sk-stars-how">Pass all 5 levels for 5 stars. Get 3 stars on Learn, Practice and Practise more for one more, and on Speed and Master for the last one.</p>
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
