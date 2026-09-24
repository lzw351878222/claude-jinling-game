// 金陵寻踪 · 纯 JS 预计算合成：弦（Karplus-Strong）、钟磬（加法合成）、打击乐 → AudioBuffer（按键缓存）
// 运行时每个音只需一个 BufferSource + 一个 Gain，适合与 WebGL 同跑的手机。
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function seeded(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// RBJ 双二阶滤波（原地处理）
export function biquad(d, sr, type, f, q = 0.707, gainDb = 0) {
  const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'bandpass') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; } // peaking
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
  }
  return d;
}

// 峰值归一化 + 首尾淡化（防爆音）
export function finish(d, sr, peak = 0.9, fadeIn = 0.001, fadeOut = 0.06) {
  let pk = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; }
  const k = pk > 1e-9 ? peak / pk : 0, n = d.length;
  const fi = Math.max(1, Math.floor(sr * fadeIn)), fo = Math.max(1, Math.floor(sr * fadeOut));
  for (let i = 0; i < n; i++) {
    let w = k;
    if (i < fi) w *= i / fi;
    if (i > n - fo) w *= (n - i) / fo;
    d[i] = Number.isFinite(d[i]) ? d[i] * w : 0;
  }
  return d;
}

// —— 拨弦 ——
// S: 环路低通（越小越亮）；t60lo/hi：低/高音区衰减；beta：拨弦位置；exLP：激励低通（越大越柔）；body：琴体共鸣
export const STRINGS = {
  zheng: { S: 0.4, t60lo: 3.4, t60hi: 1.5, beta: 0.12, exLP: 0.3, dur: 2.3, body: [[260, 1.1, 4], [1900, 1.4, 3], [4200, 1.2, 2]] },
  pipa: { S: 0.3, t60lo: 1.4, t60hi: 0.7, beta: 0.085, exLP: 0.15, dur: 1.5, body: [[420, 1.4, 5], [1300, 1.6, 5], [3000, 1.4, 3]] },
  qin: { S: 0.5, t60lo: 5.0, t60hi: 2.5, beta: 0.24, exLP: 0.62, dur: 2.9, body: [[140, 1.0, 5], [520, 1.2, 3]] },
};
export function stringData(sr, midi, kind, seed = 1) {
  const o = STRINGS[kind] || STRINGS.zheng, f = mtof(midi), rand = seeded(seed * 7919 + midi * 131);
  const x = Math.max(0, Math.min(1, (midi - 40) / 50));
  const t60 = o.t60lo + (o.t60hi - o.t60lo) * x;
  const dur = Math.min(o.dur, t60 * 0.85 + 0.25);
  const n = Math.floor(sr * dur), d = new Float32Array(n);
  const S = o.S, P = sr / f;
  let N = Math.floor(P - S - 0.25);
  if (N < 2) N = 2;
  const Dl = P - N - S, C = (1 - Dl) / (1 + Dl);
  const rho = Math.pow(10, -3 / (t60 * f));
  let lp = 0;
  for (let i = 0; i < N && i < n; i++) { lp += (rand() * 2 - 1 - lp) * (1 - o.exLP); d[i] = lp; }
  const pb = Math.max(1, Math.round(o.beta * N));
  for (let i = N - 1; i >= pb; i--) d[i] -= d[i - pb];
  let mean = 0;
  for (let i = 0; i < N; i++) mean += d[i];
  mean /= N;
  for (let i = 0; i < N; i++) d[i] -= mean;
  let ax = 0, ay = 0;
  for (let i = N; i < n; i++) {
    const v = (1 - S) * d[i - N] + S * (i > N ? d[i - N - 1] : 0);
    const ap = C * v + ax - C * ay;
    ax = v; ay = ap;
    d[i] = rho * ap;
  }
  for (const [bf, bq2, g] of o.body) biquad(d, sr, 'peaking', bf, bq2, g);
  biquad(d, sr, 'highpass', 55, 0.7);
  return finish(d, sr, 0.9, 0.0008, 0.12);
}

