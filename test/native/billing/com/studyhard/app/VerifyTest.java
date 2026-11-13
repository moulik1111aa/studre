package com.studyhard.app;
import java.security.*; import java.util.Base64;
public class VerifyTest { public static void main(String[] a) throws Exception {
  KeyPairGenerator g = KeyPairGenerator.getInstance("RSA"); g.initialize(2048); KeyPair kp = g.generateKeyPair();
  String key = Base64.getEncoder().encodeToString(kp.getPublic().getEncoded());
  String json = "{\"orderId\":\"GPA.1\",\"productId\":\"mn_plus\",\"purchaseToken\":\"tok\"}";
  Signature s = Signature.getInstance("SHA1withRSA"); s.initSign(kp.getPrivate()); s.update(json.getBytes("UTF-8"));
  String sig = Base64.getEncoder().encodeToString(s.sign());
  check(Billing.verify(key, json, sig), "a purchase Play signed is verified");
  check(!Billing.verify(key, json.replace("mn_plus", "mn_plus_lifetime"), sig), "an edited purchase is not");
  check(!Billing.verify("", json, sig), "no key: nothing is verified");
  check(!Billing.verify(key, json, ""), "no signature: not verified");
  KeyPair other = g.generateKeyPair();
  check(!Billing.verify(Base64.getEncoder().encodeToString(other.getPublic().getEncoded()), json, sig), "another app's key: not verified");
  check(!Billing.verify("not base64 !!", json, sig), "a broken key: not verified");
  System.out.println("all signature checks passed");
}
static void check(boolean ok, String what){ if(!ok) throw new AssertionError(what); System.out.println("ok - " + what); } }
