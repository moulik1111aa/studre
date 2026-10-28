// The Adventure pet on screen: four original pets drawn in the app's chunky style, the egg,
// the Pet tab (hatch, name, snacks, tricks), the hatching moment, the "your pet grew!" moment,
// the little cheer that peeks into a level, and the pet beside the child on the map.

import { html, esc, type App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { ensureEgg, feed, hatch, hatchReady, levelsToHatch, moodOf, petStage, cleanName } from '../core/pet.ts';
import { HATCH_LEVELS, PET_NAME_MAX, SNACKS, SPECIES, STAGES, TRICKS, heartsOf, speciesOf, tricksFor, type SnackId, type Species, type TrickId } from '../core/petdata.ts';
import { gemBalance } from '../core/wardrobe.ts';
import { awardBadges } from '../core/adventure.ts';
import { remember } from '../core/undo.ts';
import { reducedMotion, wait, EASE_SPRING, stagger } from '../render/motion.ts';

const I = '#1A1446';
let uid = 0;

interface Look {
  /** Where the eyes are (for open and sleepy eyes), and the top of the head (for the crown). */
  eyes: [number, number][];
  eyeR: number;
  crownY: number;
  back: string;
  front: string;
}

const s = (d: string, fill: string, w = 4) => `<path d="${d}" fill="${fill}" stroke="${I}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const e = (cx: number, cy: number, rx: number, ry: number, fill: string, w = 4) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${I}" stroke-width="${w}"/>`;

const LOOKS: Record<Species, Look> = {
  fox: {
    eyes: [
      [48, 55],
      [72, 55],
    ],
    eyeR: 5,
    crownY: 22,
    back: s('M82 96 C110 98 118 66 102 50 C104 70 96 82 78 84 Z', '#FF8A3D') + s('M102 50 C112 58 114 70 108 78 C104 70 102 62 102 50 Z', '#FFF4E6', 3),
    front:
      e(60, 92, 25, 19, '#FF8A3D') +
      `<ellipse cx="60" cy="97" rx="13" ry="10" fill="#FFF4E6"/>` +
      e(48, 108, 8, 5, '#C9551A', 3) +
      e(72, 108, 8, 5, '#C9551A', 3) +
      s('M38 42 L34 14 L57 32 Z', '#FF8A3D') +
      s('M82 42 L86 14 L63 32 Z', '#FF8A3D') +
      `<path d="M40 36 L38 22 L50 31 Z M80 36 L82 22 L70 31 Z" fill="#FFD3B0"/>` +
      `<circle cx="60" cy="56" r="27" fill="#FF8A3D" stroke="${I}" stroke-width="4"/>` +
      `<path d="M34 62 Q46 56 60 69 Q74 56 86 62 Q83 83 60 83 Q37 83 34 62 Z" fill="#FFF4E6"/>` +
      `<ellipse cx="60" cy="69" rx="4.6" ry="3.4" fill="${I}"/><path d="M55 75 Q60 79 65 75" fill="none" stroke="${I}" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="40" cy="67" rx="4" ry="2.6" fill="#FF9BB5" opacity=".75"/><ellipse cx="80" cy="67" rx="4" ry="2.6" fill="#FF9BB5" opacity=".75"/>`,
  },
  turtle: {
    eyes: [
      [52, 41],
      [68, 41],
    ],
    eyeR: 4.4,
    crownY: 14,
    back: e(32, 98, 10, 8, '#6CCB7F', 3) + e(88, 98, 10, 8, '#6CCB7F', 3),
    front:
      `<circle cx="60" cy="42" r="20" fill="#6CCB7F" stroke="${I}" stroke-width="4"/>` +
      `<path d="M54 50 Q60 55 66 50" fill="none" stroke="${I}" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="46" cy="49" rx="3.6" ry="2.4" fill="#FF9BB5" opacity=".8"/><ellipse cx="74" cy="49" rx="3.6" ry="2.4" fill="#FF9BB5" opacity=".8"/>` +
      s('M18 96 Q18 56 60 56 Q102 56 102 96 Z', '#2E9E6A') +
      `<path d="M60 62 L72 70 L72 84 L60 92 L48 84 L48 70 Z" fill="#4CC08A" stroke="#1E7A50" stroke-width="2.5"/><path d="M34 76 L44 72 L48 84 L40 92 L28 90 Z M86 76 L76 72 L72 84 L80 92 L92 90 Z" fill="#4CC08A" stroke="#1E7A50" stroke-width="2.5"/>` +
      `<rect x="14" y="92" width="92" height="12" rx="6" fill="#F7D774" stroke="${I}" stroke-width="4"/>` +
      e(40, 110, 8, 5, '#6CCB7F', 3) +
      e(80, 110, 8, 5, '#6CCB7F', 3),
  },
  owl: {
    eyes: [
      [45, 52],
      [75, 52],
    ],
    eyeR: 6,
    crownY: 12,
    back: s('M26 70 Q10 82 22 100 Q30 92 32 80 Z', '#6E4DC2') + s('M94 70 Q110 82 98 100 Q90 92 88 80 Z', '#6E4DC2'),
    front:
      s('M34 30 L28 10 L50 24 Z', '#8E6BD8') +
      s('M86 30 L92 10 L70 24 Z', '#8E6BD8') +
      s('M60 18 C90 18 98 50 96 76 C94 102 78 110 60 110 C42 110 26 102 24 76 C22 50 30 18 60 18 Z', '#8E6BD8') +
      `<ellipse cx="60" cy="86" rx="22" ry="20" fill="#EDE3FF"/><path d="M50 80 L54 84 L58 80 M62 80 L66 84 L70 80 M54 92 L58 96 L62 92 M64 92 L68 96 L72 92" fill="none" stroke="#B9A3EE" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="45" cy="52" r="14" fill="#FFFFFF" stroke="#FFC531" stroke-width="5"/><circle cx="75" cy="52" r="14" fill="#FFFFFF" stroke="#FFC531" stroke-width="5"/>` +
      s('M55 62 L65 62 L60 72 Z', '#FFAE1A', 3) +
      e(50, 111, 6, 4, '#FFAE1A', 3) +
      e(70, 111, 6, 4, '#FFAE1A', 3),
  },
  dragon: {
    eyes: [
      [49, 50],
      [71, 50],
    ],
    eyeR: 5,
    crownY: 18,
    back:
      s('M36 70 L10 48 L16 70 L6 76 L30 86 Z', '#9FF0DF') +
      s('M84 70 L110 48 L104 70 L114 76 L90 86 Z', '#9FF0DF') +
      s('M80 100 Q108 102 106 76 Q100 90 82 88 Z', '#3DCFB0') +
      s('M106 76 L114 70 L110 82 Z', '#FFD25A', 3),
    front:
      e(60, 90, 24, 20, '#3DCFB0') +
      `<ellipse cx="60" cy="95" rx="13" ry="12" fill="#FFF1C4"/><path d="M50 90 H70 M49 96 H71 M51 102 H69" stroke="#E8CF84" stroke-width="2.5" stroke-linecap="round"/>` +
      e(48, 108, 8, 5, '#2BAE93', 3) +
      e(72, 108, 8, 5, '#2BAE93', 3) +
      s('M44 34 L38 14 L54 28 Z', '#FFD25A', 3) +
      s('M76 34 L82 14 L66 28 Z', '#FFD25A', 3) +
      `<circle cx="60" cy="52" r="26" fill="#3DCFB0" stroke="${I}" stroke-width="4"/>` +
      s('M54 27 L60 18 L66 27 Z', '#FFD25A', 3) +
      `<ellipse cx="60" cy="65" rx="15" ry="9.5" fill="#6FE3CC" stroke="${I}" stroke-width="3"/><circle cx="55" cy="63" r="1.8" fill="${I}"/><circle cx="65" cy="63" r="1.8" fill="${I}"/><path d="M54 69 Q60 73 66 69" fill="none" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<ellipse cx="40" cy="60" rx="4" ry="2.6" fill="#FF9BB5" opacity=".75"/><ellipse cx="80" cy="60" rx="4" ry="2.6" fill="#FF9BB5" opacity=".75"/>`,
  },
};

const crown = (y: number) =>
  `<g class="pet-crown"><path d="M44 ${y + 2} L41 ${y - 18} L52 ${y - 8} L60 ${y - 22} L68 ${y - 8} L79 ${y - 18} L76 ${y + 2} Z" fill="#FFD25A" stroke="${I}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="60" cy="${y - 5}" r="3" fill="#FF5A7A"/></g>`;

export interface PetLook {
  stage?: number;
  sleepy?: boolean;
  cls?: string;
}

/** One of the four pets. Stage 4 glows, stage 5 also wears a crown. */
export function petSvg(species: Species, o: PetLook = {}): string {
  const L = LOOKS[species] ?? LOOKS.fox;
  const stage = o.stage ?? 1;
  const id = `pg${++uid}`;
  const eyes = L.eyes
    .map(([x, y]) =>
      o.sleepy
        ? `<path d="M${x - L.eyeR} ${y} Q${x} ${y + L.eyeR * 0.9} ${x + L.eyeR} ${y}" fill="none" stroke="${I}" stroke-width="3.2" stroke-linecap="round"/>`
        : `<g class="pet-eye"><ellipse cx="${x}" cy="${y}" rx="${L.eyeR * 0.85}" ry="${L.eyeR}" fill="${I}"/><circle cx="${x + L.eyeR * 0.3}" cy="${y - L.eyeR * 0.35}" r="${L.eyeR * 0.32}" fill="#fff"/></g>`,
    )
    .join('');
  const glow = stage >= 4 ? `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#FFE27A" stop-opacity=".75"/><stop offset="1" stop-color="#FFE27A" stop-opacity="0"/></radialGradient></defs><circle class="pet-glow" cx="60" cy="68" r="62" fill="url(#${id})"/>` : '';
  const zs = o.sleepy ? `<g class="pet-z" fill="${I}" font-weight="900" font-family="inherit"><text x="92" y="20" font-size="16">z</text><text x="102" y="6" font-size="12">z</text></g>` : '';
  return `<svg class="pet pet-${species} st${stage}${o.sleepy ? ' sleepy' : ''}${o.cls ? ` ${o.cls}` : ''}" viewBox="-6 -26 132 146" aria-hidden="true">${glow}<g class="pet-body">${L.back}${L.front}${eyes}${stage >= 5 ? crown(L.crownY) : ''}</g>${zs}</svg>`;
}

/** The speckled egg (cracks show while it hatches). */
export function eggSvg(cls = ''): string {
  return `<svg class="pet-egg ${cls}" viewBox="0 0 120 140" aria-hidden="true">
    <ellipse cx="60" cy="130" rx="34" ry="6" fill="rgba(0,0,0,.18)"/>
    <g class="egg-shell"><path d="M60 8 C88 8 104 56 104 84 C104 112 84 128 60 128 C36 128 16 112 16 84 C16 56 32 8 60 8 Z" fill="#FFF6E0" stroke="${I}" stroke-width="5"/>
    <g fill="#FFB86B"><circle cx="44" cy="48" r="6"/><circle cx="74" cy="38" r="4.5"/><circle cx="82" cy="80" r="7"/><circle cx="38" cy="92" r="5"/><circle cx="62" cy="104" r="4"/></g>
    <path d="M36 30 Q44 18 56 16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g>
    <path class="egg-crack c1" d="M30 70 L42 62 L50 72 L60 62" fill="none" stroke="${I}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <path class="egg-crack c2" d="M60 62 L70 74 L80 64 L92 72" fill="none" stroke="${I}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

const kindName = (sp: Species) => (speciesOf(sp)?.name ?? 'pet').toLowerCase();

/** The pet's look right now for this child. */
export function petNow(app: App, c: Child, cls = ''): string {
  const p = c.adventure?.pet;
  if (!p) return '';
  return petSvg(p.species, { stage: petStage(c).stage.n, sleepy: moodOf(c, app.today) === 'sleepy', cls });
}

/** Beside the child's avatar on the map (Adventure on, pet hatched). */
export function mapPetHtml(app: App, c: Child): string {
  const p = c.adventure?.on ? c.adventure.pet : undefined;
  return p ? `<span class="who-pet" title="${esc(p.name)}">${petNow(app, c, 'alive')}</span>` : '';
}

/** A Plus line about the pet, or null. */
export function petLine(c: Child, passed: boolean): string | null {
  const p = c.adventure?.on ? c.adventure.pet : undefined;
  if (!p) return null;
  const n = esc(p.name);
  return passed ? [`${n} is proud of you!`, `${n} did a happy dance for that one!`, `Look, ${n} is cheering!`][p.name.length % 3] : [`${n} believes in you!`, `${n} says: try again, you’ve got this!`][p.name.length % 2];
}

// ── the Pet tab ─────────────────────────────────────────────────────────────
export function petTab(app: App, c: Child): string {
  const a = c.adventure!;
  const p = a.pet;
  if (!p) {
    const ready = hatchReady(c);
    const left = levelsToHatch(c);
    const dots = Array.from({ length: HATCH_LEVELS }, (_, k) => `<i class="${k < HATCH_LEVELS - left ? 'on' : ''}"></i>`).join('');
    return `<div class="card pet-eggcard${ready ? ' ready' : ''}">
      <div class="pet-eggwrap">${eggSvg(ready ? 'wobble' : 'rock')}</div>
      <h2>${ready ? 'Your egg is moving!' : 'A mystery egg!'}</h2>
      <p>${ready ? 'Something inside wants to meet you.' : `Finish ${left} more level${left === 1 ? '' : 's'}, or open a chest, and it will hatch.`}</p>
      ${ready ? '<button class="btn mint pet-hatch">🐣 Hatch it!</button>' : `<p class="pet-dots" aria-label="${HATCH_LEVELS - left} of ${HATCH_LEVELS} levels">${dots}</p>`}
    </div>
    <p class="fine pet-note">Inside is a fox, a turtle, an owl or a little dragon. You get to choose!</p>`;
  }
  const st = petStage(c);
  const hearts = heartsOf(p);
  const mood = moodOf(c, app.today);
  const balance = gemBalance(c);
  const next = TRICKS.find((t) => hearts < t.hearts);
  const pct = st.need ? Math.min(100, (100 * st.into) / st.need) : 100;
  return `<div class="card pet-hero">
      <button class="pet-stagebox s${st.stage.n}" aria-label="Tap ${esc(p.name)} for a trick">${petNow(app, c, 'alive')}</button>
      <h2>${esc(p.name)}</h2>
      <p class="pet-kind">${st.stage.name} ${esc(kindName(p.species))}</p>
      <p class="pet-mood ${mood}">${mood === 'sleepy' ? `${esc(p.name)} is snoozing. Play a level and ${esc(p.name)} will wake up bouncing!` : `${esc(p.name)} is bouncy! You played today.`}</p>
      <div class="pet-grow"><span>${st.next ? `Grows into <b>${st.next.name}</b>` : '<b>Legendary!</b> Fully grown'}</span><div class="aq-bar"><i style="width:${pct}%"></i></div><small>${st.next ? `${st.into.toLocaleString('en-IN')} / ${st.need.toLocaleString('en-IN')} XP` : 'The biggest and shiniest'}</small></div>
    </div>
    <h3 class="pa-h">Snacks <small class="pet-gems">💎 ${balance.toLocaleString('en-IN')}</small></h3>
    <div class="pet-snacks">${SNACKS.map((sn) => `<button class="pet-snack${balance < sn.price ? ' short' : ''}" data-snack="${sn.id}" aria-label="${sn.name}: ${sn.price} gems, ${sn.hearts} heart${sn.hearts > 1 ? 's' : ''}"><span class="ps-i" aria-hidden="true">${sn.icon}</span><b>${sn.name}</b><small>💎 ${sn.price} · ❤️ +${sn.hearts}</small></button>`).join('')}</div>
    <h3 class="pa-h">Tricks <small class="pet-hearts">❤️ ${hearts}</small></h3>
    <div class="pet-tricks">${TRICKS.map((t) => `<div class="pet-trick${hearts >= t.hearts ? ' on' : ''}"><b>${t.name}</b><small>${hearts >= t.hearts ? 'Tap your pet!' : `🔒 ${t.hearts} hearts`}</small></div>`).join('')}</div>
    <p class="fine pet-note">${next ? `${next.hearts - hearts} more heart${next.hearts - hearts === 1 ? '' : 's'} to learn ${next.name}.` : 'Every trick learned!'} ${esc(p.name)} grows with the XP you earn: ${STAGES.slice(1).map((x) => x.name).join(', ')}.</p>`;
}

/** Hook up the Pet tab. `rerender` draws the tab again. */
export function bindPetTab(app: App, c: Child, body: HTMLElement, rerender: () => void): void {
  ensureEggSaved(app, c);
  body.querySelector('.pet-hatch')?.addEventListener('click', () => void hatchMoment(app, c).then(rerender));
  const box = body.querySelector<HTMLElement>('.pet-stagebox');
  let k = 0;
  box?.addEventListener('click', () => {
    const tricks = tricksFor(heartsOf(c.adventure?.pet));
    const svg = box.querySelector<SVGElement>('svg.pet');
    if (!svg) return;
    if (!tricks.length) {
      doTrick(svg, 'hop');
      app.sfx.pop();
      return app.toast('Give snacks for hearts. 5 hearts teaches a trick!');
    }
    const t = tricks[k++ % tricks.length];
    doTrick(svg, t.id);
    app.sfx.fanfare();
  });
  body.querySelectorAll<HTMLButtonElement>('.pet-snack').forEach((b) =>
    b.addEventListener('click', () => {
      let r: ReturnType<typeof feed> | null = null;
      let learned: (typeof TRICKS)[number] | undefined;
      app.save.update(() => {
        remember(c, [], Date.now(), app.today);
        const before = heartsOf(c.adventure?.pet);
        r = feed(c, b.dataset.snack as SnackId, Date.now());
        if (r.ok) {
          learned = TRICKS.find((t) => before < t.hearts && r!.ok && r!.hearts >= t.hearts);
          awardBadges(badgeCtx(app, c), Date.now());
        }
      });
      const res = r as ReturnType<typeof feed> | null;
      if (!res) return;
      if (!res.ok) return app.toast(`You need ${res.need} more gem${res.need === 1 ? '' : 's'}. Gems come from new levels, chests and badges.`);
      app.sfx.pop();
      const name = c.adventure!.pet!.name;
      const icon = SNACKS.find((x) => x.id === b.dataset.snack)!.icon;
      void snackMoment(app, body, icon, res.gained).then(() => {
        rerender();
        if (learned) app.toast(`${name} learned a new trick: ${learned.name}! Tap ${name} to see it.`);
        else app.toast(`${name} loved it! ❤️ +${res.gained}`);
      });
    }),
  );
}

/** Badge context without importing the Adventure screen (no import loop). */
let badgeCtx: (app: App, c: Child) => Parameters<typeof awardBadges>[0] = () => {
  throw new Error('pet: badge context not set');
};
export function setPetBadgeContext(f: typeof badgeCtx): void {
  badgeCtx = f;
}

function ensureEggSaved(app: App, c: Child): void {
  if (c.adventure?.on && !c.adventure.pet && !c.adventure.eggAt) app.save.update(() => ensureEgg(c.adventure, Date.now()));
}

function doTrick(svg: SVGElement, trick: TrickId | 'hop'): void {
  if (reducedMotion()) return;
  const frames: Record<string, Keyframe[]> = {
    hop: [{ transform: 'none' }, { transform: 'translateY(-12%) scale(1.04,.96)' }, { transform: 'none' }],
    wave: [{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }],
    spin: [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(180deg) scale(1.1)' }, { transform: 'rotate(360deg) scale(1)' }],
    dance: [{ transform: 'none' }, { transform: 'translate(-10%,-8%) rotate(-10deg)' }, { transform: 'translate(10%,0) rotate(10deg)' }, { transform: 'translate(-10%,-8%) rotate(-10deg)' }, { transform: 'translate(10%,0) rotate(10deg)' }, { transform: 'none' }],
  };
  svg.animate(frames[trick], { duration: trick === 'dance' ? 1400 : trick === 'hop' ? 420 : 900, easing: 'ease-in-out' });
}

/** A snack flies into the pet, it hops, and hearts float up. */
async function snackMoment(app: App, body: HTMLElement, icon: string, hearts: number): Promise<void> {
  const box = body.querySelector<HTMLElement>('.pet-stagebox');
  const svg = box?.querySelector<SVGElement>('svg.pet');
  if (!box || !svg || reducedMotion()) return;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await wait(250);
  const snack = html(`<span class="pet-fly" aria-hidden="true">${icon}</span>`);
  box.appendChild(snack);
  await snack.animate([{ transform: 'translate(-50%,120%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-20%) scale(1.2)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,10%) scale(.2)', opacity: 0 }], { duration: 650, easing: 'ease-out' }).finished;
  snack.remove();
  doTrick(svg, 'hop');
  for (let k = 0; k < Math.min(4, hearts + 1); k++) {
    const h = html(`<span class="pet-heart" aria-hidden="true">❤️</span>`);
    h.style.left = `${35 + k * 10}%`;
    box.appendChild(h);
    void h.animate([{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { transform: 'translateY(-30px) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translateY(-80px) scale(1.1)', opacity: 0 }], { duration: 1100, delay: k * 120, easing: 'ease-out' }).finished.then(() => h.remove());
  }
  app.haptics.match(3);
  await wait(900);
}

// ── hatching ────────────────────────────────────────────────────────────────
/** The egg wobbles, cracks and opens; the child picks a pet and names it. */
export function hatchMoment(app: App, c: Child): Promise<void> {
  const calm = reducedMotion();
  const ov = html(`<div class="overlay pet-hatch-ov" role="dialog" aria-modal="true" aria-label="Hatch your egg">
    <div class="ph-stage">
      <div class="ph-burst" aria-hidden="true"></div>
      <div class="ph-egg">${eggSvg()}</div>
      <p class="ph-say" aria-live="polite">${calm ? 'Your egg is hatching!' : 'Something is wriggling…'}</p>
    </div>
    <div class="ph-pick" hidden>
      <h2>Who’s inside? You choose!</h2>
      <div class="ph-grid">${SPECIES.map((sp) => `<button class="ph-opt" data-sp="${sp.id}">${petSvg(sp.id, { cls: 'alive' })}<b>${esc(sp.name)}</b><small>${esc(sp.blurb)}</small></button>`).join('')}</div>
    </div>
    <div class="ph-name" hidden>
      <div class="ph-chosen"></div>
      <h2>What’s its name?</h2>
      <input class="ph-input" type="text" maxlength="${PET_NAME_MAX}" autocomplete="off" aria-label="Pet name">
      <div class="ph-sugg"></div>
      <button class="btn mint ph-ok" disabled>That’s the name!</button>
      <button class="btn ghost small ph-back">Pick a different pet</button>
    </div>
    <button class="ph-close" aria-label="Close" data-back>✕</button>
  </div>`);
  app.root.appendChild(ov);
  const say = ov.querySelector<HTMLElement>('.ph-say')!;
  const eggEl = ov.querySelector<HTMLElement>('.ph-egg')!;
  let chosen: Species | null = null;
  return new Promise((done) => {
    const close = () => {
      ov.remove();
      done();
    };
    ov.querySelector('.ph-close')!.addEventListener('click', close);
    const showPick = () => {
      ov.querySelector<HTMLElement>('.ph-stage')!.hidden = true;
      ov.querySelector<HTMLElement>('.ph-name')!.hidden = true;
      const pick = ov.querySelector<HTMLElement>('.ph-pick')!;
      pick.hidden = false;
      if (!calm) stagger(pick.querySelectorAll('.ph-opt'), { gap: 90, y: 16 });
      app.voice.say('Who is inside? You choose!');
    };
    const showName = (sp: Species) => {
      chosen = sp;
      ov.querySelector<HTMLElement>('.ph-pick')!.hidden = true;
      const box = ov.querySelector<HTMLElement>('.ph-name')!;
      box.hidden = false;
      box.querySelector('.ph-chosen')!.innerHTML = petSvg(sp, { cls: 'alive' });
      const input = box.querySelector<HTMLInputElement>('.ph-input')!;
      const names = speciesOf(sp)!.names;
      input.placeholder = names[0];
      input.value = '';
      box.querySelector('.ph-sugg')!.innerHTML = names.map((n) => `<button class="chip-btn ph-s">${esc(n)}</button>`).join('');
      const ok = box.querySelector<HTMLButtonElement>('.ph-ok')!;
      const sync = () => (ok.disabled = !cleanName(input.value));
      input.oninput = sync;
      box.querySelectorAll<HTMLButtonElement>('.ph-s').forEach((b) =>
        b.addEventListener('click', () => {
          input.value = b.textContent ?? '';
          sync();
        }),
      );
      sync();
    };
    ov.querySelectorAll<HTMLButtonElement>('.ph-opt').forEach((b) => b.addEventListener('click', () => showName(b.dataset.sp as Species)));
    ov.querySelector('.ph-back')!.addEventListener('click', showPick);
    ov.querySelector('.ph-ok')!.addEventListener('click', async () => {
      const name = cleanName(ov.querySelector<HTMLInputElement>('.ph-input')!.value);
      if (!chosen || !name) return;
      let ok = false;
      app.save.update(() => {
        remember(c, [], Date.now(), app.today);
        ok = hatch(c, chosen!, name, Date.now());
        if (ok) awardBadges(badgeCtx(app, c), Date.now());
      });
      if (!ok) return close();
      const box = ov.querySelector<HTMLElement>('.ph-name')!;
      box.innerHTML = `<div class="ph-chosen big">${petSvg(chosen, { cls: 'alive' })}</div><h2>Say hi to ${esc(name)}!</h2><p>${esc(name)} grows as you learn. Feed snacks to teach tricks.</p><p class="ph-badge">🥚 New badge: Pet Parent</p><button class="btn mint ph-done">Let’s go!</button>`;
      app.sfx.chime();
      app.voice.say(`Say hi to ${name}!`);
      if (!calm) {
        const r = box.querySelector('.ph-chosen')!.getBoundingClientRect();
        app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 80);
      }
      box.querySelector('.ph-done')!.addEventListener('click', close);
    });
    // The egg: wobble, wobble harder, crack, pop.
    void (async () => {
      if (calm) return showPick();
      const shell = eggEl.querySelector<SVGElement>('svg')!;
      for (const [deg, ms] of [
        [6, 420],
        [10, 380],
        [16, 340],
      ] as const) {
        await shell.animate([{ transform: 'rotate(0)' }, { transform: `rotate(-${deg}deg)` }, { transform: `rotate(${deg}deg)` }, { transform: 'rotate(0)' }], { duration: ms, easing: 'ease-in-out' }).finished;
        app.haptics.tap();
        await wait(120);
      }
      say.textContent = 'Crack!';
      eggEl.classList.add('cracked');
      app.sfx.pop();
      await wait(600);
      eggEl.classList.add('pop');
      ov.querySelector('.ph-burst')!.classList.add('on');
      const r = eggEl.getBoundingClientRect();
      app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 60);
      await wait(700);
      if (ov.isConnected) showPick();
    })();
  });
}

// ── growing up ──────────────────────────────────────────────────────────────
/** After play: if the pet reached a new stage since the last look, celebrate it once. */
export async function petStageCheck(app: App, c: Child): Promise<void> {
  const p = c.adventure?.on ? c.adventure.pet : undefined;
  if (!p) return;
  const n = petStage(c).stage.n;
  const seen = p.seenStage ?? 1;
  if (n <= seen) {
    if (n < seen) app.save.update(() => (p.seenStage = n));
    return;
  }
  app.save.update(() => {
    p.seenStage = n;
    awardBadges(badgeCtx(app, c), Date.now());
  });
  const st = STAGES[n - 1];
  const ov = html(`<div class="overlay pet-grow-ov" role="dialog" aria-modal="true" aria-label="${esc(p.name)} grew">
    <div class="lu-card pg-card">
      <p class="lu-kicker">${esc(p.name)} grew!</p>
      <div class="pg-pet s${n}">${petSvg(p.species, { stage: n, cls: 'alive' })}</div>
      <h2>Now a ${st.name} ${esc(kindName(p.species))}!</h2>
      <p>${n >= 5 ? 'Legendary! The biggest, shiniest pet there is. Wow!' : n === 4 ? `${esc(p.name)} is glowing with all your maths power!` : `All that learning made ${esc(p.name)} grow.`}</p>
      <button class="btn pg-ok" data-back>Yay!</button>
    </div>
  </div>`);
  app.root.appendChild(ov);
  app.sfx.chime();
  app.voice.say(`${p.name} grew! Now a ${st.name} ${kindName(p.species)}!`);
  if (!reducedMotion()) {
    ov.querySelector('.pg-card')!.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: 620, easing: EASE_SPRING });
    setTimeout(() => {
      const r = ov.querySelector('.pg-pet')!.getBoundingClientRect();
      app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 90);
    }, 450);
  }
  await new Promise<void>((done) =>
    ov.querySelector('.pg-ok')!.addEventListener('click', () => {
      ov.remove();
      done();
    }),
  );
}

// ── in a level ──────────────────────────────────────────────────────────────
/** The pet peeks in from the side with a cheer (combos of 5+, and the end of a level). */
export function petPeek(app: App, c: Child, screen: HTMLElement, text: string): void {
  const p = c.adventure?.on ? c.adventure.pet : undefined;
  if (!p || !screen.isConnected) return;
  screen.querySelector('.pet-peek')?.remove();
  const el = html(`<div class="pet-peek" aria-hidden="true"><span class="pp-pet">${petSvg(p.species, { stage: petStage(c).stage.n, cls: 'alive' })}</span><span class="pp-say">${esc(text)}</span></div>`);
  screen.appendChild(el);
  if (reducedMotion()) {
    setTimeout(() => el.remove(), 1600);
    return;
  }
  el.animate([{ transform: 'translateX(-110%)' }, { transform: 'translateX(4%)', offset: 0.7 }, { transform: 'translateX(0)' }], { duration: 420, easing: 'ease-out' });
  setTimeout(() => void el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-110%)' }], { duration: 320, easing: 'ease-in' }).finished.then(() => el.remove()), 1500);
}

export const peekLine = (c: Child, run: number): string => {
  const n = c.adventure?.pet?.name ?? '';
  return run >= 10 ? `${n}: WOW! ${run} in a row!` : `${n}: ${run} in a row! Go go go!`;
};
