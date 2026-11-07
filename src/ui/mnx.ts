// MN × ("MN Times"), the paid extras: its mark is Plus's own sign turned an eighth of the way
// round, so the plus becomes a times sign, in two colours that mix where they cross.
// "Learning, multiplied."

export const MNX = 'MN ×';
export const MNX_SPOKEN = 'MN Times';
export const MNX_TAGLINE = 'Learning, multiplied.';

/** The × mark: Plus's sign turned to a times sign, as two bars, pink and sky blue, that mix
 *  to lilac where they cross ("multiplied"). */
export function timesMarkSvg(cls = ''): string {
  return `<svg class="mnx-mark ${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <g class="mnx-turn">
      <rect x="38" y="4" width="24" height="92" rx="12" fill="#FF7A9A"/>
      <rect x="4" y="38" width="92" height="24" rx="12" fill="#5CC8FF"/>
      <rect x="38" y="38" width="24" height="24" fill="#B7A2FF"/>
    </g>
  </svg>`;
}

/** The lockup: "MN", the mark, and the line under it. */
export function mnxLockup(): string {
  return `<div class="mnx-lock" aria-label="${MNX_SPOKEN}. ${MNX_TAGLINE}"><span class="mnx-row"><b>MN</b><span class="mnx-m">${timesMarkSvg('turn-in')}</span></span><small>${MNX_TAGLINE}</small></div>`;
}
