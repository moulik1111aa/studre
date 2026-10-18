// Placement: a few questions for the grown-up ("Can Riya easily do 17 + 34?"), or a short
// "Let them try" check the child plays. Then the path opens at the right place per strand.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS } from '../core/areas/index.ts';
import { Placement, answerFromCheck, type ParentAnswer } from '../core/placement.ts';
import type { Skill } from '../core/skill.ts';
import { createRng } from '../core/rng.ts';
import { makeQuestion } from '../core/path.ts';
import { isCorrect, spoken } from '../core/question.ts';
import { avatarHtml } from './icons.ts';
import { optionHtml } from './visuals.ts';
import { stagger, popIn, wait } from '../render/motion.ts';
import { enterChild } from './flow.ts';

const STRAND_NAMES: Record<string, string> = {
  number: 'Numbers',
  addsub: 'Adding & taking away',
  muldiv: 'Times & sharing',
  fdp: 'Fractions & decimals',
  algebra: 'Algebra & powers',
};

export function placementScreen(child: Child) {
  return (app: App): Screen => {
    const skills = AREAS[0].skills.flat();
    const pl = new Placement(child.age, skills);
    const el = html(`<section class="screen placement" aria-label="Placement">
      <header class="pl-head">${avatarHtml(child.avatar, 56)}<div><p class="chip">For a grown-up</p><h1 class="title">Where should ${esc(child.name)} start?</h1></div></header>
      <div class="pl-body"></div>
    </section>`);
    const body = el.querySelector<HTMLElement>('.pl-body')!;
    let count = 0;

    const finish = () => {
      const plan = pl.result();
      app.save.update(() => {
        for (const id of plan.skipped) child.progress.skipped[id] = true;
        child.placedAt = plan.startAt as Record<string, string>;
        child.placed = true;
        child.placementChecks = plan.skipped.length ? 3 : 0;
      });
      body.innerHTML = `<div class="pl-done card"><div class="big-emoji">🗺️</div><h2>All set!</h2><p>${esc(child.name)}’s path is ready. Next: choose the rewards to work towards.</p><button class="btn go">Choose rewards</button></div>`;
      popIn(body.firstElementChild!);
      body.querySelector('.go')!.addEventListener('click', () => enterChild(app, child, 'fade', false));
    };

    const ask = () => {
      const q = pl.next();
      if (!q) return finish();
      count++;
      const rng = createRng(`${child.id}:${q.skill.id}:${count}`);
      const example = makeQuestion(q.skill, rng, 0.6, new Set());
      body.innerHTML = `<div class="pl-card card">
        <p class="chip">${STRAND_NAMES[q.strand] ?? q.strand} · question ${count}</p>
        <p class="pl-q">Can ${esc(child.name)} easily do this?</p>
        <div class="pl-example">${example.optionObject ? optionHtml(example.answer, example.optionObject) : ''}<b>${esc(example.prompt)}</b></div>
        <p class="pl-skill">${esc(q.skill.name)}</p>
        <div class="pl-answers">
          <button class="btn mint" data-a="yes">Yes, easily</button>
          <button class="btn" data-a="effort">With a little effort</button>
          <button class="btn ghost" data-a="not">Not yet</button>
        </div>
        <button class="btn ghost small try">Not sure? Let ${esc(child.name)} try</button>
      </div>`;
      stagger(body.querySelectorAll('.pl-card > *'), { gap: 60 });
      body.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) =>
        b.addEventListener('click', () => {
          pl.answer(b.dataset.a as ParentAnswer);
          ask();
        }),
      );
      body.querySelector('.try')!.addEventListener('click', () => void tryIt(q.skill).then((a) => {
        pl.answer(a);
        ask();
      }));
    };

    /** Six quick questions the child answers; the score becomes the answer. */
    const tryIt = (skill: Skill): Promise<ParentAnswer> =>
      new Promise((resolve) => {
        const rng = createRng(`${child.id}:try:${skill.id}:${Date.now()}`);
        const seen = new Set<string>();
        let n = 0;
        let right = 0;
        const next = async () => {
          if (n >= 6) {
            body.innerHTML = `<div class="pl-card card"><h2>${right} out of 6!</h2><p>Thanks, ${esc(child.name)}.</p></div>`;
            await wait(1100);
            return resolve(answerFromCheck(right));
          }
          n++;
          const q = makeQuestion(skill, rng, 0.6, seen, 4);
          seen.add(q.key);
          body.innerHTML = `<div class="pl-card card try-card"><p class="chip">${n} of 6</p><h2 class="pl-example"><b>${esc(q.prompt)}</b></h2>
            <div class="choices">${q.choices.map((c) => `<button class="choice" data-v="${encodeURIComponent(c)}">${optionHtml(c, q.optionObject)}</button>`).join('')}</div></div>`;
          app.voice.say(q.speak ?? spoken(q.prompt));
          stagger(body.querySelectorAll('.choice'), { gap: 60 });
          body.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) =>
            b.addEventListener('click', async () => {
              const ok = isCorrect(q, decodeURIComponent(b.dataset.v!));
              if (ok) right++;
              b.classList.add(ok ? 'right' : 'wrong');
              ok ? app.sfx.correct() : app.sfx.wrong();
              await wait(500);
              void next();
            }),
          );
        };
        void next();
      });

    return {
      el,
      mounted: () => {
        stagger(el.querySelector('.pl-head')!.children, { gap: 90 });
        if (child.age <= 4) {
          body.innerHTML = `<div class="pl-card card"><div class="big-emoji">🌼</div><h2>${esc(child.name)} starts at the very beginning</h2><p>Counting, pictures and spoken questions. No reading needed.</p><button class="btn go">Great!</button></div>`;
          body.querySelector('.go')!.addEventListener('click', finish);
          popIn(body.firstElementChild!);
          return;
        }
        ask();
      },
    };
  };
}

/** After placement, a weak early result steps that strand back one skill (spec §3). */
export function stepBackAfterPlacement(child: Child, skill: Skill): void {
  const startId = child.placedAt[skill.strand];
  if (!startId) return;
  const strandSkills = AREAS[0].skills.flat().filter((s) => s.strand === skill.strand);
  const i = strandSkills.findIndex((s) => s.id === startId);
  if (i <= 0) return;
  const prev = strandSkills[i - 1];
  delete child.progress.skipped[prev.id];
  child.placedAt[skill.strand] = prev.id;
}
