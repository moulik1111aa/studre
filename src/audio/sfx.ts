// Synthesised sound effects (no audio files): bright, short and friendly.

export class Sfx {
  enabled: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private idle = 0;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Browsers only start audio from a user gesture; call on the first tap. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
          (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* no audio */
    }
  }

  suspend(): void {
    clearTimeout(this.idle);
    void this.ctx?.suspend().catch(() => {});
  }
  /** Coming back to the app: the engine wakes on the next sound instead (see wake). */
  resume(): void {}

  /** Wake the audio engine for a sound, and put it back to sleep after 3 quiet seconds
   *  (a running AudioContext keeps the phone's audio thread busy even in silence). */
  private wake(): boolean {
    const c = this.ctx;
    if (!c || !this.master || !this.enabled) return false;
    if (c.state === 'suspended') void c.resume().catch(() => {});
    clearTimeout(this.idle);
    this.idle = window.setTimeout(() => void c.suspend().catch(() => {}), 3000);
    return true;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slide = 0): void {
    const c = this.ctx;
    if (!c || !this.master || !this.wake()) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(start: number, dur: number, vol = 0.2, lowpass = 1200): void {
    const c = this.ctx;
    if (!c || !this.master || !this.wake()) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(c.currentTime + start);
  }

  tap(): void {
    this.tone(660, 0, 0.06, 'triangle', 0.12);
  }
  key(): void {
    this.tone(520, 0, 0.05, 'triangle', 0.1);
  }
  correct(streak = 1): void {
    const base = 523.25 * Math.pow(2, Math.min(streak - 1, 6) / 12);
    this.tone(base, 0, 0.14, 'triangle', 0.22);
    this.tone(base * 1.26, 0.07, 0.14, 'triangle', 0.2);
    this.tone(base * 1.5, 0.14, 0.24, 'sine', 0.22);
  }
  wrong(): void {
    this.tone(220, 0, 0.22, 'sine', 0.2, 0.7);
  }
  coin(i = 0): void {
    this.tone(1318.5 + i * 40, 0, 0.08, 'square', 0.06);
    this.tone(1975.5 + i * 40, 0.05, 0.12, 'square', 0.05);
  }
  whoosh(): void {
    this.noise(0, 0.35, 0.15, 900);
  }
  pop(): void {
    this.tone(880, 0, 0.08, 'sine', 0.2, 1.8);
  }
  hit(critical = false): void {
    this.noise(0, 0.15, 0.35, critical ? 2400 : 1400);
    this.tone(critical ? 180 : 140, 0, 0.18, 'square', 0.15, 0.5);
  }
  block(): void {
    this.tone(1046, 0, 0.12, 'triangle', 0.2);
    this.tone(1568, 0.04, 0.2, 'sine', 0.15);
  }
  hurt(): void {
    this.tone(200, 0, 0.3, 'sawtooth', 0.12, 0.5);
  }
  fanfare(): void {
    const n = [523.25, 659.25, 783.99, 1046.5];
    n.forEach((f, i) => this.tone(f, i * 0.11, 0.3, 'triangle', 0.2));
    this.tone(1046.5, 0.5, 0.6, 'sine', 0.2);
  }
  sad(): void {
    [392, 349.23, 311.13].forEach((f, i) => this.tone(f, i * 0.18, 0.3, 'sine', 0.15));
  }
  drip(): void {
    this.tone(900, 0, 0.12, 'sine', 0.15, 0.4);
  }
}
