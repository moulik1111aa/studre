// MN Plus, the grown-ups' paid extras (Play Store build only). What the Play account owns
// decides it; this file only does the deciding, with no Play or screen code, so it can be
// tested. Plans: monthly and yearly subscriptions (with a free trial offer) and a one-time
// lifetime purchase. Prices always come from Play (in the phone's own currency); the ones
// here are only shown when Play can't be reached.

import type { PlayProduct, PlayPurchase } from '../platform/native.ts';

/** Google Play product ids (create these in Play Console → Monetise). */
export const PLUS_SUB = 'mn_plus';
export const PLUS_LIFETIME = 'mn_plus_lifetime';
/** The subscription's base plans. */
export const BASE_MONTHLY = 'monthly';
export const BASE_YEARLY = 'yearly';
/** The offer tag on the longer trial, for grown-ups signed in with Google. */
export const TAG_SIGNED_IN = 'signed-in';

export type PlanId = 'monthly' | 'yearly' | 'lifetime';

/** Shown only when Play's own prices haven't loaded (₹, India). */
export const FALLBACK: Record<PlanId, { price: string; per: string }> = {
  monthly: { price: '₹150', per: 'a month' },
  yearly: { price: '₹960', per: 'a year' },
  lifetime: { price: '₹1,989', per: 'once' },
};

/** Trial lengths (days). Play gives the trial; these are only for the words on screen. */
export const TRIAL_DAYS = 7;
export const TRIAL_DAYS_SIGNED_IN = 14;

/** What MN Plus adds, in the order the Plus page lists them. */
export type PlusFeature = 'sync' | 'school' | 'report' | 'sheets';
export const FEATURES: { id: PlusFeature; icon: string; name: string; free: string; plus: string }[] = [
  { id: 'sync', icon: '☁️', name: 'Backup and sync', free: 'A safe copy from one phone', plus: 'Every phone in step, all the time' },
  { id: 'school', icon: '📚', name: 'School paths', free: 'The path for their age', plus: 'CBSE, ICSE or Common Core, by class, with the topics you pick' },
  { id: 'report', icon: '📊', name: 'Full report', free: 'Stars, time and this week', plus: 'Strengths, skills to practise, speed and best times' },
  { id: 'sheets', icon: '🖨️', name: 'Worksheets', free: '', plus: 'Printable sheets from where they are now, with answers' },
];

/** The phone's record of MN Plus (kept on the phone, not in backups). */
export interface PlusState {
  /** What gives Plus now; none when it isn't on. */
  via?: 'monthly' | 'yearly' | 'lifetime' | 'subscription' | 'owner' | 'pending';
  /** Last time Play was asked (ms), and when a subscription was last seen active. */
  checkedAt: number;
  activeAt?: number;
  /** Purchase tokens already acknowledged with Play. */
  acked?: string[];
}

export const freshPlus = (): PlusState => ({ checkedAt: 0 });

/** Purchase state 1 = purchased, 2 = pending (a cash or UPI payment still on its way). */
const PURCHASED = 1;
const PENDING = 2;

/**
 * What Play says the account owns. A subscription in its trial, or cancelled but not yet
 * ended, still shows up as purchased, so "owned" is simply "listed and purchased".
 */
export function fromPurchases(list: PlayPurchase[], basePlanOf: (p: PlayPurchase) => string | null = () => null): { via: PlusState['via'] | undefined; needAck: string[] } {
  let via: PlusState['via'] | undefined;
  const needAck: string[] = [];
  for (const p of list) {
    const mine = p.products.includes(PLUS_SUB) || p.products.includes(PLUS_LIFETIME);
    if (!mine) continue;
    if (p.state === PENDING) {
      via ??= 'pending';
      continue;
    }
    if (p.state !== PURCHASED) continue;
    if (!p.acknowledged) needAck.push(p.token);
    if (p.products.includes(PLUS_LIFETIME)) via = 'lifetime';
    else if (via !== 'lifetime') {
      const plan = basePlanOf(p);
      via = plan === BASE_YEARLY ? 'yearly' : plan === BASE_MONTHLY ? 'monthly' : 'subscription';
    }
  }
  return { via, needAck };
}

