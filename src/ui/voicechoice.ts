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

/**
 * Every English voice on the phone, described plainly (accent, a woman's or a man's voice,
 * numbered when there are several alike): offline ones first, Indian English first.
 */
export function voiceOptions(voices: VoiceInfo[]): VoiceOption[] {
  const ranked = [...voices].sort((a, b) => Number(a.network) - Number(b.network) || accentOf(a) - accentOf(b) || (a.gender ?? 'z').localeCompare(b.gender ?? 'z'));
  const seen: Record<string, number> = {};
  const total: Record<string, number> = {};
  const kind = (v: VoiceInfo) => `${ACCENTS[accentOf(v)]?.[1] ?? 'English'}|${v.gender ?? ''}|${v.network ? 'n' : ''}`;
  for (const v of ranked) total[kind(v)] = (total[kind(v)] ?? 0) + 1;
  const out: VoiceOption[] = ranked.map((v) => {
    const k = kind(v);
    const n = (seen[k] = (seen[k] ?? 0) + 1);
    const accent = ACCENTS[accentOf(v)]?.[1];
    const who = v.gender === 'f' ? 'Woman’s voice' : v.gender === 'm' ? 'Man’s voice' : 'Voice';
    return {
      who: total[k] > 1 ? `${who} ${n}` : who,
      desc: `${accent ? `${accent} English` : (v.locale ?? 'English')}${v.network ? ' · needs internet' : ''}`,
      icon: v.gender === 'f' ? '👩' : v.gender === 'm' ? '👨' : '🗣️',
      name: v.name,
      pitch: 1,
    };
  });
  // No man's (or woman's) voice on this phone: the clearest voice, deeper (or higher).
  const base = ranked.find((v) => !v.network)?.name ?? ranked[0]?.name ?? '';
  if (!out.some((o) => o.icon === '👨')) out.push({ who: 'Deeper voice', desc: 'The clearest voice, lower', icon: '👨', name: base, pitch: 0.72 });
  if (!out.some((o) => o.icon === '👩')) out.push({ who: 'Higher voice', desc: 'The clearest voice, higher', icon: '👩', name: base, pitch: 1.18 });
  return out;
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
      <p class="card vc-together">🤝 <b>Grown-up:</b> please sit with ${esc(child.name)} for the first 3 levels. They’re practice rounds: after a slip Plus shows how and they try one like it. Only first tries earn coins.</p>
    </section>`);
    const list = el.querySelector<HTMLElement>('.vc-list')!;
    const go = el.querySelector<HTMLButtonElement>('.vc-go')!;
    const hear = (o: VoiceOption) => {
      const [n, p] = [app.voice.name, app.voice.pitch];
      app.voice.name = o.name;
      app.voice.pitch = o.pitch;
      app.voice.say(`Hi ${child.name}! Shall I read your maths questions? What is 7 plus 8?`, undefined, true);
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
        options = voiceOptions(await app.voice.list());
        paint();
        stagger(list.children, { gap: 80 });
      },
      back: () => true,
    };
  };
}
