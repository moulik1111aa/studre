// Biscuit, the Study Hard mascot: a very round, very happy dog. Drawn as layered SVG so it
// can draw itself in line by line (data-draw strokes), then colour in (data-fill shapes),
// then wobble its belly, wag its tail and blink.

const INK = '#3A2416';
const TAN = '#E9A866';
const CREAM = '#FCE6C8';
const BROWN = '#8E5428';
const O = `stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

/** One shape: a fill layer and its outline (each optional). */
const part = (d: string, fill: string | null, outline = true, extra = '') =>
  `${fill ? `<path data-fill d="${d}" fill="${fill}" ${extra}/>` : ''}${outline ? `<path data-draw d="${d}" ${O}/>` : ''}`;
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

export interface DogOptions {
  /** Closed eyes and a "z" — for the see-you-tomorrow screen. */
  sleep?: boolean;
  cls?: string;
  /** Leave out the ground shadow (app icon). */
  noShadow?: boolean;
}

export function dogSvg(o: DogOptions = {}): string {
  const eyes = o.sleep
    ? `<g class="dog-eyes">${part('M74 71 C78 75 86 75 90 71', null)}${part('M110 71 C114 75 122 75 126 71', null)}</g>`
    : `<g class="dog-eyes"><path data-fill d="${ell(82, 70, 6.5, 7.5)}" fill="${INK}"/><path data-fill d="${ell(118, 70, 6.5, 7.5)}" fill="${INK}"/><path data-fill d="${ell(84.5, 67, 2.2, 2.2)}" fill="#fff"/><path data-fill d="${ell(120.5, 67, 2.2, 2.2)}" fill="#fff"/></g>`;
  return `<svg class="dog ${o.cls ?? ''}" viewBox="0 0 200 200" aria-hidden="true">
  ${o.noShadow ? '' : `<ellipse class="dog-shadow" cx="100" cy="188" rx="64" ry="7" fill="rgba(0,0,0,.28)"/>`}
  <g class="dog-tail">${part('M178 128 C194 118 198 100 188 92 C184 90 180 94 182 100 C184 108 176 116 170 120 Z', TAN)}</g>
  <g class="dog-body">
    ${part(ell(100, 134, 90, 58), TAN)}
    ${part(ell(100, 148, 62, 36), CREAM, false)}
    ${part('M56 156 C80 168 120 168 144 156', null)}${part('M70 170 C88 178 112 178 130 170', null)}
    ${part(ell(42, 182, 14, 8), TAN)}${part(ell(76, 188, 13, 7), TAN)}${part(ell(124, 188, 13, 7), TAN)}${part(ell(158, 182, 14, 8), TAN)}
  </g>
  <g class="dog-head">
    ${part('M56 60 C36 62 30 98 44 114 C56 110 62 92 68 74 Z', BROWN)}
    ${part('M144 60 C164 62 170 98 156 114 C144 110 138 92 132 74 Z', BROWN)}
    ${part(ell(100, 80, 52, 44), TAN)}
    <path data-fill d="${ell(121, 66, 15, 13)}" fill="${BROWN}" fill-opacity=".55"/>
    ${part(ell(100, 98, 28, 19), CREAM)}
    <path data-fill d="${ell(68, 94, 7, 5)}" fill="#FF8FA3" fill-opacity=".7"/><path data-fill d="${ell(132, 94, 7, 5)}" fill="#FF8FA3" fill-opacity=".7"/>
    ${eyes}
    ${part(ell(100, 88, 9, 6.5), INK)}
    ${part('M100 94 L100 99 M88 101 C94 107 106 107 112 101', null)}
    ${o.sleep ? '' : part('M95 104 C95 114 105 114 105 104 Z', '#FF6F8E')}
    ${part('M60 118 C82 132 118 132 140 118', null, true)}
    <path data-draw d="M60 118 C82 132 118 132 140 118" stroke="#E5484D" stroke-width="7" stroke-linecap="round" fill="none"/>
    ${part(ell(100, 131, 6.5, 6.5), '#FFD25A')}
  </g>
  ${o.sleep ? `<text class="dog-z" x="150" y="44" font-size="26" font-weight="900" fill="#fff">z</text><text class="dog-z z2" x="166" y="26" font-size="18" font-weight="900" fill="#fff">z</text>` : ''}
</svg>`;
}

/** A standalone file version (no animation attributes needed) for icons. */
export const DOG_ICON_SVG = (): string => dogSvg({ noShadow: true });
