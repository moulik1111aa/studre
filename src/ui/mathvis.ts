// Drawing Measure & Time, Shapes & Space and Data & Chance pictures (core/vis.ts) as SVG/HTML.
// Colours come from the theme (--mv-* in 37-mathvis.css); objects use a fixed bright palette.
// Motion classes (mv-rot, mv-draw, mv-pop, mv-move) only play inside a lesson step that has
// just appeared (.pf.fresh), so question cards stay still.

import type { MathVisual, Pt, ShapeName, SolidName, GeoSeg, GeoArc, GeoLabel } from '../core/vis.ts';

export const PAL: Record<string, string> = {
  red: '#FF5A5F', blue: '#3D8BFF', green: '#2ED47A', yellow: '#FFC531', orange: '#FF9F1C', purple: '#9B5DE5',
  pink: '#FF6FB5', brown: '#B07246', teal: '#1FC8C8', grey: '#9AA0B4', white: '#FFFFFF', black: '#2B2B3C',
};
const col = (c?: string, d = 'blue') => PAL[c ?? d] ?? c ?? PAL[d];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n: number) => Math.round(n * 10) / 10;
const P = (p: Pt) => `${r1(p[0])},${r1(p[1])}`;
const svg = (w: number, h: number, body: string, cls = '') => `<svg class="mv-svg${cls ? ' ' + cls : ''}" width="${r1(w)}" height="${r1(h)}" viewBox="0 0 ${r1(w)} ${r1(h)}" role="img" aria-hidden="true">${body}</svg>`;
const txt = (x: number, y: number, s: string, cls = 'mv-t', anchor = 'middle', extra = '') => `<text x="${r1(x)}" y="${r1(y)}" class="${cls}" text-anchor="${anchor}"${extra}>${esc(s)}</text>`;
const wrap = (kind: string, inner: string, extra = '') => `<div class="vis mv mv-${kind}"${extra}>${inner}</div>`;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Point at angle (maths convention, degrees, y up) and radius from a centre (SVG y down). */
const polar = (c: Pt, r: number, deg: number): Pt => [c[0] + r * Math.cos(rad(deg)), c[1] - r * Math.sin(rad(deg))];
/** Arc path from a0 to a1 (degrees, anticlockwise). */
function arcPath(c: Pt, r: number, a0: number, a1: number): string {
  let sweep = a1 - a0;
  while (sweep < 0) sweep += 360;
  const p0 = polar(c, r, a0);
  const p1 = polar(c, r, a0 + sweep);
  return `M${P(p0)} A${r1(r)},${r1(r)} 0 ${sweep > 180 ? 1 : 0} 0 ${P(p1)}`;
}
const sector = (c: Pt, r: number, a0: number, a1: number) => `${arcPath(c, r, a0, a1)} L${P(c)} Z`;

// ── Shapes ────────────────────────────────────────────────────────────────

const regular = (n: number, c: Pt, r: number, start = 90): Pt[] => Array.from({ length: n }, (_, i) => polar(c, r, start + (360 * i) / n));

/** Outline points of a named flat shape in a 160 × 160 box (curved shapes return []). */
export function shapePts(s: ShapeName): Pt[] {
  const c: Pt = [80, 84];
  switch (s) {
    case 'triangle': return regular(3, [80, 92], 72);
    case 'square': return [[25, 29], [135, 29], [135, 139], [25, 139]];
    case 'rectangle': return [[10, 44], [150, 44], [150, 124], [10, 124]];
    case 'pentagon': return regular(5, c, 70);
    case 'hexagon': return regular(6, c, 70, 0);
    case 'octagon': return regular(8, c, 70, 22.5);
    case 'rhombus': return [[80, 8], [138, 84], [80, 160], [22, 84]];
    case 'kite': return [[80, 10], [130, 62], [80, 156], [30, 62]];
    case 'trapezium': return [[48, 42], [112, 42], [150, 126], [10, 126]];
    case 'parallelogram': return [[44, 42], [152, 42], [116, 126], [8, 126]];
    case 'right-triangle': return [[22, 140], [140, 140], [22, 26]];
    case 'star': return Array.from({ length: 10 }, (_, i) => polar(c, i % 2 ? 30 : 72, 90 + i * 36));
    default: return [];
  }
}
function shapeEl(s: ShapeName, fill: string, cls = 'mv-shape'): string {
  const pts = shapePts(s);
  if (pts.length) return `<polygon class="${cls}" points="${pts.map(P).join(' ')}" fill="${fill}"/>`;
  switch (s) {
    case 'circle': return `<circle class="${cls}" cx="80" cy="84" r="68" fill="${fill}"/>`;
    case 'oval': return `<ellipse class="${cls}" cx="80" cy="84" rx="74" ry="48" fill="${fill}"/>`;
    case 'semicircle': return `<path class="${cls}" d="M10,116 A70,70 0 0 1 150,116 Z" fill="${fill}"/>`;
    case 'heart': return `<path class="${cls}" d="M80,148 C20,104 6,72 22,44 C38,18 70,24 80,48 C90,24 122,18 138,44 C154,72 140,104 80,148 Z" fill="${fill}"/>`;
    default: return '';
  }
}
const SHAPE_COLORS = ['yellow', 'pink', 'teal', 'orange', 'purple', 'green', 'blue', 'red'];

function shapeSvg(v: Extract<MathVisual, { kind: 'shape' }>): string {
  const fill = col(v.color, 'yellow');
  const pts = shapePts(v.shape);
  let body = `<g${v.rot ? ` transform="rotate(${v.rot} 80 84)"` : ''}>${shapeEl(v.shape, fill)}`;
  if (v.sides && pts.length) {
    body += pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const o: Pt = [m[0] + (m[0] - 80) * 0.22, m[1] + (m[1] - 84) * 0.22];
      return `<line class="mv-side mv-draw" pathLength="1" x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(q[0])}" y2="${r1(q[1])}" style="--d:${i * 260}ms"/><g class="mv-pop" style="--d:${i * 260 + 150}ms">${txt(o[0], o[1] + 5, String(i + 1), 'mv-t mv-num')}</g>`;
    }).join('');
  }
  if (v.corners && pts.length) {
    body += pts.map((p, i) => `<g class="mv-pop" style="--d:${i * 260}ms"><circle class="mv-corner" cx="${r1(p[0])}" cy="${r1(p[1])}" r="7"/></g>`).join('');
  }
  if (v.fold) {
    const l = v.fold === 'v' ? 'x1="80" y1="0" x2="80" y2="168"' : v.fold === 'h' ? 'x1="0" y1="84" x2="160" y2="84"' : 'x1="8" y1="8" x2="152" y2="160"';
    body += `<line class="mv-fold" ${l}/>`;
  }
  body += '</g>';
  return wrap('shape', svg(160, 168, body));
}

// ── Solids ────────────────────────────────────────────────────────────────

function solidSvg(s: SolidName, colorName = 'blue', hl?: 'faces' | 'edges' | 'corners'): string {
  const c = col(colorName);
  const face = (d: string, shade: number, k = 0) => `<path class="mv-face${hl === 'faces' ? ' mv-pop' : ''}" d="${d}" fill="${c}" style="--sh:${shade};--d:${k * 220}ms"/>`;
  const edge = (d: string) => `<path class="mv-edge${hl === 'edges' ? ' hl mv-draw' : ''}" pathLength="1" d="${d}"/>`;
  const hid = (d: string) => `<path class="mv-hidden" d="${d}"/>`;
  const dot = (p: Pt, k: number) => (hl === 'corners' ? `<g class="mv-pop" style="--d:${k * 160}ms"><circle class="mv-corner" cx="${p[0]}" cy="${p[1]}" r="6"/></g>` : '');
  let b = '';
  switch (s) {
    case 'cube':
    case 'cuboid': {
      const [w, h, d] = s === 'cube' ? [80, 80, 40] : [110, 62, 40];
      const x0 = 18;
      const y0 = 148 - h;
      const A: Pt = [x0, y0], B: Pt = [x0 + w, y0], C: Pt = [x0 + w, y0 + h], D: Pt = [x0, y0 + h];
      const off: Pt = [d * 0.9, -d * 0.75];
      const a = (p: Pt): Pt => [p[0] + off[0], p[1] + off[1]];
      b += hid(`M${P(D)} L${P(a(D))} L${P(a(C))} M${P(a(D))} L${P(a(A))}`);
      b += face(`M${P(A)} L${P(B)} L${P(C)} L${P(D)} Z`, 0, 0) + face(`M${P(A)} L${P(a(A))} L${P(a(B))} L${P(B)} Z`, 0.25, 1) + face(`M${P(B)} L${P(a(B))} L${P(a(C))} L${P(C)} Z`, -0.22, 2);
      b += edge(`M${P(A)} L${P(B)} L${P(C)} L${P(D)} Z M${P(A)} L${P(a(A))} L${P(a(B))} L${P(B)} M${P(a(B))} L${P(a(C))} L${P(C)}`);
      if (hl === 'faces') b += `<g class="mv-pop" style="--d:700ms">${txt(x0 + w / 2, y0 + h / 2 + 6, '1', 'mv-t mv-num')}${txt(x0 + w / 2 + off[0] / 2, y0 + off[1] / 2 + 5, '2', 'mv-t mv-num')}${txt(x0 + w + off[0] / 2, y0 + h / 2 + off[1] / 2 + 5, '3', 'mv-t mv-num')}</g>`;
      [A, B, C, D, a(A), a(B), a(C), a(D)].forEach((p, k) => (b += dot(p, k)));
      return svg(180, 160, b, 'mv-solid');
    }
    case 'cylinder':
      b += face('M30,40 L30,128 A50,16 0 0 0 130,128 L130,40 Z', -0.1) + face('M30,40 A50,16 0 0 1 130,40 A50,16 0 0 1 30,40 Z', 0.3, 1);
      b += edge('M30,40 L30,128 A50,16 0 0 0 130,128 L130,40 M30,40 A50,16 0 0 1 130,40 A50,16 0 0 1 30,40') + hid('M30,128 A50,16 0 0 1 130,128');
      return svg(160, 156, b, 'mv-solid');
    case 'cone':
      b += face('M80,14 L132,124 A52,17 0 0 1 28,124 Z', 0) + edge('M80,14 L132,124 A52,17 0 0 1 28,124 Z') + hid('M28,124 A52,17 0 0 1 132,124');
      b += dot([80, 14], 0);
      return svg(160, 152, b, 'mv-solid');
    case 'sphere':
      b += `<circle class="mv-face" cx="80" cy="80" r="62" fill="${c}" style="--sh:0"/><ellipse class="mv-shine" cx="58" cy="56" rx="16" ry="10"/>` + hid('M18,80 A62,18 0 0 1 142,80') + edge('M18,80 A62,18 0 0 0 142,80') + `<circle class="mv-edge" cx="80" cy="80" r="62"/>`;
      return svg(160, 160, b, 'mv-solid');
    case 'hemisphere':
      b += face('M18,70 A62,62 0 0 0 142,70 Z', 0) + face('M18,70 A62,18 0 0 1 142,70 A62,18 0 0 1 18,70 Z', 0.3, 1) + edge('M18,70 A62,62 0 0 0 142,70 M18,70 A62,18 0 0 1 142,70 A62,18 0 0 1 18,70');
      return svg(160, 140, b, 'mv-solid');
    case 'pyramid': {
      const T: Pt = [80, 14], A: Pt = [22, 132], B: Pt = [112, 132], C: Pt = [142, 104], D: Pt = [52, 104];
      b += hid(`M${P(A)} L${P(D)} L${P(C)} M${P(D)} L${P(T)}`);
      b += face(`M${P(T)} L${P(A)} L${P(B)} Z`, 0, 0) + face(`M${P(T)} L${P(B)} L${P(C)} Z`, -0.22, 1);
      b += edge(`M${P(T)} L${P(A)} L${P(B)} Z M${P(T)} L${P(C)} L${P(B)}`);
      [T, A, B, C, D].forEach((p, k) => (b += dot(p, k)));
      return svg(160, 150, b, 'mv-solid');
    }
    case 'prism': {
      const A: Pt = [20, 134], B: Pt = [80, 134], T: Pt = [50, 64];
      const o: Pt = [62, -34];
      const a = (p: Pt): Pt => [p[0] + o[0], p[1] + o[1]];
      b += hid(`M${P(A)} L${P(a(A))} L${P(a(B))} M${P(a(A))} L${P(a(T))}`);
      b += face(`M${P(A)} L${P(B)} L${P(T)} Z`, 0, 0) + face(`M${P(T)} L${P(a(T))} L${P(a(B))} L${P(B)} Z`, -0.2, 1);
      b += edge(`M${P(A)} L${P(B)} L${P(T)} Z M${P(T)} L${P(a(T))} L${P(a(B))} L${P(B)}`);
      [A, B, T, a(A), a(B), a(T)].forEach((p, k) => (b += dot(p, k)));
      return svg(160, 150, b, 'mv-solid');
    }
  }
}

