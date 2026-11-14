// Review fix 8: what Android may copy to the parent's Google backup (and to a new phone).
// Only MN's save (shared_prefs/studyhard_save.xml, the native copy of progress) goes, so a
// family without Google sign-in still gets its progress back on a new phone. Nothing else:
// not the WebView folder (it holds the Google sign-in session, so a restored phone starts
// signed out), not the reminders and widget data, not the reward photos, not caches. With an
// <include>, Android copies only what is included.

export const SAVE_PREFS = 'studyhard_save.xml';

const rules = `        <include domain="sharedpref" path="${SAVE_PREFS}" />`;

/** android:fullBackupContent (Android 11 and older). */
export const BACKUP_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${rules}
</full-backup-content>
`.replace(/^ {4}/gm, '');

/** android:dataExtractionRules (Android 12 and later): the Google backup and a phone-to-phone transfer. */
export const DATA_EXTRACTION_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
${rules}
    </cloud-backup>
    <device-transfer>
${rules}
    </device-transfer>
</data-extraction-rules>
`;

/** The <application> attributes that point Android at the two files. */
export function backupAttributes(manifest) {
  const re = /android:allowBackup="[^"]*"/;
  if (!re.test(manifest)) throw new Error('patch anchor not found: android:allowBackup on <application>');
  if (manifest.includes('android:dataExtractionRules') || manifest.includes('android:fullBackupContent')) throw new Error('the manifest already has backup rules');
  return manifest.replace(
    re,
    'android:allowBackup="true"\n        android:fullBackupContent="@xml/backup_rules"\n        android:dataExtractionRules="@xml/data_extraction_rules"',
  );
}
