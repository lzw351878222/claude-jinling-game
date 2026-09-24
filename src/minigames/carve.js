// 刻版 —— 「为世德堂刻一部新书」
// 万历十五年（1587），南京三山街书坊。雕版上的字是反的：写样纸反贴上版，照着刻，印出来才是正字。
import { clamp, lerp, easeOutCubic, easeInOutCubic, easeOutBack, rng, shuffle, injectStyle, el } from '../core/util.js';
import {
  scope, waitFor, Tweens, Particles, tipLine, glow, brushText, offscreen, localXY, fontReady, button, roundRect, hostPaused, FONT_BRUSH,
} from './lib-b.js';
import css from './carve.css';

injectStyle('carve', css);

const TAU = Math.PI * 2;
// 书名页：自右向左三行（印出来的样子）
const PAGE = [
  { text: '新刻出像官板', mode: 'top' },
  { text: '大字西游记', mode: 'spread' },
  { text: '金陵世德堂梓行', mode: 'full' },
];
const COL_W = [1, 1.3, 1];
const TARGETS = { normal: '新刻像板游记陵德梓行', easy: '刻游记陵德行' };
const KINDS = ['mirror', 'normal', 'vflip', 'rot'];
const TF = { mirror: 'scaleX(-1)', normal: 'none', vflip: 'scaleY(-1)', rot: 'rotate(180deg)' };
const WHY = { normal: '这是正字：刻上版，印出来就反了', vflip: '上下颠倒了', rot: '整个倒转了' };
const BA = 0.66; // 版面宽高比
const FX = 0.075, FY = 0.06; // 版框内边距（相对宽 / 高）

