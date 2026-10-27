// The dragon curve (the dragon map, ui/foldmap.ts): the shape a strip of paper makes when it is folded
// in half again and again and every fold is opened to a right angle. Each segment is one
// level. The first 2^k segments are always a whole dragon of order k, and the next 2^k are
// the same shape again, turned a quarter around its end: that is one "unfold", and it is how
// a new chapter of the map appears.

export type Pt = readonly [number, number];

const cache: Pt[] = [
  [0, 0],
  [1, 0],
];

/** Corner points of the dragon with at least `segments` segments (P[i] is the end of level i). */
export function dragonPoints(segments: number): readonly Pt[] {
  while (cache.length - 1 < segments) {
    const n = cache.length - 1;
    const [px, py] = cache[n];
    // The copy of everything so far, walked backwards and turned a quarter (clockwise) around the end.
    for (let j = n - 1; j >= 0; j--) {
      const dx = cache[j][0] - px;
      const dy = cache[j][1] - py;
      cache.push([px + dy, py - dx]);
    }
  }
  return cache;
}

/**
 * The paper-folding rule: at corner `n` (n ≥ 1), take the odd part m of n; the path turns
 * one way when m leaves 1 divided by 4 and the other way when it leaves 3. Returns +1 or -1
 * (+1 = anticlockwise in the points above).
 */
export function turnAt(n: number): 1 | -1 {
  let m = n;
  while (m % 2 === 0) m /= 2;
  return m % 4 === 1 ? 1 : -1;
}

/** Smallest power of two that is ≥ n (and ≥ 1). */
export const pow2AtLeast = (n: number): number => {
  let t = 1;
  while (t < n) t *= 2;
  return t;
};

/** The first chapter is 8 levels, then 16, 32 … (each doubles the map). */
export const FIRST_CHAPTER = 8;

/**
 * The chapter the next level is in: the map shows levels 1 … `end`, where `end` is the
 * smallest power of two (at least FIRST_CHAPTER) above the levels done.
 */
export function chapterOf(done: number): { no: number; start: number; end: number } {
  const end = Math.max(FIRST_CHAPTER, pow2AtLeast(done + 1));
  const no = Math.log2(end) - Math.log2(FIRST_CHAPTER) + 1;
  return { no, start: no === 1 ? 1 : end / 2 + 1, end };
}

/** Middle of level i's segment (levels count from 1). */
export function levelMid(i: number): Pt {
  const p = dragonPoints(i);
  return [(p[i - 1][0] + p[i][0]) / 2, (p[i - 1][1] + p[i][1]) / 2];
}

/**
 * The path while the chapter ending at `from` unfolds into the next one: the first `from`
 * segments, then their copy turned by `t` of a quarter turn (0 = folded on top, 1 = open).
 */
export function unfolding(from: number, t: number): Pt[] {
  const p = dragonPoints(from * 2);
  const [px, py] = p[from];
  const a = (-Math.PI / 2) * t;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const out: Pt[] = p.slice(0, from + 1) as Pt[];
  for (let j = from - 1; j >= 0; j--) {
    const dx = p[j][0] - px;
    const dy = p[j][1] - py;
    out.push([px + dx * c - dy * s, py + dx * s + dy * c]);
  }
  return out;
}
