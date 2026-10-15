// Drawing question pictures: counting objects, dots, ten frames, patterns, fractions, money.

import type { Visual } from '../core/question.ts';
import { createRng, hashString } from '../core/rng.ts';

export const EMOJI: Record<string, string> = {
  mango: '🥭', balloon: '🎈', duck: '🦆', star: '⭐', car: '🚗', flower: '🌸', apple: '🍎', fish: '🐟', ball: '⚽', cookie: '🍪', butterfly: '🦋', kite: '🪁',
};

export function objectGroup(object: string, count: number, crossed = 0, size = 'md'): string {
  const e = EMOJI[object] ?? '⭐';
  const items = Array.from({ length: count }, (_, i) => `<span class="obj${i >= count - crossed ? ' crossed' : ''}" style="--i:${i}">${e}</span>`).join('');
  return `<span class="group ${size}" data-count="${count}">${items}</span>`;
}

export function visualHtml(v: Visual, key: string): string {
  switch (v.kind) {
    case 'objects': {
      const joiner = v.joiner ? `<span class="joiner">${v.joiner}</span>` : '';
      const big = v.groups.length > 3;
      return `<div class="vis objects${big ? ' many' : ''}">${v.groups.map((g) => objectGroup(g.object, g.count, g.crossed ?? 0, big ? 'sm' : 'md')).join(joiner)}</div>`;
    }
    case 'dots': {
      // Scattered dots, positions fixed by the question so a re-render doesn't move them.
      const r = createRng(hashString(key));
      const pts: [number, number][] = [];
      for (let i = 0; i < v.count; i++) {
        for (let t = 0; t < 60; t++) {
          const p: [number, number] = [12 + r.next() * 76, 14 + r.next() * 72];
          if (pts.every(([x, y]) => Math.hypot(x - p[0], y - p[1]) > 17)) {
            pts.push(p);
            break;
          }
          if (t === 59) pts.push(p);
        }
      }
      return `<div class="vis dots"><svg viewBox="0 0 100 100">${pts.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" style="--i:${i}"/>`).join('')}</svg></div>`;
    }
    case 'tenframe': {
      const cells = Array.from({ length: 10 }, (_, i) => `<span class="cell">${i < v.count ? '<i></i>' : ''}</span>`).join('');
      return `<div class="vis tenframe">${cells}</div>`;
    }
    case 'pattern':
      return `<div class="vis pattern">${v.items.map((o, i) => `<span class="obj" style="--i:${i}">${EMOJI[o] ?? o}</span>`).join('')}<span class="slot">?</span></div>`;
    case 'shape-fraction': {
      if (v.shape === 'circle') {
        const parts = Array.from({ length: v.parts }, (_, i) => {
          const a0 = (i / v.parts) * Math.PI * 2 - Math.PI / 2;
          const a1 = ((i + 1) / v.parts) * Math.PI * 2 - Math.PI / 2;
          const p = (a: number) => `${(50 + 42 * Math.cos(a)).toFixed(2)},${(50 + 42 * Math.sin(a)).toFixed(2)}`;
          return `<path d="M50,50 L${p(a0)} A42,42 0 ${v.parts === 1 ? 1 : 0} 1 ${p(a1)} Z" class="${i < v.shaded ? 'on' : ''}"/>`;
        }).join('');
        return `<div class="vis fraction"><svg viewBox="0 0 100 100">${parts}</svg></div>`;
      }
      const w = 92 / v.parts;
      return `<div class="vis fraction"><svg viewBox="0 0 100 40">${Array.from({ length: v.parts }, (_, i) => `<rect x="${4 + i * w}" y="6" width="${w}" height="28" class="${i < v.shaded ? 'on' : ''}"/>`).join('')}</svg></div>`;
    }
    case 'money':
      return `<div class="vis money">${v.values.map((c, i) => moneyPiece(c, i)).join('')}</div>`;
  }
}

function moneyPiece(value: number, i: number): string {
  if (value >= 10 && value !== 10) return `<span class="note" style="--i:${i}">₹${value}</span>`;
  return `<span class="coin-piece c${value}" style="--i:${i}">₹${value}</span>`;
}

/** Content of an answer option. */
export function optionHtml(value: string, optionObject?: string): string {
  if (optionObject) return objectGroup(optionObject, Number(value), 0, 'sm');
  if (EMOJI[value]) return `<span class="opt-emoji">${EMOJI[value]}</span>`;
  return `<span class="opt-num">${prettyAnswer(value)}</span>`;
}

/** Answers shown nicely: "3/4" as a stacked fraction, "-7" with a real minus. */
export function prettyAnswer(a: string): string {
  const mx = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(a);
  if (mx) return `${mx[1] ? '−' : ''}${mx[2]}<span class="frac"><sup>${mx[3]}</sup><sub>${mx[4]}</sub></span>`;
  const m = /^(-?)(\d+)\/(\d+)$/.exec(a);
  if (m) return `${m[1] ? '−' : ''}<span class="frac"><sup>${m[2]}</sup><sub>${m[3]}</sub></span>`;
  return a.replace(/(^|[^\w])-(?=\d)/g, '$1−').replace(/,/g, ' and ');
}
