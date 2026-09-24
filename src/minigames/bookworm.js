// 捉蠹 —— 永乐五年（1407），文渊阁。《永乐大典》正在编纂，蠹鱼从书架里爬出来啃书。
// 点击蠹鱼把它按死；爬上书页的蠹鱼会把字一口口啃掉。芸香一现，点它：香气所至，蠹鱼尽退。
//
// opts：duration 秒数（默认 60，简单 55）· budget 可损字数（默认 36，简单 48）· seed · tutorial true/false
import { clamp, lerp, rng, easeOutCubic, TAU, cnNum } from '../core/util.js';
import {
  useLibStyle, fBrush, fontsReady, Particles, Shake, hint, banner, keymap, untilDone, devHandle, hostPaused,
  rr, rgba, mixRgb, drawSplat, drawWood, drawSilverfish, drawCrown, blobPath, paperTexture,
} from './lib-a.js';

// 书页上的正文（《大学》《中庸》《千字文》，按原文顺序，不加标点）
const TEXTS = [
  { title: '大学', a: '大学之道在明明德在亲民在止于至善知止而后有定定而后能静静而后能安安而后能虑虑而后能得物有本末事有终始知所先后则近道矣', b: '古之欲明明德于天下者先治其国欲治其国者先齐其家欲齐其家者先修其身欲修其身者先正其心欲正其心者先诚其意欲诚其意者先致其知致知在格物物格而后知至' },
  { title: '千字文', a: '天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏闰余成岁律吕调阳云腾致雨露结为霜金生丽水玉出昆冈剑号巨阙珠称夜光果珍李柰菜重芥姜', b: '海咸河淡鳞潜羽翔龙师火帝鸟官人皇始制文字乃服衣裳推位让国有虞陶唐吊民伐罪周发殷汤坐朝问道垂拱平章爱育黎首臣伏戎羌遐迩一体率宾归王' },
  { title: '中庸', a: '天命之谓性率性之谓道修道之谓教道也者不可须臾离也可离非道也是故君子戒慎乎其所不睹恐惧乎其所不闻莫见乎隐莫显乎微故君子慎其独也', b: '喜怒哀乐之未发谓之中发而皆中节谓之和中也者天下之大本也和也者天下之达道也致中和天地位焉万物育焉仲尼曰君子中庸小人反中庸' },
];
const WAVES = [
  { every: 1.5, max: 5, mix: [['normal', 1]] },
  { every: 1.05, max: 7, mix: [['normal', 0.45], ['fast', 0.25], ['zig', 0.3]] },
  { every: 0.85, max: 9, mix: [['normal', 0.25], ['fast', 0.25], ['zig', 0.25], ['armor', 0.25]] },
  { every: 1.5, max: 6, mix: [['normal', 0.3], ['fast', 0.3], ['zig', 0.2], ['armor', 0.2]] },
];
const WAVE_BANNER = [null, ['第二波', '有的走之字，有的跑得快'], ['第三波', '披甲的，要点两下'], ['蠹王出洞', '连点数下，方能擒之']];

export default {
  id: 'bookworm',
  title: '捉蠹',
  subtitle: '护书于文渊阁',
  rules: [
    '蠹鱼从书架里爬出来，专啃书页上的字。<b>点击</b>蠹鱼，把它按住。',
    '爬上书页的蠹鱼会一口口啃掉字；<b>书损</b>满了，这一关就输了。',
    '走之字的、跑得快的、<b>披甲的（要点两下）</b>接连出现，最后还有一只<b>蠹王</b>。',
    '桌上偶尔会出现一枝<b>芸香</b>——点它，香气所至，蠹鱼尽退。',
  ],
  controls: '鼠标 / 触屏点按 · 空格 使用芸香',
  async play(ctx, opts = {}) {
    useLibStyle();
    await fontsReady();
    return run(ctx, opts);
  },
};

