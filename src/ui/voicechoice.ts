// A child's first stop: choose who reads the questions aloud (a woman's or a man's voice,
// and an accent), each with a short hello. Then Biscuit's tour of the map.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import type { VoiceInfo } from '../platform/voice.ts';
import { avatarHtml } from './icons.ts';
import { stagger, popIn } from '../render/motion.ts';

export interface VoiceOption {
  who: string;
  desc: string;
  icon: string;
  /** Phone voice name ('' = the automatic one) and pitch. */
  name: string;
  pitch: number;
}

const REGIONS: [RegExp, string, string, string][] = [
  // locale, accent, woman's name, man's name
  [/-IN$/i, 'Indian', 'Asha', 'Arjun'],
  [/-GB$/i, 'British', 'Emma', 'Oliver'],
  [/-US$/i, 'American', 'Ava', 'Leo'],
  [/-AU$/i, 'Australian', 'Ruby', 'Jack'],
];

/** Up to four voices to offer: the clearest woman's and man's voice, then other accents. */
export function voiceOptions(voices: VoiceInfo[]): VoiceOption[] {
  const region = (v: VoiceInfo) => REGIONS.findIndex(([re]) => re.test((v.locale ?? '').replace('_', '-')));
  const ranked = voices
    .filter((v) => region(v) >= 0)
    .sort((a, b) => Number(a.network) - Number(b.network) || region(a) - region(b));
  const out: VoiceOption[] = [];
  const used = new Set<string>();
  const add = (v: VoiceInfo, g: 'f' | 'm') => {
    const [, accent, her, him] = REGIONS[region(v)];
    const who = g === 'f' ? her : him;
    if (used.has(v.name) || out.some((o) => o.who === who)) return;
    used.add(v.name);
    out.push({ who, desc: `${accent} · ${g === 'f' ? 'woman’s voice' : 'man’s voice'}`, icon: g === 'f' ? '👩' : '👨', name: v.name, pitch: 1 });
  };
  for (const g of ['f', 'm'] as const) {
    const v = ranked.find((x) => x.gender === g);
    if (v) add(v, g);
  }
  // Other accents, if the phone has them.
  for (const v of ranked) {
    if (out.length >= 4) break;
    if (v.gender && region(v) !== region(ranked[0])) add(v, v.gender);
  }
  // No man's (or woman's) voice on this phone: the same voice, deeper (or brighter).
  const base = out[0]?.name ?? ranked[0]?.name ?? '';
  if (!out.some((o) => o.icon === '👨')) out.push({ who: 'Arjun', desc: 'Deeper voice', icon: '👨', name: base, pitch: 0.72 });
  if (!out.some((o) => o.icon === '👩')) out.unshift({ who: 'Asha', desc: 'Brighter voice', icon: '👩', name: base, pitch: 1.18 });
  return out.slice(0, 4);
}

/** Use a child's voice (or the parent's choice when no child is playing). */
export function useVoice(app: App, child?: Child): void {
  const st = app.save.data.settings;
  app.voice.name = child?.voicePicked ? (child.voiceName ?? '') : st.voiceName;
  app.voice.pitch = child?.voicePicked ? (child.voicePitch ?? 1) : 1;
}

export function voiceChoiceScreen(child: Child, then: () => void) {
  return (app: App): Screen => {
    let pick = -1;
    let options: VoiceOption[] = [];
    const el = html(`<section class="screen voicechoice" aria-label="Choose a voice">
      <header class="vc-head">${avatarHtml(child.avatar, 64)}<div><h1 class="title">Who should read to you, ${esc(child.name)}?</h1><p class="vc-sub">Tap a voice to hear it. A grown-up can help you choose.</p></div></header>
      <div class="vc-list"><p class="fine">Finding voices…</p></div>
      <button class="btn mint vc-go" disabled>Choose a voice</button>
      <p class="fine vc-later">You can change it later in the parent area.</p>
    </section>`);
    const list = el.querySelector<HTMLElement>('.vc-list')!;
    const go = el.querySelector<HTMLButtonElement>('.vc-go')!;
    const hear = (o: VoiceOption) => {
      const [n, p] = [app.voice.name, app.voice.pitch];
      app.voice.name = o.name;
      app.voice.pitch = o.pitch;
      app.voice.say(`Hi ${child.name}! I'm ${o.who}. Let's learn maths together!`, undefined, true);
      app.voice.name = n;
      app.voice.pitch = p;
    };
    const paint = () => {
      list.innerHTML = options
        .map((o, k) => `<button class="card vc-card${k === pick ? ' on' : ''}" data-k="${k}" aria-pressed="${k === pick}"><span class="vc-face">${o.icon}</span><b>${esc(o.who)}</b><small>${esc(o.desc)}</small><span class="vc-play" aria-hidden="true">▶</span></button>`)
        .join('');
    };
    list.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.vc-card');
      if (!b) return;
      pick = Number(b.dataset.k);
      paint();
      popIn(list.querySelector('.vc-card.on')!, 0, 0.94);
      hear(options[pick]);
      go.disabled = false;
      go.textContent = `Choose ${options[pick].who}`;
    });
    go.addEventListener('click', () => {
      const o = options[pick];
      if (!o) return;
      app.save.update(() => {
        child.voiceName = o.name;
        child.voicePitch = o.pitch;
        child.voicePicked = true;
      });
      useVoice(app, child);
      then();
    });
    return {
      el,
      mounted: async () => {
        stagger(el.querySelector('.vc-head')!.children, { gap: 90 });
        options = voiceOptions(await app.voice.list());
        paint();
        stagger(list.children, { gap: 80 });
      },
      back: () => true,
    };
  };
}
