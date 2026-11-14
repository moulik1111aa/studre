// Parent area (behind the parent check). It opens on the everyday settings: children
// (report, and their own settings), daily play time, sound, the look and backups. The rest
// sits in groups (learning, notes, audio, device, security, help) in a ☰ side menu, like a
// game's settings. Each child's own settings (age, difficulty, school syllabus,
// Adventure, play together) live on that child's page.

import { showParentAdventureTips, toggleAdventure } from './adventure.ts';
import { openerScreen } from './opener.ts';
import { GUIDE, SECTION_GUIDE, guideHtml } from './guide.ts';
import { backUpNow, dueKids, lastBackupText } from './backup.ts';
import { askNotifications, notificationState, offerNotifications } from './remindsync.ts';
import { certificatesFor } from '../core/certs.ts';
import { certsScreen } from './certs.ts';
import { examSetupScreen } from './exam.ts';
import { bindWidgetsSection, offerWidget, widgetsSectionHtml } from './widgets.ts';
import { remindersOf, type ReminderSettings } from '../core/reminders.ts';
import { focusFor } from './focus.ts';
import { FOCUS_GOAL, trend, weekChange } from '../core/focus.ts';
import { mnxPreviewScreen, type DemoId } from './mnxdemo.ts';
import { strengths, timeOfDay } from '../core/stats.ts';
import { skillById } from '../core/areas/index.ts';
import { plusSvg } from './plus.ts';
import { timesMarkSvg } from './mnx.ts';
import { eraseEverything } from './erase.ts';
import { openLink, PRIVACY_URL } from './links.ts';
import { schoolScreen, schoolLabel } from './school.ts';
import { reportScreen } from './report.ts';
import { restoreFromFile } from './restore.ts';
import { appIconSvg } from './appicons.ts';
import { chooseAppIcon, currentIcon, iconsAvailable } from './iconpick.ts';
import { escv, html, esc, type App, type Screen } from './app.ts';
import { PLUS_THEMES, type Child, type Settings, type Theme } from '../storage/save.ts';
import { CATEGORIES } from '../core/rewards.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { stagger } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { addChildScreen, limitsScreen } from './setup.ts';
import { voiceScreen } from './voicepick.ts';
import { lockSetupScreen } from './grownup.ts';
// #unless play
import { accessState, lockScreen, niceDay } from './access.ts';
// #end
import { hasPlus, needPlus, offeredTrialDays, plansCta, plansNow, plusScreen, plusTag, plusVideoFor, storeBuild } from './membership.ts';
import { freshProgress } from '../core/path.ts';
import { quietSettingsScreen } from './quiet.ts';
import { quietSummary } from '../core/quiet.ts';
import { saveWorksheet } from './worksheet.ts';
import { account, cloudOn, deleteCloudCopy, downloadCloudCopy, lastSync, onePhone, otherPhone, signIn, signOut, syncNow, syncText } from './cloud.ts';
import { saveFamilyFile } from './familyfile.ts';
import { skillsIndexScreen } from './skillindex.ts';
import { googleButton } from './gbutton.ts';

const LOCAL_NOTE = 'Saved on this phone only';


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
  if (!secs) return 'No timer on levels. Challenges still need one, so they get a whole minute.';
  if (secs <= 10) return 'Hard: quick recall, for children who know their facts well.';
  if (secs <= 20) return 'Normal: about right for most children.';
  if (secs <= 40) return 'Easy: plenty of time to work it out.';
  return 'Relaxed: no rush at all.';
}

type Toggle = { key: keyof Settings; label: string; note: string };
const T = (key: keyof Settings, label: string, note: string): Toggle => ({ key, label, note });
const toggleRows = (st: Settings, list: Toggle[]) => list.map((t) => `<label class="toggle-row"><span><b>${t.label}</b><small>${t.note}</small></span><input type="checkbox" role="switch" data-k="${t.key}" ${st[t.key] ? 'checked' : ''}></label>`).join('');

const THEME_CHOICES: { id: Theme; name: string; note: string }[] = [
  { id: 'studio', name: 'Notebook', note: 'Graph paper, ink and highlighters' },
  { id: 'shapes', name: 'Shapes', note: 'Flat colour shapes, bold type' },
  { id: 'print', name: 'Print', note: 'Halftone dots and bright inks' },
  { id: 'playground', name: 'Playground', note: 'Bright sky, buttons that click like toys' },
  { id: 'glass', name: 'Glass', note: 'Deep colour, frosted panels' },
  { id: 'schoolbook', name: 'Schoolbook', note: 'Graph paper and ink' },
  { id: 'precision', name: 'Precision', note: 'White, one strong blue' },
];

/** The Parent area's six tabs, down the right edge (thumb side). Each changes the page in place. */
type Page = 'kids' | 'guide' | 'sound' | 'premium' | 'app' | 'help';
const TABS: { id: Page; icon: string; label: string; title: string }[] = [
  { id: 'kids', icon: ICONS.users, label: 'Children', title: 'Children' },
  { id: 'guide', icon: ICONS.compass, label: 'Guide', title: 'Get the most from MN' },
  { id: 'sound', icon: ICONS.speaker, label: 'Sound', title: 'Sound and voice' },
  { id: 'premium', icon: timesMarkSvg('tab'), label: 'MN ×', title: 'MN ×' },
  { id: 'app', icon: ICONS.gear, label: 'App', title: 'App settings' },
  { id: 'help', icon: ICONS.help, label: 'Help', title: 'Help' },
];
/** The page the parent is on (kept while they visit a sub-screen and come back). */
let page: Page = 'kids';
/** Open the Parent area on a given tab next time (e.g. from a notification or the Premium card). */
export const openParentOn = (p: Page): void => void (page = p);

const kidLine = (c: Child): string => [`Age ${escv(c.age)}`, c.adventure?.on ? 'Adventure' : '', c.school?.on ? 'School syllabus' : '', (c.challenge ?? 0) > 0 ? CHALLENGE[c.challenge ?? 0].name : ''].filter(Boolean).join(' · ');

