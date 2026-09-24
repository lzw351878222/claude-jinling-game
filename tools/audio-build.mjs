// 音频调试页：node tools/audio-build.mjs  →  dist/audio-test.html
// 打开 http://localhost:5173/audio-test.html （所有音乐/环境/音效/插曲/对白按钮 + 离线客观测量）
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const r = await esbuild.build({
  entryPoints: [path.join(SRC, 'dev', 'audio-test.js')],
  bundle: true, format: 'iife', target: 'es2020', write: false, sourcemap: 'inline',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.css': 'text' },
  define: { __DEV__: 'true' }, logLevel: 'warning',
});
const cssRes = await esbuild.build({ entryPoints: [path.join(SRC, 'styles', 'main.css')], bundle: true, write: false, logLevel: 'warning' });
let fontCss = '';
const fontFile = path.join(ROOT, 'tools', '.cache', 'brush.woff2');
if (fs.existsSync(fontFile)) fontCss = `@font-face{font-family:"JLBrush";src:url(data:font/woff2;base64,${fs.readFileSync(fontFile).toString('base64')}) format("woff2");}`;
const tpl = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const out = tpl.replace('/*__CSS__*/', () => fontCss + cssRes.outputFiles[0].text)
  .replace('/*__JS__*/', () => r.outputFiles[0].text.replace(/<\/script/gi, '<\/script'));
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'audio-test.html'), out);
console.log('已生成 dist/audio-test.html');
