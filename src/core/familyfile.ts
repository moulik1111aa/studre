// One backup file for the whole family, the same as the cloud copy: the family's rules and one
// checked child backup per child (exactly what the cloud keeps for each child). A file saved on
// a phone and a file downloaded from the cloud are the same kind of file, so either one restores
// on any phone, and a restored family then backs up to the cloud as usual.
// A single child's report card (backup.ts) still works everywhere too.

import type { Child } from '../storage/save.ts';
import { makeBackup, readBackup, type Backup } from './backup.ts';
import { forCloud, type FamilyRules } from './cloud.ts';

export const FAMILY_FORMAT = 'mn-family-backup';
export const FAMILY_VERSION = 1;

export interface FamilyFile {
  format: typeof FAMILY_FORMAT;
  version: number;
  exportedAt: string;
  /** Where it came from: this phone, or the cloud copy. */
  source: 'phone' | 'cloud';
  rules: FamilyRules;
  children: Backup[];
}

/** Children's backups as the cloud stores them (no question history or undo notes). */
export async function makeFamilyFile(children: Child[], rules: FamilyRules, source: 'phone' | 'cloud', now = new Date()): Promise<FamilyFile> {
  const backups: Backup[] = [];
  for (const c of children) backups.push(await makeBackup(forCloud(c), now));
  return { format: FAMILY_FORMAT, version: FAMILY_VERSION, exportedAt: now.toISOString(), source, rules, children: backups };
}

/** From a file already made of checked backups (the cloud's own copies). */
export function familyFileOf(backups: Backup[], rules: FamilyRules, source: 'phone' | 'cloud', now = new Date()): FamilyFile {
  return { format: FAMILY_FORMAT, version: FAMILY_VERSION, exportedAt: now.toISOString(), source, rules, children: backups };
}

export const familyJson = (f: FamilyFile): string => JSON.stringify(f).replace(/</g, '\\u003c');

export type AnyBackup = { ok: true; backups: Backup[]; rules?: FamilyRules; source?: 'phone' | 'cloud'; family: boolean } | { ok: false; reason: string };

/** Read a family backup file or a single report card (or their bare JSON). */
export async function readAnyBackup(text: string): Promise<AnyBackup> {
  const m = /<script[^>]*id="mn-family-backup"[^>]*>([\s\S]*?)<\/script>/.exec(text);
  let fam: FamilyFile | null = null;
  if (m) {
    try {
      fam = JSON.parse(m[1]) as FamilyFile;
    } catch {
      return { ok: false, reason: 'This family backup file can’t be read.' };
    }
  } else if (!/id="mn-backup"/.test(text)) {
    try {
      const j = JSON.parse(text.trim());
      if (j?.format === FAMILY_FORMAT) fam = j as FamilyFile;
    } catch {
      /* not JSON: try as a report card below */
    }
  }
  if (!fam) {
    const r = await readBackup(text);
    return r.ok ? { ok: true, backups: [r.backup], family: false } : r;
  }
  if (fam.format !== FAMILY_FORMAT || !Array.isArray(fam.children)) return { ok: false, reason: 'This isn’t an MN backup file.' };
  if (fam.version > FAMILY_VERSION) return { ok: false, reason: 'This file comes from a newer MN. Update the app, then try again.' };
  const out: Backup[] = [];
  for (const b of fam.children) {
    const r = await readBackup(JSON.stringify(b));
    if (!r.ok) return { ok: false, reason: r.reason.replace('This report card', 'A child in this file').replace('This file', 'This backup file') };
    out.push(r.backup);
  }
  return { ok: true, backups: out, rules: fam.rules, source: fam.source, family: true };
}
