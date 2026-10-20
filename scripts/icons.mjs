// Renders Study Hard's Android launcher icons and splash logo from Plus, the mascot
// (src/ui/plus.ts), on the Playground sky. Output is committed under native/android/res,
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
const { plusFaceSvg } = await import('../src/ui/plus.ts');
/** Inner markup of Plus (200 × 204 canvas, middle 100 102), without its own <svg> wrapper. */
const PLUS = plusFaceSvg().replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const res = join(root, 'native/android/res');

const DEFS = `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6EC3FF"/><stop offset="1" stop-color="#C4EBFF"/></linearGradient>
</defs>`;
// Sky, a soft cloud and two green hills along the bottom.
const FIELD = '<rect width="108" height="108" fill="url(#sky)"/><ellipse cx="24" cy="20" rx="13" ry="5" fill="#fff" opacity=".8"/><ellipse cx="33" cy="17" rx="8" ry="4.5" fill="#fff" opacity=".8"/><ellipse cx="20" cy="112" rx="52" ry="22" fill="#6FD88A"/><ellipse cx="92" cy="114" rx="50" ry="24" fill="#55C978"/>';

/** Place Plus at size `w` centred on (cx, cy). */
const placed = (cx, cy, w) => `<g transform="translate(${cx} ${cy}) scale(${w / 200}) translate(-100 -102)">${PLUS}</g>`;

const background = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}${FIELD}</svg>`;
const foreground = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${placed(54, 54, 64)}</svg>`;
// Themed icon: Plus's silhouette with the eyes and smile cut out (Android uses only the alpha).
const MONO = `<rect x="60" y="2" width="80" height="172" rx="18" fill="#fff"/><rect x="12" y="50" width="176" height="76" rx="18" fill="#fff"/><circle cx="16" cy="92" r="14" fill="#fff"/><circle cx="186" cy="66" r="14" fill="#fff"/>
  <path d="M88 166 L84 190 M112 166 L116 190" stroke="#fff" stroke-width="8" stroke-linecap="round"/><ellipse cx="79" cy="193" rx="13" ry="7" fill="#fff"/><ellipse cx="121" cy="193" rx="13" ry="7" fill="#fff"/>
  <ellipse cx="86" cy="82" rx="8.5" ry="10.5" fill="#000"/><ellipse cx="114" cy="82" rx="8.5" ry="10.5" fill="#000"/><path d="M85 96 Q100 119 115 96 Q100 103 85 96 Z" fill="#000"/>`;
const monochrome = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><defs><mask id="m"><g transform="translate(54 54) scale(${64 / 200}) translate(-100 -102)">${MONO}</g></mask></defs><rect width="108" height="108" fill="#000" mask="url(#m)"/></svg>`;
function legacy(shape) {
  const clip = shape === 'round' ? '<clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath>' : '<clipPath id="c"><rect width="108" height="108" rx="24"/></clipPath>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${DEFS}<defs>${clip}</defs><g clip-path="url(#c)">${FIELD}${placed(54, 53, 84)}</g></svg>`;
}
const splash = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 204">${PLUS}</svg>`;

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
