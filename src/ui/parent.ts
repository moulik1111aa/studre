// Parent area (behind the grown-up check): children, time limit, holiday mode, reward
// categories, sound/voice, redo placement, and a progress report per child.

import { html, esc, type App, type Screen } from './app.ts';
import { resetChild, removeChild, type Child, type Settings, type Theme } from '../storage/save.ts';
import { CATEGORIES, rewardById } from '../core/rewards.ts';
import { AREAS } from '../core/areas/index.ts';
import { isMastered } from '../core/path.ts';
import { addDays } from '../core/economy.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { stagger } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { addChildScreen, limitsScreen } from './setup.ts';
import { voiceScreen } from './voicepick.ts';
import { freshProgress } from '../core/path.ts';
import { changesSince, rollback } from '../core/undo.ts';

const startOfToday = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const CHALLENGE = [
  { name: 'Normal', icon: '🙂', note: 'as designed' },
  { name: 'Harder', icon: '🔥', note: 'tougher numbers, no hints' },
  { name: 'Toughest', icon: '🔥🔥', note: 'hardest numbers, timers on' },
] as const;

const paceText = (v: number, jar: 'treat' | 'goal'): string => {
  const days = (jar === 'treat' ? 10 : 90) * v;
  return days < 10 ? `every ${Math.round(days)} days` : days < 26 ? `every ${Math.round(days / 7)} weeks`.replace('every 1 weeks', 'weekly') : `in ${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'}`;
};

const TOGGLES: { key: keyof Settings; label: string; note: string }[] = [
  { key: 'holiday', label: 'Holiday mode', note: 'Rewards don’t melt while you’re away or unwell.' },
  { key: 'voice', label: 'Read questions aloud', note: 'Uses the phone’s English voice.' },
  { key: 'confirmAnswers', label: 'Confirm answers', note: 'Tap an answer, then Check. Fewer slips from a stray tap.' },
  { key: 'fx3d', label: '3D boss fights', note: 'Turn off if fights feel slow on this phone.' },
  { key: 'showFps', label: 'Show frame rate', note: 'For testing: how smoothly the app runs.' },
  { key: 'sound', label: 'Sound effects', note: 'Taps, cheers and coins.' },
  { key: 'vibration', label: 'Vibration', note: 'Gentle buzzes on taps and answers.' },
];

const THEME_CHOICES: { id: Theme; name: string; note: string }[] = [
  { id: 'glass', name: 'Glass', note: 'Deep colour, frosted panels' },
  { id: 'schoolbook', name: 'Schoolbook', note: 'Graph paper and ink' },
  { id: 'precision', name: 'Precision', note: 'White, one strong blue' },
];

