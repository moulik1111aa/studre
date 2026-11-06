// Lessons: how to work out one question, step by step, with a picture that builds up as the
// steps go. A skill attaches one to every question it makes (built from the same numbers), and
// the app shows it after a wrong answer.
//
// Pure data: no DOM here (see ui/lesson.ts and ui/boards.ts for drawing).

/** A short lesson for one question. */
import type { Visual } from '../question.ts';

export interface Lesson {
  /** A picture that builds up with the steps (each item appears at its step). */
  board?: Board;
  steps: Step[];
  /** Notes for common wrong answers: when the child's answer equals `answer`, show `note`. */
  slips?: Slip[];
  /** The method's short name ("Make ten", "Column"), shown on "Another way". */
  method?: string;
  /** The method family (e.g. 'add', 'sub'): a child's favourite method is remembered per family. */
  family?: string;
  /** Other ways to work out the same question (each ends on the same answer). */
  alts?: () => Lesson[];
}

export interface Step {
  /** One short sentence: shown, and read aloud. */
  say: string;
  /** Working shown big under the sentence, one string per line (fractions like 3/4 are stacked). */
  math?: string[];
  /** A short line after the working ("Write 2 and carry 1."). */
  after?: string;
  /** The last step: says the answer. */
  end?: boolean;
  /** "Your turn": the child taps the answer to this small question before going on. */
  turn?: { ask: string; answer: string; choices: string[] };
}

export interface Slip {
  answer: string;
  note: string;
}

/**
 * Board items are timed by step index (0 = the first step): an item shows from step `at`
 * (default 0) until before step `until` (default: stays), and is highlighted from step `hl`.
 * Every step-number field is listed in STEP_KEYS (so a lesson can be nested in another).
 */
export interface Timed {
  at?: number;
  until?: number;
  hl?: number;
}
/** Fields that hold step numbers. */
export const STEP_KEYS = ['at', 'until', 'hl', 'on', 'cross', 'goneAt', 'count', 'textAt', 'labelAt', 'step', 'readAt'] as const;

export type Board = LineBoard | ColsBoard | BarsBoard | DotsBoard | BlocksBoard | TableBoard | BusBoard | TrackBoard | BeadsBoard | BundleBoard | StackBoard | PicBoard;

/** Pictures (clocks, rulers, shapes, charts…) that change from step to step: each frame shows
 * from its step until the next frame's. Motion hints in a frame play when it appears. */
export interface PicBoard {
  kind: 'pic';
  frames: { step: number; v: Visual }[];
}

/**
 * A moving number line: points are spaced evenly along a long line, and the view slides along
 * with each jump (a pointer rides the jumps). The last step shows the whole line when it fits.
 */
export interface TrackBoard {
  kind: 'track';
  /** Space the points to scale (so a slid gap keeps its length), instead of evenly. */
  linear?: boolean;
  points: LinePoint[];
  hops: LineHop[];
  /** A bar over the line between two points (the gap in "slide the gap"), with its own timing. */
  gaps?: (Timed & { from: number; to: number; label?: string })[];
}

/** A bead frame (rekenrek): rows of 10 beads in fives (red, then white). */
export interface BeadsBoard {
  kind: 'beads';
  /** Per row: from which step how many beads are slid to the left (later entries win). */
  rows: { slides: { step: number; n: number }[]; label?: string }[];
  /** Beads that hop from the bottom row to the end of the top row (make ten). */
  hop?: { step: number; n: number };
  /** Rings round the red beads and the white beads, from this step (reading 10 and the rest). */
  readAt?: number;
  /** Text under the frame from a step (e.g. "10 + 4 = 14"). */
  notes?: (Timed & { text: string })[];
}

/**
 * Base-ten blocks over a written column sum: each column's blocks join at the step that column
 * is added; ten ones (or tens) bundle and move to the next column as the carried 1.
 */
export interface BundleBoard {
  kind: 'bundle';
  /** The numbers being added (whole, up to 3 digits). */
  nums: number[];
  /** For each column (0 = ones), the step at which it is added. */
  cols: { step: number }[];
}

/** Two pictures one above the other, sharing the steps. */
export interface StackBoard {
  kind: 'stack';
  boards: Board[];
}

/** A number line with points and hops. */
export interface LineBoard {
  kind: 'line';
  /** 'linear' draws to scale (counting lines, thermometers); 'even' spaces points for an empty number line. */
  scale: 'linear' | 'even';
  /** For a linear line: the range, and ticks every `step` (labels every `labelEvery`). */
  min?: number;
  max?: number;
  tick?: number;
  labelEvery?: number;
  points: LinePoint[];
  hops: LineHop[];
}
export interface LinePoint extends Timed {
  v: number;
  label?: string;
  tone?: 'start' | 'end' | 'mark' | 'zero';
}
export interface LineHop extends Timed {
  from: number;
  to: number;
  label: string;
}

