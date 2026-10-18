// Face-off (spec §6): set up two players (children or a guest with a level slider), pick a
// mode, then race on one phone lying flat — the top half is turned 180° for the player opposite.

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { AREAS, allSkills } from '../core/areas/index.ts';
import { makeQuestion } from '../core/path.ts';
import { createRng } from '../core/rng.ts';
import { isCorrect, type Question } from '../core/question.ts';
import { addCoins, addPlayTime, COINS } from '../core/economy.ts';
import { FaceoffMatch, FACEOFF, MODE_NAMES, childSkillIndex, pairScore, recordPair, showdownAllowed, type FaceoffMode } from '../core/faceoff.ts';
import { ICONS, avatarHtml } from './icons.ts';
import { visualHtml, optionHtml } from './visuals.ts';
import { popIn, shake, stagger, wait, reducedMotion, EASE_OUT, EASE_SPRING, fitCard } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';
import { timeState } from './flow.ts';
import { remember } from '../core/undo.ts';

export interface Player {
  /** Child id, or 'guest'. */
  id: string;
  name: string;
  avatar: number;
  skill: number;
}

const SKILLS = allSkills();
const GUEST_AVATAR = 12;
const stageStart = (stage: number): number => AREAS[0].skills.slice(0, stage - 1).reduce((a, s) => a + s.length, 0);
const stageOf = (skill: number): number => {
  let i = 0;
  for (let s = 0; s < AREAS[0].skills.length; s++) {
    i += AREAS[0].skills[s].length;
    if (skill < i) return s + 1;
  }
  return 7;
};

function playerFor(app: App, c: Child): Player {
  return { id: c.id, name: c.name, avatar: c.avatar, skill: childSkillIndex(app.path, c.progress, SKILLS) };
}

// ── setup ──────────────────────────────────────────────────────────────────

