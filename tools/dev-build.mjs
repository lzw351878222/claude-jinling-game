// 通用调试页构建：node tools/dev-build.mjs dev/sprite-test.js  →  dist/sprite-test.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const entry = process.argv[2];
const name = path.basename(entry, '.js');
const r = await esbuild.build({
  entryPoints: [path.join(SRC, entry)], bundle: true, format: 'iife', target: 'es2020', write: false, sourcemap: 'inline',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.css': 'text' }, define: { __DEV__: 'true' }, logLevel: 'warning',
});
const cssRes = await esbuild.build({ entryPoints: [path.join(SRC, 'styles', 'main.css')], bundle: true, write: false, logLevel: 'warning' });
let fontCss = '';
const fontFile = path.join(ROOT, 'tools', '.cache', 'brush.woff2');
if (fs.existsSync(fontFile)) fontCss = `@font-face{font-family:"JLBrush";src:url(data:font/woff2;base64,${fs.readFileSync(fontFile).toString('base64')}) format("woff2");}`;
const tpl = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const out = tpl.replace('/*__CSS__*/', () => fontCss + cssRes.outputFiles[0].text).replace('/*__JS__*/', () => r.outputFiles[0].text.replace(/<\/script/gi, '<\/script'));
fs.writeFileSync(path.join(ROOT, 'dist', `${name}.html`), out);
console.log(`已生成 dist/${name}.html`);
