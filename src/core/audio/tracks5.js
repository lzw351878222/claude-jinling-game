// 金陵寻踪 · 曲目（五）：ending / minigame / home / sea
import { lead, arp, bass, drums, roll, sweep, padChord, bellAt, hit } from './styles.js';
import { MOLI_P, MOLI_R, MOLI_CTR_A, MOLI_CTR_B } from './tracks1.js';
import * as I from './inst.js';

const ERHU_EQ = [['highpass', 190, 0.7], ['peaking', 820, 1.4, 5], ['peaking', 2100, 1.6, 3], ['lowpass', 4800, 0.7]];
const MOLIHUA = MOLI_P.join(' '), MOLI_ROOTS = MOLI_R.join(' ');

// —— ending：片尾。茉莉花的温暖完整编配，1=F，66 BPM：第一遍二胡领奏，第二遍笛子 + 笙，轻柔打击乐 ——
export const ending = {
  bpm: 66, bpb: 2, gong: 65,
  ch: {
    lead: { pan: -0.08, send: 0.36, eq: ERHU_EQ }, hi: { pan: 0.15, send: 0.35 }, acc: { pan: 0.3, send: 0.32, gain: 0.8 }, bass: { pan: 0, send: 0.22 },
    ctr: { pan: -0.3, send: 0.36, gain: 0.85 }, pad: { send: 0.45, gain: 0.85, eq: [['lowpass', 2000, 0.7]] }, perc: { pan: 0.12, send: 0.22 }, bell: { pan: 0.4, send: 0.55 },
  },
  sec: {
    I: { roots: '1, 6,, 5,, 5,,' },
    A: { mel: MOLIHUA, mel2: MOLI_CTR_B, roots: MOLI_ROOTS },
    B: { mel: MOLIHUA, mel2: MOLI_CTR_A, roots: MOLI_ROOTS },
  },
  intro: ['I'], form: ['A', 'B'],
  bar(b) {
    const s = b.sec;
    bass(b, { pat: b.rng() < 0.5 ? '0 . 3 .' : '0 . . 3', vel: 0.36 });
    arp(b, { pats: s === 'B' ? ['0 3 5 7 8 7 5 3', '0 3 5 3 7 5 3 5'] : ['. 3 5 3', '. 3 5 7'], vel: 0.15, d: 0.9 });
    padChord(b, { vel: s === 'B' ? 0.26 : 0.2, sheng: s === 'B', a: 0.8, r: 1.2 });
    drums(b, { tanggu: 'o...', muyu: s === 'B' ? '..o.' : '..g.' }, { vel: 0.3 });
    if (s === 'I') {
      if (b.bi === 0) { sweep(b, 0, b.root, b.root + 24, 1.4, { vel: 0.28 }); bellAt(b, 1, b.S.g + 24, { kind: 'chime', vel: 0.18 }); }
      return;
    }
    if (s === 'A') {
      lead(b, { inst: 'erhu', vel: 0.58, legato: 0.99, slide: 0.55, vib: 18 });
      if (b.bi >= 8) lead(b, { notes: b.notes2, inst: 'zheng', ch: 'ctr', vel: 0.34 });
    } else {
      lead(b, { inst: 'dizi', ch: 'hi', oct: 1, vel: 0.46, legato: 0.92, slide: 0.35 });
      lead(b, { inst: 'zheng', ch: 'acc', vel: 0.3, dbl: 0.3 });
      lead(b, { notes: b.notes2, inst: 'erhu', vel: 0.36, legato: 0.99, slide: 0.5 });
    }
    if (b.bi % 4 === 0) hit(b, 0, 'xiaoluo', { vel: 0.12 });
    if (b.bi === 0) bellAt(b, 0, b.S.g + 24, { kind: 'chime', vel: 0.16 });
    if (b.last && s === 'B') sweep(b, 1, b.root, b.root + 36, 1, { vel: 0.26 });
  },
  warm: { perc: ['tanggu', 'muyu', 'xiaoluo'] },
};

// —— minigame：轻巧的解谜小曲。宫调，1=G，100 BPM；木鱼梆子 + 断奏古筝，一问一答 ——
export const minigame = {
  bpm: 100, bpb: 4, gong: 67,
  ch: {
    lead: { pan: -0.1, send: 0.2 }, acc: { pan: 0.3, send: 0.18, gain: 0.8 }, bass: { pan: 0, send: 0.1 },
    perc: { pan: 0.15, send: 0.15 }, wood: { pan: -0.35, send: 0.2 }, bell: { pan: 0.4, send: 0.45 },
  },
  sec: {
    A: { mel: `5_ 0_ 5_ 6_ 5 3 | 2_ 3_ 0_ 2_ 1 0 | 3_ 0_ 3_ 5_ 6_ 5_ 3_ 2_ | 1_ 2_ 3_ 1_ 2 0 | 5_ 0_ 5_ 6_ 5 3 | 6_ 1'_ 0_ 6_ 5 0 | 3_ 5_ 2_ 3_ 1_ 2_ 6,_ 2_ | 1 0 1' 0 |`, roots: '1, 5,, 1, 2,/5,, 1, 2,/1, 6,,/5,, 1,' },
    B: { mel: `1'_ 1'_ 0 6_ 5_ 0 | 0 - - - | 6_ 6_ 0 5_ 3_ 0 | 0 - - - | 3_ 5_ 6_ 1'_ 2'_ 1'_ 6_ 5_ | 3_ 5_ 3_ 2_ 1 0 | 2_ 3_ 5_ 3_ 2_ 1_ 6,_ 1_ | 1 - 0 0 |`, roots: '1, 1, 6,, 6,, 1, 1,/5,, 5,, 1,' },
  },
  form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, answer = s === 'B' && (b.bi === 1 || b.bi === 3);
    bass(b, { pat: '0 . 3 . 0 . 3 .', vel: 0.36, d: 0.2 });
    if (!answer) arp(b, { pats: ['. 3 . 5 . 3 . 5', '. 5 . 3 . 5 . 7'], vel: 0.14, d: 0.15 });
    if (answer) {
      drums(b, { bang: b.bi === 1 ? 'x.x.xx..x.x.x...' : 'x..x..x.x.xx....', muyu: '....x.......x.x.' }, { vel: 0.45, ch: 'wood' });
      b.ev(b.at(3.5), (t) => I.bell(b.E, b.ch.bell, t, b.S.g + 24 + (b.bi === 3 ? 7 : 4), { kind: 'glass', vel: 0.16 }));
    } else drums(b, { bang: '..x...x...x...x.', muyu: 'x.......x.o.....' }, { vel: 0.4 });
    lead(b, { inst: 'zheng', vel: 0.55, d: 0.22 });
    if (b.loop % 2 && s === 'A') lead(b, { inst: 'pipa', ch: 'acc', oct: 1, vel: 0.2, d: 0.15 });
    if (b.last) hit(b, 2, 'bang', { vel: 0.3, rate: 1.3 });
  },
  warm: { perc: ['bang', 'muyu'] },
};

