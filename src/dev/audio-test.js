// 音频调试页：node tools/audio-build.mjs → dist/audio-test.html
// 按钮覆盖全部 music / ambient / sfx / jingle / blip id；音量推子、静音；离线渲染客观测量（峰值/RMS/NaN/削波/复音数）。
import { audio } from '../core/audio.js';
import { renderOffline, analyzeAll, playBuffer, renderWith, lib } from '../core/audio/dev.js';

export const MUSIC = ['title', 'level', 'level2', 'map', 'modern', 'hongwu', 'library', 'shipyard', 'temple', 'night', 'festival',
  'boss', 'rift', 'tension', 'sad', 'ending', 'minigame', 'mystery', 'home', 'sea'];
export const AMB = ['wind', 'river', 'crowd', 'fire', 'sea', 'night', 'rain', 'library', 'construction'];
export const SFX = ['click', 'hover', 'button', 'ok', 'cancel', 'open', 'close', 'page', 'good', 'perfect', 'bad', 'error', 'win', 'fail', 'tick', 'countdown', 'quest', 'codex', 'get', 'item',
  'pluck', 'chime', 'bell', 'gong', 'drum', 'wood', 'horn', 'door', 'seal', 'stamp', 'brush', 'ink', 'star', 'sparkle', 'magic', 'coin',
  'whoosh', 'swoosh', 'fire', 'water', 'splash', 'steam', 'wave', 'crack', 'shatter', 'knock_good', 'knock_bad', 'squish', 'scurry', 'rotate', 'lamp_on', 'lamp_off', 'firework', 'hit', 'hurt', 'heal', 'step',
  'swap', 'swap_back', 'match', 'drop', 'land', 'special', 'line', 'burst', 'colorbomb', 'combo_big', 'shuffle', 'obstacle', 'worm', 'lamp_lit', 'collect', 'moves_low', 'level_win', 'level_fail', 'booster', 'hammer'];
export const JINGLES = ['codex', 'quest', 'chapter', 'seal', 'victory', 'sad', 'mystery', 'item', 'restore'];
export const BLIPS = ['kangye', 'male', 'female', 'old', 'child', 'qilin', 'monster', 'narrator'];

const ui = document.getElementById('ui');
document.body.style.background = '#1d2433';
const root = document.createElement('div');
root.style.cssText = 'position:absolute;inset:0;overflow:auto;padding:12px 16px 60px;color:#eee;font:14px/1.4 system-ui,sans-serif;z-index:5';
ui.appendChild(root);
const h = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const section = (title) => { const s = h('div', 'margin:10px 0'); s.appendChild(h('div', 'font-weight:bold;margin:6px 0;color:#f2d38a', title)); const box = h('div', 'display:flex;flex-wrap:wrap;gap:6px'); s.appendChild(box); root.appendChild(s); return box; };
const btn = (box, label, fn) => { const b = h('button', 'padding:5px 9px;border-radius:6px;border:1px solid #556;background:#2c3650;color:#fff;cursor:pointer;font-size:13px', label); b.onclick = () => { audio.unlock(); try { fn(); } catch (e) { console.error(e); } }; box.appendChild(b); return b; };

const status = h('pre', 'margin:0 0 6px;color:#9fe', 'locked');
root.appendChild(status);
setInterval(() => { status.textContent = JSON.stringify(audio._stats()) + '   currentMusic=' + audio.currentMusic; }, 250);

