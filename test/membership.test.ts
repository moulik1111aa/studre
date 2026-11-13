// MN ×: what Play's answers mean (core/membership.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREE_SYNC_GAP, OFFLINE_GRACE, freeSyncDue, fromPurchases, periodDays, planOffers, plusOn, plusStatus, replacementMode, trialDaysOf, PLUS_LIFETIME, PLUS_SUB, REPLACE_DEFERRED, REPLACE_WITH_TIME_PRORATION, TAG_SIGNED_IN } from '../src/core/membership.ts';
import type { PlayProduct, PlayPurchase, StudyHardPlugin } from '../src/platform/native.ts';
import { NativeBilling } from '../src/platform/billing.ts';

const buy = (product: string, o: Partial<PlayPurchase> = {}): PlayPurchase => ({ products: [product], token: `t-${product}`, state: 1, acknowledged: true, autoRenewing: true, time: 1, json: '{}', signature: '', ...o });

test('owned: a subscription or the lifetime product gives Plus; lifetime wins; pending is not Plus yet', () => {
  assert.equal(fromPurchases([]).via, undefined);
  assert.equal(fromPurchases([buy(PLUS_SUB)]).via, 'subscription');
  assert.equal(fromPurchases([buy(PLUS_SUB)], () => 'yearly').via, 'yearly');
  assert.equal(fromPurchases([buy(PLUS_SUB), buy(PLUS_LIFETIME)]).via, 'lifetime');
  assert.equal(fromPurchases([buy(PLUS_LIFETIME), buy(PLUS_SUB)]).via, 'lifetime');
  assert.equal(fromPurchases([buy(PLUS_SUB, { state: 2 })]).via, 'pending');
  assert.equal(fromPurchases([buy('something_else')]).via, undefined);
  assert.deepEqual(fromPurchases([buy(PLUS_SUB, { acknowledged: false })]).needAck, ['t-mn_plus']);
  assert.deepEqual(fromPurchases([buy(PLUS_SUB, { acknowledged: false, state: 2 })]).needAck, [], 'pending ones are confirmed later');
});

test('Plus stays on offline: lifetime always, a subscription for a week after Play last saw it', () => {
  const now = 1_000_000_000_000;
  assert.equal(plusOn(undefined, now), false);
  assert.equal(plusOn({ via: 'lifetime', checkedAt: 0 }, now), true);
  assert.equal(plusOn({ via: 'pending', checkedAt: now }, now), false);
  assert.equal(plusOn({ via: 'monthly', checkedAt: now, activeAt: now - OFFLINE_GRACE + 1000 }, now), true);
  assert.equal(plusOn({ via: 'monthly', checkedAt: now, activeAt: now - OFFLINE_GRACE - 1000 }, now), false);
});

const phase = (price: string, micros: number, period: string, cycles = 0) => ({ price, micros, currency: 'INR', period, cycles });
const products = (trials: boolean): PlayProduct[] => [
  {
    id: PLUS_SUB,
    type: 'subs',
    name: 'MN ×',
    offers: ['monthly', 'yearly'].flatMap((base) => {
      const paid = base === 'monthly' ? phase('₹150', 150e6, 'P1M') : phase('₹960', 960e6, 'P1Y');
      return [
        { basePlan: base, offer: null, token: base, tags: [], phases: [paid] },
        ...(trials
          ? [
              { basePlan: base, offer: 'trial', token: `${base}:7`, tags: [], phases: [phase('Free', 0, 'P1W', 1), paid] },
              { basePlan: base, offer: 'trial14', token: `${base}:14`, tags: [TAG_SIGNED_IN], phases: [phase('Free', 0, 'P2W', 1), paid] },
            ]
          : []),
      ];
    }),
  },
  { id: PLUS_LIFETIME, type: 'inapp', name: 'MN × for life', price: '₹1,989', micros: 1989e6, currency: 'INR' },
];

test('plans: Play prices, the signed-in trial when signed in, and no trial once it was used', () => {
  const out = planOffers(products(true), false);
  assert.deepEqual(out.map((o) => [o.plan, o.price, o.trialDays, o.token]), [
    ['monthly', '₹150', 7, 'monthly:7'],
    ['yearly', '₹960', 7, 'yearly:7'],
    ['lifetime', '₹1,989', 0, undefined],
  ]);
  assert.equal(out[1].monthly, '₹80 a month');
  const signed = planOffers(products(true), true);
  assert.deepEqual(signed.map((o) => o.trialDays), [14, 14, 0]);
  assert.equal(signed[0].token, 'monthly:14');
  const used = planOffers(products(false), true);
  assert.deepEqual(used.map((o) => [o.trialDays, o.token]), [[0, 'monthly'], [0, 'yearly'], [0, undefined]]);
});

