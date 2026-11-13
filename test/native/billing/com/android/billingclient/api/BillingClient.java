package com.android.billingclient.api;
public abstract class BillingClient {
  public static final class ProductType { public static final String SUBS="subs", INAPP="inapp"; }
  public static final class BillingResponseCode { public static final int OK=0, USER_CANCELED=1, ITEM_UNAVAILABLE=4; }
  public static Builder newBuilder(android.content.Context c){ return new Builder(); }
  public static class Builder { public Builder setListener(PurchasesUpdatedListener l){return this;} public Builder enablePendingPurchases(PendingPurchasesParams p){return this;} public Builder enableAutoServiceReconnection(){return this;} public BillingClient build(){return new FakeClient();} }
  public abstract boolean isReady();
  public abstract void startConnection(BillingClientStateListener l);
  public abstract void queryProductDetailsAsync(QueryProductDetailsParams p, ProductDetailsResponseListener l);
  public abstract void queryPurchasesAsync(QueryPurchasesParams p, PurchasesResponseListener l);
  public abstract void acknowledgePurchase(AcknowledgePurchaseParams p, AcknowledgePurchaseResponseListener l);
  public abstract BillingResult launchBillingFlow(android.app.Activity a, BillingFlowParams p);
}