/** Google backup and sync (when this build has it). */
function cloudCard(app: App): string {
  if (!cloudOn(app)) return '';
  const who = account(app);
  if (!who)
    return `<div class="card pa-cloud"><p><b>Back up with Google</b><small>Sign in to keep progress safe and the same on every phone. What’s on this phone now is kept and joins your account. ${esc(LOCAL_NOTE)} right now.</small></p>${googleButton('cl-in')}</div>`;
  // Play Store build without MN ×: an online backup from one phone.
  const other = onePhone(app) ? otherPhone() : null;
  const note = other
    ? `<div class="cl-other" role="status"><p>The online backup now comes from <b>${esc(other)}</b>. Progress made on this phone isn’t backed up.</p><button class="btn ghost small cl-take">Keep the online backup from this phone</button><p class="fine">With MN ×, every phone stays in step. <button class="linkish mp-from-cloud">See MN ×</button></p></div>`
    : onePhone(app)
      ? `<p class="fine cl-one">Online backup from this phone, every few hours. With MN ×, every phone stays in step all the time. <button class="linkish mp-from-cloud">See MN ×</button></p>`
      : '';
  return `<div class="card pa-cloud on"><p><b>${esc(who.email)}</b><small class="cl-status">${esc(other ? 'Not backing up from this phone' : syncText(lastSync()))}</small></p>${note}
    <div class="cl-btns"><button class="btn small cl-sync">Back up now</button><button class="btn ghost small cl-out">Sign out</button></div>
    <button class="linkish cl-dl">⤓ Download the online backup as a backup file</button>
    <button class="linkish warn cl-del">Delete the online backup</button></div>`;
}

/** A section; one the Guide explains gets a small "Learn" link to its card there. */
const sec = (title: string, body: string) => {
  const g = SECTION_GUIDE[title];
  const learn = g ? `<button class="gd-learn" data-g="${g}" aria-label="Learn about ${title} in the Guide">${ICONS.help}<span>Learn</span></button>` : '';
  return `<section class="pa-sec"><h2 class="pa-h">${title}${learn}</h2>${body}</section>`;
};

/** Children: who plays, how long, and how lessons and rewards work. */
function kidsHtml(app: App): string {
  const st = app.save.data.settings;
  return `${sec('Children', `<div class="pa-kids">${app.save.data.children
        .map((c) => `<div class="pa-kid card">${avatarHtml(c.avatar, 48)}<div class="pk-who"><b>${esc(c.name)}</b><small>${kidLine(c)}</small></div>
          <div class="pk-btns"><button class="btn ghost small report" data-id="${escv(c.id)}">${ICONS.chart} Report</button><button class="icon-btn kid-set" data-id="${escv(c.id)}" aria-label="Settings for ${esc(c.name)}">⚙️</button></div></div>`)
        .join('')}</div>
      <button class="btn ghost small add-kid">+ Add a child</button>`)}
    ${sec('Daily play', `<button class="pa-row card limits"><b>${escv(st.limitMinutes)} minutes a day</b><small>${st.timeUpMode === 'stop' ? 'Stops when time is up' : 'Keeps playing without coins'} · treats ${paceText(st.treatPace, 'treat')}, big reward ${paceText(st.goalPace, 'goal')}</small></button>
      <button class="pa-row card quiet-row"><b>Bedtime</b><small>${esc(quietSummary(st.quiet))}</small></button>
      <div class="card pa-toggles">${toggleRows(st, [T('holiday', 'Pause rewards', 'On holiday or unwell: jars don’t shrink and no daily reminder.')])}</div>`)}
    ${sec('Learning', `<div class="card pa-timer"><div class="pt-head"><b>Time per question</b><span class="pt-val"></span></div>
        <small>For timed levels (Speed and Master) and challenges.</small>
        <input type="range" class="slider pt-slider" min="${TIMER_MIN}" max="${TIMER_OFF}" step="5" value="${st.timerSeconds || TIMER_OFF}" aria-label="Seconds per question">
        <div class="pt-marks" aria-hidden="true">${TIMER_MARKS.map(([v, t]) => `<span style="--at:${(100 * (v - TIMER_MIN)) / (TIMER_OFF - TIMER_MIN)}%">${t}</span>`).join('')}</div>
        <p class="pt-note"></p></div>
      <div class="card pa-toggles">${toggleRows(st, [T('teach', 'Show how after a mistake', 'A short step-by-step lesson when an answer is wrong.'), T('confirmAnswers', 'Check before submitting', 'Tap an answer, then Check. Fewer slips from a stray tap.')])}</div>`)}`;
}

/** Sound and voice. */
function soundHtml(app: App): string {
  const st = app.save.data.settings;
  return `${sec('Sound', `<div class="card pa-toggles">${toggleRows(st, [T('sound', 'Sound effects', 'Taps, cheers and coins.')])}</div>
      <div class="card pa-vol"><div class="pt-head"><b>Volume</b><span class="vol-val">${Math.round((st.volume ?? 0.8) * 100)}%</span></div><input type="range" class="slider vol-slider" min="0.2" max="1" step="0.1" value="${st.volume ?? 0.8}" aria-label="Sound volume"></div>`)}
    ${sec('Reading aloud', `<div class="card pa-toggles">${toggleRows(st, [T('voice', 'Read questions aloud', 'Plus reads each question and tip.')])}</div>
      <button class="pa-row card voice-row"><b>Reading voice</b><small>${st.voiceName ? ((st.voicePitch ?? 1) < 1 ? 'A deeper voice' : 'Your chosen voice') : 'Automatic'} · ${st.voiceRate < 0.9 ? 'slow' : st.voiceRate > 1 ? 'quick' : 'normal speed'} · tap to hear every voice</small></button>`)}`;
}

