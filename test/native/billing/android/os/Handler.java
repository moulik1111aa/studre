package android.os;
public class Handler { private static final java.util.Map<Runnable, java.util.TimerTask> t = new java.util.concurrent.ConcurrentHashMap<>(); private static final java.util.Timer timer = new java.util.Timer(true);
 public Handler(Looper l){}
 public boolean postDelayed(Runnable r,long ms){ java.util.TimerTask k = new java.util.TimerTask(){ public void run(){ t.remove(r); r.run(); } }; t.put(r,k); timer.schedule(k, ms); return true; }
 public void removeCallbacks(Runnable r){ java.util.TimerTask k = t.remove(r); if (k != null) k.cancel(); } }
