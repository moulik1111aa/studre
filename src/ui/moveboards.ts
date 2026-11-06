// Lesson pictures that move: the moving number line (track), the bead frame (beads) and
// base-ten blocks that bundle into the next column (bundle). Each is drawn once; setMoveStep()
// then moves its parts to where they are at step i, with CSS transitions doing the motion
// (so reduced motion simply jumps).

import type { BeadsBoard, BundleBoard, TrackBoard } from '../core/teach/types.ts';
import { esc } from './app.ts';
import { reducedMotion } from '../render/motion.ts';

const W = 340;
const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-IN') : String(v));
const at = (t: { at?: number }) => t.at ?? 0;
const pinPath = 'M0 0 C-3 -7 -10 -11 -10 -19 A10 10 0 1 1 10 -19 C10 -11 3 -7 0 0 Z';

// ── Moving number line ─────────────────────────────────────────────────────

function trackLayout(b: TrackBoard) {
  const vals = new Set<number>();
  b.points.forEach((p) => vals.add(p.v));
  b.hops.forEach((h) => (vals.add(h.from), vals.add(h.to)));
  b.gaps?.forEach((g) => (vals.add(g.from), vals.add(g.to)));
  const sorted = [...vals].sort((p, q) => p - q);
  const gaps = sorted.slice(1).map((v, i) => 0.9 + Math.log10(1 + Math.abs(v - sorted[i])));
  const unit = 64;
  const pad = 36;
  let acc = pad;
  const pos = new Map<number, number>();
  sorted.forEach((v, i) => {
    if (i) acc += gaps[i - 1] * unit;
    pos.set(v, acc);
  });
  let worldW = acc + pad;
  if (b.linear) {
    // To scale: everything fits the view, so a slid gap keeps its length.
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    const k = (W - 2 * pad) / Math.max(1, hi - lo);
    sorted.forEach((v) => pos.set(v, pad + (v - lo) * k));
    worldW = W;
  } else if (worldW < W) {
    // Short lines fit the view: stretch them evenly instead of panning.
    const k = (W - 2 * pad) / Math.max(1, acc - pad);
    sorted.forEach((v) => pos.set(v, pad + (pos.get(v)! - pad) * k));
    worldW = W;
  }
  const x = (v: number) => pos.get(v) ?? W / 2;
  const last = Math.max(0, ...b.points.map(at), ...b.hops.map(at), ...(b.gaps ?? []).map(at)) + 2;
  // Where the view is centred, and where the pointer stands, at each step.
  const cams: number[] = [];
  const ptrs: number[] = [];
  const start = b.points.find((p) => p.tone === 'start')?.v ?? b.hops[0]?.from ?? sorted[0];
  let cam = x(start);
  let ptr = x(start);
  for (let i = 0; i <= last; i++) {
    const hs = b.hops.filter((h) => at(h) === i);
    const gs = (b.gaps ?? []).filter((g) => at(g) === i);
    if (hs.length) {
      const h = hs[hs.length - 1];
      ptr = x(h.to);
      const lo = Math.min(...hs.map((q) => Math.min(x(q.from), x(q.to))));
      const hi = Math.max(...hs.map((q) => Math.max(x(q.from), x(q.to))));
      cam = hi - lo < W * 0.8 ? (lo + hi) / 2 : ptr;
    } else if (gs.length) {
      const g = gs[gs.length - 1];
      cam = (x(g.from) + x(g.to)) / 2;
    }
    cams.push(cam);
    ptrs.push(ptr);
  }
  const clampCam = (c: number) => Math.max(W / 2, Math.min(worldW - W / 2, c));
  return { x, worldW, cams: cams.map(clampCam), ptrs, start: x(start) };
}