async function run(ctx, opts) {
  const easy = ctx.difficulty === 0;
  const DUR = opts.duration ?? (easy ? 55 : 60);
  const BUDGET = opts.budget ?? (easy ? 48 : 36);
  const R = rng(opts.seed ?? ((Date.now() ^ (ctx.attempt * 977)) >>> 0));
  const dpr = ctx.dpr;
  const T_W2 = DUR * 0.33; const T_W3 = DUR * 0.6; const T_BOSS = DUR - 12;

  const cv = ctx.canvas();
  const g = cv.g;
  const bg = document.createElement('canvas');
  const parts = new Particles(700);
  const shake = new Shake();
  const L = {};
  const S = {
    phase: 'intro', phaseT: 0, t: 0, time: 0, wave: 1, caught: 0, lost: 0, combo: 0, lastKill: -9,
    spawnT: 0, worms: [], decals: [], sprig: null, sprigs: 0, nextSprig: easy ? 11 : 15, fw: null, boss: null,
    bossDown: false, endReason: null, done: null, result: null, freeze: false, nid: 1, hurtSfxT: 0, scurryT: 0,
    tutWorm: null, firstArmor: false,
  };
  const nBooks = ctx.w >= ctx.h * 1.05 ? 3 : 2;
  const books = [];

  // ---------------------------------------------------------------- 布局
  function layout() {
    const W = ctx.w; const H = ctx.h;
    L.W = W; L.H = H;
    L.land = W >= H * 1.05;
    L.shelfH = clamp(H * 0.17, 76, 132);
    L.sideW = L.land ? clamp(W * 0.075, 58, 100) : 0;
    L.slop = ctx.isTouch ? 26 : 18;
    const x0 = L.sideW + 14; const x1 = W - L.sideW - 14;
    const areaTop = L.land ? H * 0.5 : H * 0.44; const areaBot = H - 14;
    const gap = 16;
    let bw; let bh;
    if (L.land) { bw = (x1 - x0 - gap * (nBooks - 1)) / nBooks; bh = Math.min(areaBot - areaTop, bw / 1.36); }
    else { bw = x1 - x0; bh = Math.min((areaBot - areaTop - gap * (nBooks - 1)) / nBooks, bw / 1.36); if (bh * 1.36 < bw) bw = bh * 1.36; }
    L.bw = bw; L.bh = bh;
    const totalW = L.land ? bw * nBooks + gap * (nBooks - 1) : bw;
    const totalH = L.land ? bh : bh * nBooks + gap * (nBooks - 1);
    const ox = (W - totalW) / 2; const oy = areaBot - totalH;
    L.pagesTop = oy;
    L.v = (oy - L.shelfH + 110) / 7 * (easy ? 0.75 : 1);
    L.worm = clamp(Math.min(W, H) * 0.075, 28, 50);
    for (let i = 0; i < nBooks; i++) {
      const bx = L.land ? ox + i * (bw + gap) : ox; const by = L.land ? oy : oy + i * (bh + gap);
      if (!books[i]) books[i] = makeBook(i, bw, bh);
      const bk = books[i];
      bk.x = bx; bk.y = by; bk.w = bw; bk.h = bh;
      const pw = (bw - 4) / 2;
      bk.pages[0].x = bx + pw + 4; bk.pages[0].y = by; // 右页（先读）
      bk.pages[1].x = bx; bk.pages[1].y = by;
      for (const p of bk.pages) { p.w = pw; p.h = bh; placeChars(p); p.dirty = true; }
    }
    // 出洞口
    L.spawns = [];
    const nTop = L.land ? 6 : 4;
    for (let i = 0; i < nTop; i++) L.spawns.push({ x: lerp(L.sideW + 40, W - L.sideW - 40, (i + 0.5) / nTop) + (i % 2 ? 12 : -12), y: L.shelfH - 2, ang: Math.PI / 2 });
    if (L.land) {
      for (let i = 0; i < 2; i++) {
        const y = lerp(L.shelfH + 40, areaTop - 10, (i + 0.5) / 2);
        L.spawns.push({ x: L.sideW - 2, y, ang: 0.35 });
        L.spawns.push({ x: W - L.sideW + 2, y, ang: Math.PI - 0.35 });
      }
    }
    drawBackground();
  }

  function makeBook(i, bw, bh) {
    const T = TEXTS[i % TEXTS.length];
    const pw = (bw - 4) / 2;
    const frame = Math.max(5, pw * 0.045);
    const innerW = pw - 2 * (frame + pw * 0.035);
    const cols = 6;
    const colW = innerW / cols;
    const innerH = bh * 0.84;
    const rows = clamp(Math.floor(innerH / (colW * 0.96)), 5, 12);
    const pages = [0, 1].map((side) => {
      const src = side === 0 ? [...T.title, ' ', ...T.a] : [...T.b];
      const chars = [];
      let k = 0;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const ch = src[k++] || '';
          chars.push({ ch: ch === ' ' ? '' : ch, col: c, row: r, red: side === 0 && k <= T.title.length, bite: 0, taken: 0, seed: Math.floor(R() * 1e6), cx: 0, cy: 0 });
        }
      }
      return { side, cols, rows, chars, cv: null, dirty: true, x: 0, y: 0, w: pw, h: bh };
    });
    return { i, pages, x: 0, y: 0, w: bw, h: bh };
  }

  function placeChars(p) {
    p.frame = Math.max(5, p.w * 0.045);
    const ix = p.frame + p.w * 0.035; const iw = p.w - 2 * ix;
    const iy = p.h * 0.1; const ih = p.h * 0.84;
    p.colW = iw / p.cols; p.rowH = ih / p.rows;
    p.inner = { x: ix, y: iy, w: iw, h: ih };
    p.cs = Math.min(p.colW * 0.8, p.rowH * 0.9);
    for (const c of p.chars) { c.cx = ix + iw - p.colW * (c.col + 0.5); c.cy = iy + p.rowH * (c.row + 0.5); }
  }

  // ---------------------------------------------------------------- 书页（离屏，带虫洞）
  function renderPage(p) {
    const w = p.w; const h = p.h;
    const c = p.cv || (p.cv = document.createElement('canvas'));
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const q = c.getContext('2d');
    q.setTransform(dpr, 0, 0, dpr, 0, 0);
    q.fillStyle = '#f3ead3'; q.fillRect(0, 0, w, h);
    q.globalAlpha = 0.75; q.fillStyle = q.createPattern(paperTexture(), 'repeat'); q.fillRect(0, 0, w, h); q.globalAlpha = 1;
    const sx = p.side === 0 ? 0 : w;
    const sg = q.createLinearGradient(sx, 0, p.side === 0 ? w * 0.2 : w * 0.8, 0);
    sg.addColorStop(0, 'rgba(95,62,30,.3)'); sg.addColorStop(1, 'rgba(95,62,30,0)');
    q.fillStyle = sg; q.fillRect(0, 0, w, h);
    const f = p.frame;
    q.strokeStyle = '#b8412f'; q.lineWidth = 2.2; q.strokeRect(f, f, w - 2 * f, h - 2 * f);
    q.lineWidth = 0.9; q.strokeRect(f + 3, f + 3, w - 2 * f - 6, h - 2 * f - 6);
    const { x: ix, y: iy, w: iw, h: ih } = p.inner;
    q.strokeStyle = 'rgba(184,65,47,.75)'; q.lineWidth = 0.8;
    for (let i = 1; i < p.cols; i++) { const x = ix + iw - p.colW * i; q.beginPath(); q.moveTo(x, f + 3); q.lineTo(x, h - f - 3); q.stroke(); }
    q.font = fBrush(p.cs); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const ch of p.chars) {
      if (!ch.ch || ch.bite >= 3) continue;
      q.fillStyle = ch.red ? '#b23a2e' : '#211b16';
      q.fillText(ch.ch, ch.cx, ch.cy + p.cs * 0.04);
    }
    for (const ch of p.chars) if (ch.bite > 0) biteHoles(q, ch, p.cs);
    p.dirty = false;
  }

  function biteHoles(q, ch, cs) {
    const Rb = rng(ch.seed);
    const n = ch.bite === 1 ? 1 : ch.bite === 2 ? 2 : 4;
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const a = Rb() * TAU;
      const d = ch.bite >= 3 ? cs * 0.2 * Rb() : cs * (0.1 + Rb() * 0.18);
      const r = cs * (ch.bite >= 3 ? 0.34 + Rb() * 0.12 : 0.17 + Rb() * 0.08 + i * 0.03);
      blobs.push([ch.cx + Math.cos(a) * d, ch.cy + Math.sin(a) * d, r, Math.floor(Rb() * 1e6)]);
    }
    q.save();
    q.fillStyle = 'rgba(140,92,44,.5)';
    for (const [x, y, r, s] of blobs) { blobPath(q, x, y, r + 1.8, s, 9, 0.45); q.fill(); }
    q.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, s] of blobs) { blobPath(q, x, y, r, s, 9, 0.45); q.fill(); }
    q.restore();
  }

  // ---------------------------------------------------------------- 背景：书案、书架
  function drawBackground() {
    const W = L.W; const H = L.H;
    bg.width = Math.ceil(W * dpr); bg.height = Math.ceil(H * dpr);
    const b = bg.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWood(b, 0, 0, W, H, { base: '#7a4d2c', light: '#8f5d37', dark: '#5a3820', seed: 3, lines: Math.round(H / 14), alpha: 0.28 });
    // 木板缝
    b.strokeStyle = 'rgba(40,22,10,.45)'; b.lineWidth = 1.5;
    for (let y = L.shelfH + 90; y < H; y += 150) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
    // 暖光
    const lg = b.createRadialGradient(W * 0.5, H * 0.6, Math.min(W, H) * 0.1, W * 0.5, H * 0.6, Math.max(W, H) * 0.75);
    lg.addColorStop(0, 'rgba(255,214,150,.16)'); lg.addColorStop(0.6, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(10,4,0,.45)');
    b.fillStyle = lg; b.fillRect(0, 0, W, H);
    // 书架
    shelfBand(b, 0, 0, W, L.shelfH, 11, false);
    if (L.sideW) {
      shelfBand(b, 0, L.shelfH - 8, L.sideW, H - L.shelfH + 8, 21, true);
      shelfBand(b, W - L.sideW, L.shelfH - 8, L.sideW, H - L.shelfH + 8, 31, true);
    }
    // 书架投下的影子
    const sh = b.createLinearGradient(0, L.shelfH, 0, L.shelfH + 24);
    sh.addColorStop(0, 'rgba(20,10,4,.45)'); sh.addColorStop(1, 'rgba(20,10,4,0)');
    b.fillStyle = sh; b.fillRect(L.sideW, L.shelfH, W - 2 * L.sideW, 24);
    // 出洞口
    for (const s of L.spawns) {
      b.fillStyle = '#120a05';
      if (s.ang === Math.PI / 2) { rr(b, s.x - 9, s.y - 12, 18, 12, 4); b.fill(); }
      else { rr(b, s.x - (s.ang < 1 ? 10 : 0), s.y - 8, 10, 16, 4); b.fill(); }
    }
    // 案上小物：砚台与笔
    if (L.land) {
      const s = clamp(H * 0.05, 18, 34);
      const x = L.sideW + 26; const y = L.pagesTop - s * 1.6;
      if (y > L.shelfH + s * 2) {
        b.fillStyle = 'rgba(0,0,0,.25)'; b.beginPath(); b.ellipse(x + s * 0.9, y + s * 0.62, s * 1.0, s * 0.3, 0, 0, TAU); b.fill();
        b.fillStyle = '#2a2927'; rr(b, x, y, s * 1.8, s * 1.1, s * 0.2); b.fill();
        b.fillStyle = '#121212'; b.beginPath(); b.ellipse(x + s * 0.9, y + s * 0.62, s * 0.6, s * 0.3, 0, 0, TAU); b.fill();
        b.strokeStyle = '#6b4a2a'; b.lineWidth = 3; b.lineCap = 'round';
        b.beginPath(); b.moveTo(x + s * 2.2, y + s * 1.1); b.lineTo(x + s * 3.6, y + s * 0.3); b.stroke();
        b.strokeStyle = '#1d1b18'; b.lineWidth = 4.5;
        b.beginPath(); b.moveTo(x + s * 2.2, y + s * 1.1); b.lineTo(x + s * 1.95, y + s * 1.25); b.stroke();
      }
    }
  }

  function shelfBand(b, x, y, w, h, seed, vertical) {
    const Rs = rng(seed);
    b.save();
    b.beginPath(); b.rect(x, y, w, h); b.clip();
    b.fillStyle = '#1c110a'; b.fillRect(x, y, w, h);
    const post = 7;
    const covers = ['#2f3f5e', '#27334d', '#3b4a6b', '#8a6a3c', '#5b3a2a', '#2d4a45'];
    const drawStack = (sx, sy, sw, sh) => { // sy = 底
      if (Rs() < 0.28) { // 函套
        const hh = Math.min(sh, 16 + Rs() * 22);
        b.fillStyle = covers[Math.floor(Rs() * 3)];
        b.fillRect(sx, sy - hh, sw, hh);
        b.strokeStyle = 'rgba(0,0,0,.5)'; b.lineWidth = 1; b.strokeRect(sx + 0.5, sy - hh + 0.5, sw - 1, hh - 1);
        b.fillStyle = '#efe6d0';
        b.fillRect(sx + sw - 5, sy - hh * 0.72, 3, 5); b.fillRect(sx + sw - 5, sy - hh * 0.38, 3, 5);
        b.fillStyle = '#e9dfc4'; b.fillRect(sx + sw * 0.25, sy - hh + 3, sw * 0.28, 7);
        return;
      }
      let yy = sy;
      const n = 2 + Math.floor(Rs() * 5);
      for (let k = 0; k < n && sy - yy < sh - 6; k++) {
        const bh2 = 5 + Rs() * 5; const inset = (Rs() - 0.5) * 4;
        b.fillStyle = covers[Math.floor(Rs() * covers.length)];
        b.fillRect(sx + inset, yy - bh2, sw, bh2);
        b.fillStyle = '#e8ddc2';
        b.fillRect(sx + inset + 1, yy - bh2 + 1.2, sw - 2, bh2 - 2.4);
        b.strokeStyle = 'rgba(0,0,0,.35)'; b.lineWidth = 0.8; b.strokeRect(sx + inset + 0.5, yy - bh2 + 0.5, sw - 1, bh2 - 1);
        if (Rs() < 0.3) { b.fillStyle = '#f7f2e4'; b.fillRect(sx + inset + sw * 0.4, yy - 1, 5, 8); }
        yy -= bh2;
      }
    };
    if (!vertical) {
      const rowH = (h - post) / 2;
      const nCol = Math.max(3, Math.round(w / 190));
      for (let r = 0; r < 2; r++) {
        const ry = y + r * rowH;
        b.fillStyle = '#4a2e1b'; b.fillRect(x, ry + rowH - post / 2, w, post + 2);
        for (let c = 0; c < nCol; c++) {
          const cx0 = x + (w / nCol) * c + post; const cx1 = x + (w / nCol) * (c + 1);
          let sx = cx0 + 4;
          while (sx < cx1 - 30) { const sw = 30 + Rs() * 34; if (sx + sw > cx1 - 4) break; drawStack(sx, ry + rowH - post / 2, sw, rowH - 10); sx += sw + 5 + Rs() * 10; }
        }
      }
      for (let c = 0; c <= nCol; c++) { b.fillStyle = '#4a2e1b'; b.fillRect(x + (w / nCol) * c - post / 2, y, post, h); }
      b.fillStyle = '#5c3a22'; b.fillRect(x, y + h - post, w, post);
      b.fillStyle = 'rgba(255,220,170,.12)'; b.fillRect(x, y + h - post, w, 1.5);
    } else {
      const rowH = 88;
      for (let ry = y; ry < y + h; ry += rowH) {
        b.fillStyle = '#4a2e1b'; b.fillRect(x, ry + rowH - post, w, post);
        let sx = x + 6;
        while (sx < x + w - 20) { const sw = Math.min(x + w - 6 - sx, 20 + Rs() * 24); if (sw < 14) break; drawStack(sx, ry + rowH - post, sw, rowH - 14); sx += sw + 4; }
      }
      b.fillStyle = '#4a2e1b'; b.fillRect(x, y, post, h); b.fillRect(x + w - post, y, post, h);
    }
    b.restore();
    b.strokeStyle = 'rgba(0,0,0,.6)'; b.lineWidth = 2; b.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  // ---------------------------------------------------------------- 蠹鱼
  function pickType(mix) {
    let r = R();
    for (const [t, p] of mix) { r -= p; if (r <= 0) return t; }
    return mix[0][0];
  }
  function intact(c) { return c.ch && c.bite < 3; }
  function pickTarget(w, near) {
    let best = null;
    if (near) { // 就近：同页或全局最近的完好字
      let bd = Infinity;
      for (const bk of books) {
        for (const p of bk.pages) {
          for (const c of p.chars) {
            if (!intact(c) || c.taken) continue;
            const d = Math.hypot(p.x + c.cx - w.x, p.y + c.cy - w.y);
            if (d < bd) { bd = d; best = { p, c }; }
          }
        }
      }
      return best;
    }
    const pages = [];
    for (const bk of books) for (const p of bk.pages) pages.push(p);
    for (let k = 0; k < 12 && !best; k++) {
      const p = pages[Math.floor(R() * pages.length)];
      const cands = p.chars.filter((c) => intact(c) && !c.taken && c.row < Math.ceil(p.rows * 0.6));
      if (cands.length) best = { p, c: cands[Math.floor(R() * cands.length)] };
    }
    return best || pickTarget(w, true);
  }
  function setTarget(w, tg) {
    if (w.target) w.target.c.taken = Math.max(0, w.target.c.taken - 1);
    w.target = tg;
    if (tg) tg.c.taken++;
  }

  function spawnWorm(type, spawn) {
    const sp = spawn || L.spawns[Math.floor(R() * L.spawns.length)];
    const k = type === 'king';
    const size = L.worm * (k ? 2.5 : type === 'fast' ? 0.85 : type === 'armor' ? 1.12 : 1);
    const sp0 = L.v * (k ? 0.5 : type === 'fast' ? 1.6 : type === 'zig' ? 1.1 : type === 'armor' ? 0.85 : 1);
    const w = {
      id: S.nid++, type, x: sp.x, y: sp.y, ang: sp.ang, L: size, speed: sp0, state: 'emerge', t: R() * 10, stT: 0,
      hp: k ? (easy ? 6 : 10) : type === 'armor' ? 2 : 1, armor: type === 'armor', hurt: 0, boost: 0, alpha: 0,
      zig: R() * TAU, eatT: 0, target: null, spawnAng: sp.ang, waveHit: -1, deadT: 0, wither: false,
    };
    w.maxHp = w.hp;
    setTarget(w, pickTarget(w, false));
    S.worms.push(w);
    for (let i = 0; i < 6; i++) parts.add({ x: sp.x + (R() - 0.5) * 14, y: sp.y + 4, vx: (R() - 0.5) * 40, vy: 10 + R() * 30, drag: 3, life: 0.6, size: 2 + R() * 2, size1: 5, color: '#8a7050', alpha: 0.6 });
    if (S.scurryT <= 0) { ctx.sfx('scurry'); S.scurryT = 0.6; }
    if (type === 'armor' && !S.firstArmor) { S.firstArmor = true; }
    return w;
  }

  function eatDur(w) { return (w.type === 'king' ? 0.75 : w.type === 'fast' ? 1.3 : 1.6) * (easy ? 1.3 : 1); }

  function updateWorm(w, dt) {
    w.t += dt; w.stT += dt;
    w.hurt = Math.max(0, w.hurt - dt * 4);
    w.boost = Math.max(0, w.boost - dt);
    const turn = (to, rate) => {
      let d = to - w.ang;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      w.ang += clamp(d, -rate * dt, rate * dt);
    };
    switch (w.state) {
      case 'emerge': {
        w.alpha = Math.min(1, w.stT / 0.45);
        const v = w.speed * 0.5;
        w.x += Math.cos(w.ang) * v * dt; w.y += Math.sin(w.ang) * v * dt;
        if (w.stT > 0.5) { w.state = 'crawl'; w.stT = 0; }
        break;
      }
      case 'crawl': {
        w.alpha = 1;
        if (!w.target || !intact(w.target.c)) setTarget(w, pickTarget(w, true));
        if (!w.target) { flee(w); break; }
        const tx = w.target.p.x + w.target.c.cx; const ty = w.target.p.y + w.target.c.cy;
        const d = Math.hypot(tx - w.x, ty - w.y);
        let want = Math.atan2(ty - w.y, tx - w.x);
        if (w.type === 'zig') want += Math.sin(w.t * 4.2 + w.zig) * 0.95 * clamp(d / 70, 0, 1);
        turn(want, w.type === 'king' ? 3 : 6);
        const v = Math.min(d / Math.max(dt, 0.001), w.speed * (1 + w.boost * 0.7));
        w.x += Math.cos(w.ang) * v * dt; w.y += Math.sin(w.ang) * v * dt;
        if (d < 4) { w.state = 'eat'; w.stT = 0; w.eatT = 0; }
        break;
      }
      case 'eat': {
        if (!w.target || !intact(w.target.c)) { w.state = 'crawl'; w.stT = 0; setTarget(w, pickTarget(w, true)); break; }
        const c = w.target.c; const p = w.target.p;
        w.eatT += dt * (1 + w.boost);
        const dur = eatDur(w);
        const stage = Math.min(3, Math.floor((w.eatT / dur) * 3 + 0.4));
        if (stage > c.bite) {
          c.bite = stage; p.dirty = true;
          const x = p.x + c.cx; const y = p.y + c.cy;
          for (let i = 0; i < 4; i++) parts.add({ shape: 'rect', x, y, vx: (R() - 0.5) * 70, vy: (R() - 0.5) * 70 - 20, ay: 60, drag: 2, vr: (R() - 0.5) * 10, life: 0.7, size: 2.5 + R() * 2, color: R() < 0.5 ? '#efe4c8' : '#2a211a' });
          if (c.bite >= 3) { onCharLost(); setTarget(w, pickTarget(w, true)); w.state = 'crawl'; w.stT = 0; }
        }
        if (w.type === 'king' && w.eatT > dur * 0.4) { // 蠹王一口啃两个字
          const nb = p.chars.find((o) => o !== c && intact(o) && Math.abs(o.col - c.col) + Math.abs(o.row - c.row) === 1);
          if (nb && nb.bite < c.bite) { nb.bite = Math.min(3, c.bite); p.dirty = true; if (nb.bite >= 3) onCharLost(); }
        }
        break;
      }
      case 'flee': {
        w.alpha -= dt * 0.9;
        const v = w.speed * 2.2;
        w.x += Math.cos(w.ang) * v * dt; w.y += Math.sin(w.ang) * v * dt;
        break;
      }
      case 'dead':
        w.deadT += dt;
        break;
      default:
    }
  }

  function flee(w) {
    if (w.state === 'dead') return;
    setTarget(w, null);
    w.state = 'flee'; w.stT = 0;
    const cx = L.W / 2;
    w.ang = w.x < cx * 0.6 ? Math.PI : w.x > L.W - cx * 0.6 ? 0 : -Math.PI / 2;
  }

  function onCharLost() {
    S.lost++;
    if (S.hurtSfxT <= 0) { ctx.sfx('hurt'); S.hurtSfxT = 0.45; }
    if (S.lost >= BUDGET && S.phase === 'play') endRound('ruin');
  }

  // ---------------------------------------------------------------- 点击
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax; const vy = by - ay;
    const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    return Math.hypot(px - ax - vx * t, py - ay - vy * t);
  }
  function tap(x, y) {
    if (S.phase !== 'play') return;
    const sp = S.sprig;
    if (sp && sp.state === 'live' && Math.hypot(x - sp.x, y - sp.y) < sp.r + L.slop) { useSprig(); return; }
    let best = null; let bd = Infinity;
    for (const w of S.worms) {
      if (w.state === 'dead' || w.alpha < 0.2) continue;
      const hx = w.x; const hy = w.y;
      const tx = w.x - Math.cos(w.ang) * w.L * 0.85; const ty = w.y - Math.sin(w.ang) * w.L * 0.85;
      const d = segDist(x, y, hx, hy, tx, ty);
      const rad = w.type === 'king' ? w.L * 0.3 + L.slop : Math.max(L.slop, w.L * 0.42);
      if (d < rad && d < bd) { bd = d; best = w; }
    }
    if (best) hitWorm(best, x, y);
    else {
      parts.add({ shape: 'ring', x, y, size: 4, size1: 20, life: 0.3, color: 'rgba(30,20,10,.5)', lw: 2 });
    }
  }

  function hitWorm(w, x, y) {
    if (w.type === 'king') {
      w.hp--; w.hurt = 1;
      const a = Math.atan2(w.y - y, w.x - x);
      w.x += Math.cos(a) * 16; w.y += Math.sin(a) * 16;
      ctx.sfx('hit'); shake.add(3.5);
      for (let i = 0; i < 8; i++) parts.add({ shape: 'shard', x, y, vx: (R() - 0.5) * 220, vy: (R() - 0.5) * 220, drag: 2, vr: (R() - 0.5) * 12, life: 0.6, size: 5 + R() * 4, color: '#e8d6a0', stroke: 'rgba(80,60,20,.6)' });
      parts.add({ shape: 'text', text: w.hp > 0 ? '啪' : '', font: fBrush(26), x, y: y - 18, vy: -40, life: 0.6, size: 1, size1: 1.3, color: '#b23a2e', stroke: 'rgba(251,246,234,.9)', lw: 5 });
      if (w.state === 'eat') { w.state = 'crawl'; w.stT = 0; }
      if (w.hp <= 0) killBoss(w);
      return;
    }
    if (w.armor) {
      w.armor = false; w.hp--; w.hurt = 1; w.boost = 1.1;
      ctx.sfx('crack'); shake.add(1.5);
      for (let i = 0; i < 9; i++) parts.add({ shape: 'shard', x: w.x, y: w.y, vx: (R() - 0.5) * 240, vy: (R() - 0.5) * 240, ay: 200, drag: 2, vr: (R() - 0.5) * 14, life: 0.7, size: 5 + R() * 4, color: '#5d6d80', stroke: '#1d2530' });
      parts.add({ shape: 'text', text: '咔', font: fBrush(24), x: w.x, y: w.y - 20, vy: -40, life: 0.55, size: 1, size1: 1.25, color: '#243049', stroke: 'rgba(251,246,234,.9)', lw: 5 });
      if (w.state === 'eat') { w.state = 'crawl'; w.stT = 0; }
      return;
    }
    kill(w, false);
  }

  function kill(w, byScent) {
    if (w.state === 'dead') return;
    setTarget(w, null);
    w.state = 'dead'; w.deadT = 0; w.wither = byScent;
    S.caught++;
    if (!byScent) {
      S.combo = S.t - S.lastKill < 1.0 ? S.combo + 1 : 1;
      S.lastKill = S.t;
      if (S.combo === 3) ctx.toast('好！', 'good');
      else if (S.combo === 5) ctx.toast('妙！', 'gold');
      else if (S.combo === 8) ctx.toast('神乎其技！', 'gold');
      ctx.sfx('squish');
      shake.add(1.4);
      S.decals.push({ x: w.x - Math.cos(w.ang) * w.L * 0.3, y: w.y - Math.sin(w.ang) * w.L * 0.3, r: w.L * 0.36, seed: Math.floor(R() * 1e6), t: 0 });
      for (let i = 0; i < 10; i++) {
        const a = R() * TAU; const sp = 60 + R() * 160;
        parts.add({ x: w.x, y: w.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 5, life: 0.5 + R() * 0.3, size: 1.5 + R() * 2.5, color: R() < 0.6 ? '#1d1b18' : '#dfe6ec' });
      }
      if (R() < 0.45 || S.combo >= 3) parts.add({ shape: 'text', text: R() < 0.5 ? '啪' : '噗', font: fBrush(clamp(w.L * 0.7, 18, 28)), x: w.x, y: w.y - w.L * 0.5, vy: -36, life: 0.55, size: 0.9, size1: 1.2, color: '#1d1b18', stroke: 'rgba(251,246,234,.9)', lw: 4 });
    } else {
      for (let i = 0; i < 5; i++) parts.add({ shape: 'leaf', x: w.x, y: w.y, vx: (R() - 0.5) * 80, vy: -30 - R() * 50, drag: 1.5, vr: (R() - 0.5) * 6, life: 0.9, size: 4 + R() * 3, color: '#6f9a55', rot: R() * TAU });
    }
    if (S.tutWorm === w) tutDone();
  }

  function killBoss(w) {
    kill(w, false);
    S.bossDown = true;
    ctx.sfx('shatter'); ctx.sfx('gong');
    shake.add(9);
    ctx.toast('蠹王伏诛！', 'gold');
    S.decals.push({ x: w.x, y: w.y, r: w.L * 0.42, seed: 99, t: 0 });
    for (let i = 0; i < 40; i++) {
      const a = R() * TAU; const sp = 80 + R() * 320;
      parts.add({ shape: i % 3 ? 'circle' : 'spark', x: w.x, y: w.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: 0.8 + R() * 0.5, size: 2 + R() * 3, color: i % 2 ? '#e8cf94' : '#dfe6ec' });
    }
    for (const o of S.worms) if (o !== w) flee(o);
    S.endAt = S.time + 1.6;
  }

  // ---------------------------------------------------------------- 芸香
  function spawnSprig() {
    const W = L.W;
    const y0 = L.shelfH + 40; const y1 = L.pagesTop - 30;
    const x = lerp(L.sideW + 60, W - L.sideW - 60, 0.15 + R() * 0.7);
    const y = y1 > y0 ? lerp(y0, y1, 0.3 + R() * 0.5) : L.pagesTop - 20;
    S.sprig = { x, y, r: clamp(L.worm * 0.95, 30, 46), t: 0, life: easy ? 9 : 7.5, state: 'live' };
    S.sprigs++;
    ctx.sfx('sparkle');
    if (S.sprigs === 1 && tut.on) {
      if (tut.h) tut.h.close();
      tut.h = hint(ctx, '<b>芸香</b>！点它，香气所至，蠹鱼尽退', { x, y: y - S.sprig.r - 8, place: 'above', ms: 4000 });
    }
  }
  function useSprig() {
    const sp = S.sprig;
    sp.state = 'used'; sp.t = 0;
    S.fw = { x: sp.x, y: sp.y, r: 0, max: Math.hypot(Math.max(sp.x, L.W - sp.x), Math.max(sp.y, L.H - sp.y)) + 40, id: S.nid++ };
    ctx.sfx('magic');
    ctx.toast('芸香辟蠹！', 'gold');
    if (tut.h) { tut.h.close(); tut.h = null; }
    if (!S.scentTold) {
      S.scentTold = true;
      hint(ctx, '古人藏书，常夹<b>芸草</b>以辟蠹，<br>藏书之所因称「芸台」「芸阁」', { x: L.W / 2, y: L.shelfH + 16, place: 'below', ms: 5200, bob: false, arrow: false });
    }
  }
  function updateScent(dt) {
    const sp = S.sprig;
    if (sp) {
      sp.t += dt;
      if (sp.state === 'live' && sp.t > sp.life) { sp.state = 'gone'; sp.t = 0; }
      if (sp.state !== 'live' && sp.t > 0.6) S.sprig = null;
    }
    const f = S.fw;
    if (f) {
      f.r += (f.max / 0.95) * dt;
      for (const w of S.worms) {
        if (w.state === 'dead' || w.waveHit === f.id) continue;
        if (Math.hypot(w.x - f.x, w.y - f.y) < f.r) {
          w.waveHit = f.id;
          if (w.type === 'king') {
            w.hp = Math.max(1, w.hp - (easy ? 4 : 3)); w.hurt = 1;
            const a = Math.atan2(w.y - f.y, w.x - f.x); w.x += Math.cos(a) * 30; w.y += Math.sin(a) * 30;
            ctx.sfx('hit');
          } else kill(w, true);
        }
      }
      for (let i = 0; i < 3; i++) {
        const a = R() * TAU;
        parts.add({ shape: 'leaf', x: f.x + Math.cos(a) * f.r, y: f.y + Math.sin(a) * f.r, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 20, drag: 2, vr: (R() - 0.5) * 8, life: 0.8, size: 3 + R() * 3, color: R() < 0.5 ? '#7fa862' : '#c9b24a', rot: a });
      }
      if (f.r > f.max) S.fw = null;
    }
  }

  function drawSprig(sp) {
    const k = sp.state === 'live' ? Math.min(1, sp.t / 0.35) : 1 - Math.min(1, sp.t / 0.5);
    const warn = sp.state === 'live' && sp.life - sp.t < 2 ? 0.5 + 0.5 * Math.sin(sp.t * 16) : 1;
    const s = sp.r / 24;
    g.save();
    g.translate(sp.x, sp.y + Math.sin(S.t * 2.4) * 3);
    g.globalAlpha = k * (0.55 + 0.45 * warn);
    const gl = g.createRadialGradient(0, 0, 2, 0, 0, sp.r * 1.9);
    gl.addColorStop(0, 'rgba(220,240,160,.55)'); gl.addColorStop(1, 'rgba(220,240,160,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, sp.r * 1.9, 0, TAU); g.fill();
    g.scale(s * (0.8 + 0.2 * k), s * (0.8 + 0.2 * k));
    g.rotate(-0.35);
    g.strokeStyle = '#4c6b34'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 26); g.quadraticCurveTo(-3, 0, 2, -24); g.stroke();
    const leaf = (x, y, a, sz) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = '#6f9a8a';
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(i * sz * 0.55, -sz * 0.35 * (1 - Math.abs(i) * 0.4), sz * 0.36, sz * 0.5, i * 0.5, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(40,70,50,.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -sz * 0.6); g.stroke();
      g.restore();
    };
    leaf(-6, 14, -1.1, 9); leaf(6, 6, 1.0, 10); leaf(-5, -4, -0.9, 9); leaf(5, -12, 0.9, 8);
    g.fillStyle = '#e3c63c';
    for (const [x, y] of [[2, -26], [-3, -22], [6, -21]]) { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + Math.cos(i * 1.57) * 2.2, y + Math.sin(i * 1.57) * 2.2, 1.7, 0, TAU); g.fill(); } }
    g.restore();
    // 香气缭绕
    if (sp.state === 'live') {
      g.save(); g.globalAlpha = 0.5 * k; g.strokeStyle = '#d9e8b0'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ph = S.t * 1.4 + i * 2.1; const up = ((S.t * 0.6 + i / 3) % 1);
        g.beginPath();
        for (let j = 0; j <= 10; j++) { const u = j / 10; const x = sp.x + (i - 1) * 9 + Math.sin(ph + u * 5) * 7; const y = sp.y - sp.r * 0.8 - (up * 0.6 + u * 0.8) * sp.r * 1.6; if (j === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
    }
  }

  // ---------------------------------------------------------------- 绘制
  function drawBooks() {
    for (const bk of books) {
      g.fillStyle = 'rgba(20,10,4,.35)';
      rr(g, bk.x - 4, bk.y + 6, bk.w + 12, bk.h + 8, 6); g.fill();
      g.fillStyle = '#26324d';
      rr(g, bk.x - 7, bk.y - 5, bk.w + 14, bk.h + 12, 5); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#e4d8bb'; g.fillRect(bk.x - 2, bk.y + bk.h, bk.w + 4, 4);
      g.strokeStyle = 'rgba(120,100,70,.6)'; g.lineWidth = 0.6;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(bk.x - 2, bk.y + bk.h + i); g.lineTo(bk.x + bk.w + 2, bk.y + bk.h + i); g.stroke(); }
      for (const p of bk.pages) {
        if (p.dirty || !p.cv) renderPage(p);
        g.fillStyle = '#3a291b'; g.fillRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
        g.drawImage(p.cv, p.x, p.y, p.w, p.h);
      }
      g.fillStyle = 'rgba(60,40,20,.35)'; g.fillRect(bk.x + (bk.w - 4) / 2, bk.y, 4, bk.h);
    }
  }

  function drawWorm(w) {
    const k = w.state === 'dead' ? clamp(w.deadT / 0.3, 0, 1) : 0;
    if (w.state === 'dead' && k >= 1) return;
    const cx = w.x - Math.cos(w.ang) * w.L * 0.36; const cy = w.y - Math.sin(w.ang) * w.L * 0.36;
    const a = w.alpha * (1 - k);
    // 影子
    g.save();
    g.globalAlpha = 0.3 * a;
    g.fillStyle = '#1a0e05';
    g.beginPath(); g.ellipse(cx + 2, cy + 4, w.L * 0.5, w.L * 0.15, w.ang, 0, TAU); g.fill();
    g.restore();
    const eat = w.state === 'eat';
    const bob = eat ? Math.sin(w.t * 18) * 1.4 : 0;
    const res = drawSilverfish(g, cx + Math.cos(w.ang) * bob, cy + Math.sin(w.ang) * bob, w.ang, w.L, {
      t: w.t, rate: eat ? 14 : 9 + w.speed * 0.04, wig: eat ? 0.45 : w.state === 'flee' ? 1.4 : 1, alpha: a,
      armor: w.armor ? 1 : 0, king: w.type === 'king', hurt: w.hurt, flat: w.wither ? 0 : k, gait: w.t * (eat ? 6 : 16 + w.speed * 0.1),
    });
    if (w.type === 'king' && w.state !== 'dead') {
      drawCrown(g, res.hx, res.hy - w.L * 0.2, w.L * 0.2);
      // 血条
      const bw = w.L * 0.9; const bx = cx - bw / 2; const by = cy - w.L * 0.5;
      g.save(); g.globalAlpha = a;
      for (let i = 0; i < w.maxHp; i++) {
        const px = bx + (bw / w.maxHp) * (i + 0.5);
        g.fillStyle = i < w.hp ? '#b23a2e' : 'rgba(40,30,20,.35)';
        g.beginPath(); g.arc(px, by, Math.min(5, bw / w.maxHp * 0.35), 0, TAU); g.fill();
      }
      g.restore();
    }
  }

  function draw() {
    const W = L.W; const H = L.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(shake.x, shake.y);
    g.drawImage(bg, -3, -3, W + 6, H + 6);
    drawBooks();
    for (const d of S.decals) drawSplat(g, d.x, d.y, d.r, d.seed, '#1d1b18', clamp(1 - (d.t - 2.2) / 1.2, 0, 0.9));
    const order = S.worms.slice().sort((a, b) => (a.type === 'king') - (b.type === 'king') || a.y - b.y);
    for (const w of order) drawWorm(w);
    if (S.sprig) drawSprig(S.sprig);
    if (S.fw) {
      const f = S.fw;
      g.save();
      const ring = g.createRadialGradient(f.x, f.y, Math.max(0, f.r - 60), f.x, f.y, f.r);
      ring.addColorStop(0, 'rgba(210,235,160,0)'); ring.addColorStop(0.85, 'rgba(210,235,160,.35)'); ring.addColorStop(1, 'rgba(240,250,210,0)');
      g.fillStyle = ring; g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(232,207,148,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.stroke();
      g.restore();
    }
    parts.draw(g);
    g.restore();
    // 时限条
    const k = clamp(1 - S.time / DUR, 0, 1);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, 4);
    g.fillStyle = k < 0.2 ? '#d4513f' : '#c8a15a'; g.fillRect(0, 0, W * k, 4);
  }

  // ---------------------------------------------------------------- 流程
  const tut = { on: opts.tutorial ?? (ctx.attempt === 1 || easy), h: null, done: false };
  function tutDone() {
    if (tut.done) return;
    tut.done = true;
    if (tut.h) { tut.h.close(); tut.h = null; }
    ctx.toast('好！', 'good');
  }

  function waveAt(t) { return t >= T_BOSS ? 4 : t >= T_W3 ? 3 : t >= T_W2 ? 2 : 1; }

  function spawning(dt) {
    const t = S.time;
    const wv = waveAt(t);
    if (wv !== S.wave) {
      S.wave = wv;
      const bn = WAVE_BANNER[wv - 1];
      if (bn) banner(ctx, bn[0], bn[1], { ms: 1800, top: '30%' });
      if (wv === 4) {
        const sp = L.spawns[Math.floor(L.spawns.length / 2) - (L.land ? 1 : 0)] || L.spawns[0];
        S.boss = spawnWorm('king', sp);
        ctx.sfx('horn'); shake.add(6);
      } else ctx.sfx('drum');
    }
    if (tut.on && !tut.done) {
      if (!S.tutWorm && t > 0.2) {
        S.tutWorm = spawnWorm('normal', L.spawns[Math.min(1, L.spawns.length - 1)]);
        S.tutWorm.speed *= 0.6;
        tut.h = hint(ctx, '点它！', { x: S.tutWorm.x, y: S.tutWorm.y - 20, place: 'above' });
      }
      if (S.tutWorm && tut.h) tut.h.at(S.tutWorm.x, S.tutWorm.y - S.tutWorm.L * 0.6 - 6, 'above');
      if (t < 7 && !tut.done) return;
      if (!tut.done) { tut.done = true; if (tut.h) { tut.h.close(); tut.h = null; } }
    }
    const cfg = WAVES[wv - 1];
    const max = cfg.max - (easy ? 2 : 0);
    const alive = S.worms.filter((w) => w.state !== 'dead' && w.state !== 'flee' && w.type !== 'king').length;
    S.spawnT -= dt;
    if (S.spawnT <= 0 && alive < max) {
      S.spawnT = cfg.every * (easy ? 1.4 : 1) * (0.8 + R() * 0.4);
      let type = pickType(cfg.mix);
      if (easy && wv < 3 && type === 'armor') type = 'normal';
      spawnWorm(type);
    }
    // 芸香
    if (!S.sprig && !S.fw) {
      S.nextSprig -= dt;
      const crowded = alive >= max - 1 && t > 8;
      if (S.nextSprig <= 0 || (crowded && S.nextSprig < 8)) { spawnSprig(); S.nextSprig = easy ? 14 : 19; }
    }
  }

  function endRound(reason) {
    if (S.phase !== 'play') return;
    S.phase = 'end'; S.phaseT = 0; S.endReason = reason;
    if (tut.h) { tut.h.close(); tut.h = null; }
    for (const w of S.worms) flee(w);
    if (reason === 'ruin') { banner(ctx, '书页残损', `损字 ${S.lost}`, { ms: 2200, top: '32%' }); shake.add(6); }
    else {
      if (reason === 'time' && S.boss && S.boss.state !== 'dead') ctx.toast('蠹王遁走了……', 'bad');
      banner(ctx, '护书功成', `捉蠹 ${S.caught} 只 · 损字 ${S.lost}`, { ms: 2200, top: '32%' });
      ctx.sfx('chime');
    }
  }

  function finish() {
    if (S.result) return;
    const success = S.lost < BUDGET;
    const perfect = success && S.lost === 0;
    let note;
    if (perfect) note = '一字未损！古人藏书常夹芸草辟蠹，藏书之所因称“芸台”“芸阁”。';
    else if (success) note = `书保住了（损字 ${S.lost}）。古人藏书夹芸草以辟蠹——相传“书香”一说，便由此而来。`;
    else note = '书页被啃坏了……要趁蠹鱼爬上书页之前捉住它；芸香一出现，赶紧点。';
    S.result = { success, score: S.caught, perfect, note, scoreText: `捉蠹 ${S.caught} 只 · 损字 ${S.lost}` };
    S.done(S.result);
  }

  let hudKey = '';
  function updHud() {
    const left = Math.max(0, Math.ceil(DUR - S.time));
    const dmg = clamp(S.lost / BUDGET, 0, 1);
    const narrow = ctx.w < 440; // 手机竖屏：HUD 写短些，免得左侧标题被挤成「捉…」
    const key = `${left}|${S.caught}|${S.lost}|${S.wave}|${narrow}`;
    if (key === hudKey) return;
    hudKey = key;
    const col = dmg < 0.5 ? 'var(--jade)' : dmg < 0.8 ? 'var(--gold-dark)' : 'var(--vermilion)';
    const wave = S.wave === 4 ? '蠹王' : `第${cnNum(S.wave)}波`;
    const sec = `<b class="${left <= 10 ? 'bad' : ''}">${left}</b>`;
    ctx.hud({
      center: `<span class="liba-hud">${narrow ? `${wave} · ${sec}秒` : `${wave} · 余 ${sec} 秒`}</span>`,
      right: `<span class="liba-hud">捉${narrow ? '' : ' '}<b>${S.caught}</b> 书损<span class="liba-meter"><i style="width:${(dmg * 100).toFixed(0)}%;background:${col}"></i></span></span>`,
    });
  }

  function update(dt) {
    if (S.freeze || hostPaused(ctx)) dt = 0; // 宿主「暂且离开？」确认框打开时，时间停住
    S.t += dt; S.phaseT += dt;
    if (Math.abs(ctx.w - L.W) > 0.5 || Math.abs(ctx.h - L.H) > 0.5) layout();
    parts.update(dt);
    shake.update(dt);
    S.hurtSfxT -= dt; S.scurryT -= dt;
    for (const d of S.decals) d.t += dt;
    S.decals = S.decals.filter((d) => d.t < 3.4);
    for (const w of S.worms) updateWorm(w, dt);
    S.worms = S.worms.filter((w) => !(w.state === 'dead' && w.deadT > 0.35) && !(w.state === 'flee' && (w.alpha <= 0 || w.x < -80 || w.x > L.W + 80 || w.y < -80)));
    updateScent(dt);
    switch (S.phase) {
      case 'intro':
        if (S.phaseT > 1.4) { S.phase = 'play'; S.phaseT = 0; }
        break;
      case 'play': {
        const before = Math.ceil(DUR - S.time);
        S.time += dt;
        const after = Math.ceil(DUR - S.time);
        if (after !== before && after <= 5 && after > 0) ctx.sfx('tick');
        spawning(dt);
        if (S.endAt && S.time >= S.endAt) endRound('boss');
        else if (S.time >= DUR) endRound('time');
        break;
      }
      case 'end':
        if (S.phaseT > 2.3) finish();
        break;
      default:
    }
    updHud();
  }

  // ---------------------------------------------------------------- 启动
  layout();
  ctx.onResize(() => { layout(); draw(); });
  cv.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = cv.canvas.getBoundingClientRect();
    tap(e.clientX - r.left, e.clientY - r.top);
  });
  cv.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  keymap(ctx, {
    Space: () => { if (S.phase === 'play' && S.sprig && S.sprig.state === 'live') useSprig(); },
    Enter: () => { if (S.phase === 'play' && S.sprig && S.sprig.state === 'live') useSprig(); },
  });
  banner(ctx, '永乐五年', '文渊阁 · 护书', { ms: 1700, top: '34%' });
  ctx.sfx('page');
  updHud();
  devHandle('__bookworm', { S, L, books, tap, spawnWorm, useSprig, spawnSprig });
  ctx.loop((dt) => { update(dt); draw(); });
  return untilDone(ctx, (done) => { S.done = done; });
}
