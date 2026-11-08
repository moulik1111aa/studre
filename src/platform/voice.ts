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

/** Words the phone's voice gets wrong: "MN" is said letter by letter (not "man"), and "MN ×" is "M N Times".
 *  Emoji are never read out ("chick hatching: A pet…"): they are decoration; a question whose emoji
 *  stands for a word has already turned it into the word (spoken() in core/question.ts). */
export const sayable = (t: string): string =>
  t
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*\uFE0F?/gu, ' ')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/\s+([.,!?:;])/g, '$1')
    .replace(/^[\s.,:;]+/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/, '')
    .replace(/\bMN(?:\s|\u00a0)*×/g, 'M N Times')
    .replace(/\bMN\b/g, 'M N')
    // "5 / 2" written with spaces is a division (engines read it as "5 2").
    .replace(/([\d)])\s+\/\s+(?=[\d(])/g, '$1 divided by ');

export class Voice {
  enabled: boolean;
  /** Parent's choice: a voice name ('' = automatic) and speed (0.75–1.15). */
  name = '';
  rate = 0.95;
  /** 1 is the voice's own pitch; a little lower or higher gives a deeper or brighter voice. */
  pitch = 1;
  private readonly native: StudyHardPlugin | null;
  private webVoices: SpeechSynthesisVoice[] = [];
  /** Automatic means a man's voice when the phone has one (the best-ranked), else the best voice. */
  private autoName = '';
  /** Which kind of voice "automatic" means: a man's (default) or a woman's. */
  private gender: 'm' | 'f' = 'm';

  constructor(enabled: boolean, native: StudyHardPlugin | null, name = '', rate = 0.95, gender: 'm' | 'f' = 'm') {
    this.enabled = enabled;
    this.native = native;
    this.name = name;
    this.rate = rate;
    this.gender = gender;
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
    void this.findAuto();
  }

  /** Switch the automatic voice between a man's and a woman's. */
  setGender(g: 'm' | 'f'): void {
    if (g === this.gender && this.autoName) return;
    this.gender = g;
    this.autoName = '';
    void this.findAuto();
  }

  /** The automatic voice: the best voice of the chosen kind (voices come best first). */
  private async findAuto(): Promise<void> {
    for (let i = 0; i < 6 && !this.autoName; i++) {
      const list = await this.list().catch(() => [] as VoiceInfo[]);
      this.autoName = (list.find((v) => v.gender === this.gender) ?? list[0])?.name ?? '';
      if (!this.autoName) await new Promise((r) => setTimeout(r, 800));
    }
  }

  /** The voice that speaks: the parent's choice, or the automatic one. */
  get speaking(): string {
    return this.name || this.autoName;
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
    this.sayParts([text], rate, force);
  }

  /**
   * Say a few lines one after another, with a short breath between them (a lesson step's
   * explanation and its working lines), so they don't run together as one sentence.
   */
  sayParts(parts: string[], rate = this.rate, force = false, gapMs = 450): void {
    if (!this.enabled && !force) return;
    const lines = parts.map((p) => sayable(p).trim()).filter(Boolean);
    if (!lines.length) return;
    if (this.native) {
      // QUEUE_FLUSH replaces whatever was being said; a separate stop could land after it.
      const o = { text: lines.join('. '), rate, pitch: this.pitch, voice: this.speaking || undefined, ...(lines.length > 1 ? { parts: lines, gap: gapMs } : {}) };
      quietly(this.native.speak(o));
      return;
    }
    this.stop();
    try {
      const v = this.webVoices.find((x) => x.name === this.speaking) ?? this.webVoices[0];
      // The browser queues them and leaves a small natural gap between utterances.
      for (const line of lines) {
        const u = new SpeechSynthesisUtterance(line);
        u.rate = rate;
        u.pitch = this.pitch;
        if (v) {
          u.voice = v;
          u.lang = v.lang;
        } else u.lang = 'en-IN';
        speechSynthesis.speak(u);
      }
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
