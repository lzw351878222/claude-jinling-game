// 金陵寻踪 · 曲目（四）：boss / rift / tension / sad / mystery
import { lead, arp, bass, drums, roll, sweep, padChord, bellAt, hit } from './styles.js';
import { noise } from './engine.js';
import * as I from './inst.js';

const ERHU_EQ = [['highpass', 190, 0.7], ['peaking', 820, 1.4, 5], ['peaking', 2100, 1.6, 3], ['lowpass', 4800, 0.7]];

// —— boss：时空裂隙的最终决战。羽调（结束于 6），1=F，138 BPM；堂鼓驱动、琵琶轮指，英勇而紧张 ——
export const boss = {
  bpm: 138, bpb: 4, gong: 65,
  ch: {
    lead: { pan: -0.1, send: 0.18 }, acc: { pan: 0.3, send: 0.12, gain: 0.85 }, bass: { pan: 0, send: 0.08 },
    perc: { pan: 0.05, send: 0.1 }, big: { pan: -0.2, send: 0.25, gain: 0.9 }, hi: { pan: 0.35, send: 0.2, gain: 0.85 },
  },
  sec: {
    I: { roots: '6,, 6,,' },
    A: { mel: `6 6_ 1'_ 2' 1' | 6 5_ 3_ 2 3 | 5 5_ 6_ 1' 2' | 3' - - 0 | 3'_ 3'_ 2'_ 1'_ 6 1' | 2'_ 1'_ 6_ 5_ 6 - | 3_ 5_ 6_ 1'_ 5_ 6_ 3_ 5_ | 6 - 6, 0 |`, roots: '6,, 6,,/5,, 5,, 1, 6,, 2,/6,, 1,/5,, 6,,' },
    B: { mel: `1' - 2'_ 1'_ 6 | 5 6_ 1'_ 2' - | 3' 2'_ 3'_ 5' 3' | 2' - - 0 | 1' - 2'_ 1'_ 6 | 5 6_ 1'_ 2' 3' | 6'_ 5'_ 3'_ 2'_ 1'_ 2'_ 3'_ 5'_ | 6' - 6 0 |`, roots: '1, 5,, 1, 2, 1, 5,, 6,,/1, 6,,' },
  },
  intro: ['I'], form: ['A', 'B', 'A', 'B'],
  bar(b) {
    const s = b.sec;
    arp(b, { pat: '0 0 3 0 0 3 5 3 0 0 3 0 5 3 0 3', vel: 0.15, d: 0.12 }); // 低音区闷音古筝十六分
    bass(b, { pat: '0 . 0 . 0 0 . 0', vel: 0.42, d: 0.25 });
    drums(b, { tanggu: 'x.xxx.x.x.xxx.xx', dagu: 'x.......x.......', bangu: '....x.......x...' }, { vel: 0.5 });
    if (s === 'I') {
      roll(b, 'tanggu', b.bi ? 0 : 2, b.bi ? 4 : 2, { n: b.bi ? 16 : 6, vel: 0.45 });
      if (b.bi === 1) sweep(b, 2, b.root, b.root + 24, 2, { vel: 0.3 });
      return;
    }
    lead(b, { inst: 'pipa', vel: 0.6, trem: 1, dbl: 0.25 });
    if (s === 'B') lead(b, { inst: 'dizi', ch: 'hi', vel: 0.3, legato: 0.85, slide: 0.2 });
    if (b.bi === 0) { hit(b, 0, 'bo', { vel: 0.32, ch: 'big' }); if (s === 'B') b.ev(b.t, (t) => I.perc(b.E, b.ch.big, t, 'gong', { vel: 0.3, d: 1.6 })); }
    if (b.bi % 2 === 1) hit(b, 3.5, 'xiaoluo', { vel: 0.18 });
    if (b.last) roll(b, 'tanggu', 2, 2, { n: 8, vel: 0.4 });
  },
  warm: { perc: ['tanggu', 'dagu', 'bangu', 'bo', 'xiaoluo', 'gong'], pipa: [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86] },
};