export function parentScreen(app: App): Screen {
  const st = app.save.data.settings;
  const el = html(`<section class="screen parent" aria-label="Parent area">
    <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Parent area</span><span style="width:50px"></span></header>
    <div class="scroll pa-body">
      <h2 class="pa-h">Children</h2>
      <div class="pa-kids">${app.save.data.children
        .map((c) => `<div class="pa-kid card">${avatarHtml(c.avatar, 52)}<div><b>${esc(c.name)}</b><small>Age ${c.age}</small></div>
          <div class="pa-kid-btns"><button class="btn ghost small level-btn" data-id="${c.id}">${CHALLENGE[c.challenge ?? 0].icon} ${CHALLENGE[c.challenge ?? 0].name}</button><button class="btn ghost small report" data-id="${c.id}">${ICONS.chart} Report</button></div></div>`)
        .join('')}</div>
      <button class="btn ghost small add-kid">+ Add a child</button>
      <h2 class="pa-h">Play time and rewards</h2>
      <button class="pa-row card limits"><b>${st.limitMinutes} minutes a day</b><small>${st.timeUpMode === 'stop' ? 'Stops when time is up' : 'Keeps playing without coins'} · treats ${paceText(st.treatPace, 'treat')}, big toy ${paceText(st.goalPace, 'goal')}</small></button>
      <h2 class="pa-h">Look</h2>
      <div class="themes" role="radiogroup" aria-label="Look of the app">${THEME_CHOICES.map((t) => `<button class="theme-tile th-${t.id}${st.theme === t.id ? ' on' : ''}" role="radio" aria-checked="${st.theme === t.id}" data-theme-id="${t.id}"><span class="th-swatch"><i></i><i></i><i></i></span><b>${t.name}</b><small>${t.note}</small></button>`).join('')}</div>
      <h2 class="pa-h">Settings</h2>
      <button class="pa-row card voice-row"><b>Reading voice</b><small>${st.voiceName ? 'Chosen voice' : 'Automatic (clearest)'} · ${st.voiceRate < 0.9 ? 'slow' : st.voiceRate > 1 ? 'quick' : 'normal speed'}</small></button>
      <div class="card pa-toggles">${TOGGLES.map((t) => `<label class="toggle-row"><span><b>${t.label}</b><small>${t.note}</small></span><input type="checkbox" role="switch" data-k="${t.key}" ${st[t.key] ? 'checked' : ''}></label>`).join('')}</div>
      ${faceoffRows(app)}
      <h2 class="pa-h">Reward categories</h2>
      <div class="card pa-cats">${CATEGORIES.map((c) => `<label class="toggle-row"><span><b>${c.icon} ${esc(c.name)}</b></span><input type="checkbox" role="switch" data-c="${c.id}" ${st.hiddenCategories.includes(c.id) ? '' : 'checked'}></label>`).join('')}</div>
    </div>
  </section>`);
  el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(whosPlayingScreen));
  el.querySelector('.add-kid')!.addEventListener('click', () => void app.show(addChildScreen(false)));
  el.querySelector('.limits')!.addEventListener('click', () => void app.show(limitsScreen(false)));
  el.querySelector('.voice-row')!.addEventListener('click', () => void app.show(voiceScreen));
  el.querySelectorAll<HTMLButtonElement>('.theme-tile').forEach((b) =>
    b.addEventListener('click', () => {
      const theme = b.dataset.themeId as Theme;
      app.save.update((d) => (d.settings.theme = theme));
      app.applyTheme(theme);
      el.querySelectorAll('.theme-tile').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
    }),
  );
  el.querySelectorAll<HTMLInputElement>('[data-k]').forEach((i) =>
    i.addEventListener('change', () => {
      const k = i.dataset.k as keyof Settings;
      app.save.update((d) => ((d.settings as unknown as Record<string, boolean>)[k] = i.checked));
      if (k === 'sound') app.sfx.enabled = i.checked;
      if (k === 'voice') app.voice.enabled = i.checked;
      if (k === 'vibration') app.haptics.enabled = i.checked;
      if (k === 'showFps') app.fps.set(i.checked);
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
  el.querySelectorAll<HTMLButtonElement>('.level-btn').forEach((b) =>
    b.addEventListener('click', async () => {
      const c = app.save.data.children.find((k) => k.id === b.dataset.id)!;
      const actions: { label: string; value: number; kind: 'mint' | 'ghost'; back?: boolean }[] = [
        ...CHALLENGE.map((x, i) => ({ label: `${x.icon} ${x.name} — ${x.note}`, value: i, kind: i === (c.challenge ?? 0) ? ('mint' as const) : ('ghost' as const) })),
        { label: 'Cancel', value: -1, kind: 'ghost', back: true },
      ];
      const { result } = app.sheet(`<h2>How hard for ${esc(c.name)}?</h2><p>The skills stay the same; the numbers get tougher.</p>`, actions, 'Difficulty');
      const v = await result;
      if (v === -1) return;
      app.save.update(() => (c.challenge = v as 0 | 1 | 2));
      void app.show(parentScreen);
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('.report').forEach((b) =>
    b.addEventListener('click', () => void app.show(reportScreen(app.save.data.children.find((c) => c.id === b.dataset.id)!))),
  );
  return { el, mounted: () => stagger(el.querySelectorAll('.pa-body > *'), { gap: 40 }) };
}

function faceoffRows(app: App): string {
  const kids = app.save.data.children;
  const nameOf = (id: string) => (id === 'guest' ? 'Guest' : kids.find((k) => k.id === id)?.name ?? 'Someone');
  const rows = Object.entries(app.save.data.faceoff).map(([key, [x, y]]) => {
    const [a, b] = key.split('|');
    return `<div class="fo-row"><span>${esc(nameOf(a))}</span><b>${x} – ${y}</b><span>${esc(nameOf(b))}</span></div>`;
  });
  return rows.length ? `<h2 class="pa-h">Face-off scores</h2><div class="card fo-board">${rows.join('')}</div>` : '';
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
        <h2 class="pa-h">Undo recent play</h2>
        <div class="card undo-card"><p class="fine">Someone else played on ${esc(child.name)}’s profile? Remove it. Stars, coins and time go back to how they were.</p>
          <button class="btn ghost small undo-hour"${changesSince(child, Date.now() - 3_600_000) ? '' : ' disabled'}>Remove the last hour (${changesSince(child, Date.now() - 3_600_000)})</button>
          <button class="btn ghost small undo-today"${changesSince(child, startOfToday()) ? '' : ' disabled'}>Remove all of today (${changesSince(child, startOfToday())})</button></div>
        <button class="btn ghost small redo">Redo placement</button>
        <h2 class="pa-h">Profile</h2>
        <div class="card undo-card profile-card"><p class="fine">Start over clears ${esc(child.name)}’s stars, coins, jars and rewards earned, and runs placement again. Delete removes the profile completely.</p>
          <button class="btn ghost small warn reset-kid">Start ${esc(child.name)} over</button>
          <button class="btn ghost small warn delete-kid">Delete ${esc(child.name)}’s profile</button></div>
      </div>
    </section>`);
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(parentScreen));
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
        void app.show(reportScreen(child));
      });
    };
    el.querySelector('.undo-hour')!.addEventListener('click', () => undo(Date.now() - 3_600_000, 'the last hour'));
    el.querySelector('.undo-today')!.addEventListener('click', () => undo(startOfToday(), 'all of today'));
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
    el.querySelector('.reset-kid')!.addEventListener('click', () => {
      const { result } = app.sheet(`<h2>Start ${esc(child.name)} over?</h2><p>All stars, coins, jars, rewards earned and play history are cleared. Name, age and picture stay, and placement runs again. This can’t be undone.</p>`, [
        { label: 'Start over', value: true, kind: 'danger' },
        { label: 'Cancel', value: false, kind: 'ghost', back: true },
      ], 'Start over');
      void result.then((yes) => {
        if (!yes) return;
        app.save.update(() => resetChild(child, app.today));
        app.toast(`${child.name} is starting fresh.`);
        void app.show(reportScreen(child));
      });
    });
    el.querySelector('.delete-kid')!.addEventListener('click', () => {
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
    return { el, mounted: () => stagger(el.querySelectorAll('.pa-body > *'), { gap: 50 }) };
  };
}
