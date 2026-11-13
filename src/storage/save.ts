// Versioned save: children, their progress and jars, and parent settings.
// Written to a primary and a backup key; mirrored natively in the Android app.

import { freshProgress, type Progress } from '../core/path.ts';
import { freshWallet, type Wallet } from '../core/economy.ts';
import type { UndoEntry } from '../core/undo.ts';
import type { OwnReward } from '../core/rewards.ts';
import type { PlayEntry, Tally } from '../core/stats.ts';
import type { AdventureState } from '../core/adventure.ts';
import type { ExamRecord } from '../core/exam.ts';
import type { ReminderSettings } from '../core/reminders.ts';
import type { FixBank } from '../core/fixit.ts';
import type { QuietSettings } from '../core/quiet.ts';
import type { GoogleGate } from '../core/gate.ts';
import { cleanChild, cleanSavedSettings } from '../core/clean.ts';

export const SAVE_VERSION = 1;
const PRIMARY = 'studyhard.save';
const BACKUP = 'studyhard.save.bak';

export interface ChildStats {
  answered: number;
  correct: number;
  /** Local day → counted seconds played. */
  secondsByDay: Record<string, number>;
}

/** A school syllabus: a board and class (or "custom"), and the skills the parent kept. */
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
  /** Practice-together levels left (the first few levels, played play together). */
  together?: number;
  /** Road version this child was caught up to (see core/catchup.ts). */
  roadV?: number;
  /** The owner's tester profile: every level open, no daily limit. */
  tester?: boolean;
  /**
   * Assisted mode (on by default for ages 3–6): a parent plays alongside. Every level is
   * like practice-together: no timers, a slip shows how and the child tries again, and each
   * question carries a tip for the parent.
   */
  assisted?: boolean;
  /** A school syllabus chosen by a parent; while `on`, the map shows only these skills. */
  school?: SchoolPath;
  /** Last report-card backup (ms) and how many play days it held (for the backup reminder). */
  backupAt?: number;
  backupDays?: number;
  /** Exam practice results, newest last (MN ×). */
  exams?: ExamRecord[];
  /** Adventure mode: quests, chests and badges (core/adventure.ts); off when missing. */
  adventure?: AdventureState;
  /** Play log and per-skill answer tallies for the parent report (core/stats.ts). */
  log?: PlayEntry[];
  tally?: Tally;
  /** The last finished level (Plus mentions it next time). */
  lastPlay?: LastPlay;
  /** Fix-it: skills missed lately, coming back after 1, 3 and 7 days (core/fixit.ts). */
  fixit?: FixBank;
  /** The way of working that helped, per method family ("add" → "Make ten"), from lessons. */
  methods?: Record<string, string>;
}

/** The first levels a new child plays together play together. */
export const TOGETHER_LEVELS = 3;

export interface Settings {
  limitMinutes: number;
  timeUpMode: 'stop' | 'keep';
  /** Price multipliers the parent picks: how often a treat / a big reward comes (1 = calibrated). */
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
  /** The automatic reading voice: a man's (default) or a woman's. */
  voiceGender: 'm' | 'f';
  /** The chosen voice's pitch (1, or lower for the "deeper" version). */
  voicePitch?: number;
  /** Parent area visits, and whether the home-screen widget tip was shown. */
  parentVisits?: number;
  widgetAsked?: boolean;
  /** The free-trial note in the Parent area stays hidden until then (ms). */
  trialNudgeAt?: number;
  /** The parent chose the reading voice in setup (children aren't asked again). */
  voiceSet?: boolean;
  /** Sound effects volume, 0.2–1. */
  volume: number;
  /** Seconds per timed question (Speed and Master levels, boss fights); 0 = no timer. */
  timerSeconds: number;
  /** Build 37's timer choice (1, 1.5, 2 or 0); read once to set timerSeconds. */
  timerScale?: number;
  /** Look of the app: 'studio' (Notebook, default for new installs), 'shapes', 'print', 'playground', 'glass', 'schoolbook' or 'precision'. */
  theme: Theme;
  /** Set once Playground families were moved to Studio (build 75), so choosing Playground again sticks. */
  studioMoved?: boolean;
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
  /** The parent has been through the quick tour once (it can't be skipped before that). */
  tourSeen?: boolean;
  /** Parent PIN for the parent check, as "salt:hash" (none: the phone's screen lock). */
  parentPin?: string;
  /** Phone reminders (melt watch, backup); the defaults when missing. */
  reminders?: ReminderSettings;
  /** Backup reminders are quiet until then (ms), after "Remind me in 3 days". */
  backupSnoozeUntil?: number;
  /** The parent has been asked once whether MN may send notes. */
  notifAsked?: boolean;
  /** The parents' "What is Adventure?" tips have been seen once (after that they can be skipped). */
  advTipsSeen?: boolean;
  /** The Parent area's Guide has been opened (its tab stops glowing), or its invite closed. */
  guideSeen?: boolean;
  guideInviteOff?: boolean;
  /** MN Swipe (an endless feed of quick maths for anyone, no coins): off until a parent turns it on. */
  swipeOn?: boolean;
  swipeBest?: number;
  swipeTrack?: number;
  swipeMusic?: boolean;
  swipeBand?: string;
  /** Bedtime and school time (core/quiet.ts), and a parent's unlock until then (ms). */
  quiet?: QuietSettings;
  quietUnlockUntil?: number;
}

