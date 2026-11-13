package com.studyhard.app;
import com.getcapacitor.JSObject; import java.util.*; import java.util.concurrent.*;
public class ReadyTest { public static void main(String[] a) throws Exception {
  for (String mode : new String[] { "fail", "hang" }) {
    com.android.billingclient.api.FakeClient.mode = mode; com.android.billingclient.api.FakeClient.starts = 0;
    Billing b = new Billing(new android.content.Context(), r -> {});
    List<JSObject> got = Collections.synchronizedList(new ArrayList<>()); CountDownLatch done = new CountDownLatch(3);
    Map<String,Integer> answers = new ConcurrentHashMap<>();
    long t0 = System.currentTimeMillis();
    b.products(Arrays.asList("mn_plus"), Arrays.asList("mn_plus_lifetime"), r -> { answers.merge("products",1,Integer::sum); got.add(r); done.countDown(); });
    b.owned(r -> { answers.merge("owned",1,Integer::sum); got.add(r); done.countDown(); });
    b.acknowledge("tok", r -> { answers.merge("ack",1,Integer::sum); got.add(r); done.countDown(); });
    if (!done.await(20, TimeUnit.SECONDS)) throw new AssertionError(mode + ": a call was never answered " + answers);
    Thread.sleep(16_000 - Math.min(16_000, System.currentTimeMillis() - t0) + 500); // past every timeout: no second answers
    long secs = (System.currentTimeMillis() - t0) / 1000;
    for (JSObject r : got) if (!Boolean.FALSE.equals(r.get("ok"))) throw new AssertionError(mode + ": not an error " + r);
    if (answers.values().stream().anyMatch(n -> n != 1)) throw new AssertionError(mode + ": answered more than once " + answers);
    if (com.android.billingclient.api.FakeClient.starts != 1) throw new AssertionError(mode + ": connected " + com.android.billingclient.api.FakeClient.starts + " times");
    System.out.println("ok - Play " + mode + ": all 3 waiting calls answered once with an error (codes " + got.stream().map(r -> String.valueOf(r.get("code"))).reduce((x,y)->x+","+y).get() + "), one connection attempt");
    // After a failure, the next call tries to connect again (not stuck "connecting").
    CountDownLatch again = new CountDownLatch(1);
    b.owned(r -> again.countDown());
    if (!again.await(20, TimeUnit.SECONDS)) throw new AssertionError(mode + ": the next call hung");
    if (com.android.billingclient.api.FakeClient.starts != 2) throw new AssertionError(mode + ": did not try to connect again");
    System.out.println("ok - Play " + mode + ": the next call connects again and is answered");
  }
  System.exit(0);
} }
