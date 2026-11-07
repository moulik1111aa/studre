// MN × ("MN Times"), the paid extras: its mark is Plus's own sign turned a quarter of the way
// round, so the plus becomes a times sign, in Plus's own yellow. "Learning, multiplied."

let uid = 0;

export const MNX = 'MN ×';
export const MNX_SPOKEN = 'MN Times';
export const MNX_TAGLINE = 'Learning, multiplied.';

/** The × mark: Plus's two rounded bars with the same ink outline, tilted 45°, in gold. */
export function timesMarkSvg(cls = ''): string {
  const u = ++uid;
  const V = 'x="70" y="14" width="60" height="172" rx="14"';
  const H = 'x="14" y="70" width="172" height="60" rx="14"';
  return `<svg class="mnx-mark ${cls}" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="mxG${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE27A"/><stop offset=".5" stop-color="#FFC531"/><stop offset="1" stop-color="#FFAE1A"/></linearGradient>
      <linearGradient id="mxS${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <g class="mnx-turn">
      <g fill="#1A1446" stroke="#1A1446" stroke-width="12" stroke-linejoin="round"><rect ${V}/><rect ${H}/></g>
      <g fill="url(#mxG${u})"><rect ${V}/><rect ${H}/></g>
      <rect x="80" y="24" width="14" height="60" rx="7" fill="url(#mxS${u})"/>
    </g>
  </svg>`;
}

/** The lockup: "MN", the mark, and the line under it. */
export function mnxLockup(): string {
  return `<div class="mnx-lock" aria-label="${MNX_SPOKEN}. ${MNX_TAGLINE}"><span class="mnx-row"><b>MN</b><span class="mnx-m">${timesMarkSvg('turn-in')}</span></span><small>${MNX_TAGLINE}</small></div>`;
}
