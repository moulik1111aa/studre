// Stage worlds: palettes and ambient backdrops for the map and play screens.

export const WORLDS = [
  { name: 'Meadow', a: '#7BE495', b: '#2E9E6A', deco: ['🌼', '🌿', '🦋', '☁️'] },
  { name: 'Pirate Sea', a: '#5CC8FF', b: '#2457C9', deco: ['🌊', '🐚', '⛵', '☁️'] },
  { name: 'Dragon Volcano', a: '#FF9A4D', b: '#C92A2A', deco: ['🔥', '🌋', '💎', '☁️'] },
  { name: 'Robot City', a: '#B48BFF', b: '#4B3BB8', deco: ['⚙️', '🏙️', '💡', '✨'] },
  { name: 'Pizza Kitchen', a: '#FFC15E', b: '#E8590C', deco: ['🍕', '🧀', '🍅', '♨️'] },
  { name: 'Storm Ocean', a: '#7C9CFF', b: '#2B2F77', deco: ['⚡', '🌧️', '🐙', '🌊'] },
  { name: 'Ninja Mountains', a: '#FF6FA8', b: '#5F3DC4', deco: ['🏔️', '🌸', '🏯', '🌙'] },
];

export const worldColors = (stage: number): [string, string] => {
  const w = WORLDS[stage - 1] ?? WORLDS[0];
  return [w.a, w.b];
};

/** CSS custom properties for a stage's world. */
export const worldVars = (stage: number): string => {
  const [a, b] = worldColors(stage);
  return `--world:${a};--world-b:${b}`;
};

/** Ambient floating decorations for a world backdrop. */
export function ambientHtml(stage: number, n = 7): string {
  const w = WORLDS[stage - 1] ?? WORLDS[0];
  return `<div class="ambient" aria-hidden="true">${Array.from({ length: n }, (_, i) => {
    const e = w.deco[i % w.deco.length];
    const x = (i * 37 + 11) % 92;
    const y = (i * 53 + 7) % 88;
    return `<span style="left:${x}%;top:${y}%;--d:${6 + (i % 4) * 2}s;--delay:${-i * 1.3}s">${e}</span>`;
  }).join('')}</div>`;
}
