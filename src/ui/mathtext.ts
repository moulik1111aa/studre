// Maths text for lessons: escaped, with fractions like 3/4 drawn stacked.

import { esc } from './app.ts';

// Not part of a longer number either side; a full stop after it (end of a sentence) is fine.
const FRAC = /(?<![\d.])(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(?!\d|\.\d)/g;

export function mathHtml(s: string): string {
  return esc(s).replace(FRAC, '<span class="frac"><sup>$1</sup><sub>$2</sub></span>');
}
