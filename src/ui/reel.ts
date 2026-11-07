// The opening video: a one-minute, reel-style ad made in code, with a recorded voiceover
// (assets/audio/opening.mp3, one file). It moves in stops: each stop plays its line of the
// voiceover (or, for the worked word problem, plays for a set time) and moves on by itself;
// Back replays the one before and stays there until Next. One moment
// lets the child tap the answer. It says what MN (Mission Next) is for (screen time that builds
// something), how it keeps a child going (a treat they choose, a jar that fills with right
// answers, lessons after mistakes, bosses) and who is in charge (the parent).
// The first time it can't be skipped: Next unlocks once the line has played. Afterwards
// (welcome screen, parent area) Skip and Next work straight away.

import { html, esc, type App, type Screen } from './app.ts';
import { plusSvg, plusFaceSvg } from './plus.ts';
import { BOSS_EMOJI } from './bosses.ts';
import { reducedMotion } from '../render/motion.ts';

/** Coins fly in an arc from one element to another. */
function flyCoins(from: Element, to: Element, n = 6): Promise<void> {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (reducedMotion() || !a.width || !b.width) return Promise.resolve();
  const runs: Promise<unknown>[] = [];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('i');
    c.className = 'fly-coin';
    document.body.appendChild(c);
    const x0 = a.x + a.width / 2 - 11 + (Math.random() - 0.5) * a.width * 0.5;
    const y0 = a.y + a.height / 2 - 11;
    const x1 = b.x + b.width / 2 - 11;
    const y1 = b.y + b.height / 2 - 11;
    const lift = 60 + Math.random() * 50;
    const anim = c.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - lift}px) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: 0.9 },
      ],
      { duration: 720, delay: k * 70, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' },
    );
    runs.push(anim.finished.then(() => c.remove(), () => c.remove()));
  }
  return Promise.all(runs).then(() => undefined);
}

export interface ReelScene {
  id: string;
  /** A stop without a line in the voiceover plays for this long instead (ms). */
  silentMs?: number;
  /** Background colours (top, bottom). */
  bg: [string, string];
  caption: string;
  sub?: string;
  art: string;
  /** Runs when the scene starts; returns a clean-up. */
  enter?: (el: HTMLElement, app: App, speed: number) => (() => void) | void;
}

/** A caption whose words pop in one after another. */
export const words = (text: string, delay = 0.15) =>
  esc(text)
    .split(' ')
    .map((w, i) => `<span class="rl-w" style="--d:${(delay + i * 0.11).toFixed(2)}s">${w}</span>`)
    .join(' ');

const FEED = ['🎬', '😂', '🔥', '🐱', '💃', '🎮', '🤳', '😂', '🔥', '🐶', '🎬', '😂'];

function answerScene(el: HTMLElement, app: App, speed = 1): () => void {
  const jar = el.querySelector<HTMLElement>('.rl-jar')!;
  const fill = jar.querySelector<HTMLElement>('i')!;
  let answered = false;
  const answer = async (b: HTMLElement) => {
    if (answered) return;
    answered = true;
    b.classList.add('right');
    el.querySelector('.rl-tap')?.classList.add('gone');
    app.sfx.correct(2);
    await flyCoins(b, jar, 8);
    app.sfx.coin(3);
    fill.style.height = '55%';
    el.querySelector('.rl-plus')?.classList.add('on');
  };
  const right = el.querySelector<HTMLElement>('.rl-choice[data-right]')!;
  el.querySelectorAll<HTMLElement>('.rl-choice').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.hasAttribute('data-right')) void answer(b);
      else if (!answered) {
        b.classList.add('wrong');
        app.sfx.wrong();
      }
    }),
  );
  // Nobody tapped? The answer taps itself, so the video never waits.
  const t = setTimeout(() => void answer(right), 3800 * speed);
  return () => clearTimeout(t);
}

