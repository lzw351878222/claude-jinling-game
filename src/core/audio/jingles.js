// 金陵寻踪 · 插曲（1–3 秒的短乐句，播放时压低音乐）与对白"打字"音
import { makeChannel, mtof } from './engine.js';
import * as I from './inst.js';
import { T, N, Z, Pp, Q, B, P, G, pd, rnd, ctxOf } from './sfxlib.js';

function jch(E) { // 插曲声道：更多混响
  if (!E.jingleCh) E.jingleCh = makeChannel(E, E.bus.sfx, { send: 0.32, gain: 0.95 });
  return E.jingleCh;
}
function erhuCh(E) {
  if (!E.erhuCh) E.erhuCh = makeChannel(E, E.bus.sfx, { send: 0.35, eq: [['highpass', 190, 0.7], ['peaking', 820, 1.4, 5], ['peaking', 2100, 1.6, 3], ['lowpass', 4600, 0.7]] });
  return E.erhuCh;
}

// 每个插曲返回时长（秒），用于压低音乐
export const JINGLES = {
  codex: (o) => { // 发现：五声音阶上行闪光 + 钟
    [5, 6, 7, 8, 9, 10, 12, 15].forEach((d, i) => Z(o, i * 0.055, pd(d), 0.2 + i * 0.022, { d: 0.9 }));
    B(o, 0.45, pd(15), 'chime', 0.26); B(o, 0.47, pd(13), 'glass', 0.18);
    N(o, 0.15, { type: 'highpass', f: 6500, a: 0.3, d: 0.9, vol: 0.035 });
    return 1.6;
  },
  quest: (o) => { // 新任务：琵琶动机
    P(o, 0, 'xiaoluo', 0.22);
    Pp(o, 0, pd(3), 0.34); Pp(o, 0.12, pd(4), 0.34); Pp(o, 0.24, pd(5), 0.38);
    Pp(o, 0.42, pd(6), 0.42, { vib: [14, 5] }); B(o, 0.42, pd(11), 'glass', 0.14);
    return 1.5;
  },
  chapter: (o) => { // 章节：大锣 + 古筝刮奏
    P(o, 0, 'gong', 0.62); P(o, 0, 'dagu', 0.5);
    G(o, 0.15, pd(-5), pd(10), 0.9, 0.3, { ring: 0.8 });
    [0, 3, 5].forEach((d, i) => Z(o, 1.1 + i * 0.015, pd(d), 0.36));
    B(o, 1.1, pd(5), 'zhong', 0.26);
    return 3;
  },
  seal: (o) => { // 盖印：闷响 + 钟
    P(o, 0, 'dagu', 0.55); P(o, 0, 'thud', 0.5, 0.95);
    N(o, 0, { type: 'lowpass', f: 900, a: 0.002, d: 0.08, vol: 0.16 });
    B(o, 0.12, pd(3), 'zhong', 0.3); B(o, 0.2, pd(10), 'chime', 0.2);
    return 1.8;
  },
  victory: (o) => { // 胜利：锣鼓经 + 刮奏 + 终止和弦
    const hits = [[0, 'xiaoluo', 0.45], [0, 'tanggu', 0.55], [0.18, 'tanggu', 0.4], [0.27, 'tanggu', 0.4], [0.36, 'bo', 0.25], [0.36, 'tanggu', 0.5], [0.54, 'xiaoluo', 0.35]];
    for (const [t, n, v] of hits) P(o, t, n, v);
    G(o, 0.2, pd(-5), pd(10), 0.5, 0.3);
    P(o, 0.75, 'gong', 0.45); P(o, 0.75, 'dagu', 0.5);
    [0, 3, 5, 7, 10].forEach((d, i) => Z(o, 0.75 + i * 0.015, pd(d), 0.36));
    B(o, 0.78, pd(15), 'chime', 0.22);
    return 2.6;
  },
  sad: (o) => { // 伤感：二胡下行（羽调）+ 低音古筝
    const ch = erhuCh(o.E);
    [[pd(2), 0, 0.72], [pd(1), 0.72, 0.5], [pd(0), 1.22, 0.5], [pd(-1), 1.72, 1.3]].forEach(([m, t, d], i, a) =>
      I.erhu(o.E, ch, o.t + t, m + o.p, d, { vel: 0.62 * o.v, from: i ? a[i - 1][0] + o.p : null }));
    Z(o, 0, pd(-6), 0.3); Z(o, 0.02, pd(-3), 0.22); Z(o, 1.72, pd(-6), 0.26); Z(o, 1.74, pd(-2), 0.18);
    return 3.1;
  },
  mystery: (o) => { // 神秘：古琴泛音 + 微失谐的钟 + 低鸣
    B(o, 0, pd(5), 'glass', 0.28); B(o, 0.02, pd(0), 'qing', 0.2, { rate: 1.012 });
    B(o, 0.45, pd(8), 'glass', 0.16, { rate: 0.985 });
    Q(o, 0.8, pd(-2), 0.3, { bend: [Math.pow(2, -2 / 12), 0.35, 0.5] });
    T(o, 0, { f: mtof(pd(-10)), a: 0.8, hold: 0.9, r: 1.2, vol: 0.08 });
    return 2.6;
  },
  item: (o) => { // 获得物品
    B(o, 0, pd(13), 'glass', 0.28); B(o, 0.1, pd(15), 'glass', 0.3);
    Z(o, 0, pd(8), 0.2, { d: 0.5 }); Z(o, 0.1, pd(10), 0.22);
    N(o, 0.06, { type: 'highpass', f: 6500, a: 0.02, d: 0.4, vol: 0.03 });
    return 1.2;
  },
  restore: (o) => { // 场景修复：温暖闪烁的上行琶音
    [0, 2, 3, 5, 7, 8, 10].forEach((d, i) => Z(o, i * 0.13 * (1 - i * 0.04), pd(d), 0.26 + i * 0.02));
    I.pad(o.E, o.ch, o.t + 0.1, [pd(0), pd(3), pd(7)].map((m) => m + o.p), 1.1, { vel: 0.7 * o.v, a: 0.6, r: 1.2 });
    B(o, 0.85, pd(13), 'chime', 0.2);
    N(o, 0.3, { type: 'highpass', f: 5000, f2: 9000, glide: 0.8, a: 0.5, d: 1, vol: 0.03 });
    return 2.4;
  },
};

