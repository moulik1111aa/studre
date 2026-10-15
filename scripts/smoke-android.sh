#!/usr/bin/env bash
# Smoke test on an Android emulator (run by CI inside android-emulator-runner):
# install the APK, launch it, set up a child (grown-up check, name, age, daily limit),
# place them, choose a treat and a big goal, start a level, pause it with the back
# button, leave, and relaunch — taking screenshots and checking the log for crashes.
# Usage: scripts/smoke-android.sh StudyHard.apk out-dir
set -u
APK=${1:-StudyHard.apk}
OUT=${2:-ci-results}
PKG=com.studyhard.app
mkdir -p "$OUT"
FAILS=()
STEP=0

note() { echo "[smoke] $*" | tee -a "$OUT/steps.txt"; }
fail() { note "FAIL: $*"; FAILS+=("$*"); }
shot() { STEP=$((STEP + 1)); adb exec-out screencap -p > "$OUT/$(printf %02d $STEP)-$1.png"; }
ui() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb exec-out cat /sdcard/ui.xml 2>/dev/null; }
# Centre of the first on-screen node whose text or description contains $1 (or equals it
# when $2 is "exact"); prints "x y".
find_node() {
  ui | python3 -c '
import sys, re, html
want, mode = sys.argv[1], sys.argv[2]
xml = sys.stdin.read()
for m in re.finditer(r"<node [^>]*>", xml):
    n = m.group(0)
    parts = [html.unescape(p) for p in re.findall(r"(?:text|content-desc)=\"([^\"]*)\"", n)]
    hit = any(p.strip() == want for p in parts) if mode == "exact" else want in " ".join(parts)
    b = re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", n)
    if hit and b:
        x1, y1, x2, y2 = map(int, b.groups())
        if x2 > x1 and y2 > y1:
            print((x1 + x2) // 2, (y1 + y2) // 2); break
' "$1" "${2:-contains}"
}
screen_text() {
  ui | python3 -c '
import sys, re, html
print(" | ".join(html.unescape(t) for t in re.findall(r"(?:text|content-desc)=\"([^\"]+)\"", sys.stdin.read())))'
}
clear_system_dialogs() {
  local xy; xy=$(find_node "isn't responding")
  if [ -n "$xy" ]; then
    note "dismissing a system 'not responding' dialog"
    xy=$(find_node "Wait"); [ -n "$xy" ] && adb shell input tap $xy
  fi
}
wait_for() {
  local t=0
  while [ $t -lt "${2:-30}" ]; do
    [ -n "$(find_node "$1")" ] && return 0
    clear_system_dialogs
    sleep 2; t=$((t + 2))
  done
  return 1
}
tap_text() {
  local xy; xy=$(find_node "$1" "${2:-contains}")
  if [ -z "$xy" ]; then fail "could not find \"$1\" to tap"; return 1; fi
  adb shell input tap $xy; note "tapped \"$1\" at $xy"
}
alive() { [ -n "$(adb shell pidof $PKG | tr -d '\r')" ]; }
# Answer the grown-up check: read "What is A × B?" and type the product on its keypad.
grown_up() {
  wait_for "What is" 15 || { fail "grown-up check did not appear"; return 1; }
  local q; q=$(screen_text | grep -oE "What is [0-9]+ × [0-9]+" | head -1)
  local a b; a=$(echo "$q" | grep -oE "[0-9]+" | sed -n 1p); b=$(echo "$q" | grep -oE "[0-9]+" | sed -n 2p)
  local ans=$((a * b)); note "grown-up check: $a × $b = $ans"
  local d
  for d in $(echo "$ans" | grep -o .); do tap_text "$d" exact >/dev/null; sleep 0.4; done
  tap_text "Check" exact
}

note "device: $(adb shell getprop ro.product.model | tr -d '\r'), Android $(adb shell getprop ro.build.version.release | tr -d '\r'), $(adb shell wm size | tr -d '\r')"
sleep 20
adb shell settings put global hide_error_dialogs 1
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1
adb install -r "$APK" | tee -a "$OUT/steps.txt" || { fail "install failed"; exit 1; }
adb logcat -c
adb shell settings put secure immersive_mode_confirmations confirmed

# 1. Launch: the staged loader, then the welcome screen.
adb shell am start -W -n $PKG/.MainActivity | tee -a "$OUT/steps.txt"
sleep 3; shot loader
if [ -n "$(find_node "Viewing full screen")" ]; then tap_text "Got it"; fi
if wait_for "Set up for my child" 90; then note "welcome screen is up"; else fail "welcome screen did not appear"; fi
sleep 2; shot welcome

# 2. Setup: grown-up check, add a child, daily limit.
tap_text "Set up for my child"
grown_up
if wait_for "Add a child" 15; then note "add-child screen"; else fail "add-child screen did not open"; fi
tap_text "e.g. Riya" || tap_text "Name"
sleep 1; adb shell input text "Aarav"; sleep 1
tap_text "Pick a buddy" >/dev/null; sleep 1
tap_text "Older" exact; sleep 0.5; tap_text "Older" exact
shot add-child
tap_text "Save" exact
wait_for "Add another child" 15 || fail "children screen did not open"
tap_text "Next" exact
wait_for "Daily play time" 15 || fail "limit screen did not open"
shot limits
tap_text "Finish setup"
if wait_for "Who’s playing" 15 || wait_for "Who's playing" 2; then note "who's playing"; else fail "who's playing did not appear"; fi
shot whos

# 3. The child: placement questions for a grown-up.
tap_text "Aarav"
if wait_for "Where should" 20; then note "placement started"; else fail "placement did not start"; fi
shot placement
for i in $(seq 1 30); do
  [ -n "$(find_node "Choose rewards")" ] && break
  if [ -n "$(find_node "Yes, easily")" ]; then tap_text "Yes, easily" >/dev/null; fi
  sleep 2
done
wait_for "Choose rewards" 10 && note "placement done" || fail "placement did not finish"
tap_text "Choose rewards"

# 4. Rewards: a treat, then a big goal (both lock in).
if wait_for "Pick your treat" 15; then note "treat picker"; else fail "treat picker missing"; fi
shot treats
tap_text "Milk chocolate bar"; wait_for "Choose this" 10; shot treat-confirm
tap_text "Choose this"
if wait_for "Pick a big goal" 15; then note "goal picker"; else fail "goal picker missing"; fi
tap_text "Toy car"; wait_for "Choose this" 10; tap_text "Choose this"

# 5. Map, then a level; back pauses it, "Leave level" returns to the map.
if wait_for "Play" 20 && wait_for "min left today" 5; then note "map is up"; else fail "map did not appear"; fi
sleep 2; shot map
tap_text "Play" exact || tap_text "Play"
sleep 5; shot level
adb shell input keyevent KEYCODE_BACK
if wait_for "Paused" 10; then note "back paused the level"; else fail "back did not pause"; fi
shot paused
tap_text "Leave level"
wait_for "min left today" 15 && note "back on the map" || fail "did not return to the map"

# 6. On the map, back warns first, then leaves.
adb shell input keyevent KEYCODE_BACK; sleep 1
shot exit-warning
adb shell input keyevent KEYCODE_BACK; sleep 3
FOCUS=$(adb shell dumpsys window | grep -m1 mCurrentFocus | tr -d '\r')
note "after second back: $FOCUS"
echo "$FOCUS" | grep -q "$PKG" && fail "app did not leave on second back"

# 7. Relaunch: the child and their rewards are remembered.
adb shell am start -W -n $PKG/.MainActivity >/dev/null
wait_for "Aarav" 40 && note "child remembered after relaunch" || fail "child not remembered"
alive && note "process alive after relaunch" || fail "process died"
shot relaunch

adb logcat -d > "$OUT/logcat-full.txt"
grep -E "AndroidRuntime|Capacitor|chromium|StudyHard|$PKG|System.err|TextToSpeech" "$OUT/logcat-full.txt" | tail -n 400 > "$OUT/logcat.txt"
if grep -q "FATAL EXCEPTION" "$OUT/logcat-full.txt"; then fail "app crashed (FATAL EXCEPTION in logcat)"; fi
if grep -E "Capacitor/Console.*(Uncaught|TypeError|ReferenceError)" "$OUT/logcat-full.txt" | grep -v "Error injecting safe area CSS" > "$OUT/js-errors.txt"; then fail "JavaScript errors in the console"; fi
rm -f "$OUT/logcat-full.txt"

if [ ${#FAILS[@]} -gt 0 ]; then
  note "${#FAILS[@]} problem(s): ${FAILS[*]}"
  exit 1
fi
note "all smoke checks passed"
