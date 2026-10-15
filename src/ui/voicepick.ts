// Parent area → Reading voice: pick one of the phone's English voices and the speed,
// with a "Try" button for each.

import { html, esc, type App, type Screen } from './app.ts';
import { ICONS } from './icons.ts';
import { stagger } from '../render/motion.ts';
import { parentScreen } from './parent.ts';

const SAMPLE = 'Hello! What is 7 plus 8? Take your time.';
const SPEEDS: [number, string][] = [[0.8, 'Slow'], [0.95, 'Normal'], [1.1, 'Quick']];

export function voiceScreen(app: App): Screen {
  let chosen = app.save.data.settings.voiceName;
  let rate = app.save.data.settings.voiceRate;
  const el = html(`<section class="screen voicepick" aria-label="Reading voice">
    <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Reading voice</span><span style="width:50px"></span></header>
    <div class="scroll pa-body">
      <h2 class="pa-h">Speed</h2>
      <div class="seg seg3">${SPEEDS.map(([v, t]) => `<button class="seg-b${Math.abs(v - rate) < 0.01 ? ' on' : ''}" data-rate="${v}"><b>${t}</b></button>`).join('')}</div>
      <h2 class="pa-h">Voice</h2>
      <div class="card vp-list"><p class="fine">Finding voices…</p></div>
      <p class="fine">More voices: phone Settings → Text-to-speech → install voice data (Speech Recognition &amp; Synthesis by Google sounds most natural).</p>
    </div>
    <button class="btn save">Save</button>
  </section>`);
  const list = el.querySelector<HTMLElement>('.vp-list')!;
  const paint = async () => {
    const voices = await app.voice.list();
    const rows = [{ name: '', label: 'Automatic — the clearest voice on this phone', network: false }, ...voices];
    list.innerHTML = rows
      .map((v) => `<div class="vp-row${v.name === chosen ? ' on' : ''}" data-name="${esc(v.name)}"><button class="vp-pick" aria-pressed="${v.name === chosen}"><i></i><span>${esc(v.label)}</span></button><button class="btn ghost small vp-try" aria-label="Try ${esc(v.label)}">${ICONS.speaker} Try</button></div>`)
      .join('');
    stagger(list.children, { gap: 30 });
  };
  list.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.vp-row');
    if (!row) return;
    const name = row.dataset.name ?? '';
    if ((e.target as HTMLElement).closest('.vp-try')) {
      const prev = app.voice.name;
      app.voice.name = name;
      app.voice.say(SAMPLE, rate, true);
      app.voice.name = prev;
      return;
    }
    chosen = name;
    list.querySelectorAll<HTMLElement>('.vp-row').forEach((r) => {
      r.classList.toggle('on', r === row);
      r.querySelector('.vp-pick')!.setAttribute('aria-pressed', String(r === row));
    });
  });
  el.querySelectorAll<HTMLElement>('[data-rate]').forEach((b) =>
    b.addEventListener('click', () => {
      rate = Number(b.dataset.rate);
      el.querySelectorAll('[data-rate]').forEach((x) => x.classList.toggle('on', x === b));
      app.voice.say(SAMPLE, rate, true);
    }),
  );
  el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(parentScreen));
  el.querySelector('.save')!.addEventListener('click', () => {
    app.save.update((d) => {
      d.settings.voiceName = chosen;
      d.settings.voiceRate = rate;
    });
    app.voice.name = chosen;
    app.voice.rate = rate;
    app.toast('Voice saved.');
    void app.show(parentScreen);
  });
  return { el, mounted: () => void paint() };
}
