// A boss fight in 3D: the boss stands on a small floating arena island. Four bosses are
// built as 3D models (Mr Bubbles, Gobble, Blaze the dragon, Robo-Multiplex); the others
// stand in the 3D arena as 2D cut-outs of their usual art. Attacks are 3D: the player's
// gold star flies in with a light trail; bosses answer with bubbles, fireballs, lasers or
// their own thrown objects. Same methods as BossView (bosses.ts), which it falls back to
// when 3D is not available. Everything is disposed when the fight screen closes.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { BossView, ART } from './bosses.ts';
import type { Fx } from '../render/fx.ts';
import { loadThree, makeRenderer, softEnv, cutoutTex, svgCutoutTex, glowTex, disposeAll, RenderLoop, type Three } from '../render/three.ts';
import { reducedMotion, screenShake, wait, EASE_OUT } from '../render/motion.ts';

type Attack = 'bubbles' | 'fire' | 'laser' | 'emoji';
const MODEL: Record<string, { attack: Attack }> = {
  bubbles: { attack: 'bubbles' },
  gobble: { attack: 'emoji' },
  blaze: { attack: 'fire' },
  multiplex: { attack: 'laser' },
};
const ISLAND: Record<number, [string, string]> = {
  1: ['#7BCB6B', '#9C6B48'], 2: ['#F9C6E0', '#B07AA1'], 3: ['#57534E', '#7F1D1D'], 4: ['#F2C26B', '#C27C46'],
  5: ['#4ADE80', '#7C5A3A'], 6: ['#A5B4FC', '#4C4A8A'], 7: ['#EEF4FF', '#7C8DB5'],
};
const INK = '#1B1440';

/** A running effect: return false when finished. */
type Effect = (now: number) => boolean;

export class Boss3DView {
  readonly el: HTMLElement;
  private readonly id: string;
  private readonly stage: number;
  private readonly fxHost: HTMLElement;
  private fallback: BossView | null = null;
  private T: Three = null;
  private r: any = null;
  private scene: any = null;
  private cam: any = null;
  private boss: any = null;
  private tick: (t: number) => void = () => {};
  private loop: RenderLoop | null = null;
  private effects: Effect[] = [];
  private flashMats: any[] = [];
  private flash = 0;
  private recoil = 0;
  private bossScale = 1;
  private phaseLevel = 0;
  private dead = false;
  private resize = () => {};
  private white: any = null;
  private tints: any[] = [];

  private readonly fx: Fx;

  constructor(bossId: string, fx: Fx, stage: number) {
    this.fx = fx;
    this.id = bossId;
    this.stage = stage;
    this.el = document.createElement('div');
    this.el.className = 'boss3d';
    this.el.innerHTML = `<div class="boss-fx"></div>`;
    this.fxHost = this.el.querySelector('.boss-fx')!;
  }

