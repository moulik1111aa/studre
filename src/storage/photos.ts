// Photos of agreed rewards: kept on the phone only (app storage natively, IndexedDB in a browser),
// downscaled to 1280 px JPEG before saving.
import type { StudyHardPlugin } from '../platform/native.ts';

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
}
