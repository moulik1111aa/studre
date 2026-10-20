// The quick tour for grown-ups (from the welcome screen, or Parent area → How it works).
// Biscuit walks the grown-up through Study Hard, one hands-on stop at a time: say hello,
// swap a reel feed for a goal, pick a treat, play a question (right and wrong), beat a boss,
// watch a dream jar fill and melt, promise to play the first levels together, and try
// assisted mode. Each stop has its own colour; Biscuit reads it aloud (🔊 to mute).

import { html, esc, type App, type Screen, type ScreenMaker } from './app.ts';
import { dogSvg, dogHeadSvg } from './dog.ts';
import { BOSS_EMOJI } from './bosses.ts';
import { pickable, jarOf, aboutOf, type Reward } from '../core/rewards.ts';
import { reducedMotion, EASE_OUT, popIn, shake, wait } from '../render/motion.ts';

interface TourCtx {
  app: App;
  /** The treat picked for the demo. */
  treat?: Reward;
}

interface Scene {
  /** The stop's colour. */
  hue: string;
  title: string;
  text: string;
  art: string;
  /** Wire up the stop; call `done` once the grown-up has tried it. */
  play?: (art: HTMLElement, done: () => void, ctx: TourCtx) => void;
  /** What Next says until `done`. Without it, a stop with `play` can be passed straight away. */
  gate?: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Coins fly in an arc from one element to another. */
function flyCoins(from: Element, to: Element, n = 6): Promise<void> {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (reducedMotion() || !a.width || !b.width) return Promise.resolve();
  const runs: Promise<unknown>[] = [];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('i');
    c.className = 'fly-coin';
    document.body.appendChild(c);
    const x0 = a.x + a.width / 2 - 11 + (Math.random() - 0.5) * a.width * 0.5;
    const y0 = a.y + a.height / 2 - 11;
    const x1 = b.x + b.width / 2 - 11;
    const y1 = b.y + b.height / 2 - 11;
    const lift = 60 + Math.random() * 50;
    const anim = c.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - lift}px) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: 0.9 },
      ],
      { duration: 720, delay: k * 70, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' },
    );
    runs.push(anim.finished.then(() => c.remove(), () => c.remove()));
  }
  return Promise.all(runs).then(() => undefined);
}

/** Six treats from different categories, for the demo pick. */
function demoTreats(): Reward[] {
  const out: Reward[] = [];
  for (const r of pickable()) if (jarOf(r) === 'treat' && !r.id.startsWith('own.') && !out.some((x) => x.category === r.category)) out.push(r);
  return out.slice(0, 6);
}

const choicesHtml = (opts: string[]) => `<div class="tl-choices">${opts.map((o) => `<button class="tl-choice" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;

// ── the stops ──────────────────────────────────────────────────────────────

function hello(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const dog = art.querySelector<HTMLElement>('.th-dog')!;
  let taps = 0;
  const lines = ['Woof! Hello!', 'That tickles!', 'Let’s learn some maths!'];
  dog.addEventListener('click', () => {
    ctx.app.sfx.pop();
    if (!reducedMotion()) dog.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-28px) rotate(-6deg)' }, { transform: 'translateY(0) rotate(0)' }], { duration: 520, easing: EASE_OUT });
    const bub = art.querySelector<HTMLElement>('.th-say')!;
    bub.textContent = lines[taps++ % lines.length];
    popIn(bub, 0, 0.8);
    const r = dog.getBoundingClientRect();
    ctx.app.fx.confetti(r.x + r.width / 2, r.y + r.height * 0.3, 26, 0.7);
    done();
  });
}

function reels(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const strip = art.querySelector<HTMLElement>('.tr-strip')!;
  const seen = art.querySelector<HTMLElement>('.tr-seen')!;
  let views = 0;
  const swipe = () => {
    views++;
    strip.style.transform = `translateY(${-(views % 8) * 25}%)`;
    seen.innerHTML = `Watched: <b>${views}</b> · Learned: <b>0</b> · Saved: <b>0</b>`;
    ctx.app.sfx.tap();
  };
  art.querySelector('.tr-phone')!.addEventListener('click', swipe);
  art.querySelector('.tr-swap')!.addEventListener('click', async () => {
    ctx.app.sfx.whoosh();
    art.classList.add('swapped');
    await wait(reducedMotion() ? 0 : 450);
    art.querySelector<HTMLElement>('.tr-goal')!.hidden = false;
    popIn(art.querySelector('.tr-goal')!, 0, 0.6);
    seen.innerHTML = 'Now every minute of play fills a jar for something <b>real</b>.';
    ctx.app.sfx.coin(2);
    done();
  });
}

