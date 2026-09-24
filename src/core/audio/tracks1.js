// 金陵寻踪 · 曲目（一）：title 茉莉花 / level / level2 / map
// 简谱记号见 seq.js。根音串每小节一个（"a/b" 为前后半小节）。
import { lead, arp, bass, drums, roll, sweep, padChord, bellAt, hit } from './styles.js';

// 茉莉花（江苏民歌，六合；传统曲目）。1=D，2/4，徵调式（结束于 5）。按乐句拆开，供 ending / home 复用
export const MOLI_P = [
  `3 3_ 5_ | 6_ 1'_ 1'_ 6_ | 5 5_ 6_ | 5 - |`,
  `3 3_ 5_ | 6_ 1'_^ 1'_ 6_ | 5 5_ 6_ | 5 - |`,
  `5 5 | 5 3_ 5_ | 6 6^ | 5 - |`,
  `3 2_ 3_ | 5 3_ 2_ | 1 1_ 2_ | 1 - |`,
  `3_ 2_ 1_ 3_ | 2. 3_ | 5 6_ 1'_ | 5 - |`,
  `2_ 3_ 5_ 2_ | 3_ 2_ 1 | 6, 5, | - - |`,
  `6,_ 1_ 2_ 3_ | 1_ 2_ 1_ 6,_ | 5, - | - - |`,
];
export const MOLI_R = ['1, 6,, 5,, 1,', '1, 6,, 5,, 1,', '1, 6,, 2, 5,,', '6,, 5,, 6,, 1,', '1, 5,, 6,, 1,', '5,, 6,, 2, 5,,', '6,, 1, 5,, 5,,'];
const MOLIHUA = MOLI_P.join(' ');
const MOLI_ROOTS = MOLI_R.join(' ');
// 箫的对位旋律（长音，与主旋律反向进行）
export const MOLI_CTR_A = `
  0 - | 0 - | 0 - | 0 - | 0 - | 0 - | 0 - | 0 - |
  3 - | 1 - | 2. 3_ | 2 - | 6, - | 2 - | 3 - | 5, - |
  1 - | 5, - | 3 - | 2_ 3_ 2 | 5, - | 6, - | 1 - | 2 - | 3 - | 5 - | 2. 1_ | 2 - |`;
export const MOLI_CTR_B = `
  1 - | 6, - | 5, - | 1 - | 3 - | 1 - | 2 - | 3_ 2_ 1 |
  3 - | 1 - | 2. 3_ | 2 - | 6, - | 2 - | 3 - | 5, - |
  1 - | 5, - | 3 - | 2_ 3_ 2 | 5, - | 6, - | 1 - | 2 - | 3 - | 5 - | 2. 1_ | 2 - |`;

export const title = {
  bpm: 58, bpb: 2, gong: 62,
  ch: {
    lead: { pan: -0.08, send: 0.4 }, acc: { pan: 0.3, send: 0.36, gain: 0.8 }, bass: { pan: 0.05, send: 0.25 },
    ctr: { pan: 0.22, send: 0.45 }, pad: { send: 0.5, gain: 0.8, eq: [['lowpass', 1500, 0.7]] }, bell: { pan: -0.35, send: 0.6 },
  },
  sec: {
    I: { roots: '1, 6,, 5,, 5,,', mel2: '0 - | 0 - | 5 - | - - |' },
    A: { mel: MOLIHUA, mel2: MOLI_CTR_A, roots: MOLI_ROOTS },
    B: { mel: MOLIHUA, mel2: MOLI_CTR_B, roots: MOLI_ROOTS },
  },
  intro: ['I'], form: ['A', 'B'],
  bar(b) {
    const s = b.sec;
    bass(b, { pat: b.rng() < 0.6 ? '0 . . .' : '0 . 3 .', vel: 0.36 });
    if (s === 'B') arp(b, { pats: ['0 3 5 7 8 7 5 3', '0 3 5 3 7 5 3 5', '. 3 5 7 5 3 5 7'], vel: 0.16, d: 0.9 });
    else arp(b, { pats: ['. 3 5 3', '. 3 5 7', '. 5 3 5'], vel: 0.2 });
    if (s === 'I') {
      if (b.bi === 0) { sweep(b, 0, b.root, b.root + 24, 1.4, { vel: 0.3 }); bellAt(b, 1.5, b.S.g + 19, { kind: 'chime', vel: 0.22 }); }
      lead(b, { notes: b.notes2, inst: 'xiao', ch: 'ctr', vel: 0.5 });
      return;
    }
    if (s === 'A') lead(b, { inst: 'zheng', vel: 0.64, gliss: 0.35, dbl: 0.12, bendEnd: 0.45 });
    else lead(b, { inst: 'zheng', oct: 1, vel: 0.5, gliss: 0.25, dbl: 0.4, vib: 12 });
    lead(b, { notes: b.notes2, inst: 'xiao', ch: 'ctr', oct: s === 'A' ? 1 : 0, vel: s === 'A' ? 0.34 : 0.55, slide: 0.6 });
    if (s === 'B') padChord(b, { vel: 0.3, a: 0.9, r: 1.4 });
    if (b.bi === 0 && s === 'B') { sweep(b, 0, b.root + 12, b.root + 31, 0.9, { vel: 0.22 }); bellAt(b, 0, b.S.g + 24, { kind: 'chime', vel: 0.18 }); }
    if (b.bi === 27) bellAt(b, 0, b.S.g + 7, { kind: 'qing', vel: 0.16 });
  },
  warm: { perc: [] },
};

