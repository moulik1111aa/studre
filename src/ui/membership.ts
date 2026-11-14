// MN × on the phone: whether it's on, buying it through Google Play, and the MN × page
// in the Parent area. Only the Play Store build sells Plus; the app shared by link (with keys
// or approved Google accounts) keeps everything included, as before. Children never see any
// of this: it lives behind the parent check.

import { html, esc, type App, type Screen } from './app.ts';
import { timesMarkSvg } from './mnx.ts';
import { NativeBilling, type Billing } from '../platform/billing.ts';
// #unless play
import { MockBilling } from '../platform/billing.ts';
// #end
import { FEATURES, freshPlus, fromPurchases, planOffers, plusOn, plusStatus, replacementMode, trialDaysOf, type PlanId, type PlanOffer, type PlusFeature, type PlusState } from '../core/membership.ts';
import type { PlayProduct, PlayPurchase, PurchasesEvent } from '../platform/native.ts';
import { account, cloudOn, signIn } from './cloud.ts';
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
  billingCache = app.native?.billingProducts ? new NativeBilling(app.native) : null;
  // Test purchases: debug runs with ?store, and the owner's Play Store preview on the shared app.
  // #unless play
  if (!app.storeBuild && app.store) billingCache = new MockBilling();
  // #end
  if (billingCache) billingCache.onPurchases((e) => void purchased(app, e));
  return billingCache;
}

/** Play has answered "what does this account own" in this session. */
let answered = false;

/** Does this phone have MN ×? (Always yes outside the Play Store build.) Only Play decides. */
export function hasPlus(app: App): boolean {
  if (!storeBuild(app)) return true;
  return plusOn(read(), Date.now());
}

/** MN × on, off, or "checking": a subscription not confirmed for a while, before Play's first answer this session. */
export function plusState(app: App): 'on' | 'off' | 'checking' {
  if (!storeBuild(app)) return 'on';
  return plusStatus(read(), Date.now(), answered);
}

// ── Play's plans, once loaded this session (no prices or trial words before that) ──

let products: PlayProduct[] | null = null;
let loading: Promise<PlayProduct[] | null> | null = null;
/** Ask Play for the plans (once at a time); null when Play can't be reached. */
export function loadPlans(app: App): Promise<PlayProduct[] | null> {
  const b = billing(app);
  if (!b) return Promise.resolve(null);
  loading ??= b.products().then((p) => {
    loading = null;
    if (p) products = p;
    return p;
  });
  return loading;
}
/** The plans with Play's prices for this account (empty until Play has answered). */
export const plansNow = (app: App): PlanOffer[] => (products ? planOffers(products, !!account(app)) : []);
/** Free days Play offers this account now (0: none, or not known yet). */
export const offeredTrialDays = (app: App): number => trialDaysOf(plansNow(app));
/** The words on a button to the plans: the trial only when Play offers one. */
export const plansCta = (app: App): string => {
  const d = offeredTrialDays(app);
  return d ? `Try ${d} days free` : 'See plans';
};
/** The free days a family would get by signing in with Google first, when Play offers more that way. */
const signedInTrialDays = (): number => (products ? trialDaysOf(planOffers(products, true)) : 0);

