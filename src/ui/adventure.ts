// Adventure mode screens: the child's player level and rank, today's quests with the daily
// chest, the weekly challenge with its chest, the week's flames, and the badge collection.
// Also the "+XP / quest done / new badge" news on the result screen, the level-up moment, and
// the quests button and level line on the map. A parent turns it on per child.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS, skillById } from '../core/areas/index.ts';
import { frontier } from '../core/path.ts';
import { addCoins, coinsForLevel } from '../core/economy.ts';
import { remember } from '../core/undo.ts';
import { streaks } from '../core/stats.ts';
import {
  BADGES,
  awardBadges,
  chestCoins,
  claimChest,
  dailyQuests,
  freshAdventure,
  questStreak,
  status,
  tidy,
  weekDays,
  weekStart,
  weeklyChallenge,
  XP,
  RANKS,
  levelOf,
  nextRank,
  rankOf,
  xpOf,
  type Badge,
  type BadgeContext,
  type LevelInfo,
  type QuestStatus,
} from '../core/adventure.ts';
import { plusSvg } from './plus.ts';
import { ICONS } from './icons.ts';
import { goHome } from './flow.ts';
import { unlockScreen } from './unlock.ts';
import { popIn, stagger, reducedMotion, wait, EASE_SPRING } from '../render/motion.ts';

export const adventureOn = (c: Child): boolean => !!c.adventure?.on;

export function badgeContext(app: App, c: Child): BadgeContext {
  const skillIds = AREAS[0].skills.flat().map((s) => s.id);
  return { c, today: app.today, path: app.pathFor(c), strandOf: (id) => skillById(id)?.strand, skillIds };
}

export const levelInfo = (c: Child): LevelInfo => levelOf(xpOf(c));
const pctOf = (L: LevelInfo) => (L.need ? Math.min(100, (100 * L.into) / L.need) : 100);

/** Parent area: switch Adventure on or off for one child. Badges already earned are kept. */
export function toggleAdventure(app: App, c: Child): boolean {
  app.save.update(() => {
    if (!c.adventure) {
      c.adventure = freshAdventure();
      // Badges for what they had already done before Adventure (time 1 = "before Adventure").
      awardBadges(badgeContext(app, c), 1);
    } else c.adventure.on = !c.adventure.on;
    // Past play already counts: they start at their level, without a pile of level-ups.
    if (c.adventure.on) {
      const L = levelInfo(c);
      c.adventure.seenLevel = Math.max(c.adventure.seenLevel ?? 0, L.level);
      c.adventure.xpSeen = L.xp;
    }
  });
  return !!c.adventure?.on;
}

/** Map: the line under the child's name: rank, level and a thin XP bar. */
export function whoLine(c: Child): string {
  const L = levelInfo(c);
  const r = rankOf(L.level);
  return `<small class="who-lv">${r.icon} Lv ${L.level} · ${esc(r.short)}</small><i class="who-xp" aria-hidden="true"><b style="width:${pctOf(L)}%"></b></i>`;
}

const limitOf = (app: App) => app.save.data.settings.limitMinutes;
const todayQuests = (app: App, c: Child): QuestStatus[] => dailyQuests(c, app.today, limitOf(app)).map((q) => status(c, q, [app.today]));
const weekQuest = (app: App, c: Child): QuestStatus => status(c, weeklyChallenge(c, app.today), weekDays(app.today));
const dailyKey = (app: App) => `d:${app.today}`;
const weekKey = (app: App) => `w:${weekStart(app.today)}`;

/** Coins in a chest, from the child's current stage. */
function chestFor(app: App, c: Child, kind: 'daily' | 'weekly'): number {
  const path = app.pathFor(c);
  const stage = path[frontier(path, c.progress)]?.stage ?? path[path.length - 1]?.stage ?? 3;
  return chestCoins(coinsForLevel('skill', 1, true, false, stage), kind);
}

/** For the map button: quests done today, and whether a chest is waiting. */
export function questBadge(app: App, c: Child): { done: number; ready: boolean } {
  const qs = todayQuests(app, c);
  const done = qs.filter((q) => q.done).length;
  const a = c.adventure!;
  const ready = (done === qs.length && !a.claimed[dailyKey(app)]) || (weekQuest(app, c).done && !a.claimed[weekKey(app)]);
  return { done, ready };
}