// —— level：轻快的消除关卡曲，宫调，1=F，112 BPM ——
export const level = {
  bpm: 112, bpb: 4, gong: 65,
  ch: {
    lead: { pan: -0.1, send: 0.22 }, acc: { pan: 0.32, send: 0.2, gain: 0.85 }, bass: { pan: 0, send: 0.1 },
    perc: { pan: 0.08, send: 0.1 }, hi: { pan: -0.35, send: 0.14, gain: 0.8 }, bell: { pan: 0.4, send: 0.4 },
  },
  sec: {
    I: { roots: '1, 1,' },
    A: {
      mel: `1_ 2_ 3_ 5_ 6 5_ 3_ | 2_ 3_ 2_ 1_ 6,_ 1_ 2 | 3_ 5_ 6_ 1'_ 6_ 5_ 3_ 5_ | 6 5 2 - |
            1_ 2_ 3_ 5_ 6 5_ 3_ | 2_ 3_ 2_ 1_ 6,_ 5,_ 6, | 1_ 2_ 3_ 5_ 2_ 3_ 2_ 6,_ | 1 - 0_ 5,_ 6,_ 1_ |`,
      roots: '1, 2, 1, 5,, 1, 6,, 6,,/5,, 1,',
    },
    B: {
      mel: `5_ 6_ 5_ 3_ 5 1' | 6_ 1'_ 6_ 5_ 3 2 | 3_ 5_ 3_ 2_ 1_ 2_ 3_ 5_ | 6 - 5 0 |
            5_ 6_ 5_ 3_ 5 1' | 2'_ 1'_ 6_ 5_ 6 1' | 5_ 3_ 2_ 3_ 5_ 6_ 2_ 3_ | 1 - - 0 |`,
      roots: '1, 6,, 1, 2,/5,, 1, 2,/6,, 5,, 1,',
    },
    C: {
      mel: `3 5_ 6_ 5 3 | 2 3_ 2_ 1 6, | 1_ 1_ 2_ 3_ 5 6_ 5_ | 3 - - 0 |
            6 1'_ 6_ 5 3 | 2_ 3_ 5_ 3_ 2 1 | 6,_ 1_ 2_ 3_ 5_ 3_ 2_ 3_ | 1 - - 0 |`,
      roots: '6,, 2, 1, 1, 6,, 5,, 6,,/2, 1,',
    },
  },
  intro: ['I'], form: ['A', 'B', 'A', 'C'],
  bar(b) {
    const s = b.sec, alt = b.loop % 2 === 1;
    bass(b, { pat: '0 . . 3 0 . 3 .', vel: 0.4, d: 0.5 });
    arp(b, { pats: ['. 3 5 3 . 3 5 7', '. 5 3 5 . 5 7 5', '. 3 5 7 . 7 5 3'], vel: s === 'C' ? 0.15 : 0.19, d: 0.32 });
    if (s === 'C') drums(b, { bang: '..o...o...o.o.o.', muyu: 'o.......o.......' }, { vel: 0.5 });
    else drums(b, { tanggu: 'x.....o.x.......', paiban: '....o.......o...', bang: alt ? '..o...o...o...oo' : '..o...o...o...o.' }, { vel: 0.5 });
    if (s === 'I') { if (b.bi === 1) sweep(b, 2, b.root, b.root + 24, 1.6, { vel: 0.3 }); return; }
    if (s === 'A') lead(b, { inst: 'zheng', vel: 0.6, gliss: 0.3, dbl: alt ? 0.3 : 0 });
    if (s === 'B') { lead(b, { inst: 'zheng', vel: 0.56, dbl: 0.45 }); if (alt) lead(b, { inst: 'dizi', ch: 'hi', vel: 0.35, legato: 0.8 }); }
    if (s === 'C') lead(b, { inst: 'pipa', vel: 0.55, trem: 2 });
    if (b.last) roll(b, 'tanggu', 3, 1, { n: 4, vel: 0.32 });
    if (b.bi === 0 && s === 'B') { hit(b, 0, 'xiaoluo', { vel: 0.22 }); bellAt(b, 0, b.S.g + 24, { vel: 0.14 }); }
  },
  warm: { perc: ['tanggu', 'paiban', 'bang', 'muyu', 'xiaoluo'], pipa: [65, 67, 69, 72, 74, 77, 79, 81] },
};