/** App settings: notifications, look, vibration, parent PIN, backup. */
function appHtml(app: App): string {
  const st = app.save.data.settings;
  const rs = remindersOf(st.reminders);
  const times = ['07:30', '16:00', '17:00', '18:00', '19:00'];
  const nice = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`; };
  return `${sec('Notifications', `<p class="pr-status card" hidden></p>
      <div class="card pa-remind">
        <label class="toggle-row"><span><b>Daily learning time</b><small>One note a day, naming who hasn’t played yet.</small></span><input type="checkbox" role="switch" data-r="daily" ${rs.daily ? 'checked' : ''}></label>
        <div class="seg pr-time" role="radiogroup" aria-label="Time of the daily note"${rs.daily ? '' : ' hidden'}>${times.map((t) => `<button class="seg-b${rs.dailyAt === t ? ' on' : ''}" role="radio" aria-checked="${rs.dailyAt === t}" data-at="${t}"><b>${nice(t)}</b></button>`).join('')}</div>
        <label class="toggle-row"><span><b>Reward ready</b><small>When a jar is full and a reward is waiting to be given.</small></span><input type="checkbox" role="switch" data-r="ready" ${rs.ready ? 'checked' : ''}></label>
        <label class="toggle-row"><span><b>Backup reminder</b><small>When a week of progress isn’t backed up.</small></span><input type="checkbox" role="switch" data-r="backup" ${rs.backup ? 'checked' : ''}></label>
      </div>`)}
    ${sec('Look', `<div class="themes" role="radiogroup" aria-label="Look of the app">${THEME_CHOICES.map((t) => `<button class="theme-tile th-${t.id}${st.theme === t.id ? ' on' : ''}" role="radio" aria-checked="${st.theme === t.id}" data-theme-id="${t.id}"><span class="th-swatch"><i></i><i></i><i></i></span><b>${t.name}${PLUS_THEMES.includes(t.id) ? ` ${plusTag(app)}` : ''}</b><small>${t.note}</small></button>`).join('')}</div>
      ${iconsAvailable(app) ? `<button class="pa-row card icon-row"><span class="ic-now" aria-hidden="true">${appIconSvg('sky', 'square', 40)}</span><span><b>App icon ${plusTag(app)}</b><small>Choose MN’s icon on the home screen</small></span></button>` : ''}
      <div class="card pa-toggles">${toggleRows(st, [T('vibration', 'Vibration', 'Gentle buzzes on taps and answers.'), T('fx3d', '3D challenges', 'Turn off if challenges feel slow on this phone.')])}</div>`)}
    ${sec('Rewards', `<div class="card pa-cats"><p class="cat-why">Rewards children can pick from. Tap to show or hide a kind.</p><div class="cat-chips">${CATEGORIES.map((c) => `<button class="cat-chip${st.hiddenCategories.includes(c.id) ? '' : ' on'}" aria-pressed="${!st.hiddenCategories.includes(c.id)}" data-c="${c.id}"><span aria-hidden="true">${c.icon}</span>${esc(c.name)}</button>`).join('')}</div></div>`)}
    ${sec('Parent PIN', `<button class="pa-row card lock-row"><b>How parents unlock settings</b><small>${st.parentPin ? 'Your own PIN' : 'This phone’s screen lock'}</small></button>
      ${storeBuild(app) ? '' : '<button class="pa-row card key-row"><b>Access key</b><small class="key-left">Checking…</small></button>'}`)}
    ${sec('Backup', `<div class="card pa-backup">
        ${(() => {
          const due = dueKids(app);
          return due.length ? `<p class="pb-due" role="status"><span>${esc(due.map((c) => c.name).join(' and '))} ${due.length === 1 ? 'has' : 'have'} new progress that isn’t backed up yet.</span></p>` : '';
        })()}
        <p class="pb-why"><small>${account(app) ? 'Progress is backed up online. A backup file is an extra copy you can keep anywhere.' : 'Progress is saved on this phone (and in the phone’s own Google backup, if that is on, though it doesn’t always come back). A backup file (in Google Drive or email) brings it back on any phone.'}</small></p>
        <ul class="pb-kids">${app.save.data.children.map((c) => `<li>${avatarHtml(c.avatar, 28)}<span>${esc(c.name)}</span><small>${lastBackupText(c)}</small></li>`).join('')}</ul>
        <button class="btn small bk-family">Save a backup file</button>
        <button class="linkish restore-kid">Restore from a backup file</button>
        <button class="linkish bk-all">Save one file per child instead</button>
      </div>
      ${cloudCard(app)}`)}
    ${sec('Your data', `<button class="pa-row card privacy-row"><b>Privacy policy</b><small>What MN keeps, and where</small></button>
      <button class="pa-row card erase-row"><b>Delete account and data</b><small>Progress, reward photos and reminders on this phone${account(app) ? ', the online backup and your MN sign-in' : ''}</small></button>`)}
    ${sec('MN Swipe', `<div class="card pa-toggles">${toggleRows(st, [T('swipeOn', 'MN Swipe on the home screen', 'Endless quick maths for anyone, with music. Just for fun: no coins, no child profile.')])}</div>`)}
    ${sec('Home-screen widgets', widgetsSectionHtml(app))}`;
}

/** Help: videos and answers to common questions. */
const FAQ: [string, string][] = [
  ['How much should my child play?', 'Little and often is a good habit: 10 to 20 minutes a day is a sensible start. Set the daily time in Children → Daily play.'],
  ['How do rewards work?', 'Levels fill a treat jar with coins. When it’s full, MN asks you to hand over the treat and tap Given. You choose the treats and how fast jars fill (Children → Daily play).'],
  ['Why does the jar shrink?', 'A missed day takes a little off the treat jar, so playing a few minutes every day pays off. Pause rewards stops this on holidays or sick days.'],
  ['My child got an answer wrong. What happens?', 'MN shows a short step-by-step lesson with pictures, then a similar question to try. You can turn lessons off in Children → Learning.'],
  ['What are steps 1–5?', 'Each skill has five steps on the map: Learn, Practice, Practise more, Speed and Master. Each step wins up to 3 stars; Speed and Master are timed (change the time in Children → Learning).'],
  ['Can two children share one phone?', 'Yes. Add each child in Children; MN asks who’s playing when it opens.'],
  ['How do I move to a new phone?', 'Sign in with Google in App → Backup on both phones, or save a backup file and open it on the new phone.'],
  ['Is my child’s data private?', 'MN has no ads and no tracking. Progress stays on the phone, or in your own online backup if you sign in. The privacy policy (App → Your data) has the details.'],
];
function helpHtml(app: App): string {
  return `${sec('Videos', `<button class="pa-row card story-row"><b>▶ How MN works</b><small>One minute: levels, lessons and rewards</small></button>
      <button class="pa-row card plus-row"><b>▶ What MN × adds</b><small>A short video about the extra features</small></button>`)}
    ${sec('Questions', `<div class="card pa-faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`)}
    ${sec('More', `<button class="pa-row card tips-row"><b>Show the map tips again</b><small>Each child sees Plus’s tips the next time they open the map</small></button>
      <button class="pa-row card adv-what"><b>What is Adventure mode?</b><small>Quests and badges: daily goals, chests, a pet and outfits</small></button>
      ${faceoffRows(app)}`)}`;
}

/** What MN × adds, in a few words each (the page keeps it short, Duolingo-style). */
const GAINS: { id: DemoId; name: string; line: string }[] = [
  { id: 'focus', name: 'A Focus plan every week', line: 'Short rounds on the 3 skills that are hardest right now.' },
  { id: 'report', name: 'The full report', line: 'Strengths, skills to practise, and how each one is changing.' },
  { id: 'school', name: 'Your school’s syllabus', line: 'CBSE, ICSE or Common Core, class by class.' },
  { id: 'sheets', name: 'Worksheets to print', line: 'From the skills they’re on now, with answers.' },
  { id: 'exam', name: 'Exam practice', line: 'A timed test on topics you pick, then a score sheet.' },
  { id: 'certs', name: 'Certificates', line: 'One to print for every challenge beaten.' },
  { id: 'sync', name: 'Every phone in step', line: 'Same progress on a phone and a tablet.' },
  { id: 'widgets', name: 'The Focus widget', line: 'This week’s plan on your home screen.' },
];
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#fff"/><path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#6C47FF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="2" fill="currentColor"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

/** One child's report as MN × shows it: real numbers; without MN ×, all but the first row is blurred. */
function reportPeek(app: App, c: Child, on: boolean): string {
  const t = c.tally ?? {};
  const { best, practise } = strengths(t, 6);
  const p = focusFor(app, c);
  const tod = timeOfDay(c.log ?? []).sort((x, y) => y.levels - x.levels)[0];
  const name = (id: string) => esc(skillById(id)?.name ?? id);
  // How each skill is changing, coloured: green up, orange down, grey steady.
  const chip = (id: string) => {
    const w = weekChange(c.log, app.today, id);
    const t = trend(w);
    if (!w || !t) return '';
    const d = w.now - w.before;
    return ` <i class="pm-chg ${t}">${t === 'up' ? '▲' : t === 'down' ? '▼' : '•'} ${t === 'same' ? 'steady' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`}</i>`;
  };
  const rows: [string, string][] = [
    ['Strongest', best.length ? `${name(best[0].id)} · ${best[0].accuracy}%${chip(best[0].id)}` : 'Shows after a few days of play'],
    ['Needs help with', practise.length ? practise.map((x) => `${name(x.id)} (${x.accuracy}%)${chip(x.id)}`).join(', ') : p.skills.length ? p.skills.map((x) => name(x.id)).join(', ') : 'Shows after a few days of play'],
    ['This week’s Focus plan', p.skills.length ? `${p.skills.length} skills · ${Math.min(p.rounds, FOCUS_GOAL)} of ${FOCUS_GOAL} rounds done` : 'Ready after a few days of play'],
    ['Learns best in the', tod && tod.levels ? tod.label.toLowerCase() : 'Shows after a few days of play'],
  ];
  return `<div class="pm-peek${on ? ' open' : ''}">
    <div class="pm-peek-h">${avatarHtml(c.avatar, 34)}<b>${esc(c.name)}</b><small>this week</small></div>
    ${rows.map(([k, v], i) => `<div class="pm-row${!on && i > 0 ? ' locked' : ''}"><small>${k}</small><b>${v}</b>${!on && i > 0 ? `<span class="pm-lock">${LOCK}</span>` : ''}</div>`).join('')}
  </div>`;
}