// ── Compare (Stage 1) ─────────────────────────────────────────────────────

function compareSvg(v: Extract<MathVisual, { kind: 'compare' }>): string {
  const items = v.items;
  if (v.mode === 'long') {
    const rows = items.map((it, i) => {
      const y = 14 + i * 44;
      const len = 70 + it.size * 230;
      const c = col(it.color);
      return `<g class="${it.hl ? 'mv-hl' : ''}"><rect class="mv-pencil" x="14" y="${y}" width="${r1(len - 26)}" height="22" rx="4" fill="${c}"/><polygon class="mv-pencil-tip" points="${r1(14 + len - 26)},${y} ${r1(14 + len)},${y + 11} ${r1(14 + len - 26)},${y + 22}"/><polygon fill="#3A3A4A" points="${r1(14 + len - 8)},${y + 7} ${r1(14 + len)},${y + 11} ${r1(14 + len - 8)},${y + 15}"/><rect x="14" y="${y}" width="10" height="22" rx="3" fill="#FF9EB5" class="mv-eraser"/></g>`;
    });
    const tip = v.tip !== undefined ? `<line class="mv-guide" x1="${r1(14 + 70 + items[v.tip].size * 230)}" y1="4" x2="${r1(14 + 70 + items[v.tip].size * 230)}" y2="${items.length * 44 + 10}"/><line class="mv-guide" x1="14" y1="4" x2="14" y2="${items.length * 44 + 10}"/>` : '';
    return wrap('compare', svg(320, items.length * 44 + 14, rows.join('') + tip));
  }
  if (v.mode === 'tall' || v.mode === 'big') {
    const n = items.length;
    const W = Math.max(110, n * 100);
    const body = items.map((it, i) => {
      const cx = (W / n) * (i + 0.5);
      const c = col(it.color, 'green');
      if (v.mode === 'big') {
        const r = 14 + it.size * 36;
        return `<g class="${it.hl ? 'mv-hl' : ''}"><circle class="mv-ball" cx="${r1(cx)}" cy="${r1(150 - r)}" r="${r1(r)}" fill="${c}"/><path class="mv-ballline" d="M${r1(cx - r)},${r1(150 - r)} Q${r1(cx)},${r1(150 - r * 0.4)} ${r1(cx + r)},${r1(150 - r)}"/></g>`;
      }
      const h = 40 + it.size * 120;
      const crown = 20 + it.size * 10;
      return `<g class="${it.hl ? 'mv-hl' : ''}"><rect x="${r1(cx - 6)}" y="${r1(150 - h * 0.45)}" width="12" height="${r1(h * 0.45)}" fill="#B07246" class="mv-trunk"/><ellipse class="mv-crown" cx="${r1(cx)}" cy="${r1(150 - h + crown)}" rx="${r1(crown)}" ry="${r1(crown * 1.15)}" fill="${c}"/></g>`;
    });
    return wrap('compare', svg(W, 158, `<line class="mv-ground" x1="0" y1="150" x2="${W}" y2="150"/>${body.join('')}`));
  }
  if (v.mode === 'holds') {
    const n = items.length;
    const W = Math.max(110, n * 110);
    const body = items.map((it, i) => {
      const cx = (W / n) * (i + 0.5);
      const w = 34 + it.size * 60;
      const h = 40 + it.size * 90;
      const c = col(it.color, 'blue');
      const top = 150 - h;
      return `<g class="${it.hl ? 'mv-hl' : ''}"><path class="mv-water" d="M${r1(cx - w / 2 + 3)},${r1(top + h * 0.3)} L${r1(cx + w / 2 - 3)},${r1(top + h * 0.3)} L${r1(cx + w / 2 - 3)},147 L${r1(cx - w / 2 + 3)},147 Z"/><path class="mv-jar" d="M${r1(cx - w / 2)},${r1(top)} L${r1(cx - w / 2)},146 Q${r1(cx - w / 2)},150 ${r1(cx - w / 2 + 4)},150 L${r1(cx + w / 2 - 4)},150 Q${r1(cx + w / 2)},150 ${r1(cx + w / 2)},146 L${r1(cx + w / 2)},${r1(top)}" style="stroke:${c}"/></g>`;
    });
    return wrap('compare', svg(W, 158, body.join('')));
  }
  // heavy: emoji drawn larger for heavier
  return wrap('compare', `<div class="mv-heavy">${items.map((it) => `<span style="font-size:${r1(30 + it.size * 40)}px">${it.e ?? '⚫'}</span>`).join('')}</div>`);
}

function seesawSvg(v: Extract<MathVisual, { kind: 'seesaw' }>): string {
  const ang = v.tip * 12;
  const L = polar([150, 96], 120, 180 - ang);
  const R = polar([150, 96], 120, -ang);
  const body = `<polygon class="mv-pivot" points="150,96 130,140 170,140"/><g class="mv-plank"><line class="mv-board" x1="${r1(L[0])}" y1="${r1(L[1])}" x2="${r1(R[0])}" y2="${r1(R[1])}"/></g>
    <text x="${r1(L[0] + 18)}" y="${r1(L[1] - 8)}" class="mv-em" text-anchor="middle">${v.left}</text><text x="${r1(R[0] - 18)}" y="${r1(R[1] - 8)}" class="mv-em" text-anchor="middle">${v.right}</text><line class="mv-ground" x1="20" y1="140" x2="280" y2="140"/>`;
  return wrap('seesaw', svg(300, 146, body));
}

// ── Position, strips, rows ────────────────────────────────────────────────

function whereSvg(v: Extract<MathVisual, { kind: 'where' }>): string {
  let ref = '';
  if (v.ref === 'table') ref = `<rect class="mv-wood" x="60" y="74" width="120" height="14" rx="4"/><rect class="mv-wood" x="70" y="88" width="10" height="56"/><rect class="mv-wood" x="160" y="88" width="10" height="56"/>`;
  else if (v.ref === 'chair') ref = `<rect class="mv-wood" x="90" y="30" width="10" height="70"/><rect class="mv-wood" x="90" y="92" width="70" height="12" rx="3"/><rect class="mv-wood" x="92" y="104" width="9" height="40"/><rect class="mv-wood" x="150" y="104" width="9" height="40"/>`;
  else ref = `<path class="mv-box" d="M66,70 L174,70 L174,144 L66,144 Z"/><path class="mv-boxflap" d="M66,70 L48,52 M174,70 L192,52"/>`;
  const at: Record<string, Pt> = v.ref === 'box'
    ? { on: [120, 60], under: [120, 160], beside: [210, 140], in: [120, 124] }
    : v.ref === 'chair' ? { on: [125, 86], under: [126, 142], beside: [205, 142], in: [125, 86] }
      : { on: [120, 66], under: [120, 142], beside: [215, 142], in: [120, 66] };
  const p = at[v.pos];
  const body = `<line class="mv-ground" x1="10" y1="146" x2="250" y2="146"/>${v.pos === 'in' && v.ref === 'box' ? `<text x="${p[0]}" y="${p[1]}" class="mv-em" text-anchor="middle">${v.thing}</text>${ref}` : `${ref}<text x="${p[0]}" y="${p[1]}" class="mv-em" text-anchor="middle">${v.thing}</text>`}`;
  return wrap('where', svg(260, v.pos === 'under' && v.ref === 'box' ? 168 : 152, body));
}

function stripSvg(v: Extract<MathVisual, { kind: 'strip' }>): string {
  const n = v.cells.length;
  const per = n > 8 ? Math.ceil(n / Math.ceil(n / 7)) : n;
  const rows = Math.ceil(n / per);
  const cw = Math.min(62, 320 / per);
  const W = per * cw + 8;
  const rh = 58;
  const pos = (i: number): Pt => [4 + (i % per) * cw + cw / 2, 30 + Math.floor(i / per) * rh];
  const long = v.cells.some((c) => c.length > 3);
  let b = v.cells.map((c, i) => {
    const [x, y] = pos(i);
    return `<g class="${i === v.hl ? 'mv-on' : ''}${i === v.to ? ' mv-target mv-pop' : ''}" style="--d:${Math.abs((v.to ?? 0) - (v.hl ?? 0)) * 200}ms"><rect class="mv-cell" x="${r1(x - cw / 2 + 2)}" y="${y - 2}" width="${r1(cw - 4)}" height="40" rx="10"/>${txt(x, y + 23, c, long ? 'mv-t mv-small' : 'mv-t')}</g>`;
  }).join('');
  if (v.hl !== undefined && v.to !== undefined) {
    const a = v.hl, z = v.to;
    const step = z > a ? 1 : -1;
    const hops = Math.abs(z - a);
    for (let k = 0; k < hops; k++) {
      const p0 = pos(a + k * step), p1 = pos(a + (k + 1) * step);
      const lift = p0[1] === p1[1] ? 16 : 6;
      b += `<path class="mv-hop mv-draw" pathLength="1" style="--d:${k * 200}ms" d="M${r1(p0[0])},${p0[1] - 4} Q${r1((p0[0] + p1[0]) / 2)},${Math.min(p0[1], p1[1]) - 4 - lift} ${r1(p1[0])},${p1[1] - 4}"/>`;
    }
  }
  return wrap('strip', svg(W, 30 + (rows - 1) * rh + 46, b));
}

// ── Measuring ─────────────────────────────────────────────────────────────