export function trackHtml(b: TrackBoard): string {
  const L = trackLayout(b);
  const y0 = 104;
  const out: string[] = [];
  out.push(`<line class="ax" x1="0" y1="${y0}" x2="${L.worldW}" y2="${y0}"/>`);
  for (const g of b.gaps ?? []) {
    const x1 = L.x(g.from), x2 = L.x(g.to);
    out.push(`<g class="trk-gap" data-at="${at(g)}"${g.until !== undefined ? ` data-until="${g.until}"` : ''}><rect x="${x1}" y="${y0 - 36}" width="${x2 - x1}" height="16" rx="8"/><line x1="${x1}" y1="${y0 - 20}" x2="${x1}" y2="${y0}"/><line x1="${x2}" y1="${y0 - 20}" x2="${x2}" y2="${y0}"/>${g.label ? `<text x="${(x1 + x2) / 2}" y="${y0 - 42}">${esc(g.label)}</text>` : ''}</g>`);
  }
  for (const h of b.hops) {
    const x1 = L.x(h.from), x2 = L.x(h.to);
    const xm = (x1 + x2) / 2;
    const hgt = Math.max(16, Math.min(34, Math.abs(x2 - x1) * 0.4));
    const cy = y0 - 2 - hgt * 2;
    out.push(`<g class="hop${x2 < x1 ? ' back' : ''}" data-at="${at(h)}"><path pathLength="1" d="M${x1} ${y0 - 2} Q${xm} ${cy} ${x2} ${y0 - 2}"/><text class="hl-t" x="${xm}" y="${y0 - 2 - hgt - 6}">${esc(h.label)}</text></g>`);
  }
  for (const p of b.points) {
    const xx = L.x(p.v);
    out.push(`<g class="pt${p.tone ? ' p-' + p.tone : ''}" data-at="${at(p)}"${p.until !== undefined ? ` data-until="${p.until}"` : ''}${p.hl !== undefined ? ` data-hl="${p.hl}"` : ''}><line class="tk" x1="${xx}" y1="${y0 - 7}" x2="${xx}" y2="${y0 + 7}"/><circle cx="${xx}" cy="${y0}" r="5"/><text class="pl" x="${xx}" y="${y0 + 26}">${esc(p.label ?? fmt(p.v))}</text></g>`);
  }
  if (b.hops.length) out.push(`<g class="trk-ptr" style="transform:translate(${L.start}px,${y0 - 3}px)"><path d="${pinPath}"/><circle cx="0" cy="-19" r="3.6" class="hole"/></g>`);
  return `<div class="bd bd-line trk" data-cams="${L.cams.map((c) => Math.round(c)).join(',')}" data-ptrs="${L.ptrs.map((c) => Math.round(c)).join(',')}" data-y="${y0 - 3}"><svg viewBox="0 0 ${W} 140" class="board-svg" role="img" aria-label="Number line"><g class="trk-world" style="transform:translateX(${Math.round(W / 2 - L.cams[0])}px)">${out.join('')}</g></svg></div>`;
}

function trackStep(el: HTMLElement, i: number, prev: number): void {
  const cams = el.dataset.cams!.split(',').map(Number);
  const ptrs = el.dataset.ptrs!.split(',').map(Number);
  const y = Number(el.dataset.y);
  const k = Math.min(i, cams.length - 1);
  const world = el.querySelector<SVGGElement>('.trk-world')!;
  world.style.transform = `translateX(${W / 2 - cams[k]}px)`;
  const ptr = el.querySelector<SVGGElement>('.trk-ptr');
  if (!ptr) return;
  const from = ptrs[Math.max(0, Math.min(prev, ptrs.length - 1))];
  const to = ptrs[k];
  ptr.style.transform = `translate(${to}px,${y}px)`;
  if (i === prev + 1 && from !== to && !reducedMotion()) {
    // Ride the arc: up and over to the next point.
    const mid = (from + to) / 2;
    const h = Math.max(22, Math.min(40, Math.abs(to - from) * 0.4));
    ptr.animate(
      [{ transform: `translate(${from}px,${y}px)` }, { transform: `translate(${mid}px,${y - h}px)` }, { transform: `translate(${to}px,${y}px)` }],
      { duration: 700, easing: 'ease-in-out' },
    );
  }
}

// ── Bead frame ─────────────────────────────────────────────────────────────

const ROWS_Y = [46, 100];
const home = (i: number) => 316 - (9 - i) * 22;
const slid = (i: number) => 34 + i * 22 + (i >= 5 ? 8 : 0);

