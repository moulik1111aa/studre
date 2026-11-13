package com.studyhard.app;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * MN × purchases through Google Play Billing: the products and their offers (prices come
 * from Play, in the phone's own currency), buying and changing plan, what the account already
 * owns, and acknowledging new purchases. The web side (src/platform/billing.ts) decides what
 * MN × unlocks; this only talks to Play.
 *
 * Every call is answered exactly once: with Play's answer, or with an error after TIMEOUT_MS
 * (Play unreachable, the connection never finishing). Only purchases whose signature matches
 * the app's Play licensing key (PlayKey.LICENSE, written at build time) are reported.
 */
class Billing {
    interface Listener {
        void onPurchases(JSObject result);
    }

    interface Done {
        void done(JSObject result);
    }

    /** How long a call may wait for Play before it is answered with an error. */
    static final long TIMEOUT_MS = 15_000;
    /** The error code a timed-out call reports (Play's own SERVICE_TIMEOUT). */
    private static final int TIMED_OUT = -3;

    private final Context context;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    /** Guards client, ready, connecting, attempt and waiting (used from the plugin's thread and Play's callbacks). */
    private final Object lock = new Object();
    private BillingClient client;
    private boolean ready = false;
    private boolean connecting = false;
    private int attempt = 0;
    private final List<Waiting> waiting = new ArrayList<>();
    private final Map<String, ProductDetails> details = new ConcurrentHashMap<>();

    private static final class Waiting {
        final Runnable run;
        final Done fail;

        Waiting(Runnable run, Done fail) {
            this.run = run;
            this.fail = fail;
        }
    }

    Billing(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    /** `d`, answered once: the first result wins; after TIMEOUT_MS, an error. */
    private Done once(Done d) {
        AtomicBoolean answered = new AtomicBoolean(false);
        Runnable late = () -> {
            if (answered.compareAndSet(false, true)) d.done(error(TIMED_OUT, "Google Play didn't answer in time"));
        };
        main.postDelayed(late, TIMEOUT_MS);
        return (r) -> {
            if (answered.compareAndSet(false, true)) {
                main.removeCallbacks(late);
                d.done(r);
            }
        };
    }

    /** Run once connected to Play (connects, or reconnects, as needed). */
    private void whenReady(Runnable r, Done fail) {
        final BillingClient c;
        final int mine;
        synchronized (lock) {
            if (client != null && ready && client.isReady()) {
                c = null;
                mine = 0;
            } else {
                waiting.add(new Waiting(r, fail));
                if (client == null) {
                    client = BillingClient.newBuilder(context)
                        .setListener((result, purchases) -> listener.onPurchases(purchasesResult(result, purchases)))
                        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                        .enableAutoServiceReconnection()
                        .build();
                }
                if (connecting) return;
                connecting = true;
                c = client;
                mine = ++attempt;
            }
        }
        if (c == null) {
            r.run();
            return;
        }
        // A connection that never finishes answers everyone waiting, and lets the next call try again.
        main.postDelayed(() -> finish(mine, null), TIMEOUT_MS);
        c.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                finish(mine, result);
            }

            @Override
            public void onBillingServiceDisconnected() {
                synchronized (lock) {
                    ready = false;
                }
                finish(mine, null);
            }
        });
    }

    /** The end of connection attempt `which`: run (or fail) every call that was waiting for it. */
    private void finish(int which, BillingResult result) {
        List<Waiting> run;
        boolean ok = result != null && result.getResponseCode() == BillingClient.BillingResponseCode.OK;
        synchronized (lock) {
            if (which != attempt || !connecting) return;
            connecting = false;
            ready = ok;
            run = new ArrayList<>(waiting);
            waiting.clear();
        }
        JSObject err = result == null ? error(TIMED_OUT, "Google Play isn't reachable") : error(result);
        for (Waiting w : run) {
            if (ok) w.run.run();
            else w.fail.done(err);
        }
    }

    private static JSObject error(BillingResult result) {
        return error(result.getResponseCode(), result.getDebugMessage());
    }

    private static JSObject error(int code, String message) {
        JSObject r = new JSObject();
        r.put("ok", false);
        r.put("code", code);
        r.put("message", message);
        return r;
    }

    private BillingClient client() {
        synchronized (lock) {
            return client;
        }
    }

    /** The products and every offer they have (base plans, trials, offer tags, prices). */
    void products(List<String> subs, List<String> inapp, Done answer) {
        Done done = once(answer);
        whenReady(() -> {
            JSArray out = new JSArray();
            final int[] left = { (subs.isEmpty() ? 0 : 1) + (inapp.isEmpty() ? 0 : 1) };
            if (left[0] == 0) {
                JSObject r = new JSObject();
                r.put("ok", true);
                r.put("products", out);
                done.done(r);
                return;
            }
            final boolean[] failed = { false };
            for (int t = 0; t < 2; t++) {
                List<String> ids = t == 0 ? subs : inapp;
                if (ids.isEmpty()) continue;
                String type = t == 0 ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP;
                List<QueryProductDetailsParams.Product> list = new ArrayList<>();
                for (String id : ids) list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build());
                client().queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (BillingResult result, QueryProductDetailsResult found) -> {
                    synchronized (out) {
                        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) failed[0] = true;
                        if (found != null) for (ProductDetails pd : found.getProductDetailsList()) {
                            details.put(pd.getProductId(), pd);
                            out.put(describe(pd));
                        }
                        if (--left[0] == 0) {
                            JSObject r = failed[0] && out.length() == 0 ? error(result) : new JSObject();
                            if (!r.has("ok")) r.put("ok", true);
                            r.put("products", out);
                            done.done(r);
                        }
                    }
                });
            }
        }, done);
    }

    private static JSObject describe(ProductDetails pd) {
        JSObject p = new JSObject();
        p.put("id", pd.getProductId());
        p.put("type", pd.getProductType());
        p.put("name", pd.getName());
        ProductDetails.OneTimePurchaseOfferDetails one = pd.getOneTimePurchaseOfferDetails();
        if (one != null) {
            p.put("price", one.getFormattedPrice());
            p.put("micros", one.getPriceAmountMicros());
            p.put("currency", one.getPriceCurrencyCode());
        }
        List<ProductDetails.SubscriptionOfferDetails> subs = pd.getSubscriptionOfferDetails();
        if (subs != null) {
            JSArray offers = new JSArray();
            for (ProductDetails.SubscriptionOfferDetails o : subs) {
                JSObject x = new JSObject();
                x.put("basePlan", o.getBasePlanId());
                x.put("offer", o.getOfferId());
                x.put("token", o.getOfferToken());
                JSArray tags = new JSArray();
                for (String tag : o.getOfferTags()) tags.put(tag);
                x.put("tags", tags);
                JSArray phases = new JSArray();
                for (ProductDetails.PricingPhase ph : o.getPricingPhases().getPricingPhaseList()) {
                    JSObject f = new JSObject();
                    f.put("price", ph.getFormattedPrice());
                    f.put("micros", ph.getPriceAmountMicros());
                    f.put("currency", ph.getPriceCurrencyCode());
                    f.put("period", ph.getBillingPeriod());
                    f.put("cycles", ph.getBillingCycleCount());
                    phases.put(f);
                }
                x.put("phases", phases);
                offers.put(x);
            }
            p.put("offers", offers);
        }
        return p;
    }

    /**
     * Open Play's purchase sheet. The outcome arrives through the listener ("purchases").
     * `oldToken`: the subscription being replaced (a change of plan), with Play's replacement
     * mode. `account`: an obfuscated id for the signed-in family (a hash, never the email).
     */
    void buy(Activity activity, String productId, String offerToken, String oldToken, int replacementMode, String account, Done answer) {
        Done done = once(answer);
        whenReady(() -> {
            ProductDetails pd = details.get(productId);
            if (pd == null) {
                done.done(error(BillingClient.BillingResponseCode.ITEM_UNAVAILABLE, "Product not loaded"));
                return;
            }
            BillingFlowParams.ProductDetailsParams.Builder b = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);
            if (offerToken != null && !offerToken.isEmpty()) b.setOfferToken(offerToken);
            List<BillingFlowParams.ProductDetailsParams> list = new ArrayList<>();
            list.add(b.build());
            BillingFlowParams.Builder fb = BillingFlowParams.newBuilder().setProductDetailsParamsList(list);
            if (account != null && !account.isEmpty()) fb.setObfuscatedAccountId(account);
            if (oldToken != null && !oldToken.isEmpty()) {
                fb.setSubscriptionUpdateParams(BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                    .setOldPurchaseToken(oldToken)
                    .setSubscriptionReplacementMode(replacementMode)
                    .build());
            }
            BillingFlowParams params = fb.build();
            activity.runOnUiThread(() -> {
                BillingResult res = client().launchBillingFlow(activity, params);
                JSObject out = res.getResponseCode() == BillingClient.BillingResponseCode.OK ? new JSObject() : error(res);
                if (!out.has("ok")) out.put("ok", true);
                done.done(out);
            });
        }, done);
    }

    /** Everything this Play account owns now (subscriptions and the lifetime product), verified. */
    void owned(Done answer) {
        Done done = once(answer);
        whenReady(() -> {
            JSArray all = new JSArray();
            final int[] left = { 2 };
            final int[] rejected = { 0 };
            final boolean[] failed = { false };
            for (String type : new String[] { BillingClient.ProductType.SUBS, BillingClient.ProductType.INAPP }) {
                client().queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build(), (result, list) -> {
                    synchronized (all) {
                        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) failed[0] = true;
                        if (list != null) for (Purchase p : list) {
                            if (verified(p)) all.put(purchase(p));
                            else rejected[0]++;
                        }
                        if (--left[0] == 0) {
                            JSObject r = new JSObject();
                            r.put("ok", !failed[0]);
                            r.put("purchases", all);
                            r.put("unverified", rejected[0]);
                            done.done(r);
                        }
                    }
                });
            }
        }, done);
    }

    /** Tell Play a purchase was received (it is refunded after 3 days otherwise). */
    void acknowledge(String token, Done answer) {
        Done done = once(answer);
        whenReady(() -> client().acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), result -> {
            JSObject r = new JSObject();
            r.put("ok", result.getResponseCode() == BillingClient.BillingResponseCode.OK);
            r.put("code", result.getResponseCode());
            done.done(r);
        }), done);
    }

    /**
     * Whether Play signed this purchase: its JSON checked against the app's Play licensing key
     * (Play Console → Monetisation setup), the usual on-device check. With no key in the build,
     * nothing is verified, so nothing is unlocked.
     */
    static boolean verified(Purchase p) {
        return verify(PlayKey.LICENSE, p.getOriginalJson(), p.getSignature());
    }

    static boolean verify(String key, String json, String signature) {
        if (key == null || key.isEmpty() || json == null || signature == null || signature.isEmpty()) return false;
        try {
            PublicKey pk = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.decode(key, Base64.DEFAULT)));
            Signature s = Signature.getInstance("SHA1withRSA");
            s.initVerify(pk);
            s.update(json.getBytes(StandardCharsets.UTF_8));
            return s.verify(Base64.decode(signature, Base64.DEFAULT));
        } catch (Exception e) {
            return false;
        }
    }

    private static JSObject purchase(Purchase p) {
        JSObject x = new JSObject();
        JSArray products = new JSArray();
        for (String id : p.getProducts()) products.put(id);
        x.put("products", products);
        x.put("token", p.getPurchaseToken());
        x.put("state", p.getPurchaseState()); // 1 = purchased, 2 = pending
        x.put("acknowledged", p.isAcknowledged());
        x.put("autoRenewing", p.isAutoRenewing());
        x.put("time", p.getPurchaseTime());
        x.put("verified", true);
        return x;
    }

    private static JSObject purchasesResult(BillingResult result, List<Purchase> purchases) {
        JSObject r = new JSObject();
        int code = result.getResponseCode();
        r.put("ok", code == BillingClient.BillingResponseCode.OK);
        r.put("code", code);
        r.put("cancelled", code == BillingClient.BillingResponseCode.USER_CANCELED);
        JSArray list = new JSArray();
        int rejected = 0;
        if (purchases != null) for (Purchase p : purchases) {
            if (verified(p)) list.put(purchase(p));
            else rejected++;
        }
        r.put("purchases", list);
        r.put("unverified", rejected);
        return r;
    }
}