function objectShape(kind: string, x: number, y: number, len: number, color: string): string {
  if (kind === 'ribbon') return `<path class="mv-ribbon" d="M${x},${y} L${r1(x + len)},${y} L${r1(x + len - 6)},${y + 9} L${r1(x + len)},${y + 18} L${x},${y + 18} L${x + 6},${y + 9} Z" fill="${color}"/>`;
  if (kind === 'leaf') return `<path class="mv-leaf" d="M${x},${y + 9} Q${r1(x + len / 2)},${y - 10} ${r1(x + len)},${y + 9} Q${r1(x + len / 2)},${y + 28} ${x},${y + 9} Z" fill="#2ED47A"/><line class="mv-vein" x1="${x}" y1="${y + 9}" x2="${r1(x + len)}" y2="${y + 9}"/>`;
  if (kind === 'key') return `<circle class="mv-key" cx="${x + 10}" cy="${y + 9}" r="10" fill="#FFC531"/><rect class="mv-key" x="${x + 18}" y="${y + 6}" width="${r1(len - 18)}" height="6" fill="#FFC531"/><rect x="${r1(x + len - 10)}" y="${y + 12}" width="4" height="6" fill="#FFC531" class="mv-key"/>`;
  if (kind === 'spoon') return `<ellipse class="mv-spoon" cx="${r1(x + len - 13)}" cy="${y + 9}" rx="13" ry="9" fill="#C9CEDC"/><rect class="mv-spoon" x="${x}" y="${y + 6}" width="${r1(len - 24)}" height="6" rx="3" fill="#C9CEDC"/>`;
  // pencil / crayon
  const tip = kind === 'crayon' ? 12 : 18;
  return `<rect class="mv-pencil" x="${x}" y="${y}" width="${r1(len - tip)}" height="18" rx="3" fill="${color}"/><polygon class="mv-pencil-tip" points="${r1(x + len - tip)},${y} ${r1(x + len)},${y + 9} ${r1(x + len - tip)},${y + 18}"/>${kind === 'pencil' ? `<polygon fill="#3A3A4A" points="${r1(x + len - 6)},${y + 6} ${r1(x + len)},${y + 9} ${r1(x + len - 6)},${y + 12}"/>` : ''}`;
}

function cubesSvg(v: Extract<MathVisual, { kind: 'cubes' }>): string {
  const u = Math.min(30, 300 / v.len);
  const W = v.len * u + 20;
  let b = objectShape(v.obj, 10, 10, v.len * u, PAL.orange);
  for (let i = 0; i < v.len; i++) {
    b += `<g class="${v.count ? 'mv-pop' : ''}" style="--d:${i * 160}ms"><rect class="mv-cube" x="${r1(10 + i * u)}" y="40" width="${r1(u)}" height="${r1(u)}" fill="${i % 2 ? PAL.blue : PAL.teal}"/>${v.count ? txt(10 + i * u + u / 2, 40 + u / 2 + 5, String(i + 1), 'mv-t mv-small mv-onfill') : ''}</g>`;
  }
  return wrap('cubes', svg(W, 48 + u, b));
}

function rulerSvg(v: Extract<MathVisual, { kind: 'ruler' }>): string {
  const W = 330;
  const x0 = 16;
  const u = (W - 2 * x0) / v.max;
  const n = v.items.length;
  const top = 8 + n * 28;
  let b = '';
  v.items.forEach((it, i) => {
    b += `<g class="${v.hl === i ? 'mv-hl' : ''}">${objectShape(it.name ?? 'pencil', x0 + it.from * u, 8 + i * 28, (it.to - it.from) * u, col(it.color, 'orange'))}</g>`;
    b += `<line class="mv-guide" x1="${r1(x0 + it.to * u)}" y1="${8 + i * 28}" x2="${r1(x0 + it.to * u)}" y2="${top + 10}"/>`;
    if (it.from > 0) b += `<line class="mv-guide" x1="${r1(x0 + it.from * u)}" y1="${8 + i * 28}" x2="${r1(x0 + it.from * u)}" y2="${top + 10}"/>`;
  });
  b += `<rect class="mv-ruler" x="4" y="${top}" width="${W - 8}" height="44" rx="6"/>`;
  const label = v.max <= 20 ? 1 : v.max <= 50 ? 5 : 10;
  for (let k = 0; k <= v.max; k++) {
    const x = x0 + k * u;
    const big = k % label === 0;
    b += `<line class="mv-tick" x1="${r1(x)}" y1="${top}" x2="${r1(x)}" y2="${top + (big ? 16 : 10)}"/>`;
    if (v.max <= 15 && k < v.max) b += `<line class="mv-tick mv-mm" x1="${r1(x + u / 2)}" y1="${top}" x2="${r1(x + u / 2)}" y2="${top + 6}"/>`;
    if (big) b += txt(x, top + 31, String(k), u < 24 ? 'mv-t mv-tiny mv-rn' : 'mv-t mv-small');
  }
  b += txt(W - 8, top + 42, v.unit ?? 'cm', 'mv-t mv-tiny', 'end');
  if (v.gap && n >= 2) {
    const a = Math.min(v.items[0].to, v.items[1].to);
    const z = Math.max(v.items[0].to, v.items[1].to);
    b += `<rect class="mv-gapbar mv-pop" x="${r1(x0 + a * u)}" y="${top - 6}" width="${r1((z - a) * u)}" height="6" rx="3"/>`;
  }
  if (v.count !== undefined && n) {
    const it = v.items[0];
    for (let k = 0; k < v.count; k++) {
      const xa = x0 + (it.from + k) * u;
      b += `<path class="mv-hop mv-draw" pathLength="1" style="--d:${k * 140}ms" d="M${r1(xa)},${top} Q${r1(xa + u / 2)},${top - 14} ${r1(xa + u)},${top}"/>`;
    }
  }
  return wrap('ruler', svg(W, top + 50, b));
}

function scaleSvg(v: Extract<MathVisual, { kind: 'scale' }>): string {
  const W = 330;
  const x0 = 22;
  const span = v.to - v.from;
  const x = (val: number) => x0 + ((val - v.from) / span) * (W - 2 * x0);
  let b = `<line class="mv-axis" x1="${x0 - 6}" y1="60" x2="${W - x0 + 6}" y2="60"/>`;
  for (let k = v.from; k <= v.to + 1e-9; k += v.step) {
    const big = Math.abs(((k - v.from) / v.every) - Math.round((k - v.from) / v.every)) < 1e-9;
    b += `<line class="mv-tick" x1="${r1(x(k))}" y1="${big ? 48 : 52}" x2="${r1(x(k))}" y2="${big ? 72 : 68}"/>`;
    if (big) b += txt(x(k), 92, String(Math.round(k * 100) / 100), 'mv-t mv-small');
  }
  if (v.unit) b += txt(W - 6, 112, v.unit, 'mv-t mv-tiny', 'end');
  if (v.value !== undefined) b += `<g class="mv-move" style="--dx:${r1(x(v.from) - x(v.value))}px"><polygon class="mv-pointer" points="${r1(x(v.value))},46 ${r1(x(v.value) - 9)},26 ${r1(x(v.value) + 9)},26"/></g>`;
  if (v.count && v.value !== undefined) {
    const base = v.from + Math.floor((v.value - v.from) / v.every) * v.every;
    const n = Math.round((v.value - base) / v.step);
    for (let k = 0; k < n; k++) b += `<path class="mv-hop mv-draw" pathLength="1" style="--d:${k * 180}ms" d="M${r1(x(base + k * v.step))},${44} Q${r1(x(base + (k + 0.5) * v.step))},30 ${r1(x(base + (k + 1) * v.step))},44"/>`;
  }
  return wrap('scale', svg(W, 118, b));
}

function thermoSvg(v: Extract<MathVisual, { kind: 'thermo' }>): string {
  const y = (t: number) => 170 - ((t - v.min) / (v.max - v.min)) * 150;
  let b = `<rect class="mv-tube" x="44" y="12" width="22" height="168" rx="11"/><circle class="mv-bulb" cx="55" cy="186" r="16"/><rect class="mv-mercury" x="50" y="${r1(y(v.v))}" width="12" height="${r1(186 - y(v.v))}" rx="6"/>`;
  for (let t = v.min; t <= v.max; t += v.step) b += `<line class="mv-tick" x1="70" y1="${r1(y(t))}" x2="80" y2="${r1(y(t))}"/>${txt(86, y(t) + 5, `${t}°`, 'mv-t mv-small', 'start')}`;
  return wrap('thermo', svg(140, 206, b));
}

function jugsSvg(v: Extract<MathVisual, { kind: 'jugs' }>): string {
  const n = v.jugs.length;
  const W = n * 120;
  const marks = v.marks ?? 4;
  const body = v.jugs.map((j, i) => {
    const cx = 60 + i * 120;
    const top = 26, bot = 160;
    const h = bot - top;
    const lvl = bot - (j.fill / j.cap) * h;
    let s = `<rect class="mv-water mv-fill" x="${cx - 34}" y="${r1(lvl)}" width="68" height="${r1(bot - lvl)}" style="--h:${r1(bot - lvl)}px"/><path class="mv-jar" d="M${cx - 36},${top} L${cx - 36},${bot} L${cx + 36},${bot} L${cx + 36},${top}"/><path class="mv-jar" d="M${cx + 36},50 q20,4 18,34 q-2,24 -18,28" fill="none"/>`;
    for (let k = 1; k <= marks; k++) {
      const yy = bot - (k / marks) * h;
      s += `<line class="mv-tick" x1="${cx - 36}" y1="${r1(yy)}" x2="${cx - 24}" y2="${r1(yy)}"/>${txt(cx - 20, yy + 4, `${Math.round((j.cap * k) / marks)}`, 'mv-t mv-tiny', 'start')}`;
    }
    if (j.label) s += txt(cx, 182, j.label, 'mv-t mv-small');
    return s;
  }).join('');
  return wrap('jugs', svg(W, 190, body + (v.unit ? txt(W - 4, 18, v.unit, 'mv-t mv-tiny', 'end') : '')));
}

// ── Clock and calendar ────────────────────────────────────────────────────

