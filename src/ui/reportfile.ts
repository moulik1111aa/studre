// The exported report card: one .html file that opens in any browser (and prints neatly),
// with the child's backup inside so MN on another phone can import it.

import { esc, type App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS, skillById } from '../core/areas/index.ts';
import { isMastered, frontier, TIER_NAMES, type Level, type Tier } from '../core/path.ts';
import { addDays, jarProgress } from '../core/economy.ts';
import { rewardById, costOf } from '../core/rewards.ts';
import { BOSSES, bossFor } from '../core/boss.ts';
import { pct, spanFigures, dayFigures, streaks, strengths, pathProgress, skillFigures } from '../core/stats.ts';
import { backupJson, type Backup } from '../core/backup.ts';
import { plusFaceSvg } from './plus.ts';
import { schoolLabel } from './school.ts';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};
const name = (id: string) => skillById(id)?.name ?? id;
function label(l: Level | undefined): string {
  if (!l) return 'Everything done!';
  if (l.kind === 'skill') return `${name(l.skillId)} · ${TIER_NAMES[l.tier]}`;
  return l.kind === 'review' ? 'Minion fight' : `Boss: ${bossFor(l.stage, l.boss).name}`;
}

/** File name: MN-Riya-report-2026-10-25.html */
export const reportFileName = (child: Child, today: string) => `MN-${child.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'child'}-report-${today}.html`;

