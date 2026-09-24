// 金陵寻踪 · 曲目（二）：modern / hongwu / library / shipyard
import { lead, arp, bass, drums, roll, sweep, padChord, bellAt, hit } from './styles.js';
import * as I from './inst.js';

// —— modern：2026 黄昏的中华门。羽调（结束于 6），1=F，66 BPM；古筝流动分解 + 温暖铺底 ——
export const modern = {
  bpm: 66, bpb: 4, gong: 65,
  ch: {
    lead: { pan: -0.1, send: 0.4 }, acc: { pan: 0.25, send: 0.38, gain: 0.8 }, bass: { pan: 0, send: 0.25 },
    ctr: { pan: 0.25, send: 0.45 }, pad: { send: 0.55, gain: 0.9, eq: [['lowpass', 1300, 0.7]] }, bell: { pan: -0.35, send: 0.6 },
  },
  sec: {
    I: { roots: '6,, 5,,' },
    A: { mel: `3' - 2'_ 1'_ 6 | 5 - - 6_ 1'_ | 2' - 1'_ 2'_ 3' | 2' - - - | 3' - 5'_ 3'_ 2' | 1' - 6_ 1'_ 2' | 1'_ 6_ 5 6 1' | 6 - - - |`, roots: '6,, 5,, 1, 5,, 6,, 2, 5,, 6,,' },
    B: { mel: `1' 2'_ 3'_ 5' 3' | 2' - - 1'_ 6_ | 5 6_ 1'_ 2' 3' | 3' - - - | 5' - 3'_ 2'_ 1' | 2' 3'_ 2'_ 1' 6 | 5 6_ 1'_ 6 5 | 6 - - - |`, roots: '1, 2, 5,, 6,, 1, 2, 5,, 6,,' },
  },
  intro: ['I'], form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, second = b.fi >= 2;
    bass(b, { pat: '0 . . . . . 3 .', vel: 0.32 });
    arp(b, { pats: ['0 3 5 7 8 7 5 3 0 3 5 7 8 7 5 3', '0 3 5 3 7 5 8 5 0 3 5 3 7 5 8 5', '0 5 3 5 7 5 3 5 0 5 3 5 8 7 5 3'], vel: 0.14, d: 1.1 });
    padChord(b, { vel: 0.3, a: 1.4, r: 2, color: s === 'B' ? 2 : 1 });
    if (s === 'I') { if (b.bi === 0) bellAt(b, 0, b.S.g + 21, { kind: 'chime', vel: 0.15 }); return; }
    lead(b, { inst: 'zheng', vel: 0.52, vib: 14, bendEnd: 0.35, dbl: 0.1 });
    if (s === 'B' || second) lead(b, { inst: 'xiao', ch: 'ctr', oct: -1, vel: s === 'B' ? 0.38 : 0.28, slide: 0.5 });
    if (b.bi === 0) bellAt(b, 0, b.S.g + 26, { kind: 'chime', vel: 0.12 });
    if (b.last && s === 'B') sweep(b, 2, b.root + 12, b.root + 36, 1.6, { vel: 0.18, dim: true });
  },
};