// —— rift：时空裂隙。角调（结束于 3，悬而未决），1=C，50 BPM；缓慢的铺底涨落、稀疏且微失谐的钟、倒放般的气声 ——
export const rift = {
  bpm: 50, bpb: 4, gong: 60,
  ch: {
    bell: { pan: 0.3, send: 0.75 }, echo: { pan: -0.4, send: 0.8, gain: 0.8 }, pad: { send: 0.7, gain: 0.9, eq: [['lowpass', 1100, 0.7]] },
    lead: { pan: -0.1, send: 0.6 }, air: { pan: 0.2, send: 0.8, gain: 0.8 },
  },
  sec: { A: { mel: `3' - - - | 0 - 5' - | 6' - - 3' | 2' - - - | 3' - 1' - | 6 - - - | 5 - 6 - | 3 - - - |`, roots: '3, 3, 6,, 6,, 1, 6,, 2, 3,' } },
  form: ['A'],
  bar(b) {
    const E = b.E, ch = b.ch;
    padChord(b, { vel: 0.42, a: 2.6, r: 3.2, color: b.rng() < 0.5 ? 1 : 3 });
    if (b.bi % 2 === 0) b.ev(b.t, (t) => I.drone(E, ch.pad, t, b.root - 12, b.bpb * b.spb * 2, { vel: 0.5, a: 2, r: 2.5 }));
    for (const n of b.notes) {
      const r1 = 1 + (b.rng() - 0.5) * 0.03, r2 = 1 + (b.rng() - 0.5) * 0.04;
      b.ev(n.t, (t) => I.bell(E, ch.bell, t, n.m, { kind: 'zhong', vel: 0.32, rate: r1 }));
      b.ev(n.t + b.spb * 0.75, (t) => I.bell(E, ch.echo, t, n.m + 12, { kind: 'glass', vel: 0.1, rate: r2 }));
    }
    if (b.bi % 4 === 2) b.ev(b.t, (t) => noise(E, ch.air, t, { type: 'highpass', f: 2500, f2: 6500, glide: 3, a: 3, d: 0.35, vol: 0.05 }));
    if (b.bi % 4 === 1) b.ev(b.at(2), (t) => I.qin(E, ch.lead, t, b.root + 12, { vel: 0.32, bend: [Math.pow(2, -3 / 12), 0.5, 1.4] }));
    if (b.bi === 4 && b.loop % 2) sweep(b, 1, b.S.g + 24, b.S.g, 2.5, { vel: 0.14, ch: 'echo', dim: true });
  },
  warm: { zheng: false, qin: [60, 62, 64, 67, 69], bell: [['zhong', 88], ['zhong', 91], ['zhong', 93], ['zhong', 86], ['zhong', 84], ['zhong', 81], ['zhong', 79], ['zhong', 76]] },
};

// —— tension：悬疑。羽调，1=Bb，84 BPM；心跳般的鼓、低音固定音型、二胡宽颤音、五声音簇 ——
export const tension = {
  bpm: 84, bpb: 4, gong: 58,
  ch: {
    lead: { pan: -0.1, send: 0.3, eq: ERHU_EQ }, acc: { pan: 0.25, send: 0.2, gain: 0.8 }, bass: { pan: 0, send: 0.15 },
    perc: { pan: 0.1, send: 0.25 }, pad: { send: 0.4, gain: 0.9, eq: [['lowpass', 700, 0.7]] }, big: { send: 0.35, gain: 0.8 },
  },
  sec: { A: { mel: `6, - - - | 1 - 6, - | 3 - 2 - | 1 - - - | 6, - - - | 1 - 2 - | 3 - 5 - | 3 - - - |`, roots: '6,, 6,, 6,, 5,, 6,, 6,, 2, 6,,' } },
  form: ['A', 'A'],
  bar(b) {
    const S = b.S, r = b.root;
    drums(b, { tanggu: 'x..x............' }, { vel: 0.5, rate: { tanggu: 0.8 } }); // 心跳
    arp(b, { pat: '0 1 0 1 0 1 0 1', vel: 0.12, d: 0.25 });
    bass(b, { pat: '0 . . . . . . .', vel: 0.36 });
    if (b.bi % 2 === 0) padChord(b, { bars: 2, vel: 0.36, a: 1.5, r: 1.5, notes: [r, S.step(r, 1), S.step(r, 2)] });
    lead(b, { inst: 'erhu', oct: 1, vel: 0.5, legato: 0.98, slide: 0.6, vib: 26 });
    if (b.bi % 4 === 3) drums(b, { bangu: '........x.x.xxxx' }, { vel: 0.26 });
    if (b.bi === 0) b.ev(b.t, (t) => I.perc(b.E, b.ch.big, t, 'gong', { vel: 0.22, rate: 0.7, d: 2.5 }));
    if (b.fi === 1 && b.bi % 2 === 0) b.ev(b.t, (t) => I.pipaTrem(b.E, b.ch.acc, t, r + 12, b.bpb * b.spb * 0.95, { vel: 0.16 }));
  },
  warm: { perc: ['tanggu', 'bangu', 'gong'], pipa: [55, 58, 60, 62, 65, 67] },
};

