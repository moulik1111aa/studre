// Review fix 10: the release build is shrunk with R8 (code) and resource shrinking. Capacitor
// finds plugins and their methods by reflection, and android.print.PdfMaker reaches callbacks
// whose constructors the SDK hides, so those are kept whole.

/** Lines for `buildTypes { release { … } }` in app/build.gradle. */
export const RELEASE_SHRINKING = `            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`;

/** Added to app/proguard-rules.pro. */
export const PROGUARD_RULES = `
# ── MN (added by scripts/android.mjs, review fix 10) ──
# Capacitor: the bridge, every plugin class and the methods the web app calls by name.
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    public <init>(...);
    @com.getcapacitor.PluginMethod public <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
# MN's own code (small): plugins, receivers, widgets, the PDF maker's helpers.
-keep class com.studyhard.app.** { *; }
# PDF sharing: subclasses of print callbacks whose constructors are hidden from the SDK.
-keep class android.print.PdfMaker { *; }
-keep class android.print.PdfMaker$* { *; }
-dontwarn android.print.**
# Sign in with Google (Credential Manager, as its documentation asks).
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
`;

/** app/build.gradle's release build type with shrinking on. */
export function withShrinking(gradleBlock) {
  const anchor = '        release {\n';
  const i = gradleBlock.indexOf('    buildTypes {\n' + anchor);
  if (i < 0) throw new Error('patch anchor not found: buildTypes { release {');
  const at = i + '    buildTypes {\n'.length + anchor.length;
  return gradleBlock.slice(0, at) + RELEASE_SHRINKING + '\n' + gradleBlock.slice(at);
}
