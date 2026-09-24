// 金陵寻踪 · 曲目（三）：temple / night / festival
import { lead, arp, bass, drums, roll, sweep, padChord, bellAt, hit } from './styles.js';
import * as I from './inst.js';

// —— temple：1428 大报恩寺（白日）。宫调，1=C，60 BPM；木鱼每拍、磬、箫的平和旋律、笙的长音 ——
export const temple = {
  bpm: 60, bpb: 4, gong: 60,
  ch: {
    lead: { pan: -0.1, send: 0.45 }, acc: { pan: 0.3, send: 0.4, gain: 0.7 }, bass: { pan: 0, send: 0.3 },
    perc: { pan: 0.15, send: 0.35 }, pad: { send: 0.5, gain: 0.8, eq: [['lowpass', 1600, 0.7]] }, bell: { pan: -0.3, send: 0.7 },
  },
  sec: {
    A: { mel: `1 - 2 3 | 5 - 3 - | 2 3 2 1 | 6, - - - | 1 - 2 3 | 5 6 5 3 | 2 - 3 2 | 1 - - - |`, roots: '1, 1, 5,, 6,, 1, 1, 5,, 1,' },
    B: { mel: `5 - 6 1' | 6 - 5 - | 3 5 6 5 | 3 - - - | 2 - 3 5 | 3 2 1 - | 6, 1 2 - | 1 - - - |`, roots: '1, 2, 6,, 6,, 5,, 6,, 5,, 1,' },
  },
  form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, alt = (b.loop + (b.fi >> 1)) % 2;
    drums(b, { muyu: 'x.o.x.o.' }, { vel: 0.36, hum: 0.004 });
    if (b.bi % 2 === 0) padChord(b, { bars: 2, vel: 0.32, sheng: true, a: 1.6, r: 2.2 });
    bass(b, { pat: '0 . . . . . . .', vel: 0.3 });
    arp(b, { pats: ['. . 3 . . . 5 .', '. . 5 . . . 3 .', '. . . . . . . .'], vel: 0.14 });
    if (alt) { lead(b, { inst: 'zheng', oct: 1, vel: 0.42, vib: 14, gliss: 0.3 }); lead(b, { inst: 'xiao', vel: 0.32, legato: 0.98 }); }
    else lead(b, { inst: 'xiao', vel: 0.55, legato: 0.98, slide: 0.5 });
    if (b.bi % 4 === 0) bellAt(b, 0, b.S.g + (b.bi === 0 ? 12 : 7), { kind: 'qing', vel: 0.22 });
    if (b.bi === 0 && s === 'A') bellAt(b, 0, b.S.g - 12, { kind: 'temple', vel: 0.2 });
  },
  warm: { perc: ['muyu'], bell: [['qing', 72], ['qing', 67], ['temple', 48]] },
};

// —— night：琉璃塔夜景，一百四十六盏灯。徵调（结束于 5），1=G，56 BPM；空灵的钟片、筝的高音闪烁 ——
export const night = {
  bpm: 56, bpb: 4, gong: 67,
  ch: {
    lead: { pan: -0.15, send: 0.55 }, acc: { pan: 0.3, send: 0.5, gain: 0.7 }, bass: { pan: 0, send: 0.35 },
    pad: { send: 0.6, gain: 0.9, eq: [['lowpass', 1200, 0.7]] }, bell: { pan: 0.2, send: 0.7 }, star: { pan: 0.45, send: 0.8, gain: 0.8 },
  },
  sec: {
    A: { mel: `3' - 2' 1' | 5 - - 6_ 1'_ | 2' - 3' 5' | 3' - - - | 6' - 5' 3' | 2' - 1'_ 2'_ 3' | 2'_ 1'_ 6 5 6 | 5 - - - |`, roots: '1, 5,, 2, 6,, 6,, 5,, 2,/5,, 5,,' },
    B: { mel: `6 - 5 3 | 5 - - 3_ 5_ | 6 1' 2' 3' | 2' - - - | 3' 5' 3' 2' | 1' - 6 5 | 6 1'_ 6_ 5 3 | 5 - - - |`, roots: '6,, 5,, 1, 2, 6,, 1, 2,/6,, 5,,' },
  },
  form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, E = b.E;
    bass(b, { pat: '0 . . . . . . .', vel: 0.26 });
    padChord(b, { vel: 0.3, a: 2, r: 2.5, color: 2 });
    arp(b, { pats: ['0 3 5 7 8 7 5 3 5 7 8 10 8 7 5 3', '5 7 8 7 5 3 5 7 8 10 8 7 5 7 8 7'], oct: 1, vel: 0.075, d: 0.9 });
    if (s === 'A') for (const n of b.notes) b.ev(n.t, (t) => I.bell(E, b.ch.lead, t, n.m, { kind: 'chime', vel: 0.36 }));
    else {
      lead(b, { inst: 'zheng', vel: 0.46, vib: 12, gliss: 0.3 });
      for (const n of b.notes) if (n.d >= 1) b.ev(n.t + 0.01, (t) => I.bell(E, b.ch.bell, t, n.m + 12, { kind: 'glass', vel: 0.14 }));
    }
    // 灯火闪烁：随机的高音琉璃声
    const k = 2 + ((b.rng() * 3) | 0);
    for (let i = 0; i < k; i++) {
      const beat = ((b.rng() * 16) | 0) / 4, m = b.S.step(b.S.g + 24, (b.rng() * 6) | 0);
      b.ev(b.at(beat), (t) => I.bell(E, b.ch.star, t, m, { kind: 'glass', vel: 0.07 + b.rng() * 0.06 }));
    }
    if (b.bi === 0) sweep(b, 0, b.S.g + 12, b.S.g + 36, 2, { vel: 0.12, dim: true, ch: 'acc' });
  },
};

