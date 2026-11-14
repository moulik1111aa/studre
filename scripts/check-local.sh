#!/usr/bin/env bash
# Checks LocalData.java (the reward photos and the share folder, review fix 8) without the
# Android SDK: compiles it with test/native/local/.../LocalTest.java and runs the test.
set -eo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -r "$root/test/native/local" "$work/src"
cp "$root/native/android/java/com/studyhard/app/LocalData.java" "$work/src/com/studyhard/app/"
javac -nowarn -d "$work/out" $(find "$work/src" -name '*.java')
java -cp "$work/out" com.studyhard.app.LocalTest
