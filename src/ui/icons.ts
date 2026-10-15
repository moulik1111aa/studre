// Line icons (24×24, currentColor).
const s = (body: string, fill = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

export const ICONS = {
  back: s('<path d="M15 5 8 12l7 7"/>'),
  gear: s('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.5Z"/>'),
  speaker: s('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  star: s('<path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>', true),
  heart: s('<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 4 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.7 1.2-1.6 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>', true),
  lock: s('<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  trophy: s('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8.5 20h7M9.5 17h5"/>'),
  camera: s('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  play: s('<path d="M8 5.5v13l10.5-6.5z"/>', true),
  check: s('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  cross: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  pause: s('<rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/>', true),
  swords: s('<path d="M4 4l9 9M20 4l-9 9M7 14l-3 3 3 3 3-3M17 14l3 3-3 3-3-3"/>'),
  users: s('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  backspace: s('<path d="M9 5h11v14H9l-6-7z"/><path d="m12 9.5 5 5M17 9.5l-5 5"/>'),
  bulb: s('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.2 1.1 2.2h5c0-1 .3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'),
  gift: s('<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M2.5 9h19M12 9v11M12 9c-1.5-3-5-4.5-5.5-2S9.5 9 12 9c2.5 0 6-.5 5.5-2.5S13.5 6 12 9"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  moon: s('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  chart: s('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
};

export const coinSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="cg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF4B8"/><stop offset=".45" stop-color="#FFD25A"/><stop offset="1" stop-color="#E08A10"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#cg)" stroke="#B86A00" stroke-width="1.2"/><circle cx="12" cy="12" r="7" fill="none" stroke="#FFF2B0" stroke-opacity=".7" stroke-width="1.2"/><path d="M9.5 8.5h5M9.5 11h5M9.5 8.5c2.8 0 2.8 4 0 4l4 3.5" fill="none" stroke="#9A5800" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Children's avatars: friendly animal faces on gradient discs. */
export const AVATARS = ['🦁', '🐯', '🐼', '🐨', '🐸', '🦊', '🐰', '🐻', '🐵', '🦄', '🐙', '🐧', '🦉', '🐢', '🐳', '🦋', '🐝', '🐞', '🐬', '🦒', '🐘', '🦖', '🐱', '🐶'];
export const AVATAR_COLORS = [
  ['#FFD25A', '#F5A524'], ['#FF9A4D', '#E8590C'], ['#7BE495', '#2E9E6A'], ['#5CC8FF', '#2457C9'],
  ['#B48BFF', '#5F3DC4'], ['#FF7AA8', '#C2255C'],
];
export function avatarHtml(i: number, size = 64): string {
  const [a, b] = AVATAR_COLORS[i % AVATAR_COLORS.length];
  return `<span class="avatar" style="--a:${a};--b:${b};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.56)}px">${AVATARS[i % AVATARS.length]}</span>`;
}
