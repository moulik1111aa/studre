// Exam practice (MN ×): the parent picks topics, how many questions and the time; the child
// answers like a test (no right or wrong until the end); then a score sheet with each topic,
// the questions to look at again (with "See how") and a PDF to share.

import { esc, html, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS, skillById } from '../core/areas/index.ts';
import { makeQuestion } from '../core/path.ts';
import { createRng } from '../core/rng.ts';
import { isCorrect, type Question } from '../core/question.ts';
import { defaultPick, EXAM_KEEP, EXAM_PACES, EXAM_SIZES, examPlan, examVerdict, learnedSkills, scoreExam, type ExamRecord } from '../core/exam.ts';
import { mountAnswers, escPrompt } from './answerpad.ts';
import { visualHtml, prettyAnswer } from './visuals.ts';
import { fitCard, stagger } from '../render/motion.ts';
import { showLesson } from './lesson.ts';
import { worldVars } from './worlds.ts';
import { ICONS } from './icons.ts';
import { plusFaceSvg } from './plus.ts';
import { fileSafe, sharePage } from './pdfshare.ts';
import { mnxIncluded } from './membership.ts';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDay = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const skillName = (id: string) => skillById(id)?.name ?? id;
const pct = (ok: number, n: number) => (n ? Math.round((100 * ok) / n) : 0);

/** Parent area → a child → Exam practice: choose, then hand over. */
export function examSetupScreen(child: Child, back: (app: App) => Screen) {
  return (app: App): Screen => {
    const learned = learnedSkills(app.pathFor(child), child.progress);
    const picked = new Set(defaultPick(learned));
    let size: number = child.age <= 6 ? 10 : 20;
    let pace: number = child.age <= 6 ? 0 : 60;
    const byStage = new Map<number, string[]>();
    for (const id of learned) {
      const st = skillById(id)?.stage ?? 1;
      byStage.set(st, [...(byStage.get(st) ?? []), id]);
    }
    const past = (child.exams ?? []).slice(-3).reverse();
    const el = html(`<section class="screen limits exam-setup" aria-label="Exam practice">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">Exam practice</span><span style="width:50px"></span></header>
      <div class="scroll lim-body ex-body">
        ${mnxIncluded(app)}<p class="ex-why">A test-style round for ${esc(child.name)}: no hints and no right or wrong until the end, then a score sheet you can share.</p>
        ${
          learned.length
            ? `<h2 class="pa-h">Topics</h2>
        <div class="ex-topics">${[...byStage]
          .reverse()
          .map(([st, ids], k) => `<details class="card ex-stage"${k === 0 ? ' open' : ''}><summary class="ex-st"><b>Stage ${st}</b><span>${esc(AREAS[0].stages[st - 1]?.name ?? '')}</span><em class="ex-picked" data-st="${st}"></em></summary><div class="ex-chips">${ids.map((id) => `<button class="ex-chip${picked.has(id) ? ' on' : ''}" aria-pressed="${picked.has(id)}" data-id="${esc(id)}" data-st="${st}">${esc(skillName(id))}</button>`).join('')}</div><button class="linkish ex-all" data-st="${st}">Pick all in Stage ${st}</button></details>`)
          .join('')}</div>
        <h2 class="pa-h">Questions</h2>
        <div class="seg seg3 ex-size" role="radiogroup" aria-label="Number of questions">${EXAM_SIZES.map((n) => `<button class="seg-b${n === size ? ' on' : ''}" role="radio" aria-checked="${n === size}" data-n="${n}"><b>${n}</b></button>`).join('')}</div>
        <h2 class="pa-h">Time</h2>
        <div class="seg seg3 ex-pace" role="radiogroup" aria-label="Time allowed">${EXAM_PACES.map((s) => `<button class="seg-b${s === pace ? ' on' : ''}" role="radio" aria-checked="${s === pace}" data-s="${s}"><b>${s ? `${s === 60 ? '1 min' : `${s} s`}` : 'No limit'}</b><small>${s ? 'per question' : 'take your time'}</small></button>`).join('')}</div>`
            : `<div class="card ex-empty"><p>Exam practice uses the topics ${esc(child.name)} has already learned. Play a few levels on the map first.</p></div>`
        }
        ${past.length ? `<h2 class="pa-h">Last results</h2><div class="card ex-past">${past.map((r) => `<p><span>${esc(niceDay(r.d))}</span><b>${r.ok} / ${r.n}</b><small>${pct(r.ok, r.n)}%</small></p>`).join('')}</div>` : ''}
      </div>
      <footer class="lim-foot"><button class="btn mint ex-start"${learned.length ? '' : ' disabled'}>Start the exam</button></footer>
    </section>`);
    const start = el.querySelector<HTMLButtonElement>('.ex-start')!;
    const paintStart = () => {
      el.querySelectorAll<HTMLElement>('.ex-picked').forEach((e) => {
        const k = (byStage.get(Number(e.dataset.st)) ?? []).filter((id) => picked.has(id)).length;
        e.textContent = k ? `${k} picked` : '';
      });
      start.disabled = !picked.size;
      start.textContent = picked.size ? `Start: ${size} questions` : 'Pick at least one topic';
    };
    if (learned.length) paintStart();
    el.querySelectorAll<HTMLElement>('.ex-chip').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.id!;
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
        b.classList.toggle('on', picked.has(id));
        b.setAttribute('aria-pressed', String(picked.has(id)));
        paintStart();
      }),
    );
    el.querySelectorAll<HTMLElement>('.ex-all').forEach((a) =>
      a.addEventListener('click', () => {
        const ids = byStage.get(Number(a.dataset.st)) ?? [];
        const all = ids.every((id) => picked.has(id));
        for (const id of ids) all ? picked.delete(id) : picked.add(id);
        a.closest('.ex-stage')!.querySelectorAll<HTMLElement>('.ex-chip').forEach((b) => (b.classList.toggle('on', picked.has(b.dataset.id!)), b.setAttribute('aria-pressed', String(picked.has(b.dataset.id!)))));
        paintStart();
      }),
    );
    const seg = (sel: string, attr: string, set: (v: number) => void) =>
      el.querySelectorAll<HTMLElement>(`${sel} .seg-b`).forEach((b) =>
        b.addEventListener('click', () => {
          set(Number(b.dataset[attr]));
          el.querySelectorAll(`${sel} .seg-b`).forEach((x) => (x.classList.toggle('on', x === b), x.setAttribute('aria-checked', String(x === b))));
          paintStart();
        }),
      );
    seg('.ex-size', 'n', (v) => (size = v));
    seg('.ex-pace', 's', (v) => (pace = v));
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(back));
    start.addEventListener('click', async () => {
      const { result } = app.sheet(
        `<h2>📝 Hand the phone to ${esc(child.name)}</h2><p>${size} questions${pace ? `, ${clock(size * pace)} minutes in all` : ', no time limit'}. Answer each one, or skip it and keep going. The score comes at the end.</p>`,
        [
          { label: 'Start', value: true, kind: 'mint' },
          { label: 'Not yet', value: false, kind: 'ghost', back: true },
        ],
        'Exam practice',
      );
      if (await result) void app.show(examScreen(child, [...picked], size, pace, back), 'liquid');
    });
    return { el, mounted: () => stagger(el.querySelectorAll('.ex-body > *'), { gap: 30 }), back: () => (void app.show(back), true) };
  };
}

