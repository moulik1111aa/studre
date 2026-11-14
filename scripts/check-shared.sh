#!/usr/bin/env bash
# Checks SharedInbox.java (files shared to MN) without the Android SDK: compiles it against small
# stand-ins for Intent and Uri (test/native/shared) and runs test/native/shared/.../SharedTest.java:
# read on a background thread, content:// from other apps only, at most 10 MB, ignored when the
# app is reopened from Recents, handed over once.
# With a path to an older StudyHardPlugin.java, its inline readShared() is wrapped and tested instead.
set -eo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -r "$root/test/native/shared" "$work/src"
if [ -n "$1" ]; then
  python3 - "$1" "$work/src/com/studyhard/app/SharedInbox.java" <<'PY'
import sys
s = open(sys.argv[1]).read()
i = s.index('    private boolean readShared(Intent intent) {'); j = s.index('    private String displayName(Uri uri) {')
body = s[i:j].replace('getContext().getContentResolver().openInputStream(uri)', 'files.open(uri)').replace('displayName(uri)', 'files.name(uri)')
open(sys.argv[2], 'w').write('''package com.studyhard.app;
import android.content.Intent; import android.net.Uri; import java.io.*; import java.nio.charset.StandardCharsets; import java.util.concurrent.Executor;
/** The old StudyHardPlugin.readShared(), wrapped in SharedInbox's shape. */
final class SharedInbox {
  static final int LIMIT = 10 * 1024 * 1024;
  static final String TOO_BIG = "too-big", UNSUPPORTED = "unsupported", UNREADABLE = "unreadable";
  interface Files { InputStream open(Uri uri) throws IOException; String name(Uri uri); boolean ours(String authority); }
  interface Arrived { void arrived(); }
  private final Files files; private final Arrived arrived; private String sharedText, sharedName;
  SharedInbox(Files files, Executor worker, Arrived arrived) { this.files = files; this.arrived = arrived; }
  static boolean fromHistory(Intent intent) { return false; }
  boolean take(Intent intent) { boolean r = readShared(intent); if (r) arrived.arrived(); return r; }
  synchronized String[] collect() { String[] r = { sharedText, sharedName, null }; sharedText = sharedName = null; return r; }
''' + body + '}\n')
PY
else
  cp "$root/native/android/java/com/studyhard/app/SharedInbox.java" "$work/src/com/studyhard/app/"
fi
javac -nowarn -d "$work/out" $(find "$work/src" -name '*.java')
java -cp "$work/out" com.studyhard.app.SharedTest
