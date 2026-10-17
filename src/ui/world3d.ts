// The map in 3D. Stages: one floating island per stage, stacked into the distance; swipe
// up and down to move between them (it settles on the nearest island). Tap an island to
// open it: the stage's levels become a winding path of tokens on a long island (gold when
// done, a pulsing ring and Biscuit on the next one, a castle for each boss); swipe along
// it and tap a token to open that level. "All stages" goes back.
// The look follows the app theme: colourful glass, inked paper (Schoolbook) or clean white
// shapes (Precision). Drawing pauses when hidden or after 20 s without a touch, and
// everything is freed when the map closes.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadThree, makeRenderer, softEnv, cutoutTex, svgCutoutTex, cloudTex, disposeAll, RenderLoop, type Three } from '../render/three.ts';
import { dogSvg } from './dog.ts';

export interface StageInfo {
  stage: number;
  name: string;
  world: string;
  done: number;
  total: number;
  state: 'done' | 'now' | 'locked';
  /** Final boss beaten: a gold flag on the castle. */
  boss: boolean;
}

export interface LevelNode {
  id: string;
  kind: 'skill' | 'review' | 'boss' | 'quest';
  /** Token text: skill number, ⚔️, 🧭, or the boss's emoji. */
  label: string;
  name: string;
  state: 'done' | 'now' | 'open' | 'locked';
}

type ThemeName = 'glass' | 'schoolbook' | 'precision';
const LOOK: Record<number, { top: string; rock: string; props: string[] }> = {
  1: { top: '#7BCB6B', rock: '#9C6B48', props: ['🌳', '🌼', '🍄', '🌲', '🦋', '🌷'] },
  2: { top: '#F2D49B', rock: '#B9824F', props: ['🌴', '🐚', '⛵', '🦀', '⚓', '🏝️'] },
  3: { top: '#78716C', rock: '#7F1D1D', props: ['🌋', '🔥', '💎', '🪨', '🦎', '🔥'] },
  4: { top: '#A5B4FC', rock: '#4C4A8A', props: ['🏙️', '⚙️', '🤖', '📡', '💡', '🔋'] },
  5: { top: '#FCD34D', rock: '#B45309', props: ['🍕', '🧀', '🍅', '🥫', '🍄', '🫑'] },
  6: { top: '#93C5FD', rock: '#1E3A8A', props: ['🌊', '🐙', '⚡', '🐚', '🪸', '🐠'] },
  7: { top: '#FBCFE8', rock: '#6B4F7A', props: ['🌸', '🏯', '🗻', '🎋', '⛩️', '🌸'] },
};
const PALETTE: Record<ThemeName, { label: string; labelBg: string; accent: string; gold: string; stone: string; outline: boolean; props: boolean; font: string }> = {
  glass: { label: '#ffffff', labelBg: 'rgba(15,21,48,.6)', accent: '#38BDF8', gold: '#F5C542', stone: '#F4EBD9', outline: false, props: true, font: '"Inter Display", Inter, system-ui' },
  schoolbook: { label: '#1F2A44', labelBg: 'rgba(255,255,255,.94)', accent: '#C8423B', gold: '#3E5C9A', stone: '#FFFFFF', outline: true, props: true, font: 'Schola, "TeX Gyre Schola", Georgia, serif' },
  precision: { label: '#111827', labelBg: 'rgba(255,255,255,.96)', accent: '#1D4ED8', gold: '#1D4ED8', stone: '#E5E7EB', outline: false, props: false, font: '"Inter Display", Inter, system-ui' },
};
const STAGE_GAP = 12;
const LEVEL_GAP = 2.1;

export interface WorldOptions {
  stages: StageInfo[];
  levels: (stage: number) => LevelNode[];
  current: number;
  next: string;
  onLevel: (id: string) => void;
  onNext: () => void;
}

export class World3D {
  readonly el: HTMLElement;
  private readonly o: WorldOptions;
  private T: Three = null;
  private r: any = null;
  private scene: any = null;
  private cam: any = null;
  private content: any = null;
  private loop: RenderLoop | null = null;
  private dead = false;
  private resize = () => {};
  private theme: ThemeName = 'glass';
  private mode: 'stages' | 'levels' = 'stages';
  private stage = 1;
  private focus = 0;
  private target = 0;
  private velocity = 0;
  private min = 0;
  private max = 0;
  private snaps: number[] = [];
  private picks: any[] = [];
  private updaters: ((t: number) => void)[] = [];
  private dogTex: any = null;
  private texCache = new Map<string, any>();
  private titleKey = '';

