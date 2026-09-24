// 金陵寻踪 · 预计算效果声（纯 JS）：噼啪、气泡/倒水、水花、碎裂、细碎脚步/摇动、虫鸣唧唧、脚步
import { seeded, biquad, finish } from './dsp.js';

// 噼啪（火焰、烟花爆开）：稀疏随机脉冲（幂律幅度）+ 可选低频"噗"
export function crackleData(sr, o, seed = 1) {
  const r = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  for (let k = 0; k < o.count; k++) {
    const at = Math.floor(Math.pow(r(), o.front || 1) * (n - sr * 0.01));
    const amp = Math.pow(r(), 2.2) * (0.4 + 0.6 * r()), len = Math.floor(sr * (0.0005 + r() * 0.003));
    for (let i = 0; i < len && at + i < n; i++) d[at + i] += (r() * 2 - 1) * amp * Math.exp(-i / (len * 0.3));
  }
  biquad(d, sr, 'highpass', o.hp || 1200, 0.7);
  if (o.body) {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, env = Math.min(1, t / 0.015) * Math.exp(-t / o.bodyDec);
      lp += (r() * 2 - 1 - lp) * 0.04;
      d[i] += lp * env * o.body * 6;
    }
  }
  return finish(d, sr, 0.9, 0.0005, 0.03);
}

// 气泡（倒水、水花里的水滴）：上扬正弦啾声 + 可选带通噪声底
export function bubbleData(sr, o, seed = 1) {
  const r = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  for (let k = 0; k < o.count; k++) {
    const at = Math.floor(Math.pow(r(), o.front || 1) * n * 0.9), f0 = o.fLo + r() * (o.fHi - o.fLo);
    const tau = 0.012 + r() * 0.03, amp = 0.3 + r() * 0.7, len = Math.floor(sr * tau * 6);
    let ph = 0;
    for (let i = 0; i < len && at + i < n; i++) {
      const t = i / sr;
      ph += 2 * Math.PI * f0 * (1 + (o.rise || 2.5) * t / tau * 0.3) / sr;
      d[at + i] += Math.sin(ph) * amp * Math.exp(-t / tau) * Math.min(1, i / (sr * 0.001));
    }
  }
  if (o.noise) {
    const nz = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / n; nz[i] = (r() * 2 - 1) * Math.sin(Math.PI * Math.min(1, t * 1.2)) * o.noise; }
    biquad(nz, sr, 'bandpass', o.nF || 1500, 0.8);
    for (let i = 0; i < n; i++) d[i] += nz[i];
  }
  return finish(d, sr, 0.9, 0.002, 0.05);
}

// 碎裂（瓷器/琉璃）：冲击噪声 + 若干高频随机"叮"
export function shatterData(sr, o, seed = 1) {
  const r = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.exp(-i / (sr * 0.06)) * 0.8;
  biquad(d, sr, 'highpass', 1800, 0.7);
  for (let k = 0; k < o.count; k++) {
    const at = Math.floor(Math.pow(r(), 1.8) * n * 0.6), f = o.fLo + r() * (o.fHi - o.fLo), dec = 0.03 + r() * 0.15, amp = 0.2 + r() * 0.5;
    const w = 2 * Math.PI * f / sr, w2 = w * (2.3 + r() * 0.6);
    for (let i = 0; at + i < n && i < sr * dec * 5; i++) d[at + i] += (Math.sin(w * i) + 0.4 * Math.sin(w2 * i)) * amp * Math.exp(-i / (sr * dec));
  }
  return finish(d, sr, 0.9, 0.0005, 0.05);
}

// 一串短促"嗒"声（细脚跑动、牌面摇动/洗牌）：每下为模态叮 + 噪声尖
export function clicksData(sr, o, seed = 1) {
  const r = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  for (let k = 0; k < o.count; k++) {
    const at = Math.floor((k / o.count + (r() - 0.5) * (o.jitter || 0.6) / o.count) * n * 0.92);
    if (at < 0) continue;
    const f = o.fLo + r() * (o.fHi - o.fLo), dec = o.dec * (0.6 + r() * 0.8), amp = (0.4 + r() * 0.6) * (o.env ? Math.sin(Math.PI * (k + 0.5) / o.count) : 1);
    const w = 2 * Math.PI * f / sr;
    for (let i = 0; at + i < n && i < sr * dec * 6; i++) d[at + i] += Math.sin(w * i) * amp * Math.exp(-i / (sr * dec)) + (i < sr * 0.0008 ? (r() * 2 - 1) * amp * o.tick : 0);
  }
  if (o.hp) biquad(d, sr, 'highpass', o.hp, 0.7);
  return finish(d, sr, 0.9, 0.0005, 0.02);
}

// 唧唧（衣鱼/虫子：可爱不恶心）：高频正弦 + 快速调幅音节
export function chitterData(sr, o, seed = 1) {
  const r = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  const syl = o.syl || 3;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, x = t / o.len;
    const s = Math.floor(x * syl), sx = x * syl - s;
    const f = o.f * (1 + 0.12 * Math.sin(2 * Math.PI * 7 * t) + 0.08 * s) * (1 + 0.1 * sx);
    ph += 2 * Math.PI * f / sr;
    const am = Math.pow(Math.max(0, Math.sin(2 * Math.PI * o.am * t)), 2);
    const env = Math.sin(Math.PI * sx) * (sx < 0.85 ? 1 : (1 - sx) / 0.15);
    d[i] = Math.sin(ph) * am * env * (0.8 + 0.2 * r());
  }
  return finish(d, sr, 0.9, 0.002, 0.02);
}

// 轻脚步：闷"嗒"（低通噪声）+ 少量沙砾声
export function stepData(sr, o, seed = 1) {
  const r = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = Math.min(1, t / 0.004) * Math.exp(-t / (0.018 + r() * 0.0005));
    lp += (r() * 2 - 1 - lp) * 0.08;
    d[i] = lp * env * 5;
  }
  for (let k = 0; k < 6; k++) {
    const at = Math.floor(r() * n * 0.6), len = Math.floor(sr * 0.002), amp = r() * 0.25 * o.grit;
    for (let i = 0; i < len && at + i < n; i++) d[at + i] += (r() * 2 - 1) * amp;
  }
  biquad(d, sr, 'lowpass', o.lp || 2500, 0.7);
  return finish(d, sr, 0.9, 0.0005, 0.02);
}
