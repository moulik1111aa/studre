// The 14 bosses: line-drawn SVG rigs (drawn in, then coloured) and their own animations
// for idle, being hit, attacking, the player's block or miss, phase changes and defeat.

import { drawOn, screenShake, wait, reducedMotion, EASE_OUT, EASE_SPRING } from '../render/motion.ts';
import type { Fx } from '../render/fx.ts';

export const BOSS_EMOJI: Record<string, string> = {
  bubbles: '🫧', gobble: '🧦', hoot: '🦉', tenbeard: '🏴‍☠️', gloop: '🟢', blaze: '🐉', crab: '🦀',
  multiplex: '🤖', fractio: '👨‍🍳', pizzawizard: '🍕', volt: '⛈️', kraken: '🐙', mirror: '🪞', sensei: '🥷',
};

type Idle = 'float' | 'bob' | 'sway' | 'pulse' | 'hover' | 'jitter';
type Path = 'arc' | 'straight' | 'spin' | 'wave' | 'drop' | 'zigzag';
type Defeat = 'pop' | 'sneeze' | 'sleep' | 'sink' | 'melt' | 'shrink' | 'burst' | 'shutdown' | 'faint' | 'eaten' | 'rainbow' | 'knot' | 'shatter' | 'bow';

interface BossArt {
  svg: string;
  idle: Idle;
  /** Boss attack: projectile and how it flies. */
  shot: string;
  shotPath: Path;
  /** Player's weapon (what flies at the boss when you answer right). */
  weapon: string;
  /** Successful block, and what hits you on a miss. */
  block: string;
  splat: string;
  special: string;
  defeat: Defeat;
  /** Defeat leftover emoji (lizard, rainbow, black belt…). */
  after?: string;
  color: string;
}

const O = 'stroke="#1B1440" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const eyes = (x1: number, x2: number, y: number, r = 9) =>
  `<g class="b-eyes"><circle data-fill cx="${x1}" cy="${y}" r="${r}" fill="#fff"/><circle data-fill cx="${x2}" cy="${y}" r="${r}" fill="#fff"/><circle class="pupil" data-fill cx="${x1 + 2}" cy="${y + 1}" r="${r * 0.45}" fill="#1B1440"/><circle class="pupil" data-fill cx="${x2 + 2}" cy="${y + 1}" r="${r * 0.45}" fill="#1B1440"/><circle data-draw cx="${x1}" cy="${y}" r="${r}" ${O}/><circle data-draw cx="${x2}" cy="${y}" r="${r}" ${O}/></g>`;
const brows = (x1: number, x2: number, y: number) => `<g class="b-brow"><path data-draw d="M${x1 - 10} ${y} L${x1 + 8} ${y + 5}" ${O}/><path data-draw d="M${x2 + 10} ${y} L${x2 - 8} ${y + 5}" ${O}/></g>`;
const grad = (id: string, a: string, b: string) => `<defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs>`;

