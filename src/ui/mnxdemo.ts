// MN × demos: tap ? beside a perk and a small mock screen shows what it looks like, with the
// parent's own child's name. Drawn in HTML (no pictures to ship), in the colours of the app.

import { esc } from './app.ts';
import { muddleSvg } from './muddles.ts';

export type DemoId = 'focus' | 'report' | 'school' | 'sheets' | 'sync';

const phone = (inner: string, cls = '') => `<div class="dm-phone ${cls}"><div class="dm-notch"></div><div class="dm-screen">${inner}</div></div>`;
/** A change chip: green up, orange down, grey steady. */
const chg = (t: 'up' | 'down' | 'same', txt: string) => `<i class="dm-chg ${t}">${t === 'up' ? '▲' : t === 'down' ? '▼' : '•'} ${txt}</i>`;

const DEMOS: Record<DemoId, { title: string; line: string; art: (name: string) => string }> = {
  focus: {
    title: 'Focus plan',
    line: 'Each Monday, three short rounds on the skills that are hardest right now. You see the scores rise.',
    art: (n) =>
      phone(`<div class="dm-top"><b>Focus round</b><small>${esc(n)}’s 3 skills</small></div>
        <div class="dm-mud">${muddleSvg(4, 0)}</div>
        <div class="dm-q"><b>7 × 8 = ?</b></div>
        <div class="dm-keys"><span>54</span><span class="ok">56</span><span>48</span></div>`) +
      `<div class="dm-side"><b>This week</b>
        <p><span>7 × 8 facts</span>${chg('up', '42% → 81%')}</p>
        <p><span>Carry the ten</span>${chg('up', '55% → 70%')}</p>
        <p><span>Halves and quarters</span>${chg('same', '64%')}</p></div>`,
  },
  report: {
    title: 'Full report',
    line: 'What they’re great at, what to practise, and how each skill is changing, coloured so you can see it at a glance.',
    art: (n) =>
      phone(`<div class="dm-top"><b>${esc(n)}</b><small>this week</small></div>
        <div class="dm-sec">Strongest</div>
        <div class="dm-bar"><span>Add within 20</span><i style="--v:96%"></i>${chg('up', '+6')}</div>
        <div class="dm-bar"><span>Doubles</span><i style="--v:92%"></i>${chg('same', '0')}</div>
        <div class="dm-sec">Needs help</div>
        <div class="dm-bar low"><span>Take away with a borrow</span><i style="--v:58%"></i>${chg('down', '−9')}</div>
        <div class="dm-bar low"><span>Missing numbers</span><i style="--v:64%"></i>${chg('up', '+12')}</div>
        <div class="dm-sec">Learns best in the</div>
        <div class="dm-tod"><span style="--h:30%"></span><span style="--h:55%"></span><span class="on" style="--h:100%"></span><span style="--h:12%"></span></div>
        <div class="dm-todl"><small>Morning</small><small>Afternoon</small><small><b>Evening</b></small><small>Night</small></div>`),
  },
  school: {
    title: 'School syllabus',
    line: 'Pick the board and class, tick this term’s topics, and the map follows school.',
    art: () =>
      phone(`<div class="dm-top"><b>School syllabus</b></div>
        <div class="dm-chips"><span class="on">CBSE</span><span>ICSE</span><span>Common Core</span></div>
        <div class="dm-sel">Class 4 <small>▾</small></div>
        <div class="dm-sec">This term</div>
        <p class="dm-tick on">Multiply 2-digit numbers</p><p class="dm-tick on">Fractions of a shape</p><p class="dm-tick on">Perimeter</p><p class="dm-tick">Money: bills and budgets</p><p class="dm-tick">Time: 24-hour clock</p>`),
  },
  sheets: {
    title: 'Worksheets',
    line: 'A printable sheet from exactly where they are, with an answer key for you on the last page.',
    art: (n) =>
      `<div class="dm-paper"><div class="dm-ph"><b>MN worksheet</b><small>${esc(n)} · Class 4</small></div>
        <ol><li>36 × 4 = ____</li><li>¾ of 20 = ____</li><li>Perimeter of a 6 cm square = ____</li><li>₹250 − ₹87 = ____</li><li>Round 4,567 to the nearest 100 = ____</li><li>9 × 7 = ____</li></ol>
        <div class="dm-ans">Answers on the last page</div></div>`,
  },
  sync: {
    title: 'Every phone in step',
    line: 'Play on a tablet at home and a phone on the go. Progress follows your child, automatically.',
    art: (n) =>
      `<div class="dm-two">${phone(`<div class="dm-top"><b>${esc(n)}</b></div><div class="dm-big">★ 248</div><small class="dm-dev">Your phone</small>`, 'sm')}
        <div class="dm-sync"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5l2-2.5M20 20v-5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        ${phone(`<div class="dm-top"><b>${esc(n)}</b></div><div class="dm-big">★ 248</div><small class="dm-dev">Tablet</small>`, 'sm')}</div>`,
  },
};

export function demoHtml(id: DemoId, childName: string): string {
  const d = DEMOS[id];
  return `<div class="mnx-demo"><div class="dm-art">${d.art(childName)}</div><h2>${esc(d.title)}</h2><p>${esc(d.line)}</p><small class="dm-note">A preview. Your own child’s numbers show here with MN ×.</small></div>`;
}
