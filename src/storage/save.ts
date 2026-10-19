// Versioned save: children, their progress and jars, and parent settings.
// Written to a primary and a backup key; mirrored natively in the Android app.

import { freshProgress, type Progress } from '../core/path.ts';
import { freshWallet, type Wallet } from '../core/economy.ts';
import type { UndoEntry } from '../core/undo.ts';
import type { OwnReward } from '../core/rewards.ts';

export const SAVE_VERSION = 1;
const PRIMARY = 'studyhard.save';
const BACKUP = 'studyhard.save.bak';

export interface ChildStats {
  answered: number;
  correct: number;
  /** Local day → counted seconds played. */
  secondsByDay: Record<string, number>;
}

export interface Child {
  id: string;
  name: string;
  age: number;
  /** Index into the avatar set. */
  avatar: number;
  placed: boolean;
  /** Levels left in which a poor score steps a strand back (after placement). */
  placementChecks: number;
  /** Strand → first skill id after placement (for the self-correcting step-back). */
  placedAt: Record<string, string>;
  progress: Progress;
  wallet: Wallet;
  stats: ChildStats;
  bossesBeaten: string[];
  createdDay: string;
  /** Parent-set difficulty: 0 normal, 1 harder, 2 toughest (same skills, harder questions). */
  challenge: 0 | 1 | 2;
  /** Levels finished since the big progress screen was last shown. */
  sinceShowcase?: number;
  /** Recent changes, so a parent can remove the last hour or today (see core/undo.ts). */
  undo?: UndoEntry[];
}

export interface Settings {
  limitMinutes: number;
  timeUpMode: 'stop' | 'keep';
  /** Price multipliers the parent picks: how often a treat / a big goal comes (1 = calibrated). */
  treatPace: number;
  goalPace: number;
  holiday: boolean;
  hiddenCategories: string[];
  sound: boolean;
  music: boolean;
  vibration: boolean;
  voice: boolean;
  /** Chosen reading voice ('' = the best one automatically) and its speed. */
  voiceName: string;
  voiceRate: number;
  /** Look of the app: 'glass' (default), 'schoolbook' or 'precision'. */
  theme: Theme;
  /** Rewards the family added themselves. */
  ownRewards: OwnReward[];
  /** 3D boss fights (off for slower phones). */
  fx3d: boolean;
  /** Frame-rate readout, for testing. */
  showFps: boolean;
  /** Tap an answer to pick it, then Check (fewer slips from a stray tap). */
  confirmAnswers: boolean;
  /** After a wrong answer, a short step-by-step lesson on how to work it out. */
  teach: boolean;
}

export type Theme = 'glass' | 'schoolbook' | 'precision';
export const THEMES: Theme[] = ['glass', 'schoolbook', 'precision'];

export interface SaveData {
  version: number;
  setupDone: boolean;
  children: Child[];
  activeChildId: string | null;
  settings: Settings;
  /** "idA|idB" (sorted) → wins for [A, B]. */
  faceoff: Record<string, [number, number]>;
}

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const freshSettings = (): Settings => ({
  limitMinutes: 30,
  timeUpMode: 'stop',
  treatPace: 1,
  goalPace: 1,
  holiday: false,
  hiddenCategories: [],
  sound: true,
  music: true,
  vibration: true,
  voice: true,
  voiceName: '',
  voiceRate: 0.95,
  theme: 'glass',
  ownRewards: [],
  fx3d: true,
  showFps: false,
  confirmAnswers: false,
  teach: true,
});

export function freshSave(): SaveData {
  return { version: SAVE_VERSION, setupDone: false, children: [], activeChildId: null, settings: freshSettings(), faceoff: {} };
}

export function newChild(name: string, age: number, avatar: number, today: string): Child {
  return {
    id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: name.trim().slice(0, 20) || 'Champ',
    age: Math.max(3, Math.min(16, Math.round(age))),
    avatar,
    placed: false,
    placementChecks: 0,
    placedAt: {},
    progress: freshProgress(),
    wallet: freshWallet(),
    stats: { answered: 0, correct: 0, secondsByDay: {} },
    bossesBeaten: [],
    createdDay: today,
    challenge: 0,
  };
}