/** The paper itself. */
export function examScreen(child: Child, skillIds: string[], n: number, pace: number, back: (app: App) => Screen) {
  return (app: App): Screen => {
    const rng = createRng(`${child.id}:exam:${Date.now()}`);
    const plan = examPlan(skillIds, n, rng, child.age, (id) => skillById(id)?.stage ?? 1);
    const qs: Question[] = [];
    for (const p of plan) {
      const s = skillById(p.skillId);
      if (!s) continue;
      qs.push(makeQuestion(s, rng, p.d, new Set(child.progress.history[s.id] ?? []), undefined, qs.at(-1)?.key, qs));
    }
    const given: (string | null)[] = qs.map(() => null);
    const limit = pace * qs.length;
    const stage = skillById(skillIds[0])?.stage ?? 1;
    const el = html(`<section class="screen play exam" style="${worldVars(stage)}" aria-label="Exam practice">
      <header class="play-top">
        <button class="icon-btn quit" aria-label="Stop the exam">${ICONS.back}</button>
        <div class="play-title"><b>📝 Exam practice</b><span class="ex-count"></span></div>
        ${limit ? '<span class="ex-clock" role="timer" aria-live="off"></span>' : '<span style="width:50px"></span>'}
      </header>
      <div class="ex-bar" aria-hidden="true"><i></i></div>
      <main class="qwrap" aria-live="polite"></main>
      <footer class="answers"></footer>
      <button class="linkish ex-skip">Skip this one</button>
    </section>`);
    const qwrap = el.querySelector<HTMLElement>('.qwrap')!;
    const answers = el.querySelector<HTMLElement>('.answers')!;
    const count = el.querySelector<HTMLElement>('.ex-count')!;
    const bar = el.querySelector<HTMLElement>('.ex-bar i')!;
    const clockEl = el.querySelector<HTMLElement>('.ex-clock');
    const t0 = Date.now();
    let i = 0;
    let over = false;
    let tick = 0;

    const finish = () => {
      if (over) return;
      over = true;
      clearInterval(tick);
      app.voice.stop();
      const sec = Math.round((Date.now() - t0) / 1000);
      const right = qs.map((q, k) => given[k] !== null && isCorrect(q, given[k]!));
      const { ok, skills } = scoreExam(qs, right);
      const rec: ExamRecord = { t: Date.now(), d: app.today, n: qs.length, ok, sec: limit ? Math.min(sec, limit) : sec, limit, skills };
      app.save.update(() => {
        child.exams = [...(child.exams ?? []), rec].slice(-EXAM_KEEP);
        child.stats.secondsByDay[app.today] = (child.stats.secondsByDay[app.today] ?? 0) + rec.sec;
      });
      void app.show(examResultScreen(child, rec, qs, given, back), 'liquid');
    };

    const show = () => {
      if (i >= qs.length) return finish();
      const q = qs[i];
      count.textContent = `Question ${i + 1} of ${qs.length}`;
      bar.style.transform = `scaleX(${i / qs.length})`;
      qwrap.innerHTML = `<article class="qcard${q.visual ? ' has-vis' : ''}">
        ${q.visual ? visualHtml(q.visual, q.key) : ''}
        <h2 class="prompt${q.prompt.length > 34 ? ' long' : ''}${q.prompt.length > 70 ? ' xlong' : ''}">${escPrompt(q.prompt)}</h2>
      </article>`;
      const card = qwrap.firstElementChild as HTMLElement;
      if (app.debug) card.dataset.answer = q.answer;
      mountAnswers(app, answers, q, () => over, (v) => {
        given[i] = v;
        i++;
        show();
      });
      fitCard(card, qwrap);
      app.voice.say(q.speak ?? '');
    };

    el.querySelector('.ex-skip')!.addEventListener('click', () => {
      if (over) return;
      i++;
      show();
    });
    const leave = async () => {
      const { result } = app.sheet(`<h2>Stop the exam?</h2><p>Answers so far won’t be marked.</p>`, [
        { label: 'Keep going', value: false, kind: 'mint', back: true },
        { label: 'Stop', value: true, kind: 'ghost' },
      ], 'Stop the exam');
      if (await result) {
        over = true;
        clearInterval(tick);
        void app.show(back);
      }
    };
    el.querySelector('.quit')!.addEventListener('click', () => void leave());
    return {
      el,
      mounted: () => {
        show();
        if (clockEl) {
          const paint = () => {
            const left = Math.max(0, limit - (Date.now() - t0) / 1000);
            clockEl.textContent = clock(left);
            clockEl.classList.toggle('low', left < 60);
            if (left <= 0) finish();
          };
          paint();
          tick = window.setInterval(paint, 500);
        }
      },
      back: () => (void leave(), true),
      destroy: () => clearInterval(tick),
      keepAwake: true,
    };
  };
}