// —— hongwu：1377 聚宝门工地。宫调，1=C，108 BPM；堂鼓 + 梆子，琵琶领奏，号子式一唱众和 ——
export const hongwu = {
  bpm: 108, bpb: 4, gong: 60,
  ch: {
    lead: { pan: -0.12, send: 0.2 }, acc: { pan: 0.3, send: 0.18, gain: 0.8 }, bass: { pan: 0, send: 0.12 },
    perc: { pan: 0.05, send: 0.12 }, work: { pan: 0.45, send: 0.3, gain: 0.9 }, bell: { pan: -0.4, send: 0.4 },
  },
  sec: {
    I: { roots: '1,' },
    A: { mel: `1 1_ 2_ 3 5 | 6_ 5_ 3_ 2_ 1 0 | 3 3_ 5_ 6 1' | 5 - 6_ 5_ 3 | 2 2_ 3_ 5 3 | 2_ 1_ 6,_ 1_ 2 0 | 3_ 5_ 3_ 2_ 1_ 2_ 3_ 5_ | 1 - 1 0 |`, roots: '1, 6,, 1, 5,, 2, 6,,/5,, 1,/5,, 1,' },
    B: { mel: `5 5_ 6_ 1' 6 | 5 - 3 0 | 0 - - - | 0 - - - | 6 6_ 1'_ 2' 1' | 6 - 5 0 | 3_ 5_ 6_ 5_ 3_ 2_ 1_ 2_ | 1 - - 0 |`, roots: '1, 1, 1, 5,, 6,, 2, 5,, 1,' },
  },
  intro: ['I'], form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, answer = s === 'B' && (b.bi === 2 || b.bi === 3), alt = b.loop % 2;
    bass(b, { pat: '0 . 0 . 3 . 0 .', vel: 0.4, d: 0.45 });
    if (!answer) arp(b, { pats: ['. 3 5 3 . 3 5 3', '. 5 3 5 . 5 7 5'], vel: 0.16, d: 0.3 });
    drums(b, { tanggu: answer ? 'x.x.x.xxx...x...' : 'x..x..x.x.x.x...', bang: '..x...x...x...x.', paiban: answer ? '' : '....o.......o...' }, { vel: 0.5 });
    if (answer) { // 众人应和：石工錾子 + 夯声
      drums(b, { chisel: 'x.x.x.x.x...x...', thud: 'x.......x.......', xiaoluo: b.bi === 3 ? '............x...' : '' }, { vel: 0.45, ch: 'work' });
      arp(b, { pat: '0 . 0 . 3 . 0 .', vel: 0.3, inst: 'pipa', ch: 'acc', d: 0.2 });
    }
    if (s === 'I') { roll(b, 'tanggu', 2, 2, { n: 6, vel: 0.4 }); return; }
    lead(b, { inst: 'pipa', vel: 0.58, trem: 2, dbl: 0.15 });
    if (alt && s === 'A') lead(b, { inst: 'zheng', ch: 'acc', oct: 1, vel: 0.22 });
    if (b.bi === 0) hit(b, 0, 'xiaoluo', { vel: 0.25 });
    if (b.last) roll(b, 'tanggu', 3, 1, { n: 4, vel: 0.35 });
  },
  warm: { perc: ['tanggu', 'bang', 'paiban', 'chisel', 'thud', 'xiaoluo'], pipa: [60, 62, 64, 67, 69, 72, 74, 76, 79, 81] },
};

// —— library：1407 文渊阁。商调（结束于 2），1=C，58 BPM；古琴散板式旋律 + 泛音 + 偶尔一声磬 ——
export const library = {
  bpm: 58, bpb: 4, gong: 60,
  ch: {
    lead: { pan: -0.05, send: 0.35 }, harm: { pan: 0.2, send: 0.5 }, bass: { pan: 0, send: 0.3 },
    pad: { send: 0.5, gain: 0.7, eq: [['lowpass', 900, 0.7]] }, bell: { pan: 0.4, send: 0.65 },
  },
  sec: {
    A: { mel: `2, - - 5,_ 6,_ | 1/ - 6, 5, | 6, - 5,_ 3,_ 2, | 2, - - - | 5, - 6,_ 1_ 2 | 3 - 2_ 1_ 6, | 1 2_ 1_ 6, 5, | 6,_ 5,_ 3, 2, - |`, roots: '2, 2, 6,, 2, 5,, 6,, 1, 2,' },
    B: { mel: `6 - 5_ 3_ 2 | 3 - - 5_ 6_ | 1' - 6 5 | 6 - - - | 5 - 3_ 2_ 1 | 2 - 3 5 | 3_ 2_ 1 6, 1 | 2 - - - |`, roots: '2, 6,, 2, 6,, 5,, 2, 6,, 2,' },
  },
  form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, E = b.E;
    if (b.bi % 2 === 0) { const r = b.root; b.ev(b.t, (t) => I.qin(E, b.ch.bass, t, r, { vel: 0.4 })); }
    if (b.bi % 4 === 0) b.ev(b.t, (t) => I.drone(E, b.ch.pad, t, b.root, b.bpb * b.spb * 4, { vel: 0.35, a: 2.5, r: 3 }));
    if (s === 'A') lead(b, { inst: 'qin', vel: 0.62, vib: 10, bendEnd: 0.5 });
    else {
      for (const n of b.notes) b.ev(n.t, (t) => I.bell(E, b.ch.harm, t, n.m, { kind: 'glass', vel: 0.34 }));
      if (b.rng() < 0.5) arp(b, { pat: '. . 3 . . . 5 .', inst: 'qin', ch: 'bass', vel: 0.22 });
    }
    if (b.bi === 0 || (b.bi === 4 && b.rng() < 0.5)) bellAt(b, 0, b.S.g + 2, { kind: 'qing', vel: 0.16 });
  },
  warm: { zheng: false, qin: [38, 43, 45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69], bell: [['qing', 62]] },
};

