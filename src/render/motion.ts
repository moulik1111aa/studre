// Motion helpers for the premium feel (spec §8): self-drawing strokes, staggered entrances,
// liquid page transitions, springy presses, coin flights and screen shake.
// Everything animates transform/opacity (or SVG dash offsets) for smooth 120 Hz motion.

export const reducedMotion = (): boolean => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
export const EASE_SPRING = 'cubic-bezier(.2,.9,.3,1.04)';
export const EASE_IN_OUT = 'cubic-bezier(.65,0,.35,1)';
export const EASE_DRAW = 'cubic-bezier(.5,0,.3,1)';

export const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Draw every stroke of an SVG on, one after another, then (optionally) fade its fills in.
 * Strokes need no setup: path lengths are normalised with pathLength="1".
 */
export async function drawOn(svg: SVGElement, opts: { duration?: number; stagger?: number; fillDelay?: number; fill?: boolean } = {}): Promise<void> {
  const { duration = 900, stagger = 110, fillDelay = 200, fill = true } = opts;
  const strokes = [...svg.querySelectorAll<SVGGeometryElement>('[data-draw]')];
  const fills = [...svg.querySelectorAll<SVGElement>('[data-fill]')];
  if (reducedMotion()) {
    strokes.forEach((s) => (s.style.strokeDashoffset = '0'));
    fills.forEach((f) => (f.style.opacity = '1'));
    return;
  }
  for (const s of strokes) {
    s.setAttribute('pathLength', '1');
    s.style.strokeDasharray = '1 1';
    s.style.strokeDashoffset = '1';
  }
  for (const f of fills) f.style.opacity = '0';
  const anims = strokes.map((s, i) =>
    s.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration, delay: i * stagger, easing: EASE_DRAW, fill: 'forwards' }).finished,
  );
  const last = strokes.length ? (strokes.length - 1) * stagger + duration : 0;
  const fillAnims = fill
    ? fills.map((f, i) => f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: last - 200 + fillDelay + i * 60, easing: 'ease-out', fill: 'forwards' }).finished)
    : [];
  await Promise.allSettled([...anims, ...fillAnims]);
}