function pickTreat(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const grid = art.querySelector<HTMLElement>('.tp-grid')!;
  const note = art.querySelector<HTMLElement>('.tp-chosen')!;
  const jar = art.querySelector<HTMLElement>('.tp-jar')!;
  const treats = demoTreats();
  grid.innerHTML = treats.map((r, i) => `<button class="tp-card" data-i="${i}" style="--k:${i}"><span>${r.icon}</span><b>${esc(r.name)}</b></button>`).join('');
  grid.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.tp-card');
    if (!b) return;
    const r = treats[Number(b.dataset.i)];
    ctx.treat = r;
    ctx.app.sfx.pop();
    grid.querySelectorAll('.tp-card').forEach((x) => x.classList.toggle('on', x === b));
    // The treat drops into the jar.
    const icon = b.querySelector('span')!;
    const from = icon.getBoundingClientRect();
    const to = jar.getBoundingClientRect();
    jar.querySelector('em')!.textContent = r.icon;
    if (!reducedMotion()) {
      const ghost = document.createElement('span');
      ghost.className = 'fly-treat';
      ghost.textContent = r.icon;
      document.body.appendChild(ghost);
      await ghost
        .animate(
          [
            { transform: `translate(${from.x}px, ${from.y}px) scale(1)` },
            { transform: `translate(${(from.x + to.x) / 2}px, ${Math.min(from.y, to.y) - 70}px) scale(1.3) rotate(-12deg)`, offset: 0.5 },
            { transform: `translate(${to.x + 4}px, ${to.y + 8}px) scale(.8)` },
          ],
          { duration: 650, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' },
        )
        .finished.catch(() => {});
      ghost.remove();
    }
    popIn(jar, 0, 0.85);
    note.innerHTML = `<b>${esc(r.name)}</b> is locked in the jar. It takes ${esc(aboutOf(r))} of play to earn.`;
    done();
  });
}

interface DemoQ {
  q: string;
  answer: string;
  options: string[];
  steps: string[];
}
const DEMO_QS: DemoQ[] = [
  { q: '7 × 8 = ?', answer: '56', options: ['54', '56', '48', '64'], steps: ['7 × 8 is double 7 × 4.', '7 × 4 = 28.', 'Double 28 is 56.'] },
  { q: '45 − 18 = ?', answer: '27', options: ['33', '27', '23', '37'], steps: ['Take away 10 first: 45 − 10 = 35.', 'Then take away 8: 35 − 8 = 27.'] },
];

