// Muddles: the minions. Small mischief-makers who mix up sums. Each one holds up a sign
// with a wrong sum; beat it (enough right answers) and the sign is put right. Drawn in the
// same style as Plus and the bosses: a thick ink outline, soft colour and big eyes.
// Also the fight effects that used to be emoji: Plus's star (what you throw), a boss's
// orb, the shield when you block and the splat when you don't.

const INK = '#1B1440';
let uid = 0;

/** Body colours by stage (light, dark). */
const COLOURS: Record<number, [string, string]> = {
  1: ['#A8EBFF', '#3BA9E8'],
  2: ['#FFD59A', '#FF8A3D'],
  3: ['#BDF5A0', '#34B158'],
  4: ['#DCCBFF', '#8257E6'],
  5: ['#FFB8CA', '#E8507A'],
  6: ['#A6F0E6', '#1FA394'],
  7: ['#CDD2EC', '#5A6190'],
};

/** Each stage's mixed-up sums, and what they should say. */
const SUMS: Record<number, [string, string][]> = {
  1: [['2+1=4', '2+1=3'], ['3+2=6', '3+2=5'], ['1+1=3', '1+1=2']],
  2: [['5+5=11', '5+5=10'], ['9+3=11', '9+3=12'], ['8+4=13', '8+4=12']],
  3: [['40+7=74', '40+7=47'], ['25+5=35', '25+5=30'], ['63−8=57', '63−8=55']],
  4: [['6×7=41', '6×7=42'], ['8×3=21', '8×3=24'], ['9×6=56', '9×6=54']],
  5: [['½+½=2', '½+½=1'], ['¼=0.4', '¼=0.25'], ['⅓>½', '⅓<½']],
  6: [['3²=6', '3²=9'], ['√16=8', '√16=4'], ['2³=6', '2³=8']],
  7: [['√9=4.5', '√9=3'], ['5²=10', '5²=25'], ['2⁵=10', '2⁵=32']],
};

export const muddleSum = (stage: number, n: number): [string, string] => {
  const l = SUMS[stage] ?? SUMS[1];
  return l[n % l.length];
};

