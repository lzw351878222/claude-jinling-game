// 金陵寻踪 · 音频引擎核心 —— 与上下文无关（实时 AudioContext 或离线 OfflineAudioContext 通用）
// 负责：总线/混响/限幅器、复音管理（上限+抢占最旧+按归属批量停止）、基础合成原语、预计算缓冲缓存。
import { mtof } from './dsp.js';
export { mtof };
export const PENTA = [0, 2, 4, 7, 9]; // 宫 商 角 徵 羽（相对宫音的半音数）
export const MAX_VOICES = 48;
export const DEFAULT_VOL = { master: 0.9, music: 0.55, sfx: 0.8, ambient: 0.6 };
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// 五声音阶级数 → MIDI（base 为宫音；级数可为负或超过 4）
export function pentaMidi(base, deg) {
  const o = Math.floor(deg / 5), i = ((deg % 5) + 5) % 5;
  return base + 12 * o + PENTA[i];
}

function makeNoise(ctx, sec) {
  const sr = ctx.sampleRate, n = Math.floor(sr * sec);
  const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// 程序生成的立体声混响脉冲：指数衰减噪声，随时间变暗（高频先衰），附少量早期反射
function makeIR(ctx, sec) {
  const sr = ctx.sampleRate, n = Math.floor(sr * sec);
  const b = ctx.createBuffer(2, n, sr);
  const pre = Math.floor(sr * 0.016);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const x = (i - pre) / (n - pre);
      const k = 0.3 + 0.6 * x;
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = lp * Math.sqrt((1 + k) / (1 - k)) * Math.exp(-x * 5.5) * (1 - x);
    }
    for (let r = 0; r < 7; r++) {
      const at = pre + Math.floor(sr * (0.006 + r * 0.009 + Math.random() * 0.008));
      if (at < n) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.45 - r * 0.05);
    }
  }
  return b;
}

export function createEngine(ctx, vols = DEFAULT_VOL) {
  const E = { ctx, voices: [], cache: new Map(), bus: {}, psr: Math.min(32000, ctx.sampleRate) };
  E.master = ctx.createGain();
  E.master.gain.value = vols.master;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -10; lim.knee.value = 3; lim.ratio.value = 18;
  lim.attack.value = 0.0015; lim.release.value = 0.16;
  E.limiter = lim;
  E.out = ctx.createGain();
  E.out.gain.value = 0.8;
  E.master.connect(lim); lim.connect(E.out); E.out.connect(ctx.destination);
  E.reverb = ctx.createConvolver();
  try { E.reverb.buffer = makeIR(ctx, 2.6); } catch (e) { /* 旧浏览器忽略 */ }
  E.revOut = ctx.createGain();
  E.revOut.gain.value = 1;
  E.reverb.connect(E.revOut); E.revOut.connect(E.master);
  for (const name of ['music', 'sfx', 'ambient']) {
    const dry = ctx.createGain(), wet = ctx.createGain(), dd = ctx.createGain(), dw = ctx.createGain();
    dry.gain.value = wet.gain.value = vols[name];
    dry.connect(dd); dd.connect(E.master);
    wet.connect(dw); dw.connect(E.reverb);
    E.bus[name] = { dry, wet, vol: [dry.gain, wet.gain], duck: [dd.gain, dw.gain] };
  }
  E.noise = makeNoise(ctx, 3);
  E.sfxCh = makeChannel(E, E.bus.sfx, { send: 0.14 });
  E.sfxDry = makeChannel(E, E.bus.sfx, { send: 0.03 });
  return E;
}

// 声道条：输入 →（EQ 链）→（声像）→ 干路；并按 send 送混响。o: {pan, send, gain, eq:[[type,f,q,gainDb]], owner}
export function makeChannel(E, target, o = {}) {
  const c = E.ctx, nodes = [];
  const inp = c.createGain();
  inp.gain.value = o.gain != null ? o.gain : 1;
  nodes.push(inp);
  let node = inp;
  for (const [type, f, q, g] of o.eq || []) {
    const b = c.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; if (g) b.gain.value = g;
    node.connect(b); node = b; nodes.push(b);
  }
  if (o.pan && c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = clamp(o.pan, -1, 1);
    node.connect(p); node = p; nodes.push(p);
  }
  node.connect(target.dry);
  if (o.send > 0) {
    const s = c.createGain();
    s.gain.value = o.send;
    node.connect(s); s.connect(target.wet); nodes.push(s);
  }
  return {
    in: inp, owner: o.owner || null,
    disconnect() { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } } },
  };
}

function killVoice(v, t) {
  try {
    const g = v.g.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, 0.005); // 约 30ms 淡出（无爆音）后停止
  } catch (e) { /* */ }
  for (const s of v.srcs) { try { s.stop(t + 0.035); } catch (e) { /* */ } }
  v.end = Math.min(v.end, t + 0.035);
}

