// Method pictures for lessons: a balance for equations, an expression strip that boxes the part
// to do first, fraction bars, a box (area) model, a Venn diagram, tile chains for powers, a
// sliding decimal point and a parabola. Pure functions of core/vis.ts data, drawn as SVG/HTML.

import type { MathVisual, Pt } from '../core/vis.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n: number) => Math.round(n * 10) / 10;
const svg = (w: number, h: number, body: string) => `<svg class="mv-svg" width="${r1(w)}" height="${r1(h)}" viewBox="0 0 ${r1(w)} ${r1(h)}" role="img" aria-hidden="true">${body}</svg>`;
const txt = (x: number, y: number, s: string, cls = 'mv-t', anchor = 'middle') => `<text x="${r1(x)}" y="${r1(y)}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`;
const wrap = (kind: string, inner: string) => `<div class="vis mv mv-${kind}">${inner}</div>`;
type V<K extends MathVisual['kind']> = Extract<MathVisual, { kind: K }>;

// ── Balance ───────────────────────────────────────────────────────────────

function balanceSvg(v: V<'balance'>): string {
  const W = 340;
  const c: Pt = [170, 60];
  const tilt = (v.tilt ?? 0) * 7;
  const end = (side: -1 | 1): Pt => {
    const a = ((side === -1 ? 180 + tilt : tilt) * Math.PI) / 180;
    return [c[0] + 125 * Math.cos(a), c[1] - 125 * Math.sin(a) * (side === -1 ? 1 : 1)];
  };
  const L = end(-1), R = end(1);
  const pan = (p: Pt, t: string, side: string) => {
    const y = p[1] + 46;
    const small = t.length > 11;
    const w = Math.min(150, Math.max(86, t.length * (small ? 8.4 : 10.6) + 26));
    return `<line class="mv-string" x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(p[0] - w / 2 + 8)}" y2="${r1(y)}"/><line class="mv-string" x1="${r1(p[0])}" y1="${r1(p[1])}" x2="${r1(p[0] + w / 2 - 8)}" y2="${r1(y)}"/>
      <path class="mv-pan" d="M${r1(p[0] - w / 2)},${r1(y)} Q${r1(p[0])},${r1(y + 26)} ${r1(p[0] + w / 2)},${r1(y)} Z"/>
      <rect class="mv-tray ${side}" x="${r1(p[0] - w / 2 + 4)}" y="${r1(y - 34)}" width="${r1(w - 8)}" height="32" rx="9"/>${txt(p[0], y - 12, t, small ? 'mv-t mv-small mv-onfill' : 'mv-t mv-onfill')}
      ${v.act ? `<g class="mv-drop" style="--d:${side === 'l' ? 0 : 120}ms"><rect class="mv-act" x="${r1(p[0] - 30)}" y="${r1(y - 66)}" width="60" height="26" rx="13"/>${txt(p[0], y - 47, v.act, 'mv-t mv-small mv-acttxt')}</g>` : ''}`;
  };
  let b = `<polygon class="mv-pivot" points="${c[0]},${c[1]} ${c[0] - 22},150 ${c[0] + 22},150"/><line class="mv-ground" x1="100" y1="152" x2="240" y2="152"/>`;
  b += `<line class="mv-beam" x1="${r1(L[0])}" y1="${r1(L[1])}" x2="${r1(R[0])}" y2="${r1(R[1])}"/>`;
  b += pan(L, v.left, 'l') + pan(R, v.right, 'r');
  b += `<circle class="mv-signbg${v.ok ? ' ok' : ''}" cx="${c[0]}" cy="${c[1] + 50}" r="17"/>${txt(c[0], c[1] + 57, v.ok ? '✓' : v.sign ?? '=', 'mv-t mv-sign')}`;
  return wrap('balance', svg(W, 160, b));
}

// ── Expression strip (order of operations) ────────────────────────────────

const RULES: [string, string, string][] = [['B', '( )', 'Brackets'], ['O', 'x²', 'Powers'], ['DM', '× ÷', 'Times, divide'], ['AS', '+ −', 'Add, take']];

function exprHtml(v: V<'expr'>): string {
  const ladder = v.ladder !== false && v.rule ? `<div class="mv-lad">${RULES.map(([k, sym, name], i) => `<span class="${k === v.rule ? 'on' : RULES.findIndex((r) => r[0] === v.rule) > i ? 'past' : ''}"><b>${sym}</b><small>${name}</small></span>`).join('<i>›</i>')}</div>` : '';
  const chips = v.parts.map((p) => {
    if (p.sign) return `<span class="mv-xs">${esc(p.t)}</span>`;
    if (p.box) return `<span class="mv-xc box mv-pop"><b>${esc(p.t)}</b>${v.under ? `<small>${esc(v.under)}</small>` : ''}</span>`;
    return `<span class="mv-xc${p.done ? ' done mv-pop' : ''}">${esc(p.t)}</span>`;
  }).join('');
  return wrap('expr', `${ladder}<div class="mv-ex">${chips}</div>`);
}

// ── Fraction bars ─────────────────────────────────────────────────────────

