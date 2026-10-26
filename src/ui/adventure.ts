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
import { plusSvg, plusFaceSvg, type Outfit } from './plus.ts';
import { GEMS, chestsOpened } from '../core/adventure.ts';
import { ITEMS, SLOTS, chestsToSurprise, gemBalance, itemById, outfitOf, ownsItem, surpriseFor, tapItem, type Item } from '../core/wardrobe.ts';
import { JarBar } from './jars.ts';
import { coinSvg } from './icons.ts';
import { flyArc, countUp } from '../render/motion.ts';
import { ICONS } from './icons.ts';
import { goHome } from './flow.ts';
import { unlockScreen } from './unlock.ts';
import { popIn, stagger, reducedMotion, EASE_SPRING } from '../render/motion.ts';

export const adventureOn = (c: Child): boolean => !!c.adventure?.on;

export function badgeContext(app: App, c: Child): BadgeContext {
  const skillIds = AREAS[0].skills.flat().map((s) => s.id);
  return { c, today: app.today, path: app.pathFor(c), strandOf: (id) => skillById(id)?.strand, skillIds };
}

export const levelInfo = (c: Child): LevelInfo => levelOf(xpOf(c));
/** What Plus wears for this child (nothing when Adventure is off). */
export const outfitFor = (c: Child | undefined): Outfit => (c?.adventure?.on ? outfitOf(c.adventure) : {});
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
  return `<small class="who-lv" title="${esc(r.name)}">${r.icon} Level ${L.level}</small><i class="who-xp" aria-hidden="true"><b style="width:${pctOf(L)}%"></b></i>`;
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
      <p class="lu-gems">💎 +${(to - from) * GEMS.level} gems for the wardrobe</p>
      <div class="lu-plus" aria-hidden="true">${plusSvg({ cls: 'alive', noShadow: true, outfit: outfitFor(c) })}</div>
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
type Tab = 'quests' | 'badges' | 'wardrobe';

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
    <div class="card adv-quests"><ul>${qs.map(questRow).join('')}</ul>${chestHtml('daily', a.claimed[dailyKey(app)] ? 'open' : allDone ? 'ready' : 'locked', chestFor(app, c, 'daily'))}${surpriseLine(a)}</div>
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

/** "🎁 Surprise item ●●○ 2/3": every third chest holds a wardrobe item. */
function surpriseLine(a: NonNullable<Child['adventure']>): string {
  const done = chestsOpened(a) % 3;
  const dots = [0, 1, 2].map((k) => `<i class="${k < done ? 'on' : ''}"></i>`).join('');
  return `<p class="adv-surprise"><span>🎁 Surprise item</span><span class="as-dots" aria-hidden="true">${dots}</span><b>${done}/3</b></p>`;
}

function itemTile(c: Child, item: Item, level: number, balance: number): string {
  const a = c.adventure!;
  const own = ownsItem(a, item.id);
  const wearing = own && a.equipped?.[item.slot] === item.id;
  const locked = !own && level < item.level;
  const short = !own && !locked && balance < item.price;
  const label = wearing ? 'Wearing ✓' : own ? 'Tap to wear' : locked ? `🔒 Level ${item.level}` : `💎 ${item.price}`;
  const cls = wearing ? 'on' : own ? 'own' : locked ? 'locked' : short ? 'short' : 'buy';
  return `<button class="wd-item ${cls}" data-id="${item.id}" aria-pressed="${wearing}" aria-label="${esc(item.name)}: ${esc(label)}"><span class="wd-i" aria-hidden="true">${item.icon}</span><b>${esc(item.name)}</b><small>${label}</small></button>`;
}

