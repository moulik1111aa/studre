// The progress report for a parent: five tabs.
//   Overview — who, where they are, headline numbers, this week against last, 14 days of play, highlights.
//   Skills   — progress per stage and strand, strengths and skills to practise, speed, tiers and stars.
//   Activity — a six-week calendar, time of day, and the most recent levels.
//   Rewards  — both jars, coins earned, rewards given and bosses beaten.
//   Manage   — undo recent play, redo placement, start over or delete.
// Lifetime totals (time, answers, stars, coins, rewards) cover all play. Per-skill accuracy, speed,
// times of day and the level list come from the play log, which starts with this update.

import { html, esc, type App, type Screen } from './app.ts';
import { resetChild, removeChild, type Child } from '../storage/save.ts';
import { rewardById, costOf } from '../core/rewards.ts';
import { AREAS, skillById } from '../core/areas/index.ts';
import { isMastered, frontier, freshProgress, TIER_NAMES, type Level, type Tier } from '../core/path.ts';
import { addDays, dayDiff, jarProgress } from '../core/economy.ts';
import { BOSSES, bossFor } from '../core/boss.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { stagger } from '../render/motion.ts';
import { changesSince, rollback } from '../core/undo.ts';
import { pct, spanFigures, dayFigures, streaks, strengths, skillFigures, timeOfDay, pathProgress, bestDay, type PlayEntry, type SkillFigure } from '../core/stats.ts';
import { schoolLabel } from './school.ts';
import { parentScreen } from './parent.ts';
import { addChildScreen } from './setup.ts';
import { makeBackup } from '../core/backup.ts';
import { reportCardHtml, reportFileName } from './reportfile.ts';
import { saveTextFile } from '../platform/files.ts';

const STRANDS: [string, string][] = [
  ['number', 'Numbers & place value'],
  ['addsub', 'Adding & subtracting'],
  ['muldiv', 'Times & division'],
  ['fdp', 'Fractions & decimals'],
  ['algebra', 'Algebra & powers'],
  ['mental', 'Mental tricks'],
  ['word', 'Word problems'],
];
const TABS = [
  ['overview', 'Overview'],
  ['skills', 'Skills'],
  ['activity', 'Activity'],
  ['rewards', 'Rewards'],
  ['manage', 'Manage'],
] as const;
type Tab = (typeof TABS)[number][0];

const startOfToday = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateOf = (day: string) => new Date(`${day}T12:00:00`);
/** "Tue 21 Oct" */
const niceDate = (day: string) => {
  const d = dateOf(day);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
};
const shortDate = (day: string) => {
  const d = dateOf(day);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
};
const hm = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`);
const ago = (day: string, today: string) => {
  const n = dayDiff(day, today);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};
const skillName = (id: string) => skillById(id)?.name ?? id;

function levelLabel(l: Level | undefined): string {
  if (!l) return 'Everything done!';
  if (l.kind === 'skill') return `${skillName(l.skillId)} · ${TIER_NAMES[l.tier]}`;
  if (l.kind === 'review') return 'Minion fight';
  return `Boss: ${bossFor(l.stage, l.boss).name}`;
}
function entryLabel(e: PlayEntry): string {
  if (e.k === 'skill') return `${skillName(e.id.split('#')[0])} · ${TIER_NAMES[(e.tier ?? 1) as Tier]}`;
  if (e.k === 'review') return 'Minion fight';
  if (e.k === 'quest') return 'Side quest';
  const slot = e.id.endsWith(':mid') ? 'mid' : 'final';
  return `Boss: ${bossFor(e.st, slot).name}`;
}
/** ▲ 12% / ▼ 3 / = */
function change(now: number, before: number, unit = ''): string {
  if (now === before) return '<span class="rp-ch same">=</span>';
  const up = now > before;
  const diff = Math.abs(now - before);
  return `<span class="rp-ch ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${diff}${unit}</span>`;
}

