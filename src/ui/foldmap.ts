// The dragon map (a per-child option in the Parent area): the same levels as the usual map,
// laid along a dragon curve (core/dragon.ts). Each segment
// of the glowing line is one level; a skill's 5 levels share one stop. The map shows one
// chapter at a time: when the levels done pass 8, 16, 32 … the whole path so far is copied
// and swings out by a right angle around its end, like a folded strip opening, and the new
// chapter appears. Drag to look around, pinch or use the buttons to zoom.

import { html, esc, type App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { chapterOf, dragonPoints, levelMid, unfolding, FIRST_CHAPTER, type Pt } from '../core/dragon.ts';
import { worldColors } from './worlds.ts';
import { reducedMotion, wait } from '../render/motion.ts';

/**
 * The whole feature can be switched off here. To remove it for good: delete this file,
 * core/dragon.ts and test/dragon.test.ts, the `fold` branch in map.ts, the Dragon map
 * button in parent.ts, the .fold-* styles in 20-map.css and Child.dragonMap/foldSeen.
 */
export const DRAGON_MAP = true;

/** Dragon map for this child (browser tests can force it with ?debug&dragon). */
export const dragonMapOn = (app: App, child: Child): boolean =>
  DRAGON_MAP && (!!child.dragonMap || (app.debug && new URLSearchParams(location.search).has('dragon')));

export interface FoldNode {
  kind: 'skill' | 'review' | 'boss' | 'quest';
  stage: number;
  /** Segments (levels, counted from 1) the stop covers; a side quest sits on its boss's. */
  first: number;
  last: number;
  face: string;
  label: string;
  done: boolean;
  playable: boolean;
  skipped: boolean;
  current: boolean;
  /** Skill stops: which of the 5 levels are passed. */
  tiers?: boolean[];
}

export interface FoldOptions {
  nodes: FoldNode[];
  /** Stage of each level (index 1 … total). */
  segStage: number[];
  /** Done (or skipped) for each level (index 1 … total). */
  segDone: boolean[];
  total: number;
  /** Levels done in order (the frontier). */
  done: number;
  /** The end of the last chapter this child has seen unfold (none: never opened the dragon map). */
  seen?: number;
  markSeen: (end: number) => void;
  onTap: (k: number) => void;
  /** Plus in his Adventure outfit, next to the current stop. */
  buddy?: string;
  /** Adventure map trail (wardrobe): colours the done path. */
  trail?: string;
}

const TRAIL: Record<string, string> = { sparkles: '#FFC531', stars: '#FFFFFF', bubbles: '#7FD3FF', 'ghost-trail': '#CFE3F2' };

interface Cam {
  x: number;
  y: number;
  s: number;
  a: number;
}

/** Chapter `end` drawn upright: its start-to-end line points up and to the right. */
function uprightFor(end: number): number {
  const p = dragonPoints(end);
  return -Math.PI / 4 - Math.atan2(p[end][1] - p[0][1], p[end][0] - p[0][0]);
}
const nearAngle = (a: number, ref: number): number => {
  let x = a;
  while (x - ref > Math.PI) x -= 2 * Math.PI;
  while (x - ref < -Math.PI) x += 2 * Math.PI;
  return x;
};

/** Corners cut a little, so turns look like folded paper. */
function rounded(pts: readonly Pt[]): Pt[] {
  if (pts.length < 3) return [...pts];
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const [cx, cy] = pts[i + 1];
    out.push([bx + (ax - bx) * 0.24, by + (ay - by) * 0.24], [bx + (cx - bx) * 0.24, by + (cy - by) * 0.24]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function foldStage(app: App, o: FoldOptions): { el: HTMLElement; mounted: () => Promise<void>; destroy: () => void } {
  const chapter = chapterOf(o.done);
  const end = chapter.end;
  const shown = Math.min(end, o.total);
  const el = html(`<div class="fold-stage">
    <canvas class="fold-canvas" aria-label="Map: chapter ${chapter.no}, levels ${chapter.start} to ${shown}"></canvas>
    <div class="fold-anchors"></div>
    <p class="fold-cap" aria-hidden="true"><b>Chapter ${chapter.no}</b> · levels ${chapter.start}–${shown}</p>
    <div class="fold-tools">
      <button class="icon-btn fold-fit" aria-label="See the whole chapter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button class="icon-btn fold-me" aria-label="Back to the next level"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg></button>
    </div>
    <p class="fold-banner" role="status"></p>
  </div>`);
  const canvas = el.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d');
  const anchors = el.querySelector<HTMLElement>('.fold-anchors')!;
  const banner = el.querySelector<HTMLElement>('.fold-banner')!;
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

  let W = 0;
  let H = 0;
  let dpr = 1;
  const cam: Cam = { x: 0, y: 0, s: 40, a: uprightFor(end) };
  const goal: Cam = { ...cam };
  let raf = 0;
  let alive = true;
  /** While a chapter unfolds: the path to draw instead, and which levels to leave out. */
  let scene: { pts: Pt[]; upto: number } | null = null;
  let busy = false;
  let fitMode = false;

  const curNode = o.nodes.find((n) => n.current && n.kind !== 'quest');
  const nodeAt = (n: FoldNode): Pt => (n.kind === 'skill' ? levelMid(Math.round((n.first + n.last) / 2)) : levelMid(n.first));
  const focus: Pt = curNode ? nodeAt(curNode) : levelMid(Math.max(1, Math.min(o.done || 1, shown)));

  // ── Camera ─────────────────────────────────────────────────────────────
  function bounds(pts: readonly Pt[], a: number): { cx: number; cy: number; w: number; h: number } {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (const [px, py] of pts) {
      const x = px * c - py * s;
      const y = px * s + py * c;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    // Back from the turned frame to the map's own.
    return { cx: mx * c + my * s, cy: -mx * s + my * c, w: x1 - x0 + 1.4, h: y1 - y0 + 1.4 };
  }
  /** Room left for the map between the top tools and the Play bar. */
  const view = () => ({ w: W - 24, h: H - 170, dy: -30 });
  function fitCam(pts: readonly Pt[], a: number): Cam {
    const b = bounds(pts, a);
    const v = view();
    const s = Math.max(4, Math.min(v.w / b.w, v.h / b.h, 120));
    // Shift up so the Play bar doesn't cover the bottom.
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const off = v.dy / s;
    return { x: b.cx - off * sn, y: b.cy - off * c, s, a };
  }
  const chapterPts = () => dragonPoints(end).slice(0, shown + 1);
  const minScale = () => Math.min(fitCam(chapterPts(), cam.a).s, 30);
  const COMFY = 46;
  function homeCam(): Cam {
    const whole = fitCam(chapterPts(), uprightFor(end));
    if (whole.s >= COMFY) return whole;
    const v = view();
    const a = uprightFor(end);
    const off = v.dy / COMFY;
    return { x: focus[0] - off * Math.sin(a), y: focus[1] - off * Math.cos(a), s: COMFY, a };
  }

  const project = (p: Pt): [number, number] => {
    const dx = p[0] - cam.x;
    const dy = p[1] - cam.y;
    const c = Math.cos(cam.a);
    const s = Math.sin(cam.a);
    return [W / 2 + (dx * c - dy * s) * cam.s, H / 2 + (dx * s + dy * c) * cam.s];
  };
  const unproject = (x: number, y: number): Pt => {
    const dx = (x - W / 2) / cam.s;
    const dy = (y - H / 2) / cam.s;
    const c = Math.cos(cam.a);
    const s = Math.sin(cam.a);
    return [cam.x + dx * c + dy * s, cam.y - dx * s + dy * c];
  };

  /** Keep the chapter in sight. */
  function clampCam(c: Cam): Cam {
    const lo = minScale();
    const s = Math.max(lo, Math.min(110, c.s));
    const b = bounds(chapterPts(), c.a);
    // Limits in the turned frame, then back.
    const co = Math.cos(c.a);
    const sn = Math.sin(c.a);
    let rx = c.x * co - c.y * sn;
    let ry = c.x * sn + c.y * co;
    const bx = b.cx * co - b.cy * sn;
    const by = b.cx * sn + b.cy * co;
    const hx = Math.max(0, b.w / 2 - W / (2.6 * s));
    const hy = Math.max(0, b.h / 2 - H / (2.6 * s)) + 2.5;
    rx = Math.max(bx - hx, Math.min(bx + hx, rx));
    ry = Math.max(by - hy, Math.min(by + hy, ry));
    return { x: rx * co + ry * sn, y: -rx * sn + ry * co, s, a: c.a };
  }

  function moveTo(c: Cam, snap = false): void {
    Object.assign(goal, c);
    goal.a = nearAngle(goal.a, cam.a);
    if (snap || reducedMotion()) Object.assign(cam, goal);
    kick();
  }

  // ── Drawing ────────────────────────────────────────────────────────────
  function grid(c: CanvasRenderingContext2D): void {
    let g = 1;
    while (g * cam.s < 22) g *= 2;
    const R = Math.hypot(W, H) / 2 / cam.s + g * 4;
    for (const major of [false, true]) {
      const step = major ? g * 4 : g;
      c.beginPath();
      const sx = Math.floor((cam.x - R) / step) * step;
      const sy = Math.floor((cam.y - R) / step) * step;
      for (let x = sx; x <= cam.x + R; x += step) {
        c.moveTo(x, cam.y - R);
        c.lineTo(x, cam.y + R);
      }
      for (let y = sy; y <= cam.y + R; y += step) {
        c.moveTo(cam.x - R, y);
        c.lineTo(cam.x + R, y);
      }
      c.strokeStyle = major ? 'rgba(130,108,235,.26)' : 'rgba(130,108,235,.11)';
      c.lineWidth = 1 / cam.s;
      c.stroke();
    }
  }

  function stroke(c: CanvasRenderingContext2D, pts: readonly Pt[], colour: string, width: number, blur: number, alpha = 1): void {
    if (pts.length < 2) return;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.globalAlpha = alpha;
    c.shadowColor = colour;
    c.shadowBlur = blur;
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.stroke();
    c.shadowBlur = 0;
    c.globalAlpha = 1;
  }

  const doneColour = (i: number): string => {
    if (o.trail === 'rainbow') return `hsl(${(i * 9) % 360} 95% 68%)`;
    return (o.trail && TRAIL[o.trail]) || worldColors(o.segStage[i] ?? 1)[0];
  };

  function draw(): void {
    if (!ctx || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const c = Math.cos(cam.a) * cam.s;
    const s = Math.sin(cam.a) * cam.s;
    ctx.setTransform(dpr * c, dpr * s, -dpr * s, dpr * c, dpr * (W / 2 - (c * cam.x - s * cam.y)), dpr * (H / 2 - (s * cam.x + c * cam.y)));
    grid(ctx);
    const pts = scene ? scene.pts.slice(0, o.total + 1) : chapterPts();
    const lw = Math.max(3, Math.min(10, cam.s * 0.2)) / cam.s;
    // The whole chapter, faint; then the levels done, glowing in their world's colour.
    stroke(ctx, rounded(pts), 'rgba(170,150,255,.30)', lw, 0);
    const upto = scene ? scene.upto : pts.length - 1;
    let runStart = -1;
    let runColour = '';
    const flush = (endAt: number) => {
      if (runStart >= 0) stroke(ctx, rounded(pts.slice(runStart - 1, endAt + 1)), runColour, lw * 1.15, 14);
      runStart = -1;
    };
    for (let i = 1; i <= Math.min(upto, pts.length - 1); i++) {
      const on = !!o.segDone[i];
      const col = on ? doneColour(o.trail === 'rainbow' ? Math.floor(i / 4) : i) : '';
      if (on && runStart >= 0 && col === runColour) continue;
      flush(i - 1);
      if (on) {
        runStart = i;
        runColour = col;
      }
    }
    flush(Math.min(upto, pts.length - 1));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!scene) drawNodes();
    placeAnchors();
  }

  const nodeR = () => Math.max(7, Math.min(28, cam.s * 0.34));

  function drawNodes(): void {
    if (!ctx) return;
    const r0 = nodeR();
    // Each stage's first stop wears a little flag with the stage number (not stage 1's on level 1).
    const flags = new Map<FoldNode, number>();
    if (cam.s >= 18) {
      let prev = 0;
      for (const n of o.nodes) {
        if (n.first > shown) break;
        if (n.stage !== prev && (prev || n.first > 1)) flags.set(n, n.stage);
        prev = n.stage;
      }
    }
    // Zoomed far out, only the bosses (and the current stop's ring) stay, so the shape reads.
    const far = cam.s < 15;
    for (const n of o.nodes) {
      if (n.first > shown || (far && n.kind !== 'boss')) continue;
      const [x, y] = project(nodeAt(n));
      const r = n.kind === 'boss' ? r0 * 1.3 : n.kind === 'quest' ? r0 * 0.62 : r0;
      const qx = n.kind === 'quest' ? r0 * 1.25 : 0;
      const px = x + qx;
      const py = y - qx;
      if (px < -r || py < -r || px > W + r || py > H + r) continue;
      const [a, b] = n.kind === 'boss' ? ['#FF7A7A', '#8E1F3B'] : n.kind === 'review' ? ['#9B8CFF', '#4B3BB8'] : n.kind === 'quest' ? ['#5CF3C8', '#1F8F8A'] : worldColors(n.stage);
      ctx.globalAlpha = n.playable || n.done ? 1 : 0.5;
      // A soft shadow below, then the ball.
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.arc(px, py + r * 0.18, r, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createLinearGradient(px - r, py - r, px + r, py + r);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * 0.1);
      ctx.strokeStyle = n.current ? '#FFE27A' : 'rgba(255,255,255,.55)';
      ctx.stroke();
      // Five little arcs: the skill's levels passed.
      if (n.tiers && r >= 10) {
        const gap = 0.16;
        n.tiers.forEach((on, k) => {
          const s0 = -Math.PI / 2 + (k * 2 * Math.PI) / 5 + gap;
          ctx.beginPath();
          ctx.arc(px, py, r + Math.max(3, r * 0.2), s0, s0 + (2 * Math.PI) / 5 - gap * 2);
          ctx.strokeStyle = on ? '#FFD25A' : 'rgba(255,255,255,.18)';
          ctx.lineWidth = Math.max(2, r * 0.13);
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      }
      if (r >= 9) {
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emoji = n.kind !== 'skill';
        ctx.font = `900 ${Math.round(r * (emoji ? 1.05 : 0.95))}px ${font}`;
        ctx.fillText(n.face, px, py + (emoji ? r * 0.06 : r * 0.04));
      }
      ctx.globalAlpha = 1;
      const flag = flags.get(n);
      if (flag) {
        const [fa] = worldColors(flag);
        const text = `Stage ${flag}`;
        ctx.font = `800 ${Math.round(Math.max(11, r0 * 0.48))}px ${font}`;
        const tw = ctx.measureText(text).width + 14;
        const fy = py - r - 16;
        ctx.fillStyle = fa;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px - tw / 2, fy - 10, tw, 20, 10);
        else ctx.rect(px - tw / 2, fy - 10, tw, 20);
        ctx.fill();
        ctx.fillStyle = '#14123A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, px, fy + 1);
      }
      if ((n.done || n.skipped) && r >= 9 && n.kind !== 'quest') {
        const cx = px + r * 0.72;
        const cy = py + r * 0.72;
        const cr = Math.max(6, r * 0.38);
        ctx.fillStyle = n.done && !n.skipped ? '#3DDC97' : '#7FD3FF';
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#05301F';
        ctx.font = `900 ${Math.round(cr * 1.3)}px ${font}`;
        ctx.fillText(n.skipped && !n.done ? '↷' : '✓', cx, cy + 1);
      }
    }
  }

  /** Buttons over the canvas for the current stop (and the next boss, for the tips). */
  let anchorCur: HTMLElement | null = null;
  let anchorBoss: HTMLElement | null = null;
  const nextBoss = o.nodes.find((n) => n.kind === 'boss' && !n.done && n.last <= shown && (!curNode || n.first >= curNode.first));
  if (curNode) {
    anchorCur = html(`<button class="node current fold-anchor" aria-label="${esc(curNode.label)}: the next level">${o.buddy ? `<span class="fold-buddy" aria-hidden="true">${o.buddy}</span>` : ''}</button>`);
    anchorCur.addEventListener('click', () => !busy && o.onTap(o.nodes.indexOf(curNode)));
    anchors.appendChild(anchorCur);
  }
  if (nextBoss) {
    anchorBoss = html(`<span class="node boss fold-anchor fold-ghost" aria-hidden="true"></span>`);
    anchors.appendChild(anchorBoss);
  }
  function place(a: HTMLElement | null, n: FoldNode | undefined, scale = 1): void {
    if (!a || !n) return;
    const [x, y] = project(nodeAt(n));
    const r = nodeR() * scale;
    const off = !!scene || x < -r || y < -r || x > W + r || y > H + r;
    a.hidden = off;
    a.style.left = `${x}px`;
    a.style.top = `${y}px`;
    a.style.setProperty('--r', `${r}px`);
  }
  function placeAnchors(): void {
    place(anchorCur, curNode);
    place(anchorBoss, nextBoss, 1.3);
    // The tips point at the boss only when it's on screen.
    if (anchorBoss) anchorBoss.classList.toggle('node', !anchorBoss.hidden);
  }

  // ── Animation loop (only while something moves) ─────────────────────────
  let last = 0;
  function frame(t: number): void {
    raf = 0;
    if (!alive) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    const f = 1 - Math.exp(-dt * 7);
    cam.x += (goal.x - cam.x) * f;
    cam.y += (goal.y - cam.y) * f;
    cam.s *= Math.pow(goal.s / cam.s, f);
    cam.a += (goal.a - cam.a) * f;
    const settled = Math.abs(goal.x - cam.x) * cam.s < 0.3 && Math.abs(goal.y - cam.y) * cam.s < 0.3 && Math.abs(goal.s / cam.s - 1) < 0.002 && Math.abs(goal.a - cam.a) < 0.001;
    if (settled) Object.assign(cam, goal);
    draw();
    if (!settled || scene) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick(): void {
    if (!raf && alive) raf = requestAnimationFrame(frame);
  }

  // ── Touch: drag to look around, pinch to zoom, tap a stop ────────────────
  const ptrs = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch: { d: number; s: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) moved = 0;
    if (ptrs.size === 2) {
      const [p, q] = [...ptrs.values()];
      pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), s: cam.s };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId);
    if (!prev || busy) return;
    const now = { x: e.clientX, y: e.clientY };
    ptrs.set(e.pointerId, now);
    if (ptrs.size >= 2 && pinch) {
      const [p, q] = [...ptrs.values()];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      Object.assign(cam, clampCam({ ...cam, s: (pinch.s * d) / Math.max(1, pinch.d) }));
      moved = 99;
    } else {
      const dx = now.x - prev.x;
      const dy = now.y - prev.y;
      moved += Math.abs(dx) + Math.abs(dy);
      const [ax, ay] = unproject(W / 2 - dx, H / 2 - dy);
      Object.assign(cam, clampCam({ ...cam, x: ax, y: ay }));
    }
    Object.assign(goal, cam);
    fitMode = false;
    kick();
  });
  const up = (e: PointerEvent) => {
    const had = ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!had || ptrs.size || busy || moved > 10) return;
    const r = canvas.getBoundingClientRect();
    tapAt(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => {
    ptrs.delete(e.pointerId);
    pinch = null;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      Object.assign(cam, clampCam({ ...cam, s: cam.s * Math.exp(-e.deltaY * 0.0015) }));
      Object.assign(goal, cam);
      kick();
    },
    { passive: false },
  );
  function tapAt(x: number, y: number): void {
    const r0 = nodeR();
    let best = -1;
    let bestD = Infinity;
    o.nodes.forEach((n, k) => {
      if (n.last > shown) return;
      const [nx, ny] = project(nodeAt(n));
      const q = n.kind === 'quest' ? r0 * 1.25 : 0;
      const d = Math.hypot(nx + q - x, ny - q - y);
      const reach = Math.max(22, (n.kind === 'boss' ? 1.3 : n.kind === 'quest' ? 0.7 : 1) * r0 + 6);
      if (d < reach && d < bestD) {
        best = k;
        bestD = d;
      }
    });
    if (best >= 0) o.onTap(best);
  }

  el.querySelector('.fold-fit')!.addEventListener('click', () => {
    fitMode = !fitMode;
    moveTo(fitMode ? fitCam(chapterPts(), uprightFor(end)) : homeCam());
  });
  el.querySelector('.fold-me')!.addEventListener('click', () => {
    fitMode = false;
    moveTo(homeCam());
  });

  function resize(): void {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    draw();
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;

  // ── The unfold ceremonies ──────────────────────────────────────────────
  function say(text: string, ms = 2600): void {
    banner.textContent = text;
    banner.classList.add('on');
    setTimeout(() => banner.classList.remove('on'), ms);
  }
  /** Swing the copy of chapter `from` out into chapter `from * 2`. */
  async function unfoldFrom(from: number, ms: number): Promise<void> {
    const next = from * 2;
    const t0 = performance.now();
    const before = uprightFor(from);
    const after = nearAngle(uprightFor(next), before);
    return new Promise((resolve) => {
      const step = (t: number) => {
        if (!alive) return resolve();
        const k = Math.min(1, (t - t0) / ms);
        const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
        const pts = unfolding(from, e);
        scene = { pts, upto: o.done };
        Object.assign(cam, fitCam(pts.slice(0, Math.min(next, o.total) + 1), before + (after - before) * e));
        Object.assign(goal, cam);
        draw();
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  async function ceremony(): Promise<void> {
    const first = o.seen === undefined;
    const from = first ? 1 : Math.max(1, o.seen!);
    if (from >= end || reducedMotion()) {
      if (o.seen !== end) o.markSeen(end);
      return;
    }
    busy = true;
    el.classList.add('unfolding');
    // Start from the old chapter (or, the first time, a single folded strip).
    const startPts = dragonPoints(from).slice(0, from + 1);
    Object.assign(cam, fitCam(startPts, uprightFor(from)));
    Object.assign(goal, cam);
    scene = { pts: [...startPts], upto: o.done };
    draw();
    await wait(first ? 500 : 650);
    if (first) say('Your map! Every line is one level.', 3800);
    else {
      say(`Chapter ${chapter.no}! The map unfolds.`, 3200);
      app.sfx.chime();
    }
    for (let f = from; f < end && alive; f *= 2) await unfoldFrom(f, first ? (f < FIRST_CHAPTER ? 380 : 700) : 1300);
    scene = null;
    o.markSeen(end);
    await wait(350);
    busy = false;
    el.classList.remove('unfolding');
    moveTo(homeCam());
    await wait(700);
  }

  return {
    el,
    mounted: async () => {
      ro?.observe(el);
      resize();
      Object.assign(cam, homeCam());
      Object.assign(goal, cam);
      draw();
      await ceremony();
    },
    destroy: () => {
      alive = false;
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