function wardrobeTab(c: Child): string {
  const level = levelInfo(c).level;
  const balance = gemBalance(c);
  const outfit = outfitFor(c);
  return `
    <div class="card wd-hero">
      <div class="wd-plus" aria-hidden="true">${plusSvg({ cls: 'alive', noShadow: true, outfit })}</div>
      <div class="wd-side">
        <p class="wd-gems"><b>💎 ${balance.toLocaleString('en-IN')}</b><small>gems to spend</small></p>
        <p class="wd-how">Gems come from new levels (+${GEMS.level}), chests (+${GEMS.daily}, weekly +${GEMS.weekly}) and badges. They are only for Plus’s wardrobe.</p>
      </div>
    </div>
    ${SLOTS.map((slot) => `<h3 class="pa-h">${slot.name}</h3><div class="wd-grid">${ITEMS.filter((i) => i.slot === slot.id).map((i) => itemTile(c, i, level, balance)).join('')}</div>`).join('')}
    <p class="fine wd-note">Tap an item to buy it and put it on. Tap again to take it off. Every third chest has a surprise item inside.</p>`;
}

const CHEST_COLOURS = { daily: ['#C97A36', '#B8692B', '#FFD25A'], weekly: ['#7A52EE', '#6440D8', '#FFD25A'] } as const;
function chestSvg(kind: 'daily' | 'weekly'): string {
  const [box, lid, band] = CHEST_COLOURS[kind];
  return `<svg class="cc-svg" viewBox="0 0 200 170" aria-hidden="true">
    <g class="cc-box"><rect x="24" y="70" width="152" height="86" rx="12" fill="${box}" stroke="${PLUS_INK_C}" stroke-width="6"/><path d="M24 100 H176" stroke="${PLUS_INK_C}" stroke-width="3" opacity=".25"/><rect x="88" y="70" width="24" height="86" fill="${band}" stroke="${PLUS_INK_C}" stroke-width="5"/><rect x="83" y="82" width="34" height="28" rx="7" fill="#FFE27A" stroke="${PLUS_INK_C}" stroke-width="5"/><circle cx="100" cy="94" r="4" fill="${PLUS_INK_C}"/><path d="M100 96 V103" stroke="${PLUS_INK_C}" stroke-width="3.5" stroke-linecap="round"/></g>
    <g class="cc-lid"><path d="M24 72 Q24 24 100 24 Q176 24 176 72 Z" fill="${lid}" stroke="${PLUS_INK_C}" stroke-width="6" stroke-linejoin="round"/><path d="M88 26 H112 V72 H88 Z" fill="${band}" stroke="${PLUS_INK_C}" stroke-width="5"/><path d="M44 50 Q60 36 84 34" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".45"/></g>
  </svg>`;
}
const PLUS_INK_C = '#1A1446';

/**
 * Opening a chest is a moment: tap it three times (it wobbles and glows more each time), then it
 * bursts. Coins fly into the treat jar, gems count up, and every third chest has a surprise.
 * The chest is already claimed when this shows; this is the show.
 */