/** After a level: new badges are saved, and quests finished since the last look are listed. */
export function adventureNews(app: App, c: Child): string {
  if (!c.adventure?.on) return '';
  const a = c.adventure;
  const qs = todayQuests(app, c);
  const seen = new Set(a.cheered[app.today] ?? []);
  const fresh = qs.filter((q) => q.done && !seen.has(q.quest.id));
  const week = weekQuest(app, c);
  const weekFresh = week.done && !seen.has(week.quest.id);
  let got: Badge[] = [];
  let before = 0;
  let after = 0;
  app.save.update(() => {
    got = awardBadges(badgeContext(app, c), Date.now());
    a.cheered[app.today] = [...seen, ...fresh.map((q) => q.quest.id), ...(weekFresh ? [week.quest.id] : [])];
    tidy(a, app.today);
    after = xpOf(c);
    before = Math.min(a.xpSeen ?? after, after);
    a.xpSeen = after;
  });
  const xpRow = xpRowHtml(before, after);
  const lines: string[] = [];
  for (const q of fresh) lines.push(`<li><span>${q.quest.icon}</span><p><b>Quest done!</b> ${esc(q.quest.text)}</p></li>`);
  if (weekFresh) lines.push(`<li><span>🏆</span><p><b>Weekly challenge done!</b> ${esc(week.quest.text)}</p></li>`);
  const allDone = qs.every((q) => q.done) && !a.claimed[dailyKey(app)];
  if (fresh.length && allDone) lines.push(`<li class="chest"><span>🎁</span><p><b>All 3 quests done!</b> Your chest is ready to open.</p></li>`);
  for (const b of got.slice(0, 3)) lines.push(`<li class="badge-new t${b.tier}"><span>${b.icon}</span><p><b>New badge: ${esc(b.name)}</b> ${esc(b.desc)}</p></li>`);
  if (got.length > 3) lines.push(`<li><span>🏅</span><p>…and ${got.length - 3} more badges!</p></li>`);
  if (!lines.length) {
    const left = qs.filter((q) => !q.done);
    const q = left[0];
    if (!q && !xpRow) return '';
    return `<div class="adv-news card quiet">${xpRow}${q ? `<p class="adv-next"><span>${q.quest.icon}</span><span class="an-t">Next quest: ${esc(q.quest.text)}</span><b>${q.value}/${q.quest.target}</b></p>` : ''}</div>`;
  }
  return `<div class="adv-news card">${xpRow}<ul>${lines.join('')}</ul><button class="btn ghost small adv-open">${allDone ? '🎁 Open chest' : '📜 See quests'}</button></div>`;
}

/** "+120 XP" with the level bar filling up from where it was. */
function xpRowHtml(before: number, after: number): string {
  const gained = after - before;
  if (gained <= 0) return '';
  const a = levelOf(before);
  const b = levelOf(after);
  const from = b.level > a.level ? 0 : pctOf(a);
  return `<div class="xp-row"><b class="xp-gain">+${gained.toLocaleString('en-IN')} XP</b><span class="xp-track"><i style="--from:${from}%;width:${pctOf(b)}%"></i></span><small>${b.level > a.level ? `Level ${b.level}!` : `Lv ${b.level}`}</small></div>`;
}

// ── level up ─────────────────────────────────────────────────────────────
const LEVEL_LINES = [
  'Your maths brain just got stronger!',
  'Plus is doing a happy dance for you!',
  'Every right answer adds up. Literally!',
  'Look at you go! On to the next one.',
  'That’s what practice does. Brilliant!',
  'You are getting faster and sharper!',
];

/** After play: if the child reached a new level since the last look, celebrate it once. */
export async function levelUpCheck(app: App, c: Child): Promise<void> {
  const a = c.adventure;
  if (!a?.on) return;
  const L = levelInfo(c).level;
  const seen = a.seenLevel ?? L;
  if (L <= seen) {
    // After an undo the level can go down: just remember the lower one.
    if (L < seen || a.seenLevel === undefined) app.save.update(() => (a.seenLevel = L));
    return;
  }
  app.save.update(() => (a.seenLevel = L));
  await showLevelUp(app, c, seen, L);
}

