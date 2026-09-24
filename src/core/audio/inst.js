// 金陵寻踪 · 民乐音色库。所有函数签名：fn(E, ch, t, midi, …)；ch 为声道条（makeChannel 的返回）或 AudioNode。
import { osc, noise, playBuf, getBuf, mtof, rnd } from './engine.js';
import { stringData, bellData, drumData, modalData, metalData } from './dsp.js';

// 缓冲按"每两个半音"一格预计算，相邻半音用 playbackRate 移调（≤1 半音，音色差异可忽略），内存减半
const grid = (m) => { const mm = Math.round(m); return mm - (((mm % 2) + 2) % 2); };
const rateOf = (m, base) => Math.pow(2, (m - base) / 12);
const SSR = { zheng: 32000, pipa: 32000, qin: 24000 };

// —— 弹拨：古筝 / 琵琶 / 古琴（Karplus-Strong 预计算）——
function strBuf(E, kind, base) { return getBuf(E, kind + ':' + base, (sr) => stringData(sr, base, kind), Math.min(SSR[kind] || 32000, E.ctx.sampleRate)); }
function pluck(E, ch, t, m, o, kind, gain, extra) {
  const base = grid(m);
  return playBuf(E, ch, t, strBuf(E, kind, base), { rate: rateOf(m, base) * (o.rateMul || 1), vol: (o.vel != null ? o.vel : 0.6) * gain, d: o.d, bend: o.bend, vib: o.vib, ...extra });
}
// o: {vel, d(闷音时长), bend:[比例,延迟,时长], vib:[音分,Hz], rateMul}
export function zheng(E, ch, t, m, o = {}) { return pluck(E, ch, t, m, o, 'zheng', 0.85, { twang: 0.0035 }); }
export function pipa(E, ch, t, m, o = {}) { return pluck(E, ch, t, m, o, 'pipa', 0.8, { twang: 0.005 }); }
export function qin(E, ch, t, m, o = {}) { return pluck(E, ch, t, m, o, 'qin', 0.9, { a: 0.004 }); }
// 琵琶轮指（颤音）：dur 秒内以约 13Hz 反复弹拨
export function pipaTrem(E, ch, t, m, dur, o = {}) {
  const vel = o.vel != null ? o.vel : 0.5, rate = o.rate || 13, dt = 1 / rate;
  const n = Math.max(2, Math.floor(dur * rate));
  for (let k = 0; k < n; k++) {
    const acc = k === 0 ? 1 : 0.55 + 0.25 * Math.sin(k * 1.7) + 0.1 * Math.random();
    pipa(E, ch, t + k * dt + rnd(-0.004, 0.004), m, { vel: vel * acc, d: k === n - 1 ? 0.5 : dt * 2.2 });
  }
}
// 花指 / 刮奏：沿音阶从 from 到 to（MIDI，含端点），scale 为允许的音级函数
export function gliss(E, ch, t, from, to, dur, inScale, o = {}) {
  const notes = [];
  const dir = to >= from ? 1 : -1;
  for (let m = from; dir > 0 ? m <= to : m >= to; m += dir) if (inScale(m)) notes.push(m);
  const n = notes.length, vel = o.vel != null ? o.vel : 0.4, f = o.inst || zheng;
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? i / (n - 1) : 1;
    const tt = t + dur * (1 - Math.pow(1 - x, 1.35)); // 略加速
    f(E, ch, tt, notes[i], { vel: vel * (0.45 + 0.55 * (o.dim ? 1 - x * 0.6 : x)), d: i < n - 1 ? (o.ring || 0.9) : undefined });
  }
  return n ? notes[n - 1] : to;
}

