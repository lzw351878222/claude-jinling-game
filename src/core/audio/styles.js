// 金陵寻踪 · 编配助手：旋律演奏（含装饰音）、五声分解和弦、低音、锣鼓经式节奏串、花指、铺底
import * as I from './inst.js';

const PLUCK = { zheng: I.zheng, pipa: I.pipa, qin: I.qin };
const BLOW = { dizi: I.dizi, xiao: I.xiao, erhu: I.erhu, suona: I.suona };

// 旋律。o: {inst, ch, oct, vel, notes, legato, vib, d(弹拨闷音/断奏), dbl(八度叠奏概率), gliss(句首花指概率), trem(琵琶长音轮指), bendEnd}
export function lead(b, o) {
  const notes = o.notes || b.notes, ch = b.ch[o.ch || 'lead'], inst = o.inst || 'zheng', S = b.S, E = b.E;
  const oct = (o.oct || 0) * 12, vel = o.vel != null ? o.vel : 0.6;
  notes.forEach((n, i) => {
    const m = n.m + oct, strong = n.b % 1 === 0, acc = n.orn.includes('>') ? 1.15 : 1;
    const v = vel * acc * (strong ? 1 : 0.86) * (0.94 + b.rng() * 0.12);
    const dur = n.dur, t = n.t + (b.rng() - 0.5) * 0.012;
    if (PLUCK[inst]) {
      const f = PLUCK[inst];
      if (n.orn.includes('^')) b.ev(t - 0.07, (tt) => f(E, ch, tt, S.step(m, 1), { vel: v * 0.5, d: 0.12 }));
      if (i === 0 && b.bi % 4 === 0 && o.gliss && b.rng() < o.gliss) {
        const from = m - 12, gd = Math.min(0.5, b.spb * 0.9);
        b.ev(t - gd, (tt) => I.gliss(E, ch, tt, from, m - 1, gd * 0.92, (x) => S.has(x), { vel: v * 0.55, ring: 0.6 }));
      }
      if (inst === 'pipa' && (n.orn.includes('~') || (o.trem && n.d >= o.trem))) {
        b.ev(t, (tt) => I.pipaTrem(E, ch, tt, m, dur * 0.95, { vel: v }));
      } else if (n.orn.includes('/') && n.prev != null && n.prev < m) {
        const r = Math.pow(2, (n.prev - m) / 12);
        b.ev(t, (tt) => f(E, ch, tt, m, { vel: v, bend: [1 / r, 0.04, 0.12], rateMul: r }));
      } else {
        const long = n.d >= 1.5;
        const bendEnd = o.bendEnd && long && b.rng() < o.bendEnd;
        b.ev(t, (tt) => f(E, ch, tt, m, { vel: v, d: o.d, vib: long && !bendEnd && !o.d ? [o.vib || 16, 5] : undefined, bend: bendEnd ? [Math.pow(2, -1 / 12), dur * 0.55, dur * 0.3] : undefined }));
      }
      if (o.dbl && strong && n.d >= 1 && b.rng() < o.dbl) b.ev(t + 0.012, (tt) => f(E, ch, tt, m - 12, { vel: v * 0.55 }));
    } else {
      const f = BLOW[inst] || I.dizi;
      const next = notes[i + 1];
      const leg = o.legato != null ? o.legato : 0.96;
      const d = next && Math.abs(next.t - (n.t + dur)) < 0.02 ? dur * leg + 0.03 : dur * 0.9;
      const from = n.prev != null && Math.abs(n.prev - m) <= 5 && b.rng() < (o.slide != null ? o.slide : 0.45) ? n.prev + oct : null;
      const grace = n.orn.includes('^') ? S.step(m, 1) - m : 0;
      b.ev(t, (tt) => f(E, ch, tt, m, d, { vel: v, from, grace, vib: n.orn.includes('~') ? (o.vib || 16) * 1.7 : o.vib }));
    }
  });
}