export function sweepVoices(E) {
  const now = E.ctx.currentTime, vs = E.voices;
  for (let i = vs.length - 1; i >= 0; i--) if (vs[i].end < now - 0.1) vs.splice(i, 1);
}
export function killOwner(E, owner, t = E.ctx.currentTime) {
  for (const v of E.voices) if (v.owner === owner && v.end > t && !v.killed) { v.killed = true; killVoice(v, t); }
}
// 正在发声的复音数（已开始且未结束）；scheduled 为前瞻窗口内已排程、尚未开始的
export function activeVoices(E) {
  const now = E.ctx.currentTime;
  let n = 0;
  for (const v of E.voices) if (v.end > now && v.t0 <= now) n++;
  return n;
}
export function cacheBytes(E) {
  let b = 0;
  for (const buf of E.cache.values()) b += buf.length * buf.numberOfChannels * 4;
  return b;
}

// 注册复音：srcs 为声源（都在 end 停止），g 为输出增益（抢占时淡出），nodes 在结束后断开。
// 上限按"与新音开始时刻 t0 重叠的复音数"计算（实时与离线渲染都适用），超限时淡出最旧的。
export function addVoice(E, srcs, g, nodes, t0, end, owner = null) {
  const vs = E.voices;
  if (vs.length >= MAX_VOICES) sweepVoices(E);
  if (vs.length >= MAX_VOICES) {
    let live = 0;
    for (const v of vs) if (v.end > t0) live++;
    for (let i = 0; i < vs.length && live >= MAX_VOICES; i++) {
      const old = vs[i];
      if (old.end > t0 && !old.killed) { old.killed = true; killVoice(old, Math.max(E.ctx.currentTime, Math.min(t0, old.end))); live--; }
    }
  }
  const v = { srcs, g, t0, end, owner, killed: false };
  vs.push(v);
  for (const s of srcs) { try { s.stop(end); } catch (e) { /* */ } }
  srcs[0].onended = () => {
    for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } }
    const i = vs.indexOf(v);
    if (i >= 0) vs.splice(i, 1);
  };
  return v;
}

const dst = (ch) => (ch && ch.in) || ch;
const own = (ch) => (ch && ch.owner) || null;

// 在 t 时刻冻结参数的当前值（打断进行中的渐变而不跳变）
export function holdParam(param, t) {
  if (param.cancelAndHoldAtTime) { try { param.cancelAndHoldAtTime(t); return; } catch (e) { /* */ } }
  const v = param.value;
  param.cancelScheduledValues(t);
  param.setValueAtTime(v, t);
}

// 包络：a 线性起音到 peak，然后 d（≈-60dB 所需时间）指数衰减
// 注意：先把默认值设为 0 —— GainNode 默认增益为 1，若声源首帧因取整早于第一个自动化事件，会漏出一个满幅采样（爆音）
export function envAD(param, t, a, peak, d) {
  param.value = 0;
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setTargetAtTime(0, t + a, Math.max(0.003, d / 6.9));
}
// 持续音：a 起音，保持到 t+hold，r 释放
export function envASR(param, t, a, peak, hold, r) {
  const h = Math.max(a, hold);
  param.value = 0;
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setValueAtTime(peak, t + h);
  param.setTargetAtTime(0, t + h, Math.max(0.004, r / 6.9));
}

// 振荡器单音。o: {type, wave(PeriodicWave), f, f2, glide, a, d, vol, detune, hold, r, vib:[音分, Hz, 延迟], flt:[type,f,q,f2,glide]}
export function osc(E, ch, t, o) {
  const c = E.ctx;
  const n = c.createOscillator(), g = c.createGain();
  if (o.wave) n.setPeriodicWave(o.wave); else n.type = o.type || 'sine';
  n.frequency.setValueAtTime(o.f, t);
  if (o.f2) n.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || 0.1));
  if (o.detune) n.detune.setValueAtTime(o.detune, t);
  const a = o.a != null ? o.a : 0.004, vol = o.vol != null ? o.vol : 0.3;
  let end;
  if (o.hold != null) {
    const r = o.r || 0.2;
    envASR(g.gain, t, a, vol, o.hold, r); end = t + Math.max(a, o.hold) + r * 1.1 + 0.02;
    if (o.vib) { // o.vib = [音分深度, 频率Hz, 延迟秒]
      const dur = Math.max(0.05, end - t - 0.01);
      try { n.detune.setValueCurveAtTime(vibCurve(dur, o.vib[0], o.vib[1], o.vib[2] != null ? o.vib[2] : 0.25, o.detune || 0), t + 0.001, dur); } catch (e) { /* */ }
    }
  } else { const d = o.d || 0.3; envAD(g.gain, t, a, vol, d); end = t + a + d + 0.02; }
  const nodes = [n, g];
  if (o.flt) { // o.flt = [type, f, q, f2, glide]
    const b = c.createBiquadFilter();
    b.type = o.flt[0]; b.frequency.setValueAtTime(o.flt[1], t); b.Q.value = o.flt[2] || 0.7;
    if (o.flt[3]) b.frequency.exponentialRampToValueAtTime(o.flt[3], t + (o.flt[4] || 0.2));
    n.connect(b); b.connect(g); nodes.push(b);
  } else n.connect(g);
  g.connect(dst(ch));
  n.start(t);
  addVoice(E, [n], g, nodes, t, end, own(ch));
  return { osc: n, gain: g, end };
}

