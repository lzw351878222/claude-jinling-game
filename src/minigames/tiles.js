// 转瓦 —— 「复原琉璃拱门」
// 大报恩寺琉璃塔的拱门由五色琉璃构件拼成。蠹啃掉了构件上的墨书编号，只能凭缠枝莲纹样把它们转回原位。
import { clamp, easeOutBack, rng, injectStyle } from '../core/util.js';
import {
  scope, waitFor, Tweens, Particles, tipLine, glow, brushText, approach, offscreen, localXY, mix, fontReady, button, roundRect, hostPaused,
} from './lib-b.js';
import { LEVELS, generate, current, analyze, rotCW, period, TYPE_OF, DX, DY } from './tiles-logic.js';
import { paintVine, drawMotif, MOTIFS } from './tiles-art.js';
import css from './tiles.css';

injectStyle('tiles', css);

const TAU = Math.PI * 2;
const GLAZE = {
  green: ['#2f8c6a', '#2b7f61', '#33946f'],
  blue: ['#2e5f9a', '#2a5890', '#3467a3'],
  mixed: ['#2f8c6a', '#2e5f9a', '#7a3b2e', '#3a7f8e', '#2b7f61', '#6b3a5a'],
};

export default {
  id: 'tiles',
  title: '转瓦',
  subtitle: '复原琉璃拱门',
  rules: [
    '蠹啃掉了琉璃构件上的<b>墨书编号</b>，只能凭纹样把它们转回原位。',
    '点一块瓦，它会<b>顺时针转九十度</b>。让缠枝莲藤蔓首尾相接：<b>不留断头</b>，也不伸出边外。',
    '与<b>宝珠</b>连通的藤蔓会发出金光；全部连通，这一块拱门件就复原了。共三块。',
    '要在一炷<b>香</b>燃尽前完成；转的次数越少，得分越高。',
  ],
  controls: '点按瓦片（鼠标右键可逆转）· 键盘 方向键选瓦、空格转动',

  async play(ctx, opts = {}) {
    const easy = ctx.difficulty === 0;
    const seed = (opts.seed != null ? Number(opts.seed) : (Date.now() & 0xffffff)) + ctx.attempt * 7919;
    const R = rng(seed);
    const S = scope(ctx);
    const tw = new Tweens(ctx.signal);
    const P = new Particles();
    const cv = ctx.canvas();
    const g = cv.g;
    const tip = tipLine(ctx.root);
    const levels = LEVELS[easy ? 'easy' : 'normal'];
    const startAt = clamp(Number(opts.level) || 0, 0, 2);
    const narrow = () => ctx.w < 560;

    let li = 0, lv = levels[0], p = null;
    let rot = [], disp = [], pop = [], glowV = [], glowT = [], glowDelay = [], locked = [], appear = [], glaze = [];
    let conn = null;
    let moves = 0, totalMoves = 0, totalPar = 0, hints = 0;
    let timeLeft = 1, timeMax = 1, timing = false, lowWarned = false;
    let inputOn = false, cursor = -1, showCursor = false;
    let sweep = -1, motifA = 0, boardDim = 0, shakeT = 0;
    let resolveLevel = null;
    let time = 0;
    let firstConnectTip = false;
    const smoke = [];

    // ---------------------------------------------------------------- 布局
    function layout() {
      const w = ctx.w, h = ctx.h;
      const top = narrow() ? 48 : 58, bottom = narrow() || ctx.isTouch ? 62 : 84;
      const { cols, rows } = lv;
      const T = Math.floor(clamp(Math.min((w - 24) / (cols + 0.55), (h - top - bottom) / (rows + 0.55)), 30, 112));
      const bw = T * cols, bh = T * rows;
      const bx = Math.round((w - bw) / 2), by = Math.round(top + (h - top - bottom - bh) / 2);
      return { w, h, T, bx, by, bw, bh, top };
    }
    const cellXY = (lay, i) => [lay.bx + (i % lv.cols) * lay.T, lay.by + Math.floor(i / lv.cols) * lay.T];

    // ---------------------------------------------------------------- 缓存：背景墙、瓦身、藤纹
    let bg = null, bgKey = '';
    function ensureBg(w, h) {
      const key = `${w}x${h}`;
      if (key === bgKey) return;
      bgKey = key;
      bg = offscreen(w, h, ctx.dpr);
      const b = bg.g;
      b.fillStyle = '#d9d2c0'; b.fillRect(0, 0, w, h);
      const BR = rng(11);
      const bhh = clamp(Math.round(h / 16), 20, 30), bww = bhh * 2.1;
      for (let y = 0, row = 0; y < h; y += bhh, row++) {
        for (let x = (row % 2) * -bww / 2; x < w; x += bww) {
          const tint = BR();
          const base = tint < 0.12 ? '#e4e6e2' : tint < 0.2 ? '#efe6cf' : '#ece6d6';
          const gr = b.createLinearGradient(0, y, 0, y + bhh);
          gr.addColorStop(0, mix(base, '#ffffff', 0.35)); gr.addColorStop(0.5, base); gr.addColorStop(1, mix(base, '#b9ae94', 0.35));
          b.fillStyle = gr;
          b.fillRect(x + 1.5, y + 1.5, bww - 3, bhh - 3);
          b.fillStyle = 'rgba(255,255,255,.35)'; b.fillRect(x + 3, y + 2.5, bww - 8, 1.2);
        }
      }
      const vg = b.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(255,248,230,0)'); vg.addColorStop(1, 'rgba(60,45,25,.38)');
      b.fillStyle = vg; b.fillRect(0, 0, w, h);
    }
    const bodyCache = new Map();
    function tileBody(color, T) {
      const key = `${color}|${T}|${ctx.dpr}`;
      let c = bodyCache.get(key);
      if (c) return c;
      c = offscreen(T, T, ctx.dpr);
      const b = c.g;
      const r = T * 0.1;
      const gr = b.createLinearGradient(0, 0, T, T);
      gr.addColorStop(0, mix(color, '#ffffff', 0.3)); gr.addColorStop(0.45, color); gr.addColorStop(1, mix(color, '#000000', 0.35));
      roundRect(b, 1, 1, T - 2, T - 2, r); b.fillStyle = gr; b.fill();
      // 釉面内沿
      roundRect(b, 3.5, 3.5, T - 7, T - 7, r * 0.8);
      const eg = b.createLinearGradient(0, 0, T, T);
      eg.addColorStop(0, 'rgba(255,255,255,.45)'); eg.addColorStop(0.5, 'rgba(255,255,255,.05)'); eg.addColorStop(1, 'rgba(0,0,0,.35)');
      b.lineWidth = 2; b.strokeStyle = eg; b.stroke();
      // 细开片
      const CR = rng(T + color.length);
      b.strokeStyle = 'rgba(255,255,255,.08)'; b.lineWidth = 0.7;
      b.beginPath();
      for (let i = 0; i < 5; i++) { const x = CR() * T, y = CR() * T; b.moveTo(x, y); b.lineTo(x + (CR() - 0.5) * T * 0.5, y + (CR() - 0.5) * T * 0.5); }
      b.stroke();
      roundRect(b, 1, 1, T - 2, T - 2, r); b.lineWidth = 1.2; b.strokeStyle = 'rgba(20,14,8,.65)'; b.stroke();
      bodyCache.set(key, c);
      return c;
    }
    const vineCache = new Map();
    function vineImg(type, on, src, T) {
      const key = `${type}|${on}|${src}|${T}|${ctx.dpr}`;
      let c = vineCache.get(key);
      if (c) return c;
      c = offscreen(T, T, ctx.dpr);
      c.g.translate(T / 2, T / 2);
      paintVine(c.g, type, T, on, src);
      vineCache.set(key, c);
      return c;
    }

    // ---------------------------------------------------------------- 绘制
    function drawFrame(lay, t) {
      const { T } = lay;
      const m1 = T * 0.22, m2 = T * 0.07;
      // 外框（黄釉琉璃边）
      g.save();
      g.shadowColor = 'rgba(40,25,10,.45)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
      g.fillStyle = '#c9962f';
      g.beginPath();
      for (const i of p.cells) { const [x, y] = cellXY(lay, i); g.rect(x - m1, y - m1, T + m1 * 2, T + m1 * 2); }
      g.fill();
      g.restore();
      const fg = g.createLinearGradient(lay.bx, lay.by - m1, lay.bx, lay.by + lay.bh + m1);
      fg.addColorStop(0, '#f0cf6e'); fg.addColorStop(0.5, '#d9a52a'); fg.addColorStop(1, '#a8761c');
      g.fillStyle = fg;
      g.beginPath();
      for (const i of p.cells) { const [x, y] = cellXY(lay, i); g.rect(x - m1, y - m1, T + m1 * 2, T + m1 * 2); }
      g.fill();
      // 绿釉线脚
      g.fillStyle = '#2f7d5f';
      g.beginPath();
      for (const i of p.cells) { const [x, y] = cellXY(lay, i); g.rect(x - m1 * 0.55, y - m1 * 0.55, T + m1 * 1.1, T + m1 * 1.1); }
      g.fill();
      // 凹槽
      g.fillStyle = '#231a12';
      g.beginPath();
      for (const i of p.cells) { const [x, y] = cellXY(lay, i); g.rect(x - m2, y - m2, T + m2 * 2, T + m2 * 2); }
      g.fill();
      // 门洞
      if (lv.arch) {
        const holes = [];
        for (let i = 0; i < p.n; i++) if (!p.ok[i]) {
          const x = i % lv.cols, y = Math.floor(i / lv.cols);
          if (y > 0 && x > 0 && x < lv.cols - 1) holes.push(i);
        }
        if (holes.length) {
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          for (const i of holes) { const [x, y] = cellXY(lay, i); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + T); y1 = Math.max(y1, y + T); }
          x0 += m2; x1 -= m2; y0 -= m2;
          const wD = x1 - x0, r = wD / 2;
          g.fillStyle = '#d9a52a'; g.fillRect(x0, y0, wD, y1 - y0);
          g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + r); g.arc(x0 + r, y0 + r, r, Math.PI, 0); g.lineTo(x1, y1); g.closePath();
          const dg = g.createLinearGradient(0, y0, 0, y1);
          dg.addColorStop(0, '#120b07'); dg.addColorStop(0.7, '#2a1a10'); dg.addColorStop(1, '#4a2c14');
          g.fillStyle = dg; g.fill();
          g.lineWidth = Math.max(2, T * 0.06); g.strokeStyle = '#2f7d5f'; g.stroke();
          glow(g, x0 + r, y1 - r * 0.5, r * 1.1, 'rgba(255,170,70,.35)', 0.8 + 0.2 * Math.sin(t * 2));
        }
      }
    }
    function drawTiles(lay, t) {
      const { T } = lay;
      for (const i of p.cells) {
        const a = appear[i];
        if (a <= 0.01) continue;
        const [x, y] = cellXY(lay, i);
        const cx = x + T / 2, cy = y + T / 2;
        const sc = a * (1 - 0.1 * Math.sin(Math.min(1, pop[i]) * Math.PI));
        g.save();
        g.translate(cx, cy);
        if (shakeT > 0 && locked[i] && cursor === i) g.translate(Math.sin(t * 70) * 3 * shakeT, 0);
        g.scale(sc, sc);
        g.globalAlpha = Math.min(1, a * 1.3);
        g.drawImage(tileBody(glaze[i], T).c, -T / 2, -T / 2, T, T);
        const [type, k0] = TYPE_OF[p.sol[i]];
        g.rotate((k0 + disp[i]) * Math.PI / 2);
        const gv = glowV[i];
        const src = i === p.source;
        if (gv < 0.99) g.drawImage(vineImg(type, false, src, T).c, -T / 2, -T / 2, T, T);
        if (gv > 0.01) { g.globalAlpha = Math.min(1, a * 1.3) * gv; g.drawImage(vineImg(type, true, src, T).c, -T / 2, -T / 2, T, T); }
        g.restore();
        // 釉光（不随瓦转）
        if (a > 0.5) {
          g.save();
          g.globalAlpha = 0.9 * a;
          const hg = g.createLinearGradient(x, y, x + T * 0.6, y + T * 0.6);
          hg.addColorStop(0, 'rgba(255,255,255,.28)'); hg.addColorStop(0.35, 'rgba(255,255,255,.06)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)');
          g.fillStyle = hg;
          roundRect(g, x + 2, y + 2, T - 4, T - 4, T * 0.1); g.fill();
          g.restore();
        }
        if (locked[i]) {
          g.save(); g.strokeStyle = '#ffd86a'; g.lineWidth = 2.5; g.shadowColor = 'rgba(255,200,80,.9)'; g.shadowBlur = 8;
          roundRect(g, x + 3, y + 3, T - 6, T - 6, T * 0.1); g.stroke(); g.restore();
        }
      }
      if (boardDim > 0.01) {
        g.save(); g.globalAlpha = boardDim * 0.55; g.fillStyle = '#1a1410';
        for (const i of p.cells) { const [x, y] = cellXY(lay, i); g.fillRect(x, y, T, T); }
        g.restore();
      }
      // 光扫
      if (sweep >= 0 && sweep <= 1) {
        g.save();
        g.beginPath();
        for (const i of p.cells) { const [x, y] = cellXY(lay, i); g.rect(x, y, T, T); }
        g.clip();
        g.globalCompositeOperation = 'lighter';
        const span = lay.bw + lay.bh;
        const pos = lay.bx - lay.bh + sweep * (span + lay.bh);
        const sg = g.createLinearGradient(pos - T, lay.by, pos + T, lay.by + T * 0.6);
        sg.addColorStop(0, 'rgba(255,240,200,0)'); sg.addColorStop(0.5, 'rgba(255,240,200,.75)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = sg;
        g.fillRect(lay.bx - T, lay.by - T, lay.bw + 2 * T, lay.bh + 2 * T);
        g.restore();
      }
      // 光标
      if (showCursor && cursor >= 0 && inputOn) {
        const [x, y] = cellXY(lay, cursor);
        g.save(); g.strokeStyle = '#ff5a40'; g.lineWidth = 3; g.shadowColor = 'rgba(255,90,60,.8)'; g.shadowBlur = 8;
        roundRect(g, x + 1, y + 1, T - 2, T - 2, T * 0.12); g.stroke(); g.restore();
      }
    }
    function drawIncense(lay, t) {
      const w = lay.w;
      const Ls = clamp(w * 0.42, 140, 300);
      const x0 = (w - Ls) / 2, y = narrow() ? 22 : 28;
      const f = clamp(timeLeft / timeMax, 0, 1);
      // 香座
      g.fillStyle = '#5a3a22';
      roundRect(g, x0 - 16, y + 3, 26, 9, 3); g.fill();
      g.fillStyle = '#8a5a30'; roundRect(g, x0 - 14, y + 3, 22, 3, 1.5); g.fill();
      // 香灰槽
      g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = 1; g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(x0, y + 5.5); g.lineTo(x0 + Ls, y + 5.5); g.stroke(); g.setLineDash([]);
      // 香身
      const tipX = x0 + Ls * f;
      g.lineCap = 'round';
      g.strokeStyle = '#7a3a24'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(Math.max(x0 + 0.1, tipX), y); g.stroke();
      g.strokeStyle = 'rgba(255,190,140,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0, y - 1); g.lineTo(Math.max(x0 + 0.1, tipX), y - 1); g.stroke();
      // 香灰
      if (f < 0.999) {
        g.strokeStyle = 'rgba(150,145,140,.8)'; g.lineWidth = 3.5;
        g.beginPath(); g.moveTo(tipX, y); g.lineTo(Math.min(x0 + Ls, tipX + 10), y + 0.5); g.stroke();
      }
      // 火点
      if (timing || f > 0) {
        const fl = 0.8 + 0.2 * Math.sin(t * 13);
        glow(g, tipX, y, 14, 'rgba(255,120,40,.85)', fl);
        g.fillStyle = '#ffdd88'; g.beginPath(); g.arc(tipX, y, 2.2, 0, TAU); g.fill();
      }
      // 烟
      g.save();
      for (const s of smoke) {
        const k = s.t / s.life;
        g.strokeStyle = `rgba(120,110,100,${0.28 * (1 - k)})`; g.lineWidth = 1.2 + k * 2;
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.quadraticCurveTo(s.x + Math.sin(s.p + k * 4) * 8, s.y - 10, s.x + Math.sin(s.p + k * 6) * 5, s.y - 20);
        g.stroke();
      }
      g.restore();
      // 剩余时间
      const sec = Math.ceil(timeLeft);
      const low = timeLeft < 20 && timing;
      const txt = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      brushText(g, txt, x0 + Ls + 14, y + 2, low ? 22 + 2 * Math.sin(t * 10) : 20, low ? '#b23a2e' : '#3b352d', { align: 'left' });
      brushText(g, '香', x0 - 28, y + 2, 20, '#3b352d', { align: 'right' });
      return { tipX, y };
    }

    // ---------------------------------------------------------------- 主循环
    let smokeAcc = 0;
    let loopErr = false;
    const stopLoop = ctx.loop((dt) => {
      if (hostPaused(ctx)) dt = 0; // 宿主「暂且离开？」确认框打开时，香也停着
      time += dt;
      tw.update(dt);
      P.update(dt);
      try { frame(dt, time); } catch (e) { if (!loopErr) { loopErr = true; console.error('[tiles]', e); } }
    });
    function frame(dt, t) {
      if (timing) {
        timeLeft = Math.max(0, timeLeft - dt);
        if (timeLeft < 20 && !lowWarned) { lowWarned = true; tip.set('香快燃尽了！', 'dark'); ctx.sfx('tick'); }
        if (timeLeft <= 0 && resolveLevel) { timing = false; resolveLevel('timeout'); }
      }
      if (p) {
        for (const i of p.cells) {
          disp[i] = approach(disp[i], rot[i], 22, dt);
          if (Math.abs(disp[i] - rot[i]) < 0.002) disp[i] = rot[i];
          pop[i] = Math.max(0, pop[i] - dt * 5);
          if (glowT[i] > glowV[i]) {
            if (glowDelay[i] > 0) glowDelay[i] -= dt;
            else glowV[i] = Math.min(1, glowV[i] + dt * 6);
          } else glowV[i] = Math.max(glowT[i], glowV[i] - dt * 7);
        }
      }
      shakeT = Math.max(0, shakeT - dt * 3);
      for (const s of smoke) { s.t += dt; s.y -= dt * 14; }
      for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].t > smoke[i].life) smoke.splice(i, 1);

      const lay = layout();
      ensureBg(lay.w, lay.h);
      g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      g.clearRect(0, 0, lay.w, lay.h);
      g.drawImage(bg.c, 0, 0, lay.w, lay.h);
      if (p) {
        drawFrame(lay, t);
        drawTiles(lay, t);
        if (motifA > 0.01) {
          const pad = lay.T * 0.3;
          glow(g, lay.bx + lay.bw / 2, lay.by + lay.bh / 2, Math.max(lay.bw, lay.bh) * 0.6, 'rgba(255,230,170,.45)', motifA);
          drawMotif(g, lv.motif, lay.bx + pad, lay.by + pad, lay.bw - pad * 2, lay.bh - pad * 2, motifA);
        }
      }
      P.draw(g);
      const inc = drawIncense(lay, t);
      smokeAcc += dt;
      if (timing && smokeAcc > 0.22) { smokeAcc = 0; smoke.push({ x: inc.tipX, y: inc.y - 3, t: 0, life: 1.6, p: R() * TAU }); }
    }

    // ---------------------------------------------------------------- 操作
    function hud() {
      const name = MOTIFS[lv.motif].name;
      ctx.hud({
        center: narrow() ? `${li + 1}/3 ${name}` : `第${['一', '二', '三'][li]}块 · ${name}`,
        right: narrow() ? `${moves}步` : `步数 <b>${moves}</b>`,
      });
    }
    function refreshConn(fromTap) {
      const cur = current(p, rot);
      const a = analyze(p, cur);
      let grew = 0;
      for (const i of p.cells) {
        const c = a.depth[i] >= 0 ? 1 : 0;
        if (c && glowT[i] < 1) { glowT[i] = 1; glowDelay[i] = a.depth[i] * 0.045; if (i !== p.source) grew++; }
        else if (!c && glowT[i] > 0) { glowT[i] = 0; glowDelay[i] = 0; }
      }
      conn = a;
      if (grew && fromTap) {
        ctx.sfx('pluck', { note: clamp(Math.round(a.reached / p.cells.length * 14), 0, 14) });
        if (!firstConnectTip && li === 0) { firstConnectTip = true; tip.set('和<b>宝珠</b>相连的藤蔓会发出金光。', ''); }
      }
      return a;
    }
    function tap(i, dir = 1) {
      if (!inputOn || !p.ok[i]) return;
      if (locked[i]) { cursor = i; shakeT = 1; ctx.sfx('bad'); return; }
      rot[i] += dir;
      if (rot[i] < 0) { rot[i] += 4; disp[i] += 4; }
      pop[i] = 1;
      moves++; totalMoves++;
      ctx.sfx('rotate');
      const a = refreshConn(true);
      hud();
      if (a.solved) { inputOn = false; timing = false; if (resolveLevel) resolveLevel('solved'); }
    }
    function useHint() {
      if (!inputOn) return;
      // 优先：与已连通区域相邻、且朝向不对的瓦
      const wrong = p.cells.filter((i) => !locked[i] && ((((rot[i] % 4) + 4) % 4) % period(p.sol[i])) !== 0);
      if (!wrong.length) return;
      const near = wrong.filter((i) => [0, 1, 2, 3].some((d) => { const j = p.nb(i, d); return j >= 0 && conn && conn.depth[j] >= 0; }));
      const pick = (near.length ? near : wrong)[Math.floor(R() * (near.length ? near.length : wrong.length))];
      const per = period(p.sol[pick]);
      let need = ((4 - (rot[pick] % 4)) % 4) % per;
      rot[pick] += need;
      locked[pick] = true;
      pop[pick] = 1;
      hints++;
      ctx.sfx('magic');
      const lay = layout();
      const [x, y] = cellXY(lay, pick);
      P.emit(14, (q) => {
        const a = R() * TAU, s = 30 + R() * 70;
        q.x = x + lay.T / 2; q.y = y + lay.T / 2; q.vx = Math.cos(a) * s; q.vy = Math.sin(a) * s; q.drag = 2.5; q.life = 0.7 + R() * 0.4;
        q.size = 3 + R() * 2; q.shape = 'star'; q.color = '#ffe7a0'; q.add = true; q.vr = 4;
      });
      const a = refreshConn(true);
      if (a.solved) { inputOn = false; timing = false; if (resolveLevel) resolveLevel('solved'); }
    }
    const hintBtn = easy ? button(ctx.root, '提 示', 'paper small tiles-hintbtn', () => useHint()) : null;

    function cellAt(x, y) {
      const lay = layout();
      const cx = Math.floor((x - lay.bx) / lay.T), cy = Math.floor((y - lay.by) / lay.T);
      if (cx < 0 || cy < 0 || cx >= lv.cols || cy >= lv.rows) return -1;
      const i = cy * lv.cols + cx;
      return p.ok[i] ? i : -1;
    }
    S.on(cv.canvas, 'pointerdown', (e) => {
      if (!inputOn || !p) return;
      const q = localXY(cv.canvas, e);
      const i = cellAt(q.x, q.y);
      if (i < 0) return;
      showCursor = false;
      cursor = i;
      tap(i, e.button === 2 ? -1 : 1);
    });
    S.on(cv.canvas, 'contextmenu', (e) => e.preventDefault());
    S.add(ctx.keys.onDown((code, e) => {
      if (!inputOn || !p || hostPaused(ctx)) return;
      const dirs = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
      if (code in dirs) {
        e.preventDefault();
        if (!showCursor || cursor < 0) { showCursor = true; if (cursor < 0 || !p.ok[cursor]) cursor = p.source; ctx.sfx('tick'); return; }
        const d = dirs[code];
        let x = cursor % lv.cols, y = Math.floor(cursor / lv.cols);
        for (let s = 0; s < Math.max(lv.cols, lv.rows); s++) {
          x += DX[d]; y += DY[d];
          if (x < 0 || y < 0 || x >= lv.cols || y >= lv.rows) break;
          if (p.ok[y * lv.cols + x]) { cursor = y * lv.cols + x; ctx.sfx('tick'); break; }
        }
      } else if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        if (!showCursor || cursor < 0) { showCursor = true; if (cursor < 0 || !p.ok[cursor]) cursor = p.source; return; }
        tap(cursor, 1);
      } else if (code === 'KeyQ' || code === 'KeyZ' || code === 'Backspace') {
        e.preventDefault();
        if (showCursor && cursor >= 0) tap(cursor, -1);
      } else if (code === 'KeyH' && easy) { e.preventDefault(); useHint(); }
    }));
    S.add(ctx.onResize(() => { if (p) hud(); }));

    // ---------------------------------------------------------------- 流程
    async function playLevel(k) {
      li = k; lv = levels[k];
      p = generate(lv, R);
      rot = p.rot.slice();
      disp = rot.slice();
      pop = new Array(p.n).fill(0);
      glowV = new Array(p.n).fill(0); glowT = new Array(p.n).fill(0); glowDelay = new Array(p.n).fill(0);
      locked = new Array(p.n).fill(false);
      appear = new Array(p.n).fill(0);
      const pal = GLAZE[lv.glaze];
      glaze = Array.from({ length: p.n }, () => pal[Math.floor(R() * pal.length)]);
      moves = 0; totalPar += p.par;
      timeMax = timeLeft = lv.time; lowWarned = false;
      motifA = 0; sweep = -1; boardDim = 0;
      cursor = showCursor ? p.source : -1;
      hud();
      // 源头先亮
      glowT[p.source] = 1; glowV[p.source] = 0;
      refreshConn(false);
      const order = p.cells.slice().sort((a, b) => (a % lv.cols + Math.floor(a / lv.cols)) - (b % lv.cols + Math.floor(b / lv.cols)));
      order.forEach((i, n) => tw.to(0.38, (e) => { appear[i] = e; }, { ease: easeOutBack, delay: n * 0.025 }));
      ctx.sfx('open');
      await tw.delay(0.4 + order.length * 0.025);
      const name = MOTIFS[lv.motif].name;
      if (k === 0) tip.set(`点一块瓦，它会<b>顺时针转动</b>。把藤蔓接成一整片：<b>不留断头</b>，也不伸出边外。${ctx.isTouch ? '' : '<br><span style="font-size:.85em;opacity:.8">方向键选瓦，空格转动；鼠标右键逆转</span>'}`, '');
      else if (lv.arch) tip.set(`最后一块：<b>${name}</b>。拱门中间是门洞——藤蔓也不能伸进门洞。`, '');
      else tip.set(`第二块：<b>${name}</b>。从宝珠旁边接起，一圈圈往外推。`, '');
      inputOn = true; timing = true;
      if (hintBtn) hintBtn.disabled = false;
      const res = await waitFor(ctx, (done) => { resolveLevel = done; return () => { resolveLevel = null; }; });
      inputOn = false; timing = false;
      if (hintBtn) hintBtn.disabled = true;
      return res;
    }
    async function levelSolved(k) {
      tip.hide();
      showCursor = false;
      await tw.delay(0.35);
      ctx.sfx('chime');
      ctx.sfx('whoosh');
      await tw.to(0.9, (e) => { sweep = e; }, { ease: (x) => x });
      sweep = -1;
      const lay = layout();
      const name = MOTIFS[lv.motif].name;
      ctx.sfx('magic');
      tw.to(0.8, (e) => { motifA = e; });
      P.emit(30, (q) => {
        q.x = lay.bx + R() * lay.bw; q.y = lay.by + R() * lay.bh; q.vy = -20 - R() * 40; q.vx = (R() - 0.5) * 30; q.drag = 0.5;
        q.life = 1 + R() * 0.8; q.size = 2.5 + R() * 3; q.shape = 'star'; q.color = R() < 0.6 ? '#fff3c4' : '#ffd86a'; q.add = true; q.vr = 3; q.fadeIn = 0.2;
      });
      const extra = moves - p.par;
      if (extra <= 2) { ctx.sfx('perfect'); ctx.toast(`${name}归位！`, 'gold'); } else { ctx.sfx('good'); ctx.toast(`${name}归位！`, 'good'); }
      tip.set(k === 0 ? '白象驮莲座——拱门上的琉璃白象复原了。' : k === 1 ? '生着双翼的飞羊，踏云而来。' : '飞天衣带当风，拱门终于完整。', '');
      await tw.delay(2.2);
      tip.hide();
      if (k < levels.length - 1) {
        const cells = p.cells.slice();
        tw.to(0.4, (e) => { motifA = 1 - e; });
        cells.forEach((i, n) => tw.to(0.3, (e) => { appear[i] = 1 - e; }, { delay: n * 0.012, ease: (x) => x * x }));
        await tw.delay(0.45 + cells.length * 0.012);
      }
    }
    async function timeUp() {
      tip.set('一炷香燃尽了……', 'dark');
      ctx.sfx('bad');
      ctx.toast('香尽了', 'bad');
      await tw.to(0.8, (e) => { boardDim = e; });
      await tw.delay(0.8);
    }

    if (opts.debug) {
      window.__tiles = {
        get p() { return p; }, get rot() { return rot; }, get inputOn() { return inputOn; }, get moves() { return moves; },
        get timeLeft() { return timeLeft; }, set timeLeft(v) { timeLeft = v; },
        tap: (i, d) => tap(i, d),
        solveAll: () => { for (const i of p.cells) { const per = period(p.sol[i]); let need = ((4 - (rot[i] % 4)) % 4) % per; while (need-- > 0) tap(i, 1); } },
        cellXY: (i) => { const lay = layout(); const [x, y] = cellXY(lay, i); return [x + lay.T / 2, y + lay.T / 2]; },
      };
    }

    // ---------------------------------------------------------------- 运行
    try {
      await fontReady('转瓦白象飞羊天香', 48);
      for (let k = startAt; k < levels.length; k++) {
        const res = await playLevel(k);
        if (res === 'timeout') {
          await timeUp();
          return { success: false, score: 0, perfect: false, note: '一炷香燃尽了。诀窍：先把宝珠周围的藤蔓接好，再一圈圈往外推；边角上的瓦只有一两种转法。' };
        }
        await levelSolved(k);
      }
      const extra = Math.max(0, totalMoves - totalPar);
      const perfect = extra <= 6 && hints === 0;
      const score = Math.max(40, Math.round(100 - extra * 0.8 - hints * 6));
      return {
        success: true,
        score,
        scoreText: `转了 ${totalMoves} 次（顺转最少 ${totalPar} 次）${hints ? ` · 提示 ${hints} 次` : ''} · 得分 ${score} / 100`,
        perfect,
        note: '白象、飞羊、飞天，三块拱门琉璃件各归其位。相传琉璃塔的构件都烧造一式三份，一份上塔，两份编号埋存备用——蠹啃掉的正是那些墨书编号。',
      };
    } finally {
      stopLoop();
      S.dispose();
    }
  },
};
