// A Fix-it round: up to 5 questions like ones the child got wrong before, with new numbers.
// No timer. Right first time moves each one a step on (back in 3 days, then a week, then
// fixed for good); a slip shows how, and a twin question follows to try straight away.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { skillById } from '../core/areas/index.ts';
import { makeQuestion, replaceQuestion, noteAsked } from '../core/path.ts';
import { createRng } from '../core/rng.ts';
import { isCorrect, spoken, type Question } from '../core/question.ts';
import { addCoins, addPlayTime, coinsForLevel } from '../core/economy.ts';
import { dueFix, noteTry, FIX_GAPS, type FixDue } from '../core/fixit.ts';
import { remember } from '../core/undo.ts';
import { ICONS, coinSvg } from './icons.ts';
import { visualHtml, prettyAnswer } from './visuals.ts';
import { ambientHtml, worldVars } from './worlds.ts';
import { fitCard, popIn, shake, stagger, wait, reducedMotion, EASE_OUT } from '../render/motion.ts';
import { mountAnswers, escPrompt } from './answerpad.ts';
import { lessonFor, showLesson } from './lesson.ts';
import { goHome, timeState } from './flow.ts';
import { timesUpScreen } from './timesup.ts';
import { unlockScreen } from './unlock.ts';
import { plusSays } from './pep.ts';
import { outfitFor } from './adventure.ts';
import { quietNow, quietScreen } from './quiet.ts';

/** Skills a Fix-it question can be made for (the skill still exists). */
export const fixKnown = (id: string): boolean => !!skillById(id);

/** What is waiting for this child today. */
export const fixDueFor = (app: App, child: Child): FixDue[] => dueFix(child, app.today, fixKnown);

type Outcome = 'fixed' | 'next' | 'again';

export function startFixit(app: App, child: Child): void {
  const quiet = child.tester ? null : quietNow(app);
  if (quiet) return void app.show(quietScreen(child, quiet, () => startFixit(app, child)));
  if (timeState(app, child) === 'stop') return void app.show(timesUpScreen(child));
  const items = fixDueFor(app, child);
  if (!items.length) return goHome(app);
  void app.show(fixitScreen(child, items), 'liquid');
}