/** The score sheet: what went well, what to practise, and each question to look at again. */
export function examResultScreen(child: Child, rec: ExamRecord, qs: Question[], given: (string | null)[], back: (app: App) => Screen) {
  return (app: App): Screen => {
    const wrong = qs.map((q, k) => ({ q, k, g: given[k] })).filter((x) => x.g === null || !isCorrect(x.q, x.g));
    const topics = Object.entries(rec.skills).sort(([, a], [, b]) => a[1] / a[0] - b[1] / b[0]);
    const p = pct(rec.ok, rec.n);
    const el = html(`<section class="screen limits exam-result" aria-label="Exam result">
      <header class="topbar"><span style="width:50px"></span><span class="t">Exam result</span><span style="width:50px"></span></header>
      <div class="scroll lim-body ex-body">
        <div class="card ex-score"><div class="ex-ring" style="--p:${p}"><b>${rec.ok}<small>/ ${rec.n}</small></b></div><div><h2>${esc(examVerdict(rec.ok, rec.n))}</h2><p>${p}% right · time ${clock(rec.sec)}${rec.limit ? ` of ${clock(rec.limit)}` : ''}</p></div></div>
        <h2 class="pa-h">By topic</h2>
        <div class="card ex-tp">${topics.map(([id, [n, ok]]) => `<div class="ex-row"><span>${esc(skillName(id))}</span><i style="--v:${pct(ok, n)}%"></i><b>${ok}/${n}</b></div>`).join('')}</div>
        ${
          wrong.length
            ? `<h2 class="pa-h">To look at again</h2><div class="ex-wrong">${wrong
                .map(({ q, k, g }) => `<div class="card ex-w"><p class="ex-q"><span class="ex-n">${k + 1}</span>${escPrompt(q.prompt)}</p><p class="ex-a">${g === null ? '<span class="ex-skipped">Skipped</span>' : `<span class="ex-yours">${prettyAnswer(g)}</span>`}<span class="ex-right">Answer: ${prettyAnswer(q.answer)}</span></p>${q.teach ? `<button class="btn ghost small ex-how" data-k="${k}">See how</button>` : ''}</div>`)
                .join('')}</div>`
            : '<p class="card ex-all-right">Every question right. 🎉</p>'
        }
      </div>
      <footer class="lim-foot ex-foot"><button class="btn ghost ex-share">Share as PDF</button><button class="btn mint ex-done">Done</button></footer>
    </section>`);
    el.querySelectorAll<HTMLElement>('.ex-how').forEach((b) => b.addEventListener('click', () => void showLesson(app, qs[Number(b.dataset.k)], given[Number(b.dataset.k)])));
    el.querySelector('.ex-share')!.addEventListener('click', () => void sharePage(app, { html: examSheetHtml(child, rec, qs, given), name: `MN-${fileSafe(child.name)}-exam-${rec.d}`, title: `${child.name}’s exam result` }));
    el.querySelector('.ex-done')!.addEventListener('click', () => void app.show(back));
    return {
      el,
      mounted: () => {
        stagger(el.querySelectorAll('.ex-body > *'), { gap: 40 });
        if (rec.ok / Math.max(1, rec.n) >= 0.75) {
          const r = el.querySelector('.ex-ring')!.getBoundingClientRect();
          app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 30);
        }
        app.voice.say(`${examVerdict(rec.ok, rec.n)} You got ${rec.ok} out of ${rec.n}.`);
      },
      back: () => (void app.show(back), true),
    };
  };
}

