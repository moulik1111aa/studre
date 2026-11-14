package android.content;
import java.util.HashMap;
import java.util.Map;
/** Stand-in for android.content.Intent: action, data, flags and extras. */
public class Intent {
    public static final String ACTION_SEND = "android.intent.action.SEND", ACTION_VIEW = "android.intent.action.VIEW", ACTION_MAIN = "android.intent.action.MAIN";
    public static final String EXTRA_STREAM = "android.intent.extra.STREAM", EXTRA_TEXT = "android.intent.extra.TEXT";
    public static final int FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY = 0x00100000;
    private String action; private android.net.Uri data; private int flags; private final Map<String, Object> extras = new HashMap<>();
    public Intent(String action) { this.action = action; }
    public String getAction() { return action; }
    public Intent setAction(String a) { action = a; return this; }
    public android.net.Uri getData() { return data; }
    public Intent setData(android.net.Uri d) { data = d; return this; }
    public int getFlags() { return flags; }
    public Intent addFlags(int f) { flags |= f; return this; }
    public Intent putExtra(String k, Object v) { extras.put(k, v); return this; }
    @SuppressWarnings("unchecked") public <T> T getParcelableExtra(String k) { return (T) extras.get(k); }
    public CharSequence getCharSequenceExtra(String k) { return (CharSequence) extras.get(k); }
    public void removeExtra(String k) { extras.remove(k); }
    public boolean hasExtra(String k) { return extras.containsKey(k); }
}