/** The worked fix: 99 rounds up to 100 (700), then one 7 comes off (693), then a tick. */
function fixScene(el: HTMLElement, app: App, speed = 1): () => void {
  const box = el.querySelector<HTMLElement>('.rl-fix')!;
  box.classList.remove('s1', 's2', 's3');
  const beats: [number, string, () => void][] = [
    [700, 's1', () => app.sfx.whoosh()],
    [1900, 's2', () => app.sfx.tap()],
    [3000, 's3', () => app.sfx.correct(3)],
  ];
  const timers = beats.map(([ms, cls, sound]) =>
    window.setTimeout(() => {
      box.classList.add(cls);
      sound();
    }, ms * speed),
  );
  return () => timers.forEach(clearTimeout);
}

function scenes(): ReelScene[] {
  return [
    {
      id: 'reels',
      bg: ['#FF4F8B', '#5B21B6'],
      caption: 'Endless reels…',
      sub: '…nothing learned.',
      art: `<div class="rl-phone"><div class="rl-feed">${FEED.map((e) => `<b>${e}<small>♥ ${Math.floor(Math.random() * 90 + 10)}k</small></b>`).join('')}</div><span class="rl-zero">0 learned</span></div>`,
    },
    {
      id: 'whatif',
      bg: ['#6D5DFC', '#0EA5E9'],
      caption: 'What if screen time built something?',
      art: `<div class="rl-whatif">${['1', '+', '3', '×', '7', '½', '=', '9'].map((s, i) => `<span class="rl-orb" style="--k:${i}">${s}</span>`).join('')}<div class="rl-dog">${plusSvg({ cls: 'alive', noShadow: true })}</div></div>`,
    },
    {
      id: 'meet',
      bg: ['#7C3AED', '#DB2777'],
      caption: 'Meet MN',
      sub: 'Mission Next: maths missions from age 3 to 16.',
      art: `<div class="rl-meet"><div class="rl-logo">${plusSvg({ cls: 'alive', noShadow: true })}</div><div class="rl-mark"><span>M</span><span>N</span><small>Mission Next</small></div></div>`,
    },
    {
      id: 'treat',
      bg: ['#F59E0B', '#EA580C'],
      caption: 'Your child picks a treat',
      sub: 'Locked until it’s earned.',
      art: `<div class="rl-treat"><div class="rl-cards"><b>🍦</b><b class="pick">🍫</b><b>📚</b></div><div class="rl-bigjar"><em>🍫</em><span class="rl-lock">🔒</span></div></div>`,
    },
    {
      id: 'answer',
      bg: ['#16A34A', '#0D9488'],
      caption: 'Right answers fill the jar',
      art: `<div class="rl-answer"><div class="rl-q"><h3>7 × 8 = ?</h3><div class="rl-choices"><button class="rl-choice">54</button><button class="rl-choice" data-right>56</button><button class="rl-choice">48</button><button class="rl-choice">64</button></div><p class="rl-tap">👆 Tap the answer!</p></div><div class="rl-jarcol"><span class="rl-jar"><i></i><em>🍫</em></span><span class="rl-plus">+30 coins</span></div></div>`,
      enter: answerScene,
    },
    {
      // A slip, fixed the clever way: 99 × 7 is "100 sevens, take one 7 away" (beats s1–s3).
      id: 'lesson',
      bg: ['#0EA5E9', '#4F46E5'],
      caption: 'Wrong? Plus shows how.',
      sub: 'One step at a time.',
      art: `<div class="rl-fix">
        <span class="rl-coach">${plusFaceSvg({ cls: 'oops' })}</span>
        <div class="fx-card">
          <p class="fx-q"><b>99 × 7 = ?</b><span>You said <s>683</s></span></p>
          <p class="fx-line"><span class="fx-flip fx-n"><i class="a">99</i><i class="b">100</i></span><span>× 7</span><span class="fx-minus">− 7</span><span>=</span><span class="fx-flip fx-r"><i class="a">?</i><i class="b">700</i><i class="c">693</i></span></p>
          <p class="fx-hint"><span class="h1">99 is nearly 100</span><span class="h2">100 sevens, take one 7 away</span><span class="h3">✓ 99 × 7 = 693</span></p>
        </div>
      </div>`,
      enter: fixScene,
    },
    {
      id: 'days',
      bg: ['#E11D48', '#9333EA'],
      caption: 'A treat about every 10 days',
      sub: 'Not a chocolate every day, just steady effort.',
      art: `<div class="rl-days">${Array.from({ length: 10 }, (_, i) => `<span class="${i === 9 ? 'win' : ''}" style="--k:${i}"><small>Day ${i + 1}</small><b>${i === 9 ? '🍫' : '✓'}</b></span>`).join('')}</div>`,
    },
    {
      id: 'dream',
      bg: ['#2563EB', '#7C3AED'],
      caption: 'Big dreams take months',
      sub: 'Skip a day and the jar shrinks a little.',
      art: `<div class="rl-dream"><span class="rl-dreamjar"><i></i><b>🚲</b></span><span class="rl-drip"></span></div>`,
    },
    {
      id: 'boss',
      bg: ['#9333EA', '#C026D3'],
      caption: 'Beat bosses. Win trophies.',
      art: `<div class="rl-boss"><span class="rl-monster">${BOSS_EMOJI.bubbles}</span><span class="rl-hit">POW!</span><span class="rl-trophy">🏆</span></div>`,
    },
    {
      id: 'charge',
      bg: ['#0F766E', '#1E3A8A'],
      caption: 'And you’re in charge',
      art: `<div class="rl-chips"><p style="--k:0">⏱️ A daily time limit</p><p style="--k:1">🔒 A parent PIN</p><p style="--k:2">🎁 You hand prizes over</p><p style="--k:3">📵 No ads, works offline</p></div>`,
    },
    {
      id: 'end',
      bg: ['#6D5DFC', '#DB2777'],
      caption: 'Small steps. Real rewards.',
      art: `<div class="rl-end"><div class="rl-logo">${plusSvg({ cls: 'spin', noShadow: true })}</div><div class="rl-mark"><span>M</span><span>N</span><small>Mission Next</small></div></div>`,
    },
  ];
}

