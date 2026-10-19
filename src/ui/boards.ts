// Drawing lesson pictures (boards): number lines, column methods, bar models, dots and
// objects, base-ten blocks, tables and short division. A board is drawn once with every item;
// setBoardStep() then shows, highlights and animates items as the lesson's steps go by.

import type { Board, BarsBoard, BlocksBoard, BusBoard, ColsBoard, DotsBoard, LineBoard, TableBoard, Timed } from '../core/teach/types.ts';
import { esc } from './app.ts';
import { EMOJI } from './visuals.ts';
import { mathHtml } from './mathtext.ts';

/** data-* attributes for a timed item. */
function timed(t: Timed, extra = ''): string {
  const a: string[] = [`data-at="${t.at ?? 0}"`];
  if (t.until !== undefined) a.push(`data-until="${t.until}"`);
  if (t.hl !== undefined) a.push(`data-hl="${t.hl}"`);
  return `${a.join(' ')}${extra ? ' ' + extra : ''}`;
}

export function boardHtml(b: Board): string {
  switch (b.kind) {
    case 'line':
      return lineHtml(b);
    case 'cols':
      return colsHtml(b);
    case 'bars':
      return barsHtml(b);
    case 'dots':
      return dotsHtml(b);
    case 'blocks':
      return blocksHtml(b);
    case 'table':
      return tableHtml(b);
    case 'bus':
      return busHtml(b);
  }
}

/** Show the board as it is at step i (items for step i animate in). */
export function setBoardStep(root: HTMLElement, i: number): void {
  const num = (el: Element, k: string): number | undefined => {
    const v = el.getAttribute(`data-${k}`);
    return v === null ? undefined : Number(v);
  };
  root.querySelectorAll('[data-at]').forEach((el) => {
    const at = num(el, 'at')!;
    const until = num(el, 'until');
    const on = at <= i && (until === undefined || i < until);
    const was = el.classList.contains('shown');
    el.classList.toggle('shown', on);
    el.classList.toggle('fresh', on && !was && at === i);
  });
  root.querySelectorAll('[data-hl]').forEach((el) => el.classList.toggle('lit', num(el, 'hl')! <= i));
  root.querySelectorAll('[data-shade]').forEach((el) => {
    const on = num(el, 'shade')! <= i;
    el.classList.toggle('new-shade', on && !el.classList.contains('shaded'));
    el.classList.toggle('shaded', on);
  });
  root.querySelectorAll('[data-x]').forEach((el) => el.classList.toggle('crossed', num(el, 'x')! <= i));
  root.querySelectorAll('[data-badge]').forEach((el) => el.classList.toggle('counted', num(el, 'badge')! <= i));
  // Column focus (column methods): light the column being worked on.
  root.querySelectorAll<HTMLElement>('[data-focus]').forEach((grid) => {
    const spans: [number, number, number][] = JSON.parse(grid.dataset.focus || '[]');
    const cols = new Set(spans.filter(([, at, until]) => at <= i && i < until).map(([c]) => c));
    grid.querySelectorAll<HTMLElement>('[data-col]').forEach((cell) => cell.classList.toggle('colfocus', cols.has(Number(cell.dataset.col))));
  });
}

// ── Number line ────────────────────────────────────────────────────────────

