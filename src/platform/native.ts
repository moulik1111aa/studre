// Bridge to the Android shell (Capacitor + the app's own `StudyHard` plugin in
// native/android/StudyHardPlugin.java). In a browser `nativeBridge()` is null and
// web fallbacks are used (speech synthesis, IndexedDB photos, navigator.vibrate).

import type { StorageAdapter } from '../storage/save.ts';
import { browserStorage, revOf, PRIMARY, BACKUP } from '../storage/save.ts';

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
  /** Turn HTML into an A4 PDF and open the share sheet (or the print screen if that fails). */
  sharePdf?(o: { html: string; name: string; title: string; landscape?: boolean }): Promise<{ ok: boolean; via?: 'share' | 'print'; error?: string }>;
  /** Written to disk before it resolves (ok: false if the phone couldn't store it). */
  writeSave(o: { key: string; value: string }): Promise<{ ok?: boolean } | void>;
  /** `parts` (newer apps): said one after another with `gap` ms of quiet between; `text` is all of it joined, for older apps. */
  /** Home-screen widgets placed, and whether the launcher can add one from the app. */
  widgetState?(): Promise<{ placed: number; canPin: boolean }>;
  /** Ask the launcher to add a widget: today, focus, jar or fact. ok: its box was shown. */
  pinWidget?(o: { kind: 'today' | 'focus' | 'jar' | 'fact' }): Promise<{ ok: boolean }>;
  speak(o: { text: string; rate?: number; pitch?: number; voice?: string; parts?: string[]; gap?: number }): Promise<void>;
  voices(): Promise<{ voices?: { name: string; locale: string; quality: number; network: boolean }[] }>;
  stopSpeaking(): Promise<void>;
  /** Whether the voice is still talking (newer apps only). */
  speaking?(): Promise<{ speaking: boolean }>;
  savePhoto(o: { id: string; dataUrl: string }): Promise<void>;
  loadPhoto(o: { id: string }): Promise<{ dataUrl?: string }>;
  deletePhoto(o: { id: string }): Promise<void>;
  setReminders?(o: { plan: string }): Promise<{ enabled?: boolean; canAsk?: boolean; snoozeUntil?: number }>;
  notificationState?(): Promise<{ enabled?: boolean; canAsk?: boolean; snoozeUntil?: number }>;
  askNotifications?(): Promise<{ enabled?: boolean; canAsk?: boolean }>;
  openNotificationSettings?(): Promise<void>;
  /** Open an https page in the phone's browser. */
  openUrl?(o: { url: string }): Promise<void>;
  launchAction?(): Promise<{ open?: string }>;
  /** A file shared to MN or opened with it (taken once): its text and name. Newer apps only. */
  /** A file shared to MN, once: its text and name, or why it wasn't read ('too-big', 'unsupported', 'unreadable'). */
  sharedFile?(): Promise<{ text?: string; name?: string; error?: string }>;
  /** The launcher icon (MN × members can pick one). Newer apps only. */
  setAppIcon?(o: { name: string }): Promise<{ ok: boolean }>;
  appIcon?(): Promise<{ name?: string }>;
  /** Sign in with Google (Credential Manager); newer apps only. */
  googleSignIn?(o: { webClientId: string }): Promise<{ idToken?: string; email?: string; name?: string; cancelled?: boolean; error?: string }>;
  googleSignOut?(): Promise<void>;
  /** MN × purchases through Google Play (newer apps only; see platform/billing.ts). */
  billingProducts?(o: { subs: string[]; inapp: string[] }): Promise<{ ok: boolean; products?: PlayProduct[]; code?: number; message?: string }>;
  /** `oldToken` and `mode`: a change of plan (Play's subscription update); `account`: an obfuscated id for the signed-in family. */
  billingBuy?(o: { product: string; offer?: string; oldToken?: string; mode?: number; account?: string }): Promise<{ ok: boolean; code?: number; message?: string }>;
  billingOwned?(): Promise<{ ok: boolean; purchases?: PlayPurchase[] }>;
  billingAck?(o: { token: string }): Promise<{ ok: boolean; code?: number }>;
  billingManage?(o: { product?: string }): Promise<void>;
  addListener(event: 'back', cb: () => void): unknown;
  addListener(event: 'launch', cb: (d: { open?: string }) => void): unknown;
  addListener(event: 'shared', cb: () => void): unknown;
  addListener(event: 'purchases', cb: (d: PurchasesEvent) => void): unknown;
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

