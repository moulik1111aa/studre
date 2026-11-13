// Everything that comes from outside the running app is untrusted: a progress or family file (anyone
// can make one that passes the check value), the online backup, and the saved copy itself. This
// module turns such data into a well-formed child or set of family rules: every field is checked for
// type and range, unknown fields are dropped, and anything unusable becomes a safe default. Only a
// child without a usable id or name is refused.

import { PRICES, OWN_ICONS, CATEGORIES, type OwnReward, type PriceTier } from './rewards.ts';
import type { Child, Settings } from '../storage/save.ts';

/** How many avatars the app has (ui/icons.ts AVATARS; a test keeps the two in step). */
export const AVATAR_COUNT = 24;
/** A child's id: what newChild() makes, and what a Firestore path can carry. */
export const CHILD_ID = /^[A-Za-z0-9_-]{1,40}$/;
/** Ids of skills, levels, rewards, badges, wardrobe items…: letters, digits and a few joiners. */
const KEY = /^[A-Za-z0-9_.:@|+#-]{1,80}$/;
/** Names used as record keys (a strand, a method family): anything short without markup. */
const NAME = /^[^<>&"'`\u0000-\u001f]{1,80}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const arr = (v: unknown, max = 5000): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const num = (v: unknown, d = 0, min = -1e12, max = 1e12): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const int = (v: unknown, d = 0, min = -1e12, max = 1e12): number => Math.round(num(v, d, min, max));
const bool = (v: unknown, d = false): boolean => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, max: number, d = ''): string => (typeof v === 'string' ? v.slice(0, max) : d);
const key = (v: unknown): string | null => (typeof v === 'string' && KEY.test(v) ? v : null);
const day = (v: unknown): string | null => (typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? v : null);

/** A record with safe keys; each value cleaned by `f` (undefined drops the entry). */
function rec<T>(v: unknown, f: (x: unknown, k: string) => T | undefined, keyOk: (k: string) => boolean = (k) => KEY.test(k), max = 20000): Record<string, T> {
  const out: Record<string, T> = {};
  let n = 0;
  for (const [k, x] of Object.entries(obj(v))) {
    if (!keyOk(k) || k === '__proto__') continue;
    const c = f(x, k);
    if (c === undefined) continue;
    out[k] = c;
    if (++n >= max) break;
  }
  return out;
}
const trueRec = (v: unknown): Record<string, true> => rec(v, (x) => (x === true ? true : undefined));
const numRec = (v: unknown, min = 0, max = 1e12): Record<string, number> => rec(v, (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : undefined));
const dayNumRec = (v: unknown, max = 1e7): Record<string, number> => rec(v, (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : undefined), (k) => day(k) !== null);
const keys = (v: unknown, max = 5000): string[] => arr(v, max).filter((x): x is string => key(x) !== null);
/** A level result: 0–3 stars and how many times it was passed. */
const result = (v: unknown) => (isObj(v) ? { stars: int(v.stars, 0, 0, 3) as 0 | 1 | 2 | 3, passes: int(v.passes, 0, 0, 1e6) } : undefined);
/** Per-skill answer counts: [asked, right, …]. */
const tally = (v: unknown, n: 2 | 3) =>
  rec(v, (x) => {
    if (!Array.isArray(x)) return undefined;
    const t = Array.from({ length: n }, (_, i) => int(x[i], 0, 0, 1e9));
    return t as [number, number, number];
  });

function jar(v: unknown) {
  const j = obj(v);
  const photo = key(j.photo);
  return { rewardId: key(j.rewardId), coins: num(j.coins, 0, 0, 1e9), waiting: bool(j.waiting), ...(photo ? { photo } : {}) };
}

function wallet(v: unknown) {
  const w = obj(v);
  return {
    treat: jar(w.treat),
    goal: jar(w.goal),
    lifetime: num(w.lifetime, 0, 0, 1e12),
    lastPlayDay: day(w.lastPlayDay),
    meltCheckedDay: day(w.meltCheckedDay),
    todaySeconds: num(w.todaySeconds, 0, 0, 86400),
    todayDay: day(w.todayDay),
    earned: arr(w.earned, 2000).flatMap((e) => {
      const o = obj(e);
      const rewardId = key(o.rewardId);
      const d = day(o.day);
      const photo = key(o.photo);
      return rewardId && d ? [{ rewardId, day: d, ...(photo ? { photo } : {}) }] : [];
    }),
  };
}

function progress(v: unknown) {
  const p = obj(v);
  return {
    levels: rec(p.levels, result),
    skipped: trueRec(p.skipped),
    lastSeen: rec(p.lastSeen, (x) => day(x) ?? undefined),
    // Question keys are only ever compared, never shown; they may hold a whole picture.
    history: rec(p.history, (x) => arr(x, 50).filter((s): s is string => typeof s === 'string' && s.length <= 60000)),
    ...(p.skippedLevels !== undefined ? { skippedLevels: trueRec(p.skippedLevels) } : {}),
    ...(p.questBest !== undefined ? { questBest: numRec(p.questBest, 0, 1000) } : {}),
  };
}

const KINDS = ['skill', 'review', 'boss', 'quest'];
function playLog(v: unknown) {
  return arr(v, 4000).flatMap((e) => {
    const o = obj(e);
    const id = key(o.id);
    const d = day(o.d);
    if (!id || !d || typeof o.t !== 'number' || !Number.isFinite(o.t) || !KINDS.includes(o.k as string)) return [];
    return [
      {
        t: num(o.t, 0, 0, 1e14),
        d,
        id,
        k: o.k as 'skill',
        st: int(o.st, 1, 1, 7),
        ...(o.tier !== undefined ? { tier: int(o.tier, 1, 1, 5) } : {}),
        sc: int(o.sc, 0, 0, 1e6),
        of: int(o.of, 0, 0, 1e6),
        s: int(o.s, 0, 0, 3),
        sec: num(o.sec, 0, 0, 1e6),
        c: num(o.c, 0, 0, 1e7),
        ...(o.g !== undefined ? { g: bool(o.g) } : {}),
        a: tally(o.a, 3),
        ...(o.cb !== undefined ? { cb: int(o.cb, 0, 0, 1e6) } : {}),
      },
    ];
  });
}

function exams(v: unknown) {
  return arr(v, 500).flatMap((e) => {
    const o = obj(e);
    const d = day(o.d);
    if (!d) return [];
    return [{ t: num(o.t, 0, 0, 1e14), d, n: int(o.n, 0, 0, 1000), ok: int(o.ok, 0, 0, 1000), sec: num(o.sec, 0, 0, 1e6), limit: num(o.limit, 0, 0, 1e6), skills: tally(o.skills, 2) as unknown as Record<string, [number, number]> }];
  });
}

function fixit(v: unknown) {
  return rec(v, (x) => {
    const o = obj(x);
    const h = arr(o.h, 20).flatMap((s) => {
      if (!Array.isArray(s)) return [];
      const due = day(s[2]);
      return due ? [[num(s[0], 0, 0, 1e14), int(s[1], 0, 0, 20), due] as [number, number, string]] : [];
    });
    return h.length ? { d: num(o.d, 0.5, 0, 1), n: int(o.n, 1, 0, 1e6), h } : undefined;
  });
}

function adventure(v: unknown) {
  if (!isObj(v)) return undefined;
  const raid = obj(v.raidSeen);
  const monday = day(raid.monday);
  return {
    on: bool(v.on, true),
    claimed: numRec(v.claimed, 0, 1e14),
    badges: numRec(v.badges, 0, 1e14),
    cheered: rec(v.cheered, (x) => keys(x, 50)),
    ...(v.seenLevel !== undefined ? { seenLevel: int(v.seenLevel, 0, 0, 1e6) } : {}),
    ...(v.xpSeen !== undefined ? { xpSeen: num(v.xpSeen, 0, 0, 1e12) } : {}),
    ...(v.owned !== undefined ? { owned: numRec(v.owned, 0, 1e14) } : {}),
    ...(v.gifted !== undefined ? { gifted: numRec(v.gifted, 0, 1e14) } : {}),
    ...(v.equipped !== undefined ? { equipped: rec(v.equipped, (x) => key(x) ?? undefined) } : {}),
    ...(monday ? { raidSeen: { monday, damage: num(raid.damage, 0, 0, 1e12) } } : {}),
    ...(v.toured !== undefined ? { toured: bool(v.toured) } : {}),
    ...(typeof v.eggAt === 'number' && Number.isFinite(v.eggAt) ? { eggAt: num(v.eggAt, 0, 0, 1e14) } : {}),
    ...(pet(v.pet) ? { pet: pet(v.pet) } : {}),
    ...(v.giftSeen !== undefined ? { giftSeen: keys(v.giftSeen, 200) } : {}),
  };
}

function pet(v: unknown) {
  const o = obj(v);
  const species = key(o.species);
  if (!species) return undefined;
  return {
    species,
    name: str(o.name, 12).replace(/[\u0000-\u001f<>&"'`]/g, '').trim(),
    hatchedAt: num(o.hatchedAt, 0, 0, 1e14),
    xpAtHatch: num(o.xpAtHatch, 0, 0, 1e12),
    ...(o.treats !== undefined ? { treats: numRec(o.treats, 0, 1e14) } : {}),
    ...(o.seenStage !== undefined ? { seenStage: int(o.seenStage, 0, 0, 100) } : {}),
  };
}

function lastPlay(v: unknown) {
  const o = obj(v);
  const d = day(o.day);
  const levelId = key(o.levelId);
  if (!d || !levelId) return undefined;
  return { day: d, levelId, name: str(o.name, 80), score: int(o.score, 0, 0, 1e6), total: int(o.total, 0, 0, 1e6), stars: int(o.stars, 0, 0, 3) };
}

function school(v: unknown) {
  if (!isObj(v)) return undefined;
  return { board: str(v.board, 40), grade: str(v.grade, 40), skills: keys(v.skills, 2000), on: bool(v.on) };
}

function undo(v: unknown) {
  return arr(v, 200).flatMap((e) => {
    const o = obj(e);
    const d = day(o.day);
    if (!d) return [];
    return [
      {
        t: num(o.t, 0, 0, 1e14),
        day: d,
        levels: rec(o.levels, (x) => (x === null ? null : result(x))),
        skippedLevels: rec(o.skippedLevels, (x) => (x === true || x === null ? x : undefined)),
        wallet: wallet(o.wallet),
        answered: int(o.answered, 0, 0, 1e9),
        correct: int(o.correct, 0, 0, 1e9),
        secondsByDay: dayNumRec(o.secondsByDay),
        bosses: keys(o.bosses, 500),
      },
    ];
  });
}

export type CleanChild = { ok: true; child: Child } | { ok: false; reason: string };

/**
 * A child from a file, the cloud or the save, made well-formed. `lenient` (the phone's own save)
 * never refuses: a bad id or name is repaired, so one damaged child can't lose the rest.
 */
export function cleanChild(raw: unknown, opts: { lenient?: boolean } = {}): CleanChild {
  const c = obj(raw);
  let id = typeof c.id === 'string' && CHILD_ID.test(c.id) ? c.id : null;
  let name = typeof c.name === 'string' ? c.name.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 20) : null;
  if (opts.lenient) {
    if (!id) id = (typeof c.id === 'string' ? c.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) : '') || `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    if (!name) name = 'Champ';
  }
  if (!id || !isObj(raw)) return { ok: false, reason: 'This progress file is missing some of its data.' };
  if (name === null) return { ok: false, reason: 'This progress file is missing some of its data.' };
  const age = int(c.age, 6, 3, 16);
  const adv = adventure(c.adventure);
  const lp = lastPlay(c.lastPlay);
  const sch = school(c.school);
  const stats = obj(c.stats);
  const child: Child = {
    id,
    name: name || 'Champ',
    age,
    avatar: int(c.avatar, 0, 0, AVATAR_COUNT - 1),
    placed: bool(c.placed),
    placementChecks: int(c.placementChecks, 0, 0, 1000),
    placedAt: rec(c.placedAt, (x) => key(x) ?? undefined, (k) => NAME.test(k)),
    progress: progress(c.progress),
    wallet: wallet(c.wallet),
    stats: { answered: int(stats.answered, 0, 0, 1e9), correct: int(stats.correct, 0, 0, 1e9), secondsByDay: dayNumRec(stats.secondsByDay) },
    bossesBeaten: keys(c.bossesBeaten, 500),
    createdDay: day(c.createdDay) ?? '',
    challenge: int(c.challenge, 0, 0, 2) as 0 | 1 | 2,
    ...(c.sinceShowcase !== undefined ? { sinceShowcase: int(c.sinceShowcase, 0, 0, 1000) } : {}),
    ...(c.undo !== undefined ? { undo: undo(c.undo) as Child['undo'] } : {}),
    ...(c.toured !== undefined ? { toured: bool(c.toured) } : {}),
    ...(typeof c.voiceName === 'string' ? { voiceName: c.voiceName.slice(0, 120) } : {}),
    ...(c.voicePitch !== undefined ? { voicePitch: num(c.voicePitch, 1, 0.5, 2) } : {}),
    ...(c.voicePicked !== undefined ? { voicePicked: bool(c.voicePicked) } : {}),
    ...(c.together !== undefined ? { together: int(c.together, 0, 0, 100) } : {}),
    ...(c.roadV !== undefined ? { roadV: int(c.roadV, 0, 0, 1e6) } : {}),
    // The tester profile (every level open) is made on the phone, never taken from a file.
    ...(opts.lenient && c.tester === true ? { tester: true } : {}),
    assisted: bool(c.assisted, age <= 6),
    ...(sch ? { school: sch } : {}),
    ...(c.backupAt !== undefined ? { backupAt: num(c.backupAt, 0, 0, 1e14) } : {}),
    ...(c.backupDays !== undefined ? { backupDays: int(c.backupDays, 0, 0, 1e6) } : {}),
    ...(c.exams !== undefined ? { exams: exams(c.exams) } : {}),
    ...(adv ? { adventure: adv as Child['adventure'] } : {}),
    ...(c.log !== undefined ? { log: playLog(c.log) as Child['log'] } : {}),
    ...(c.tally !== undefined ? { tally: tally(c.tally, 3) } : {}),
    ...(lp ? { lastPlay: lp } : {}),
    ...(c.fixit !== undefined ? { fixit: fixit(c.fixit) } : {}),
    ...(c.methods !== undefined ? { methods: rec(c.methods, (x) => (typeof x === 'string' && NAME.test(x) ? x : undefined), (k) => NAME.test(k)) } : {}),
  };
  return { ok: true, child };
}

const TIERS = Object.keys(PRICES) as PriceTier[];
const ALL_ICONS = [...OWN_ICONS.treat, ...OWN_ICONS.goal];
const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

function ownRewards(v: unknown): OwnReward[] {
  const seen = new Set<string>();
  return arr(v, 60).flatMap((e) => {
    const o = obj(e);
    const id = typeof o.id === 'string' && /^own\.[A-Za-z0-9]{1,24}$/.test(o.id) ? o.id : null;
    const name = typeof o.name === 'string' ? o.name.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40) : '';
    const tier = TIERS.includes(o.tier as PriceTier) ? (o.tier as PriceTier) : null;
    if (!id || !name || !tier || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name, icon: ALL_ICONS.includes(o.icon as string) ? (o.icon as string) : ALL_ICONS[0], tier }];
  });
}

function quiet(v: unknown): Settings['quiet'] | undefined {
  if (!isObj(v)) return undefined;
  const range = (r: unknown, from: string, to: string) => {
    const o = obj(r);
    return { on: bool(o.on), from: typeof o.from === 'string' && TIME.test(o.from) ? o.from : from, to: typeof o.to === 'string' && TIME.test(o.to) ? o.to : to };
  };
  const rawDays = obj(v.school).days;
  // No list at all (an older save, or one set before school time existed): the usual school week.
  if (!Array.isArray(rawDays)) return { bed: range(v.bed, '21:00', '07:00'), school: { ...range(v.school, '08:00', '14:00'), days: [1, 2, 3, 4, 5] } };
  const days = [...new Set(arr(rawDays, 7).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))];
  return { bed: range(v.bed, '21:00', '07:00'), school: { ...range(v.school, '08:00', '14:00'), days } };
}

/** The family's rules as a file or the cloud may set them. Must list the same keys as FAMILY_KEYS (core/cloud.ts). */
export type CleanRules = Partial<Pick<Settings, 'limitMinutes' | 'timeUpMode' | 'treatPace' | 'goalPace' | 'holiday' | 'hiddenCategories' | 'timerSeconds' | 'confirmAnswers' | 'teach' | 'ownRewards' | 'quiet'>>;

/**
 * Family rules from a file or the cloud: only the shared rules, each checked for type and range.
 * Anything else in the block (a parent PIN, a look, an unknown key) is left out, and a value of
 * the wrong kind is left out too, so the phone keeps its own.
 */
export function cleanRules(raw: unknown): CleanRules {
  const r = obj(raw);
  const out: CleanRules = {};
  const n = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
  const limit = n(r.limitMinutes, 1, 600);
  if (limit !== undefined) out.limitMinutes = Math.round(limit);
  if (r.timeUpMode === 'stop' || r.timeUpMode === 'keep') out.timeUpMode = r.timeUpMode;
  const tp = n(r.treatPace, 0.1, 10);
  if (tp !== undefined) out.treatPace = tp;
  const gp = n(r.goalPace, 0.1, 10);
  if (gp !== undefined) out.goalPace = gp;
  if (typeof r.holiday === 'boolean') out.holiday = r.holiday;
  if (Array.isArray(r.hiddenCategories)) out.hiddenCategories = [...new Set(r.hiddenCategories.filter((c): c is string => typeof c === 'string' && CATEGORY_IDS.includes(c)))];
  const timer = n(r.timerSeconds, 0, 600);
  if (timer !== undefined) out.timerSeconds = Math.round(timer);
  if (typeof r.confirmAnswers === 'boolean') out.confirmAnswers = r.confirmAnswers;
  if (typeof r.teach === 'boolean') out.teach = r.teach;
  if (Array.isArray(r.ownRewards)) out.ownRewards = ownRewards(r.ownRewards);
  const q = quiet(r.quiet);
  if (q) out.quiet = q;
  return out;
}

/** The phone's own saved settings: the family rules cleaned, and the values that are drawn on screen checked. */
export function cleanSavedSettings<T extends Partial<Settings>>(s: T): T {
  const out = { ...s } as Obj;
  const rules = cleanRules(s);
  for (const k of ['limitMinutes', 'timeUpMode', 'treatPace', 'goalPace', 'holiday', 'hiddenCategories', 'timerSeconds', 'confirmAnswers', 'teach', 'ownRewards', 'quiet'] as const) {
    if (rules[k] !== undefined) out[k] = rules[k];
    else delete out[k];
  }
  for (const k of ['volume', 'voiceRate', 'voicePitch', 'parentVisits', 'trialNudgeAt', 'backupSnoozeUntil', 'quietUnlockUntil', 'swipeBest', 'swipeTrack'] as const) {
    if (out[k] !== undefined && !(typeof out[k] === 'number' && Number.isFinite(out[k] as number))) delete out[k];
  }
  for (const k of ['voiceName', 'parentPin', 'swipeBand'] as const) if (out[k] !== undefined && typeof out[k] !== 'string') delete out[k];
  return out as T;
}

/** A device id or label as the family document carries it. */
const DEVICE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The family document from the cloud, made well-formed: child ids that fit CHILD_ID, finite times,
 * checked rules (given as an object or as the JSON text the cloud stores).
 */
export function cleanFamilyDoc(raw: unknown) {
  const f = obj(raw);
  const times = (v: unknown) => rec(v, (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined), (k) => CHILD_ID.test(k), 200);
  let rules: unknown = f.rules;
  if (typeof rules === 'string') {
    try {
      rules = JSON.parse(rules);
    } catch {
      rules = {};
    }
  }
  const primary = typeof f.primary === 'string' && DEVICE.test(f.primary) ? f.primary : undefined;
  const deletedAt = typeof f.deletedAt === 'number' && Number.isFinite(f.deletedAt) && f.deletedAt > 0 ? f.deletedAt : undefined;
  return {
    v: 1 as const,
    consentAt: num(f.consentAt, 0, 0, 1e14),
    policy: str(f.policy, 40),
    kids: times(f.kids),
    removed: times(f.removed),
    resets: times(f.resets),
    devices: rec(f.devices, (x) => (isObj(x) ? { label: str(x.label, 60), at: num(x.at, 0, 0, 1e14) } : undefined), (k) => DEVICE.test(k), 100),
    rules: cleanRules(rules),
    rulesAt: num(f.rulesAt, 0, 0, 1e14),
    ...(primary ? { primary } : {}),
    ...(deletedAt ? { deletedAt } : {}),
  };
}
