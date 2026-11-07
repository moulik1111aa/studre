// Share a printable page as a PDF: on the phone, MN makes the PDF and opens the share list
// (WhatsApp, Drive, print…); in a browser, the page opens with its print screen ("Save as PDF").
// If neither works, the page is saved as a web page instead.

import type { App } from './app.ts';
import { saveTextFile } from '../platform/files.ts';

/** A file name part from a child's name: "Riya Shah" → "Riya-Shah". */
export const fileSafe = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'child';

export async function sharePage(app: App, o: { html: string; name: string; title: string; landscape?: boolean }): Promise<boolean> {
  if (app.native?.sharePdf) {
    app.toast('Making the PDF…', 2500);
    try {
      // Never wait for ever: if the phone hasn't made it in 20 seconds, save the page instead.
      const r = await Promise.race([
        app.native.sharePdf({ html: o.html, name: `${o.name}.pdf`, title: o.title, landscape: o.landscape }),
        new Promise<{ ok: false }>((res) => setTimeout(() => res({ ok: false }), 20_000)),
      ]);
      if (r.ok) return true;
    } catch {
      /* falls back to the web page */
    }
  }
  if (!app.native) {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(o.html);
      w.document.close();
      setTimeout(() => w.print(), 400);
      return true;
    }
  }
  const ok = await saveTextFile(app, `${o.name}.html`, 'text/html', o.html);
  if (ok) app.toast(`Saved ${o.name}.html. Open it to print.`, 5000);
  return ok;
}