/** MN ×: its own page, in the spirit of Duolingo's: one bold colour, the mascot, a few lines and
 *  one button, and the parent's own child's report as the proof. */
function premiumHtml(app: App): string {
  const on = hasPlus(app);
  const store = storeBuild(app);
  const kids = app.save.data.children;
  const kid = kids.find((c) => c.id === app.save.data.activeChildId) ?? kids[0];
  const hero = `<div class="pm-hero">
      <div class="pm-mascot" aria-hidden="true">${plusSvg({ cls: 'alive shiny', noShadow: true })}</div>
      <p class="pm-brand" aria-label="MN Times">MN ${timesMarkSvg()}</p>
      ${on ? `<p class="pm-on">${store ? 'MN × is on for your family' : 'MN × is included in this version'}</p><h2 class="pm-h">Everything below is yours.</h2>` : '<h2 class="pm-h">See where to help, at a glance.</h2>'}
      <button class="pm-video"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor"/></svg>Watch the 1-minute video</button>
    </div>`;
  const peek = kid ? `<section class="pm-proof"><p class="pm-cap">${on ? 'Your full report' : 'Here’s what MN × shows you'}</p>${reportPeek(app, kid, on)}</section>` : '';
  const gains = `${on ? '<p class="pm-cap pm-have">What you have with MN ×</p>' : ''}<ul class="pm-gains${on ? ' have' : ''}">${GAINS.map((g) => `<li>${CHECK}<span><b>${esc(g.name)}</b><small>${esc(g.line)}</small></span><button class="pm-q" data-demo="${g.id}" aria-label="See what ${esc(g.name)} looks like">?</button></li>`).join('')}</ul>`;
  const free = on ? '' : '<p class="pm-free-note">Every level, lesson and reward is free for every child, with no ads.</p>';
  // Prices only as Google Play gives them (nothing shown until Play has answered).
  const offers = plansNow(app);
  const priced = offers.map((o) => `${esc(o.price)} ${o.plan === 'lifetime' ? 'once' : esc(o.per)}`);
  const plans = !store || on || !priced.length ? '' : `<p class="pm-price">Plans: ${priced.length > 1 ? `${priced.slice(0, -1).join(', ')} or ${priced[priced.length - 1]}` : priced[0]}.</p>`;
  const trial = offeredTrialDays(app);
  const cta = !store
    ? '<div class="pm-cta-bar"><p class="pm-incl">Everything in MN × is included in this version of MN.</p></div>'
    : on
      ? '<div class="pm-cta-bar"><button class="pm-buy ghost pm-plans">Manage your plan</button></div>'
      : `<div class="pm-cta-bar"><button class="pm-buy pm-plans">${esc(plansCta(app))}</button><small>${trial ? 'Cancel any time in Google Play. No charge if you cancel during the free days.' : 'Cancel any time in Google Play.'}</small></div>`;
  return `<div class="pm-page">${hero}${peek}${gains}${free}${plans}</div>${cta}`;
}

