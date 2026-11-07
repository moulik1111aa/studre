// The opening film: a one-minute motion piece on the recorded voiceover (assets/audio/opening.mp3),
// in three flat-colour styles that keep handing over to each other:
//   Shapes   – Bauhaus geometry: bars, circles and arcs click together into numbers and letters;
//   Print    – risograph: halftone dots, overprinted colour, layers slightly out of register;
//   Notebook – graph paper: precise ink drawings that draw themselves, highlighter swipes.
// Each hand-over is a transition that grows out of the last scene (dots collapse to a pen point,
// a stamp bursts into a circle, a pen sweeps the page, the paper tears, …).
//
// Everything is one SVG stage (1080 × 1920, cropped to fit the phone) drawn from one clock,
// `paint(t)` with t in seconds of the voiceover, every animation frame, so the voice and the picture
// stay together, and any moment can be drawn on its own (debug: window.__opener.seek(t)).

import { esc, html, type App, type Screen } from './app.ts';
import { voiceover } from './reel.ts';

export const OPENER_END = 62.6;

// ── maths for motion ────────────────────────────────────────────────────────
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const o3 = (x: number) => 1 - (1 - x) ** 3;
const o5 = (x: number) => 1 - (1 - x) ** 5;
const io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const bk = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2);
const el5 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a: number, b: number) => a + (b - a) * rnd();

// ── palettes ────────────────────────────────────────────────────────────────
const SH = { bg: '#F3EEE4', ink: '#141414', blue: '#2140FF', red: '#FF4B2B', yel: '#FFC21A', grn: '#00B386', pink: '#FF9EC4' };
const PR = { bg: '#F4EEE2', blue: '#1F6FD0', pink: '#FF4FA3', yel: '#FFD400', teal: '#00A6A0', ink: '#1C1A33' };
const NB = { bg: '#FBFBF7', grid: '#D9E3FF', ink: '#1B2A5C', pen: '#3D6BFF', hp: '#FF6FB5', hy: '#FFEB3B', hg: '#5CF0A0' };
const FONT = { cn: '"Heros Cn","TeX Gyre Heros Cn",sans-serif', adv: '"Adventor","TeX Gyre Adventor",sans-serif', body: '"Inter Display",system-ui,sans-serif' };

// ── SVG helpers ─────────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
type A = Record<string, string | number>;
function S<K extends keyof SVGElementTagNameMap>(tag: K, attrs: A = {}, parent?: Element, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}
const tf = (e: Element, s: string) => e.setAttribute('transform', s);
const op = (e: SVGElement, o: number) => {
  e.style.opacity = o < 0.003 ? '0' : o > 0.997 ? '1' : o.toFixed(3);
  e.style.visibility = o < 0.003 ? 'hidden' : '';
};
const plusD = (s: number) => {
  const a = 46 * s, b = 16 * s, r = 7 * s;
  return `M${-b} ${-a + r}Q${-b} ${-a} ${-b + r} ${-a}H${b - r}Q${b} ${-a} ${b} ${-a + r}V${-b}H${a - r}Q${a} ${-b} ${a} ${-b + r}V${b - r}Q${a} ${b} ${a - r} ${b}H${b}V${a - r}Q${b} ${a} ${b - r} ${a}H${-b + r}Q${-b} ${a} ${-b} ${a - r}V${b}H${-a + r}Q${-a} ${b} ${-a} ${b - r}V${-b + r}Q${-a} ${-b} ${-a + r} ${-b}H${-b}Z`;
};
/** A path that draws itself: returns a setter for 0 → 1. */
function drawn(p: SVGGeometryElement): (k: number) => void {
  let len = 0;
  return (k: number) => {
    if (!len) {
      try {
        len = p.getTotalLength() || 1;
      } catch {
        len = 1000;
      }
      p.style.strokeDasharray = `${len}`;
    }
    p.style.strokeDashoffset = `${len * (1 - clamp(k))}`;
    op(p, k > 0.001 ? 1 : 0);
  };
}

// ── words ───────────────────────────────────────────────────────────────────
type Style = 'shape' | 'print' | 'note';
interface WordSpec {
  text: string;
  at: number;
  out: number;
  y: number;
  size: number;
  style: Style;
  /** Words to colour (indexes), and the colour. */
  hi?: number[];
  hiColor?: string;
  align?: 'center' | 'left' | 'right';
  color?: string;
  /** Strike the highlighted words through at this time. */
  strike?: number;
}
/** Widest a line may be: the phone crops the 1080 stage to about 890 across. */
const MAXW = 820;
class Words {
  g: SVGGElement;
  inner: SVGGElement;
  strikes: SVGRectElement[] = [];
  items: { g: SVGGElement; t: SVGTextElement; t2?: SVGTextElement; bar?: SVGRectElement; sw?: SVGRectElement; clip?: SVGRectElement; w: number; hi: boolean }[] = [];
  laid = false;
  s: WordSpec;
  constructor(parent: Element, s: WordSpec, defs: SVGDefsElement) {
    this.s = s;
    this.g = S('g', {}, parent);
    this.inner = S('g', {}, this.g);
    const words = s.text.split(' ');
    words.forEach((w, i) => {
      const hi = !!s.hi?.includes(i);
      const g = S('g', {}, this.inner);
      const fam = s.style === 'print' ? FONT.adv : FONT.cn;
      const base = s.color ?? (s.style === 'print' ? PR.blue : s.style === 'note' ? NB.ink : SH.ink);
      const col = hi && s.hiColor && s.style !== 'note' ? s.hiColor : base;
      const item: Words['items'][number] = { g, t: null as unknown as SVGTextElement, w: 0, hi };
      if (s.style === 'note' && hi) item.sw = S('rect', { x: -8, y: -s.size * 0.72, height: s.size * 0.86, fill: s.hiColor ?? NB.hy, rx: 6 }, g);
      if (s.style === 'shape') {
        const cid = `wc${Math.random().toString(36).slice(2, 8)}`;
        const cp = S('clipPath', { id: cid }, defs);
        item.clip = S('rect', { x: -20, y: -s.size * 1.1, height: s.size * 1.4, width: 10 }, cp);
        item.bar = S('rect', { y: -s.size * 0.8, height: s.size * 0.9, fill: hi ? (s.hiColor ?? SH.red) : SH.blue }, g);
        const inner = S('g', { 'clip-path': `url(#${cid})` }, g);
        item.t = S('text', { 'font-family': fam, 'font-weight': 700, 'font-size': s.size, fill: col, 'letter-spacing': s.size * -0.005 }, inner, s.style === 'shape' ? w.toUpperCase() : w);
      } else {
        if (s.style === 'print') item.t2 = S('text', { 'font-family': fam, 'font-weight': 700, 'font-size': s.size, fill: hi ? PR.blue : PR.pink, style: 'mix-blend-mode:multiply' }, g, w);
        item.t = S('text', { 'font-family': fam, 'font-weight': 700, 'font-size': s.size, fill: col, style: s.style === 'print' ? 'mix-blend-mode:multiply' : '' }, g, s.style === 'note' ? w.toUpperCase() : w);
        if (s.style === 'print' && hi) item.t.setAttribute('fill', PR.pink);
        if (s.style === 'note') {
          const cid = `wc${Math.random().toString(36).slice(2, 8)}`;
          const cp = S('clipPath', { id: cid }, defs);
          item.clip = S('rect', { x: -20, y: -s.size * 1.1, height: s.size * 1.5, width: 0 }, cp);
          item.t.setAttribute('clip-path', `url(#${cid})`);
        }
      }
      if (s.strike !== undefined && hi) this.strikes.push(S('rect', { x: -10, y: -s.size * 0.36, height: Math.max(8, s.size * 0.12), width: 0, fill: s.style === 'print' ? PR.pink : NB.hp }, g));
      this.items.push(item);
    });
  }
  layout(): void {
    const gap = this.s.size * 0.24;
    let total = 0;
    for (const it of this.items) {
      try {
        it.w = it.t.getComputedTextLength();
      } catch {
        it.w = this.s.size * 0.5 * (it.t.textContent?.length ?? 3);
      }
      total += it.w;
    }
    total += gap * (this.items.length - 1);
    const fit = total > MAXW ? MAXW / total : 1;
    const ax = (this.s.align ?? 'center') === 'left' ? 120 : (this.s.align ?? 'center') === 'right' ? 960 : 540;
    tf(this.inner, `translate(${ax} ${this.s.y}) scale(${fit}) translate(${-ax} ${-this.s.y})`);
    total = Math.min(total, MAXW / fit);
    const align = this.s.align ?? 'center';
    let x = align === 'left' ? 120 : align === 'right' ? 960 - total : 540 - total / 2;
    if (fit < 1 && align === 'center') x = 540 - total / 2;
    for (const it of this.items) {
      it.g.dataset.x = String(x);
      if (it.bar) it.bar.setAttribute('width', String(it.w + 16)), it.bar.setAttribute('x', '-8');
      if (it.sw) it.sw.setAttribute('width', String(it.w + 16));
      x += it.w + gap;
    }
    this.laid = true;
  }
  private strikeK(t: number): number {
    return this.s.strike === undefined ? 0 : o3(seg(t, this.s.strike, this.s.strike + 0.3));
  }
  paint(t: number): void {
    const s = this.s;
    const vis = t > s.at - 0.05 && t < s.out + 0.6;
    this.g.style.display = vis ? '' : 'none';
    if (!vis) return;
    if (!this.laid) this.layout();
    this.items.forEach((it, i) => {
      const x = Number(it.g.dataset.x);
      const a = s.at + i * 0.09;
      const gone = io(seg(t, s.out + i * 0.03, s.out + i * 0.03 + 0.35));
      if (s.style === 'shape') {
        // A bar sweeps across and leaves the word behind it.
        const k1 = o5(seg(t, a, a + 0.28)), k2 = io(seg(t, a + 0.22, a + 0.5));
        const w = it.w + 16;
        it.bar!.setAttribute('x', String(-8 + w * k2));
        it.bar!.setAttribute('width', String(Math.max(0, w * k1 - w * k2)));
        it.clip!.setAttribute('width', String(w * k2 + 10));
        tf(it.g, `translate(${x} ${s.y + gone * 30}) scale(${1 - gone * 0.2})`);
        op(it.g, 1 - gone);
      } else if (s.style === 'print') {
        // A stamp: big, then down, with the second colour settling just out of register.
        const k = bk(seg(t, a, a + 0.42));
        const sc = lerp(1.6, 1, k);
        const off = lerp(26, 7, o3(seg(t, a, a + 0.6)));
        tf(it.g, `translate(${x + it.w / 2} ${s.y}) scale(${sc * (1 - gone * 0.3)}) translate(${-it.w / 2} 0) rotate(${(1 - k) * (i % 2 ? 6 : -6)})`);
        it.t2!.setAttribute('x', String(off));
        it.t2!.setAttribute('y', String(off * 0.6));
        op(it.g, clamp(seg(t, a, a + 0.12)) * (1 - gone));
      } else {
        void 0;
        // Written on, left to right, then highlighted.
        const k = io(seg(t, a, a + 0.32));
        it.clip!.setAttribute('width', String((it.w + 30) * k));
        if (it.sw) {
          const h = o3(seg(t, a + 0.3, a + 0.6));
          it.sw.setAttribute('width', String((it.w + 16) * h));
        }
        tf(it.g, `translate(${x} ${s.y - gone * 20})`);
        op(it.g, 1 - gone);
      }
    });
    const sk = this.strikeK(t);
    let n = 0;
    for (const it of this.items) if (it.hi && this.strikes[n]) this.strikes[n++].setAttribute('width', String((it.w + 20) * sk));
  }
}

