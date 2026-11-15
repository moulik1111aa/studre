#!/usr/bin/env bash
# The shrunk release APK on an emulator (review fix 10, run by .github/workflows/release-check.yml):
# install, launch, let the opening film play, tap "Let's set up", and reach the lock screen,
# which shows this phone's code from the native plugin (so Capacitor and MN's plugin methods
# survived R8). Optionally turn the screen sideways (tablets). Fails on a crash, a JavaScript
# error or a missing plugin method in the log.
# Usage: scripts/release-smoke.sh app.apk out-dir [sideways]
set -u
APK=$1
OUT=$2
SIDEWAYS=${3:-}
PKG=com.studyhard.app
mkdir -p "$OUT"
FAILS=()
STEP=0
note() { echo "[release] $*" | tee -a "$OUT/steps.txt"; }
fail() { note "FAIL: $*"; FAILS+=("$*"); }
shot() { STEP=$((STEP + 1)); adb exec-out screencap -p > "$OUT/$(printf %02d $STEP)-$1.png"; }
ui() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb exec-out cat /sdcard/ui.xml 2>/dev/null; }
find_node() {
  ui | python3 -c '
import sys, re, html
want = sys.argv[1]
for m in re.finditer(r"<node [^>]*>", sys.stdin.read()):
    n = m.group(0)
    parts = [html.unescape(p) for p in re.findall(r"(?:text|content-desc)=\"([^\"]*)\"", n)]
    b = re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", n)
    if want in " ".join(parts) and b:
        x1, y1, x2, y2 = map(int, b.groups())
        if x2 > x1 and y2 > y1:
            print((x1 + x2) // 2, (y1 + y2) // 2); break
' "$1"
}
wait_for() {
  local t=0
  while [ $t -lt "${2:-30}" ]; do
    [ -n "$(find_node "$1")" ] && return 0
    # Android's "Viewing full screen" tip covers the app the first time.
    xy=$(find_node "Got it"); [ -n "$xy" ] && { adb shell input tap $xy; note "closed the full-screen tip"; }
    [ $((t % 30)) -eq 0 ] && { note "waiting for \"$1\" (${t}s): pid $(adb shell pidof $PKG | tr -d '\r'), top: $(adb shell dumpsys activity activities | grep -m1 -E 'topResumedActivity|mResumedActivity' | tr -d '\r' | sed 's/^ *//')"; shot "wait-$t"; }
    sleep 2; t=$((t + 2))
  done
  return 1
}
screen_text() {
  ui | python3 -c '
import sys, re, html
print(" | ".join(html.unescape(t) for t in re.findall(r"(?:text|content-desc)=\"([^\"]+)\"", sys.stdin.read()))[:600])'
}
tap_text() {
  local xy; xy=$(find_node "$1")
  if [ -z "$xy" ]; then fail "could not find \"$1\" to tap"; return 1; fi
  adb shell input tap $xy
}

sleep 15
adb shell settings put global hide_error_dialogs 1
note "device: $(adb shell getprop ro.product.model | tr -d '\r'), Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r')), $(adb shell wm size | tr -d '\r')"
adb install -r "$APK" | tee -a "$OUT/steps.txt" || { fail "install failed"; exit 1; }
adb logcat -c
if [ -n "$SIDEWAYS" ]; then
  adb shell settings put system accelerometer_rotation 0
  adb shell settings put system user_rotation 1
  note "screen turned sideways"
fi
adb shell am start -W -n $PKG/.MainActivity | tee -a "$OUT/steps.txt"
sleep 5; shot launch
note "after launch: pid $(adb shell pidof $PKG | tr -d '\r'); on screen: $(screen_text)"
# The opening film (about a minute) ends on "Let's set up" at the bottom, in the middle. The
# WebView's words aren't always visible to uiautomator, so its end is also read from MN's log
# (the film saves that it has been seen) and the button is tapped where it sits.
film_seen() { adb logcat -d | grep -q "methodName: writeSave"; }
t=0; while [ $t -lt 150 ] && ! film_seen && [ -z "$(find_node "set up")" ]; do sleep 3; t=$((t + 3)); xy=$(find_node "Got it"); [ -n "$xy" ] && adb shell input tap $xy; done
if film_seen || [ -n "$(find_node "set up")" ]; then
  note "opening film finished (${t}s)"; sleep 3; shot film-end
  xy=$(find_node "set up")
  if [ -z "$xy" ]; then
    size=$(adb exec-out screencap -p | python3 -c 'import sys,struct; d=sys.stdin.buffer.read(24); print(*struct.unpack(">II", d[16:24]))')
    set -- $size; xy="$(( $1 / 2 )) $(( $2 * 93 / 100 ))"
  fi
  adb shell input tap $xy; note "tapped Let's set up at $xy"
else
  fail "the opening film did not finish"; shot film-stuck
fi
# The lock screen asks the native plugin for this phone's code.
t=0; while [ $t -lt 40 ] && ! adb logcat -d | grep -q "methodName: deviceId"; do sleep 2; t=$((t + 2)); done
if adb logcat -d | grep -q "methodName: deviceId"; then note "the lock screen asked the native plugin for the phone code"; else fail "the lock screen didn't ask for the phone code"; fi
sleep 4
if wait_for "Your phone code" 10; then note "lock screen shows the phone code"; else note "(the lock screen's words aren't visible to uiautomator: see the screenshot)"; fi
sleep 2; shot lock
[ -n "$(adb shell pidof $PKG | tr -d '\r')" ] && note "process alive" || fail "process died"

# The app's own log lines only (other apps on the emulator log missing classes too).
PID=$(adb shell pidof $PKG | tr -d '\r')
adb logcat -d > "$OUT/logcat-full.txt"
if [ -n "$PID" ]; then adb logcat -d --pid="$PID" > "$OUT/logcat-app.txt"; else grep -E "$PKG|AndroidRuntime" "$OUT/logcat-full.txt" > "$OUT/logcat-app.txt"; fi
grep -E "AndroidRuntime|Capacitor|chromium|StudyHard|System.err|ClassNotFound|NoSuchMethod" "$OUT/logcat-app.txt" | tail -n 300 > "$OUT/logcat.txt"
if grep -A12 "FATAL EXCEPTION" "$OUT/logcat-full.txt" | grep -q "$PKG"; then fail "app crashed (FATAL EXCEPTION)"; grep -A20 "FATAL EXCEPTION" "$OUT/logcat-full.txt" | head -40; fi
if grep -E "ClassNotFoundException|NoSuchMethodException|NoSuchFieldException" "$OUT/logcat-app.txt" > "$OUT/missing.txt"; then
  fail "a class or method is missing (R8 removed something used by name)"; head -20 "$OUT/missing.txt"
fi
if grep -E "is not implemented on android|No such method|Unable to find method" "$OUT/logcat-app.txt"; then fail "a Capacitor plugin method is missing"; fi
if grep -E "Capacitor/Console.*(Uncaught|TypeError|ReferenceError)" "$OUT/logcat-app.txt" | grep -v "Error injecting safe area CSS" > "$OUT/js-errors.txt"; then fail "JavaScript errors in the console"; head -20 "$OUT/js-errors.txt"; fi
echo "── MN in the system log ──"
grep -E "FATAL|Process: $PKG|Caused by|E AndroidRuntime|ActivityManager.*$PKG|ActivityTaskManager.*$PKG|libc.*$PKG|DEBUG.*(signal|Abort|backtrace)|chromium.*(CONSOLE|ERROR)|Capacitor" "$OUT/logcat-full.txt" | grep -v uiautomator | head -n 120
rm -f "$OUT/logcat-full.txt"

if [ ${#FAILS[@]} -gt 0 ]; then
  note "${#FAILS[@]} problem(s): ${FAILS[*]}"
  exit 1
fi
note "all release checks passed"
