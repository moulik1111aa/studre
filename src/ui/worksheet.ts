// The paper worksheet: a self-contained .html page that prints on A4, made from the child's
// own place on the path (core/worksheet.ts). Page 1 has the questions, page 2 the answers
// for the parent.

import { esc, type App } from './app.ts';
import type { Child } from '../storage/save.ts';
import { skillById } from '../core/areas/index.ts';
import { makeQuestion } from '../core/path.ts';
import { createRng } from '../core/rng.ts';
import type { Question } from '../core/question.ts';
import { worksheetPlan, type SheetItem } from '../core/worksheet.ts';
import { visualHtml, optionHtml, prettyAnswer } from './visuals.ts';
import { escPrompt } from './answerpad.ts';
import { plusFaceSvg } from './plus.ts';

/** The app's rules for Measure, Shapes and Data pictures, copied into the printable sheet (in print colours). */
function mathVisCss(): string {
  let rules = '';
  try {
    for (const sh of [...document.styleSheets]) {
      let list: CSSRuleList;
      try {
        list = sh.cssRules;
      } catch {
        continue;
      }
      for (const r of [...list]) if (/\.mv[\s.,{:-]|\.opt-vis/.test(r.cssText) && !r.cssText.includes('.pf.fresh')) rules += r.cssText + '\n';
    }
  } catch {
    /* no stylesheets (tests) */
  }
  return `.mv{--q-ink:#1A1446;--q-bg:#FFFFFF;--q-soft:#F1EEFF;--accent:#5B3DF5;--ink:#1A1446}\n${rules}.mv .mv-svg{max-height:150px}.opt-vis .mv-svg{max-height:60px}`;
}
import { saveTextFile } from '../platform/files.ts';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};

/** File name: MN-Riya-worksheet-2026-11-05.html */
export const worksheetFileName = (child: Child, today: string) => `MN-${child.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'child'}-worksheet-${today}.html`;

/** The questions for a new sheet (different each time it is made). */
export function worksheetQuestions(app: App, child: Child, seed = `${Date.now()}`): { q: Question; item: SheetItem }[] {
  const rng = createRng(`${child.id}:sheet:${seed}`);
  const plan = worksheetPlan(child, app.pathFor(child), app.today, rng, (id) => skillById(id)?.stage);
  const seen = new Set<string>();
  const out: { q: Question; item: SheetItem }[] = [];
  for (const item of plan) {
    const s = skillById(item.skillId);
    if (!s) continue;
    const q = makeQuestion(s, rng, item.d, new Set([...seen, ...(child.progress.history[s.id] ?? [])]), undefined, out.at(-1)?.q.key, out.map((x) => x.q));
    seen.add(q.key);
    out.push({ q, item });
  }
  return out;
}

export function worksheetHtml(app: App, child: Child, qs: { q: Question; item: SheetItem }[]): string {
  const little = child.age <= 6;
  const today = app.today;
  const card = ({ q, item }: { q: Question; item: SheetItem }, n: number) => {
    const choices = q.format === 'pad' || q.format === 'pad-ext' ? '' : `<div class="opts">${q.choices.map((c) => `<span class="opt"><i></i>${optionHtml(c, q.optionObject, q.optionVisuals)}</span>`).join('')}</div>`;
    return `<li class="q${q.visual ? ' has-vis' : ''}"><span class="n">${n}</span>${item.why === 'fixit' ? '<span class="tag">🔧 Fix-it</span>' : ''}
      ${q.visual ? visualHtml(q.visual, q.key) : ''}
      <p class="p">${escPrompt(q.prompt)}</p>
      ${choices || '<p class="line">Answer: <span></span></p>'}</li>`;
  };
  const answers = qs.map(({ q }, k) => `<li><b>${k + 1}.</b> ${prettyAnswer(q.answer)}</li>`).join('');
  const topics = [...new Set(qs.map(({ q }) => skillById(q.skillId)?.name ?? ''))].filter(Boolean);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(child.name)}'s maths worksheet · ${esc(nice(today))}</title>
