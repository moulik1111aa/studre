// Biscuit, the Study Hard mascot: a very round golden retriever puppy in a flat, softly
// shaded style. dogHeadSvg() is the logo and app icon; dogSvg() is the whole dog sitting,
// used on the loader, welcome and night screens. Groups dog-head, dog-body, dog-tail and
// dog-eyes are animated by CSS (.dog.alive) to wobble, wag and blink.

export interface DogOptions {
  /** Closed eyes and a "z" (the see-you-tomorrow screen). */
  sleep?: boolean;
  cls?: string;
  /** Leave out the ground shadow. */
  noShadow?: boolean;
}

/** Gradient ids must be unique per drawing on the page. */
let uid = 0;

const C = { coat: '#E9A54B', light: '#F7CE87', cream: '#FCE6BF', ear: '#C97D33', earDeep: '#B36A27', shade: '#D48F3E', ink: '#2A1C17', tongue: '#F0899A', tongueDeep: '#D9667A' };
const mirror = (d: string): string => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_: string, x: string, y: string) => `${200 - Number(x)} ${y}`);
function headParts(o: DogOptions, u: number): string {
  // Feathered ear: set high, folds forward, wavy fringe at the bottom.
  const earL = 'M70 50 C50 46 32 58 26 80 C21 98 24 118 32 130 C35 126 38 132 42 128 C45 134 50 130 52 126 C56 130 60 124 62 118 C64 98 66 74 76 58 Z';
  const earFold = 'M64 60 C50 64 40 78 37 96 C36 108 38 118 42 124 C46 112 50 96 56 82 C60 72 62 66 66 62 Z';
  // Head: domed top, very round cheeks with small fur tufts at the jaw.
  const headD = 'M100 34 C134 34 156 54 160 84 C163 102 162 118 157 130 L163 136 L155 138 L159 146 L150 146 C139 159 120 166 100 166 C80 166 61 159 50 146 L41 146 L45 138 L37 136 L43 130 C38 118 37 102 40 84 C44 54 66 34 100 34 Z';
  // Fluffy ruff under the chin (the fat, fluffy neck).
  const ruff = 'M46 118 C36 136 38 158 48 170 C46 178 54 182 60 180 C62 188 72 190 78 186 C82 194 92 194 96 188 C100 195 108 194 110 188 C116 194 126 192 128 186 C136 190 146 186 146 178 C154 180 160 172 154 166 C162 154 164 134 154 118 Z';
  const muzzle = 'M100 100 C116 100 132 106 140 118 C148 132 143 148 130 154 C120 158 108 156 100 152 C92 156 80 158 70 154 C57 148 52 132 60 118 C68 106 84 100 100 100 Z';
  const eye = (x: number) => `<ellipse cx="${x}" cy="90" rx="8" ry="9" fill="${C.ink}"/><circle cx="${x + 2.5}" cy="86.5" r="3" fill="#fff"/><circle cx="${x - 2.3}" cy="93.5" r="1.2" fill="#fff" opacity=".7"/>`;
  const brow = (x: number, d: number) => `<path d="M${x - 9} ${79 + d} C${x - 4} ${73} ${x + 4} ${73} ${x + 9} ${79 - d}" fill="none" stroke="${C.earDeep}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`;
  return `<defs><radialGradient id="dgLit${u}" cx=".38" cy=".3" r=".75"><stop offset="0" stop-color="#F6C46E"/><stop offset=".6" stop-color="${C.coat}"/><stop offset="1" stop-color="#DB923D"/></radialGradient>
  <linearGradient id="dgRuff${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9A54B"/><stop offset=".45" stop-color="#F2BE6E"/><stop offset="1" stop-color="#F9D898"/></linearGradient></defs>
  <g class="dog-head">
    <path d="${ruff}" fill="url(#dgRuff${u})"/>
    <path d="M66 168 C70 174 74 176 80 176 M134 168 C130 174 126 176 120 176 M94 178 C97 182 103 182 106 178" fill="none" stroke="#DE9A4A" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
    <path d="${earL}" fill="${C.ear}"/><path d="${mirror(earL)}" fill="${C.ear}"/>
    <path d="${headD}" fill="url(#dgLit${u})"/>
    <path d="${earFold}" fill="${C.ear}"/><path d="${mirror(earFold)}" fill="${C.ear}"/>
    <path d="M44 74 C42 90 42 106 46 118" fill="none" stroke="${C.earDeep}" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>
    <path d="${mirror('M44 74 C42 90 42 106 46 118')}" fill="none" stroke="${C.earDeep}" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>
    
    <path d="${muzzle}" fill="${C.light}"/>
    <path d="M70 152 C80 157 92 156 100 152 C108 156 120 157 130 152 C122 160 110 162 100 158 C90 162 78 160 70 152 Z" fill="${C.cream}" opacity=".9"/>
    ${brow(76, 1)}${brow(124, -1)}
    <g class="dog-eyes">${o.sleep ? `<path d="M68 91 C72 96 80 96 84 91 M116 91 C120 96 128 96 132 91" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>` : eye(76) + eye(124)}</g>
    <ellipse cx="64" cy="114" rx="8" ry="4.5" fill="#F29A86" opacity=".32"/><ellipse cx="136" cy="114" rx="8" ry="4.5" fill="#F29A86" opacity=".32"/>
    <path d="M85 110 C85 101 115 101 115 110 C115 119 105 126 100 126 C95 126 85 119 85 110 Z" fill="${C.ink}"/>
    <ellipse cx="93" cy="107" rx="5.5" ry="2.6" fill="#fff" opacity=".38"/>
    <path d="M100 126 L100 134" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
    ${o.sleep ? '' : `<path d="M90 138 C90 156 110 156 110 138 C106 140 94 140 90 138 Z" fill="${C.tongue}"/><path d="M100 140 L100 149" stroke="${C.tongueDeep}" stroke-width="2" stroke-linecap="round"/>`}
    <path d="M100 134 C96 140 86 142 79 136 M100 134 C104 140 114 142 121 136" fill="none" stroke="${C.ink}" stroke-width="3.2" stroke-linecap="round"/>
  </g>`;
}
/** Just the head: the logo and app icon. */
export function dogHeadSvg(o: DogOptions = {}): string {
  const u = ++uid;
  return `<svg class="dog dog-face ${o.cls ?? ''}" viewBox="0 0 200 200" aria-hidden="true">${headParts(o, u)}</svg>`;
}

