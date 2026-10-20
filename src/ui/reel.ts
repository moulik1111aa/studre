// The opening video: a 30-second, reel-style ad made in code. Big captions, Plus the mascot, sound,
// and one moment to tap the answer. It says what Study Hard is for (screen time that builds
// something), how it keeps a child going (a treat they choose, a jar that fills with right
// answers, lessons after mistakes, bosses) and who is in charge (the grown-up).
// The first time it can't be skipped; afterwards (welcome screen, parent area) it can.

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

interface ReelScene {
  id: string;
  /** How long it stays (ms). The last scene stays until the button is tapped. */
  ms: number;
  /** Background colours (top, bottom). */
  bg: [string, string];
  caption: string;
  sub?: string;
  art: string;
  /** Runs when the scene starts; returns a clean-up. */
  enter?: (el: HTMLElement, app: App) => (() => void) | void;
}

/** A caption whose words pop in one after another. */
const words = (text: string, delay = 0.15) =>
  esc(text)
    .split(' ')
    .map((w, i) => `<span class="rl-w" style="--d:${(delay + i * 0.11).toFixed(2)}s">${w}</span>`)
    .join(' ');

const FEED = ['🎬', '😂', '🔥', '🐱', '💃', '🎮', '🤳', '😂', '🔥', '🐶', '🎬', '😂'];

function answerScene(el: HTMLElement, app: App): () => void {
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
  const t = setTimeout(() => void answer(right), 2300);
  return () => clearTimeout(t);
}

function scenes(): ReelScene[] {
  return [
    {
      id: 'reels',
      ms: 3000,
      bg: ['#FF4F8B', '#5B21B6'],
      caption: 'Endless reels…',
      sub: '…teach nothing.',
      art: `<div class="rl-phone"><div class="rl-feed">${FEED.map((e) => `<b>${e}<small>♥ ${Math.floor(Math.random() * 90 + 10)}k</small></b>`).join('')}</div><span class="rl-zero">0 learned</span></div>`,
    },
    {
      id: 'whatif',
      ms: 2800,
      bg: ['#6D5DFC', '#0EA5E9'],
      caption: 'What if screen time built something?',
      art: `<div class="rl-whatif">${['1', '+', '3', '×', '7', '½', '=', '9'].map((s, i) => `<span class="rl-orb" style="--k:${i}">${s}</span>`).join('')}<div class="rl-dog">${plusSvg({ cls: 'alive', noShadow: true })}</div></div>`,
    },
    {
      id: 'meet',
      ms: 2400,
      bg: ['#7C3AED', '#DB2777'],
      caption: 'Meet Study Hard',
      sub: 'Maths from age 3 to 16.',
      art: `<div class="rl-meet"><div class="rl-logo">${plusSvg({ cls: 'alive', noShadow: true })}</div><div class="rl-mark"><span>Study</span> <span>Hard</span></div></div>`,
    },
    {
      id: 'treat',
      ms: 2800,
      bg: ['#F59E0B', '#EA580C'],
      caption: 'Your child picks a treat',
      sub: 'Locked in until it’s earned.',
      art: `<div class="rl-treat"><div class="rl-cards"><b>🍦</b><b class="pick">🍫</b><b>📚</b></div><div class="rl-bigjar"><em>🍫</em><span class="rl-lock">🔒</span></div></div>`,
    },
    {
      id: 'answer',
      ms: 4000,
      bg: ['#16A34A', '#0D9488'],
      caption: 'Right answers fill the jar',
      art: `<div class="rl-answer"><div class="rl-q"><h3>7 × 8 = ?</h3><div class="rl-choices"><button class="rl-choice">54</button><button class="rl-choice" data-right>56</button><button class="rl-choice">48</button><button class="rl-choice">64</button></div><p class="rl-tap">👆 Tap the answer!</p></div><div class="rl-jarcol"><span class="rl-jar"><i></i><em>🍫</em></span><span class="rl-plus">+30 coins</span></div></div>`,
      enter: answerScene,
    },
    {
      id: 'lesson',
      ms: 2800,
      bg: ['#0EA5E9', '#4F46E5'],
      caption: 'Wrong? Plus shows how.',
      art: `<div class="rl-lesson"><span class="rl-coach">${plusFaceSvg({ cls: 'oops' })}</span><div class="rl-steps"><p style="--k:0"><i>1</i>45 − 10 = 35</p><p style="--k:1"><i>2</i>35 − 8 = 27</p><p class="ok" style="--k:2"><i>✓</i>So 45 − 18 = 27</p></div></div>`,
    },
    {
      id: 'days',
      ms: 2800,
      bg: ['#E11D48', '#9333EA'],
      caption: 'A treat about every 10 days',
      sub: 'Not a chocolate every day.',
      art: `<div class="rl-days">${Array.from({ length: 10 }, (_, i) => `<span class="${i === 9 ? 'win' : ''}" style="--k:${i}"><small>Day ${i + 1}</small><b>${i === 9 ? '🍫' : '✓'}</b></span>`).join('')}</div>`,
    },
    {
      id: 'dream',
      ms: 2800,
      bg: ['#2563EB', '#7C3AED'],
      caption: 'Big dreams take months',
      sub: 'Skip a day and the jar melts a little.',
      art: `<div class="rl-dream"><span class="rl-dreamjar"><i></i><b>🚲</b></span><span class="rl-drip"></span></div>`,
    },
    {
      id: 'boss',
      ms: 2400,
      bg: ['#9333EA', '#C026D3'],
      caption: 'Beat bosses. Win trophies.',
      art: `<div class="rl-boss"><span class="rl-monster">${BOSS_EMOJI.bubbles}</span><span class="rl-hit">POW!</span><span class="rl-trophy">🏆</span></div>`,
    },
    {
      id: 'charge',
      ms: 2800,
      bg: ['#0F766E', '#1E3A8A'],
      caption: 'And you’re in charge',
      art: `<div class="rl-chips"><p style="--k:0">⏱️ A daily time limit</p><p style="--k:1">🔒 A grown-up lock</p><p style="--k:2">🎁 You hand prizes over</p><p style="--k:3">📵 No ads, works offline</p></div>`,
    },
    {
      id: 'end',
      ms: 0,
      bg: ['#6D5DFC', '#DB2777'],
      caption: 'Small steps. Real rewards.',
      art: `<div class="rl-end"><div class="rl-logo">${plusSvg({ cls: 'spin', noShadow: true })}</div><div class="rl-mark"><span>Study</span> <span>Hard</span></div></div>`,
    },
  ];
}