function fbarHtml(v: V<'fbar'>): string {
  return wrap('fbar', v.rows.map((row) => `<div class="mv-fbrow">${row.name ? `<span class="mv-fbname">${esc(row.name)}</span>` : ''}<span class="mv-fbars">${row.bars.map((bar) => {
    const cells = Array.from({ length: bar.d }, (_, i) => {
      const on = i < bar.on;
      const x = on && bar.x && i >= bar.on - bar.x;
      return `<i class="${on ? `on t${bar.tone ?? 0}` : ''}${x ? ' x' : ''}"></i>`;
    }).join('');
    return `<span class="mv-fb${bar.new ? ' mv-drop' : ''}${bar.t ? ' has-t' : ''}" style="--n:${bar.d}">${cells}${bar.t ? `<b>${esc(bar.t)}</b>` : ''}</span>`;
  }).join('')}</span>${row.after ? `<b class="mv-fbafter">${esc(row.after)}</b>` : ''}</div>`).join(''));
}

// ── Box (area) model ──────────────────────────────────────────────────────

function areaHtml(v: V<'area'>): string {
  const cw = v.cw ?? v.cols.map(() => 1);
  const rh = v.rh ?? v.rows.map(() => 1);
  const heads = v.cols.some((c) => c) || v.rows.some((r) => r);
  const cols = v.tiny
    ? `grid-template-columns:${heads ? 'auto ' : ''}repeat(${v.cols.length},minmax(20px,30px));grid-auto-rows:26px`
    : `grid-template-columns:auto ${cw.map((w) => `minmax(46px,${r1(w)}fr)`).join(' ')};grid-template-rows:auto ${rh.map((h) => `minmax(40px,${r1(h * 40)}px)`).join(' ')}`;
  const hl = new Set((v.hl ?? []).map(([r, c]) => `${r},${c}`));
  let g = heads || !v.tiny ? `<span class="mv-ah op">${esc(v.op ?? '×')}</span>${v.cols.map((c) => `<span class="mv-ah">${esc(c)}</span>`).join('')}` : '';
  v.rows.forEach((r, i) => {
    if (heads || !v.tiny) g += `<span class="mv-ah">${esc(r)}</span>`;
    v.cols.forEach((_, j) => {
      const t = v.cells[i]?.[j] ?? '';
      g += `<span class="mv-ac t${v.tone?.[i]?.[j] ?? (i + j) % 2}${hl.has(`${i},${j}`) ? ' hl' : ''}${t ? ' mv-pop' : ''}" style="--d:${(i * v.cols.length + j) * 180}ms">${esc(t)}</span>`;
    });
  });
  return wrap('area', `<div class="mv-agrid${v.tiny ? ' tiny' : ''}" style="${cols}">${g}</div>${v.total ? `<p class="mv-atot">${esc(v.total)}</p>` : ''}`);
}

// ── Venn diagram ──────────────────────────────────────────────────────────

function vennSvg(v: V<'venn'>): string {
  const W = 340, H = 212;
  const place = (items: string[], cx: number, colW: number) => {
    const per = items.length > 4 ? 2 : 1;
    const rows = Math.ceil(items.length / per);
    return items.map((t, i) => {
      const col = per === 1 ? 0 : (i % per) - 0.5;
      const row = Math.floor(i / per);
      const x = cx + col * colW;
      const y = 112 + (row - (rows - 1) / 2) * 24;
      const pick = t === v.pick;
      return `<g class="mv-pop" style="--d:${i * 90}ms">${pick ? `<circle class="mv-vpick" cx="${r1(x)}" cy="${r1(y - 5)}" r="15"/>` : ''}${txt(x, y, t, `mv-t mv-small${pick ? ' hl' : ''}`)}</g>`;
    }).join('');
  };
  let b = `<circle class="mv-va" cx="128" cy="112" r="88"/><circle class="mv-vb" cx="212" cy="112" r="88"/>`;
  b += txt(92, 18, v.a, 'mv-t mv-small') + txt(248, 18, v.b, 'mv-t mv-small');
  b += place(v.onlyA, 84, 32) + place(v.both, 170, 26) + place(v.onlyB, 256, 32);
  return wrap('venn', (v.title ? `<small class="mv-vt">${esc(v.title)}</small>` : '') + svg(W, H, b));
}

// ── Tile chains (powers) ──────────────────────────────────────────────────

function chainHtml(v: V<'chain'>): string {
  const parts = v.groups.map((g, gi) => {
    const tiles = g.items.map((t, i) => `<i class="t${g.tone ?? gi % 4}${g.x?.includes(i) ? ' x' : ''}${g.hl?.includes(i) ? ' hl mv-pop' : ''}">${esc(t)}</i>`).join('');
    return `<span class="mv-cgw"><span class="mv-cg">${tiles}</span>${g.label ? `<small>${esc(g.label)}</small>` : ''}</span>`;
  });
  const row = parts.map((p, i) => (i ? `<span class="mv-cop">${esc(v.ops?.[i - 1] ?? '×')}</span>` : '') + p).join('');
  return wrap('chain', `<div class="mv-chain${v.rows ? ' rows' : ''}">${row}</div>${v.note ? `<p class="mv-cnote">${esc(v.note)}</p>` : ''}`);
}

