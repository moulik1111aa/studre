// The Parent area's Guide: everything MN does, what's free and what comes with MN ×, and how
// families get the most from each part. Other Parent pages link here ("Learn") so a parent can
// read about a setting where they meet it; each Guide card can take them back to the setting.

import { esc } from './app.ts';
import { ICONS } from './icons.ts';

export type GuideGroup = 'teach' | 'rewards' | 'charge' | 'progress' | 'extras';
/** Where "Take me there" goes: a Parent tab and the element to show, or a screen. */
export type GuideGo = { tab: 'kids' | 'sound' | 'app' | 'premium' | 'help'; sel: string } | 'skills' | 'story' | 'child' | 'report';

export interface GuideItem {
  id: string;
  group: GuideGroup;
  icon: string;
  name: string;
  /** 'plus': comes with MN ×; 'part': free, with more in MN ×. */
  plan: 'free' | 'plus' | 'part';
  what: string;
  best: string;
  /** For 'part': what MN × adds. */
  more?: string;
  go?: GuideGo;
  goLabel?: string;
}

export const GUIDE_GROUPS: { id: GuideGroup; title: string; line: string }[] = [
  { id: 'teach', title: 'How MN teaches', line: 'A path of skills, short lessons, and second tries.' },
  { id: 'rewards', title: 'Rewards that work', line: 'Real treats, earned with steady effort.' },
  { id: 'charge', title: 'You stay in charge', line: 'Time, bedtime and settings stay in your hands.' },
  { id: 'progress', title: 'Seeing how they’re doing', line: 'What they’re good at, and what needs help.' },
  { id: 'extras', title: 'Extras', line: 'For school, for the fridge door, and for the home screen.' },
];