function playLevel(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  let k = 0;
  let fill = 0;
  let wrongSeen = false;
  const ask = () => {
    const d = DEMO_QS[k % DEMO_QS.length];
    let prize = 30;
    art.innerHTML = `<div class="tl-top"><span class="tl-prize">Perfect score <b>+${prize}</b></span><span class="tl-dots">${DEMO_QS.map((_, j) => `<i class="${j < k % DEMO_QS.length ? 'on' : j === k % DEMO_QS.length ? 'now' : ''}"></i>`).join('')}</span><span class="tl-jar"><i style="height:${fill}%"></i><em>${ctx.treat?.icon ?? '🍫'}</em></span></div>
      <div class="tl-card"><h3>${d.q}</h3>${choicesHtml(d.options)}</div>
      <div class="tl-out" aria-live="polite"><p class="tl-hint">${wrongSeen ? 'Now get it right first time: that pays the most.' : 'Tip: try a wrong answer first, to see what happens.'}</p></div>`;
    const out = art.querySelector<HTMLElement>('.tl-out')!;
    const chip = art.querySelector<HTMLElement>('.tl-prize')!;
    art.querySelector('.tl-choices')!.addEventListener('click', async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tl-choice');
      if (!b || b.disabled) return;
      if (b.dataset.v !== d.answer) {
        wrongSeen = true;
        ctx.app.sfx.wrong();
        ctx.app.haptics.lose();
        b.classList.add('wrong');
        b.disabled = true;
        shake(b);
        prize = Math.max(5, Math.round(prize / 2));
        chip.innerHTML = `After a slip <b>+${prize}</b>`;
        chip.classList.add('shrunk');
        popIn(chip, 0, 0.8);
        out.innerHTML = `<div class="tl-lesson"><span class="tl-coach">${dogHeadSvg({ cls: 'alive' })}</span><div><p class="tl-why">Not quite! Here’s how, with the same numbers:</p>${d.steps.map((st, i) => `<p class="ta-ls" style="--k:${i}"><i>${i + 1}</i>${esc(st)}</p>`).join('')}<p class="tl-again">Now try again.</p></div></div>`;
        return;
      }
      ctx.app.sfx.correct(2);
      ctx.app.haptics.win();
      b.classList.add('right');
      art.querySelectorAll<HTMLButtonElement>('.tl-choice').forEach((x) => (x.disabled = true));
      const jar = art.querySelector<HTMLElement>('.tl-jar')!;
      await flyCoins(b, jar, prize >= 30 ? 8 : 4);
      ctx.app.sfx.coin(3);
      fill = Math.min(100, fill + (prize >= 30 ? 24 : 12));
      jar.querySelector<HTMLElement>('i')!.style.height = `${fill}%`;
      popIn(jar, 0, 0.85);
      out.innerHTML = `<p class="tl-right"><b>Right! +${prize} coins.</b> ${prize >= 30 ? 'A perfect round pays ten times more than scraping through, so children aim to get it right.' : 'Right first time would have paid double.'}</p>
        <button class="btn ghost small tl-next">${wrongSeen ? 'Another question' : 'Another one: try a wrong answer'}</button>`;
      out.querySelector('.tl-next')!.addEventListener('click', () => {
        k++;
        ask();
      });
      done();
    });
  };
  ask();
}

function bossFight(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const QS: [string, string, string[]][] = [
    ['3 + 4 = ?', '7', ['6', '7', '8']],
    ['5 × 2 = ?', '10', ['10', '12', '7']],
    ['9 − 3 = ?', '6', ['5', '7', '6']],
  ];
  let hp = 3;
  const boss = art.querySelector<HTMLElement>('.tb-boss')!;
  const bar = art.querySelector<HTMLElement>('.tb-hp i')!;
  const say = art.querySelector<HTMLElement>('.tb-say')!;
  const qbox = art.querySelector<HTMLElement>('.tb-q')!;
  const ask = () => {
    const [q, a, opts] = QS[3 - hp];
    qbox.innerHTML = `<h3>${q}</h3>${choicesHtml(opts)}`;
    qbox.querySelector('.tl-choices')!.addEventListener('click', async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tl-choice');
      if (!b || b.disabled) return;
      if (b.dataset.v !== a) {
        ctx.app.sfx.hurt();
        b.classList.add('wrong');
        b.disabled = true;
        say.textContent = 'Ha! Missed me!';
        popIn(say, 0, 0.8);
        if (!reducedMotion()) art.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 260 });
        return;
      }
      hp--;
      ctx.app.sfx.hit(hp === 0);
      b.classList.add('right');
      qbox.querySelectorAll<HTMLButtonElement>('.tl-choice').forEach((x) => (x.disabled = true));
      bar.style.width = `${(hp / 3) * 100}%`;
      if (!reducedMotion()) boss.animate([{ transform: 'scale(1)' }, { transform: 'scale(.82) rotate(8deg)', filter: 'brightness(2)' }, { transform: 'scale(1)' }], { duration: 380, easing: EASE_OUT });
      const r = boss.getBoundingClientRect();
      ctx.app.fx.burst(r.x + r.width / 2, r.y + r.height / 2, '#FFD25A', 16, 1.2);
      if (hp > 0) {
        say.textContent = hp === 2 ? 'Ouch! Lucky shot!' : 'No! Not again!';
        popIn(say, 0, 0.8);
        await wait(500);
        ask();
        return;
      }
      say.textContent = 'POP!';
      ctx.app.sfx.fanfare();
      if (!reducedMotion()) await boss.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 420, fill: 'forwards' }).finished.catch(() => {});
      ctx.app.fx.confetti(r.x + r.width / 2, r.y + r.height / 2, 60);
      boss.textContent = '🏆';
      say.textContent = 'You won a trophy!';
      boss.getAnimations().forEach((x) => x.cancel());
      popIn(boss, 0, 0.3);
      qbox.innerHTML = '<p class="tl-right"><b>Boss beaten!</b> Every stage has bosses like this, plus side quests and trophies to collect.</p>';
      done();
    });
  };
  ask();
}

