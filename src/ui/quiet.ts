// Bedtime on screen: the calm "time to sleep" / "school time" stop, and the parent-area
// page where a parent sets bedtime and school time.

import { plusSvg } from './plus.ts';
import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { stagger, popIn } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { ICONS } from './icons.ts';
import { DEFAULT_QUIET, UNLOCK_MINUTES, dayShort, niceTime, quietAt, quietOf, type QuietNow, type QuietSettings } from '../core/quiet.ts';

/** Bedtime or school time right now (null when MN is open). */
export function quietNow(app: App): QuietNow | null {
  const st = app.save.data.settings;
  return quietAt(st.quiet, new Date(), st.holiday, st.quietUnlockUntil ?? 0);
}

/** The stop screen. `then` runs after a parent unlocks it. */
export function quietScreen(child: Child, q: QuietNow, then: () => void) {
  return (app: App): Screen => {
    const bed = q.kind === 'bed';
    const title = bed ? `Time to sleep, ${child.name}` : `School time, ${child.name}!`;
    const line = bed ? `MN opens again at ${niceTime(q.until)}. Sleep well, your jar will be waiting.` : `MN opens again at ${niceTime(q.until)}. Learn lots today!`;
    const sky = bed
      ? `<div class="moon" aria-hidden="true"><span>🌙</span>${plusSvg({ sleep: true, cls: 'sleepy' })}${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};left:${(i * 37) % 95}%;top:${(i * 53) % 70}%"></i>`).join('')}</div>`
      : `<div class="moon sun" aria-hidden="true"><span>🏫</span>${plusSvg({ cls: 'alive school-plus' })}</div>`;
    const el = html(`<section class="screen timesup quiet-${q.kind}" aria-label="${bed ? 'Bedtime' : 'School time'}">
      ${sky}
      <h1 class="title">${esc(title)}</h1>
      <p class="subtitle">${esc(line)}</p>
      <button class="btn ghost back-btn">OK</button>
      <button class="linkish quiet-unlock">Parent: unlock for ${UNLOCK_MINUTES} minutes</button>
    </section>`);
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(whosPlayingScreen));
    el.querySelector('.quiet-unlock')!.addEventListener('click', async () => {
      if (!(await app.grownUp(bed ? 'Unlock bedtime' : 'Unlock school time'))) return;
      app.save.update((d) => (d.settings.quietUnlockUntil = Date.now() + UNLOCK_MINUTES * 60_000));
      app.toast(`Unlocked for ${UNLOCK_MINUTES} minutes.`);
      then();
    });
    return {
      el,
      back: () => (void app.show(whosPlayingScreen), true),
      mounted: () => {
        popIn(el.querySelector('.moon span')!);
        stagger(el.querySelectorAll('.title, .subtitle, .btn, .linkish'), { delay: 300, gap: 120 });
        app.voice.say(`${title}. ${line}`);
      },
    };
  };
}

/** Parent area → Daily play → Bedtime. */
export function quietSettingsScreen(back: (app: App) => Screen) {
  return (app: App): Screen => {
    const q: QuietSettings = quietOf(app.save.data.settings.quiet);
    const save = () => app.save.update((d) => (d.settings.quiet = JSON.parse(JSON.stringify(q)) as QuietSettings));
    const time = (id: string, v: string, label: string) => `<label class="qt-time"><small>${label}</small><input type="time" data-t="${id}" value="${esc(v)}" step="300"></label>`;
    const el = html(`<section class="screen parent quiet-set" aria-label="Bedtime">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Bedtime</span><span style="width:50px"></span></header>
      <div class="scroll pa-body">
        <p class="fine qs-why">At these times MN shows a calm stop screen instead of levels. A parent can still unlock it for ${UNLOCK_MINUTES} minutes.</p>
        <div class="card qs-card">
          <label class="toggle-row"><span><b>Bedtime</b><small>No play from bedtime until morning.</small></span><input type="checkbox" role="switch" data-on="bed" ${q.bed.on ? 'checked' : ''}></label>
          <div class="qt-row" data-for="bed"${q.bed.on ? '' : ' hidden'}>${time('bed.from', q.bed.from, 'From')}${time('bed.to', q.bed.to, 'Until')}</div>
        </div>
        <div class="card qs-card">
          <label class="toggle-row"><span><b>School time</b><small>Not in pause rewards.</small></span><input type="checkbox" role="switch" data-on="school" ${q.school.on ? 'checked' : ''}></label>
          <div class="qt-row" data-for="school"${q.school.on ? '' : ' hidden'}>${time('school.from', q.school.from, 'From')}${time('school.to', q.school.to, 'Until')}</div>
          <div class="qt-days" data-for="school" role="group" aria-label="School days"${q.school.on ? '' : ' hidden'}>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="qt-day${q.school.days.includes(d) ? ' on' : ''}" data-day="${d}" aria-pressed="${q.school.days.includes(d)}">${dayShort(d)}</button>`).join('')}</div>
        </div>
        <button class="linkish qs-reset">Back to the usual times</button>
      </div>
    </section>`);
    const go = () => void app.show(back);
    el.querySelector('.back-btn')!.addEventListener('click', go);
    el.querySelectorAll<HTMLInputElement>('[data-on]').forEach((i) =>
      i.addEventListener('change', () => {
        const k = i.dataset.on as 'bed' | 'school';
        q[k].on = i.checked;
        el.querySelectorAll<HTMLElement>(`[data-for="${k}"]`).forEach((x) => (x.hidden = !i.checked));
        save();
      }),
    );
    el.querySelectorAll<HTMLInputElement>('[data-t]').forEach((i) =>
      i.addEventListener('change', () => {
        if (!/^\d{2}:\d{2}$/.test(i.value)) return;
        const [k, end] = i.dataset.t!.split('.') as ['bed' | 'school', 'from' | 'to'];
        q[k][end] = i.value;
        save();
      }),
    );
    el.querySelectorAll<HTMLButtonElement>('.qt-day').forEach((b) =>
      b.addEventListener('click', () => {
        const d = Number(b.dataset.day);
        const set = new Set(q.school.days);
        if (set.has(d)) set.delete(d);
        else set.add(d);
        q.school.days = [...set].sort();
        b.classList.toggle('on', set.has(d));
        b.setAttribute('aria-pressed', String(set.has(d)));
        save();
      }),
    );
    el.querySelector('.qs-reset')!.addEventListener('click', () => {
      app.save.update((d) => (d.settings.quiet = { bed: { ...DEFAULT_QUIET.bed, on: q.bed.on }, school: { ...DEFAULT_QUIET.school, on: q.school.on } }));
      void app.show(quietSettingsScreen(back));
    });
    return { el, back: () => (go(), true), mounted: () => stagger(el.querySelectorAll('.pa-body > *'), { gap: 40 }) };
  };
}