/**
 * How long Plus keeps working without reaching Play (offline): a lifetime purchase forever,
 * a subscription for 7 days after Play last said it was active (Play's own list normally
 * works offline anyway; this covers a phone where it doesn't).
 */
export const OFFLINE_GRACE = 7 * 86_400_000;

export function plusOn(s: PlusState | undefined, now: number): boolean {
  if (!s?.via || s.via === 'pending') return false;
  if (s.via === 'lifetime' || s.via === 'owner') return true;
  return !!s.activeAt && now - s.activeAt < OFFLINE_GRACE;
}

/** One plan's price line, from Play when it has loaded. */
export interface PlanOffer {
  plan: PlanId;
  product: string;
  /** For subscriptions: the offer token Play needs to buy it. */
  token?: string;
  price: string;
  per: string;
  /** Days free first (0: no trial offered, e.g. it was used before). */
  trialDays: number;
  /** "₹80 a month" for the yearly plan. */
  monthly?: string;
}

/** "P7D" → 7, "P2W" → 14, "P1M" → 30. */
export function periodDays(iso: string): number {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 365 + Number(m[2] ?? 0) * 30 + Number(m[3] ?? 0) * 7 + Number(m[4] ?? 0);
}

const money = (micros: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: micros % 1_000_000 ? 2 : 0 }).format(micros / 1_000_000);
  } catch {
    return `${currency} ${Math.round(micros / 10_000) / 100}`;
  }
};

/**
 * The three plans with Play's prices. For a subscription, Play lists only the offers this
 * account may use: the signed-in trial when signed in and offered, else the usual trial,
 * else the base plan on its own (trial used before).
 */
export function planOffers(products: PlayProduct[], signedIn: boolean): PlanOffer[] {
  const out: PlanOffer[] = [];
  const sub = products.find((p) => p.id === PLUS_SUB);
  for (const [plan, base] of [['monthly', BASE_MONTHLY], ['yearly', BASE_YEARLY]] as const) {
    const offers = (sub?.offers ?? []).filter((o) => o.basePlan === base);
    if (!offers.length) {
      out.push({ plan, product: PLUS_SUB, ...FALLBACK[plan], trialDays: 0 });
      continue;
    }
    const trial = (o: (typeof offers)[number]) => o.phases.find((ph) => ph.micros === 0);
    const pick =
      (signedIn ? offers.find((o) => o.tags.includes(TAG_SIGNED_IN) && trial(o)) : undefined) ??
      offers.find((o) => !o.tags.includes(TAG_SIGNED_IN) && o.offer && trial(o)) ??
      offers.find((o) => !o.offer) ??
      offers[0];
    const paid = pick.phases.find((ph) => ph.micros > 0) ?? pick.phases[pick.phases.length - 1];
    const free = trial(pick);
    out.push({
      plan,
      product: PLUS_SUB,
      token: pick.token,
      price: paid?.price ?? FALLBACK[plan].price,
      per: plan === 'yearly' ? 'a year' : 'a month',
      trialDays: free ? periodDays(free.period) * Math.max(1, free.cycles) : 0,
      monthly: plan === 'yearly' && paid ? `${money(paid.micros / 12, paid.currency)} a month` : undefined,
    });
  }
  const life = products.find((p) => p.id === PLUS_LIFETIME);
  out.push({ plan: 'lifetime', product: PLUS_LIFETIME, price: life?.price ?? FALLBACK.lifetime.price, per: 'once', trialDays: 0 });
  if (!sub) out[1].monthly = '₹80 a month';
  return out;
}

/**
 * Free backup is a safe copy from one phone, at most every few hours (Plus: a few seconds
 * after each change, on every phone).
 */
export const FREE_SYNC_GAP = 6 * 3_600_000;

/** Is a free (one-phone) backup due? `asked`: the grown-up tapped "Back up now". */
export const freeSyncDue = (lastSync: number, now: number, asked: boolean): boolean => asked || !lastSync || now - lastSync >= FREE_SYNC_GAP;
