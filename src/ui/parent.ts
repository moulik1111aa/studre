// Parent area (behind the grown-up check). It opens on the everyday settings: children
// (report, and their own settings), daily play time, sound, the look and backups. The rest
// sits in groups (learning, notes, audio, device, security, help) in a ☰ side menu, like a
// game's settings. Each child's own settings (age, difficulty, school path,
// Adventure, dragon map, with a grown-up) live on that child's page.

import { showParentAdventureTips, toggleAdventure } from './adventure.ts';
import { DRAGON_MAP } from './foldmap.ts';
import { backUpNow, lastBackupText } from './backup.ts';
import { askNotifications, notificationState } from './remindsync.ts';
import { DEFAULT_REMINDERS, type ReminderSettings } from '../core/reminders.ts';
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
import { MENU_ICON, openDrawer } from './drawer.ts';


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

type Toggle = { key: keyof Settings; label: string; note: string };
const T = (key: keyof Settings, label: string, note: string): Toggle => ({ key, label, note });
const toggleRows = (st: Settings, list: Toggle[]) => list.map((t) => `<label class="toggle-row"><span><b>${t.label}</b><small>${t.note}</small></span><input type="checkbox" role="switch" data-k="${t.key}" ${st[t.key] ? 'checked' : ''}></label>`).join('');

const THEME_CHOICES: { id: Theme; name: string; note: string }[] = [
  { id: 'playground', name: 'Playground', note: 'Bright sky, buttons that click like toys' },
  { id: 'glass', name: 'Glass', note: 'Deep colour, frosted panels' },
  { id: 'schoolbook', name: 'Schoolbook', note: 'Graph paper and ink' },
  { id: 'precision', name: 'Precision', note: 'White, one strong blue' },
];

/** Advanced settings come in groups, like the tabs down the side of a game's settings. */
type Group = 'learning' | 'notes' | 'audio' | 'device' | 'security' | 'help';
const GROUPS: { id: Group; icon: string; name: string; note: string }[] = [
  { id: 'learning', icon: '🎓', name: 'Learning', note: 'Timers, checking answers, lessons, rewards' },
  { id: 'notes', icon: '🔔', name: 'Notes', note: 'Melt watch, backup reminders, widgets' },
  { id: 'audio', icon: '🔊', name: 'Audio', note: 'Reading voice, sound, vibration' },
  { id: 'device', icon: '📱', name: 'Device', note: '3D fights, frame rate' },
  { id: 'security', icon: '🔒', name: 'Security', note: 'Grown-up lock, access key' },
  { id: 'help', icon: '❓', name: 'Help', note: 'Video, tips, what Adventure is' },
];

/** The page the grown-up is on (kept while they visit a sub-screen and come back). */
type Page = 'basic' | Group;
let page: Page = 'basic';

const kidLine = (c: Child): string => [`Age ${c.age}`, c.adventure?.on ? 'Adventure' : '', c.school?.on ? 'School path' : '', (c.challenge ?? 0) > 0 ? CHALLENGE[c.challenge ?? 0].name : ''].filter(Boolean).join(' · ');

