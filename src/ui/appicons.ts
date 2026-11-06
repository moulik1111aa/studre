// The launcher icons an MN Plus member can pick: Plus on five skies. The same drawings make
// the Android icon files (scripts/icons.mjs) and the previews in the Parent area.

import { plusFaceSvg } from './plus.ts';

export type AppIconId = 'sky' | 'night' | 'sunset' | 'space' | 'gold';
export const APP_ICONS: { id: AppIconId; name: string }[] = [
  { id: 'sky', name: 'Sky' },
  { id: 'night', name: 'Night' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'space', name: 'Space' },
  { id: 'gold', name: 'Gold' },
];

const star = (x: number, y: number, r: number, o = 1, fill = '#fff') => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="${fill}" opacity="${o}"/>`;
const dots = (pts: [number, number, number][]) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join('');

/** The background (108 × 108 adaptive-icon canvas), with its own gradient ids. */
export function iconFieldSvg(id: AppIconId): string {
  switch (id) {
    case 'night':
      return `<defs><linearGradient id="g-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1A4F"/><stop offset="1" stop-color="#3A4FB0"/></linearGradient></defs>
        <rect width="108" height="108" fill="url(#g-night)"/>${dots([[14, 30, 0.9], [30, 14, 0.7], [90, 40, 0.8], [70, 12, 0.6], [100, 22, 0.7], [8, 54, 0.6]])}${star(22, 22, 3.2)}${star(96, 56, 2.4, 0.9)}
        <path d="M88 11 A11 11 0 1 0 97 28 A8.5 8.5 0 1 1 88 11 Z" fill="#FFE9A8"/>
        <ellipse cx="20" cy="112" rx="52" ry="22" fill="#1F7A55"/><ellipse cx="92" cy="114" rx="50" ry="24" fill="#16664A"/>`;
    case 'sunset':
      return `<defs><linearGradient id="g-sunset" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF6F61"/><stop offset=".6" stop-color="#FFA26B"/><stop offset="1" stop-color="#FFD28A"/></linearGradient></defs>
        <rect width="108" height="108" fill="url(#g-sunset)"/><circle cx="80" cy="86" r="22" fill="#FFE7A3" opacity=".95"/>
        <ellipse cx="22" cy="20" rx="13" ry="4.5" fill="#FFD0B8" opacity=".8"/><ellipse cx="31" cy="17" rx="8" ry="4" fill="#FFD0B8" opacity=".8"/>
        <ellipse cx="20" cy="112" rx="52" ry="22" fill="#B5487A"/><ellipse cx="92" cy="114" rx="50" ry="24" fill="#8E3A8A"/>`;
    case 'space':
      return `<defs><radialGradient id="g-space" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#5B33A8"/><stop offset="1" stop-color="#140B33"/></radialGradient></defs>
        <rect width="108" height="108" fill="url(#g-space)"/>${dots([[12, 50, 0.8], [40, 10, 0.6], [94, 30, 0.9], [78, 8, 0.6], [100, 60, 0.6], [6, 20, 0.7], [60, 18, 0.5]])}${star(88, 16, 2.6)}${star(14, 36, 2, 0.8)}
        <g transform="rotate(-18 24 24)"><ellipse cx="24" cy="24" rx="17" ry="4.5" fill="none" stroke="#FFC6E0" stroke-width="2"/><circle cx="24" cy="24" r="9" fill="#FF8FB8"/><path d="M15 24 A9 9 0 0 0 33 24" fill="#E8679A"/><path d="M7 24 A17 4.5 0 0 0 41 24" fill="none" stroke="#FFC6E0" stroke-width="2"/></g>
        <ellipse cx="54" cy="120" rx="80" ry="30" fill="#9A93BF"/><ellipse cx="30" cy="98" rx="6" ry="2.2" fill="#7D76A6"/><ellipse cx="82" cy="102" rx="8" ry="2.6" fill="#7D76A6"/>`;
    case 'gold':
      return `<defs><radialGradient id="g-gold" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#7B3FD0"/><stop offset="1" stop-color="#2A1260"/></radialGradient></defs>
        <rect width="108" height="108" fill="url(#g-gold)"/>
        <g opacity=".9" fill="#FFD54A">${Array.from({ length: 12 }, (_, i) => `<path d="M54 54 L${54 + 80 * Math.cos(((i * 30 - 3) * Math.PI) / 180)} ${54 + 80 * Math.sin(((i * 30 - 3) * Math.PI) / 180)} L${54 + 80 * Math.cos(((i * 30 + 3) * Math.PI) / 180)} ${54 + 80 * Math.sin(((i * 30 + 3) * Math.PI) / 180)} Z"/>`).join('')}</g>
        ${star(18, 20, 4.5)}${star(92, 24, 3.4)}${star(88, 90, 3.6, 0.9)}${star(16, 86, 3, 0.9)}`;
    default:
      return `<defs><linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6EC3FF"/><stop offset="1" stop-color="#C4EBFF"/></linearGradient></defs>
        <rect width="108" height="108" fill="url(#g-sky)"/><ellipse cx="24" cy="20" rx="13" ry="5" fill="#fff" opacity=".8"/><ellipse cx="33" cy="17" rx="8" ry="4.5" fill="#fff" opacity=".8"/>
        <ellipse cx="20" cy="112" rx="52" ry="22" fill="#6FD88A"/><ellipse cx="92" cy="114" rx="50" ry="24" fill="#55C978"/>`;
  }
}

/** Plus's own markup (200 × 204, middle 100 102), without its <svg> wrapper. */
export const plusMark = (): string => plusFaceSvg().replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** A whole icon as the launcher shows it (Plus on the field), square with round corners or round. */
export function appIconSvg(id: AppIconId, shape: 'square' | 'round' = 'square', size?: number): string {
  const clip = shape === 'round' ? `<clipPath id="c-${id}"><circle cx="54" cy="54" r="54"/></clipPath>` : `<clipPath id="c-${id}"><rect width="108" height="108" rx="24"/></clipPath>`;
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"${dim}><defs>${clip}</defs><g clip-path="url(#c-${id})">${iconFieldSvg(id)}<g transform="translate(54 53) scale(${84 / 200}) translate(-100 -102)">${plusMark()}</g></g></svg>`;
}