  constructor(o: WorldOptions) {
    this.o = o;
    this.stage = o.current;
    this.el = document.createElement('div');
    this.el.className = 'world3d';
    this.el.innerHTML = `<div class="wv-top"><button class="wv-back" hidden>‹ All stages</button><span class="wv-title"></span></div>
      <div class="wv-hint"></div><button class="wv-next">${o.next}</button>`;
    this.el.querySelector('.wv-back')!.addEventListener('click', () => this.showStages(this.stage));
    this.el.querySelector('.wv-next')!.addEventListener('click', () => {
      if (this.mode === 'levels' && this.stage === this.o.current) this.o.onNext();
      else this.showLevels(this.o.current);
    });
    void this.init();
  }

  private async init(): Promise<void> {
    let T: Three;
    try {
      T = this.T = await loadThree();
    } catch {
      this.el.dispatchEvent(new CustomEvent('no3d', { bubbles: true }));
      this.el.remove();
      return;
    }
    if (this.dead) return;
    const t = document.documentElement.dataset.theme as ThemeName;
    this.theme = t in PALETTE ? t : 'glass';
    const R = makeRenderer(T, this.el);
    this.r = R.r;
    this.r.domElement.style.touchAction = 'none';
    const scene = (this.scene = new T.Scene());
    scene.environment = softEnv(T, this.r);
    this.cam = new T.PerspectiveCamera(38, R.w / R.h, 0.1, 300);
    this.resize = () => {
      R.resize();
      this.cam.aspect = R.w / R.h;
      this.cam.updateProjectionMatrix();
    };
    this.resize();
    addEventListener('resize', this.resize);
    const g = this.theme === 'glass';
    scene.add(new T.HemisphereLight(g ? '#e0e7ff' : '#ffffff', g ? '#3b2a5a' : '#cbd5e1', g ? 1.6 : 2.2));
    const sun = new T.DirectionalLight('#fff7ed', g ? 2.6 : 1.8);
    sun.position.set(-5, 10, 6);
    scene.add(sun);
    this.dogTex = await svgCutoutTex(T, dogSvg({ noShadow: true }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="210" '), 200, 210, this.theme === 'precision' ? 0 : 10);
    if (this.dead) return;
    this.bindInput();
    this.loop = new RenderLoop(this.el, (time) => this.draw(time), 20000);
    this.showStages(this.o.current);
    this.el.classList.add('ready');
  }

  // ---------- input: drag to move along, tap to pick ----------
  private bindInput(): void {
    const c = this.r.domElement as HTMLCanvasElement;
    let y0 = 0;
    let last = 0;
    let lastT = 0;
    let moved = 0;
    let down = false;
    c.addEventListener('pointerdown', (e) => {
      down = true;
      y0 = last = e.clientY;
      lastT = performance.now();
      moved = 0;
      this.velocity = 0;
      c.setPointerCapture?.(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dy = e.clientY - last;
      moved = Math.max(moved, Math.abs(e.clientY - y0));
      // Swipe up to go further along (later stages / later levels).
      const k = this.mode === 'stages' ? 0.05 : 0.035;
      this.target = Math.max(this.min - 1, Math.min(this.max + 1, this.target - dy * k));
      const now = performance.now();
      this.velocity = ((-dy * k) / Math.max(1, now - lastT)) * 16;
      last = e.clientY;
      lastT = now;
      this.loop?.touch();
    });
    const up = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      if (moved < 8) this.tap(e);
      else if (this.mode === 'stages') this.snapAfterFling();
      else this.target = Math.max(this.min, Math.min(this.max, this.target));
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => {
      down = false;
      if (this.mode === 'stages') this.snapAfterFling();
    });
  }

  private snapAfterFling(): void {
    const projected = this.target + this.velocity * 10;
    this.velocity = 0;
    this.target = this.snaps.reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a), this.snaps[0] ?? 0);
  }

