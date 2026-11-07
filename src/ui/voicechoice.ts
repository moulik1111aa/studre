// A child's first stop: choose who reads the questions aloud, from every English voice on
// the phone (each plays a short sample). Then Plus's tour of the map.

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

const ACCENTS: [RegExp, string][] = [
  [/-IN$/i, 'Indian'],
  [/-GB$/i, 'British'],
  [/-US$/i, 'American'],
  [/-AU$/i, 'Australian'],
  [/-CA$/i, 'Canadian'],
  [/-IE$/i, 'Irish'],
  [/-ZA$/i, 'South African'],
  [/-NG$/i, 'Nigerian'],
];
const accentOf = (v: VoiceInfo): number => {
  const i = ACCENTS.findIndex(([re]) => re.test((v.locale ?? '').replace('_', '-')));
  return i < 0 ? ACCENTS.length : i;
};

/** What every voice reads when it's tried. */
export const VOICE_SAMPLE = 'Hi! I’ll read every question out loud for you. And if an answer goes wrong, I’ll show you how to solve it, one step at a time.';

/**
 * Every English voice on the phone, named plainly by accent and numbered ("Indian English 2"):
 * offline ones first, Indian English first. Phones don't say reliably whether a voice is a
 * man's or a woman's, so the list doesn't guess: you tap to hear each one. Last, a deeper
 * version of the clearest voice, for phones with only higher voices.
 */
export function voiceOptions(voices: VoiceInfo[]): VoiceOption[] {
  const ranked = [...voices].sort((a, b) => Number(a.network) - Number(b.network) || accentOf(a) - accentOf(b));
  const seen: Record<string, number> = {};
  const total: Record<string, number> = {};
  const accentName = (v: VoiceInfo) => (ACCENTS[accentOf(v)]?.[1] ? `${ACCENTS[accentOf(v)][1]} English` : 'English');
  for (const v of ranked) total[accentName(v)] = (total[accentName(v)] ?? 0) + 1;
  const out: VoiceOption[] = ranked.map((v) => {
    const a = accentName(v);
    const n = (seen[a] = (seen[a] ?? 0) + 1);
    return { who: total[a] > 1 ? `${a} ${n}` : a, desc: v.network ? 'Needs internet' : 'Works offline', icon: '🗣️', name: v.name, pitch: 1 };
  });
  const base = ranked.find((v) => !v.network)?.name ?? ranked[0]?.name ?? '';
  if (ranked.length) out.push({ who: 'Deeper voice', desc: 'The clearest voice, a little lower', icon: '🗣️', name: base, pitch: 0.75 });
  return out;
}

const SPEEDS: [number, string][] = [[0.8, 'Slow'], [0.95, 'Normal'], [1.1, 'Quick']];
/** Slow, normal or quick reading (buttons with data-rate). */
export const speedSeg = (rate: number): string => `<div class="seg seg3 vl-speed" role="radiogroup" aria-label="Reading speed">${SPEEDS.map(([v, t]) => `<button class="seg-b${Math.abs(v - rate) < 0.01 ? ' on' : ''}" role="radio" aria-checked="${Math.abs(v - rate) < 0.01}" data-rate="${v}"><b>${t}</b></button>`).join('')}</div>`;

/** The automatic choice, first in every list. */
export const AUTO_VOICE: VoiceOption = { who: 'Automatic', desc: 'MN picks the clearest voice on this phone', icon: '✨', name: '', pitch: 1 };

/** Play the sample in one voice, then go back to the current one. */
export function hearVoice(app: App, o: { name: string; pitch: number }, text = VOICE_SAMPLE, rate?: number): void {
  const [n, p] = [app.voice.name, app.voice.pitch];
  app.voice.name = o.name;
  app.voice.pitch = o.pitch;
  app.voice.say(text, rate, true);
  app.voice.name = n;
  app.voice.pitch = p;
}

/**
 * A tappable list of every voice (Parent area and setup): tap one to choose it and hear it.
 * Returns when the list is drawn.
 */
export async function mountVoiceList(app: App, host: HTMLElement, chosen: { name: string; pitch: number }, rate: () => number, onPick: (o: VoiceOption) => void): Promise<void> {
  host.innerHTML = '<p class="fine">Finding voices…</p>';
  const options = [AUTO_VOICE, ...voiceOptions(await app.voice.list())];
  const isOn = (o: VoiceOption) => o.name === chosen.name && Math.abs(o.pitch - chosen.pitch) < 0.01;
  host.innerHTML = options
    .map((o, k) => `<button class="vl-row${isOn(o) ? ' on' : ''}" data-k="${k}" role="radio" aria-checked="${isOn(o)}"><i class="vl-dot" aria-hidden="true"></i><span><b>${esc(o.who)}</b><small>${esc(o.desc)}</small></span><span class="vl-play" aria-hidden="true">▶</span></button>`)
    .join('');
  host.setAttribute('role', 'radiogroup');
  host.setAttribute('aria-label', 'Reading voice');
  stagger(host.children, { gap: 30 });
  host.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.vl-row');
    if (!b) return;
    const o = options[Number(b.dataset.k)];
    chosen = { name: o.name, pitch: o.pitch };
    host.querySelectorAll<HTMLElement>('.vl-row').forEach((r) => {
      r.classList.toggle('on', r === b);
      r.setAttribute('aria-checked', String(r === b));
    });
    hearVoice(app, o, VOICE_SAMPLE, rate());
    onPick(o);
  };
}

/** Use a child's voice (or the parent's choice when no child is playing). */
export function useVoice(app: App, child?: Child): void {
  const st = app.save.data.settings;
  app.voice.name = child?.voicePicked ? (child.voiceName ?? '') : st.voiceName;
  app.voice.pitch = child?.voicePicked ? (child.voicePitch ?? 1) : (st.voicePitch ?? 1);
}

export function voiceChoiceScreen(child: Child, then: () => void) {
  return (app: App): Screen => {
    let pick = -1;
    let options: VoiceOption[] = [];
    const el = html(`<section class="screen voicechoice" aria-label="Choose a voice">
      <header class="vc-head">${avatarHtml(child.avatar, 64)}<div><h1 class="title">Who should read to you, ${esc(child.name)}?</h1><p class="vc-sub">Tap a voice to hear it. A parent can help you choose.</p></div></header>
      <div class="vc-list"><p class="fine">Finding voices…</p></div>
      <button class="btn mint vc-go" disabled>Choose a voice</button>
      <p class="fine vc-later">You can change it later in the parent area.</p>
      <p class="card vc-together">🤝 <b>Parent:</b> please sit with ${esc(child.name)} for the first 3 levels. They’re practice rounds: after a slip Plus shows how and they try one like it. Only first tries earn coins.</p>
    </section>`);
    const list = el.querySelector<HTMLElement>('.vc-list')!;
    const go = el.querySelector<HTMLButtonElement>('.vc-go')!;
    const hear = (o: VoiceOption) => hearVoice(app, o, VOICE_SAMPLE.replace('Hi!', `Hi ${child.name}!`));
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
      go.textContent = 'Choose this voice';
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
        options = [AUTO_VOICE, ...voiceOptions(await app.voice.list())];
        paint();
        stagger(list.children, { gap: 80 });
      },
      back: () => true,
    };
  };
}
