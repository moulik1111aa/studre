// Photos of agreed rewards: kept on the phone only (app storage natively, IndexedDB in a browser),
// downscaled to 1280 px JPEG before saving. A photo is deleted as soon as no reward uses it:
// when it is retaken or not used, when its reward is given, when its child is removed or reset,
// and with "Delete account and data". `tidy` also clears any left over from older versions.
import type { StudyHardPlugin } from '../platform/native.ts';
import type { SaveData } from './save.ts';

/** The photos the save still uses: each child's two jars (a given reward keeps no photo). */
export function photosInUse(d: SaveData): Set<string> {
  const ids = new Set<string>();
  for (const c of d.children) {
    for (const j of [c.wallet?.treat, c.wallet?.goal]) if (j?.photo) ids.add(j.photo);
  }
  return ids;
}

/** Of the photos stored, the ones to delete: not used by the save and not in an open photo picker. */
export function unusedPhotos(stored: string[], inUse: Set<string>, held: Set<string> = new Set()): string[] {
  return stored.filter((id) => !inUse.has(id) && !held.has(id));
}

const DB = 'studyhard-photos';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function downscale(file: Blob, max = 1280): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

export class Photos {
  private readonly native: StudyHardPlugin | null;
  private readonly cache = new Map<string, string>();
  /** Photos just taken in an open reward sheet, not chosen yet (tidy leaves them alone). */
  private readonly held = new Set<string>();
  constructor(native: StudyHardPlugin | null) {
    this.native = native;
  }

  async save(file: Blob): Promise<string> {
    const dataUrl = await downscale(file);
    const id = `p${Date.now().toString(36)}`;
    if (this.native) await this.native.savePhoto({ id, dataUrl });
    else {
      const db = await idb();
      await new Promise<void>((res, rej) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put(dataUrl, id);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
    this.cache.set(id, dataUrl);
    return id;
  }

  async load(id: string): Promise<string | undefined> {
    if (this.cache.has(id)) return this.cache.get(id);
    let url: string | undefined;
    try {
      if (this.native) url = (await this.native.loadPhoto({ id })).dataUrl;
      else {
        const db = await idb();
        url = await new Promise<string | undefined>((res) => {
          const r = db.transaction('photos').objectStore('photos').get(id);
          r.onsuccess = () => res(r.result as string | undefined);
          r.onerror = () => res(undefined);
        });
      }
    } catch {
      url = undefined;
    }
    if (url) this.cache.set(id, url);
    return url;
  }

  /** A photo taken in a reward sheet that is still open: kept by `tidy` until `release`. */
  hold(id: string): void {
    this.held.add(id);
  }
  release(id: string): void {
    this.held.delete(id);
  }

  async delete(id: string | undefined): Promise<void> {
    if (!id) return;
    this.cache.delete(id);
    this.held.delete(id);
    try {
      if (this.native) await this.native.deletePhoto({ id });
      else await this.idbDo((s) => s.delete(id));
    } catch {
      /* gone already, or tidied up next time */
    }
  }

  /** The ids of the photos stored (empty if they can't be listed). */
  async list(): Promise<string[]> {
    try {
      if (this.native) return (await this.native.listPhotos?.())?.ids ?? [];
      const db = await idb();
      return await new Promise<string[]>((res) => {
        const r = db.transaction('photos').objectStore('photos').getAllKeys();
        r.onsuccess = () => res((r.result as IDBValidKey[]).map(String));
        r.onerror = () => res([]);
      });
    } catch {
      return [];
    }
  }

  /** Deletes every photo the save no longer uses. Returns how many were deleted. */
  async tidy(d: SaveData): Promise<number> {
    const gone = unusedPhotos(await this.list(), photosInUse(d), this.held);
    for (const id of gone) await this.delete(id);
    return gone.length;
  }

  /** Deletes every photo (in a browser; on a phone `wipeLocal` does it with the rest). */
  async clear(): Promise<void> {
    this.cache.clear();
    this.held.clear();
    if (this.native) {
      for (const id of await this.list()) await this.delete(id);
      return;
    }
    try {
      await this.idbDo((s) => s.clear());
    } catch {
      /* nothing stored */
    }
  }

  private async idbDo(op: (s: IDBObjectStore) => void): Promise<void> {
    const db = await idb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('photos', 'readwrite');
      op(tx.objectStore('photos'));
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
}