  /** Build the 3D scene; on any failure, fall back to the 2D boss. */
  private async init(): Promise<boolean> {
    try {
      const T = (this.T = await loadThree());
      if (this.dead) return false;
      const R = makeRenderer(T, this.el);
      this.r = R.r;
      this.resize = () => {
        R.resize();
        this.cam.aspect = R.w / R.h;
        this.cam.updateProjectionMatrix();
      };
      const scene = (this.scene = new T.Scene());
      scene.environment = softEnv(T, this.r);
      this.cam = new T.PerspectiveCamera(36, R.w / R.h, 0.1, 100);
      this.cam.position.set(0, 0.8, 9.4);
      this.cam.lookAt(0, -0.4, 0);
      this.resize();
      addEventListener('resize', this.resize);
      scene.add(new T.HemisphereLight('#e0e7ff', '#3b2a5a', 1.5));
      const sun = new T.DirectionalLight('#fff3dc', 2.6);
      sun.position.set(-4, 8, 7);
      scene.add(sun);
      const rim = new T.DirectionalLight('#f0abfc', 1.4);
      rim.position.set(5, 3, -5);
      scene.add(rim);
      // Arena island
      const [top, rock] = ISLAND[this.stage] ?? ISLAND[1];
      const arena = new T.Group();
      const cap = new T.Mesh(new T.CylinderGeometry(2.6, 2.5, 0.35, 12), new T.MeshStandardMaterial({ color: top, flatShading: true, roughness: 0.9 }));
      cap.position.y = -1.55;
      arena.add(cap);
      const under = new T.Mesh(new T.ConeGeometry(2.5, 2.4, 12, 2), new T.MeshStandardMaterial({ color: rock, flatShading: true, roughness: 0.9 }));
      under.rotation.x = Math.PI;
      under.position.y = -2.9;
      arena.add(under);
      const shadow = new T.Mesh(new T.CircleGeometry(1.3, 32), new T.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.36;
      arena.add(shadow);
      scene.add(arena);
      // Boss
      const built = await this.buildBoss(T);
      this.boss = built.g;
      this.tick = built.tick;
      scene.add(this.boss);
      this.boss.traverse((o: any) => {
        if (o.material && o.material.emissive && !o.material.userData.glowing) {
          o.material.userData.base = o.material.emissive.clone();
          this.flashMats.push(o.material);
        }
      });
      this.white = new T.Color('#ffffff');
      this.tints = [new T.Color('#451a03'), new T.Color('#7f1d1d')];
      this.loop = new RenderLoop(this.el, (t) => this.draw(t), 0, false);
      return true;
    } catch {
      return false;
    }
  }

  private async buildBoss(T: Three): Promise<{ g: any; tick: (t: number) => void }> {
    const std = (c: string, o: object = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.45, ...o });
    const glossy = (c: string, o: object = {}) => new T.MeshPhysicalMaterial({ color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, ...o });
    const g = new T.Group();
    const eyes = (parent: any, { x = 0.36, y = 0.2, z = 0.95, r = 0.26, angry = 0.35 } = {}) => {
      const white = std('#ffffff', { roughness: 0.2 });
      const black = std(INK, { roughness: 0.3 });
      for (const sx of [-1, 1]) {
        const e = new T.Mesh(new T.SphereGeometry(r, 24, 12), white);
        e.position.set(sx * x, y, z);
        e.scale.set(1, 1.1, 0.6);
        parent.add(e);
        const p = new T.Mesh(new T.SphereGeometry(r * 0.5, 16, 8), black);
        p.position.set(sx * x + 0.03, y - 0.02, z + r * 0.42);
        p.scale.set(1, 1.1, 0.6);
        parent.add(p);
        const sh = new T.Mesh(new T.SphereGeometry(r * 0.16, 8, 6), new T.MeshBasicMaterial({ color: '#fff' }));
        sh.position.set(sx * x + 0.1, y + 0.07, z + r * 0.6);
        parent.add(sh);
        const brow = new T.Mesh(new T.BoxGeometry(r * 1.7, r * 0.32, 0.1), black);
        brow.position.set(sx * x, y + r * 1.25, z + 0.02);
        brow.rotation.z = -sx * angry;
        parent.add(brow);
      }
    };
    const smile = (parent: any, y: number, z: number, w: number) => {
      const m = new T.Mesh(new T.TorusGeometry(w, 0.05, 8, 20, Math.PI), std(INK));
      m.rotation.z = Math.PI;
      m.position.set(0, y, z);
      parent.add(m);
    };
    switch (this.id) {
      case 'bubbles': {
        const body = new T.Mesh(new T.SphereGeometry(1.25, 48, 24), glossy('#8EE3FF', { transparent: true, opacity: 0.93, iridescence: 1, iridescenceIOR: 1.3, envMapIntensity: 1.6 }));
        g.add(body);
        const hl = new T.Mesh(new T.SphereGeometry(0.28, 16, 8), new T.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.8 }));
        hl.scale.set(1.4, 0.7, 0.3);
        hl.position.set(-0.55, 0.7, 0.98);
        hl.rotation.z = 0.6;
        g.add(hl);
        eyes(g, { z: 1.08 });
        smile(g, -0.38, 1.12, 0.3);
        const minis = Array.from({ length: 4 }, (_, i) => {
          const b = new T.Mesh(new T.SphereGeometry(0.18 + (i % 3) * 0.07, 20, 10), glossy('#BDEFFF', { transparent: true, opacity: 0.75 }));
          g.add(b);
          return b;
        });
        return { g, tick: (t) => { body.scale.set(1 + Math.sin(t * 3) * 0.03, 1 - Math.sin(t * 3) * 0.03, 1); minis.forEach((b, i) => { const a = t * 0.9 + i * 1.57; b.position.set(Math.cos(a) * 1.75, 0.3 + Math.sin(t * 1.4 + i) * 0.5, Math.sin(a) * 1.1); }); } };
      }
      case 'gobble': {
        const body = new T.Mesh(new T.SphereGeometry(1.2, 40, 24), glossy('#8B5CF6'));
        body.scale.set(1.15, 1, 0.95);
        g.add(body);
        const belly = new T.Mesh(new T.SphereGeometry(0.8, 24, 12), std('#C4B5FD'));
        belly.scale.set(1, 0.8, 0.5);
        belly.position.set(0, -0.45, 0.85);
        g.add(belly);
        for (const sx of [-1, 1]) {
          const h = new T.Mesh(new T.ConeGeometry(0.2, 0.7, 12), glossy('#FBBF24', { metalness: 0.4 }));
          h.position.set(sx * 0.6, 1.15, 0.1);
          h.rotation.z = -sx * 0.35;
          g.add(h);
          const f = new T.Mesh(new T.SphereGeometry(0.32, 16, 8), glossy('#7C3AED'));
          f.scale.set(1.2, 0.6, 1.3);
          f.position.set(sx * 0.6, -1.15, 0.3);
          g.add(f);
        }
        eyes(g, { y: 0.35, z: 1.0, r: 0.27, angry: 0.45 });
        const m = new T.Mesh(new T.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#3B0A2A'));
        m.scale.set(1.3, 0.8, 0.5);
        m.position.set(0, -0.15, 0.98);
        g.add(m);
        for (const sx of [-1, 1]) {
          const tooth = new T.Mesh(new T.ConeGeometry(0.07, 0.16, 8), std('#fff'));
          tooth.rotation.x = Math.PI;
          tooth.position.set(sx * 0.2, -0.2, 1.18);
          g.add(tooth);
        }
        return { g, tick: (t) => { g.rotation.z = Math.sin(t * 2) * 0.06; body.scale.y = 1 + Math.sin(t * 4) * 0.03; } };
      }
      case 'multiplex': {
        const metal = std('#CBD5E1', { metalness: 0.7, roughness: 0.25 });
        const dark = std('#334155', { metalness: 0.5, roughness: 0.4 });
        const rb = (w: number, h: number, d: number, r: number, m: any) => {
          const s = new T.Shape();
          s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
          s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
          const geo = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
          geo.center();
          return new T.Mesh(geo, m);
        };
        const body = rb(1.6, 1.3, 1.0, 0.2, metal);
        body.position.y = -0.55;
        g.add(body);
        const head = rb(1.4, 1.0, 1.0, 0.25, metal);
        head.position.y = 0.75;
        g.add(head);
        const visor = rb(1.1, 0.45, 0.1, 0.18, std('#0F172A', { roughness: 0.1 }));
        visor.position.set(0, 0.8, 0.56);
        g.add(visor);
        const eyeMat = std('#22D3EE', { emissive: '#22D3EE', emissiveIntensity: 2.2 });
        eyeMat.userData.glowing = true;
        for (const sx of [-1, 1]) {
          const e = rb(0.26, 0.14, 0.02, 0.05, eyeMat);
          e.position.set(sx * 0.25, 0.82, 0.63);
          g.add(e);
        }
        const ant = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.5), dark);
        ant.position.set(0, 1.5, 0);
        g.add(ant);
        const bulbMat = std('#F43F5E', { emissive: '#F43F5E', emissiveIntensity: 2 });
        bulbMat.userData.glowing = true;
        const bulb = new T.Mesh(new T.SphereGeometry(0.11, 12, 8), bulbMat);
        bulb.position.set(0, 1.78, 0);
        g.add(bulb);
        ['#A78BFA', '#34D399', '#FBBF24'].forEach((c, i) => {
          const b = rb(0.22, 0.14, 0.05, 0.04, std(c, { emissive: c, emissiveIntensity: 0.6 }));
          b.position.set(-0.35 + i * 0.35, -0.4, 0.56);
          g.add(b);
        });
        for (const sx of [-1, 1]) {
          const arm = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.9, 12), dark);
          arm.position.set(sx * 1.0, -0.55, 0);
          arm.rotation.z = sx * 0.4;
          g.add(arm);
          const hand = new T.Mesh(new T.SphereGeometry(0.22, 16, 8), metal);
          hand.position.set(sx * 1.2, -1.0, 0.1);
          g.add(hand);
        }
        return { g, tick: (t) => { bulbMat.emissiveIntensity = (t * 2) % 1 < 0.5 ? 2.5 : 0.3; head.rotation.y = Math.sin(t * 1.2) * 0.12; } };
      }
      case 'blaze': {
        const red = new T.MeshPhysicalMaterial({ color: '#EF4444', roughness: 0.35, clearcoat: 1, flatShading: true });
        const body = new T.Mesh(new T.IcosahedronGeometry(1.1, 2), red);
        body.scale.set(1.1, 1, 0.95);
        body.position.y = -0.5;
        g.add(body);
        const belly = new T.Mesh(new T.IcosahedronGeometry(0.75, 2), std('#FCD34D', { flatShading: true }));
        belly.scale.set(1, 1.1, 0.5);
        belly.position.set(0, -0.55, 0.75);
        g.add(belly);
        const head = new T.Mesh(new T.IcosahedronGeometry(0.8, 2), red);
        head.position.set(0, 0.75, 0.2);
        g.add(head);
        const snout = new T.Mesh(new T.IcosahedronGeometry(0.45, 1), red);
        snout.scale.set(1.2, 0.8, 1);
        snout.position.set(0, 0.55, 0.85);
        g.add(snout);
        for (const sx of [-1, 1]) {
          const h = new T.Mesh(new T.ConeGeometry(0.14, 0.6, 8), std('#FDE68A'));
          h.position.set(sx * 0.42, 1.45, 0.05);
          h.rotation.set(-0.3, 0, -sx * 0.4);
          g.add(h);
        }
        eyes(g, { x: 0.3, y: 0.95, z: 0.78, r: 0.2, angry: 0.5 });
        const ws = new T.Shape();
        ws.moveTo(0, 0); ws.lineTo(1.6, 0.9); ws.lineTo(1.4, 0.2); ws.lineTo(1.7, -0.2); ws.lineTo(1.1, -0.3); ws.lineTo(1.2, -0.7); ws.lineTo(0.2, -0.4); ws.closePath();
        const wings = [-1, 1].map((sx) => {
          const w = new T.Mesh(new T.ShapeGeometry(ws), std('#B91C1C', { side: T.DoubleSide, flatShading: true }));
          w.scale.set(sx, 1, 1);
          w.position.set(sx * 0.6, -0.1, -0.4);
          g.add(w);
          return [w, sx] as const;
        });
        const tail = new T.Mesh(new T.ConeGeometry(0.25, 1.4, 8), red);
        tail.position.set(1.0, -1.05, -0.2);
        tail.rotation.z = 1.9;
        g.add(tail);
        return { g, tick: (t) => { wings.forEach(([w, sx]) => (w.rotation.y = sx * (0.3 + Math.sin(t * 6) * 0.45))); g.position.y = Math.sin(t * 3) * 0.08; } };
      }
      default: {
        // Any other boss: its usual art as a standing cut-out in the 3D arena.
        const art = ART[this.id];
        const tex = await svgCutoutTex(T, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="320" height="320">${art.svg.replace(/ data-(draw|fill)/g, '')}</svg>`, 320, 320, 12);
        const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, toneMapped: false }));
        s.scale.set(3.1, 3.1, 1);
        s.center.set(0.5, 0.06);
        s.position.y = -1.42;
        g.add(s);
        return { g, tick: (t) => { s.position.y = -1.42 + Math.abs(Math.sin(t * 2.2)) * 0.12; s.material.rotation = Math.sin(t * 1.3) * 0.04; s.material.color.setScalar(1 + this.flash * 1.5); } };
      }
    }
  }

  private draw(t: number): void {
    const now = performance.now();
    this.tick(t);
    this.effects = this.effects.filter((e) => e(now));
    // Hurt flash and recoil decay
    this.flash = Math.max(0, this.flash - 0.06);
    this.recoil = Math.max(0, this.recoil - 0.07);
    const tint = this.phaseLevel ? this.tints[Math.min(2, this.phaseLevel) - 1] : null;
    for (const m of this.flashMats) {
      m.emissive.copy(tint ?? m.userData.base);
      m.emissive.lerp(this.white, this.flash * 0.7);
    }
    if (this.boss) {
      this.boss.rotation.x = -this.recoil * 0.3;
      this.boss.position.z = -this.recoil * 0.5;
      this.boss.scale.setScalar(this.bossScale * (1 + this.phaseLevel * 0.05));
    }
    this.r.render(this.scene, this.cam);
  }

  // ---------- effects ----------
  private add(e: Effect): void {
    this.effects.push(e);
    this.loop?.touch();
  }

  private glow(rgb: string, s: number): any {
    const T = this.T;
    const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex(T, rgb), blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    m.scale.setScalar(s);
    this.scene.add(m);
    return m;
  }

  private remove(...objs: any[]): void {
    for (const o of objs) {
      this.scene.remove(o);
      disposeAll(o);
    }
  }

  /** A burst of sparks at a point. */
  private sparks(at: any, rgb = '253,230,138', n = 40, power = 1): void {
    const T = this.T;
    const pos = new Float32Array(n * 3);
    const geo = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ color: `rgb(${rgb})`, size: 0.12, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }));
    this.scene.add(pts);
    const fl = this.glow(rgb, 2.6 * power);
    fl.position.copy(at);
    const dirs = Array.from({ length: n }, (_, i) => new T.Vector3(Math.cos(i * 2.39) * Math.cos(((i % 7) / 7) * Math.PI - Math.PI / 2), Math.sin(((i % 7) / 7) * Math.PI - Math.PI / 2) + 0.4, Math.sin(i * 2.39) * 0.6 + 0.5));
    const t0 = performance.now();
    this.add((now) => {
      const k = (now - t0) / 700;
      if (k >= 1) {
        this.remove(pts, fl);
        return false;
      }
      for (let i = 0; i < n; i++) pos.set([at.x + dirs[i].x * k * 2.2 * power, at.y + dirs[i].y * k * 2 * power - k * k * 1.2, at.z + dirs[i].z * k * 2 * power], i * 3);
      geo.attributes.position.needsUpdate = true;
      pts.material.opacity = 1 - k;
      fl.material.opacity = Math.max(0, 1 - k * 2.5);
      fl.scale.setScalar(2.6 * power * (1 + k));
      return true;
    });
  }

  /** Fly an object along a curve over `ms`, with an optional glowing trail; resolves on arrival. */
  private fly(obj: any, curve: any, ms: number, trailRgb: string | null, spin = 0, grow = 0): Promise<void> {
    const trail = trailRgb ? Array.from({ length: 10 }, () => this.glow(trailRgb, 0.6)) : [];
    this.scene.add(obj);
    const t0 = performance.now();
    return new Promise((done) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this.remove(obj, ...trail);
        done();
      };
      // Never wait on drawing: the move finishes on time even if frames are skipped.
      setTimeout(finish, ms + 60);
      this.add((now) => {
        if (finished) return false;
        const k = Math.min(1, (now - t0) / ms);
        const e = k * k * (3 - 2 * k);
        obj.position.copy(curve.getPoint(e));
        if (spin) obj.rotation.set((now / 1000) * spin, (now / 700) * spin, 0);
        if (obj.material?.rotation !== undefined && spin) obj.material.rotation = (now / 1000) * spin;
        if (grow) obj.scale.setScalar(1 + e * grow);
        trail.forEach((s, i) => {
          const u = Math.max(0, e - (i + 1) * 0.03);
          s.position.copy(curve.getPoint(u));
          s.visible = u > 0;
          s.material.opacity = 0.7 * (1 - i / 10);
          s.scale.setScalar(0.6 * (1 - i / 12) * (1 + u * grow));
        });
        if (k >= 1) {
          finish();
          return false;
        }
        return true;
      });
    });
  }

  private starMesh(scale = 1): any {
    const T = this.T;
    const s = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 ? 0.2 : 0.45;
      if (i) s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    const geo = new T.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
    geo.center();
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: '#F5C542', metalness: 1, roughness: 0.25, emissive: '#7a4a05', emissiveIntensity: 0.4 }));
    m.scale.setScalar(scale);
    return m;
  }

  private target(): any {
    return new this.T.Vector3(0, 0.1, 0.9);
  }

  private float(text: string, cls: string): void {
    const t = document.createElement('div');
    t.className = `dmg ${cls}`;
    t.textContent = text;
    this.fxHost.appendChild(t);
    if (reducedMotion()) return void setTimeout(() => t.remove(), 900);
    t.animate([{ transform: 'translate(-50%,0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-30px) scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-80px) scale(1)', opacity: 0 }], { duration: 1100, easing: EASE_OUT }).finished.then(() => t.remove());
  }

  // ---------- BossView API ----------
  async enter(): Promise<void> {
    if (await this.init()) {
      this.bossScale = 0.6;
      const t0 = performance.now();
      this.add((now) => {
        const k = Math.min(1, (now - t0) / 650);
        this.bossScale = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3));
        return k < 1;
      });
      await wait(650);
      return;
    }
    // No 3D here: use the 2D boss.
    this.fallback = new BossView(this.id, this.fx);
    this.el.replaceChildren(this.fallback.el);
    this.el.classList.add('flat');
    await this.fallback.enter();
  }

  async hit(from: DOMRect, damage: number, critical: boolean, stage: HTMLElement): Promise<void> {
    if (this.fallback) return this.fallback.hit(from, damage, critical, stage);
    const T = this.T;
    const star = this.starMesh(critical ? 1.4 : 1);
    const start = new T.Vector3(0.4, -3.2, 7.2);
    const to = this.target();
    await this.fly(star, new T.QuadraticBezierCurve3(start, new T.Vector3(1.4, 0.6, 4), to), critical ? 380 : 460, '253,224,71', 8);
    this.sparks(to, critical ? '255,236,179' : '253,224,71', critical ? 60 : 36, critical ? 1.4 : 1);
    this.flash = 1;
    this.recoil = 1;
    if (critical && !reducedMotion()) screenShake(stage, 1.4);
    this.float(critical ? `CRITICAL! −${damage}` : `−${damage}`, critical ? 'crit' : '');
  }

  async special(stage: HTMLElement, damage: number): Promise<void> {
    if (this.fallback) return this.fallback.special(stage, damage);
    const T = this.T;
    const ov = document.createElement('div');
    ov.className = 'special';
    ov.innerHTML = `<div class="sp-title">SUPER MOVE!</div>`;
    stage.appendChild(ov);
    screenShake(stage, 2);
    const to = this.target();
    const shots = Array.from({ length: 5 }, (_, i) =>
      wait(i * 120).then(() => this.fly(this.starMesh(1.1), new T.QuadraticBezierCurve3(new T.Vector3((i - 2) * 1.4, -3, 7), new T.Vector3((i - 2) * 1.2, 1.5, 3.5), to), 520, '253,224,71', 8).then(() => {
        this.sparks(to, '255,255,255', 40, 1.3);
        this.flash = 1;
        this.recoil = 1;
      })),
    );
    await Promise.all(shots);
    this.float(`SUPER! −${damage}`, 'crit');
    await wait(500);
    ov.remove();
  }

  miss(): void {
    if (this.fallback) return this.fallback.miss();
    const t0 = performance.now();
    this.add((now) => {
      const k = (now - t0) / 600;
      if (this.boss) this.boss.position.y = Math.sin(Math.min(1, k) * Math.PI) * 0.5;
      return k < 1;
    });
    this.float('Ha ha!', 'taunt');
  }

  async attack(target: DOMRect): Promise<void> {
    if (this.fallback) return this.fallback.attack(target);
    const T = this.T;
    // Wind up
    const t0 = performance.now();
    this.add((now) => {
      const k = (now - t0) / 420;
      this.bossScale = 1 + Math.sin(Math.min(1, k) * Math.PI) * 0.12;
      return k < 1;
    });
    await wait(reducedMotion() ? 0 : 380);
    const kind = MODEL[this.id]?.attack ?? 'emoji';
    const from = new T.Vector3(0, 0.3, 1.1);
    const end = (x: number) => new T.Vector3(x, -2.6, 8.4);
    const arc = (x: number, lift = 0.6) => new T.QuadraticBezierCurve3(from, new T.Vector3(x * 0.5, from.y + lift, 4.5), end(x));
    if (kind === 'bubbles') {
      const mk = () => new T.Mesh(new T.SphereGeometry(0.32, 24, 12), new T.MeshPhysicalMaterial({ color: '#BDEFFF', roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.6, iridescence: 1 }));
      await Promise.all([-0.9, 0.2, 1.0].map((x, i) => wait(i * 90).then(() => this.fly(mk(), arc(x, 0.9), 650, null, 0, 1.6))));
    } else if (kind === 'fire') {
      const fire = () => {
        const g = new T.Group();
        g.add(new T.Mesh(new T.SphereGeometry(0.28, 16, 8), new T.MeshBasicMaterial({ color: '#FFF7ED', toneMapped: false })));
        const a = new T.Sprite(new T.SpriteMaterial({ map: glowTex(T, '251,146,60'), blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
        a.scale.setScalar(2);
        g.add(a);
        return g;
      };
      await Promise.all([-0.6, 0.6].map((x, i) => wait(i * 140).then(() => this.fly(fire(), arc(x, 0.3), 650, '249,115,22', 0, 1.3))));
    } else if (kind === 'laser') {
      const mat = new T.MeshBasicMaterial({ color: '#67E8F9', transparent: true, opacity: 0.9, blending: T.AdditiveBlending, toneMapped: false, depthWrite: false });
      const beams = [-1, 1].map(() => {
        const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.22, 1, 12, 1, true), mat);
        this.scene.add(m);
        return m;
      });
      const t1 = performance.now();
      await new Promise<void>((done) => {
        let over = false;
        setTimeout(() => {
          if (over) return;
          over = true;
          beams.forEach((m) => this.remove(m));
          done();
        }, 720);
        this.add((now) => {
          if (over) return false;
          const k = Math.min(1, (now - t1) / 650);
          beams.forEach((m, i) => {
            const sx = i ? 1 : -1;
            const a = new T.Vector3(sx * 0.25, 0.82, 0.8);
            const d = new T.Vector3(sx * 0.9, -3.4, 8).normalize();
            const len = Math.min(1, k * 1.6) * 9;
            m.scale.set(1 + Math.sin(now / 25) * 0.15, len, 1 + Math.sin(now / 25) * 0.15);
            m.position.copy(a).addScaledVector(d, len / 2);
            m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d);
          });
          if (k >= 1) {
            over = true;
            beams.forEach((m) => this.remove(m));
            done();
            return false;
          }
          return true;
        });
      });
    } else {
      const e = ART[this.id]?.shot ?? '💥';
      const tex = cutoutTex(T, e, 160, 10);
      const mk = () => {
        const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, toneMapped: false }));
        s.scale.setScalar(0.9);
        return s;
      };
      await Promise.all([-0.7, 0.7].map((x, i) => wait(i * 120).then(() => this.fly(mk(), arc(x, 0.8), 650, '255,255,255', 6, 1.4))));
    }
    void target;
  }

  defend(ok: boolean, at: DOMRect, stage: HTMLElement): void {
    if (this.fallback) return this.fallback.defend(ok, at, stage);
    const T = this.T;
    if (ok) {
      // A glowing hexagon shield in front of the player.
      const ring = new T.Mesh(new T.RingGeometry(1.1, 1.35, 6), new T.MeshBasicMaterial({ color: '#7DD3FC', transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, toneMapped: false, depthWrite: false }));
      ring.position.set(0, -1.6, 6.5);
      this.scene.add(ring);
      const g = this.glow('125,211,252', 3);
      g.position.copy(ring.position);
      const t0 = performance.now();
      this.add((now) => {
        const k = (now - t0) / 600;
        if (k >= 1) {
          this.remove(ring, g);
          return false;
        }
        ring.scale.setScalar(0.8 + k * 0.6);
        ring.rotation.z = k * 1.2;
        ring.material.opacity = 1 - k;
        g.material.opacity = 1 - k;
        return true;
      });
      this.sparks(new T.Vector3(0, -1.6, 6.5), '186,230,253', 30, 0.8);
    } else {
      screenShake(stage, 1.2);
      const flash = document.createElement('div');
      flash.className = 'hurt-flash';
      stage.appendChild(flash);
      setTimeout(() => flash.remove(), 600);
    }
  }

  phase(n: number, stage: HTMLElement): void {
    if (this.fallback) return this.fallback.phase(n, stage);
    this.phaseLevel = n;
    this.flash = 1;
    screenShake(stage, 1.5);
    this.float(n === 1 ? 'Grrr!' : 'GRRRAAH!', 'taunt');
  }

  async defeat(stage: HTMLElement): Promise<void> {
    if (this.fallback) return this.fallback.defeat(stage);
    const T = this.T;
    // Swell, flash white, then break into tumbling shards.
    const t0 = performance.now();
    this.add((now) => {
      const k = (now - t0) / 450;
      this.bossScale = 1 + Math.min(1, k) * 0.2;
      this.flash = Math.min(1, k);
      return k < 1;
    });
    await wait(450);
    const color = new T.Color(ART[this.id]?.color ?? '#A78BFA');
    const mat = new T.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1, flatShading: true, side: T.DoubleSide, transparent: true });
    const shards = Array.from({ length: 36 }, (_, i) => {
      const m = new T.Mesh(new T.TetrahedronGeometry(0.16 + (i % 4) * 0.06), mat);
      m.position.set(0, 0.1, 0.4);
      this.scene.add(m);
      const a = i * 2.39;
      return { m, v: new T.Vector3(Math.cos(a) * (1 + (i % 5) * 0.4), 1.5 + (i % 6) * 0.45, Math.sin(a) * 0.8 + 0.8) };
    });
    this.sparks(new T.Vector3(0, 0.1, 0.6), '255,255,255', 70, 1.8);
    if (this.boss) this.boss.visible = false;
    screenShake(stage, 1.6);
    const t1 = performance.now();
    this.add((now) => {
      const k = (now - t1) / 1300;
      if (k >= 1) {
        shards.forEach((s) => this.scene.remove(s.m));
        disposeAll(shards[0]?.m);
        return false;
      }
      for (const s of shards) {
        s.m.position.set(s.v.x * k * 2.4, 0.1 + s.v.y * k * 2 - 4 * k * k, 0.4 + s.v.z * k * 2);
        s.m.rotation.set(k * 9 + s.v.x, k * 7, k * 5);
      }
      mat.opacity = 1 - Math.max(0, k - 0.6) / 0.4;
      return true;
    });
    await wait(1300);
    const after = ART[this.id]?.after;
    if (after) {
      const t = document.createElement('div');
      t.className = 'boss-after';
      t.textContent = after;
      this.el.appendChild(t);
    }
  }

  destroy(): void {
    this.dead = true;
    this.loop?.stop();
    removeEventListener('resize', this.resize);
    if (this.scene) {
      disposeAll(this.scene);
      this.scene.environment?.dispose?.();
    }
    if (this.r) {
      this.r.dispose();
      this.r.forceContextLoss?.();
      this.r.domElement.remove();
    }
  }
}