const ctl = section('控制');
btn(ctl, '解锁 unlock', () => audio.unlock());
btn(ctl, '静音切换', () => audio.mute(!audio.isMuted()));
btn(ctl, '停止音乐', () => audio.music(null));
btn(ctl, '停止环境', () => audio.ambient(null));
btn(ctl, 'duck', () => audio.duck(0.45, 1.2));
btn(ctl, '忽略隐藏(dev)', () => audio._dev(true));
for (const bus of ['master', 'music', 'sfx', 'ambient']) {
  const w = h('label', 'display:flex;align-items:center;gap:4px', bus);
  const r = h('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.01; r.value = audio.getVolume(bus);
  r.oninput = () => audio.setVolume(bus, +r.value);
  w.appendChild(r); ctl.appendChild(w);
}

const mus = section('音乐 music');
for (const id of MUSIC) btn(mus, id, () => audio.music(id));
btn(mus, '未知id→level', () => audio.music('no_such_track'));
const amb = section('环境 ambient');
for (const id of AMB) btn(amb, id, () => audio.ambient(id));
const opts = { pitch: 0, pan: 0, note: 5, combo: 1 };
const sx = section('音效 sfx（参数：pitch/pan/note/combo）');
for (const k of Object.keys(opts)) {
  const w = h('label', 'display:flex;align-items:center;gap:4px', k);
  const r = h('input'); r.type = 'number'; r.value = opts[k]; r.style.width = '52px'; r.step = k === 'pan' ? 0.1 : 1;
  r.oninput = () => { opts[k] = +r.value; };
  w.appendChild(r); sx.appendChild(w);
}
const sfxBox = section('');
for (const id of SFX) btn(sfxBox, id, () => audio.sfx(id, { ...opts }));
btn(sfxBox, '未知名→click', () => audio.sfx('no_such_sfx'));
const jg = section('插曲 jingle');
for (const id of JINGLES) btn(jg, id, () => audio.jingle(id));
const bl = section('对白 blip（连续 24 字）');
for (const v of BLIPS) btn(bl, v, () => { for (let i = 0; i < 24; i++) setTimeout(() => audio.blip(v), i * 45); });

const st = section('压力测试');
btn(st, '快速切歌 40 次', () => { const ids = MUSIC; for (let i = 0; i < 40; i++) setTimeout(() => audio.music(ids[i % ids.length], { fade: 0.3 }), i * 60); });
btn(st, 'match 连锁 ×60', () => { for (let i = 0; i < 60; i++) setTimeout(() => audio.sfx('match', { combo: 1 + (i % 12) }), i * 40); });
btn(st, '消除风暴 ×200', () => { const n = ['match', 'drop', 'land', 'swap', 'collect', 'burst', 'line']; for (let i = 0; i < 200; i++) setTimeout(() => audio.sfx(n[i % n.length], { combo: 1 + (i % 12) }), i * 8); });

const an = section('离线测量（OfflineAudioContext）');
const out = h('pre', 'font-size:12px;color:#cfe;white-space:pre-wrap;margin-top:6px');
root.appendChild(out);
const fmt = (r) => r.error ? `${r.kind}:${r.id} ERROR ${r.error}` :
  `${(r.kind + ':' + r.id).padEnd(22)} peak ${String(r.peakDb).padStart(6)}dB  rms ${String(r.rmsDb).padStart(6)}dB  win ${String(r.maxWinRmsDb).padStart(6)}  nan ${r.nan} clip ${r.clip} dc ${r.dc} silent ${r.silentPct}% sound ${r.soundSec}s voices ${r.maxVoices} jump ${r.maxJump} gen ${r.genMs}ms render ${r.renderMs}ms`;
const run = async (list, sec) => { out.textContent = ''; const rows = await analyzeAll(list, sec, (r) => { out.textContent += fmt(r) + '\n'; }); window.__rows = rows; return rows; };
btn(an, '全部音乐 12s', () => run(MUSIC.map((id) => ['music', id]), 12));
btn(an, '全部环境 10s', () => run(AMB.map((id) => ['ambient', id]), 10));
btn(an, '全部音效', () => run(SFX.map((id) => ['sfx', id, 2.8]), 2.8));
btn(an, '全部插曲', () => run(JINGLES.map((id) => ['jingle', id, 4.3]), 4.3));
btn(an, '全部 blip', () => run(BLIPS.map((id) => ['blip', id, 2.9]), 2.9));
let lastSrc = null;
btn(an, '试听：离线渲染当前音乐 20s', async () => { const r = await renderOffline('music', audio.currentMusic || 'title', 20); out.textContent = fmt({ kind: 'music', id: audio.currentMusic, ...r.stats, maxVoices: r.maxVoices, genMs: r.genMs, renderMs: r.renderMs }); audio.unlock(); if (lastSrc) lastSrc.stop(); lastSrc = playBuffer(new (window.AudioContext || window.webkitAudioContext)(), r.buf); });

window.__audio = audio;
window.__dev = { renderOffline, renderWith, lib, analyzeAll, run, MUSIC, AMB, SFX, JINGLES, BLIPS, fmt };
