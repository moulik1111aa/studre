// Renders Study Hard's Android launcher icons and splash logo from Biscuit, the round dog
// mascot (src/ui/dog.ts). Output is committed under native/android/res,
// so the APK build needs no image tools. Re-run after changing the mark:
//   node scripts/icons.mjs
// Uses sharp (installed globally here: npm root -g).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = require(join(execSync('npm root -g').toString().trim(), 'sharp'));
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { dogSvg } = await import('../src/ui/dog.ts');
/** Inner markup of the dog (200-unit canvas), without its own <svg> wrapper. */
const DOG = dogSvg({ noShadow: true }).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/ data-(draw|fill)/g, '');
const res = join(root, 'native/android/res');

const DEFS = `<defs>
  <radialGradient id="bg" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#3B42A8"/><stop offset=".55" stop-color="#23286A"/><stop offset="1" stop-color="#14173A"/></radialGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#FFE58A" stop-opacity=".55"/><stop offset="1" stop-color="#FFE58A" stop-opacity="0"/></radialGradient>
  <linearGradient id="lgA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE58A"/><stop offset="1" stop-color="#F5A524"/></linearGradient>
  <linearGradient id="lgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FD6FF"/><stop offset="1" stop-color="#5A6CFF"/></linearGradient>
  <linearGradient id="lgC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9FC2"/><stop offset="1" stop-color="#C64CFF"/></linearGradient>
</defs>`;

const LEFT = 'M60 92 C46 82 30 80 14 82 L14 40 C30 38 46 40 60 50 Z';
const RIGHT = 'M60 92 C74 82 90 80 106 82 L106 40 C90 38 74 40 60 50 Z';
const STAR = 'M60 8 L66.5 22.5 L82 24 L70.5 34.5 L74 50 L60 42 L46 50 L49.5 34.5 L38 24 L53.5 22.5 Z';
const LINES = 'M24 52 C34 51 44 53 52 58 M24 64 C34 63 44 65 52 70 M96 52 C86 51 76 53 68 58 M96 64 C86 63 76 65 68 70';

/** The mark on a 120-unit canvas. */
const mark = () => `<circle cx="60" cy="30" r="30" fill="url(#glow)"/>
  <path fill="url(#lgB)" d="${LEFT}"/><path fill="url(#lgC)" d="${RIGHT}"/><path fill="url(#lgA)" d="${STAR}"/>
  <g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="${LEFT}"/><path d="${RIGHT}"/><path d="M60 50 L60 92"/><path d="${STAR}"/><path d="${LINES}" stroke-opacity=".8"/>
  </g>`;

/** Place the 200-unit dog at size `w` centred on (cx, cy). */
const placed = (cx, cy, w) => `<g transform="translate(${cx} ${cy}) scale(${w / 200}) translate(-100 -112)">${DOG}</g>`;

const background = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}<rect width="108" height="108" fill="url(#bg)"/>
  ${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 37 + 9) % 104}" cy="${(i * 53 + 13) % 104}" r="${0.6 + (i % 3) * 0.4}" fill="#fff" opacity=".35"/>`).join('')}</svg>`;
const foreground = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}${placed(54, 56, 70)}</svg>`;
// Themed icon: the dog's silhouette (every fill and stroke black).
const monochrome = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${placed(54, 56, 70).replace(/fill="(?!none)[^"]*"/g, 'fill="#000"').replace(/stroke="[^"]*"/g, 'stroke="#000"')}</svg>`;
function legacy(shape) {
  const clip = shape === 'round' ? '<clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath>' : '<clipPath id="c"><rect width="108" height="108" rx="24"/></clipPath>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}<defs>${clip}</defs><g clip-path="url(#c)"><rect width="108" height="108" fill="url(#bg)"/>${placed(54, 58, 96)}</g></svg>`;
}
const splash = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${DOG}</svg>`;

async function png(svg, w, h, file) {
  const out = join(res, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await sharp(Buffer.from(svg)).resize(w, h).png().toBuffer());
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, scale] of Object.entries(DENSITIES)) {
  const legacySize = Math.round(48 * scale);
  const layer = Math.round(108 * scale);
  await png(legacy('square'), legacySize, legacySize, `mipmap-${name}/ic_launcher.png`);
  await png(legacy('round'), legacySize, legacySize, `mipmap-${name}/ic_launcher_round.png`);
  await png(foreground(), layer, layer, `mipmap-${name}/ic_launcher_foreground.png`);
  await png(background(), layer, layer, `mipmap-${name}/ic_launcher_background.png`);
  await png(monochrome(), layer, layer, `mipmap-${name}/ic_launcher_monochrome.png`);
}
await png(splash(), 480, 480, 'drawable-nodpi/splash_logo.png');
mkdirSync(join(root, 'docs/assets'), { recursive: true });
writeFileSync(join(root, 'docs/assets/icon-512.png'), await sharp(Buffer.from(legacy('square'))).resize(512, 512).png().toBuffer());
console.log('icons written');