// ── scenes ──────────────────────────────────────────────────────────────────
interface Scene {
  a: number;
  b: number;
  root: SVGGElement;
  paint(t: number): void;
  /** The incoming wipe: sets the clip each frame (k 0 → 1). */
  wipe?(k: number): void;
  wd?: number;
}

function paper(root: SVGGElement, fill: string): void {
  S('rect', { x: -200, y: -200, width: 1480, height: 2320, fill }, root);
}
/** Floating bits that keep every frame alive. */
function ambient(root: SVGGElement, kind: Style, n: number, area: [number, number, number, number] = [60, 1020, 120, 1880]) {
  const items: { e: SVGElement; x: number; y: number; ph: number; sp: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = R(area[0], area[1]), y = R(area[2], area[3]), s = R(16, 46);
    let e: SVGElement;
    if (kind === 'shape') {
      const c = [SH.blue, SH.red, SH.yel, SH.grn, SH.pink][i % 5];
      const k = i % 4;
      e = k === 0 ? S('circle', { r: s / 2, fill: c }, root) : k === 1 ? S('rect', { x: -s / 2, y: -s / 2, width: s, height: s, fill: c }, root) : k === 2 ? S('polygon', { points: `0,${-s} ${s},${s / 2} ${-s},${s / 2}`, fill: c }, root) : S('path', { d: `M${-s} 0A${s} ${s} 0 0 1 ${s} 0`, fill: 'none', stroke: c, 'stroke-width': 7, 'stroke-linecap': 'round' }, root);
    } else if (kind === 'print') {
      e = S('circle', { r: R(20, 90), fill: ['url(#htp)', 'url(#htb)', 'url(#hty)'][i % 3], style: 'mix-blend-mode:multiply' }, root);
      e.style.opacity = '.7';
    } else {
      e = S('text', { 'font-family': FONT.cn, 'font-weight': 700, 'font-size': R(28, 52), fill: NB.ink, 'fill-opacity': 0.22, 'text-anchor': 'middle' }, root, ['+', '=', '×', '÷', '7', '½', '%', '3', '9', '√'][i % 10]);
    }
    items.push({ e, x, y, ph: R(0, 6.28), sp: R(0.3, 0.9), r: R(-40, 40) });
  }
  return (t: number) => {
    for (const it of items) tf(it.e, `translate(${it.x + Math.sin(t * it.sp + it.ph) * 26} ${it.y + Math.cos(t * it.sp * 0.8 + it.ph) * 34 - t * 6}) rotate(${it.r * t * 0.6 + it.ph * 40})`);
  };
}
function grid(root: SVGGElement, step = 40): (k: number) => void {
  const lines: ((k: number) => void)[] = [];
  const g = S('g', {}, root);
  for (let x = 0; x <= 1080; x += step) lines.push(drawn(S('line', { x1: x, y1: -40, x2: x, y2: 1960, stroke: NB.grid, 'stroke-width': x % 200 ? 1.6 : 3 }, g)));
  for (let y = 0; y <= 1920; y += step) lines.push(drawn(S('line', { x1: -40, y1: y, x2: 1120, y2: y, stroke: NB.grid, 'stroke-width': y % 200 ? 1.6 : 3 }, g)));
  return (k: number) => lines.forEach((f, i) => f(seg(k, (i % 30) / 60, (i % 30) / 60 + 0.5)));
}

