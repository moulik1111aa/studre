// Plus, the Study Hard mascot: a chunky yellow plus sign with a face, white gloves on its
// arms and little feet, so it can wave, point and run. plusFaceSvg() is the logo, app icon and the
// helper in lessons and tips; plusSvg() adds a ground shadow for the big moments (welcome,
// video, night screen). CSS animates it (.mascot.alive): the raised glove waves, it bobs and blinks;
// .oops tips it over into a × (a wrong answer), .spin turns it like a pinwheel (a treat).

export interface PlusOptions {
  /** Closed eyes and a "z" (the see-you-tomorrow screen). */
  sleep?: boolean;
  cls?: string;
  /** Leave out the ground shadow. */
  noShadow?: boolean;
  /** Adventure wardrobe: what Plus is wearing (item ids by slot, see core/wardrobe.ts). */
  outfit?: Outfit;
}

export type Outfit = Partial<Record<'hat' | 'face' | 'neck' | 'colour' | 'trail', string>>;

/** Gradient ids must be unique per drawing on the page. */
let uid = 0;

export const PLUS_INK = '#1A1446';
const C = { ink: PLUS_INK, top: '#FFE27A', mid: '#FFC531', low: '#FFAE1A', cheek: '#FF7FA3', tongue: '#FF6F91' };
/** The two bars of the plus (centre 100, 88), with gloves on the arms and feet below. */
const V = 'x="66" y="8" width="68" height="160" rx="13"';
const H = 'x="18" y="56" width="164" height="64" rx="13"';

/** Body colours from the wardrobe: top, middle and bottom of the gradient. */
const COLOURS: Record<string, [string, string, string]> = {
  mint: ['#C4F7E2', '#5BE3B0', '#22B983'],
  sky: ['#C9EBFF', '#66C2FF', '#3A92EA'],
  snow: ['#FFFFFF', '#F0F3FA', '#C9D3E3'],
  bubblegum: ['#FFD6E7', '#FF8FBE', '#EE5C97'],
  grape: ['#E2D4FF', '#A983FF', '#7A52EE'],
  sunset: ['#FFE38A', '#FF9A4D', '#FF5E7A'],
  'octo-purple': ['#E6D2FF', '#B07CFF', '#7B3FE4'],
  stone: ['#E3E7EA', '#AAB4BC', '#7D8A94'],
  jelly: ['#FFE1EC', '#FF9EC2', '#F06292'],
};