function clockSvg(v: Extract<MathVisual, { kind: 'clock' }>): string {
  const c: Pt = [120, 120];
  const R = 92;
  let b = `<circle class="mv-clockface" cx="120" cy="120" r="${R}"/>`;
  if (v.sweep) {
    const [a, z] = v.sweep;
    if (z !== a) b += `<path class="mv-sweep mv-pop" d="${sector(c, R - 6, 90 - z * 6, 90 - a * 6)}"/>`;
  }
  for (let k = 0; k < 60; k++) {
    const big = k % 5 === 0;
    const p0 = polar(c, R - (big ? 12 : 6), 90 - k * 6);
    const p1 = polar(c, R - 2, 90 - k * 6);
    b += `<line class="mv-tick${big ? '' : ' mv-mm'}" x1="${r1(p0[0])}" y1="${r1(p0[1])}" x2="${r1(p1[0])}" y2="${r1(p1[1])}"/>`;
  }
  for (let k = 1; k <= 12; k++) {
    const p = polar(c, R - 28, 90 - k * 30);
    b += txt(p[0], p[1] + 8, String(k), 'mv-t mv-clocknum');
  }
  if (v.fives) for (let k = 1; k <= 12; k++) {
    const p = polar(c, R + 14, 90 - k * 30);
    b += `<g class="mv-pop" style="--d:${k * 90}ms">${txt(p[0], p[1] + 5, String((k * 5) % 60 === 0 ? '00' : (k * 5) % 60), 'mv-t mv-five')}</g>`;
  }
  const hourDeg = ((v.h % 12) + v.m / 60) * 30;
  const minDeg = v.m * 6;
  const fromDeg = v.sweep ? v.sweep[0] * 6 : minDeg;
  const fromHour = v.sweep ? ((v.h % 12) + v.sweep[0] / 60) * 30 - (v.sweep[0] > v.m ? 30 : 0) : hourDeg;
  b += `<g class="mv-hand-h${v.hl === 'hour' ? ' hl' : ''}${v.sweep ? ' mv-rot' : ''}" style="--from:${r1(fromHour - hourDeg)}deg;transform-origin:120px 120px"><line x1="120" y1="120" x2="${r1(polar(c, 50, 90 - hourDeg)[0])}" y2="${r1(polar(c, 50, 90 - hourDeg)[1])}"/></g>`;
  b += `<g class="mv-hand-m${v.hl === 'min' ? ' hl' : ''}${v.sweep ? ' mv-rot' : ''}" style="--from:${r1(fromDeg - minDeg)}deg;transform-origin:120px 120px"><line x1="120" y1="120" x2="${r1(polar(c, 76, 90 - minDeg)[0])}" y2="${r1(polar(c, 76, 90 - minDeg)[1])}"/></g>`;
  b += `<circle class="mv-pin" cx="120" cy="120" r="6"/>`;
  if (v.ampm) b += `<text x="214" y="34" class="mv-em mv-ampm" text-anchor="middle">${v.ampm === 'am' ? '🌅' : '🌙'}</text>`;
  const clock = svg(240, 240, b, 'mv-clock');
  return wrap('clock', v.digital ? `${clock}<div class="mv-digi">${esc(v.digital)}</div>` : clock);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function calendarSvg(v: Extract<MathVisual, { kind: 'calendar' }>): string {
  const first = new Date(Date.UTC(v.year, v.month, 1)).getUTCDay();
  const n = daysInMonth(v.year, v.month);
  const rows = Math.ceil((first + n) / 7);
  const cw = 38;
  const W = 7 * cw + 12;
  let b = txt(W / 2, 22, `${MONTHS[v.month]} ${v.year}`, 'mv-t mv-calhead');
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => (b += txt(6 + i * cw + cw / 2, 46, d, 'mv-t mv-tiny')));
  const at = (d: number): Pt => {
    const k = first + d - 1;
    return [6 + (k % 7) * cw + cw / 2, 58 + Math.floor(k / 7) * 32 + 16];
  };
  for (let d = 1; d <= n; d++) {
    const [x, y] = at(d);
    const on = v.hl?.includes(d);
    b += `<g class="${on ? 'mv-on' : ''}${d === v.ring ? ' mv-target' : ''}"><rect class="mv-cell" x="${r1(x - cw / 2 + 2)}" y="${r1(y - 14)}" width="${cw - 4}" height="28" rx="8"/>${txt(x, y + 5, String(d), 'mv-t mv-small')}</g>`;
  }
  if (v.hop) for (let k = 0; k + 1 < v.hop.length; k++) {
    const a = at(v.hop[k]);
    const z = at(v.hop[k + 1]);
    b += `<path class="mv-hop mv-draw" pathLength="1" style="--d:${k * 260}ms" d="M${r1(a[0] + 12)},${r1(a[1] - 6)} Q${r1(a[0] + 30)},${r1((a[1] + z[1]) / 2)} ${r1(z[0] + 12)},${r1(z[1] + 6)}"/>`;
  }
  return wrap('calendar', svg(W, 58 + rows * 32 + 6, b));
}

function fistSvg(v: Extract<MathVisual, { kind: 'fist' }>): string {
  // Knuckles (31 days) and the dips between them (30, or February). Say Jan…Jul along the
  // knuckles and dips, then start again at the first knuckle with Aug…Dec.
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const x = (k: number) => 34 + k * 42;
  let wave = `M14,70`;
  for (let k = 0; k < 7; k++) wave += ` Q${x(k)},${k % 2 ? 78 : 18} ${x(k) + 21},${k % 2 ? 60 : 50}`;
  let b = `<path class="mv-fist" d="${wave} L320,60 L320,150 L14,150 Z"/>`;
  short.forEach((m, i) => {
    const k = i < 7 ? i : i - 7;
    const knuckle = k % 2 === 0;
    const y = i < 7 ? (knuckle ? 26 : 56) : (knuckle ? 98 : 120);
    b += `<g class="${v.hl === i ? 'mv-on' : ''}">${v.hl === i ? `<circle class="mv-fistring" cx="${x(k)}" cy="${y - 5}" r="17"/>` : ''}${txt(x(k), y, m, `mv-t mv-small${knuckle ? ' mv-k' : ''}`)}</g>`;
  });
  b += txt(167, 144, 'knuckle: 31 days · dip: 30 (February 28 or 29)', 'mv-t mv-tiny');
  return wrap('fist', svg(334, 152, b));
}

// ── Grids, nets, mirror pictures ──────────────────────────────────────────

function cellsSvg(v: Extract<MathVisual, { kind: 'cells' }>): string {
  const u = Math.min(30, 300 / v.w, 220 / v.h);
  const W = v.w * u + 8;
  const H = v.h * u + 8;
  let b = '';
  for (let x = 0; x <= v.w; x++) b += `<line class="mv-grid" x1="${r1(4 + x * u)}" y1="4" x2="${r1(4 + x * u)}" y2="${r1(4 + v.h * u)}"/>`;
  for (let y = 0; y <= v.h; y++) b += `<line class="mv-grid" x1="4" y1="${r1(4 + y * u)}" x2="${r1(4 + v.w * u)}" y2="${r1(4 + y * u)}"/>`;
  const sorted = [...v.on].sort((a, b2) => a[1] - b2[1] || a[0] - b2[0]);
  sorted.forEach(([x, y], k) => {
    b += `<g class="${v.count ? 'mv-pop' : ''}" style="--d:${k * 110}ms"><rect class="mv-cellon" x="${r1(4 + x * u + 1)}" y="${r1(4 + y * u + 1)}" width="${r1(u - 2)}" height="${r1(u - 2)}" rx="3" fill="${col(v.color, 'teal')}"/>${v.count ? txt(4 + x * u + u / 2, 4 + y * u + u / 2 + 4, String(k + 1), 'mv-t mv-tiny mv-onfill') : ''}</g>`;
  });
  (v.ghost ?? []).forEach(([x, y], k) => (b += `<g class="mv-pop" style="--d:${k * 90}ms"><rect class="mv-ghost" x="${r1(4 + x * u + 2)}" y="${r1(4 + y * u + 2)}" width="${r1(u - 4)}" height="${r1(u - 4)}" rx="3"/></g>`));
  if (v.mirror?.x !== undefined) b += `<line class="mv-mirror" x1="${r1(4 + v.mirror.x * u)}" y1="0" x2="${r1(4 + v.mirror.x * u)}" y2="${H}"/>`;
  if (v.mirror?.y !== undefined) b += `<line class="mv-mirror" x1="0" y1="${r1(4 + v.mirror.y * u)}" x2="${W}" y2="${r1(4 + v.mirror.y * u)}"/>`;
  return wrap('cells', svg(W, H, b));
}

function netSvg(v: Extract<MathVisual, { kind: 'net' }>): string {
  const xs = v.cells.map((c) => c[0]);
  const ys = v.cells.map((c) => c[1]);
  const w = Math.max(...xs) + 1;
  const h = Math.max(...ys) + 1;
  const u = Math.min(28, 150 / Math.max(w, h));
  const body = v.cells.map(([x, y], k) => `<g class="${v.fold ? 'mv-pop' : ''}" style="--d:${k * 140}ms"><rect class="mv-netcell" x="${r1(4 + x * u)}" y="${r1(4 + y * u)}" width="${r1(u)}" height="${r1(u)}" fill="${PAL[SHAPE_COLORS[k % SHAPE_COLORS.length]]}"/>${v.fold ? txt(4 + x * u + u / 2, 4 + y * u + u / 2 + 4, String(k + 1), 'mv-t mv-tiny mv-onfill') : ''}</g>`).join('');
  return wrap('net', svg(w * u + 8, h * u + 8, body));
}

function gridmapSvg(v: Extract<MathVisual, { kind: 'gridmap' }>): string {
  const u = Math.min(52, 320 / v.w, 260 / v.h);
  const W = v.w * u + 8;
  const H = v.h * u + 8;
  let b = '';
  for (let x = 0; x < v.w; x++) for (let y = 0; y < v.h; y++) b += `<rect class="mv-tile${(x + y) % 2 ? ' alt' : ''}" x="${r1(4 + x * u)}" y="${r1(4 + y * u)}" width="${r1(u)}" height="${r1(u)}"/>`;
  const at = (p: Pt): Pt => [4 + p[0] * u + u / 2, 4 + (v.h - 1 - p[1]) * u + u / 2];
  if (v.path && v.path.length > 1) b += `<path class="mv-route mv-draw" pathLength="1" d="M${v.path.map((p) => P(at(p))).join(' L')}"/>`;
  for (const it of v.items) {
    const [x, y] = at(it.at);
    b += `<text x="${r1(x)}" y="${r1(y + u * 0.18)}" class="mv-em" style="font-size:${r1(u * 0.6)}px" text-anchor="middle">${it.e}</text>`;
  }
  const s = at(v.start);
  b += `<circle class="mv-start" cx="${r1(s[0])}" cy="${r1(s[1])}" r="${r1(u * 0.34)}"/><text x="${r1(s[0])}" y="${r1(s[1] + u * 0.14)}" class="mv-em" style="font-size:${r1(u * 0.42)}px" text-anchor="middle">🧒</text>`;
  return wrap('gridmap', svg(W, H, b));
}

