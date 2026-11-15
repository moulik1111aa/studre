#!/usr/bin/env bash
# Checks VoiceState.java and NoteIds.java (review fix 10) without the Android SDK: compiles
# them with test/native/release/.../ReleaseTest.java and runs the test.
set -eo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -r "$root/test/native/release" "$work/src"
for f in VoiceState NoteIds; do cp "$root/native/android/java/com/studyhard/app/$f.java" "$work/src/com/studyhard/app/"; done
javac -nowarn -d "$work/out" $(find "$work/src" -name '*.java')
java -cp "$work/out" com.studyhard.app.ReleaseTest
