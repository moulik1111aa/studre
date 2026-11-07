// MN × previews: tap ? beside a perk and a full-screen preview opens on that feature. Each page
// is one large, detailed mock of the real screen, with numbered notes saying what each part
// does. Swipe for the next feature. The parent's own child's name is used throughout, and their
// real hardest and strongest skills when MN already knows them.

import { esc, html, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { muddleSvg } from './muddles.ts';
import { skillById } from '../core/areas/index.ts';
import { strengths } from '../core/stats.ts';
import { focusFor } from './focus.ts';
import { focusPreview, todayPreview } from './widgets.ts';

export type DemoId = 'focus' | 'report' | 'school' | 'sheets' | 'exam' | 'certs' | 'sync' | 'widgets';
const ORDER: DemoId[] = ['focus', 'report', 'school', 'sheets', 'exam', 'certs', 'sync', 'widgets'];

/** Skill names for the mocks: the child's own when known, else typical ones for their age. */
function names(app: App, c: Child | undefined): { hard: string[]; strong: string[] } {
  const young = (c?.age ?? 8) <= 7;
  const fallback = young
    ? { hard: ['Take away within 20', 'Count on from a number', 'Missing number sums'], strong: ['Add within 10', 'Doubles to 10', 'Count to 100'] }
    : { hard: ['7 and 8 times tables', 'Subtract with borrowing', 'Fractions of amounts'], strong: ['Add 3-digit numbers', '2, 5 and 10 times tables', 'Place value'] };
  if (!c) return fallback;
  const nm = (id: string) => skillById(id)?.name ?? id;
  const plan = focusFor(app, c).skills.map((s) => nm(s.id));
  const { best } = strengths(c.tally ?? {}, 6);
  return { hard: [...plan, ...fallback.hard].slice(0, 3), strong: [...best.map((b) => nm(b.id)), ...fallback.strong].slice(0, 3) };
}

const chg = (t: 'up' | 'down' | 'same', txt: string) => `<i class="dm-chg ${t}">${t === 'up' ? '▲' : t === 'down' ? '▼' : '•'} ${txt}</i>`;
const n = (k: number) => `<span class="dm-n">${k}</span>`;
const phone = (inner: string) => `<div class="dp-phone"><div class="dp-notch"></div><div class="dp-screen">${inner}</div></div>`;

interface Page {
  title: string;
  line: string;
  mock: string;
  notes: string[];
}

function pages(app: App, c: Child | undefined): Record<DemoId, Page> {
  const who = esc(c?.name ?? 'Your child');
  const { hard, strong } = names(app, c);
  const h = hard.map(esc);
  const s = strong.map(esc);
  return {
    focus: {
      title: 'A Focus plan every week',
      line: 'Practice aimed at the skills your child is finding hardest, in short rounds.',
      mock: phone(`<div class="dp-bar"><b>${who}’s Focus plan</b><small>Week of Monday</small></div>
        <div class="dp-card">${n(1)}<p class="dp-cap">This week’s 3 skills</p>
          ${h.map((x, i) => `<div class="dp-sk"><span>${x}</span><b>${[42, 55, 61][i]}% → ${[81, 70, 61][i]}%</b>${chg(i < 2 ? 'up' : 'same', i < 2 ? `+${[39, 15][i]}` : 'steady')}</div>`).join('')}
        </div>
        <div class="dp-card dp-row">${n(2)}<div><p class="dp-cap">Rounds this week</p><div class="dp-dots"><i class="on"></i><i class="on"></i><i></i></div></div><div class="dp-round"><div class="dp-mud">${muddleSvg(4, 0)}</div><small>About 3 minutes</small></div></div>
        <div class="dp-card">${n(3)}<p class="dp-cap">Before → after</p><div class="dp-chart">${[42, 48, 57, 66, 74, 81].map((v) => `<span style="--h:${v}%"><i>${v}</i></span>`).join('')}</div><div class="dp-axis"><small>Mon</small><small>Sun</small></div></div>`),
      notes: [`Each Monday MN picks the 3 skills ${who} finds hardest, from everything they’ve answered.`, 'Your child taps the target on the map for a short round on just those skills. Three a week is the goal.', 'You see each skill’s score before the week and how it changes.'],
    },
    report: {
      title: 'The full report',
      line: 'A quick weekly look: what’s going well, what to help with, and when they play best.',
      mock: phone(`<div class="dp-bar"><b>${who}</b><small>Report · this week</small></div>
        <div class="dp-tiles"><div><b>2 h 10 m</b><small>played</small></div><div><b>86%</b><small>right first time</small></div><div><b>5 days</b><small>in a row</small></div></div>
        <div class="dp-card">${n(1)}<p class="dp-cap">Strengths</p>${s.map((x, i) => `<div class="dp-meter"><span>${x}</span><i style="--v:${[97, 94, 91][i]}%"></i><b>${[97, 94, 91][i]}%</b>${chg(i === 0 ? 'up' : 'same', i === 0 ? '+4' : 'steady')}</div>`).join('')}</div>
        <div class="dp-card">${n(2)}<p class="dp-cap">Practise next</p>${h.map((x, i) => `<div class="dp-meter low"><span>${x}</span><i style="--v:${[58, 63, 69][i]}%"></i><b>${[58, 63, 69][i]}%</b>${chg(i === 0 ? 'down' : 'up', i === 0 ? '−7' : `+${[9, 5][i - 1]}`)}</div>`).join('')}</div>
        <div class="dp-card dp-row">${n(3)}<div class="dp-tod">${[30, 55, 100, 12].map((v, i) => `<span class="${i === 2 ? 'on' : ''}" style="--h:${v}%"></span>`).join('')}</div><div class="dp-todt"><b>Evenings</b><small>Best time of day · 4.1 s per answer</small></div></div>`),
      notes: ['Strengths, so you can praise something specific, with how each one is changing (green up, orange down).', 'The skills to practise next, with their scores.', 'The time of day they do best, and how quickly they answer.'],
    },
    school: {
      title: 'Your school’s syllabus',
      line: 'Choose the topics your child’s class is doing, and the map follows them.',
      mock: phone(`<div class="dp-bar"><b>School syllabus</b><small>${who}</small></div>
        <div class="dp-card">${n(1)}<p class="dp-cap">Board</p><div class="dp-chips"><span class="on">CBSE / NCERT</span><span>ICSE</span><span>Common Core</span></div>
          <p class="dp-cap">Class</p><div class="dp-chips"><span>Class 3</span><span class="on">Class 4</span><span>Class 5</span></div></div>
        <div class="dp-card">${n(2)}<p class="dp-cap">This term’s topics</p>
          ${['Multiply 2-digit by 1-digit', 'Fractions of a shape', 'Perimeter of rectangles', 'Bills and budgets with paise', '24-hour clock', 'Read a protractor'].map((x, i) => `<p class="dp-tick${i < 4 ? ' on' : ''}">${x}</p>`).join('')}
        </div>
        <div class="dp-card dp-row">${n(3)}<div class="dp-map"><i class="done"></i><i class="done"></i><i class="now"></i><i></i><i></i></div><small class="dp-mapt">The map now follows Class 4</small></div>`),
      notes: ['Topic lists for CBSE, ICSE (Classes 1 to 10) and Common Core, in their usual order. MN isn’t linked to or approved by these boards.', 'Tick what the class is doing this term, and add or remove topics any time.', `${who}’s map shows just those topics.`],
    },
    sheets: {
      title: 'Worksheets to print',
      line: 'Screen-free practice from the skills your child is on now, for car rides and quiet evenings.',
      mock: `<div class="dp-paper"><div class="dp-ph"><b>MN worksheet</b><small>${who} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></div>
          ${n(1)}<ol>${['36 × 4 = ______', '¾ of 20 = ______', 'Perimeter of a 6 cm square = ______ cm', '₹250 − ₹87 = ₹______', 'Round 4,567 to the nearest 100: ______', '9 × 7 = ______', '1,204 + 389 = ______', 'Which is bigger: ⅔ or ¾? ______', '84 ÷ 7 = ______', 'Half past 3 in 24-hour time: ______', '5 × 8 × 2 = ______', '600 − 245 = ______'].map((x) => `<li>${x}</li>`).join('')}</ol>
          <div class="dp-pf">${n(2)}<span>12 questions · about 15 minutes</span></div></div>
        <div class="dp-paper back"><div class="dp-ph"><b>Answers</b><small>for the parent</small></div>${n(3)}<ol>${['144', '15', '24', '163', '4,600', '63', '1,593', '¾', '12', '15:30', '80', '355'].map((x) => `<li>${x}</li>`).join('')}</ol></div>`,
      notes: ['Questions from the skills your child is on now, with fresh numbers each time.', 'Short enough to finish in one sitting.', 'An answer page for you, so checking takes a minute.'],
    },
    exam: {
      title: 'Exam practice',
      line: 'A test-style round before a school test: the topics you choose, a clock, and no hints.',
      mock: `<div class="dp-two">${phone(`<div class="dp-bar"><b>📝 Exam practice</b><small>Question 7 of 20 · <span class="dp-clock">13:42</span></small></div>
          <div class="dp-card">${n(1)}<p class="dp-exq">¾ of 20 = ?</p><div class="dp-opts"><span>12</span><span>15</span><span>16</span><span>5</span></div></div>`)}
        ${phone(`<div class="dp-bar"><b>Score sheet</b><small>${who}</small></div>
          <div class="dp-card">${n(2)}<div class="dp-score"><b>16<small>/20</small></b><span>80% · 17:05 min</span></div>
            ${h.map((x, i) => `<div class="dp-meter${i === 0 ? ' low' : ''}"><span>${x}</span><i style="--v:${[50, 83, 100][i]}%"></i><b>${['3/6', '5/6', '8/8'][i]}</b></div>`).join('')}</div>
          <div class="dp-card">${n(3)}<p class="dp-cap">To look at again</p><p class="dp-tick">Q4 · 7 × 8 · answer 56 <em>See how</em></p></div>`)}</div>`,
      notes: ['You pick the topics, 10, 20 or 30 questions, and the time. No right or wrong is shown until the end.', 'Then the score, the time taken and how each topic went.', 'Each question to look at again, with the working. Share the score sheet as a PDF.'],
    },
    certs: {
      title: 'Certificates',
      line: 'Every challenge beaten on the map earns a certificate to print and put up at home.',
      mock: `<div class="dp-cert"><div class="dp-cert-in">${n(1)}<small>MN · Mission Next</small><b class="dp-cert-k">Certificate of Achievement</b><small>This certificate is proudly given to</small><b class="dp-cert-name">${who}</b><span>for finishing Stage 2 and beating Captain Tenbeard.</span><div class="dp-cert-foot"><i></i><em>${n(2)}</em><i></i></div></div></div>`,
      notes: ['One for each challenge beaten, and a bigger one when a stage is finished, with the date it was won.', 'Shared as an A4 PDF: print it, or send it to grandparents on WhatsApp.'],
    },
    sync: {
      title: 'Every phone in step',
      line: 'A tablet at home, a phone in the car, grandma’s phone at the weekend: the same progress everywhere.',
      mock: `<div class="dp-two">${phone(`<div class="dp-bar"><b>${who}</b><small>Your phone</small></div><div class="dp-big">★ 248</div><div class="dp-jar"><i style="--v:72%"></i></div><small class="dp-jt">Treat jar 72%</small>`)}
        <div class="dp-sync">${n(1)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5l2-2.5M20 20v-5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        ${phone(`<div class="dp-bar"><b>${who}</b><small>Tablet</small></div><div class="dp-big">★ 248</div><div class="dp-jar"><i style="--v:72%"></i></div><small class="dp-jt">Treat jar 72%</small>`)}</div>
        <div class="dp-strip">${n(2)}<span>Backed up with your Google account when there’s an internet connection</span></div>
        <div class="dp-strip">${n(3)}<span>New phone? Sign in to bring progress back</span></div>`,
      notes: ['Stars, jars, rewards and the report stay the same on every phone.', 'Saved to your own family space with your Google account.', 'On a new phone, sign in to bring progress back.'],
    },
    widgets: {
      title: 'The Focus widget',
      line: 'This week’s Focus plan on your home screen, so you can see how it’s going without opening MN.',
      mock: `<div class="dp-home">
          <div class="dp-apps">${['#FF8A5C', '#5CC8FF', '#43E0A8', '#A879FF'].map((c) => `<i style="background:${c}"></i>`).join('')}</div>
          <div class="dp-wg">${n(1)}${focusPreview(c)}</div>
          <div class="dp-wg">${n(2)}${todayPreview(app, c, true)}</div>
          <div class="dp-apps">${['#FFD25A', '#FF7AA8', '#6C47FF', '#1FA394'].map((c) => `<i style="background:${c}"></i>`).join('')}</div>
        </div>`,
      notes: [`${who}’s 3 Focus skills, each with its score before the week and now: green when it’s going up.`, 'MN today, free for everyone: days played this week, today’s minutes and the streak.', 'Tap the Focus widget and a Focus round starts.'],
    },
  };
}

/** The full-screen preview, opened on one feature; swipe for the others. */
export function mnxPreviewScreen(start: DemoId, back: (app: App) => Screen, trial: number | null, buy: () => void) {
  return (app: App): Screen => {
    const kids = app.save.data.children;
    const kid = kids.find((c) => c.id === app.save.data.activeChildId) ?? kids[0];
    const P = pages(app, kid);
    const el = html(`<section class="screen mnx-prev" aria-label="MN × preview">
      <header class="dp-top"><button class="dp-x" aria-label="Close the preview">✕</button><b>Preview</b><span class="dp-count"></span></header>
      <div class="dp-pages">${ORDER.map((id) => {
        const p = P[id];
        return `<article class="dp-page" data-id="${id}"><h2>${esc(p.title)}</h2><p class="dp-line">${esc(p.line)}</p><div class="dp-mock">${p.mock}</div>
          <ol class="dp-notes">${p.notes.map((t, i) => `<li>${n(i + 1)}<span>${t}</span></li>`).join('')}</ol><small class="dp-sample">A preview with sample numbers. Results vary from child to child.</small></article>`;
      }).join('')}</div>
      <div class="dp-dots-nav">${ORDER.map((id) => `<button data-go="${id}" aria-label="${esc(P[id].title)}"></button>`).join('')}</div>
      <footer class="dp-foot">${trial ? `<button class="dp-buy">Try ${trial} days free</button>` : '<button class="dp-buy ghost">Done</button>'}</footer>
    </section>`);
    const strip = el.querySelector<HTMLElement>('.dp-pages')!;
    const count = el.querySelector<HTMLElement>('.dp-count')!;
    const dots = [...el.querySelectorAll<HTMLElement>('[data-go]')];
    const paint = () => {
      const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
      count.textContent = `${i + 1} of ${ORDER.length}`;
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    };
    strip.addEventListener('scroll', paint, { passive: true });
    dots.forEach((d) => d.addEventListener('click', () => strip.scrollTo({ left: ORDER.indexOf(d.dataset.go as DemoId) * strip.clientWidth, behavior: 'smooth' })));
    const close = () => void app.show(back);
    el.querySelector('.dp-x')!.addEventListener('click', close);
    el.querySelector('.dp-buy')!.addEventListener('click', () => (trial ? buy() : close()));
    return {
      el,
      back: () => (close(), true),
      mounted: () => {
        strip.scrollLeft = ORDER.indexOf(start) * strip.clientWidth;
        paint();
      },
    };
  };
}
