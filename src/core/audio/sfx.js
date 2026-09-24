// 金陵寻踪 · 音效库（界面 / 乐器与器物 / 自然与物理）+ 统一入口 playSfx。未知名称回退到 click。
import { mtof } from './engine.js';
import { T, N, Z, Pp, B, P, G, F, pd, rnd, clamp, ctxOf } from './sfxlib.js';
import { SFX_M3 } from './sfx-m3.js';
export { playBlip, playJingle, JINGLES, BLIPS } from './jingles.js';

const pickOf = (a) => a[(Math.random() * a.length) | 0];

export const SFX = {
  // —— 界面 ——
  click: (o) => P(o, 0, 'bang', 0.22, 1.35, { d: 0.05 }),
  hover: (o) => T(o, 0, { f: 2600, a: 0.002, d: 0.025, vol: 0.028 }),
  button: (o) => { P(o, 0, 'muyu', 0.24, 1.2, { d: 0.12 }); Z(o, 0.005, pd(5), 0.11, { d: 0.3 }); },
  ok: (o) => { Z(o, 0, pd(3), 0.32); Z(o, 0.075, pd(5), 0.36); B(o, 0.075, pd(10), 'glass', 0.07); },
  cancel: (o) => { Z(o, 0, pd(4), 0.26, { d: 0.5 }); Z(o, 0.08, pd(2), 0.25, { d: 0.6 }); },
  open: (o) => { // 纸卷展开
    N(o, 0, { f: 900, f2: 3200, glide: 0.3, q: 0.9, a: 0.04, d: 0.36, vol: 0.14 });
    N(o, 0.03, { type: 'highpass', f: 4000, a: 0.03, d: 0.25, vol: 0.045 });
    P(o, 0.3, 'muyu', 0.13, 1.7, { d: 0.08 });
  },
  close: (o) => { N(o, 0, { f: 3000, f2: 900, glide: 0.22, q: 0.9, a: 0.02, d: 0.26, vol: 0.12 }); P(o, 0.2, 'muyu', 0.15, 1.45, { d: 0.08 }); },
  page: (o) => { // 翻页
    N(o, 0, { f: 2400, f2: 4200, glide: 0.06, q: 0.7, a: 0.008, d: 0.07, vol: 0.12 });
    N(o, 0.05, { f: 3600, f2: 1600, glide: 0.12, q: 0.6, a: 0.01, d: 0.14, vol: 0.1 });
  },
  good: (o) => { Z(o, 0, pd(5), 0.3); Z(o, 0.06, pd(7), 0.3); Z(o, 0.12, pd(8), 0.34); },
  perfect: (o) => {
    [5, 7, 8, 10].forEach((d, i) => Z(o, i * 0.055, pd(d), 0.28 + i * 0.03));
    B(o, 0.22, pd(12), 'chime', 0.2);
    N(o, 0.2, { type: 'highpass', f: 6000, a: 0.05, d: 0.5, vol: 0.03 });
  },
  bad: (o) => { Pp(o, 0, pd(1), 0.28, { d: 0.25 }); Pp(o, 0.09, pd(-1), 0.28, { d: 0.35, bend: [0.97, 0.05, 0.2] }); P(o, 0, 'thud', 0.13, 1.2); },
  error: (o) => { T(o, 0, { type: 'triangle', f: 210, f2: 160, glide: 0.12, d: 0.18, vol: 0.15 }); P(o, 0, 'rim', 0.2, 0.8, { d: 0.08 }); P(o, 0.1, 'rim', 0.17, 0.75, { d: 0.08 }); },
  win: (o) => { G(o, 0, pd(0), pd(10), 0.32, 0.3); P(o, 0.34, 'xiaoluo', 0.28); Z(o, 0.34, pd(5), 0.28); Z(o, 0.34, pd(10), 0.38); B(o, 0.34, pd(15), 'chime', 0.16); },
  fail: (o) => { [4, 3, 2, 1].forEach((d, i) => Z(o, i * 0.16, pd(d), 0.3 - i * 0.03, i === 3 ? { bend: [0.97, 0.25, 0.3] } : { d: 0.5 })); },
  tick: (o) => P(o, 0, 'bang', 0.15, 1.6, { d: 0.04 }),
  countdown: (o) => { B(o, 0, pd(8 + clamp(Math.round(+o.note || 0), 0, 5)), 'chime', 0.3, { d: 0.45 }); },
  quest: (o) => { Pp(o, 0, pd(3), 0.28); Pp(o, 0.09, pd(4), 0.28); Pp(o, 0.18, pd(5), 0.34); P(o, 0.18, 'xiaoluo', 0.13); },
  codex: (o) => {
    [5, 6, 7, 8, 10].forEach((d, i) => Z(o, i * 0.045, pd(d), 0.2 + i * 0.03, { d: 0.6 }));
    B(o, 0.24, pd(12), 'chime', 0.22);
    N(o, 0.1, { type: 'highpass', f: 7000, a: 0.1, d: 0.5, vol: 0.03 });
  },
  get: (o) => { Z(o, 0, pd(8), 0.28, { d: 0.4 }); Z(o, 0.07, pd(10), 0.32); B(o, 0.07, pd(13), 'glass', 0.1); },
  item: (o) => { B(o, 0, pd(8), 'glass', 0.26); B(o, 0.09, pd(10), 'glass', 0.28); N(o, 0.05, { type: 'highpass', f: 6500, a: 0.02, d: 0.35, vol: 0.028 }); },

  // —— 乐器与器物 ——
  pluck: (o) => Z(o, 0, pd(Number.isFinite(+o.note) && o.note != null ? clamp(Math.round(+o.note), 0, 14) : 5), 0.5),
  chime: (o) => B(o, 0, pickOf([pd(8), pd(9), pd(10)]), 'chime', 0.34),
  bell: (o) => { B(o, 0, pd(0), 'qing', 0.5); P(o, 0, 'rim', 0.07, 2.2, { d: 0.03 }); },
  gong: (o) => P(o, 0, 'gong', 0.7),
  drum: (o) => P(o, 0, 'tanggu', 0.75),
  wood: (o) => P(o, 0, 'muyu', 0.55),
  horn: (o) => { // 海螺 / 船号：低沉的号角
    T(o, 0, { type: 'sawtooth', f: 116, f2: 123, glide: 0.25, a: 0.18, hold: 1.0, r: 0.5, vol: 0.13, flt: ['lowpass', 520, 1.2, 900, 0.3], vib: [8, 4.5, 0.3] });
    T(o, 0, { type: 'triangle', f: 232, f2: 246, glide: 0.25, a: 0.2, hold: 0.95, r: 0.45, vol: 0.05 });
  },
  door: (o) => { // 木门：吱呀 + 合上
    T(o, 0, { type: 'sawtooth', f: 70, f2: 105, glide: 0.45, a: 0.06, hold: 0.42, r: 0.08, vol: 0.09, flt: ['bandpass', 1300, 5, 1700, 0.45] });
    P(o, 0.5, 'thud', 0.45, 0.8); P(o, 0.5, 'rim', 0.12, 0.6, { d: 0.06 });
  },
  seal: (o) => { P(o, 0, 'thud', 0.55, 0.95); N(o, 0, { type: 'lowpass', f: 900, a: 0.002, d: 0.08, vol: 0.17 }); B(o, 0.09, pd(10), 'chime', 0.26); },
  stamp: (o) => { P(o, 0, 'thud', 0.6, 1.0); N(o, 0.005, { f: 1400, q: 0.8, a: 0.002, d: 0.06, vol: 0.12 }); },
  brush: (o) => { N(o, 0, { f: 1800, f2: 2600, glide: 0.25, q: 0.9, a: 0.07, d: 0.28, vol: 0.09 }); N(o, 0.02, { type: 'highpass', f: 5000, a: 0.06, d: 0.2, vol: 0.022 }); },
  ink: (o) => { // 墨滴溅开
    N(o, 0, { type: 'lowpass', f: 3200, f2: 500, glide: 0.18, q: 1.5, a: 0.004, d: 0.22, vol: 0.2 });
    T(o, 0.01, { f: 320, f2: 110, glide: 0.1, d: 0.12, vol: 0.15 });
    F(o, 0.03, 'drops', 0.12, 1.4);
  },
  star: (o) => { // 星星（note 越大越高：1..3 星）
    const k = clamp(Math.round(+o.note || 0), 0, 6);
    B(o, 0, pd(8 + k), 'glass', 0.32); B(o, 0.07, pd(10 + k), 'glass', 0.22);
    N(o, 0.02, { type: 'highpass', f: 7000, a: 0.02, d: 0.4, vol: 0.032 });
  },
  sparkle: (o) => { for (let i = 0; i < 4; i++) T(o, i * 0.035 + Math.random() * 0.02, { f: mtof(pd(10 + ((Math.random() * 5) | 0))), a: 0.002, d: 0.12, vol: 0.045 }); },
  magic: (o) => {
    for (let i = 0; i < 6; i++) B(o, i * 0.06, pd(5 + i * 2), 'glass', 0.13 + i * 0.02);
    N(o, 0, { type: 'highpass', f: 3000, f2: 8000, glide: 0.4, a: 0.25, d: 0.5, vol: 0.045 });
  },
  coin: (o) => { B(o, 0, pd(14), 'chime', 0.24, { d: 0.25 }); B(o, 0.075, pd(16), 'chime', 0.27, { d: 0.7 }); },

  // —— 自然与物理 ——
  whoosh: (o) => N(o, 0, { f: 350, f2: 1800, glide: 0.22, q: 1.1, a: 0.12, d: 0.3, vol: 0.28 }),
  swoosh: (o) => N(o, 0, { f: 1200, f2: 4200, glide: 0.12, q: 1.4, a: 0.05, d: 0.16, vol: 0.22 }),
  fire: (o) => { F(o, 0, 'crackle', 0.4); N(o, 0, { type: 'lowpass', f: 250, f2: 700, glide: 0.15, a: 0.03, d: 0.4, vol: 0.2 }); },
  water: (o) => F(o, 0, 'pour', 0.32),
  splash: (o) => { N(o, 0, { type: 'lowpass', f: 5000, f2: 900, glide: 0.25, q: 0.8, a: 0.003, d: 0.35, vol: 0.26 }); F(o, 0.05, 'drops', 0.3); },
  steam: (o) => N(o, 0, { type: 'highpass', f: 3200, f2: 2400, glide: 0.6, a: 0.06, hold: 0.45, r: 0.35, vol: 0.11 }),
  wave: (o) => N(o, 0, { type: 'lowpass', f: 350, f2: 1600, glide: 0.7, q: 0.7, a: 0.6, d: 1.2, vol: 0.3 }),
  crack: (o) => { P(o, 0, 'rim', 0.48, 1.6, { d: 0.1 }); F(o, 0.005, 'crackleS', 0.34, 1.3); N(o, 0, { type: 'highpass', f: 2500, a: 0.001, d: 0.05, vol: 0.18 }); },
  shatter: (o) => F(o, 0, 'shatter', 0.55),
  knock_good: (o) => { P(o, 0, 'brick', 0.45); P(o, 0, 'thud', 0.18, 1.4, { d: 0.1 }); }, // 烧透的城砖：清亮"叮"，余音长
  knock_bad: (o) => { P(o, 0, 'thud', 0.5, 0.75, { d: 0.12 }); N(o, 0, { type: 'lowpass', f: 450, a: 0.002, d: 0.08, vol: 0.17 }); }, // 欠火砖：闷而短
  squish: (o) => {
    T(o, 0, { type: 'triangle', f: 700, f2: 140, glide: 0.09, a: 0.003, d: 0.12, vol: 0.21 });
    N(o, 0.005, { type: 'lowpass', f: 1400, f2: 400, glide: 0.1, a: 0.003, d: 0.1, vol: 0.13 });
    T(o, 0.06, { f: 1300, f2: 1900, glide: 0.05, d: 0.06, vol: 0.045 });
  },
  scurry: (o) => F(o, 0, 'scurry', 0.3),
  rotate: (o) => { P(o, 0, 'bang', 0.24, 1.25, { d: 0.05 }); P(o, 0.045, 'bang', 0.19, 1.5, { d: 0.05 }); },
  lamp_on: (o) => {
    N(o, 0, { type: 'lowpass', f: 220, f2: 1400, glide: 0.12, q: 1.2, a: 0.02, d: 0.35, vol: 0.27 });
    T(o, 0, { f: 110, f2: 70, glide: 0.15, a: 0.01, d: 0.25, vol: 0.17 });
    B(o, 0.12, pd(13), 'glass', 0.15);
  },
  lamp_off: (o) => { N(o, 0, { type: 'lowpass', f: 1400, f2: 180, glide: 0.25, q: 1, a: 0.01, d: 0.3, vol: 0.19 }); T(o, 0, { f: 180, f2: 90, glide: 0.2, d: 0.2, vol: 0.07 }); },
  firework: (o) => {
    T(o, 0, { f: 900, f2: 2600, glide: 0.7, a: 0.05, hold: 0.62, r: 0.06, vol: 0.045, vib: [40, 11, 0.1] });
    N(o, 0, { f: 2000, f2: 5000, glide: 0.7, q: 3, a: 0.05, hold: 0.6, r: 0.06, vol: 0.03 });
    P(o, 0.72, 'dagu', 0.48, 1.2); F(o, 0.74, 'crackle', 0.48);
  },
  hit: (o) => { P(o, 0, 'thud', 0.6, 1.1); N(o, 0, { type: 'highpass', f: 1500, a: 0.001, d: 0.04, vol: 0.17 }); },
  hurt: (o) => { T(o, 0, { type: 'triangle', f: 420, f2: 190, glide: 0.18, a: 0.005, d: 0.25, vol: 0.19 }); P(o, 0, 'thud', 0.33, 1.3); },
  heal: (o) => { [3, 5, 7, 10].forEach((d, i) => B(o, i * 0.08, pd(d), 'glass', 0.17)); T(o, 0, { f: mtof(pd(5)), a: 0.25, hold: 0.3, r: 0.5, vol: 0.055 }); },
  step: (o) => F(o, 0, 'step', 0.15 * rnd(0.8, 1.2), rnd(0.85, 1.2)),
  ...SFX_M3,
};
export const SFX_NAMES = Object.keys(SFX);

export function playSfx(E, name, opts, t) {
  const f = SFX[name] || SFX.click;
  f(ctxOf(E, t, opts));
}