function arrowSvg(v: Extract<MathVisual, { kind: 'arrow' }>): string {
  const arrow = (deg: number, cls: string, extra = '') => `<g class="${cls}" style="transform-origin:80px 80px;transform:rotate(${deg}deg)${extra}"><path d="M80,18 L118,62 L94,62 L94,132 L66,132 L66,62 L42,62 Z"/></g>`;
  let b = '';
  if (v.ghost) b += arrow(v.dir - (v.turn ?? 0), 'mv-arrow ghost');
  b += arrow(v.dir, `mv-arrow${v.ghost ? ' mv-rot' : ''}`, '');
  if (v.turn) {
    const t = Math.max(-359, Math.min(359, v.turn));
    const a0 = 90 - (v.dir - t);
    const a1 = 90 - v.dir;
    const path = t > 0 ? arcPath([80, 80], 72, a1, a0) : arcPath([80, 80], 72, a0, a1);
    b += `<path class="mv-turn mv-draw" pathLength="1" d="${path}"/>`;
  }
  return wrap('arrow', svg(160, 160, b).replace('<g class="mv-arrow mv-rot"', `<g class="mv-arrow mv-rot" data-from="${-(v.turn ?? 0)}"`).replace(/class="mv-arrow mv-rot" data-from="(-?\d+)" style="/, (_m, f) => `class="mv-arrow mv-rot" style="--from:${f}deg;`));
}

// ── Polygons with lengths ─────────────────────────────────────────────────

function polySvg(v: Extract<MathVisual, { kind: 'poly' }>): string {
  const xs = v.pts.map((p) => p[0]);
  const ys = v.pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const u = Math.min(260 / w, 170 / h, 40);
  const pad = 34;
  const W = w * u + 2 * pad;
  const H = h * u + 2 * pad;
  const at = (p: Pt): Pt => [pad + (p[0] - minX) * u, pad + (maxY - p[1]) * u];
  let b = '';
  if (v.grid) {
    for (let x = Math.floor(minX); x <= maxX; x++) b += `<line class="mv-grid" x1="${r1(at([x, 0])[0])}" y1="${pad - 6}" x2="${r1(at([x, 0])[0])}" y2="${r1(H - pad + 6)}"/>`;
    for (let y = Math.floor(minY); y <= maxY; y++) b += `<line class="mv-grid" x1="${pad - 6}" y1="${r1(at([0, y])[1])}" x2="${r1(W - pad + 6)}" y2="${r1(at([0, y])[1])}"/>`;
  }
  const d = `M${v.pts.map((p) => P(at(p))).join(' L')} Z`;
  b += `<path class="mv-polyfill" d="${d}"/>`;
  for (const rc of v.rects ?? []) {
    const a = at(rc.a), z = at(rc.b);
    b += `<rect class="mv-part t${rc.tone} mv-pop" x="${r1(Math.min(a[0], z[0]))}" y="${r1(Math.min(a[1], z[1]))}" width="${r1(Math.abs(z[0] - a[0]))}" height="${r1(Math.abs(z[1] - a[1]))}" style="--d:${rc.tone * 300}ms"/>`;
  }
  if (v.squares) {
    // Unit squares inside the outline, row by row (rectilinear shapes on whole numbers).
    let k = 0;
    for (let y = maxY - 1; y >= minY; y--) for (let x = minX; x < maxX; x++) {
      if (!inside([x + 0.5, y + 0.5], v.pts)) continue;
      const a = at([x, y + 1]);
      b += `<g class="mv-pop" style="--d:${k * 70}ms"><rect class="mv-unit" x="${r1(a[0] + 1.5)}" y="${r1(a[1] + 1.5)}" width="${r1(u - 3)}" height="${r1(u - 3)}" rx="2"/>${u >= 22 ? txt(a[0] + u / 2, a[1] + u / 2 + 4, String(k + 1), 'mv-t mv-tiny') : ''}</g>`;
      k++;
    }
  }
  b += `<path class="mv-outline${v.walk ? ' mv-draw slow' : ''}" pathLength="1" d="${d}"/>`;
  if (v.cut) b += `<line class="mv-cut mv-draw" pathLength="1" x1="${r1(at(v.cut[0])[0])}" y1="${r1(at(v.cut[0])[1])}" x2="${r1(at(v.cut[1])[0])}" y2="${r1(at(v.cut[1])[1])}"/>`;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  (v.labels ?? []).forEach((l, i) => {
    if (!l) return;
    const p = v.pts[i], q = v.pts[(i + 1) % v.pts.length];
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    // Push the label outwards along the side's normal (away from the shape's middle).
    let nx = -(q[1] - p[1]), ny = q[0] - p[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    if ((m[0] - cx) * nx + (m[1] - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const s = at(m);
    const o: Pt = [s[0] + nx * 22, s[1] - ny * 22];
    b += `<g class="${v.hl === i ? 'mv-hl' : ''}${v.walk ? ' mv-pop' : ''}" style="--d:${i * 280}ms">${txt(o[0], o[1] + 5, l + (v.unit && /\d$/.test(l) ? ` ${v.unit}` : ''), 'mv-t mv-len')}</g>`;
  });
  return wrap('poly', svg(W, H, b));
}
function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ── Angles and lines ──────────────────────────────────────────────────────

function angleSvg(v: Extract<MathVisual, { kind: 'angle' }>): string {
  const rot = v.rot ?? 0;
  const c: Pt = [v.deg > 180 ? 120 : v.deg > 100 ? 140 : 50, v.deg > 180 ? 96 : 130];
  const L = v.deg > 180 ? 86 : 120;
  const a = polar(c, L, rot);
  const z = polar(c, L, rot + v.deg);
  let b = '';
  if (v.ref) {
    const rr = polar(c, L * 0.9, rot + 90);
    b += `<line class="mv-refarm" x1="${r1(c[0])}" y1="${r1(c[1])}" x2="${r1(rr[0])}" y2="${r1(rr[1])}"/>`;
    const q1 = polar(c, 18, rot), q2 = polar(c, 18 * Math.SQRT2, rot + 45), q3 = polar(c, 18, rot + 90);
    b += `<path class="mv-refbox" d="M${P(q1)} L${P(q2)} L${P(q3)}"/>`;
  }
  if (Math.abs(v.deg - 90) < 0.01 && !v.ref) {
    const q1 = polar(c, 20, rot), q2 = polar(c, 20 * Math.SQRT2, rot + 45), q3 = polar(c, 20, rot + 90);
    b += `<path class="mv-rightbox" d="M${P(q1)} L${P(q2)} L${P(q3)}"/>`;
  } else b += `<path class="mv-anglearc${v.sweep ? ' mv-draw' : ''}" pathLength="1" d="${arcPath(c, 34, rot, rot + v.deg)}"/>`;
  b += `<line class="mv-arm" x1="${r1(c[0])}" y1="${r1(c[1])}" x2="${r1(a[0])}" y2="${r1(a[1])}"/>`;
  b += `<g class="${v.sweep ? 'mv-rot' : ''}" style="--from:${r1(v.deg)}deg;transform-origin:${r1(c[0])}px ${r1(c[1])}px"><line class="mv-arm" x1="${r1(c[0])}" y1="${r1(c[1])}" x2="${r1(z[0])}" y2="${r1(z[1])}"/></g>`;
  b += `<circle class="mv-vertex" cx="${r1(c[0])}" cy="${r1(c[1])}" r="5"/>`;
  if (v.label) {
    const p = polar(c, 56, rot + v.deg / 2);
    b += txt(p[0], p[1] + 6, v.label, 'mv-t mv-anglelabel');
  }
  return wrap('angle', svg(260, 170, b));
}

function linesSvg(v: Extract<MathVisual, { kind: 'lines' }>): string {
  const rot = v.rot ?? 0;
  let b = '';
  if (v.type === 'parallel') {
    b += `<line class="mv-arm" x1="20" y1="50" x2="180" y2="50"/><line class="mv-arm" x1="20" y1="110" x2="180" y2="110"/>`;
    if (v.marks) b += `<path class="mv-par" d="M95,43 L103,50 L95,57 M95,103 L103,110 L95,117"/>`;
  } else if (v.type === 'perp') {
    b += `<line class="mv-arm" x1="20" y1="120" x2="180" y2="120"/><line class="mv-arm" x1="100" y1="14" x2="100" y2="146"/>`;
    if (v.marks) b += `<path class="mv-rightbox" d="M100,102 L118,102 L118,120"/>`;
  } else b += `<line class="mv-arm" x1="20" y1="40" x2="180" y2="130"/><line class="mv-arm" x1="30" y1="140" x2="170" y2="30"/>`;
  return wrap('lines', svg(200, 160, `<g transform="rotate(${rot} 100 80)">${b}</g>`));
}

function protractorSvg(v: Extract<MathVisual, { kind: 'protractor' }>): string {
  const c: Pt = [150, 150];
  const R = 128;
  let b = `<path class="mv-protractor" d="M${150 - R - 8},150 A${R + 8},${R + 8} 0 0 1 ${150 + R + 8},150 Z"/>`;
  for (let k = 0; k <= 180; k += 5) {
    const big = k % 10 === 0;
    const p0 = polar(c, R - (big ? 14 : 7), k);
    const p1 = polar(c, R, k);
    b += `<line class="mv-tick" x1="${r1(p0[0])}" y1="${r1(p0[1])}" x2="${r1(p1[0])}" y2="${r1(p1[1])}"/>`;
    if (k % 30 === 0) {
      const t = polar(c, R - 28, k);
      b += txt(t[0], t[1] + 5, String(k), 'mv-t mv-tiny');
    }
  }
  const z = polar(c, R + 14, v.deg);
  b += `<line class="mv-arm" x1="150" y1="150" x2="${R + 164}" y2="150"/><g class="${v.read ? 'mv-rot' : ''}" style="--from:${v.deg}deg;transform-origin:150px 150px"><line class="mv-arm hl" x1="150" y1="150" x2="${r1(z[0])}" y2="${r1(z[1])}"/></g>`;
  b += `<path class="mv-anglearc${v.read ? ' mv-draw' : ''}" pathLength="1" d="${arcPath(c, 40, 0, v.deg)}"/><circle class="mv-vertex" cx="150" cy="150" r="5"/>`;
  return wrap('protractor', svg(300, 160, b));
}

function geoSvg(v: Extract<MathVisual, { kind: 'geo' }>): string {
  const s = Math.min(300 / v.w, 210 / v.h);
  const pad = 22;
  const W = v.w * s + 2 * pad;
  const H = v.h * s + 2 * pad;
  const at = (p: Pt): Pt => [pad + p[0] * s, pad + (v.h - p[1]) * s];
  let b = '';
  if (v.fill) b += `<polygon class="mv-geofill" points="${v.fill.map((p) => P(at(p))).join(' ')}"/>`;
  if (v.fill2) b += `<polygon class="mv-geofill2" points="${v.fill2.map((p) => P(at(p))).join(' ')}"/>`;
  for (const c of v.circles ?? []) b += `<circle class="mv-geocircle${c.style ? ' ' + c.style : ''}" cx="${r1(at(c.c)[0])}" cy="${r1(at(c.c)[1])}" r="${r1(c.r * s)}"/>`;
  for (const a of v.arcs ?? []) b += geoArc(a, at, s);
  for (const g of v.segs) b += geoSeg(g, at);
  for (const d of v.dots ?? []) b += `<circle class="mv-vertex" cx="${r1(at(d)[0])}" cy="${r1(at(d)[1])}" r="4.5"/>`;
  for (const l of v.labels ?? []) b += geoLabel(l, at);
  return wrap('geo', svg(W, H, b));
}
function geoSeg(g: GeoSeg, at: (p: Pt) => Pt): string {
  const a = at(g.a), z = at(g.b);
  let s = `<line class="mv-geoseg${g.style ? ' ' + g.style : ''}" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(z[0])}" y2="${r1(z[1])}"/>`;
  const ang = Math.atan2(z[1] - a[1], z[0] - a[0]);
  const m: Pt = [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2];
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  if (g.ticks) for (let k = 0; k < g.ticks; k++) {
    const o = (k - (g.ticks - 1) / 2) * 6;
    const cx = m[0] + Math.cos(ang) * o, cy = m[1] + Math.sin(ang) * o;
    s += `<line class="mv-geotick" x1="${r1(cx - nx * 7)}" y1="${r1(cy - ny * 7)}" x2="${r1(cx + nx * 7)}" y2="${r1(cy + ny * 7)}"/>`;
  }
  if (g.par) for (let k = 0; k < g.par; k++) {
    const o = k * 8;
    const tip: Pt = [m[0] + Math.cos(ang) * (o + 6), m[1] + Math.sin(ang) * (o + 6)];
    const back = (side: number): Pt => [tip[0] - Math.cos(ang) * 9 + nx * 6 * side, tip[1] - Math.sin(ang) * 9 + ny * 6 * side];
    s += `<path class="mv-par" d="M${P(back(1))} L${P(tip)} L${P(back(-1))}"/>`;
  }
  if (g.style === 'ray') {
    const back = (side: number): Pt => [z[0] - Math.cos(ang) * 12 + nx * 6 * side, z[1] - Math.sin(ang) * 12 + ny * 6 * side];
    s += `<path class="mv-par" d="M${P(back(1))} L${P(z)} L${P(back(-1))}"/>`;
  }
  return s;
}
function geoArc(a: GeoArc, at: (p: Pt) => Pt, s: number): string {
  const c = at(a.at);
  const r = a.r ? a.r * s : 26;
  let out = '';
  if (a.right) {
    const q1 = polar(c, 15, a.a0), q2 = polar(c, 15 * Math.SQRT2, a.a0 + 45), q3 = polar(c, 15, a.a0 + 90);
    out += `<path class="mv-rightbox" d="M${P(q1)} L${P(q2)} L${P(q3)}"/>`;
  } else out += `<path class="mv-geoarc${a.ask ? ' ask' : a.hl ? ' hl' : ''}" d="${sector(c, r, a.a0, a.a1)}"/>`;
  if (a.label) {
    let mid = (a.a0 + a.a1) / 2;
    if (a.a1 < a.a0) mid += 180;
    const p = polar(c, r + 15, mid);
    out += txt(p[0], p[1] + 5, a.label, `mv-t mv-anglelabel${a.ask ? ' ask' : ''}`);
  }
  return out;
}
function geoLabel(l: GeoLabel, at: (p: Pt) => Pt): string {
  const p = at(l.at);
  return txt(p[0], p[1] + 5, l.t, `mv-t ${l.small ? 'mv-small' : 'mv-len'}${l.ask ? ' ask' : l.hl ? ' hl' : ''}`);
}

// ── Coordinates ───────────────────────────────────────────────────────────

function coordSvg(v: Extract<MathVisual, { kind: 'coord' }>): string {
  const n = v.max - v.min;
  const u = Math.min(28, 270 / n);
  const pad = 26;
  const W = n * u + 2 * pad;
  const at = (p: Pt): Pt => [pad + (p[0] - v.min) * u, pad + (v.max - p[1]) * u];
  let b = '';
  for (let k = v.min; k <= v.max; k++) {
    const [x] = at([k, 0]);
    const [, y] = at([0, k]);
    b += `<line class="mv-grid" x1="${r1(x)}" y1="${pad}" x2="${r1(x)}" y2="${r1(W - pad)}"/><line class="mv-grid" x1="${pad}" y1="${r1(y)}" x2="${r1(W - pad)}" y2="${r1(y)}"/>`;
  }
  const o = at([0, 0]);
  b += `<line class="mv-axis${v.mirror === 'x' ? ' hl' : ''}" x1="${pad - 6}" y1="${r1(o[1])}" x2="${r1(W - pad + 8)}" y2="${r1(o[1])}"/><line class="mv-axis${v.mirror === 'y' ? ' hl' : ''}" x1="${r1(o[0])}" y1="${r1(W - pad + 6)}" x2="${r1(o[0])}" y2="${pad - 8}"/>`;
  const every = n > 12 ? 2 : 1;
  for (let k = v.min; k <= v.max; k += every) {
    if (k === 0) continue;
    b += txt(at([k, 0])[0], o[1] + 15, String(k).replace('-', '−'), 'mv-t mv-tiny');
    b += txt(o[0] - 7, at([0, k])[1] + 4, String(k).replace('-', '−'), 'mv-t mv-tiny', 'end');
  }
  b += txt(o[0] - 7, o[1] + 15, '0', 'mv-t mv-tiny', 'end') + txt(W - pad + 12, o[1] - 6, 'x', 'mv-t mv-small') + txt(o[0] + 10, pad - 8, 'y', 'mv-t mv-small');
  if (v.line) {
    const ys = (x: number) => v.line!.m * x + v.line!.c;
    let x0 = v.min, x1 = v.max;
    const clip = (x: number) => Math.max(v.min, Math.min(v.max, x));
    if (v.line.m !== 0) {
      const xa = (v.min - v.line.c) / v.line.m, xb = (v.max - v.line.c) / v.line.m;
      x0 = clip(Math.min(xa, xb)); x1 = clip(Math.max(xa, xb));
    }
    b += `<line class="mv-gline mv-draw" pathLength="1" x1="${r1(at([x0, ys(x0)])[0])}" y1="${r1(at([x0, ys(x0)])[1])}" x2="${r1(at([x1, ys(x1)])[0])}" y2="${r1(at([x1, ys(x1)])[1])}"/>`;
  }
  if (v.poly) b += `<polygon class="mv-cpoly" points="${v.poly.map((p) => P(at(p))).join(' ')}"/>`;
  if (v.poly2) b += `<polygon class="mv-cpoly2 mv-pop" points="${v.poly2.map((p) => P(at(p))).join(' ')}"/>`;
  if (v.tri) b += `<path class="mv-ctri mv-draw" pathLength="1" d="M${P(at(v.tri[0]))} L${P(at(v.tri[1]))} L${P(at(v.tri[2]))}"/>`;
  if (v.seg) b += `<line class="mv-gline" x1="${r1(at(v.seg[0])[0])}" y1="${r1(at(v.seg[0])[1])}" x2="${r1(at(v.seg[1])[0])}" y2="${r1(at(v.seg[1])[1])}"/>`;
  if (v.walk) {
    const a = at([0, 0]), m = at([v.walk[0], 0]), z = at(v.walk);
    b += `<path class="mv-route mv-draw slow" pathLength="1" d="M${P(a)} L${P(m)} L${P(z)}"/>`;
  }
  for (const p of v.pts ?? []) {
    const [x, y] = at(p.at);
    if (p.e) b += `<text x="${r1(x)}" y="${r1(y + 8)}" class="mv-em${p.ghost ? ' ghost' : ''}" style="font-size:22px" text-anchor="middle">${p.e}</text>`;
    else b += `<circle class="mv-cpt${p.ghost ? ' ghost' : ''}${p.hl ? ' hl mv-pop' : ''}" cx="${r1(x)}" cy="${r1(y)}" r="6"/>`;
    if (p.label) b += txt(x + 10, y - 9, p.label, 'mv-t mv-small', 'start');
  }
  return wrap('coord', svg(W + 10, W, b));
}

// ── Data ──────────────────────────────────────────────────────────────────

function tallySvg(v: Extract<MathVisual, { kind: 'tally' }>): string {
  const groups = Math.ceil(v.n / 5);
  const gw = 62;
  let b = '';
  for (let g = 0; g < groups; g++) {
    const inG = Math.min(5, v.n - g * 5);
    const x0 = 12 + g * gw;
    for (let k = 0; k < Math.min(4, inG); k++) b += `<line class="mv-tallyline" x1="${x0 + k * 11}" y1="14" x2="${x0 + k * 11}" y2="74"/>`;
    if (inG === 5) b += `<line class="mv-tallyline slash" x1="${x0 - 8}" y1="66" x2="${x0 + 42}" y2="22"/>`;
    if (v.groups) b += `<g class="mv-pop" style="--d:${g * 250}ms">${txt(x0 + 16, 98, String(inG), 'mv-t mv-small')}</g>`;
  }
  return wrap('tally', svg(groups * gw + 16, v.groups ? 106 : 86, b));
}

function picgraphHtml(v: Extract<MathVisual, { kind: 'picgraph' }>): string {
  const rows = v.rows.map((r, i) => {
    const whole = Math.floor(r.n);
    const half = r.n - whole >= 0.5;
    const icons = Array.from({ length: whole }, () => `<i>${r.e}</i>`).join('') + (half ? `<i class="half">${r.e}</i>` : '');
    return `<div class="mv-pgrow${v.hl?.includes(i) ? ' on' : ''}"><span>${esc(r.label)}</span><b>${icons}</b></div>`;
  }).join('');
  const key = v.key ? `<p class="mv-key">Each ${v.rows[0]?.e ?? '•'} = ${v.key}</p>` : '';
  return wrap('picgraph', `<div class="mv-pg">${rows}</div>${key}`);
}

function barsSvg(v: Extract<MathVisual, { kind: 'bars' }>): string {
  const n = v.bars.length;
  const left = 34, top = 12, H = 150, bw = Math.min(46, 250 / n - 10);
  const W = left + n * (bw + 14) + 12;
  const y = (val: number) => top + H - (val / v.max) * H;
  let b = '';
  for (let k = 0; k <= v.max + 1e-9; k += v.step) b += `<line class="mv-grid" x1="${left}" y1="${r1(y(k))}" x2="${W - 6}" y2="${r1(y(k))}"/>${txt(left - 6, y(k) + 4, String(k), 'mv-t mv-tiny', 'end')}`;
  v.bars.forEach((bar, i) => {
    const x = left + 8 + i * (bw + 14);
    b += `<rect class="mv-bar${v.hl?.includes(i) ? ' hl' : ''}" x="${r1(x)}" y="${r1(y(bar.v))}" width="${r1(bw)}" height="${r1(top + H - y(bar.v))}" rx="4" fill="${PAL[SHAPE_COLORS[i % SHAPE_COLORS.length]]}"/>`;
    b += txt(x + bw / 2, top + H + 16, bar.label, 'mv-t mv-tiny');
    if (v.read === i) b += `<line class="mv-readline mv-draw" pathLength="1" x1="${r1(x + bw / 2)}" y1="${r1(y(bar.v))}" x2="${left}" y2="${r1(y(bar.v))}"/>`;
  });
  b += `<line class="mv-axis" x1="${left}" y1="${top + H}" x2="${W - 6}" y2="${top + H}"/><line class="mv-axis" x1="${left}" y1="${top - 4}" x2="${left}" y2="${top + H}"/>`;
  if (v.unit) b += txt(4, 8, v.unit, 'mv-t mv-tiny', 'start');
  return wrap('bars', svg(W, top + H + 24, b));
}

function linegSvg(v: Extract<MathVisual, { kind: 'lineg' }>): string {
  const n = v.pts.length;
  const min = v.min ?? 0;
  const left = 36, top = 14, H = 150, gap = Math.min(52, 260 / (n - 1 || 1));
  const W = left + (n - 1) * gap + 30;
  const y = (val: number) => top + H - ((val - min) / (v.max - min)) * H;
  let b = '';
  for (let k = min; k <= v.max + 1e-9; k += v.step) b += `<line class="mv-grid" x1="${left}" y1="${r1(y(k))}" x2="${W - 6}" y2="${r1(y(k))}"/>${txt(left - 6, y(k) + 4, String(k), 'mv-t mv-tiny', 'end')}`;
  const pts = v.pts.map((p, i): Pt => [left + 12 + i * gap, y(p.v)]);
  b += `<path class="mv-gline" d="M${pts.map(P).join(' L')}"/>`;
  v.pts.forEach((p, i) => {
    b += `<circle class="mv-cpt${v.hl === i ? ' hl' : ''}" cx="${r1(pts[i][0])}" cy="${r1(pts[i][1])}" r="5"/>${txt(pts[i][0], top + H + 16, p.label, 'mv-t mv-tiny')}`;
    if (v.hl === i) b += `<path class="mv-readline mv-draw" pathLength="1" d="M${r1(pts[i][0])},${top + H} L${r1(pts[i][0])},${r1(pts[i][1])} L${left},${r1(pts[i][1])}"/>`;
  });
  b += `<line class="mv-axis" x1="${left}" y1="${top + H}" x2="${W - 6}" y2="${top + H}"/><line class="mv-axis" x1="${left}" y1="${top - 4}" x2="${left}" y2="${top + H}"/>`;
  if (v.unit) b += txt(4, 10, v.unit, 'mv-t mv-tiny', 'start');
  return wrap('lineg', svg(W, top + H + 24, b));
}

function pieSvg(v: Extract<MathVisual, { kind: 'pie' }>): string {
  const c: Pt = [110, 110];
  let a = 90;
  let b = '';
  v.parts.forEach((p, i) => {
    const a1 = a - p.deg;
    b += `<path class="mv-slice${v.hl === i ? ' hl' : ''}${v.sweep && v.hl === i ? ' mv-pop' : ''}" d="${sector(c, 90, a1, a)}" fill="${PAL[SHAPE_COLORS[i % SHAPE_COLORS.length]]}"/>`;
    const m = polar(c, 58, a - p.deg / 2);
    b += txt(m[0], m[1] + 4, p.label, 'mv-t mv-tiny mv-onfill');
    a = a1;
  });
  return wrap('pie', svg(220, 220, b));
}

function tableHtml(v: Extract<MathVisual, { kind: 'table' }>): string {
  const hl = new Set((v.hl ?? []).map(([r, c]) => `${r},${c}`));
  return wrap('table', `${v.title ? `<p class="mv-ttl">${esc(v.title)}</p>` : ''}<table class="mv-tbl"><thead><tr>${v.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${v.rows.map((r, i) => `<tr>${r.map((c, j) => `<td class="${hl.has(`${i},${j}`) ? 'on' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
}

function bagSvg(v: Extract<MathVisual, { kind: 'bag' }>): string {
  if (v.spinner) {
    const n = v.balls.length;
    let b = '';
    v.balls.forEach((c, i) => (b += `<path class="mv-slice${v.hl === c ? ' hl' : ''}" d="${sector([90, 90], 76, 90 - ((i + 1) * 360) / n, 90 - (i * 360) / n)}" fill="${col(c)}"/>`));
    b += `<line class="mv-arm" x1="90" y1="90" x2="128" y2="44"/><circle class="mv-pin" cx="90" cy="90" r="7"/>`;
    return wrap('bag', svg(180, 180, b));
  }
  const n = v.balls.length;
  const per = Math.ceil(Math.sqrt(n * 1.4));
  let b = `<path class="mv-sack" d="M40,52 Q20,150 60,176 L180,176 Q220,150 200,52 Z"/><path class="mv-sacktop" d="M40,52 Q120,30 200,52"/>`;
  v.balls.forEach((c, i) => {
    const row = Math.floor(i / per), k = i % per;
    const x = 120 + (k - (per - 1) / 2) * 24 + (row % 2) * 6;
    const y = 160 - row * 22;
    b += `<circle class="mv-ball${v.hl === c ? ' hl' : ''}" cx="${r1(x)}" cy="${r1(y)}" r="10" fill="${col(c)}"/>`;
  });
  return wrap('bag', svg(240, 184, b));
}

function diceHtml(v: Extract<MathVisual, { kind: 'dice' }>): string {
  const pips: Record<number, Pt[]> = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };
  return wrap('dice', v.faces.map((f) => svg(64, 64, `<rect class="mv-die" x="3" y="3" width="58" height="58" rx="12"/>${(pips[f] ?? []).map(([x, y]) => `<circle class="mv-pip" cx="${x * 16}" cy="${y * 16}" r="5.5"/>`).join('')}`)).join(''));
}
function cardsHtml(v: Extract<MathVisual, { kind: 'cards' }>): string {
  return wrap('cards', v.cards.map((c) => `<span class="mv-card${/[♥♦]/.test(c) ? ' red' : ''}">${esc(c)}</span>`).join(''));
}

// ── 3-D boxes of cubes, cylinders and cones ───────────────────────────────

function cuboidSvg(v: Extract<MathVisual, { kind: 'cuboid' }>): string {
  const u = Math.min(26, 180 / (v.l + v.b * 0.6), 130 / (v.h + v.b * 0.5));
  const dx = u * 0.6, dy = u * 0.5;
  const ox = 18, oy = 18 + v.b * dy + v.h * u;
  const W = ox + v.l * u + v.b * dx + 40;
  const H = oy + 30;
  const c = col(v.color, 'orange');
  // Cube at (x along l, y depth b, z up h): front face at depth 0.
  const cube = (x: number, y: number, z: number, k: number) => {
    const fx = ox + x * u + y * dx, fy = oy - z * u - y * dy;
    return `<g class="${v.layers ? 'mv-drop' : ''}" style="--d:${k}ms"><path class="mv-cubef" d="M${r1(fx)},${r1(fy)} h${r1(u)} v${r1(-u)} h${r1(-u)} Z" fill="${c}"/><path class="mv-cubet" d="M${r1(fx)},${r1(fy - u)} l${r1(dx)},${r1(-dy)} h${r1(u)} l${r1(-dx)},${r1(dy)} Z" fill="${c}"/><path class="mv-cubes" d="M${r1(fx + u)},${r1(fy)} l${r1(dx)},${r1(-dy)} v${r1(-u)} l${r1(-dx)},${r1(dy)} Z" fill="${c}"/></g>`;
  };
  let b = '';
  if (v.cubes) {
    for (let z = 0; z < v.h; z++) for (let y = v.b - 1; y >= 0; y--) for (let x = 0; x < v.l; x++) b += cube(x, y, z, z * 450);
  } else {
    const A: Pt = [ox, oy], B: Pt = [ox + v.l * u, oy], C: Pt = [ox + v.l * u, oy - v.h * u], D: Pt = [ox, oy - v.h * u];
    const o = (p: Pt): Pt => [p[0] + v.b * dx, p[1] - v.b * dy];
    b += `<path class="mv-cubef" d="M${P(A)} L${P(B)} L${P(C)} L${P(D)} Z" fill="${c}"/><path class="mv-cubet" d="M${P(D)} L${P(o(D))} L${P(o(C))} L${P(C)} Z" fill="${c}"/><path class="mv-cubes" d="M${P(B)} L${P(o(B))} L${P(o(C))} L${P(C)} Z" fill="${c}"/>`;
  }
  if (v.labels) {
    const [l, bb, h] = v.labels;
    b += txt(ox + (v.l * u) / 2, oy + 20, l, 'mv-t mv-len');
    b += txt(ox + v.l * u + (v.b * dx) / 2 + 16, oy - (v.b * dy) / 2 + 6, bb, 'mv-t mv-len', 'start');
    b += txt(ox - 6, oy - (v.h * u) / 2 + 5, h, 'mv-t mv-len', 'end');
  }
  return wrap('cuboid', svg(W + 20, H, `<g transform="translate(20,0)">${b}</g>`));
}

function roundSolidSvg(v: Extract<MathVisual, { kind: 'cone' }>): string {
  let b = '';
  if (v.solid === 'cylinder') {
    b += `<path class="mv-face" style="--sh:-.1" fill="${PAL.teal}" d="M40,40 L40,140 A60,18 0 0 0 160,140 L160,40 Z"/><ellipse class="mv-face" style="--sh:.3" fill="${PAL.teal}" cx="100" cy="40" rx="60" ry="18"/><path class="mv-edge" d="M40,40 L40,140 A60,18 0 0 0 160,140 L160,40"/><ellipse class="mv-edge" cx="100" cy="40" rx="60" ry="18"/><line class="mv-geoseg dash" x1="100" y1="40" x2="160" y2="40"/><line class="mv-geoseg dash" x1="176" y1="40" x2="176" y2="140"/>`;
    b += txt(130, 34, `r = ${v.r}`, 'mv-t mv-len') + txt(182, 96, `h = ${v.h}`, 'mv-t mv-len', 'start');
  } else if (v.solid === 'cone') {
    b += `<path class="mv-face" style="--sh:0" fill="${PAL.orange}" d="M100,16 L160,140 A60,18 0 0 1 40,140 Z"/><path class="mv-edge" d="M100,16 L160,140 A60,18 0 0 1 40,140 Z"/><path class="mv-hidden" d="M40,140 A60,18 0 0 1 160,140"/><line class="mv-geoseg dash" x1="100" y1="16" x2="100" y2="140"/><line class="mv-geoseg dash" x1="100" y1="140" x2="160" y2="140"/>`;
    b += txt(130, 160, `r = ${v.r}`, 'mv-t mv-len') + txt(94, 90, `h = ${v.h}`, 'mv-t mv-len', 'end') + (v.l ? txt(150, 76, `l = ${v.l}`, 'mv-t mv-len', 'start') : '');
  } else {
    const hemi = v.solid === 'hemisphere';
    b += hemi
      ? `<path class="mv-face" style="--sh:0" fill="${PAL.purple}" d="M30,70 A70,70 0 0 0 170,70 Z"/><ellipse class="mv-face" style="--sh:.3" fill="${PAL.purple}" cx="100" cy="70" rx="70" ry="20"/><path class="mv-edge" d="M30,70 A70,70 0 0 0 170,70"/><ellipse class="mv-edge" cx="100" cy="70" rx="70" ry="20"/>`
      : `<circle class="mv-face" style="--sh:0" fill="${PAL.purple}" cx="100" cy="90" r="70"/><ellipse class="mv-shine" cx="76" cy="62" rx="18" ry="11"/><path class="mv-hidden" d="M30,90 A70,20 0 0 1 170,90"/><path class="mv-edge" d="M30,90 A70,20 0 0 0 170,90"/><circle class="mv-edge" cx="100" cy="90" r="70"/>`;
    const cy = hemi ? 70 : 90;
    b += `<line class="mv-geoseg dash" x1="100" y1="${cy}" x2="170" y2="${cy}"/>` + txt(135, cy - 8, `r = ${v.r}`, 'mv-t mv-len');
  }
  return wrap('cyl', svg(230, 172, b));
}

function cylinderSvg(v: Extract<MathVisual, { kind: 'cylinder' }>): string {
  if (!v.coins) return roundSolidSvg({ kind: 'cone', r: v.r, h: v.h, solid: 'cylinder' });
  let b = '';
  for (let k = 0; k < 8; k++) {
    const y = 140 - k * 13;
    b += `<g class="mv-drop" style="--d:${k * 160}ms"><path class="mv-face" style="--sh:-.1" fill="${PAL.yellow}" d="M40,${y - 10} L40,${y} A60,16 0 0 0 160,${y} L160,${y - 10} Z"/><ellipse class="mv-face" style="--sh:.3" fill="${PAL.yellow}" cx="100" cy="${y - 10}" rx="60" ry="16"/><ellipse class="mv-edge" cx="100" cy="${y - 10}" rx="60" ry="16"/></g>`;
  }
  return wrap('cyl', svg(200, 164, b));
}

// ── Patterns ──────────────────────────────────────────────────────────────

function growingHtml(v: Extract<MathVisual, { kind: 'growing' }>): string {
  const fig = (n: number, k: number) => {
    const dots: Pt[] = [];
    if (v.style === 'squares') { const s = Math.round(Math.sqrt(n)); for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) dots.push([i, j]); }
    else if (v.style === 'triangles') { let r = 0, c = 0; for (let i = 0; i < n; i++) { dots.push([c + (r === 0 ? 0 : 0), r]); c++; if (c > r) { r++; c = 0; } } }
    else if (v.style === 'L') { const arm = (n + 1) / 2; for (let i = 0; i < arm; i++) dots.push([0, i]); for (let i = 1; i < arm; i++) dots.push([i, arm - 1]); }
    else for (let i = 0; i < n; i++) dots.push([Math.floor(i / 2), i % 2]);
    const w = Math.max(...dots.map((d) => d[0])) + 1, h = Math.max(...dots.map((d) => d[1])) + 1;
    const u = 14;
    const tri = v.style === 'triangles';
    const body = dots.map(([x, y]) => `<circle class="mv-gdot" cx="${r1(10 + x * u + (tri ? ((h - 1 - y) * u) / 2 - ((h - 1) * u) / 2 + ((h - 1) * u) / 2 : 0))}" cy="${10 + y * u}" r="5.2"/>`).join('');
    return `<figure class="mv-gfig">${svg(w * u + 6 + (tri ? 0 : 0), h * u + 6, body)}<figcaption>${k + 1}</figcaption></figure>`;
  };
  return wrap('growing', v.terms.map(fig).join('') + (v.ask ? `<figure class="mv-gfig ask"><span>?</span><figcaption>${v.terms.length + 1}</figcaption></figure>` : ''));
}

function sticksHtml(v: Extract<MathVisual, { kind: 'sticks' }>): string {
  const fig = (n: number, k: number) => {
    const u = 22;
    let b = '';
    if (v.shape === 'squares') {
      for (let i = 0; i <= n; i++) b += `<line class="mv-stick" x1="${6 + i * u}" y1="6" x2="${6 + i * u}" y2="${6 + u}"/>`;
      for (let i = 0; i < n; i++) b += `<line class="mv-stick" x1="${6 + i * u}" y1="6" x2="${6 + (i + 1) * u}" y2="6"/><line class="mv-stick" x1="${6 + i * u}" y1="${6 + u}" x2="${6 + (i + 1) * u}" y2="${6 + u}"/>`;
      return `<figure class="mv-gfig">${svg(n * u + 12, u + 12, b)}<figcaption>${k + 1}</figcaption></figure>`;
    }
    // triangles in a row (alternating up/down)
    const h = u * 0.87;
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 0;
      const x = 6 + (i * u) / 2;
      b += up
        ? `<path class="mv-stick" d="M${r1(x)},${r1(6 + h)} L${r1(x + u / 2)},6 L${r1(x + u)},${r1(6 + h)} Z"/>`
        : `<path class="mv-stick" d="M${r1(x)},6 L${r1(x + u)},6 L${r1(x + u / 2)},${r1(6 + h)} Z"/>`;
    }
    return `<figure class="mv-gfig">${svg(((n + 1) * u) / 2 + 12, h + 12, b)}<figcaption>${k + 1}</figcaption></figure>`;
  };
  return wrap('sticks', v.n.map(fig).join('') + (v.ask ? `<figure class="mv-gfig ask"><span>?</span></figure>` : ''));
}

function rotsymSvg(v: Extract<MathVisual, { kind: 'rotsym' }>): string {
  const c: Pt = [80, 80];
  let shape = '';
  if (v.style === 'star') shape = `<polygon class="mv-shape" fill="${PAL.yellow}" points="${Array.from({ length: 2 * v.n }, (_, i) => P(polar(c, i % 2 ? 28 : 66, 90 + (i * 180) / v.n))).join(' ')}"/>`;
  else if (v.style === 'polygon') shape = `<polygon class="mv-shape" fill="${PAL.teal}" points="${regular(v.n, c, 64).map(P).join(' ')}"/>`;
  else if (v.style === 'flower') shape = Array.from({ length: v.n }, (_, i) => { const p = polar(c, 38, 90 + (i * 360) / v.n); return `<ellipse class="mv-shape" fill="${PAL.pink}" cx="${r1(p[0])}" cy="${r1(p[1])}" rx="17" ry="30" transform="rotate(${r1(-(i * 360) / v.n)} ${r1(p[0])} ${r1(p[1])})"/>`; }).join('') + `<circle class="mv-shape" fill="${PAL.yellow}" cx="80" cy="80" r="16"/>`;
  else shape = Array.from({ length: v.n }, (_, i) => { const a = 90 + (i * 360) / v.n; const p1 = polar(c, 66, a), p2 = polar(c, 40, a - 360 / v.n / 1.6); return `<path class="mv-shape" fill="${PAL[SHAPE_COLORS[i % 4]]}" d="M80,80 L${P(p1)} L${P(p2)} Z"/>`; }).join('');
  const dot = `<circle class="mv-corner" cx="${r1(polar(c, 66, 90)[0])}" cy="${r1(polar(c, 66, 90)[1])}" r="5"/>`;
  return wrap('rotsym', svg(160, 160, `<g class="${v.turned ? 'mv-spin' : ''}" style="--to:${r1(360 / v.n)}deg;transform-origin:80px 80px">${shape}${dot}</g><circle class="mv-pin" cx="80" cy="80" r="4"/>`));
}

function packsHtml(v: Extract<MathVisual, { kind: 'packs' }>): string {
  return wrap('packs', v.packs.map((p) => `<div class="mv-pack" style="--c:${col(p.color)}"><b>${esc(p.label)}</b><span class="mv-packbox">${esc(p.amount)}</span><em>${esc(p.price)}</em></div>`).join(''));
}

function speedHtml(v: Extract<MathVisual, { kind: 'speed' }>): string {
  return wrap('speed', `<div class="mv-road"><span>🏠</span><i></i><span>🏫</span></div><p class="mv-key">${esc(v.dist)}</p><div class="mv-legs">${v.legs.map((l) => `<span><b>${esc(l.label)}</b> ${esc(l.time)}</span>`).join('')}</div>`);
}

// ── Entry points ──────────────────────────────────────────────────────────

export function mathVisHtml(v: MathVisual): string {
  switch (v.kind) {
    case 'compare': return compareSvg(v);
    case 'seesaw': return seesawSvg(v);
    case 'emoji': return wrap('emoji', `<span class="mv-bigemoji${v.big ? ' big' : ''}">${v.e}</span>${v.label ? `<small>${esc(v.label)}</small>` : ''}`);
    case 'row': return wrap('row', v.items.map((e, i) => `<span class="mv-rowitem${v.hl === i ? ' on' : ''}">${e}${v.labels?.[i] ? `<small>${esc(v.labels[i])}</small>` : ''}</span>`).join(''));
    case 'where': return whereSvg(v);
    case 'strip': return stripSvg(v);
    case 'cubes': return cubesSvg(v);
    case 'ruler': return rulerSvg(v);
    case 'scale': return scaleSvg(v);
    case 'thermo': return thermoSvg(v);
    case 'jugs': return jugsSvg(v);
    case 'clock': return clockSvg(v);
    case 'digital': return wrap('digital', `<div class="mv-digi big">${esc(v.text)}</div>${v.sub ? `<small>${esc(v.sub)}</small>` : ''}`);
    case 'calendar': return calendarSvg(v);
    case 'fist': return fistSvg(v);
    case 'shape': return shapeSvg(v);
    case 'shapes': return wrap('shapes', v.items.map((s, i) => `<span class="mv-shapeitem${v.hl === i ? ' on' : ''}">${svg(160, 168, `<g${s.rot ? ` transform="rotate(${s.rot} 80 84)"` : ''}>${shapeEl(s.shape, col(s.color, SHAPE_COLORS[i % SHAPE_COLORS.length]))}</g>`)}</span>`).join(''));
    case 'sort': return wrap('sort', v.groups.map((g, gi) => `<div class="mv-sortrow mv-pop" style="--d:${gi * 250}ms"><span class="mv-sortlabel">${esc(g.label)}</span><span class="mv-sortitems">${g.items.map((s) => svg(160, 168, shapeEl(s.shape, col(s.color, 'yellow')))).join('')}</span><b>${g.items.length}</b></div>`).join(''));
    case 'solid': return wrap('solid', solidSvg(v.solid, v.color, v.hl));
    case 'arrow': return arrowSvg(v);
    case 'gridmap': return gridmapSvg(v);
    case 'tally': return tallySvg(v);
    case 'picgraph': return picgraphHtml(v);
    case 'growing': return growingHtml(v);
    case 'poly': return polySvg(v);
    case 'cells': return cellsSvg(v);
    case 'angle': return angleSvg(v);
    case 'lines': return linesSvg(v);
    case 'bars': return barsSvg(v);
    case 'lineg': return linegSvg(v);
    case 'pie': return pieSvg(v);
    case 'table': return tableHtml(v);
    case 'coord': return coordSvg(v);
    case 'net': return netSvg(v);
    case 'protractor': return protractorSvg(v);
    case 'geo': return geoSvg(v);
    case 'bag': return bagSvg(v);
    case 'dice': return diceHtml(v);
    case 'cards': return cardsHtml(v);
    case 'cuboid': return cuboidSvg(v);
    case 'sticks': return sticksHtml(v);
    case 'packs': return packsHtml(v);
    case 'rotsym': return rotsymSvg(v);
    case 'speed': return speedHtml(v);
    case 'cylinder': return cylinderSvg(v);
    case 'cone': return roundSolidSvg(v);
    case 'pair': return wrap('pair', `<div class="mv-pa">${mathVisHtml(v.a)}${v.la ? `<small>${esc(v.la)}</small>` : ''}</div>${v.op ? `<span class="mv-op">${esc(v.op)}</span>` : ''}<div class="mv-pa">${mathVisHtml(v.b)}${v.lb ? `<small>${esc(v.lb)}</small>` : ''}</div>`);
  }
}

const MATH_KINDS = new Set(['sort', 'compare', 'seesaw', 'emoji', 'row', 'where', 'strip', 'cubes', 'ruler', 'scale', 'thermo', 'jugs', 'clock', 'digital', 'calendar', 'fist', 'shape', 'shapes', 'solid', 'arrow', 'gridmap', 'tally', 'picgraph', 'growing', 'poly', 'cells', 'angle', 'lines', 'bars', 'lineg', 'pie', 'table', 'coord', 'net', 'protractor', 'geo', 'bag', 'dice', 'cards', 'cuboid', 'sticks', 'packs', 'rotsym', 'speed', 'cylinder', 'cone', 'pair']);
export const isMathVisual = (v: { kind: string }): v is MathVisual => MATH_KINDS.has(v.kind);

/** An answer option drawn as a picture. */
export function optionVisHtml(v: MathVisual): string {
  return `<span class="opt-vis">${mathVisHtml(v)}</span>`;
}
