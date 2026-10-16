// Renders Study Hard's Android launcher icons and splash logo from Biscuit's head
// (src/ui/dog.ts) on the Glass colour field. Output is committed under native/android/res,
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
const { dogHeadSvg } = await import('../src/ui/dog.ts');
/** Inner markup of the head (200-unit canvas), without its own <svg> wrapper. */
const DOG = dogHeadSvg().replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const res = join(root, 'native/android/res');

const DEFS = `<defs>
  <radialGradient id="bgA" cx="12%" cy="8%" r="75%"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#4F46E5" stop-opacity="0"/></radialGradient>
  <radialGradient id="bgB" cx="98%" cy="58%" r="60%"><stop offset="0" stop-color="#0EA5E9" stop-opacity=".75"/><stop offset="1" stop-color="#0EA5E9" stop-opacity="0"/></radialGradient>
  <radialGradient id="bgC" cx="25%" cy="105%" r="65%"><stop offset="0" stop-color="#F472B6" stop-opacity=".6"/><stop offset="1" stop-color="#F472B6" stop-opacity="0"/></radialGradient>
</defs>`;
const FIELD = '<rect width="108" height="108" fill="#0F1530"/><rect width="108" height="108" fill="url(#bgA)"/><rect width="108" height="108" fill="url(#bgB)"/><rect width="108" height="108" fill="url(#bgC)"/>';

/** Place the 200-unit dog at size `w` centred on (cx, cy). */
const placed = (cx, cy, w) => `<g transform="translate(${cx} ${cy}) scale(${w / 200}) translate(-100 -112)">${DOG}</g>`;

const background = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}${FIELD}</svg>`;
const foreground = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}${placed(54, 56, 66)}</svg>`;
// Themed icon: the dog's silhouette (every fill and stroke black).
const monochrome = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${placed(54, 56, 66).replace(/fill="(?!none)[^"]*"/g, 'fill="#000"').replace(/stroke="[^"]*"/g, 'stroke="#000"')}</svg>`;
function legacy(shape) {
  const clip = shape === 'round' ? '<clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath>' : '<clipPath id="c"><rect width="108" height="108" rx="24"/></clipPath>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}<defs>${clip}</defs><g clip-path="url(#c)">${FIELD}${placed(54, 56, 88)}</g></svg>`;
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
