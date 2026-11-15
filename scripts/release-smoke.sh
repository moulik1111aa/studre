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
    sleep 2; t=$((t + 2))
  done
  return 1
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
# The opening film (about a minute) ends on "Let's set up".
if wait_for "set up" 150; then note "opening film finished"; shot film-end; tap_text "set up"; else fail "the opening film did not finish"; fi
if wait_for "Your phone code" 40; then note "lock screen with this phone's code (native plugin works)"; else fail "lock screen with the phone code did not appear"; fi
sleep 2; shot lock
[ -n "$(adb shell pidof $PKG | tr -d '\r')" ] && note "process alive" || fail "process died"

adb logcat -d > "$OUT/logcat-full.txt"
grep -E "AndroidRuntime|Capacitor|chromium|StudyHard|$PKG|System.err|R8|ClassNotFound|NoSuchMethod" "$OUT/logcat-full.txt" | tail -n 300 > "$OUT/logcat.txt"
grep -q "FATAL EXCEPTION" "$OUT/logcat-full.txt" && fail "app crashed (FATAL EXCEPTION)"
grep -qE "ClassNotFoundException|NoSuchMethodException|NoSuchFieldException" "$OUT/logcat-full.txt" && fail "a class or method is missing (R8 removed something used by name)"
grep -qE "is not implemented on android|No such method|Unable to find method" "$OUT/logcat-full.txt" && fail "a Capacitor plugin method is missing"
if grep -E "Capacitor/Console.*(Uncaught|TypeError|ReferenceError)" "$OUT/logcat-full.txt" | grep -v "Error injecting safe area CSS" > "$OUT/js-errors.txt"; then fail "JavaScript errors in the console"; fi
rm -f "$OUT/logcat-full.txt"

if [ ${#FAILS[@]} -gt 0 ]; then
  note "${#FAILS[@]} problem(s): ${FAILS[*]}"
  exit 1
fi
note "all release checks passed"
