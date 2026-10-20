// School path: a grown-up picks the child's board and class; the skills for that class come
// ticked, and any can be added or removed. While it's on, the child's map shows only those
// skills (with their own minion fights and bosses). Switching back to the age path keeps
// all progress, because skill levels are shared.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child, SchoolPath } from '../storage/save.ts';
import { BOARDS, boardById, gradeOf, gradeForAge } from '../core/curricula.ts';
import { AREAS } from '../core/areas/index.ts';
import { stopsHtml } from './setup.ts';
import { stagger } from '../render/motion.ts';

const STRANDS: Record<string, string> = {
  number: 'Numbers and place value',
  addsub: 'Adding and subtracting',
  muldiv: 'Times tables and division',
  fdp: 'Fractions, decimals and percent',
  algebra: 'Algebra and powers',
  mental: 'Mental maths',
  word: 'Word problems and money',
};

export function schoolLabel(sp: SchoolPath): string {
  const g = gradeOf(sp.board, sp.grade);
  const b = boardById(sp.board);
  return b && g ? `${b.name} · ${g.label}` : 'Custom path';
}

export function schoolScreen(child: Child, back: (app: App) => Screen) {
  return (app: App): Screen => {
    const prev = child.school;
    let board = prev?.board ?? '';
    let grade = prev?.grade ?? '';
    let picked = new Set(prev?.skills ?? []);
    let step = 0;
    const LABELS = ['School', 'Class', 'Skills'];
    const all = AREAS[0].skills.flat();
    const el = html(`<section class="screen limits school" aria-label="School path">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">←</button><span class="t">${esc(child.name)}’s path</span><span style="width:50px"></span></header>
      <div class="stops-slot"></div>
      <div class="scroll lim-body"></div>
      <footer class="lim-foot"><button class="btn done">Next</button></footer>
    </section>`);
    const body = el.querySelector<HTMLElement>('.lim-body')!;
    const next = el.querySelector<HTMLButtonElement>('.done')!;

    const skillRow = (id: string) => {
      const s = all.find((x) => x.id === id)!;
      return `<label class="sc-skill"><input type="checkbox" data-s="${s.id}" ${picked.has(s.id) ? 'checked' : ''}><span>${esc(s.name)}</span></label>`;
    };
    const paint = () => {
      el.querySelector('.stops-slot')!.innerHTML = stopsHtml(LABELS, step);
      if (step === 0) {
        body.innerHTML = `<div class="card lim-card lim-one"><h2 class="ac-q">Which school curriculum does ${esc(child.name)} follow?</h2>
          <div class="seg seg-col">${BOARDS.map((b) => `<button class="seg-b${board === b.id ? ' on' : ''}" data-b="${b.id}"><b>${esc(b.name)}</b><small>${esc(b.country)}: ${esc(b.note)}</small></button>`).join('')}
          <button class="seg-b${board === '' ? ' on' : ''}" data-b=""><b>No school path</b><small>Follow the app’s path for their age (every skill)</small></button></div>
          <p class="fine">Covers number work, fractions, percent and algebra. Shapes, measuring and data aren’t in the app yet.</p></div>`;
        body.querySelectorAll<HTMLElement>('[data-b]').forEach((b) =>
          b.addEventListener('click', () => {
            if (board !== b.dataset.b) grade = '';
            board = b.dataset.b!;
            body.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('on', x === b));
            next.textContent = board ? 'Next' : 'Save';
          }),
        );
        next.textContent = board ? 'Next' : 'Save';
        next.disabled = false;
      } else if (step === 1) {
        const b = boardById(board)!;
        const usual = gradeForAge(b, child.age).id;
        body.innerHTML = `<div class="card lim-card lim-one"><h2 class="ac-q">Which ${b.id === 'ccss' ? 'grade' : 'class'} is ${esc(child.name)} in?</h2>
          <div class="sc-grades">${b.grades.map((g) => `<button class="seg-b${grade === g.id ? ' on' : ''}" data-g="${g.id}"><b>${esc(g.label)}</b>${g.id === usual ? '<em>Usual for age ' + child.age + '</em>' : ''}<small>${g.skills.length} skills</small></button>`).join('')}</div></div>`;
        body.querySelectorAll<HTMLElement>('[data-g]').forEach((x) =>
          x.addEventListener('click', () => {
            if (grade !== x.dataset.g) picked = new Set(gradeOf(board, x.dataset.g!)!.skills);
            grade = x.dataset.g!;
            body.querySelectorAll('[data-g]').forEach((y) => y.classList.toggle('on', y === x));
            next.disabled = false;
          }),
        );
        next.textContent = 'Next';
        next.disabled = !grade;
      } else {
        const g = gradeOf(board, grade)!;
        const inClass = new Set(g.skills);
        const groups = Object.entries(STRANDS)
          .map(([k, name]) => [name, all.filter((s) => s.strand === k && inClass.has(s.id))] as const)
          .filter(([, xs]) => xs.length);
        const others = AREAS[0].skills.map((st, i) => [i + 1, st.filter((s) => !inClass.has(s.id))] as const).filter(([, xs]) => xs.length);
        body.innerHTML = `<div class="card lim-card"><h2 class="ac-q">The ${esc(g.label)} skills</h2>
            <p class="fine sc-count"></p>
            ${groups.map(([name, xs]) => `<h3 class="sc-h">${esc(name)}</h3>${xs.map((s) => skillRow(s.id)).join('')}`).join('')}
          </div>
          <details class="card sc-more"><summary><b>Add skills from other classes</b><small>Revision, or going ahead</small></summary>
            ${others.map(([stage, xs]) => `<h3 class="sc-h">${esc(AREAS[0].stages[stage - 1].name)} · ages ${AREAS[0].stages[stage - 1].ages}</h3>${xs.map((s) => skillRow(s.id)).join('')}`).join('')}
          </details>`;
        const count = () => {
          body.querySelector('.sc-count')!.textContent = `${picked.size} skills ticked. Untick any your child doesn’t need.`;
          next.disabled = !picked.size;
        };
        body.querySelectorAll<HTMLInputElement>('[data-s]').forEach((c) =>
          c.addEventListener('change', () => {
            if (c.checked) picked.add(c.dataset.s!);
            else picked.delete(c.dataset.s!);
            count();
          }),
        );
        count();
        next.textContent = 'Save path';
      }
      stagger(body.querySelectorAll('.lim-card > *'), { gap: 40 });
    };
    const save = () => {
      app.save.update(() => {
        if (!board) {
          if (child.school) child.school.on = false;
        } else child.school = { board, grade, skills: all.filter((s) => picked.has(s.id)).map((s) => s.id), on: true };
      });
      app.toast(board ? `${child.name} now follows ${schoolLabel(child.school!)}.` : `${child.name} follows the path for their age.`);
      void app.show(back);
    };
    next.addEventListener('click', () => {
      if (next.disabled) return;
      if (step === 0 && !board) return save();
      if (step < 2) {
        step++;
        if (step === 2 && !picked.size) picked = new Set(gradeOf(board, grade)!.skills);
        paint();
      } else save();
    });
    el.querySelector('.stops-slot')!.addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('[data-stop]');
      if (li && Number(li.dataset.stop) < step) {
        step = Number(li.dataset.stop);
        paint();
      }
    });
    const goBack = () => {
      if (step > 0) {
        step--;
        paint();
      } else void app.show(back);
    };
    el.querySelector('.back-btn')!.addEventListener('click', goBack);
    return { el, mounted: paint, back: () => (goBack(), true) };
  };
}
