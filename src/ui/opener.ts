// The opening film: a one-minute motion piece on the recorded voiceover (assets/audio/opening.mp3).
// Its own look, separate from the app's themes: a soft off-white stage with iridescent light
// at the edges, thin type that comes into focus word by word, frosted-glass pieces of the app
// tilted in depth, and one hero, the iridescent + mark, that is in every part of the film:
// tiles from the feed come together into it, it sits by the words, it becomes the tenth day,
// and it ends as the MN mark.
//
// Everything is drawn from one clock (`paint(t)`, t in seconds of the voiceover), so picture
// and voice can't drift apart, and any moment can be rendered on its own to check it
// (debug: window.__opener.seek(t)). Word timings come from the pauses in the recording.

import { esc, html, type App, type Screen } from './app.ts';
import { voiceover } from './reel.ts';

/** Everything on the stage sits this far below its centre, so the picture is balanced. */
const SHIFT = 110;
/** Where the film ends (seconds of the voiceover). */
const END = 62.4;

// ── easing ──────────────────────────────────────────────────────────────────
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const out3 = (x: number) => 1 - (1 - x) ** 3;
const out5 = (x: number) => 1 - (1 - x) ** 5;
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const back = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
/** In at `a` (taking `d`), out at `b`: 0 → 1 → 0. */
const live = (t: number, a: number, b: number, d = 0.5) => out3(seg(t, a, a + d)) * (1 - inOut(seg(t, b, b + d)));

// ── the mark ────────────────────────────────────────────────────────────────
let uid = 0;
/** The iridescent +: two rounded bars, light running through them. */
export function markSvg(cls = ''): string {
  const u = ++uid;
  return `<svg class="op-mark ${cls}" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="opG${u}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FF8A5B"/><stop offset=".28" stop-color="#FFC94D"/><stop offset=".5" stop-color="#5FE3B5"/><stop offset=".74" stop-color="#5B8CFF"/><stop offset="1" stop-color="#A06BFF"/>
      </linearGradient>
      <radialGradient id="opH${u}" cx=".35" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <path d="M78 22 Q78 10 90 10 H110 Q122 10 122 22 V78 H178 Q190 78 190 90 V110 Q190 122 178 122 H122 V178 Q122 190 110 190 H90 Q78 190 78 178 V122 H22 Q10 122 10 110 V90 Q10 78 22 78 H78 Z" fill="url(#opG${u})"/>
    <path d="M78 22 Q78 10 90 10 H110 Q122 10 122 22 V78 H178 Q190 78 190 90 V110 Q190 122 178 122 H122 V178 Q122 190 110 190 H90 Q78 190 78 178 V122 H22 Q10 122 10 110 V90 Q10 78 22 78 H78 Z" fill="url(#opH${u})"/>
  </svg>`;
}

// ── thin line icons (stage units, 120 box) ─────────────────────────────────
const ICON: Record<string, string> = {
  cone: '<path d="M40 52 L60 104 L80 52" /><path d="M36 52 C30 30 50 18 60 26 C70 18 90 30 84 52 Z" /><path d="M48 62 L72 62 M52 76 L68 76" />',
  book: '<path d="M60 34 C46 26 30 26 20 30 V96 C30 92 46 92 60 100 C74 92 90 92 100 96 V30 C90 26 74 26 60 34 Z" /><path d="M60 34 V100" />',
  lock: '<rect x="30" y="54" width="60" height="48" rx="10" /><path d="M42 54 V40 C42 24 78 24 78 40 V54" /><path d="M60 72 V84" />',
  clock: '<circle cx="60" cy="62" r="38" /><path d="M60 40 V62 L76 72" />',
  key: '<circle cx="42" cy="60" r="18" /><path d="M60 60 H100 M86 60 V74 M98 60 V70" />',
  gift: '<rect x="24" y="48" width="72" height="54" rx="6" /><path d="M20 36 H100 V48 H20 Z M60 36 V102" /><path d="M60 36 C50 18 32 22 40 36 M60 36 C70 18 88 22 80 36" />',
  star: '<path d="M60 18 L71 46 L101 48 L78 67 L86 97 L60 80 L34 97 L42 67 L19 48 L49 46 Z" />',
  plane: '<path d="M18 62 L102 26 L82 98 L60 74 Z" /><path d="M60 74 L102 26" />',
};
const icon = (k: string, cls = '') => `<svg class="op-ic ${cls}" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</g></svg>`;