// —— home：尾声，2026 的夜。1=C，54 BPM；如回忆般稀疏地重现茉莉花（音乐盒似的高音古筝 + 琉璃泛音）——
export const home = {
  bpm: 54, bpb: 2, gong: 60,
  ch: {
    lead: { pan: -0.1, send: 0.5 }, glass: { pan: 0.25, send: 0.6, gain: 0.8 }, acc: { pan: 0.3, send: 0.45, gain: 0.7 }, bass: { pan: 0, send: 0.3 },
    ctr: { pan: 0.2, send: 0.5 }, pad: { send: 0.55, gain: 0.8, eq: [['lowpass', 1100, 0.7]] },
  },
  sec: {
    A: { mel: MOLI_P.slice(0, 4).join(' '), roots: MOLI_R.slice(0, 4).join(' ') },
    B: { mel: MOLI_P.slice(4).join(' '), roots: MOLI_R.slice(4).join(' ') },
  },
  form: ['A', 'B'],
  bar(b) {
    const s = b.sec, E = b.E;
    if (b.bi % 2 === 0) bass(b, { pat: '0 . . .', vel: 0.26 });
    arp(b, { pats: ['. 3 . 5', '. 5 . 3', '. . 3 .'], vel: 0.12, d: 1.2 });
    if (b.bi % 2 === 0) padChord(b, { bars: 2, vel: 0.22, a: 1.8, r: 2.4 });
    if (s === 'A' || b.loop % 2 === 0) {
      lead(b, { inst: 'zheng', oct: 1, vel: 0.42, vib: 10, bendEnd: 0.3 });
      for (const n of b.notes) if (n.d >= 1) b.ev(n.t + 0.005, (t) => I.bell(E, b.ch.glass, t, n.m + 24, { kind: 'glass', vel: 0.08 }));
    } else lead(b, { inst: 'xiao', ch: 'ctr', vel: 0.45, legato: 0.98, slide: 0.55 });
  },
};

// —— sea：航海。羽调（结束于 6），1=F，3/4 拍 60 BPM；宽广流动的古筝刮奏（浪）+ 低音持续音 ——
export const sea = {
  bpm: 60, bpb: 3, gong: 65,
  ch: {
    lead: { pan: -0.1, send: 0.4 }, acc: { pan: 0.3, send: 0.4, gain: 0.75 }, wave: { pan: -0.3, send: 0.5, gain: 0.8 }, bass: { pan: 0, send: 0.25 },
    ctr: { pan: 0.2, send: 0.45 }, pad: { send: 0.5, gain: 0.9, eq: [['lowpass', 900, 0.7]] }, bell: { pan: 0.4, send: 0.6 },
  },
  sec: {
    A: { mel: `6, - 1 | 2 - 3 | 5 - 3_ 2_ | 3 - - | 6, - 1 | 2 3 5 | 3 - 2_ 1_ | 6, - - |`, roots: '6,, 2, 1, 6,, 6,, 2, 5,, 6,,' },
    B: { mel: `6 - 5 | 3 - 5 | 6 - 1' | 2' - - | 3' - 2'_ 1'_ | 6 - 5 | 3 - 2_ 3_ | 6, - - |`, roots: '6,, 1, 6,, 2, 1, 6,, 5,, 6,,' },
  },
  form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec, E = b.E, r = b.root;
    arp(b, { pats: ['0 3 5 7 5 3', '0 5 3 5 7 5', '0 3 5 8 7 5'], vel: 0.14, d: 1.2 });
    if (b.bi % 4 === 0) b.ev(b.t, (t) => I.drone(E, b.ch.pad, t, b.S.snap(b.S.g - 27), b.bpb * b.spb * 4, { vel: 0.55, a: 2, r: 2.5 }));
    bass(b, { pat: '0 . . . . .', vel: 0.32 });
    if (b.bi % 2 === 0) sweep(b, 0.2, r - 12, r + 24, 1.4, { vel: 0.2, ch: 'wave', ring: 1.2 });
    if (s === 'A') lead(b, { inst: 'zheng', vel: 0.55, vib: 16, gliss: 0.2, dbl: 0.2 });
    else { lead(b, { inst: 'xiao', ch: 'ctr', vel: 0.5, legato: 0.98, slide: 0.5 }); if (b.loop % 2) lead(b, { inst: 'zheng', vel: 0.3, oct: 1 }); }
    if (b.bi === 0) bellAt(b, 0, b.S.g + 21, { kind: 'glass', vel: 0.14 });
  },
};