export function beadsHtml(b: BeadsBoard): string {
  const out: string[] = [`<rect class="bd-frame" x="8" y="14" width="324" height="${ROWS_Y[b.rows.length - 1] + 32}" rx="14"/>`];
  b.rows.forEach((r, ri) => {
    out.push(`<line class="bd-wire" x1="16" y1="${ROWS_Y[ri]}" x2="324" y2="${ROWS_Y[ri]}"/>`);
    for (let i = 0; i < 10; i++) out.push(`<circle class="bead ${i < 5 ? 'red' : 'white'}" data-row="${ri}" data-i="${i}" r="10" cx="0" cy="0" style="transform:translate(${home(i)}px,${ROWS_Y[ri]}px)"/>`);
  });
  const h = ROWS_Y[b.rows.length - 1] + 66;
  for (const n of b.notes ?? []) out.push(`<text class="bead-note" x="${W / 2}" y="${h - 8}" data-at="${at(n)}"${n.until !== undefined ? ` data-until="${n.until}"` : ''}>${esc(n.text)}</text>`);
  return `<div class="bd beads" data-b='${JSON.stringify({ rows: b.rows.map((r) => r.slides), hop: b.hop ?? null, readAt: b.readAt ?? null })}'><svg viewBox="0 0 ${W} ${h}" class="board-svg" role="img" aria-label="Bead frame">${out.join('')}</svg></div>`;
}

function beadsStep(el: HTMLElement, i: number): void {
  const d = JSON.parse(el.dataset.b!) as { rows: { step: number; n: number }[][]; hop: { step: number; n: number } | null; readAt: number | null };
  const count = (ri: number) => d.rows[ri].filter((s) => s.step <= i).reduce((n, s) => s.n, 0);
  const n = d.rows.map((_, ri) => count(ri));
  const hopped = d.hop && d.hop.step <= i ? d.hop.n : 0;
  el.querySelectorAll<SVGCircleElement>('.bead').forEach((c) => {
    const ri = Number(c.dataset.row);
    const k = Number(c.dataset.i);
    let x = k < n[ri] ? slid(k) : home(k);
    let y = ROWS_Y[ri];
    let gone = false;
    if (hopped) {
      // The last `hopped` slid beads of the bottom row move up to finish the top row; the
      // top row's beads that were not slid step back out of the way.
      if (ri === 1 && k >= n[1] - hopped && k < n[1]) {
        const j = n[0] + (k - (n[1] - hopped));
        x = slid(j);
        y = ROWS_Y[0];
      }
      if (ri === 0 && k >= n[0] && k < n[0] + hopped) gone = true;
    }
    c.style.transform = `translate(${x}px,${y}px)`;
    c.style.opacity = gone ? '0' : '';
    const moved = k < n[ri] && !gone;
    c.classList.toggle('in', moved);
    c.classList.toggle('read', d.readAt !== null && i >= d.readAt && moved);
  });
}

// ── Base-ten blocks that bundle ────────────────────────────────────────────

const COLW = 104;
type Blk = { kind: 'flat' | 'rod' | 'cube'; col: number; who: 0 | 1 | 2; key: string };

function bundleLayout(b: BundleBoard) {
  const ncol = Math.max(...b.nums.map((n) => String(n).length), String(b.nums.reduce((p, q) => p + q, 0)).length);
  const left = (c: number) => W - 12 - (c + 1) * COLW; // c = 0 ones (rightmost)
  const kindOf = (c: number): Blk['kind'] => (c === 0 ? 'cube' : c === 1 ? 'rod' : 'flat');
  const size = (k: Blk['kind']) => (k === 'cube' ? [11, 11] : k === 'rod' ? [9, 56] : [30, 30]);
  const perRow = (k: Blk['kind']) => (k === 'cube' ? 7 : k === 'rod' ? 9 : 3);
  const digit = (n: number, c: number) => Math.floor(n / 10 ** c) % 10;
  const blocks: Blk[] = [];
  for (let c = 0; c < ncol; c++) b.nums.forEach((n, who) => { for (let k = 0; k < digit(n, c); k++) blocks.push({ kind: kindOf(c), col: c, who: who as 0 | 1, key: `${c}-${who}-${k}` }); });
  // The carried block each column makes (if its total is 10 or more).
  const carries: { from: number; step: number }[] = [];
  let carry = 0;
  for (let c = 0; c < ncol; c++) {
    const tot = b.nums.reduce((p, n) => p + digit(n, c), 0) + carry;
    carry = tot >= 10 ? 1 : 0;
    if (carry) {
      blocks.push({ kind: kindOf(c + 1), col: c + 1, who: 2, key: `${c + 1}-carry` });
      carries.push({ from: c, step: b.cols[c]?.step ?? 0 });
    }
  }
  return { ncol, left, size, perRow, blocks, carries };
}