// ── words that come into focus ──────────────────────────────────────────────
/**
 * A line of words. `*a few words*` is drawn in the light gradient, `~word~` gets crossed out,
 * `{+}` leaves room for the mark, and `[n:4:16:15.4]` counts from 4 to 16 starting at 15.4 s.
 */
function line(text: string, cls = ''): string {
  let hi = false;
  const words = text.split(' ').map((raw) => {
    if (raw === '{+}') return '<span class="op-w op-slot"></span>';
    let w = raw;
    const open = w.startsWith('*');
    if (open) (hi = true), (w = w.slice(1));
    const close = w.endsWith('*') || w.endsWith('*.') || w.endsWith('*?');
    w = w.replace(/\*/g, '');
    const n = /^\[n:(\d+):(\d+):([\d.]+)\](.*)$/.exec(w);
    const inner = n ? `<span class="op-num" data-from="${n[1]}" data-to="${n[2]}" data-at="${n[3]}" data-tail="${esc(n[4])}">${n[1]}${esc(n[4])}</span>` : w.startsWith('~') ? `<s>${esc(w.replace(/~/g, ''))}</s>` : esc(w);
    const span = `<span class="op-w${hi ? ' op-hi' : ''}">${inner}</span>`;
    if (close) hi = false;
    return span;
  });
  return `<p class="op-line ${cls}">${words.join(' ')}</p>`;
}

interface Beat {
  sel: string;
  in: number;
  out: number;
}

/** Every line on screen, when it comes in and when it goes (from the pauses in the voice). */
const LINES: Beat[] = [];
const say = (text: string, at: number, until: number, cls = ''): string => {
  const sel = `l${LINES.length}`;
  LINES.push({ sel, in: at, out: until });
  return line(text, `${sel} ${cls}`);
};