const I = PLUS_INK;
const star = (cx: number, cy: number, r: number, inner = r * 0.45) =>
  Array.from({ length: 10 }, (_, k) => {
    const a = (Math.PI / 5) * k - Math.PI / 2;
    const rr = k % 2 ? inner : r;
    return `${k ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ') + 'Z';
const heart = (cx: number, cy: number) => `M${cx} ${cy + 11} C${cx - 18} ${cy} ${cx - 12} ${cy - 15} ${cx} ${cy - 6} C${cx + 12} ${cy - 15} ${cx + 18} ${cy} ${cx} ${cy + 11} Z`;
const flower = (x: number, y: number, r: number, petal: string) =>
  `<g>${Array.from({ length: 5 }, (_, k) => {
    const a = (2 * Math.PI * k) / 5;
    return `<circle cx="${(x + r * Math.cos(a)).toFixed(1)}" cy="${(y + r * Math.sin(a)).toFixed(1)}" r="${r * 0.8}" fill="${petal}" stroke="${I}" stroke-width="1.6"/>`;
  }).join('')}<circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="#FFD25A" stroke="${I}" stroke-width="1.6"/></g>`;
/** Points along a quadratic curve, for flowers on a crown or a necklace. */
const along = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number) =>
  Array.from({ length: n }, (_, k) => {
    const t = k / (n - 1);
    return [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1] as const;
  });

/** Wardrobe drawings, in Plus's own coordinates (the head's top edge is at y = 8). */
const HATS: Record<string, string> = {
  'party-hat': `<path d="M72 18 L100 -40 L128 18 Z" fill="#FF7FA3" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><path d="M80 6 H120 M86 -6 H114 M92 -20 H108" stroke="#FFE27A" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="-42" r="8" fill="#FFE27A" stroke="${I}" stroke-width="4"/>`,
  cap: `<path d="M66 20 C66 -14 134 -14 134 20 Z" fill="#3D7BFF" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><path d="M118 19 L166 19 Q174 28 160 31 L116 31 Z" fill="#2B5FD9" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><circle cx="100" cy="-7" r="5" fill="#FFE27A" stroke="${I}" stroke-width="3"/>`,
  'flower-crown': `<path d="M64 16 Q100 0 136 16" fill="none" stroke="#22A36F" stroke-width="5" stroke-linecap="round"/>${along(66, 15, 100, -2, 134, 15, 5).map(([x, y], k) => flower(x, y - 3, 6, ['#FF8FBE', '#FFFFFF', '#7FD3FF', '#FFFFFF', '#FF8FBE'][k])).join('')}`,
  'chef-hat': `<path d="M72 20 V0 C56 -4 58 -30 78 -27 C80 -46 120 -46 122 -27 C142 -30 144 -4 128 0 V20 Z" fill="#FFFFFF" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><path d="M73 8 H127" stroke="${I}" stroke-width="3" opacity=".25"/>`,
  headphones: `<path d="M58 76 C52 -20 148 -20 142 76" fill="none" stroke="${I}" stroke-width="12" stroke-linecap="round"/><path d="M58 76 C52 -20 148 -20 142 76" fill="none" stroke="#FF5A5A" stroke-width="5" stroke-linecap="round"/><rect x="42" y="58" width="26" height="42" rx="11" fill="#FF5A5A" stroke="${I}" stroke-width="5"/><rect x="132" y="58" width="26" height="42" rx="11" fill="#FF5A5A" stroke="${I}" stroke-width="5"/>`,
  'bunny-ears': `<g fill="#FFFFFF" stroke="${I}" stroke-width="5"><ellipse cx="82" cy="-20" rx="13" ry="34" transform="rotate(-12 82 -20)"/><ellipse cx="118" cy="-20" rx="13" ry="34" transform="rotate(12 118 -20)"/></g><g fill="#FFB3C7"><ellipse cx="82" cy="-18" rx="5.5" ry="24" transform="rotate(-12 82 -18)"/><ellipse cx="118" cy="-18" rx="5.5" ry="24" transform="rotate(12 118 -18)"/></g>`,
  'pirate-hat': `<path d="M48 20 C60 -32 140 -32 152 20 C122 8 78 8 48 20 Z" fill="#2A2540" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><path d="M52 17 C82 6 118 6 148 17" fill="none" stroke="#FFD25A" stroke-width="3"/><circle cx="100" cy="-8" r="7" fill="#FFFFFF"/><path d="M89 5 L111 -3 M89 -3 L111 5" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>`,
  'wizard-hat': `<path d="M56 20 C80 12 92 -10 106 -48 C110 -20 120 6 144 20 Z" fill="#6C4CF5" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><ellipse cx="100" cy="20" rx="52" ry="8" fill="#5038C8" stroke="${I}" stroke-width="5"/><path d="${star(100, -4, 9)}" fill="#FFE27A"/><circle cx="86" cy="8" r="3" fill="#FFE27A"/><circle cx="117" cy="2" r="2.5" fill="#FFE27A"/>`,
  crown: `<path d="M68 20 L63 -22 L84 -2 L100 -32 L116 -2 L137 -22 L132 20 Z" fill="#FFD25A" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><circle cx="100" cy="6" r="5.5" fill="#FF5A7A" stroke="${I}" stroke-width="2.5"/><circle cx="81" cy="8" r="4" fill="#3D7BFF" stroke="${I}" stroke-width="2.5"/><circle cx="119" cy="8" r="4" fill="#22B983" stroke="${I}" stroke-width="2.5"/>`,
  'space-helmet': `<circle cx="100" cy="64" r="76" fill="rgba(170,215,255,.25)" stroke="#E8F2FF" stroke-width="7"/><circle cx="100" cy="64" r="76" fill="none" stroke="${I}" stroke-width="2.5" opacity=".55"/><path d="M54 28 Q70 2 100 -4" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".85"/><path d="M100 -12 V-34" stroke="${I}" stroke-width="4"/><circle cx="100" cy="-38" r="7" fill="#FF5A5A" stroke="${I}" stroke-width="3"/>`,
};
Object.assign(HATS, {
  'dino-spikes': `<path d="M64 20 L69 -22 L84 12 L92 -34 L102 10 L110 -30 L120 12 L131 -20 L136 20 Z" fill="#4CAF6A" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><path d="M69 -22 L74 0 M92 -34 L95 -6 M110 -30 L112 -4 M131 -20 L130 2" stroke="#2E7D4A" stroke-width="3" stroke-linecap="round"/>`,
  nightcap: `<path d="M62 22 C62 -16 126 -30 164 6 C150 6 138 6 134 22 Z" fill="#5C7CFA" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><circle cx="84" cy="2" r="3" fill="#fff"/><circle cx="104" cy="-8" r="3" fill="#fff"/><circle cx="122" cy="-4" r="3" fill="#fff"/><rect x="60" y="14" width="80" height="12" rx="6" fill="#fff" stroke="${I}" stroke-width="4"/><circle cx="166" cy="8" r="10" fill="#fff" stroke="${I}" stroke-width="4"/>`,
});
const FACES: Record<string, string> = {
  'round-glasses': `<g fill="rgba(255,255,255,.18)" stroke="${I}" stroke-width="4"><circle cx="85" cy="82" r="13"/><circle cx="115" cy="82" r="13"/></g><path d="M98 80 Q100 76 102 80 M72 80 L64 75 M128 80 L136 75" fill="none" stroke="${I}" stroke-width="4" stroke-linecap="round"/>`,
  sunglasses: `<path d="M67 73 H98 V85 Q98 96 86 96 H80 Q67 96 67 85 Z M102 73 H133 V85 Q133 96 121 96 H114 Q102 96 102 85 Z" fill="${I}" stroke="${I}" stroke-width="3" stroke-linejoin="round"/><path d="M98 77 H102" stroke="${I}" stroke-width="4"/><path d="M73 79 H82 M108 79 H117" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".75"/>`,
  'heart-glasses': `<g fill="#FF6F91" fill-opacity=".78" stroke="${I}" stroke-width="3.5" stroke-linejoin="round"><path d="${heart(85, 82)}"/><path d="${heart(115, 82)}"/></g><path d="M97 80 Q100 77 103 80" fill="none" stroke="${I}" stroke-width="3.5"/>`,
  'star-glasses': `<g fill="#FFD25A" fill-opacity=".72" stroke="${I}" stroke-width="3" stroke-linejoin="round"><path d="${star(85, 82, 17, 8)}"/><path d="${star(115, 82, 17, 8)}"/></g>`,
  'pixel-shades': `<path d="M64 73 H136 V81 H124 V91 H106 V81 H94 V91 H76 V81 H64 Z" fill="${I}"/><path d="M80 77 h6 v4 h-6z M110 77 h6 v4 h-6z" fill="#fff"/>`,
  monocle: `<circle cx="115" cy="82" r="14" fill="rgba(255,255,255,.2)" stroke="#E0A400" stroke-width="4.5"/><path d="M128 89 Q142 110 126 124" fill="none" stroke="#E0A400" stroke-width="2.5"/>`,
};
const NECKS: Record<string, string> = {
  'bow-tie': `<path d="M100 128 L77 115 L77 141 Z M100 128 L123 115 L123 141 Z" fill="#6C4CF5" stroke="${I}" stroke-width="4" stroke-linejoin="round"/><circle cx="100" cy="128" r="6.5" fill="#8B6DFF" stroke="${I}" stroke-width="4"/>`,
  scarf: `<path d="M110 128 L126 166 L110 169 L100 132 Z" fill="#FF5A5A" stroke="${I}" stroke-width="4" stroke-linejoin="round"/><rect x="61" y="115" width="78" height="18" rx="9" fill="#FF5A5A" stroke="${I}" stroke-width="4"/><path d="M74 117 V131 M90 117 V131 M106 117 V131 M122 117 V131" stroke="#FFE27A" stroke-width="3" opacity=".85"/>`,
  'flower-lei': `${along(64, 116, 100, 150, 136, 116, 7).map(([x, y], k) => flower(x, y, 5, ['#FF8FBE', '#FFFFFF', '#FFB35C', '#FF8FBE', '#FFFFFF', '#FFB35C', '#FF8FBE'][k])).join('')}`,
  medal: `<path d="M84 114 L100 142 L116 114" fill="none" stroke="#3D7BFF" stroke-width="8" stroke-linejoin="round"/><path d="M91 114 L100 131 L109 114" fill="none" stroke="#FF5A5A" stroke-width="3"/><circle cx="100" cy="150" r="13" fill="#FFD25A" stroke="${I}" stroke-width="4"/><path d="${star(100, 150, 7)}" fill="#E0A400"/>`,
};
/** Drawn behind Plus. */
const WING = `<path d="M74 54 C56 12 24 -4 -6 -10 C4 16 8 32 16 50 C28 42 42 44 52 56 Z" fill="#FF7043" stroke="${I}" stroke-width="5" stroke-linejoin="round"/><path d="M66 46 C50 26 28 12 6 2 M60 52 C44 38 30 30 12 26" fill="none" stroke="${I}" stroke-width="3" opacity=".35"/>`;
const BACKS: Record<string, string> = {
  'dragon-wings': `${WING}<g transform="translate(200 0) scale(-1 1)">${WING}</g>`,
  cape: `<path d="M70 58 C50 90 40 150 32 192 Q100 206 168 192 C160 150 150 90 130 58 Z" fill="#E84A5F" stroke="${I}" stroke-width="5" stroke-linejoin="round"/>`,
};

function body(o: PlusOptions, u: number): string {
  const eye = (x: number) =>
    `<ellipse cx="${x}" cy="82" rx="7.5" ry="9.5" fill="${C.ink}"/><circle cx="${x + 2.4}" cy="78.5" r="3" fill="#fff"/><circle cx="${x - 2.2}" cy="86" r="1.2" fill="#fff" opacity=".7"/>`;
  const eyes = o.sleep
    ? `<path d="M78 83 C81 88 89 88 92 83 M108 83 C111 88 119 88 122 83" fill="none" stroke="${C.ink}" stroke-width="4.5" stroke-linecap="round"/>`
    : eye(86) + eye(114);
  const mouth = o.sleep
    ? `<ellipse cx="100" cy="101" rx="4.5" ry="3.5" fill="${C.ink}"/>`
    : `<path d="M86 97 Q100 117 114 97 Q100 103 86 97 Z" fill="${C.ink}"/><path d="M93 104 Q100 112 107 104 Q100 106 93 104 Z" fill="${C.tongue}"/>`;
  const glove = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="11" fill="#fff" stroke="${C.ink}" stroke-width="5.5"/><path d="M${cx - 4} ${cy - 3} q2 -4 6 -4" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" opacity=".35"/>`;
  const [top, mid, low] = COLOURS[o.outfit?.colour ?? ''] ?? [C.top, C.mid, C.low];
  const fit = o.outfit ?? {};
  const back = fit.neck && BACKS[fit.neck] ? `<g class="px-acc px-back">${BACKS[fit.neck]}</g>` : '';
  const neck = fit.neck && NECKS[fit.neck] ? `<g class="px-acc px-neck">${NECKS[fit.neck]}</g>` : '';
  const glasses = fit.face && FACES[fit.face] && !o.sleep ? `<g class="px-acc px-glasses">${FACES[fit.face]}</g>` : '';
  const hat = fit.hat && HATS[fit.hat] ? `<g class="px-acc px-hat" data-item="${fit.hat}">${HATS[fit.hat]}</g>` : '';
  return `<defs><linearGradient id="pxFill${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${low}"/></linearGradient></defs>
  <g class="px-body">${back}
    <g class="px-legs" stroke="${C.ink}" stroke-width="7" stroke-linecap="round"><path d="M88 166 L84 190"/><path d="M112 166 L116 190"/></g>
    <ellipse cx="79" cy="193" rx="12.5" ry="6.5" fill="${C.ink}"/><ellipse cx="121" cy="193" rx="12.5" ry="6.5" fill="${C.ink}"/>
    <g fill="${C.ink}" stroke="${C.ink}" stroke-width="12"><rect ${V}/><rect ${H}/></g>
    <g fill="url(#pxFill${u})"><rect ${V}/><rect ${H}/></g>
    <path d="M80 26 C81 19 86 16 93 16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
    <g class="px-glove-l">${glove(16, 92)}</g>
    <g class="px-h">${glove(186, 66)}</g>
    <g class="px-face">
      <g class="px-eyes">${eyes}</g>
      <ellipse cx="75" cy="98" rx="7" ry="4.2" fill="${C.cheek}" opacity=".55"/><ellipse cx="125" cy="98" rx="7" ry="4.2" fill="${C.cheek}" opacity=".55"/>
      ${mouth}
    </g>
    ${neck}${glasses}${hat}
  </g>`;
}

/** Room above the head for a hat. */
const hatRoom = (o: PlusOptions) => (o.outfit?.hat && HATS[o.outfit.hat] ? 50 : o.outfit?.neck === 'dragon-wings' ? 20 : 0);

/** Plus on its own (no shadow): the logo, the app icon and the helper in lessons and tips. */
export function plusFaceSvg(o: PlusOptions = {}): string {
  const u = ++uid;
  const top = hatRoom(o);
  return `<svg class="mascot plus ${o.cls ?? ''}" viewBox="0 ${-top} 200 ${204 + top}" aria-hidden="true">${body(o, u)}</svg>`;
}

/** Plus standing on the ground, for the big moments. */
export function plusSvg(o: PlusOptions = {}): string {
  const u = ++uid;
  const top = hatRoom(o);
  return `<svg class="mascot plus ${o.cls ?? ''}" viewBox="0 ${-top} 200 ${212 + top}" aria-hidden="true">
  ${o.noShadow ? '' : '<ellipse class="px-shadow" cx="100" cy="203" rx="56" ry="6.5" fill="rgba(0,0,0,.2)"/>'}
  ${body(o, u)}
  ${o.sleep ? `<text class="px-z" x="150" y="30" font-size="26" font-weight="900" fill="currentColor">z</text><text class="px-z z2" x="168" y="12" font-size="17" font-weight="900" fill="currentColor">z</text>` : ''}
</svg>`;
}