function basicHtml(app: App): string {
  const st = app.save.data.settings;
  return `
    <section class="pa-sec"><h2 class="pa-h">👧 Children</h2>
      <div class="pa-kids">${app.save.data.children
        .map((c) => `<div class="pa-kid card">${avatarHtml(c.avatar, 48)}<div class="pk-who"><b>${esc(c.name)}</b><small>${kidLine(c)}</small></div>
          <div class="pk-btns"><button class="btn ghost small report" data-id="${c.id}">${ICONS.chart} Report</button><button class="icon-btn kid-set" data-id="${c.id}" aria-label="Settings for ${esc(c.name)}">⚙️</button></div></div>`)
        .join('')}</div>
      <button class="btn ghost small add-kid">+ Add a child</button></section>
    <section class="pa-sec"><h2 class="pa-h">⏱️ Daily play</h2>
      <button class="pa-row card limits"><b>${st.limitMinutes} minutes a day</b><small>${st.timeUpMode === 'stop' ? 'Stops when time is up' : 'Keeps playing without coins'} · treats ${paceText(st.treatPace, 'treat')}, big toy ${paceText(st.goalPace, 'goal')}</small></button>
      <div class="card pa-toggles">${toggleRows(st, [T('holiday', 'Holiday mode', 'Rewards don’t melt while you’re away or unwell.')])}</div></section>
    <section class="pa-sec"><h2 class="pa-h">🔊 Sound</h2>
      <div class="card pa-toggles">${toggleRows(st, [T('sound', 'Sound effects', 'Taps, cheers and coins.'), T('voice', 'Read questions aloud', 'Plus reads each question and tip.')])}</div></section>
    <section class="pa-sec"><h2 class="pa-h">🎨 Look</h2>
      <div class="themes" role="radiogroup" aria-label="Look of the app">${THEME_CHOICES.map((t) => `<button class="theme-tile th-${t.id}${st.theme === t.id ? ' on' : ''}" role="radio" aria-checked="${st.theme === t.id}" data-theme-id="${t.id}"><span class="th-swatch"><i></i><i></i><i></i></span><b>${t.name}</b><small>${t.note}</small></button>`).join('')}</div></section>
    <section class="pa-sec"><h2 class="pa-h">💾 Backup</h2>
      <div class="card pa-backup">
        <p class="pb-why"><small>Progress is saved only on this phone. A report card file (kept in Google Drive or email) brings it back on any phone.</small></p>
        <ul class="pb-kids">${app.save.data.children.map((c) => `<li>${avatarHtml(c.avatar, 28)}<span>${esc(c.name)}</span><small>${lastBackupText(c)}</small></li>`).join('')}</ul>
        <button class="btn small bk-all">Save report cards now</button>
        <button class="linkish restore-kid">⤓ Restore from a report card</button>
      </div></section>
    <button class="pa-more card to-adv"><span>☰</span><span><b>More settings</b><small>Timers, notes, voice, lock and help are in the menu</small></span><i aria-hidden="true">›</i></button>`;
}

function groupHtml(app: App, group: Group): string {
  const st = app.save.data.settings;
  const rs: ReminderSettings = { ...DEFAULT_REMINDERS, ...st.reminders };
  const body: Record<Group, () => string> = {
    learning: () => `
      <div class="card pa-timer"><div class="pt-head"><b>Time per question</b><span class="pt-val"></span></div>
        <small>For timed levels (Speed and Master) and boss fights.</small>
        <input type="range" class="slider pt-slider" min="${TIMER_MIN}" max="${TIMER_OFF}" step="5" value="${st.timerSeconds || TIMER_OFF}" aria-label="Seconds per question">
        <div class="pt-marks" aria-hidden="true">${TIMER_MARKS.map(([v, t]) => `<span style="--at:${(100 * (v - TIMER_MIN)) / (TIMER_OFF - TIMER_MIN)}%">${t}</span>`).join('')}</div>
        <p class="pt-note"></p></div>
      <div class="card pa-toggles">${toggleRows(st, [T('confirmAnswers', 'Confirm answers', 'Tap an answer, then Check. Fewer slips from a stray tap.'), T('teach', 'Show how after a mistake', 'A short step-by-step lesson when an answer is wrong.')])}</div>
      <h3 class="pa-sub">Reward categories</h3>
      <div class="card pa-cats">${CATEGORIES.map((c) => `<label class="toggle-row"><span><b>${c.icon} ${esc(c.name)}</b></span><input type="checkbox" role="switch" data-c="${c.id}" ${st.hiddenCategories.includes(c.id) ? '' : 'checked'}></label>`).join('')}</div>`,
    notes: () => `
      <div class="card pa-remind">
        <label class="toggle-row"><span><b>🍫 Melt watch</b><small>Friendly notes when a treat jar is about to melt, each with a fun fact.</small></span><input type="checkbox" role="switch" data-r="melt" ${rs.melt ? 'checked' : ''}></label>
        <div class="seg pr-per" role="radiogroup" aria-label="Notes a day"${rs.melt ? '' : ' hidden'}>${([2, 3] as const).map((n) => `<button class="seg-b${rs.perDay === n ? ' on' : ''}" role="radio" aria-checked="${rs.perDay === n}" data-per="${n}"><b>${n} a day</b><small>${n === 3 ? '8 am · 4:30 pm · 7:30 pm' : '8 am · 6:30 pm'}</small></button>`).join('')}</div>
        <label class="toggle-row"><span><b>💾 Backup reminder</b><small>When there’s a week of progress not backed up. Grown-ups also see it when the app opens.</small></span><input type="checkbox" role="switch" data-r="backup" ${rs.backup ? 'checked' : ''}></label>
        <p class="pr-status" hidden></p>
      </div>
      <div class="card pa-widgets"><b>📱 Home-screen widgets</b><small>Treat jars, a fun fact and the Adventure card. Touch and hold an empty spot on your home screen, tap Widgets, then find MN.</small></div>`,
    audio: () => `
      <button class="pa-row card voice-row"><b>Reading voice</b><small>${st.voiceName ? 'Chosen voice' : 'Automatic (clearest)'} · ${st.voiceRate < 0.9 ? 'slow' : st.voiceRate > 1 ? 'quick' : 'normal speed'}</small></button>
      <div class="card pa-toggles">${toggleRows(st, [T('sound', 'Sound effects', 'Taps, cheers and coins.'), T('voice', 'Read questions aloud', 'Plus reads each question and tip.'), T('vibration', 'Vibration', 'Gentle buzzes on taps and answers.')])}</div>`,
    device: () => `<div class="card pa-toggles">${toggleRows(st, [T('fx3d', '3D boss fights', 'Turn off if fights feel slow on this phone.'), T('showFps', 'Show frame rate', 'For testing: how smoothly the app runs.')])}</div>`,
    security: () => `
      <button class="pa-row card lock-row"><b>Grown-up lock</b><small>${st.parentPin ? 'Parent PIN' : 'This phone’s screen lock'}</small></button>
      <button class="pa-row card key-row"><b>Access key</b><small class="key-left">Checking…</small></button>`,
    help: () => `
      <button class="pa-row card story-row"><b>▶ Watch the one-minute video</b><small>What MN does and how it keeps children going</small></button>
      <button class="pa-row card tips-row"><b>Show Plus’s map tips again</b><small>Each child sees the tips the next time they open the map</small></button>
      <button class="pa-row card adv-what"><b>🎮 What is Adventure?</b><small>Quests, chests, badges, the wardrobe, the raid and the pet</small></button>
      ${faceoffRows(app)}`,
  };
  return `<div class="pa-panel">${body[group]()}</div>`;
}