const W = 340;
function lineHtml(b: LineBoard): string {
  const y0 = 66;
  const pad = 20;
  const vals = new Set<number>();
  b.points.forEach((p) => vals.add(p.v));
  b.hops.forEach((h) => (vals.add(h.from), vals.add(h.to)));
  let x: (v: number) => number;
  if (b.scale === 'linear') {
    const min = b.min ?? Math.min(...vals);
    const max = b.max ?? Math.max(...vals);
    x = (v) => pad + ((v - min) / (max - min || 1)) * (W - 2 * pad);
  } else {
    const sorted = [...vals].sort((p, q) => p - q);
    const gaps = sorted.slice(1).map((v, i) => 0.9 + Math.log10(1 + Math.abs(v - sorted[i])));
    const total = gaps.reduce((p, g) => p + g, 0) || 1;
    const pos = new Map<number, number>();
    let acc = 0;
    sorted.forEach((v, i) => {
      if (i) acc += gaps[i - 1];
      pos.set(v, sorted.length === 1 ? W / 2 : pad + 10 + (acc / total) * (W - 2 * pad - 20));
    });
    x = (v) => pos.get(v) ?? W / 2;
  }
  const out: string[] = [];
  out.push(`<line class="ax" x1="${pad - 8}" y1="${y0}" x2="${W - pad + 8}" y2="${y0}"/>`);
  // Every point shows its own label; tick labels near one step aside when it appears.
  const textW = (s: string, size: number) => s.length * size * 0.62;
  const pointLabels = b.points.map((p) => ({ x: x(p.v), w: textW(p.label ?? fmtNum(p.v), 13), at: p.at ?? 0 }));
  if (b.scale === 'linear' && b.tick) {
    const min = b.min!;
    const max = b.max!;
    const tick = b.tick;
    // Label every m ticks: as asked, or spread out until the labels have room.
    const unit = (W - 2 * pad) / (max - min || 1);
    const room = Math.max(textW(fmtNum(min), 11), textW(fmtNum(max), 11)) + 5;
    const asked = b.labelEvery ? Math.max(1, Math.round(b.labelEvery / tick)) : 0;
    let m = asked;
    if (m && m * tick * unit < room) m = [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((k) => k > asked && k * tick * unit >= room) ?? asked;
    for (let v = min; v <= max + 1e-9; v += tick) {
      const vv = Math.round(v * 1000) / 1000;
      const big = m > 0 && Math.round(vv / tick) % m === 0;
      const xx = x(vv).toFixed(1);
      out.push(`<line class="tk${vv === 0 ? ' zero' : ''}" x1="${xx}" y1="${y0 - (big ? 6 : 4)}" x2="${xx}" y2="${y0 + (big ? 6 : 4)}"/>`);
      if (!big) continue;
      const tw = textW(fmtNum(vv), 11);
      const near = pointLabels.filter((pl) => Math.abs(pl.x - x(vv)) < (pl.w + tw) / 2 + 3);
      if (near.some((pl) => pl.at === 0)) continue;
      const until = near.length ? ` data-at="0" data-until="${Math.min(...near.map((pl) => pl.at))}"` : '';
      out.push(`<text class="tl${vv === 0 ? ' zero' : ''}" x="${xx}" y="${y0 + 22}"${until}>${fmtNum(vv)}</text>`);
    }
  }
  // Hops: arcs above the line, drawn on in order.
  const byAt = new Map<number, number>();
  for (const h of b.hops) {
    const k = byAt.get(h.at ?? 0) ?? 0;
    byAt.set(h.at ?? 0, k + 1);
    const x1 = x(h.from);
    const x2 = x(h.to);
    const xm = (x1 + x2) / 2;
    const span = Math.abs(x2 - x1);
    const hgt = Math.max(16, Math.min(46, span * 0.5));
    const cy = y0 - 2 - hgt * 2;
    const dir = x2 >= x1 ? 1 : -1;
    // Arrowhead along the end tangent (from the control point to the end).
    const ang = Math.atan2(y0 - 2 - cy, x2 - xm);
    const ah = (a: number) => `${(x2 - 7 * Math.cos(ang + a)).toFixed(1)},${(y0 - 2 - 7 * Math.sin(ang + a)).toFixed(1)}`;
    const lab = span >= 16 || b.hops.length <= 6 ? `<text class="hl-t" x="${xm.toFixed(1)}" y="${(y0 - 2 - hgt - 6).toFixed(1)}">${esc(h.label)}</text>` : '';
    out.push(
      `<g class="hop${dir < 0 ? ' back' : ''}" ${timed(h)} style="--k:${k}"><path pathLength="1" d="M${x1.toFixed(1)} ${y0 - 2} Q${xm.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y0 - 2}"/><path class="ah" d="M${ah(0.45)} L${x2.toFixed(1)},${y0 - 2} L${ah(-0.45)}"/>${lab}</g>`,
    );
  }
  // Points, labels staggered if crowded.
  const pts = [...b.points].sort((p, q) => x(p.v) - x(q.v));
  let lastX = -99;
  let low = false;
  for (const p of pts) {
    const px = x(p.v);
    low = px - lastX < 30 ? !low : false;
    lastX = px;
    out.push(
      `<g class="pt${p.tone ? ` p-${p.tone}` : ''}" ${timed(p)}><circle cx="${px.toFixed(1)}" cy="${y0}" r="5.5"/><text class="pl" x="${px.toFixed(1)}" y="${y0 + (low ? 36 : 22)}">${esc(p.label ?? fmtNum(p.v))}</text></g>`,
    );
  }
  return `<div class="bd bd-line"><svg viewBox="0 0 ${W} 108" role="img" aria-label="Number line">${out.join('')}</svg></div>`;
}
const fmtNum = (v: number): string => (v < 0 ? `−${-v}` : String(v));

// ── Column methods ─────────────────────────────────────────────────────────

function colsHtml(b: ColsBoard): string {
  const rows: string[] = [];
  if (b.heads) rows.push(`<span class="cc op"></span>${b.heads.map((h, c) => `<span class="cc head" data-col="${c}">${esc(h)}</span>`).join('')}`);
  b.rows.forEach((kind, r) => {
    const op = b.ops?.find((o) => o.r === r);
    const cells: string[] = [`<span class="cc op k-${kind}">${op ? esc(op.ch) : ''}</span>`];
    for (let c = 0; c < b.width; c++) {
      const items = b.cells.filter((x) => x.r === r && x.c === c);
      const rule = b.rules.includes(r) ? ' rule' : '';
      if (!items.length) cells.push(`<span class="cc k-${kind}${rule}" data-col="${c}"></span>`);
      else {
        const it = items[items.length - 1];
        const x = it.cross !== undefined ? ` data-x="${it.cross}"` : '';
        cells.push(`<span class="cc k-${kind}${rule}" data-col="${c}"><i class="d${it.tone ? ` k-${it.tone}` : ''}${it.ch === '.' ? ' k-pt' : ''}" ${timed(it)}${x}>${esc(it.ch)}</i></span>`);
      }
    }
    rows.push(cells.join(''));
  });
  const focus = JSON.stringify((b.focus ?? []).map((fz) => [fz.c, fz.at ?? 0, fz.until ?? 999]));
  return `<div class="bd bd-cols"><div class="cgrid" style="--w:${b.width}" data-focus='${focus}'>${rows.join('')}</div></div>`;
}

// ── Bars ───────────────────────────────────────────────────────────────────

function barsHtml(b: BarsBoard): string {
  const rows = b.bars.map((bar) => {
    const parts = bar.parts
      .map((p) => {
        const shade = p.tone ? ` data-shade="${p.on ?? p.at ?? bar.at ?? 0}"` : '';
        const x = p.cross !== undefined ? ` data-x="${p.cross}"` : '';
        return `<span class="bp t${p.tone ?? 0}" style="flex:${p.w ?? 1}" ${timed({ at: p.at ?? bar.at, until: p.until, hl: p.hl })}${shade}${x}>${p.text ? `<b${p.textAt !== undefined ? ` data-at="${p.textAt}"` : ''}>${mathHtml(p.text)}</b>` : ''}</span>`;
      })
      .join('');
    return `<div class="brow" ${timed(bar)}>${bar.label ? `<span class="bl">${mathHtml(bar.label)}</span>` : ''}<div class="bwrap" style="width:${((bar.len ?? 1) * 100).toFixed(1)}%">${bar.total ? `<span class="btot">${mathHtml(bar.total)}</span>` : ''}<div class="bar">${parts}</div></div></div>`;
  });
  const labels = b.bars.some((x) => x.label);
  return `<div class="bd bd-bars${labels ? ' labelled' : ''}">${rows.join('')}</div>`;
}

// ── Dots and objects ───────────────────────────────────────────────────────

function dotsHtml(b: DotsBoard): string {
  const item = (g: DotsBoard['groups'][number], i: number): string => {
    const gone = g.gone && i >= g.n - g.gone ? ` data-x="${g.goneAt ?? 0}"` : '';
    const em = g.items?.[i] ?? g.emoji;
    const plain = g.hollow || (!g.face && !em);
    const inner = g.hollow ? '<span class="hole"></span>' : g.face ? `<span class="coin">${esc(g.face)}</span>` : em ? `<span class="em">${EMOJI[em] ?? em}</span>` : '<span class="dot"></span>';
    const cnt = g.count !== undefined ? `<span class="cnt" data-badge="${g.count}" style="--k:${i}">${(g.countFrom ?? 1) + i}</span>` : '';
    return `<span class="it${plain ? ' plain' : ''}${cnt ? ' has-n' : ''}"${gone}><span class="ib">${inner}${plain ? cnt : ''}</span>${plain ? '' : cnt}</span>`;
  };
  if (b.layout === 'frame') {
    const cells: string[] = [];
    for (const g of b.groups) for (let i = 0; i < g.n && cells.length < 10; i++) cells.push(`<span class="fc"><span class="fi" ${timed(g)}>${item(g, i)}</span></span>`);
    while (cells.length < 10) cells.push('<span class="fc"></span>');
    const label = b.groups.find((g) => g.label)?.label;
    return `<div class="bd bd-dots frame"><div class="tf">${cells.join('')}</div>${label ? `<p class="glab">${mathHtml(label)}</p>` : ''}</div>`;
  }
  // Long rows wrap into even rows (9 → 5 and 4, not 8 and 1).
  const most = b.layout === 'groups' ? 4 : b.layout === 'row' ? 8 : 0;
  const groups = b.groups.map((g, gi) => {
    const items = Array.from({ length: g.n }, (_, i) => item(g, i)).join('');
    const per = most && g.n > most ? Math.ceil(g.n / Math.ceil(g.n / most)) : 0;
    const join = gi && b.joiner ? `<span class="jn" ${timed(g)}>${esc(b.joiner)}</span>` : '';
    const label = g.label ? `<p class="glab"${g.labelAt !== undefined ? ` data-at="${g.labelAt}" style="--k:${gi}"` : ''}>${mathHtml(g.label)}</p>` : '';
    return `${join}<div class="grp ${b.layout}" ${timed(g)}><div class="its${per ? ' per' : ''}"${per ? ` style="--per:${per}"` : ''}>${items}</div>${label}</div>`;
  });
  const cap = b.caption ? `<p class="cap">${mathHtml(b.caption)}</p>` : '';
  return `<div class="bd bd-dots ${b.layout}"><div class="dbody">${groups.join('')}</div>${cap}</div>`;
}

// ── Base-ten blocks ────────────────────────────────────────────────────────

function blocksHtml(b: BlocksBoard): string {
  const one = (g: BlocksBoard['groups'][number]) => {
    const u = 7;
    const parts: string[] = [];
    let xx = 0;
    for (let i = 0; i < g.h; i++) {
      parts.push(`<rect class="hb" x="${xx}" y="0" width="${u * 10}" height="${u * 10}"/>`);
      for (let k = 1; k < 10; k++) parts.push(`<line class="bgl" x1="${xx + k * u}" y1="0" x2="${xx + k * u}" y2="${u * 10}"/><line class="bgl" x1="${xx}" y1="${k * u}" x2="${xx + u * 10}" y2="${k * u}"/>`);
      xx += u * 10 + 6;
    }
    for (let i = 0; i < g.t; i++) {
      parts.push(`<rect class="tb" x="${xx}" y="0" width="${u}" height="${u * 10}"/>`);
      for (let k = 1; k < 10; k++) parts.push(`<line class="bgl" x1="${xx}" y1="${k * u}" x2="${xx + u}" y2="${k * u}"/>`);
      xx += u + 4;
    }
    if (g.t) xx += 4;
    for (let i = 0; i < g.o; i++) {
      const col = Math.floor(i / 5);
      const row = i % 5;
      parts.push(`<rect class="ob" x="${xx + col * (u + 3)}" y="${u * 10 - (row + 1) * (u + 3) + 3}" width="${u}" height="${u}"/>`);
    }
    xx += Math.ceil(g.o / 5) * (u + 3);
    const w = Math.max(xx, 10);
    return `<div class="blk" ${timed(g)}><svg viewBox="-1 -1 ${w + 2} ${u * 10 + 2}" style="width:${Math.min(w + 2, 300)}px">${parts.join('')}</svg>${g.label ? `<p class="glab">${mathHtml(g.label)}</p>` : ''}</div>`;
  };
  return `<div class="bd bd-blocks">${b.groups.map(one).join('<span class="blk-arrow" aria-hidden="true">→</span>')}</div>`;
}

// ── Tables ─────────────────────────────────────────────────────────────────

function tableHtml(b: TableBoard): string {
  const head = b.head ? `<tr class="thead">${b.head.map((h) => `<th>${mathHtml(h)}</th>`).join('')}${b.rows.some((r) => r.note) ? '<th class="tnote"></th>' : ''}</tr>` : '';
  const rows = b.rows
    .map((r) => {
      const cells = r.cells
        .map((c, i) => {
          const tag = b.label && i === 0 ? 'th' : 'td';
          if (typeof c === 'string') return `<${tag}>${mathHtml(c)}</${tag}>`;
          return `<${tag} class="${c.tone ? `t-${c.tone}` : ''}" ${c.at !== undefined || c.hl !== undefined || c.until !== undefined ? timed(c) : ''}>${mathHtml(c.v)}</${tag}>`;
        })
        .join('');
      return `<tr ${timed(r)}>${cells}${r.note !== undefined ? `<td class="tnote">${mathHtml(r.note)}</td>` : b.rows.some((x) => x.note) ? '<td class="tnote"></td>' : ''}</tr>`;
    })
    .join('');
  return `<div class="bd bd-table"><table>${head}${rows}</table></div>`;
}

// ── Short division ─────────────────────────────────────────────────────────

function busHtml(b: BusBoard): string {
  const ans = b.digits.map((_, i) => {
    const a = b.answer[i];
    return `<span class="bc ans">${a && a.ch ? `<i ${timed(a)}>${esc(a.ch)}</i>` : ''}</span>`;
  });
  const digs = b.digits.map((d, i) => {
    const carry = b.carries.find((c) => c.i === i);
    return `<span class="bc dig">${carry ? `<sup class="cy" ${timed(carry)}>${esc(carry.ch)}</sup>` : ''}${esc(d)}</span>`;
  });
  const rem = b.rem ? `<span class="bc rem"><i ${timed(b.rem)}>${esc(b.rem.text)}</i></span>` : '';
  return `<div class="bd bd-bus"><div class="bus" style="--n:${b.digits.length}"><span class="bc"></span>${ans.join('')}${rem || '<span class="bc"></span>'}<span class="bc dv">${esc(b.divisor)}</span>${digs.join('')}<span class="bc"></span></div></div>`;
}
