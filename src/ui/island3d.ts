// The current stage as a small floating 3D island at the top of the map: the nearby levels
// are tokens on a stepping-stone path (gold when done, a pulsing ring on the next one),
// the stage boss waits in a castle at the end, and 2D cut-outs move around it: Biscuit
// hopping on the current level, fluttering insects, birds, drifting clouds and props
// from the stage's world. Tap a token or the castle to open it. Drawing pauses when the
// island scrolls away, the app is hidden or nobody has touched the screen for a while,
// and everything is disposed when the map closes.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadThree, makeRenderer, softEnv, cutoutTex, svgCutoutTex, textTex, cloudTex, disposeAll, RenderLoop, type Three } from '../render/three.ts';
import { dogSvg } from './dog.ts';

export interface IslandNode {
  id: string;
  /** Text on the token (skill number, ⚔ for a minion fight, the boss's emoji). */
  label: string;
  state: 'done' | 'now' | 'locked';
  boss?: boolean;
}

interface Look {
  top: string;
  rim: string;
  rock: string;
  stone: string;
  props: string[];
  fliers: string[];
  sky: string[];
  extra?: string;
  sea?: boolean;
  roof: string;
}
const LOOKS: Record<number, Look> = {
  1: { top: '#7BCB6B', rim: '#5DB25A', rock: '#9C6B48', stone: '#F4EBD9', props: ['🌳', '🌲', '🌼', '🍄', '🌳', '🌷'], fliers: ['🦋', '🐝'], sky: ['🐦', '🐦'], extra: '🎈', roof: '#E11D48' },
  2: { top: '#F2D49B', rim: '#E3BC74', rock: '#B9824F', stone: '#FFF7E6', props: ['🌴', '🐚', '🌴', '🦀', '🏝️', '⚓'], fliers: ['🦜'], sky: ['🕊️'], extra: '⛵', sea: true, roof: '#1D4ED8' },
  3: { top: '#57534E', rim: '#44403C', rock: '#7F1D1D', stone: '#FDE68A', props: ['🌋', '🔥', '🪨', '💎', '🔥', '🦎'], fliers: ['🔥'], sky: ['🦅'], roof: '#B91C1C' },
  4: { top: '#A5B4FC', rim: '#818CF8', rock: '#4C4A8A', stone: '#E0E7FF', props: ['🏙️', '⚙️', '📡', '💡', '🤖', '🔋'], fliers: ['🛸'], sky: ['🚀'], roof: '#7C3AED' },
  5: { top: '#FCD34D', rim: '#F59E0B', rock: '#B45309', stone: '#FFF7ED', props: ['🍕', '🧀', '🍅', '🥫', '🍄', '🫑'], fliers: ['🐝'], sky: ['🐦'], roof: '#DC2626' },
  6: { top: '#93C5FD', rim: '#60A5FA', rock: '#1E3A8A', stone: '#EFF6FF', props: ['🌊', '🐙', '🪸', '🐚', '⚓', '🐠'], fliers: ['🐟'], sky: ['⛈️'], sea: true, roof: '#0F766E' },
  7: { top: '#FBCFE8', rim: '#F9A8D4', rock: '#6B4F7A', stone: '#FFF1F7', props: ['🌸', '🏯', '🌸', '🎋', '⛩️', '🗻'], fliers: ['🦋'], sky: ['🐉'], roof: '#BE185D' },
};

const PATH: [number, number, number][] = [[-3.2, 0, 2.6], [-1.2, 0, 3.0], [0.6, 0, 1.9], [-0.4, 0, 0.4], [-2.6, 0, -0.4], [-1.6, 0, -2.0], [0.6, 0, -1.5], [2.2, 0, -0.2], [2.8, 0, -2.6]];
const SPOTS: [number, number][] = [[3.2, 1.6], [3.4, 0.5], [-3.6, 0.9], [-3.4, -2.2], [1.6, 2.8], [0.6, -3.4], [-0.2, -3.6], [3.6, -1.2], [-2.0, 1.2], [1.2, 0.4], [-0.6, 2.0], [2.4, 1.7]];

