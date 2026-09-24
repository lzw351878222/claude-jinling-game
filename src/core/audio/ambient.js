// 金陵寻踪 · 环境声床：连续层（循环噪声 + 滤波 + 超低频调制）+ 随机事件（虫鸣、噼啪、敲凿、翻书…）
import { makeChannel, killOwner, rnd, getBuf, noise, osc, holdParam } from './engine.js';
import { perc, bell } from './inst.js';
import { seeded, biquad, finish } from './dsp.js';
import { bubbleData, crackleData } from './dsp2.js';

export const AMB_IDS = ['wind', 'river', 'crowd', 'fire', 'sea', 'night', 'rain', 'library', 'construction'];

// 首尾交叉淡化成可无缝循环的缓冲
function loopify(d, ov) {
  const n = d.length - ov, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = d[i];
  for (let i = 0; i < ov; i++) { const w = i / ov; out[i] = d[i] * Math.sqrt(w) + d[n + i] * Math.sqrt(1 - w); }
  return out;
}
// 蟋蟀：每声 3–4 个 4–5kHz 短脉冲，周期性鸣叫
function cricketData(sr, o, seed) {
  const r = seeded(seed), n = Math.floor(sr * o.len), ov = Math.floor(sr * 0.05), d = new Float32Array(n + ov);
  for (let t0 = r() * 0.2; t0 < o.len; t0 += o.period * (0.9 + r() * 0.2)) {
    const f = o.f * (1 + (r() - 0.5) * 0.02), pulses = 3 + (r() < 0.5 ? 1 : 0);
    for (let p = 0; p < pulses; p++) {
      const at = Math.floor((t0 + p * 0.034) * sr), len = Math.floor(sr * 0.018), w = 2 * Math.PI * f / sr;
      for (let i = 0; i < len && at + i < d.length; i++) d[at + i] += Math.sin(w * i) * Math.sin(Math.PI * i / len) * (0.7 + 0.3 * r());
    }
  }
  return loopify(d, ov);
}
const TEX = {
  babble: (sr, s) => loopify(bubbleData(sr, { len: 3.35, count: 80, fLo: 280, fHi: 950, rise: 2 }, s), Math.floor(sr * 0.2)),
  crackles: (sr, s) => loopify(crackleData(sr, { len: 3.75, count: 70, hp: 1400, front: 1 }, s), Math.floor(sr * 0.1)),
  drops: (sr, s) => { const d = bubbleData(sr, { len: 2.9, count: 150, fLo: 1800, fHi: 5200, rise: 1 }, s); biquad(d, sr, 'highpass', 1200, 0.7); return loopify(finish(d, sr, 0.9), Math.floor(sr * 0.1)); },
  cricketA: (sr, s) => cricketData(sr, { len: 2.3, period: 0.58, f: 4550 }, s),
  cricketB: (sr, s) => cricketData(sr, { len: 3.1, period: 0.83, f: 3980 }, s),
};