function pageHtml(app: App, p: Page): string {
  const invite = p === 'kids' && cloudOn(app) && !account(app) ? `<div class="card pa-invite"><p><b>Keep progress safe with Google</b><small>Sign in once. Everything on this phone is kept and backed up online.</small></p>${googleButton('cl-in')}</div>` : '';
  const html = { kids: kidsHtml, guide: guidePage, sound: soundHtml, premium: premiumHtml, app: appHtml, help: helpHtml }[p](app);
  return `${invite}${p === 'kids' ? guideInvite(app) : ''}${p === 'kids' && !invite ? trialNudge(app) : ''}${html}`;
}

const guidePage = (app: App): string => guideHtml(app.save.data.children.map((c) => c.name), storeBuild(app), hasPlus(app));

/** On the Children page until the Guide has been opened (or this is closed): an invitation to it. */
function guideInvite(app: App): string {
  const st = app.save.data.settings;
  if (st.guideSeen || st.guideInviteOff) return '';
  const kids = app.save.data.children;
  const who = kids.length === 1 ? esc(kids[0].name) : 'your children';
  return `<div class="card gd-invite" role="note">
    <span class="gd-inv-i" aria-hidden="true">${ICONS.compass}</span>
    <p><b>Get the most from MN for ${who}</b><small>Two minutes to see everything MN can do, what’s free, and how families use each part best.</small></p>
    <div class="gd-inv-btns"><button class="btn small gd-open">Open the Guide</button><button class="icon-btn gd-x" aria-label="Close">${ICONS.cross}</button></div>
  </div>`;
}

/**
 * A small, dismissible note about the free trial (Play build, MN × not on, from the second
 * Parent area visit). It names the child's hardest skill when MN knows it. Hidden for two
 * weeks when closed.
 */
function trialNudge(app: App): string {
  const st = app.save.data.settings;
  if (!storeBuild(app) || hasPlus(app) || (st.parentVisits ?? 0) < 2 || Date.now() < (st.trialNudgeAt ?? 0)) return '';
  const c = app.save.data.children.find((k) => k.id === app.save.data.activeChildId) ?? app.save.data.children[0];
  const hard = c ? focusFor(app, c).skills[0] : undefined;
  const skill = hard ? skillById(hard.id)?.name : undefined;
  const line = c && skill ? `${esc(c.name)} is finding <b>${esc(skill)}</b> tricky right now. MN × turns that into a short Focus plan each week.` : 'See what each child finds tricky, with a short Focus plan for it each week.';
  return `<div class="card pa-nudge" role="note"><span class="pa-nudge-x">${timesMarkSvg('nudge')}</span><p>${line}<small>${offeredTrialDays(app) ? `Free for ${offeredTrialDays(app)} days. Cancel any time.` : 'Cancel any time in Google Play.'}</small></p><button class="btn small pa-nudge-go">See MN ×</button><button class="pa-nudge-close" aria-label="Hide this for now">✕</button></div>`;
}

