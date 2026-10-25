// Parent area (behind the grown-up check): children, time limit, holiday mode, reward
// categories, sound/voice, redo placement, and a progress report per child.

import { schoolScreen, schoolLabel } from './school.ts';
import { reportScreen } from './report.ts';
import { restoreFromFile } from './restore.ts';
import { html, esc, type App, type Screen } from './app.ts';
import { type Child, type Settings, type Theme } from '../storage/save.ts';
import { CATEGORIES } from '../core/rewards.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { stagger } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { addChildScreen, limitsScreen } from './setup.ts';
import { voiceScreen } from './voicepick.ts';
import { lockSetupScreen } from './grownup.ts';
import { reelScreen } from './reel.ts';
import { accessState, lockScreen, niceDay } from './access.ts';
import { freshProgress } from '../core/path.ts';


export const CHALLENGE = [
  { name: 'Normal', icon: '🙂', note: 'as designed' },
  { name: 'Harder', icon: '🔥', note: 'tougher numbers, no hints' },
  { name: 'Toughest', icon: '🔥🔥', note: 'hardest numbers, timers on' },
] as const;

const paceText = (v: number, jar: 'treat' | 'goal'): string => {
  const days = (jar === 'treat' ? 10 : 90) * v;
  return days < 10 ? `every ${Math.round(days)} days` : days < 26 ? `every ${Math.round(days / 7)} weeks`.replace('every 1 weeks', 'weekly') : `in ${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'}`;
};

/** The timer slider: 5–60 seconds, and one more notch at the end for no timer. */
const TIMER_MIN = 5;
const TIMER_OFF = 65;
const TIMER_MARKS: [number, string][] = [[5, 'Hard'], [15, 'Normal'], [30, 'Easy'], [50, 'Relaxed'], [65, 'No timer']];
function timerNote(secs: number): string {
  if (!secs) return 'No timer on levels. Boss fights still need one, so they get a whole minute.';
  if (secs <= 10) return 'Hard: quick recall, for children who know their facts well.';
  if (secs <= 20) return 'Normal: about right for most children.';
  if (secs <= 40) return 'Easy: plenty of time to work it out.';
  return 'Relaxed: no rush at all.';
}

const TOGGLES: { key: keyof Settings; label: string; note: string }[] = [
  { key: 'holiday', label: 'Holiday mode', note: 'Rewards don’t melt while you’re away or unwell.' },
  { key: 'voice', label: 'Read questions aloud', note: 'Uses the phone’s English voice.' },
  { key: 'confirmAnswers', label: 'Confirm answers', note: 'Tap an answer, then Check. Fewer slips from a stray tap.' },
  { key: 'teach', label: 'Show how after a mistake', note: 'A short step-by-step lesson when an answer is wrong.' },
  { key: 'fx3d', label: '3D boss fights', note: 'Turn off if fights feel slow on this phone.' },
  { key: 'showFps', label: 'Show frame rate', note: 'For testing: how smoothly the app runs.' },
  { key: 'sound', label: 'Sound effects', note: 'Taps, cheers and coins.' },
  { key: 'vibration', label: 'Vibration', note: 'Gentle buzzes on taps and answers.' },
];

