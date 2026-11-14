package android.net;
/** Stand-in for android.net.Uri: scheme and authority of "scheme://authority/path". */
public class Uri {
    private final String s;
    private Uri(String s) { this.s = s; }
    public static Uri parse(String s) { return new Uri(s); }
    public String getScheme() { int i = s.indexOf(':'); return i < 0 ? null : s.substring(0, i); }
    public String getAuthority() { int i = s.indexOf("://"); if (i < 0) return null; String r = s.substring(i + 3); int j = r.indexOf('/'); return j < 0 ? r : r.substring(0, j); }
    public String getLastPathSegment() { return s.substring(s.lastIndexOf('/') + 1); }
    public String toString() { return s; }
}
