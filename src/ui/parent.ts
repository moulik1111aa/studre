// Parent area (behind the grown-up check): children, time limit, holiday mode, reward
// categories, sound/voice, redo placement, and a progress report per child.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child, Settings } from '../storage/save.ts';
import { CATEGORIES, rewardById } from '../core/rewards.ts';
import { AREAS } from '../core/areas/index.ts';
import { isMastered } from '../core/path.ts';
import { addDays } from '../core/economy.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { stagger } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { addChildScreen, limitsScreen } from './setup.ts';
import { freshProgress } from '../core/path.ts';

const TOGGLES: { key: keyof Settings; label: string; note: string }[] = [
  { key: 'holiday', label: 'Holiday mode', note: 'Rewards don’t melt while you’re away or unwell.' },
  { key: 'voice', label: 'Read questions aloud', note: 'Uses the phone’s English voice.' },
  { key: 'sound', label: 'Sound effects', note: 'Taps, cheers and coins.' },
  { key: 'vibration', label: 'Vibration', note: 'Gentle buzzes on taps and answers.' },
];

export function parentScreen(app: App): Screen {
  const st = app.save.data.settings;
  const el = html(`<section class="screen parent" aria-label="Parent area">
    <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Parent area</span><span style="width:50px"></span></header>
    <div class="scroll pa-body">
      <h2 class="pa-h">Children</h2>
      <div class="pa-kids">${app.save.data.children
        .map((c) => `<div class="pa-kid card">${avatarHtml(c.avatar, 52)}<div><b>${esc(c.name)}</b><small>Age ${c.age}</small></div>
          <button class="btn ghost small report" data-id="${c.id}">${ICONS.chart} Report</button></div>`)
        .join('')}</div>
      <button class="btn ghost small add-kid">+ Add a child</button>
      <h2 class="pa-h">Play time</h2>
      <button class="pa-row card limits"><b>${st.limitMinutes} minutes a day</b><small>${st.timeUpMode === 'stop' ? 'Stops when time is up' : 'Keeps playing without coins'}</small></button>
      <h2 class="pa-h">Settings</h2>
      <div class="card pa-toggles">${TOGGLES.map((t) => `<label class="toggle-row"><span><b>${t.label}</b><small>${t.note}</small></span><input type="checkbox" role="switch" data-k="${t.key}" ${st[t.key] ? 'checked' : ''}></label>`).join('')}</div>
      <h2 class="pa-h">Reward categories</h2>
      <div class="card pa-cats">${CATEGORIES.map((c) => `<label class="toggle-row"><span><b>${c.icon} ${esc(c.name)}</b></span><input type="checkbox" role="switch" data-c="${c.id}" ${st.hiddenCategories.includes(c.id) ? '' : 'checked'}></label>`).join('')}</div>
    </div>
  </section>`);
  el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(whosPlayingScreen));
  el.querySelector('.add-kid')!.addEventListener('click', () => void app.show(addChildScreen(false)));
  el.querySelector('.limits')!.addEventListener('click', () => void app.show(limitsScreen(false)));
  el.querySelectorAll<HTMLInputElement>('[data-k]').forEach((i) =>
    i.addEventListener('change', () => {
      const k = i.dataset.k as keyof Settings;
      app.save.update((d) => ((d.settings as unknown as Record<string, boolean>)[k] = i.checked));
      if (k === 'sound') app.sfx.enabled = i.checked;
      if (k === 'voice') app.voice.enabled = i.checked;
      if (k === 'vibration') app.haptics.enabled = i.checked;
    }),
  );
  el.querySelectorAll<HTMLInputElement>('[data-c]').forEach((i) =>
    i.addEventListener('change', () =>
      app.save.update((d) => {
        const set = new Set(d.settings.hiddenCategories);
        if (i.checked) set.delete(i.dataset.c!);
        else set.add(i.dataset.c!);
        d.settings.hiddenCategories = [...set];
      }),
    ),
  );
  el.querySelectorAll<HTMLButtonElement>('.report').forEach((b) =>
    b.addEventListener('click', () => void app.show(reportScreen(app.save.data.children.find((c) => c.id === b.dataset.id)!))),
  );
  return { el, mounted: () => stagger(el.querySelectorAll('.pa-body > *'), { gap: 40 }) };
}

const STRANDS: [string, string][] = [
  ['number', 'Numbers'],
  ['addsub', 'Add & subtract'],
  ['muldiv', 'Times & divide'],
  ['fdp', 'Fractions & decimals'],
  ['algebra', 'Algebra & powers'],
  ['mental', 'Mental tricks'],
  ['word', 'Word problems'],
];

export function reportScreen(child: Child) {
  return (app: App): Screen => {
    const skills = AREAS[0].skills.flat();
    const strandRows = STRANDS.map(([id, name]) => {
      const list = skills.filter((s) => s.strand === id);
      if (!list.length) return '';
      const m = list.filter((s) => isMastered(child.progress, s.id)).length;
      const sk = list.filter((s) => child.progress.skipped[s.id] && !isMastered(child.progress, s.id)).length;
      return `<div class="rep-row"><span>${name}</span><div class="rep-bar"><i style="width:${(100 * m) / list.length}%"></i><i class="sk" style="width:${(100 * sk) / list.length}%"></i></div><b>${m}/${list.length}</b></div>`;
    }).join('');
    const days = Array.from({ length: 14 }, (_, i) => addDays(app.today, i - 13));
    const max = Math.max(app.save.data.settings.limitMinutes * 60, ...days.map((d) => child.stats.secondsByDay[d] ?? 0));
    const bars = days.map((d) => {
      const s = child.stats.secondsByDay[d] ?? 0;
      return `<div class="day" title="${d}: ${Math.round(s / 60)} min"><i style="height:${Math.max(2, (100 * s) / max)}%"></i><small>${d.slice(8)}</small></div>`;
    }).join('');
    const earned = child.wallet.earned.map((e) => `<li>${rewardById(e.rewardId)?.icon ?? '🎁'} ${esc(rewardById(e.rewardId)?.name ?? '')} <small>${e.day}</small></li>`).join('') || '<li><small>None yet</small></li>';
    const acc = child.stats.answered ? Math.round((100 * child.stats.correct) / child.stats.answered) : 0;
    const el = html(`<section class="screen report" aria-label="Progress report">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">${esc(child.name)}’s progress</span><span style="width:50px"></span></header>
      <div class="scroll pa-body">
        <div class="card rep-sum"><div><b>${skills.filter((s) => isMastered(child.progress, s.id)).length}</b><small>skills mastered</small></div><div><b>${acc}%</b><small>answers right</small></div><div><b>${child.bossesBeaten.length}</b><small>bosses beaten</small></div></div>
        <h2 class="pa-h">Skills by strand</h2><div class="card rep-strands">${strandRows}<p class="fine">Lighter part = skipped at placement.</p></div>
        <h2 class="pa-h">Minutes played (last 14 days)</h2><div class="card rep-days">${bars}</div>
        <h2 class="pa-h">Rewards earned</h2><ul class="card rep-earned">${earned}</ul>
        <button class="btn ghost small redo">Redo placement</button>
      </div>
    </section>`);
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(parentScreen));
    el.querySelector('.redo')!.addEventListener('click', () => {
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
    return { el, mounted: () => stagger(el.querySelectorAll('.pa-body > *'), { gap: 50 }) };
  };
}
