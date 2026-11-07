// MN × on the phone: whether it's on, buying it through Google Play, and the MN × page
// in the Parent area. Only the Play Store build sells Plus; the app shared by link (with keys
// or approved Google accounts) keeps everything included, as before. Children never see any
// of this: it lives behind the parent check.

import { html, esc, type App, type Screen } from './app.ts';
import { MockBilling, NativeBilling, type Billing } from '../platform/billing.ts';
import { FEATURES, freshPlus, fromPurchases, planOffers, plusOn, PLUS_LIFETIME, TRIAL_DAYS, TRIAL_DAYS_SIGNED_IN, type PlanId, type PlanOffer, type PlusFeature, type PlusState } from '../core/membership.ts';
import type { PlayPurchase, PurchasesEvent } from '../platform/native.ts';
import { account, cloudOn, isOwnerAccount, signIn } from './cloud.ts';
import { plusVideoScreen } from './plusvideo.ts';
import { plusSvg } from './plus.ts';
import { stagger } from '../render/motion.ts';

const KEY = 'studyhard.plus';
const LAST_PLAN = 'studyhard.plus.plan';

const read = (): PlusState => {
  try {
    return { ...freshPlus(), ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as PlusState | null) };
  } catch {
    return freshPlus();
  }
};
const write = (s: PlusState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: nothing kept */
  }
};
const lsGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** Is this the Play Store build (the one that sells MN ×)? Debug: `?debug&store`. */
export const storeBuild = (app: App): boolean => app.store;

let billingCache: Billing | null | undefined;
function billing(app: App): Billing | null {
  if (billingCache !== undefined) return billingCache;
  // Test purchases: debug runs with ?store, and the owner's Play Store preview on the shared app.
  const stand = !app.storeBuild && app.store;
  billingCache = stand ? new MockBilling() : app.native?.billingProducts ? new NativeBilling(app.native) : null;
  if (billingCache) billingCache.onPurchases((e) => void purchased(app, e));
  return billingCache;
}

/** Does this phone have MN ×? (Always yes outside the Play Store build.) */
export function hasPlus(app: App): boolean {
  if (!storeBuild(app)) return true;
  if (isOwnerAccount(app) && app.storeBuild) return true;
  return plusOn(read(), Date.now());
}

/**
 * The tag beside every MN × feature: without MN ×, a gold "MN ×" (it's a paid extra); with it,
 * a violet "✓ MN ×", so parents can see what came with MN ×.
 */
export const plusTag = (app: App): string =>
  hasPlus(app) ? '<span class="mp-tag own" title="Included with MN ×"><span aria-hidden="true">✓ </span>MN&nbsp;×<span class="sr-only"> included</span></span>' : '<span class="mp-tag">MN&nbsp;×</span>';

/** A line at the top of an MN × screen, when it's on: "✓ Included with MN ×". */
export const mnxIncluded = (app: App): string => (hasPlus(app) ? '<p class="mnx-incl"><span class="mnx-incl-x" aria-hidden="true">✓</span>Included with MN&nbsp;×</p>' : '');

const listeners = new Set<() => void>();
/** Run `fn` whenever Plus turns on or off (a screen re-draws). */
export function onPlusChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Ask Play what this account owns, confirm new purchases, and keep the answer. */
export async function refreshPlus(app: App): Promise<boolean> {
  const b = billing(app);
  if (!storeBuild(app) || !b) return hasPlus(app);
  const list = await b.owned();
  if (list) await apply(app, list, true);
  return hasPlus(app);
}

async function apply(app: App, list: PlayPurchase[], complete: boolean): Promise<void> {
  const b = billing(app)!;
  const before = hasPlus(app);
  const plan = lsGet(LAST_PLAN);
  const { via, needAck } = fromPurchases(list, () => plan);
  const s = read();
  const now = Date.now();
  for (const t of needAck) if (!s.acked?.includes(t) && (await b.ack(t))) s.acked = [...(s.acked ?? []), t].slice(-10);
  if (via) {
    s.via = via;
    if (via !== 'pending') s.activeAt = now;
  } else if (complete) {
    delete s.via;
    delete s.activeAt;
  }
  s.checkedAt = now;
  write(s);
  if (before !== hasPlus(app)) for (const fn of listeners) fn();
}