export function parentScreen(app: App): Screen {
  const tabs = TABS;
  const el = html(`<section class="screen parent rail" aria-label="Parent area">
    <header class="topbar"><span class="t"></span></header>
    <div class="pa-wrap">
      <div class="scroll pa-body" role="tabpanel"></div>
      <nav class="pa-rail" role="tablist" aria-label="Parent area sections" aria-orientation="vertical">
        <div class="pa-tabs">${tabs.map((t) => `<button class="pa-tab${t.id === 'premium' && hasPlus(app) ? ' owned' : ''}" role="tab" data-id="${t.id}" aria-selected="false"><span aria-hidden="true">${t.icon}</span><small>${esc(t.label)}</small></button>`).join('')}</div>
        <button class="pa-tab pa-close back-btn" aria-label="Close the parent area"><span aria-hidden="true">✕</span><small>Close</small></button>
      </nav>
    </div>
  </section>`);
  const body = el.querySelector<HTMLElement>('.pa-body')!;
  const render = (animate: boolean) => {
    el.querySelector('.topbar .t')!.textContent = TABS.find((t) => t.id === page)!.title;
    el.querySelectorAll<HTMLElement>('.pa-tab[data-id]').forEach((b) => {
      const on = b.dataset.id === page;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (page === 'guide' && !app.save.data.settings.guideSeen) app.save.update((d) => (d.settings.guideSeen = true));
    el.querySelector('.pa-tab[data-id="guide"]')?.classList.toggle('glow', !app.save.data.settings.guideSeen);
    body.innerHTML = pageHtml(app, page);
    body.dataset.page = page;
    body.scrollTop = 0;
    void notificationState(app).then((n) => el.querySelector('.pa-tab[data-id="app"]')?.classList.toggle('warn', !!n && !n.enabled));
    bind(app, el, body, render);
    if (page === 'app') void bindWidgetsSection(app, body);
    if (animate) stagger(body.querySelectorAll('.pa-sec, .pa-invite'), { gap: 30 });
  };
  const go = (p: Page) => {
    if (p === page) return;
    page = p;
    render(true);
  };
  el.querySelectorAll<HTMLButtonElement>('.pa-tab[data-id]').forEach((b) =>
    b.addEventListener('click', () => {
      go(b.dataset.id as Page);
    }),
  );
  el.querySelector('.pa-close')!.addEventListener('click', () => void app.show(whosPlayingScreen));
  render(false);
  return {
    el,
    // Android back: from another tab, back to Children first.
    back: () => {
      if (page === 'kids') return false;
      go('kids');
      return true;
    },
    mounted: () => {
      stagger(body.querySelectorAll('.pa-sec, .pa-invite'), { gap: 40 });
      app.save.update((d) => (d.settings.parentVisits = (d.settings.parentVisits ?? 0) + 1));
      // One offer per visit: notifications first (once), later the home-screen widget (once).
      if (!app.save.data.settings.notifAsked && app.native?.askNotifications) void offerNotifications(app);
      else void offerWidget(app);
    },
  };
}

/** Hook up whatever tab is showing. */
function bind(app: App, el: HTMLElement, body: HTMLElement, render: (animate: boolean) => void): void {
  const on = <K extends keyof HTMLElementEventMap>(sel: string, ev: K, fn: (b: HTMLElement) => void) => body.querySelectorAll<HTMLElement>(sel).forEach((b) => b.addEventListener(ev, () => fn(b)));
  const kid = (b: HTMLElement) => app.save.data.children.find((k) => k.id === b.dataset.id)!;
  on('.kid-set', 'click', (b) => void app.show(childSettingsScreen(kid(b))));
  on('.report', 'click', (b) => void app.show(reportScreen(kid(b))));
  // The Guide: open it (at a card), and from a card, go to the setting it explains.
  const showOn = (p: Page, sel: string, open = false) => {
    page = p;
    render(true);
    requestAnimationFrame(() => {
      const t = body.querySelector<HTMLElement>(sel);
      if (!t) return;
      if (open && t instanceof HTMLDetailsElement) t.open = true;
      t.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      t.classList.remove('gd-flash');
      void t.offsetWidth;
      t.classList.add('gd-flash');
      window.setTimeout(() => t.classList.remove('gd-flash'), 2200);
    });
  };
  on('.gd-learn', 'click', (b) => showOn('guide', `#gd-${b.dataset.g}`, true));
  on('.gd-open', 'click', () => showOn('guide', '.gd-start'));
  on('.gd-x', 'click', () => {
    app.save.update((d) => (d.settings.guideInviteOff = true));
    body.querySelector('.gd-invite')?.remove();
  });
  on('.gd-f', 'click', (b) => {
    const f = b.dataset.f!;
    body.querySelectorAll<HTMLElement>('.gd-f').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
    body.querySelectorAll<HTMLElement>('.gd-item').forEach((it) => {
      const plan = it.dataset.plan;
      it.hidden = f === 'free' ? plan === 'plus' : f === 'plus' ? plan === 'free' : false;
    });
    body.querySelectorAll<HTMLElement>('.gd-group').forEach((g) => (g.hidden = !g.querySelector('.gd-item:not([hidden])')));
  });
  on('.gd-go', 'click', (b) => {
    const it = GUIDE.find((x) => x.id === b.dataset.id);
    const go = it?.go;
    if (!go) return;
    const kids = app.save.data.children;
    if (go === 'skills') void app.show(skillsIndexScreen(parentScreen));
    else if (go === 'story') void app.show(openerScreen({ first: false, label: 'Done', done: () => void app.show(parentScreen) }), 'liquid');
    else if (go === 'child') kids.length === 1 ? void app.show(childSettingsScreen(kids[0])) : showOn('kids', '.pa-kids');
    else if (go === 'report') kids.length === 1 ? void app.show(reportScreen(kids[0])) : showOn('kids', '.pa-kids');
    else showOn(go.tab, go.sel);
  });
  on('.add-kid', 'click', () => void app.show(addChildScreen(false)));
  on('.restore-kid', 'click', () => void restoreFromFile(app, () => void app.show(parentScreen)));
  on('.cl-in', 'click', async () => {
    const r = await signIn(app);
    if (r === 'approved') app.toast(onePhone(app) ? 'Signed in. An online backup of your family’s progress is kept with Google.' : 'Signed in. Progress is backed up and syncs on every phone.', 5000);
    else if (r === 'waiting') app.toast('Signed in. Your account is waiting to be approved; backup starts once it is.', 6000);
    else if (r === 'offline') app.toast('No internet connection. Connect and try again.');
    render(false);
  });
  on('.cl-sync', 'click', async (b) => {
    (b as HTMLButtonElement).disabled = true;
    const r = await syncNow(app, true);
    (b as HTMLButtonElement).disabled = false;
    const st = body.querySelector('.cl-status');
    if (r.ok) {
      if (st) st.textContent = syncText(r.at);
      app.toast(r.added.length ? `Backed up. ${r.added.map((c) => c.name).join(' and ')} came from the cloud.` : 'Backed up.');
      if (r.added.length || r.dropped.length) render(false);
    } else {
      app.toast(r.why === 'not-approved' ? 'Your account isn’t approved yet.' : r.message);
      if (r.why === 'other-phone') render(false);
    }
  });
  on('.cl-take', 'click', async (b) => {
    (b as HTMLButtonElement).disabled = true;
    const r = await syncNow(app, true, true);
    app.toast(r.ok ? 'Backed up. The online backup comes from this phone now.' : r.message, 5000);
    render(false);
  });
  on('.mp-from-cloud', 'click', () => void app.show(plusScreen(parentScreen)));
  on('.cl-out', 'click', async () => {
    const viaGoogle = !!app.save.data.access?.google && !app.save.data.access?.key;
    const { result } = app.sheet(`<h2>Sign out of Google?</h2><p>Progress stays on this phone, but stops backing up.${viaGoogle ? ' MN was unlocked with this account, so it will need Google or a key to open next time.' : ''}</p>`, [
      { label: 'Sign out', value: true, kind: 'danger' },
      { label: 'Cancel', value: false, kind: 'ghost', back: true },
    ], 'Sign out');
    if (!(await result)) return;
    await syncNow(app);
    await signOut(app);
    render(false);
  });
  on('.cl-del', 'click', async () => {
    const { result } = app.sheet(`<h2>Delete the online backup?</h2><p>Your family’s progress is deleted from the cloud, and this phone signs out. Progress on this phone stays. Other phones keep their own progress too, but stop syncing.</p>`, [
      { label: 'Delete online backup', value: true, kind: 'danger' },
      { label: 'Cancel', value: false, kind: 'ghost', back: true },
    ], 'Delete online backup');
    if (!(await result)) return;
    app.toast((await deleteCloudCopy(app)) ? 'The online backup is deleted.' : 'That didn’t work. Check the internet connection.');
    render(false);
  });
  on('.limits', 'click', () => void app.show(limitsScreen(false)));
  on('.quiet-row', 'click', () => void app.show(quietSettingsScreen(parentScreen)));
  on('.icon-row', 'click', async () => {
    if (await needPlus(app, 'icons', parentScreen)) void chooseAppIcon(app);
  });
  // The row shows the icon in use now.
  void currentIcon(app).then((id) => {
    const now = body.querySelector('.ic-now');
    if (now) now.innerHTML = appIconSvg(id, 'square', 40);
  });
  on('.bk-family', 'click', async () => {
    if (await saveFamilyFile(app)) {
      app.toast('Backup file saved. Keep it somewhere safe, like Google Drive.');
      render(false);
    }
  });
  on('.cl-dl', 'click', async (b) => {
    (b as HTMLButtonElement).disabled = true;
    const r = await downloadCloudCopy(app);
    (b as HTMLButtonElement).disabled = false;
    if (r === 'saved') app.toast('The online backup is saved as a backup file.');
    else if (r === 'empty') app.toast('There’s nothing in the cloud yet. Tap Back up now first.');
    else if (r === 'offline') app.toast('No internet connection.');
    else if (r === 'error') app.toast('Couldn’t download the online backup just now.');
  });
  on('.bk-all', 'click', async () => {
    const kids = app.save.data.children;
    const n = await backUpNow(app, kids);
    if (n) app.toast(n === kids.length ? 'Backed up! Keep the file somewhere safe, like Google Drive.' : `Saved ${n} of ${kids.length}.`);
    if (n) render(false);
  });
  on('.theme-tile', 'click', async (b) => {
    const theme = b.dataset.themeId as Theme;
    // Precision is an MN × look (with the app icons).
    if (PLUS_THEMES.includes(theme) && !(await needPlus(app, 'icons', parentScreen))) return;
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
  on('.cat-chip', 'click', (b) => {
    const show = !b.classList.contains('on');
    // At least one kind stays, so children always have something to pick.
    if (!show && body.querySelectorAll('.cat-chip.on').length <= 1) return app.toast('Keep at least one kind of reward.');
    b.classList.toggle('on', show);
    b.setAttribute('aria-pressed', String(show));
    app.save.update((d) => {
      const set = new Set(d.settings.hiddenCategories);
      if (show) set.delete(b.dataset.c!);
      else set.add(b.dataset.c!);
      d.settings.hiddenCategories = [...set];
    });
  });
  // Notifications: switches, the daily time, and whether the phone lets MN send them.
  const setRemind = (patch: Partial<ReminderSettings>) => app.save.update((d) => (d.settings.reminders = { ...remindersOf(d.settings.reminders), ...patch }));
  const status = body.querySelector<HTMLElement>('.pr-status');
  const paintNotes = async (ask = false) => {
    if (!status) return;
    let n = await notificationState(app);
    if (!n) return;
    if (!n.enabled && n.canAsk && ask) n = { enabled: await askNotifications(app), canAsk: false };
    status.hidden = n.enabled;
    if (n.enabled) return;
    status.innerHTML = n.canAsk
      ? '<b>Notifications are off</b><small>MN can’t remind you about learning time or rewards yet.</small><button class="btn small pr-allow">Turn on</button>'
      : '<b>Notifications are blocked</b><small>They’re switched off for MN in the phone’s settings.</small><button class="btn small pr-open">Open settings</button>';
    status.querySelector('.pr-allow')?.addEventListener('click', () => void paintNotes(true));
    status.querySelector('.pr-open')?.addEventListener('click', () => void app.native?.openNotificationSettings?.());
  };
  on('[data-r]', 'change', (b) => {
    const i = b as HTMLInputElement;
    setRemind({ [i.dataset.r as 'daily' | 'ready' | 'backup']: i.checked });
    if (i.dataset.r === 'daily') body.querySelector<HTMLElement>('.pr-time')!.hidden = !i.checked;
    if (i.checked) void paintNotes(true);
  });
  on('.pr-time .seg-b', 'click', (b) => {
    setRemind({ dailyAt: b.dataset.at! });
    body.querySelectorAll('.pr-time .seg-b').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', String(x === b));
    });
  });
  void paintNotes();
  on('.voice-row', 'click', () => void app.show(voiceScreen));
  const vol = body.querySelector<HTMLInputElement>('.vol-slider');
  if (vol) {
    const paintVol = () => {
      body.querySelector('.vol-val')!.textContent = `${Math.round(Number(vol.value) * 100)}%`;
      vol.style.setProperty('--p', `${(100 * (Number(vol.value) - 0.2)) / 0.8}%`);
    };
    paintVol();
    vol.addEventListener('input', () => {
      paintVol();
      app.sfx.volume = Number(vol.value);
    });
    vol.addEventListener('change', () => {
      app.save.update((d) => (d.settings.volume = Number(vol.value)));
      app.sfx.correct(1);
    });
  }
  on('.erase-row', 'click', () => void eraseEverything(app));
  on('.privacy-row', 'click', () => openLink(app, PRIVACY_URL));
  on('.pm-q', 'click', (b) => {
    const sell = storeBuild(app) && !hasPlus(app);
    void app.show(mnxPreviewScreen(b.dataset.demo as DemoId, parentScreen, sell ? plansCta(app) : null, () => void app.show(plusScreen(parentScreen))));
  });
  on('.pa-nudge-go', 'click', () => {
    openParentOn('premium');
    render(true);
  });
  on('.pa-nudge-close', 'click', () => {
    app.save.update((d) => (d.settings.trialNudgeAt = Date.now() + 14 * 86_400_000));
    body.querySelector('.pa-nudge')?.remove();
  });
  on('.pm-video', 'click', () => void app.show(plusVideoFor(app, parentScreen), 'liquid'));
  on('.pm-plans', 'click', () => void app.show(plusScreen(parentScreen)));
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
  // #unless play
  if (body.querySelector('.key-row')) {
    void accessState(app).then((st) => {
      const small = body.querySelector('.key-left');
      if (!small) return;
      small.textContent = st.locked ? 'No working key' : st.owner ? 'Owner’s phone: always unlocked' : st.until !== undefined ? `Works until ${niceDay(st.until)} · phone code ${st.phone}` : `Phone code ${st.phone}`;
      body.querySelector('.key-row')!.addEventListener('click', () => void app.show(lockScreen(st, () => void app.show(parentScreen), { renew: true, back: () => void app.show(parentScreen) })));
    });
  }
  // #end
  on('.mp-card', 'click', () => void app.show(plusScreen(parentScreen)));
  on('.plus-row', 'click', () => void app.show(plusVideoFor(app, parentScreen), 'liquid'));
  on('.story-row', 'click', () => void app.show(openerScreen({ first: false, label: 'Done', done: () => void app.show(parentScreen) }), 'liquid'));
  on('.tips-row', 'click', () => {
    app.save.update((d) => d.children.forEach((c) => (c.toured = false)));
    app.toast('Done. The tips show next time each child opens the map.');
  });
  on('.adv-what', 'click', () => void showParentAdventureTips(app, el));
}

/** One child's settings: report, age, difficulty, school syllabus, Adventure, play together. */
export function childSettingsScreen(c: Child) {
  return (app: App): Screen => {
    const here = childSettingsScreen(c);
    const el = html(`<section class="screen parent kid-settings" aria-label="Settings for ${esc(c.name)}">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">${esc(c.name)}</span><span style="width:50px"></span></header>
      <div class="scroll pa-body">
        <div class="ks-hero">${avatarHtml(c.avatar, 64)}<b>${esc(c.name)}</b><small>Age ${escv(c.age)}</small></div>
        <button class="pa-row card report" data-id="${escv(c.id)}"><b>${ICONS.chart} Report</b><small>What ${esc(c.name)} has learned, and where they need help</small></button>
        <button class="pa-row card sheet-btn"><b>Print a worksheet ${plusTag(app)}</b><small>${c.age <= 6 ? 12 : 20} questions mixed from the last skills ${esc(c.name)} played, as an A4 PDF. Answers on a separate page.</small></button>
        <button class="linkish sheet-html">Save it as a web page instead</button>
        <button class="pa-row card exam-btn"><b>Exam practice ${plusTag(app)}</b><small>A timed test on topics you pick, with a score sheet to share</small></button>
        <button class="pa-row card certs-btn"><b>Certificates ${plusTag(app)}</b><small>${(() => {
          const n = certificatesFor(app.pathFor(c), c.progress, c.log).length;
          return n ? `${n} earned · print one for the fridge` : 'One for each challenge beaten on the map';
        })()}</small></button>
        <h2 class="pa-h">Learning</h2>
        <button class="pa-row card age-btn"><b>Age</b><small>${escv(c.age)} · questions follow the age</small></button>
        <button class="pa-row card level-btn"><b>Difficulty</b><small>${CHALLENGE[c.challenge ?? 0].name} · ${CHALLENGE[c.challenge ?? 0].note}</small></button>
        <button class="pa-row card school-btn"><b>School syllabus ${plusTag(app)}</b><small>${c.school?.on ? (hasPlus(app) ? esc(schoolLabel(c.school)) : `${esc(schoolLabel(c.school))} · paused without MN ×`) : 'Off · follow the school syllabus instead of the age path'}</small></button>
        <div class="card pa-toggles">
          <label class="toggle-row"><span><b>Play together</b><small>No timers; after a slip they try one like it. On by default for ages 3–6.</small></span><input type="checkbox" role="switch" class="assist-btn" ${c.assisted ? 'checked' : ''}></label>
        </div>
        <h2 class="pa-h">Fun</h2>
        <div class="card pa-toggles">
          <label class="toggle-row"><span><b>Adventure mode</b><small>Quests and badges: daily goals, chests, a pet and outfits for Plus.</small></span><input type="checkbox" role="switch" class="adv-toggle" ${c.adventure?.on ? 'checked' : ''}></label>
        </div>
        <button class="linkish adv-what">What is Adventure mode?</button>
      </div>
    </section>`);
    const back = () => void app.show(parentScreen);
    el.querySelector('.back-btn')!.addEventListener('click', back);
    el.querySelector('.report')!.addEventListener('click', () => void app.show(reportScreen(c)));
    el.querySelector('.age-btn')!.addEventListener('click', () => void app.show(ageScreen(c)));
    el.querySelector('.sheet-btn')!.addEventListener('click', async () => {
      if (await needPlus(app, 'sheets', here)) void saveWorksheet(app, c, 'pdf');
    });
    el.querySelector('.sheet-html')!.addEventListener('click', async () => {
      if (await needPlus(app, 'sheets', here)) void saveWorksheet(app, c, 'html');
    });
    el.querySelector('.school-btn')!.addEventListener('click', async () => {
      if (await needPlus(app, 'school', here)) void app.show(schoolScreen(c, here));
    });
    el.querySelector('.exam-btn')!.addEventListener('click', async () => {
      if (await needPlus(app, 'exam', here)) void app.show(examSetupScreen(c, here));
    });
    el.querySelector('.certs-btn')!.addEventListener('click', async () => {
      if (await needPlus(app, 'certs', here)) void app.show(certsScreen(c, here));
    });
    el.querySelector('.level-btn')!.addEventListener('click', async () => {
      const actions: { label: string; value: number; kind: 'mint' | 'ghost'; back?: boolean }[] = [
        ...CHALLENGE.map((x, i) => ({ label: `${x.name} — ${x.note}`, value: i, kind: i === (c.challenge ?? 0) ? ('mint' as const) : ('ghost' as const) })),
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
      // Turning it on: show the parent what their child will get.
      if (on) await showParentAdventureTips(app, el);
      app.toast(on ? `Adventure on for ${c.name}.` : `Adventure off for ${c.name}. Badges are kept for later.`);
    });
    el.querySelector('.adv-what')!.addEventListener('click', () => void showParentAdventureTips(app, el));
    return { el, back: () => (back(), true), mounted: () => stagger(el.querySelectorAll('.pa-body > *'), { gap: 35 }) };
  };
}

/** Once, on the phone: may MN send the melt-watch and backup notes? */
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
