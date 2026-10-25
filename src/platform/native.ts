// Bridge to the Android shell (Capacitor + the app's own `StudyHard` plugin in
// native/android/StudyHardPlugin.java). In a browser `nativeBridge()` is null and
// web fallbacks are used (speech synthesis, IndexedDB photos, navigator.vibrate).

import type { StorageAdapter } from '../storage/save.ts';
import { browserStorage } from '../storage/save.ts';

export type HapticKind = 'tap' | 'match' | 'combo' | 'heartbeat' | 'win' | 'lose';

export interface StudyHardPlugin {
  haptic(o: { kind: HapticKind }): Promise<void>;
  keepAwake(o: { on: boolean }): Promise<void>;
  exit(): Promise<void>;
  readSave(): Promise<{ values?: Record<string, string> }>;
  deviceId?(): Promise<{ id?: string }>;
  deviceSecure?(): Promise<{ secure?: boolean }>;
  confirmDevice?(o: { title: string; text?: string }): Promise<{ ok?: boolean; none?: boolean }>;
  saveFile?(o: { name: string; mime: string; text: string }): Promise<{ saved?: boolean; error?: string }>;
  writeSave(o: { key: string; value: string }): Promise<void>;
  speak(o: { text: string; rate?: number; pitch?: number; voice?: string }): Promise<void>;
  voices(): Promise<{ voices?: { name: string; locale: string; quality: number; network: boolean }[] }>;
  stopSpeaking(): Promise<void>;
  savePhoto(o: { id: string; dataUrl: string }): Promise<void>;
  loadPhoto(o: { id: string }): Promise<{ dataUrl?: string }>;
  deletePhoto(o: { id: string }): Promise<void>;
  addListener(event: 'back', cb: () => void): unknown;
}

interface SystemBarsPlugin {
  setStyle(o: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?(): boolean;
  Plugins?: { StudyHard?: StudyHardPlugin; SystemBars?: SystemBarsPlugin };
}

function capacitor(): CapacitorGlobal | null {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  try {
    return cap?.isNativePlatform?.() ? cap : null;
  } catch {
    return null;
  }
}

export function nativeBridge(): StudyHardPlugin | null {
  return capacitor()?.Plugins?.StudyHard ?? null;
}

export function setSystemBarStyle(darkBackground: boolean): void {
  capacitor()
    ?.Plugins?.SystemBars?.setStyle({ style: darkBackground ? 'DARK' : 'LIGHT' })
    .catch(() => {});
}

export function quietly(p: Promise<unknown> | undefined): void {
  p?.catch(() => {});
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/** localStorage stays the main copy; every write is mirrored natively and restored if lost. */
export async function nativeStorage(plugin: StudyHardPlugin, web: StorageAdapter = browserStorage()): Promise<StorageAdapter> {
  try {
    const { values = {} } = await timeout(plugin.readSave(), 1500);
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string' && web.get(key) === null) web.set(key, value);
    }
  } catch {
    /* mirror unavailable */
  }
  return {
    get: (key: string) => web.get(key),
    set(key: string, value: string) {
      web.set(key, value);
      quietly(plugin.writeSave({ key, value }));
    },
  };
}