// —— sad：离别。羽调（结束于 6），1=G，60 BPM；二胡如泣的长线条（慢起弓、揉弦、滑音）+ 轻柔古筝 ——
export const sad = {
  bpm: 60, bpb: 4, gong: 67,
  ch: {
    lead: { pan: -0.05, send: 0.4, eq: ERHU_EQ }, acc: { pan: 0.3, send: 0.4, gain: 0.75 }, bass: { pan: 0, send: 0.3 },
    pad: { send: 0.5, gain: 0.8, eq: [['lowpass', 1200, 0.7]] }, ctr: { pan: 0.25, send: 0.45 },
  },
  sec: {
    I: { roots: '6,, 5,,' },
    A: { mel: `6, - 1_ 2_ 3 | 2 - - 1_ 6,_ | 5, - 6,_ 1_ 2 | 3 - - - | 6 - 5_ 3_ 2 | 3 - 2_ 1_ 6, | 1 2_ 1_ 6, 5, | 6, - - - |`, roots: '6,, 5,, 5,, 6,, 2, 6,, 1,/5,, 6,,' },
    B: { mel: `3 - 5 6 | 1' - 6_ 5_ 6 | 3' - 2'_ 1'_ 6 | 5 - - - | 6 - 1'_ 6_ 5 | 3 - 5_ 3_ 2 | 1_ 2_ 3 2 1 | 6, - - - |`, roots: '6,, 1, 6,, 5,, 6,, 6,, 1,/5,, 6,,' },
  },
  intro: ['I'], form: ['A', 'B'],
  bar(b) {
    const s = b.sec;
    bass(b, { pat: '0 . . . 3 . . .', vel: 0.3 });
    arp(b, { pats: ['0 3 5 3 7 5 3 5', '0 3 5 7 5 3 5 3', '. 3 5 3 . 5 7 5'], vel: 0.13, d: 1 });
    padChord(b, { vel: 0.24, a: 1.6, r: 2 });
    if (s === 'I') return;
    lead(b, { inst: 'erhu', vel: 0.6, legato: 0.99, slide: 0.65, vib: 22 });
    if (s === 'B' && b.loop % 2) lead(b, { inst: 'zheng', ch: 'ctr', oct: -1, vel: 0.28 });
    if (b.bi === 0 && s === 'B') bellAt(b, 0, b.S.g + 9, { kind: 'qing', vel: 0.12, ch: 'pad' });
  },
};

// —— mystery：沉思。羽调，1=D，52 BPM；低音古琴 + 泛音，大量留白 ——
export const mystery = {
  bpm: 52, bpb: 4, gong: 62,
  ch: { lead: { pan: -0.1, send: 0.45 }, harm: { pan: 0.25, send: 0.6 }, pad: { send: 0.5, gain: 0.8, eq: [['lowpass', 700, 0.7]] }, bell: { pan: 0.4, send: 0.7 } },
  sec: { A: { mel: `6,, - - - | 0 - 3, - | 2, - 1, - | 6,, - - - | 3 - - 2_ 1_ | 6, - - - | 5, - 6, - | 3, - - - |`, roots: '6,, 6,, 2, 6,, 6,, 6,, 5,, 6,,' } },
  form: ['A', 'A'],
  bar(b) {
    const E = b.E, ch = b.ch;
    if (b.bi % 4 === 0) b.ev(b.t, (t) => I.drone(E, ch.pad, t, b.root, b.bpb * b.spb * 4, { vel: 0.4, a: 3, r: 3 }));
    for (const n of b.notes) {
      if (n.m >= 60) b.ev(n.t, (t) => I.bell(E, ch.harm, t, n.m + 12, { kind: 'glass', vel: 0.28 }));
      else {
        const bend = b.rng() < 0.35 ? [Math.pow(2, 2 / 12), n.dur * 0.5, 0.3] : undefined;
        b.ev(n.t, (t) => I.qin(E, ch.lead, t, n.m, { vel: 0.5, bend, vib: bend ? undefined : [9, 4.5] }));
        if (b.fi === 1) b.ev(n.t + 0.02, (t) => I.bell(E, ch.harm, t, n.m + 24, { kind: 'glass', vel: 0.08 }));
      }
    }
    if (b.bi === 6 && b.rng() < 0.6) bellAt(b, 2, b.S.g + 9, { kind: 'qing', vel: 0.1 });
  },
  warm: { zheng: false, qin: [47, 50, 52, 54, 57, 59, 62, 64, 66] },
};