/** The saved look; Playground (the old default) moves to Studio once. */
function lookFrom(s: Partial<Settings> | undefined): Theme {
  const t = THEMES.includes(s?.theme as Theme) ? (s!.theme as Theme) : 'glass';
  return t === 'playground' && !s?.studioMoved ? 'studio' : t;
}
export type Theme = 'studio' | 'shapes' | 'print' | 'playground' | 'glass' | 'schoolbook' | 'precision';
/** The looks that come with MN × (the rest are free). */
export const PLUS_THEMES: Theme[] = ['shapes', 'print', 'precision'];
export const THEMES: Theme[] = ['studio', 'shapes', 'print', 'playground', 'glass', 'schoolbook', 'precision'];

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
  /** Unlocked with an approved Google account (core/gate.ts). */
  google?: GoogleGate;
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
  voiceGender: 'm',
  volume: 0.8,
  timerSeconds: TIMER_DEFAULT,
  theme: 'studio',
  studioMoved: true,
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
  Object.assign(c, { ...fresh, id: c.id, undo: [], sinceShowcase: 0, log: [], tally: {}, lastPlay: undefined, fixit: undefined });
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
    // The saved copy is checked like any other outside data (core/clean.ts): a damaged or edited
    // save can't put markup or wrong-typed values in front of the screens.
    const st = cleanSavedSettings((typeof d.settings === 'object' && d.settings !== null ? d.settings : {}) as Partial<Settings>);
    const children = d.children.flatMap((raw) => {
      // Something that isn't a child at all is left out; a damaged child is repaired.
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
      const c = raw as Partial<Child>;
      const passed = Object.values((c.progress?.levels ?? {}) as Record<string, { stars?: number }>).filter((l) => (l?.stars ?? 0) >= 1).length;
      const r = cleanChild({
        ...c,
        // Children from before practice-together get it only if they've hardly played.
        together: c.together ?? (passed < 3 ? TOGETHER_LEVELS : 0),
      }, { lenient: true });
      return r.ok ? [{ ...newChild(r.child.name, r.child.age, r.child.avatar, r.child.createdDay), ...r.child }] : [];
    });
    const ids = new Set(children.map((c) => c.id));
    const faceoff: Record<string, [number, number]> = {};
    for (const [k, v] of Object.entries(typeof d.faceoff === 'object' && d.faceoff !== null ? d.faceoff : {})) {
      if (k.split('|').every((id) => /^[A-Za-z0-9_@.-]{1,60}$/.test(id)) && Array.isArray(v)) faceoff[k] = [Number.isFinite(v[0]) ? Number(v[0]) : 0, Number.isFinite(v[1]) ? Number(v[1]) : 0];
    }
    return {
      ...base,
      ...d,
      version: SAVE_VERSION,
      setupDone: d.setupDone === true,
      activeChildId: typeof d.activeChildId === 'string' && ids.has(d.activeChildId) ? d.activeChildId : null,
      settings: { ...base.settings, ...st, timerSeconds: timerFrom(st), ownRewards: st.ownRewards ?? [], theme: lookFrom(st), studioMoved: true },
      faceoff,
      children,
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

  /** The saved copy as text (for "Save a copy of my data" when the app is stuck). */
  rawCopy(): string | null {
    return this.store.get(PRIMARY) ?? this.store.get(BACKUP);
  }

  /** Whether the spare copy (the save before the last one) can be read. */
  hasSpare(): boolean {
    const spare = this.store.get(BACKUP);
    return !!spare && spare !== this.store.get(PRIMARY) && parse(spare) !== null;
  }

  /** Go back to the spare copy. The copy it replaces is kept aside under its own key. */
  useSpare(): boolean {
    const spare = parse(this.store.get(BACKUP));
    if (!spare) return false;
    const now = this.store.get(PRIMARY);
    if (now) this.store.set(`${PRIMARY}.stuck`, now);
    this.data = spare;
    this.store.set(PRIMARY, JSON.stringify(spare));
    return true;
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