// 滤波噪声。o: {type, f, f2, glide, q, a, d, vol, hold, r, rate}
export function noise(E, ch, t, o) {
  const c = E.ctx;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = E.noise; s.loop = true;
  if (o.rate) s.playbackRate.value = o.rate;
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.f || 1000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.glide || 0.2));
  f.Q.value = o.q != null ? o.q : 1;
  const a = o.a != null ? o.a : 0.003, vol = o.vol != null ? o.vol : 0.3;
  let end;
  if (o.hold != null) { const r = o.r || 0.2; envASR(g.gain, t, a, vol, o.hold, r); end = t + Math.max(a, o.hold) + r * 1.1 + 0.02; }
  else { const d = o.d || 0.2; envAD(g.gain, t, a, vol, d); end = t + a + d + 0.02; }
  s.connect(f); f.connect(g); g.connect(dst(ch));
  s.start(t, Math.random() * 2.5);
  addVoice(E, [s], g, [s, f, g], t, end, own(ch));
  return { filter: f, gain: g, end };
}

// 预计算缓冲（按 key 缓存，LRU 淘汰，总量不超过 CACHE_BUDGET）：make(sr) → Float32Array
export const CACHE_BUDGET = 16 * 1048576;
export function getBuf(E, key, make, sr = E.psr) {
  let b = E.cache.get(key);
  if (b) { E.cache.delete(key); E.cache.set(key, b); return b; } // 标记为最近使用
  const data = make(sr);
  b = E.ctx.createBuffer(1, Math.max(1, data.length), sr);
  if (b.copyToChannel) b.copyToChannel(data, 0); else b.getChannelData(0).set(data);
  E.cache.set(key, b);
  E.cacheBytes = (E.cacheBytes || 0) + b.length * 4;
  while (E.cacheBytes > CACHE_BUDGET && E.cache.size > 1) { // 淘汰最久未用的（正在播放的声源仍持有引用，不受影响）
    const [k0, b0] = E.cache.entries().next().value;
    E.cache.delete(k0);
    E.cacheBytes -= b0.length * 4;
  }
  return b;
}

// 播放缓冲。o: {rate, vol, a, d(提前闷音), bend:[比例, 延迟, 时长], vib:[音分, Hz], twang}
export function playBuf(E, ch, t, buf, o = {}) {
  const c = E.ctx;
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = buf;
  const rate = o.rate || 1, pr = s.playbackRate;
  const len = buf.duration / rate;
  let end = t + len;
  if (o.d && o.d < len) end = t + o.d + 0.03;
  if (o.twang) { pr.setValueAtTime(rate * (1 + o.twang), t); pr.setTargetAtTime(rate, t, 0.02); }
  else pr.setValueAtTime(rate, t);
  if (o.bend) pr.setTargetAtTime(rate * o.bend[0], t + o.bend[1], Math.max(0.01, o.bend[2] / 3));
  else if (o.vib) { // o.vib = [音分深度, 频率Hz]（揉弦）
    const dur = Math.max(0.05, end - t - 0.13);
    try { pr.setValueCurveAtTime(vibCurve(dur, o.vib[0], o.vib[1], 0.08, rate, true), t + 0.12, dur); } catch (e) { /* */ }
  }
  const vol = o.vol != null ? o.vol : 0.5;
  g.gain.value = 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.0015));
  if (o.d && o.d < len) g.gain.setTargetAtTime(0, t + o.d * 0.55, o.d * 0.065);
  s.connect(g); g.connect(dst(ch));
  s.start(t);
  addVoice(E, [s], g, [s, g], t, end, own(ch));
  return s;
}

// 颤音曲线（音分或比例）：delay 秒后渐入，rate Hz，depth 深度；用于 detune / playbackRate 的 setValueCurveAtTime
export function vibCurve(dur, depth, rate = 5.5, delay = 0.25, base = 0, ratio = false) {
  const n = Math.max(4, Math.min(2000, Math.ceil(dur * 60)));
  const c = new Float32Array(n), ph = Math.random() * 6.28, r = rate * (0.93 + Math.random() * 0.14);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * dur;
    const w = t < delay ? 0 : Math.min(1, (t - delay) / 0.35);
    const v = Math.sin(ph + 2 * Math.PI * r * t) * depth * w;
    c[i] = ratio ? base * Math.pow(2, v / 1200) : base + v;
  }
  return c;
}
