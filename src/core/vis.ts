// Pictures for Measure & Time, Shapes & Space and Data & Chance questions (and their lessons).
// Pure data: ui/mathvis.ts draws them. Coordinates are in the picture's own units.
//
// In lessons, a picture can carry motion hints (sweep, hop, drop…): they play once when the
// step that shows the picture appears.

export type Pt = [number, number];

/** A thing to compare (Stage 1): a pencil, tree, jug… drawn at a relative size. */
export interface CompareItem {
  /** 0–1 size (length, height, weight or how much it holds). */
  size: number;
  /** Colour name the question uses ("red"). */
  color: string;
  /** Emoji for weight comparisons (🐘). */
  e?: string;
  /** Highlight (lessons). */
  hl?: boolean;
}

export type ShapeName =
  | 'circle' | 'square' | 'rectangle' | 'triangle' | 'pentagon' | 'hexagon' | 'octagon' | 'oval' | 'star'
  | 'rhombus' | 'kite' | 'trapezium' | 'parallelogram' | 'semicircle' | 'heart' | 'right-triangle';

export type SolidName = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'sphere' | 'pyramid' | 'prism' | 'hemisphere';

/** A line segment, an arc mark or a text label on a geometry figure. */
export interface GeoSeg {
  a: Pt;
  b: Pt;
  /** dashed (construction), bold (highlight), ray (arrow at b), tick marks (equal sides), parallel arrows. */
  style?: 'dash' | 'bold' | 'ray' | 'faint';
  ticks?: number;
  par?: number;
}
export interface GeoArc {
  at: Pt;
  /** Start and end angle in degrees (maths convention: 0 = east, anticlockwise). */
  a0: number;
  a1: number;
  r?: number;
  label?: string;
  right?: boolean;
  hl?: boolean;
  /** A second colour (the angle you're finding). */
  ask?: boolean;
}
export interface GeoLabel {
  at: Pt;
  t: string;
  hl?: boolean;
  ask?: boolean;
  small?: boolean;
}

/** One block of a bar model, as long as its amount. */
export interface BarPart {
  v: number;
  /** Text on the block ("1 kg"). */
  t: string;
  /** Small text under it ("1000 g"). */
  sub?: string;
  tone?: 0 | 1 | 2 | 3;
  /** Drops in when its step appears. */
  new?: boolean;
  hl?: boolean;
  /** Taken away (crossed out). */
  x?: boolean;
}
export interface BarRow {
  name?: string;
  parts: BarPart[];
  /** Brace under the row with this total. */
  total?: string;
  ask?: boolean;
  /** Bracket over parts from..to (inclusive) with a label ("1000 g = 1 kg"). */
  group?: { from: number; to: number; t: string };
}

/** A chip in an expression strip; `box` marks the part being worked out now. */
export interface ExprPart { t: string; box?: boolean; done?: boolean; sign?: boolean }
/** A fraction bar: d equal parts, `on` shaded; `x` of the shaded ones crossed out (taken away). */
export interface FBar { d: number; on: number; tone?: 0 | 1 | 2 | 3; x?: number; new?: boolean; t?: string }