function dream(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const slider = art.querySelector<HTMLInputElement>('.td-days')!;
  const fill = art.querySelector<HTMLElement>('.td-jar i')!;
  const label = art.querySelector<HTMLElement>('.td-label')!;
  let melted = 0;
  const paint = () => {
    const days = Number(slider.value);
    const pct = Math.max(0, Math.min(100, Math.round((days / 90) * 100) - melted));
    fill.style.height = `${pct}%`;
    label.innerHTML = days >= 90 && pct >= 100 ? '<b>Day 90: the bicycle is earned! 🎉</b>' : `Day <b>${days}</b> of daily play: <b>${pct}%</b> of the way to the bicycle`;
  };
  slider.addEventListener('input', () => {
    paint();
    if (Number(slider.value) % 10 === 0) ctx.app.sfx.coin(1);
    done();
  });
  art.querySelector('.td-skip')!.addEventListener('click', () => {
    melted += 3;
    ctx.app.sfx.drip();
    const drop = art.querySelector<HTMLElement>('.td-drop')!;
    if (!reducedMotion()) drop.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(46px)', opacity: 0 }], { duration: 700, easing: 'ease-in' });
    paint();
    label.innerHTML += '<br><small>A skipped day melts the jar a little. A little practice every day wins.</small>';
    done();
  });
  paint();
}

function charge(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  art.querySelectorAll<HTMLElement>('.tc-tile').forEach((t) =>
    t.addEventListener('click', () => {
      t.classList.toggle('flip');
      ctx.app.sfx.tap();
      done();
    }),
  );
}

function together(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  art.querySelector('.tg-voice')!.addEventListener('click', () => ctx.app.voice.say('Hello! I will read every question to you. What is 7 plus 8?', undefined, true));
  const pledge = art.querySelector<HTMLElement>('.tg-pledge')!;
  pledge.addEventListener('click', () => {
    pledge.classList.add('on');
    pledge.setAttribute('aria-pressed', 'true');
    ctx.app.sfx.correct(3);
    popIn(pledge, 0, 0.95);
    const r = pledge.getBoundingClientRect();
    ctx.app.fx.sparkle(r.x + r.width / 2, r.y + r.height / 2, 16);
    done();
  });
}

function assist(art: HTMLElement, done: () => void, ctx: TourCtx): void {
  const say = (t: string) => ctx.app.voice.say(t, undefined, true);
  const ask = () => {
    art.innerHTML = `<div class="tl-card"><div class="as-ducks">${'<span>🦆</span>'.repeat(3)}</div><h3>How many ducks?</h3>${choicesHtml(['2', '3', '4'])}
      <p class="coach-note"><b>👪 Grown-up:</b> Point at each duck as you count together: one, two, three.</p></div>
      <div class="tl-out" aria-live="polite"></div>`;
    const out = art.querySelector<HTMLElement>('.tl-out')!;
    art.querySelector('.tl-choices')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.tl-choice');
      if (!b || b.disabled) return;
      if (b.dataset.v !== '3') {
        b.classList.add('wrong');
        b.disabled = true;
        shake(b);
        ctx.app.sfx.wrong();
        say('Let’s count them together. One, two, three. Try again!');
        art.querySelectorAll<HTMLElement>('.as-ducks span').forEach((d, i) => d.animate?.([{ transform: 'none' }, { transform: 'translateY(-14px) scale(1.15)' }, { transform: 'none' }], { duration: 420, delay: 300 + i * 600 }));
        out.innerHTML = '<p class="tl-why">No marks lost: you count together, and they try again.</p>';
        return;
      }
      b.classList.add('right');
      art.querySelectorAll<HTMLButtonElement>('.tl-choice').forEach((x) => (x.disabled = true));
      ctx.app.sfx.correct(2);
      say('Yes! Three ducks. Well done!');
      out.innerHTML = '<p class="tl-right"><b>Yes! Three ducks.</b> Coins still count when you help.</p><button class="btn ghost small tl-next">Try it again</button>';
      out.querySelector('.tl-next')!.addEventListener('click', ask);
      done();
    });
  };
  ask();
}

