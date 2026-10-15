// Time's up for today: a calm goodnight screen (stop mode).

import { html, esc, type App, type Screen } from './app.ts';
import type { Child } from '../storage/save.ts';
import { JarBar } from './jars.ts';
import { stagger, popIn } from '../render/motion.ts';
import { whosPlayingScreen } from './whos.ts';

export function timesUpScreen(child: Child) {
  return (app: App): Screen => {
    const el = html(`<section class="screen timesup" aria-label="Time's up">
      <div class="moon" aria-hidden="true"><span>🌙</span>${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};left:${(i * 37) % 95}%;top:${(i * 53) % 70}%"></i>`).join('')}</div>
      <h1 class="title">Great work today, ${esc(child.name)}!</h1>
      <p class="subtitle">That’s your ${app.save.data.settings.limitMinutes} minutes. See you tomorrow!</p>
      <div class="jar-slot"></div>
      <button class="btn ghost back-btn">Done</button>
    </section>`);
    const jar = new JarBar(child);
    el.querySelector('.jar-slot')!.appendChild(jar.el);
    el.querySelector('.back-btn')!.addEventListener('click', () => void app.show(whosPlayingScreen));
    return {
      el,
      mounted: () => {
        popIn(el.querySelector('.moon span')!);
        stagger(el.querySelectorAll('.title, .subtitle, .jar-slot, .btn'), { delay: 300, gap: 120 });
        app.voice.say(`Great work today, ${child.name}! See you tomorrow!`);
      },
    };
  };
}