// —— 吹管 / 拉弦（实时振荡器，颤音用预计算曲线，无额外 LFO 节点）——
function waves(E) {
  if (E.waves) return E.waves;
  const c = E.ctx, mk = (amps) => {
    const re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => { im[i + 1] = a; });
    return c.createPeriodicWave(re, im, { disableNormalization: false });
  };
  const saw = [], reed = [];
  for (let k = 1; k <= 24; k++) { saw.push(1 / Math.pow(k, 1.05)); reed.push((k % 2 ? 1 : 0.65) / Math.pow(k, 0.85)); }
  E.waves = {
    dizi: mk([1, 0.42, 0.22, 0.12, 0.09, 0.05, 0.035, 0.02]),
    xiao: mk([1, 0.18, 0.06, 0.025]),
    erhu: mk(saw),
    suona: mk(reed),
    warm: mk([1, 0.3, 0.12, 0.05]),
    sheng: mk([1, 0.5, 0.45, 0.2, 0.22, 0.1, 0.08, 0.05]),
  };
  return E.waves;
}
// o: {vel, from(上一音 MIDI，产生滑音), grace(倚音半音偏移), vib 深度}
export function dizi(E, ch, t, m, dur, o = {}) {
  const w = waves(E), f = mtof(m), vel = o.vel != null ? o.vel : 0.6;
  if (o.grace) osc(E, ch, t - 0.06, { wave: w.dizi, f: mtof(m + o.grace), a: 0.01, hold: 0.045, r: 0.03, vol: 0.16 * vel });
  const v = osc(E, ch, t, { wave: w.dizi, f: o.from ? mtof(o.from) : f * 0.985, f2: f, glide: o.from ? 0.07 : 0.05, a: 0.03, hold: dur * 0.94, r: 0.12, vol: 0.2 * vel, vib: [o.vib != null ? o.vib : 16, 5.3, 0.28] });
  noise(E, ch, t, { f: Math.min(9000, f * 3), q: 1.2, a: 0.015, hold: Math.min(dur * 0.9, 0.9), r: 0.15, vol: 0.05 * vel });
  noise(E, ch, t, { type: 'highpass', f: 2500, a: 0.002, d: 0.05, vol: 0.05 * vel }); // 吐音气口
  return v;
}
export function xiao(E, ch, t, m, dur, o = {}) {
  const w = waves(E), f = mtof(m), vel = o.vel != null ? o.vel : 0.6;
  const v = osc(E, ch, t, { wave: w.xiao, f: o.from ? mtof(o.from) : f * 0.99, f2: f, glide: o.from ? 0.12 : 0.08, a: 0.12, hold: dur * 0.95, r: 0.3, vol: 0.24 * vel, vib: [o.vib != null ? o.vib : 11, 4.6, 0.45] });
  noise(E, ch, t, { f: Math.min(6000, f * 2), q: 0.8, a: 0.08, hold: dur * 0.9, r: 0.3, vol: 0.07 * vel });
  return v;
}
export function suona(E, ch, t, m, dur, o = {}) {
  const w = waves(E), f = mtof(m), vel = o.vel != null ? o.vel : 0.6;
  if (o.grace) osc(E, ch, t - 0.05, { wave: w.suona, f: mtof(m + o.grace), a: 0.008, hold: 0.04, r: 0.02, vol: 0.08 * vel });
  return osc(E, ch, t, { wave: w.suona, f: o.from ? mtof(o.from) : f * 0.97, f2: f, glide: 0.06, a: 0.025, hold: dur * 0.92, r: 0.08, vol: 0.1 * vel, vib: [o.vib != null ? o.vib : 24, 5.8, 0.2] });
}
export function erhu(E, ch, t, m, dur, o = {}) {
  const w = waves(E), f = mtof(m), vel = o.vel != null ? o.vel : 0.6;
  const v = osc(E, ch, t, { wave: w.erhu, f: o.from ? mtof(o.from) : f * 0.99, f2: f, glide: o.from ? 0.11 : 0.06, a: o.a || 0.14, hold: dur * 0.96, r: 0.25, vol: 0.12 * vel, vib: [o.vib != null ? o.vib : 20, 5.4, 0.3] });
  noise(E, ch, t, { f: 2800, q: 0.9, a: 0.1, hold: dur * 0.9, r: 0.2, vol: 0.012 * vel }); // 弓毛擦声
  return v;
}
// 柔和铺底和声（每音两支轻微失谐的振荡器）
export function pad(E, ch, t, notes, dur, o = {}) {
  const w = waves(E), vel = o.vel != null ? o.vel : 0.5, a = o.a || 1.2, r = o.r || 1.6;
  for (const m of notes) for (const dt of [-6, 6]) osc(E, ch, t, { wave: o.sheng ? w.sheng : w.warm, f: mtof(m), detune: dt + rnd(-2, 2), a, hold: dur, r, vol: 0.05 * vel / Math.sqrt(notes.length) });
}
export function drone(E, ch, t, m, dur, o = {}) {
  const w = waves(E), vel = o.vel != null ? o.vel : 0.5;
  osc(E, ch, t, { wave: w.warm, f: mtof(m), a: o.a || 1.5, hold: dur, r: o.r || 2, vol: 0.09 * vel });
}

// —— 钟磬（加法合成预计算，24kHz 足够）——
function bellBuf(E, kind, base) { return getBuf(E, 'bell:' + kind + ':' + base, (sr) => bellData(sr, mtof(base), kind), Math.min(22050, E.ctx.sampleRate)); }
export function bell(E, ch, t, m, o = {}) {
  const kind = o.kind || 'bell', base = grid(m);
  return playBuf(E, ch, t, bellBuf(E, kind, base), { rate: rateOf(m, base) * (o.rate || 1), vol: (o.vel != null ? o.vel : 0.5) * 0.7, d: o.d });
}

