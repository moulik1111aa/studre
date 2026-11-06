// Small icons for the branches of maths (map badges, report). Shapes differ, so the branch
// never depends on colour alone.
import type { Branch } from '../core/branches.ts';

export const BRANCH_ICON: Record<Branch, string> = {
  num: '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="900" fill="currentColor" font-family="system-ui,sans-serif">123</text></svg>',
  mea: '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-35 12 12)"><rect x="2.5" y="8" width="19" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4" stroke="currentColor" stroke-width="1.8"/></g></svg>',
  sha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5 20 18.5H4Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  dat: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="9" width="4" height="11" rx="1"/></g></svg>',
  alg: '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="16" font-style="italic" font-weight="800" fill="currentColor" font-family="Georgia,serif">x</text></svg>',
};