const SCENES: Scene[] = [
  {
    hue: '#7C6CFF',
    title: 'Hi, I’m Biscuit!',
    text: 'Study Hard is a maths adventure from age 3 to 16, with bosses to beat and real rewards to earn. Tap me to say hello.',
    art: `<div class="ta th-hello">${['1', '+', '3', '×', '7', '½', '=', '9'].map((s, i) => `<span class="ta-orbit" style="--k:${i}">${s}</span>`).join('')}<button class="th-dog" aria-label="Say hello to Biscuit">${dogSvg({ cls: 'alive', noShadow: true })}</button><span class="th-say">Tap me!</span></div>`,
    play: hello,
  },
  {
    hue: '#FF4F8B',
    title: 'Swap the scroll for a goal',
    text: 'Reels hand out a tiny buzz every few seconds and leave nothing behind. Tap the feed a few times, then swap it.',
    art: `<div class="ta tr-reels">
      <button class="tr-phone" aria-label="Scroll the feed"><span class="tr-strip">${['🎬', '😂', '🔥', '🐱', '💃', '🎮', '😂', '🔥'].map((e) => `<b>${e}<small>♥ ${Math.floor(Math.random() * 90 + 10)}k</small></b>`).join('')}</span><span class="tr-x">✕</span></button>
      <div class="tr-goal" hidden><span class="tr-jar"><i></i></span><b>🎯</b></div>
      <p class="tr-seen">Watched: <b>0</b> · Learned: <b>0</b> · Saved: <b>0</b></p>
      <button class="btn tr-swap">Swap it for a goal</button>
    </div>`,
    gate: 'Tap “Swap it for a goal”',
    play: reels,
  },
  {
    hue: '#FFB020',
    title: 'Pick a treat',
    text: 'Instead of a chocolate every day, your child saves for a treat that comes about every 10 days. Pick one, like your child will.',
    art: `<div class="ta ta-pick"><div class="tp-grid"></div><div class="tp-row"><span class="tp-jar"><i></i><em>?</em></span><p class="tp-chosen" aria-live="polite">Tap a treat to lock it in the jar.</p></div></div>`,
    gate: 'Pick a treat first',
    play: pickTreat,
  },
  {
    hue: '#22C55E',
    title: 'Now play a level',
    text: 'Answer like your child would: a wrong answer, then a right one.',
    art: `<div class="ta ta-try"></div>`,
    gate: 'Answer the question first',
    play: playLevel,
  },
  {
    hue: '#A855F7',
    title: 'Beat the boss',
    text: 'Every stage has boss fights: each right answer is a hit. Three hits pop this one.',
    art: `<div class="ta tb-fight"><div class="tb-top"><span class="tb-boss">${BOSS_EMOJI.bubbles}</span><span class="tb-say">Bubble trouble!</span></div><span class="tb-hp"><i></i></span><div class="tl-card tb-q"></div></div>`,
    gate: 'Beat the boss first',
    play: bossFight,
  },
  {
    hue: '#0EA5E9',
    title: 'Dream big, save slowly',
    text: 'One coin in five goes to a big dream, like a bicycle. Slide to see it fill over the months, or skip a day to see it melt.',
    art: `<div class="ta td-dream"><div class="td-side"><span class="td-jar"><i></i><b>🚲</b></span><i class="td-drop"></i></div>
      <p class="td-label"></p>
      <label class="td-slide"><span>Days of play</span><input type="range" class="td-days slider" min="0" max="90" value="12"></label>
      <button class="btn ghost small td-skip">💧 Skip a day</button></div>`,
    play: dream,
  },
  {
    hue: '#14B8A6',
    title: 'You’re in charge',
    text: 'You set the time and the prizes, and only you hand a prize over. Tap a card to see more.',
    art: `<div class="ta tc-grid">${[
      ['⏱️', '30 min a day', 'Or what you choose. When time is up, play stops or just stops earning.'],
      ['🔒', 'Grown-up lock', 'Your phone’s screen lock or a parent PIN guards settings and prizes.'],
      ['🎁', 'You hand it over', 'The app says “Show a grown-up”. You give the real reward.'],
      ['📵', 'No ads, offline', 'No sign-up. Nothing leaves this phone.'],
    ]
      .map(([e, b, s], i) => `<button class="tc-tile" style="--k:${i}"><span class="tc-front"><span>${e}</span><b>${b}</b></span><span class="tc-back">${s}</span></button>`)
      .join('')}</div>`,
    play: charge,
  },
  {
    hue: '#F97316',
    title: 'Start together',
    text: 'Your child picks a reading voice, then plays their first 3 levels with you beside them. A slip there costs nothing, and coins still count.',
    art: `<div class="ta tg-wrap">
      <button class="card tg-pledge" aria-pressed="false"><span class="tg-box">✓</span><span><b>I’ll sit with my child</b><small>for their first 3 levels</small></span></button>
      <button class="btn ghost tg-voice">🔊 Hear a reading voice</button>
    </div>`,
    gate: 'Tap “I’ll sit with my child”',
    play: together,
  },
  {
    hue: '#EC4899',
    title: 'Little ones play with you',
    text: 'For ages 3–6, assisted mode keeps you alongside every level: read aloud, no timers, try again after a slip, and a tip for you. Try it.',
    art: `<div class="ta ta-assist"></div>`,
    gate: 'Count the ducks first',
    play: assist,
  },
  {
    hue: '#7C6CFF',
    title: 'Ready, set, learn!',
    text: 'Setting up takes about 2 minutes. Then sit with your child for their first few levels.',
    art: `<div class="ta ta-ready"><div class="ta-dog">${dogSvg({ cls: 'alive', noShadow: true })}</div><div class="ta-jar full"><i class="ta-fill"></i><b>⭐</b></div></div>`,
  },
];

