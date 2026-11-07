// The Play Store build: no owner area (see owner.ts, which this replaces at build time).
import type { App, Screen } from './app.ts';

export const ownerScreen: ((leave: () => void) => (app: App) => Screen) | null = null;