export function faceoffSetupScreen(prev?: { a: Player; b: Player; mode: FaceoffMode }) {
  return (app: App): Screen => {
    const kids = app.save.data.children;
    const guest = (skill: number): Player => ({ id: 'guest', name: 'Guest', avatar: GUEST_AVATAR, skill });
    let players: [Player, Player] = prev
      ? [prev.a, prev.b]
      : [kids[0] ? playerFor(app, app.child ?? kids[0]) : guest(0), kids[1] ? playerFor(app, kids.find((k) => k.id !== (app.child ?? kids[0]).id)!) : guest(stageStart(4))];
    let mode: FaceoffMode = prev?.mode ?? 'tug';

    const el = html(`<section class="screen fo-setup" aria-label="Face-off setup">
      <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Face-off</span><span style="width:50px"></span></header>
      <div class="scroll fo-body">
        <p class="subtitle center">Lay the phone flat between you. Answer fast — a wrong tap freezes you for a second!</p>
        <div class="fo-players"></div>
        <h2 class="pa-h">Mode</h2>
        <div class="fo-modes">${(['tug', 'race', 'showdown'] as FaceoffMode[]).map((m) => `<button class="seg-b fo-mode" data-m="${m}"><b>${MODE_NAMES[m]}</b><small>${m === 'tug' ? 'Pull the flag 7 notches' : m === 'race' ? 'First to 10 right' : 'Same question, first to 7'}</small></button>`).join('')}</div>
        <p class="fine fo-note"></p>
      </div>
      <button class="btn fo-start">${ICONS.swords} Start!</button>
    </section>`);
    const box = el.querySelector<HTMLElement>('.fo-players')!;

    const paint = () => {
      box.innerHTML = players
        .map((p, i) => {
          const options = [...kids.map((k) => ({ id: k.id, name: k.name, avatar: k.avatar })), { id: 'guest', name: 'Guest', avatar: GUEST_AVATAR }];
          const st = stageOf(p.skill);
          const local = p.skill - stageStart(st);
          return `<div class="card fo-player" data-i="${i}">
            <p class="chip">${i === 0 ? 'Player 1 · near side' : 'Player 2 · far side'}</p>
            <div class="fo-pick">${options.map((o) => `<button class="fo-who${o.id === p.id ? ' on' : ''}" data-id="${o.id}" aria-label="${esc(o.name)}">${avatarHtml(o.avatar, 50)}<small>${esc(o.name)}</small></button>`).join('')}</div>
            ${p.id === 'guest'
              ? `<div class="fo-guest"><div class="fo-stages">${AREAS[0].stages.map((s, k) => `<button class="fo-st${k + 1 === st ? ' on' : ''}" data-st="${k + 1}">${k + 1}</button>`).join('')}</div>
                 <input type="range" class="slider fo-skill" min="0" max="${AREAS[0].skills[st - 1].length - 1}" value="${local}" aria-label="Guest level">
                 <small class="fo-skillname">Stage ${st} · ${esc(SKILLS[p.skill].name)}</small></div>`
              : `<small class="fo-level">Plays at: ${esc(SKILLS[p.skill].name)} (Stage ${st})</small>`}
          </div>`;
        })
        .join('');
      const okShowdown = showdownAllowed(players[0].skill, players[1].skill);
      if (!okShowdown && mode === 'showdown') mode = 'tug';
      el.querySelectorAll<HTMLButtonElement>('.fo-mode').forEach((b) => {
        b.classList.toggle('on', b.dataset.m === mode);
        b.disabled = b.dataset.m === 'showdown' && !okShowdown;
      });
      el.querySelector('.fo-note')!.textContent = okShowdown ? '' : 'Showdown needs players at a similar level. Everyone gets their own questions in the other modes.';
      const same = players[0].id === players[1].id && players[0].id !== 'guest';
      el.querySelector<HTMLButtonElement>('.fo-start')!.disabled = same;
    };

    box.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const card = t.closest<HTMLElement>('.fo-player');
      if (!card) return;
      const i = Number(card.dataset.i) as 0 | 1;
      const who = t.closest<HTMLElement>('.fo-who');
      if (who) {
        const id = who.dataset.id!;
        const c = kids.find((k) => k.id === id);
        players[i] = c ? playerFor(app, c) : guest(players[i].id === 'guest' ? players[i].skill : stageStart(3));
        paint();
        return;
      }
      const st = t.closest<HTMLElement>('.fo-st');
      if (st) {
        players[i] = { ...players[i], skill: stageStart(Number(st.dataset.st)) };
        paint();
      }
    });
    box.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.classList.contains('fo-skill')) return;
      const i = Number(t.closest<HTMLElement>('.fo-player')!.dataset.i) as 0 | 1;
      const st = stageOf(players[i].skill);
      players[i] = { ...players[i], skill: stageStart(st) + Number(t.value) };
      t.parentElement!.querySelector('.fo-skillname')!.textContent = `Stage ${st} · ${SKILLS[players[i].skill].name}`;
      const ok = showdownAllowed(players[0].skill, players[1].skill);
      el.querySelector<HTMLButtonElement>('.fo-mode[data-m="showdown"]')!.disabled = !ok;
    });
    el.querySelectorAll<HTMLButtonElement>('.fo-mode').forEach((b) =>
      b.addEventListener('click', () => {
        mode = b.dataset.m as FaceoffMode;
        paint();
      }),
    );
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(whosPlayingScreen));
    el.querySelector('.fo-start')!.addEventListener('click', () => {
      for (const p of players) {
        const c = kids.find((k) => k.id === p.id);
        if (c && timeState(app, c) === 'stop') {
          app.toast(`${c.name} has used today’s play time.`);
          return;
        }
      }
      void app.show(faceoffMatchScreen(players[0], players[1], mode), 'liquid');
    });
    paint();
    return { el, colors: ['#FF7AA8', '#5F3DC4'], mounted: () => stagger(el.querySelectorAll('.fo-body > *, .fo-start'), { gap: 70 }) };
  };
}

// ── match ──────────────────────────────────────────────────────────────────

