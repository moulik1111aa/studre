// A small frame-rate readout (parent setting "Show frame rate"), for testing how smoothly
// the app runs on a phone. Its own loop runs only while it is switched on.

export class FpsMeter {
  private el: HTMLElement | null = null;
  private raf = 0;

  set(on: boolean): void {
    if (on && !this.el) {
      this.el = document.createElement('div');
      this.el.className = 'fps-meter';
      this.el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.el);
      let frames = 0;
      let last = performance.now();
      let worst = 0;
      let prev = last;
      const step = (now: number) => {
        frames++;
        worst = Math.max(worst, now - prev);
        prev = now;
        if (now - last >= 500) {
          const fps = Math.round((frames * 1000) / (now - last));
          this.el!.textContent = `${fps} fps · ${Math.round(worst)} ms`;
          this.el!.dataset.level = fps >= 55 ? 'good' : fps >= 40 ? 'ok' : 'bad';
          frames = 0;
          worst = 0;
          last = now;
        }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    } else if (!on && this.el) {
      cancelAnimationFrame(this.raf);
      this.el.remove();
      this.el = null;
    }
  }
}
