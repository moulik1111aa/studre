// Parent area → Reading voice: every English voice on the phone (tap to choose and hear it)
// and the speed.

import { html, type App, type Screen } from './app.ts';
import { ICONS } from './icons.ts';
import { parentScreen } from './parent.ts';
import { hearVoice, mountVoiceList, speedSeg, VOICE_SAMPLE } from './voicechoice.ts';

export function voiceScreen(app: App): Screen {
  const st = app.save.data.settings;
  let chosen = { name: st.voiceName, pitch: st.voicePitch ?? 1 };
  let rate = st.voiceRate;
  const el = html(`<section class="screen voicepick" aria-label="Reading voice">
    <header class="topbar"><button class="icon-btn back-btn" aria-label="Back">${ICONS.back}</button><span class="t">Reading voice</span><span style="width:50px"></span></header>
    <div class="scroll pa-body">
      <h2 class="pa-h">Voice</h2>
      <p class="fine">Tap a voice to hear it. Every child hears the one you choose.</p>
      <div class="card vl-list"></div>
      <h2 class="pa-h">Speed</h2>
      ${speedSeg(rate)}
      <p class="fine">More voices: phone Settings → Text-to-speech → install voice data (Speech Recognition &amp; Synthesis by Google sounds most natural).</p>
    </div>
    <button class="btn save">Save</button>
  </section>`);
  el.querySelectorAll<HTMLElement>('[data-rate]').forEach((b) =>
    b.addEventListener('click', () => {
      rate = Number(b.dataset.rate);
      el.querySelectorAll('[data-rate]').forEach((x) => (x.classList.toggle('on', x === b), x.setAttribute('aria-checked', String(x === b))));
      hearVoice(app, chosen, VOICE_SAMPLE, rate);
    }),
  );
  el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(parentScreen));
  el.querySelector('.save')!.addEventListener('click', () => {
    app.save.update((d) => {
      d.settings.voiceName = chosen.name;
      d.settings.voicePitch = chosen.pitch;
      d.settings.voiceRate = rate;
      for (const c of d.children) if (c.voicePicked) Object.assign(c, { voiceName: chosen.name, voicePitch: chosen.pitch });
    });
    app.voice.pitch = chosen.pitch;
    app.voice.name = chosen.name;
    app.voice.rate = rate;
    app.toast('Voice saved.');
    void app.show(parentScreen);
  });
  return { el, mounted: () => void mountVoiceList(app, el.querySelector<HTMLElement>('.vl-list')!, chosen, () => rate, (o) => (chosen = { name: o.name, pitch: o.pitch })) };
}
