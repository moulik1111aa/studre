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
timeout 300 adb install -r "$APK" | tee -a "$OUT/steps.txt" || { fail "install failed"; exit 1; }
note "installed"
timeout 30 adb logcat -c || note "(couldn't clear the log)"
WV=$(timeout 20 adb shell dumpsys package com.google.android.webview | grep -m1 versionName | tr -d '\r' | sed 's/^ *versionName=//')
note "WebView: $WV"
# MN's code needs a WebView from about 2020 on (Chrome 80+). Android 7 phones get one from the
# Play Store; this emulator image has an older one, where MN shows how to update it instead.
OLD_WEBVIEW=""; [ "${WV%%.*}" -lt 80 ] 2>/dev/null && OLD_WEBVIEW=1
shot_size() { adb exec-out screencap -p | python3 -c 'import sys,struct; d=sys.stdin.buffer.read(24); print(*struct.unpack(">II", d[16:24]))'; }
if [ -n "$SIDEWAYS" ]; then
  # Wider than tall, whichever way the device holds itself naturally (a tablet: already sideways).
  adb shell settings put system accelerometer_rotation 0
  for r in 0 1; do
    adb shell settings put system user_rotation $r; sleep 2
    set -- $(shot_size); [ "$1" -gt "$2" ] && break
  done
  set -- $(shot_size); note "screen sideways: ${1}×${2}"; [ "$1" -gt "$2" ] || fail "couldn't turn the screen sideways"
fi
timeout 90 adb shell am start -W -n $PKG/.MainActivity | tee -a "$OUT/steps.txt" || note "(the launch didn't report back within 90 s)"
sleep 5; shot launch
note "after launch: pid $(adb shell pidof $PKG | tr -d '\r'); on screen: $(screen_text)"
if [ -n "$OLD_WEBVIEW" ]; then
  if wait_for "Android System WebView" 40; then note "old WebView: MN shows how to update it"; else fail "old WebView: no note on how to update it"; fi
  shot old-webview
else
# The opening film ends on "Let's set up" at the bottom, in the middle. The WebView's words
# aren't always visible to uiautomator, so the button is tapped where it sits, every few seconds
# until the lock screen asks the native plugin for this phone's code.
asked() { adb logcat -d | grep -q "methodName: deviceId"; }
t=0
while [ $t -lt 180 ] && ! asked; do
  xy=$(find_node "Got it"); [ -n "$xy" ] && adb shell input tap $xy
  xy=$(find_node "set up")
  if [ -z "$xy" ]; then set -- $(shot_size); xy="$(( $1 / 2 )) $(( $2 * 93 / 100 ))"; fi
  [ $t -ge 10 ] && adb shell input tap $xy
  sleep 6; t=$((t + 6))
done
if asked; then note "after the film (${t}s), the lock screen asked the native plugin for the phone code"; else fail "the lock screen didn't ask for the phone code"; shot stuck; fi
sleep 4
if wait_for "Your phone code" 10; then note "lock screen shows the phone code"; else note "(the lock screen's words aren't visible to uiautomator: see the screenshot)"; fi
fi
sleep 2; shot lock
[ -n "$(adb shell pidof $PKG | tr -d '\r')" ] && note "process alive" || fail "process died"

# The app's own log lines only (other apps on the emulator log missing classes too).
PID=$(adb shell pidof $PKG | tr -d '\r')
adb logcat -d > "$OUT/logcat-full.txt"
if [ -n "$PID" ]; then adb logcat -d --pid="$PID" > "$OUT/logcat-app.txt"; else grep -E "$PKG|AndroidRuntime" "$OUT/logcat-full.txt" > "$OUT/logcat-app.txt"; fi
grep -E "AndroidRuntime|Capacitor|chromium|StudyHard|System.err|ClassNotFound|NoSuchMethod" "$OUT/logcat-app.txt" | tail -n 300 > "$OUT/logcat.txt"
if grep -A12 "FATAL EXCEPTION" "$OUT/logcat-full.txt" | grep -q "$PKG"; then fail "app crashed (FATAL EXCEPTION)"; grep -A20 "FATAL EXCEPTION" "$OUT/logcat-full.txt" | head -40; fi
if grep -E "ClassNotFoundException|NoSuchMethodException|NoSuchFieldException" "$OUT/logcat-app.txt" | grep -vE "android\.webkit\.|/system/app/(Chrome|WebView)|com\.android\.webview|org\.chromium" > "$OUT/missing.txt"; then
  fail "a class or method is missing (R8 removed something used by name)"; head -20 "$OUT/missing.txt"
fi
if grep -E "is not implemented on android|No such method|Unable to find method" "$OUT/logcat-app.txt"; then fail "a Capacitor plugin method is missing"; fi
if [ -z "$OLD_WEBVIEW" ] && grep -E "Capacitor/Console.*(Uncaught|TypeError|ReferenceError)" "$OUT/logcat-app.txt" | grep -v "Error injecting safe area CSS" > "$OUT/js-errors.txt"; then fail "JavaScript errors in the console"; head -20 "$OUT/js-errors.txt"; fi
echo "── MN in the system log ──"
grep -E "FATAL|Process: $PKG|Caused by|E AndroidRuntime|ActivityManager.*$PKG|ActivityTaskManager.*$PKG|libc.*$PKG|DEBUG.*(signal|Abort|backtrace)|chromium.*(CONSOLE|ERROR)|Capacitor" "$OUT/logcat-full.txt" | grep -v uiautomator | head -n 120
rm -f "$OUT/logcat-full.txt"

if [ ${#FAILS[@]} -gt 0 ]; then
  note "${#FAILS[@]} problem(s): ${FAILS[*]}"
  exit 1
fi
note "all release checks passed"
