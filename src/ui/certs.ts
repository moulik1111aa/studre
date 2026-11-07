// Certificates (MN ×): Parent area → a child → Certificates. One for each challenge beaten on
// the map; a stage's final challenge is the "stage complete" certificate. Each one shares as a
// landscape A4 PDF to print and put on the fridge.

import { esc, html, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS } from '../core/areas/index.ts';
import { certificatesFor, type Cert } from '../core/certs.ts';
import { stagger } from '../render/motion.ts';
import { plusSvg } from './plus.ts';
import { bossFaceSvg } from './bosses.ts';
import { fileSafe, sharePage } from './pdfshare.ts';
import { mnxIncluded } from './membership.ts';

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDay = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};
const stageName = (s: number) => AREAS[0].stages[s - 1]?.name ?? `Stage ${s}`;

/** Ribbon colours by stage (print-friendly). */
const TONE: Record<number, [string, string]> = {
  1: ['#3BA9E8', '#DDF2FF'],
  2: ['#F07A2E', '#FFEBDC'],
  3: ['#2E9E55', '#DFF6E6'],
  4: ['#7A4FE0', '#ECE4FF'],
  5: ['#D9446E', '#FFE3EB'],
  6: ['#16958A', '#DCF5F2'],
  7: ['#4F5690', '#E6E8F5'],
};

export const certTitle = (c: Cert): string => (c.kind === 'stage' ? `Stage ${c.stage} complete` : 'Challenge beaten');
export const certLine = (c: Cert): string =>
  c.kind === 'stage' ? `for finishing Stage ${c.stage}, ${stageName(c.stage)}, and beating ${c.boss}` : `for beating ${c.boss}, the challenge halfway through Stage ${c.stage}, ${stageName(c.stage)}`;

export function certsScreen(child: Child, back: (app: App) => Screen) {
  return (app: App): Screen => {
    const certs = certificatesFor(app.pathFor(child), child.progress, child.log).reverse();
    const el = html(`<section class="screen limits certs" aria-label="Certificates">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">Certificates</span><span style="width:50px"></span></header>
      <div class="scroll lim-body ct-body">
        ${mnxIncluded(app)}
        <p class="ex-why">${certs.length ? `${esc(child.name)} has earned ${certs.length === 1 ? 'a certificate' : `${certs.length} certificates`}. Share one as a PDF to print, or send it to family.` : `Each challenge ${esc(child.name)} beats on the map earns a certificate. The first one is waiting at the next challenge.`}</p>
        ${certs
          .map((c) => {
            const [ink, soft] = TONE[c.stage] ?? TONE[1];
            return `<div class="card ct-card" style="--ct:${ink};--ct-soft:${soft}"><span class="ct-medal" aria-hidden="true">${c.kind === 'stage' ? '🏆' : '🏅'}</span><span class="ct-txt"><b>${esc(certTitle(c))}</b><small>${esc(c.boss)} · Stage ${c.stage}${c.day ? ` · ${esc(longDay(c.day))}` : ''}</small></span><button class="btn small ct-share" data-id="${esc(c.id)}">Share</button></div>`;
          })
          .join('')}
      </div>
    </section>`);
    el.querySelectorAll<HTMLElement>('.ct-share').forEach((b) =>
      b.addEventListener('click', () => {
        const c = certs.find((x) => x.id === b.dataset.id)!;
        void sharePage(app, { html: certificateHtml(child, c, app.today), name: `MN-${fileSafe(child.name)}-certificate-stage-${c.stage}${c.kind === 'stage' ? '' : '-challenge'}`, title: `${child.name}’s certificate`, landscape: true });
      }),
    );
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(back));
    return { el, mounted: () => stagger(el.querySelectorAll('.ct-body > *'), { gap: 40 }), back: () => (void app.show(back), true) };
  };
}

/** The certificate: a landscape A4 page. */
export function certificateHtml(child: Child, c: Cert, today: string): string {
  const [ink, soft] = TONE[c.stage] ?? TONE[1];
  const day = longDay(c.day ?? today);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(child.name)}’s certificate</title><style>
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#fff}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1A1446}
.sheet{width:297mm;height:210mm;padding:11mm;position:relative;overflow:hidden}
.frame{height:100%;border:3px solid ${ink};border-radius:8mm;padding:3mm;position:relative}
.inner{height:100%;border:1.2px solid ${ink};border-radius:6mm;background:linear-gradient(180deg,#fff 0%,#fff 62%,${soft} 100%);display:flex;flex-direction:column;align-items:center;text-align:center;padding:12mm 22mm 10mm;position:relative}
.corner{position:absolute;width:16mm;height:16mm;opacity:.9}
.corner.tl{top:4mm;left:4mm}.corner.tr{top:4mm;right:4mm;transform:scaleX(-1)}.corner.bl{bottom:4mm;left:4mm;transform:scaleY(-1)}.corner.br{bottom:4mm;right:4mm;transform:scale(-1,-1)}
.brand{display:flex;align-items:center;gap:3mm;font-weight:800;letter-spacing:.02em;font-size:12pt}
.brand svg{width:13mm;height:13mm}
.kind{margin:7mm 0 0;font-family:Georgia,"Times New Roman",serif;font-size:34pt;font-weight:700;color:${ink};line-height:1.05}
.sub{margin:2mm 0 0;font-size:12pt;color:#4a4570}
.name{margin:7mm 0 0;font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:52pt;line-height:1.05;padding:0 10mm 2mm;border-bottom:1.5px solid #1A1446;min-width:140mm}
.line{margin:7mm 0 0;font-size:16pt;line-height:1.45;max-width:200mm}
.foot{margin-top:auto;width:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10mm}
.sig{border-top:1.5px solid #1A1446;padding-top:2mm;font-size:10.5pt;color:#4a4570;text-align:center}
.seal{width:34mm;height:34mm;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 1.4mm ${ink},0 0 0 3.2mm ${soft},0 0 0 3.8mm ${ink}}
.seal svg{width:31mm;height:31mm}
</style></head><body><div class="sheet"><div class="frame"><div class="inner">
${['tl', 'tr', 'bl', 'br'].map((k) => `<svg class="corner ${k}" viewBox="0 0 40 40" aria-hidden="true"><path d="M2 38 V14 Q2 2 14 2 H38" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="12" r="3.4" fill="${ink}"/></svg>`).join('')}
<div class="brand">${plusSvg({ noShadow: true })}<span>MN</span></div>
<p class="kind">${c.kind === 'stage' ? 'Certificate of Achievement' : 'Challenge Certificate'}</p>
<p class="sub">This certificate is proudly given to</p>
<p class="name">${esc(child.name)}</p>
<p class="line">${esc(certLine(c))}.</p>
<div class="foot"><div class="sig">${esc(day)}<br>Date</div><div class="seal">${bossFaceSvg(c.bossId)}</div><div class="sig">&nbsp;<br>Signed by a proud grown-up</div></div>
</div></div></div></body></html>`;
}
