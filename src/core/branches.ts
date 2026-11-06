// The branches of maths on the one road: each skill's strand picks its branch, which gives the
// stop's badge and colour (map) and a line in the parent report.
import type { Strand } from './question.ts';

export type Branch = 'num' | 'mea' | 'sha' | 'dat' | 'alg';

export interface BranchInfo {
  id: Branch;
  /** The child's name for it. */
  name: string;
  /** The grown-up's name for it. */
  long: string;
  /** Colour on light themes, then on dark themes. */
  color: [string, string];
}

export const BRANCHES: BranchInfo[] = [
  { id: 'num', name: 'Numbers', long: 'Numbers & arithmetic', color: ['#5B3DF5', '#A78BFA'] },
  { id: 'mea', name: 'Measure', long: 'Measure & time', color: ['#D9480F', '#FFA94D'] },
  { id: 'sha', name: 'Shapes', long: 'Shapes & space', color: ['#1971C2', '#4DABF7'] },
  { id: 'dat', name: 'Data', long: 'Data & chance', color: ['#2B8A3E', '#69DB7C'] },
  { id: 'alg', name: 'Algebra', long: 'Algebra & patterns', color: ['#C2255C', '#F783AC'] },
];
export const branchInfo = (b: Branch): BranchInfo => BRANCHES.find((x) => x.id === b)!;

export function branchOf(strand: Strand): Branch {
  switch (strand) {
    case 'measure': return 'mea';
    case 'shape': return 'sha';
    case 'data': return 'dat';
    case 'algebra': return 'alg';
    default: return 'num';
  }
}