export function playJingle(E, name, t) {
  const f = JINGLES[name] || JINGLES.item;
  return f(ctxOf(E, t, {}, jch(E)));
}

// 对白打字音：各角色一种音色，五声音阶随机取音，很轻
const R = (lo, hi) => lo + ((Math.random() * (hi - lo + 1)) | 0);
export const BLIPS = {
  kangye: (o) => Z(o, 0, pd(R(7, 11)), 0.15, { d: 0.14 }),
  male: (o) => Pp(o, 0, pd(R(-2, 2)), 0.16, { d: 0.11 }),
  female: (o) => Z(o, 0, pd(R(4, 8)), 0.12, { d: 0.11 }),
  old: (o) => Q(o, 0, pd(R(-4, 0)), 0.12, { d: 0.16 }),
  child: (o) => Z(o, 0, pd(R(9, 13)), 0.1, { d: 0.06 }),
  qilin: (o) => B(o, 0, pd(R(10, 14)), 'glass', 0.1, { d: 0.22 }),
  monster: (o) => T(o, 0, { type: 'sawtooth', f: rnd(70, 95), f2: rnd(60, 80), glide: 0.06, a: 0.004, d: 0.08, vol: 0.07, flt: ['lowpass', 520, 3] }),
  narrator: (o) => P(o, 0, 'muyu', 0.11, [1, 1.122, 1.26, 1.498, 1.682][R(0, 4)] * 1.15, { d: 0.06 }),
};
export function playBlip(E, voice, t) {
  const f = BLIPS[voice] || BLIPS.narrator;
  const o = ctxOf(E, t, {}, E.sfxDry);
  o.r = 1; // 打字音不加随机失谐（音高已随机取五声音）
  f(o);
}
