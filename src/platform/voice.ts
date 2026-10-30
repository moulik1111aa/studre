// Reading questions aloud. In the app: the phone's text-to-speech, using the clearest English
// voice it has (Indian English first) or the one a parent picked. Elsewhere: the browser's.
import { quietly, type StudyHardPlugin } from './native.ts';

export interface VoiceInfo {
  name: string;
  label: string;
  network: boolean;
  /** Language tag, e.g. "en-IN". */
  locale?: string;
  /** Woman's or man's voice, when it can be told from the voice's name. */
  gender?: 'f' | 'm';
}

/**
 * Google's Android voices are named "en-in-x-ena-local": the three letters tell the
 * speaker. Known ones, and browser voices that say so in their names.
 */
const ANDROID_GENDER: Record<string, 'f' | 'm'> = {
  ena: 'f', ahp: 'f', cxx: 'f', enc: 'm', end: 'm',
  gba: 'f', gbc: 'f', gbg: 'f', fis: 'f', gbb: 'm', gbd: 'm', rjs: 'm',
  iob: 'f', iog: 'f', sfg: 'f', tpc: 'f', tpf: 'f', iol: 'm', iom: 'm', tpd: 'm',
  afh: 'f', aua: 'f', auc: 'f', aub: 'm', aud: 'm',
};
export function genderOf(name: string): 'f' | 'm' | undefined {
  const id = /-x-([a-z]{3})[-_]/i.exec(name)?.[1]?.toLowerCase();
  if (id && ANDROID_GENDER[id]) return ANDROID_GENDER[id];
  if (/\b(female|woman|zira|samantha|heera|veena|susan|hazel|libby|sonia|natasha|aria|jenny|karen|moira|tessa|serena|kate|fiona|neerja)\b/i.test(name)) return 'f';
  if (/\b(male|man|david|mark|daniel|ravi|george|ryan|thomas|guy|prabhat|rishi|oliver|arthur|aaron|fred)\b/i.test(name)) return 'm';
  return undefined;
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
  /** 1 is the voice's own pitch; a little lower or higher gives a deeper or brighter voice. */
  pitch = 1;
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
        return (r.voices ?? []).map((v) => ({ name: v.name, label: describe(v.name, v.locale), network: v.network, locale: v.locale, gender: genderOf(v.name) }));
      } catch {
        return [];
      }
    }
    return this.webVoices.map((v) => ({ name: v.name, label: `${v.name.replace(/^(Microsoft|Google)\s*/, '')} (${v.lang})`, network: !v.localService, locale: v.lang, gender: genderOf(v.name) }));
  }

  say(text: string, rate = this.rate, force = false): void {
    if ((!this.enabled && !force) || !text) return;
    if (this.native) {
      // QUEUE_FLUSH replaces whatever was being said; a separate stop could land after it.
      quietly(this.native.speak({ text, rate, pitch: this.pitch, voice: this.name || undefined }));
      return;
    }
    this.stop();
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = this.pitch;
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

  /**
   * Wait until the voice has finished talking (at most `maxMs`). Resolves true when it could
   * tell, false when this phone can't say (then callers fall back to a reading-time guess).
   */
  async whenDone(maxMs = 30000): Promise<boolean> {
    if (!this.enabled) return false;
    const t0 = Date.now();
    const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // First wait for it to start talking (engines can take a moment); if it never does, we can't tell.
    let started = false;
    while (Date.now() - t0 < maxMs) {
      let on: boolean;
      if (this.native) {
        try {
          on = !!(await this.native.speaking!()).speaking;
        } catch {
          return false;
        }
      } else if ('speechSynthesis' in globalThis) on = speechSynthesis.speaking || speechSynthesis.pending;
      else return false;
      if (on) started = true;
      else if (started) return true;
      else if (Date.now() - t0 > 3000) return false;
      await pause(started ? 250 : 150);
    }
    return true;
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