export const ART: Record<string, BossArt> = {
  bubbles: {
    svg: `${grad('g-bub', '#E8FBFF', '#7FD6FF')}<circle data-fill cx="100" cy="105" r="68" fill="url(#g-bub)" opacity=".92"/><circle data-draw cx="100" cy="105" r="68" ${O}/><path data-draw d="M62 78 C70 64 84 56 98 55" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/>${eyes(82, 118, 100, 10)}${brows(82, 118, 84)}<path class="b-mouth" data-draw d="M86 128 C94 138 106 138 114 128" ${O}/><circle data-fill cx="160" cy="60" r="12" fill="#BDEFFF" opacity=".8"/><circle data-draw cx="160" cy="60" r="12" ${O}/><circle data-fill cx="40" cy="150" r="9" fill="#BDEFFF" opacity=".8"/><circle data-draw cx="40" cy="150" r="9" ${O}/>`,
    idle: 'float', shot: '🫧', shotPath: 'wave', weapon: '🎯', block: '✨', splat: '🫧', special: '💥', defeat: 'pop', color: '#7FD6FF',
  },
  gobble: {
    svg: `${grad('g-gob', '#C9A3FF', '#7A3FE0')}<path data-fill fill="url(#g-gob)" d="M40 150 C30 100 50 50 100 48 C150 50 170 100 160 150 C150 168 50 168 40 150 Z"/><path data-draw d="M40 150 C30 100 50 50 100 48 C150 50 170 100 160 150 C150 168 50 168 40 150 Z" ${O}/><path data-draw d="M60 58 L52 34 L74 52 M140 58 L150 32 L128 52" ${O}/>${eyes(80, 120, 92, 11)}${brows(80, 120, 74)}<path class="b-mouth" data-fill d="M66 120 C80 146 120 146 134 120 Z" fill="#3B1060"/><path data-draw d="M66 120 C80 146 120 146 134 120 Z" ${O}/><path data-fill d="M118 132 L124 162 L140 162 L138 150 L128 150 L126 132 Z" fill="#FF7AA8"/><path data-draw d="M118 132 L124 162 L140 162 L138 150 L128 150 L126 132" ${O}/>`,
    idle: 'bob', shot: '🧦', shotPath: 'spin', weapon: '🧦', block: '🛡️', splat: '🤢', special: '🌪️', defeat: 'sneeze', after: '🧦', color: '#A879FF',
  },
  hoot: {
    svg: `${grad('g-hoot', '#E7C29A', '#9C6B3C')}<ellipse data-fill cx="100" cy="112" rx="62" ry="66" fill="url(#g-hoot)"/><ellipse data-draw cx="100" cy="112" rx="62" ry="66" ${O}/><ellipse data-fill cx="100" cy="132" rx="34" ry="38" fill="#F6E3C8"/><path data-draw d="M78 120 C88 128 112 128 122 120 M80 138 C90 146 110 146 120 138" ${O}/><rect data-fill x="62" y="32" width="76" height="12" rx="3" fill="#1B1440"/><path data-fill d="M70 44 L130 44 L124 56 L76 56 Z" fill="#1B1440"/><path data-draw d="M138 38 L150 54" ${O}/><circle data-fill cx="150" cy="58" r="5" fill="#FFD25A"/>${eyes(80, 120, 86, 14)}<g class="b-brow"><path data-draw d="M64 66 L94 76 M136 66 L106 76" ${O}/></g><path data-draw d="M66 86 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M106 86 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M94 86 L106 86" stroke="#1B1440" stroke-width="3" fill="none"/><path class="b-mouth" data-fill d="M94 100 L106 100 L100 112 Z" fill="#FF9A4D"/>`,
    idle: 'sway', shot: '📕', shotPath: 'arc', weapon: '🪶', block: '🙅', splat: '💫', special: '🌟', defeat: 'sleep', after: '💤', color: '#C69563',
  },
  tenbeard: {
    svg: `${grad('g-pir', '#FFD9B8', '#E9A27A')}<circle data-fill cx="100" cy="104" r="50" fill="url(#g-pir)"/><circle data-draw cx="100" cy="104" r="50" ${O}/><path data-fill d="M40 66 C60 30 140 30 160 66 C140 58 60 58 40 66 Z" fill="#1B1440"/><path data-draw d="M40 66 C60 30 140 30 160 66 C140 58 60 58 40 66 Z" ${O}/><text x="92" y="58" font-size="16" fill="#fff">☠</text><path data-fill d="M58 120 C60 170 140 170 142 120 C130 140 70 140 58 120 Z" fill="#E8590C"/><path data-draw d="M58 120 C60 170 140 170 142 120 C130 140 70 140 58 120 Z" ${O}/>${eyes(82, 118, 96, 9)}<path data-fill d="M108 84 L130 84 L130 104 L108 104 Z" fill="#1B1440"/><path data-draw d="M64 84 L136 78" ${O}/>${brows(82, 118, 80)}<path class="b-mouth" data-draw d="M88 124 C96 130 104 130 112 124" ${O}/>`,
    idle: 'sway', shot: '⚫', shotPath: 'arc', weapon: '💣', block: '🔔', splat: '💦', special: '🏴‍☠️', defeat: 'sink', after: '🛁', color: '#E8590C',
  },
  gloop: {
    svg: `${grad('g-gl', '#B9FF9E', '#2FB84F')}<path data-fill fill="url(#g-gl)" d="M36 160 C30 120 50 70 100 66 C150 70 170 120 164 160 C150 158 148 172 136 166 C126 160 120 174 108 166 C98 160 86 176 76 166 C66 158 52 172 36 160 Z"/><path data-draw d="M36 160 C30 120 50 70 100 66 C150 70 170 120 164 160 C150 158 148 172 136 166 C126 160 120 174 108 166 C98 160 86 176 76 166 C66 158 52 172 36 160 Z" ${O}/><path data-fill d="M72 66 L76 40 L88 54 L100 34 L112 54 L124 40 L128 66 Z" fill="#FFD25A"/><path data-draw d="M72 66 L76 40 L88 54 L100 34 L112 54 L124 40 L128 66 Z" ${O}/>${eyes(84, 116, 104, 11)}${brows(84, 116, 86)}<path class="b-mouth" data-draw d="M82 132 C92 142 108 142 118 132" ${O}/>`,
    idle: 'pulse', shot: '🟢', shotPath: 'arc', weapon: '💧', block: '☂️', splat: '🟩', special: '🌊', defeat: 'melt', after: '👑', color: '#43E06B',
  },
  blaze: {
    svg: `${grad('g-dr', '#FF9A6B', '#C92A2A')}<path data-fill fill="url(#g-dr)" d="M50 150 C40 110 56 70 100 64 C144 70 160 110 150 150 C130 170 70 170 50 150 Z"/><path data-draw d="M50 150 C40 110 56 70 100 64 C144 70 160 110 150 150 C130 170 70 170 50 150 Z" ${O}/><path data-fill d="M62 76 L48 36 L80 66 Z M138 76 L152 36 L120 66 Z" fill="#FFD25A"/><path data-draw d="M62 76 L48 36 L80 66 M138 76 L152 36 L120 66" ${O}/><path data-fill d="M20 110 C10 80 30 70 48 92 Z M180 110 C190 80 170 70 152 92 Z" fill="#FF6B6B"/><path data-draw d="M20 110 C10 80 30 70 48 92 M180 110 C190 80 170 70 152 92" ${O}/>${eyes(82, 118, 100, 10)}${brows(82, 118, 82)}<path class="b-mouth" data-fill d="M76 128 C90 144 110 144 124 128 L116 134 L108 128 L100 136 L92 128 L84 134 Z" fill="#7A1010"/><path data-draw d="M76 128 C90 144 110 144 124 128" ${O}/><circle data-fill cx="90" cy="116" r="3" fill="#7A1010"/><circle data-fill cx="110" cy="116" r="3" fill="#7A1010"/>`,
    idle: 'hover', shot: '🔥', shotPath: 'straight', weapon: '🏹', block: '🧊', splat: '💨', special: '❄️', defeat: 'shrink', after: '🦎', color: '#FF6B4D',
  },
  crab: {
    svg: `${grad('g-cr', '#FFB18A', '#E2553B')}<ellipse data-fill cx="100" cy="120" rx="62" ry="42" fill="url(#g-cr)"/><ellipse data-draw cx="100" cy="120" rx="62" ry="42" ${O}/><circle data-draw cx="100" cy="122" r="16" ${O}/><path data-draw d="M100 106 L100 138 M84 122 L116 122 M89 111 L111 133 M111 111 L89 133" stroke="#1B1440" stroke-width="2.5"/><path data-fill d="M30 90 C10 70 20 40 46 52 L40 70 L56 66 C60 80 50 92 30 90 Z M170 90 C190 70 180 40 154 52 L160 70 L144 66 C140 80 150 92 170 90 Z" fill="#E2553B"/><path data-draw d="M30 90 C10 70 20 40 46 52 L40 70 L56 66 C60 80 50 92 30 90 Z M170 90 C190 70 180 40 154 52 L160 70 L144 66 C140 80 150 92 170 90 Z" ${O}/><path data-draw d="M84 82 L80 62 M116 82 L120 62" ${O}/>${eyes(80, 120, 56, 9)}${brows(80, 120, 42)}<path class="b-mouth" data-draw d="M90 140 L110 140" ${O}/>`,
    idle: 'jitter', shot: '✂️', shotPath: 'zigzag', weapon: '🔧', block: '💨', splat: '🦶', special: '⚙️', defeat: 'burst', after: '⚙️', color: '#FF8A5C',
  },
  multiplex: {
    svg: `${grad('g-rb', '#D8DEFF', '#7C86C9')}<rect data-fill x="50" y="70" width="100" height="96" rx="16" fill="url(#g-rb)"/><rect data-draw x="50" y="70" width="100" height="96" rx="16" ${O}/>${Array.from({ length: 12 }, (_, i) => `<rect class="plate" data-fill x="${58 + (i % 4) * 22}" y="${108 + Math.floor(i / 4) * 18}" width="18" height="14" rx="3" fill="#A879FF"/>`).join('')}<rect data-fill x="62" y="28" width="76" height="46" rx="12" fill="url(#g-rb)"/><rect data-draw x="62" y="28" width="76" height="46" rx="12" ${O}/><path data-draw d="M100 28 L100 12" ${O}/><circle data-fill cx="100" cy="10" r="6" fill="#FF6B6B"/><g class="b-eyes"><rect data-fill x="74" y="42" width="18" height="12" rx="3" fill="#5CF3FF"/><rect data-fill x="108" y="42" width="18" height="12" rx="3" fill="#5CF3FF"/></g><g class="b-brow"><path data-draw d="M72 38 L94 42 M128 38 L106 42" ${O}/></g><path class="b-mouth" data-draw d="M84 64 L116 64" ${O}/>`,
    idle: 'hover', shot: '🚀', shotPath: 'straight', weapon: '⚡', block: '🎆', splat: '📺', special: '🔋', defeat: 'shutdown', after: '404', color: '#8F98FF',
  },
  fractio: {
    svg: `${grad('g-ch', '#FFE1C2', '#F2B78C')}<circle data-fill cx="100" cy="112" r="50" fill="url(#g-ch)"/><circle data-draw cx="100" cy="112" r="50" ${O}/><path data-fill d="M58 76 C40 70 44 36 70 42 C72 22 128 22 130 42 C156 36 160 70 142 76 Z" fill="#fff"/><path data-draw d="M58 76 C40 70 44 36 70 42 C72 22 128 22 130 42 C156 36 160 70 142 76 Z" ${O}/>${eyes(82, 118, 104, 8)}${brows(82, 118, 90)}<path data-fill d="M70 126 C84 116 96 122 100 128 C104 122 116 116 130 126 C120 136 106 132 100 130 C94 132 80 136 70 126 Z" fill="#5B3216"/><path class="b-mouth" data-draw d="M90 142 C96 148 104 148 110 142" ${O}/>`,
    idle: 'bob', shot: '🍳', shotPath: 'spin', weapon: '🥧', block: '🥞', splat: '💫', special: '🎂', defeat: 'faint', after: '🍲', color: '#FFB547',
  },
  pizzawizard: {
    svg: `${grad('g-pz', '#C6B5FF', '#5F3DC4')}<path data-fill d="M40 168 C50 120 70 90 100 88 C130 90 150 120 160 168 Z" fill="url(#g-pz)"/><path data-draw d="M40 168 C50 120 70 90 100 88 C130 90 150 120 160 168 Z" ${O}/><circle data-fill cx="100" cy="96" r="30" fill="#FFE1C2"/><circle data-draw cx="100" cy="96" r="30" ${O}/><path data-fill d="M56 74 L100 8 L144 74 Z" fill="#FFC15E"/><path data-draw d="M56 74 L100 8 L144 74 Z" ${O}/><circle data-fill cx="92" cy="50" r="5" fill="#E8590C"/><circle data-fill cx="110" cy="38" r="4" fill="#E8590C"/><circle data-fill cx="112" cy="62" r="5" fill="#E8590C"/>${eyes(90, 112, 94, 6)}${brows(90, 112, 84)}<path data-fill d="M80 108 C90 140 110 140 120 108 C110 118 90 118 80 108 Z" fill="#fff"/><path class="b-mouth" data-draw d="M94 112 L106 112" ${O}/>`,
    idle: 'float', shot: '🧀', shotPath: 'wave', weapon: '🔪', block: '✂️', splat: '🧀', special: '✨', defeat: 'eaten', after: '🐭', color: '#8C6BFF',
  },
  volt: {
    svg: `${grad('g-vo', '#E3E8FF', '#7C86C9')}<path data-fill fill="url(#g-vo)" d="M44 130 C20 130 20 96 46 92 C44 64 80 52 96 70 C108 46 150 50 150 82 C176 80 182 118 158 128 Z"/><path data-draw d="M44 130 C20 130 20 96 46 92 C44 64 80 52 96 70 C108 46 150 50 150 82 C176 80 182 118 158 128 Z" ${O}/>${eyes(84, 118, 100, 9)}${brows(84, 118, 84)}<path class="b-mouth" data-draw d="M90 116 L96 112 L102 116 L108 112" ${O}/><path data-fill d="M80 132 L70 160 L84 156 L76 182 L100 148 L86 152 L94 132 Z" fill="#FFD25A"/><path data-draw d="M80 132 L70 160 L84 156 L76 182 L100 148 L86 152 L94 132 Z" ${O}/>`,
    idle: 'float', shot: '⚡', shotPath: 'zigzag', weapon: '🌬️', block: '🗼', splat: '⚡', special: '🌈', defeat: 'rainbow', after: '🌈', color: '#7C9CFF',
  },
  kraken: {
    svg: `${grad('g-kr', '#E3A6FF', '#8E3BC9')}<path data-fill fill="url(#g-kr)" d="M56 110 C50 60 150 60 144 110 Z"/><path data-draw d="M56 110 C50 60 150 60 144 110" ${O}/>${[0, 1, 2, 3, 4, 5].map((i) => { const x = 56 + i * 17.6; return `<path data-fill d="M${x} 108 C${x - 6} 140 ${x + 14} 150 ${x + 4} 176 C${x + 18} 160 ${x + 16} 130 ${x + 14} 108 Z" fill="#B45EE8"/><path data-draw d="M${x} 108 C${x - 6} 140 ${x + 14} 150 ${x + 4} 176" ${O}/>`; }).join('')}${eyes(84, 116, 90, 11)}${brows(84, 116, 72)}<path class="b-mouth" data-draw d="M92 106 C96 110 104 110 108 106" ${O}/>`,
    idle: 'sway', shot: '🖤', shotPath: 'arc', weapon: '🔱', block: '🫧', splat: '🖤', special: '🌀', defeat: 'knot', after: '🪢', color: '#B45EE8',
  },
  mirror: {
    svg: `<defs><linearGradient id="g-mi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8F7FF"/><stop offset=".5" stop-color="#A6C8FF"/><stop offset="1" stop-color="#7A66FF"/></linearGradient></defs><ellipse data-fill cx="100" cy="100" rx="56" ry="76" fill="#FFD25A"/><ellipse data-draw cx="100" cy="100" rx="56" ry="76" ${O}/><ellipse data-fill cx="100" cy="100" rx="44" ry="64" fill="url(#g-mi)"/><ellipse data-draw cx="100" cy="100" rx="44" ry="64" ${O}/><path data-draw d="M74 60 L90 44 M80 74 L104 50" stroke="#fff" stroke-width="5" stroke-linecap="round"/>${eyes(86, 114, 98, 8)}${brows(86, 114, 84)}<path class="b-mouth" data-draw d="M90 124 C96 130 104 130 110 124" ${O}/>`,
    idle: 'pulse', shot: '👥', shotPath: 'zigzag', weapon: '🪄', block: '💎', splat: '🔄', special: '🌟', defeat: 'shatter', after: '✨', color: '#A6C8FF',
  },
  sensei: {
    svg: `${grad('g-ni', '#5A5F8C', '#1B1F3B')}<path data-fill d="M44 176 C46 120 68 100 100 98 C132 100 154 120 156 176 Z" fill="url(#g-ni)"/><path data-draw d="M44 176 C46 120 68 100 100 98 C132 100 154 120 156 176" ${O}/><circle data-fill cx="100" cy="70" r="38" fill="url(#g-ni)"/><circle data-draw cx="100" cy="70" r="38" ${O}/><rect data-fill x="62" y="60" width="76" height="18" rx="9" fill="#FFE1C2"/><path data-fill d="M136 66 L170 54 L164 70 L172 80 L136 74 Z" fill="#FF6B6B"/><g class="b-eyes"><path data-fill d="M76 70 L94 66 L94 72 Z M124 70 L106 66 L106 72 Z" fill="#1B1440"/></g><g class="b-brow"><path data-draw d="M74 62 L94 64 M126 62 L106 64" ${O}/></g><path data-draw d="M60 132 L140 132" stroke="#FFD25A" stroke-width="6"/><path data-draw d="M150 40 L180 160" stroke="#C9D2FF" stroke-width="5" stroke-linecap="round"/><path class="b-mouth" data-draw d="M96 92 L104 92" ${O}/>`,
    idle: 'hover', shot: '✴️', shotPath: 'spin', weapon: '🗡️', block: '⚔️', splat: '🌀', special: '🐉', defeat: 'bow', after: '🥋', color: '#5A5F8C',
  },
};