const pageName = (p: Page): string => (p === 'basic' ? 'Parent area' : GROUPS.find((g) => g.id === p)!.name);

/** The ☰ menu: everyday settings first, then the groups of more settings. */
function parentMenu(app: App, go: (p: Page) => void): Promise<void> {
  return openDrawer(app, {
    title: 'Parent area',
    sub: 'Settings for grown-ups',
    items: [
      { id: 'basic', icon: '⭐', label: 'Everyday settings', note: 'Children, play time, sound, look, backup', current: page === 'basic', onPick: () => go('basic') },
      { heading: 'More settings' },
      ...GROUPS.map((g) => ({ id: g.id, icon: g.icon, label: g.name, note: g.note, current: page === g.id, onPick: () => go(g.id) })),
    ],
  });
}

export function parentScreen(app: App): Screen {
  const el = html(`<section class="screen parent" aria-label="Parent area">
    <header class="topbar"><button class="icon-btn pa-menu" aria-label="Menu">${MENU_ICON}</button><span class="t"></span><button class="icon-btn back-btn" aria-label="Close the parent area">✕</button></header>
    <div class="scroll pa-body"></div>
  </section>`);
  const body = el.querySelector<HTMLElement>('.pa-body')!;
  const render = (animate: boolean) => {
    el.querySelector('.topbar .t')!.textContent = pageName(page);
    body.innerHTML = page === 'basic' ? basicHtml(app) : groupHtml(app, page);
    body.scrollTop = 0;
    bind(app, el, body, render);
    if (animate) stagger(body.querySelectorAll(page === 'basic' ? '.pa-sec, .pa-more' : '.pa-panel > *'), { gap: 40 });
  };
  const go = (p: Page) => {
    if (p === page) return;
    page = p;
    render(true);
  };
  const menu = () => void parentMenu(app, go);
  el.querySelector('.pa-menu')!.addEventListener('click', menu);
  body.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.to-adv')) menu();
  });
  el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(whosPlayingScreen));
  render(false);
  return {
    el,
    // Android back: from a group, back to the everyday settings first.
    back: () => {
      if (page === 'basic') return false;
      go('basic');
      return true;
    },
    mounted: () => {
      stagger(body.querySelectorAll(page === 'basic' ? '.pa-sec, .pa-more' : '.pa-panel > *'), { gap: 40 });
      void firstAsk(app);
    },
  };
}