export function reportCardHtml(app: App, child: Child, backup: Backup): string {
  const today = app.today;
  const secs = child.stats.secondsByDay;
  const log = child.log ?? [];
  const path = app.pathFor(child);
  const front = path[frontier(path, child.progress)];
  const skills = AREAS[0].skills.flat();
  const prog = pathProgress(path, child.progress);
  const st = streaks(secs, today);
  const totalMin = Math.round(Object.values(secs).reduce((a, b) => a + b, 0) / 60);
  const daysPlayed = Object.values(secs).filter((s) => s > 0).length;
  const week = spanFigures(secs, log, today, 7);
  const last = spanFigures(secs, log, addDays(today, -7), 7);
  const month = spanFigures(secs, log, today, 30);
  const { best, practise } = strengths(child.tally ?? {});
  const figs = skillFigures(child.tally ?? {});
  const answers = figs.reduce((a, f) => a + f.answers, 0);
  const speed = answers ? figs.reduce((a, f) => a + f.speed * f.answers, 0) / answers : 0;
  const passed = Object.values(child.progress.levels).filter((l) => l.stars >= 1).length;
  const mastered = skills.filter((s) => isMastered(child.progress, s.id)).length;
  const stage = AREAS[0].stages[(front?.stage ?? 7) - 1];
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const max14 = Math.max(1, ...days14.map((d) => dayFigures(secs, log, d).minutes));
  const strands: [string, string][] = [['number', 'Numbers & place value'], ['addsub', 'Adding & subtracting'], ['muldiv', 'Times & division'], ['fdp', 'Fractions & decimals'], ['algebra', 'Algebra & powers'], ['mental', 'Mental tricks'], ['word', 'Word problems']];
  const kpi = (v: string | number, l: string) => `<div class="k"><b>${v}</b><span>${l}</span></div>`;
  const row = (l: string, a: number, b: number, u = '') => `<tr><th>${l}</th><td>${a}${u}</td><td>${b}${u}</td></tr>`;
  const jar = (w: 'treat' | 'goal') => {
    const j = child.wallet[w];
    const r = j.rewardId ? rewardById(j.rewardId) : undefined;
    return r ? `<p>${r.icon} <b>${esc(r.name)}</b> (${w === 'treat' ? 'treat' : 'big goal'}): ${Math.floor(jarProgress(j) * 100)}%, ${Math.floor(j.coins)} of ${costOf(r)} coins</p>` : '';
  };
  const recent = log.slice(-30).reverse();

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(child.name)}’s MN report card · ${esc(nice(today))}</title>
<style>
:root{--ink:#1A1446;--soft:#5B567A;--faint:#8C88A8;--line:#E4E0F2;--accent:#5B3DF5;--sun:#E09A00;--good:#1F9D5B;--bad:#D6455B;--bg:#F6F4FF}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 18px 40px}
header{display:flex;align-items:center;gap:14px;margin-bottom:6px}
header svg{width:56px;height:56px;flex:none}
header h1{margin:0;font-size:26px;letter-spacing:-.02em}
header p{margin:0;color:var(--soft);font-weight:600}
section{background:#fff;border:1.5px solid var(--line);border-radius:18px;padding:16px 18px;margin:14px 0;break-inside:avoid}
h2{margin:0 0 10px;font-size:17px}
.who{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--soft);font-weight:600}
.who b{color:var(--ink)}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.k{border:1.5px solid var(--line);border-radius:14px;padding:10px 12px}
.k b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.k span{font-size:12.5px;font-weight:700;color:var(--soft)}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:6px 6px;border-bottom:1px solid var(--line);font-size:14px}
td{text-align:right}
thead th{font-size:12px;color:var(--faint)}
thead th:not(:first-child){text-align:right}
.bar{height:10px;border-radius:9px;background:var(--line);overflow:hidden;display:flex}
.bar i{display:block;height:100%;background:var(--accent)}
.bar i.sk{background:#B8ACFA}
.grid3{display:grid;grid-template-columns:1fr 110px 54px;gap:8px 12px;align-items:center;font-size:14px}
.grid3 .v{text-align:right;font-weight:700}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
ul{margin:0;padding-left:18px}
li{margin:3px 0}
.small{font-size:12.5px;color:var(--faint)}
.chart{display:flex;align-items:flex-end;gap:5px;height:120px;margin-top:6px}
.chart div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:3px}
.chart i{display:block;width:100%;border-radius:4px 4px 2px 2px;background:var(--accent)}
.chart small{font-size:10px;color:var(--faint)}
.stars{color:var(--sun);letter-spacing:-1px}
footer{margin-top:18px;padding:14px 16px;border-radius:14px;background:#EEEAFE;color:var(--soft);font-size:13px}
@media (max-width:560px){.two{grid-template-columns:1fr}}
@media print{body{background:#fff}section{border-color:#ccc}footer{display:none}}
</style></head>
<body><main>
<header>${plusFaceSvg()}<div><h1>${esc(child.name)}’s report card</h1><p>MN · Mission Next · ${esc(nice(today))}</p></div></header>

<section><div class="who"><span>Age <b>${child.age}</b></span><span>${child.school?.on ? `Path: <b>${esc(schoolLabel(child.school))}</b>` : `Stage <b>${front?.stage ?? 7}: ${esc(stage.name)}</b> (ages ${stage.ages})`}</span><span>Now on: <b>${esc(label(front))}</b></span>${child.createdDay ? `<span>Playing since <b>${esc(nice(child.createdDay))}</b></span>` : ''}</div></section>

<section><h2>At a glance</h2><div class="kpis">
${kpi(totalMin >= 60 ? `${Math.floor(totalMin / 60)} h ${totalMin % 60} m` : `${totalMin} min`, `time played over ${daysPlayed} days`)}
${kpi(child.stats.answered, 'questions answered')}
${kpi(`${pct(child.stats.correct, child.stats.answered)}%`, 'answers right')}
${kpi(passed, 'levels passed')}
${kpi(`${mastered} / ${skills.length}`, 'skills mastered')}
${kpi(`${prog.stars} / ${prog.maxStars}`, 'stars won')}
${kpi(`${st.current} (best ${st.best})`, 'day streak')}
${kpi(speed ? `${speed.toFixed(1)} s` : '–', 'per answer')}
${kpi(Math.round(child.wallet.lifetime), 'coins earned')}
${kpi(child.bossesBeaten.length, 'bosses beaten')}
</div></section>

<section><h2>Recent weeks</h2><table><thead><tr><th></th><th>This week</th><th>Last week</th></tr></thead><tbody>
${row('Minutes played', week.minutes, last.minutes)}${row('Days played', week.activeDays, last.activeDays)}${row('Levels', week.levels, last.levels)}${row('Questions', week.answers, last.answers)}${row('Answers right', pct(week.right, week.answers), pct(last.right, last.answers), '%')}
</tbody></table>
<p class="small">Last 30 days: ${month.minutes} minutes on ${month.activeDays} days, ${month.levels} levels, ${pct(month.right, month.answers)}% right.</p>
<div class="chart">${days14.map((d) => `<div><i style="height:${Math.max(2, (100 * dayFigures(secs, log, d).minutes) / max14)}%"></i><small>${Number(d.slice(8))}</small></div>`).join('')}</div>
<p class="small">Minutes played each day, last 14 days.</p></section>

<section><h2>Progress by stage</h2><div class="grid3">
${prog.stages.map((s) => { const i = AREAS[0].stages[s.stage - 1]; return `<span>${s.stage}. ${esc(i.name)} <span class="small">(ages ${i.ages})</span></span><div class="bar"><i style="width:${(100 * s.passed) / s.total}%"></i><i class="sk" style="width:${(100 * s.skipped) / s.total}%"></i></div><span class="v">${pct(s.passed + s.skipped, s.total)}%</span>`; }).join('')}
</div><p class="small">Light part: skipped at placement as too easy.</p></section>

<section><h2>Skills by strand</h2><div class="grid3">
${strands.map(([id, n]) => { const list = skills.filter((s) => s.strand === id); const m = list.filter((s) => isMastered(child.progress, s.id)).length; const t = figs.filter((f) => skillById(f.id)?.strand === id); const a = t.reduce((x, f) => x + f.answers, 0); const ok = t.reduce((x, f) => x + f.right, 0); return list.length ? `<span>${n}${a ? ` <span class="small">${pct(ok, a)}% right</span>` : ''}</span><div class="bar"><i style="width:${(100 * m) / list.length}%"></i></div><span class="v">${m}/${list.length}</span>` : ''; }).join('')}
</div><p class="small">Skills mastered (Master level passed) in each strand.</p></section>

<section class="two"><div><h2>💪 Strengths</h2>${best.length ? `<ul>${best.map((f) => `<li><b>${esc(name(f.id))}</b>: ${f.accuracy}% right (${f.answers} questions)</li>`).join('')}</ul>` : '<p class="small">Not enough answers yet.</p>'}</div>
<div><h2>🎯 Worth practising</h2>${practise.length ? `<ul>${practise.map((f) => `<li><b>${esc(name(f.id))}</b>: ${f.accuracy}% right (${f.answers} questions)</li>`).join('')}</ul>` : '<p class="small">Nothing below 80% right.</p>'}</div></section>

<section><h2>Levels passed by type</h2><table><tbody>${prog.tiers.map((n, i) => `<tr><th>${TIER_NAMES[(i + 1) as Tier]}</th><td>${n}</td></tr>`).join('')}</tbody></table></section>

${recent.length ? `<section><h2>Recent levels</h2><table><thead><tr><th>Level</th><th>Date</th><th>Score</th><th>Stars</th></tr></thead><tbody>
${recent.map((e) => `<tr><th>${esc(e.k === 'skill' ? `${name(e.id.split('#')[0])} · ${TIER_NAMES[(e.tier ?? 1) as Tier]}` : e.k === 'review' ? 'Minion fight' : e.k === 'quest' ? 'Side quest' : 'Boss fight')}</th><td>${esc(nice(e.d))}</td><td>${e.sc}/${e.of}</td><td class="stars">${'★'.repeat(e.s)}${'☆'.repeat(3 - e.s)}</td></tr>`).join('')}
</tbody></table></section>` : ''}

<section><h2>Rewards</h2>${jar('treat')}${jar('goal')}
<p>Rewards given: ${child.wallet.earned.length ? child.wallet.earned.map((e) => `${rewardById(e.rewardId)?.icon ?? '🎁'} ${esc(rewardById(e.rewardId)?.name ?? 'Reward')} (${esc(nice(e.day))})`).join(', ') : 'none yet'}.</p>
<p>Bosses beaten: ${child.bossesBeaten.length ? child.bossesBeaten.map((id) => esc(BOSSES.find((b) => b.id === id)?.name ?? id)).join(', ') : 'none yet'}.</p></section>

<footer><b>This file is also a backup.</b> To move ${esc(child.name)} to another phone, or to bring the progress back, open MN there and go to Parent area → Restore from a report card, then pick this file. If ${esc(child.name)} is already on that phone, the two are combined.</footer>
</main>
<script type="application/json" id="mn-backup">${backupJson(backup)}</script>
</body></html>`;
}