/** Where each line of the voiceover starts and ends (seconds), one per voiced scene, in order. */
const LINES: [number, number][] = [
  [0, 6.28], [7.11, 9.77], [10.33, 16.82], [17.83, 22.9], [23.78, 29.98], [30.53, 34.63],
  [35.67, 40.58], [41.47, 46.4], [47.31, 49.84], [50.49, 57.3], [58.26, 62.36],
];

/** A voiceover, inlined by the build (scripts/build.mjs) as base64 MP3 in a <script> with this id. */
const audioUrls = new Map<string, string | null>();
function voiceover(id = 'reel-audio'): HTMLAudioElement | null {
  if (!audioUrls.has(id)) {
    const b64 = document.getElementById(id)?.textContent?.trim();
    audioUrls.set(id, b64 ? URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'audio/mpeg' })) : null);
  }
  const url = audioUrls.get(id);
  if (!url) return null;
  const a = new Audio(url);
  a.preload = 'auto';
  return a;
}

/** Another video played the same way (the MN Premium video): its stops, its voiceover and where each line is. */
export interface ReelVideo {
  scenes: () => ReelScene[];
  lines: [number, number][];
  audioId: string;
  /** What the screen is called for screen readers. */
  name: string;
}

/** Run each beat (a class on `box`, and a sound) at its time; returns a clean-up. */
export function beats(box: HTMLElement, list: [number, string, (() => void)?][], speed: number): () => void {
  box.classList.remove(...list.map(([, c]) => c));
  const timers = list.map(([ms, cls, sound]) =>
    window.setTimeout(() => {
      box.classList.add(cls);
      sound?.();
    }, ms * speed),
  );
  return () => timers.forEach(clearTimeout);
}

export interface ReelOptions {
  /** First time: no skipping; Next waits for each line. */
  first: boolean;
  /** The button at the end. */
  label: string;
  done: () => void;
  /** Where Skip / Back go (later times only). */
  leave?: () => void;
  /** Play another video instead of the opening one. */
  video?: ReelVideo;
}