/** Ignore a native call's failure. Some calls (like addListener) give back a plain handle,
 *  not a promise, on some Capacitor versions, so only a real promise is caught. */
export function quietly(p: unknown): void {
  if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(() => {});
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/** The keys whose copies carry a save counter (storage/save.ts). */
const COUNTED = [PRIMARY, BACKUP];

/**
 * The app's storage on a phone: the WebView's storage, with every write mirrored to the app's
 * own storage on the phone (SharedPreferences in StudyHardPlugin.java).
 * - On start both are read. For the save and its spare, the copy with the higher save counter
 *   wins, so a write the WebView lost (storage full, app killed) doesn't bring back an older save.
 * - Nothing is written to the phone's copy until it has been read. If reading it fails or is
 *   slow, the WebView copy is used for now and the phone's copy is left alone until a later read
 *   succeeds and shows it is not newer than what this session started from.
 */
export async function nativeStorage(plugin: StudyHardPlugin, web: StorageAdapter = browserStorage(), wait = 6000): Promise<StorageAdapter> {
  let ready = false;
  /** Values the WebView couldn't hold: read from here until a write succeeds. */
  const held = new Map<string, string>();
  const startRev = revOf(web.get(PRIMARY));
  const take = (values: Record<string, string>, atStart: boolean) => {
    for (const [key, value] of Object.entries(values)) {
      if (typeof value !== 'string') continue;
      const here = web.get(key);
      const newer = COUNTED.includes(key) ? revOf(value) > revOf(here) : here === null;
      if (atStart && newer && web.set(key, value) === false) held.set(key, value);
    }
  };
  const read = plugin.readSave().then(({ values = {} }) => values);
  try {
    take(await timeout(read, wait), true);
    ready = true;
  } catch {
    // Not read yet: keep waiting in the background, but never overwrite the phone's copy with an
    // older save. If it turns out newer, it stays as it is and wins on the next start.
    read.then((values) => {
      if (revOf(values[PRIMARY]) <= startRev) ready = true;
    }, () => {});
  }
  return {
    get: (key: string) => held.get(key) ?? web.get(key),
    set(key: string, value: string) {
      const ok = web.set(key, value);
      if (ok === false) held.set(key, value);
      else held.delete(key);
      if (ready) quietly(plugin.writeSave({ key, value }));
      return ok;
    },
    remove(key: string) {
      held.delete(key);
      web.remove?.(key);
    },
  };
}

/** A Google Play product, as Billing.java describes it (prices in the phone's own currency). */
export interface PlayProduct {
  id: string;
  type: 'subs' | 'inapp';
  name: string;
  price?: string;
  micros?: number;
  currency?: string;
  offers?: { basePlan: string; offer: string | null; token: string; tags: string[]; phases: { price: string; micros: number; currency: string; period: string; cycles: number }[] }[];
}

/** Something the Play account owns. `state` 1 = purchased, 2 = pending. */
export interface PlayPurchase {
  products: string[];
  token: string;
  state: number;
  acknowledged: boolean;
  autoRenewing: boolean;
  time: number;
  /** Billing.java reports only purchases whose signature matches the app's Play licensing key. */
  verified?: boolean;
  json?: string;
  signature?: string;
}

/** Play's answer after the purchase sheet closes. */
export interface PurchasesEvent {
  ok: boolean;
  code: number;
  cancelled: boolean;
  purchases: PlayPurchase[];
}
