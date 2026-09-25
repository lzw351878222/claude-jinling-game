// 点灯 —— 「琉璃塔上一百四十六盏长明灯」
// 八角形的一层塔檐挂八盏长明灯：点一盏，它和左右两盏一起翻转（亮↔熄）。三层：第一、第五、第九层。
import { clamp, lerp, easeOutCubic, easeInOutCubic, easeOutBack, rng } from '../core/util.js';
import {
  scope, waitFor, Tweens, Particles, tipLine, glow, brushText, approach, offscreen, localXY, mix, rgba, fontReady, hostPaused, FONT_BRUSH,
} from './lib-b.js';
import { N, FULL, popcount, buildRule, genPuzzle, STOREYS } from './lamps-logic.js';

const TAU = Math.PI * 2;
const lampAngle = (i) => -Math.PI / 2 + i * Math.PI / 4;

export default {
  id: 'lamps',
  title: '点灯',
  subtitle: '琉璃塔上一百四十六盏长明灯',
  rules: [
    '点一盏灯，它和<b>左右相邻的两盏</b>会一起翻转：亮的熄，熄的亮。',
    '让这一圈<b>八盏灯全部点亮</b>，这一层就亮了。共三层，越往上越难。',
    '每点一次耗一勺<b>灯油</b>；油尽而灯未全亮，就要从头再来。',
    '第九层挂着<b>金链</b>：点带链的灯，链子另一头的灯也会随之翻转。',
  ],
  controls: '点按灯笼 · 键盘 ←→ 选灯、空格点灯，或直接按 1–8',

  async play(ctx, opts = {}) {
    const easy = ctx.difficulty === 0;
    const seed = (opts.seed != null ? Number(opts.seed) : (Date.now() & 0xffffff)) + ctx.attempt * 1013;
    const R = rng(seed);
    const S = scope(ctx);
    const tw = new Tweens(ctx.signal);
    const P = new Particles();
    const cv = ctx.canvas();
    const g = cv.g;
    const tip = tipLine(ctx.root);
    const narrow = () => ctx.w < 560;

    const storeys = STOREYS.map((st) => {
      const rule = buildRule(st.links);
      const min = st.min[easy ? 0 : 1];
      return { ...st, rule, min, start: genPuzzle(rule, min, R) };
    });
    const startAt = clamp(Number(opts.storey) || 0, 0, 2);

    // ---------------------------------------------------------------- 状态
    let cur = storeys[0];
    let si = 0;
    let state = FULL;
    let moves = 0, oil = 1, oilMax = 1, totalMoves = 0, totalMin = 0;
    const lamps = Array.from({ length: N }, () => ({ lit: false, lv: 0, pop: 0, flash: 0, scale: 0 }));
    let ringAlpha = 0, titleA = 0, titleText = '', coreGlow = 0, chainA = 0;
    const pagLv = new Array(9).fill(0), pagTarget = new Array(9).fill(0);
    let spireLv = 0, spireTarget = 0, halo = 0, haloTarget = 0, fin = 0;
    let litFloors = 0;
    let inputOn = false, cursor = 0, showCursor = false, hintLamp = -1, guided = false, nonProgress = 0, lastDist = 0; // lastDist：本层到过的最少剩余步数
    let oilFlash = 0, shake = 0;
    let pulses = [];
    let resolveStorey = null;
    let time = 0;

    // 预先点亮已通过的楼层（opts.storey 调试用）
    for (let k = 0; k < startAt; k++) { for (let f = litFloors; f < storeys[k].floor; f++) { pagTarget[f] = 1; pagLv[f] = 1; } litFloors = storeys[k].floor; }

    // ---------------------------------------------------------------- 布局
    function layout() {
      const w = ctx.w, h = ctx.h;
      if (h / w >= 1.45) {
        // 高竖屏：灯圈在上，塔在下
        const ringH = h * 0.58, topPad = 38;
        const Rr = Math.max(52, Math.min(w / 2 - 20, (ringH - topPad) / 2 - 4) / 1.12);
        const cx = w / 2, cy = topPad + (ringH - topPad) / 2;
        const L = clamp(Rr * 0.42, 30, 64);
        const tipTop = cy + Rr * 1.12 + 12;
        const pagTop = tipTop + 46;
        const H1 = Math.max(120, Math.min(h - pagTop - 6, (w * 0.6) / 0.36));
        const H2 = Math.min(h * 0.94, (w * 0.8) / 0.36);
        const f = easeInOutCubic(fin);
        const pag = { cx: w / 2, by: h - 6, H: lerp(H1, H2, f) };
        return { w, h, portrait: true, tall: true, cx, cy, R: Rr, L, pag, ringW: w, pw: w, tipTop };
      }
      const portrait = w / h < 0.95;
      const pw = portrait ? clamp(w * 0.27, 78, 150) : clamp(w * 0.3, 150, 330);
      const ringW = w - pw - (portrait ? 0 : 10);
      const topPad = portrait ? 40 : 42, botPad = portrait ? 64 : (ctx.isTouch ? 62 : 80);
      const availH = h - topPad - botPad;
      const Rr = Math.max(52, Math.min(ringW / 2 - (portrait ? 22 : 40), availH / 2) / 1.12);
      const cx = ringW / 2 + (portrait ? 4 : 10);
      const cy = topPad + availH / 2;
      const L = clamp(Rr * 0.42, 30, 64);
      // 塔：侧栏 → 终场居中放大
      const colCx = w - pw / 2 - (portrait ? 2 : 10);
      const H1 = Math.min(h - 20, (pw - 6) / 0.36);
      const H2 = Math.min(h * 0.94, (w * 0.8) / 0.36);
      const f = easeInOutCubic(fin);
      const pag = { cx: lerp(colCx, w / 2, f), by: h - 6, H: lerp(H1, H2, f) };
      return { w, h, portrait, cx, cy, R: Rr, L, pag, ringW, pw };
    }
    const lampPos = (lay, i) => [lay.cx + Math.cos(lampAngle(i)) * lay.R, lay.cy + Math.sin(lampAngle(i)) * lay.R];

    // ---------------------------------------------------------------- 背景（缓存）
    let bg = null, bgKey = '';
    const twinkles = Array.from({ length: 26 }, () => ({ x: R(), y: R() * 0.55, p: R() * TAU, s: 0.6 + R() * 1.1 }));
    function ensureBg(w, h) {
      const key = `${w}x${h}`;
      if (key === bgKey) return;
      bgKey = key;
      bg = offscreen(w, h, ctx.dpr);
      const b = bg.g;
      const sky = b.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#060a16');
      sky.addColorStop(0.5, '#0f1830');
      sky.addColorStop(0.82, '#1f2645');
      sky.addColorStop(1, '#2b2a44');
      b.fillStyle = sky; b.fillRect(0, 0, w, h);
      const SR = rng(7);
      for (let i = 0; i < Math.round(w * h / 2600); i++) {
        const x = SR() * w, y = SR() * h * 0.8, r = SR() < 0.93 ? 0.4 + SR() * 0.7 : 1 + SR() * 0.8;
        b.fillStyle = `rgba(${220 + SR() * 35 | 0},${220 + SR() * 30 | 0},255,${0.25 + SR() * 0.6})`;
        b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
      }
      // 月
      const tallBg = h / w >= 1.45;
      const mx = tallBg ? w * 0.8 : w * 0.08 + 26, my = tallBg ? h * 0.7 : h * 0.1 + 22, mr = clamp(Math.min(w, h) * 0.045, 14, 30);
      const mg = b.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 5);
      mg.addColorStop(0, 'rgba(240,230,200,.28)'); mg.addColorStop(1, 'rgba(240,230,200,0)');
      b.fillStyle = mg; b.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
      b.fillStyle = '#f3ead0'; b.beginPath(); b.arc(mx, my, mr, 0, TAU); b.fill();
      b.fillStyle = 'rgba(200,190,160,.35)';
      b.beginPath(); b.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, TAU); b.fill();
      b.beginPath(); b.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.15, 0, TAU); b.fill();
      // 薄云
      for (let i = 0; i < 5; i++) {
        const cx = SR() * w, cy = h * (0.12 + SR() * 0.35), rx = w * (0.12 + SR() * 0.2), ry = rx * 0.08;
        const cg = b.createRadialGradient(cx, cy, 0, cx, cy, rx);
        cg.addColorStop(0, 'rgba(120,130,170,.10)'); cg.addColorStop(1, 'rgba(120,130,170,0)');
        b.save(); b.translate(cx, cy); b.scale(1, ry / rx); b.translate(-cx, -cy);
        b.fillStyle = cg; b.beginPath(); b.arc(cx, cy, rx, 0, TAU); b.fill(); b.restore();
      }
      // 远山、城墙
      const hill = (y0, amp, col, sd) => {
        const HR = rng(sd);
        b.fillStyle = col; b.beginPath(); b.moveTo(0, h);
        const n = 7;
        const pts = [];
        for (let i = 0; i <= n; i++) pts.push([i / n * w, y0 - HR() * amp]);
        b.lineTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          const [x0, yA] = pts[i - 1], [x1, yB] = pts[i];
          b.quadraticCurveTo((x0 + x1) / 2, Math.min(yA, yB) - amp * 0.5 * HR(), x1, yB);
        }
        b.lineTo(w, h); b.closePath(); b.fill();
      };
      hill(h * 0.84, h * 0.08, '#141b33', 3);
      hill(h * 0.9, h * 0.05, '#10162a', 5);
      // 城墙垛口
      b.fillStyle = '#0c1122';
      const wy = h * 0.93;
      b.fillRect(0, wy, w, h - wy);
      for (let x = 0; x < w; x += 12) b.fillRect(x, wy - 5, 7, 5);
      // 江面反光
      b.fillStyle = 'rgba(255,210,140,.05)';
      b.fillRect(0, h - 4, w, 4);
    }

    // ---------------------------------------------------------------- 琉璃塔（侧视）
    const UNLIT = { wall: '#1d2540', side: '#161d34', eave: '#10162a', rim: '#34405f', door: '#0a0e1a' };
    const LIT = { wall: '#f8efdb', side: '#e3d2ac', eave: '#2f8c6a', rim: '#e2b33c', door: '#ffcf73' };
    function drawPagoda(lay, t) {
      const { cx, by, H } = lay.pag;
      if (halo > 0.01) {
        glow(g, cx, by - H * 0.5, H * 0.75, 'rgba(255,190,100,.55)', halo * (0.85 + 0.15 * Math.sin(t * 2)));
        glow(g, cx, by - H * 0.9, H * 0.25, 'rgba(255,230,160,.6)', halo);
      }
      // 台基
      const baseL = pagLv[0] * 0.7;
      const bh = H * 0.045;
      g.fillStyle = mix('#161c30', '#cdbb94', baseL);
      g.beginPath();
      g.moveTo(cx - H * 0.2, by); g.lineTo(cx + H * 0.2, by); g.lineTo(cx + H * 0.18, by - bh * 0.5); g.lineTo(cx - H * 0.18, by - bh * 0.5); g.closePath(); g.fill();
      g.fillStyle = mix('#1a2138', '#e3d4b0', baseL);
      g.fillRect(cx - H * 0.165, by - bh, H * 0.33, bh * 0.52);
      g.strokeStyle = mix('#2a3452', '#8a6a2c', baseL); g.lineWidth = 1;
      g.strokeRect(cx - H * 0.165, by - bh, H * 0.33, bh * 0.52);
      let y = by - bh;
      for (let k = 0; k < 9; k++) {
        const h = H * 0.086 * (1 - 0.036 * k);
        const b = H * 0.23 * (1 - 0.047 * k);
        drawStorey(cx, y, b, h, pagLv[k], t, k, lay);
        y -= h;
      }
      drawSpire(cx, y, H * 0.19, spireLv, t);
      // 当前楼层标记
      if (fin < 0.05 && ringAlpha > 0.3 && si < 3) {
        let yy = by - bh;
        const k = storeys[si].floor - 1;
        for (let j = 0; j < k; j++) yy -= H * 0.086 * (1 - 0.036 * j);
        const hk = H * 0.086 * (1 - 0.036 * k);
        const bk = H * 0.23 * (1 - 0.047 * k);
        const mx = cx - bk * 0.78 - 8, my = yy - hk * 0.45;
        const bob = Math.sin(t * 4) * 2;
        g.save(); g.globalAlpha = ringAlpha;
        g.fillStyle = '#e25a45';
        g.beginPath(); g.moveTo(mx + bob, my); g.lineTo(mx - 9 + bob, my - 6); g.lineTo(mx - 9 + bob, my + 6); g.closePath(); g.fill();
        g.restore();
      }
    }
    function drawStorey(cx, yb, b, h, L, t, k, lay) {
      const ph = h * 0.1, pw = b * 1.1;
      // 平座栏杆
      g.fillStyle = mix('#131a2e', '#d9c9a2', L);
      g.fillRect(cx - pw / 2, yb - ph, pw, ph);
      g.strokeStyle = mix('#28324f', '#9a7a3a', L); g.lineWidth = 0.8;
      g.beginPath();
      for (let x = -pw / 2 + 3; x < pw / 2; x += Math.max(3, pw / 14)) { g.moveTo(cx + x, yb - ph); g.lineTo(cx + x, yb); }
      g.stroke();
      // 塔身（三面）
      const wy0 = yb - ph, wy1 = yb - h * 0.72, tb = b * 0.95;
      const face = (x0, x1, x2, x3, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(cx + x0, wy0); g.lineTo(cx + x1, wy0); g.lineTo(cx + x2, wy1); g.lineTo(cx + x3, wy1); g.closePath(); g.fill(); };
      face(-b / 2, -b * 0.26, -tb * 0.26, -tb / 2, mix(UNLIT.side, LIT.side, L));
      face(b * 0.26, b / 2, tb / 2, tb * 0.26, mix('#1a2139', '#ecdcb8', L));
      face(-b * 0.26, b * 0.26, tb * 0.26, -tb * 0.26, mix(UNLIT.wall, LIT.wall, L));
      // 月光描边
      g.strokeStyle = mix(UNLIT.rim, '#b8a57a', L); g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(cx - b / 2, wy0); g.lineTo(cx - tb / 2, wy1); g.stroke();
      // 门、窗
      const dw = b * 0.2, dh = (wy0 - wy1) * 0.62, dy = wy0 - (wy0 - wy1) * 0.08;
      const arch = (x, w2, hh) => { g.beginPath(); g.moveTo(x - w2 / 2, dy); g.lineTo(x - w2 / 2, dy - hh + w2 / 2); g.arc(x, dy - hh + w2 / 2, w2 / 2, Math.PI, 0); g.lineTo(x + w2 / 2, dy); g.closePath(); };
      if (L > 0.02) {
        const dg = g.createLinearGradient(0, dy - dh, 0, dy);
        dg.addColorStop(0, mix(UNLIT.door, '#fff3c0', L)); dg.addColorStop(1, mix(UNLIT.door, '#f39a3c', L));
        g.fillStyle = dg;
      } else g.fillStyle = UNLIT.door;
      arch(cx, dw, dh); g.fill();
      g.fillStyle = mix(UNLIT.door, '#f7b456', L * 0.85);
      arch(cx - b * 0.38, dw * 0.45, dh * 0.6); g.fill();
      arch(cx + b * 0.38, dw * 0.45, dh * 0.6); g.fill();
      // 塔檐（琉璃瓦）
      const ey0 = wy1, ey1 = yb - h, ew = b * 1.42, lift = h * 0.2;
      g.beginPath();
      g.moveTo(cx - ew / 2, ey0 - lift);
      g.quadraticCurveTo(cx - b * 0.5, ey0 + h * 0.03, cx - b * 0.34, ey0);
      g.lineTo(cx + b * 0.34, ey0);
      g.quadraticCurveTo(cx + b * 0.5, ey0 + h * 0.03, cx + ew / 2, ey0 - lift);
      g.quadraticCurveTo(cx + b * 0.44, ey0 - h * 0.16, cx + b * 0.36, ey1);
      g.lineTo(cx - b * 0.36, ey1);
      g.quadraticCurveTo(cx - b * 0.44, ey0 - h * 0.16, cx - ew / 2, ey0 - lift);
      g.closePath();
      if (L > 0.02) {
        const eg = g.createLinearGradient(0, ey1, 0, ey0);
        eg.addColorStop(0, mix(UNLIT.eave, '#4fb38c', L)); eg.addColorStop(1, mix(UNLIT.eave, '#1e6a51', L));
        g.fillStyle = eg;
      } else g.fillStyle = UNLIT.eave;
      g.fill();
      g.strokeStyle = mix(UNLIT.rim, LIT.rim, L); g.lineWidth = Math.max(1, h * 0.04);
      g.beginPath();
      g.moveTo(cx - ew / 2, ey0 - lift);
      g.quadraticCurveTo(cx - b * 0.5, ey0 + h * 0.03, cx - b * 0.34, ey0);
      g.lineTo(cx + b * 0.34, ey0);
      g.quadraticCurveTo(cx + b * 0.5, ey0 + h * 0.03, cx + ew / 2, ey0 - lift);
      g.stroke();
      // 瓦垄
      if (L > 0.05) {
        g.strokeStyle = `rgba(20,60,45,${0.35 * L})`; g.lineWidth = 0.8;
        g.beginPath();
        for (let i = -4; i <= 4; i++) { const x = cx + i * b * 0.08; g.moveTo(x, ey0 - 1); g.lineTo(x * 0.96 + cx * 0.04, ey1 + 1); }
        g.stroke();
      }
      // 檐下挂灯
      const lampsX = [-ew / 2 + 1, -b * 0.26, b * 0.26, ew / 2 - 1];
      const lr = Math.max(1.2, b * 0.035);
      lampsX.forEach((dx, j) => {
        const lx = cx + dx, ly = (j === 0 || j === 3) ? ey0 - lift + lr * 1.6 : ey0 + lr * 1.8;
        if (L > 0.02) {
          const fl = 0.85 + 0.15 * Math.sin(t * 9 + k * 1.7 + j * 2.1);
          glow(g, lx, ly, lr * 7, 'rgba(255,180,80,.7)', L * fl);
          g.fillStyle = mix('#3a2a20', '#fff0b0', L);
        } else g.fillStyle = '#2a2622';
        g.beginPath(); g.arc(lx, ly, lr, 0, TAU); g.fill();
      });
      if (L > 0.02) glow(g, cx, yb - h * 0.45, b * 0.95, 'rgba(255,190,110,.32)', L);
    }
    function drawSpire(cx, yb, H, L, t) {
      const col = mix('#141a2c', '#e8c677', L), rim = mix('#34405e', '#8a6a2c', L);
      // 覆钵
      g.fillStyle = col; g.strokeStyle = rim; g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx, yb, H * 0.13, H * 0.09, 0, Math.PI, TAU); g.fill(); g.stroke();
      // 刹杆
      g.fillRect(cx - H * 0.018, yb - H * 0.95, H * 0.036, H * 0.95);
      // 相轮
      for (let i = 0; i < 6; i++) {
        const yy = yb - H * (0.16 + i * 0.075), rw = H * (0.1 - i * 0.009);
        g.beginPath(); g.ellipse(cx, yy, rw, H * 0.018, 0, 0, TAU); g.fill(); g.stroke();
      }
      // 宝盖
      const cy = yb - H * 0.66;
      g.beginPath(); g.moveTo(cx - H * 0.14, cy + H * 0.03); g.quadraticCurveTo(cx, cy - H * 0.07, cx + H * 0.14, cy + H * 0.03); g.closePath(); g.fill(); g.stroke();
      // 宝珠
      const py = yb - H * 0.82;
      if (L > 0.02) glow(g, cx, py, H * 0.35, 'rgba(255,215,120,.8)', L * (0.8 + 0.2 * Math.sin(t * 3)));
      g.fillStyle = mix('#141a2c', '#fff0b8', L);
      g.beginPath(); g.arc(cx, py, H * 0.06, 0, TAU); g.fill(); g.stroke();
    }

    // ---------------------------------------------------------------- 灯圈（俯视）
    const octPath = (x, y, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = lampAngle(i); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
    function drawRing(lay, t) {
      const { cx, cy, R: Rr, L } = lay;
      const litCount = popcount(state);
      g.save();
      g.globalAlpha = ringAlpha;
      // 阴影与外晕
      let lvSum = 0;
      for (const l of lamps) lvSum += l.lv;
      if (lvSum > 0.1) glow(g, cx, cy, Rr * 1.55, 'rgba(255,170,80,.30)', lvSum / N);
      g.save(); g.fillStyle = 'rgba(0,0,0,.35)';
      octPath(cx + 3, cy + 6, Rr * 1.12); g.fill(); g.restore();
      // 檐（琉璃瓦）
      const eg = g.createRadialGradient(cx, cy, Rr * 0.7, cx, cy, Rr * 1.12);
      eg.addColorStop(0, '#1d4a3d'); eg.addColorStop(1, '#12302a');
      g.fillStyle = eg; octPath(cx, cy, Rr * 1.1); g.fill();
      // 瓦垄
      g.save(); octPath(cx, cy, Rr * 1.1); g.clip();
      g.strokeStyle = 'rgba(8,28,22,.55)'; g.lineWidth = 1.2;
      g.beginPath();
      for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; g.moveTo(cx + Math.cos(a) * Rr * 0.78, cy + Math.sin(a) * Rr * 0.78); g.lineTo(cx + Math.cos(a) * Rr * 1.12, cy + Math.sin(a) * Rr * 1.12); }
      g.stroke();
      g.restore();
      // 垂脊
      g.strokeStyle = '#b08a3e'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = lampAngle(i); g.moveTo(cx + Math.cos(a) * Rr * 0.78, cy + Math.sin(a) * Rr * 0.78); g.lineTo(cx + Math.cos(a) * Rr * 1.08, cy + Math.sin(a) * Rr * 1.08); }
      g.stroke();
      g.strokeStyle = '#c8a15a'; g.lineWidth = 1.5; octPath(cx, cy, Rr * 1.1); g.stroke();
      // 平座（白瓷砖）
      const pg = g.createRadialGradient(cx, cy, Rr * 0.3, cx, cy, Rr * 0.8);
      pg.addColorStop(0, '#4a5272'); pg.addColorStop(1, '#343b5c');
      g.fillStyle = pg; octPath(cx, cy, Rr * 0.78); g.fill();
      g.strokeStyle = 'rgba(20,24,44,.55)'; g.lineWidth = 1;
      for (const k of [0.54, 0.62, 0.7]) { octPath(cx, cy, Rr * k); g.stroke(); }
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a0 = lampAngle(i), a1 = lampAngle(i + 1);
        for (let q = 1; q < 4; q++) {
          const f = q / 4;
          const ix = lerp(Math.cos(a0), Math.cos(a1), f), iy = lerp(Math.sin(a0), Math.sin(a1), f);
          g.moveTo(cx + ix * Rr * 0.46, cy + iy * Rr * 0.46); g.lineTo(cx + ix * Rr * 0.78, cy + iy * Rr * 0.78);
        }
      }
      g.stroke();
      g.strokeStyle = 'rgba(220,210,180,.35)'; g.lineWidth = 1;
      octPath(cx, cy, Rr * 0.78); g.stroke();
      // 栏杆点
      g.fillStyle = 'rgba(210,200,170,.35)';
      for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * Rr * 0.75, cy + Math.sin(a) * Rr * 0.75, 1.1, 0, TAU); g.fill(); }
      // 塔心
      g.fillStyle = '#35181a'; octPath(cx, cy, Rr * 0.46); g.fill();
      g.strokeStyle = '#c8a15a'; g.lineWidth = 2; octPath(cx, cy, Rr * 0.46); g.stroke();
      g.strokeStyle = 'rgba(200,161,90,.45)'; g.lineWidth = 1; octPath(cx, cy, Rr * 0.4); g.stroke();
      // 灯光照亮
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++) {
        const l = lamps[i];
        if (l.lv < 0.02) continue;
        const [x, y] = lampPos(lay, i);
        const fl = 0.9 + 0.1 * Math.sin(t * 8 + i * 1.9) * Math.sin(t * 3.1 + i);
        const gr = g.createRadialGradient(x, y, 0, x, y, Rr * 0.95);
        gr.addColorStop(0, `rgba(255,170,80,${0.34 * l.lv * fl})`);
        gr.addColorStop(1, 'rgba(255,170,80,0)');
        g.fillStyle = gr; octPath(cx, cy, Rr * 1.1); g.fill();
      }
      g.restore();
      // 中心莲花宝珠
      drawLotus(cx, cy, Rr * 0.34, t, litCount / N);
      // 相邻连线
      g.strokeStyle = 'rgba(232,207,148,.28)'; g.lineWidth = 1.5; g.setLineDash([3, 5]);
      octPath(cx, cy, Rr); g.stroke(); g.setLineDash([]);
      // 金链
      if (cur.links.length && chainA > 0.01) {
        for (const [a, b] of cur.links) drawChain(lampPos(lay, a), lampPos(lay, b), L, t, chainA);
      }
      // 传导光点
      for (const p of pulses) {
        const k = clamp(p.t / p.dur, 0, 1);
        const [x0, y0] = lampPos(lay, p.from), [x1, y1] = lampPos(lay, p.to);
        const x = lerp(x0, x1, easeOutCubic(k)), y = lerp(y0, y1, easeOutCubic(k));
        glow(g, x, y, L * 0.55, p.chain ? 'rgba(255,220,120,.95)' : 'rgba(255,200,120,.85)', 1 - k * 0.3);
      }
      // 灯
      for (let i = 0; i < N; i++) {
        const [x, y] = lampPos(lay, i);
        drawLantern(x, y, L, lamps[i], t, i);
      }
      // 提示 / 光标
      if (hintLamp >= 0 && inputOn) {
        const [x, y] = lampPos(lay, hintLamp);
        const br = 0.5 + 0.5 * Math.sin(t * 4);
        glow(g, x, y, L * 1.5, 'rgba(160,240,210,.55)', 0.4 + 0.5 * br);
        g.save(); g.translate(x, y); g.rotate(t * 1.2);
        g.strokeStyle = `rgba(170,245,215,${0.55 + 0.4 * br})`; g.lineWidth = 2.2; g.setLineDash([6, 6]);
        g.beginPath(); g.arc(0, 0, L * 0.82, 0, TAU); g.stroke(); g.restore();
      }
      if (showCursor && inputOn) {
        const [x, y] = lampPos(lay, cursor);
        g.strokeStyle = '#ff6a50'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(x, y, L * 0.78, 0, TAU); g.stroke();
        const a = lampAngle(cursor);
        const tx = x + Math.cos(a) * L * 1.05, ty = y + Math.sin(a) * L * 1.05;
        g.fillStyle = '#ff6a50';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(a + 2.6) * 9, ty + Math.sin(a + 2.6) * 9); g.lineTo(tx + Math.cos(a - 2.6) * 9, ty + Math.sin(a - 2.6) * 9); g.closePath(); g.fill();
      }
      // 编号（键盘玩家）
      if (showCursor) {
        g.font = `${Math.round(L * 0.34)}px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let i = 0; i < N; i++) {
          const a = lampAngle(i);
          const x = cx + Math.cos(a) * (Rr + L * 0.95), y = cy + Math.sin(a) * (Rr + L * 0.95);
          g.fillStyle = 'rgba(242,232,213,.7)'; g.fillText(String(i + 1), x, y);
        }
      }
      // 层名
      if (titleA > 0.01) {
        brushText(g, titleText, cx, cy, Math.round(Rr * 0.3), `rgba(255,236,190,${titleA})`, { stroke: `rgba(40,20,10,${0.7 * titleA})`, lw: 5 });
      }
      g.restore();
    }
    function drawLotus(x, y, r, t, k) {
      g.save();
      const gl = Math.max(coreGlow, k * 0.35);
      if (gl > 0.02) glow(g, x, y, r * 1.6, 'rgba(255,200,110,.7)', gl);
      g.strokeStyle = mix('#8a6a2c', '#ffe3a0', gl); g.lineWidth = 1.4;
      g.fillStyle = mix('#4a2320', '#b8762c', gl * 0.8);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + Math.PI / 8;
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.moveTo(0, -r * 0.2); g.quadraticCurveTo(r * 0.32, -r * 0.62, 0, -r); g.quadraticCurveTo(-r * 0.32, -r * 0.62, 0, -r * 0.2);
        g.fill(); g.stroke(); g.restore();
      }
      const pg = g.createRadialGradient(x - r * 0.06, y - r * 0.06, 0, x, y, r * 0.24);
      pg.addColorStop(0, mix('#6a4a3a', '#fff8d8', gl)); pg.addColorStop(1, mix('#3a2020', '#e8a040', gl));
      g.fillStyle = pg; g.beginPath(); g.arc(x, y, r * 0.22, 0, TAU); g.fill();
      g.restore();
    }
    function drawChain([x0, y0], [x1, y1], L, t, a) {
      const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
      const step = Math.max(7, L * 0.22);
      const n = Math.floor((len - L * 0.9) / step);
      g.save(); g.globalAlpha *= a;
      g.translate(x0, y0); g.rotate(ang);
      const start = (len - n * step) / 2;
      for (let i = 0; i <= n; i++) {
        const x = start + i * step;
        const sh = 0.75 + 0.25 * Math.sin(t * 3 - i * 0.5);
        g.strokeStyle = `rgba(${200 + 40 * sh | 0},${160 + 40 * sh | 0},80,1)`;
        g.lineWidth = 2;
        g.beginPath();
        if (i % 2) g.ellipse(x, 0, step * 0.62, step * 0.2, 0, 0, TAU);
        else g.ellipse(x, 0, step * 0.62, step * 0.34, 0, 0, TAU);
        g.stroke();
      }
      g.restore();
    }
    function drawLantern(x, y, L, l, t, i) {
      const sc = l.scale * (1 + 0.14 * Math.sin(l.pop * Math.PI) * (l.pop > 0 ? 1 : 0));
      if (sc < 0.01) return;
      const fl = 0.88 + 0.12 * Math.sin(t * 9 + i * 1.3) * Math.sin(t * 4.3 + i * 2.2);
      const lv = l.lv;
      if (lv > 0.02) {
        glow(g, x, y, L * 1.9 * sc, 'rgba(255,160,60,.55)', lv * fl);
        glow(g, x, y, L * 0.8 * sc, 'rgba(255,230,160,.8)', lv * fl * 0.8);
      }
      if (l.flash > 0.01) glow(g, x, y, L * 2.4 * sc, 'rgba(255,245,210,.9)', l.flash * 0.8);
      g.save();
      g.translate(x, y); g.scale(sc, sc);
      const sw = Math.sin(t * 1.6 + i) * 0.04;
      g.rotate(sw);
      // 挂绳
      g.strokeStyle = 'rgba(30,20,12,.85)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, -L * 0.6); g.lineTo(0, -L * 0.4); g.stroke();
      // 顶盖
      g.fillStyle = mix('#3a2a1a', '#8a6a2c', lv);
      g.beginPath(); g.moveTo(-L * 0.2, -L * 0.42); g.lineTo(L * 0.2, -L * 0.42); g.lineTo(L * 0.3, -L * 0.3); g.lineTo(-L * 0.3, -L * 0.3); g.closePath(); g.fill();
      // 灯身
      const rx = L * 0.36, ry = L * 0.32;
      const off = g.createRadialGradient(-rx * 0.2, -ry * 0.2, 0, 0, 0, rx * 1.1);
      off.addColorStop(0, '#5a2b24'); off.addColorStop(1, '#241110');
      g.fillStyle = off; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
      if (lv > 0.01) {
        const on = g.createRadialGradient(-rx * 0.1, -ry * 0.15, 0, 0, 0, rx * 1.05);
        on.addColorStop(0, '#fffbe2'); on.addColorStop(0.35, '#ffd67e'); on.addColorStop(0.8, '#f08a3a'); on.addColorStop(1, '#b8431f');
        g.globalAlpha = lv * (0.92 + 0.08 * fl);
        g.fillStyle = on; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      // 竹骨
      g.strokeStyle = lv > 0.5 ? 'rgba(140,60,20,.45)' : 'rgba(0,0,0,.45)'; g.lineWidth = 1;
      g.beginPath();
      g.ellipse(0, 0, rx * 0.45, ry, 0, 0, TAU);
      g.moveTo(0, -ry); g.lineTo(0, ry);
      g.stroke();
      g.strokeStyle = 'rgba(20,10,5,.8)'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke();
      // 底盖、流苏
      g.fillStyle = mix('#3a2a1a', '#8a6a2c', lv);
      g.fillRect(-L * 0.17, ry - 1, L * 0.34, L * 0.08);
      g.strokeStyle = '#b23a2e'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, ry + L * 0.08); g.lineTo(0, ry + L * 0.3); g.stroke();
      g.fillStyle = '#b23a2e'; g.beginPath(); g.arc(0, ry + L * 0.12, L * 0.035, 0, TAU); g.fill();
      g.restore();
    }

    // ---------------------------------------------------------------- 灯油
    function drawOil(lay, t) {
      if (ringAlpha < 0.02 || fin > 0) return;
      const x = 12, y = 12;
      const w = clamp(lay.ringW * 0.36, 92, 190), h = 12;
      g.save(); g.globalAlpha = ringAlpha;
      brushText(g, '灯油', x, y + h / 2 + 1, 18, '#e8cf94', { align: 'left' });
      const bx = x + 42;
      g.fillStyle = 'rgba(0,0,0,.45)'; g.strokeStyle = 'rgba(232,207,148,.6)'; g.lineWidth = 1;
      g.beginPath(); g.roundRect ? g.roundRect(bx, y, w, h, 6) : g.rect(bx, y, w, h); g.fill(); g.stroke();
      const k = clamp(oil / oilMax, 0, 1);
      const low = oil <= 3;
      const fg = g.createLinearGradient(bx, 0, bx + w, 0);
      fg.addColorStop(0, low ? '#c23a2a' : '#c8842a'); fg.addColorStop(1, low ? '#ff7a5a' : '#ffd27a');
      g.fillStyle = fg;
      g.beginPath(); g.roundRect ? g.roundRect(bx + 1.5, y + 1.5, Math.max(0, (w - 3) * k), h - 3, 5) : g.rect(bx + 1.5, y + 1.5, Math.max(0, (w - 3) * k), h - 3); g.fill();
      if (low && oilFlash > 0) { g.fillStyle = `rgba(255,120,90,${0.4 * (0.5 + 0.5 * Math.sin(t * 12))})`; g.fillRect(bx, y, w, h); }
      g.font = `15px ${FONT_BRUSH}`; g.fillStyle = '#f3e7cf'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(`${oil}`, bx + w + 6, y + h / 2 + 1);
      g.restore();
    }

    // ---------------------------------------------------------------- 主循环
    let loopErr = false;
    const stopLoop = ctx.loop((dt) => {
      time += dt;
      tw.update(dt);
      P.update(dt);
      try { frame(dt, time); } catch (e) { if (!loopErr) { loopErr = true; console.error('[lamps]', e); } }
    });
    function frame(dt, t) {
      for (const l of lamps) {
        l.lv = approach(l.lv, l.lit ? 1 : 0, l.lit ? 14 : 7, dt);
        l.pop = Math.max(0, l.pop - dt * 4);
        l.flash = Math.max(0, l.flash - dt * 3);
      }
      for (let k = 0; k < 9; k++) pagLv[k] = approach(pagLv[k], pagTarget[k], 3.2, dt);
      spireLv = approach(spireLv, spireTarget, 2.5, dt);
      halo = approach(halo, haloTarget, 1.5, dt);
      oilFlash = Math.max(0, oilFlash - dt * 0.3);
      shake = Math.max(0, shake - dt * 3);
      for (const p of pulses) p.t += dt;
      pulses = pulses.filter((p) => p.t < p.dur + 0.05);

      const lay = layout();
      ensureBg(lay.w, lay.h);
      g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      g.clearRect(0, 0, lay.w, lay.h);
      g.drawImage(bg.c, 0, 0, lay.w, lay.h);
      for (const s of twinkles) {
        const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.p));
        g.fillStyle = `rgba(255,250,235,${a * 0.8})`;
        g.beginPath(); g.arc(s.x * lay.w, s.y * lay.h, s.s, 0, TAU); g.fill();
      }
      drawPagoda(lay, t);
      if (shake > 0) { g.save(); g.translate(Math.sin(t * 60) * shake * 4, 0); }
      if (ringAlpha > 0.01) drawRing(lay, t);
      if (shake > 0) g.restore();
      P.draw(g);
      drawOil(lay, t);
      tip.el.style.left = `${fin > 0 ? lay.w / 2 : lay.cx}px`;
      if (lay.tall && fin <= 0) { tip.el.style.top = `${lay.tipTop}px`; tip.el.style.bottom = 'auto'; } else { tip.el.style.top = ''; tip.el.style.bottom = ''; }
    }

    // ---------------------------------------------------------------- 操作
    function hud() {
      const n = narrow();
      ctx.hud({
        center: n ? `${cur.name} ${si + 1}/3` : `${cur.name} · ${['一', '二', '三'][si]}/三`,
        right: n ? `${moves}/${cur.min}步` : `步数 <b>${moves}</b> · 至少 ${cur.min}`,
      });
    }
    function burstOn(x, y, L) {
      P.emit(10, (p) => {
        const a = R() * TAU, s = 40 + R() * 90;
        p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 20; p.drag = 3; p.life = 0.5 + R() * 0.3;
        p.size = 1.6 + R() * 1.2; p.shape = 'spark'; p.color = R() < 0.5 ? '#ffe3a0' : '#ffb35a'; p.add = true;
      });
    }
    function puffOff(x, y, L) {
      P.emit(4, (p) => {
        p.x = x + (R() - 0.5) * L * 0.3; p.y = y - L * 0.2; p.vx = (R() - 0.5) * 12; p.vy = -18 - R() * 16; p.life = 0.9 + R() * 0.5;
        p.size = L * 0.15; p.size1 = L * 0.45; p.shape = 'smoke'; p.color = 'rgba(180,185,200,.35)';
      });
    }
    function flip(j, on) {
      const lay = layout();
      const [x, y] = lampPos(lay, j);
      lamps[j].lit = on;
      lamps[j].flash = on ? 1 : 0.25;
      if (on) burstOn(x, y, lay.L); else puffOff(x, y, lay.L);
    }
    function press(i) {
      if (!inputOn) return;
      const mask = cur.rule.tog[i];
      state ^= mask;
      moves++; totalMoves++;
      oil = Math.max(0, oil - 1);
      lamps[i].pop = 1;
      const lay = layout();
      const [x, y] = lampPos(lay, i);
      P.emit(1, (p) => { p.x = x; p.y = y; p.shape = 'ring'; p.size = lay.L * 0.35; p.size1 = lay.L * 1.5; p.life = 0.45; p.color = 'rgba(255,225,160,.9)'; p.lw = 2; });
      let ons = 0, offs = 0;
      for (let j = 0; j < N; j++) {
        if (!((mask >> j) & 1)) continue;
        const isPartner = cur.rule.partner[i] === j;
        const delay = j === i ? 0 : isPartner ? 0.2 : 0.09;
        const on = !!((state >> j) & 1);
        if (on) ons++; else offs++;
        if (j !== i) pulses.push({ from: i, to: j, t: 0, dur: delay, chain: isPartner });
        if (delay === 0) flip(j, on); else tw.after(delay, () => flip(j, on));
      }
      ctx.sfx('click');
      ctx.sfx(ons >= offs ? 'lamp_on' : 'lamp_off');
      if (cur.rule.partner[i] >= 0) tw.after(0.18, () => ctx.sfx('chime'));
      const d = cur.rule.dist(state);
      if (d < lastDist) { nonProgress = 0; lastDist = d; } else nonProgress++;
      hud();
      if (state === FULL) { inputOn = false; hintLamp = -1; if (resolveStorey) resolveStorey('solved'); return; }
      if (oil <= 0) { inputOn = false; hintLamp = -1; if (resolveStorey) resolveStorey('oil'); return; }
      updateHint();
      if (oil <= 3 && hintLamp < 0) { oilFlash = 1; tip.set(`灯油只剩 <b>${oil}</b> 勺了，想好再点。`, 'dark'); }
      else if (moves === 1 && si === 0 && hintLamp < 0) tip.set('留意：同一盏灯<b>点两次</b>，就等于没点。', 'dark');
    }
    function updateHint() {
      const threshold = easy ? 3 : 6;
      if (easy && nonProgress >= threshold) guided = true;
      if ((guided || nonProgress >= threshold) && state !== FULL) {
        const sol = cur.rule.solve(state);
        if (hintLamp < 0 || !((sol >> hintLamp) & 1)) {
          const cands = [];
          for (let j = 0; j < N; j++) if ((sol >> j) & 1) cands.push(j);
          hintLamp = cands.length ? cands[Math.floor(R() * cands.length)] : -1;
          if (hintLamp >= 0) ctx.sfx('sparkle');
        }
        tip.set('<span class="libb-who">阿麟</span>试试<b>发青光的那一盏</b>？', 'dark');
      } else hintLamp = -1;
    }
    S.on(cv.canvas, 'pointerdown', (e) => {
      if (!inputOn) return;
      const p = localXY(cv.canvas, e);
      const lay = layout();
      let best = -1, bd = 1e9;
      for (let i = 0; i < N; i++) {
        const [x, y] = lampPos(lay, i);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = i; }
      }
      if (bd <= Math.max(26, lay.L * 0.9)) { showCursor = false; cursor = best; press(best); }
    });
    S.add(ctx.keys.onDown((code, e) => {
      if (!inputOn || hostPaused(ctx)) return; // 宿主确认框打开时不响应（点灯要耗油）
      let handled = true;
      if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') { if (showCursor) cursor = (cursor + N - 1) % N; showCursor = true; ctx.sfx('tick'); }
      else if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') { if (showCursor) cursor = (cursor + 1) % N; showCursor = true; ctx.sfx('tick'); }
      else if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { if (!showCursor) { showCursor = true; ctx.sfx('tick'); } else press(cursor); }
      else {
        const m = /^(Digit|Numpad)([1-8])$/.exec(code);
        if (m) { cursor = Number(m[2]) - 1; showCursor = true; press(cursor); } else handled = false;
      }
      if (handled) e.preventDefault();
    }));

    // ---------------------------------------------------------------- 流程
    async function playStorey(k) {
      cur = storeys[k]; si = k;
      state = cur.start;
      moves = 0;
      oilMax = oil = cur.min + (easy ? 24 : 12);
      nonProgress = 0; lastDist = cur.rule.dist(state); hintLamp = -1; guided = false;
      pulses = [];
      for (let j = 0; j < N; j++) { const l = lamps[j]; l.lit = !!((state >> j) & 1); l.lv = 0; l.scale = 0; l.pop = 0; l.flash = 0; }
      chainA = 0; coreGlow = 0;
      titleText = cur.name;
      hud();
      tip.hide();
      await tw.to(0.45, (e) => { ringAlpha = e; });
      for (let j = 0; j < N; j++) tw.to(0.4, (e) => { lamps[j].scale = e; }, { ease: easeOutBack, delay: j * 0.05 });
      tw.to(0.35, (e) => { titleA = e; }).then(() => tw.to(0.5, (e) => { titleA = 1 - e; }, { delay: 0.9 })).catch(() => {});
      if (cur.links.length) tw.to(0.8, (e) => { chainA = e; }, { delay: 0.5 });
      await tw.delay(0.55);
      ctx.sfx('open');
      if (k === 0) tip.set(`点一盏灯，它和<b>左右两盏</b>一起明灭——让八盏灯<b>全部点亮</b>。${ctx.isTouch ? '' : '<br><span style="font-size:.85em;opacity:.8">键盘：←→ 选灯，空格点灯，或按 1–8</span>'}`, 'dark');
      else if (cur.links.length) tip.set('这一层挂着<b>两道金链</b>：点带链的灯，链子另一头的灯也会翻转。', 'dark');
      else tip.set(`第五层更难些：至少要点 <b>${cur.min}</b> 次。`, 'dark');
      inputOn = true;
      const res = await waitFor(ctx, (done) => { resolveStorey = done; return () => { resolveStorey = null; }; });
      inputOn = false;
      return res;
    }
    async function storeySolved(k) {
      tip.hide();
      await tw.delay(0.28);
      const lay = layout();
      coreGlow = 1;
      for (let j = 0; j < N; j++) lamps[j].flash = 1;
      P.emit(1, (p) => { p.x = lay.cx; p.y = lay.cy; p.shape = 'ring'; p.size = lay.R * 0.3; p.size1 = lay.R * 1.6; p.life = 0.8; p.color = 'rgba(255,220,140,.9)'; p.lw = 3; });
      P.emit(28, (p) => {
        const a = R() * TAU, s = 60 + R() * 140;
        p.x = lay.cx + Math.cos(a) * lay.R; p.y = lay.cy + Math.sin(a) * lay.R; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.drag = 2.2; p.life = 0.9 + R() * 0.5; p.size = 3 + R() * 3; p.shape = 'star'; p.vr = (R() - 0.5) * 6; p.color = R() < 0.6 ? '#ffe7a8' : '#ffffff'; p.add = true;
      });
      ctx.sfx('chime');
      if (moves === cur.min) { ctx.sfx('perfect'); ctx.toast('一步不差！', 'gold'); } else { ctx.sfx('good'); ctx.toast(['亮了！', '好！', '妙！'][k % 3], 'good'); }
      const from = litFloors;
      const to = cur.floor;
      for (let f = from; f < to; f++) {
        tw.after(0.35 + 0.28 * (f - from), () => {
          pagTarget[f] = 1;
          ctx.sfx('lamp_on');
          const L2 = layout();
          let yy = L2.pag.by - L2.pag.H * 0.045;
          for (let j = 0; j < f; j++) yy -= L2.pag.H * 0.086 * (1 - 0.036 * j);
          const hk = L2.pag.H * 0.086 * (1 - 0.036 * f);
          P.emit(8, (p) => {
            p.x = L2.pag.cx + (R() - 0.5) * L2.pag.H * 0.3; p.y = yy - hk * R(); p.vy = -20 - R() * 30; p.vx = (R() - 0.5) * 20;
            p.life = 0.8 + R() * 0.4; p.size = 2 + R() * 2; p.shape = 'star'; p.color = '#ffe7a8'; p.add = true; p.vr = 3;
          });
        });
      }
      litFloors = to;
      await tw.delay(0.6 + 0.28 * (to - from) + 0.5);
      if (k < 2) await tw.to(0.45, (e) => { ringAlpha = 1 - e; });
      coreGlow = 0;
    }
    function firework() {
      const lay = layout();
      const x = lay.pag.cx + (R() - 0.5) * Math.min(lay.w * 0.8, lay.pag.H * 1.1);
      const y = lay.h * (0.1 + R() * 0.28);
      const cols = ['#ffd27a', '#ff8a5c', '#9fe0c8', '#fff3c4', '#f4a6c0', '#b8d8ff'];
      const c = cols[Math.floor(R() * cols.length)];
      ctx.sfx('firework');
      P.emit(1, (p) => { p.x = x; p.y = y; p.shape = 'glow'; p.size = 70; p.life = 0.5; p.color = 'rgba(255,240,200,.8)'; p.add = true; });
      const n = 46;
      P.emit(n, (p, i) => {
        const a = i / n * TAU + R() * 0.12, sp = 110 + R() * 80;
        p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.ay = 55; p.drag = 1.4;
        p.life = 1.1 + R() * 0.6; p.size = 2.2; p.shape = 'spark'; p.color = c; p.add = true;
      });
      P.emit(12, (p) => {
        const a = R() * TAU, sp = 30 + R() * 60;
        p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.ay = 30; p.drag = 1;
        p.life = 1.4 + R() * 0.6; p.size = 2.5; p.shape = 'star'; p.color = '#fff6d8'; p.add = true; p.vr = 4;
      });
    }
    async function finale() {
      tip.hide();
      await tw.to(0.5, (e) => { ringAlpha = 1 - e; });
      for (let f = litFloors; f < 9; f++) pagTarget[f] = 1;
      spireTarget = 1;
      ctx.sfx('bell');
      await tw.to(1.5, (e) => { fin = e; }, { ease: (x) => x });
      haloTarget = 1;
      ctx.sfx('magic');
      ctx.toast('琉璃塔，灯火通明！', 'gold');
      for (let i = 0; i < 7; i++) tw.after(0.2 + i * 0.42, firework);
      tip.set('九层八面，塔灯彻夜长明，江上行舟远远就能望见。', 'dark');
      await tw.delay(3.4);
    }
    async function outOfOil() {
      tip.set('灯油耗尽了……', 'dark');
      ctx.sfx('lamp_off');
      ctx.toast('灯油耗尽', 'bad');
      shake = 0.6;
      await tw.delay(0.35);
      for (let j = 0; j < N; j++) if (lamps[j].lit) tw.after(0.1 * j, () => { flip(j, false); });
      await tw.delay(1.5);
    }

    S.add(ctx.onResize(() => { if (cur) hud(); }));
    if (opts.debug) {
      window.__lamps = {
        get state() { return state; }, get si() { return si; }, get oil() { return oil; }, get inputOn() { return inputOn; }, get hint() { return hintLamp; }, get moves() { return moves; },
        solution: () => { const s = cur.rule.solve(state); const out = []; for (let i = 0; i < N; i++) if ((s >> i) & 1) out.push(i); return out; },
        press: (i) => press(i),
      };
    }

    // ---------------------------------------------------------------- 运行
    try {
      await fontReady('第一层五九灯油阿麟', 48);
      if (startAt > 0) { si = startAt; }
      for (let k = startAt; k < 3; k++) {
        const res = await playStorey(k);
        totalMin += storeys[k].min;
        if (res === 'oil') {
          await outOfOil();
          return {
            success: false, score: 0, perfect: false,
            note: '灯油耗尽，这一层还没点亮。诀窍：同一盏灯点两次等于没点——每盏灯最多只需点一次。',
          };
        }
        await storeySolved(k);
      }
      await finale();
      tip.hide();
      const extra = Math.max(0, totalMoves - totalMin);
      const perfect = extra === 0;
      const score = Math.max(40, 100 - 4 * extra);
      return {
        success: true,
        score,
        scoreText: `点了 ${totalMoves} 次 · 最少 ${totalMin} 次 · 得分 ${score} / 100`,
        perfect,
        note: perfect
          ? '三层都用最少的步数点亮，一勺灯油也没浪费！琉璃塔九层八面，塔上长明灯入夜不熄，江上行舟远远可见。'
          : '琉璃塔九层八面，长明灯次第亮起。相传塔上共悬一百四十六盏长明灯，入夜不熄，江上行舟远远可见。',
      };
    } finally {
      stopLoop();
      S.dispose();
    }
  },
};