// —— level2：徵调（结束于 5），1=D，120 BPM，更有冲劲：琵琶领奏 + 堂鼓八分 ——
export const level2 = {
  bpm: 120, bpb: 4, gong: 62,
  ch: {
    lead: { pan: -0.12, send: 0.2 }, acc: { pan: 0.3, send: 0.18, gain: 0.8 }, bass: { pan: 0, send: 0.1 },
    perc: { pan: 0.06, send: 0.1 }, hi: { pan: 0.35, send: 0.16, gain: 0.8 }, bell: { pan: -0.4, send: 0.4 },
  },
  sec: {
    I: { roots: '5,' },
    A: {
      mel: `5 6_ 1'_ 5 3_ 2_ | 3_ 5_ 6_ 5_ 3 - | 2_ 3_ 5_ 6_ 1'_ 6_ 5_ 3_ | 2_ 3_ 2_ 1_ 2 - |
            5 6_ 1'_ 5 3_ 2_ | 3_ 5_ 6_ 1'_ 2' 1'_ 6_ | 5_ 6_ 5_ 3_ 2_ 3_ 1_ 2_ | 5 - 5_ 6_ 1'_ 2'_ |`,
      roots: '5, 6, 2, 5, 5, 6,/2, 1,/5, 5,',
    },
    B: {
      mel: `1'_ 1'_ 6_ 1'_ 2' 1' | 6_ 5_ 3_ 5_ 6 - | 5_ 5_ 3_ 5_ 6_ 1'_ 6_ 5_ | 3 2_ 3_ 5 0 |
            1'_ 1'_ 6_ 1'_ 2' 3' | 2'_ 1'_ 6_ 5_ 6 1' | 2_ 3_ 5_ 6_ 5_ 3_ 2_ 3_ | 5 - - 0 |`,
      roots: '1, 6, 1, 6,/5, 1, 2,/6, 5, 5,',
    },
    C: {
      mel: `6 - 5_ 6_ 1' | 2' 1'_ 6_ 5 - | 3_ 5_ 6_ 5_ 3 2 | 1 2 3 - |
            6 - 5_ 6_ 1' | 2'_ 3'_ 2'_ 1'_ 6 5 | 3_ 2_ 3_ 5_ 6_ 5_ 2_ 3_ | 5 - - 0 |`,
      roots: '6, 2,/5, 6, 1, 6, 2,/5, 6,/2, 5,',
    },
  },
  intro: ['I'], form: ['A', 'B', 'A', 'C'],
  bar(b) {
    const s = b.sec, alt = b.loop % 2 === 1;
    bass(b, { pat: '0 . 0 3 . 3 0 .', vel: 0.4, d: 0.45 });
    arp(b, { pats: ['0 3 5 3 7 5 3 5 0 3 5 3 7 5 3 5', '. 3 5 7 5 3 5 7 . 3 5 7 5 3 5 7'], vel: 0.14, d: 0.25 });
    drums(b, { tanggu: s === 'C' ? 'x.......x...o...' : 'x...o.o.x...o.oo', bangu: '....x.......x.x.', bang: '..o...o...o...o.' }, { vel: 0.5 });
    if (s === 'I') { roll(b, 'tanggu', 2, 2, { n: 8, vel: 0.4 }); sweep(b, 2, b.root, b.root + 24, 1.8, { vel: 0.28 }); return; }
    if (b.bi === 0) hit(b, 0, s === 'B' ? 'bo' : 'xiaoluo', { vel: s === 'B' ? 0.2 : 0.25 });
    if (s === 'C') { lead(b, { inst: 'zheng', vel: 0.6, dbl: 0.3, gliss: 0.3 }); lead(b, { inst: 'dizi', ch: 'hi', oct: 1, vel: 0.3 }); }
    else lead(b, { inst: 'pipa', vel: 0.58, trem: alt ? 1.5 : 2, dbl: 0.2 });
    if (s === 'B' && alt) lead(b, { inst: 'zheng', ch: 'hi', oct: 1, vel: 0.3 });
    if (b.last) roll(b, 'tanggu', 2, 2, { n: 8, vel: 0.36 });
  },
  warm: { perc: ['tanggu', 'bangu', 'bang', 'xiaoluo', 'bo'], pipa: [62, 64, 66, 69, 71, 74, 76, 78, 81] },
};