test('plans before Play answers: no prices at all, and no trial to mention', () => {
  assert.deepEqual(planOffers([], false), []);
  assert.equal(trialDaysOf(planOffers([], true)), 0);
  // A plan Play didn't list is left out, never filled in.
  const onlyLife = planOffers([products(true)[1]], false);
  assert.deepEqual(onlyLife.map((o) => [o.plan, o.price]), [['lifetime', '₹1,989']]);
});

test('a free trial is mentioned only when the loaded offer has one', () => {
  assert.equal(trialDaysOf(planOffers(products(true), false)), 7);
  assert.equal(trialDaysOf(planOffers(products(true), true)), 14);
  assert.equal(trialDaysOf(planOffers(products(false), true)), 0, 'an account that used its trial');
});

test('only purchases Billing.java verified count, and the subscription token is kept for a change of plan', () => {
  assert.equal(fromPurchases([buy(PLUS_LIFETIME, { verified: false })]).via, undefined);
  assert.equal(fromPurchases([buy(PLUS_SUB, { verified: false })]).via, undefined);
  assert.equal(fromPurchases([buy(PLUS_SUB, { verified: true })]).via, 'subscription');
  const both = fromPurchases([buy(PLUS_LIFETIME), buy(PLUS_SUB, { token: 'sub-1', autoRenewing: true })]);
  assert.equal(both.via, 'lifetime');
  assert.equal(both.subToken, 'sub-1');
  assert.equal(both.subRenewing, true, 'a lifetime buyer still has a renewing subscription to cancel');
});

test('a change of plan: monthly to yearly now with the time credited, yearly to monthly at renewal', () => {
  assert.equal(replacementMode('yearly'), REPLACE_WITH_TIME_PRORATION);
  assert.equal(replacementMode('monthly'), REPLACE_DEFERRED);
  assert.equal(REPLACE_WITH_TIME_PRORATION, 1);
  assert.equal(REPLACE_DEFERRED, 6);
});

test('an expired cached subscription is "checking" until Play answers, not "off"', () => {
  const now = 1_000_000_000_000;
  const old = { via: 'yearly' as const, checkedAt: 0, activeAt: now - OFFLINE_GRACE - 1000 };
  assert.equal(plusStatus(old, now, false), 'checking');
  assert.equal(plusStatus(old, now, true), 'off');
  assert.equal(plusStatus({ via: 'yearly', checkedAt: now, activeAt: now }, now, false), 'on');
  assert.equal(plusStatus({ via: 'lifetime', checkedAt: 0 }, now, false), 'on');
  assert.equal(plusStatus({ via: 'pending', checkedAt: 0 }, now, false), 'off');
  assert.equal(plusStatus(undefined, now, false), 'off');
});

test('with Play unavailable, every billing call answers with an error within the wait', async () => {
  const never = () => new Promise<never>(() => {});
  const plugin = { billingProducts: never, billingBuy: never, billingOwned: never, billingAck: never, billingManage: never, addListener: () => undefined } as unknown as StudyHardPlugin;
  const b = new NativeBilling(plugin, 40);
  const t0 = Date.now();
  const [p, buyR, owned, ack] = await Promise.all([b.products(), b.buy(PLUS_SUB, 'yearly'), b.owned(), b.ack('t')]);
  assert.equal(p, null);
  assert.deepEqual(buyR, { ok: false });
  assert.equal(owned, null);
  assert.equal(ack, false);
  assert.ok(Date.now() - t0 < 1000);
  // A failed answer is an error too, not a hang.
  const fails = { billingProducts: async () => ({ ok: false, code: 3 }), billingOwned: async () => { throw new Error('no Play'); } } as unknown as StudyHardPlugin;
  assert.equal(await new NativeBilling(fails, 40).products(), null);
  assert.equal(await new NativeBilling(fails, 40).owned(), null);
  // A plan change and the family's id reach the native call.
  let sent: unknown;
  const rec = { billingBuy: async (o: unknown) => ((sent = o), { ok: true }) } as unknown as StudyHardPlugin;
  await new NativeBilling(rec, 40).buy(PLUS_SUB, 'yearly', { oldToken: 'old', mode: 1, account: 'abc' });
  assert.deepEqual(sent, { product: PLUS_SUB, offer: 'yearly', oldToken: 'old', mode: 1, account: 'abc' });
});

test('periods and the free online backup', () => {
  assert.equal(periodDays('P7D'), 7);
  assert.equal(periodDays('P2W'), 14);
  assert.equal(periodDays('P1M'), 30);
  assert.equal(periodDays('nonsense'), 0);
  assert.equal(freeSyncDue(0, 5, false), true);
  assert.equal(freeSyncDue(100, 100 + FREE_SYNC_GAP - 1, false), false);
  assert.equal(freeSyncDue(100, 100 + FREE_SYNC_GAP - 1, true), true);
  assert.equal(freeSyncDue(100, 100 + FREE_SYNC_GAP, false), true);
});
