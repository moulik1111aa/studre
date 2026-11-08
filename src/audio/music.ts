// Music for MN Swipe: three loops synthesised live with Web Audio (no audio files, nothing to
// license). The music follows play: a streak adds layers and a little tempo, a swipe whooshes,
// a right answer sparkles (higher with each one in a row), a wrong one muffles the mix for a moment
// and strips it back to the basics.

export interface TrackInfo {
  id: string;
  name: string;
}
export const TRACKS: TrackInfo[] = [
  { id: 'lofi', name: 'Lo-fi' },
  { id: 'arcade', name: 'Arcade' },
  { id: 'dhol', name: 'Dhol pop' },
];

type Inst = 'kick' | 'snare' | 'clap' | 'hat' | 'ohat' | 'tabla' | 'tablaLo';
interface Track {
  bpm: number;
  swing: number;
  /** 16-step drum patterns; each layer starts at an intensity level (0–3). */
  drums: { inst: Inst; steps: string; from: number; vol?: number }[];
  /** Four bars of chords (MIDI notes), one per bar. */
  chords: number[][];
  chordWave: OscillatorType;
  chordFrom: number;
  /** Bass: steps where a bass note plays (root of the bar's chord, an octave down). */
  bass: string;
  bassWave: OscillatorType;
  bassFrom: number;
  /** Lead: an arpeggio over the chord, steps where it plays. */
  lead: string;
  leadWave: OscillatorType;
  leadFrom: number;
  /** Scale for the sparkles (MIDI). */
  scale: number[];
}

