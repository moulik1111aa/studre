// Generates the Android project for the APK build (run in CI after `npm run build`).
// The android/ folder is not committed: Capacitor creates it fresh from its
// template, then this script layers Study Hard's native code and resources on top
// and patches the manifest and Gradle file. Every patch checks its anchor, so a
// template change fails the build loudly instead of shipping a broken app.
//
//   node scripts/android.mjs
//
// Env: STUDYHARD_VERSION_CODE (default: GITHUB_RUN_NUMBER, or 1 locally).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));

export const VERSION_OFFSET = 0;
const versionCode = Number(
  process.env.STUDYHARD_VERSION_CODE ?? (process.env.GITHUB_RUN_NUMBER ? Number(process.env.GITHUB_RUN_NUMBER) + VERSION_OFFSET : 1),
);
if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error(`bad version code: ${versionCode}`);
const versionName = `${pkg.version} (${versionCode})`;

// 1. Web assets: the single-file app.
const dist = join(root, 'dist/index.html');
if (!existsSync(dist)) throw new Error('dist/index.html is missing: run `npm run build` first');
rmSync(join(root, 'www'), { recursive: true, force: true });
mkdirSync(join(root, 'www'));
cpSync(dist, join(root, 'www/index.html'));

// 2. A fresh Android project from Capacitor's template.
const android = join(root, 'android');
rmSync(android, { recursive: true, force: true });
run('npx cap add android');

const main = join(android, 'app/src/main');
const pkgPath = config.appId.split('.').join('/');

// 3. Native code: our MainActivity (registers the plugin) and the StudyHard plugin.
const javaDir = join(main, 'java', pkgPath);
if (!existsSync(join(javaDir, 'MainActivity.java'))) throw new Error(`template MainActivity not found in ${javaDir}`);
cpSync(join(root, 'native/android/java', pkgPath), javaDir, { recursive: true });

// 4. Resources: icons, splash, theme. Template splash bitmaps go (ours is a layered drawable).
const res = join(main, 'res');
for (const dir of readdirSync(res)) {
  if (dir.startsWith('drawable')) rmSync(join(res, dir, 'splash.png'), { force: true });
}
cpSync(join(root, 'native/android/res'), res, { recursive: true });

// 5. Manifest: portrait, vibration, visibility of the phone's text-to-speech engine (Android 11+),
//    and the reminders and widgets.
const manifestPath = join(main, 'AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
manifest = patch(manifest, 'android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
manifest = patch(
  manifest,
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.VIBRATE" />\n    <queries>\n        <intent>\n            <action android:name="android.intent.action.TTS_SERVICE" />\n        </intent>\n    </queries>',
);
// Reminders (melt watch, backup) and the home-screen widgets: notification permission, alarms
// that come back after a restart, and the receivers (see Reminders.java and Widgets.java).
manifest = patch(
  manifest,
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-permission android:name="android.permission.VIBRATE" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
);
const widget = (name, label, info) => `
        <receiver android:name=".${name}" android:exported="false" android:label="${label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/${info}" />
        </receiver>`;
manifest = patch(
  manifest,
  '</application>',
  `        <receiver android:name=".ReminderReceiver" android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>${widget('JarWidget', 'MN treat jars', 'widget_jar_info')}${widget('FactWidget', 'MN fun fact', 'widget_fact_info')}${widget('AdventureWidget', 'MN adventure', 'widget_adventure_info')}
    </application>`,
);
writeFileSync(manifestPath, manifest);

// 6. Gradle: version, release signing (from CI secrets), and the AndroidX libraries the plugin uses.
const gradlePath = join(android, 'app/build.gradle');
const gradle = readFileSync(gradlePath, 'utf8');
if (!gradle.includes(`applicationId "${config.appId}"`)) throw new Error('app/build.gradle: applicationId not set by the template');
writeFileSync(
  gradlePath,
  `${gradle}

// ── Study Hard release settings (added by scripts/android.mjs) ──
android {
    defaultConfig {
        versionCode ${versionCode}
        versionName "${versionName}"
    }
    signingConfigs {
        release {
            def ks = System.getenv("STUDYHARD_KEYSTORE")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("STUDYHARD_KEYSTORE_PASSWORD")
                keyAlias System.getenv("STUDYHARD_KEY_ALIAS")
                keyPassword System.getenv("STUDYHARD_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            // Without the keystore (e.g. a fork), fall back to the debug key so the APK still installs.
            signingConfig System.getenv("STUDYHARD_KEYSTORE") ? signingConfigs.release : signingConfigs.debug
        }
    }
}

dependencies {
    implementation "androidx.core:core:$androidxCoreVersion"
    implementation "androidx.activity:activity:$androidxActivityVersion"
}
`,
);

// 7. Copy the web assets and config into the native project.
run('npx cap sync android');
console.log(`android/ ready: ${config.appId} ${versionName}`);

function patch(text, anchor, replacement) {
  if (!text.includes(anchor)) throw new Error(`patch anchor not found: ${anchor}`);
  return text.replace(anchor, replacement);
}
