// Biscuit, the Study Hard mascot: a very round, very happy golden retriever, sitting turned a
// little to one side (three-quarter view). Drawn as layered SVG so it can draw itself in line
// by line (data-draw strokes), then colour in (data-fill shapes), then wobble, wag and blink.

const INK = '#3A2416';
const GOLD = '#EBAA4C'; // coat
const CREAM = '#F9DDA2'; // light feathering: chest, muzzle
const DEEP = '#C67E2C'; // ears and shading
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
    ? `<g class="dog-eyes">${part('M64 63 C67 66 72 66 75 63', null)}${part('M94 63 C97 67 104 67 107 63', null)}</g>`
    : `<g class="dog-eyes"><path data-fill d="${ell(70, 62, 5, 6)}" fill="${INK}"/><path data-fill d="${ell(101, 62, 6.5, 7.5)}" fill="${INK}"/><path data-fill d="${ell(72, 59.5, 1.7, 1.7)}" fill="#fff"/><path data-fill d="${ell(103.5, 59, 2.3, 2.3)}" fill="#fff"/></g>`;
  return `<svg class="dog ${o.cls ?? ''}" viewBox="0 0 200 200" aria-hidden="true">
  ${o.noShadow ? '' : `<ellipse class="dog-shadow" cx="108" cy="190" rx="78" ry="7" fill="rgba(0,0,0,.28)"/>`}
  <g class="dog-tail">${part('M150 170 C176 174 198 160 194 138 C200 132 198 124 190 122 C190 130 186 130 184 126 C182 140 176 150 158 156 Z', GOLD)}${part('M186 138 C184 146 178 150 170 152', null)}</g>
  <g class="dog-body">
    ${part('M54 106 C24 126 18 172 44 188 C68 202 142 202 164 188 C186 172 180 122 150 104 C128 90 76 90 54 106 Z', GOLD)}
    ${part(ell(144, 158, 36, 30), GOLD)}
    ${part('M136 168 C144 178 156 180 166 172', null)}
    ${part(ell(164, 188, 15, 7), GOLD)}
    ${part(ell(80, 150, 42, 38), CREAM, false)}
    ${part('M54 126 C60 136 66 128 72 138 C78 130 84 142 90 134 C96 142 102 132 108 138 C112 130 116 132 118 124', null)}
    ${part('M64 150 L64 184 C64 192 82 192 82 184 L82 152', GOLD)}
    ${part('M92 152 L92 186 C92 194 110 194 110 186 L110 150', GOLD)}
    ${part(ell(73, 188, 13, 6), GOLD)}${part(ell(101, 190, 13, 6), GOLD)}
  </g>
  <g class="dog-head">
    ${part('M56 46 C40 50 30 74 34 94 C36 104 44 102 48 98 C54 84 58 64 64 54 Z', DEEP)}
    ${part(ell(88, 70, 46, 42), GOLD)}
    ${part('M76 30 C80 24 84 30 88 24 C92 30 96 26 100 32', null)}
    ${part('M116 40 C138 40 150 66 148 92 C148 106 140 104 138 112 C132 106 126 110 124 100 C120 86 116 66 108 52 Z', DEEP)}
    ${part(ell(74, 86, 26, 18), CREAM)}
    <path data-fill d="${ell(108, 84, 7, 5)}" fill="#FF8FA3" fill-opacity=".7"/>
    ${eyes}
    ${part(ell(62, 78, 8.5, 6.5), INK)}
    ${part('M62 84 L64 90 M54 92 C62 99 76 99 86 90', null)}
    ${o.sleep ? '' : part('M64 95 C64 106 76 106 76 95 Z', '#FF6F8E')}
    ${part('M48 108 C70 122 108 122 130 104', null)}
    <path data-draw d="M48 108 C70 122 108 122 130 104" stroke="#3D7BFF" stroke-width="7" stroke-linecap="round" fill="none"/>
    ${part(ell(88, 120, 6.5, 6.5), '#FFD25A')}
  </g>
  ${o.sleep ? `<text class="dog-z" x="130" y="40" font-size="26" font-weight="900" fill="#fff">z</text><text class="dog-z z2" x="148" y="22" font-size="18" font-weight="900" fill="#fff">z</text>` : ''}
</svg>`;
}

/** The dog without its shadow, for icons. */
export const DOG_ICON_SVG = (): string => dogSvg({ noShadow: true });
