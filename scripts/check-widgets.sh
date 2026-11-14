#!/usr/bin/env bash
# Checks the jar widget's maths in native/android/java/.../Widgets.java without the Android SDK:
# lifts its two pure methods (days, jarPercent) into a small class and runs the review's numbers
# (the treat costs 480, the jar holds 300, the last play was 5 days ago).
set -eo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
src="${1:-$root/native/android/java/com/studyhard/app/Widgets.java}"
python3 - "$src" "$work/W.java" <<'PY'
import re, sys
s = open(sys.argv[1]).read()
def method(name):
    i = s.index('static ' + name)
    depth = 0; j = s.index('{', i)
    for k in range(j, len(s)):
        depth += s[k] == '{'; depth -= s[k] == '}'
        if depth == 0: return s[i:k + 1]
body = method('long days(')
try: body += '\n' + method('int jarPercent(')
except ValueError:
    # The old widget had the maths inline: the same lines, as they were.
    body += '''
static int jarPercent(double coins, double cost, double base, double rate, String meltFrom, String last, String today, boolean still) {
    long since = last.isEmpty() ? -1 : days(last, today);
    long missed = since < 0 ? 0 : Math.max(0, since - 1);
    double now = still ? coins : Math.max(0, coins - missed * rate * base);
    return (int) Math.min(100, Math.floor(100 * now / cost));
}'''
open(sys.argv[2], 'w').write('''import java.text.SimpleDateFormat; import java.util.*;
public class W {
''' + body + '''
  static void eq(int got, int want, String what) { if (got != want) throw new AssertionError(what + ": " + got + "%, expected " + want + "%"); System.out.println("ok - " + what + ": " + got + "%"); }
  public static void main(String[] a) {
    // Before the app opens: coins 300, counted from the last play (5 days ago).
    eq(jarPercent(300, 480, 480, 0.05, "", "2026-11-05", "2026-11-10", false), 42, "before the app opens (old data, no meltFrom)");
    // The app opened and applied the melting: coins 204, meltFrom = yesterday.
    eq(jarPercent(204, 480, 480, 0.05, "2026-11-09", "2026-11-05", "2026-11-10", false), 42, "after the app applied the melting");
    eq(jarPercent(204, 480, 480, 0.05, "2026-11-09", "2026-11-05", "2026-11-11", false), 37, "the next day, app not opened");
    eq(jarPercent(204, 480, 480, 0.05, "2026-11-09", "2026-11-05", "2026-11-11", true), 42, "a waiting reward or a holiday: nothing melts");
    eq(jarPercent(300, 480, 480, 0.05, "", "", "2026-11-11", false), 62, "never played: nothing melts");
  }
}''')
PY
javac -nowarn -d "$work" "$work/W.java" 2>&1 | grep -v 'JAVA_TOOL_OPTIONS\|^Note:' || true
java -cp "$work" W 2>&1 | grep -v JAVA_TOOL_OPTIONS