/** Written column methods: a grid of digits with carries, exchanges and an answer row. */
export interface ColsBoard {
  kind: 'cols';
  /** Number of columns (a decimal point takes a column). */
  width: number;
  /** Headings over the columns, left to right ('' for none). */
  heads?: string[];
  /** Column widths (1 = one digit), for columns that hold a whole amount ("750" grams). */
  widths?: number[];
  /** Row kinds, top to bottom: small rows hold carries and exchanges. */
  rows: ('small' | 'num' | 'ans' | 'you')[];
  /** Draw a rule under these rows. */
  rules: number[];
  /** Operator sign at the left of a row. */
  ops?: { r: number; ch: string }[];
  cells: ColsCell[];
  /** A column lit up while it is being worked on. */
  focus?: (Timed & { c: number })[];
}
export interface ColsCell extends Timed {
  r: number;
  c: number;
  ch: string;
  tone?: 'carry' | 'ans' | 'new' | 'you' | 'bad';
  /** Struck through from this step (exchanging). */
  cross?: number;
}

/** Bar model / fraction bars: rows of segments. */
export interface BarsBoard {
  kind: 'bars';
  bars: Bar[];
}
export interface Bar extends Timed {
  label?: string;
  /** Text over the whole bar (e.g. "₹240"). */
  total?: string;
  /** Length relative to the longest bar (default 1). */
  len?: number;
  parts: BarPart[];
}
export interface BarPart extends Timed {
  /** Relative width within the bar (default 1). */
  w?: number;
  text?: string;
  /** The text shows from this step (default: with the part). */
  textAt?: number;
  /** Colour once shaded: 1 = main, 2 = answer, 3 = taken away. */
  tone?: 1 | 2 | 3;
  /** Shaded from this step (default: from when it appears). */
  on?: number;
  /** Crossed out from this step. */
  cross?: number;
}

/** Objects or dots: groups, rows, arrays, ten frames and pairs. */
export interface DotsBoard {
  kind: 'dots';
  layout: 'row' | 'groups' | 'array' | 'frame' | 'pairs';
  groups: DotGroup[];
  /** Sign between groups ('+', '−', '='), groups layout only. */
  joiner?: string;
  /** A line under the whole picture (e.g. "7 rows of 8"). */
  caption?: string;
}
export interface DotGroup extends Timed {
  n: number;
  /** Emoji to draw; plain dots when missing. */
  emoji?: string;
  /** A different emoji for each item (patterns, rows of things). */
  items?: string[];
  /** Text on round coins (e.g. "₹5"), instead of dots. */
  face?: string;
  /** Label under the group (beside it, in an array). */
  label?: string;
  /** The label shows from this step (default: with the group). */
  labelAt?: number;
  /** The last `gone` items are crossed out from step `goneAt`. */
  gone?: number;
  goneAt?: number;
  /** Number badges counting the items appear at this step, starting from `countFrom` (default 1). */
  count?: number;
  countFrom?: number;
  /** Empty slots (ten frame / make 5): drawn hollow. */
  hollow?: boolean;
}

/** Base-ten blocks: hundreds, tens and ones. */
export interface BlocksBoard {
  kind: 'blocks';
  groups: (Timed & { h: number; t: number; o: number; label?: string })[];
}

/** A small table: place value charts, grids, factor pairs, ratio tables. */
export interface TableBoard {
  kind: 'table';
  head?: string[];
  rows: TableRow[];
  /** First column holds row labels. */
  label?: boolean;
}
export interface TableRow extends Timed {
  cells: (string | TableCell)[];
  /** Side note to the right (e.g. "÷ 3"). */
  note?: string;
}
export interface TableCell extends Timed {
  v: string;
  tone?: 'good' | 'bad' | 'dim' | 'key';
}

/** Short division ("bus stop"). */
export interface BusBoard {
  kind: 'bus';
  divisor: string;
  /** Digits of the number being divided (a '.' may appear). */
  digits: string[];
  /** Answer characters over each digit ('' for none). */
  answer: (Timed & { ch: string })[];
  /** Small carried remainders written before digit `i`. */
  carries: (Timed & { i: number; ch: string })[];
  /** Remainder written after the answer. */
  rem?: Timed & { text: string };
}
