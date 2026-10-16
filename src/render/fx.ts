// Particle effects on a canvas layer: confetti, ring bursts, sparkles and impact stars.

import { reducedMotion } from './motion.ts';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  spin: number;
  rot: number;
  shape: 'rect' | 'circle' | 'star' | 'ring';
  g: number;
  drag: number;
}

const PALETTE = ['#FFD25A', '#FF7AA8', '#43E0A8', '#5CC8FF', '#A879FF', '#FF8A5C', '#FFFFFF'];
/** Confetti colours from the current theme (--fx-colors), or the default palette. */
const palette = (): string[] => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fx-colors').trim();
  return v ? v.split(/\s+/) : PALETTE;
};

export class Fx {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private parts: P[] = [];
  private raf = 0;
  private dpr = Math.min(2, devicePixelRatio || 1);

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }

  private origin(): DOMRect {
    return this.canvas.getBoundingClientRect();
  }

  /** Confetti shower from a point (screen coordinates). */
  confetti(x: number, y: number, n = 80, spread = 1): void {
    if (reducedMotion()) return;
    const o = this.origin();
    const colors = palette();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread;
      const v = 6 + Math.random() * 9;
      this.parts.push({
        x: x - o.x, y: y - o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 90 + Math.random() * 60,
        size: 6 + Math.random() * 6, color: colors[i % colors.length], spin: (Math.random() - 0.5) * 0.4, rot: Math.random() * 6,
        shape: Math.random() < 0.7 ? 'rect' : 'circle', g: 0.28, drag: 0.985,
      });
    }
    this.run();
  }

  /** A ring of sparks (correct answer, hit). */
  burst(x: number, y: number, color = '#FFD25A', n = 18, power = 1): void {
    if (reducedMotion()) return;
    const o = this.origin();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = (3 + Math.random() * 4) * power;
      this.parts.push({
        x: x - o.x, y: y - o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 34 + Math.random() * 16,
        size: 3 + Math.random() * 4, color: i % 3 ? color : '#FFFFFF', spin: 0.2, rot: 0, shape: i % 4 ? 'circle' : 'star', g: 0.05, drag: 0.93,
      });
    }
    this.parts.push({ x: x - o.x, y: y - o.y, vx: 0, vy: 0, life: 0, max: 26, size: 10, color, spin: 0, rot: 0, shape: 'ring', g: 0, drag: 1 });
    this.run();
  }

  /** Gentle twinkles rising (level complete, unlock). */
  sparkle(x: number, y: number, n = 14, color = '#FFE58A'): void {
    if (reducedMotion()) return;
    const o = this.origin();
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x - o.x + (Math.random() - 0.5) * 80, y: y - o.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 1.2, vy: -1.5 - Math.random() * 2,
        life: 0, max: 50 + Math.random() * 40, size: 3 + Math.random() * 5, color, spin: 0.1, rot: 0, shape: 'star', g: -0.01, drag: 0.99,
      });
    }
    this.run();
  }

  /** One drawing loop at most; it stops (and clears the canvas) as soon as the last particle fades. */
  private run(): void {
    if (this.raf) return;
    const tick = () => {
      this.draw();
      this.raf = this.parts.length ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  private draw(): void {
    const c = this.ctx;
    const d = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(d, 0, 0, d, 0, 0);
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const p of this.parts) {
      p.life++;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      const a = 1 - p.life / p.max;
      c.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
      c.fillStyle = p.color;
      c.strokeStyle = p.color;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      if (p.shape === 'rect') c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else if (p.shape === 'circle') {
        c.beginPath();
        c.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        c.fill();
      } else if (p.shape === 'ring') {
        c.lineWidth = 4 * a;
        c.beginPath();
        c.arc(0, 0, p.size + (1 - a) * 70, 0, Math.PI * 2);
        c.stroke();
      } else {
        star(c, p.size);
      }
      c.restore();
    }
    c.globalAlpha = 1;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}

function star(c: CanvasRenderingContext2D, r: number): void {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.4 : r;
    const a = (i / 8) * Math.PI * 2;
    c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}