export default {
  id: 'carve',
  title: '刻版',
  subtitle: '为世德堂刻一部新书',
  rules: [
    '蠹啃坏了世德堂的<b>写样</b>。刻书时，写样纸是<b>反贴</b>在木版上照着刻的——所以版上的字<b>左右相反</b>，印出来才是正字。',
    '每个字给出四张写样：只有<b>左右反过来</b>的那张能用。选对了就动刀，选错了师傅会帮你补刻。',
    '一炷香的工夫刻十个字，至少刻对<b>八个</b>；连对有加分。',
    '刻完了，<b>刷墨、铺纸、刷印、揭纸</b>——看看印出来的书名。',
  ],
  controls: '点选写样 · 键盘 1–4 或 ←→ + 空格；刷墨、刷印时按住拖动（或按空格代刷）',

  async play(ctx, opts = {}) {
    const easy = ctx.difficulty === 0;
    const seed = (opts.seed != null ? Number(opts.seed) : (Date.now() & 0xffffff)) + ctx.attempt * 131;
    const R = rng(seed);
    const S = scope(ctx);
    const tw = new Tweens(ctx.signal);
    const P = new Particles();
    const cv = ctx.canvas();
    const g = cv.g;
    const tip = tipLine(ctx.root);
    const narrow = () => ctx.w < 560;
    const targetsStr = TARGETS[easy ? 'easy' : 'normal'];
    const need = easy ? 4 : 8;
    const total = targetsStr.length;
    const timeTotal = opts.time ? Number(opts.time) : (easy ? 64 : 72);

    // ---------------------------------------------------------------- 版面格子（归一化坐标，版上是镜像：印本右起第一行在版的最左）
    const innerW = 1 - 2 * FX, innerH = 1 - 2 * FY;
    const sumW = COL_W.reduce((a, b) => a + b, 0);
    const cells = [];
    let colX = FX;
    const ruleU = [];
    PAGE.forEach((col, c) => {
      const cw = COL_W[c] / sumW * innerW;
      const chars = [...col.text];
      const slots = col.mode === 'spread' ? chars.length : 7;
      chars.forEach((ch, i) => {
        const v = FY + (i + 0.5) / slots * innerH;
        const s = col.mode === 'spread' ? Math.min(cw * BA, innerH / slots) * 0.8 : Math.min(cw * BA, innerH / 7) * 0.8; // 相对版高
        cells.push({ c, i, ch, u: colX + cw / 2, v, s, cw, target: targetsStr.includes(ch), state: 'carved', k: 0, big: col.mode === 'spread' });
      });
      colX += cw;
      if (c < PAGE.length - 1) ruleU.push(colX);
    });
    for (const cell of cells) if (cell.target) cell.state = 'raw';
    const order = cells.filter((c) => c.target);
    const allChars = PAGE.map((c) => c.text).join('') + '印出来应是世德堂';

    // ---------------------------------------------------------------- 状态
    let phase = 'carve'; // carve | finale
    let current = null;
    let timeLeft = timeTotal, timing = false;
    let correct = 0, streak = 0, bestStreak = 0, bonus = 0, answered = 0;
    let fin = 0; // 版移到中央
    let flying = null; // { kind, from:[x,y,s], t }
    let pulse = 0;
    let time = 0;
    let blockDirty = true;
    let inkA = 0, paperA = 0, paperDrop = 0, flip = 0, printK = 0, sealK = 0, blockAway = 0;
    let rub = null;
    let brushPos = null, brushAng = 0, brushKind = 'ink';
    let resolvePick = null;

    // ---------------------------------------------------------------- DOM：目标字卡、四张写样
    const ui = el('div', 'carve-ui', ctx.root);
    const card = el('div', 'carve-target hide', ui);
    el('div', 'carve-target-lbl', card, '印出来应是');
    const cardCh = el('div', 'carve-target-ch', card, '');
    const cands = KINDS.map((k, idx) => {
      const b = el('button', 'carve-cand off gone', ui);
      b.type = 'button'; b.tabIndex = -1;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      const gl = el('span', 'carve-glyph', b, '');
      el('span', 'carve-key', b, String(idx + 1));
      const o = { b, gl, kind: k };
      b.addEventListener('click', () => { if (resolvePick && !b.classList.contains('off')) resolvePick(o); });
      return o;
    });
    let selIdx = -1;
    let why = null;
    const actBtn = button(ui, '铺 纸', 'verm carve-act hide', () => { if (actHandler) actHandler(); });
    const autoBtn = button(ui, '代 刷', 'paper small carve-auto hide', () => { if (rub && !rub.auto) autoRub(); });
    let actHandler = null;

    // ---------------------------------------------------------------- 布局
    function layout() {
      const w = ctx.w, h = ctx.h;
      const wide = w / h > 1.05;
      let block, cardR, cand;
      if (wide) {
        const panelW = clamp(w * 0.36, 250, 430);
        const area = { x: 20, y: 36, w: w - panelW - 44, h: h - 36 - 14 };
        let bh = area.h, bw = bh * BA;
        if (bw > area.w) { bw = area.w; bh = bw / BA; }
        block = { x: area.x + (area.w - bw) / 2, y: area.y + (area.h - bh) / 2, w: bw, h: bh };
        const px = w - panelW - 16, py = 40, ph = h - 56;
        const cs = Math.min((panelW - 16) / 2, (ph * 0.66 - 16) / 2, 150);
        const cardH = Math.min(ph * 0.3, cs * 1.25);
        cardR = { x: px + (panelW - cs * 1.1) / 2, y: py + 6, w: cs * 1.1, h: cardH };
        const gy = py + cardH + 26;
        const gx = px + (panelW - (cs * 2 + 14)) / 2;
        cand = KINDS.map((_, i) => ({ x: gx + (i % 2) * (cs + 14), y: gy + Math.floor(i / 2) * (cs + 18), s: cs }));
      } else {
        const cs = clamp(Math.min((w - 20 - 30) / 4, h * 0.14), 56, 110);
        const topH = clamp(h * 0.17, 84, 132);
        const bottomH = cs + 22;
        const area = { x: 12, y: 30 + topH, w: w - 24, h: h - 30 - topH - bottomH - 10 };
        let bh = area.h, bw = bh * BA;
        if (bw > area.w) { bw = area.w; bh = bw / BA; }
        block = { x: area.x + (area.w - bw) / 2, y: area.y + (area.h - bh) / 2, w: bw, h: bh };
        cardR = { x: (w - topH * 0.95) / 2, y: 26, w: topH * 0.95, h: topH - 4 };
        const gx = (w - (cs * 4 + 10 * 3)) / 2, gy = h - bottomH + 4;
        cand = KINDS.map((_, i) => ({ x: gx + i * (cs + 10), y: gy, s: cs }));
      }
      // 终场：版移到中央放大
      if (fin > 0) {
        const bh2 = Math.min(ctx.h - 90, (ctx.w - 30) / BA);
        const bw2 = bh2 * BA;
        const f = easeInOutCubic(fin);
        block = { x: lerp(block.x, (w - bw2) / 2, f), y: lerp(block.y, 36 + (h - 36 - 60 - bh2) / 2, f), w: lerp(block.w, bw2, f), h: lerp(block.h, bh2, f) };
      }
      return { w, h, wide, block, cardR, cand };
    }
    let lastLayKey = '';
    function applyDom(lay) {
      const key = `${lay.w}x${lay.h}|${fin > 0}`;
      if (key === lastLayKey) return;
      lastLayKey = key;
      Object.assign(card.style, { left: `${lay.cardR.x}px`, top: `${lay.cardR.y}px`, width: `${lay.cardR.w}px`, height: `${lay.cardR.h}px` });
      cardCh.style.fontSize = `${Math.round(Math.min(lay.cardR.w, lay.cardR.h - 20) * 0.72)}px`;
      cands.forEach((o, i) => {
        const r = lay.cand[i];
        Object.assign(o.b.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.s}px`, height: `${r.s}px` });
        o.gl.style.fontSize = `${Math.round(r.s * 0.72)}px`;
      });
      actBtn.style.bottom = `${narrow() ? 14 : 18}px`;
      autoBtn.style.bottom = `${narrow() ? 14 : 18}px`;
    }
    const cellPx = (lay, cell) => [lay.block.x + cell.u * lay.block.w, lay.block.y + cell.v * lay.block.h, cell.s * lay.block.h];

    // ---------------------------------------------------------------- 画字
    function glyphAt(gg, ch, x, y, size, { mirror = true, color = '#000', dx = 0, dy = 0, tf = null } = {}) {
      gg.save();
      gg.translate(x + dx, y + dy);
      if (tf === 'vflip') gg.scale(1, -1);
      else if (tf === 'rot') gg.rotate(Math.PI);
      else if (tf === 'normal') { /* 正字 */ } else if (mirror) gg.scale(-1, 1);
      gg.font = `${Math.round(size)}px ${FONT_BRUSH}`;
      gg.textAlign = 'center'; gg.textBaseline = 'middle';
      gg.fillStyle = color;
      gg.fillText(ch, 0, size * 0.04);
      gg.restore();
    }
    function reliefGlyph(gg, ch, x, y, size, inked = false) {
      const d = Math.max(1, size * 0.035);
      glyphAt(gg, ch, x, y, size, { color: 'rgba(45,22,6,.7)', dx: d, dy: d * 1.2 });
      glyphAt(gg, ch, x, y, size, { color: 'rgba(255,236,200,.55)', dx: -d * 0.6, dy: -d * 0.6 });
      glyphAt(gg, ch, x, y, size, { color: inked ? '#16110c' : '#d7ae76' });
    }

    // ---------------------------------------------------------------- 版（缓存）
    let blockC = null, blockKey = '';
    let inkC = null;
    const woodTex = noiseTex();
    function noiseTex() {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const b = c.getContext('2d');
      const NR = rng(5);
      const img = b.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) { const v = NR(); img.data[i * 4] = 60; img.data[i * 4 + 1] = 35; img.data[i * 4 + 2] = 12; img.data[i * 4 + 3] = v * v * 50; }
      b.putImageData(img, 0, 0);
      return c;
    }
    function frameGeom(bw, bh) {
      return { o: bw * 0.04, i: bw * 0.062, ow: Math.max(2, bw * 0.013), iw: Math.max(1, bw * 0.005) };
    }
    function renderBlock(bw, bh) {
      const key = `${Math.round(bw)}x${Math.round(bh)}|${ctx.dpr}`;
      if (!blockDirty && key === blockKey) return;
      blockKey = key; blockDirty = false;
      blockC = offscreen(bw, bh, ctx.dpr);
      const b = blockC.g;
      // 梨木版面
      const wg = b.createLinearGradient(0, 0, bw, bh);
      wg.addColorStop(0, '#e2bd88'); wg.addColorStop(0.5, '#d6ab72'); wg.addColorStop(1, '#c99a60');
      roundRect(b, 0, 0, bw, bh, Math.max(3, bw * 0.015)); b.fillStyle = wg; b.fill();
      b.save(); b.clip();
      const GR = rng(9);
      b.strokeStyle = 'rgba(120,70,30,.16)'; b.lineWidth = 1;
      for (let i = 0; i < 38; i++) {
        const x0 = GR() * bw;
        b.beginPath(); b.moveTo(x0, 0);
        for (let y = 0; y <= bh; y += bh / 12) b.lineTo(x0 + Math.sin(y / bh * 6 + i) * bw * 0.012 + (GR() - 0.5) * 2, y);
        b.stroke();
      }
      b.fillStyle = b.createPattern(woodTex, 'repeat'); b.fillRect(0, 0, bw, bh);
      b.restore();
      const fgm = frameGeom(bw, bh);
      // 刻去的底（版框之内）
      const rx = fgm.o, ry = fgm.o, rw = bw - fgm.o * 2, rh = bh - fgm.o * 2;
      const dg = b.createLinearGradient(0, ry, 0, ry + rh);
      dg.addColorStop(0, '#96673a'); dg.addColorStop(1, '#85582f');
      b.fillStyle = dg; b.fillRect(rx, ry, rw, rh);
      // 刀痕
      const CR = rng(21);
      b.strokeStyle = 'rgba(60,30,10,.28)'; b.lineWidth = 1;
      b.beginPath();
      for (let i = 0; i < 160; i++) {
        const x = rx + CR() * rw, y = ry + CR() * rh, l = 3 + CR() * 8, a = -0.6 + CR() * 1.2 + (CR() < 0.5 ? 0 : Math.PI / 2);
        b.moveTo(x, y); b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      b.stroke();
      b.fillStyle = 'rgba(0,0,0,.08)'; b.fillRect(rx, ry, rw, 3);
      // 未刻的格子：仍是平整版面
      for (const cell of cells) {
        if (cell.state === 'carved') continue;
        const cx = cell.u * bw, cy = cell.v * bh, s = cell.s * bh * 1.12;
        b.fillStyle = '#d8ae76';
        b.fillRect(cx - s / 2, cy - s / 2, s, s);
        b.strokeStyle = 'rgba(70,40,15,.45)'; b.lineWidth = 1;
        b.strokeRect(cx - s / 2 + 0.5, cy - s / 2 + 0.5, s - 1, s - 1);
        b.fillStyle = 'rgba(255,240,210,.35)'; b.fillRect(cx - s / 2, cy - s / 2, s, 1.5);
      }
      // 版框（四周双边）、界行
      const reliefRect = (x, y, w2, h2, lw) => {
        b.lineWidth = lw;
        b.strokeStyle = 'rgba(45,22,6,.65)'; b.strokeRect(x + 1, y + 1.2, w2, h2);
        b.strokeStyle = 'rgba(255,236,200,.6)'; b.strokeRect(x - 0.6, y - 0.6, w2, h2);
        b.strokeStyle = '#d7ae76'; b.strokeRect(x, y, w2, h2);
      };
      reliefRect(fgm.o, fgm.o, bw - fgm.o * 2, bh - fgm.o * 2, fgm.ow);
      reliefRect(fgm.i, fgm.i, bw - fgm.i * 2, bh - fgm.i * 2, fgm.iw);
      for (const u of ruleU) {
        const x = u * bw;
        b.lineWidth = fgm.iw;
        for (const [dx, dy, col] of [[1, 1, 'rgba(45,22,6,.6)'], [-0.6, 0, 'rgba(255,236,200,.5)'], [0, 0, '#d7ae76']]) {
          b.strokeStyle = col; b.beginPath(); b.moveTo(x + dx, fgm.i + dy); b.lineTo(x + dx, bh - fgm.i + dy); b.stroke();
        }
      }
      // 字
      for (const cell of cells) if (cell.state === 'carved') reliefGlyph(b, cell.ch, cell.u * bw, cell.v * bh, cell.s * bh);
    }
    function renderInk(bw, bh) {
      inkC = offscreen(bw, bh, ctx.dpr);
      const b = inkC.g;
      const fgm = frameGeom(bw, bh);
      b.fillStyle = 'rgba(20,14,8,.16)';
      b.fillRect(fgm.o, fgm.o, bw - fgm.o * 2, bh - fgm.o * 2);
      b.strokeStyle = '#120d09';
      b.lineWidth = fgm.ow; b.strokeRect(fgm.o, fgm.o, bw - fgm.o * 2, bh - fgm.o * 2);
      b.lineWidth = fgm.iw; b.strokeRect(fgm.i, fgm.i, bw - fgm.i * 2, bh - fgm.i * 2);
      for (const u of ruleU) { b.beginPath(); b.moveTo(u * bw, fgm.i); b.lineTo(u * bw, bh - fgm.i); b.stroke(); }
      for (const cell of cells) glyphAt(b, cell.ch, cell.u * bw, cell.v * bh, cell.s * bh, { color: '#120d09' });
    }

    // ---------------------------------------------------------------- 刷墨 / 刷印
    const GX = 12, GY = 16;
    let maskC = null, maskKey = '', tmpC = null;
    function ensureMask(bw, bh) {
      const key = `${Math.round(bw)}x${Math.round(bh)}|${rub ? rub.kind : ''}`;
      if (key === maskKey && maskC) return;
      maskKey = key;
      maskC = offscreen(bw, bh, ctx.dpr);
      tmpC = offscreen(bw, bh, ctx.dpr);
      if (rub) for (const s of rub.strokes) paintStroke(s, bw, bh);
    }
    function paintStroke([u0, v0, u1, v1], bw, bh) {
      const m = maskC.g;
      m.lineCap = 'round';
      m.strokeStyle = 'rgba(255,255,255,.5)';
      m.lineWidth = bw * 0.15;
      m.beginPath(); m.moveTo(u0 * bw, v0 * bh); m.lineTo(u1 * bw + 0.01, v1 * bh); m.stroke();
    }
    function addStroke(u0, v0, u1, v1) {
      if (!rub) return;
      const s = [u0, v0, u1, v1];
      rub.strokes.push(s);
      const lay = layout();
      ensureMask(lay.block.w, lay.block.h);
      paintStroke(s, lay.block.w, lay.block.h);
      const len = Math.hypot(u1 - u0, (v1 - v0) / BA);
      const steps = Math.max(1, Math.ceil(len / 0.03));
      const rr = 0.075;
      for (let k = 0; k <= steps; k++) {
        const u = lerp(u0, u1, k / steps), v = lerp(v0, v1, k / steps);
        for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
          const cu = (gx + 0.5) / GX, cvv = (gy + 0.5) / GY;
          if (Math.hypot(cu - u, (cvv - v) / BA * 0.66) < rr * 1.25) {
            const id = gy * GX + gx;
            if (rub.cover[id] < 2) { rub.cover[id]++; if (rub.cover[id] === 2) rub.count++; }
          }
        }
      }
      if (rub.strokes.length % 6 === 0) ctx.sfx(rub.kind === 'ink' ? 'brush' : 'swoosh');
      if (rub.count >= rub.need && rub.done) rub.done();
    }
    function autoRub() {
      if (!rub || rub.auto) return;
      rub.auto = true;
      let prev = null;
      const passes = 9;
      tw.to(2.2, (e) => {
        const k = e * passes;
        const row = Math.min(passes - 1, Math.floor(k));
        const f = k - row;
        const u = row % 2 ? 1.02 - f * 1.04 : -0.02 + f * 1.04;
        const v = 0.06 + row / (passes - 1) * 0.88 + Math.sin(f * Math.PI) * 0.02;
        if (prev) addStroke(prev[0], prev[1], u, v);
        prev = [u, v];
        const lay = layout();
        brushPos = [lay.block.x + u * lay.block.w, lay.block.y + v * lay.block.h];
        brushAng = row % 2 ? Math.PI : 0;
      }, { ease: (x) => x });
    }

    // ---------------------------------------------------------------- 画面
    let bg = null, bgKey = '';
    function ensureBg(w, h) {
      const key = `${w}x${h}`;
      if (key === bgKey) return;
      bgKey = key;
      bg = offscreen(w, h, ctx.dpr);
      const b = bg.g;
      // 书坊案头：深色木案
      const tg = b.createLinearGradient(0, 0, 0, h);
      tg.addColorStop(0, '#5a3a22'); tg.addColorStop(1, '#3e2615');
      b.fillStyle = tg; b.fillRect(0, 0, w, h);
      const GR = rng(3);
      b.strokeStyle = 'rgba(30,15,5,.3)'; b.lineWidth = 1.2;
      for (let i = 0; i < 30; i++) {
        const y0 = GR() * h;
        b.beginPath(); b.moveTo(0, y0);
        for (let x = 0; x <= w; x += w / 10) b.lineTo(x, y0 + Math.sin(x / w * 5 + i) * 6);
        b.stroke();
      }
      b.fillStyle = b.createPattern(woodTex, 'repeat'); b.fillRect(0, 0, w, h);
      const vg = b.createRadialGradient(w * 0.45, h * 0.45, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(255,220,160,.12)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
      b.fillStyle = vg; b.fillRect(0, 0, w, h);
      // 案角的书页、墨碟
      b.save();
      b.translate(w - 40, h - 26); b.rotate(-0.25);
      b.fillStyle = 'rgba(244,236,218,.9)'; b.fillRect(-70, -30, 110, 80);
      b.strokeStyle = 'rgba(40,30,20,.35)'; b.lineWidth = 1;
      for (let i = 0; i < 6; i++) { b.beginPath(); b.moveTo(-62 + i * 16, -22); b.lineTo(-62 + i * 16, 40); b.stroke(); }
      b.restore();
      b.fillStyle = '#1b1612'; b.beginPath(); b.ellipse(34, h - 26, 26, 14, 0, 0, TAU); b.fill();
      b.fillStyle = '#060504'; b.beginPath(); b.ellipse(34, h - 28, 18, 8, 0, 0, TAU); b.fill();
    }
    function drawTimer(lay, t) {
      if (phase !== 'carve') return;
      const x0 = 14, x1 = lay.w - 14, y = 14;
      const f = clamp(timeLeft / timeTotal, 0, 1);
      g.fillStyle = 'rgba(0,0,0,.35)'; roundRect(g, x0, y - 4, x1 - x0, 8, 4); g.fill();
      const low = timeLeft < 12;
      const bgr = g.createLinearGradient(x0, 0, x1, 0);
      bgr.addColorStop(0, low ? '#b23a2e' : '#8a6a2c'); bgr.addColorStop(1, low ? '#ff7a5a' : '#e8cf94');
      g.fillStyle = bgr; roundRect(g, x0 + 1, y - 3, Math.max(0, (x1 - x0 - 2) * f), 6, 3); g.fill();
      if (timing) glow(g, x0 + (x1 - x0) * f, y, 10, 'rgba(255,200,120,.8)', 0.7 + 0.3 * Math.sin(t * 10));
    }
    function drawBlock(lay, t) {
      const B = lay.block;
      if (blockAway >= 1) return;
      renderBlock(B.w, B.h);
      g.save();
      g.globalAlpha = 1 - blockAway;
      g.translate(0, blockAway * 40);
      g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
      g.drawImage(blockC.c, B.x, B.y, B.w, B.h);
      g.restore();
      // 当前格：高亮
      if (current && phase === 'carve' && current.state === 'raw') {
        const [x, y, s] = cellPx(lay, current);
        const ss = s * 1.18;
        const a = 0.55 + 0.45 * Math.sin(pulse * 5);
        g.save(); g.strokeStyle = `rgba(178,58,46,${a})`; g.lineWidth = 2.5; g.setLineDash([5, 4]);
        g.strokeRect(x - ss / 2, y - ss / 2, ss, ss); g.restore();
      }
      // 正在刻的格子
      for (const cell of cells) {
        if (cell.state !== 'draft') continue;
        const [x, y, s] = cellPx(lay, cell);
        const k = cell.k;
        const ss = s * 1.12;
        g.save();
        g.globalAlpha = clamp(k * 1.4, 0, 1);
        const dg = g.createLinearGradient(0, y - ss / 2, 0, y + ss / 2);
        dg.addColorStop(0, '#96673a'); dg.addColorStop(1, '#85582f');
        g.fillStyle = dg; g.fillRect(x - ss / 2, y - ss / 2, ss, ss);
        g.globalAlpha = clamp((k - 0.25) / 0.6, 0, 1);
        reliefGlyph(g, cell.ch, x, y, s);
        g.restore();
        // 写样纸
        const pa = 1 - clamp((k - 0.15) / 0.7, 0, 1);
        if (pa > 0.01) {
          g.save(); g.globalAlpha = pa;
          g.fillStyle = 'rgba(246,238,220,.92)';
          g.fillRect(x - ss / 2, y - ss / 2, ss, ss);
          glyphAt(g, cell.ch, x, y, s, { color: 'rgba(20,15,10,.85)' });
          g.restore();
        }
      }
      // 墨
      if (rub && rub.kind === 'ink' || inkA > 0) {
        if (!inkC || inkC.w !== B.w || inkC.h !== B.h) renderInk(B.w, B.h);
        if (inkA >= 1 && !rub) {
          g.save(); g.globalAlpha = 1 - blockAway; g.translate(0, blockAway * 40); g.drawImage(inkC.c, B.x, B.y, B.w, B.h); g.restore();
        } else if (rub && rub.kind === 'ink') {
          ensureMask(B.w, B.h);
          const tg2 = tmpC.g;
          tg2.save(); tg2.setTransform(1, 0, 0, 1, 0, 0); tg2.clearRect(0, 0, tmpC.c.width, tmpC.c.height); tg2.restore();
          tg2.globalCompositeOperation = 'source-over';
          tg2.drawImage(inkC.c, 0, 0, B.w, B.h);
          tg2.globalCompositeOperation = 'destination-in';
          tg2.drawImage(maskC.c, 0, 0, B.w, B.h);
          tg2.globalCompositeOperation = 'source-over';
          g.drawImage(tmpC.c, B.x, B.y, B.w, B.h);
          // 墨面反光
          g.save(); g.globalAlpha = 0.1; g.globalCompositeOperation = 'lighter';
          g.drawImage(maskC.c, B.x, B.y, B.w, B.h); g.restore();
        }
      }
    }
    function paperTex(gg, w2, h2) {
      const pg = gg.createLinearGradient(0, 0, w2, h2);
      pg.addColorStop(0, '#fbf6ea'); pg.addColorStop(1, '#efe5cc');
      gg.fillStyle = pg; gg.fillRect(0, 0, w2, h2);
      gg.strokeStyle = 'rgba(150,120,80,.12)'; gg.lineWidth = 0.7;
      const FR = rng(17);
      gg.beginPath();
      for (let i = 0; i < 70; i++) { const x = FR() * w2, y = FR() * h2, l = 6 + FR() * 18, a = FR() * Math.PI; gg.moveTo(x, y); gg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
      gg.stroke();
    }
    let printC = null, printKey = '';
    function renderPrint(bw, bh) {
      const key = `${Math.round(bw)}x${Math.round(bh)}`;
      if (key === printKey && printC) return;
      printKey = key;
      if (!inkC || inkC.w !== bw) renderInk(bw, bh);
      printC = offscreen(bw, bh, ctx.dpr);
      const b = printC.g;
      paperTex(b, bw, bh);
      b.save(); b.translate(bw, 0); b.scale(-1, 1);
      b.globalAlpha = 0.93; b.drawImage(inkC.c, 0, 0, bw, bh);
      b.restore();
      // 印刷的干湿不匀
      b.save(); b.globalCompositeOperation = 'destination-out';
      const NR = rng(33);
      for (let i = 0; i < 260; i++) { b.fillStyle = `rgba(0,0,0,${0.15 + NR() * 0.25})`; b.beginPath(); b.arc(NR() * bw, NR() * bh, 0.6 + NR() * 1.6, 0, TAU); b.fill(); }
      b.restore();
      b.save(); b.globalCompositeOperation = 'destination-over'; paperTex(b, bw, bh); b.restore();
    }
    function drawSeal(x, y, s, k) {
      if (k <= 0) return;
      const sc = lerp(2.2, 1, easeOutCubic(Math.min(1, k * 1.6)));
      const a = clamp(k * 2.5, 0, 1);
      g.save();
      g.translate(x, y); g.rotate(-0.08); g.scale(sc, sc);
      g.globalAlpha = a;
      const w2 = s * 0.46, h2 = s * 1.2;
      g.fillStyle = '#b8322a';
      roundRect(g, -w2 / 2, -h2 / 2, w2, h2, s * 0.04); g.fill();
      g.strokeStyle = '#fbeee0'; g.lineWidth = Math.max(1.2, s * 0.03);
      roundRect(g, -w2 / 2 + s * 0.04, -h2 / 2 + s * 0.04, w2 - s * 0.08, h2 - s * 0.08, s * 0.03); g.stroke();
      g.font = `${Math.round(s * 0.32)}px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fbeee0';
      [...'世德堂'].forEach((ch, i) => g.fillText(ch, 0, -h2 / 2 + s * 0.24 + i * s * 0.36));
      // 斑驳
      g.globalCompositeOperation = 'destination-out';
      const NR = rng(8);
      for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + NR() * 0.4})`; g.beginPath(); g.arc((NR() - 0.5) * w2, (NR() - 0.5) * h2, 0.5 + NR() * 1.5, 0, TAU); g.fill(); }
      g.restore();
    }
    function drawPaper(lay, t) {
      if (paperA <= 0) return;
      const B = lay.block;
      const drop = 1 - easeOutCubic(paperDrop);
      // 翻纸：绕竖轴
      const f = easeInOutCubic(flip);
      const sx = Math.cos(f * Math.PI);
      const lift = Math.sin(f * Math.PI) * 18;
      const px = lerp(B.x, B.x, f), py = B.y - drop * B.h * 0.25 - lift;
      g.save();
      g.globalAlpha = paperA * (1 - drop * 0.6);
      g.translate(px + B.w / 2, py + B.h / 2);
      g.scale(Math.abs(sx) < 0.02 ? 0.02 : Math.abs(sx), 1);
      g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 16 + lift; g.shadowOffsetY = 6 + lift * 0.5;
      if (sx >= 0) {
        // 纸背：透出反字
        g.fillStyle = '#f6efdf'; g.fillRect(-B.w / 2, -B.h / 2, B.w, B.h);
        g.shadowColor = 'transparent';
        g.save(); g.translate(-B.w / 2, -B.h / 2);
        paperTex(g, B.w, B.h);
        if (printK > 0 && inkC) {
          if (rub && rub.kind === 'print') {
            ensureMask(B.w, B.h);
            const tg2 = tmpC.g;
            tg2.save(); tg2.setTransform(1, 0, 0, 1, 0, 0); tg2.clearRect(0, 0, tmpC.c.width, tmpC.c.height); tg2.restore();
            tg2.drawImage(inkC.c, 0, 0, B.w, B.h);
            tg2.globalCompositeOperation = 'destination-in';
            tg2.drawImage(maskC.c, 0, 0, B.w, B.h);
            tg2.globalCompositeOperation = 'source-over';
            g.globalAlpha = 0.32; g.drawImage(tmpC.c, 0, 0, B.w, B.h);
          } else { g.globalAlpha = 0.32; g.drawImage(inkC.c, 0, 0, B.w, B.h); }
        }
        g.restore();
      } else {
        renderPrint(B.w, B.h);
        g.drawImage(printC.c, -B.w / 2, -B.h / 2, B.w, B.h);
      }
      g.restore();
      if (sx < 0 && sealK > 0) {
        const fgm = frameGeom(B.w, B.h);
        const s = B.w * 0.2;
        drawSeal(B.x + fgm.i + s * 0.3, B.y + B.h - fgm.i - s * 0.62, s, sealK);
      }
    }
    function drawBrush() {
      if (!brushPos || !rub) return;
      const [x, y] = brushPos;
      g.save();
      g.translate(x, y); g.rotate(brushAng * 0.15 - 0.3);
      const s = clamp(ctx.w * 0.05, 26, 46);
      if (brushKind === 'ink') {
        // 墨刷（圆刷）
        g.fillStyle = '#6a4a2a'; roundRect(g, -s * 0.12, -s * 1.3, s * 0.24, s * 0.9, s * 0.08); g.fill();
        g.fillStyle = '#1a140e'; g.beginPath(); g.ellipse(0, -s * 0.2, s * 0.45, s * 0.34, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
        for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * s * 0.1, -s * 0.45); g.lineTo(i * s * 0.12, s * 0.08); g.stroke(); }
      } else {
        // 棕刷（长条）
        g.fillStyle = '#7a5530'; roundRect(g, -s * 0.7, -s * 0.55, s * 1.4, s * 0.4, s * 0.1); g.fill();
        g.fillStyle = '#4a3220';
        for (let i = -6; i <= 6; i++) { g.fillRect(i * s * 0.1 - 1, -s * 0.18, 2, s * 0.32); }
        g.strokeStyle = '#2a1a0c'; g.lineWidth = 1.2; roundRect(g, -s * 0.7, -s * 0.55, s * 1.4, s * 0.4, s * 0.1); g.stroke();
      }
      g.restore();
    }
    function drawFlying(lay) {
      if (!flying) return;
      const cell = flying.cell;
      const [x1, y1, s1] = cellPx(lay, cell);
      const [x0, y0, s0] = flying.from;
      const k = easeInOutCubic(clamp(flying.t, 0, 1));
      const x = lerp(x0, x1, k), y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 50;
      const s = lerp(s0, s1 * 1.12, k);
      g.save();
      g.translate(x, y); g.rotate((1 - k) * 0.25 * flying.spin);
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 12; g.shadowOffsetY = 6 * (1 - k);
      g.fillStyle = '#f7f0de'; g.fillRect(-s / 2, -s / 2, s, s);
      g.shadowColor = 'transparent';
      glyphAt(g, cell.ch, 0, 0, s * 0.72, { tf: flying.kind === 'mirror' ? null : flying.kind, color: '#1d1b18' });
      g.restore();
    }

    // ---------------------------------------------------------------- 主循环
    let loopErr = false;
    const stopLoop = ctx.loop((dt) => {
      if (hostPaused(ctx)) dt = 0; // 宿主「暂且离开？」确认框打开时，香也停着
      time += dt;
      pulse += dt;
      tw.update(dt);
      P.update(dt);
      try { frame(dt, time); } catch (e) { if (!loopErr) { loopErr = true; console.error('[carve]', e); } }
    });
    function frame(dt, t) {
      if (timing) {
        timeLeft = Math.max(0, timeLeft - dt);
        if (timeLeft <= 0 && resolvePick) resolvePick(null);
      }
      if (flying) flying.t += dt / flying.dur;
      const lay = layout();
      applyDom(lay);
      ensureBg(lay.w, lay.h);
      g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      g.clearRect(0, 0, lay.w, lay.h);
      g.drawImage(bg.c, 0, 0, lay.w, lay.h);
      drawTimer(lay, t);
      drawBlock(lay, t);
      drawPaper(lay, t);
      drawFlying(lay);
      P.draw(g);
      drawBrush();
    }

    // ---------------------------------------------------------------- 选写样
    function hud() {
      const n = narrow();
      const idx = Math.min(total, answered + 1);
      ctx.hud({
        center: phase === 'carve' ? (n ? `${idx}/${total}字` : `第 ${idx}/${total} 字`) : (n ? '印书' : '刷印成书'),
        right: n ? `对${correct}` + (streak >= 2 ? ` 连${streak}` : '') : `刻对 <b>${correct}</b>` + (streak >= 2 ? ` · 连 ${streak}` : '') + ` · 余 ${Math.ceil(timeLeft)} 秒`,
      });
    }
    let hudAcc = 0;
    S.add(ctx.loop((dt) => { hudAcc += dt; if (hudAcc > 0.25) { hudAcc = 0; if (phase === 'carve') hud(); } }));
    function setSel(i) {
      selIdx = i;
      cands.forEach((o, j) => o.b.classList.toggle('sel', j === i));
    }
    function candCenter(o) {
      const r = o.b.getBoundingClientRect(), rr = ctx.root.getBoundingClientRect();
      return [r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2, r.width];
    }
    async function carveCell(cell, kindFrom, fromO, master) {
      // 写样飞上版
      const [fx, fy, fs] = candCenter(fromO);
      fromO.b.classList.add('gone');
      flying = { cell, kind: kindFrom, from: [fx, fy, fs], t: 0, dur: master ? 0.3 : 0.38, spin: R() < 0.5 ? -1 : 1 };
      ctx.sfx('whoosh');
      await tw.delay(flying.dur);
      flying = null;
      cell.state = 'draft'; cell.k = 0;
      ctx.sfx('page');
      const lay = layout();
      const [x, y, s] = cellPx(lay, cell);
      const dur = master ? 0.55 : 0.8;
      const knocks = [0.1, 0.4, 0.7];
      knocks.forEach((kk) => tw.after(dur * kk, () => {
        ctx.sfx('wood');
        P.emit(9, (q) => {
          const a = -Math.PI / 2 + (R() - 0.5) * 2.4, sp = 60 + R() * 140;
          q.x = x + (R() - 0.5) * s * 0.8; q.y = y + (R() - 0.5) * s * 0.8; q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; q.ay = 420; q.drag = 1;
          q.life = 0.6 + R() * 0.4; q.size = 2 + R() * 3; q.shape = 'chip'; q.vr = (R() - 0.5) * 18; q.color = R() < 0.5 ? '#e0b680' : '#c9955a';
        });
      }));
      await tw.to(dur, (e) => { cell.k = e; }, { ease: (v) => v });
      cell.state = 'carved';
      blockDirty = true;
      ctx.sfx('brush');
    }
    async function ask(cell) {
      current = cell;
      answered = order.indexOf(cell);
      hud();
      cardCh.textContent = cell.ch;
      cardCh.classList.remove('pop'); void cardCh.offsetWidth; cardCh.classList.add('pop');
      const kinds = shuffle(KINDS, R);
      cands.forEach((o, i) => {
        o.kind = kinds[i];
        o.gl.textContent = cell.ch;
        o.gl.style.transform = TF[o.kind];
        o.b.className = 'carve-cand';
      });
      setSel(-1);
      ctx.sfx('page');
      timing = true;
      const pick = await waitFor(ctx, (done) => { resolvePick = done; return () => { resolvePick = null; }; });
      timing = false;
      cands.forEach((o) => o.b.classList.add('off'));
      setSel(-1);
      const right = cands.find((o) => o.kind === 'mirror');
      if (pick && pick.kind === 'mirror') {
        correct++; streak++; bestStreak = Math.max(bestStreak, streak);
        if (streak >= 3) bonus += 2;
        ctx.sfx(streak >= 3 ? 'perfect' : 'good');
        ctx.toast(streak >= 3 ? `连对${['', '', '', '三', '四', '五', '六', '七', '八', '九', '十'][Math.min(10, streak)]}字！` : ['好！', '对！', '妙！'][correct % 3], streak >= 3 ? 'gold' : 'good');
        cands.forEach((o) => { if (o !== pick) o.b.classList.add('gone'); });
        await carveCell(cell, 'mirror', pick, false);
      } else {
        streak = 0;
        if (pick) {
          ctx.sfx('bad');
          pick.b.classList.add('wrong');
          const [x, y, sz] = candCenter(pick);
          why = el('div', 'carve-why', ui, WHY[pick.kind]);
          why.style.left = `${clamp(x, 90, ctx.w - 90)}px`; why.style.top = `${y - sz / 2 - 6}px`;
          right.b.classList.add('right');
          await tw.delay(1.1);
          why.remove(); why = null;
        } else {
          right.b.classList.add('right');
          await tw.delay(0.3);
        }
        ctx.toast('师傅补刻', '');
        cands.forEach((o) => { if (o !== right) o.b.classList.add('gone'); });
        await carveCell(cell, 'mirror', right, true);
      }
      hud();
    }
    S.add(ctx.keys.onDown((code, e) => {
      if (hostPaused(ctx)) return;
      if (phase === 'carve' && resolvePick) {
        const m = /^(Digit|Numpad)([1-4])$/.exec(code);
        if (m) { e.preventDefault(); resolvePick(cands[Number(m[2]) - 1]); return; }
        if (code === 'ArrowLeft' || code === 'ArrowUp') { e.preventDefault(); setSel(selIdx < 0 ? 0 : (selIdx + 3) % 4); ctx.sfx('tick'); }
        else if (code === 'ArrowRight' || code === 'ArrowDown') { e.preventDefault(); setSel(selIdx < 0 ? 0 : (selIdx + 1) % 4); ctx.sfx('tick'); }
        else if ((code === 'Space' || code === 'Enter' || code === 'NumpadEnter') && selIdx >= 0) { e.preventDefault(); resolvePick(cands[selIdx]); }
      } else if (phase === 'finale') {
        if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
          e.preventDefault();
          if (rub && !rub.auto) autoRub();
          else if (actHandler) actHandler();
        }
      }
    }));

    // ---------------------------------------------------------------- 终场操作
    let rubbing = false;
    S.on(cv.canvas, 'pointerdown', (e) => {
      if (phase !== 'finale') return;
      const q = localXY(cv.canvas, e);
      const lay = layout();
      const B = lay.block;
      const inside = q.x > B.x - 20 && q.x < B.x + B.w + 20 && q.y > B.y - 20 && q.y < B.y + B.h + 20;
      if (rub && !rub.auto && inside) {
        rubbing = true;
        try { cv.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        const u = (q.x - B.x) / B.w, v = (q.y - B.y) / B.h;
        rub.last = [u, v];
        brushPos = [q.x, q.y];
        addStroke(u, v, u, v);
      } else if (!rub && actHandler && inside) actHandler();
    });
    S.on(cv.canvas, 'pointermove', (e) => {
      if (phase !== 'finale' || !rub || rub.auto) return;
      const q = localXY(cv.canvas, e);
      const lay = layout();
      const B = lay.block;
      if (!rubbing) { if (e.pointerType === 'mouse') brushPos = [q.x, q.y]; return; }
      const u = (q.x - B.x) / B.w, v = (q.y - B.y) / B.h;
      const [u0, v0] = rub.last;
      if (Math.hypot(u - u0, v - v0) < 0.004) return;
      brushAng = Math.atan2(q.y - brushPos[1], q.x - brushPos[0]);
      brushPos = [q.x, q.y];
      addStroke(u0, v0, u, v);
      rub.last = [u, v];
    });
    const endRub = () => { rubbing = false; };
    S.on(cv.canvas, 'pointerup', endRub);
    S.on(cv.canvas, 'pointercancel', endRub);

    function doRub(kind) {
      return waitFor(ctx, (done) => {
        rub = { kind, strokes: [], cover: new Uint8Array(GX * GY), count: 0, need: Math.round(GX * GY * (easy ? 0.8 : 0.88)), last: null, auto: false, done: null };
        brushKind = kind;
        maskKey = '';
        rub.done = () => { rub.done = null; done(); };
        autoBtn.classList.remove('hide');
        return () => { autoBtn.classList.add('hide'); };
      });
    }
    function waitAct(label) {
      return waitFor(ctx, (done) => {
        actBtn.setLabel(label);
        actBtn.classList.remove('hide');
        actHandler = () => { actHandler = null; ctx.sfx('click'); done(); };
        return () => { actBtn.classList.add('hide'); actHandler = null; };
      });
    }
    async function finale() {
      phase = 'finale';
      hud();
      card.classList.add('hide');
      cands.forEach((o) => o.b.classList.add('gone', 'off'));
      current = null;
      tip.set('十字刻成！接下来印一张看看。', '');
      await tw.to(1.0, (e) => { fin = e; }, { ease: (x) => x });
      lastLayKey = '';
      // 刷墨
      tip.set(`按住在版面上<b>来回拖动</b>，把墨刷匀。${ctx.isTouch ? '' : '（也可按空格代刷）'}`, '');
      ctx.sfx('ink');
      await doRub('ink');
      rub.auto = true;
      brushPos = null;
      inkA = 1;
      rub = null;
      ctx.sfx('good'); ctx.toast('墨刷匀了', 'good');
      // 铺纸
      tip.set('铺上一张白绵纸。', '');
      await waitAct('铺 纸');
      ctx.sfx('page');
      paperA = 1; paperDrop = 0;
      await tw.to(0.6, (e) => { paperDrop = e; }, { ease: easeOutCubic });
      // 刷印
      tip.set(`用<b>棕刷</b>在纸背上来回刷，把字印上去。${ctx.isTouch ? '' : '（也可按空格代刷）'}`, '');
      printK = 1;
      await doRub('print');
      rub.auto = true;
      brushPos = null;
      rub = null;
      ctx.sfx('good'); ctx.toast('印好了', 'good');
      // 揭纸
      tip.set('轻轻揭起纸来——', '');
      await waitAct('揭 纸');
      ctx.sfx('page');
      await tw.to(1.0, (e) => { flip = e; }, { ease: (x) => x });
      tw.to(0.6, (e) => { blockAway = e; });
      ctx.sfx('sparkle');
      tip.set('<span class="libb-who">阿麟</span>印出来是正的！', '');
      await tw.delay(0.5);
      ctx.sfx('stamp');
      await tw.to(0.5, (e) => { sealK = e; }, { ease: (x) => x });
      ctx.sfx('seal');
      const lay = layout();
      P.emit(24, (q) => {
        const a = R() * TAU, sp = 40 + R() * 120;
        q.x = lay.block.x + lay.block.w / 2; q.y = lay.block.y + lay.block.h / 2; q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; q.drag = 2;
        q.life = 0.9 + R() * 0.5; q.size = 3 + R() * 3; q.shape = 'star'; q.color = R() < 0.5 ? '#ffe7a0' : '#fff'; q.add = true; q.vr = 4;
      });
      ctx.toast('新书印成！', 'gold');
      await tw.delay(2.4);
      tip.hide();
    }
    async function failAnim() {
      phase = 'done';
      card.classList.add('hide');
      cands.forEach((o) => o.b.classList.add('gone', 'off'));
      current = null;
      tip.set(`只刻对了 <b>${correct}</b> 个字，这块版印不得了……`, 'dark');
      ctx.toast('错字太多', 'bad');
      ctx.sfx('crack');
      await tw.delay(1.6);
    }

    if (opts.debug) {
      window.__carve = {
        get phase() { return phase; }, get correct() { return correct; }, get picking() { return !!resolvePick; },
        get rub() { return rub ? { kind: rub.kind, count: rub.count, need: rub.need } : null; }, get canAct() { return !!actHandler; },
        get timeLeft() { return timeLeft; }, set timeLeft(v) { timeLeft = v; },
        pick: (kind) => { const o = cands.find((c) => c.kind === kind); if (resolvePick && o) resolvePick(o); },
        autoRub: () => autoRub(), act: () => { if (actHandler) actHandler(); },
      };
    }

    // ---------------------------------------------------------------- 运行
    try {
      await fontReady(allChars, 64);
      hud();
      tip.set('写样纸是<b>反贴</b>上版的：版上的字要<b>左右相反</b>，印出来才是正的。', '');
      card.classList.remove('hide');
      await tw.delay(0.4);
      for (const cell of order) {
        if (timeLeft <= 0) {
          // 时间到：余下的字由师傅补刻
          streak = 0;
          cell.state = 'carved';
          blockDirty = true;
          continue;
        }
        await ask(cell);
        if (order.indexOf(cell) === 0) tip.hide();
      }
      answered = total;
      current = null;
      hud();
      if (timeLeft <= 0 && correct < need) ctx.toast('香尽了', 'bad');
      if (correct < need) {
        await failAnim();
        return { success: false, score: correct * 10, perfect: false, note: `刻对 ${correct} 个字，还差一些。诀窍：写样纸反贴上版——版上的字，要像在镜子里看到的一样。` };
      }
      await finale();
      const perfect = correct === total;
      return {
        success: true,
        score: correct * 10 + bonus,
        perfect,
        note: `刻对 ${correct}/${total} 字${bestStreak >= 3 ? `，最多连对 ${bestStreak} 字` : ''}。五年后（万历二十年，1592 年），金陵世德堂刊行《新刻出像官板大字西游记》——这是现存最早的完整《西游记》刊本。`,
      };
    } finally {
      stopLoop();
      S.dispose();
    }
  },
};