/** Where the story was, so coming back to it (e.g. from the owner area) carries on there. */
let resumeAt = 0;

/** The story. `finish` is where the last button goes; `leave` is for Skip / back. */
export function storyScreen(finish: { label: string; go: () => void }, leave: ScreenMaker) {
  return (app: App): Screen => {
    let i = 0;
    const n = SCENES.length;
    let narrate = app.save.data.settings.voice;
    const el = html(`<section class="screen story" aria-label="Quick tour">
      <header class="st-top"><span class="st-paws" aria-hidden="true">${SCENES.map(() => '<i>🐾</i>').join('')}</span><span class="st-count" aria-live="polite"></span>
        <button class="icon-btn st-mute" aria-label="Read aloud" aria-pressed="${narrate}">${narrate ? '🔊' : '🔇'}</button><button class="btn ghost small st-skip">Skip</button></header>
      <div class="st-stage">${SCENES.map(
        (s, k) => `<article class="st-scene" data-i="${k}" aria-hidden="true">
          <div class="st-say"><span class="st-biscuit">${dogHeadSvg({ cls: 'alive' })}</span><h2 class="st-title">${esc(s.title)}</h2></div>
          <div class="st-art">${s.art}</div>
          <p class="st-text">${esc(s.text)}</p>
        </article>`,
      ).join('')}</div>
      <footer class="st-foot">
        <button class="icon-btn st-prev" aria-label="Back">←</button>
        <button class="btn st-next">Next</button>
      </footer>
    </section>`);
    const scenes = [...el.querySelectorAll<HTMLElement>('.st-scene')];
    const paws = [...el.querySelectorAll<HTMLElement>('.st-paws i')];
    const next = el.querySelector<HTMLButtonElement>('.st-next')!;
    const prev = el.querySelector<HTMLButtonElement>('.st-prev')!;
    const mute = el.querySelector<HTMLButtonElement>('.st-mute')!;

    const ctx: TourCtx = { app };
    const started = new Set<number>();
    const finished = new Set<number>();
    const ready = (k: number) => !SCENES[k].gate || finished.has(k);
    const paintNext = () => {
      const last = i === n - 1;
      next.disabled = !ready(i);
      next.textContent = !ready(i) ? SCENES[i].gate! : last ? finish.label : 'Next';
      next.classList.toggle('mint', ready(i));
      if (ready(i) && SCENES[i].gate && finished.has(i) && !reducedMotion()) popIn(next, 0, 0.94);
    };
    const read = () => {
      if (narrate) app.voice.say(`${SCENES[i].title}. ${SCENES[i].text}`, undefined, true);
    };
    const go = (k: number, dir = 1) => {
      const old = scenes[i];
      i = Math.max(0, Math.min(n - 1, k));
      resumeAt = i;
      const sc = SCENES[i];
      el.style.setProperty('--tour', sc.hue);
      scenes.forEach((s, j) => {
        s.classList.toggle('on', j === i);
        s.setAttribute('aria-hidden', String(j !== i));
      });
      if (sc.play && !started.has(i)) {
        started.add(i);
        const at = i;
        sc.play(scenes[i].querySelector<HTMLElement>('.ta')!, () => {
          if (finished.has(at)) return;
          finished.add(at);
          if (i === at) paintNext();
        }, ctx);
      }
      if (old !== scenes[i] && !reducedMotion()) {
        old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-50 * dir}px) rotate(${-2 * dir}deg)` }], { duration: 260, easing: EASE_OUT });
        scenes[i].animate([{ opacity: 0, transform: `translateX(${60 * dir}px) rotate(${2 * dir}deg)` }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE_OUT });
        const say = scenes[i].querySelector('.st-say');
        if (say) popIn(say, 120, 0.85);
        app.sfx.whoosh();
      }
      paws.forEach((d, j) => d.classList.toggle('on', j <= i));
      el.querySelector('.st-count')!.textContent = `${i + 1} of ${n}`;
      prev.style.visibility = i ? 'visible' : 'hidden';
      paintNext();
      el.querySelector<HTMLElement>('.st-skip')!.style.visibility = i === n - 1 ? 'hidden' : 'visible';
      if (i === n - 1 && !reducedMotion()) {
        const r = scenes[i].querySelector('.ta-jar')!.getBoundingClientRect();
        setTimeout(() => app.fx.confetti(r.x + r.width / 2, r.y + r.height / 3, 70), 350);
        app.sfx.fanfare();
      }
      read();
    };
    next.addEventListener('click', () => {
      if (!ready(i)) return;
      if (i === n - 1) {
        resumeAt = 0;
        app.voice.stop();
        finish.go();
      } else go(i + 1, 1);
    });
    prev.addEventListener('click', () => go(i - 1, -1));
    mute.addEventListener('click', () => {
      narrate = !narrate;
      mute.textContent = narrate ? '🔊' : '🔇';
      mute.setAttribute('aria-pressed', String(narrate));
      if (narrate) read();
      else app.voice.stop();
    });
    el.querySelector('.st-skip')!.addEventListener('click', () => {
      resumeAt = 0;
      app.voice.stop();
      void app.show(leave);
    });
    // Swipe between stops (not while dragging the slider).
    let x0: number | null = null;
    const stage = el.querySelector<HTMLElement>('.st-stage')!;
    stage.addEventListener('pointerdown', (e) => (x0 = (e.target as HTMLElement).closest('input') ? null : e.clientX));
    stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 60) return;
      if (dx < 0 && i < n - 1 && ready(i)) go(i + 1, 1);
      if (dx > 0 && i > 0) go(i - 1, -1);
    });
    return {
      el,
      // Interactive stops before the resume point count as done (they were tried already).
      mounted: () => {
        for (let k = 0; k < resumeAt; k++) finished.add(k);
        go(resumeAt);
      },
      back: () => {
        if (i > 0) go(i - 1, -1);
        else {
          app.voice.stop();
          void app.show(leave);
        }
        return true;
      },
      destroy: () => app.voice.stop(),
    };
  };
}