function showLevelUp(app: App, c: Child, from: number, to: number): Promise<void> {
  const rank = rankOf(to);
  const newRank = rankOf(from).name !== rank.name;
  const line = LEVEL_LINES[to % LEVEL_LINES.length];
  const ov = html(`<div class="overlay lvlup" role="dialog" aria-modal="true" aria-label="Level up">
    <div class="lu-rays" aria-hidden="true"></div>
    <div class="lu-card">
      <p class="lu-kicker">Level up!</p>
      <div class="lu-emb${newRank ? ' rank' : ''}"><span class="lu-icon" aria-hidden="true">${rank.icon}</span><b class="lu-num">${to}</b></div>
      <h2>${newRank ? `You’re a ${esc(rank.name)}!` : `Level ${to}`}</h2>
      <p>${newRank ? `A new rank for ${esc(c.name)}. ${line}` : line}</p>
      <div class="lu-plus" aria-hidden="true">${plusSvg({ cls: 'alive', noShadow: true })}</div>
      <button class="btn lu-ok" data-back>Awesome!</button>
    </div>
  </div>`);
  app.root.appendChild(ov);
  const num = ov.querySelector<HTMLElement>('.lu-num')!;
  app.sfx.fanfare();
  app.voice.say(newRank ? `Level ${to}! You're a ${rank.name}!` : `Level up! Level ${to}!`);
  if (!reducedMotion()) {
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    ov.querySelector('.lu-card')!.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: 620, easing: EASE_SPRING });
    // Count up from the old level.
    num.textContent = String(from);
    const steps = Math.min(to - from, 12);
    for (let k = 1; k <= steps; k++) setTimeout(() => (num.textContent = String(k === steps ? to : from + Math.round(((to - from) * k) / steps))), 450 + k * 110);
    setTimeout(() => {
      const r = ov.querySelector('.lu-emb')!.getBoundingClientRect();
      app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 90);
    }, 520 + steps * 110);
  }
  return new Promise((done) => {
    ov.querySelector('.lu-ok')!.addEventListener('click', () => {
      app.sfx.tap();
      if (reducedMotion()) {
        ov.remove();
        return done();
      }
      ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => {
        ov.remove();
        done();
      });
    });
  });
}

/** The ladder of ranks, and how XP is earned. */
function showRanks(app: App, c: Child): void {
  const L = levelInfo(c);
  const rows = RANKS.map((r) => `<li class="${L.level >= r.from ? 'on' : ''}${rankOf(L.level) === r ? ' now' : ''}"><span>${r.icon}</span><b>${esc(r.name)}</b><small>${L.level >= r.from ? (rankOf(L.level) === r ? 'You are here' : '✓') : `Level ${r.from}`}</small></li>`).join('');
  const how = [
    ['✅', `${XP.right} XP for each right answer`],
    ['⭐', `${XP.star} XP for each star`],
    ['👑', `${XP.boss} XP for each boss beaten`],
    ['🎁', `${XP.daily} XP for a daily chest, ${XP.weekly} for a weekly one`],
    ['🏅', `${XP.badge[1]}–${XP.badge[3]} XP for each badge`],
  ].map(([i, t]) => `<li><span>${i}</span><p>${t}</p></li>`).join('');
  const { el } = app.sheet(`<h2>Ranks</h2><p>Level ${L.level} · ${L.xp.toLocaleString('en-IN')} XP</p><ul class="rank-list">${rows}</ul><h3 class="pa-h">How to earn XP</h3><ul class="xp-how">${how}</ul>`, [{ label: 'Close', value: true, kind: 'ghost', back: true }], 'Ranks');
  el.querySelector('.sheet')!.classList.add('ranks-sheet');
}

// ── the Adventure screen ─────────────────────────────────────────────────
type Tab = 'quests' | 'badges';

function questRow(q: QuestStatus): string {
  return `<li class="aq${q.done ? ' done' : ''}"><span class="aq-i">${q.quest.icon}</span><div class="aq-b"><p>${esc(q.quest.text)}</p><div class="aq-bar"><i style="width:${(100 * q.value) / q.quest.target}%"></i></div></div><b class="aq-n">${q.done ? ICONS.check : `${q.value}/${q.quest.target}`}</b></li>`;
}

