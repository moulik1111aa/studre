package com.android.billingclient.api;
public class FakeClient extends BillingClient {
  public static String mode = "fail"; public static int starts = 0;
  public boolean isReady(){ return false; }
  public void startConnection(BillingClientStateListener l){ starts++; if (mode.equals("fail")) new Thread(() -> { try { Thread.sleep(200); } catch (Exception e) {} l.onBillingSetupFinished(new BillingResult(){ public int getResponseCode(){return 3;} public String getDebugMessage(){return "BILLING_UNAVAILABLE";} }); }).start(); }
  public void queryProductDetailsAsync(QueryProductDetailsParams p, ProductDetailsResponseListener l){}
  public void queryPurchasesAsync(QueryPurchasesParams p, PurchasesResponseListener l){}
  public void acknowledgePurchase(AcknowledgePurchaseParams p, AcknowledgePurchaseResponseListener l){}
  public BillingResult launchBillingFlow(android.app.Activity a, BillingFlowParams p){ return new BillingResult(); }
}
