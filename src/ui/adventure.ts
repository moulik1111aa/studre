// Adventure mode screens: today's quests with the daily chest, the weekly challenge with its
// chest, the week's flames, and the badge collection. Also the "quest done / new badge" news
// on the result screen and the quests button on the map. A parent turns it on per child.

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
  type Badge,
  type BadgeContext,
  type QuestStatus,
} from '../core/adventure.ts';
import { ICONS } from './icons.ts';
import { goHome } from './flow.ts';
import { unlockScreen } from './unlock.ts';
import { popIn, stagger, reducedMotion, EASE_SPRING } from '../render/motion.ts';

export const adventureOn = (c: Child): boolean => !!c.adventure?.on;

export function badgeContext(app: App, c: Child): BadgeContext {
  const skillIds = AREAS[0].skills.flat().map((s) => s.id);
  return { c, today: app.today, path: app.pathFor(c), strandOf: (id) => skillById(id)?.strand, skillIds };
}

/** Parent area: switch Adventure on or off for one child. Badges already earned are kept. */
export function toggleAdventure(app: App, c: Child): boolean {
  app.save.update(() => {
    if (!c.adventure) {
      c.adventure = freshAdventure();
      // Badges for what they had already done before Adventure (time 1 = "before Adventure").
      awardBadges(badgeContext(app, c), 1);
    } else c.adventure.on = !c.adventure.on;
  });
  return !!c.adventure?.on;
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
  app.save.update(() => {
    got = awardBadges(badgeContext(app, c), Date.now());
    a.cheered[app.today] = [...seen, ...fresh.map((q) => q.quest.id), ...(weekFresh ? [week.quest.id] : [])];
    tidy(a, app.today);
  });
  const lines: string[] = [];
  for (const q of fresh) lines.push(`<li><span>${q.quest.icon}</span><p><b>Quest done!</b> ${esc(q.quest.text)}</p></li>`);
  if (weekFresh) lines.push(`<li><span>🏆</span><p><b>Weekly challenge done!</b> ${esc(week.quest.text)}</p></li>`);
  const allDone = qs.every((q) => q.done) && !a.claimed[dailyKey(app)];
  if (fresh.length && allDone) lines.push(`<li class="chest"><span>🎁</span><p><b>All 3 quests done!</b> Your chest is ready to open.</p></li>`);
  for (const b of got.slice(0, 3)) lines.push(`<li class="badge-new t${b.tier}"><span>${b.icon}</span><p><b>New badge: ${esc(b.name)}</b> ${esc(b.desc)}</p></li>`);
  if (got.length > 3) lines.push(`<li><span>🏅</span><p>…and ${got.length - 3} more badges!</p></li>`);
  if (!lines.length) {
    const left = qs.filter((q) => !q.done);
    if (!left.length) return '';
    const q = left[0];
    return `<div class="adv-news card quiet"><p class="adv-next"><span>${q.quest.icon}</span> Next quest: ${esc(q.quest.text)} <b>${q.value}/${q.quest.target}</b></p></div>`;
  }
  return `<div class="adv-news card"><ul>${lines.join('')}</ul><button class="btn ghost small adv-open">${allDone ? '🎁 Open chest' : '📜 See quests'}</button></div>`;
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
  return `
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
    };
    el.querySelector('.adv-tabs')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.rp-tab');
      if (!b || b.dataset.tab === tab) return;
      tab = b.dataset.tab as Tab;
      render();
    });
    el.querySelector('.back-btn')!.addEventListener('click', () => goHome(app));
    render(false);
    return { el, mounted: () => stagger(body.querySelectorAll('.card, .pa-h'), { gap: 50 }) };
  };
}