export const GUIDE: GuideItem[] = [
  // How MN teaches
  { id: 'path', group: 'teach', icon: ICONS.map, name: 'The map of skills', plan: 'free', what: 'Each child follows a path of skills made for their age. Every skill has five steps: Learn, Practice, Practise more, Speed and Master, and each step wins up to 3 stars.', best: 'Let them play the next level rather than jumping around: each skill builds on the one before.', go: 'story', goLabel: 'Watch how MN works' },
  { id: 'teach', group: 'teach', icon: ICONS.bulb, name: 'Lessons after a mistake', plan: 'free', what: 'A wrong answer opens a short, step-by-step lesson with pictures, then a similar question to try.', best: 'Keep it on for younger children. If an older child finds it slow, it can be turned off.', go: { tab: 'kids', sel: '.toggle-row:has([data-k="teach"])' } },
  { id: 'fixit', group: 'teach', icon: ICONS.check, name: 'Fix-it', plan: 'free', what: 'Questions like the ones your child missed come back for another go, from the Fix-it button on the map.', best: 'A quick Fix-it before new levels clears up mistakes while they’re fresh.' },
  { id: 'together', group: 'teach', icon: ICONS.users, name: 'Play together', plan: 'free', what: 'For sitting side by side: after a slip, your child gets a twin question with new numbers, and only first tries count.', best: 'Turn it on for a child who is just starting, or stuck on a skill, and sit with them for a few levels.', go: 'child', goLabel: 'Open a child’s settings' },
  { id: 'difficulty', group: 'teach', icon: ICONS.target, name: 'Difficulty', plan: 'free', what: 'Makes questions gentler or harder than usual for their age, for each child.', best: 'Start on the usual setting. Move it after a week if levels feel too easy or too hard.', go: 'child', goLabel: 'Open a child’s settings' },
  { id: 'focus', group: 'teach', icon: ICONS.target, name: 'Focus plan', plan: 'plus', what: 'Each week, short rounds on the 3 skills your child finds hardest, with before-and-after scores.', best: 'One Focus round a day, before new levels.', go: { tab: 'premium', sel: '.pm-gains' } },
  { id: 'school', group: 'teach', icon: ICONS.book, name: 'School syllabus', plan: 'plus', what: 'Follows CBSE, ICSE or Common Core, class by class, with the topics you pick.', best: 'Pick the topics their class is on this term, and change them as the term moves on.', go: 'child', goLabel: 'Open a child’s settings' },
  { id: 'exam', group: 'teach', icon: ICONS.pencil, name: 'Exam practice', plan: 'plus', what: 'A timed test on the topics you pick, with no hints, then a score sheet by topic to share as a PDF.', best: 'Use it a week or two before a school test, then practise the weakest topic.', go: 'child', goLabel: 'Open a child’s settings' },
  { id: 'skills', group: 'teach', icon: ICONS.brain, name: 'Every skill MN teaches', plan: 'free', what: 'The full list of skills, each with an example question and how it is taught.', best: 'Look up what your child is on now, so you can talk about it together.', go: 'skills', goLabel: 'See the skills list' },

  // Rewards
  { id: 'jar', group: 'rewards', icon: ICONS.gift, name: 'The treat jar', plan: 'free', what: 'Levels fill a jar with coins. When it’s full, MN asks you to hand over the treat and tap Given.', best: 'Choose the treat together, and hand it over soon after the jar fills. A treat about every 10 days keeps it exciting.', go: { tab: 'kids', sel: '.limits' } },
  { id: 'dream', group: 'rewards', icon: ICONS.star, name: 'Big dreams', plan: 'free', what: 'Bigger treats take months and fill a bigger jar. A missed day takes a little off, so steady play pays off.', best: 'Pair one big dream with small treats along the way.' },
  { id: 'pause', group: 'rewards', icon: ICONS.moon, name: 'Pause rewards', plan: 'free', what: 'On holidays or sick days, jars don’t shrink and there’s no daily reminder.', best: 'Turn it on before a trip, and off when you’re back.', go: { tab: 'kids', sel: '.toggle-row:has([data-k="holiday"])' } },
  { id: 'kinds', group: 'rewards', icon: ICONS.heart, name: 'Kinds of treats', plan: 'free', what: 'Choose which kinds of treats your children can pick from.', best: 'Hide the kinds you’d rather not give, so every choice is one you’re happy with.', go: { tab: 'app', sel: '.pa-cats' } },
  { id: 'adventure', group: 'rewards', icon: ICONS.compass, name: 'Adventure mode', plan: 'free', what: 'Daily quests, chests of coins, badges, a pet and outfits for Plus, on top of the same maths.', best: 'Good for children who love games. Switch it off for a child it distracts.', go: 'child', goLabel: 'Open a child’s settings' },

  // In charge
  { id: 'limit', group: 'charge', icon: ICONS.calendar, name: 'Daily time', plan: 'free', what: 'How long each child can play a day, and what happens when time is up.', best: 'Little and often: 10 to 20 minutes a day is a good start.', go: { tab: 'kids', sel: '.limits' } },
  { id: 'bedtime', group: 'charge', icon: ICONS.moon, name: 'Bedtime', plan: 'free', what: 'MN rests during the hours you set.', best: 'Set it to start half an hour before bed.', go: { tab: 'kids', sel: '.quiet-row' } },
  { id: 'pin', group: 'charge', icon: ICONS.lock, name: 'Parent PIN', plan: 'free', what: 'The Parent area opens with your own PIN, or this phone’s screen lock.', best: 'Use your own PIN if your child knows the phone’s lock.', go: { tab: 'app', sel: '.lock-row' } },
  { id: 'timer', group: 'charge', icon: ICONS.pause, name: 'Time per question', plan: 'free', what: 'The time limit for timed levels (Speed and Master) and challenges.', best: 'Give more time to younger children, or turn the timer off while a skill is new.', go: { tab: 'kids', sel: '.pa-timer' } },
  { id: 'voice', group: 'charge', icon: ICONS.speaker, name: 'Reading aloud and voice', plan: 'free', what: 'Plus reads each question and tip aloud, in the voice and speed you choose.', best: 'Keep it on for early readers. Older children can turn it off.', go: { tab: 'sound', sel: '.pa-sec' } },
  { id: 'kids', group: 'charge', icon: ICONS.users, name: 'More than one child', plan: 'free', what: 'Add each child. MN asks who’s playing when it opens, and keeps their progress and rewards apart.', best: 'Give each child their own name and picture, so nobody plays on the wrong path.', go: { tab: 'kids', sel: '.add-kid' } },
  { id: 'privacy', group: 'charge', icon: ICONS.heart, name: 'No ads, no tracking', plan: 'free', what: 'MN has no ads and no tracking. Progress stays on the phone, or in your own online backup if you sign in.', best: 'Read the privacy policy if you’d like the details.', go: { tab: 'app', sel: '.privacy-row' } },

  // Progress
  { id: 'report', group: 'progress', icon: ICONS.chart, name: 'Report', plan: 'part', what: 'Stars, time played and this week, for each child.', more: 'Strengths, skills to practise, speed and best times, and how each skill is changing.', best: 'Look once a week, and praise effort and streaks, not only scores.', go: 'report', goLabel: 'Open a report' },
  { id: 'remind', group: 'progress', icon: ICONS.calendar, name: 'Reminders', plan: 'free', what: 'One note a day naming who hasn’t played yet, a note when a reward is ready to give, and one when a week of progress isn’t backed up.', best: 'Set the daily note for the time your child usually plays.', go: { tab: 'app', sel: '.pa-remind' } },
  { id: 'widgets', group: 'progress', icon: ICONS.phone, name: 'Home-screen widgets', plan: 'part', what: 'MN today on your home screen: treat jars, the week, and a fun fact.', more: 'The Focus plan widget: this week’s 3 skills and how each is going.', best: 'Put MN today next to the apps you open every day.', go: { tab: 'app', sel: '.pa-sec:last-child' } },

  // Extras
  { id: 'sheets', group: 'extras', icon: ICONS.printer, name: 'Worksheets', plan: 'plus', what: 'Printable sheets from the skills your child played last, with answers.', best: 'One sheet on a weekend morning, away from the screen.', go: 'child', goLabel: 'Open a child’s settings' },
  { id: 'certs', group: 'extras', icon: ICONS.medal, name: 'Certificates', plan: 'plus', what: 'A certificate to print for every challenge beaten and every stage finished.', best: 'Print one when they finish a stage, and put it up where they can see it.', go: 'child', goLabel: 'Open a child’s settings' },
  { id: 'backup', group: 'extras', icon: ICONS.cloud, name: 'Backup and sync', plan: 'part', what: 'An online backup with Google, or a backup file you keep.', more: 'Every phone and tablet in step, all the time.', best: 'Sign in with Google once, so a lost or new phone loses nothing.', go: { tab: 'app', sel: '.pa-backup' } },
  { id: 'looks', group: 'extras', icon: ICONS.palette, name: 'Looks and app icons', plan: 'part', what: 'Notebook, Playground, Glass and Schoolbook.', more: 'The Shapes, Print and Precision looks, and MN icons for your home screen.', best: 'Let your child choose: a look they like is one they come back to.', go: { tab: 'app', sel: '.themes' } },
];

