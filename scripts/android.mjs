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
import { FILE_PATHS_XML, shareFilters } from './android-share.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));

export const VERSION_OFFSET = 0;
/** The Google Play app's id (the shared app stays com.studyhard.app, so both can be installed). */
export const PLAY_ID = 'app.missionnext.mn';
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
// The Play licensing key (Play Console → Monetisation setup), from the PLAY_LICENSE_KEY secret:
// Billing.java checks every purchase's signature with it. A public key, but kept out of the repo
// like the other keys. Without it (the shared APK, local builds) no purchase counts as verified.
const licence = (process.env.PLAY_LICENSE_KEY ?? '').replace(/\s+/g, '');
if (licence && !/^[A-Za-z0-9+/=]{100,1000}$/.test(licence)) throw new Error('PLAY_LICENSE_KEY is not a base64 key');
if (process.env.MN_STORE === 'play' && !licence) console.warn('PLAY_LICENSE_KEY is not set: MN × purchases will not be verified, so none will turn MN × on.');
writeFileSync(join(javaDir, 'PlayKey.java'), `package ${config.appId};\n\n/** Written by scripts/android.mjs. */\nfinal class PlayKey {\n    static final String LICENSE = "${licence}";\n    /** The Google Play build (MN_STORE=play). */\n    static final boolean PLAY = ${process.env.MN_STORE === 'play'};\n}\n`);
// The PDF maker has to live in android.print (see PdfMaker.java).
cpSync(join(root, 'native/android/java/android'), join(main, 'java/android'), { recursive: true });

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
        </receiver>${widget('JarWidget', 'MN treat jars', 'widget_jar_info')}${widget('FactWidget', 'MN fun fact', 'widget_fact_info')}${widget('AdventureWidget', 'MN today', 'widget_adventure_info')}${widget('FocusWidget', 'MN × Focus plan', 'widget_focus_info')}
    </application>`,
);
// Backup files shared to MN (WhatsApp, Files, Gmail: Share or Open with) open the app, which
// restores them. And the launcher icon moves to activity-aliases, one per icon, so MN Plus
// members can pick an icon (StudyHardPlugin.setAppIcon turns one on and the others off).
const launcher = /<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"\s*\/>\s*<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>\s*<\/intent-filter>/;
if (!launcher.test(manifest)) throw new Error('patch anchor not found: the MainActivity launcher intent-filter');
manifest = manifest.replace(launcher, shareFilters());
const ICONS = ['sky', 'night', 'sunset', 'space', 'gold'];
const aliases = ICONS.map((n) => {
  const Name = n[0].toUpperCase() + n.slice(1);
  const icon = n === 'sky' ? 'ic_launcher' : `ic_launcher_${n}`;
  return `
        <activity-alias
            android:name=".Icon${Name}"
            android:targetActivity=".MainActivity"
            android:enabled="${n === 'sky'}"
            android:exported="true"
            android:icon="@mipmap/${icon}"
            android:roundIcon="@mipmap/${icon}_round">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`;
}).join('');
const mainEnd = manifest.indexOf('</activity>', manifest.indexOf('android:name=".MainActivity"'));
if (mainEnd < 0) throw new Error('patch anchor not found: </activity> after MainActivity');
manifest = manifest.slice(0, mainEnd + '</activity>'.length) + aliases + manifest.slice(mainEnd + '</activity>'.length);
// Sharing files we make (worksheet PDFs) needs a FileProvider over the app's cache folder.
if (!manifest.includes('androidx.core.content.FileProvider')) {
  manifest = patch(manifest, '</application>', `    <provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
        </provider>
    </application>`);
}
{
  const fp = join(res, 'xml', 'file_paths.xml');
  mkdirSync(dirname(fp), { recursive: true });
  writeFileSync(fp, FILE_PATHS_XML);
}
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
        versionName "${versionName}"${process.env.MN_STORE === 'play' ? `
        // The Google Play app has its own id; the code keeps its package (namespace).
        applicationId "${PLAY_ID}"` : ''}
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
    // Sign in with Google (Credential Manager), for grown-ups' backup and sync.
    implementation "androidx.credentials:credentials:1.3.0"
    implementation "androidx.credentials:credentials-play-services-auth:1.3.0"
    implementation "com.google.android.libraries.identity.googleid:googleid:1.1.1"
    // MN Plus purchases (Google Play Billing).
    implementation "com.android.billingclient:billing:8.0.0"
}
`,
);

// 7. Copy the web assets and config into the native project.
run('npx cap sync android');
console.log(`android/ ready: ${process.env.MN_STORE === 'play' ? PLAY_ID : config.appId} ${versionName}`);

function patch(text, anchor, replacement) {
  if (!text.includes(anchor)) throw new Error(`patch anchor not found: ${anchor}`);
  return text.replace(anchor, replacement);
}
