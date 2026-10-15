// Reading questions aloud. In the app: the phone's text-to-speech, using the clearest English
// voice it has (Indian English first) or the one a parent picked. Elsewhere: the browser's.
import { quietly, type StudyHardPlugin } from './native.ts';

export interface VoiceInfo {
  name: string;
  label: string;
  network: boolean;
}

/** Rank browser voices: natural/neural first, then Indian, British, American English. */
function webScore(v: SpeechSynthesisVoice): number {
  let s = 0;
  if (/natural|neural|enhanced|premium|wavenet/i.test(v.name)) s += 40;
  if (/google/i.test(v.name)) s += 20;
  if (v.lang === 'en-IN') s += 30;
  else if (v.lang === 'en-GB') s += 20;
  else if (v.lang === 'en-US') s += 15;
  if (v.localService) s += 5;
  return s;
}

export class Voice {
  enabled: boolean;
  /** Parent's choice: a voice name ('' = automatic) and speed (0.75–1.15). */
  name = '';
  rate = 0.95;
  private readonly native: StudyHardPlugin | null;
  private webVoices: SpeechSynthesisVoice[] = [];

  constructor(enabled: boolean, native: StudyHardPlugin | null, name = '', rate = 0.95) {
    this.enabled = enabled;
    this.native = native;
    this.name = name;
    this.rate = rate;
    if (!native && 'speechSynthesis' in globalThis) {
      const pick = () => {
        this.webVoices = speechSynthesis
          .getVoices()
          .filter((v) => v.lang.toLowerCase().startsWith('en'))
          .sort((a, b) => webScore(b) - webScore(a));
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  /** Whether any voice can speak here. */
  get available(): boolean {
    return !!this.native || 'speechSynthesis' in globalThis;
  }

  /** English voices to choose from, best first. */
  async list(): Promise<VoiceInfo[]> {
    if (this.native) {
      try {
        const r = await this.native.voices();
        return (r.voices ?? []).map((v) => ({ name: v.name, label: describe(v.name, v.locale), network: v.network }));
      } catch {
        return [];
      }
    }
    return this.webVoices.map((v) => ({ name: v.name, label: `${v.name.replace(/^(Microsoft|Google)\s*/, '')} (${v.lang})`, network: !v.localService }));
  }

  say(text: string, rate = this.rate, force = false): void {
    if ((!this.enabled && !force) || !text) return;
    this.stop();
    if (this.native) {
      quietly(this.native.speak({ text, rate, pitch: 1.0, voice: this.name || undefined }));
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = 1;
      const v = this.webVoices.find((x) => x.name === this.name) ?? this.webVoices[0];
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = 'en-IN';
      speechSynthesis.speak(u);
    } catch {
      /* no speech here */
    }
  }

  stop(): void {
    if (this.native) quietly(this.native.stopSpeaking());
    else
      try {
        speechSynthesis.cancel();
      } catch {
        /* none */
      }
  }
}

/** Android voice names look like "en-in-x-ena-local": make a friendly label. */
function describe(name: string, locale: string): string {
  const region: Record<string, string> = { IN: 'Indian', GB: 'British', US: 'American', AU: 'Australian', NG: 'Nigerian', CA: 'Canadian' };
  const country = locale.split('-')[1]?.toUpperCase() ?? '';
  const id = /-x-([a-z]+)-/i.exec(name)?.[1]?.toUpperCase();
  return `${region[country] ?? locale} English${id ? ` · ${id}` : ''}${/network/i.test(name) ? ' (online)' : ''}`;
}
