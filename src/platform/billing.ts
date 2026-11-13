// Talking to Google Play for MN ×: the native plugin on a phone (Billing.java), or a
// stand-in for test runs and the debug preview (purchases kept in this browser).

import type { PlayProduct, PlayPurchase, PurchasesEvent, StudyHardPlugin } from './native.ts';
import { BASE_MONTHLY, BASE_YEARLY, PLUS_LIFETIME, PLUS_SUB, TAG_SIGNED_IN } from '../core/membership.ts';

/** A change of plan (the subscription it replaces and Play's replacement mode), and the family's obfuscated id. */
export interface BuyOptions {
  oldToken?: string;
  mode?: number;
  account?: string;
}

export interface Billing {
  products(): Promise<PlayProduct[] | null>;
  /** Opens Play's sheet; the outcome comes to `onPurchases`. False when it couldn't open. */
  buy(product: string, offerToken?: string, o?: BuyOptions): Promise<{ ok: boolean; message?: string }>;
  owned(): Promise<PlayPurchase[] | null>;
  ack(token: string): Promise<boolean>;
  manage(product?: string): Promise<void>;
  onPurchases(cb: (e: PurchasesEvent) => void): void;
}

/** How long the page waits for an answer from Play (Billing.java answers within 15 s itself). */
export const BILLING_WAIT = 20_000;

/** A native call's answer, or null when it fails or takes longer than `ms`. */
function answer<T>(p: Promise<T> | undefined, ms: number): Promise<T | null> {
  if (!p) return Promise.resolve(null);
  return Promise.race([p.catch(() => null), new Promise<null>((res) => setTimeout(() => res(null), ms))]);
}

export class NativeBilling implements Billing {
  private readonly n: StudyHardPlugin;
  private readonly wait: number;
  constructor(n: StudyHardPlugin, wait = BILLING_WAIT) {
    this.n = n;
    this.wait = wait;
  }
  async products(): Promise<PlayProduct[] | null> {
    const r = await answer(this.n.billingProducts?.({ subs: [PLUS_SUB], inapp: [PLUS_LIFETIME] }), this.wait);
    return r?.ok ? (r.products ?? []) : null;
  }
  async buy(product: string, offerToken?: string, o: BuyOptions = {}) {
    const r = await answer(this.n.billingBuy?.({ product, offer: offerToken ?? '', oldToken: o.oldToken ?? '', mode: o.mode ?? 0, account: o.account ?? '' }), this.wait);
    return r ? { ok: r.ok, message: r.message } : { ok: false };
  }
  async owned(): Promise<PlayPurchase[] | null> {
    const r = await answer(this.n.billingOwned?.(), this.wait);
    return r?.ok ? (r.purchases ?? []) : null;
  }
  async ack(token: string): Promise<boolean> {
    return !!(await answer(this.n.billingAck?.({ token }), this.wait))?.ok;
  }
  async manage(product?: string): Promise<void> {
    await this.n.billingManage!({ product: product ?? PLUS_SUB }).catch(() => undefined);
  }
  onPurchases(cb: (e: PurchasesEvent) => void): void {
    this.n.addListener('purchases', cb);
  }
}

/** Purchases in this browser only (test runs: `?debug&store`). `__mockBilling.cancel` = say no. */
export class MockBilling implements Billing {
  private cbs: ((e: PurchasesEvent) => void)[] = [];
  private static KEY = 'studyhard.mockplay';
  private list(): PlayPurchase[] {
    try {
      return JSON.parse(localStorage.getItem(MockBilling.KEY) ?? '[]') as PlayPurchase[];
    } catch {
      return [];
    }
  }
  private keep(l: PlayPurchase[]) {
    try {
      localStorage.setItem(MockBilling.KEY, JSON.stringify(l));
    } catch {
      /* nothing kept */
    }
  }
  private get opts(): { cancel?: boolean; offline?: boolean; usedTrial?: boolean; pending?: boolean; slow?: number } {
    return (window as { __mockBilling?: object }).__mockBilling ?? {};
  }
  async products(): Promise<PlayProduct[] | null> {
    if (this.opts.slow) await new Promise((r) => setTimeout(r, this.opts.slow));
    if (this.opts.offline) return null;
    const phase = (price: string, micros: number, period: string, cycles = 0) => ({ price, micros, currency: 'INR', period, cycles });
    const trial = !this.opts.usedTrial;
    const offers = [BASE_MONTHLY, BASE_YEARLY].flatMap((base) => {
      const paid = base === BASE_MONTHLY ? phase('₹150', 150_000_000, 'P1M') : phase('₹960', 960_000_000, 'P1Y');
      return [
        { basePlan: base, offer: null, token: `${base}`, tags: [], phases: [paid] },
        ...(trial
          ? [
              { basePlan: base, offer: 'trial', token: `${base}:trial`, tags: [], phases: [phase('Free', 0, 'P1W', 1), paid] },
              { basePlan: base, offer: 'trial-signed-in', token: `${base}:trial14`, tags: [TAG_SIGNED_IN], phases: [phase('Free', 0, 'P2W', 1), paid] },
            ]
          : []),
      ];
    });
    return [
      { id: PLUS_SUB, type: 'subs', name: 'MN ×', offers },
      { id: PLUS_LIFETIME, type: 'inapp', name: 'MN × for life', price: '₹1,989', micros: 1_989_000_000, currency: 'INR' },
    ];
  }
  async buy(product: string, offerToken?: string, o: BuyOptions = {}) {
    const w = window as { __mockBilling?: { bought?: ({ product: string; offer?: string } & BuyOptions)[] } };
    if (this.opts.offline) return { ok: false };
    setTimeout(() => {
      if (this.opts.cancel) return this.emit({ ok: false, code: 1, cancelled: true, purchases: [] });
      const p: PlayPurchase = { products: [product], token: `tok-${product}-${Date.now()}`, state: this.opts.pending ? 2 : 1, acknowledged: false, autoRenewing: product === PLUS_SUB, time: Date.now(), verified: true };
      // A change of plan replaces the subscription it names; lifetime leaves a subscription running.
      this.keep([...this.list().filter((x) => !x.products.includes(product) && x.token !== o.oldToken), p]);
      ((w.__mockBilling ??= {}).bought ??= []).push({ product, offer: offerToken, ...o });
      this.emit({ ok: true, code: 0, cancelled: false, purchases: [p] });
    }, 300);
    return { ok: true };
  }
  async owned(): Promise<PlayPurchase[] | null> {
    if (this.opts.slow) await new Promise((r) => setTimeout(r, this.opts.slow));
    return this.opts.offline ? null : this.list();
  }
  async ack(token: string): Promise<boolean> {
    this.keep(this.list().map((p) => (p.token === token ? { ...p, acknowledged: true } : p)));
    return true;
  }
  async manage(): Promise<void> {
    // "Cancel" in the stand-in: the subscription is gone.
    this.keep(this.list().filter((p) => !p.products.includes(PLUS_SUB)));
  }
  onPurchases(cb: (e: PurchasesEvent) => void): void {
    this.cbs.push(cb);
  }
  private emit(e: PurchasesEvent) {
    for (const cb of this.cbs) cb(e);
  }
}