const T: Record<string, Track> = {
  lofi: {
    bpm: 82,
    swing: 0.16,
    drums: [
      { inst: 'kick', steps: 'x.....x...x.....', from: 0 },
      { inst: 'snare', steps: '....x.......x...', from: 0, vol: 0.5 },
      { inst: 'hat', steps: 'x.x.x.x.x.x.x.x.', from: 1, vol: 0.35 },
      { inst: 'hat', steps: '.x.x.x.x.x.x.x.x', from: 3, vol: 0.18 },
    ],
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    chordWave: 'triangle',
    chordFrom: 0,
    bass: 'x.......x.....x.',
    bassWave: 'sine',
    bassFrom: 1,
    lead: '..x...x...x...x.',
    leadWave: 'sine',
    leadFrom: 2,
    scale: [72, 74, 76, 79, 81, 84, 86, 88],
  },
  arcade: {
    bpm: 122,
    swing: 0,
    drums: [
      { inst: 'kick', steps: 'x...x...x...x...', from: 0 },
      { inst: 'clap', steps: '....x.......x...', from: 0, vol: 0.55 },
      { inst: 'ohat', steps: '..x...x...x...x.', from: 1, vol: 0.3 },
      { inst: 'hat', steps: 'xxxxxxxxxxxxxxxx', from: 2, vol: 0.16 },
    ],
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ],
    chordWave: 'square',
    chordFrom: 1,
    bass: 'x.x.x.x.x.x.x.x.',
    bassWave: 'sawtooth',
    bassFrom: 0,
    lead: 'x.xx.x.xx.x.x.xx',
    leadWave: 'square',
    leadFrom: 2,
    scale: [69, 72, 74, 76, 79, 81, 84, 88],
  },
  dhol: {
    bpm: 100,
    swing: 0.08,
    drums: [
      { inst: 'kick', steps: 'x..x..x...x..x..', from: 0 },
      { inst: 'tablaLo', steps: '..x.......x..x..', from: 0, vol: 0.7 },
      { inst: 'tabla', steps: '.x.x.xx..x.x.xx.', from: 1, vol: 0.55 },
      { inst: 'clap', steps: '....x.......x...', from: 2, vol: 0.45 },
      { inst: 'hat', steps: 'x.x.x.x.x.x.x.x.', from: 3, vol: 0.14 },
    ],
    chords: [
      [50, 57, 62],
      [48, 55, 60],
      [46, 53, 58],
      [48, 55, 60],
    ],
    chordWave: 'sawtooth',
    chordFrom: 1,
    bass: 'x..x..x...x.....',
    bassWave: 'sine',
    bassFrom: 0,
    lead: 'x.x.xx.x..x.xx.x',
    leadWave: 'triangle',
    leadFrom: 2,
    scale: [74, 75, 78, 79, 81, 82, 85, 86],
  },
};

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Music {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private mix!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private timer = 0;
  private step = 0;
  private next = 0;
  private track = 0;
  /** 0–3: how many layers play. */
  private level = 0;
  private extraBpm = 0;
  private sparkle = 0;
  playing = false;
  muted = false;

  /** Must be called from a tap (browsers start audio only after one). */
  start(track = this.track): void {
    this.track = track;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      this.out = c.createGain();
      this.out.gain.value = this.muted ? 0 : 0.55;
      this.mix = c.createBiquadFilter();
      this.mix.type = 'lowpass';
      this.mix.frequency.value = 18000;
      this.mix.connect(comp).connect(this.out).connect(c.destination);
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    this.playing = false;
    clearInterval(this.timer);
    void this.ctx?.suspend().catch(() => undefined);
  }

  close(): void {
    this.stop();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  setTrack(i: number): void {
    this.track = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    this.step = 0;
    if (this.ctx) this.next = this.ctx.currentTime + 0.05;
  }

  get trackIndex(): number {
    return this.track;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.out.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  /** The streak sets how full and how fast the music is. */
  setStreak(n: number): void {
    this.level = n >= 8 ? 3 : n >= 4 ? 2 : n >= 1 ? 1 : 0;
    this.extraBpm = Math.min(14, n * 1.5);
    this.sparkle = n;
  }

  /** A swipe to the next card: a quick whoosh (faster swipes are brighter). */
  swipe(speed = 1): void {
    const c = this.ctx;
    if (!c || !this.playing) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(2500 + 3500 * Math.min(1, speed), t + 0.28);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    src.connect(f).connect(g).connect(this.mix);
    src.start(t, Math.random() * 0.5, 0.35);
  }

  /** A right answer: a rising sparkle, higher with each one in a row. */
  right(): void {
    const c = this.ctx;
    if (!c || !this.playing) return;
    const sc = T[TRACKS[this.track].id].scale;
    const base = Math.min(sc.length - 3, this.sparkle % (sc.length - 2));
    [0, 1, 2].forEach((k) => this.note(c.currentTime + k * 0.07, hz(sc[base + k]), 0.22, 'triangle', 0.16));
    this.note(c.currentTime + 0.21, hz(sc[base + 2] + 12), 0.4, 'sine', 0.1);
  }

  /** A wrong answer: the mix goes muffled for a moment, with a soft falling note. */
  wrong(): void {
    const c = this.ctx;
    if (!c || !this.playing) return;
    const t = c.currentTime;
    this.mix.frequency.cancelScheduledValues(t);
    this.mix.frequency.setValueAtTime(this.mix.frequency.value, t);
    this.mix.frequency.exponentialRampToValueAtTime(500, t + 0.08);
    this.mix.frequency.exponentialRampToValueAtTime(18000, t + 1.6);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(this.mix);
    o.start(t);
    o.stop(t + 0.42);
  }

  // ── the sequencer ──────────────────────────────────────────────────────
  private schedule(): void {
    const c = this.ctx;
    if (!c) return;
    const tr = T[TRACKS[this.track].id];
    const sixteenth = 60 / (tr.bpm + this.extraBpm) / 4;
    // If the phone was busy and we fell behind, skip ahead rather than play a burst of late notes.
    if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.02;
    while (this.next < c.currentTime + 0.12) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % tr.chords.length;
      const at = this.next + (s % 2 ? tr.swing * sixteenth : 0);
      // One bad note never stops the music.
      try {
        this.play(tr, s, bar, at, sixteenth);
      } catch {
        /* skip this step */
      }
      this.next += sixteenth;
      this.step++;
    }
  }

  private play(tr: Track, s: number, bar: number, t: number, len: number): void {
    for (const d of tr.drums) if (this.level >= d.from && d.steps[s] === 'x') this.drum(d.inst, t, d.vol ?? 1);
    const chord = tr.chords[bar];
    if (this.level >= tr.chordFrom && s === 0) chord.forEach((m) => this.note(t, hz(m), len * 15, tr.chordWave, tr.chordWave === 'triangle' ? 0.06 : 0.025, 1800));
    if (this.level >= tr.chordFrom && tr.chordWave !== 'triangle' && s === 8) chord.forEach((m) => this.note(t, hz(m), len * 6, tr.chordWave, 0.02, 1800));
    if (this.level >= tr.bassFrom && tr.bass[s] === 'x') this.note(t, hz(chord[0] - 12), len * 1.8, tr.bassWave, tr.bassWave === 'sine' ? 0.28 : 0.12, 900);
    if (this.level >= tr.leadFrom && tr.lead[s] === 'x') {
      const m = chord[(Math.floor(s / 2) + bar) % chord.length] + 12;
      this.note(t, hz(m), len * 1.1, tr.leadWave, tr.leadWave === 'square' ? 0.035 : 0.07, 4000);
    }
  }

  private note(t: number, f: number, dur: number, wave: OscillatorType, vol: number, cut = 6000): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = wave;
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cut;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.06, dur));
    o.connect(lp).connect(g).connect(this.mix);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(inst: Inst, t: number, vol: number): void {
    const c = this.ctx!;
    if (inst === 'kick' || inst === 'tabla' || inst === 'tablaLo') {
      const o = c.createOscillator();
      o.type = 'sine';
      const [f0, f1, d] = inst === 'kick' ? [150, 45, 0.16] : inst === 'tabla' ? [520, 380, 0.12] : [180, 95, 0.2];
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + d);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((inst === 'kick' ? 0.9 : 0.5) * vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
      o.connect(g).connect(this.mix);
      o.start(t);
      o.stop(t + d + 0.08);
      return;
    }
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    const [type, freq, d, v] =
      inst === 'snare' ? (['bandpass', 1800, 0.14, 0.45] as const) : inst === 'clap' ? (['bandpass', 1200, 0.12, 0.5] as const) : inst === 'ohat' ? (['highpass', 7000, 0.18, 0.22] as const) : (['highpass', 8000, 0.04, 0.2] as const);
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * vol, t + 0.002);
    if (inst === 'clap') {
      g.gain.exponentialRampToValueAtTime(v * vol * 0.3, t + 0.012);
      g.gain.exponentialRampToValueAtTime(v * vol, t + 0.02);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(this.mix);
    src.start(t, Math.random() * 0.8, d + 0.02);
  }
}