  private tap(e: PointerEvent): void {
    const T = this.T;
    const b = this.r.domElement.getBoundingClientRect();
    const v = new T.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    const ray = new T.Raycaster();
    ray.setFromCamera(v, this.cam);
    const hit = ray.intersectObjects(this.picks, false)[0];
    if (!hit) {
      if (this.mode === 'stages') this.snapAfterFling();
      return;
    }
    const d = hit.object.userData;
    if (this.mode === 'stages' && d.stage) this.showLevels(d.stage);
    else if (this.mode === 'levels' && d.level) this.o.onLevel(d.level);
  }

  // ---------- frame ----------
  private draw(time: number): void {
    if (!this.cam) return;
    if (this.mode === 'levels' && Math.abs(this.velocity) > 0.001) {
      this.target = Math.max(this.min, Math.min(this.max, this.target + this.velocity));
      this.velocity *= 0.92;
    }
    this.focus += (this.target - this.focus) * 0.14;
    // Step back on tall, narrow screens so the island fills the width.
    const k = Math.max(1, Math.min(1.6, 0.78 / this.cam.aspect));
    if (this.mode === 'stages') {
      this.cam.position.set(0, 10.5 * k, 19 * k - 1 - this.focus);
      this.cam.lookAt(0, -0.6, -this.focus - 1.4);
    } else {
      this.cam.position.set(0, 9.0 * k, 9.5 * k - 2.6 - this.focus);
      this.cam.lookAt(0, -0.6, -this.focus - 2.6);
    }
    for (const u of this.updaters) u(time);
    this.r.render(this.scene, this.cam);
    this.updateTitle();
  }

  private updateTitle(): void {
    const s = this.mode === 'stages' ? this.o.stages[Math.max(0, Math.min(this.o.stages.length - 1, Math.round(this.focus / STAGE_GAP)))] : this.o.stages[this.stage - 1];
    const key = `${this.mode}:${s?.stage}`;
    if (!s || key === this.titleKey) return;
    this.titleKey = key;
    this.el.querySelector<HTMLElement>('.wv-title')!.textContent = this.mode === 'stages' ? `Stage ${s.stage} of ${this.o.stages.length}` : `Stage ${s.stage} · ${s.name}`;
    this.el.querySelector<HTMLElement>('.wv-hint')!.textContent = this.mode === 'stages' ? 'Swipe up for more stages · tap an island for its levels' : 'Swipe along the path · tap a level to play';
  }

  // ---------- helpers ----------
  private clear(): void {
    if (this.content) {
      this.scene.remove(this.content);
      disposeAll(this.content);
    }
    this.texCache.forEach((t) => t.dispose());
    this.texCache.clear();
    this.content = new this.T.Group();
    this.scene.add(this.content);
    this.picks = [];
    this.updaters = [];
    this.titleKey = '';
  }

  private flat(c: string): any {
    return new this.T.MeshStandardMaterial({ color: c, flatShading: this.theme !== 'precision', roughness: 0.85 });
  }

  private outline(mesh: any, s = 1.04): void {
    if (!PALETTE[this.theme].outline) return;
    const o = new this.T.Mesh(mesh.geometry, new this.T.MeshBasicMaterial({ color: '#1F2A44', side: this.T.BackSide }));
    o.scale.setScalar(s);
    mesh.add(o);
  }

  private mix(a: string, b: string, k: number): string {
    return '#' + new this.T.Color(a).lerp(new this.T.Color(b), k).getHexString();
  }

  private colours(stage: number): { top: string; rock: string } {
    const L = LOOK[stage] ?? LOOK[1];
    if (this.theme === 'precision') return { top: '#F8FAFC', rock: '#E2E8F0' };
    if (this.theme === 'schoolbook') return { top: this.mix(L.top, '#FBFBF8', 0.45), rock: this.mix(L.rock, '#FBFBF8', 0.35) };
    return L;
  }

  private cut(e: string): any {
    if (!this.texCache.has(e)) this.texCache.set(e, cutoutTex(this.T, e, 160, 10));
    return this.texCache.get(e);
  }

  private sprite(parent: any, tex: any, x: number, y: number, z: number, s: number, aspect = 1): any {
    const m = new this.T.Sprite(new this.T.SpriteMaterial({ map: tex, transparent: true, toneMapped: false }));
    m.position.set(x, y, z);
    m.scale.set(s * aspect, s, 1);
    m.center.set(0.5, 0.08);
    parent.add(m);
    return m;
  }

