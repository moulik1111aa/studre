// MN Premium: what Play's answers mean (core/membership.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREE_SYNC_GAP, OFFLINE_GRACE, freeSyncDue, fromPurchases, periodDays, planOffers, plusOn, PLUS_LIFETIME, PLUS_SUB, TAG_SIGNED_IN } from '../src/core/membership.ts';
import type { PlayProduct, PlayPurchase } from '../src/platform/native.ts';

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
    name: 'MN Premium',
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
  { id: PLUS_LIFETIME, type: 'inapp', name: 'MN Premium for life', price: '₹1,989', micros: 1989e6, currency: 'INR' },
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

test('plans before Play answers: the Indian prices, nothing to buy with', () => {
  const out = planOffers([], false);
  assert.deepEqual(out.map((o) => o.price), ['₹150', '₹960', '₹1,989']);
  assert.equal(out[1].monthly, '₹80 a month');
  assert.ok(out.every((o) => !o.token));
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