function film(): string {
  LINES.length = 0;
  const feed = Array.from({ length: 8 }, (_, i) => `<div class="op-card op-glass" data-i="${i}"><i style="--h:${(i * 47) % 360}"></i><b></b><b></b></div>`).join('');
  const tiles = Array.from({ length: 5 }, (_, i) => `<i class="op-tile op-glass" data-i="${i}"></i>`).join('');
  const dots = Array.from({ length: 10 }, (_, i) => `<i class="op-dot" data-i="${i}"></i>`).join('');
  return `
  <div class="op-glow" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="op-stage" aria-hidden="true"><div class="op-world" style="transform:translateY(${SHIFT}px)">
    <div class="op-feed">${feed}</div>
    <div class="op-tiles">${tiles}</div>

    <div class="op-text">
      ${say('Endless *reels.*', 0.2, 1.45)}
      ${say('Endless scrolling.', 1.62, 3.3)}
      ${say('And nothing ~learned.~', 4.0, 6.5, 'op-strike')}
      ${say('What if screen time', 7.1, 9.95)}
      ${say('*built* something?', 8.35, 9.95, 'op-l2')}
      ${say('Meet {+} *MN*', 10.75, 12.85, 'op-big')}
      ${say('Mission Next', 11.75, 12.85, 'op-sub')}
      ${say('Maths missions', 13.2, 17.3)}
      ${say('from age 3 to *[n:4:16:15.4].*', 15.2, 17.3, 'op-l2')}
      ${say('Your child picks a *treat.*', 17.85, 20.75)}
      ${say('Locked until it’s *earned.*', 21.0, 23.45)}
      ${say('Right answers', 23.8, 30.1)}
      ${say('fill the *jar.*', 26.6, 30.1, 'op-l2')}
      ${say('Wrong?', 30.55, 35.25)}
      ${say('MN shows *how.*', 31.55, 35.25, 'op-l2')}
      ${say('A treat about', 35.7, 39.35)}
      ${say('every *10 days.*', 36.6, 39.35, 'op-l2')}
      ${say('Steady *effort.*', 39.75, 41.05)}
      ${say('Big dreams take *months.*', 41.5, 44.2)}
      ${say('Skip a day,', 44.36, 46.95)}
      ${say('and it shrinks a *little.*', 45.45, 46.95, 'op-l2')}
      ${say('Beat the *bosses.*', 47.32, 50.15)}
      ${say('Win trophies.', 48.6, 50.15, 'op-l2')}
      ${say('And you’re in *charge.*', 50.5, 57.95)}
      ${say('Small steps.', 59.0, 61.0, 'op-end1')}
      ${say('Real *rewards.*', 60.0, 61.0, 'op-end2')}
    </div>

    <div class="op-treats">
      <div class="op-treat op-glass" data-i="0">${icon('cone')}</div>
      <div class="op-treat op-glass" data-i="1">${icon('gift')}<span class="op-jarfill"></span><span class="op-lid"></span>${icon('lock', 'op-lock')}</div>
      <div class="op-treat op-glass" data-i="2">${icon('book')}</div>
    </div>

    <div class="op-q op-glass">
      <div class="op-q1"><p class="op-sum">7 × 8</p><div class="op-pills"><button class="op-pill" data-v="54" tabindex="-1">54</button><button class="op-pill op-right" data-v="56" tabindex="-1">56</button><button class="op-pill" data-v="48" tabindex="-1">48</button><button class="op-pill" data-v="64" tabindex="-1">64</button></div></div>
      <div class="op-q2"><p class="op-sum"><span class="op-flip"><i>99</i><i>100</i></span> × 7<span class="op-minus">&nbsp;− 7</span></p><p class="op-said">You said <s>683</s></p><p class="op-res">= <span class="op-hi">693</span> <span class="op-tick">✓</span></p></div>
    </div>
    <div class="op-sparks">${Array.from({ length: 7 }, () => '<i></i>').join('')}</div>

    <div class="op-dots">${dots}</div>
    <svg class="op-ring" viewBox="0 0 700 700"><defs><linearGradient id="opRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A5B"/><stop offset=".35" stop-color="#FFC94D"/><stop offset=".6" stop-color="#5FE3B5"/><stop offset="1" stop-color="#5B8CFF"/></linearGradient></defs><circle class="op-track" cx="350" cy="350" r="300"/><circle class="op-arc" cx="350" cy="350" r="300" stroke="url(#opRing)"/></svg>
    <div class="op-medal"><span class="op-disc">${markSvg('op-mmark')}</span><i class="op-rib l"></i><i class="op-rib r"></i><span class="op-shine"></span></div>

    <div class="op-set">
      <div class="op-row op-glass" data-i="0">${icon('clock')}<span>Daily time limit</span><i class="op-tog"><b></b></i></div>
      <div class="op-row op-glass" data-i="1">${icon('key')}<span>Parent PIN</span><i class="op-pin"><b></b><b></b><b></b><b></b></i></div>
      <div class="op-row op-glass" data-i="2">${icon('star')}<span>You hand over prizes</span><i class="op-ok">✓</i></div>
      <div class="op-row op-glass" data-i="3">${icon('plane')}<span>No ads · works offline</span><i class="op-ok">✓</i></div>
    </div>

    <div class="op-hero"><span class="op-halo"></span>${markSvg()}</div>
    <div class="op-word"><b>MN</b><span>Mission Next</span></div>
  </div></div>`;
}

export interface OpenerOptions {
  /** First time: no Skip. */
  first: boolean;
  label: string;
  done: () => void;
  leave?: () => void;
}

