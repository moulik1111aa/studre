// Saving a file the parent can keep or send on (the report card). On the phone, Android's own
// "save to" screen opens; in a browser, the file downloads.
import type { App } from '../ui/app.ts';

export async function saveTextFile(app: App, name: string, mime: string, text: string): Promise<boolean> {
  if (app.native?.saveFile) {
    const r = await app.native.saveFile({ name, mime, text });
    return !!r.saved;
  }
  if (app.debug) Object.assign(window, { __lastExport: { name, text } });
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Ask for a file and read it as text (null if nothing was picked). */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    const finish = (v: { name: string; text: string } | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return finish(null);
      void f.text().then((text) => finish({ name: f.name, text }), () => finish(null));
    });
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}
