// Dependency-free bundler: follows the import graph from an entry, transpiles each
// TypeScript module to CommonJS with the TypeScript compiler, wraps it in a tiny
// module registry and inlines everything (CSS, app bundle, worker bundle) into a
// single self-contained dist/index.html.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

/** Bundle one entry into a self-executing script string. */
export function bundle(entryAbs) {
  const modules = new Map(); // id -> { deps: {spec: id}, code }
  const queue = [entryAbs];
  while (queue.length) {
    const file = queue.pop();
    const id = relative(src, file).split('\\').join('/');
    if (modules.has(id)) continue;
    const text = readFileSync(file, 'utf8');
    const deps = {};
    for (const imp of ts.preProcessFile(text, true, true).importedFiles) {
      const spec = imp.fileName;
      if (!spec.startsWith('.')) throw new Error(`${id}: only relative imports are bundled (got "${spec}")`);
      if (!spec.endsWith('.ts')) throw new Error(`${id}: import "${spec}" must use an explicit .ts extension`);
      const depAbs = resolve(dirname(file), spec);
      deps[spec] = relative(src, depAbs).split('\\').join('/');
      queue.push(depAbs);
    }
    const out = ts.transpileModule(text, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
        isolatedModules: true,
        removeComments: false,
      },
    });
    const errs = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    if (errs.length) {
      throw new Error(`${id}: ${errs.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ')}`);
    }
    modules.set(id, { deps, code: out.outputText });
  }
  const entryId = relative(src, entryAbs).split('\\').join('/');
  const defs = [...modules].map(
    ([id, m]) =>
      `__def(${JSON.stringify(id)},${JSON.stringify(m.deps)},function(require,module,exports){\n${m.code}\n});`,
  );
  return `(function(){"use strict";
var __defs={},__cache={};
function __def(id,deps,fn){__defs[id]={deps:deps,fn:fn};}
function __req(id){
  if(__cache[id])return __cache[id].exports;
  var d=__defs[id]; if(!d)throw new Error("module not found: "+id);
  var module={exports:{}}; __cache[id]=module;
  d.fn(function(spec){var t=d.deps[spec]; if(!t)throw new Error(id+": unresolved "+spec); return __req(t);},module,module.exports);
  return module.exports;
}
${defs.join('\n')}
__req(${JSON.stringify(entryId)});
})();`;
}

/** Make a string safe to place inside an inline <script> element. */
const scriptSafe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

/** The theme fonts (Inter Display, TeX Gyre Schola), vendored in assets/fonts and inlined. */
const FONT_FILES = [
  ['Inter Display', 500, 'normal', 'inter-display-medium.woff'],
  ['Inter Display', 600, 'normal', 'inter-display-semibold.woff'],
  ['Inter Display', 700, 'normal', 'inter-display-bold.woff'],
  ['Schola', 400, 'normal', 'schola-regular.woff'],
  ['Schola', 700, 'normal', 'schola-bold.woff'],
  ['Schola', 400, 'italic', 'schola-italic.woff'],
];
function fonts() {
  return FONT_FILES.map(([family, weight, style, file]) => {
    const b64 = readFileSync(join(root, 'assets', 'fonts', file)).toString('base64');
    return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};font-display:block;src:url(data:font/woff;base64,${b64}) format("woff")}`;
  }).join('');
}

export function build() {
  const css = readdirSync(join(src, 'styles'))
    .filter((f) => f.endsWith('.css'))
    .sort()
    .map((f) => readFileSync(join(src, 'styles', f), 'utf8'))
    .join('\n');
  const appSrc = bundle(join(src, 'main.ts'));
  const buildInfo = { version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, builtAt: new Date().toISOString() };
  const scriptFor = (info) =>
    `window.__BUILD__=${JSON.stringify(info)};\n` + appSrc;
  const js = scriptFor(buildInfo);
  const fontCss = fonts();
  const html = readFileSync(join(src, 'index.html'), 'utf8')
    .replace('/*__FONTS__*/', () => fontCss)
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => scriptSafe(js));
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, 'index.html'), html);
  // Artifact variant: the host wraps the page in its own document skeleton, so it
  // carries only the title, styles, app root and script.
  // The shared preview link is a playtest build: it also offers preview tools.
  const previewJs = scriptFor({ ...buildInfo, preview: true });
  const artifact =
    `<title>Study Hard</title>\n<meta name="theme-color" content="#0F1530">\n<style>${fontCss}</style>\n<style>${css}</style>\n` +
    `<div id="app" aria-live="polite"></div>\n<script>${scriptSafe(previewJs)}</script>\n`;
  writeFileSync(join(dist, 'artifact.html'), artifact);
  return { bytes: Buffer.byteLength(html) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = performance.now();
  const { bytes } = build();
  console.log(`dist/index.html  ${(bytes / 1024).toFixed(1)} KB  (${(performance.now() - t0).toFixed(0)} ms)`);
}
