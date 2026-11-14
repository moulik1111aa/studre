// What MN accepts from other apps, and which of its files it can hand to them (scripts/android.mjs).
//
// Share and Open with: MN backups are .html files (family and report files) or .json. MN is not
// offered for plain text or for any file at all (text/plain and application/octet-stream were
// dropped: no app has been seen sending an MN backup that way; add one back only when a real app
// is seen to need it, and name the app here). Opening a file takes content:// links only.
export const SHARE_MIMES = ['text/html', 'application/json'];

export function shareFilters() {
  return (
    SHARE_MIMES.map(
      (m) => `
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="${m}" />
            </intent-filter>`,
    ).join('') +
    `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
${SHARE_MIMES.map((m) => `                <data android:scheme="content" android:mimeType="${m}" />`).join('\n')}
            </intent-filter>`
  ).trim();
}

// The FileProvider exposes only the folder shareFile() writes to (cache/share/), not external
// storage or the whole cache, whatever Capacitor's template file held. (Capacitor also uses this
// provider to take a photo from a file input, but only for inputs with a `capture` attribute; MN's
// photo picker has none. Adding one needs <external-files-path name="my_images" path="Pictures/" />.)
export const FILE_PATHS_XML = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="mn_share" path="share/" />
</paths>
`;
