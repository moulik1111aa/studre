#!/usr/bin/env bash
# Checks native/android/java/.../Billing.java without the Android SDK: compiles it against small
# stand-ins for the Android, Capacitor and Play Billing classes it uses (test/native/billing),
# then runs two tests: purchase signatures (VerifyTest) and that every call waiting for Play is
# answered exactly once when Play fails or never answers (ReadyTest, about 35 seconds).
# The stand-ins check our own logic; only a real build checks Play's API names.
set -eo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -r "$root/test/native/billing" "$work/src"
cp "$root/native/android/java/com/studyhard/app/Billing.java" "$work/src/com/studyhard/app/"
printf 'package com.studyhard.app;\nfinal class PlayKey { static final String LICENSE = ""; static final boolean PLAY = true; }\n' > "$work/src/com/studyhard/app/PlayKey.java"
javac -nowarn -d "$work/out" $(find "$work/src" -name '*.java')
java -cp "$work/out" com.studyhard.app.VerifyTest 2>&1 | grep -v JAVA_TOOL_OPTIONS
java -cp "$work/out" com.studyhard.app.ReadyTest 2>&1 | grep -v JAVA_TOOL_OPTIONS