async function purchased(app: App, e: PurchasesEvent): Promise<void> {
  if (e.cancelled || !e.ok) return;
  await apply(app, e.purchases, false);
  const s = read();
  if (s.via === 'pending') app.toast('Payment is on its way. MN × turns on as soon as Google Play confirms it.', 6000);
  else if (hasPlus(app)) app.toast('MN × is on. Thank you!', 5000);
}

/** Watch for purchases and check Play when the app opens and comes back. */
export function startPlus(app: App): void {
  if (!storeBuild(app) || !billing(app)) return;
  void refreshPlus(app);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - read().checkedAt > 10 * 60_000) void refreshPlus(app);
  });
}

const FEATURE_LINE: Record<PlusFeature, string> = {
  focus: 'The Focus plan is part of MN ×: each week, short rounds on the 3 skills your child finds hardest, and the scores before and after.',
  sync: 'Keeping every phone in step is part of MN ×. Without it, one phone keeps the online backup.',
  school: 'School syllabuses are part of MN ×: CBSE, ICSE or Common Core, by class, with only the topics you choose.',
  report: 'The full report is part of MN ×: strengths, skills to practise, speed, and the times of day they do best.',
  sheets: 'Printable worksheets are part of MN ×: made from where your child is now, with an answer key for you.',
  exam: 'Exam practice is part of MN\u00a0×: a timed test on the topics you pick, then a score sheet by topic to share.',
  certs: 'Certificates are part of MN\u00a0×: a printable one for every challenge beaten and every stage finished.',
  widgets: 'The Focus plan widget is part of MN\u00a0×: this week’s 3 skills and how each is going, on your home screen.',
  icons: 'The Precision look and the app icons are part of MN\u00a0×. Playground, Glass and Schoolbook are free.',
};

/**
 * A paid feature was tapped. With Plus (or outside the Play build) this is simply true;
 * without it, a short sheet explains and offers the MN × page.
 */
export async function needPlus(app: App, feature: PlusFeature, back: (app: App) => Screen): Promise<boolean> {
  if (hasPlus(app)) return true;
  const f = FEATURES.find((x) => x.id === feature)!;
  const { result } = app.sheet(
    `<div class="mp-sheet"><span class="mp-sheet-i" aria-hidden="true">${f.icon}</span><h2>${esc(f.name)}</h2><p>${esc(FEATURE_LINE[feature])}</p><p class="fine">${trialLine(app)}</p></div>`,
    [
      { label: 'See MN ×', value: true, kind: 'mint' },
      { label: 'Not now', value: false, kind: 'ghost', back: true },
    ],
    f.name,
  );
  if ((await result) === true) void app.show(plusScreen(back));
  return false;
}

const trialDaysFor = (app: App): number => (account(app) ? TRIAL_DAYS_SIGNED_IN : TRIAL_DAYS);
const trialLine = (app: App): string => `Try it free for ${trialDaysFor(app)} days. Cancel any time in Google Play.`;

/** Free days offered on this phone right now. */
export const trialDays = (app: App): number => trialDaysFor(app);

/**
 * The MN × video. Where MN × can be bought and isn't on, it ends on "Try N days free" (to the
 * plans), with the usual button under it.
 */
export function plusVideoFor(app: App, after: (app: App) => Screen, label?: string, plansBack: (app: App) => Screen = after) {
  const sell = storeBuild(app) && !hasPlus(app);
  return plusVideoScreen(() => void app.show(after), label, undefined, sell ? { label: `Try ${trialDaysFor(app)} days free`, act: () => void app.show(plusScreen(plansBack)) } : undefined);
}

const PLAN_NAME: Record<PlanId, string> = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' };

