package com.studyhard.app;

import android.app.Activity;
import android.content.Context;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MN Plus purchases through Google Play Billing: the products and their offers (prices come
 * from Play, in the phone's own currency), buying, what the account already owns, and
 * acknowledging new purchases. The web side (src/platform/billing.ts) decides what Plus
 * unlocks; this only talks to Play.
 */
class Billing {
    interface Listener {
        void onPurchases(JSObject result);
    }

    interface Done {
        void done(JSObject result);
    }

    private final Context context;
    private final Listener listener;
    private BillingClient client;
    private boolean ready = false;
    private final List<Runnable> waiting = new ArrayList<>();
    private final Map<String, ProductDetails> details = new HashMap<>();

    Billing(Context context, Listener listener) {
        this.context = context.getApplicationContext();
        this.listener = listener;
    }

    /** Run once connected to Play (connects, or reconnects, as needed). */
    private void whenReady(Runnable r, Done fail) {
        if (client != null && ready && client.isReady()) {
            r.run();
            return;
        }
        waiting.add(r);
        if (client == null) {
            client = BillingClient.newBuilder(context)
                .setListener((result, purchases) -> listener.onPurchases(purchasesResult(result, purchases)))
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        if (waiting.size() > 1) return; // already connecting
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                List<Runnable> run = new ArrayList<>(waiting);
                waiting.clear();
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    ready = true;
                    for (Runnable x : run) x.run();
                } else {
                    ready = false;
                    JSObject r = error(result);
                    fail.done(r);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                ready = false;
            }
        });
    }

    private static JSObject error(BillingResult result) {
        JSObject r = new JSObject();
        r.put("ok", false);
        r.put("code", result.getResponseCode());
        r.put("message", result.getDebugMessage());
        return r;
    }

    /** The products and every offer they have (base plans, trials, offer tags, prices). */
    void products(List<String> subs, List<String> inapp, Done done) {
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
                client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (BillingResult result, QueryProductDetailsResult found) -> {
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

    /** Open Play's purchase sheet. The outcome arrives through the listener ("purchases"). */
    void buy(Activity activity, String productId, String offerToken, Done done) {
        whenReady(() -> {
            ProductDetails pd = details.get(productId);
            JSObject r = new JSObject();
            if (pd == null) {
                r.put("ok", false);
                r.put("message", "Product not loaded");
                done.done(r);
                return;
            }
            BillingFlowParams.ProductDetailsParams.Builder b = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);
            if (offerToken != null && !offerToken.isEmpty()) b.setOfferToken(offerToken);
            List<BillingFlowParams.ProductDetailsParams> list = new ArrayList<>();
            list.add(b.build());
            BillingFlowParams params = BillingFlowParams.newBuilder().setProductDetailsParamsList(list).build();
            activity.runOnUiThread(() -> {
                BillingResult res = client.launchBillingFlow(activity, params);
                JSObject out = res.getResponseCode() == BillingClient.BillingResponseCode.OK ? new JSObject() : error(res);
                if (!out.has("ok")) out.put("ok", true);
                done.done(out);
            });
        }, done);
    }

    /** Everything this Play account owns now (subscriptions and the lifetime product). */
    void owned(Done done) {
        whenReady(() -> {
            JSArray all = new JSArray();
            final int[] left = { 2 };
            final boolean[] failed = { false };
            for (String type : new String[] { BillingClient.ProductType.SUBS, BillingClient.ProductType.INAPP }) {
                client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build(), (result, list) -> {
                    synchronized (all) {
                        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) failed[0] = true;
                        if (list != null) for (Purchase p : list) all.put(purchase(p));
                        if (--left[0] == 0) {
                            JSObject r = new JSObject();
                            r.put("ok", !failed[0]);
                            r.put("purchases", all);
                            done.done(r);
                        }
                    }
                });
            }
        }, done);
    }

    /** Tell Play a purchase was received (it is refunded after 3 days otherwise). */
    void acknowledge(String token, Done done) {
        whenReady(() -> client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), result -> {
            JSObject r = new JSObject();
            r.put("ok", result.getResponseCode() == BillingClient.BillingResponseCode.OK);
            r.put("code", result.getResponseCode());
            done.done(r);
        }), done);
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
        x.put("json", p.getOriginalJson());
        x.put("signature", p.getSignature());
        return x;
    }

    private static JSObject purchasesResult(BillingResult result, List<Purchase> purchases) {
        JSObject r = new JSObject();
        int code = result.getResponseCode();
        r.put("ok", code == BillingClient.BillingResponseCode.OK);
        r.put("code", code);
        r.put("cancelled", code == BillingClient.BillingResponseCode.USER_CANCELED);
        JSArray list = new JSArray();
        if (purchases != null) for (Purchase p : purchases) list.put(purchase(p));
        r.put("purchases", list);
        return r;
    }
}