// —— 加法合成钟磬：parts = [[频率比, 幅度, T60秒, 拍频Hz]] ——
export const BELLS = {
  bell: [[1, 1, 2.4, 0.6], [2.76, 0.55, 1.2, 0.9], [5.4, 0.3, 0.6, 1.3], [8.93, 0.14, 0.3, 0]],
  chime: [[1, 1, 1.6, 0], [2.0, 0.25, 0.9, 0], [3.01, 0.3, 0.6, 0.7], [4.13, 0.12, 0.35, 0]],
  qing: [[1, 1, 7, 0.45], [2.71, 0.5, 3.2, 0.8], [5.13, 0.22, 1.4, 1.1], [8.21, 0.08, 0.6, 0]], // 磬 / 颂钵
  zhong: [[1, 1, 3.2, 0.35], [2.32, 0.45, 1.8, 0.5], [3.93, 0.3, 1.0, 0.9], [5.43, 0.16, 0.6, 0], [0.5, 0.25, 3.8, 0]], // 编钟
  glass: [[1, 1, 1.4, 0], [2.0, 0.4, 0.8, 0], [3.0, 0.18, 0.5, 0], [4.0, 0.06, 0.3, 0]], // 琴泛音 / 玻璃
  temple: [[0.5, 0.7, 6, 0.3], [1, 1, 5, 0.5], [1.19, 0.4, 3, 0], [1.5, 0.35, 2.5, 0.7], [2.0, 0.3, 2, 0], [2.52, 0.18, 1.3, 0], [3.1, 0.1, 0.8, 0]],
};
export function bellData(sr, f, kind, seed = 1) {
  const parts = BELLS[kind] || BELLS.bell, rand = seeded(seed * 104729 + Math.round(f));
  let maxT = 0;
  for (const p of parts) maxT = Math.max(maxT, p[2]);
  const dur = Math.min(4, maxT * 0.7 + 0.2), n = Math.floor(sr * dur), d = new Float32Array(n);
  const att = Math.floor(sr * 0.0015);
  for (const [ratio, amp, t60, beat] of parts) {
    const pf = f * ratio * (1 + (rand() - 0.5) * 0.004);
    if (pf > sr * 0.45) continue;
    const reps = beat ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      const ff = pf + (r ? beat : 0), w = 2 * Math.PI * ff / sr, k2 = 2 * Math.cos(w);
      let y1 = Math.sin(-w), y2 = Math.sin(-2 * w); // 递推正弦 y[n]=2cos(w)y[n-1]-y[n-2]，从相位 0 开始
      const dec = Math.pow(10, -3 / (t60 * sr));
      let a = amp / reps;
      for (let i = 0; i < n; i++) {
        const y = k2 * y1 - y2; y2 = y1; y1 = y;
        d[i] += y * a * (i < att ? i / att : 1);
        a *= dec;
        if (a < 1e-5) break;
      }
    }
  }
  return finish(d, sr, 0.85, 0.001, 0.1);
}

// —— 打击乐配方（全部确定性种子，可做多个变体）——
// 膜鸣：正弦扫频 + 低通噪声
export function drumData(sr, o, seed = 1) {
  const rand = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  let ph = 0, nl = 0;
  const tdrop = o.drop, att = Math.floor(sr * 0.001);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = o.f1 + (o.f0 - o.f1) * Math.exp(-t / tdrop);
    ph += 2 * Math.PI * f / sr;
    const body = Math.sin(ph) * Math.exp(-t / o.dec) + (o.h2 ? o.h2 * Math.sin(ph * 1.6) * Math.exp(-t / (o.dec * 0.4)) : 0);
    nl += (rand() * 2 - 1 - nl) * o.nLP;
    const nz = nl * o.noise * Math.exp(-t / o.nDec);
    d[i] = (body + nz) * (i < att ? i / att : 1);
  }
  if (o.hp) biquad(d, sr, 'highpass', o.hp, 0.7);
  return finish(d, sr, 0.9, 0.0005, 0.02);
}
// 模态（木鱼/梆子/砖石）：若干阻尼正弦 + 冲击噪声
export function modalData(sr, o, seed = 1) {
  const rand = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  for (const [ratio, amp, dec] of o.modes) {
    const w = 2 * Math.PI * o.f * ratio * (1 + (rand() - 0.5) * 0.01) / sr;
    if (o.f * ratio > sr * 0.45) continue;
    for (let i = 0; i < n; i++) d[i] += Math.sin(w * i) * amp * Math.exp(-i / (sr * dec));
  }
  const cl = Math.floor(sr * (o.clickLen || 0.004));
  for (let i = 0; i < cl && i < n; i++) d[i] += (rand() * 2 - 1) * (o.click || 0.3) * (1 - i / cl);
  if (o.bp) biquad(d, sr, 'peaking', o.bp, 2, 4);
  return finish(d, sr, 0.9, 0.0004, 0.01);
}
// 金属（锣/镲）：非谐分音（可滑音、可"开花"缓起）+ 带通噪声
export function metalData(sr, o, seed = 1) {
  const rand = seeded(seed), n = Math.floor(sr * o.len), d = new Float32Array(n);
  for (const [ratio, amp, t60, bloom] of o.parts) {
    const f0 = o.f * ratio;
    if (f0 * Math.max(1, o.glide || 1) > sr * 0.45) continue;
    let ph = rand() * 6.28;
    const dec = Math.pow(10, -3 / (t60 * sr)), bl = Math.max(1, Math.floor(sr * (bloom || 0.002)));
    let a = amp;
    for (let i = 0; i < n; i++) {
      const t = i / sr, g = o.glide ? 1 + (o.glide - 1) * (1 - Math.exp(-t / (o.glideT || 0.15))) : 1;
      ph += 2 * Math.PI * f0 * g / sr;
      d[i] += Math.sin(ph) * a * (i < bl ? i / bl : 1);
      a *= dec;
    }
  }
  if (o.noise) {
    const nz = new Float32Array(n);
    for (let i = 0; i < n; i++) nz[i] = (rand() * 2 - 1) * Math.exp(-i / (sr * o.nDec));
    biquad(nz, sr, 'bandpass', o.nF, o.nQ || 0.8);
    biquad(nz, sr, 'highpass', o.nF * 0.5, 0.7);
    for (let i = 0; i < n; i++) d[i] += nz[i] * o.noise;
  }
  return finish(d, sr, 0.9, 0.0006, 0.15);
}
