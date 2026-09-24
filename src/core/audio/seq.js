// 金陵寻踪 · 音序器：简谱解析、五声音阶、曲目播放器（前瞻调度 + 淡入淡出 + 按循环播种的变奏）
import { makeChannel, killOwner, holdParam } from './engine.js';
import { seeded } from './dsp.js';
import { warmTasks } from './inst.js';

// —— 简谱 ——
// 记号：数字 0-7（0 休止）；后缀 #/b 升降；' 高八度 , 低八度；_ 时值减半 . 附点；- 延长一拍（-_ 半拍）
// 装饰：^ 上倚音  / 下方滑入  ~ 揉弦/轮指  > 重音
const MAJ = [0, 0, 2, 4, 5, 7, 9, 11];
const TOK = /^([0-7])([#b]?)([',]*)([_.]*)([~^/>]*)$/;
export function jp(str) {
  const notes = [], bars = [];
  let beat = 0, barStart = 0;
  for (const tok of String(str).trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') { bars.push(beat - barStart); barStart = beat; continue; }
    if (tok[0] === '-') {
      let d = 1;
      for (const ch of tok.slice(1)) d *= ch === '_' ? 0.5 : ch === '.' ? 1.5 : 1;
      if (notes.length) notes[notes.length - 1].d += d;
      beat += d;
      continue;
    }
    const m = TOK.exec(tok);
    if (!m) { notes.push({ b: beat, d: 0, n: null, bad: tok }); continue; }
    let d = 1;
    for (const ch of m[4]) d *= ch === '_' ? 0.5 : 1.5;
    let n = null;
    if (m[1] !== '0') {
      n = MAJ[+m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
      for (const ch of m[3]) n += ch === "'" ? 12 : -12;
    }
    notes.push({ b: beat, d, n, orn: m[5] || '' });
    beat += d;
  }
  if (beat > barStart) bars.push(beat - barStart);
  return { notes: notes.filter((x) => !x.bad && x.d > 0), beats: beat, bars, bad: notes.filter((x) => x.bad).map((x) => x.bad) };
}
// 开发校验：每小节拍数是否正确
export function jpCheck(str, bpb) {
  const r = jp(str), errs = [];
  r.bars.forEach((len, i) => { if (Math.abs(len - bpb) > 1e-6) errs.push(`第${i + 1}小节 ${len} 拍`); });
  if (r.bad.length) errs.push('无法解析: ' + r.bad.join(' '));
  return errs;
}
// 根音串：每小节一个记号，"1/5," 表示前后半小节
export function roots(str) {
  return String(str).trim().split(/\s+/).filter((x) => x && x !== '|').map((tok) => tok.split('/').map((s) => {
    const r = jp(s).notes[0];
    return r && r.n != null ? r.n : 0;
  }));
}

// —— 五声音阶（宫 商 角 徵 羽）——
const PC = [0, 2, 4, 7, 9];
export class Scale {
  constructor(gong) { this.g = gong; this.pcs = PC.map((x) => (((x + gong) % 12) + 12) % 12); }
  has(m) { return this.pcs.includes(((Math.round(m) % 12) + 12) % 12); }
  snap(m) { m = Math.round(m); for (let k = 0; k < 3; k++) { if (this.has(m - k)) return m - k; if (this.has(m + k)) return m + k; } return m; }
  step(m, k) { let x = this.snap(m); while (k > 0) { x++; if (this.has(x)) k--; } while (k < 0) { x--; if (this.has(x)) k++; } return x; }
  // 根音上的"五声和弦"：根、五度（不在调内则用四度）、八度、八度上一级
  fifth(m) { return this.has(m + 7) ? m + 7 : m + 5; }
  chord(m) { const f = this.fifth(m); return [m, f, m + 12, this.step(m + 12, 1), this.step(m + 12, 2)]; }
}

const hash = (...xs) => { let h = 2166136261; for (const x of xs) { h ^= x & 0xffff; h = Math.imul(h, 16777619); h ^= x >>> 16; h = Math.imul(h, 16777619); } return h >>> 0; };

// —— 播放器 ——
// track: { bpm, bpb, gong, gain(整体音量), swing, ch:{名:{pan,send,gain,eq}}, sec:{名:{mel, mel2, roots}}, intro:[段], form:[段], bar(b), warm:{…}, seed }
export class Player {
  constructor(E, track, id, bus) {
    this.E = E; this.T = track; this.id = id; this.q = [];
    this.spb = 60 / track.bpm; this.bpb = track.bpb || 4;
    this.S = new Scale(track.gong);
    const c = E.ctx;
    this.out = { dry: c.createGain(), wet: c.createGain() };
    this.out.dry.connect(bus.dry); this.out.wet.connect(bus.wet);
    this.ch = {};
    for (const [k, spec] of Object.entries(track.ch || {})) this.ch[k] = makeChannel(E, this.out, { ...spec, owner: this });
    this.secs = {};
    for (const [k, s] of Object.entries(track.sec || {})) {
      const mel = s.mel ? jp(s.mel) : null, mel2 = s.mel2 ? jp(s.mel2) : null, rt = s.roots ? roots(s.roots) : [[0]];
      const nb = Math.max(rt.length, mel ? Math.ceil(mel.beats / this.bpb - 1e-9) : 0, mel2 ? Math.ceil(mel2.beats / this.bpb - 1e-9) : 0, 1);
      this.secs[k] = { ...s, name: k, mel, mel2, rt, nb };
    }
    this.plan = (track.intro || []).slice();
    this.loop = 0; this.fi = 0; this.sb = 0; this.gbar = 0; this.next = 0; this.stopAt = null;
    this.seed = track.seed || hash(id.length, id.charCodeAt(0), id.charCodeAt(id.length - 1));
    const w = track.warm || {};
    const lo = this.S.snap(track.gong - 12), hi = track.gong + 26, notes = [];
    for (let m = lo; m <= hi; m++) if (this.S.has(m)) notes.push(m);
    this.tasks = warmTasks(E, { zheng: w.zheng === false ? [] : (w.zheng || notes), pipa: w.pipa || [], qin: w.qin || [], perc: w.perc || [], bell: w.bell || [] });
  }
  warmStep(budgetMs) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    while (this.tasks.length) {
      try { this.tasks.shift()(); } catch (e) { /* */ }
      if ((typeof performance !== 'undefined' ? performance : Date).now() - t0 > budgetMs) break;
    }
  }
  fade(to, t, dur) {
    for (const g of [this.out.dry.gain, this.out.wet.gain]) {
      holdParam(g, t); g.linearRampToValueAtTime(to, t + Math.max(0.02, dur));
    }
  }
  start(t, fade, delay = 0.3) {
    for (const g of [this.out.dry.gain, this.out.wet.gain]) g.value = 0;
    this.fade(this.T.gain || 1, t, fade);
    this.next = t + delay;
  }
  stop(t, fade) { this.stopAt = t + Math.max(0.02, fade); this.fade(0, t, fade); }
  curSec() {
    const name = this.plan.length ? this.plan[0] : this.T.form[this.fi % this.T.form.length];
    return this.secs[name] || Object.values(this.secs)[0];
  }
  advance(sec) {
    this.sb++;
    if (this.sb >= sec.nb) {
      this.sb = 0;
      if (this.plan.length) this.plan.shift();
      else { this.fi++; if (this.fi >= this.T.form.length) { this.fi = 0; this.loop++; } }
    }
  }
  genBar() {
    const sec = this.curSec(), bi = this.sb, spb = this.spb, bpb = this.bpb, t0 = this.next, S = this.S;
    const sw = this.T.swing || 0;
    const at = (beat) => { const fr = beat % 1; return t0 + (beat + (sw && Math.abs(fr - 0.5) < 1e-6 ? sw * 0.5 : 0)) * spb; };
    const mk = (mel) => {
      if (!mel) return [];
      const lo = bi * bpb, hi = lo + bpb, out = [];
      for (const n of mel.notes) if (n.n != null && n.b >= lo - 1e-9 && n.b < hi - 1e-9) out.push({ t: at(n.b - lo), b: n.b - lo, d: n.d, dur: n.d * spb, m: S.g + n.n, orn: n.orn, prev: null });
      return out;
    };
    const rt = sec.rt[bi % sec.rt.length], nrt = sec.rt[(bi + 1) % sec.rt.length];
    const q = this.q;
    const b = {
      E: this.E, P: this, S, ch: this.ch, t: t0, spb, bpb, at, sec: sec.name, secDef: sec, bi, nb: sec.nb, loop: this.loop, fi: this.fi, gbar: this.gbar,
      rng: seeded(hash(this.seed, this.loop * 131 + this.fi, bi + 7 * this.gbar)),
      root: S.g + rt[0], roots: rt.map((r) => S.g + r), nextRoot: S.g + nrt[0],
      notes: mk(sec.mel), notes2: mk(sec.mel2),
      last: bi === sec.nb - 1, phraseEnd: bi % 4 === 3, intro: this.plan.length > 0,
      ev(t, fn) { q.push([t, fn]); },
    };
    // 为旋律音标注前一音（用于滑音）
    let prev = this.lastMel || null;
    for (const n of b.notes) { n.prev = prev; prev = n.m; }
    if (b.notes.length) this.lastMel = prev;
    try { this.T.bar(b); } catch (e) { if (typeof console !== 'undefined') console.warn('[audio] bar', this.id, e); }
    q.sort((x, y) => x[0] - y[0]);
    this.advance(sec);
    this.gbar++;
    this.next += bpb * spb;
  }
  tick(now, horizon) {
    if (this.next < now - 0.25) { // 跳过错过的时间（标签页恢复/卡顿）：丢弃过期事件，从下一小节接上
      this.q.length = 0;
      this.next = now + 0.05;
    }
    let guard = 0;
    while (this.next < horizon && guard++ < 8) this.genBar();
    const q = this.q;
    let i = 0;
    while (i < q.length && q[i][0] < horizon) {
      const [t, fn] = q[i++];
      if (t >= now - 0.04) { try { fn(t); } catch (e) { /* */ } }
    }
    if (i) q.splice(0, i);
  }
  dispose() {
    killOwner(this.E, this);
    for (const k in this.ch) this.ch[k].disconnect();
    try { this.out.dry.disconnect(); this.out.wet.disconnect(); } catch (e) { /* */ }
    this.q.length = 0; this.tasks.length = 0;
  }
}