  private label(title: string, sub: string, strong: boolean): any {
    const T = this.T;
    const P = PALETTE[this.theme];
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 150;
    const g = c.getContext('2d')!;
    // Shrink the type to fit long names.
    let big = 50;
    let small = 36;
    const measure = () => {
      g.font = `600 ${big}px ${P.font}`;
      const a = g.measureText(title).width;
      g.font = `500 ${small}px ${P.font}`;
      return Math.max(a, g.measureText(sub).width);
    };
    while (measure() > 460 && big > 30) {
      big -= 2;
      small = Math.round(big * 0.72);
    }
    const w = Math.min(504, measure() + 52);
    g.fillStyle = strong ? (this.theme === 'glass' ? 'rgba(56,189,248,.92)' : this.theme === 'schoolbook' ? '#1F2A44' : '#1D4ED8') : P.labelBg;
    g.beginPath();
    g.roundRect((512 - w) / 2, 8, w, 132, this.theme === 'schoolbook' ? 10 : 28);
    g.fill();
    if (this.theme !== 'glass' && !strong) {
      g.strokeStyle = this.theme === 'schoolbook' ? '#1F2A44' : '#E5E7EB';
      g.lineWidth = this.theme === 'schoolbook' ? 4 : 3;
      g.stroke();
    }
    g.fillStyle = strong ? '#ffffff' : P.label;
    g.textAlign = 'center';
    g.font = `600 ${big}px ${P.font}`;
    g.fillText(title, 256, 68);
    g.globalAlpha = 0.85;
    g.font = `500 ${small}px ${P.font}`;
    g.fillText(sub, 256, 118);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, toneMapped: false, depthTest: false }));
    s.scale.set(5.0, 5.0 * (150 / 512), 1);
    s.renderOrder = 10;
    return s;
  }

  private castle(parent: any, x: number, z: number, gold: boolean): any {
    const T = this.T;
    const keep = new T.Group();
    keep.position.set(x, 0.25, z);
    parent.add(keep);
    const wall = this.flat(this.theme === 'glass' ? '#D9D4E8' : '#ffffff');
    const roofC = this.theme === 'precision' ? '#94A3B8' : this.theme === 'schoolbook' ? '#C8423B' : '#E11D48';
    for (const [tx, tz, h] of [[-0.6, 0, 1.4], [0.6, 0, 1.4], [0, -0.3, 2.0]] as const) {
      const tw = new T.Mesh(new T.CylinderGeometry(0.36, 0.4, h, 8), wall);
      tw.position.set(tx, h / 2, tz);
      keep.add(tw);
      this.outline(tw, 1.06);
      const rf = new T.Mesh(new T.ConeGeometry(0.48, 0.7, 8), this.flat(roofC));
      rf.position.set(tx, h + 0.35, tz);
      keep.add(rf);
      this.outline(rf, 1.06);
    }
    const flagGeo = new T.PlaneGeometry(0.8, 0.5, 6, 2);
    const flag = new T.Mesh(flagGeo, new T.MeshBasicMaterial({ color: gold ? (this.theme === 'glass' ? '#FBBF24' : PALETTE[this.theme].gold) : '#F8FAFC', side: T.DoubleSide }));
    flag.position.set(0.45, 3.1, -0.3);
    keep.add(flag);
    const phase = x + z;
    this.updaters.push((t) => {
      const pos = flagGeo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const fx = pos.getX(k);
        pos.setZ(k, Math.sin(fx * 7 - t * 6 + phase) * 0.06 * (fx + 0.4));
      }
      pos.needsUpdate = true;
    });
    return keep;
  }

  private dog(parent: any, x: number, z: number, s = 1.5): void {
    const d = this.sprite(parent, this.dogTex, x, 0.35, z, s, 200 / 210);
    this.updaters.push((t) => (d.position.y = 0.35 + Math.abs(Math.sin(t * 3)) * 0.4));
  }

  private sky(): void {
    if (!PALETTE[this.theme].props) return;
    const T = this.T;
    const ct = cloudTex(T);
    this.texCache.set('cloud', ct);
    [[-1, 4.5, 0.3], [1, 6, 0.75]].forEach(([dir, y, ph]) => {
      const m = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, opacity: 0.85, toneMapped: false }));
      m.scale.set(5, 2.5, 1);
      this.content.add(m);
      this.updaters.push((t) => {
        const u = (t * 0.03 + ph) % 1;
        m.position.set(dir * (-12 + u * 24), y, -this.focus - 6);
      });
    });
    const bird = new T.Sprite(new T.SpriteMaterial({ map: this.cut('🐦'), transparent: true, toneMapped: false }));
    this.content.add(bird);
    this.updaters.push((t) => {
      const u = (t * 0.06) % 1;
      bird.position.set(-9 + u * 18, 5.5 + Math.sin(t * 2) * 0.3, -this.focus - 3);
      bird.scale.set(0.9, 0.9 * (0.75 + 0.25 * Math.abs(Math.sin(t * 6))), 1);
    });
  }

  // ---------- stages ----------
  showStages(focusStage: number): void {
    const T = this.T;
    this.mode = 'stages';
    this.el.classList.remove('levels');
    this.el.querySelector<HTMLElement>('.wv-back')!.hidden = true;
    this.clear();
    const P = PALETTE[this.theme];
    this.o.stages.forEach((s, i) => {
      const z = -i * STAGE_GAP;
      const x = i % 2 ? 1.0 : -1.0;
      const { top, rock: rockC } = this.colours(s.stage);
      const locked = s.state === 'locked';
      const g = new T.Group();
      g.position.set(x, 0, z);
      g.scale.setScalar(0.78);
      this.content.add(g);
      const cap = new T.Mesh(new T.CylinderGeometry(4.6, 4.4, 0.5, this.theme === 'precision' ? 48 : 11), this.flat(top));
      g.add(cap);
      this.outline(cap, 1.03);
      if (this.theme === 'precision') {
        const rim = new T.Mesh(new T.TorusGeometry(4.55, 0.1, 8, 64), new T.MeshBasicMaterial({ color: locked ? '#CBD5E1' : (LOOK[s.stage] ?? LOOK[1]).top }));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.26;
        g.add(rim);
      }
      const rock = new T.Mesh(new T.ConeGeometry(4.4, 3.4, this.theme === 'precision' ? 48 : 11, 2), this.flat(rockC));
      rock.rotation.x = Math.PI;
      rock.position.y = -1.95;
      g.add(rock);
      this.outline(rock, 1.03);
      const curve = new T.CatmullRomCurve3([[-3, 0, 2.2], [-0.6, 0, 2.6], [0.6, 0, 0.6], [-1.6, 0, -0.8], [0.8, 0, -2.2], [2.0, 0, -1.4]].map((q) => new T.Vector3(...q)));
      const frac = s.total ? s.done / s.total : 0;
      for (let k = 0; k <= 16; k++) {
        const q = curve.getPoint(k / 16);
        const gold = k / 16 < frac || s.state === 'done';
        const st = new T.Mesh(new T.CylinderGeometry(0.3, 0.34, 0.14, 12), new T.MeshStandardMaterial({ color: gold ? P.gold : P.stone, metalness: gold && this.theme === 'glass' ? 0.6 : 0, roughness: 0.4 }));
        st.position.set(q.x, 0.3, q.z);
        g.add(st);
      }
      this.castle(g, 2.8, -2.6, s.boss);
      if (P.props) [[-3.1, -1.6], [3.3, 1.5], [-0.4, 3.5], [1.4, -3.6]].forEach(([px, pz], k) => this.sprite(g, this.cut((LOOK[s.stage] ?? LOOK[1]).props[k]), px, 0.25, pz, 1.9));
      if (locked) {
        g.traverse((o: any) => o.material && !o.isSprite && ((o.material.transparent = true), (o.material.opacity = 0.5)));
        this.sprite(g, this.cut('🔒'), 0, 0.4, 0.6, 2.4);
      }
      if (s.state === 'now') {
        this.dog(g, -1.4, 1.4, 2.6);
        const ring = new T.Mesh(new T.RingGeometry(4.9, 5.2, 64), new T.MeshBasicMaterial({ color: P.accent, transparent: true, side: T.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.1;
        g.add(ring);
        this.updaters.push((t) => {
          const k = (t * 0.5) % 1;
          ring.scale.setScalar(1 + k * 0.25);
          ring.material.opacity = 0.9 * (1 - k);
        });
      }
      const lab = this.label(`Stage ${s.stage} · ${s.name}`, locked ? `${s.world} · locked` : s.state === 'done' ? `${s.world} · finished ✓` : `${s.world} · ${s.done} of ${s.total} skills`, s.state === 'now');
      lab.position.set(x, 3.2, z + 1.2);
      this.content.add(lab);
      // Only the island in focus is labelled clearly.
      this.updaters.push(() => (lab.material.opacity = Math.max(0, 1 - Math.abs(z + this.focus) / 8)));
      const hit = new T.Mesh(new T.CylinderGeometry(4.8, 4.8, 6, 12), new T.MeshBasicMaterial({ visible: false }));
      hit.position.y = -0.5;
      hit.userData.stage = s.stage;
      g.add(hit);
      this.picks.push(hit);
      this.updaters.push((t) => (g.position.y = Math.sin(t * 0.8 + i * 1.3) * 0.15));
    });
    // Bridges between islands
    for (let i = 0; i < this.o.stages.length - 1; i++) {
      const a = new T.Vector3(i % 2 ? 1.0 : -1.0, 0.2, -i * STAGE_GAP - 3.4);
      const b = new T.Vector3((i + 1) % 2 ? 1.0 : -1.0, 0.2, -(i + 1) * STAGE_GAP + 3.4);
      const curve = new T.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(new T.Vector3(0, -0.6, 0)), b);
      const done = this.o.stages[i].state === 'done';
      for (let k = 0; k <= 12; k++) {
        const q = curve.getPoint(k / 12);
        const plank = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 0.26), this.flat(done ? (this.theme === 'glass' ? '#B7791F' : P.gold) : this.theme === 'glass' ? '#94A3B8' : '#CBD5E1'));
        plank.position.copy(q);
        plank.lookAt(curve.getPoint(Math.min(1, k / 12 + 0.01)));
        this.content.add(plank);
      }
    }
    this.sky();
    this.min = 0;
    this.max = (this.o.stages.length - 1) * STAGE_GAP;
    this.snaps = this.o.stages.map((_, i) => i * STAGE_GAP);
    this.target = (Math.max(1, focusStage) - 1) * STAGE_GAP;
    this.focus = this.target + 3;
    this.velocity = 0;
    this.loop?.touch();
  }

  // ---------- levels of one stage ----------
  showLevels(stage: number): void {
    const T = this.T;
    this.mode = 'levels';
    this.stage = stage;
    this.el.classList.add('levels');
    this.el.querySelector<HTMLElement>('.wv-back')!.hidden = false;
    this.clear();
    const P = PALETTE[this.theme];
    const L = LOOK[stage] ?? LOOK[1];
    const { top, rock } = this.colours(stage);
    const nodes = this.o.levels(stage);
    const pos = (i: number) => new T.Vector3(Math.sin(i * 0.7) * 1.6, 0, -i * LEVEL_GAP);
    // A long winding island under the path
    const capMat = this.flat(top);
    const rockMat = this.flat(rock);
    const discGeo = new T.CylinderGeometry(3.0, 2.9, 0.5, this.theme === 'precision' ? 32 : 9);
    const coneGeo = new T.ConeGeometry(2.6, 2.6, this.theme === 'precision' ? 32 : 8, 1);
    for (let i = -1; i <= nodes.length; i++) {
      const p = pos(i);
      const disc = new T.Mesh(discGeo, capMat);
      disc.position.set(p.x * 0.5, -0.05, p.z);
      disc.rotation.y = i * 0.7;
      this.content.add(disc);
      if (i % 2 === 0) {
        const r = new T.Mesh(coneGeo, rockMat);
        r.rotation.x = Math.PI;
        r.position.set(p.x * 0.5, -1.6, p.z);
        this.content.add(r);
      }
    }
    if (P.outline) {
      const pts: any[] = [];
      for (let i = -1; i <= nodes.length; i++) pts.push(new T.Vector3(pos(i).x * 0.5 - 3.0, 0.21, pos(i).z));
      const ink = new T.MeshBasicMaterial({ color: '#1F2A44' });
      this.content.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), nodes.length * 4 + 8, 0.05, 4), ink));
      this.content.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((v: any) => v.clone().add(new T.Vector3(6.0, 0, 0)))), nodes.length * 4 + 8, 0.05, 4), ink));
    }
    // Stepping stones between tokens
    const stoneGeo = new T.CylinderGeometry(0.14, 0.16, 0.08, 7);
    const stoneMat = this.flat(P.stone);
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let k = 1; k < 4; k++) {
        const p = pos(i).lerp(pos(i + 1), k / 4);
        const s = new T.Mesh(stoneGeo, stoneMat);
        s.position.set(p.x, 0.24, p.z);
        this.content.add(s);
      }
    }
    // Tokens
    const tex = (txt: string, color: string) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      g.fillStyle = color;
      g.font = `600 ${/\d/.test(txt) ? 62 : 58}px ${PALETTE[this.theme].font}, "Noto Color Emoji", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt, 64, 70);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      return t;
    };
    let nowIndex = -1;
    nodes.forEach((n, i) => {
      const p = pos(i);
      if (n.kind === 'boss') {
        const keep = this.castle(this.content, p.x, p.z, n.state === 'done');
        keep.scale.setScalar(1.15);
        const hit = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 4, 12), new T.MeshBasicMaterial({ visible: false }));
        hit.position.y = 1.5;
        hit.userData.level = n.id;
        keep.add(hit);
        this.picks.push(hit);
        this.sprite(this.content, this.cut(n.label), p.x, 3.4, p.z + 0.2, 1.1);
        if (n.state === 'now') nowIndex = i;
      } else {
        const g = new T.Group();
        g.position.set(p.x, 0.25, p.z);
        const col = n.state === 'done' ? P.gold : n.state === 'now' ? '#ffffff' : n.state === 'open' ? (this.theme === 'glass' ? '#E0E7FF' : '#F1F5F9') : this.theme === 'glass' ? '#9CA3AF' : '#E5E7EB';
        const base = new T.Mesh(new T.CylinderGeometry(0.55, 0.6, 0.26, 28), new T.MeshStandardMaterial({ color: col, metalness: n.state === 'done' && this.theme === 'glass' ? 0.6 : 0.05, roughness: 0.35 }));
        g.add(base);
        this.outline(base, 1.08);
        const face = new T.Mesh(new T.CircleGeometry(0.44, 28), new T.MeshBasicMaterial({ map: tex(n.label, n.state === 'done' && this.theme !== 'glass' ? '#ffffff' : n.state === 'locked' ? '#6B7280' : '#0F1530'), transparent: true }));
        face.rotation.x = -Math.PI / 2;
        face.position.y = 0.135;
        g.add(face);
        const hit = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 1.6, 12), new T.MeshBasicMaterial({ visible: false }));
        hit.userData.level = n.id;
        g.add(hit);
        this.picks.push(hit);
        if (n.state === 'now') {
          nowIndex = i;
          const ring = new T.Mesh(new T.RingGeometry(0.75, 0.84, 40), new T.MeshBasicMaterial({ color: P.accent, transparent: true, side: T.DoubleSide, depthWrite: false }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.02;
          g.add(ring);
          this.updaters.push((t) => {
            const k = (t * 0.7) % 1;
            ring.scale.setScalar(1 + k * 0.7);
            ring.material.opacity = 0.9 * (1 - k);
          });
        }
        this.content.add(g);
      }
      if (n.state === 'now') this.dog(this.content, p.x + (p.x > 0 ? -1.2 : 1.2), p.z + 0.3, 1.5);
      // Props on the outside of each bend
      if (P.props && i % 2 === 0) this.sprite(this.content, this.cut(L.props[i % L.props.length]), (p.x > 0 ? -1 : 1) * 2.1 + p.x * 0.2, 0.2, p.z - 0.6, 1.3);
    });
    this.sky();
    this.min = 0;
    this.max = Math.max(0, (nodes.length - 1) * LEVEL_GAP);
    this.snaps = [];
    const start = nowIndex >= 0 ? nowIndex : nodes.findIndex((n) => n.state !== 'done');
    this.target = Math.max(0, (start < 0 ? nodes.length - 1 : start) - 1) * LEVEL_GAP;
    this.focus = this.target - 6;
    this.velocity = 0;
    this.loop?.touch();
  }

  destroy(): void {
    this.dead = true;
    this.loop?.stop();
    removeEventListener('resize', this.resize);
    if (this.scene) {
      disposeAll(this.scene);
      this.scene.environment?.dispose?.();
      this.dogTex?.dispose?.();
    }
    if (this.r) {
      this.r.dispose();
      this.r.forceContextLoss?.();
      this.r.domElement.remove();
    }
  }
}