/**
 * Start a child over: stars, placement, coins, jars, rewards earned and play history are
 * cleared; name, age and picture stay (placement runs again next time they play).
 */
export function resetChild(c: Child, today: string): void {
  const fresh = newChild(c.name, c.age, c.avatar, today);
  Object.assign(c, { ...fresh, id: c.id, undo: [], sinceShowcase: 0 });
}

/** Remove a child and their face-off records. */
export function removeChild(d: SaveData, id: string): void {
  d.children = d.children.filter((c) => c.id !== id);
  if (d.activeChildId === id) d.activeChildId = d.children[0]?.id ?? null;
  for (const k of Object.keys(d.faceoff)) if (k.split('|').includes(id)) delete d.faceoff[k];
}

function parse(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (typeof d !== 'object' || d === null || !Array.isArray(d.children)) return null;
    if (typeof d.version !== 'number' || d.version > SAVE_VERSION) return null;
    const base = freshSave();
    return {
      ...base,
      ...d,
      version: SAVE_VERSION,
      settings: { ...base.settings, ...d.settings, ownRewards: Array.isArray(d.settings?.ownRewards) ? d.settings!.ownRewards : [], theme: THEMES.includes(d.settings?.theme as Theme) ? (d.settings!.theme as Theme) : 'glass' },
      faceoff: d.faceoff ?? {},
      children: d.children.map((c) => ({
        ...newChild(c.name ?? 'Champ', c.age ?? 6, c.avatar ?? 0, c.createdDay ?? ''),
        ...c,
        progress: { ...freshProgress(), ...c.progress },
        wallet: { ...freshWallet(), ...c.wallet },
        stats: { ...{ answered: 0, correct: 0, secondsByDay: {} }, ...c.stats },
      })),
    } as SaveData;
  } catch {
    return null;
  }
}

export interface LoadResult {
  data: SaveData;
  source: 'primary' | 'backup' | 'new' | 'reset';
}

export class SaveStore {
  private readonly store: StorageAdapter;
  data: SaveData;
  readonly loadedFrom: LoadResult['source'];

  constructor(store: StorageAdapter) {
    this.store = store;
    const r = SaveStore.load(store);
    this.data = r.data;
    this.loadedFrom = r.source;
  }

  static load(store: StorageAdapter): LoadResult {
    const primaryRaw = store.get(PRIMARY);
    const backupRaw = store.get(BACKUP);
    const primary = parse(primaryRaw);
    if (primary) return { data: primary, source: 'primary' };
    const backup = parse(backupRaw);
    if (backup) return { data: backup, source: 'backup' };
    if (primaryRaw === null && backupRaw === null) return { data: freshSave(), source: 'new' };
    return { data: freshSave(), source: 'reset' };
  }

  save(): void {
    const json = JSON.stringify(this.data);
    const prev = this.store.get(PRIMARY);
    if (prev && parse(prev)) this.store.set(BACKUP, prev);
    this.store.set(PRIMARY, json);
    if (!prev) this.store.set(BACKUP, json);
  }

  update(fn: (d: SaveData) => void): void {
    fn(this.data);
    this.save();
  }

  child(id = this.data.activeChildId): Child | undefined {
    return this.data.children.find((c) => c.id === id);
  }
}

/** localStorage adapter that never throws (private mode, blocked storage, previews). */
export function browserStorage(): StorageAdapter {
  const mem = new Map<string, string>();
  return {
    get(key) {
      try {
        return localStorage.getItem(key) ?? mem.get(key) ?? null;
      } catch {
        return mem.get(key) ?? null;
      }
    },
    set(key, value) {
      mem.set(key, value);
      try {
        localStorage.setItem(key, value);
      } catch {
        /* in-memory only */
      }
    },
  };
}