export function faceoffMatchScreen(a: Player, b: Player, mode: FaceoffMode) {
  return (app: App): Screen => {
    const match = new FaceoffMatch(mode, a.skill, b.skill, SKILLS.length - 1);
    const players = [a, b] as const;
    const rng = createRng(`faceoff:${a.id}:${b.id}:${Date.now()}`);
    const seen = new Set<string>();
    const current: [Question | null, Question | null] = [null, null];
    let started = 0;
    let over = false;

    const half = (i: 0 | 1) => `<div class="fo-half ${i === 0 ? 'near' : 'far'}" data-side="${i}">
      <div class="fo-head">${avatarHtml(players[i].avatar, 40)}<b>${esc(players[i].name)}</b><span class="fo-score" aria-label="Score"></span></div>
      <div class="fo-q"></div>
      <div class="fo-choices"></div>
      <div class="fo-freeze" hidden>❄️</div>
    </div>`;
    const el = html(`<section class="screen fo-match mode-${mode}" aria-label="Face-off: ${MODE_NAMES[mode]}">
      <div class="fo-territory" aria-hidden="true"><i class="t-far"></i><i class="t-near"></i></div>
      ${half(1)}
      <div class="fo-mid"><button class="icon-btn fo-pause" aria-label="Pause">${ICONS.pause}</button><span class="fo-flag" aria-hidden="true">🚩</span><span class="fo-mode-name">${MODE_NAMES[mode]}</span></div>
      ${half(0)}
    </section>`);
    const halves = [el.querySelector<HTMLElement>('.fo-half.near')!, el.querySelector<HTMLElement>('.fo-half.far')!] as const;

    const paintScores = () => {
      for (const i of [0, 1] as const) {
        const s = match.sides[i];
        const target = mode === 'tug' ? FACEOFF.tugNotches : match.target;
        const got = mode === 'tug' ? Math.max(0, i === 0 ? match.rope : -match.rope) : s.score;
        halves[i].querySelector('.fo-score')!.innerHTML = Array.from({ length: target }, (_, k) => `<i class="${k < got ? 'on' : ''}"></i>`).join('');
      }
      // Tug of War: the coloured territories and the flag move with the rope.
      const shift = (match.rope / FACEOFF.tugNotches) * 42;
      el.style.setProperty('--rope', `${mode === 'tug' ? shift : 0}`);
    };

    const ask = (i: 0 | 1, shared?: Question) => {
      const p = match.sides[i];
      const skill = SKILLS[mode === 'showdown' ? match.sharedSkill : p.skill];
      const q = shared ?? makeQuestion(skill, rng, 0.6, seen, 4, current[i]?.key);
      seen.add(q.key);
      current[i] = q;
      const h = halves[i];
      h.querySelector('.fo-q')!.innerHTML = `${q.visual ? visualHtml(q.visual, q.key) : ''}<h2 class="prompt${q.prompt.length > 30 ? ' long' : ''}">${q.prompt.replace(/</g, '&lt;')}</h2>`;
      if (app.debug) h.dataset.answer = q.answer;
      h.querySelector('.fo-choices')!.innerHTML = q.choices.map((c) => `<button class="choice" data-v="${encodeURIComponent(c)}" aria-label="${esc(c)}">${optionHtml(c, q.optionObject)}</button>`).join('');
      const qbox = h.querySelector<HTMLElement>('.fo-q')!;
      fitCard(qbox, qbox, 14);
      if (!reducedMotion()) h.querySelector('.fo-q')!.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE_OUT });
      return q;
    };
    const askBoth = () => {
      if (mode === 'showdown') {
        const q = ask(0);
        ask(1, q);
      } else {
        ask(0);
        ask(1);
      }
    };

    const tap = (i: 0 | 1, btn: HTMLElement) => {
      const q = current[i];
      if (!q || over) return;
      const now = performance.now();
      if (match.frozen(i, now)) return;
      const ok = isCorrect(q, decodeURIComponent(btn.dataset.v!));
      const events = match.answer(i, ok, now);
      if (!events.length) return;
      const h = halves[i];
      for (const e of events) {
        if (e.type === 'wrong') {
          btn.classList.add('wrong');
          shake(btn);
          app.sfx.wrong();
          app.haptics.lose();
          const f = h.querySelector<HTMLElement>('.fo-freeze')!;
          f.hidden = false;
          h.classList.add('frozen');
          popIn(f, 0, 0.4);
          setTimeout(() => {
            f.hidden = true;
            h.classList.remove('frozen');
            btn.classList.remove('wrong');
          }, FACEOFF.freezeMs);
        } else if (e.type === 'point') {
          btn.classList.add('right');
          app.sfx.correct(match.sides[i].streak);
          app.haptics.match(match.sides[i].streak);
          const r = btn.getBoundingClientRect();
          app.fx.burst(r.x + r.width / 2, r.y + r.height / 2, i === 0 ? '#43E0A8' : '#FF7AA8', 16);
        } else if (e.type === 'harder') {
          const t = html(`<div class="fo-harder">Too easy! Harder questions ⬆</div>`);
          h.appendChild(t);
          popIn(t);
          setTimeout(() => t.remove(), 1500);
        }
      }
      paintScores();
      if (match.winner !== null) return void finish(match.winner);
      if (events.some((e) => e.type === 'point')) {
        if (mode === 'showdown') setTimeout(() => !over && askBoth(), 350);
        else setTimeout(() => !over && ask(i), 250);
      }
    };
    for (const i of [0, 1] as const) {
      halves[i].querySelector('.fo-choices')!.addEventListener('pointerdown', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.choice');
        if (!btn) return;
        e.preventDefault();
        tap(i, btn);
      });
    }

    const finish = async (winner: 0 | 1) => {
      over = true;
      const seconds = Math.round((performance.now() - started) / 1000);
      const kids = app.save.data.children;
      let coins = 0;
      app.save.update((d) => {
        recordPair(d.faceoff, a.id, b.id, winner);
        players.forEach((p, i) => {
          const c = kids.find((k) => k.id === p.id);
          if (!c) return;
          remember(c, [], Date.now(), app.today);
          const inside = addPlayTime(c.wallet, app.today, seconds, d.settings.limitMinutes);
          c.stats.secondsByDay[app.today] = (c.stats.secondsByDay[app.today] ?? 0) + seconds;
          if (i === winner && inside) {
            coins = COINS.faceoffWin;
            addCoins(c.wallet, coins);
          }
        });
      });
      app.sfx.fanfare();
      app.haptics.win();
      const w = halves[winner].getBoundingClientRect();
      app.fx.confetti(w.x + w.width / 2, w.y + w.height / 2, 120, 1.3);
      await wait(500);
      const [sa, sb] = pairScore(app.save.data.faceoff, a.id, b.id);
      const banner = (i: 0 | 1) => `<div class="fo-end ${i === 0 ? 'near' : 'far'}${i === winner ? ' won' : ''}">
        <div class="fo-end-big">${i === winner ? '🏆' : '🤝'}</div>
        <h2>${i === winner ? `${esc(players[i].name)} wins!` : 'Good game!'}</h2>
        <p>${esc(a.name)} ${sa} – ${sb} ${esc(b.name)}${i === winner && coins ? ` · +${coins} coins` : ''}</p>
      </div>`;
      const ov = html(`<div class="overlay fo-results" role="dialog" aria-modal="true" aria-label="Face-off result">
        ${banner(1)}
        <div class="fo-end-actions"><button class="btn mint rematch">Rematch</button><button class="btn ghost small swap">Swap sides</button><button class="btn ghost small" data-back>Done</button></div>
        ${banner(0)}
      </div>`);
      el.appendChild(ov);
      ov.querySelectorAll('.fo-end').forEach((x, k) => popIn(x, k * 120, 0.5));
      ov.querySelector('.rematch')!.addEventListener('click', () => void app.show(faceoffMatchScreen(a, b, mode)));
      ov.querySelector('.swap')!.addEventListener('click', () => void app.show(faceoffMatchScreen(b, a, mode)));
      ov.querySelector('[data-back]')!.addEventListener('click', () => void app.show(faceoffSetupScreen({ a, b, mode })));
    };

    const pause = () => {
      if (over) return;
      el.classList.add('paused');
      const { result } = app.sheet(`<h2>Paused</h2><p>Both players can take a breather.</p>`, [
        { label: 'Keep playing', value: 'resume', kind: 'mint', back: true },
        { label: 'End the match', value: 'leave', kind: 'ghost' },
      ], 'Paused');
      void result.then((v) => {
        el.classList.remove('paused');
        if (v === 'leave') {
          over = true;
          void app.show(faceoffSetupScreen({ a, b, mode }));
          return;
        }
        // Fresh questions for both players, so nobody works one out during the pause.
        if (!over && current[0] && current[1]) askBoth();
      });
    };
    el.querySelector('.fo-pause')!.addEventListener('click', pause);

    const countdown = async () => {
      paintScores();
      for (const n of ['3', '2', '1', 'GO!']) {
        const marks = halves.map((h) => {
          const m = html(`<div class="fo-count">${n}</div>`);
          h.appendChild(m);
          if (!reducedMotion()) m.animate([{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.35 }, { transform: 'scale(.8)', opacity: 0 }], { duration: 650, easing: EASE_SPRING });
          return m;
        });
        app.sfx.pop();
        await wait(reducedMotion() ? 150 : 650);
        marks.forEach((m) => m.remove());
      }
      started = performance.now();
      askBoth();
      stagger(el.querySelectorAll('.fo-choices .choice'), { gap: 40, y: 10 });
    };

    return {
      el,
      keepAwake: true,
      colors: ['#FF7AA8', '#5F3DC4'],
      mounted: () => void countdown(),
      back: () => {
        pause();
        return true;
      },
    };
  };
}