/** Three body shapes: a round blob with tufts, a tall one with a curly antenna, a wide one with horns. */
function bodyPath(kind: number): { d: string; top: string } {
  if (kind === 1)
    return {
      d: 'M100 52 C140 52 158 84 156 122 C154 158 132 176 100 176 C68 176 46 158 44 122 C42 84 60 52 100 52 Z',
      top: `<path d="M100 54 C98 38 110 30 120 36 C128 41 124 52 114 50" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="114" cy="48" r="6" fill="#FFCF5C" stroke="${INK}" stroke-width="4"/>`,
    };
  if (kind === 2)
    return {
      d: 'M100 66 C152 64 176 92 174 128 C172 162 142 178 100 178 C58 178 28 162 26 128 C24 92 48 68 100 66 Z',
      top: `<path d="M58 78 C48 60 52 46 60 40 C66 58 72 66 76 70 Z" fill="#FFF3D6" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><path d="M142 78 C152 60 148 46 140 40 C134 58 128 66 124 70 Z" fill="#FFF3D6" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`,
    };
  return {
    d: 'M100 46 C146 46 168 82 164 120 C161 156 134 178 100 178 C66 178 39 156 36 120 C32 82 54 46 100 46 Z',
    top: `<path d="M78 52 C74 40 80 32 88 34 C88 42 90 46 92 48 M100 46 C100 34 106 28 112 32 C110 38 108 42 106 46 M120 50 C124 40 132 38 136 44 C130 46 126 50 124 54" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
}

/** A Muddle for this stage (n picks its shape and sum). */
export function muddleSvg(stage: number, n: number): string {
  const u = ++uid;
  const [lo, hi] = COLOURS[stage] ?? COLOURS[1];
  const kind = n % 3;
  const b = bodyPath(kind);
  const [wrong] = muddleSum(stage, n);
  const eyeY = kind === 2 ? 108 : 104;
  return `<svg class="muddle" viewBox="0 0 200 210" aria-hidden="true">
    <defs><radialGradient id="mdG${u}" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="${lo}"/><stop offset="1" stop-color="${hi}"/></radialGradient></defs>
    <ellipse class="md-shadow" cx="100" cy="200" rx="54" ry="7" fill="rgba(0,0,0,.18)"/>
    <g class="md-feet"><ellipse cx="78" cy="182" rx="15" ry="8" fill="${INK}"/><ellipse cx="122" cy="182" rx="15" ry="8" fill="${INK}"/></g>
    ${b.top}
    <path d="${b.d}" fill="url(#mdG${u})" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M64 92 C70 78 82 70 96 68" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".55"/>
    <g class="md-eyes">
      <ellipse cx="80" cy="${eyeY}" rx="13" ry="15" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <ellipse cx="121" cy="${eyeY - 2}" rx="16" ry="18" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <circle class="md-pupil" cx="84" cy="${eyeY + 3}" r="6" fill="${INK}"/><circle class="md-pupil" cx="125" cy="${eyeY + 2}" r="7" fill="${INK}"/>
      <circle cx="86" cy="${eyeY}" r="2" fill="#fff"/><circle cx="128" cy="${eyeY - 1}" r="2.4" fill="#fff"/>
    </g>
    <path class="md-brow" d="M66 ${eyeY - 22} L92 ${eyeY - 16} M108 ${eyeY - 24} L136 ${eyeY - 30}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path class="md-grin" d="M82 ${eyeY + 30} C92 ${eyeY + 40} 112 ${eyeY + 40} 122 ${eyeY + 26}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M104 ${eyeY + 36} l4 8 l5 -9" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <g class="md-sign">
      <path d="M158 190 L166 156" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
      <rect x="118" y="122" width="80" height="40" rx="9" fill="#fff" stroke="${INK}" stroke-width="5" transform="rotate(-8 158 142)"/>
      <text class="md-sum" x="158" y="149" text-anchor="middle" transform="rotate(-8 158 142)" font-size="${wrong.length > 6 ? 16 : 20}" font-weight="900" fill="${INK}">${wrong}</text>
      <circle cx="158" cy="184" r="9" fill="${lo}" stroke="${INK}" stroke-width="4.5"/>
    </g>
  </svg>`;
}

/** Beaten: the sign is put right (and goes green). */
export function fixMuddle(host: Element, stage: number, n: number): void {
  const t = host.querySelector<SVGTextElement>('.md-sum');
  if (!t) return;
  const right = muddleSum(stage, n)[1];
  t.textContent = right;
  t.setAttribute('font-size', right.length > 6 ? '16' : '20');
  host.querySelector('.muddle')?.classList.add('fixed');
}

// ── fight effects ───────────────────────────────────────────────────────────

/** Plus's star: what flies at a minion or a boss when you answer right. */
export function starShot(): string {
  return `<svg class="fx-star" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill="#FFD25A" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M50 38 v24 M38 50 h24" stroke="${INK}" stroke-width="7" stroke-linecap="round"/></svg>`;
}

/** A boss's shot: a glowing orb in its colour. */
export function orbShot(color: string): string {
  return `<svg class="fx-orb" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="${color}" opacity=".35"/><circle cx="50" cy="50" r="27" fill="${color}" stroke="${INK}" stroke-width="5"/><circle cx="41" cy="41" r="8" fill="#fff" opacity=".7"/></svg>`;
}

/** A good block: a shield ring. */
export function shieldFx(): string {
  return `<svg class="fx-shield" viewBox="0 0 120 120" aria-hidden="true"><path d="M60 10 L100 24 C100 66 86 92 60 108 C34 92 20 66 20 24 Z" fill="#7FD6FF" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M42 58 L55 72 L80 44" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** A missed block: a splat in the boss's colour. */
export function splatFx(color: string): string {
  return `<svg class="fx-splat" viewBox="0 0 120 120" aria-hidden="true"><path d="M60 18 C70 34 84 20 88 36 C104 34 98 52 108 58 C96 66 106 82 90 84 C90 100 72 92 64 104 C56 92 40 102 36 86 C20 88 26 72 14 64 C26 56 16 42 32 40 C30 24 48 32 60 18 Z" fill="${color}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><circle cx="48" cy="54" r="6" fill="#fff" opacity=".7"/></svg>`;
}