// ── Sliding decimal point ─────────────────────────────────────────────────

function pvSvg(v: V<'pv'>): string {
  const ds = v.digits.split('');
  const cw = Math.min(40, 300 / Math.max(ds.length, 1));
  const W = ds.length * cw + 24;
  const x0 = 12;
  const top = v.heads ? 22 : 8;
  const gap = (k: number) => x0 + k * cw;
  let b = ds.map((d, i) => `<rect class="mv-pvbox" x="${r1(gap(i) + 2)}" y="${top + 26}" width="${r1(cw - 4)}" height="40" rx="8"/>${txt(gap(i) + cw / 2, top + 54, d, 'mv-t mv-pvd')}${v.heads?.[i] ? txt(gap(i) + cw / 2, top + 18, v.heads[i], 'mv-t mv-tiny') : ''}`).join('');
  if (v.from !== undefined && v.from !== v.point) {
    const dir = v.point > v.from ? 1 : -1;
    const n = Math.abs(v.point - v.from);
    b += `<circle class="mv-pvghost" cx="${r1(gap(v.from))}" cy="${top + 62}" r="4.5"/>`;
    for (let k = 0; k < n; k++) {
      const a = gap(v.from + k * dir), z = gap(v.from + (k + 1) * dir);
      b += `<path class="mv-hop mv-draw" pathLength="1" style="--d:${k * 220}ms" d="M${r1(a)},${top + 22} Q${r1((a + z) / 2)},${top + 4} ${r1(z)},${top + 22}"/>`;
    }
  }
  if (v.point >= 0 && v.point <= ds.length) b += `<circle class="mv-pvpt mv-pop" style="--d:${Math.abs(v.point - (v.from ?? v.point)) * 220}ms" cx="${r1(gap(v.point))}" cy="${top + 62}" r="5.5"/>`;
  return wrap('pv', svg(W, top + 76, b) + (v.note ? `<small class="mv-pvnote">${esc(v.note)}</small>` : ''));
}

// ── Parabola ──────────────────────────────────────────────────────────────

function parabSvg(v: V<'parab'>): string {
  const f = (x: number) => v.a * x * x + v.b * x + v.c;
  const xs = Array.from({ length: 61 }, (_, i) => v.min + ((v.max - v.min) * i) / 60);
  const ys = xs.map(f);
  let lo = Math.min(0, ...ys), hi = Math.max(0, ...ys);
  const vy = f(-v.b / (2 * v.a));
  lo = Math.min(lo, vy - 1);
  hi = Math.max(hi, vy + 1);
  const cap = Math.max(Math.abs(vy) * 3, 6);
  hi = Math.min(hi, Math.max(cap, 1));
  lo = Math.max(lo, -cap);
  const W = 300, H = 190, pad = 18;
  const X = (x: number) => pad + ((x - v.min) / (v.max - v.min)) * (W - 2 * pad);
  const Y = (y: number) => pad + ((hi - y) / (hi - lo)) * (H - 2 * pad);
  let b = `<line class="mv-axis" x1="${pad - 6}" y1="${r1(Y(0))}" x2="${W - pad + 8}" y2="${r1(Y(0))}"/>`;
  if (v.min < 0 && v.max > 0) b += `<line class="mv-axis" x1="${r1(X(0))}" y1="${H - pad + 4}" x2="${r1(X(0))}" y2="${pad - 8}"/>`;
  b += txt(W - pad + 10, Y(0) - 6, 'x', 'mv-t mv-small');
  const pts = xs.map((x, i) => [X(x), Y(Math.max(lo - 1, Math.min(hi + 1, ys[i])))] as Pt);
  b += `<clipPath id="pbclip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath><path class="mv-gline mv-draw slow" pathLength="1" clip-path="url(#pbclip)" d="M${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' L')}"/>`;
  for (const [i, m] of (v.marks ?? []).entries()) b += `<g class="mv-pop" style="--d:${1600 + i * 250}ms"><circle class="mv-rootdot" cx="${r1(X(m))}" cy="${r1(Y(0))}" r="6"/>${txt(X(m), Y(0) + (v.a > 0 ? 22 : -12), String(Math.round(m * 100) / 100).replace('-', '−'), 'mv-t mv-small hl')}</g>`;
  return wrap('parab', svg(W, H, b));
}

export function methodVisHtml(v: MathVisual): string | null {
  switch (v.kind) {
    case 'balance': return balanceSvg(v);
    case 'expr': return exprHtml(v);
    case 'fbar': return fbarHtml(v);
    case 'area': return areaHtml(v);
    case 'venn': return vennSvg(v);
    case 'chain': return chainHtml(v);
    case 'pv': return pvSvg(v);
    case 'parab': return parabSvg(v);
    default: return null;
  }
}
export const METHOD_KINDS = ['balance', 'expr', 'fbar', 'area', 'venn', 'chain', 'pv', 'parab'];