export function reportScreen(child: Child, start: Tab = 'overview') {
  return (app: App): Screen => {
    const today = app.today;
    const log = child.log ?? [];
    const tally = child.tally ?? {};
    const secs = child.stats.secondsByDay;
    const path = app.pathFor(child);
    const front = path[frontier(path, child.progress)];
    const skills = AREAS[0].skills.flat();
    const stageInfo = (n: number) => AREAS[0].stages[n - 1];
    const prog = pathProgress(path, child.progress);
    const st = streaks(secs, today);
    const totalMin = Math.round(Object.values(secs).reduce((a, b) => a + b, 0) / 60);
    const daysPlayed = Object.values(secs).filter((s) => s > 0).length;
    const lastDay = Object.keys(secs).filter((d) => secs[d] > 0).sort().pop();
    const mastered = skills.filter((s) => isMastered(child.progress, s.id)).length;
    const passed = Object.values(child.progress.levels).filter((l) => l.stars >= 1).length;
    const threeStar = Object.values(child.progress.levels).filter((l) => l.stars >= 3).length;
    const acc = pct(child.stats.correct, child.stats.answered);
    const week = spanFigures(secs, log, today, 7);
    const lastWeek = spanFigures(secs, log, addDays(today, -7), 7);
    const figs = skillFigures(tally);
    const tracked = log.length > 0;
    const since = log[0]?.d;
    const note = tracked
      ? `<p class="fine rp-since">Accuracy by skill, speed and times of day are counted from ${esc(niceDate(since!))}.</p>`
      : `<p class="fine rp-since">Accuracy by skill, speed and times of day start counting from today. Play a few levels to fill them in.</p>`;

    // ── Overview ────────────────────────────────────────────────────────────
    const days14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const limit = app.save.data.settings.limitMinutes;
    const max14 = Math.max(limit, ...days14.map((d) => dayFigures(secs, log, d).minutes), 1);
    const bars = days14
      .map((d) => {
        const f = dayFigures(secs, log, d);
        const a = f.answers ? pct(f.right, f.answers) : null;
        return `<div class="day${d === today ? ' today' : ''}" title="${esc(niceDate(d))}: ${f.minutes} min${a !== null ? `, ${a}% right` : ''}"><span class="rp-acc">${a !== null ? a : ''}</span><i style="height:${Math.max(2, (100 * f.minutes) / max14)}%"></i><small>${dateOf(d).getDate()}</small></div>`;
      })
      .join('');
    const limitLine = `<span class="rp-limit" style="bottom:calc(${(100 * limit) / max14}% * .78 + 26px)">${limit} min limit</span>`;
    const tod = timeOfDay(log);
    const topTod = [...tod].sort((a, b) => b.levels - a.levels)[0];
    const fastest = figs.filter((f) => f.answers >= 8).sort((a, b) => a.speed - b.speed)[0];
    const most = [...figs].sort((a, b) => b.answers - a.answers)[0];
    const bd = bestDay(secs);
    const highlights = [
      bd ? `📅 Best day: <b>${esc(niceDate(bd.day))}</b>, ${bd.minutes} minutes` : '',
      most ? `🔁 Most practised: <b>${esc(skillName(most.id))}</b> (${most.answers} questions)` : '',
      fastest ? `⚡ Quickest: <b>${esc(skillName(fastest.id))}</b>, ${fastest.speed.toFixed(1)} s an answer` : '',
      tracked && topTod.levels ? `🕒 Plays most in the <b>${topTod.label.toLowerCase()}</b>` : '',
      week.answers && lastWeek.answers ? `🎯 Accuracy this week: <b>${pct(week.right, week.answers)}%</b> (last week ${pct(lastWeek.right, lastWeek.answers)}%)` : '',
      daysPlayed ? `⏱️ On days played: <b>${Math.round(totalMin / daysPlayed)} min</b> on average` : '',
      st.best > 1 ? `🔥 Longest streak: <b>${st.best} days</b> in a row` : '',
    ].filter(Boolean);
    const kpi = (v: string, label: string, sub = '') => `<div class="rp-kpi"><b>${v}</b><small>${label}</small>${sub ? `<em>${sub}</em>` : ''}</div>`;
    const weekRow = (label: string, now: number, before: number, unit = '') => `<tr><th>${label}</th><td>${now}${unit}</td><td>${before}${unit}</td><td>${change(now, before, unit)}</td></tr>`;
    const overview = `
      <div class="card rp-hero">${avatarHtml(child.avatar, 64)}<div><h2>${esc(child.name)}</h2>
        <p>Age ${child.age} · ${child.school?.on ? esc(schoolLabel(child.school)) : `Stage ${front?.stage ?? 7}: ${esc(stageInfo(front?.stage ?? 7).name)}`}</p>
        <p class="rp-now">Now on: <b>${esc(levelLabel(front))}</b></p>
        <p class="rp-meta">${child.createdDay ? `Playing since ${esc(shortDate(child.createdDay))}` : ''}${lastDay ? ` · last played ${ago(lastDay, today)}` : ''}${child.assisted ? ' · 👪 plays with a grown-up' : ''}</p></div></div>
      <div class="rp-kpis">
        ${kpi(hm(totalMin), 'time played', `${daysPlayed} day${daysPlayed === 1 ? '' : 's'}`)}
        ${kpi(String(child.stats.answered), 'questions answered')}
        ${kpi(`${acc}%`, 'answers right')}
        ${kpi(String(passed), 'levels passed', `${threeStar} with 3 stars`)}
        ${kpi(String(mastered), 'skills mastered', `of ${skills.length}`)}
        ${kpi(`${st.current}`, 'day streak', `best ${st.best}`)}
      </div>
      <h3 class="pa-h">This week and last</h3>
      <div class="card rp-week"><table><thead><tr><th></th><th>This week</th><th>Last week</th><th></th></tr></thead><tbody>
        ${weekRow('Minutes', week.minutes, lastWeek.minutes)}
        ${weekRow('Days played', week.activeDays, lastWeek.activeDays)}
        ${weekRow('Levels', week.levels, lastWeek.levels)}
        ${weekRow('Questions', week.answers, lastWeek.answers)}
        ${weekRow('Right', pct(week.right, week.answers), pct(lastWeek.right, lastWeek.answers), '%')}
      </tbody></table></div>
      <h3 class="pa-h">Last 14 days</h3>
      <div class="card rp-days">${limitLine}<div class="rp-bars">${bars}</div><p class="fine">Bars: minutes played. Numbers on top: % right that day.</p></div>
      ${highlights.length ? `<h3 class="pa-h">Highlights</h3><ul class="card rp-list">${highlights.map((h) => `<li>${h}</li>`).join('')}</ul>` : ''}
      ${note}`;

    // ── Skills ──────────────────────────────────────────────────────────────
    const stageRows = prog.stages
      .map((s) => {
        const info = stageInfo(s.stage);
        const now = front?.stage === s.stage;
        return `<div class="rp-stage${now ? ' now' : ''}"><div><b>${s.stage}. ${esc(info.name)}</b><small>Ages ${info.ages}${now ? ' · here now' : s.skipped && !s.passed ? ' · skipped as too easy' : ''}</small></div><div class="rep-bar"><i style="width:${(100 * s.passed) / s.total}%"></i><i class="sk" style="width:${(100 * s.skipped) / s.total}%"></i></div><span>${pct(s.passed + s.skipped, s.total)}%</span></div>`;
      })
      .join('');
    const strandRows = STRANDS.map(([id, name]) => {
      const list = skills.filter((s) => s.strand === id);
      if (!list.length) return '';
      const m = list.filter((s) => isMastered(child.progress, s.id)).length;
      const sk = list.filter((s) => child.progress.skipped[s.id] && !isMastered(child.progress, s.id)).length;
      const t = figs.filter((f) => skillById(f.id)?.strand === id);
      const n = t.reduce((a, f) => a + f.answers, 0);
      const ok = t.reduce((a, f) => a + f.right, 0);
      return `<div class="rp-strand"><span>${name}</span><div class="rep-bar"><i style="width:${(100 * m) / list.length}%"></i><i class="sk" style="width:${(100 * sk) / list.length}%"></i></div><b>${m}/${list.length}</b><em>${n ? `${pct(ok, n)}% right` : '–'}</em></div>`;
    }).join('');
    const { best, practise } = strengths(tally);
    const skillLine = (f: SkillFigure) => `<li><b>${esc(skillName(f.id))}</b><span>${f.accuracy}% right · ${f.answers} questions · ${f.speed.toFixed(1)} s each</span></li>`;
    const allAns = figs.reduce((a, f) => a + f.answers, 0);
    const avgSpeed = allAns ? figs.reduce((a, f) => a + f.speed * f.answers, 0) / allAns : 0;
    const tierMax = Math.max(1, ...prog.tiers);
    const skillsTab = `
      <h3 class="pa-h">Progress by stage</h3><div class="card rp-stages">${stageRows}<p class="fine">Lighter part: levels skipped at placement because they were too easy.</p></div>
      <h3 class="pa-h">Skills by strand</h3><div class="card rp-strands">${strandRows}<p class="fine">Bar: skills mastered (lighter part skipped at placement). Right: share of answers right.</p></div>
      <div class="rp-two">
        <div class="card rp-good"><h3>💪 Strengths</h3>${best.length ? `<ul>${best.map(skillLine).join('')}</ul>` : '<p class="fine">Shows once a skill has 8 or more answers, with 80% or more right.</p>'}</div>
        <div class="card rp-work"><h3>🎯 Worth practising</h3>${practise.length ? `<ul>${practise.map(skillLine).join('')}</ul>` : '<p class="fine">Nothing below 80% right so far. 🎉</p>'}</div>
      </div>
      <h3 class="pa-h">Speed and stars</h3>
      <div class="rp-kpis three">
        ${kpi(avgSpeed ? `${avgSpeed.toFixed(1)} s` : '–', 'per answer')}
        ${kpi(`${prog.stars}`, 'stars won', `of ${prog.maxStars}`)}
        ${kpi(`${child.bossesBeaten.length}`, 'bosses beaten')}
      </div>
      <h3 class="pa-h">Levels passed by type</h3>
      <div class="card rp-tiers">${prog.tiers.map((n, i) => `<div><span>${TIER_NAMES[(i + 1) as Tier]}</span><div class="rep-bar"><i style="width:${(100 * n) / tierMax}%"></i></div><b>${n}</b></div>`).join('')}
        <p class="fine">Learn and Practice build the skill; Speed and Master are timed and show it is secure.</p></div>
      ${note}`;

    // ── Activity ────────────────────────────────────────────────────────────
    const first = addDays(today, -41 - ((dateOf(today).getDay() + 6) % 7));
    const cells = Array.from({ length: 42 + ((dateOf(today).getDay() + 6) % 7) + 1 }, (_, i) => addDays(first, i))
      .map((d) => {
        const m = Math.round((secs[d] ?? 0) / 60);
        const lv = m === 0 ? 0 : m < 10 ? 1 : m < 20 ? 2 : m < 30 ? 3 : 4;
        return `<i class="lv${lv}${d === today ? ' today' : ''}" title="${esc(niceDate(d))}: ${m} min"></i>`;
      })
      .join('');
    const todMax = Math.max(1, ...tod.map((t) => t.levels));
    const recent = log
      .slice(-20)
      .reverse()
      .map((e) => {
        const at = new Date(e.t);
        const time = `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
        return `<li><div><b>${esc(entryLabel(e))}</b><small>${esc(shortDate(e.d))}, ${time}${e.g ? ' · 👪' : ''}</small></div><span class="rp-score">${e.sc}/${e.of}</span><span class="rp-stars">${'★'.repeat(e.s)}${'☆'.repeat(3 - e.s)}</span><small class="rp-min">${Math.max(1, Math.round(e.sec / 60))} min${e.c ? ` · +${e.c}🪙` : ''}</small></li>`;
      })
      .join('');
    const activity = `
      <h3 class="pa-h">Last 6 weeks</h3>
      <div class="card rp-cal"><div class="rp-cal-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div><div class="rp-cal-grid">${cells}</div>
        <div class="rp-key"><span>None</span><i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><span>30+ min</span></div></div>
      <div class="rp-kpis three">
        ${kpi(`${week.minutes}`, 'minutes this week')}
        ${kpi(`${week.activeDays}/7`, 'days this week')}
        ${kpi(week.activeDays ? `${Math.round(week.minutes / week.activeDays)}` : '0', 'min a day played')}
      </div>
      <h3 class="pa-h">Time of day</h3>
      <div class="card rp-tod">${tod.map((t) => `<div><span>${t.label}</span><div class="rep-bar"><i style="width:${(100 * t.levels) / todMax}%"></i></div><b>${t.levels}</b></div>`).join('')}
        <p class="fine">Levels finished: morning 5–12, afternoon 12–5, evening 5–9, night after 9.</p></div>
      <h3 class="pa-h">Recent levels</h3>
      ${recent ? `<ul class="card rp-recent">${recent}</ul>` : '<p class="fine">Levels played from today on show here.</p>'}
      ${note}`;

    // ── Rewards ─────────────────────────────────────────────────────────────
    const jarCard = (which: 'treat' | 'goal') => {
      const jar = child.wallet[which];
      const r = jar.rewardId ? rewardById(jar.rewardId) : undefined;
      if (!r) return `<div class="card rp-jar"><p class="fine">No ${which === 'treat' ? 'treat' : 'big goal'} chosen yet.</p></div>`;
      const p = Math.floor(jarProgress(jar) * 100);
      return `<div class="card rp-jar"><span class="rp-jar-icon">${r.icon}</span><div><small>${which === 'treat' ? 'Treat' : 'Big goal'}</small><b>${esc(r.name)}</b><div class="rep-bar"><i style="width:${p}%"></i></div><em>${Math.floor(jar.coins)} of ${costOf(r)} coins · ${jar.waiting ? 'ready to hand over!' : `${p}%`}</em></div></div>`;
    };
    const earned = child.wallet.earned;
    const gaps = earned.slice(1).map((e, i) => dayDiff(earned[i].day, e.day));
    const avgGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
    const weekCoins = log.filter((e) => dayDiff(e.d, today) < 7).reduce((a, e) => a + e.c, 0);
    const rewards = `
      <h3 class="pa-h">Saving up</h3>${jarCard('treat')}${jarCard('goal')}
      <div class="rp-kpis three">
        ${kpi(`${Math.round(child.wallet.lifetime)}`, 'coins earned')}
        ${kpi(`${weekCoins}`, 'coins this week')}
        ${kpi(`${earned.length}`, 'rewards given', avgGap ? `every ${avgGap} days` : '')}
      </div>
      <h3 class="pa-h">Rewards given</h3>
      <ul class="card rp-list">${earned.length ? [...earned].reverse().map((e) => `<li>${rewardById(e.rewardId)?.icon ?? '🎁'} <b>${esc(rewardById(e.rewardId)?.name ?? 'Reward')}</b> <small>${esc(niceDate(e.day))}</small></li>`).join('') : '<li><small>None yet. The first treat is usually about 10 days in.</small></li>'}</ul>
      <h3 class="pa-h">Bosses beaten</h3>
      <ul class="card rp-list">${child.bossesBeaten.length ? child.bossesBeaten.map((id) => `<li>🏆 <b>${esc(BOSSES.find((b) => b.id === id)?.name ?? id)}</b></li>`).join('') : '<li><small>None yet.</small></li>'}</ul>`;

    // ── Manage ──────────────────────────────────────────────────────────────
    const hour = changesSince(child, Date.now() - 3_600_000);
    const day = changesSince(child, startOfToday());
    const manage = `
      <h3 class="pa-h">Report card and backup</h3>
      <div class="card undo-card"><p class="fine">Save ${esc(child.name)}’s report card as a file. It opens in any browser and prints neatly, and it is also a backup: on another phone, MN can restore ${esc(child.name)} from it (Parent area → Restore from a report card).</p>
        <button class="btn ghost small rp-export2">Save report card</button></div>
      <h3 class="pa-h">Undo recent play</h3>
      <div class="card undo-card"><p class="fine">Someone else played on ${esc(child.name)}’s profile? Remove it. Stars, coins, time and these statistics go back to how they were.</p>
        <button class="btn ghost small undo-hour"${hour ? '' : ' disabled'}>Remove the last hour (${hour})</button>
        <button class="btn ghost small undo-today"${day ? '' : ' disabled'}>Remove all of today (${day})</button></div>
      <h3 class="pa-h">Placement</h3>
      <div class="card undo-card"><p class="fine">Skipped levels are checked again with a few new questions. Stars stay.</p><button class="btn ghost small redo">Redo placement</button></div>
      <h3 class="pa-h">Profile</h3>
      <div class="card undo-card profile-card"><p class="fine">Start over clears ${esc(child.name)}’s stars, coins, jars, rewards earned and statistics, and runs placement again. Delete removes the profile completely.</p>
        <button class="btn ghost small warn reset-kid">Start ${esc(child.name)} over</button>
        <button class="btn ghost small warn delete-kid">Delete ${esc(child.name)}’s profile</button></div>`;

    const bodies: Record<Tab, string> = { overview, skills: skillsTab, activity, rewards, manage };
    const el = html(`<section class="screen report" aria-label="Progress report">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">${esc(child.name)}’s report</span><button class="icon-btn rp-export" aria-label="Save the report card"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M5 19h14"/></svg></button></header>
      <nav class="rp-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" class="rp-tab" data-tab="${id}" aria-selected="${id === start}">${label}</button>`).join('')}</nav>
      <div class="scroll pa-body rp-body"></div>
    </section>`);
    const body = el.querySelector<HTMLElement>('.rp-body')!;
    const show = (tab: Tab) => {
      body.innerHTML = bodies[tab];
      body.scrollTop = 0;
      el.querySelectorAll<HTMLElement>('.rp-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      if (tab === 'manage') wireManage();
      stagger(body.children, { gap: 35 });
    };
    el.querySelector('.rp-tabs')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (b) show(b.dataset.tab as Tab);
    });
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(parentScreen));
    let saving = false;
    const exportCard = async () => {
      if (saving) return;
      saving = true;
      try {
        const name = reportFileName(child, today);
        const ok = await saveTextFile(app, name, 'text/html', reportCardHtml(app, child, await makeBackup(child)));
        if (ok) app.toast(`Saved ${name}`);
      } catch {
        app.toast('The report card couldn’t be saved. Please try again.');
      } finally {
        saving = false;
      }
    };
    el.querySelector('.rp-export')!.addEventListener('click', () => void exportCard());

    function wireManage(): void {
      const undo = (since: number, what: string) => {
        const { result } = app.sheet(`<h2>Remove ${what}?</h2><p>${changesSince(child, since)} saved result(s) will be undone for ${esc(child.name)}. This can’t be reversed.</p>`, [
          { label: 'Remove', value: true, kind: 'mint' },
          { label: 'Cancel', value: false, kind: 'ghost', back: true },
        ], 'Undo recent play');
        void result.then((yes) => {
          if (!yes) return;
          let n = 0;
          app.save.update(() => (n = rollback(child, since)));
          app.toast(`Removed ${n} result${n === 1 ? '' : 's'}.`);
          void app.show(reportScreen(child, 'manage'));
        });
      };
      body.querySelector('.rp-export2')!.addEventListener('click', () => void exportCard());
      body.querySelector('.undo-hour')!.addEventListener('click', () => undo(Date.now() - 3_600_000, 'the last hour'));
      body.querySelector('.undo-today')!.addEventListener('click', () => undo(startOfToday(), 'all of today'));
      body.querySelector('.redo')!.addEventListener('click', () => {
        const { result } = app.sheet(`<h2>Redo placement?</h2><p>${esc(child.name)}’s stars stay. Skipped levels are re-checked with a few new questions.</p>`, [
          { label: 'Redo placement', value: true, kind: 'mint' },
          { label: 'Cancel', value: false, kind: 'ghost', back: true },
        ], 'Redo placement');
        void result.then((yes) => {
          if (!yes) return;
          app.save.update(() => {
            child.progress.skipped = freshProgress().skipped;
            child.placed = false;
          });
          app.toast('Placement will run next time they play.');
        });
      });
      body.querySelector('.reset-kid')!.addEventListener('click', () => {
        const { result } = app.sheet(`<h2>Start ${esc(child.name)} over?</h2><p>All stars, coins, jars, rewards earned, statistics and play history are cleared. Name, age and picture stay, and placement runs again. This can’t be undone.</p>`, [
          { label: 'Start over', value: true, kind: 'danger' },
          { label: 'Cancel', value: false, kind: 'ghost', back: true },
        ], 'Start over');
        void result.then((yes) => {
          if (!yes) return;
          app.save.update(() => resetChild(child, app.today));
          app.toast(`${child.name} is starting fresh.`);
          void app.show(reportScreen(child, 'manage'));
        });
      });
      body.querySelector('.delete-kid')!.addEventListener('click', () => {
        const { result } = app.sheet(`<h2>Delete ${esc(child.name)}’s profile?</h2><p>${esc(child.name)}’s progress, coins, rewards and face-off scores are removed from this phone. This can’t be undone.</p>`, [
          { label: 'Delete profile', value: true, kind: 'danger' },
          { label: 'Cancel', value: false, kind: 'ghost', back: true },
        ], 'Delete profile');
        void result.then((yes) => {
          if (!yes) return;
          app.save.update((d) => removeChild(d, child.id));
          app.toast(`${child.name}’s profile was deleted.`);
          void app.show(app.save.data.children.length ? parentScreen : addChildScreen(false));
        });
      });
    }
    return { el, mounted: () => show(start) };
  };
}