function chestCeremony(app: App, c: Child, kind: 'daily' | 'weekly', coins: number, gems: number, surprise: Item | null, jar: JarBar): Promise<void> {
  const calm = reducedMotion();
  const taps = calm ? 1 : 3;
  const ov = html(`<div class="overlay chest-cer ${kind}" role="dialog" aria-modal="true" aria-label="Open your chest">
    <div class="cc-top"></div>
    <div class="cc-stage">
      <div class="cc-glow" aria-hidden="true"></div>
      <button class="cc-chest" aria-label="Tap the chest">${chestSvg(kind)}</button>
      <p class="cc-hint">${calm ? 'Tap the chest to open it!' : 'Tap the chest!'}</p>
    </div>
    <div class="cc-loot" hidden>
      <p class="cc-row cc-coins">${coinSvg}<b>+${coins} coins</b><small>in the treat jar</small></p>
      <p class="cc-row cc-gems"><span>💎</span><b class="cc-gem-n">+0 gems</b><small>for Plus’s wardrobe</small></p>
      ${surprise ? `<div class="cc-gift card"><span class="cc-gift-plus">${plusFaceSvg({ cls: 'alive', outfit: { [surprise.slot]: surprise.id } })}</span><div><b>Surprise! ${esc(surprise.name)} ${surprise.icon}</b><small>A new wardrobe item for Plus</small></div><button class="btn small mint cc-wear">Wear it</button></div>` : `<p class="cc-next">🎁 ${chestsToSurprise(c.adventure)} more chest${chestsToSurprise(c.adventure) === 1 ? '' : 's'} to a surprise item</p>`}
      <button class="btn cc-done" data-back>Awesome!</button>
    </div>
  </div>`);
  ov.querySelector('.cc-top')!.appendChild(jar.el);
  app.root.appendChild(ov);
  if (!calm) ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
  const chest = ov.querySelector<HTMLButtonElement>('.cc-chest')!;
  const hint = ov.querySelector<HTMLElement>('.cc-hint')!;
  let n = 0;
  return new Promise((done) => {
    const close = () => {
      if (calm) {
        ov.remove();
        return done();
      }
      ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => {
        ov.remove();
        done();
      });
    };
    const burst = async () => {
      chest.disabled = true;
      ov.classList.add('open');
      hint.textContent = surprise ? 'Wow, a surprise!' : 'Wow!';
      app.sfx.fanfare();
      app.haptics.match(5);
      const r = chest.getBoundingClientRect();
      if (!calm) app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 90);
      const loot = ov.querySelector<HTMLElement>('.cc-loot')!;
      loot.hidden = false;
      if (!calm) stagger(loot.children, { gap: 120, y: 14 });
      // Coins into the jar.
      const from = ov.querySelector('.cc-coins svg')!.getBoundingClientRect();
      const flights: Promise<void>[] = [];
      for (let k = 0; k < (calm ? 0 : Math.min(8, Math.max(3, Math.round(coins / 3)))); k++) {
        const f = html(`<span class="flying-coin">${coinSvg}</span>`);
        document.body.appendChild(f);
        flights.push(flyArc(f, from, jar.target(), 700, 300 + k * 80).then(() => {
          f.remove();
          app.sfx.coin(k);
        }));
      }
      countUp(ov.querySelector<HTMLElement>('.cc-gem-n')!, 0, gems, calm ? 1 : 900, (v) => `+${Math.round(v)} gems`);
      await Promise.all(flights);
      jar.update(!calm);
    };
    chest.addEventListener('click', () => {
      if (n >= taps) return;
      n++;
      ov.style.setProperty('--t', String(n));
      if (n < taps) {
        app.sfx.pop();
        app.haptics.tap();
        hint.textContent = n === 1 ? 'Tap again!' : 'One more!';
        chest.animate([{ transform: 'rotate(0) scale(1)' }, { transform: `rotate(${n % 2 ? -10 : 10}deg) scale(${1 + n * 0.06})` }, { transform: `rotate(${n % 2 ? 8 : -8}deg) scale(${1 + n * 0.06})` }, { transform: 'rotate(0) scale(1)' }], { duration: 420, easing: EASE_SPRING });
        const r = chest.getBoundingClientRect();
        app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 10 + n * 12);
        return;
      }
      void burst();
    });
    ov.querySelector('.cc-wear')?.addEventListener('click', (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      app.save.update(() => {
        const a = c.adventure!;
        (a.equipped ??= {})[surprise!.slot] = surprise!.id;
      });
      b.textContent = 'Wearing ✓';
      b.disabled = true;
    });
    ov.querySelector('.cc-done')!.addEventListener('click', close);
  });
}