// —— festival：1587 秦淮灯会。宫调，1=D，124 BPM；欢腾的锣鼓 + 唢呐 + 笙 ——
const G_BREAK = [ // 锣鼓经（每格八分音符）：仓=锣钹鼓齐奏、才=钹、台=小锣、冬=鼓
  { gong: 'x...x...', bo: 'x.x.x.x.', tanggu: 'x...x...' },
  { gong: 'x.x.....', bo: 'xxxx..x.', xiaoluo: '....xx..', tanggu: 'x.x...x.' },
  { tanggu: 'xx..x.xx', gong: '..x...x.', xiaoluo: '....x...', bo: '..x...x.' },
  { gong: 'x...x...', bo: 'x.x.x...', xiaoluo: '..x.....', tanggu: 'x.x.x.xx' },
];
export const festival = {
  bpm: 124, bpb: 4, gong: 62,
  ch: {
    lead: { pan: -0.08, send: 0.2, eq: [['highpass', 250, 0.7], ['peaking', 1300, 1.2, 5], ['peaking', 2900, 2, 3], ['lowpass', 5200, 0.7]] },
    acc: { pan: 0.3, send: 0.18, gain: 0.8 }, bass: { pan: 0, send: 0.1 }, perc: { pan: 0.05, send: 0.14 },
    gong: { pan: -0.2, send: 0.22, gain: 0.85 }, pad: { send: 0.3, gain: 0.8, eq: [['lowpass', 2600, 0.7]] }, bell: { pan: 0.4, send: 0.4 },
  },
  sec: {
    I: { roots: '1, 1,' },
    A: { mel: `1'_ 1'_ 6_ 5_ 6 1' | 5_ 6_ 5_ 3_ 2 3 | 5_ 5_ 3_ 5_ 6_ 1'_ 6_ 5_ | 2 3 5 0 | 1'_ 1'_ 6_ 5_ 6 1' | 2'_ 1'_ 6_ 5_ 6 5 | 3_ 5_ 2_ 3_ 1_ 2_ 6,_ 1_ | 1 1 1 0 |`, roots: '1, 5,, 1, 2,/5,, 1, 2,/5,, 6,,/5,, 1,' },
    B: { mel: `3' 3'_ 2'_ 1' 2' | 3'_ 5'_ 3'_ 2'_ 1' 0 | 6_ 1'_ 6_ 5_ 3 5 | 6 - - 0 | 3' 3'_ 2'_ 1' 2' | 3'_ 5'_ 6'_ 5'_ 3' 2' | 1'_ 2'_ 1'_ 6_ 5_ 6_ 5_ 3_ | 1 1 1 0 |`, roots: '1, 1, 6,, 6,, 1, 1,/5,, 2,/5,, 1,' },
    D: { roots: '1, 1, 5,, 1,' },
  },
  intro: ['I'], form: ['A', 'B', 'A', 'D'],
  bar(b) {
    const s = b.sec;
    if (s === 'D' || s === 'I') {
      const pat = G_BREAK[(b.bi + (s === 'I' ? 2 : 0)) % 4];
      drums(b, { tanggu: pat.tanggu || '', bo: pat.bo || '', xiaoluo: pat.xiaoluo || '' }, { vel: 0.5 });
      drums(b, { gong: pat.gong || '' }, { vel: 0.4, ch: 'gong', d: { gong: 0.9 } });
      bass(b, { pat: '0 . . . 0 . . .', vel: 0.4, d: 0.3 });
      if (b.bi % 2 === 0) padChord(b, { bars: 2, vel: 0.2, sheng: true, a: 0.3, r: 0.5 });
      if (b.last && s === 'D') sweep(b, 2, b.root, b.root + 24, 2, { vel: 0.3 });
      return;
    }
    bass(b, { pat: '0 . 0 3 0 . 3 0', vel: 0.38, d: 0.32 });
    arp(b, { pats: ['0 3 5 3 7 5 3 5 0 3 5 3 7 5 3 5', '. 3 5 7 . 3 5 7 . 3 5 7 5 7 8 7'], vel: 0.11, d: 0.2 });
    if (b.bi % 2 === 0) padChord(b, { bars: 2, vel: 0.24, sheng: true, a: 0.12, r: 0.4, color: 1 });
    drums(b, { tanggu: 'x..xx.x.x..xx.x.', bo: '..x...x...x...x.', xiaoluo: b.bi % 2 ? '....x.......x.x.' : '....x.......x...' }, { vel: 0.45 });
    if (b.bi % 4 === 0) drums(b, { gong: 'x...............' }, { vel: 0.35, ch: 'gong', d: { gong: 1.2 } });
    lead(b, { inst: 'suona', vel: 0.55, legato: 0.9, slide: 0.35 });
    if (s === 'B') lead(b, { inst: 'zheng', ch: 'acc', vel: 0.28, dbl: 0.4 });
    if (b.last) roll(b, 'tanggu', 3, 1, { n: 5, vel: 0.36 });
  },
  warm: { perc: ['tanggu', 'bo', 'xiaoluo', 'gong'] },
};
