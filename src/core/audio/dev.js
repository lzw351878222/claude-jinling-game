// 金陵寻踪 · 音频开发工具（仅调试页引用，不进入游戏包）：离线渲染任意曲目/音效并做客观测量
import { createEngine, DEFAULT_VOL } from './engine.js';
import { Player } from './seq.js';
import { TRACKS } from './tracks.js';
import { playSfx, playBlip, playJingle } from './sfx.js';
import { Ambience } from './ambient.js';

import * as engine from './engine.js';
import * as inst from './inst.js';
import * as sfxlib from './sfxlib.js';
import * as seq from './seq.js';
export const lib = { engine, inst, sfxlib, seq, TRACKS };

// 用任意函数 fn(E) 离线渲染（调试实验用）
export async function renderWith(fn, seconds = 2, sr = 44100) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(sr * seconds), sr);
  const E = createEngine(ctx, DEFAULT_VOL);
  fn(E);
  const buf = await ctx.startRendering();
  return { buf, stats: analyze(buf) };
}

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const T0 = 0.3;

// 离线渲染。kind: music | ambient | sfx | jingle | blip；返回 {buf, stats, genMs, renderMs, maxVoices}
export async function renderOffline(kind, id, seconds = 12, opt = {}) {
  const sr = opt.sr || 44100;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(sr * seconds), sr);
  const E = createEngine(ctx, opt.vols || DEFAULT_VOL);
  const g0 = performance.now();
  if (kind === 'music') {
    const p = new Player(E, TRACKS[id] || TRACKS.level, TRACKS[id] ? id : 'level', E.bus.music);
    p.warmStep(1e9);
    p.start(0, 0.05, opt.delay != null ? opt.delay : 0.05);
    for (let h = 0; h < seconds; h += 0.25) p.tick(h, Math.min(seconds, h + 0.25));
  } else if (kind === 'ambient') {
    const a = new Ambience(E, id, 1);
    a.start(0, 0.3);
    for (let h = 0; h < seconds; h += 0.25) a.tick(h, Math.min(seconds, h + 0.25));
  } else if (kind === 'sfx') { // 注意：压缩器在上下文最初 ~0.1s 内会压低约 9dB，所以一次性声音从 T0 开始测
    const reps = opt.reps || 1;
    for (let i = 0; i < reps; i++) playSfx(E, id, { ...(opt.o || {}), combo: opt.o && opt.o.combo != null ? opt.o.combo : 1 + (i % 12) }, T0 + i * (opt.gap || 0.5));
  } else if (kind === 'jingle') playJingle(E, id, T0);
  else if (kind === 'blip') for (let i = 0; i < 24; i++) playBlip(E, id, T0 + i * 0.09);
  const genMs = performance.now() - g0;
  const maxVoices = overlap(E.voices);
  const r0 = performance.now();
  const buf = await ctx.startRendering();
  const one = kind === 'sfx' || kind === 'jingle' || kind === 'blip';
  const stats = analyze(buf, one ? T0 : 0);
  return { buf, stats, genMs: Math.round(genMs), renderMs: Math.round(performance.now() - r0), maxVoices, cache: E.cache.size };
}

// 同时发声的复音数峰值（扫描线）
function overlap(vs) {
  const ev = [];
  for (const v of vs) { ev.push([v.t0, 1]); ev.push([v.end, -1]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let c = 0, m = 0;
  for (const [, d] of ev) { c += d; if (c > m) m = c; }
  return m;
}

// 峰值 / RMS / 最大 400ms 窗口 RMS / NaN / 削波 / 直流 / 静音比例 / 有声时长
export function analyze(buf, skip = 0) {
  const chs = [];
  for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c).subarray(Math.floor(skip * buf.sampleRate)));
  const n = chs[0].length, sr = buf.sampleRate, win = Math.floor(sr * 0.4);
  let peak = 0, sum = 0, nan = 0, clip = 0, dc = 0, lastLoud = 0, silentWins = 0, wins = 0, maxWin = 0, wsum = 0, wn = 0, maxJump = 0;
  for (let i = 0; i < n; i++) {
    let s2 = 0;
    for (const d of chs) {
      const x = d[i];
      if (!Number.isFinite(x)) { nan++; continue; }
      const a = Math.abs(x);
      if (a > peak) peak = a;
      if (a >= 0.999) clip++;
      if (a > 0.0015) lastLoud = i;
      sum += x * x; dc += x; s2 += x * x;
      if (i > 0) { const j = Math.abs(x - d[i - 1]); if (j > maxJump) maxJump = j; }
    }
    wsum += s2 / chs.length; wn++;
    if (wn === win) {
      const r = Math.sqrt(wsum / wn);
      if (r > maxWin) maxWin = r;
      if (r < 0.0005) silentWins++;
      wins++; wsum = 0; wn = 0;
    }
  }
  const total = n * chs.length;
  const f = (x) => Math.round(x * 10) / 10;
  return {
    peakDb: f(db(peak)), rmsDb: f(db(Math.sqrt(sum / total))), maxWinRmsDb: f(db(maxWin)),
    nan, clip, dc: +(dc / total).toFixed(5), silentPct: wins ? Math.round((100 * silentWins) / wins) : 0,
    soundSec: +(lastLoud / sr).toFixed(2), maxJump: +maxJump.toFixed(3),
  };
}

// 批量分析：返回表格行
export async function analyzeAll(list, seconds, onRow) {
  const rows = [];
  for (const [kind, id, sec, opt] of list) {
    try {
      const r = await renderOffline(kind, id, sec || seconds, opt || {});
      const row = { kind, id, ...r.stats, maxVoices: r.maxVoices, genMs: r.genMs, renderMs: r.renderMs };
      rows.push(row);
      if (onRow) onRow(row);
    } catch (e) {
      const row = { kind, id, error: String(e && e.message || e) };
      rows.push(row);
      if (onRow) onRow(row);
    }
  }
  return rows;
}

// 把 AudioBuffer 用实时上下文播放（试听离线渲染结果）
export function playBuffer(ctx, buf) {
  const s = ctx.createBufferSource();
  s.buffer = buf; s.connect(ctx.destination); s.start();
  return s;
}
