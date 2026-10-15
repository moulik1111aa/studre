// Reading questions aloud: the phone's own English voice in the app, the browser's elsewhere.
import { quietly, type StudyHardPlugin } from './native.ts';

export class Voice {
  enabled: boolean;
  private readonly native: StudyHardPlugin | null;
  private webVoice: SpeechSynthesisVoice | null = null;

  constructor(enabled: boolean, native: StudyHardPlugin | null) {
    this.enabled = enabled;
    this.native = native;
    if (!native && 'speechSynthesis' in globalThis) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.webVoice = voices.find((v) => v.lang === 'en-IN') ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  /** Whether any voice can speak here. */
  get available(): boolean {
    return !!this.native || 'speechSynthesis' in globalThis;
  }

  say(text: string, rate = 0.92): void {
    if (!this.enabled || !text) return;
    this.stop();
    if (this.native) {
      quietly(this.native.speak({ text, rate }));
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.lang = this.webVoice?.lang ?? 'en-IN';
      if (this.webVoice) u.voice = this.webVoice;
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
