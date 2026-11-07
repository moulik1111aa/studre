// The family backup file as a page that opens in any browser: who is in it and when it was
// saved, with the backup itself inside (the same as the online backup; see core/familyfile.ts).
import { esc, type App } from './app.ts';
import { familyJson, makeFamilyFile, type FamilyFile } from '../core/familyfile.ts';
import { familyRules } from '../core/cloud.ts';
import { saveTextFile } from '../platform/files.ts';
import { markBackedUp } from './backup.ts';

export const familyFileName = (today: string, source: 'phone' | 'cloud') => `MN-family-backup-${source === 'cloud' ? 'cloud-' : ''}${today}.html`;

export function familyFileHtml(f: FamilyFile): string {
  const when = new Date(f.exportedAt);
  const rows = f.children
    .map((b) => {
      const c = b.child;
      const passed = Object.values(c.progress.levels).filter((l) => l.stars >= 1).length;
      return `<li><b>${esc(c.name)}</b><span>age ${c.age} · ${passed} levels passed · ${Math.round(c.wallet.lifetime)} coins earned</span></li>`;
    })
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MN family backup · ${esc(when.toDateString())}</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:32px auto;padding:0 18px;color:#1A1446;background:#F4F7FF}
h1{font-size:24px;margin:0 0 4px}p{line-height:1.5}ul{list-style:none;padding:0}li{background:#fff;border-radius:14px;padding:12px 14px;margin:8px 0;box-shadow:inset 0 0 0 2px #1A1446}
li span{display:block;font-size:14px;opacity:.8}.fine{font-size:13px;opacity:.75}</style></head><body>
<h1>MN family backup</h1>
<p>Saved ${esc(when.toLocaleString('en-IN'))}, ${f.source === 'cloud' ? 'from the Google online backup' : 'from a phone'}.</p>
<ul>${rows}</ul>
<p>To bring everyone back, open MN → Parent area → Backup → <b>Restore from a backup file</b>, and pick this file. It works the same as the online backup: if you are signed in with Google, the restored progress backs up there too.</p>
<p class="fine">Please don’t edit this file: a changed file can’t be restored.</p>
<script type="application/json" id="mn-family-backup">${familyJson(f)}</script>
</body></html>`;
}

/** Save one file with every child on this phone. */
export async function saveFamilyFile(app: App): Promise<boolean> {
  const kids = app.save.data.children;
  const f = await makeFamilyFile(kids, familyRules(app.save.data.settings), 'phone');
  const ok = await saveTextFile(app, familyFileName(app.today, 'phone'), 'text/html', familyFileHtml(f));
  if (ok) for (const c of kids) markBackedUp(app, c);
  return ok;
}