// —— 打击乐（预计算多个变体，运行时随机取用）——
const PERC = {
  muyu: [modalData, { f: 560, modes: [[1, 1, 0.05], [1.52, 0.3, 0.02], [2.9, 0.1, 0.01]], click: 0.25, clickLen: 0.003, len: 0.25 }],
  bang: [modalData, { f: 1480, modes: [[1, 1, 0.035], [2.27, 0.35, 0.014], [3.93, 0.16, 0.008]], click: 0.5, clickLen: 0.002, len: 0.15 }],
  tanggu: [drumData, { f0: 200, f1: 108, drop: 0.035, dec: 0.3, noise: 0.35, nLP: 0.18, nDec: 0.025, len: 0.9, h2: 0.22 }],
  rim: [modalData, { f: 820, modes: [[1, 1, 0.02], [1.73, 0.5, 0.014], [2.6, 0.3, 0.01]], click: 0.6, clickLen: 0.003, len: 0.1 }],
  dagu: [drumData, { f0: 115, f1: 52, drop: 0.07, dec: 0.55, noise: 0.28, nLP: 0.08, nDec: 0.05, len: 1.4, h2: 0.15 }],
  bangu: [drumData, { f0: 950, f1: 720, drop: 0.012, dec: 0.045, noise: 0.9, nLP: 0.55, nDec: 0.012, len: 0.14, hp: 300 }],
  gong: [metalData, { f: 150, parts: [[1, 1, 4, 0.02], [1.47, 0.6, 3, 0.06], [2.09, 0.5, 2.4, 0.12], [2.56, 0.36, 2, 0.2], [3.18, 0.3, 1.5, 0.25], [3.87, 0.22, 1.2, 0.3], [4.61, 0.15, 1, 0.3], [5.49, 0.1, 0.7, 0.35]], glide: 0.94, glideT: 0.45, noise: 0.22, nF: 2400, nQ: 0.7, nDec: 0.6, len: 4 }],
  xiaoluo: [metalData, { f: 610, parts: [[1, 1, 1.1, 0.002], [1.52, 0.45, 0.8], [2.31, 0.3, 0.5], [3.12, 0.15, 0.35]], glide: 1.14, glideT: 0.1, noise: 0.14, nF: 4200, nDec: 0.12, len: 1.4 }],
  bo: [metalData, { f: 430, parts: [[1, 0.15, 0.7], [2.71, 0.18, 0.6], [4.93, 0.16, 0.5], [7.31, 0.15, 0.45], [9.8, 0.12, 0.35], [13.4, 0.1, 0.3]], noise: 1, nF: 5200, nQ: 0.45, nDec: 0.45, len: 1.6 }],
  cha: [metalData, { f: 520, parts: [[4.93, 0.15, 0.2], [7.31, 0.15, 0.15], [9.8, 0.12, 0.12]], noise: 1, nF: 6000, nQ: 0.5, nDec: 0.07, len: 0.35 }],
  chisel: [modalData, { f: 2650, modes: [[1, 1, 0.09], [2.71, 0.4, 0.05], [5.2, 0.2, 0.03]], click: 0.4, clickLen: 0.002, len: 0.3 }],
  thud: [drumData, { f0: 140, f1: 70, drop: 0.02, dec: 0.1, noise: 0.6, nLP: 0.12, nDec: 0.03, len: 0.35 }],
  paiban: [modalData, { f: 2100, modes: [[1, 1, 0.02], [1.8, 0.6, 0.015], [3.3, 0.3, 0.008]], click: 0.8, clickLen: 0.004, len: 0.1, bp: 3000 }],
  brick: [modalData, { f: 3100, modes: [[1, 1, 0.5], [2.37, 0.4, 0.25], [4.1, 0.25, 0.12], [6.3, 0.1, 0.06]], click: 0.3, clickLen: 0.002, len: 1.2 }],
};
export const PERC_NAMES = Object.keys(PERC);
// o: {vel, rate, d, v(变体序号)}
const NVAR = (def) => (def[1].len > 1 ? 2 : 3);
export function perc(E, ch, t, name, o = {}) {
  const def = PERC[name] || PERC.muyu;
  const v = o.v != null ? o.v % NVAR(def) : (Math.random() * NVAR(def)) | 0;
  const buf = getBuf(E, 'perc:' + name + ':' + v, (sr) => def[0](sr, def[1], 17 + v * 101), Math.min(def[1].len > 1 ? 24000 : 32000, E.ctx.sampleRate));
  if (o.warmOnly) return null;
  return playBuf(E, ch, t, buf, { rate: (o.rate || 1) * rnd(0.985, 1.015), vol: (o.vel != null ? o.vel : 0.6) * 0.8, d: o.d });
}
// 预热缓存（分批在空闲时生成，避免首次演奏时卡顿）。返回待办任务列表：每项是一个无参函数
export function warmTasks(E, spec) {
  const tasks = [];
  for (const kind of ['zheng', 'pipa', 'qin']) {
    const seen = new Set();
    for (const m of spec[kind] || []) { const b = grid(m); if (!seen.has(b)) { seen.add(b); tasks.push(() => strBuf(E, kind, b)); } }
  }
  for (const name of spec.perc || []) {
    const def = PERC[name];
    if (def) for (let v = 0; v < NVAR(def); v++) tasks.push(() => perc(E, null, 0, name, { v, warmOnly: true }));
  }
  for (const [kind, m] of spec.bell || []) tasks.push(() => bellBuf(E, kind, grid(m)));
  return tasks;
}