export class Island3D {
  readonly el: HTMLElement;
  private loop: RenderLoop | null = null;
  private r: any = null;
  private scene: any = null;
  private dead = false;
  private resize = () => {};

  constructor(stage: number, stageName: string, nodes: IslandNode[], onTap: (id: string) => void) {
    this.el = document.createElement('div');
    this.el.className = 'island3d';
    this.el.innerHTML = `<span class="is-name">${stageName}</span>`;
    void this.init(stage, nodes, onTap);
  }

  private async init(stage: number, nodes: IslandNode[], onTap: (id: string) => void): Promise<void> {
    let T: Three;
    try {
      T = await loadThree();
    } catch {
      this.el.remove();
      return;
    }
    if (this.dead) return;
    const look = LOOKS[stage] ?? LOOKS[1];
    const R = makeRenderer(T, this.el);
    this.r = R.r;
    const scene = (this.scene = new T.Scene());
    scene.environment = softEnv(T, this.r);
    const cam = new T.PerspectiveCamera(30, R.w / R.h, 0.1, 100);
    cam.position.set(0, 6.6, 16.2);
    cam.lookAt(0, -1.0, 0);
    this.resize = () => {
      R.resize();
      cam.aspect = R.w / R.h;
      cam.updateProjectionMatrix();
    };
    addEventListener('resize', this.resize);
    scene.add(new T.HemisphereLight('#e0e7ff', '#3b2a5a', 1.6));
    const sun = new T.DirectionalLight('#fff3dc', 2.6);
    sun.position.set(-5, 10, 6);
    scene.add(sun);
    const rimL = new T.DirectionalLight('#7dd3fc', 1.2);
    rimL.position.set(6, 3, -6);
    scene.add(rimL);
    const world = new T.Group();
    scene.add(world);
    const updaters: ((t: number) => void)[] = [];
    const flat = (c: string) => new T.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85 });
    const sprite = (tex: any, x: number, y: number, z: number, s: number, aspect = 1, upd?: (m: any, t: number) => void) => {
      const m = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, toneMapped: false }));
      m.position.set(x, y, z);
      m.scale.set(s * aspect, s, 1);
      m.center.set(0.5, 0.08);
      world.add(m);
      if (upd) updaters.push((t) => upd(m, t));
      return m;
    };

    // Island
    const island = new T.Group();
    world.add(island);
    island.add(new T.Mesh(new T.CylinderGeometry(4.6, 4.4, 0.45, 11, 1), flat(look.top)));
    const capRim = new T.Mesh(new T.CylinderGeometry(4.62, 4.62, 0.12, 11, 1), flat(look.rim));
    capRim.position.y = -0.2;
    island.add(capRim);
    const rock = new T.Mesh(new T.ConeGeometry(4.4, 3.4, 11, 2), flat(look.rock));
    rock.rotation.x = Math.PI;
    rock.position.y = -1.95;
    island.add(rock);
    if (look.sea) {
      const sea = new T.Mesh(new T.RingGeometry(5.0, 7.2, 48), new T.MeshBasicMaterial({ color: '#7DD3FC', transparent: true, opacity: 0.22, side: T.DoubleSide }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.y = -1.0;
      world.add(sea);
    }
    // Path
    const curve = new T.CatmullRomCurve3(PATH.map((p) => new T.Vector3(...p)));
    const stoneGeo = new T.CylinderGeometry(0.16, 0.18, 0.08, 7);
    const stoneMat = flat(look.stone);
    for (let i = 0; i <= 50; i++) {
      const p = curve.getPoint(i / 50);
      const s = new T.Mesh(stoneGeo, stoneMat);
      s.position.set(p.x, 0.26, p.z);
      s.rotation.y = i;
      island.add(s);
    }
    // Tokens (up to 7 levels) and the castle (stage boss) at the end
    const tokens: any[] = [];
    const window = nodes.filter((n) => !n.boss).slice(0, 7);
    const bossNode = nodes.find((n) => n.boss);
    const labelTex = (txt: string, color: string) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      g.fillStyle = color;
      g.font = `600 ${/\d/.test(txt) ? 64 : 58}px "Inter Display", Inter, "Noto Color Emoji", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt, 64, 70);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      return t;
    };
    let nowPos: any = null;
    window.forEach((n, i) => {
      const p = curve.getPoint(window.length === 1 ? 0.4 : (i / (window.length - 1)) * 0.86);
      const g = new T.Group();
      g.position.set(p.x, 0.3, p.z);
      const col = n.state === 'done' ? '#F5C542' : n.state === 'now' ? '#ffffff' : '#9CA3AF';
      const base = new T.Mesh(new T.CylinderGeometry(0.46, 0.5, 0.22, 24), new T.MeshStandardMaterial({ color: col, metalness: n.state === 'done' ? 0.6 : 0.05, roughness: 0.35 }));
      base.userData.node = n.id;
      g.add(base);
      const top = new T.Mesh(new T.CircleGeometry(0.36, 24), new T.MeshBasicMaterial({ map: labelTex(n.label, n.state === 'locked' ? '#4B5563' : '#0F1530'), transparent: true }));
      top.rotation.x = -Math.PI / 2;
      top.position.y = 0.115;
      top.userData.node = n.id;
      g.add(top);
      if (n.state === 'now') {
        nowPos = g.position;
        const ring = new T.Mesh(new T.RingGeometry(0.62, 0.7, 40), new T.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.9, side: T.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        g.add(ring);
        updaters.push((t) => {
          const k = (t * 0.7) % 1;
          ring.scale.setScalar(1 + k * 0.6);
          ring.material.opacity = 0.9 * (1 - k);
        });
      }
      island.add(g);
      tokens.push(base, top);
    });
    const keep = new T.Group();
    const bp = curve.getPoint(1);
    keep.position.set(bp.x, 0.2, bp.z);
    island.add(keep);
    const wall = flat('#D9D4E8');
    const roof = flat(look.roof);
    const tower = (x: number, z: number, h: number) => {
      const t = new T.Mesh(new T.CylinderGeometry(0.32, 0.36, h, 8), wall);
      t.position.set(x, h / 2, z);
      keep.add(t);
      const c = new T.Mesh(new T.ConeGeometry(0.42, 0.6, 8), roof);
      c.position.set(x, h + 0.3, z);
      keep.add(c);
    };
    const body = new T.Mesh(new T.BoxGeometry(1.1, 0.8, 0.8), wall);
    body.position.y = 0.4;
    keep.add(body);
    tower(-0.6, 0, 1.3);
    tower(0.6, 0, 1.3);
    tower(0, -0.3, 1.8);
    const flagGeo = new T.PlaneGeometry(0.6, 0.36, 8, 2);
    const flag = new T.Mesh(flagGeo, new T.MeshBasicMaterial({ color: bossNode?.state === 'done' ? '#FBBF24' : '#F8FAFC', side: T.DoubleSide }));
    flag.position.set(0.35, 2.85, -0.3);
    keep.add(flag);
    const pole = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.8), flat('#ffffff'));
    pole.position.set(0, 2.75, -0.3);
    keep.add(pole);
    keep.traverse((o: any) => o.isMesh && bossNode && (o.userData.node = bossNode.id));
    if (bossNode) tokens.push(...keep.children);
    updaters.push((t) => {
      const pos = flagGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(x * 8 - t * 6) * 0.05 * (x + 0.3));
      }
      pos.needsUpdate = true;
    });
    if (bossNode) sprite(textTex(T, bossNode.label, { size: 90, w: 160, h: 160, stroke: '#ffffff' }), bp.x, 2.9, bp.z + 0.4, 0.9, 1, (m, t) => (m.position.y = 3.0 + Math.sin(t * 2) * 0.1));

    // 2D cut-outs
    SPOTS.forEach(([x, z], i) => {
      const e = look.props[i % look.props.length];
      const small = i % 3 === 2;
      sprite(cutoutTex(T, e), x, 0.22, z, small ? 0.75 : 1.3 + (i % 2) * 0.2, 1, (m, t) => (m.material.rotation = Math.sin(t * 1.4 + i) * 0.04));
    });
    const dogTex = await svgCutoutTex(T, dogSvg({ noShadow: true }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="210" '), 200, 210, 10);
    if (this.dead) return;
    const at = nowPos ?? curve.getPoint(0.86);
    sprite(dogTex, at.x, 0.42, at.z, 1.5, 220 / 230, (m, t) => {
      const h = Math.abs(Math.sin(t * 3));
      m.position.y = 0.42 + h * 0.35;
      m.scale.set(1.5 * (220 / 230) * (1 + (1 - h) * 0.06), 1.5 * (1 - (1 - h) * 0.06), 1);
    });
    look.fliers.forEach((e, i) => sprite(cutoutTex(T, e, 128, 8), 0, 0, 0, 0.55, 1, (m, t) => {
      const a = t * 0.8 + i * 3;
      m.position.set(Math.cos(a) * (1.4 + i), 0.9 + Math.sin(t * 3 + i) * 0.25, Math.sin(a * 1.3) * 1.2 + 0.4);
      m.scale.set(0.55 * (0.7 + 0.3 * Math.abs(Math.sin(t * 9 + i))), 0.55, 1);
    }));
    look.sky.forEach((e, i) => sprite(cutoutTex(T, e, 128, 8), 0, 0, 0, 0.6, 1, (m, t) => {
      const u = (t * 0.1 + i * 0.5) % 1;
      m.position.set(-6 + u * 12, 3.3 + i * 0.8 + Math.sin(t * 2 + i) * 0.2, -3 + i * 1.5);
    }));
    if (look.extra === '⛵') sprite(cutoutTex(T, '⛵'), 0, 0, 0, 1.1, 1, (m, t) => {
      const a = t * 0.25 + 1;
      m.position.set(Math.cos(a) * 6.0, -1.0 + Math.sin(t * 2) * 0.08, Math.sin(a) * 4.4);
    });
    else if (look.extra) sprite(cutoutTex(T, look.extra), 0, 0, 0, 1.0, 1, (m, t) => m.position.set(-3.4 + Math.sin(t * 0.4) * 0.4, 2.8 + Math.sin(t * 0.9) * 0.25, -3.2));
    const ct = cloudTex(T);
    [[-1, 1.6, 3.8, 0], [1, 2.6, -4.5, 0.5]].forEach(([dir, y, z, ph]) => {
      const m = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, opacity: 0.9, toneMapped: false }));
      m.scale.set(3.4, 1.7, 1);
      world.add(m);
      updaters.push((t) => {
        const u = (t * 0.05 + ph) % 1;
        m.position.set(dir * (-8 + u * 16), y, z);
      });
    });
    world.scale.setScalar(1.0);

    // Tap a token or the castle.
    const ray = new T.Raycaster();
    const v = new T.Vector2();
    this.el.addEventListener('click', (e: MouseEvent) => {
      const b = this.r.domElement.getBoundingClientRect();
      v.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(v, cam);
      const hit = ray.intersectObjects(tokens, false)[0];
      const id = hit?.object.userData.node;
      if (id) onTap(id);
    });

    this.loop = new RenderLoop(this.el, (t) => {
      island.position.y = Math.sin(t * 0.8) * 0.1;
      island.rotation.y = Math.sin(t * 0.25) * 0.06;
      for (const u of updaters) u(t);
      this.r.render(scene, cam);
    }, 20000);
    this.el.classList.add('ready');
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