/** The whole dog: very round, sitting, front-on, tail to one side. */
export function dogSvg(o: DogOptions = {}): string {
  const u = ++uid;
  const body = 'M100 92 C140 92 166 114 172 146 C178 174 168 192 146 197 L54 197 C32 192 22 174 28 146 C34 114 60 92 100 92 Z';
  const haunch = 'M20 176 C16 152 34 136 56 138 C76 140 86 158 82 178 C78 195 60 199 44 197 C30 195 22 188 20 176 Z';
  const tail = 'M164 176 C178 176 194 160 194 138 C194 128 188 122 182 126 C184 132 180 134 178 130 C176 144 170 152 160 156 C164 160 160 164 156 162 Z';
  return `<svg class="dog ${o.cls ?? ''}" viewBox="0 0 200 210" aria-hidden="true">
  <defs><linearGradient id="dgBody${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDAE55"/><stop offset="1" stop-color="#D88E3B"/></linearGradient>
  <radialGradient id="dgBelly${u}" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#FCE3B0"/><stop offset="1" stop-color="#F3C47A"/></radialGradient></defs>
  ${o.noShadow ? '' : '<ellipse class="dog-shadow" cx="100" cy="200" rx="84" ry="7" fill="rgba(0,0,0,.22)"/>'}
  <g class="dog-tail"><path d="${tail}" fill="${C.coat}"/><path d="M186 132 C186 146 178 156 166 160" fill="none" stroke="${C.light}" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>
  <g class="dog-body">
    <path d="${body}" fill="url(#dgBody${u})"/>
    <path d="${haunch}" fill="${C.coat}"/><path d="${mirror(haunch)}" fill="${C.coat}"/>
    <path d="M30 166 C34 152 48 146 62 150" fill="none" stroke="${C.shade}" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>
    <path d="${mirror('M30 166 C34 152 48 146 62 150')}" fill="none" stroke="${C.shade}" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="100" cy="152" rx="42" ry="42" fill="url(#dgBelly${u})"/>
    <path d="M76 124 C76 150 78 172 79 186 C80 195 98 195 98 186 C99 172 99 150 98 124 Z" fill="${C.coat}"/>
    <path d="M102 124 C101 150 101 172 102 186 C102 195 120 195 121 186 C122 172 124 150 124 124 Z" fill="${C.coat}"/>
    <path d="M98 150 C99 170 99 180 98 186 M102 150 C101 170 101 180 102 186" fill="none" stroke="${C.shade}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    <ellipse cx="89" cy="193" rx="13" ry="6.5" fill="${C.light}"/><ellipse cx="111" cy="193" rx="13" ry="6.5" fill="${C.light}"/>
    <path d="M85 191 L85 195 M93 191 L93 195 M107 191 L107 195 M115 191 L115 195" stroke="${C.shade}" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="40" cy="196" rx="19" ry="6.5" fill="${C.light}"/><ellipse cx="160" cy="196" rx="19" ry="6.5" fill="${C.light}"/>
  </g>
  <g transform="translate(26 -10) scale(.74)">${headParts(o, u)}</g>
  ${o.sleep ? `<text class="dog-z" x="150" y="34" font-size="24" font-weight="700" fill="currentColor">z</text><text class="dog-z z2" x="166" y="16" font-size="16" font-weight="700" fill="currentColor">z</text>` : ''}
</svg>`;
}

/** The head alone, for icons. */
export const DOG_ICON_SVG = (): string => dogHeadSvg();