/** The score sheet as a printable A4 page, for the PDF. */
export function examSheetHtml(child: Child, rec: ExamRecord, qs: Question[], given: (string | null)[]): string {
  const rows = qs
    .map((q, k) => {
      const g = given[k];
      const ok = g !== null && isCorrect(q, g);
      return `<tr class="${ok ? 'ok' : 'no'}"><td>${k + 1}</td><td>${escPrompt(q.prompt)}</td><td>${g === null ? '<i>skipped</i>' : prettyAnswer(g)}</td><td>${prettyAnswer(q.answer)}</td><td>${ok ? '✓' : '✗'}</td></tr>`;
    })
    .join('');
  const topics = Object.entries(rec.skills)
    .map(([id, [n, ok]]) => `<li><span>${esc(skillName(id))}</span><b>${ok} / ${n}</b></li>`)
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(child.name)}’s exam result</title><style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1A1446;background:#fff}
header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1A1446;padding-bottom:10px}
header svg{width:52px;height:52px}h1{margin:0;font-size:24px}header p{margin:2px 0 0;font-size:13px;color:#4a4570}
.sum{display:flex;gap:18px;margin:16px 0;align-items:center}
.big{font-size:40px;font-weight:900}.big small{font-size:18px;color:#4a4570}
.sum p{margin:0;font-size:14px;color:#4a4570}
h2{font-size:16px;margin:16px 0 6px}
ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:13.5px}
li{display:flex;justify-content:space-between;border-bottom:1px solid #E2DFF3;padding:4px 0}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #E2DFF3;vertical-align:top}
th{font-size:12px;color:#4a4570}
tr{break-inside:avoid}
tr.no td:last-child{color:#C2410C;font-weight:800}tr.ok td:last-child{color:#15803D;font-weight:800}
.frac{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:.8em;line-height:1.05;margin:0 2px}.frac sup{border-bottom:1.5px solid currentColor;padding:0 2px}.frac sub,.frac sup{vertical-align:baseline;font-size:1em}
footer{margin-top:16px;font-size:11.5px;color:#6b6790}
</style></head><body>
<header>${plusFaceSvg({})}<div><h1>${esc(child.name)}’s exam practice</h1><p>MN Mission Next · ${esc(niceDay(rec.d))}</p></div></header>
<div class="sum"><div class="big">${rec.ok}<small> / ${rec.n}</small></div><p><b>${pct(rec.ok, rec.n)}% right.</b> ${esc(examVerdict(rec.ok, rec.n))}<br>Time: ${clock(rec.sec)} minutes${rec.limit ? ` (of ${clock(rec.limit)} allowed)` : ''}</p></div>
<h2>By topic</h2><ul>${topics}</ul>
<h2>Every question</h2>
<table><thead><tr><th>#</th><th>Question</th><th>Answer given</th><th>Right answer</th><th></th></tr></thead><tbody>${rows}</tbody></table>
<footer>Questions with a picture are shown as text here. Practice papers from MN; not an official exam.</footer>
</body></html>`;
}