/** Hook up whatever is showing (Basic or one Advanced group). */
function bind(app: App, el: HTMLElement, body: HTMLElement, render: (animate: boolean) => void): void {
  const on = <K extends keyof HTMLElementEventMap>(sel: string, ev: K, fn: (b: HTMLElement) => void) => body.querySelectorAll<HTMLElement>(sel).forEach((b) => b.addEventListener(ev, () => fn(b)));
  const kid = (b: HTMLElement) => app.save.data.children.find((k) => k.id === b.dataset.id)!;
  on('.kid-set', 'click', (b) => void app.show(childSettingsScreen(kid(b))));
  on('.report', 'click', (b) => void app.show(reportScreen(kid(b))));
  on('.add-kid', 'click', () => void app.show(addChildScreen(false)));
  on('.restore-kid', 'click', () => void restoreFromFile(app, () => void app.show(parentScreen)));
  on('.limits', 'click', () => void app.show(limitsScreen(false)));
  on('.bk-all', 'click', async () => {
    const kids = app.save.data.children;
    const n = await backUpNow(app, kids);
    if (n) app.toast(n === kids.length ? 'Backed up! Keep the file somewhere safe, like Google Drive.' : `Saved ${n} of ${kids.length}.`);
    if (n) render(false);
  });
  on('.theme-tile', 'click', (b) => {
    const theme = b.dataset.themeId as Theme;
    app.save.update((d) => (d.settings.theme = theme));
    app.applyTheme(theme);
    body.querySelectorAll('.theme-tile').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
  });
  on('[data-k]', 'change', (b) => {
    const i = b as HTMLInputElement;
    const k = i.dataset.k as keyof Settings;
    app.save.update((d) => ((d.settings as unknown as Record<string, boolean>)[k] = i.checked));
    if (k === 'sound') app.sfx.enabled = i.checked;
    if (k === 'voice') app.voice.enabled = i.checked;
    if (k === 'vibration') app.haptics.enabled = i.checked;
    if (k === 'showFps') app.fps.set(i.checked);
  });
  on('[data-c]', 'change', (b) => {
    const i = b as HTMLInputElement;
    app.save.update((d) => {
      const set = new Set(d.settings.hiddenCategories);
      if (i.checked) set.delete(i.dataset.c!);
      else set.add(i.dataset.c!);
      d.settings.hiddenCategories = [...set];
    });
  });
  // Notes: switches, notes a day, and whether the phone lets MN send notes.
  const setRemind = (patch: Partial<ReminderSettings>) => app.save.update((d) => (d.settings.reminders = { ...DEFAULT_REMINDERS, ...d.settings.reminders, ...patch }));
  const status = body.querySelector<HTMLElement>('.pr-status');
  const paintNotes = async (ask = false) => {
    if (!status) return;
    let n = await notificationState(app);
    if (!n) return;
    if (!n.enabled && n.canAsk && ask) n = { enabled: await askNotifications(app), canAsk: false };
    status.hidden = n.enabled;
    if (n.enabled) return;
    status.innerHTML = n.canAsk ? 'MN isn’t allowed to send notes yet. <button class="linkish pr-allow">Allow notes</button>' : 'Notes are switched off for MN on this phone. <button class="linkish pr-open">Open settings</button>';
    status.querySelector('.pr-allow')?.addEventListener('click', () => void paintNotes(true));
    status.querySelector('.pr-open')?.addEventListener('click', () => void app.native?.openNotificationSettings?.());
  };
  on('[data-r]', 'change', (b) => {
    const i = b as HTMLInputElement;
    setRemind({ [i.dataset.r as 'melt' | 'backup']: i.checked });
    if (i.dataset.r === 'melt') body.querySelector<HTMLElement>('.pr-per')!.hidden = !i.checked;
    if (i.checked) void paintNotes(true);
  });
  on('.pr-per .seg-b', 'click', (b) => {
    setRemind({ perDay: Number(b.dataset.per) as 2 | 3 });
    body.querySelectorAll('.pr-per .seg-b').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
  });
  void paintNotes();
  on('.voice-row', 'click', () => void app.show(voiceScreen));
  const ts = body.querySelector<HTMLInputElement>('.pt-slider');
  if (ts) {
    const paintTimer = () => {
      const v = Number(ts.value);
      const secs = v >= TIMER_OFF ? 0 : v;
      body.querySelector('.pt-val')!.textContent = secs ? `${secs} seconds` : 'No timer';
      body.querySelector('.pt-note')!.textContent = timerNote(secs);
      ts.style.setProperty('--p', `${(100 * (v - TIMER_MIN)) / (TIMER_OFF - TIMER_MIN)}%`);
      return secs;
    };
    paintTimer();
    ts.addEventListener('input', paintTimer);
    ts.addEventListener('change', () => {
      const secs = paintTimer();
      app.save.update((d) => (d.settings.timerSeconds = secs));
    });
  }
  on('.lock-row', 'click', () => void app.show(lockSetupScreen(parentScreen)));
  if (body.querySelector('.key-row')) {
    void accessState(app).then((st) => {
      const small = body.querySelector('.key-left');
      if (!small) return;
      small.textContent = st.locked ? 'No working key' : st.owner ? 'Owner’s phone: always unlocked' : st.until !== undefined ? `Works until ${niceDay(st.until)} · phone code ${st.phone}` : `Phone code ${st.phone}`;
      body.querySelector('.key-row')!.addEventListener('click', () => void app.show(lockScreen(st, () => void app.show(parentScreen), { renew: true, back: () => void app.show(parentScreen) })));
    });
  }
  on('.story-row', 'click', () => void app.show(reelScreen({ first: false, label: 'Done', done: () => void app.show(parentScreen) }), 'liquid'));
  on('.tips-row', 'click', () => {
    app.save.update((d) => d.children.forEach((c) => (c.toured = false)));
    app.toast('Done. The tips show next time each child opens the map.');
  });
  on('.adv-what', 'click', () => void showParentAdventureTips(app, el));
}

