// 金陵寻踪 · 构建脚本
// 把 src/ 下的全部 JS 模块、CSS、图片、字体用 esbuild 打包并内联成单个 dist/index.html（无任何外部依赖）。
//   node build.mjs            生产构建（压缩）
//   node build.mjs --dev      开发构建（不压缩，带 sourcemap，额外生成小游戏调试页 dist/mg.html）
//   node build.mjs --dev --serve   开发构建 + 监听 + 本地服务 http://localhost:5173
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const DEV = process.argv.includes('--dev');
const SERVE = process.argv.includes('--serve');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

// ---------------------------------------------------------------- 字体子集
// 扫描源码里出现过的全部中日韩字符，用 fonttools 把马善政毛笔楷书（OFL）裁成子集 woff2，
// 这样标题、人名、按钮在任何设备上都是同一种书法字体，而体积只有几百 KB。
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(js|css|html)$/.test(f.name)) out.push(p);
  }
  return out;
}
function buildFontSubset() {
  const chars = new Set();
  for (const f of walk(SRC)) {
    for (const ch of fs.readFileSync(f, 'utf8')) {
      const c = ch.codePointAt(0);
      if ((c >= 0x3000 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x2000 && c <= 0x206f)) chars.add(ch);
    }
  }
  const base = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz·—…「」『』《》〈〉，。、！？：；（）【】“”‘’';
  for (const ch of base) chars.add(ch);
  const text = [...chars].sort().join('');
  const cacheDir = path.join(ROOT, 'tools', '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const textFile = path.join(cacheDir, 'chars.txt');
  const outs = [
    { src: 'MaShanZheng-Regular.ttf', out: 'brush.woff2' },
  ];
  const prev = fs.existsSync(textFile) ? fs.readFileSync(textFile, 'utf8') : '';
  const need = prev !== text || outs.some((o) => !fs.existsSync(path.join(cacheDir, o.out)));
  if (need) {
    fs.writeFileSync(textFile, text, 'utf8');
    for (const o of outs) {
      execFileSync('python', ['-m', 'fontTools.subset', path.join(ROOT, 'tools', 'fonts', o.src),
        `--text-file=${textFile}`, '--flavor=woff2', `--output-file=${path.join(cacheDir, o.out)}`,
        '--layout-features=*', '--no-hinting'], { stdio: 'inherit' });
    }
  }
  const res = {};
  for (const o of outs) res[o.out] = fs.readFileSync(path.join(cacheDir, o.out)).toString('base64');
  console.log(`字体子集：${chars.size} 字，brush.woff2 ${(res['brush.woff2'].length * 0.75 / 1024).toFixed(0)} KB`);
  return res;
}

// ---------------------------------------------------------------- 打包
const common = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.css': 'text' },
  minify: !DEV,
  sourcemap: DEV ? 'inline' : false,
  legalComments: 'none',
  define: { __DEV__: String(DEV) },
  logLevel: 'warning',
  write: false,
};

async function bundle(entry) {
  const r = await esbuild.build({ ...common, entryPoints: [path.join(SRC, entry)] });
  return r.outputFiles[0].text;
}

async function buildAll() {
  const t0 = Date.now();
  const fonts = buildFontSubset();
  const fontCss = `@font-face{font-family:"JLBrush";src:url(data:font/woff2;base64,${fonts['brush.woff2']}) format("woff2");font-display:block;}`;
  const cssRes = await esbuild.build({
    entryPoints: [path.join(SRC, 'styles', 'main.css')], bundle: true, minify: !DEV, write: false, logLevel: 'warning',
  });
  const css = fontCss + cssRes.outputFiles[0].text;
  const js = await bundle('main.js');
  const tpl = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => safeJs);
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  let extra = '';
  if (DEV && fs.existsSync(path.join(SRC, 'dev', 'mg-harness.js'))) {
    const mg = await bundle(path.join('dev', 'mg-harness.js'));
    const mgHtml = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => mg.replace(/<\/script/gi, '<\\/script'));
    fs.writeFileSync(path.join(DIST, 'mg.html'), mgHtml);
    extra = ' + mg.html';
  }
  const kb = (fs.statSync(path.join(DIST, 'index.html')).size / 1024).toFixed(0);
  console.log(`构建完成 dist/index.html ${kb} KB${extra}（${Date.now() - t0} ms）`);
}

await buildAll();

if (SERVE) {
  let timer = null;
  let building = false;
  let again = false;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (building) { again = true; return; }
      building = true;
      try { await buildAll(); } catch (e) { console.error(e.message); }
      building = false;
      if (again) { again = false; rebuild(); }
    }, 150);
  };
  fs.watch(SRC, { recursive: true }, rebuild);
  const ctx = await esbuild.context({ entryPoints: [], write: false });
  const { port } = await ctx.serve({ servedir: DIST, port: 5173, host: '127.0.0.1' });
  console.log(`开发服务：http://localhost:${port}/  （小游戏调试：/mg.html?g=kiln）`);
}