/** The MN × page (Parent area). */
export function plusScreen(back: (app: App) => Screen) {
  return (app: App): Screen => {
    let offers: PlanOffer[] = planOffers([], !!account(app));
    let chosen: PlanId = 'yearly';
    let loaded = false;
    let busy = false;
    const el = html(`<section class="screen limits mplus" aria-label="MN ×">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">MN ×</span><span style="width:50px"></span></header>
      <div class="scroll mp-body"></div>
      <footer class="lim-foot mp-foot"></footer>
    </section>`);
    const body = el.querySelector<HTMLElement>('.mp-body')!;
    const foot = el.querySelector<HTMLElement>('.mp-foot')!;

    const offer = (p: PlanId) => offers.find((o) => o.plan === p)!;
    const ctaText = (o: PlanOffer) => (o.plan === 'lifetime' ? `Buy for ${o.price}` : o.trialDays ? `Start ${o.trialDays} days free` : `Subscribe for ${o.price} ${o.per}`);
    const fine = (o: PlanOffer) =>
      o.plan === 'lifetime'
        ? 'One payment through Google Play. MN × stays on for good, on this Google account.'
        : `${o.trialDays ? `Free for ${o.trialDays} days, then ${o.price} ${o.per}` : `${o.price} ${o.per}`}. Renews automatically every ${o.plan === 'yearly' ? 'year' : 'month'} until you cancel. Cancel any time in Google Play → Payments & subscriptions${o.trialDays ? '; cancel before the free days end and you pay nothing' : ''}.`;

    const featureRows = () =>
      FEATURES.map(
        (f) => `<li class="mp-f"><span class="mp-fi" aria-hidden="true">${f.icon}</span><div><b>${esc(f.name)}</b><small>${esc(f.plus)}</small>${f.free ? `<small class="mp-free">Free: ${esc(f.free)}</small>` : ''}</div></li>`,
      ).join('');

    const paintOwned = () => {
      const s = read();
      const owner = isOwnerAccount(app) && app.storeBuild && s.via !== 'lifetime';
      const what = owner ? 'Included with the owner account.' : s.via === 'lifetime' ? 'Yours for life. Thank you!' : 'Your subscription is active. Thank you!';
      body.innerHTML = `
        <div class="mp-hero on"><div class="mp-logo">${plusSvg({ noShadow: true })}</div><h2>MN × is on</h2><p>${what}</p></div>
        <ul class="card mp-list">${featureRows()}</ul>
        <button class="pa-row card mp-video"><b>▶ What MN × adds</b><small>The 1-minute video</small></button>`;
      foot.innerHTML = s.via && s.via !== 'lifetime' && !owner ? `<button class="btn ghost mp-manage">Manage subscription</button>` : `<button class="btn mp-done">Done</button>`;
    };

    const paintShop = () => {
      const signedIn = !!account(app);
      const o = offer(chosen);
      const card = (p: PlanOffer) => `<button class="mp-plan${p.plan === chosen ? ' on' : ''}" role="radio" aria-checked="${p.plan === chosen}" data-plan="${p.plan}">
          ${p.plan === 'yearly' ? '<em>Save almost half</em>' : p.plan === 'lifetime' ? '<em>Pay once</em>' : ''}
          <small>${PLAN_NAME[p.plan]}</small><b>${esc(p.price)}</b><span>${p.plan === 'lifetime' ? 'once, for good' : esc(p.per)}</span>
          ${p.monthly ? `<i>${esc(p.monthly)}</i>` : p.trialDays ? `<i>${p.trialDays} days free</i>` : p.plan === 'lifetime' ? '<i>No renewals</i>' : ''}</button>`;
      const pending = read().via === 'pending';
      body.innerHTML = `
        <div class="mp-hero"><div class="mp-logo">${plusSvg({ noShadow: true })}</div><h2>See the whole picture</h2><p>Everything your child plays with is free. MN × is for you.</p></div>
        <ul class="card mp-list">${featureRows()}</ul>
        <button class="pa-row card mp-video"><b>▶ What MN × adds</b><small>The 1-minute video</small></button>
        ${pending ? '<p class="card mp-note" role="status">⏳ A payment is on its way. MN × turns on as soon as Google Play confirms it.</p>' : ''}
        <div class="mp-plans" role="radiogroup" aria-label="Choose a plan">${offers.map(card).join('')}</div>
        ${!signedIn && cloudOn(app) ? `<div class="card mp-signin"><p><b>Get ${TRIAL_DAYS_SIGNED_IN} days free instead of ${TRIAL_DAYS}</b><small>Sign in with Google first. Your family’s progress gets an online backup too.</small></p><button class="btn ghost small mp-g">Sign in with Google</button></div>` : ''}
        <p class="mp-fine">${esc(fine(o))}</p>
        ${loaded ? '' : '<p class="mp-fine mp-loading">Getting prices from Google Play…</p>'}
        <button class="linkish mp-restore">Already bought MN ×? Restore it</button>`;
      foot.innerHTML = `<button class="btn mint mp-buy"${busy ? ' disabled' : ''}>${esc(ctaText(o))}</button>`;
    };

    const paint = () => {
      el.classList.toggle('owned', hasPlus(app));
      return hasPlus(app) ? paintOwned() : paintShop();
    };

    const buy = async () => {
      const b = billing(app);
      const o = offer(chosen);
      if (!b || !loaded) {
        app.toast('Google Play isn’t reachable right now. Check the internet connection and try again.', 5000);
        return;
      }
      busy = true;
      paint();
      try {
        localStorage.setItem(LAST_PLAN, o.plan === 'lifetime' ? '' : o.plan);
      } catch {
        /* fine */
      }
      const r = await b.buy(o.product === PLUS_LIFETIME ? PLUS_LIFETIME : o.product, o.token);
      busy = false;
      if (!r.ok) app.toast('Google Play couldn’t open just now. Please try again.', 5000);
      paint();
    };

    el.addEventListener('click', async (e) => {
      const t = e.target as HTMLElement;
      const plan = t.closest<HTMLElement>('[data-plan]');
      if (plan) {
        chosen = plan.dataset.plan as PlanId;
        paint();
      } else if (t.closest('.mp-buy')) void buy();
      else if (t.closest('.mp-video')) void app.show(plusVideoScreen(() => void app.show(plusScreen(back)), 'Back to MN ×'));
      else if (t.closest('.mp-restore')) {
        const on = await refreshPlus(app);
        app.toast(on ? 'MN × is on.' : read().via === 'pending' ? 'Your payment is still on its way.' : 'No MN × found on this Google Play account. Use the same Google account that bought it.', 5000);
        paint();
      } else if (t.closest('.mp-manage')) await billing(app)?.manage();
      else if (t.closest('.mp-done')) void app.show(back);
      else if (t.closest('.mp-g')) {
        const r = await signIn(app);
        if (r === 'approved') app.toast(`Signed in. Your free trial is now ${TRIAL_DAYS_SIGNED_IN} days.`, 5000);
        await load();
      }
    });
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(back));

    const load = async () => {
      const b = billing(app);
      const products = b ? await b.products() : null;
      loaded = !!products;
      if (products) offers = planOffers(products, !!account(app));
      paint();
    };
    const off = onPlusChange(paint);
    paint();
    return {
      el,
      mounted: () => {
        stagger(body.children, { gap: 40 });
        void load();
        void refreshPlus(app).then(paint);
      },
      destroy: () => void off(),
    };
  };
}