/** One child's settings: report, age, difficulty, school path, Adventure, the dragon map, with a grown-up. */
export function childSettingsScreen(c: Child) {
  return (app: App): Screen => {
    const here = childSettingsScreen(c);
    const el = html(`<section class="screen parent kid-settings" aria-label="Settings for ${esc(c.name)}">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">${esc(c.name)}</span><span style="width:50px"></span></header>
      <div class="scroll pa-body">
        <div class="ks-hero">${avatarHtml(c.avatar, 64)}<b>${esc(c.name)}</b><small>Age ${c.age}</small></div>
        <button class="pa-row card report" data-id="${c.id}"><b>${ICONS.chart} Report</b><small>What ${esc(c.name)} has learned, and where they need help</small></button>
        <h2 class="pa-h">Learning</h2>
        <button class="pa-row card age-btn"><b>🎂 Age</b><small>${c.age} · questions follow the age</small></button>
        <button class="pa-row card level-btn"><b>${CHALLENGE[c.challenge ?? 0].icon} Difficulty</b><small>${CHALLENGE[c.challenge ?? 0].name} · ${CHALLENGE[c.challenge ?? 0].note}</small></button>
        <button class="pa-row card school-btn"><b>📚 School path</b><small>${c.school?.on ? esc(schoolLabel(c.school)) : 'Off · follow the school syllabus instead of the age path'}</small></button>
        <div class="card pa-toggles">
          <label class="toggle-row"><span><b>👪 With a grown-up</b><small>No timers; after a slip they try one like it. On by default for ages 3–6.</small></span><input type="checkbox" role="switch" class="assist-btn" ${c.assisted ? 'checked' : ''}></label>
        </div>
        <h2 class="pa-h">Fun</h2>
        <div class="card pa-toggles">
          <label class="toggle-row"><span><b>🎮 Adventure</b><small>Quests, chests, badges, a wardrobe for Plus, a weekly raid and a pet.</small></span><input type="checkbox" role="switch" class="adv-toggle" ${c.adventure?.on ? 'checked' : ''}></label>
          ${DRAGON_MAP ? `<label class="toggle-row"><span><b>🐉 Dragon map</b><small>The same levels, along a dragon curve that unfolds chapter by chapter.</small></span><input type="checkbox" role="switch" class="dragon-toggle" ${c.dragonMap ? 'checked' : ''}></label>` : ''}
        </div>
        <button class="linkish adv-what">🎮 What is Adventure?</button>
      </div>
    </section>`);
    const back = () => void app.show(parentScreen);
    el.querySelector('.back-btn')!.addEventListener('click', back);
    el.querySelector('.report')!.addEventListener('click', () => void app.show(reportScreen(c)));
    el.querySelector('.age-btn')!.addEventListener('click', () => void app.show(ageScreen(c)));
    el.querySelector('.school-btn')!.addEventListener('click', () => void app.show(schoolScreen(c, here)));
    el.querySelector('.level-btn')!.addEventListener('click', async () => {
      const actions: { label: string; value: number; kind: 'mint' | 'ghost'; back?: boolean }[] = [
        ...CHALLENGE.map((x, i) => ({ label: `${x.icon} ${x.name} — ${x.note}`, value: i, kind: i === (c.challenge ?? 0) ? ('mint' as const) : ('ghost' as const) })),
        { label: 'Cancel', value: -1, kind: 'ghost', back: true },
      ];
      const { result } = app.sheet(`<h2>How hard for ${esc(c.name)}?</h2><p>The skills stay the same; the numbers get tougher.</p>`, actions, 'Difficulty');
      const v = await result;
      if (v === -1) return;
      app.save.update(() => (c.challenge = v as 0 | 1 | 2));
      void app.show(here);
    });
    el.querySelector('.assist-btn')!.addEventListener('change', () => {
      app.save.update(() => (c.assisted = !c.assisted));
      app.toast(c.assisted ? `Assisted mode on: play alongside ${c.name}. No timers; after a slip they try one like it.` : `Assisted mode off for ${c.name}.`);
    });
    el.querySelector('.adv-toggle')!.addEventListener('change', async () => {
      const on = toggleAdventure(app, c);
      // Turning it on: show the grown-up what their child will get.
      if (on) await showParentAdventureTips(app, el);
      app.toast(on ? `Adventure on for ${c.name}.` : `Adventure off for ${c.name}. Badges are kept for later.`);
    });
    el.querySelector('.dragon-toggle')?.addEventListener('change', () => {
      app.save.update(() => (c.dragonMap = !c.dragonMap));
      app.toast(c.dragonMap ? `Dragon map on for ${c.name}.` : `Dragon map off for ${c.name}. Progress stays the same.`);
    });
    el.querySelector('.adv-what')!.addEventListener('click', () => void showParentAdventureTips(app, el));
    return { el, back: () => (back(), true), mounted: () => stagger(el.querySelectorAll('.pa-body > *'), { gap: 35 }) };
  };
}

/** Once, on the phone: may MN send the melt-watch and backup notes? */
async function firstAsk(app: App): Promise<void> {
  if (!app.native?.askNotifications || app.save.data.settings.notifAsked) return;
  const n = await notificationState(app);
  app.save.update((d) => (d.settings.notifAsked = true));
  if (!n || n.enabled || !n.canAsk) return;
  const { result } = app.sheet(
    `<h2>🔔 Can MN send friendly notes?</h2><p>Two or three a day about the treat jars melting, each with a fun fact, and a reminder for grown-ups to back up progress. You can change this here any time.</p>`,
    [
      { label: 'Allow notes', value: true, kind: 'mint' },
      { label: 'Not now', value: false, kind: 'ghost', back: true },
    ],
    'Notes',
  );
  if (await result) {
    const ok = await askNotifications(app);
    app.toast(ok ? 'Notes are on. Change them any time in ☰ → Notes.' : 'No notes for now. You can turn them on in ☰ → Notes.');
  }
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
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(childSettingsScreen(child)));
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
      void app.show(childSettingsScreen(child));
    });
    return { el, back: () => (void app.show(childSettingsScreen(child)), true) };
  };
}
