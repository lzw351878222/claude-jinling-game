// 单个小游戏的独立调试页：node tools/mg-build.mjs <id>  →  dist/mg-<id>.html
// 打开 http://localhost:5173/mg-<id>.html （可加 ?auto=1 自动开始，?opts={"a":1} 传参）
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const id = process.argv[2];
if (!id) { console.error('用法: node tools/mg-build.mjs <小游戏id>'); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const entry = `
import { runMinigame } from './minigames/host.js';
import game from './minigames/${id}.js';
import { audio } from './core/audio.js';
const ui = document.getElementById('ui');
const params = new URLSearchParams(location.search);
const opts = JSON.parse(params.get('opts') || '{}');
const btn = document.createElement('button');
btn.className = 'jl-btn primary';
btn.textContent = '启动：' + game.title;
btn.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)';
ui.appendChild(btn);
document.body.style.background = '#2b3a55';
async function start() {
  audio.unlock();
  btn.remove();
  const r = await runMinigame(game, opts);
  console.log('MG_RESULT', JSON.stringify(r));
  let pre = document.getElementById('mg-result');
  if (!pre) { pre = document.createElement('pre'); pre.id = 'mg-result'; pre.style.cssText = 'position:absolute;left:12px;top:12px;color:#fff;font-size:15px;z-index:99'; ui.appendChild(pre); }
  pre.textContent = JSON.stringify(r);
  ui.appendChild(btn);
}
btn.onclick = start;
if (params.get('auto')) start();
window.__mgStart = start;
`;
const r = await esbuild.build({
  stdin: { contents: entry, resolveDir: SRC, loader: 'js' },
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
fs.writeFileSync(path.join(ROOT, 'dist', `mg-${id}.html`), out);
console.log(`已生成 dist/mg-${id}.html`);