function chestHtml(kind: 'daily' | 'weekly', state: 'locked' | 'ready' | 'open', coins: number): string {
  const label = state === 'open' ? `Opened · +${coins} coins` : state === 'ready' ? `Open chest · +${coins}` : kind === 'daily' ? 'Finish all 3 to open' : 'Finish it to open';
  return `<button class="adv-chest ${state}" data-kind="${kind}" ${state === 'ready' ? '' : 'disabled'}><span class="ch-i">${state === 'open' ? '✨' : '🎁'}</span><span>${label}</span></button>`;
}

function questsTab(app: App, c: Child): string {
  const a = c.adventure!;
  const qs = todayQuests(app, c);
  const allDone = qs.every((q) => q.done);
  const week = weekQuest(app, c);
  const st = streaks(c.stats.secondsByDay, app.today);
  const qStreak = questStreak(c, app.today);
  const days = weekDays(app.today);
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const flames = days
    .map((d, i) => {
      const played = (c.stats.secondsByDay[d] ?? 0) > 0;
      const chest = !!a.claimed[`d:${d}`];
      const cls = [played ? 'lit' : '', d === app.today ? 'today' : '', d > app.today ? 'later' : ''].join(' ');
      return `<li class="${cls}"><span>${chest ? '🎁' : played ? '🔥' : '·'}</span><small>${names[i]}</small></li>`;
    })
    .join('');
  const L = levelInfo(c);
  const rank = rankOf(L.level);
  const nr = nextRank(L.level);
  return `
    <button class="card adv-rank" aria-label="Level ${L.level}, ${esc(rank.name)}. See all ranks">
      <span class="ar-emb" aria-hidden="true">${rank.icon}<b>${L.level}</b></span>
      <span class="ar-b">
        <span class="ar-n">${esc(rank.name)}</span>
        <span class="aq-bar xp"><i style="width:${pctOf(L)}%"></i></span>
        <small>${L.need ? `${L.into.toLocaleString('en-IN')} / ${L.need.toLocaleString('en-IN')} XP to Level ${L.level + 1}` : 'Top level!'}</small>
        ${nr ? `<small class="ar-next">Next rank: ${nr.icon} ${esc(nr.name)} at Level ${nr.from}</small>` : ''}
      </span>
      <span class="ar-go" aria-hidden="true">›</span>
    </button>
    <div class="card adv-hero">
      <div class="ah-flame"><span>🔥</span><b>${st.current}</b><small>day${st.current === 1 ? '' : 's'} in a row</small></div>
      <ol class="ah-week" aria-label="This week">${flames}</ol>
      ${qStreak > 1 ? `<p class="ah-note">All quests done ${qStreak} days running!</p>` : ''}
    </div>
    <h3 class="pa-h">Today’s quests</h3>
    <div class="card adv-quests"><ul>${qs.map(questRow).join('')}</ul>${chestHtml('daily', a.claimed[dailyKey(app)] ? 'open' : allDone ? 'ready' : 'locked', chestFor(app, c, 'daily'))}</div>
    <h3 class="pa-h">This week’s challenge</h3>
    <div class="card adv-quests"><ul>${questRow(week)}</ul>${chestHtml('weekly', a.claimed[weekKey(app)] ? 'open' : week.done ? 'ready' : 'locked', chestFor(app, c, 'weekly'))}<p class="fine">New quests every day. A new challenge every Monday.</p></div>`;
}

