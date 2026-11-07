// The MN Premium video: about 90 seconds, for parents, made in code like the opening video
// and played by the same player (reel.ts). Moulik recorded the voiceover
// (assets/audio/plus.mp3); each stop plays one paragraph of it, with its own animation
// timed to the words (beats).

import type { App } from './app.ts';
import { plusSvg } from './plus.ts';
import { beats, reelScreen, type ReelScene, type ReelVideo } from './reel.ts';

/** Where each paragraph of the voiceover starts and ends (seconds), found from its pauses. */
const LINES: [number, number][] = [
  [0, 8.21], [8.85, 26.43], [26.9, 45.79], [46.54, 58.56], [59.31, 68.69], [69.43, 75.26], [76.1, 82.3], [82.98, 92.5],
];

const STAR = '⭐';

function scenes(): ReelScene[] {
  return [
    {
      // "Every star your child earns is real progress. Right now, it lives on just one phone. Lose that phone…"
      id: 'pv-one',
      bg: ['#F43F5E', '#7C3AED'],
      caption: 'All that progress…',
      sub: '…on just one phone.',
      art: `<div class="pv-one">
        <div class="pv-phone"><div class="pv-screen"><span class="pv-stars">${Array.from({ length: 9 }, (_, k) => `<i style="--k:${k}">${STAR}</i>`).join('')}</span><span class="pv-jar">🍫</span></div></div>
        <span class="pv-crack" aria-hidden="true"></span><span class="pv-gone">?</span>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-one')!, [[1200, 's1'], [4600, 's2', () => app.sfx.tap()], [6200, 's3', () => app.sfx.wrong()]], speed),
    },
    {
      // "MN Premium backs it all up with Google, automatically. New phone? Sign in… one tap. Your phone, your partner's phone, grandma's tablet…"
      id: 'pv-cloud',
      bg: ['#0EA5E9', '#4F46E5'],
      caption: 'Backed up with Google',
      sub: 'Back on any phone, in one tap.',
      art: `<div class="pv-cloud">
        <div class="pv-sky"><span class="pv-cl">☁️</span><span class="pv-ok">✓</span></div>
        <div class="pv-devs">
          <div class="pv-dev d1"><b>📱</b><small>Your phone</small><span class="pv-mini">${STAR} 248</span></div>
          <div class="pv-dev d2"><b>📱</b><small>New phone</small><span class="pv-mini">${STAR} 248</span><i class="pv-tap"></i></div>
          <div class="pv-dev d3"><b>📱</b><small>Partner’s</small><span class="pv-mini">${STAR} 248</span></div>
          <div class="pv-dev d4"><b>💻</b><small>Grandma’s tablet</small><span class="pv-mini">${STAR} 248</span></div>
        </div>
        <span class="pv-fly">${Array.from({ length: 6 }, (_, k) => `<i style="--k:${k}">${STAR}</i>`).join('')}</span>
      </div>`,
      enter: (el, app, speed) =>
        beats(el.querySelector('.pv-cloud')!, [[900, 's1', () => app.sfx.whoosh()], [3200, 's2', () => app.sfx.correct(1)], [5200, 's3', () => app.sfx.tap()], [7600, 's4', () => app.sfx.coin(2)], [11000, 's5', () => app.sfx.correct(2)]], speed),
    },
    {
      // "MN Premium also follows your child's school. Choose CBSE, ICSE or Common Core, pick the class, then tick only the topics…"
      id: 'pv-school',
      bg: ['#16A34A', '#0F766E'],
      caption: 'Follows their school',
      sub: 'You choose what’s on the path.',
      art: `<div class="pv-school">
        <div class="pv-boards"><b class="on">CBSE</b><b>ICSE</b><b>Common Core</b></div>
        <div class="pv-class"><span>Class</span><b class="c3">3</b><b class="c4">4</b></div>
        <ul class="pv-topics">
          <li class="t1"><i></i>Place value to 1,000</li>
          <li class="t2"><i></i>Add and subtract 3 digits</li>
          <li class="t3 off"><i></i>Roman numerals</li>
          <li class="t4"><i></i>Times tables 2 to 10</li>
        </ul>
        <div class="pv-path"><i></i><i></i><i class="rv">⚔️</i><i></i><i></i><i class="bs">👑</i></div>
        <span class="pv-kept">Progress kept ✓</span>
      </div>`,
      enter: (el, app, speed) =>
        beats(el.querySelector('.pv-school')!, [[1400, 's1', () => app.sfx.tap()], [4600, 's2', () => app.sfx.tap()], [7400, 's3', () => app.sfx.coin(1)], [11200, 's4', () => app.sfx.whoosh()], [15600, 's5', () => app.sfx.correct(2)]], speed),
    },
    {
      // "Then see the full picture. The complete report shows strengths, the exact skills that need practice, how quickly they answer, and the days and times they learn best."
      id: 'pv-report',
      bg: ['#7C3AED', '#DB2777'],
      caption: 'See the full picture',
      sub: 'No more guessing.',
      art: `<div class="pv-report">
        <div class="pv-row r1"><small>Strengths</small><b class="g">× tables</b><b class="g">Place value</b></div>
        <div class="pv-row r2"><small>Practise</small><b class="a">Borrowing</b><b class="a">Fractions</b></div>
        <div class="pv-row r3"><small>Speed</small><span class="pv-meter"><i></i></span><em>4.2 s</em></div>
        <div class="pv-row r4"><small>Best time</small><span class="pv-heat">${Array.from({ length: 21 }, (_, k) => `<i style="--k:${k};--v:${[0.2, 0.5, 0.9, 0.3, 0.7, 1, 0.4, 0.6, 0.2, 0.8, 1, 0.5, 0.3, 0.9, 0.6, 0.2, 0.7, 1, 0.4, 0.5, 0.8][k]}"></i>`).join('')}</span><em>5–6 pm</em></div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-report')!, [[900, 's1', () => app.sfx.tap()], [3600, 's2', () => app.sfx.tap()], [6400, 's3', () => app.sfx.whoosh()], [8600, 's4', () => app.sfx.coin(2)]], speed),
    },
    {
      // "Want time away from the screen? Print a worksheet made just for your child… with an answer key for you."
      id: 'pv-sheet',
      bg: ['#F59E0B', '#EA580C'],
      caption: 'Worksheets made for them',
      sub: 'Answer key included.',
      art: `<div class="pv-sheet">
        <div class="pv-printer"><span></span></div>
        <div class="pv-paper">
          <p class="h">Riya’s maths sheet</p>
          <p class="q q1"><b>1</b>47 + 38 = <u>85</u><i>✓</i></p>
          <p class="q q2"><b>2</b>6 × 7 = <u>42</u><i>✓</i></p>
          <p class="q q3"><b>3</b>903 − 458 = <u>445</u><i>✓</i></p>
        </div>
        <span class="pv-pencil">✏️</span>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-sheet')!, [[700, 's1', () => app.sfx.whoosh()], [3800, 's2', () => app.sfx.tap()], [5800, 's3', () => app.sfx.coin(1)]], speed),
    },
    {
      // "Parents with MN Premium know exactly where their child stands. Without it, you're only seeing part of the story."
      id: 'pv-half',
      bg: ['#1E1B4B', '#4338CA'],
      caption: 'Don’t miss half the story',
      art: `<div class="pv-half">
        <div class="pv-side without"><small>Without Premium</small><div class="pv-blur"><i></i><i></i><i></i><i></i></div></div>
        <div class="pv-side with"><small>With MN Premium</small><div class="pv-clear"><i style="--w:92%"></i><i style="--w:64%"></i><i style="--w:81%"></i><i style="--w:45%"></i></div></div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-half')!, [[500, 's1'], [2600, 's2', () => app.sfx.correct(1)]], speed),
    },
    {
      // "Try everything free for seven days. If you love it, stay on monthly, or pay once and keep MN Premium for life."
      id: 'pv-price',
      bg: ['#0F766E', '#2563EB'],
      caption: 'Free for 7 days',
      sub: 'Then monthly, or once for life.',
      art: `<div class="pv-price">
        <span class="pv-free">7 days free</span>
        <div class="pv-cards">
          <div class="pv-card m"><small>Monthly</small><b>Pay monthly</b><span>Cancel any time</span></div>
          <div class="pv-card l"><em>Best value</em><small>Lifetime</small><b>Pay once</b><span>Keep Premium forever</span></div>
        </div>
      </div>`,
      enter: (el, app, speed) => beats(el.querySelector('.pv-price')!, [[600, 's1', () => app.sfx.coin(2)], [2300, 's2', () => app.sfx.tap()], [3600, 's3', () => app.sfx.correct(2)]], speed),
    },
    {
      // "Everything your child plays with stays free, always. MN Premium is for you… Start your free week today."
      id: 'end',
      bg: ['#7C3AED', '#DB2777'],
      caption: 'Start your free week',
      sub: 'Everything your child plays with stays free, always.',
      art: `<div class="rl-end pv-end"><div class="rl-logo">${plusSvg({ cls: 'spin', noShadow: true })}</div><div class="rl-mark"><span>M</span><span>N</span><b class="pv-plus">Premium</b></div></div>`,
    },
  ];
}

const VIDEO: ReelVideo = { scenes, lines: LINES, audioId: 'plus-audio', name: 'What MN Premium adds' };

/** The MN Premium video. `done` runs from the button at the end; Skip goes to `leave`. */
export function plusVideoScreen(done: () => void, label = 'Done', leave = done) {
  return (app: App) => reelScreen({ first: false, label, done, leave, video: VIDEO })(app);
}