// —— map：场景间的平和明亮小曲，宫调，1=G，84 BPM，笛子 + 古筝分解 ——
export const map = {
  bpm: 84, bpb: 4, gong: 67,
  ch: {
    lead: { pan: -0.12, send: 0.32 }, acc: { pan: 0.28, send: 0.3, gain: 0.8 }, bass: { pan: 0, send: 0.18 },
    perc: { pan: 0.2, send: 0.2 }, pad: { send: 0.45, gain: 0.7, eq: [['lowpass', 1800, 0.7]] }, bell: { pan: -0.4, send: 0.55 },
  },
  sec: {
    A: {
      mel: `5 - 6_ 5_ 3 | 2 - 3 5 | 6 1'_ 6_ 5 3 | 5 - - - | 3 - 5_ 3_ 2 | 1 - 2 3 | 5 6_ 5_ 3 2 | 1 - - - |`,
      roots: '1, 5,, 6,, 5,, 1, 6,, 2,/5,, 1,',
    },
    B: {
      mel: `6 - 1' 6 | 5 6_ 5_ 3 - | 2 3_ 5_ 6 5 | 3 - - - | 6 - 1' 2' | 1'_ 2'_ 1'_ 6_ 5 - | 3 5_ 6_ 5 2 | 1 - - - |`,
      roots: '6,, 1, 5,, 6,, 2, 1,/5,, 6,,/5,, 1,',
    },
  },
  form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, v = (b.fi + b.loop) % 2;
    bass(b, { pat: '0 . . . 3 . . .', vel: 0.34 });
    arp(b, { pats: ['0 3 5 3 7 5 3 5', '0 3 5 7 5 3 5 3', '. 3 5 3 . 5 7 5'], vel: 0.17, d: 0.8 });
    if (b.bi % 2 === 0) padChord(b, { bars: 2, vel: 0.22, a: 1.4, r: 1.8 });
    drums(b, { muyu: v ? '....o.......o...' : '....o.......o.g.' }, { vel: 0.3 });
    if (v === 0) lead(b, { inst: 'dizi', vel: 0.42, oct: s === 'B' ? 0 : 0, slide: 0.35 });
    else lead(b, { inst: 'zheng', vel: 0.55, oct: 1, gliss: 0.4, dbl: 0.3 });
    if (b.bi === 0) bellAt(b, 0, b.S.g + 24, { kind: 'chime', vel: 0.14 });
    if (b.last && s === 'B') sweep(b, 2, b.root + 12, b.root + 36, 1.5, { vel: 0.2, dim: true });
  },
  warm: { perc: ['muyu'] },
};