export class Ambience {
  constructor(E, id, vol) {
    const c = E.ctx;
    this.E = E; this.id = id; this.vol = vol; this.stopAt = null; this.srcs = []; this.nodes = [];
    this.def = AMBS[id] || AMBS.wind;
    this.g = c.createGain(); this.g.gain.value = 0; this.g.connect(E.bus.ambient.dry);
    this.w = c.createGain(); this.w.gain.value = 0; this.w.connect(E.bus.ambient.wet);
    this.ch = makeChannel(E, { dry: this.g, wet: this.w }, { send: this.def.send != null ? this.def.send : 0.15, owner: this });
    this.pans = new Map();
    this.next = 0;
    this.rng = seeded((Math.random() * 1e9) | 0);
    try { this.def.setup(this); } catch (e) { /* */ }
  }
  pch(pan) { // 事件用的声像声道
    const k = Math.round(pan * 5);
    let c = this.pans.get(k);
    if (!c) { c = makeChannel(this.E, { dry: this.g, wet: this.w }, { pan: k / 5, send: this.def.send != null ? this.def.send + 0.1 : 0.25, owner: this }); this.pans.set(k, c); }
    return c;
  }
  // 连续层：循环噪声 → 滤波 → 增益（→ 声像），可选对频率/增益的超低频正弦调制
  layer(o) {
    const c = this.E.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.E.noise; s.loop = true; s.playbackRate.value = o.rate || 1;
    f.type = o.type || 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q != null ? o.q : 0.7;
    g.gain.value = o.gain;
    s.connect(f); f.connect(g);
    let out = g;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; this.nodes.push(p); }
    out.connect(this.ch.in);
    for (const [key, param] of [['lfoF', f.frequency], ['lfoG', g.gain]]) {
      if (!o[key]) continue;
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o[key][0] * (0.9 + Math.random() * 0.2); lg.gain.value = o[key][1];
      l.connect(lg); lg.connect(param); l.start(); this.srcs.push(l); this.nodes.push(l, lg);
    }
    s.start(0, Math.random() * 2.5);
    this.srcs.push(s); this.nodes.push(s, f, g);
    return { src: s, filter: f, gain: g };
  }
  // 预计算纹理循环（河水咕嘟、火噼啪、雨滴、蟋蟀）
  loop(tex, gain, o = {}) {
    const E = this.E, c = E.ctx, v = o.v || 0;
    const buf = getBuf(E, 'amb:' + tex + ':' + v, (sr) => TEX[tex](sr, 97 + v * 31), Math.min(32000, c.sampleRate));
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; s.loop = true; s.playbackRate.value = o.rate || 1; g.gain.value = gain;
    s.connect(g);
    let out = g;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; this.nodes.push(p); }
    out.connect(this.ch.in);
    s.start(0, Math.random() * buf.duration);
    this.srcs.push(s); this.nodes.push(s, g);
    return { src: s, gain: g };
  }
  level() { return (this.def.level || 1) * this.vol; }
  start(t, fade) {
    for (const g of [this.g.gain, this.w.gain]) { g.setValueAtTime(0, t); g.linearRampToValueAtTime(this.level(), t + fade); }
    this.next = t + rnd(0.3, 1.5);
  }
  setVol(v, t) { this.vol = v; for (const g of [this.g.gain, this.w.gain]) { holdParam(g, t); g.setTargetAtTime(this.level(), t, 0.25); } }
  stop(t, fade) {
    this.stopAt = t + fade;
    for (const g of [this.g.gain, this.w.gain]) { holdParam(g, t); g.linearRampToValueAtTime(0, t + fade); }
  }
  tick(now, horizon) {
    if (!this.def.ev || (this.stopAt != null && now > this.stopAt)) return;
    if (this.next < now - 0.5) this.next = now + 0.1; // 跳过错过的事件
    let guard = 0;
    while (this.next < horizon && guard++ < 16) { let dt = 1; try { dt = this.def.ev(this, this.next); } catch (e) { /* */ } this.next += Math.max(0.05, dt || 1); }
  }
  dispose() {
    killOwner(this.E, this);
    for (const s of this.srcs) { try { s.stop(); } catch (e) { /* */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* */ } }
    this.ch.disconnect();
    for (const c of this.pans.values()) c.disconnect();
    try { this.g.disconnect(); this.w.disconnect(); } catch (e) { /* */ }
  }
}

const swell = (param, t, peak, up, hold, down) => { param.setTargetAtTime(peak, t, up / 3); param.setTargetAtTime(0, t + up + hold, down / 3); };