export function bundleHtml(b: BundleBoard): string {
  const Lb = bundleLayout(b);
  const out: string[] = [];
  const names = ['ones', 'tens', 'hundreds'];
  for (let c = 0; c < Lb.ncol; c++) out.push(`<rect class="bn-col" x="${Lb.left(c) + 4}" y="4" width="${COLW - 8}" height="152" rx="10"/><text class="bn-h" x="${Lb.left(c) + COLW / 2}" y="20">${names[c]}</text>`);
  for (const k of Lb.blocks) {
    const [w, h] = Lb.size(k.kind);
    out.push(`<rect class="bn ${k.kind} who${k.who}" data-key="${k.key}" x="0" y="0" width="${w}" height="${h}" rx="2"/>`);
  }
  return `<div class="bd bundle" data-b='${JSON.stringify(b)}'><svg viewBox="0 0 ${W} 160" class="board-svg" role="img" aria-label="Base-ten blocks">${out.join('')}</svg></div>`;
}

function bundleStep(el: HTMLElement, i: number): void {
  const b = JSON.parse(el.dataset.b!) as BundleBoard;
  const Lb = bundleLayout(b);
  const rects = new Map<string, SVGRectElement>();
  el.querySelectorAll<SVGRectElement>('.bn').forEach((r) => rects.set(r.dataset.key!, r));
  for (let c = 0; c < Lb.ncol; c++) {
    const joined = (b.cols[c]?.step ?? 0) <= i;
    const here = Lb.blocks.filter((k) => k.col === c);
    // Who is in this column now: the carried block (once made), then each number's blocks.
    const carry = here.find((k) => k.who === 2);
    const carryMade = carry ? Lb.carries.some((q) => q.from === c - 1 && q.step <= i) : false;
    const order = [...(carry && carryMade ? [carry] : []), ...here.filter((k) => k.who === 0), ...here.filter((k) => k.who === 1)];
    const bundled = Lb.carries.find((q) => q.from === c && q.step <= i);
    const kind = here[0]?.kind ?? 'cube';
    const [w, h] = Lb.size(kind);
    const per = Lb.perRow(kind);
    order.forEach((k, j) => {
      const r = rects.get(k.key)!;
      // Before the column is added, the second number's blocks sit a little lower ("apart").
      const apart = !joined && k.who === 1 ? 14 : 0;
      const firstOfSecond = here.filter((q) => q.who === 0).length + (carry && carryMade ? 1 : 0);
      const slot = joined ? j : k.who === 1 ? Math.ceil(firstOfSecond / per) * per + (j - firstOfSecond) : j;
      let x = Lb.left(c) + 10 + (slot % per) * (w + 3);
      let y = 28 + Math.floor(slot / per) * (h + 4) + apart;
      let op = 1;
      // Ten of them bundle and move to the next column (where the carried block appears).
      if (bundled && j < 10) {
        x = Lb.left(c + 1) + 10;
        y = 28;
        op = 0;
      }
      r.style.transform = `translate(${x}px,${y}px)`;
      r.style.opacity = String(op);
      r.style.transitionDelay = bundled && j < 10 && b.cols[c].step === i ? '0.45s' : '0s';
      r.classList.toggle('ten', !!bundled && j < 10);
    });
    if (carry && !carryMade) {
      const r = rects.get(carry.key)!;
      r.style.opacity = '0';
      r.style.transform = `translate(${Lb.left(c) + 10}px,28px)`;
    } else if (carry) {
      const r = rects.get(carry.key)!;
      r.style.transitionDelay = Lb.carries.some((q) => q.from === c - 1 && q.step === i) ? '0.9s' : '0s';
    }
  }
}

/** Move every moving picture inside `root` to step i (from step `prev`). */
export function setMoveStep(root: HTMLElement, i: number, prev: number): void {
  root.querySelectorAll<HTMLElement>('.trk').forEach((el) => trackStep(el, i, prev));
  root.querySelectorAll<HTMLElement>('.beads').forEach((el) => beadsStep(el, i));
  root.querySelectorAll<HTMLElement>('.bundle').forEach((el) => bundleStep(el, i));
}
