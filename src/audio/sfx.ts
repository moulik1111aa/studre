// Synthesised sound effects (no audio files): bright, short and friendly. Notes are soft
// bells (a few overtones that fade faster than the note), with a little room echo and a
// limiter so stacked sounds never crackle.

export class Sfx {
  enabled: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private room: GainNode | null = null;
  private idle = 0;
  private level: number;

  constructor(enabled: boolean, volume = 0.8) {
    this.enabled = enabled;
    this.level = volume;
  }

  /** Volume, 0.2–1 (the parent's slider). */
  get volume(): number {
    return this.level;
  }
  set volume(v: number) {
    this.level = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(0.62 * this.level, this.ctx.currentTime, 0.02);
  }

  /** Browsers only start audio from a user gesture; call on the first tap. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
          (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const c = (this.ctx = new AC());
        this.master = c.createGain();
        this.master.gain.value = 0.62 * this.level;
        // A gentle limiter: chords and coin showers stay clean on phone speakers.
        const lim = c.createDynamicsCompressor();
        lim.threshold.value = -10;
        lim.knee.value = 8;
        lim.ratio.value = 6;
        lim.attack.value = 0.003;
        lim.release.value = 0.15;
        this.master.connect(lim).connect(c.destination);
        // A small room: a soft, darkened echo send.
        this.room = c.createGain();
        this.room.gain.value = 0.18;
        const d = c.createDelay(0.5);
        d.delayTime.value = 0.11;
        const fb = c.createGain();
        fb.gain.value = 0.32;
        const dark = c.createBiquadFilter();
        dark.type = 'lowpass';
        dark.frequency.value = 2600;
        this.room.connect(d).connect(dark).connect(fb).connect(d);
        dark.connect(this.master);
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
  private wake(quiet = 3000): boolean {
    const c = this.ctx;
    if (!c || !this.master || !this.enabled) return false;
    if (c.state === 'suspended') void c.resume().catch(() => {});
    clearTimeout(this.idle);
    this.idle = window.setTimeout(() => void c.suspend().catch(() => {}), quiet);
    return true;
  }

  /** How many times the sound logo was asked for (tests read it). */
  chimes = 0;
  private logo: AudioBuffer | null = null;
  private logoLoading: Promise<AudioBuffer | null> | null = null;
  private lastChime = -1e9;

  private loadLogo(): Promise<AudioBuffer | null> {
    const c = this.ctx;
    if (this.logo || !c) return Promise.resolve(this.logo);
    this.logoLoading ??= (async () => {
      try {
        const b64 = document.getElementById('logo-audio')?.textContent?.trim();
        if (!b64) return null;
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        this.logo = await c.decodeAudioData(bytes.buffer);
        return this.logo;
      } catch {
        return null;
      }
    })();
    return this.logoLoading;
  }

  /** MN's sound logo ("Chime Pop") for the big moments: opening, level-ups, chests, rewards, perfect scores. */
  chime(): void {
    if (!this.enabled) return;
    const now = performance.now();
    // Never twice on top of each other.
    if (now - this.lastChime < 2500) return;
    this.lastChime = now;
    this.chimes++;
    void this.loadLogo().then((buf) => {
      const c = this.ctx;
      if (!buf || !c || !this.master || !this.wake(4500)) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = 0.9;
      src.connect(g).connect(this.master);
      src.start();
    });
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slide = 0, wet = 0): void {
    const c = this.ctx;
    if (!c || !this.master || !this.wake()) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    if (wet && this.room) {
      const w = c.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.room);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** A soft bell: the note plus two overtones that fade sooner, with a touch of room. */
  private bell(freq: number, start: number, dur: number, vol = 0.2, wet = 0.6): void {
    this.tone(freq, start, dur, 'sine', vol, 0, wet);
    this.tone(freq * 2, start, dur * 0.45, 'sine', vol * 0.32, 0, wet);
    this.tone(freq * 3.01, start, dur * 0.22, 'sine', vol * 0.14, 0, wet);
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
    this.tone(1400, 0, 0.035, 'sine', 0.09, 0.6);
    this.tone(700, 0, 0.05, 'triangle', 0.05);
  }
  key(): void {
    this.tone(900, 0, 0.04, 'sine', 0.08, 0.7);
  }
  /** Right answer: a rising three-note bell chord, a step higher with each answer in a row. */
  correct(streak = 1): void {
    const base = 523.25 * Math.pow(2, [0, 2, 4, 5, 7, 9, 11][Math.min(streak - 1, 6)] / 12);
    this.bell(base, 0, 0.32, 0.17);
    this.bell(base * 1.26, 0.065, 0.32, 0.15);
    this.bell(base * 1.5, 0.13, 0.5, 0.17);
  }
  /** Wrong answer: a soft low "hmm", never harsh. */
  wrong(): void {
    this.tone(311, 0, 0.16, 'sine', 0.14, 0.9);
    this.tone(262, 0.12, 0.28, 'sine', 0.14, 0.92, 0.3);
  }
  coin(i = 0): void {
    const f = 1568 * Math.pow(2, (i % 5) / 24);
    this.tone(f, 0, 0.07, 'triangle', 0.07, 0, 0.4);
    this.bell(f * 1.335, 0.045, 0.22, 0.08, 0.5);
  }
  whoosh(): void {
    this.noise(0, 0.35, 0.12, 900);
  }
  pop(): void {
    this.tone(660, 0, 0.09, 'sine', 0.18, 2.2);
    this.tone(1320, 0.02, 0.05, 'sine', 0.05);
  }
  hit(critical = false): void {
    this.noise(0, 0.12, 0.3, critical ? 2400 : 1400);
    this.tone(critical ? 180 : 140, 0, 0.18, 'triangle', 0.2, 0.5);
    if (critical) this.bell(1568, 0.04, 0.3, 0.08);
  }
  block(): void {
    this.bell(1046.5, 0, 0.3, 0.14);
    this.bell(1568, 0.04, 0.35, 0.1);
  }
  hurt(): void {
    this.tone(220, 0, 0.26, 'triangle', 0.14, 0.55);
  }
  /** Level done: a little rising tune ending on a ringing chord. */
  fanfare(): void {
    [523.25, 659.25, 783.99].forEach((f, i) => this.bell(f, i * 0.1, 0.32, 0.15));
    [1046.5, 1318.5, 1568].forEach((f) => this.bell(f, 0.32, 1.1, 0.1, 0.8));
  }
  sad(): void {
    [392, 349.23, 311.13].forEach((f, i) => this.tone(f, i * 0.18, 0.32, 'sine', 0.13, 0, 0.4));
  }
  drip(): void {
    this.tone(1100, 0, 0.1, 'sine', 0.13, 0.45, 0.5);
  }
}