const AMBS = {
  wind: {
    level: 0.6, send: 0.1,
    setup(a) {
      a.layer({ f: 420, q: 0.6, gain: 0.45, rate: 0.8, lfoF: [0.05, 200], lfoG: [0.09, 0.2] });
      a.layer({ f: 1150, q: 7, gain: 0.05, pan: 0.3, lfoF: [0.07, 320], lfoG: [0.13, 0.04] });
      a.gust = a.layer({ type: 'lowpass', f: 700, q: 0.5, gain: 0, pan: -0.25, rate: 0.9 });
    },
    ev(a, t) {
      const up = rnd(0.8, 2.2);
      swell(a.gust.gain.gain, t, rnd(0.2, 0.45), up, rnd(0.4, 2), rnd(1.5, 3));
      a.gust.filter.frequency.setTargetAtTime(rnd(500, 1300), t, up / 2);
      return rnd(5, 11);
    },
  },
  river: {
    level: 0.4, send: 0.12,
    setup(a) {
      a.layer({ f: 1300, q: 0.5, gain: 0.28, lfoG: [0.21, 0.06] });
      a.layer({ type: 'lowpass', f: 380, q: 0.7, gain: 0.4, rate: 0.7, lfoG: [0.11, 0.1] });
      a.loop('babble', 0.5, { pan: -0.35 });
      a.loop('babble', 0.4, { rate: 0.84, pan: 0.35, v: 1 });
    },
  },
  crowd: {
    level: 1.0, send: 0.25,
    setup(a) {
      a.m1 = a.layer({ f: 520, q: 1.3, gain: 0.22, pan: -0.45 });
      a.m2 = a.layer({ f: 950, q: 1.6, gain: 0.15, pan: 0.45, rate: 0.9 });
      a.m3 = a.layer({ f: 1900, q: 2, gain: 0.05, rate: 1.1 });
      a.layer({ type: 'lowpass', f: 260, gain: 0.22 });
    },
    ev(a, t) {
      for (const m of [a.m1, a.m2, a.m3]) {
        m.gain.gain.setTargetAtTime(rnd(0.06, 0.32) * (m === a.m3 ? 0.35 : 1), t, rnd(0.25, 0.8));
        m.filter.frequency.setTargetAtTime(m === a.m3 ? rnd(1500, 2600) : rnd(380, 1150), t, rnd(0.2, 0.6));
      }
      if (a.rng() < 0.12) perc(a.E, a.pch(rnd(-0.8, 0.8)), t + rnd(0, 0.5), a.rng() < 0.5 ? 'bang' : 'muyu', { vel: rnd(0.05, 0.12), rate: rnd(0.8, 1.3) });
      return rnd(0.5, 1.6);
    },
  },
  fire: {
    level: 0.8, send: 0.1,
    setup(a) {
      a.layer({ type: 'lowpass', f: 170, q: 0.8, gain: 0.55, lfoG: [0.31, 0.18] });
      a.layer({ f: 650, q: 0.7, gain: 0.08, lfoF: [0.17, 220], lfoG: [0.23, 0.04] });
      a.loop('crackles', 0.32);
    },
    ev(a, t) { // 偶尔一声大的爆裂
      if (a.rng() < 0.6) noise(a.E, a.pch(rnd(-0.5, 0.5)), t, { type: 'highpass', f: rnd(1500, 3500), a: 0.001, d: rnd(0.01, 0.04), vol: rnd(0.08, 0.25) });
      return rnd(0.3, 1.8);
    },
  },
  sea: {
    level: 0.62, send: 0.15,
    setup(a) {
      a.layer({ type: 'lowpass', f: 280, gain: 0.3, lfoG: [0.07, 0.1] });
      a.wave = a.layer({ type: 'lowpass', f: 420, q: 0.5, gain: 0, pan: -0.15 });
      a.foam = a.layer({ type: 'highpass', f: 2600, gain: 0, pan: 0.2, rate: 1.1 });
    },
    ev(a, t) { // 一道浪：涨起 → 拍岸（泡沫）→ 退去
      const T = rnd(5.5, 9.5), up = T * rnd(0.35, 0.5);
      swell(a.wave.gain.gain, t, rnd(0.45, 0.75), up, 0.3, T * 0.45);
      a.wave.filter.frequency.setTargetAtTime(rnd(900, 1500), t, up / 3);
      a.wave.filter.frequency.setTargetAtTime(420, t + up + 0.3, T * 0.15);
      swell(a.foam.gain.gain, t + up * 0.85, rnd(0.08, 0.16), 0.4, 0.3, T * 0.35);
      return T;
    },
  },
  night: {
    level: 0.7, send: 0.2,
    setup(a) {
      a.layer({ type: 'lowpass', f: 300, gain: 0.12, lfoG: [0.05, 0.04] });
      a.loop('cricketA', 0.2, { pan: -0.55 });
      a.loop('cricketB', 0.15, { pan: 0.5, v: 1 });
    },
    ev(a, t) { // 远处的第三只虫偶尔加入
      const f = rnd(5200, 6000), ch = a.pch(rnd(-0.9, 0.9)), n = 2 + ((a.rng() * 4) | 0);
      for (let i = 0; i < n; i++) osc(a.E, ch, t + i * 0.09, { f, a: 0.005, d: 0.05, vol: 0.012 });
      return rnd(2.5, 7);
    },
  },
  rain: {
    level: 0.3, send: 0.1,
    setup(a) {
      a.layer({ type: 'highpass', f: 1300, gain: 0.22, lfoG: [0.11, 0.04] });
      a.layer({ f: 5200, q: 0.5, gain: 0.1, rate: 1.05 });
      a.layer({ type: 'lowpass', f: 420, gain: 0.25, rate: 0.9 });
      a.loop('drops', 0.28);
    },
  },
  library: {
    level: 1.0, send: 0.35,
    setup(a) { a.layer({ type: 'lowpass', f: 200, gain: 0.12 }); a.layer({ f: 2400, q: 0.5, gain: 0.006 }); },
    ev(a, t) { // 偶尔翻书；更少见的是远处木鱼/磬
      const ch = a.pch(rnd(-0.7, 0.7)), r = a.rng();
      if (r < 0.75) {
        noise(a.E, ch, t, { f: rnd(2200, 3200), f2: rnd(3500, 4500), glide: 0.08, q: 0.7, a: 0.01, d: 0.09, vol: 0.05 });
        noise(a.E, ch, t + rnd(0.05, 0.09), { f: rnd(3000, 3800), f2: 1500, glide: 0.15, q: 0.6, a: 0.015, d: 0.16, vol: 0.04 });
      } else if (r < 0.9) perc(a.E, ch, t, 'muyu', { vel: 0.05, rate: rnd(0.8, 1) });
      else bell(a.E, ch, t, 74, { kind: 'qing', vel: 0.05 });
      return rnd(6, 16);
    },
  },
  construction: {
    level: 1.0, send: 0.4,
    setup(a) { a.layer({ type: 'lowpass', f: 330, gain: 0.14, lfoG: [0.07, 0.05] }); a.layer({ f: 900, q: 0.6, gain: 0.025, lfoF: [0.05, 300] }); },
    ev(a, t) { // 远处一位匠人：一阵敲打（2–6 下）后停顿
      const n = 2 + ((a.rng() * 5) | 0), sp = rnd(0.38, 0.62), ch = a.pch(rnd(-0.8, 0.8)), chisel = a.rng() < 0.45, rate = rnd(0.8, 1.15);
      for (let i = 0; i < n; i++) {
        const tt = t + i * sp + rnd(-0.02, 0.02), v = rnd(0.6, 1);
        if (chisel) { perc(a.E, ch, tt, 'chisel', { vel: 0.1 * v, rate }); perc(a.E, ch, tt, 'thud', { vel: 0.06 * v, rate: 1.4 }); }
        else { perc(a.E, ch, tt, 'thud', { vel: 0.2 * v, rate: 0.75 * rate }); perc(a.E, ch, tt, 'rim', { vel: 0.05 * v, rate: 0.7 }); }
      }
      return n * sp + rnd(1.2, 4.5);
    },
  },
};