// ── the owner's Play Store preview (on the app shared by link) ──────────────

const PREVIEW = 'studyhard.storepreview';
export const previewOn = (): boolean => lsGet(PREVIEW) === '1';

/** Owner area card: switch this phone to act like the Play build, with test purchases. */
export function previewCard(app: App, repaint: () => void): HTMLElement {
  const on = previewOn();
  const el = html(`<div class="card ow-card mp-preview">
    <h2>✨ Play Store preview</h2>
    <p class="fine">See MN on this phone the way the Play Store version will be: no keys, MN × for sale, the free plan’s limits. Purchases here are only tests: no money changes hands, and they stay on this phone.</p>
    <label class="toggle-row"><span><b>Preview the Play Store version</b><small>${on ? 'On: the Parent area shows MN ×' : 'Off'}</small></span><input type="checkbox" role="switch" class="mp-prev" ${on ? 'checked' : ''}></label>
    ${on ? '<button class="btn ghost small warn mp-reset">Remove test purchases</button>' : ''}
  </div>`);
  el.querySelector('.mp-prev')!.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).checked;
    try {
      if (v) localStorage.setItem(PREVIEW, '1');
      else localStorage.removeItem(PREVIEW);
    } catch {
      /* fine */
    }
    billingCache = undefined;
    if (v) startPlus(app);
    app.toast(v ? 'Play Store preview on. Open the Parent area to try MN ×.' : 'Play Store preview off.', 4000);
    repaint();
  });
  el.querySelector('.mp-reset')?.addEventListener('click', () => {
    try {
      localStorage.removeItem('studyhard.mockplay');
      localStorage.removeItem(KEY);
    } catch {
      /* fine */
    }
    app.toast('Test purchases removed. MN × is off on this phone.');
    for (const fn of listeners) fn();
  });
  return el;
}