// —— shipyard：1415 宝船厂。徵调（结束于 5），1=D，118 BPM；锤击动机 + 笛子领奏 ——
export const shipyard = {
  bpm: 118, bpb: 4, gong: 62,
  ch: {
    lead: { pan: -0.12, send: 0.22 }, acc: { pan: 0.3, send: 0.2, gain: 0.8 }, bass: { pan: 0, send: 0.12 },
    perc: { pan: 0.05, send: 0.12 }, work: { pan: -0.4, send: 0.3 }, bell: { pan: 0.4, send: 0.4 },
  },
  sec: {
    I: { roots: '5, 5,' },
    A: { mel: `5 6_ 5_ 3 2_ 3_ | 5 5_ 6_ 1' 6 | 5_ 6_ 5_ 3_ 2 1 | 2 - 3_ 5_ 6 | 5 6_ 5_ 3 2_ 3_ | 5 5_ 6_ 1' 2' | 1'_ 6_ 5_ 6_ 3 2_ 3_ | 5 - - 0 |`, roots: '5, 1, 5,/2, 2,/6, 5, 1, 6,/2, 5,' },
    B: { mel: `1' 1'_ 2'_ 1' 6 | 5 6 5 0 | 3_ 5_ 6_ 1'_ 6 5 | 6 - - 0 | 1' 1'_ 2'_ 3' 2' | 1'_ 2'_ 1'_ 6_ 5 6 | 3_ 2_ 3_ 5_ 6_ 5_ 3_ 2_ | 5 - - 0 |`, roots: '1, 5, 1,/5, 6, 1, 1,/5, 6,/5, 5,' },
  },
  intro: ['I'], form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, alt = b.loop % 2;
    bass(b, { pat: '0 . 0 3 . 0 3 .', vel: 0.4, d: 0.4 });
    arp(b, { pats: ['0 3 5 3 0 3 5 3 0 3 5 3 7 5 3 5', '. 3 5 7 . 3 5 7 . 3 5 7 5 3 5 3'], vel: 0.13, d: 0.22 });
    // 锤击动机（3+3+2）：船匠的号子节奏
    drums(b, { thud: 'x..x..x.x..x..x.', rim: 'x..x..x.........', chisel: alt ? '......x.......x.' : '' }, { vel: 0.42, ch: 'work' });
    drums(b, { tanggu: 'x.......x...o.o.', bang: '..o...o...o...o.' }, { vel: 0.45 });
    if (s === 'I') { if (b.bi === 1) sweep(b, 2, b.root, b.root + 24, 1.5, { vel: 0.28 }); return; }
    lead(b, { inst: 'dizi', oct: 1, vel: 0.5, legato: 0.85, slide: 0.3 });
    if (s === 'B') lead(b, { inst: 'zheng', ch: 'acc', vel: 0.3, dbl: 0.3 });
    if (b.bi === 0) hit(b, 0, s === 'B' ? 'bo' : 'xiaoluo', { vel: 0.22 });
    if (b.last) roll(b, 'tanggu', 3, 1, { n: 4, vel: 0.35 });
  },
  warm: { perc: ['thud', 'rim', 'chisel', 'tanggu', 'bang', 'xiaoluo', 'bo'] },
};
