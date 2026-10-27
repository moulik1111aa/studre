// Versioned save: children, their progress and jars, and parent settings.
// Written to a primary and a backup key; mirrored natively in the Android app.

import { freshProgress, type Progress } from '../core/path.ts';
import { freshWallet, type Wallet } from '../core/economy.ts';
import type { UndoEntry } from '../core/undo.ts';
import type { OwnReward } from '../core/rewards.ts';
import type { PlayEntry, Tally } from '../core/stats.ts';
import type { AdventureState } from '../core/adventure.ts';
import type { ReminderSettings } from '../core/reminders.ts';

export const SAVE_VERSION = 1;
const PRIMARY = 'studyhard.save';
const BACKUP = 'studyhard.save.bak';

export interface ChildStats {
  answered: number;
  correct: number;
  /** Local day → counted seconds played. */
  secondsByDay: Record<string, number>;
}

/** A school path: a board and class (or "custom"), and the skills the parent kept. */
export interface SchoolPath {
  board: string;
  grade: string;
  skills: string[];
  on: boolean;
}

/** The child's last finished level, for Plus to talk about. */
export interface LastPlay {
  day: string;
  levelId: string;
  name: string;
  score: number;
  total: number;
  stars: number;
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
  /** Has seen Plus's tips on the map (shown once; the map's ? button plays them again). */
  toured?: boolean;
  /** This child's reading voice (none: the parent's choice) and its pitch. */
  voiceName?: string;
  voicePitch?: number;
  /** Has picked a voice (asked once, before the first map). */
  voicePicked?: boolean;
  /** Practice-together levels left (the first few levels, played with a grown-up). */
  together?: number;
  /** The owner's tester profile: every level open, no daily limit. */
  tester?: boolean;
  /**
   * Assisted mode (on by default for ages 3–6): a grown-up plays alongside. Every level is
   * like practice-together: no timers, a slip shows how and the child tries again, and each
   * question carries a tip for the grown-up.
   */
  assisted?: boolean;
  /** A school path chosen by a parent; while `on`, the map shows only these skills. */
  school?: SchoolPath;
  /** Last report-card backup (ms) and how many play days it held (for the backup reminder). */
  backupAt?: number;
  backupDays?: number;
  /** Adventure mode: quests, chests and badges (core/adventure.ts); off when missing. */
  adventure?: AdventureState;
  /** Play log and per-skill answer tallies for the parent report (core/stats.ts). */
  log?: PlayEntry[];
  tally?: Tally;
  /** The last finished level (Plus mentions it next time). */
  lastPlay?: LastPlay;
  /** The dragon map instead of the usual path (a grown-up switches it in the Parent area). */
  dragonMap?: boolean;
  /** Dragon map: the end of the last chapter this child has seen unfold (core/dragon.ts). */
  foldSeen?: number;
}

/** The first levels a new child plays together with a grown-up. */
export const TOGETHER_LEVELS = 3;

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
  /** Seconds per timed question (Speed and Master levels, boss fights); 0 = no timer. */
  timerSeconds: number;
  /** Build 37's timer choice (1, 1.5, 2 or 0); read once to set timerSeconds. */
  timerScale?: number;
  /** Look of the app: 'playground' (default for new installs), 'glass', 'schoolbook' or 'precision'. */
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
  /** The grown-up has been through the quick tour once (it can't be skipped before that). */
  tourSeen?: boolean;
  /** Parent PIN for the grown-up check, as "salt:hash" (none: the phone's screen lock). */
  parentPin?: string;
  /** Phone reminders (melt watch, backup); the defaults when missing. */
  reminders?: ReminderSettings;
  /** Backup reminders are quiet until then (ms), after "Remind me in 3 days". */
  backupSnoozeUntil?: number;
  /** The grown-up has been asked once whether MN may send notes. */
  notifAsked?: boolean;
  /** The grown-ups' "What is Adventure?" tips have been seen once (after that they can be skipped). */
  advTipsSeen?: boolean;
}

export type Theme = 'playground' | 'glass' | 'schoolbook' | 'precision';
export const THEMES: Theme[] = ['playground', 'glass', 'schoolbook', 'precision'];

/** A key the owner made (kept only on the owner's phone). */
export interface IssuedKey {
  id: string;
  name: string;
  phone: string;
  /** Last day it works, as a day number (see core/access.ts). */
  until: number;
  key: string;
  made: string;
}

/** Access keys: this phone's key, the latest day seen (clock check), and the owner's tools. */
export interface Access {
  key?: string;
  maxDay?: string;
  /** Owner's phone only: the master key and the keys made. */
  master?: string;
  issued?: IssuedKey[];
}

export interface SaveData {
  version: number;
  access?: Access;
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

/** Seconds per timed question for new installs. */
export const TIMER_DEFAULT = 20;
/** The saved timer setting, carried over from build 37's choices when needed. */
function timerFrom(s: Partial<Settings> | undefined): number {
  if (typeof s?.timerSeconds === 'number' && s.timerSeconds >= 0) return s.timerSeconds;
  if (typeof s?.timerScale === 'number') return ({ 0: 0, 1: 15, 1.5: 20, 2: 30 } as Record<number, number>)[s.timerScale] ?? TIMER_DEFAULT;
  return TIMER_DEFAULT;
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
  timerSeconds: TIMER_DEFAULT,
  theme: 'playground',
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
    together: TOGETHER_LEVELS,
    assisted: age <= 6,
  };
}

/**
 * Start a child over: stars, placement, coins, jars, rewards earned and play history are
 * cleared; name, age and picture stay (placement runs again next time they play).
 */
export function resetChild(c: Child, today: string): void {
  const fresh = newChild(c.name, c.age, c.avatar, today);
  Object.assign(c, { ...fresh, id: c.id, undo: [], sinceShowcase: 0, log: [], tally: {}, lastPlay: undefined });
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
      settings: { ...base.settings, ...d.settings, timerSeconds: timerFrom(d.settings), ownRewards: Array.isArray(d.settings?.ownRewards) ? d.settings!.ownRewards : [], theme: THEMES.includes(d.settings?.theme as Theme) ? (d.settings!.theme as Theme) : 'glass' },
      faceoff: d.faceoff ?? {},
      children: d.children.map((c) => ({
        ...newChild(c.name ?? 'Champ', c.age ?? 6, c.avatar ?? 0, c.createdDay ?? ''),
        ...c,
        // Children from before practice-together get it only if they've hardly played.
        together: c.together ?? (Object.values(c.progress?.levels ?? {}).filter((l) => l.stars >= 1).length < 3 ? TOGETHER_LEVELS : 0),
        assisted: c.assisted ?? (c.age ?? 6) <= 6,
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

/** Read a saved file (exported for tests). */
export const parseSave = (raw: string): SaveData | null => parse(raw);

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

  private readonly listeners: (() => void)[] = [];
  /** Called after every save (the phone's reminders and widgets follow the save). */
  onSaved(fn: () => void): void {
    this.listeners.push(fn);
  }

  save(): void {
    const json = JSON.stringify(this.data);
    const prev = this.store.get(PRIMARY);
    if (prev && parse(prev)) this.store.set(BACKUP, prev);
    this.store.set(PRIMARY, json);
    if (!prev) this.store.set(BACKUP, json);
    for (const fn of this.listeners) fn();
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