const MINIONS: Record<number, string[]> = {
  1: ['🧦', '🫧'], 2: ['🦜', '🦉'], 3: ['🐲', '🦎'], 4: ['🤖', '🐛'], 5: ['🧀', '🥧'], 6: ['🦀', '⚡'], 7: ['🐸', '👤'],
};
export const minionFor = (stage: number, n: number): string => {
  const l = MINIONS[stage] ?? ['👾'];
  return l[n % l.length];
};

/** A boss on screen, with its animations. */
export class BossView {
  readonly el: HTMLElement;
  private readonly art: BossArt;
  private readonly svg: SVGSVGElement;
  private readonly fx: Fx;
  constructor(bossId: string, fx: Fx) {
    this.fx = fx;
    this.art = ART[bossId];
    this.el = document.createElement('div');
    this.el.className = `boss-view idle-${this.art.idle}`;
    this.el.style.setProperty('--boss', this.art.color);
    this.el.innerHTML = `<div class="boss-shadow"></div><div class="boss-body"><svg viewBox="0 0 200 200" class="boss-svg" aria-hidden="true">${this.art.svg}</svg></div><div class="boss-fx"></div>`;
    this.svg = this.el.querySelector('svg')!;
  }

  private get body(): HTMLElement {
    return this.el.querySelector('.boss-body')!;
  }

