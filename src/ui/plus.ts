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
}

/** Gradient ids must be unique per drawing on the page. */
let uid = 0;

export const PLUS_INK = '#1A1446';
const C = { ink: PLUS_INK, top: '#FFE27A', mid: '#FFC531', low: '#FFAE1A', cheek: '#FF7FA3', tongue: '#FF6F91' };
/** The two bars of the plus (centre 100, 88), with gloves on the arms and feet below. */
const V = 'x="66" y="8" width="68" height="160" rx="13"';
const H = 'x="18" y="56" width="164" height="64" rx="13"';

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
  return `<defs><linearGradient id="pxFill${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.top}"/><stop offset=".55" stop-color="${C.mid}"/><stop offset="1" stop-color="${C.low}"/></linearGradient></defs>
  <g class="px-body">
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
  </g>`;
}

/** Plus on its own (no shadow): the logo, the app icon and the helper in lessons and tips. */
export function plusFaceSvg(o: PlusOptions = {}): string {
  const u = ++uid;
  return `<svg class="mascot plus ${o.cls ?? ''}" viewBox="0 0 200 204" aria-hidden="true">${body(o, u)}</svg>`;
}

/** Plus standing on the ground, for the big moments. */
export function plusSvg(o: PlusOptions = {}): string {
  const u = ++uid;
  return `<svg class="mascot plus ${o.cls ?? ''}" viewBox="0 0 200 212" aria-hidden="true">
  ${o.noShadow ? '' : '<ellipse class="px-shadow" cx="100" cy="203" rx="56" ry="6.5" fill="rgba(0,0,0,.2)"/>'}
  ${body(o, u)}
  ${o.sleep ? `<text class="px-z" x="150" y="30" font-size="26" font-weight="900" fill="currentColor">z</text><text class="px-z z2" x="168" y="12" font-size="17" font-weight="900" fill="currentColor">z</text>` : ''}
</svg>`;
}