export type MathVisual =
  | { kind: 'compare'; mode: 'long' | 'tall' | 'heavy' | 'holds' | 'big'; items: CompareItem[]; tip?: number }
  | { kind: 'emoji'; e: string; label?: string; big?: boolean }
  | { kind: 'row'; items: string[]; hl?: number; labels?: string[] }
  | { kind: 'where'; thing: string; ref: 'table' | 'box' | 'chair'; pos: 'on' | 'under' | 'beside' | 'in' }
  | { kind: 'strip'; cells: string[]; hl?: number; to?: number; hops?: number; arrow?: 'next' | 'prev' }
  | { kind: 'cubes'; len: number; obj: 'pencil' | 'crayon' | 'ribbon' | 'leaf' | 'key' | 'spoon'; count?: boolean }
  | { kind: 'ruler'; max: number; items: { from: number; to: number; color: string; name?: string }[]; unit?: 'cm' | 'm' | 'in'; hl?: number; gap?: boolean; count?: number }
  | { kind: 'clock'; h: number; m: number; sweep?: [number, number]; hl?: 'hour' | 'min'; fives?: boolean; digital?: string; ampm?: 'am' | 'pm' }
  | { kind: 'digital'; text: string; sub?: string }
  | { kind: 'calendar'; year: number; month: number; hl?: number[]; ring?: number; hop?: number[] }
  | { kind: 'shape'; shape: ShapeName; fold?: 'v' | 'h' | 'd'; corners?: boolean; sides?: boolean; color?: string; rot?: number; bad?: boolean }
  | { kind: 'shapes'; items: { shape: ShapeName; color?: string; rot?: number }[]; hl?: number }
  | { kind: 'sort'; groups: { label: string; items: { shape: ShapeName; color?: string }[] }[] }
  | { kind: 'solid'; solid: SolidName; hl?: 'faces' | 'edges' | 'corners'; color?: string }
  | { kind: 'arrow'; dir: number; turn?: number; ghost?: boolean }
  | { kind: 'gridmap'; w: number; h: number; items: { at: Pt; e: string }[]; start: Pt; path?: Pt[] }
  | { kind: 'tally'; n: number; groups?: boolean }
  | { kind: 'picgraph'; rows: { label: string; e: string; n: number }[]; key?: number; hl?: number[] }
  | { kind: 'growing'; style: 'squares' | 'triangles' | 'dots' | 'L'; terms: number[]; ask?: boolean }
  | { kind: 'scale'; from: number; to: number; step: number; every: number; value?: number; unit?: string; count?: boolean; vertical?: boolean }
  | { kind: 'poly'; pts: Pt[]; labels?: (string | null)[]; grid?: boolean; squares?: boolean; cut?: [Pt, Pt]; walk?: boolean; hl?: number; rects?: { a: Pt; b: Pt; tone: 0 | 1 }[]; unit?: string }
  | { kind: 'cells'; w: number; h: number; on: Pt[]; mirror?: { x?: number; y?: number }; ghost?: Pt[]; count?: boolean; color?: string }
  | { kind: 'angle'; deg: number; rot?: number; label?: string; ref?: boolean; sweep?: boolean }
  | { kind: 'lines'; type: 'parallel' | 'perp' | 'cross'; rot?: number; marks?: boolean }
  | { kind: 'bars'; bars: { label: string; v: number }[]; step: number; max: number; unit?: string; hl?: number[]; read?: number }
  | { kind: 'lineg'; pts: { label: string; v: number }[]; step: number; max: number; min?: number; unit?: string; hl?: number }
  | { kind: 'pie'; parts: { label: string; deg: number }[]; hl?: number; sweep?: boolean }
  | { kind: 'table'; head: string[]; rows: string[][]; hl?: Pt[]; title?: string }
  | { kind: 'coord'; min: number; max: number; pts?: { at: Pt; label?: string; e?: string; ghost?: boolean; hl?: boolean }[]; poly?: Pt[]; poly2?: Pt[]; walk?: Pt; line?: { m: number; c: number }; seg?: [Pt, Pt]; tri?: [Pt, Pt, Pt]; mirror?: 'x' | 'y' }
  | { kind: 'net'; cells: Pt[]; fold?: boolean }
  | { kind: 'protractor'; deg: number; read?: boolean }
  | { kind: 'geo'; w: number; h: number; segs: GeoSeg[]; arcs?: GeoArc[]; labels?: GeoLabel[]; circles?: { c: Pt; r: number; style?: 'dash' | 'fill' }[]; dots?: Pt[]; fill?: Pt[]; fill2?: Pt[] }
  | { kind: 'bag'; balls: string[]; hl?: string; spinner?: boolean }
  | { kind: 'dice'; faces: number[] }
  | { kind: 'cards'; cards: string[] }
  | { kind: 'cuboid'; l: number; b: number; h: number; cubes?: boolean; layers?: boolean; labels?: string[]; color?: string }
  | { kind: 'sticks'; shape: 'squares' | 'triangles' | 'houses'; n: number[]; ask?: boolean }
  | { kind: 'packs'; packs: { label: string; amount: string; price: string; color: string }[] }
  | { kind: 'rotsym'; n: number; style: 'star' | 'flower' | 'pinwheel' | 'polygon'; turned?: boolean }
  | { kind: 'thermo'; v: number; min: number; max: number; step: number }
  | { kind: 'fist'; hl?: number }
  | { kind: 'seesaw'; left: string; right: string; tip: -1 | 0 | 1 }
  | { kind: 'jugs'; jugs: { cap: number; fill: number; label?: string; color?: string }[]; unit?: string; marks?: number }
  | { kind: 'speed'; dist: string; legs: { label: string; time: string }[] }
  | { kind: 'pair'; a: MathVisual; b: MathVisual; op?: string; la?: string; lb?: string }
  | { kind: 'cylinder'; r: string; h: string; coins?: boolean }
  | { kind: 'bar'; rows: BarRow[] }
  /** Methods: an equation as a balance; the same action dropped on both pans. tilt 1 = left side heavier. */
  | { kind: 'balance'; left: string; right: string; act?: string; sign?: string; tilt?: -1 | 0 | 1; ok?: boolean }
  /** Methods: an expression with the part to do first boxed, and the order rule lit. */
  | { kind: 'expr'; parts: ExprPart[]; rule?: 'B' | 'O' | 'DM' | 'AS'; under?: string; ladder?: boolean }
  /** Methods: fraction bars in rows (several bars in a row make wholes). */
  | { kind: 'fbar'; rows: { name?: string; bars: FBar[]; after?: string }[] }
  /** Methods: a box (area) model; widths and heights are relative sizes. */
  | { kind: 'area'; cols: string[]; rows: string[]; cells: string[][]; cw?: number[]; rh?: number[]; hl?: Pt[]; tone?: number[][]; total?: string; op?: string; tiny?: boolean }
  /** Methods: two lists in a Venn diagram (factors of each, in both). */
  | { kind: 'venn'; a: string; b: string; onlyA: string[]; both: string[]; onlyB: string[]; pick?: string; title?: string }
  /** Methods: groups of tiles (a × a × a…), with some crossed out. */
  | { kind: 'chain'; groups: { items: string[]; x?: number[]; hl?: number[]; tone?: 0 | 1 | 2 | 3; label?: string }[]; ops?: string[]; note?: string; rows?: boolean }
  /** Methods: digits with a decimal point that hops (× and ÷ by 10s, standard form). */
  | { kind: 'pv'; digits: string; point: number; from?: number; heads?: string[]; note?: string; lead?: number }
  /** Methods: a parabola y = ax² + bx + c, with where it crosses the x-axis. */
  | { kind: 'parab'; a: number; b: number; c: number; min: number; max: number; marks?: number[] }
  | { kind: 'cone'; r: string; h: string; l?: string; solid: 'cone' | 'sphere' | 'hemisphere' | 'cylinder' };