function fixitScreen(child: Child, items: FixDue[]) {
  return (app: App): Screen => {
    const rng = createRng(`${child.id}:fixit:${Date.now()}`);
    const asked: Question[] = [];
    const questions = items.map((it) => {
      const s = skillById(it.skillId)!;
      const q = makeQuestion(s, rng, it.d, new Set([...asked.map((x) => x.key), ...(child.progress.history[s.id] ?? [])]));
      asked.push(q);
      return q;
    });
    const firstStage = skillById(items[0].skillId)!.stage;
    const el = html(`<section class="screen play fixit" style="${worldVars(firstStage)}" aria-label="Fix-it">
      ${ambientHtml(firstStage, 5)}
      <header class="play-top">
        <button class="icon-btn quit" aria-label="Pause">${ICONS.pause}</button>
        <div class="play-title"><b>Fix-it</b><span>Tricky ones from before</span></div>
        <div class="dots" aria-hidden="true">${questions.map(() => '<i></i>').join('')}</div>
      </header>
      <main class="qwrap" aria-live="polite"></main>
      <footer class="answers"></footer>
    </section>`);
    const qwrap = el.querySelector<HTMLElement>('.qwrap')!;
    const answers = el.querySelector<HTMLElement>('.answers')!;
    const dots = el.querySelector<HTMLElement>('.dots')!;
    const outcomes: Outcome[] = [];
    let i = 0;
    let done = false;
    let twin = false;
    let paused = false;
    let activeSince = performance.now();
    let activeMs = 0;
    const accrue = () => {
      activeMs += performance.now() - activeSince;
      activeSince = performance.now();
    };

    const show = (q: Question, again = false) => {
      qwrap.innerHTML = `<article class="qcard${q.visual ? ' has-vis' : ''}">
        ${q.visual ? visualHtml(q.visual, q.key) : ''}
        ${again ? '<p class="again-note">Now try one like it</p>' : `<p class="fix-skill">${esc(skillById(q.skillId)!.name)}</p>`}
        <h2 class="prompt${q.prompt.length > 34 ? ' long' : ''}${q.prompt.length > 70 ? ' xlong' : ''}">${escPrompt(q.prompt)}</h2>
        <div class="q-tools"><button class="icon-btn say" aria-label="Read it again">${ICONS.speaker}</button></div>
      </article>`;
      const card = qwrap.firstElementChild as HTMLElement;
      if (app.debug) card.dataset.answer = q.answer;
      mountAnswers(app, answers, q, () => done, (v, b) => void submit(q, v, b));
      fitCard(card, qwrap);
      if (!reducedMotion()) card.animate([{ opacity: 0, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: EASE_OUT });
      stagger(card.querySelectorAll('.obj, .dots circle, .cell, .note, .coin-piece'), { gap: 45, y: 10, scale: 0.6 });
      card.querySelector('.say')!.addEventListener('click', () => app.voice.say(q.speak ?? spoken(q.prompt)));
      app.voice.say(again ? `Now try this one. ${q.speak ?? spoken(q.prompt)}` : q.speak ?? spoken(q.prompt), undefined, !!child.assisted);
    };

    const submit = async (q: Question, value: string, btn?: HTMLElement) => {
      if (done) return;
      done = true;
      const ok = isCorrect(q, value);
      const card = qwrap.firstElementChild as HTMLElement;
      const dot = dots.children[i] as HTMLElement | undefined;
      app.voice.stop();
      if (!twin) outcomes[i] = ok ? (items[i].step + 1 >= FIX_GAPS.length ? 'fixed' : 'next') : 'again';
      if (ok) {
        app.sfx.correct(1);
        app.haptics.match(1);
        card.classList.add('right');
        btn?.classList.add('right');
        if (!twin) dot?.classList.add('on');
        app.voice.say(twin ? 'Yes! You fixed it.' : outcomes[i] === 'fixed' ? 'Fixed for good!' : 'Right!');
        await wait(app.save.data.settings.voice ? 1100 : 800);
      } else {
        app.sfx.wrong();
        btn?.classList.add('wrong');
        shake(btn ?? card);
        if (!twin) dot?.classList.add('miss');
        const reveal = html(`<div class="reveal">The answer is <b>${prettyAnswer(q.answer)}</b></div>`);
        card.appendChild(reveal);
        popIn(reveal);
        answers.querySelectorAll<HTMLElement>('.choice').forEach((b) => {
          if (isCorrect(q, decodeURIComponent(b.dataset.v!))) b.classList.add('right');
        });
        if (lessonFor(app, q)) {
          await wait(900);
          await showLesson(app, q, value);
        } else {
          app.voice.say(`The answer is ${spoken(q.answer)}.`);
          await wait(2000);
        }
      }
      // A slip: one twin question straight away, to try the way just shown.
      if (!ok && !twin) {
        twin = true;
        done = false;
        const t = replaceQuestion(q, skillById(q.skillId)!, rng, new Set(asked.map((x) => x.key)), asked);
        asked.push(t);
        show(t, true);
        return;
      }
      twin = false;
      i++;
      if (i >= questions.length) return finish();
      done = false;
      show(questions[i]);
    };

    const save = (upTo: number) => {
      accrue();
      const seconds = Math.round(activeMs / 1000);
      const now = Date.now();
      const rights = outcomes.slice(0, upTo).filter((o) => o !== 'again').length;
      const each = (k: number) => Math.max(1, Math.round(coinsForLevel('skill', 1, true, false, skillById(items[k].skillId)!.stage) / 8));
      let coins = 0;
      let unlocked: ('treat' | 'goal')[] = [];
      app.save.update(() => {
        remember(child, [], now, app.today);
        const inside = addPlayTime(child.wallet, app.today, seconds, app.save.data.settings.limitMinutes);
        child.stats.secondsByDay[app.today] = (child.stats.secondsByDay[app.today] ?? 0) + seconds;
        child.stats.answered += upTo;
        child.stats.correct += rights;
        noteAsked(child.progress, asked, app.today);
        outcomes.slice(0, upTo).forEach((o, k) => noteTry(child, items[k].skillId, o !== 'again', now, app.today));
        if (inside) {
          coins = outcomes.slice(0, upTo).reduce((n, o, k) => n + (o === 'again' ? 0 : each(k)), 0);
          unlocked = addCoins(child.wallet, coins).unlocked;
        }
      });
      activeMs = 0;
      return { coins, unlocked, rights };
    };

    const finish = () => {
      const { coins, unlocked, rights } = save(outcomes.length);
      const fixedNow = outcomes.filter((o) => o === 'fixed').length;
      const rows = items
        .map((it, k) => {
          const o = outcomes[k];
          const name = esc(skillById(it.skillId)!.name);
          const when = o === 'fixed' ? 'Fixed for good!' : o === 'next' ? `Back in ${FIX_GAPS[it.step + 1]} days` : 'Back tomorrow';
          return `<li class="fx-${o}"><span aria-hidden="true">${o === 'again' ? '🔁' : o === 'fixed' ? '🏅' : '✅'}</span><b>${name}</b><small>${when}</small></li>`;
        })
        .join('');
      const title = rights === items.length ? 'All fixed up!' : rights ? `${rights} of ${items.length} right` : 'Good practice!';
      const panel = html(`<div class="fix-done card" role="dialog" aria-label="${esc(title)}">
        <div class="fd-head"><span class="fd-icon" aria-hidden="true">🔧</span><h2>${esc(title)}</h2></div>
        <p class="subtitle">${fixedNow ? `${fixedNow} fixed for good. ` : ''}Each one comes back a few days later, until it sticks.</p>
        <ul class="fd-list">${rows}</ul>
        ${coins ? `<p class="fd-coins">${coinSvg} +${coins}</p>` : ''}
        <button class="btn mint fd-go">Back to the map</button>
      </div>`);
      qwrap.innerHTML = '';
      answers.innerHTML = '';
      qwrap.appendChild(panel);
      popIn(panel);
      if (rights && !reducedMotion()) {
        const r = panel.getBoundingClientRect();
        app.fx.confetti(r.x + r.width / 2, r.y + 60, rights === items.length ? 36 : 18);
      }
      app.voice.say(title);
      const go = () => {
        if (unlocked.length) void app.show(unlockScreen(child, unlocked[0]));
        else goHome(app);
      };
      panel.querySelector('.fd-go')!.addEventListener('click', go);
    };

    const pause = () => {
      if (paused || i >= questions.length) return;
      paused = true;
      accrue();
      app.voice.stop();
      const { result } = app.sheet(`<h2>Paused</h2><p>The tricky ones will wait for you.</p>`, [
        { label: 'Keep going', value: 'resume', kind: 'mint', back: true },
        { label: 'Leave Fix-it', value: 'leave', kind: 'ghost' },
      ], 'Paused');
      void result.then((v) => {
        paused = false;
        activeSince = performance.now();
        if (v === 'leave') {
          // Finished questions count; the rest stay due.
          save(twin ? i + 1 : i);
          goHome(app);
        }
      });
    };
    el.querySelector('.quit')!.addEventListener('click', pause);

    return {
      el,
      keepAwake: true,
      mounted: () => {
        activeSince = performance.now();
        const line = items.length === 1 ? 'This one tricked you before. Let’s fix it!' : `These ${items.length} tricked you before. Let’s fix them!`;
        if (app.debug && (window as { __quietPlus?: boolean }).__quietPlus) show(questions[0]);
        else void plusSays(app, line, undefined, outfitFor(child)).then(() => show(questions[0]));
      },
      back: () => {
        pause();
        return true;
      },
      pause,
      destroy: () => app.voice.stop(),
    };
  };
}
