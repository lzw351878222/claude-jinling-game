// 无头 Chrome 截图：node tools/shot.mjs <url> <out.png> [宽x高] [等待毫秒]
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const [url, out, size = '1280x720', wait = '4000'] = process.argv.slice(2);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const [w, h] = size.split('x');
const abs = path.resolve(out);
const prof = path.resolve('tools/.cache/chrome-prof');
fs.mkdirSync(prof, { recursive: true });
execFileSync(chrome, ['--headless=new', '--hide-scrollbars', '--mute-audio', `--user-data-dir=${prof}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  `--window-size=${w},${h}`, `--virtual-time-budget=${wait}`, `--screenshot=${abs}`, url], { stdio: 'pipe', timeout: 120000 });
console.log('saved', abs);