/** The family's id for Play (obfuscatedAccountId): a hash of the Firebase account, never the email. */
async function accountId(app: App): Promise<string> {
  const uid = account(app)?.uid;
  if (!uid || !globalThis.crypto?.subtle) return '';
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mn-play:${uid}`));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
}

/**
 * The mark on every MN × feature: a small round × badge pinned to the card's top-right corner
 * (so it never pushes or wraps the text). With MN × on it's violet with a check: "came with
 * MN ×". Without it, white with a small lock: "a paid extra".
 */
export const plusTag = (app: App): string => {
  const own = hasPlus(app);
  return `<span class="mp-tag${own ? ' own' : ''}" role="img" aria-label="${own ? 'Included with MN Times' : 'Part of MN Times'}">${timesMarkSvg('mp-x')}<i class="mp-dot" aria-hidden="true">${own ? '<svg viewBox="0 0 12 12"><path d="M2.6 6.2 5 8.5l4.4-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<svg viewBox="0 0 12 12"><rect x="2.5" y="5.4" width="7" height="5" rx="1.3" fill="currentColor"/><path d="M4.2 5.6V4.2a1.8 1.8 0 0 1 3.6 0v1.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'}</i></span>`;
};

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
  const before = plusState(app);
  const plan = lsGet(LAST_PLAN);
  const { via, needAck, subToken, subRenewing } = fromPurchases(list, () => plan);
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
  if (subToken) {
    s.subToken = subToken;
    s.subRenewing = subRenewing;
  } else if (complete) {
    delete s.subToken;
    delete s.subRenewing;
  }
  s.checkedAt = now;
  write(s);
  if (complete) answered = true;
  if (before !== plusState(app)) for (const fn of listeners) fn();
}

async function purchased(app: App, e: PurchasesEvent): Promise<void> {
  if (e.cancelled || !e.ok) return;
  await apply(app, e.purchases, false);
  // The whole list: a lifetime purchase may leave a subscription running.
  const all = await billing(app)?.owned();
  if (all) await apply(app, all, true);
  const s = read();
  if (s.via === 'pending') app.toast('Payment is on its way. MN × turns on as soon as Google Play confirms it.', 6000);
  else if (s.via === 'lifetime' && s.subToken && s.subRenewing) lifetimeWithSubscription(app);
  else if (hasPlus(app)) app.toast('MN × is on. Thank you!', 5000);
  // A purchase or change of plan went through: screens show the plan as it is now.
  for (const fn of listeners) fn();
}

/** Lifetime bought while a subscription still renews: Play doesn't stop it, so the parent must. */
function lifetimeWithSubscription(app: App): void {
  const { result } = app.sheet(
    `<h2>MN × is yours for life</h2><p>Your MN × subscription is still active, and Google Play keeps charging for it until you cancel it. Cancel it in Google Play → Payments & subscriptions so you aren’t charged again.</p>`,
    [
      { label: 'Manage subscription', value: true, kind: 'mint' },
      { label: 'Later', value: false, kind: 'ghost', back: true },
    ],
    'Cancel your subscription',
  );
  void result.then((v) => {
    if (v) void manage(app);
  });
}

/** Open Play's subscriptions page; check again now and when the parent comes back from it. */
async function manage(app: App): Promise<void> {
  const again = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', again);
    void refreshPlus(app).then(() => {
      for (const fn of listeners) fn();
    });
  };
  document.addEventListener('visibilitychange', again);
  await billing(app)?.manage();
  again();
}

/** Watch for purchases and check Play when the app opens and comes back. */
export function startPlus(app: App): void {
  if (!storeBuild(app) || !billing(app)) return;
  void refreshPlus(app);
  // The plans (prices, whether a trial is offered) for the words on MN × buttons and sheets.
  void loadPlans(app);
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
  icons: 'The Shapes, Print and Precision looks and the app icons are part of MN\u00a0×. Notebook, Playground, Glass and Schoolbook are free.',
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

const trialLine = (app: App): string => {
  const d = offeredTrialDays(app);
  return d ? `Try it free for ${d} days. Cancel any time in Google Play.` : 'See the plans and prices on the MN × page.';
};

/**
 * The MN × video. Where MN × can be bought and isn't on, it ends on "Try N days free" (to the
 * plans), with the usual button under it.
 */
export function plusVideoFor(app: App, after: (app: App) => Screen, label?: string, plansBack: (app: App) => Screen = after) {
  const sell = storeBuild(app) && !hasPlus(app);
  return plusVideoScreen(() => void app.show(after), label, undefined, sell ? { label: plansCta(app), act: () => void app.show(plusScreen(plansBack)) } : undefined);
}

const PLAN_NAME: Record<PlanId, string> = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' };

/** The MN × page (Parent area). */
export function plusScreen(back: (app: App) => Screen) {
  return (app: App): Screen => {
    /** 'shop': the plans; 'change': a subscriber choosing another plan. */
    let view: 'shop' | 'change' = 'shop';
    let prices: 'loading' | 'ready' | 'none' = plansNow(app).length ? 'ready' : 'loading';
    let chosen: PlanId = 'yearly';
    let busy = false;
    const el = html(`<section class="screen limits mplus" aria-label="MN ×">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">MN ×</span><span style="width:50px"></span></header>
      <div class="scroll mp-body"></div>
      <footer class="lim-foot mp-foot"></footer>
    </section>`);
    const body = el.querySelector<HTMLElement>('.mp-body')!;
    const foot = el.querySelector<HTMLElement>('.mp-foot')!;

    /** The plans this view offers: in "change", the other subscription plan and lifetime. */
    const offers = (): PlanOffer[] => {
      const all = plansNow(app);
      if (view !== 'change') return all;
      const now = read().via;
      return all.filter((o) => o.plan !== now);
    };
    const offer = (): PlanOffer | undefined => offers().find((o) => o.plan === chosen) ?? offers()[0];
    const switching = (o: PlanOffer) => view === 'change' && o.plan !== 'lifetime';
    const ctaText = (o: PlanOffer) =>
      o.plan === 'lifetime' ? `Buy for ${o.price}` : switching(o) ? `Switch to ${PLAN_NAME[o.plan].toLowerCase()}` : o.trialDays ? `Start ${o.trialDays} days free` : `Subscribe for ${o.price} ${o.per}`;
    const fine = (o: PlanOffer) => {
      if (o.plan === 'lifetime') return `One payment through Google Play. MN × stays on for good, on this Google account.${view === 'change' ? ' Your subscription doesn’t stop by itself: cancel it in Google Play afterwards.' : ''}`;
      if (switching(o)) return o.plan === 'yearly' ? `Switches now. What’s left of this month is added to your year, then ${o.price} ${o.per}. Google Play shows the details before you confirm.` : `Your year runs to its end, then ${o.price} ${o.per}. Google Play shows the details before you confirm.`;
      return `${o.trialDays ? `Free for ${o.trialDays} days, then ${o.price} ${o.per}` : `${o.price} ${o.per}`}. Renews automatically every ${o.plan === 'yearly' ? 'year' : 'month'} until you cancel. Cancel any time in Google Play → Payments & subscriptions${o.trialDays ? '; cancel before the free days end and you pay nothing' : ''}.`;
    };

    const featureRows = () =>
      FEATURES.map(
        (f) => `<li class="mp-f"><span class="mp-fi" aria-hidden="true">${f.icon}</span><div><b>${esc(f.name)}</b><small>${esc(f.plus)}</small>${f.free ? `<small class="mp-free">Free: ${esc(f.free)}</small>` : ''}</div></li>`,
      ).join('');

    const paintChecking = () => {
      body.innerHTML = `<div class="mp-hero"><div class="mp-logo">${plusSvg({ noShadow: true })}</div><h2>Checking MN ×</h2><p>Asking Google Play what this account has…</p></div>`;
      foot.innerHTML = `<button class="btn ghost mp-done">Back</button>`;
    };

    const paintOwned = () => {
      const s = read();
      const sub = s.via !== 'lifetime';
      const what = !sub ? 'Yours for life. Thank you!' : `Your ${s.via === 'monthly' || s.via === 'yearly' ? `${s.via} ` : ''}subscription is active. Thank you!`;
      const stillCharging = !sub && s.subToken && s.subRenewing;
      body.innerHTML = `
        <div class="mp-hero on"><div class="mp-logo">${plusSvg({ noShadow: true })}</div><h2>MN × is on</h2><p>${what}</p></div>
        ${stillCharging ? '<p class="card mp-note" role="status">Your MN × subscription is still active. Cancel it in Google Play so you aren’t charged again.</p>' : ''}
        <ul class="card mp-list">${featureRows()}</ul>
        <button class="pa-row card mp-video"><b>▶ What MN × adds</b><small>The 1-minute video</small></button>`;
      foot.innerHTML = sub
        ? `<div class="mp-two"><button class="btn ghost mp-change">Change plan</button><button class="btn ghost mp-manage">Manage subscription</button></div>`
        : stillCharging
          ? `<button class="btn mint mp-manage">Manage subscription</button>`
          : `<button class="btn mp-done">Done</button>`;
    };

    const paintShop = () => {
      const list = offers();
      const o = offer();
      if (o) chosen = o.plan;
      const card = (p: PlanOffer) => `<button class="mp-plan${p.plan === chosen ? ' on' : ''}" role="radio" aria-checked="${p.plan === chosen}" data-plan="${p.plan}">
          ${p.plan === 'yearly' && view !== 'change' ? '<em>Best value</em>' : p.plan === 'lifetime' ? '<em>Pay once</em>' : ''}
          <small>${PLAN_NAME[p.plan]}</small><b>${esc(p.price)}</b><span>${p.plan === 'lifetime' ? 'once, for good' : esc(p.per)}</span>
          ${p.monthly ? `<i>${esc(p.monthly)}</i>` : p.trialDays && !switching(p) ? `<i>${p.trialDays} days free</i>` : p.plan === 'lifetime' ? '<i>No renewals</i>' : ''}</button>`;
      const pending = read().via === 'pending';
      const signedIn = !!account(app);
      const more = signedInTrialDays();
      const now = offeredTrialDays(app);
      const plans =
        prices === 'ready' && list.length
          ? `<div class="mp-plans" role="radiogroup" aria-label="Choose a plan" style="--n:${list.length}">${list.map(card).join('')}</div>${o ? `<p class="mp-fine">${esc(fine(o))}</p>` : ''}`
          : prices === 'loading'
            ? '<p class="card mp-note mp-loading" role="status">Getting prices from Google Play…</p>'
            : '<div class="card mp-note mp-noprice" role="status"><p>Prices aren’t available right now. Check the internet connection, then try again.</p><button class="btn ghost small mp-retry">Try again</button></div>';
      body.innerHTML = `
        ${view === 'change'
          ? `<div class="mp-hero on"><div class="mp-logo">${plusSvg({ noShadow: true })}</div><h2>Change plan</h2><p>You’re on the ${read().via === 'yearly' ? 'yearly' : read().via === 'monthly' ? 'monthly' : 'current'} plan. Pick another one below.</p></div>`
          : `<div class="mp-hero"><div class="mp-logo">${plusSvg({ noShadow: true })}</div><h2>See the whole picture</h2><p>Everything your child plays with is free. MN × is for you.</p></div>
        <ul class="card mp-list">${featureRows()}</ul>
        <button class="pa-row card mp-video"><b>▶ What MN × adds</b><small>The 1-minute video</small></button>`}
        ${pending ? '<p class="card mp-note" role="status">⏳ A payment is on its way. MN × turns on as soon as Google Play confirms it.</p>' : ''}
        ${plans}
        ${view === 'shop' && !signedIn && cloudOn(app) && more > now ? `<div class="card mp-signin"><p><b>Get ${more} days free${now ? ` instead of ${now}` : ''}</b><small>Sign in with Google first. Your family’s progress gets an online backup too.</small></p><button class="btn ghost small mp-g">Sign in with Google</button></div>` : ''}
        ${view === 'shop' ? '<button class="linkish mp-restore">Already bought MN ×? Restore it</button>' : ''}`;
      const can = prices === 'ready' && !!o && !busy;
      foot.innerHTML = `${view === 'change' ? '<button class="btn ghost small mp-cancel-change">Keep my plan</button>' : ''}<button class="btn mint mp-buy"${can ? '' : ' disabled'}>${o && prices === 'ready' ? esc(ctaText(o)) : prices === 'loading' ? 'Getting prices…' : 'Not available right now'}</button>`;
    };

    const paint = () => {
      const st = plusState(app);
      el.classList.toggle('owned', st === 'on' && view === 'shop');
      if (st === 'checking') return paintChecking();
      if (st === 'on' && view === 'shop') return paintOwned();
      if (st !== 'on') view = 'shop';
      return paintShop();
    };

    const buy = async () => {
      const b = billing(app);
      const o = offer();
      if (!b || prices !== 'ready' || !o) {
        app.toast('Google Play isn’t reachable right now. Check the internet connection and try again.', 5000);
        return;
      }
      const s = read();
      const change = switching(o);
      if (change && !s.subToken) {
        app.toast('Google Play hasn’t shown this subscription on this phone yet. Tap “Restore it”, then try again.', 5000);
        return;
      }
      busy = true;
      paint();
      try {
        if (o.plan !== 'lifetime' && !(change && o.plan === 'monthly')) localStorage.setItem(LAST_PLAN, o.plan);
        else if (!change && o.plan === 'lifetime') localStorage.setItem(LAST_PLAN, '');
      } catch {
        /* fine */
      }
      const r = await b.buy(o.product, change ? o.baseToken : o.token, { account: await accountId(app), ...(change ? { oldToken: s.subToken, mode: replacementMode(o.plan as 'monthly' | 'yearly') } : {}) });
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
      } else if (t.closest('.mp-manage')) await manage(app);
      else if (t.closest('.mp-change')) {
        view = 'change';
        chosen = read().via === 'yearly' ? 'monthly' : 'yearly';
        paint();
        if (prices !== 'ready') void load();
      } else if (t.closest('.mp-cancel-change')) {
        view = 'shop';
        paint();
      } else if (t.closest('.mp-retry')) {
        prices = 'loading';
        paint();
        void load();
      } else if (t.closest('.mp-done')) void app.show(back);
      else if (t.closest('.mp-g')) {
        const r = await signIn(app);
        await load();
        const d = offeredTrialDays(app);
        if (r === 'approved') app.toast(d ? `Signed in. Your free trial is ${d} days.` : 'Signed in.', 5000);
      }
    });
    el.querySelector('.back-btn')!.addEventListener('click', () => void (view === 'change' ? ((view = 'shop'), paint()) : app.show(back)));

    const load = async () => {
      const p = await loadPlans(app);
      prices = p && plansNow(app).length ? 'ready' : 'none';
      paint();
    };
    const off = onPlusChange(() => {
      view = 'shop';
      paint();
    });
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

// #unless play
// ── the owner's Play Store preview (on the app shared by link) ──────────────

const PREVIEW = 'studyhard.storepreview';
export const previewOn = (): boolean => lsGet(PREVIEW) === '1';

/** Owner area card: switch this phone to act like the Play build, with test purchases. */
export function previewCard(app: App, repaint: () => void): HTMLElement {
  const on = previewOn();
  const el = html(`<div class="card ow-card mp-preview">
    <h2>Play Store preview</h2>
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
// #end