function build(svg: SVGSVGElement, defs: SVGDefsElement, onTap: (v: string) => void, state: { answeredAt: number | null }): { scenes: Scene[]; words: Words[]; fx: SVGGElement } {
  const world = S('g', {}, svg);
  const fx = S('g', {}, svg);
  const scenes: Scene[] = [];
  const words: Words[] = [];
  const say = (parent: Element, s: WordSpec) => words.push(new Words(parent, s, defs));
  const clipRoot = (root: SVGGElement) => {
    const id = `sc${scenes.length}`;
    const cp = S('clipPath', { id }, defs);
    root.setAttribute('clip-path', `url(#${id})`);
    return cp;
  };
  const circleWipe = (root: SVGGElement, cx: number, cy: number, ring: string) => {
    const cp = clipRoot(root);
    const c = S('circle', { cx, cy, r: 0 }, cp);
    const rg = S('circle', { cx, cy, r: 0, fill: 'none', stroke: ring, 'stroke-width': 0 }, fx);
    return (k: number) => {
      const r = 1500 * o3(k);
      c.setAttribute('r', String(r));
      rg.setAttribute('r', String(r));
      rg.setAttribute('stroke-width', String(k > 0 && k < 1 ? 60 * (1 - k) : 0));
    };
  };

  // ── P1 · Print: the endless feed (0 – 7) ─────────────────────────────────
  {
    const root = S('g', {}, world);
    paper(root, PR.bg);
    const amb = ambient(root, 'print', 9);
    const phone = S('g', {}, root);
    const ph1 = S('rect', { x: -250, y: -430, width: 500, height: 860, rx: 70, fill: 'none', stroke: PR.pink, 'stroke-width': 10, style: 'mix-blend-mode:multiply' }, phone);
    S('rect', { x: -258, y: -438, width: 500, height: 860, rx: 70, fill: 'none', stroke: PR.blue, 'stroke-width': 10, style: 'mix-blend-mode:multiply' }, phone);
    const cid = 'feedclip';
    const cp = S('clipPath', { id: cid }, defs);
    S('rect', { x: -236, y: -416, width: 472, height: 832, rx: 56 }, cp);
    const feed = S('g', { 'clip-path': `url(#${cid})` }, phone);
    const cards: SVGGElement[] = [];
    for (let i = 0; i < 9; i++) {
      const c = S('g', {}, feed);
      S('rect', { x: -210, y: -130, width: 420, height: 250, rx: 30, fill: ['url(#htp)', 'url(#htb)', 'url(#hty)'][i % 3], style: 'mix-blend-mode:multiply' }, c);
      S('rect', { x: -200, y: -122, width: 420, height: 250, rx: 30, fill: 'none', stroke: PR.blue, 'stroke-width': 5 }, c);
      S('circle', { cx: -150, cy: 90, r: 22, fill: PR.pink }, c);
      S('rect', { x: -110, y: 74, width: 150, height: 14, rx: 7, fill: PR.ink, 'fill-opacity': 0.5 }, c);
      S('text', { x: 120, y: 98, 'font-family': FONT.adv, 'font-weight': 700, 'font-size': 34, fill: PR.pink, 'text-anchor': 'middle' }, c, `♥ ${Math.floor(R(10, 99))}k`);
      cards.push(c);
    }
    void ph1;
    const hearts = Array.from({ length: 14 }, () => S('text', { 'font-size': 48, fill: PR.pink, 'text-anchor': 'middle', style: 'mix-blend-mode:multiply' }, root, '♥'));
    const dot = S('circle', { cx: 540, cy: 1060, r: 0, fill: NB.ink }, root);
    say(root, { text: 'endless', at: 0.22, out: 99, y: 300, size: 190, style: 'print' });
    say(root, { text: 'scroll.', at: 1.66, out: 99, y: 470, size: 190, style: 'print', hi: [0] });
    say(root, { text: 'and nothing learned.', at: 4.02, out: 5.5, y: 1640, size: 92, style: 'print', hi: [2], strike: 4.9 });
    scenes.push({
      a: 0,
      b: 7.0,
      root,
      paint(t) {
        amb(t);
        const collapse = io(seg(t, 5.2, 6.3));
        const travel = t * 380 + 260 * seg(t, 0, 4.5) ** 2 * t;
        cards.forEach((c, i) => {
          const span = cards.length * 290;
          const y = ((((i * 290 - travel) % span) + span) % span) - span / 2;
          tf(c, `translate(0 ${y})`);
        });
        tf(phone, `translate(540 ${1060 + (1 - o5(seg(t, 0, 0.8))) * 900}) rotate(${-6 + Math.sin(t * 1.3) * 1.5}) scale(${lerp(1, 0.02, collapse)})`);
        hearts.forEach((h, i) => {
          const k = ((t * 0.7 + i / hearts.length) % 1);
          tf(h, `translate(${300 + ((i * 97) % 480)} ${1450 - k * 900}) scale(${0.6 + k})`);
          op(h, (1 - k) * (1 - collapse) * seg(t, 0.4, 1));
        });
        dot.setAttribute('r', String(14 * o3(seg(t, 6.0, 6.3))));
        // The headline drops away as the feed collapses.
        const wg = words.slice(0, 2);
        wg.forEach((w) => tf(w.g, `translate(0 ${-collapse * 300})`));
        wg.forEach((w) => op(w.g, 1 - collapse));
      },
    });
  }

  // ── N1 · Notebook: what if screen time built something? (6.4 – 10.6) ────
  {
    const root = S('g', {}, world);
    paper(root, NB.bg);
    const g = grid(root);
    const amb = ambient(root, 'note', 14);
    const q = S('path', { d: 'M440 760 C440 620 640 610 640 730 C640 810 545 820 545 900 V950', fill: 'none', stroke: NB.pen, 'stroke-width': 18, 'stroke-linecap': 'round' }, root);
    const qd = drawn(q);
    const qdot = S('circle', { cx: 545, cy: 1020, r: 0, fill: NB.pen }, root);
    const arr: SVGCircleElement[] = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) arr.push(S('circle', { cx: 360 + c * 60, cy: 1160 + r * 60, r: 0, fill: r === 4 ? NB.hp : NB.ink }, root));
    const dimA = drawn(S('path', { d: 'M340 1110 H760 M340 1098 v24 M760 1098 v24', fill: 'none', stroke: NB.ink, 'stroke-width': 4 }, root));
    const dimB = drawn(S('path', { d: 'M300 1140 V1420 M288 1140 h24 M288 1420 h24', fill: 'none', stroke: NB.ink, 'stroke-width': 4 }, root));
    say(root, { text: 'what if screen time', at: 7.11, out: 9.9, y: 300, size: 118, style: 'note' });
    say(root, { text: 'built something?', at: 8.3, out: 9.9, y: 440, size: 118, style: 'note', hi: [0], hiColor: NB.hy });
    const w = circleWipe(root, 540, 1060, NB.ink);
    scenes.push({
      a: 6.3,
      b: 10.7,
      root,
      wipe: w,
      wd: 0.7,
      paint(t) {
        g(seg(t, 6.4, 7.6));
        amb(t);
        const qk = seg(t, 7.0, 7.9);
        qd(qk);
        qdot.setAttribute('r', String(16 * bk(seg(t, 7.85, 8.1))));
        const shrink = io(seg(t, 8.2, 8.8));
        tf(q, `translate(${lerp(0, 330, shrink)} ${lerp(0, -170, shrink)}) scale(${lerp(1, 0.4, shrink)})`);
        tf(qdot, q.getAttribute('transform') ?? '');
        q.style.transformOrigin = '540px 800px';
        arr.forEach((d, i) => d.setAttribute('r', String(20 * bk(seg(t, 8.5 + i * 0.035, 8.8 + i * 0.035)))));
        dimA(seg(t, 9.0, 9.4));
        dimB(seg(t, 9.15, 9.55));
      },
    });
  }

  // ── S1 · Shapes: meet MN (10.0 – 17.9) ───────────────────────────────────
  {
    const root = S('g', {}, world);
    paper(root, SH.bg);
    const sun = S('circle', { cx: 1000, cy: 160, r: 240, fill: SH.yel }, root);
    const qc = S('path', { d: 'M-40 1960 V1560 A400 400 0 0 1 360 1960 Z', fill: SH.blue }, root);
    const arc = S('path', { d: 'M760 1960 A300 300 0 0 1 1160 1700', fill: 'none', stroke: SH.pink, 'stroke-width': 70 }, root);
    const amb = ambient(root, 'shape', 16);
    // Seven bars: two make the +, then all seven make M (4) and N (3).
    const bars = Array.from({ length: 7 }, (_, i) => S('rect', { x: -38, y: -150, width: 76, height: 300, rx: 10, fill: [SH.blue, SH.blue, SH.red, SH.blue, SH.blue, SH.yel, SH.blue][i] }, root));
    // Poses: [x, y, rotation, length]
    const PLUS = [[0, 0, 0, 300], [0, 0, 90, 300], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const MN = [[-330, 0, 0, 300], [-140, 0, 0, 300], [-283, -45, -24, 232], [-187, -45, 24, 232], [60, 0, 0, 300], [250, 0, 0, 300], [155, 0, -32, 356]];
    const ages: SVGRectElement[] = [];
    for (let i = 0; i < 14; i++) ages.push(S('rect', { x: 150 + i * 56, y: 0, width: 40, height: 0, rx: 6, fill: [SH.blue, SH.red, SH.yel, SH.grn, SH.pink][i % 5] }, root));
    say(root, { text: 'meet', at: 10.6, out: 12.9, y: 520, size: 150, style: 'shape' });
    say(root, { text: 'Mission Next', at: 11.74, out: 12.9, y: 1240, size: 96, style: 'shape', hi: [1], hiColor: SH.red });
    say(root, { text: 'maths missions', at: 13.21, out: 17.35, y: 380, size: 150, style: 'shape' });
    say(root, { text: 'from age 3 to 16.', at: 15.21, out: 17.35, y: 540, size: 120, style: 'shape', hi: [2, 4], hiColor: SH.red });
    const w = circleWipe(root, 540, 1260, SH.red);
    scenes.push({
      a: 9.95,
      b: 17.9,
      root,
      wipe: w,
      wd: 0.6,
      paint(t) {
        amb(t);
        tf(sun, `rotate(${t * 8} 1000 160)`);
        tf(qc, `translate(0 ${Math.sin(t) * 10})`);
        tf(arc, `rotate(${Math.sin(t * 0.7) * 6} 960 1960)`);
        const toMN = io(seg(t, 11.0, 11.7));
        const back = io(seg(t, 12.9, 13.5));
        const enter = o5(seg(t, 10.25, 10.85));
        bars.forEach((b, i) => {
          const p = PLUS[i], m = MN[i];
          let x = lerp(p[0], m[0], toMN), y = lerp(p[1], m[1], toMN), r = lerp(p[2], m[2], toMN), L = lerp(p[3], m[3], toMN);
          // Back to the +, small, up in the corner.
          x = lerp(x, p[0], back);
          y = lerp(y, p[1], back);
          r = lerp(r, p[2], back);
          L = lerp(L, p[3], back);
          const fly = i < 2 ? (1 - enter) * (i === 0 ? -900 : 900) : 0;
          const cx = lerp(540, 540, back), cy = lerp(880, 1010, back);
          const sc = lerp(1, 0.55, back) * (1 + 0.08 * Math.sin(Math.PI * seg(t, 10.85, 11.1)));
          b.setAttribute('height', String(Math.max(0, L)));
          b.setAttribute('y', String(-L / 2));
          tf(b, `translate(${cx} ${cy}) scale(${sc}) translate(${x + (i === 0 ? fly : 0)} ${y + (i === 1 ? fly : 0)}) rotate(${r + (1 - enter) * 120})`);
          op(b, i < 2 ? enter : clamp(L / 60));
        });
        // The ages, as a little bar chart rising from 3 to 16.
        ages.forEach((a, i) => {
          const k = bk(seg(t, 15.4 + i * 0.07, 15.75 + i * 0.07)) * (1 - io(seg(t, 17.2, 17.6)));
          const h = (60 + i * 28) * k;
          a.setAttribute('height', String(Math.max(0, h)));
          a.setAttribute('y', String(1700 - h));
        });
      },
    });
  }

  // ── P2 · Print: a treat, picked; the jar; locked (17.4 – 23.9) ───────────
  {
    const root = S('g', {}, world);
    paper(root, PR.bg);
    const amb = ambient(root, 'print', 7);
    const mk = (draw: (g: SVGGElement) => void) => {
      const g = S('g', {}, root);
      S('rect', { x: -150, y: -190, width: 300, height: 380, rx: 40, fill: 'url(#hty)', style: 'mix-blend-mode:multiply' }, g);
      S('rect', { x: -142, y: -182, width: 300, height: 380, rx: 40, fill: 'none', stroke: PR.blue, 'stroke-width': 7 }, g);
      draw(g);
      return g;
    };
    const cone = mk((g) => {
      S('polygon', { points: '-60,-10 60,-10 0,140', fill: 'url(#htb)', stroke: PR.blue, 'stroke-width': 6 }, g);
      S('circle', { cx: -34, cy: -50, r: 52, fill: PR.pink, style: 'mix-blend-mode:multiply' }, g);
      S('circle', { cx: 34, cy: -60, r: 52, fill: 'url(#htp)', stroke: PR.pink, 'stroke-width': 5 }, g);
    });
    const choc = mk((g) => {
      S('rect', { x: -80, y: -120, width: 160, height: 240, rx: 14, fill: PR.pink, style: 'mix-blend-mode:multiply' }, g);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) S('rect', { x: -66 + c * 72, y: -106 + r * 58, width: 60, height: 46, rx: 6, fill: 'url(#htb)' }, g);
      S('path', { d: 'M-90 30 L90 -10 V130 H-90 Z', fill: PR.yel, style: 'mix-blend-mode:multiply' }, g);
    });
    const book = mk((g) => {
      S('path', { d: 'M0 -80 C-40 -110 -100 -110 -120 -96 V110 C-100 96 -40 96 0 120 C40 96 100 96 120 110 V-96 C100 -110 40 -110 0 -80Z', fill: 'url(#htb)', stroke: PR.blue, 'stroke-width': 6 }, g);
      S('path', { d: 'M0 -80 V120', stroke: PR.pink, 'stroke-width': 8 }, g);
    });
    const cards = [cone, choc, book];
    const jar = S('g', {}, root);
    const j1 = drawn(S('path', { d: 'M-150 -150 Q-150 -190 -110 -190 H110 Q150 -190 150 -150 V170 Q150 230 90 230 H-90 Q-150 230 -150 170 Z', fill: 'none', stroke: PR.blue, 'stroke-width': 10 }, jar));
    const j2 = drawn(S('path', { d: 'M-142 -142 Q-142 -182 -102 -182 H118 Q158 -182 158 -142 V178 Q158 238 98 238 H-82 Q-142 238 -142 178 Z', fill: 'none', stroke: PR.pink, 'stroke-width': 10, style: 'mix-blend-mode:multiply' }, jar));
    const lid = S('rect', { x: -110, y: -236, width: 220, height: 44, rx: 22, fill: PR.pink, style: 'mix-blend-mode:multiply' }, jar);
    const lock = S('g', {}, root);
    S('rect', { x: -90, y: -40, width: 180, height: 140, rx: 24, fill: PR.blue, style: 'mix-blend-mode:multiply' }, lock);
    S('path', { d: 'M-54 -40 V-80 C-54 -150 54 -150 54 -80 V-40', fill: 'none', stroke: PR.pink, 'stroke-width': 26, style: 'mix-blend-mode:multiply' }, lock);
    S('circle', { cx: 0, cy: 22, r: 18, fill: PR.bg }, lock);
    const stamp = S('text', { 'font-family': FONT.adv, 'font-weight': 700, 'font-size': 64, fill: PR.pink, 'text-anchor': 'middle', 'letter-spacing': 8, style: 'mix-blend-mode:multiply' }, root, 'LOCKED');
    const splats = Array.from({ length: 16 }, () => S('circle', { r: R(6, 16), fill: [PR.pink, PR.blue][Math.floor(R(0, 2))], style: 'mix-blend-mode:multiply' }, root));
    const sa = splats.map(() => [R(0, 6.28), R(160, 320)]);
    say(root, { text: 'your child', at: 17.85, out: 20.6, y: 300, size: 130, style: 'print' });
    say(root, { text: 'picks a treat.', at: 18.6, out: 20.6, y: 450, size: 130, style: 'print', hi: [2] });
    say(root, { text: 'locked until', at: 21.04, out: 23.4, y: 300, size: 130, style: 'print' });
    say(root, { text: 'it’s earned.', at: 21.7, out: 23.4, y: 450, size: 130, style: 'print', hi: [1] });
    // Wipe: printed strips slide down.
    const cp = clipRoot(root);
    const strips = Array.from({ length: 8 }, (_, i) => S('rect', { x: -200 + i * 185, y: -200, width: 186, height: 0 }, cp));
    const fxs = Array.from({ length: 8 }, (_, i) => S('rect', { x: -200 + i * 185, y: -200, width: 186, height: 0, fill: i % 2 ? PR.pink : PR.blue, style: 'mix-blend-mode:multiply' }, fx));
    scenes.push({
      a: 17.35,
      b: 23.95,
      root,
      wd: 0.7,
      wipe(k) {
        strips.forEach((s, i) => s.setAttribute('height', String(2320 * io(seg(k, i * 0.06, i * 0.06 + 0.55)))));
        fxs.forEach((s, i) => {
          const a = io(seg(k, i * 0.06, i * 0.06 + 0.55)), b2 = io(seg(k, i * 0.06 + 0.2, i * 0.06 + 0.75));
          s.setAttribute('y', String(-200 + 2320 * b2));
          s.setAttribute('height', String(Math.max(0, 2320 * (a - b2))));
        });
      },
      paint(t) {
        amb(t);
        // Shuffle like cups, then the middle one is picked.
        const sh = seg(t, 18.0, 19.5);
        const pick = io(seg(t, 19.6, 20.3));
        const into = io(seg(t, 20.6, 21.4));
        const slots = [-1, 0, 1];
        cards.forEach((c, i) => {
          const phase = sh * Math.PI * 2;
          const sx = i === 1 ? Math.sin(phase) * 300 : i === 0 ? -300 * Math.cos(phase * 0.5) : 300 * Math.cos(phase * 0.5);
          const sy = Math.sin(phase + i * 2) * 60 * (1 - pick);
          const enter = o5(seg(t, 17.6 + i * 0.12, 18.2 + i * 0.12));
          let x = 540 + lerp(slots[i] * 300, sx, Math.sin(Math.PI * sh) ** 0.5 * (sh < 1 ? 1 : 0));
          let y = 1050 + sy + (1 - enter) * 900;
          let s = 1;
          if (i !== 1) {
            x += (i === 0 ? -1 : 1) * 600 * pick;
            op(c, 1 - pick);
          } else {
            y = lerp(y, 1000, pick);
            s = lerp(1, 1.15, pick) * lerp(1, 0.6, into);
            y = lerp(y, 1110, into);
            op(c, 1);
          }
          tf(c, `translate(${x} ${y}) rotate(${(1 - enter) * 30 + Math.sin(t * 2 + i) * 3}) scale(${s})`);
        });
        tf(jar, `translate(540 1080)`);
        j1(seg(t, 20.6, 21.3));
        j2(seg(t, 20.75, 21.45));
        op(lid, o3(seg(t, 21.2, 21.5)));
        tf(lid, `translate(0 ${(1 - o3(seg(t, 21.2, 21.5))) * -80})`);
        // The lock stamps on.
        const st = seg(t, 21.85, 22.1);
        const sc = lerp(3, 1, o3(st));
        tf(lock, `translate(${540 + 150} ${1280}) scale(${sc}) rotate(${(1 - st) * -25 - 8})`);
        op(lock, st > 0 ? 1 : 0);
        tf(stamp, `translate(540 1560) rotate(-6) scale(${lerp(2.2, 1, o3(seg(t, 22.05, 22.3)))})`);
        op(stamp, seg(t, 22.05, 22.1));
        splats.forEach((p, i) => {
          const k = o3(seg(t, 22.0, 22.5));
          tf(p, `translate(${690 + Math.cos(sa[i][0]) * sa[i][1] * k} ${1280 + Math.sin(sa[i][0]) * sa[i][1] * k})`);
          op(p, k > 0 ? 1 - seg(t, 22.4, 23.2) * 0.4 : 0);
        });
      },
    });
  }

  // ── S2 · Shapes: 7 × 8, the right answer fills the jar (23.5 – 30.8) ─────
  {
    const root = S('g', {}, world);
    paper(root, SH.bg);
    const amb = ambient(root, 'shape', 14, [60, 1020, 900, 1880]);
    const eq = S('g', {}, root);
    const sevA = S('rect', { x: 0, y: 0, width: 230, height: 66, fill: SH.blue }, eq);
    const sevB = S('polygon', { points: '170,66 236,66 120,350 54,350', fill: SH.blue }, eq);
    const tim = S('g', {}, eq);
    S('rect', { x: -20, y: -100, width: 40, height: 200, rx: 20, fill: SH.red }, tim);
    S('rect', { x: -100, y: -20, width: 200, height: 40, rx: 20, fill: SH.red }, tim);
    const e1 = drawn(S('circle', { cx: 0, cy: 0, r: 82, fill: 'none', stroke: SH.yel, 'stroke-width': 58, transform: 'rotate(-90)' }, eq));
    const e2 = drawn(S('circle', { cx: 0, cy: 170, r: 98, fill: 'none', stroke: SH.yel, 'stroke-width': 58, transform: 'rotate(-90 0 170)' }, eq));
    const e1g = (eq.lastChild?.previousSibling as SVGCircleElement) ?? null;
    void e1g;
    const chips = ['54', '48', '56', '64'].map((v, i) => {
      const g = S('g', { 'data-v': v, class: `op-chip op-pill${v === '56' ? ' op-right' : ''}` }, root);
      const c = S('circle', { r: 76, fill: SH.bg, stroke: SH.ink, 'stroke-width': 7 }, g);
      S('text', { y: 26, 'text-anchor': 'middle', 'font-family': FONT.cn, 'font-weight': 700, 'font-size': 74, fill: SH.ink }, g, v);
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => onTap(v));
      return { g, c, v, i };
    });
    const path = S('path', { d: 'M650 1100 C 680 1220, 780 1240, 800 1320', fill: 'none', stroke: SH.ink, 'stroke-width': 7, 'stroke-dasharray': '2 20', 'stroke-linecap': 'round' }, root);
    const pd = drawn(path);
    const jar = S('g', {}, root);
    S('rect', { x: -140, y: -230, width: 280, height: 420, rx: 44, fill: SH.bg, stroke: SH.ink, 'stroke-width': 9 }, jar);
    S('rect', { x: -96, y: -272, width: 192, height: 48, rx: 14, fill: SH.ink }, jar);
    const jcp = S('clipPath', { id: 'jarcp' }, defs);
    S('rect', { x: -131, y: -221, width: 262, height: 402, rx: 36 }, jcp);
    const fillG = S('g', { 'clip-path': 'url(#jarcp)' }, jar);
    const stripes = [SH.yel, SH.red, SH.blue, SH.grn, SH.pink].map((c, i) => S('rect', { x: -150, y: 180 - (i + 1) * 64, width: 300, height: 64, fill: c }, fillG));
    const jp = S('path', { d: plusD(1), fill: SH.blue }, jar);
    const coins = S('g', {}, root);
    const cText = S('text', { 'font-family': FONT.cn, 'font-weight': 700, 'font-size': 64, fill: '#fff', 'text-anchor': 'middle', y: 22 }, coins, '+30');
    const cBg = S('circle', { r: 70, fill: SH.grn }, coins);
    coins.insertBefore(cBg, cText);
    const travellers = Array.from({ length: 6 }, (_, i) => (i % 2 ? S('rect', { x: -16, y: -16, width: 32, height: 32, fill: [SH.red, SH.yel, SH.blue][i % 3] }, root) : S('circle', { r: 18, fill: [SH.yel, SH.blue, SH.red][i % 3] }, root)));
    say(root, { text: 'right answers', at: 23.8, out: 30.1, y: 230, size: 140, style: 'shape' });
    say(root, { text: 'fill the jar.', at: 26.6, out: 30.1, y: 1720, size: 150, style: 'shape', hi: [2], hiColor: SH.red, align: 'left' });
    const w = circleWipe(root, 690, 1280, SH.red);
    const bez = (k: number) => {
      const P0 = [650, 1100], P1 = [680, 1220], P2 = [780, 1240], P3 = [800, 1320];
      const u = 1 - k;
      return [u ** 3 * P0[0] + 3 * u * u * k * P1[0] + 3 * u * k * k * P2[0] + k ** 3 * P3[0], u ** 3 * P0[1] + 3 * u * u * k * P1[1] + 3 * u * k * k * P2[1] + k ** 3 * P3[1]];
    };
    scenes.push({
      a: 23.45,
      b: 30.85,
      root,
      wipe: w,
      wd: 0.6,
      paint(t) {
        amb(t);
        const up = io(seg(t, 25.6, 26.3));
        tf(eq, `translate(${lerp(170, 250, up)} ${lerp(560, 430, up)}) scale(${lerp(0.9, 0.72, up)})`);
        const k7 = o5(seg(t, 23.9, 24.3));
        tf(sevA, `translate(${(1 - k7) * -900} 0)`);
        tf(sevB, `translate(0 ${(1 - bk(seg(t, 24.1, 24.5))) * -900})`);
        tf(tim, `translate(450 175) rotate(${45 + (1 - bk(seg(t, 24.2, 24.6))) * 270}) scale(${bk(seg(t, 24.2, 24.6))})`);
        e1(o3(seg(t, 24.4, 24.8)));
        e2(o3(seg(t, 24.55, 24.95)));
        const ringsG = eq.querySelectorAll('circle');
        ringsG.forEach((c) => c.setAttribute('transform', `${c.getAttribute('transform')?.split(')')[0]})`));
        tf(ringsG[0], 'translate(720 85) rotate(-90)');
        tf(ringsG[1], 'translate(720 85) rotate(-90 0 170)');
        const a = state.answeredAt ?? 26.6;
        chips.forEach(({ g, c, v, i }) => {
          const enter = o5(seg(t, 24.7 + i * 0.1, 25.3 + i * 0.1));
          const x = 210 + i * 220;
          const right = v === '56';
          const after = seg(t, a, a + 0.35);
          const pop = right ? 1 + 0.25 * Math.sin(Math.PI * after) : lerp(1, 0.78, after);
          tf(g, `translate(${x + (1 - enter) * 1100} 1010) rotate(${(1 - enter) * 360}) scale(${pop})`);
          c.setAttribute('fill', right && t >= a ? SH.red : SH.bg);
          if (right) g.classList.toggle('on', t >= a);
          (g.querySelector('text') as SVGTextElement).setAttribute('fill', right && t >= a ? '#fff' : SH.ink);
          op(g, right ? 1 : 1 - 0.55 * after);
        });
        pd(seg(t, a + 0.1, a + 0.6));
        travellers.forEach((tr, i) => {
          const k = seg(t, a + 0.3 + i * 0.12, a + 0.9 + i * 0.12);
          const [x, y] = bez(io(k));
          tf(tr, `translate(${x} ${y}) rotate(${k * 360}) scale(${k > 0 && k < 1 ? 1 : 0})`);
        });
        tf(jar, `translate(800 ${1440 + (1 - o5(seg(t, 25.0, 25.6))) * 900})`);
        stripes.forEach((s, i) => {
          const k = bk(seg(t, a + 0.9 + i * 0.28, a + 1.25 + i * 0.28));
          tf(s, `translate(0 ${(1 - k) * 340})`);
        });
        tf(jp, `translate(0 ${-60}) rotate(${t * 40}) scale(${1 + 0.1 * Math.sin(t * 5)})`);
        const ck = el5(seg(t, a + 1.2, a + 2.0));
        tf(coins, `translate(890 1150) scale(${ck}) rotate(-12)`);
      },
    });
  }

  // ── N2 · Notebook: wrong? MN shows how (30.2 – 35.9) ─────────────────────
  {
    const root = S('g', {}, world);
    paper(root, NB.bg);
    const g = grid(root);
    const amb = ambient(root, 'note', 12);
    const T = (x: number, y: number, s: number, txt: string, c = NB.ink, anchor = 'start') => S('text', { x, y, 'font-family': FONT.cn, 'font-weight': 700, 'font-size': s, fill: c, 'text-anchor': anchor }, root, txt);
    const clipT = (e: SVGTextElement) => {
      const id = `ct${Math.random().toString(36).slice(2, 7)}`;
      const cp = S('clipPath', { id }, defs);
      const r = S('rect', { x: 0, y: 0, width: 0, height: 2000 }, cp);
      e.setAttribute('clip-path', `url(#${id})`);
      return (k: number) => r.setAttribute('width', String(1080 * k));
    };
    const l1 = T(140, 720, 150, '99 × 7 = 683');
    const w1 = clipT(l1);
    const strike = drawn(S('path', { d: 'M690 660 L960 700', stroke: NB.hp, 'stroke-width': 14, 'stroke-linecap': 'round', fill: 'none' }, root));
    // A number line: 98 · 99 · 100, and the hop from 99 to 100.
    const nl = drawn(S('path', { d: 'M140 1000 H940', stroke: NB.ink, 'stroke-width': 5, fill: 'none' }, root));
    const ticks = [180, 470, 760].map((x, i) => [drawn(S('path', { d: `M${x} 980 v40`, stroke: NB.ink, 'stroke-width': 5, fill: 'none' }, root)), T(x, 1080, 54, ['98', '99', '100'][i], NB.ink, 'middle')] as const);
    const hop = drawn(S('path', { d: 'M470 990 Q615 860 760 990', stroke: NB.pen, 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }, root));
    const hopT = T(615, 880, 52, '+1', NB.pen, 'middle');
    const l2 = T(140, 1290, 120, '100 × 7 = 700');
    const w2 = clipT(l2);
    const l3 = T(140, 1440, 120, '700 − 7');
    const w3 = clipT(l3);
    const l4 = T(560, 1440, 150, '= 693', NB.pen);
    const w4 = clipT(l4);
    const ring = drawn(S('ellipse', { cx: 760, cy: 1390, rx: 230, ry: 110, fill: 'none', stroke: NB.hp, 'stroke-width': 12, transform: 'rotate(-6 760 1390)' }, root));
    const tick = drawn(S('path', { d: 'M820 1540 l40 40 l80 -100', stroke: NB.hg, 'stroke-width': 22, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, root));
    say(root, { text: 'wrong?', at: 30.55, out: 35.3, y: 260, size: 130, style: 'note' });
    say(root, { text: 'MN shows how.', at: 31.54, out: 35.3, y: 410, size: 130, style: 'note', hi: [2], hiColor: NB.hy });
    // Wipe: a pen sweeps across and the page is behind it.
    const cp = clipRoot(root);
    const sweep = S('rect', { x: -200, y: -200, width: 0, height: 2320 }, cp);
    const nib = S('g', {}, fx);
    S('rect', { x: -6, y: -1000, width: 12, height: 3000, fill: NB.pen }, nib);
    S('polygon', { points: '-30,-40 30,-40 0,40', fill: NB.ink }, nib);
    scenes.push({
      a: 30.15,
      b: 35.9,
      root,
      wd: 0.65,
      wipe(k) {
        const x = -200 + 1500 * io(k);
        sweep.setAttribute('width', String(x + 200));
        tf(nib, `translate(${x} 960) rotate(8)`);
        op(nib, k > 0 && k < 1 ? 1 : 0);
      },
      paint(t) {
        g(seg(t, 30.2, 31.0));
        amb(t);
        w1(io(seg(t, 30.7, 31.3)));
        strike(seg(t, 31.3, 31.6));
        nl(seg(t, 32.3, 32.6));
        ticks.forEach(([d, txt], i) => {
          d(seg(t, 32.4 + i * 0.08, 32.55 + i * 0.08));
          op(txt, seg(t, 32.45 + i * 0.08, 32.6 + i * 0.08));
        });
        hop(seg(t, 32.6, 32.95));
        op(hopT, seg(t, 32.85, 33.0));
        w2(io(seg(t, 32.9, 33.4)));
        w3(io(seg(t, 33.4, 33.7)));
        w4(io(seg(t, 33.65, 33.95)));
        ring(seg(t, 34.0, 34.45));
        tick(seg(t, 34.3, 34.6));
      },
    });
  }

  // ── S3 · Shapes: a treat about every 10 days (35.3 – 41.7) ───────────────
  const dayPos = Array.from({ length: 10 }, (_, i) => [162 + i * 84, 1000] as [number, number]);
  {
    const root = S('g', {}, world);
    paper(root, SH.bg);
    const amb = ambient(root, 'shape', 14);
    const big = S('circle', { cx: 120, cy: 1700, r: 280, fill: SH.blue }, root);
    const tri = S('polygon', { points: '1100,300 760,560 1100,820', fill: SH.pink }, root);
    const cal: SVGRectElement[] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) cal.push(S('rect', { x: 260 + c * 80, y: 1260 + r * 80, width: 64, height: 64, rx: 10, fill: SH.ink, 'fill-opacity': 0.08 }, root));
    const days = dayPos.map(([x, y], i) => {
      const g = S('g', {}, root);
      const c = S('circle', { r: 34, fill: SH.bg, stroke: SH.ink, 'stroke-width': 6 }, g);
      S('text', { y: 82, 'text-anchor': 'middle', 'font-family': FONT.cn, 'font-weight': 700, 'font-size': 34, fill: SH.ink }, g, String(i + 1));
      tf(g, `translate(${x} ${y})`);
      return { g, c };
    });
    const star = S('path', { d: Array.from({ length: 10 }, (_, k) => { const r = k % 2 ? 34 : 78, a = -Math.PI / 2 + (k * Math.PI) / 5; return `${k ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`; }).join('') + 'Z', fill: SH.red, stroke: SH.ink, 'stroke-width': 6 }, root);
    const rays = Array.from({ length: 12 }, () => S('rect', { x: -5, y: -150, width: 10, height: 40, rx: 5, fill: SH.yel }, root));
    say(root, { text: 'a treat about', at: 35.67, out: 39.4, y: 360, size: 140, style: 'shape' });
    say(root, { text: 'every 10 days.', at: 36.6, out: 39.4, y: 520, size: 140, style: 'shape', hi: [1, 2], hiColor: SH.red });
    say(root, { text: 'steady effort.', at: 39.7, out: 41.1, y: 440, size: 150, style: 'shape', hi: [1], hiColor: SH.blue });
    // Wipe: a highlighter-yellow band sweeps diagonally.
    const cp = clipRoot(root);
    const band = S('rect', { x: -1400, y: -400, width: 0, height: 3000, transform: 'rotate(-20 540 960)' }, cp);
    const bandFx = S('rect', { x: -1400, y: -400, width: 0, height: 3000, fill: SH.yel, transform: 'rotate(-20 540 960)' }, fx);
    const COLS = [SH.blue, SH.red, SH.yel, SH.grn, SH.pink];
    scenes.push({
      a: 35.25,
      b: 41.75,
      root,
      wd: 0.7,
      wipe(k) {
        const w = 3600 * io(k);
        band.setAttribute('width', String(w));
        bandFx.setAttribute('x', String(-1400 + w - 260));
        bandFx.setAttribute('width', String(k > 0 && k < 1 ? 260 : 0));
      },
      paint(t) {
        amb(t);
        tf(big, `translate(${Math.sin(t) * 30} 0)`);
        tf(tri, `rotate(${Math.sin(t * 0.8) * 8} 1100 560)`);
        days.forEach(({ g, c }, i) => {
          const enter = bk(seg(t, 35.6 + i * 0.04, 36.0 + i * 0.04));
          const lit = seg(t, 36.25 + i * 0.36, 36.45 + i * 0.36);
          const [x, y] = dayPos[i];
          tf(g, `translate(${x} ${y}) scale(${enter * (1 + 0.3 * Math.sin(Math.PI * lit))})`);
          c.setAttribute('fill', lit > 0.5 ? COLS[i % 5] : SH.bg);
          op(g, i === 9 && t > 39.6 ? 1 - seg(t, 39.6, 39.75) : 1);
        });
        cal.forEach((r, i) => r.setAttribute('fill-opacity', String(0.08 + 0.6 * (seg(t, 36.2 + i * 0.12, 36.35 + i * 0.12) > 0.5 ? 1 : 0))));
        cal.forEach((r, i) => r.setAttribute('fill', seg(t, 36.2 + i * 0.12, 36.35 + i * 0.12) > 0.5 ? COLS[i % 5] : SH.ink));
        const sk = el5(seg(t, 39.6, 40.4));
        tf(star, `translate(${dayPos[9][0]} ${dayPos[9][1]}) rotate(${t * 60}) scale(${sk * 1.1})`);
        rays.forEach((r, i) => {
          const k = o3(seg(t, 39.7, 40.3));
          tf(r, `translate(${dayPos[9][0]} ${dayPos[9][1]}) rotate(${i * 30 + t * 30}) translate(0 ${-k * 40}) scale(1 ${k})`);
          op(r, k * (1 - seg(t, 40.5, 41.0)));
        });
      },
    });
  }

  // ── N3 · Notebook: big dreams take months (41.1 – 47.6) ──────────────────
  {
    const root = S('g', {}, world);
    paper(root, NB.bg);
    const g = grid(root);
    const amb = ambient(root, 'note', 10);
    const axis = drawn(S('path', { d: 'M160 640 V1460 H920', stroke: NB.ink, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' }, root));
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'].map((m, i) => S('text', { x: 220 + i * 128, y: 1520, 'text-anchor': 'middle', 'font-family': FONT.cn, 'font-weight': 700, 'font-size': 40, fill: NB.ink }, root, m));
    // Points: where the ten days were, flying to the chart.
    const PTS: [number, number][] = [[200, 1400], [275, 1360], [350, 1300], [425, 1250], [500, 1170], [575, 1120], [650, 1260], [715, 1050], [780, 960], [840, 860]];
    const area = S('path', { d: `M200 1460 ${PTS.map((p) => `L${p[0]} ${p[1]}`).join(' ')} L840 1460Z`, fill: NB.hg, 'fill-opacity': 0.55 }, root);
    const line = drawn(S('path', { d: `M${PTS.map((p) => p.join(' ')).join(' L')}`, stroke: NB.pen, 'stroke-width': 10, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, root));
    const dots = PTS.map(() => S('circle', { r: 16, fill: NB.ink }, root));
    const skipRing = drawn(S('circle', { cx: 650, cy: 1260, r: 60, fill: 'none', stroke: NB.hp, 'stroke-width': 10 }, root));
    const skipT = S('text', { x: 650, y: 1380, 'text-anchor': 'middle', 'font-family': FONT.cn, 'font-weight': 700, 'font-size': 44, fill: NB.hp }, root, 'SKIPPED A DAY');
    const flag = S('g', {}, root);
    S('path', { d: 'M0 0 V-170', stroke: NB.ink, 'stroke-width': 8 }, flag);
    S('path', { d: 'M0 -170 L120 -140 L0 -110 Z', fill: NB.hp }, flag);
    S('text', { x: -60, y: -190, 'font-family': FONT.cn, 'font-weight': 700, 'font-size': 40, fill: NB.ink }, flag, 'BIG GOAL');
    say(root, { text: 'big dreams', at: 41.47, out: 44.2, y: 300, size: 130, style: 'note' });
    say(root, { text: 'take months.', at: 42.4, out: 44.2, y: 450, size: 130, style: 'note', hi: [1], hiColor: NB.hy });
    say(root, { text: 'skip a day,', at: 44.36, out: 46.95, y: 300, size: 120, style: 'note' });
    say(root, { text: 'it shrinks a little.', at: 45.47, out: 46.95, y: 440, size: 120, style: 'note', hi: [3], hiColor: NB.hp });
    // Wipe: the page rises from the bottom while the day circles fly to the chart.
    const cp = clipRoot(root);
    const up = S('rect', { x: -200, y: 2120, width: 1480, height: 0 }, cp);
    scenes.push({
      a: 41.1,
      b: 47.65,
      root,
      wd: 0.6,
      wipe(k) {
        const h = 2320 * io(k);
        up.setAttribute('y', String(2120 - h));
        up.setAttribute('height', String(h));
      },
      paint(t) {
        g(seg(t, 41.2, 42.0));
        amb(t);
        axis(seg(t, 41.4, 41.9));
        months.forEach((m, i) => op(m, seg(t, 41.6 + i * 0.06, 41.75 + i * 0.06)));
        const fly = io(seg(t, 41.15, 41.9));
        dots.forEach((d, i) => {
          const [fx0, fy0] = dayPos[i];
          const [x1, y1] = PTS[i];
          const shrink = i === 6 ? io(seg(t, 44.4, 45.0)) : 0;
          d.setAttribute('cx', String(lerp(fx0, x1, fly)));
          d.setAttribute('cy', String(lerp(fy0, y1, fly) + (i === 6 ? 0 : 0)));
          d.setAttribute('r', String(lerp(34, 16, fly)));
          d.setAttribute('fill', i === 6 && t > 44.4 ? NB.hp : NB.ink);
          void shrink;
        });
        line(seg(t, 42.0, 43.9));
        op(area, 0.55 * seg(t, 43.4, 44.0));
        tf(flag, `translate(840 860) scale(${bk(seg(t, 43.7, 44.1))})`);
        skipRing(seg(t, 44.4, 44.8));
        op(skipT, seg(t, 44.7, 44.9));
      },
    });
  }

  // ── P3 · Print: beat the bosses (47.0 – 50.8) ────────────────────────────
  {
    const root = S('g', {}, world);
    paper(root, PR.bg);
    const amb = ambient(root, 'print', 8);
    const shake = S('g', {}, root);
    const blobD = 'M0 -330 C190 -340 340 -190 330 10 C320 210 200 330 10 330 C-200 330 -340 200 -330 0 C-320 -200 -190 -320 0 -330Z';
    const boss = S('g', {}, shake);
    S('path', { d: blobD, fill: 'url(#htp)', style: 'mix-blend-mode:multiply' }, boss);
    S('path', { d: blobD, fill: 'none', stroke: PR.blue, 'stroke-width': 12, transform: 'translate(10 8)', style: 'mix-blend-mode:multiply' }, boss);
    ['6×7=41', '9+3=11', '½+½=2', '√16=8', '3²=6'].forEach((s, i) => S('text', { x: R(-180, 40), y: -160 + i * 80, 'font-family': FONT.adv, 'font-weight': 700, 'font-size': 64, fill: PR.blue, 'fill-opacity': 0.75, transform: `rotate(${R(-10, 10)})` }, boss, s));
    const eyes = S('g', {}, boss);
    S('circle', { cx: -80, cy: -40, r: 44, fill: PR.bg }, eyes);
    S('circle', { cx: 80, cy: -50, r: 54, fill: PR.bg }, eyes);
    S('circle', { cx: -70, cy: -30, r: 20, fill: PR.ink }, eyes);
    S('circle', { cx: 92, cy: -38, r: 24, fill: PR.ink }, eyes);
    const pow = S('g', {}, shake);
    const pts = Array.from({ length: 24 }, (_, k) => { const r = k % 2 ? 110 : 210, a = (k * Math.PI) / 12; return `${(Math.cos(a) * r).toFixed(0)},${(Math.sin(a) * r).toFixed(0)}`; }).join(' ');
    S('polygon', { points: pts, fill: PR.yel, style: 'mix-blend-mode:multiply' }, pow);
    S('polygon', { points: pts, fill: 'none', stroke: PR.pink, 'stroke-width': 8, transform: 'translate(8 6)', style: 'mix-blend-mode:multiply' }, pow);
    S('text', { y: 30, 'text-anchor': 'middle', 'font-family': FONT.adv, 'font-weight': 700, 'font-size': 96, fill: PR.blue, transform: 'rotate(-10)' }, pow, 'POW!');
    const beam = S('path', { d: 'M150 1720 L420 1120', stroke: PR.pink, 'stroke-width': 30, 'stroke-linecap': 'round', style: 'mix-blend-mode:multiply' }, root);
    const bd = drawn(beam);
    const hero = S('path', { d: plusD(1.6), fill: 'url(#htb)', stroke: PR.blue, 'stroke-width': 6 }, root);
    const trophy = S('g', {}, root);
    S('path', { d: 'M-90 -110 H90 V-40 C90 30 40 60 0 60 C-40 60 -90 30 -90 -40Z', fill: PR.blue, style: 'mix-blend-mode:multiply' }, trophy);
    S('path', { d: 'M-90 -90 C-150 -90 -150 -10 -80 0 M90 -90 C150 -90 150 -10 80 0', fill: 'none', stroke: PR.pink, 'stroke-width': 16, style: 'mix-blend-mode:multiply' }, trophy);
    S('rect', { x: -20, y: 60, width: 40, height: 60, fill: PR.blue }, trophy);
    S('rect', { x: -70, y: 116, width: 140, height: 34, rx: 8, fill: PR.pink, style: 'mix-blend-mode:multiply' }, trophy);
    say(root, { text: 'beat the bosses.', at: 47.31, out: 50.15, y: 300, size: 130, style: 'print', hi: [2] });
    say(root, { text: 'win trophies.', at: 48.6, out: 50.15, y: 1680, size: 110, style: 'print', hi: [1] });
    // Wipe: torn paper, a zigzag edge from the left.
    const cp = clipRoot(root);
    const tear = S('polygon', { points: '' }, cp);
    const tearFx = S('polyline', { points: '', fill: 'none', stroke: PR.ink, 'stroke-width': 6, 'stroke-opacity': 0.4 }, fx);
    scenes.push({
      a: 46.95,
      b: 50.85,
      root,
      wd: 0.55,
      wipe(k) {
        const x = -200 + 1600 * io(k);
        const zz: string[] = [];
        for (let y = -200; y <= 2120; y += 70) zz.push(`${(x + ((y / 70) % 2 ? 40 : -40)).toFixed(0)},${y}`);
        tear.setAttribute('points', `-200,-200 ${zz.join(' ')} -200,2120`);
        tearFx.setAttribute('points', k > 0 && k < 1 ? zz.join(' ') : '');
      },
      paint(t) {
        amb(t);
        const hit = seg(t, 47.95, 48.1);
        const sh = hit > 0 ? Math.max(0, 1 - seg(t, 48.1, 48.6)) : 0;
        tf(shake, `translate(${Math.sin(t * 90) * 18 * sh} ${Math.cos(t * 80) * 14 * sh})`);
        const enter = bk(seg(t, 47.2, 47.75));
        const crush = io(seg(t, 48.9, 49.6));
        tf(boss, `translate(600 1000) scale(${enter * lerp(1, 0.15, crush)}) rotate(${Math.sin(t * 2) * 4 + crush * 200})`);
        op(boss, 1 - seg(t, 49.4, 49.7));
        tf(eyes, `translate(${Math.sin(t * 1.7) * 12} 0)`);
        bd(seg(t, 47.75, 47.95));
        op(beam, 1 - seg(t, 48.2, 48.5));
        tf(hero, `translate(150 1720) rotate(${45 + t * 30}) scale(${bk(seg(t, 47.4, 47.8))})`);
        tf(pow, `translate(470 1080) scale(${el5(seg(t, 47.95, 48.6))}) rotate(${-8 + Math.sin(t * 6) * 3})`);
        op(pow, 1 - seg(t, 49.2, 49.5));
        tf(trophy, `translate(600 1060) scale(${lerp(3, 1, o3(seg(t, 49.3, 49.55)))}) rotate(${(1 - seg(t, 49.3, 49.55)) * 20})`);
        op(trophy, seg(t, 49.3, 49.35));
      },
    });
  }

  // ── N4 · Notebook: and you're in charge (50.2 – 58.6) ────────────────────
  {
    const root = S('g', {}, world);
    paper(root, NB.bg);
    const g = grid(root);
    const amb = ambient(root, 'note', 12);
    const AT = [51.74, 52.81, 54.2, 56.07];
    const rows = ['DAILY TIME LIMIT', 'PARENT PIN', 'YOU HAND OVER PRIZES', 'NO ADS · WORKS OFFLINE'].map((label, i) => {
      const y = 760 + i * 230;
      const box = drawn(S('rect', { x: 150, y: y - 60, width: 110, height: 110, rx: 12, fill: 'none', stroke: NB.ink, 'stroke-width': 7 }, root));
      const tick = drawn(S('path', { d: `M170 ${y} l30 30 l60 -80`, stroke: NB.hg, 'stroke-width': 22, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, root));
      const txt = S('text', { x: 300, y: y + 18, 'font-family': FONT.cn, 'font-weight': 700, 'font-size': 64, fill: NB.ink }, root, label);
      const id = `rw${i}`;
      const cp = S('clipPath', { id }, defs);
      const cr = S('rect', { x: 290, y: y - 80, height: 140, width: 0 }, cp);
      txt.setAttribute('clip-path', `url(#${id})`);
      return { box, tick, cr };
    });
    // Little drawings by each: a clock, PIN boxes, a gift, a plane.
    const clock = S('g', {}, root);
    S('circle', { r: 46, fill: 'none', stroke: NB.pen, 'stroke-width': 6 }, clock);
    const hand = S('path', { d: 'M0 0 V-32', stroke: NB.pen, 'stroke-width': 6, 'stroke-linecap': 'round' }, clock);
    const pins = Array.from({ length: 4 }, (_, i) => S('rect', { x: 680 + i * 64, y: 950, width: 48, height: 48, rx: 8, fill: 'none', stroke: NB.pen, 'stroke-width': 5 }, root));
    const pinDots = pins.map((_, i) => S('circle', { cx: 704 + i * 64, cy: 974, r: 0, fill: NB.pen }, root));
    say(root, { text: 'and you’re', at: 50.49, out: 57.95, y: 330, size: 130, style: 'note' });
    say(root, { text: 'in charge.', at: 51.0, out: 57.95, y: 480, size: 130, style: 'note', hi: [1], hiColor: NB.hy });
    // Wipe: halftone dots grow until they cover the page.
    const cp = clipRoot(root);
    const ds: SVGCircleElement[] = [];
    for (let y = -100; y < 2100; y += 120) for (let x = -60; x < 1140; x += 120) ds.push(S('circle', { cx: x + ((y / 120) % 2 ? 60 : 0), cy: y, r: 0 }, cp));
    scenes.push({
      a: 50.15,
      b: 58.65,
      root,
      wd: 0.6,
      wipe(k) {
        ds.forEach((d, i) => d.setAttribute('r', String(110 * io(seg(k, ((i * 37) % 100) / 250, ((i * 37) % 100) / 250 + 0.6)))));
      },
      paint(t) {
        g(seg(t, 50.2, 51.0));
        amb(t);
        rows.forEach(({ box, tick, cr }, i) => {
          box(seg(t, AT[i] - 0.3, AT[i]));
          cr.setAttribute('width', String(760 * io(seg(t, AT[i] - 0.15, AT[i] + 0.35))));
          tick(seg(t, AT[i] + 0.4, AT[i] + 0.7));
        });
        tf(clock, `translate(${890} ${745}) scale(${bk(seg(t, 51.9, 52.2))})`);
        tf(hand, `rotate(${t * 240})`);
        pins.forEach((p, i) => op(p, seg(t, 52.95, 53.05)));
        pinDots.forEach((d, i) => d.setAttribute('r', String(12 * bk(seg(t, 53.2 + i * 0.18, 53.35 + i * 0.18)))));
        void pins;
      },
    });
  }

  // ── S4 · Shapes and everything: small steps, real rewards, MN (58.0 – end) ─
  {
    const root = S('g', {}, world);
    paper(root, SH.bg);
    const half = S('g', {}, root);
    for (let x = 0; x <= 1080; x += 40) S('line', { x1: x, y1: 1300, x2: x, y2: 1960, stroke: NB.grid, 'stroke-width': 2 }, half);
    for (let y = 1300; y <= 1960; y += 40) S('line', { x1: 0, y1: y, x2: 1080, y2: y, stroke: NB.grid, 'stroke-width': 2 }, half);
    const amb1 = ambient(root, 'print', 6, [60, 1020, 120, 900]);
    const amb2 = ambient(root, 'shape', 16);
    const bars = Array.from({ length: 7 }, (_, i) => S('rect', { x: -38, y: -150, width: 76, height: 300, rx: 10, fill: [SH.blue, SH.blue, SH.red, SH.blue, SH.blue, SH.yel, SH.blue][i] }, root));
    const PLUS = [[0, 0, 0, 300], [0, 0, 90, 300], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const MN = [[-330, 0, 0, 300], [-140, 0, 0, 300], [-283, -45, -24, 232], [-187, -45, 24, 232], [60, 0, 0, 300], [250, 0, 0, 300], [155, 0, -32, 356]];
    const steps: SVGRectElement[] = [];
    for (let i = 0; i < 7; i++) steps.push(S('rect', { x: 130 + i * 118, y: 0, width: 100, height: 0, fill: [SH.grn, SH.blue, SH.yel, SH.red, SH.pink, SH.blue, SH.red][i] }, root));
    say(root, { text: 'small steps.', at: 59.02, out: 61.0, y: 1180, size: 150, style: 'shape' });
    say(root, { text: 'real rewards.', at: 60.03, out: 61.0, y: 1360, size: 140, style: 'print', hi: [1] });
    say(root, { text: 'mission next', at: 61.5, out: 99, y: 1280, size: 92, style: 'shape', hi: [1], hiColor: SH.red });
    words[words.length - 1].g.classList.add('op-word');
    const w = circleWipe(root, 540, 760, SH.blue);
    scenes.push({
      a: 57.95,
      b: 99,
      root,
      wipe: w,
      wd: 0.6,
      paint(t) {
        amb1(t);
        amb2(t);
        const enter = o5(seg(t, 58.3, 58.9));
        const toMN = io(seg(t, 61.05, 61.8));
        bars.forEach((b, i) => {
          const p = PLUS[i], m = MN[i];
          const L = lerp(p[3], m[3], toMN);
          const fly = i < 2 ? (1 - enter) * (i === 0 ? -1000 : 1000) : 0;
          const spin = i < 2 ? 90 * io(seg(t, 58.8, 59.4)) * (1 - toMN) : 0;
          b.setAttribute('height', String(Math.max(0, L)));
          b.setAttribute('y', String(-L / 2));
          tf(b, `translate(540 ${lerp(720, 820, toMN)}) scale(${lerp(1.1, 1, toMN)}) translate(${lerp(p[0], m[0], toMN) + (i === 0 ? fly : 0)} ${lerp(p[1], m[1], toMN) + (i === 1 ? fly : 0)}) rotate(${lerp(p[2], m[2], toMN) + spin})`);
          op(b, i < 2 ? enter : clamp(L / 60));
        });
        steps.forEach((s, i) => {
          const k = bk(seg(t, 59.1 + i * 0.1, 59.5 + i * 0.1)) * (1 - io(seg(t, 60.9, 61.3)));
          const h = (50 + i * 34) * k;
          s.setAttribute('height', String(Math.max(0, h)));
          s.setAttribute('y', String(1760 - h));
        });
      },
    });
  }

  return { scenes, words, fx };
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
      <svg class="op-svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" aria-hidden="true"></svg>
      <div class="op-grain" aria-hidden="true"></div>
      <div class="op-ui">
        <div class="op-bar" aria-hidden="true"><i></i></div>
        <div class="op-top"><button class="op-btn rl-mute" aria-label="Sound">${muted ? soundOff : soundOn}</button>${o.first ? '' : '<button class="op-btn rl-skip">Skip</button>'}</div>
        <button class="op-btn op-tapsound" hidden>Tap for sound</button>
        <div class="op-foot" hidden><button class="op-go rl-go">${esc(o.label)}</button>${o.first ? '' : '<button class="op-link rl-again">Watch again</button>'}</div>
      </div>
    </section>`);
    const svg = el.querySelector<SVGSVGElement>('.op-svg')!;
    const defs = S('defs', {}, svg);
    const ht = (id: string, c: string, s = 14, r = 4.2) => {
      const p = S('pattern', { id, width: s, height: s, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(30)' }, defs);
      S('circle', { cx: s / 2, cy: s / 2, r, fill: c }, p);
    };
    ht('htp', PR.pink, 12, 3.8);
    ht('htb', PR.blue);
    ht('hty', PR.yel, 16, 5.2);
    const state = { answeredAt: null as number | null };
    let now = () => 0;
    const onTap = (v: string) => {
      const t = now();
      if (t < 25.2 || t > 26.6 || state.answeredAt !== null) return;
      if (v === '56') {
        state.answeredAt = t;
        app.sfx.correct(2);
      } else app.sfx.wrong();
    };
    const { scenes, words } = build(svg, defs, onTap, state);
    const bar = el.querySelector<HTMLElement>('.op-bar i')!;

    const paint = (t: number) => {
      for (const sc of scenes) {
        const on = t >= sc.a && t < sc.b;
        sc.root.style.display = on ? '' : 'none';
        if (!on) continue;
        sc.wipe?.(seg(t, sc.a, sc.a + (sc.wd ?? 0.6)));
        sc.paint(t);
      }
      // The wipes' own marks (rings, the pen, the band) only while a wipe runs.
      for (const w of words) w.paint(t);
      bar.style.transform = `scaleX(${clamp(t / OPENER_END)})`;
    };

    // ── the clock ────────────────────────────────────────────────────────
    const audio = fast ? null : voiceover();
    if (audio) audio.muted = muted;
    let t0 = performance.now();
    let manual: number | null = null;
    let raf = 0;
    let ended = false;
    let running = true;
    now = (): number => {
      if (manual !== null) return manual;
      if (audio && !audio.paused && audio.currentTime > 0) return audio.currentTime;
      return ((performance.now() - t0) / 1000) * speed;
    };
    const foot = el.querySelector<HTMLElement>('.op-foot')!;
    const tick = () => {
      if (!running) return;
      const t = Math.min(now(), OPENER_END + 1);
      paint(t);
      if (t >= OPENER_END - 0.6 && !ended) {
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
        el.querySelector<HTMLElement>('.op-tapsound')!.hidden = false;
      }
    };
    el.querySelector('.op-tapsound')!.addEventListener('click', (e) => {
      (e.currentTarget as HTMLElement).hidden = true;
      if (!audio) return;
      muted = false;
      audio.muted = false;
      audio.currentTime = Math.min(now(), OPENER_END);
      void audio.play().catch(() => undefined);
    });
    el.querySelector('.rl-mute')!.addEventListener('click', (e) => {
      muted = !muted;
      if (audio) audio.muted = muted;
      (e.currentTarget as HTMLElement).innerHTML = muted ? soundOff : soundOn;
      if (!muted && audio && audio.paused) {
        audio.currentTime = Math.min(now(), OPENER_END);
        void audio.play().catch(() => undefined);
      }
    });
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      audio?.pause();
    };
    el.querySelector('.rl-go')!.addEventListener('click', () => (stop(), o.done()));
    el.querySelector('.rl-skip')?.addEventListener('click', () => (stop(), (o.leave ?? o.done)()));
    el.querySelector('.rl-again')?.addEventListener('click', () => {
      ended = false;
      foot.classList.remove('in');
      foot.hidden = true;
      state.answeredAt = null;
      if (audio) audio.currentTime = 0;
      void start();
    });
    if (app.debug) Object.assign(window, { __opener: { seek: (t: number) => ((manual = t), paint(t)), play: () => (manual = null) } });

    return {
      el,
      mounted: () => {
        // Words are measured once the fonts are in.
        void document.fonts?.ready.then(() => words.forEach((w) => (w.laid = false)));
        void start();
        raf = requestAnimationFrame(tick);
      },
      destroy: stop,
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