const THEME_CHOICES: { id: Theme; name: string; note: string }[] = [
  { id: 'playground', name: 'Playground', note: 'Bright sky, buttons that click like toys' },
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
          <div class="pa-kid-btns"><button class="btn ghost small level-btn" data-id="${c.id}">${CHALLENGE[c.challenge ?? 0].icon} ${CHALLENGE[c.challenge ?? 0].name}</button><button class="btn ghost small report" data-id="${c.id}">${ICONS.chart} Report</button><button class="btn ghost small age-btn" data-id="${c.id}">🎂 Age ${c.age}</button><button class="btn ghost small school-btn" data-id="${c.id}">📚 ${c.school?.on ? esc(schoolLabel(c.school)) : 'School path'}</button><button class="btn ghost small assist-btn${c.assisted ? ' on' : ''}" data-id="${c.id}" aria-pressed="${!!c.assisted}">👪 With a grown-up: ${c.assisted ? 'on' : 'off'}</button></div></div>`)
        .join('')}</div>
      <button class="btn ghost small add-kid">+ Add a child</button>
      <button class="btn ghost small restore-kid">⤓ Restore from a report card</button>
      <h2 class="pa-h">Play time and rewards</h2>
      <button class="pa-row card limits"><b>${st.limitMinutes} minutes a day</b><small>${st.timeUpMode === 'stop' ? 'Stops when time is up' : 'Keeps playing without coins'} · treats ${paceText(st.treatPace, 'treat')}, big toy ${paceText(st.goalPace, 'goal')}</small></button>
      <h2 class="pa-h">Look</h2>
      <div class="themes" role="radiogroup" aria-label="Look of the app">${THEME_CHOICES.map((t) => `<button class="theme-tile th-${t.id}${st.theme === t.id ? ' on' : ''}" role="radio" aria-checked="${st.theme === t.id}" data-theme-id="${t.id}"><span class="th-swatch"><i></i><i></i><i></i></span><b>${t.name}</b><small>${t.note}</small></button>`).join('')}</div>
      <h2 class="pa-h">Settings</h2>
      <button class="pa-row card voice-row"><b>Reading voice</b><small>${st.voiceName ? 'Chosen voice' : 'Automatic (clearest)'} · ${st.voiceRate < 0.9 ? 'slow' : st.voiceRate > 1 ? 'quick' : 'normal speed'}</small></button>
      <div class="card pa-timer"><div class="pt-head"><b>Time per question</b><span class="pt-val"></span></div>
        <small>For timed levels (Speed and Master) and boss fights.</small>
        <input type="range" class="slider pt-slider" min="${TIMER_MIN}" max="${TIMER_OFF}" step="5" value="${st.timerSeconds || TIMER_OFF}" aria-label="Seconds per question">
        <div class="pt-marks" aria-hidden="true">${TIMER_MARKS.map(([v, t]) => `<span style="--at:${(100 * (v - TIMER_MIN)) / (TIMER_OFF - TIMER_MIN)}%">${t}</span>`).join('')}</div>
        <p class="pt-note"></p></div>
      <div class="card pa-toggles">${TOGGLES.map((t) => `<label class="toggle-row"><span><b>${t.label}</b><small>${t.note}</small></span><input type="checkbox" role="switch" data-k="${t.key}" ${st[t.key] ? 'checked' : ''}></label>`).join('')}</div>
      ${faceoffRows(app)}
      <button class="pa-row card lock-row"><b>Grown-up lock</b><small>${st.parentPin ? 'Parent PIN' : 'This phone’s screen lock'}</small></button>
      <h2 class="pa-h">Access key</h2>
      <button class="pa-row card key-row"><b>Access key</b><small class="key-left">Checking…</small></button>
      <h2 class="pa-h">How it works</h2>
      <button class="pa-row card story-row"><b>▶ Watch the one-minute video</b><small>What MN does and how it keeps children going</small></button>
      <button class="pa-row card tips-row"><b>Show Plus’s map tips again</b><small>Each child sees the tips the next time they open the map</small></button>
      <h2 class="pa-h">Reward categories</h2>
      <div class="card pa-cats">${CATEGORIES.map((c) => `<label class="toggle-row"><span><b>${c.icon} ${esc(c.name)}</b></span><input type="checkbox" role="switch" data-c="${c.id}" ${st.hiddenCategories.includes(c.id) ? '' : 'checked'}></label>`).join('')}</div>
    </div>
  </section>`);
  el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(whosPlayingScreen));
  el.querySelector('.add-kid')!.addEventListener('click', () => void app.show(addChildScreen(false)));
  el.querySelector('.restore-kid')!.addEventListener('click', () => void restoreFromFile(app, () => void app.show(parentScreen)));
  el.querySelector('.limits')!.addEventListener('click', () => void app.show(limitsScreen(false)));
  el.querySelector('.voice-row')!.addEventListener('click', () => void app.show(voiceScreen));
  const ts = el.querySelector<HTMLInputElement>('.pt-slider')!;
  const paintTimer = () => {
    const v = Number(ts.value);
    const secs = v >= TIMER_OFF ? 0 : v;
    el.querySelector('.pt-val')!.textContent = secs ? `${secs} seconds` : 'No timer';
    el.querySelector('.pt-note')!.textContent = timerNote(secs);
    ts.style.setProperty('--p', `${(100 * (v - TIMER_MIN)) / (TIMER_OFF - TIMER_MIN)}%`);
    return secs;
  };
  paintTimer();
  ts.addEventListener('input', paintTimer);
  ts.addEventListener('change', () => {
    const secs = paintTimer();
    app.save.update((d) => (d.settings.timerSeconds = secs));
  });
  el.querySelector('.lock-row')!.addEventListener('click', () => void app.show(lockSetupScreen(parentScreen)));
  void accessState(app).then((st) => {
    const small = el.querySelector('.key-left')!;
    small.textContent = st.locked ? 'No working key' : st.owner ? 'Owner’s phone: always unlocked' : st.until !== undefined ? `Works until ${niceDay(st.until)} · phone code ${st.phone}` : `Phone code ${st.phone}`;
    el.querySelector('.key-row')!.addEventListener('click', () => void app.show(lockScreen(st, () => void app.show(parentScreen), { renew: true, back: () => void app.show(parentScreen) })));
  });
  el.querySelector('.story-row')!.addEventListener('click', () => void app.show(reelScreen({ first: false, label: 'Done', done: () => void app.show(parentScreen) }), 'liquid'));
  el.querySelector('.tips-row')!.addEventListener('click', () => {
    app.save.update((d) => d.children.forEach((c) => (c.toured = false)));
    app.toast('Done. The tips show next time each child opens the map.');
  });
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
  el.querySelectorAll<HTMLButtonElement>('.school-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const c = app.save.data.children.find((x) => x.id === b.dataset.id);
      if (c) void app.show(schoolScreen(c, parentScreen));
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('.age-btn').forEach((b) =>
    b.addEventListener('click', () => void app.show(ageScreen(app.save.data.children.find((k) => k.id === b.dataset.id)!))),
  );
  el.querySelectorAll<HTMLButtonElement>('.assist-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const c = app.save.data.children.find((k) => k.id === b.dataset.id)!;
      app.save.update(() => (c.assisted = !c.assisted));
      app.toast(c.assisted ? `Assisted mode on: play alongside ${c.name}. No timers; after a slip they try one like it.` : `Assisted mode off for ${c.name}.`);
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

/** Change a child's age. Levels below the new age are moved out of the way; a younger age opens a redo of placement. */
function ageScreen(child: Child) {
  return (app: App): Screen => {
    let age = child.age;
    const el = html(`<section class="screen add-child age-edit" aria-label="Change age">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Change age</span><span style="width:50px"></span></header>
      <div class="scroll ac-body">
        <h1 class="ac-q">How old is ${esc(child.name)}?</h1>
        <div class="ac-ages">${Array.from({ length: 14 }, (_, k) => k + 3).map((a) => `<button class="ac-age${a === age ? ' on' : ''}" data-age="${a}">${a}</button>`).join('')}</div>
        <p class="fine">Stars, coins and rewards stay. Questions follow the new age.</p>
      </div>
      <button class="btn ac-next">Save</button>
    </section>`);
    el.querySelector('.ac-ages')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.ac-age');
      if (!b) return;
      age = Number(b.dataset.age);
      el.querySelectorAll('.ac-age').forEach((x) => x.classList.toggle('on', x === b));
    });
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(parentScreen));
    el.querySelector('.ac-next')!.addEventListener('click', () => {
      const younger = age < child.age;
      app.save.update(() => {
        child.age = age;
        // Younger: look again at where to start (placement runs next time they play).
        if (younger && child.placed) {
          child.placed = false;
          child.progress.skipped = freshProgress().skipped;
        }
      });
      app.toast(younger ? `${child.name} is now ${age}. A few placement questions come next time they play.` : `${child.name} is now ${age}.`);
      void app.show(parentScreen);
    });
    return { el, back: () => (void app.show(parentScreen), true) };
  };
}