<style>
${mathVisCss()}
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1A1446;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:780px;margin:0 auto;padding:20px}
header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1A1446;padding-bottom:12px}
header svg{width:58px;height:58px;flex:none}
header h1{margin:0;font-size:26px;line-height:1.1}
header p{margin:2px 0 0;font-size:13px;color:#4a4570}
.fill{display:grid;grid-template-columns:2fr 1.3fr 1fr;gap:14px;margin:14px 0 6px;font-size:14px;font-weight:700}
.fill span{display:block;border-bottom:2px solid #1A1446;height:26px;margin-top:2px}
.tip{font-size:12.5px;color:#4a4570;margin:8px 0 14px}
ol.qs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.q{position:relative;border:2px solid #CFCBE8;border-radius:14px;padding:12px 12px 12px 46px;break-inside:avoid;page-break-inside:avoid;min-height:${little ? 128 : 92}px}
.q .n{position:absolute;left:10px;top:10px;width:26px;height:26px;border-radius:50%;background:#1A1446;color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px}
.q .tag{position:absolute;right:10px;top:8px;font-size:11px;font-weight:700;color:#7a5200;background:#FFF1C9;border-radius:999px;padding:2px 8px}
.q .p{margin:2px 0 8px;font-size:${little ? 22 : 17}px;font-weight:700;line-height:1.35}
.line{margin:6px 0 0;font-size:13px;color:#4a4570;display:flex;align-items:flex-end;gap:6px}
.line span{flex:1;border-bottom:2px dotted #1A1446;height:22px}
.opts{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:${little ? 20 : 16}px;font-weight:700}
.opt{display:inline-flex;align-items:center;gap:6px}
.opt i{width:16px;height:16px;border:2px solid #1A1446;border-radius:50%;flex:none}
.frac{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.8em;line-height:1.05;margin:0 2px}
.frac sup{border-bottom:1.5px solid currentColor;padding:0 2px}
.frac sub,.frac sup{vertical-align:baseline;font-size:1em}
.vis{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:2px 0 6px}
.group{display:inline-flex;flex-wrap:wrap;gap:2px;max-width:200px}
.obj{font-size:${little ? 26 : 20}px;line-height:1.1}
.obj.crossed{opacity:.35;text-decoration:line-through}
.joiner{font-size:22px;font-weight:800;padding:0 4px}
.vis.dots svg{width:120px;height:120px}
.vis.dots circle{fill:#fff;stroke:#1A1446;stroke-width:2}
.vis.tenframe{display:grid;grid-template-columns:repeat(5,30px);grid-template-rows:repeat(2,30px);border:2px solid #1A1446}
.vis.tenframe .cell{border:1px solid #1A1446;display:grid;place-items:center}
.vis.tenframe .cell i{width:18px;height:18px;border-radius:50%;background:#1A1446}
.vis.pattern .obj{font-size:26px}
.vis.pattern .slot{width:34px;height:34px;border:2px dashed #1A1446;border-radius:8px;display:grid;place-items:center;font-weight:800}
.vis.fraction svg{width:110px;max-height:110px}
.vis.fraction path,.vis.fraction rect{fill:#fff;stroke:#1A1446;stroke-width:1.6}
.vis.fraction .on{fill:#B9B3E0}
.vis.money{gap:6px}
.note,.coin-piece{display:inline-grid;place-items:center;font-weight:800;font-size:13px;border:2px solid #1A1446}
.note{padding:6px 10px;border-radius:6px}
.coin-piece{width:40px;height:40px;border-radius:50%}
.opt .group{max-width:none}
.key{break-before:page;page-break-before:always;margin-top:34px}
.key h2{font-size:18px;margin:0 0 4px}
.key p{font-size:12.5px;color:#4a4570;margin:0 0 10px}
.key ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:6px 12px;font-size:14px}
.key .topics{margin-top:14px}
@media print{.page{padding:0;max-width:none}.noprint{display:none}header{padding-bottom:8px}header svg{width:46px;height:46px}.fill{margin:10px 0 4px}.tip{margin:6px 0 10px}ol.qs{gap:8px}.q{min-height:0;padding:8px 10px 8px 42px;border-radius:12px}.q .n{top:8px}.q .p{margin:0 0 4px;font-size:${little ? 20 : 15}px}.line{margin-top:2px}.line span{height:18px}.vis{margin:0 0 4px}.key ol{font-size:15px;gap:8px 12px}.mv .mv-svg{max-height:100px}.opt-vis .mv-svg{max-height:40px}}
@media (max-width:560px){ol.qs{grid-template-columns:1fr}.fill{grid-template-columns:1fr 1fr}.key ol{grid-template-columns:repeat(2,1fr)}}
.noprint{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#EEF0FF;font-size:13px}
</style></head><body><div class="page">
<p class="noprint">Print this page (Share → Print, or ⋮ → Print in Chrome), or copy the questions onto paper. Answers are on the last page.</p>
<header>${plusFaceSvg({})}<div><h1>${esc(child.name)}’s maths sheet</h1><p>MN Mission Next · ${esc(nice(today))} · ${qs.length} questions · about ${little ? 10 : 15} minutes, no screen</p></div></header>
<div class="fill"><label>Name<span></span></label><label>Time taken<span></span></label><label>Score<span style="border:none;font-size:18px">&nbsp;&nbsp;&nbsp;&nbsp;/ ${qs.length}</span></label></div>
<p class="tip">${little ? 'Read each one together. Count, point and talk it through before writing.' : 'Show your working in the space. Check each answer once you are done.'}</p>
<ol class="qs">${qs.map((x, k) => card(x, k + 1)).join('')}</ol>
<section class="key"><h2>Answers (for parents)</h2><p>Mark it together and praise the trying. Any wrong ones are good to practise in MN next time.</p><ol>${answers}</ol>
<p class="topics"><b>On this sheet:</b> ${topics.map(esc).join(', ')}</p></section>
</div></body></html>`;
}

/**
 * Make a new sheet. As a PDF (the default): A4, answers always on their own page, and the share
 * sheet opens straight away (WhatsApp, Drive, email, a printer). As a web page (html) when the
 * parent asks: saved as a file, as before.
 */
export async function saveWorksheet(app: App, child: Child, format: 'pdf' | 'html' = 'pdf'): Promise<void> {
  try {
    const qs = worksheetQuestions(app, child);
    if (!qs.length) return void app.toast('Play a level first, then the worksheet follows where they are.');
    const page = worksheetHtml(app, child, qs);
    const name = worksheetFileName(child, app.today);
    if (format === 'pdf' && app.native?.sharePdf) {
      app.toast('Making the PDF…', 2500);
      const r = await app.native.sharePdf({ html: page, name: name.replace(/\.html$/, '.pdf'), title: `${child.name}’s maths worksheet` });
      if (r.ok) return;
      // No PDF on this phone: fall back to the web page.
    }
    if (format === 'pdf' && !app.native) {
      // In a browser: open the sheet and its print screen ("Save as PDF" is one of the printers).
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(page);
        w.document.close();
        setTimeout(() => w.print(), 400);
        return;
      }
    }
    const ok = await saveTextFile(app, name, 'text/html', page);
    if (ok) app.toast(`Saved ${name}. Open it and print, or copy it onto paper.`, 5000);
  } catch {
    app.toast('The worksheet couldn’t be made. Please try again.');
  }
}