/** Which Guide card explains a Parent-area section (for its "Learn" link). */
export const SECTION_GUIDE: Record<string, string> = {
  Children: 'kids', 'Daily play': 'limit', Learning: 'teach', Sound: 'voice', 'Reading aloud': 'voice', Notifications: 'remind', Look: 'looks', Rewards: 'kinds', 'Parent PIN': 'pin', Backup: 'backup', 'Your data': 'privacy', 'Home-screen widgets': 'widgets',
};

const tagFor = (it: GuideItem, store: boolean, owned: boolean): string => {
  if (!store) return '';
  if (it.plan === 'plus') return `<span class="gd-plan x">${owned ? '✓ Included with MN&nbsp;×' : 'MN&nbsp;×'}</span>`;
  if (it.plan === 'part') return '<span class="gd-plan">Free, more with MN ×</span>';
  return '<span class="gd-plan">Free</span>';
};

/** The Guide page. `store`: the Play build, where some features come with MN ×. */
export function guideHtml(kidNames: string[], store: boolean, owned: boolean): string {
  const who = kidNames.length === 1 ? esc(kidNames[0]) : kidNames.length ? 'your children' : 'your child';
  const start = `<section class="pa-sec gd-start">
    <h2 class="pa-h">Start here</h2>
    <div class="card gd-steps">
      <p class="gd-lead">Three things that make MN work for ${who}:</p>
      <ol>
        <li><b>Pick a treat together.</b><small>Something they really want. It sits in a jar that right answers fill.</small></li>
        <li><b>A little every day.</b><small>10 to 20 minutes beats a long session once a week, and keeps the jar growing.</small></li>
        <li><b>Hand over the prize yourself.</b><small>When the jar is full, give the treat soon, and look at the report together once a week.</small></li>
      </ol>
    </div>
  </section>`;
  const filter = store
    ? `<div class="gd-filter" role="radiogroup" aria-label="Show">${[['all', 'Everything'], ['free', 'Free'], ['plus', 'With MN ×']].map(([v, t], i) => `<button class="chip gd-f${i === 0 ? ' on' : ''}" role="radio" aria-checked="${i === 0}" data-f="${v}">${t}</button>`).join('')}</div>`
    : '';
  const groups = GUIDE_GROUPS.map((g) => {
    const items = GUIDE.filter((it) => it.group === g.id);
    return `<section class="pa-sec gd-group" data-group="${g.id}">
      <h2 class="pa-h">${esc(g.title)}</h2><p class="gd-gline">${esc(g.line)}</p>
      ${items
        .map(
          (it) => `<details class="card gd-item" id="gd-${it.id}" data-plan="${it.plan}">
        <summary><span class="gd-i" aria-hidden="true">${it.icon}</span><span class="gd-n"><b>${esc(it.name)}</b>${tagFor(it, store, owned)}</span><span class="gd-chev" aria-hidden="true"></span></summary>
        <div class="gd-body">
          <p>${esc(it.what)}</p>
          ${it.more && store ? `<p class="gd-more"><b>With MN ×:</b> ${esc(it.more)}</p>` : it.more ? `<p>${esc(it.more)}</p>` : ''}
          <p class="gd-best"><b>Best way to use it:</b> ${esc(it.best)}</p>
          ${it.go ? `<button class="btn ghost small gd-go" data-id="${it.id}">${esc(it.goLabel ?? 'Take me there')}</button>` : ''}
        </div>
      </details>`,
        )
        .join('')}
    </section>`;
  }).join('');
  return `${start}${filter}${groups}`;
}