/** Rise-and-fade entrance for a list of elements, ~70 ms apart. */
export function stagger(els: Iterable<Element>, opts: { delay?: number; gap?: number; y?: number; scale?: number } = {}): void {
  if (reducedMotion()) return;
  const { delay = 0, gap = 70, y = 18, scale = 0.98 } = opts;
  let i = 0;
  for (const el of els) {
    (el as HTMLElement).animate(
      [
        { opacity: 0, transform: `translateY(${y}px) scale(${scale})` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 620, delay: delay + i++ * gap, easing: EASE_OUT, fill: 'backwards' },
    );
  }
}

/** Pop an element in with a soft overshoot. */
export function popIn(el: Element, delay = 0, from = 0.92): Animation | null {
  if (reducedMotion()) return null;
  return (el as HTMLElement).animate(
    [
      { opacity: 0, transform: `scale(${from})` },
      { opacity: 1, transform: 'scale(1.015)', offset: 0.7 },
      { opacity: 1, transform: 'scale(1)' },
    ],
    { duration: 560, delay, easing: EASE_OUT, fill: 'backwards' },
  );
}

/** A gentle no-no shake (wrong answer). */
export function shake(el: Element, strength = 10): void {
  if (reducedMotion()) return;
  const s = strength;
  (el as HTMLElement).animate(
    [{ transform: 'translateX(0)' }, { transform: `translateX(${-s}px)` }, { transform: `translateX(${s}px)` }, { transform: `translateX(${-s * 0.6}px)` }, { transform: `translateX(${s * 0.3}px)` }, { transform: 'translateX(0)' }],
    { duration: 420, easing: 'ease-out' },
  );
}

/** Whole-screen impact shake (boss hits). */
export function screenShake(el: Element, power = 1): void {
  if (reducedMotion()) return;
  const p = 8 * power;
  (el as HTMLElement).animate(
    [
      { transform: 'translate(0,0)' },
      { transform: `translate(${-p}px,${p * 0.5}px) rotate(-.4deg)` },
      { transform: `translate(${p}px,${-p * 0.4}px) rotate(.4deg)` },
      { transform: `translate(${-p * 0.5}px,${p * 0.3}px)` },
      { transform: 'translate(0,0)' },
    ],
    { duration: 380, easing: 'ease-out' },
  );
}

/**
 * Liquid page transition: a coloured wave pours down over the screen, the swap happens
 * under it, then the wave drains away downwards.
 */
export async function liquidWipe(host: HTMLElement, colorA: string, colorB: string, swap: () => void | Promise<void>): Promise<void> {
  if (reducedMotion()) {
    await swap();
    return;
  }
  const w = host.clientWidth || innerWidth;
  const h = host.clientHeight || innerHeight;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'liquid');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `<defs><linearGradient id="lq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colorA}"/><stop offset="1" stop-color="${colorB}"/></linearGradient></defs><path fill="url(#lq)"/>`;
  const path = svg.querySelector('path')!;
  host.appendChild(svg);
  // The wave edge is a gentle curve; above it is liquid while pouring, below it while draining.
  const edgePoints = (edge: number, t: number): [number, number][] => {
    const amp = h * 0.05;
    return Array.from({ length: 9 }, (_, i) => {
      const x = (w * i) / 8;
      return [x, edge + Math.sin(i * 1.1 + t * 6) * amp] as [number, number];
    });
  };
  const curve = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const wave = (edge: number, t: number, pouring: boolean): string => {
    const pts = edgePoints(edge, t);
    return pouring
      ? `${curve(pts)} L${w},0 L0,0 Z`
      : `${curve(pts)} L${w},${h} L0,${h} Z`;
  };
  const run = (ms: number, step: (t: number) => void): Promise<void> =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        step(t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  await run(520, (t) => path.setAttribute('d', wave(-h * 0.2 + ease(t) * h * 1.35, t, true)));
  path.setAttribute('d', `M0,0 L${w},0 L${w},${h} L0,${h} Z`);
  await swap();
  await frame();
  await run(560, (t) => path.setAttribute('d', wave(-h * 0.15 + ease(t) * h * 1.35, t, false)));
  svg.remove();
}

/** Fly a small element (a coin) along a curved path from one point to another. */
export function flyArc(el: HTMLElement, from: DOMRect | { x: number; y: number }, to: DOMRect | { x: number; y: number }, ms = 760, delay = 0): Promise<void> {
  const fx = 'width' in from ? from.x + from.width / 2 : from.x;
  const fy = 'width' in from ? from.y + from.height / 2 : from.y;
  const tx = 'width' in to ? to.x + to.width / 2 : to.x;
  const ty = 'width' in to ? to.y + to.height / 2 : to.y;
  const lift = Math.min(160, Math.abs(fy - ty) * 0.5 + 60);
  const kf: Keyframe[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = fx + (tx - fx) * t;
    const y = fy + (ty - fy) * t - Math.sin(Math.PI * t) * lift;
    const s = 1 + Math.sin(Math.PI * t) * 0.35 - t * 0.3;
    kf.push({ transform: `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s}) rotate(${t * 360}deg)`, opacity: i === 12 ? 0.2 : 1 });
  }
  return el.animate(kf, { duration: reducedMotion() ? 1 : ms, delay, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' }).finished.then(() => undefined);
}

/** Count a number up inside an element. */
export function countUp(el: HTMLElement, from: number, to: number, ms = 700, format = (n: number) => String(Math.round(n))): void {
  if (reducedMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Shrink a question's text until its card fits the space it has (long word problems,
 * long expressions). Pictures shrink a little too. Never below `min` px; if it still
 * overflows, the card scrolls.
 */
export function fitCard(card: HTMLElement, room: HTMLElement, min = 16): void {
  const prompt = card.querySelector<HTMLElement>('.prompt');
  if (!prompt) return;
  prompt.style.fontSize = '';
  const vis = card.querySelector<HTMLElement>('.vis');
  if (vis) vis.style.zoom = '';
  let size = parseFloat(getComputedStyle(prompt).fontSize) || 32;
  const over = () => card.scrollHeight > room.clientHeight + 1 || prompt.scrollWidth > prompt.clientWidth + 1;
  for (let i = 0; i < 30 && over() && size > min; i++) {
    size -= 2;
    prompt.style.fontSize = `${size}px`;
    if (vis && i % 3 === 2) vis.style.zoom = String(Math.max(0.6, Number(vis.style.zoom || 1) - 0.1));
  }
}