export function adventureScreen(child: Child, start: Tab = 'quests') {
  return (app: App): Screen => {
    let tab: Tab = start;
    // Catch up on badges earned while away (e.g. a boss beaten).
    app.save.update(() => awardBadges(badgeContext(app, child), Date.now()));
    const el = html(`<section class="screen adventure" aria-label="Adventure">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Adventure</span><span style="width:50px"></span></header>
      <nav class="rp-tabs adv-tabs" role="tablist"><button role="tab" class="rp-tab" data-tab="quests">📜 Quests</button><button role="tab" class="rp-tab" data-tab="badges">🏅 Badges</button><button role="tab" class="rp-tab" data-tab="wardrobe">🎩 Wardrobe</button></nav>
      <div class="scroll pa-body adv-body"></div>
    </section>`);
    const body = el.querySelector<HTMLElement>('.adv-body')!;
    const render = (animate = true) => {
      el.querySelectorAll<HTMLElement>('.rp-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      const keep = tab === 'wardrobe' && !animate ? body.scrollTop : 0;
      body.innerHTML = tab === 'quests' ? questsTab(app, child) : tab === 'badges' ? badgesTab(app, child) : wardrobeTab(child);
      body.scrollTop = keep;
      body.querySelectorAll<HTMLButtonElement>('.wd-item').forEach((b) => b.addEventListener('click', () => tapWardrobe(b.dataset.id!)));
      body.querySelectorAll<HTMLButtonElement>('.adv-chest.ready').forEach((b) => b.addEventListener('click', () => void openChest(b.dataset.kind as 'daily' | 'weekly', b)));
      body.querySelector('.adv-rank')?.addEventListener('click', () => showRanks(app, child));
      if (animate) stagger(body.querySelectorAll(tab === 'quests' ? '.card, .pa-h' : '.ab'), { gap: tab === 'quests' ? 50 : 12 });
    };
    const tapWardrobe = (id: string) => {
      let r: ReturnType<typeof tapItem> = null;
      let got: Badge[] = [];
      app.save.update(() => {
        if (itemById(id) && !ownsItem(child.adventure, id)) remember(child, [], Date.now(), app.today);
        r = tapItem(child, id, Date.now());
        if (r?.kind === 'bought') got = awardBadges(badgeContext(app, child), Date.now());
      });
      const res = r as ReturnType<typeof tapItem>;
      if (!res) return;
      if (res.kind === 'locked') return app.toast(`${res.item.name} unlocks at Level ${res.need}. Keep playing!`);
      if (res.kind === 'short') return app.toast(`You need ${res.need} more gem${res.need === 1 ? '' : 's'} for the ${res.item.name.toLowerCase()}. Gems come from levels, chests and badges.`);
      if (res.kind === 'bought') {
        app.sfx.fanfare();
        app.toast(`New for Plus: ${res.item.name}! 💎 −${res.item.price}${got.length ? ` · New badge: ${got[0].name}` : ''}`);
      } else app.sfx.pop();
      render(false);
      const plus = body.querySelector('.wd-plus');
      if (plus && !reducedMotion()) plus.animate([{ transform: 'scale(.85) rotate(-6deg)' }, { transform: 'scale(1.06) rotate(3deg)' }, { transform: 'none' }], { duration: 480, easing: EASE_SPRING });
    };
    const openChest = async (kind: 'daily' | 'weekly', btn: HTMLElement) => {
      const a = child.adventure!;
      const done = kind === 'daily' ? todayQuests(app, child).every((q) => q.done) : weekQuest(app, child).done;
      const key = kind === 'daily' ? dailyKey(app) : weekKey(app);
      const coins = chestFor(app, child, kind);
      // The jar as it was, so the coins can be seen landing in it.
      const jar = new JarBar(child);
      let unlocked: ('treat' | 'goal')[] = [];
      let ok = false;
      let surprise: Item | null = null;
      app.save.update(() => {
        if (a.claimed[key] || !done) return;
        remember(child, [], Date.now(), app.today);
        ok = claimChest(a, key, done, Date.now());
        if (ok) {
          unlocked = addCoins(child.wallet, coins).unlocked;
          surprise = surpriseFor(child, Date.now());
          awardBadges(badgeContext(app, child), Date.now());
        }
      });
      if (!ok) return render();
      btn.setAttribute('disabled', '');
      await chestCeremony(app, child, kind, coins, kind === 'daily' ? GEMS.daily : GEMS.weekly, surprise, jar);
      if (unlocked.length) return void app.show(unlockScreen(child, unlocked[0]));
      render(false);
      const fresh = body.querySelector<HTMLElement>(`.adv-chest[data-kind="${kind}"]`);
      if (fresh) popIn(fresh, 0, 0.9);
      // Chests and badges give XP too.
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