export function openerScreen(o: OpenerOptions) {
  return (app: App): Screen => {
    const q = new URLSearchParams(location.search);
    // Browser tests (?debug&fastreel) run it 20 times faster, without sound.
    const fast = app.debug && q.has('fastreel');
    const speed = fast ? 1 / (Number(q.get('fastreel')) || 0.05) : 1;
    let muted = !app.save.data.settings.voice || fast;
    const el = html(`<section class="screen opener${o.first ? ' first' : ''}" aria-label="MN in one minute">
      ${film()}
      <div class="op-ui">
        <div class="op-bar" aria-hidden="true"><i></i></div>
        <div class="op-top"><button class="op-btn rl-mute" aria-label="Sound">${muted ? soundOff : soundOn}</button>${o.first ? '' : '<button class="op-btn rl-skip">Skip</button>'}</div>
        <button class="op-btn op-tapsound" hidden>Tap for sound</button>
        <div class="op-foot" hidden><button class="op-go rl-go">${esc(o.label)}</button>${o.first ? '' : '<button class="op-link rl-again">Watch again</button>'}</div>
      </div>
    </section>`);
    const stage = el.querySelector<HTMLElement>('.op-stage')!;
    const $ = <T extends Element = HTMLElement>(s: string) => stage.querySelector<T & HTMLElement>(s)!;
    const $$ = (s: string) => [...stage.querySelectorAll<HTMLElement>(s)];
    const lines = LINES.map((b) => ({ ...b, el: $(`.${b.sel}`), words: [...$(`.${b.sel}`).querySelectorAll<HTMLElement>('.op-w')] }));
    const feed = $$('.op-card');
    const tiles = $$('.op-tile');
    const treats = $$('.op-treat');
    const dots = $$('.op-dot');
    const sparks = $$('.op-sparks i');
    const rows = $$('.op-row');
    const glow = [...el.querySelectorAll<HTMLElement>('.op-glow i')];
    const hero = $('.op-hero');
    const halo = $('.op-halo');
    const qcard = $('.op-q');
    const arc = $('.op-arc');
    const ring = $('.op-ring');
    const medal = $('.op-medal');
    const word = $('.op-word');
    const jarFill = $('.op-jarfill');
    const bar = el.querySelector<HTMLElement>('.op-bar i')!;
    let answeredAt: number | null = null;
    let wrongAt: number | null = null;
    let slot: { x: number; y: number } | null = null;

    // The stage is 1080 wide and at least 1920 tall: it fills a tall phone (everything is placed
    // from its centre), and fits inside a wide screen.
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight;
      const s = H / W > 1920 / 1080 ? W / 1080 : H / 1920;
      stage.style.height = `${Math.max(1920, H / s)}px`;
      stage.style.transform = `translate(-50%, -50%) scale(${s})`;
      slot = null;
    };
    const set = (e: HTMLElement, o: number, tf = '', blur = 0) => {
      e.style.opacity = o < 0.002 ? '0' : o.toFixed(3);
      e.style.visibility = o < 0.002 ? 'hidden' : 'visible';
      if (tf) e.style.transform = tf;
      e.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : '';
    };

    const paint = (t: number) => {
      // Light at the edges: drifts, and blooms at the big moments.
      const bloom = 0.55 + 0.3 * live(t, 10.3, 12.8, 0.6) + 0.25 * live(t, 26.6, 29.8, 0.6) + 0.45 * seg(t, 58.2, 59.4);
      glow.forEach((g, i) => {
        const a = t * 0.12 + i * 1.7;
        g.style.transform = `translate(${Math.cos(a) * 90}px, ${Math.sin(a * 1.3) * 120}px) scale(${1 + 0.08 * Math.sin(a * 0.7)})`;
        g.style.opacity = (bloom * (i === 4 ? 0.6 : 1)).toFixed(3);
      });
      bar.style.transform = `scaleX(${clamp(t / END)})`;

      // Words come into focus one by one, and leave softly.
      for (const l of lines) {
        const vis = t > l.in - 0.05 && t < l.out + 0.7;
        l.el.style.display = vis ? '' : 'none';
        if (!vis) continue;
        l.words.forEach((w, i) => {
          const p = out5(seg(t, l.in + i * 0.085, l.in + i * 0.085 + 0.7));
          const g = inOut(seg(t, l.out + i * 0.03, l.out + i * 0.03 + 0.45));
          set(w, p * (1 - g), `translate3d(0, ${(1 - p) * 26 - g * 18}px, 0) scale(${0.96 + 0.04 * p})`, (1 - p) * 16 + g * 12);
        });
        l.el.querySelectorAll<HTMLElement>('.op-num[data-at]').forEach((n) => {
          const k = out3(seg(t, Number(n.dataset.at), Number(n.dataset.at) + 1.1));
          n.textContent = `${Math.round(lerp(Number(n.dataset.from), Number(n.dataset.to), k))}${n.dataset.tail ?? ''}`;
        });
        const s = l.el.querySelector<HTMLElement>('s');
        if (s) s.style.setProperty('--k', out3(seg(t, l.in + 1.4, l.in + 2.0)).toFixed(3));
      }

      // 1 · The feed: glass cards scrolling past, faster and faster, then gone.
      {
        const show = 1 - inOut(seg(t, 4.0, 5.6));
        const speedNow = 520 + 900 * seg(t, 0, 4);
        const travel = t * 520 + 450 * seg(t, 0, 4) ** 2 * t;
        feed.forEach((c, i) => {
          const span = feed.length * 330;
          const y = ((((i * 330 - travel) % span) + span) % span) - span / 2;
          const fall = inOut(seg(t, 4.0 + i * 0.04, 5.6 + i * 0.04));
          set(c, show * live(t, 0, 99, 0.6) * (1 - Math.abs(y) / (span / 1.6)), `translate3d(-50%, ${y + fall * 500}px, ${-fall * 600}px)`, (speedNow / 1420) * 6 + fall * 14);
        });
        const f = $('.op-feed');
        f.style.visibility = t < 6.2 ? 'visible' : 'hidden';
      }

      // 2–3 · Tiles gather into a +, then fuse into the mark.
      {
        const PLUS: [number, number][] = [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]];
        const gather = out5(seg(t, 7.4, 9.4));
        const fuse = inOut(seg(t, 9.9, 10.75));
        tiles.forEach((e, i) => {
          const [px, py] = PLUS[i];
          const sx = (i - 2) * 230;
          const sy = 700 + (i % 2) * 120;
          const gap = lerp(150, 76, fuse);
          const x = lerp(sx, px * gap, gather);
          const y = lerp(sy, px === 0 && py === 0 ? 0 : py * gap, gather) + 60;
          const size = lerp(110, 80, fuse);
          set(e, live(t, 7.2, 10.6, 0.5), `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${(1 - gather) * (i - 2) * 24}deg)`, (1 - gather) * 6);
          e.style.width = e.style.height = `${size}px`;
          e.style.borderRadius = `${lerp(30, 18, fuse)}px`;
        });
      }

      // The hero mark: born from the tiles, beside "Meet MN", then up top as a little guide,
      // the tenth day, the jar's light, and the MN mark at the end.
      {
        if (!slot) {
          const s = stage.querySelector<HTMLElement>('.op-slot');
          if (s && s.getBoundingClientRect().width > 0) {
            const k = stage.getBoundingClientRect();
            const r = s.getBoundingClientRect();
            const scale = k.width / 1080;
            slot = { x: (r.left + r.width / 2 - k.left) / scale - 540, y: (r.top + r.height / 2 - k.top) / scale - k.height / scale / 2 - SHIFT };
          }
        }
        const sl = slot ?? { x: -40, y: -70 };
        type P = [number, number, number];
        // Key positions: [x, y, size] from the stage centre.
        const centre: P = [0, 60, 250];
        const inline: P = [sl.x, sl.y, 118];
        const top: P = [0, -760, 64];
        const tenth: P = [(9 - 4.5) * 92, 120, 70];
        const end: P = [0, -60, 300];
        const endUp: P = [0, -170, 230];
        let p: P = centre;
        const ease = (a: P, b: P, k: number): P => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
        if (t < 11.0) p = centre;
        else if (t < 12.9) p = ease(centre, inline, inOut(seg(t, 10.95, 11.6)));
        else if (t < 39.0) p = ease(inline, top, inOut(seg(t, 12.85, 13.7)));
        else if (t < 40.6) p = ease(top, tenth, inOut(seg(t, 39.0, 39.62)));
        else if (t < 58.2) p = ease(tenth, top, inOut(seg(t, 40.6, 41.3)));
        else if (t < 61.0) p = ease(top, end, inOut(seg(t, 58.25, 59.2)));
        else p = ease(end, endUp, inOut(seg(t, 61.0, 61.7)));
        const born = out5(seg(t, 10.45, 11.0));
        const spin = 90 * inOut(seg(t, 58.25, 59.2)) + 90 * inOut(seg(t, 10.45, 11.1));
        const breathe = 1 + 0.035 * Math.sin(t * 2.4);
        set(hero, born, `translate3d(${p[0]}px, ${p[1]}px, 0) translate(-50%, -50%) rotate(${spin}deg) scale(${breathe})`);
        hero.style.width = hero.style.height = `${p[2]}px`;
        halo.style.opacity = (0.35 + 0.65 * live(t, 10.5, 12.0, 0.5) + 0.9 * live(t, 39.6, 40.4, 0.25) + seg(t, 58.6, 59.4)).toFixed(3);
        set(word, out5(seg(t, 61.1, 61.9)), `translate(-50%, 0) translateY(${(1 - out5(seg(t, 61.1, 61.9))) * 40}px)`, (1 - out5(seg(t, 61.1, 61.9))) * 14);
      }

      // 4 · Three treats fan in; one is chosen and becomes the jar, locked.
      // 5 · The jar moves aside while a question fills it.
      {
        const fan = out5(seg(t, 17.9, 18.9));
        const pick = inOut(seg(t, 19.6, 20.4));
        const jar = inOut(seg(t, 20.6, 21.5));
        const aside = inOut(seg(t, 23.6, 24.4));
        const gone = inOut(seg(t, 30.1, 30.7));
        treats.forEach((e, i) => {
          const off = i - 1;
          if (i !== 1) {
            set(e, fan * (1 - pick) * (t < 22 ? 1 : 0), `translate3d(${off * 300 * fan}px, ${(1 - fan) * 300 + 80}px, ${-pick * 300}px) translate(-50%, -50%) rotateY(${off * -22 * fan}deg) rotate(${off * 6}deg)`, pick * 12 + (1 - fan) * 8);
            return;
          }
          const w = lerp(260, 330, jar);
          const h = lerp(330, 440, jar);
          const x = lerp(0, 300, aside);
          const y = lerp(lerp(80, 40, pick), 520, aside);
          const s = lerp(lerp(1, 1.12, pick), 0.62, aside);
          set(e, fan * (1 - gone), `translate3d(${x}px, ${y + (1 - fan) * 300}px, ${pick * 80}px) translate(-50%, -50%) scale(${s})`, (1 - fan) * 8 + gone * 10);
          e.style.width = `${w}px`;
          e.style.height = `${h}px`;
          e.style.borderRadius = `${lerp(44, 150, jar)}px ${lerp(44, 150, jar)}px ${lerp(44, 110, jar)}px ${lerp(44, 110, jar)}px`;
        });
        stage.style.setProperty('--jar', jar.toFixed(3));
        stage.style.setProperty('--lock', out3(seg(t, 21.0, 21.9)).toFixed(3));
        const a = answeredAt ?? 26.6;
        jarFill.style.transform = `scaleY(${(0.04 + 0.56 * out3(seg(t, a + 0.7, a + 2.2))) * jar})`;
      }

      // 5–6 · The question card: 7 × 8 (it can be tapped), then 99 × 7 put right.
      {
        const inn = out5(seg(t, 23.75, 24.6));
        const shrink = inOut(seg(t, 35.2, 35.85));
        const o = inn * (1 - shrink);
        set(qcard, o, `translate3d(-50%, ${(1 - inn) * 160 - 60}px, 0) translate(0, -50%) rotateX(${(1 - inn) * 24 + 4}deg) scale(${lerp(1, 0.5, shrink)}, ${lerp(1, 0.2, shrink)})`, (1 - inn) * 10 + shrink * 6);
        const a = answeredAt ?? 26.6;
        const q1 = 1 - inOut(seg(t, 30.3, 30.75));
        const q2 = out3(seg(t, 30.6, 31.3));
        set($('.op-q1'), q1, '', (1 - q1) * 10);
        set($('.op-q2'), q2, `translateY(${(1 - q2) * 20}px)`, (1 - q2) * 10);
        $$('.op-pill').forEach((p, i) => {
          const right = p.classList.contains('op-right');
          const k = out5(seg(t, 24.2 + i * 0.08, 24.9 + i * 0.08));
          const after = seg(t, a, a + 0.4);
          set(p, k * (right ? 1 : 1 - 0.65 * after), `translateY(${(1 - k) * 30}px) scale(${right ? 1 + 0.06 * Math.sin(Math.PI * after) : 1})`);
          p.classList.toggle('on', right && t >= a);
          p.classList.toggle('no', !right && wrongAt !== null && p.dataset.v === p.dataset.wrong && t < a);
        });
        // Light runs from the right answer into the jar.
        sparks.forEach((s, i) => {
          const k = seg(t, a + 0.15 + i * 0.07, a + 0.85 + i * 0.07);
          const e = inOut(k);
          const x0 = 70, y0 = 30, x1 = 300, y1 = 520;
          const x = lerp(x0, x1, e) + Math.sin(e * Math.PI) * (i - 3) * 40;
          const y = lerp(y0, y1, e) - Math.sin(e * Math.PI) * 260;
          set(s, k > 0 && k < 1 ? 1 - k * 0.5 : 0, `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${1 - k * 0.6})`);
        });
        // 99 becomes 100, take one 7 away, the answer.
        const flip = inOut(seg(t, 32.45, 32.95));
        const [a99, a100] = [...stage.querySelectorAll<HTMLElement>('.op-flip i')];
        set(a99, 1 - flip, `translateY(${-flip * 30}px)`, flip * 10);
        set(a100, flip, `translateY(${(1 - flip) * 30}px)`, (1 - flip) * 10);
        const m = out5(seg(t, 32.7, 33.3));
        set($('.op-minus'), m, `translateX(${(1 - m) * -30}px)`, (1 - m) * 8);
        const r = out5(seg(t, 33.65, 34.3));
        set($('.op-res'), r, `translateY(${(1 - r) * 24}px) scale(${0.94 + 0.06 * r})`, (1 - r) * 12);
        $('.op-said').style.setProperty('--k', out3(seg(t, 31.0, 31.6)).toFixed(3));
      }

      // 7 · Ten days, one by one; the mark lands on the tenth.
      // 8 · The days become a ring that fills over months, and slips back a little.
      {
        const toRing = inOut(seg(t, 41.35, 42.2));
        const ringOut = inOut(seg(t, 46.95, 47.55));
        dots.forEach((d, i) => {
          const lx = (i - 4.5) * 92, ly = 120;
          const ang = -Math.PI / 2 + (i / 10) * Math.PI * 2;
          const rx = Math.cos(ang) * 300, ry = Math.sin(ang) * 300 + 80;
          const x = lerp(lx, rx, toRing), y = lerp(ly, ry, toRing);
          const appear = out5(seg(t, 35.55 + i * 0.03, 36.1 + i * 0.03));
          const lit = seg(t, 36.25 + i * 0.36, 36.45 + i * 0.36);
          set(d, appear * (1 - inOut(seg(t, 42.0, 42.6))), `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${1 + 0.35 * Math.sin(Math.PI * lit)})`);
          d.classList.toggle('lit', lit > 0.5 && i < 9);
          d.style.opacity = i === 9 && t > 39.4 && t < 41.3 ? '0' : d.style.opacity;
        });
        const fill = 0.72 * out3(seg(t, 42.0, 43.9)) - 0.1 * inOut(seg(t, 44.4, 45.2));
        const shrinkR = inOut(seg(t, 47.2, 47.9));
        set(ring as unknown as HTMLElement, seg(t, 41.9, 42.3) * (1 - ringOut), `translate(-50%, -50%) translateY(80px) scale(${lerp(1, 0.55, shrinkR)})`, ringOut * 10);
        arc.style.strokeDashoffset = `${(1 - clamp(fill)) * 1885}`;
        ring.classList.toggle('slip', t > 44.4 && t < 46.9);
      }

      // 9 · The ring closes into a medal; light runs across it.
      {
        const m = back(seg(t, 47.45, 48.3));
        const up = inOut(seg(t, 50.2, 50.9));
        set(medal, clamp(m) * (1 - up), `translate(-50%, -50%) translateY(${80 - up * 900}px) scale(${0.6 + 0.4 * m})`, (1 - clamp(m)) * 10 + up * 10);
        medal.style.setProperty('--shine', seg(t, 48.5, 49.4).toFixed(3));
        medal.style.setProperty('--rib', out5(seg(t, 47.9, 48.6)).toFixed(3));
      }

      // 10 · Glass settings stack up in depth; each one switches on as it's named.
      {
        const AT = [51.74, 52.81, 54.2, 56.07];
        const off = inOut(seg(t, 58.15, 58.85));
        rows.forEach((r, i) => {
          const k = out5(seg(t, AT[i] - 0.25, AT[i] + 0.55));
          const y = -120 + i * 190;
          set(r, k * (1 - off), `translate3d(-50%, ${lerp(y + 140, y, k) * (1 - off) + off * 60}px, ${(1 - k) * -200 - off * 300}px) rotateX(${14 * (1 - off)}deg) scale(${lerp(1, 0.3, off)})`, (1 - k) * 12 + off * 10);
          r.classList.toggle('on', t > AT[i] + 0.45);
          if (i === 1) r.querySelectorAll('b').forEach((b, j) => b.classList.toggle('on', t > AT[i] + 0.4 + j * 0.16));
        });
      }
    };

    // ── the clock ────────────────────────────────────────────────────────────
    const audio = fast ? null : voiceover();
    if (audio) audio.muted = muted;
    let t0 = performance.now();
    let manual: number | null = null;
    let raf = 0;
    let ended = false;
    let live_ = true;
    const now = (): number => {
      if (manual !== null) return manual;
      if (audio && !audio.paused && audio.currentTime > 0) return audio.currentTime;
      return ((performance.now() - t0) / 1000) * speed;
    };
    const foot = el.querySelector<HTMLElement>('.op-foot')!;
    const tick = () => {
      if (!live_) return;
      const t = Math.min(now(), END + 0.6);
      paint(t);
      if (t >= END - 0.5 && !ended) {
        ended = true;
        if (!app.save.data.settings.tourSeen) app.save.update((d) => (d.settings.tourSeen = true));
        foot.hidden = false;
        requestAnimationFrame(() => foot.classList.add('in'));
      }
      raf = requestAnimationFrame(tick);
    };
    const start = async () => {
      t0 = performance.now();
      if (!audio) return;
      try {
        await audio.play();
      } catch {
        // No sound without a tap here: carry on silently and offer it.
        el.querySelector<HTMLElement>('.op-tapsound')!.hidden = false;
      }
    };

    // Tap the right answer in the film (it answers itself if nobody does).
    stage.style.pointerEvents = 'none';
    stage.querySelectorAll<HTMLElement>('.op-pill').forEach((p) =>
      p.addEventListener('click', () => {
        const t = now();
        if (t < 24.6 || t > 26.6 || answeredAt !== null) return;
        if (p.classList.contains('op-right')) {
          answeredAt = t;
          app.sfx.correct(2);
        } else {
          wrongAt = t;
          stage.querySelectorAll<HTMLElement>('.op-pill').forEach((x) => (x.dataset.wrong = p.dataset.v));
          app.sfx.wrong();
        }
      }),
    );
    const qc = stage.querySelector<HTMLElement>('.op-q')!;
    qc.style.pointerEvents = 'auto';

    el.querySelector('.op-tapsound')!.addEventListener('click', (e) => {
      const b = e.currentTarget as HTMLElement;
      b.hidden = true;
      if (!audio) return;
      muted = false;
      audio.muted = false;
      audio.currentTime = Math.min(now(), END);
      void audio.play().catch(() => undefined);
    });
    el.querySelector('.rl-mute')!.addEventListener('click', (e) => {
      muted = !muted;
      if (audio) audio.muted = muted;
      (e.currentTarget as HTMLElement).innerHTML = muted ? soundOff : soundOn;
      if (!muted && audio && audio.paused) {
        audio.currentTime = Math.min(now(), END);
        void audio.play().catch(() => undefined);
      }
    });
    const stop = () => {
      live_ = false;
      cancelAnimationFrame(raf);
      audio?.pause();
    };
    el.querySelector('.rl-go')!.addEventListener('click', () => {
      stop();
      o.done();
    });
    el.querySelector('.rl-skip')?.addEventListener('click', () => {
      stop();
      (o.leave ?? o.done)();
    });
    el.querySelector('.rl-again')?.addEventListener('click', () => {
      ended = false;
      foot.classList.remove('in');
      foot.hidden = true;
      answeredAt = wrongAt = null;
      if (audio) audio.currentTime = 0;
      void start();
    });

    if (app.debug) {
      Object.assign(window, {
        __opener: {
          seek: (t: number) => {
            manual = t;
            paint(t);
          },
          play: () => {
            manual = null;
          },
        },
      });
    }
    const onResize = () => fit();
    return {
      el,
      mounted: () => {
        fit();
        window.addEventListener('resize', onResize);
        void start();
        raf = requestAnimationFrame(tick);
      },
      destroy: () => {
        stop();
        window.removeEventListener('resize', onResize);
      },
      back: () => {
        if (o.first) return true;
        stop();
        (o.leave ?? o.done)();
        return true;
      },
      keepAwake: true,
    };
  };
}

const soundOn = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const soundOff = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