const TIER = ['', 'Bronze', 'Silver', 'Gold'];
function badgesTab(app: App, c: Child): string {
  const x = badgeContext(app, c);
  const have = c.adventure!.badges;
  const earned = BADGES.filter((b) => have[b.id]).sort((p, q) => have[q.id] - have[p.id]);
  const locked = BADGES.filter((b) => !have[b.id])
    .map((b) => ({ b, v: Math.min(b.target, b.value(x)) }))
    .sort((p, q) => q.v / q.b.target - p.v / p.b.target);
  const when = (t: number) => (t <= 1 ? 'Earned before Adventure' : new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  return `
    <p class="adv-count"><b>${earned.length}</b> of ${BADGES.length} badges</p>
    <div class="adv-badges">
      ${earned.map((b) => `<div class="ab on card t${b.tier}" title="${esc(b.desc)}"><span class="ab-i">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small><em>${TIER[b.tier]} · ${when(have[b.id])}</em></div>`).join('')}
      ${locked.map(({ b, v }) => `<div class="ab t${b.tier}" title="${esc(b.desc)}"><span class="ab-i">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small><div class="aq-bar"><i style="width:${(100 * v) / b.target}%"></i></div></div>`).join('')}
    </div>`;
}

export function adventureScreen(child: Child, start: Tab = 'quests') {
  return (app: App): Screen => {
    let tab: Tab = start;
    // Catch up on badges earned while away (e.g. a boss beaten).
    app.save.update(() => awardBadges(badgeContext(app, child), Date.now()));
    const el = html(`<section class="screen adventure" aria-label="Adventure">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Adventure</span><span style="width:50px"></span></header>
      <nav class="rp-tabs adv-tabs" role="tablist"><button role="tab" class="rp-tab" data-tab="quests">📜 Quests</button><button role="tab" class="rp-tab" data-tab="badges">🏅 Badges</button></nav>
      <div class="scroll pa-body adv-body"></div>
    </section>`);
    const body = el.querySelector<HTMLElement>('.adv-body')!;
    const render = (animate = true) => {
      el.querySelectorAll<HTMLElement>('.rp-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      body.innerHTML = tab === 'quests' ? questsTab(app, child) : badgesTab(app, child);
      body.scrollTop = 0;
      body.querySelectorAll<HTMLButtonElement>('.adv-chest.ready').forEach((b) => b.addEventListener('click', () => void openChest(b.dataset.kind as 'daily' | 'weekly', b)));
      body.querySelector('.adv-rank')?.addEventListener('click', () => showRanks(app, child));
      if (animate) stagger(body.querySelectorAll(tab === 'quests' ? '.card, .pa-h' : '.ab'), { gap: tab === 'quests' ? 50 : 12 });
    };
    const openChest = async (kind: 'daily' | 'weekly', btn: HTMLElement) => {
      const a = child.adventure!;
      const done = kind === 'daily' ? todayQuests(app, child).every((q) => q.done) : weekQuest(app, child).done;
      const key = kind === 'daily' ? dailyKey(app) : weekKey(app);
      const coins = chestFor(app, child, kind);
      let unlocked: ('treat' | 'goal')[] = [];
      let ok = false;
      let got: Badge[] = [];
      app.save.update(() => {
        if (a.claimed[key] || !done) return;
        remember(child, [], Date.now(), app.today);
        ok = claimChest(a, key, done, Date.now());
        if (ok) {
          unlocked = addCoins(child.wallet, coins).unlocked;
          got = awardBadges(badgeContext(app, child), Date.now());
        }
      });
      if (!ok) return render();
      btn.setAttribute('disabled', '');
      app.sfx.fanfare();
      const r = btn.getBoundingClientRect();
      if (!reducedMotion()) {
        btn.querySelector('.ch-i')?.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-14deg) scale(1.2)' }, { transform: 'rotate(12deg) scale(1.25)' }, { transform: 'rotate(0) scale(1)' }], { duration: 650, easing: EASE_SPRING });
        app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 60);
      }
      app.toast(`+${coins} coins in your jar!${got.length ? ` New badge: ${got[0].name}` : ''}`);
      await new Promise((res) => setTimeout(res, reducedMotion() ? 50 : 900));
      if (unlocked.length) return void app.show(unlockScreen(child, unlocked[0]));
      render();
      const fresh = body.querySelector<HTMLElement>(`.adv-chest[data-kind="${kind}"]`);
      if (fresh) popIn(fresh, 0, 0.9);
      // Chests and badges give XP too.
      await wait(reducedMotion() ? 0 : 400);
      app.save.update(() => (a.xpSeen = xpOf(child)));
      if (el.isConnected) await levelUpCheck(app, child);
      if (el.isConnected) render(false);
    };
    el.querySelector('.adv-tabs')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.rp-tab');
      if (!b || b.dataset.tab === tab) return;
      tab = b.dataset.tab as Tab;
      render();
    });
    el.querySelector('.back-btn')!.addEventListener('click', () => goHome(app));
    render(false);
    return {
      el,
      mounted: () => {
        stagger(body.querySelectorAll('.card, .pa-h'), { gap: 50 });
        void levelUpCheck(app, child).then(() => el.isConnected && render(false));
      },
    };
  };
}