  async enter(): Promise<void> {
    if (!reducedMotion()) this.body.animate([{ transform: 'translateY(30px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: EASE_OUT });
    await drawOn(this.svg, { duration: 700, stagger: 60, fillDelay: 0 });
  }

  private center(): { x: number; y: number } {
    const r = this.body.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  private float(text: string, cls: string): void {
    const t = document.createElement('div');
    t.className = `dmg ${cls}`;
    t.textContent = text;
    this.el.querySelector('.boss-fx')!.appendChild(t);
    if (reducedMotion()) return void setTimeout(() => t.remove(), 900);
    t.animate([{ transform: 'translate(-50%,0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-30px) scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-80px) scale(1)', opacity: 0 }], { duration: 1100, easing: EASE_OUT }).finished.then(() => t.remove());
  }

  /** The player's weapon flies up from `from` into the boss. */
  async hit(from: DOMRect, damage: number, critical: boolean, stage: HTMLElement): Promise<void> {
    await projectile(this.art.weapon, { x: from.x + from.width / 2, y: from.y }, this.center(), 'arc', critical ? 380 : 460);
    const c = this.center();
    this.fx.burst(c.x, c.y, critical ? '#FFD25A' : this.art.color, critical ? 30 : 18, critical ? 1.6 : 1);
    if (!reducedMotion()) {
      this.body.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'translateX(12px) rotate(4deg) scale(.95)', filter: 'brightness(2.2)' }, { transform: 'none', filter: 'brightness(1)' }], { duration: critical ? 520 : 360, easing: EASE_OUT });
      if (critical) {
        screenShake(stage, 1.4);
        document.body.animate([{ filter: 'none' }, { filter: 'saturate(1.6) contrast(1.1)' }, { filter: 'none' }], { duration: 600 });
      }
    }
    this.float(critical ? `CRITICAL! −${damage}` : `−${damage}`, critical ? 'crit' : '');
  }

  /** Five in a row: a full-screen super move. */
  async special(stage: HTMLElement, damage: number): Promise<void> {
    const ov = document.createElement('div');
    ov.className = 'special';
    ov.innerHTML = `<div class="sp-title">SUPER MOVE!</div>${Array.from({ length: 14 }, (_, i) => `<span style="--i:${i};left:${(i * 29) % 100}%">${this.art.special}</span>`).join('')}`;
    stage.appendChild(ov);
    screenShake(stage, 2);
    const c = this.center();
    for (let i = 0; i < 3; i++) setTimeout(() => this.fx.burst(c.x + (i - 1) * 40, c.y, '#FFFFFF', 24, 1.8), 300 + i * 180);
    if (!reducedMotion()) this.body.animate([{ transform: 'none' }, { transform: 'scale(.8) rotate(-12deg)', filter: 'brightness(3)' }, { transform: 'scale(1.05) rotate(6deg)' }, { transform: 'none' }], { duration: 1000, easing: EASE_OUT });
    this.float(`SUPER! −${damage}`, 'crit');
    await wait(1300);
    ov.remove();
  }

  miss(): void {
    if (!reducedMotion()) this.body.animate([{ transform: 'none' }, { transform: 'translateY(-14px) rotate(-6deg)' }, { transform: 'none' }], { duration: 500, easing: EASE_SPRING });
    this.float('Ha ha!', 'taunt');
  }

  /** The boss winds up and fires; resolves when the shot arrives near the player. */
  async attack(target: DOMRect): Promise<void> {
    if (!reducedMotion()) await this.body.animate([{ transform: 'none' }, { transform: 'scale(1.12) translateY(-10px)' }, { transform: 'scale(.95) translateY(8px)' }, { transform: 'none' }], { duration: 520, easing: EASE_OUT }).finished;
    await projectile(this.art.shot, this.center(), { x: target.x + target.width / 2, y: target.y + 20 }, this.art.shotPath, 650);
  }

  /** Result of a defend question at the player's end of the screen. */
  defend(ok: boolean, at: DOMRect, stage: HTMLElement): void {
    const x = at.x + at.width / 2;
    const y = at.y + 30;
    if (ok) {
      bigEmoji(this.art.block, x, y, stage, 'block');
      this.fx.burst(x, y, '#5CC8FF', 20, 1.2);
    } else {
      bigEmoji(this.art.splat, x, y, stage, 'splat');
      screenShake(stage, 1.2);
      const flash = document.createElement('div');
      flash.className = 'hurt-flash';
      stage.appendChild(flash);
      setTimeout(() => flash.remove(), 600);
    }
  }

  phase(n: number, stage: HTMLElement): void {
    this.el.classList.add(`phase-${n}`);
    screenShake(stage, 1.5);
    this.float(n === 1 ? 'Grrr!' : 'GRRRAAH!', 'taunt');
  }

  async defeat(stage: HTMLElement): Promise<void> {
    const b = this.body;
    const c = this.center();
    const a = this.art;
    const k = (frames: Keyframe[], ms = 1400) => (reducedMotion() ? Promise.resolve() : b.animate(frames, { duration: ms, easing: EASE_OUT, fill: 'forwards' }).finished.then(() => undefined));
    this.el.classList.remove(`idle-${a.idle}`);
    switch (a.defeat) {
      case 'pop':
        await k([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(0)', opacity: 0 }], 700);
        this.fx.burst(c.x, c.y, '#BDEFFF', 40, 2);
        break;
      case 'sneeze':
        await k([{ transform: 'none' }, { transform: 'scale(1.1,.9)' }, { transform: 'scale(.9,1.15) translateY(-10px)' }, { transform: 'none' }], 900);
        for (let i = 0; i < 8; i++) void projectile('🧦', c, { x: c.x + (i - 4) * 70, y: c.y - 260 }, 'arc', 800);
        await k([{ transform: 'none' }, { transform: 'scale(.7) translateY(30px)', opacity: 0.4 }], 900);
        break;
      case 'sleep':
        await k([{ transform: 'none' }, { transform: 'rotate(-14deg) translateY(16px)' }], 900);
        bigEmoji('💤', c.x + 40, c.y - 60, stage, 'float');
        break;
      case 'sink':
      case 'knot':
        await k([{ transform: 'none' }, { transform: 'translateY(-10px) rotate(-6deg)' }, { transform: 'translateY(260px) rotate(14deg)', opacity: 0 }], 1500);
        break;
      case 'melt':
        await k([{ transform: 'none' }, { transform: 'scale(1.2,.4) translateY(120px)', opacity: 0.7 }], 1400);
        break;
      case 'shrink':
      case 'eaten':
      case 'faint':
        await k([{ transform: 'none' }, { transform: 'rotate(360deg) scale(.15)', opacity: 0.2 }], 1200);
        break;
      case 'burst':
      case 'shatter':
        this.fx.burst(c.x, c.y, a.color, 40, 2.2);
        await k([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'scale(1.15)', filter: 'brightness(3)' }, { transform: 'scale(.2)', opacity: 0 }], 800);
        this.fx.burst(c.x, c.y, '#FFFFFF', 30, 2.6);
        break;
      case 'shutdown':
        await k([{ filter: 'none' }, { filter: 'grayscale(1) brightness(.6)' }, { filter: 'grayscale(1) brightness(.4)', transform: 'translateY(16px)' }], 1300);
        break;
      case 'rainbow':
        await k([{ transform: 'none' }, { transform: 'scale(1.2)', opacity: 0.4 }, { transform: 'scale(1.6)', opacity: 0 }], 1300);
        break;
      case 'bow':
        await k([{ transform: 'none' }, { transform: 'rotate(18deg) translateY(16px)' }], 1100);
        break;
    }
    if (a.after) {
      const t = document.createElement('div');
      t.className = 'boss-after';
      t.textContent = a.after;
      this.el.appendChild(t);
      if (!reducedMotion()) t.animate([{ transform: 'translate(-50%,-50%) scale(0)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 700, easing: EASE_OUT, fill: 'both' });
    }
  }
}

/** Fly an emoji from a to b along a path style. */
export function projectile(emoji: string, a: { x: number; y: number }, b: { x: number; y: number }, how: Path, ms: number): Promise<void> {
  const el = document.createElement('div');
  el.className = 'shot';
  el.textContent = emoji;
  document.body.appendChild(el);
  if (reducedMotion()) {
    el.remove();
    return Promise.resolve();
  }
  const kf: Keyframe[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x = a.x + (b.x - a.x) * t;
    let y = a.y + (b.y - a.y) * t;
    let rot = 0;
    if (how === 'arc') y -= Math.sin(Math.PI * t) * 120;
    if (how === 'wave') x += Math.sin(t * Math.PI * 3) * 40;
    if (how === 'zigzag') x += (i % 2 ? 1 : -1) * 30 * (1 - t);
    if (how === 'spin') rot = t * 900;
    if (how === 'drop') y = a.y + (b.y - a.y) * t * t;
    kf.push({ transform: `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${rot}deg) scale(${0.8 + 0.6 * Math.sin(Math.PI * t)})` });
  }
  return el.animate(kf, { duration: ms, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }).finished.then(() => el.remove());
}

function bigEmoji(e: string, x: number, y: number, host: HTMLElement, cls: string): void {
  const el = document.createElement('div');
  el.className = `big-emoji-fx ${cls}`;
  el.textContent = e;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  host.appendChild(el);
  if (reducedMotion()) return void setTimeout(() => el.remove(), 700);
  el.animate([{ transform: 'translate(-50%,-50%) scale(0) rotate(-20deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.4) rotate(6deg)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-60%) scale(1.1)', opacity: 0 }], { duration: 950, easing: EASE_OUT }).finished.then(() => el.remove());
}