export interface ReelOptions {
  /** First time: no skipping, no tapping ahead. */
  first: boolean;
  /** The button at the end. */
  label: string;
  done: () => void;
  /** Where Skip / Back go (later times only). */
  leave?: () => void;
}

export function reelScreen(o: ReelOptions) {
  return (app: App): Screen => {
    // Browser tests (?debug&fastreel) play it 20 times faster.
    const fast = app.debug && new URLSearchParams(location.search).has('fastreel') ? 0.05 : 1;
    const list = scenes().map((s) => ({ ...s, ms: Math.round(s.ms * fast) }));
    let i = -1;
    let narrate = app.save.data.settings.voice;
    let timer = 0;
    let startedAt = 0;
    let left = 0;
    let paused = false;
    let cleanup: (() => void) | void;
    const el = html(`<section class="screen reel${o.first ? ' first' : ''}" aria-label="Study Hard in 30 seconds">
      <div class="rl-bars" aria-hidden="true">${list.map(() => '<i><b></b></i>').join('')}</div>
      <div class="rl-top"><button class="rl-btn rl-mute" aria-label="Sound">${narrate ? '🔊' : '🔇'}</button>${o.first ? '' : '<button class="rl-btn rl-skip">Skip</button>'}</div>
      <div class="rl-stage">${list
        .map(
          (s) => `<article class="rl-scene rl-s-${s.id}" style="--a:${s.bg[0]};--b:${s.bg[1]}">
            <div class="rl-art">${s.art}</div>
            <h2 class="rl-cap">${words(s.caption)}</h2>
            ${s.sub ? `<p class="rl-sub" style="--d:${(0.4 + s.caption.split(' ').length * 0.11).toFixed(2)}s">${esc(s.sub)}</p>` : ''}
          </article>`,
        )
        .join('')}</div>
      <div class="rl-foot" hidden><button class="btn rl-go">${esc(o.label)}</button>${o.first ? '' : '<button class="btn ghost rl-again">Watch again</button>'}</div>
    </section>`);
    const sceneEls = [...el.querySelectorAll<HTMLElement>('.rl-scene')];
    const bars = [...el.querySelectorAll<HTMLElement>('.rl-bars i')];
    const foot = el.querySelector<HTMLElement>('.rl-foot')!;

    const say = () => {
      const s = list[i];
      if (narrate) app.voice.say(`${s.caption.replace('…', '.')} ${s.sub ?? ''}`, undefined, true);
    };
    const arm = (ms: number) => {
      clearTimeout(timer);
      if (!ms) return;
      startedAt = performance.now();
      left = ms;
      timer = window.setTimeout(() => go(i + 1), ms);
    };
    const go = (k: number) => {
      if (k < 0 || k >= list.length) return;
      cleanup?.();
      cleanup = undefined;
      i = k;
      const s = list[i];
      sceneEls.forEach((x, j) => x.classList.toggle('on', j === i));
      bars.forEach((b, j) => {
        b.classList.toggle('done', j < i);
        b.classList.toggle('now', j === i);
        b.style.setProperty('--ms', `${s.ms || 1}ms`);
      });
      const last = i === list.length - 1;
      foot.hidden = !last;
      if (last) {
        app.sfx.fanfare();
        const r = sceneEls[i].querySelector('.rl-logo')!.getBoundingClientRect();
        if (!reducedMotion()) setTimeout(() => app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 80), 300);
      } else app.sfx.whoosh();
      cleanup = s.enter?.(sceneEls[i], app);
      say();
      arm(s.ms);
    };
    const pause = () => {
      if (paused || !list[i]?.ms) return;
      paused = true;
      clearTimeout(timer);
      left = Math.max(400, left - (performance.now() - startedAt));
      el.classList.add('paused');
      app.voice.stop();
    };
    const resume = () => {
      if (!paused) return;
      paused = false;
      el.classList.remove('paused');
      arm(left);
    };
    const onVis = () => (document.visibilityState === 'hidden' ? pause() : resume());
    document.addEventListener('visibilitychange', onVis);

    el.querySelector('.rl-mute')!.addEventListener('click', (e) => {
      e.stopPropagation();
      narrate = !narrate;
      (e.currentTarget as HTMLElement).textContent = narrate ? '🔊' : '🔇';
      if (narrate) say();
      else app.voice.stop();
    });
    const finish = () => {
      clearTimeout(timer);
      app.voice.stop();
      app.save.update((d) => (d.settings.tourSeen = true));
    };
    el.querySelector('.rl-go')!.addEventListener('click', () => {
      finish();
      o.done();
    });
    el.querySelector('.rl-again')?.addEventListener('click', () => go(0));
    el.querySelector('.rl-skip')?.addEventListener('click', () => {
      finish();
      (o.leave ?? o.done)();
    });
    // Later times: tap the right side to go on, the left side to go back. Hold to pause.
    const stage = el.querySelector<HTMLElement>('.rl-stage')!;
    if (!o.first) {
      stage.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const x = e.clientX / innerWidth;
        if (x > 0.6 && i < list.length - 1) go(i + 1);
        else if (x < 0.3 && i > 0) go(i - 1);
      });
    }
    stage.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('button')) pause();
    });
    addEventListener('pointerup', resume);

    return {
      el,
      keepAwake: true,
      mounted: () => go(0),
      // First time there's no way out but through; later, back leaves.
      back: () => {
        if (!o.first) {
          finish();
          (o.leave ?? o.done)();
        }
        return true;
      },
      destroy: () => {
        clearTimeout(timer);
        cleanup?.();
        document.removeEventListener('visibilitychange', onVis);
        removeEventListener('pointerup', resume);
        app.voice.stop();
      },
    };
  };
}
