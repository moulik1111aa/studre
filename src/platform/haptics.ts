// Vibration feedback. In the Android app this uses the phone's haptic engine
// through the native plugin (crisp predefined ticks and clicks); in a browser it
// falls back to the web Vibration API where allowed. Never throws.

import { quietly, type HapticKind, type PairfallPlugin } from './native.ts';

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 6,
  match: 14,
  combo: [14, 40, 22],
  heartbeat: [18, 90, 26],
  win: [30, 60, 30, 60, 70],
  lose: [90, 70, 140],
};

export class Haptics {
  enabled: boolean;
  private readonly native: PairfallPlugin | null;

  constructor(enabled: boolean, native: PairfallPlugin | null = null) {
    this.enabled = enabled;
    this.native = native;
  }

  private buzz(kind: HapticKind): void {
    if (!this.enabled) return;
    if (this.native) {
      try {
        quietly(this.native.haptic({ kind }));
      } catch {
        /* bridge gone */
      }
      return;
    }
    try {
      navigator.vibrate?.(WEB_PATTERNS[kind]);
    } catch {
      /* not allowed here */
    }
  }

  tap(): void {
    this.buzz('tap');
  }
  match(combo: number): void {
    this.buzz(combo >= 3 ? 'combo' : 'match');
  }
  heartbeat(): void {
    this.buzz('heartbeat');
  }
  win(): void {
    this.buzz('win');
  }
  lose(): void {
    this.buzz('lose');
  }
}
