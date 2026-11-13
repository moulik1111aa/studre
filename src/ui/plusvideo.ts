// The MN × video: about a minute, for parents, made in code like the opening video and
// played by the same player (reel.ts). The voiceover (assets/audio/plus.mp3) was made by Moulik with a text-to-speech tool;
// each stop plays one part of it, with its own animation timed to the words (beats).

import type { App } from './app.ts';
import { muddleSvg } from './muddles.ts';
import { timesMarkSvg } from './mnx.ts';
import { beats, reelScreen, type ReelScene, type ReelVideo } from './reel.ts';

/** Where each part of the voiceover starts and ends (seconds), found from its pauses. */
const LINES: [number, number][] = [
  [0, 6.34], [6.62, 15.45], [16.12, 25.74], [26.12, 29.81], [30.14, 37.56], [38.21, 46.83], [47.48, 51.5], [52.14, 54.9],
];

/** A small drawn phone or tablet for the scenes (no emoji). */
const device = (label: string, cls = '') => `<div class="pv-dv ${cls}"><span class="pv-dvs"><b>★ 248</b><i></i></span><small>${label}</small></div>`;

function scenes(): ReelScene[] {
  return [
    {
      // "Every day, your child plays Em En, and every answer tells you a little more about how they're doing."
      id: 'pv-ans',
      bg: ['#6C47FF', '#8E6BFF'],
      caption: 'Every answer counts',
      sub: 'Each one tells you a little more.',
      art: `<div class="pv-ans">
        <div class="pv-chips">${['7 + 5 = 12', '9 − 4 = 5', '6 × 3 = 18', '¼ of 8 = 2', '40 + 7 = 47', '8 × 7 = 54'].map((q, k) => `<span class="${k === 5 ? 'no' : ''}" style="--k:${k}">${q}<i>${k === 5 ? '✗' : '✓'}</i></span>`).join('')}</div>
        <div class="pv-mini-bars">${[72, 88, 54, 93, 61].map((v, k) => `<i style="--v:${v}%;--k:${k}"></i>`).join('')}</div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-ans')!, [[300, 's1', () => app.sfx.tap()], [3100, 's2', () => app.sfx.whoosh()]], speed),
    },
    {
      // "Em En is free for every child, with no ads. Em En Times is for you, the parent. It helps you see where to help."
      id: 'pv-half',
      bg: ['#4C2FD9', '#7C5CFF'],
      caption: 'Free for every child',
      sub: 'MN × is for you, the parent.',
      art: `<div class="pv-half">
        <div class="pv-side without"><small>Your child · free</small><div class="pv-clear kid"><i style="--w:100%"></i><i style="--w:100%"></i><i style="--w:100%"></i><i style="--w:100%"></i></div><em>Levels, lessons, rewards</em></div>
        <div class="pv-side with"><small>You · MN ×</small><div class="pv-clear"><i style="--w:92%"></i><i style="--w:64%"></i><i style="--w:81%"></i><i style="--w:45%"></i></div><em>Where to help</em></div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-half')!, [[400, 's1', () => app.sfx.tap()], [4000, 's2', () => app.sfx.correct(1)]], speed),
    },
    {
      // "Each Monday, Em En Times picks the three skills your child is finding hardest, and turns them into short Focus rounds on the map, about three minutes each."
      id: 'pv-focus',
      bg: ['#5B3DF5', '#C026D3'],
      caption: 'A Focus plan each Monday',
      sub: 'Short rounds on the 3 hardest skills.',
      art: `<div class="pv-focus">
        <div class="pv-three">${['7 and 8 times tables', 'Subtract with borrowing', 'Fractions of amounts'].map((t, k) => `<span style="--k:${k}">${t}</span>`).join('')}</div>
        <div class="pv-round"><div class="pv-mud">${muddleSvg(4, 0)}</div><div class="pv-clock"><b>3</b><small>min</small></div></div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-focus')!, [[700, 's1', () => app.sfx.tap()], [4300, 's2', () => app.sfx.whoosh()], [7600, 's3', () => app.sfx.correct(1)]], speed),
    },
    {
      // "You can see each skill's score before the week, and how it changes."
      id: 'pv-rise',
      bg: ['#0EA5E9', '#6366F1'],
      caption: 'Before, and after',
      sub: 'Each skill’s score, week by week.',
      art: `<div class="pv-rise">${[[42, 68], [55, 63], [61, 60]].map(([a, b], k) => `<div class="pv-pair" style="--k:${k}"><span class="a" style="--v:${a}%"><b>${a}%</b></span><span class="b" style="--v:${b}%"><b>${b}%</b></span></div>`).join('')}<div class="pv-key"><small><i class="a"></i>Before</small><small><i class="b"></i>This week</small></div></div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-rise')!, [[300, 's1', () => app.sfx.tap()], [1800, 's2', () => app.sfx.coin(2)]], speed),
    },
    {
      // "The full report shows what's going well, what to practise next, how quickly they answer, and the time of day they play best."
      id: 'pv-report',
      bg: ['#7C3AED', '#DB2777'],
      caption: 'The full report',
      sub: 'What’s going well, and what’s next.',
      art: `<div class="pv-report">
        <div class="pv-row r1"><small>Going well</small><b class="g">× tables</b><b class="g">Place value</b></div>
        <div class="pv-row r2"><small>Practise next</small><b class="a">Borrowing</b><b class="a">Fractions</b></div>
        <div class="pv-row r3"><small>Speed</small><span class="pv-meter"><i></i></span><em>4.2 s</em></div>
        <div class="pv-row r4"><small>Best time</small><span class="pv-heat">${Array.from({ length: 21 }, (_, k) => `<i style="--k:${k};--v:${[0.2, 0.5, 0.9, 0.3, 0.7, 1, 0.4, 0.6, 0.2, 0.8, 1, 0.5, 0.3, 0.9, 0.6, 0.2, 0.7, 1, 0.4, 0.5, 0.8][k]}"></i>`).join('')}</span><em>5–6 pm</em></div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-report')!, [[400, 's1', () => app.sfx.tap()], [1900, 's2', () => app.sfx.tap()], [4300, 's3', () => app.sfx.whoosh()], [5600, 's4', () => app.sfx.coin(2)]], speed),
    },
    {
      // "You can choose topics from the C B S E, I C S E or Common Core lists to match your child's class, and print a worksheet for a screen-free evening."
      id: 'pv-school',
      bg: ['#16A34A', '#0F766E'],
      caption: 'Topics to match their class',
      sub: 'And worksheets to print.',
      art: `<div class="pv-school">
        <div class="pv-boards"><b class="on">CBSE</b><b>ICSE</b><b>Common Core</b></div>
        <div class="pv-class"><span>Class</span><b class="c3">3</b><b class="c4">4</b></div>
        <ul class="pv-topics">
          <li class="t1"><i></i>Place value to 1,000</li>
          <li class="t2"><i></i>Add and subtract 3 digits</li>
          <li class="t3 off"><i></i>Roman numerals</li>
          <li class="t4"><i></i>Times tables 2 to 10</li>
        </ul>
        <div class="pv-mini-sheet"><b>Worksheet</b><i></i><i></i><i></i><i></i></div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-school')!, [[600, 's1', () => app.sfx.tap()], [2400, 's2', () => app.sfx.tap()], [3800, 's3', () => app.sfx.coin(1)], [5400, 's4', () => app.sfx.whoosh()]], speed),
    },
    {
      // "Sign in with Google, and progress is the same on every phone and tablet."
      id: 'pv-sync',
      bg: ['#0EA5E9', '#4F46E5'],
      caption: 'The same on every phone',
      sub: 'Sign in with Google.',
      art: `<div class="pv-sync2">${device('Your phone', 'd1')}<span class="pv-arrows"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5l2-2.5M20 20v-5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${device('Tablet', 'd2 tab')}</div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-sync2')!, [[300, 's1', () => app.sfx.tap()], [1800, 's2', () => app.sfx.correct(2)]], speed),
    },
    {
      // "Em En Times. Learning, multiplied." (The recording went on "Try it free for seven days…";
      // that part is cut, since whether a free trial is offered is Google Play's to say.)
      id: 'end',
      bg: ['#6C47FF', '#8E6BFF'],
      caption: 'See the whole picture',
      sub: 'Cancel any time in Google Play.',
      art: `<div class="pv-endx"><span class="pv-x">${timesMarkSvg('turn-in')}</span><b>MN</b><small>Learning, multiplied.</small></div>`,
    },
  ];
}

const VIDEO: ReelVideo = { scenes, lines: LINES, audioId: 'plus-audio', name: 'What MN × adds' };

/** The MN × video. `done` runs from the button at the end; Skip goes to `leave`. */
/** `cta`: a main button at the end (to the plans), when MN × can be bought here and isn't on. */
export function plusVideoScreen(done: () => void, label = 'Done', leave = done, cta?: { label: string; act: () => void }) {
  return (app: App) => reelScreen({ first: false, label, done, leave, video: VIDEO, cta })(app);
}
