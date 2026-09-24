// 金陵寻踪 · 音效构件：统一的"一次性声音"小工具（o 为一次播放的上下文）
// o = { E, t, ch, v(音量), p(半音移调), r(频率比，含 ±2.5% 随机), note, combo }
import { osc, noise, pentaMidi, rnd, getBuf, playBuf, makeChannel, clamp } from './engine.js';
import * as I from './inst.js';
import { crackleData, bubbleData, shatterData, clicksData, chitterData, stepData } from './dsp2.js';

export const BASE = 62; // D4：五声级数 0 = D4
export const pd = (deg) => pentaMidi(BASE, deg);
export { rnd, clamp };

// 振荡器 / 噪声（频率随 o.r 变化，音量随 o.v 变化）
export function T(o, dt, s) {
  return osc(o.E, o.ch, o.t + dt, { ...s, f: s.f * o.r, f2: s.f2 ? s.f2 * o.r : undefined, vol: (s.vol != null ? s.vol : 0.3) * o.v });
}
export function N(o, dt, s) {
  return noise(o.E, o.ch, o.t + dt, { ...s, f: (s.f || 1000) * o.r, f2: s.f2 ? s.f2 * o.r : undefined, vol: (s.vol != null ? s.vol : 0.3) * o.v });
}
// 乐音（只随用户 pitch 移调，不加随机失谐，保证在调上）
export function Z(o, dt, m, vel, x = {}) { return I.zheng(o.E, o.ch, o.t + dt, m + o.p, { ...x, vel: vel * o.v }); }
export function Pp(o, dt, m, vel, x = {}) { return I.pipa(o.E, o.ch, o.t + dt, m + o.p, { ...x, vel: vel * o.v }); }
export function Q(o, dt, m, vel, x = {}) { return I.qin(o.E, o.ch, o.t + dt, m + o.p, { ...x, vel: vel * o.v }); }
export function B(o, dt, m, kind, vel, x = {}) { return I.bell(o.E, o.ch, o.t + dt, m + o.p, { ...x, kind, vel: vel * o.v }); }
export function P(o, dt, name, vel, rate = 1, x = {}) { return I.perc(o.E, o.ch, o.t + dt, name, { ...x, vel: vel * o.v, rate: rate * o.r }); }
export function G(o, dt, lo, hi, dur, vel, x = {}) { // 五声刮奏（D 宫）
  return I.gliss(o.E, o.ch, o.t + dt, lo + o.p, hi + o.p, dur, (m) => [0, 2, 4, 7, 9].includes((((m - o.p - BASE) % 12) + 12) % 12), { vel: vel * o.v, ...x });
}

// 预计算效果缓冲（每种 3 个变体）
const FX = {
  crackle: [crackleData, { len: 0.7, count: 55, hp: 1500, front: 1.6, body: 0.5, bodyDec: 0.18 }],
  crackleS: [crackleData, { len: 0.35, count: 26, hp: 1800, front: 1.8 }],
  pour: [bubbleData, { len: 0.9, count: 38, fLo: 350, fHi: 1100, noise: 0.25, nF: 1200 }],
  drops: [bubbleData, { len: 0.5, count: 9, fLo: 600, fHi: 1600, front: 1.5 }],
  shatter: [shatterData, { len: 0.8, count: 16, fLo: 2600, fHi: 7000 }],
  scurry: [clicksData, { len: 0.36, count: 14, fLo: 2400, fHi: 4200, dec: 0.004, tick: 0.5, env: true, hp: 1200 }],
  rattle: [clicksData, { len: 0.45, count: 12, fLo: 900, fHi: 1700, dec: 0.012, tick: 0.35, jitter: 0.9 }],
  chitter: [chitterData, { len: 0.28, f: 3200, am: 34, syl: 3 }],
  step: [stepData, { len: 0.1, grit: 1, lp: 2200 }],
};
export function F(o, dt, name, vel, rate = 1, d) {
  const def = FX[name] || FX.crackleS, v = (Math.random() * 3) | 0;
  const buf = getBuf(o.E, 'fx:' + name + ':' + v, (sr) => def[0](sr, def[1], 31 + v * 977));
  return playBuf(o.E, o.ch, o.t + dt, buf, { rate: rate * o.r, vol: vel * o.v, d });
}
export const FX_NAMES = Object.keys(FX);

// 声像声道（按 0.1 量化缓存，避免每次新建节点）
export function panCh(E, pan) {
  const k = Math.round(clamp(pan, -1, 1) * 10);
  if (!k) return E.sfxCh;
  if (!E.panCh) E.panCh = new Map();
  let c = E.panCh.get(k);
  if (!c) { c = makeChannel(E, E.bus.sfx, { pan: k / 10, send: 0.14 }); E.panCh.set(k, c); }
  return c;
}
export function ctxOf(E, t, opts = {}, ch) {
  const p = Number.isFinite(+opts.pitch) ? +opts.pitch : 0;
  const v = opts.vol != null && Number.isFinite(+opts.vol) ? clamp(+opts.vol, 0, 2) : 1;
  return { E, t, ch: ch || (opts.pan ? panCh(E, +opts.pan || 0) : E.sfxCh), v, p, r: Math.pow(2, p / 12) * rnd(0.975, 1.025), note: opts.note, combo: opts.combo };
}