// 分解和弦：pat 为每格的音阶级数（相对根音，"." 休止，"r" 取下一根音），格长 = bpb/格数 拍
// o: {ch, inst, oct, vel, pat 或 pats(随机选), d(闷音), accent}
export function arp(b, o) {
  const pat = o.pats ? o.pats[(b.rng() * o.pats.length) | 0] : o.pat;
  const toks = pat.trim().split(/\s+/), L = toks.length, E = b.E, ch = b.ch[o.ch || 'acc'], S = b.S;
  const f = PLUCK[o.inst || 'zheng'], base = (o.oct || 0) * 12, vel = o.vel != null ? o.vel : 0.3;
  toks.forEach((tk, k) => {
    if (tk === '.' || tk === '-') return;
    const beat = (k * b.bpb) / L, half = beat >= b.bpb / 2 && b.roots.length > 1 ? 1 : 0;
    const root = b.roots[half] + base;
    const m = tk === 'r' ? b.nextRoot + base : S.step(root, parseInt(tk, 10));
    const v = vel * (beat % 1 === 0 ? 1 : 0.78) * (o.accent && k === 0 ? 1.25 : 1) * (0.9 + b.rng() * 0.2);
    b.ev(b.at(beat) + (b.rng() - 0.5) * 0.01, (t) => f(E, ch, t, m, { vel: v, d: o.d }));
  });
}

// 低音：pat 同上（级数可为负），o: {ch, inst, oct(默认 -1), vel}
export function bass(b, o) { arp(b, { ch: 'bass', inst: 'zheng', oct: -1, vel: 0.45, ...o }); }

// 打击乐节奏串：{乐器: "x..o..x."}；x=重 o=中 .=空 数字1-9=力度；格长 = bpb/串长
// o: {ch, vel, rate:{乐器:变调}, d:{乐器:闷音秒}, hum(随机时值偏移秒)}
export function drums(b, map, o = {}) {
  const E = b.E, ch = b.ch[o.ch || 'perc'], vel = o.vel != null ? o.vel : 0.6;
  for (const [name, pat] of Object.entries(map)) {
    const s = pat.replace(/\s+/g, ''), L = s.length;
    for (let k = 0; k < L; k++) {
      const c = s[k];
      if (c === '.' || c === '-') continue;
      const v = c === 'x' ? 1 : c === 'o' ? 0.6 : c === 'g' ? 0.35 : (parseInt(c, 10) || 5) / 9;
      const t = b.at((k * b.bpb) / L) + (b.rng() - 0.5) * (o.hum != null ? o.hum : 0.008);
      const rate = (o.rate && o.rate[name]) || 1, d = o.d ? o.d[name] : undefined;
      b.ev(t, (tt) => I.perc(E, ch, tt, name, { vel: vel * v * (0.9 + b.rng() * 0.2), rate, d }));
    }
  }
}

// 滚奏（渐快渐强），用于句尾过门：从 beat 开始持续 len 拍
export function roll(b, name, beat, len, o = {}) {
  const E = b.E, ch = b.ch[o.ch || 'perc'], n = o.n || 8, vel = o.vel != null ? o.vel : 0.5;
  for (let k = 0; k < n; k++) {
    const x = k / n, t = b.at(beat) + len * b.spb * (1 - Math.pow(1 - x, 1.6));
    b.ev(t, (tt) => I.perc(E, ch, tt, name, { vel: vel * (0.4 + 0.6 * x) }));
  }
}

// 花指：在 beat 处从 lo 扫到 hi（MIDI），时长 len 拍
export function sweep(b, beat, lo, hi, len, o = {}) {
  const E = b.E, ch = b.ch[o.ch || 'acc'], S = b.S;
  b.ev(b.at(beat), (t) => I.gliss(E, ch, t, lo, hi, len * b.spb, (x) => S.has(x), { vel: o.vel || 0.35, inst: o.inst ? PLUCK[o.inst] : undefined, dim: o.dim, ring: o.ring }));
}

// 铺底和声：根音上的五声和弦（根/五/八度/二级），持续 bars 小节
export function padChord(b, o = {}) {
  const E = b.E, ch = b.ch[o.ch || 'pad'], S = b.S, r = b.root + (o.oct || 0) * 12;
  const notes = o.notes || [r, S.fifth(r), S.step(r + 12, o.color != null ? o.color : 1)];
  const dur = (o.bars || 1) * b.bpb * b.spb;
  b.ev(b.t, (t) => I.pad(E, ch, t, notes, dur, { vel: o.vel || 0.5, a: o.a, r: o.r, sheng: o.sheng }));
}

export function bellAt(b, beat, m, o = {}) {
  const E = b.E, ch = b.ch[o.ch || 'bell'];
  b.ev(b.at(beat), (t) => I.bell(E, ch, t, m, { kind: o.kind || 'bell', vel: o.vel || 0.4, rate: o.rate }));
}
export function hit(b, beat, name, o = {}) {
  const E = b.E, ch = b.ch[o.ch || 'perc'];
  b.ev(b.at(beat), (t) => I.perc(E, ch, t, name, { vel: o.vel != null ? o.vel : 0.6, rate: o.rate }));
}