export function reelScreen(o: ReelOptions) {
  return (app: App): Screen => {
    // Browser tests (?debug&fastreel) run it 20 times faster, without sound (&fastreel=0.25: 4 times).
    const q = new URLSearchParams(location.search);
    const fast = app.debug && q.has('fastreel');
    const speed = fast ? Number(q.get('fastreel')) || 0.05 : 1;
    const list = (o.video?.scenes ?? scenes)();
    const LINES_OF = o.video?.lines ?? LINES;
    const audio = fast ? null : voiceover(o.video?.audioId);
    let i = -1;
    let heard = -1; // the furthest stop whose line has finished
    let muted = !app.save.data.settings.voice;
    let paused = false;
    let timer = 0;
    let frame = 0;
    let stopAt = 0;
    /** A silent stop: when it ends, and how long was left when it was paused. */
    let silentEnd = 0;
    let silentLeft = 0;
    /** It plays straight through on its own; going back (rewind) stops at that stop until Next. */
    let auto = true;
    let advance = 0;
    let cleanup: (() => void) | void;
    const el = html(`<section class="screen reel${o.first ? ' first' : ''}" aria-label="${esc(o.video?.name ?? 'MN in one minute')}">
      <div class="rl-bars" aria-hidden="true">${list.map(() => '<i><b></b></i>').join('')}</div>
      <div class="rl-top"><button class="rl-btn rl-mute" aria-label="Sound">${muted ? '🔇' : '🔊'}</button>${o.first ? '' : '<button class="rl-btn rl-skip">Skip</button>'}</div>
      <div class="rl-stage">${list
        .map(
          (s) => `<article class="rl-scene rl-s-${s.id}" style="--a:${s.bg[0]};--b:${s.bg[1]}">
            <div class="rl-art">${s.art}</div>
            <h2 class="rl-cap">${words(s.caption)}</h2>
            ${s.sub ? `<p class="rl-sub" style="--d:${(0.4 + s.caption.split(' ').length * 0.11).toFixed(2)}s">${esc(s.sub)}</p>` : ''}
          </article>`,
        )
        .join('')}</div>
      <div class="rl-nav"><button class="rl-btn rl-prev" aria-label="Back">←</button><span class="rl-count"></span><button class="btn rl-next">Next →</button></div>
      <div class="rl-foot" hidden><button class="btn rl-go">${esc(o.label)}</button>${o.first ? '' : '<button class="btn ghost rl-again">Watch again</button>'}</div>
    </section>`);
    const sceneEls = [...el.querySelectorAll<HTMLElement>('.rl-scene')];
    const bars = [...el.querySelectorAll<HTMLElement>('.rl-bars i')];
    const foot = el.querySelector<HTMLElement>('.rl-foot')!;
    const nav = el.querySelector<HTMLElement>('.rl-nav')!;
    const next = el.querySelector<HTMLButtonElement>('.rl-next')!;
    const prev = el.querySelector<HTMLButtonElement>('.rl-prev')!;
    if (audio) audio.muted = muted;

    // Which voiceover line goes with each stop (none for a silent stop).
    let n = 0;
    const lineOf = list.map((s) => (s.silentMs ? null : LINES_OF[n++]));
    const lineMs = (k: number) => {
      const line = lineOf[k];
      return (line ? (line[1] - line[0]) * 1000 : list[k].silentMs!) * speed;
    };
    /** The line for this stop has finished: unlock Next (or show the end buttons). */
    const lineDone = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      audio?.pause();
      heard = Math.max(heard, i);
      bars[i]?.classList.add('done');
      const last = i === list.length - 1;
      foot.hidden = !last;
      nav.hidden = last;
      next.disabled = false;
      next.classList.add('ready');
      // On to the next stop by itself (after a short breath), unless they went back to look again.
      if (auto && !last && !paused) advance = window.setTimeout(() => go(i + 1), 650 * speed);
    };
    /** Play this stop's line; a fallback clock keeps going if the sound can't play. */
    const playLine = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      const line = lineOf[i];
      const ms = lineMs(i);
      bars[i].style.setProperty('--ms', `${ms}ms`);
      if (!line) {
        // A stop with no voiceover: it plays for its own time.
        audio?.pause();
        stopAt = 0;
        silentEnd = performance.now() + ms;
        timer = window.setTimeout(lineDone, ms);
        return;
      }
      const [from, to] = line;
      stopAt = to;
      if (audio) {
        audio.currentTime = from;
        const watch = () => {
          if (audio.currentTime >= stopAt - 0.03 || audio.ended) return lineDone();
          frame = requestAnimationFrame(watch);
        };
        audio.play().then(
          () => (frame = requestAnimationFrame(watch)),
          () => (timer = window.setTimeout(lineDone, ms)),
        );
      } else timer = window.setTimeout(lineDone, ms);
    };
    const go = (k: number) => {
      if (k < 0 || k >= list.length) return;
      clearTimeout(advance);
      cleanup?.();
      cleanup = undefined;
      i = k;
      paused = false;
      el.classList.remove('paused');
      sceneEls.forEach((x, j) => x.classList.toggle('on', j === i));
      bars.forEach((b, j) => {
        b.classList.toggle('done', j < i);
        b.classList.toggle('now', j === i);
      });
      el.querySelector('.rl-count')!.textContent = `${i + 1} of ${list.length}`;
      prev.disabled = i === 0;
      next.classList.remove('ready');
      // First time, Next waits for the line; after that (or a line already heard) it's free.
      next.disabled = o.first && heard < i;
      const last = i === list.length - 1;
      foot.hidden = true;
      nav.hidden = false;
      if (last) {
        app.sfx.fanfare();
        const r = sceneEls[i].querySelector('.rl-logo')!.getBoundingClientRect();
        if (!reducedMotion()) setTimeout(() => app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 80), 300);
      } else app.sfx.whoosh();
      cleanup = list[i].enter?.(sceneEls[i], app, speed);
      playLine();
    };
    const pause = () => {
      if (paused || next.classList.contains('ready')) return;
      clearTimeout(advance);
      paused = true;
      el.classList.add('paused');
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      audio?.pause();
      silentLeft = Math.max(0, silentEnd - performance.now());
    };
    const resume = () => {
      if (!paused) return;
      paused = false;
      el.classList.remove('paused');
      if (!lineOf[i]) {
        silentEnd = performance.now() + silentLeft;
        timer = window.setTimeout(lineDone, silentLeft);
      } else if (audio && audio.currentTime < stopAt) {
        const watch = () => {
          if (audio.currentTime >= stopAt - 0.03 || audio.ended) return lineDone();
          frame = requestAnimationFrame(watch);
        };
        audio.play().then(() => (frame = requestAnimationFrame(watch)), () => (timer = window.setTimeout(lineDone, 1500)));
      } else timer = window.setTimeout(lineDone, 600 * speed);
    };
    const onVis = () => (document.visibilityState === 'hidden' ? pause() : resume());
    document.addEventListener('visibilitychange', onVis);

    el.querySelector('.rl-mute')!.addEventListener('click', (e) => {
      e.stopPropagation();
      muted = !muted;
      if (audio) audio.muted = muted;
      (e.currentTarget as HTMLElement).textContent = muted ? '🔇' : '🔊';
    });
    next.addEventListener('click', () => {
      if (next.disabled) return;
      auto = true;
      go(i + 1);
    });
    // Rewind: replay the stop before, and stay there until Next (then it plays on again).
    prev.addEventListener('click', () => {
      auto = false;
      go(i - 1);
    });
    const finish = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      audio?.pause();
      if (!o.video) app.save.update((d) => (d.settings.tourSeen = true));
    };
    el.querySelector('.rl-go')!.addEventListener('click', () => {
      finish();
      o.done();
    });
    el.querySelector('.rl-again')?.addEventListener('click', () => {
      auto = true;
      go(0);
    });
    el.querySelector('.rl-skip')?.addEventListener('click', () => {
      finish();
      (o.leave ?? o.done)();
    });
    // Hold the picture to pause.
    const stage = el.querySelector<HTMLElement>('.rl-stage')!;
    stage.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('button')) pause();
    });
    addEventListener('pointerup', resume);

    return {
      el,
      keepAwake: true,
      mounted: () => go(0),
      // Back goes to the stop before; from the first stop it leaves (not the first time).
      back: () => {
        if (i > 0) {
          auto = false;
          go(i - 1);
        }
        else if (!o.first) {
          finish();
          (o.leave ?? o.done)();
        }
        return true;
      },
      destroy: () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        clearTimeout(advance);
        cleanup?.();
        audio?.pause();
        document.removeEventListener('visibilitychange', onVis);
        removeEventListener('pointerup', resume);
      },
    };
  };
}
