// 窑火 —— 周老汉的馒头窑，重烧一窑补缺的城砖。
// 预热 → 烧成 → 保温：按住「添柴」让火旺，松手火弱，把火色稳在金框里；
// 最后封窑窨水：窑顶洇水，砖在缺氧中由红转青。看准水圈与金圈重合的一刻浇水。
//
// opts：seed 随机种子 · pass 过关所需砖品（默认 60，简单 45）· tutorial true/false 强制开关教学提示
import { clamp, lerp, rng, smoothstep, easeOutCubic, easeInOutCubic, TAU, injectStyle, el } from '../core/util.js';
import css from './kiln.css';
import {
  useLibStyle, fBrush, fBody, fontsReady, Particles, Shake, gameButton, hint, banner, keymap, untilDone, devHandle, hostPaused,
  rr, rgba, mixRgb, rampRgb, glowSprite, drawRidge,
} from './lib-a.js';

// 火色：暗红 → 樱红 → 橘红 → 橘黄 → 金黄 → 白炽
const FIRE = [[0, '#2a1a14'], [0.18, '#5c1b10'], [0.36, '#9d2717'], [0.52, '#d44b1c'], [0.66, '#f08b2b'], [0.8, '#f8c24e'], [0.92, '#fde7a3'], [1, '#fffaf0']];
const LABELS = [[0.2, '暗红'], [0.4, '樱红'], [0.56, '橘红'], [0.72, '橘黄'], [0.86, '金黄'], [0.97, '白炽']];
const PHASES = [
  { name: '预热', sub: '文火烘坯 · 逼出潮气', lo: 0.3, hi: 0.44, need: 9, limit: 22, say: '先用文火慢慢烘，把砖坯里的潮气逼出来——火色暗红就够，千万别急。' },
  { name: '烧成', sub: '大火烧透 · 火色橘黄', lo: 0.66, hi: 0.8, need: 13, limit: 28, say: '上大火！火色要烧到橘黄。' },
  { name: '保温', sub: '稳火焖窑 · 里外烧透', lo: 0.56, hi: 0.68, need: 10, limit: 24, say: '火降一点，稳住，焖一焖，让砖里外都烧透。' },
];
const TAB_NAMES = ['预热', '烧成', '保温', '窨水'];
const ICON_WOOD = '<svg viewBox="0 0 24 24"><path d="M12.2 1.8c1.6 3.1 4.6 4.8 4.6 8.4a4.8 4.8 0 0 1-9.6 0c0-2.7 2-4 2.6-6.2.9 1.2 1.2 2.5 1.1 3.7 1.6-1.3 1.9-3.5 1.3-5.9z" fill="currentColor"/><rect x="2.5" y="15.6" width="19" height="3.2" rx="1.6" fill="currentColor" transform="rotate(-9 12 17.2)"/><rect x="2.5" y="19.3" width="19" height="3.2" rx="1.6" fill="currentColor" transform="rotate(9 12 20.9)"/></svg>';
const ICON_WATER = '<svg viewBox="0 0 24 24"><path d="M12 2.5C9 7 6 10.2 6 14a6 6 0 0 0 12 0c0-3.8-3-7-6-11.5z" fill="currentColor"/></svg>';

// 局部坐标（窑的剖面）：地面 y=0，向上为负
const BOX_L = { x0: -575, x1: 445, y0: -512, y1: 64 };
const BOX_P = { x0: -405, x1: 440, y0: -512, y1: 64 };
const FLOW = [[-172, 32], [-176, -40], [-188, -118], [-164, -198], [-104, -262], [0, -286], [104, -262], [166, -198], [188, -120], [190, -52], [206, -24], [290, -24], [392, -24]];
const TUB = { x: -118, y: -392 };
const POND = { x: 0, y: -357 };
const PULSE = { x: 0, y: -448, r: 50 };

export default {
  id: 'kiln',
  title: '窑火',
  subtitle: '烧一窑青砖',
  rules: [
    '按住<b>「添柴」</b>（或空格、按住画面）火势渐旺；松手火势渐弱。火有余势，要提前收手。',
    '看右侧<b>火色尺</b>：把火色稳在<b>金框</b>里，进度才会增长；火太猛会把砖坯烧裂，砖品下降。',
    '依次<b>预热 → 烧成 → 保温</b>，最后封窑<b>窨水</b>：水圈与金圈重合时点按浇水，砖才会由红转青。',
    '出窑时砖品不低于六十即可过关。',
  ],
  controls: '按住 鼠标 / 触屏 / 空格 添柴 · 窨水时点按',
  async play(ctx, opts = {}) {
    useLibStyle();
    injectStyle('kiln', css);
    await fontsReady();
    return run(ctx, opts);
  },
};

async function run(ctx, opts) {
  const easy = ctx.difficulty === 0;
  const PASS = opts.pass ?? (easy ? 45 : 60);
  const R = rng(opts.seed ?? ((Date.now() ^ (ctx.attempt * 131)) >>> 0));
  const dpr = ctx.dpr;
  const WIDEN = easy ? 0.04 : 0;
  const TOL = easy ? 0.07 : 0.045;

  const cv = ctx.canvas();
  const g = cv.g;
  const back = document.createElement('canvas');
  const front = document.createElement('canvas');
  const ui = ctx.el('div', 'kiln-ui');
  const say = el('div', 'kiln-say', ui);
  say.innerHTML = '<span class="kiln-say-seal">周</span><span class="kiln-say-b"><span class="kiln-say-n">周老汉</span><span class="kiln-say-t"></span></span>';
  const sayT = say.querySelector('.kiln-say-t');
  const showKeys = !ctx.isTouch;
  const btn = gameButton(ui, {
    text: '添柴', icon: ICON_WOOD, cls: 'gold kiln-btn', key: showKeys ? '空格' : '',
    onPress: () => press('btn'), onRelease: () => release('btn'),
  });

  const parts = new Particles(700);
  const shake = new Shake();
  const L = {};
  const S = {
    phase: 'trans', phaseT: 0, t: 0, pi: 0, T: 0.06, F: 0, prog: 0, phaseTime: 0, quality: 100,
    crackAcc: 0, cracks: 0, fired: 0, noise: 0, gust: { t: 9, dur: 0, str: 0 }, nextGust: 7 + R() * 4,
    bandLo: PHASES[0].lo - WIDEN, bandHi: PHASES[0].hi + WIDEN, inBandFor: 0, lowFor: 0, highFor: 0,
    feeding: false, feedT: 0, fireSfxT: 0, logT: 0, smokeT: 0, sparkT: 0, sealK: 0, capK: 0,
    q: null, quenched: false, pourAnim: -1, steamT: -1, done: null, result: null, freeze: false,
    windK: 0, firstFeed: false, firstBand: false, winds: [],
  };
  const ware = makeWare();
  const held = new Set();

  // ---------------------------------------------------------------- 周老汉
  let sayTimer = 0;
  let sayPrio = 0;
  const cool = {};
  function speak(text, { dur = 2.8, prio = 1, warn = false, key = null, cd = 0 } = {}) {
    if (key) {
      if (cool[key] > S.t) return;
      cool[key] = S.t + cd;
    }
    if (sayTimer > 0 && prio < sayPrio) return;
    sayT.textContent = text;
    say.classList.add('show');
    say.classList.toggle('warn', warn);
    say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop');
    sayTimer = dur; sayPrio = prio;
  }

  // ---------------------------------------------------------------- 窑中砖坯
  function makeWare() {
    const list = [];
    const Rw = rng(77);
    const inside = (x, y) => {
      if (x < -127 || x > 188 || y > -8) return false;
      if (y >= -125) return true;
      const dx = x / 184; const dy = (y + 125) / 150;
      return dx * dx + dy * dy <= 1;
    };
    let row = 0;
    for (let yb = -8; yb > -290; yb -= 17, row++) {
      const h = 15;
      const long = row % 2 === 0;
      const w = long ? 38 : 15; const gap = long ? 7 : 10;
      const off = long ? (row % 4 === 0 ? 0 : 22) : 5;
      for (let x = -124 + off; x + w <= 190; x += w + gap) {
        if (inside(x, yb - h) && inside(x + w, yb - h)) {
          list.push({ x, y: yb - h, w, h, v: Rw(), crack: 0, blue: 0, blueShow: 0, seed: Math.floor(Rw() * 1e6) });
        }
      }
    }
    return list;
  }

  // ---------------------------------------------------------------- 布局
  const K = (x, y) => [L.ox + x * L.s, L.oy + y * L.s];
  function layout() {
    const W = ctx.w; const H = ctx.h;
    L.W = W; L.H = H;
    L.portrait = W / H < 0.9;
    L.headY = L.portrait ? 12 : 12;
    L.headH = 54;
    if (L.portrait) {
      L.gw = clamp(W * 0.1, 30, 44);
      L.gx = W - L.gw - 10;
      L.btnW = Math.min(300, W - 40); L.btnH = clamp(H * 0.09, 58, 72);
      L.btnX = (W - L.btnW) / 2; L.btnY = H - L.btnH - 14;
      L.sayTop = L.headY + L.headH + 8;
      const top = L.sayTop + 70; const bottom = L.btnY - 16;
      L.gy = top + 6; L.gh = bottom - top - 12;
      fit(BOX_P, 8, top, W - L.gw - 28, bottom - top);
    } else {
      L.gw = clamp(W * 0.045, 36, 56);
      L.gx = W - L.gw - 26;
      L.btnW = clamp(W * 0.15, 150, 200); L.btnH = clamp(H * 0.12, 64, 86);
      L.btnX = W - L.btnW - 18; L.btnY = H - L.btnH - 16;
      L.sayTop = L.headY + L.headH + 10;
      const top = L.headY + L.headH + 4; const bottom = H - 8;
      L.gy = top + 40; L.gh = L.btnY - 34 - L.gy;
      fit(BOX_L, 10, top, L.gx - 60, bottom - top);
    }
    btn.style.left = `${L.btnX}px`; btn.style.top = `${L.btnY}px`;
    btn.style.width = `${L.btnW}px`; btn.style.height = `${L.btnH}px`;
    btn.style.fontSize = `${clamp(L.btnH * 0.4, 22, 32)}px`;
    if (L.portrait) say.style.cssText = `left:8px;right:${L.gw + 18}px;top:${L.sayTop}px;max-width:none;`;
    else say.style.cssText = `left:16px;top:${L.sayTop}px;max-width:${Math.min(460, W * 0.42)}px;`;
    drawBack();
    drawFront();
  }
  function fit(box, x, y, w, h) {
    const bw = box.x1 - box.x0; const bh = box.y1 - box.y0;
    const s = Math.min(w / bw, h / bh);
    L.s = s;
    L.ox = x + (w - bw * s) / 2 - box.x0 * s;
    L.oy = y + (h - bh * s) * (L.portrait ? 0.74 : 0.72) - box.y0 * s;
    L.fgBottom = y + h;
  }

  // ---------------------------------------------------------------- 静态层：天空、山、地面、窑包、烟囱、柴堆
  function chamberPath() {
    const p = new Path2D();
    p.moveTo(-200, 40); p.lineTo(-200, -125);
    p.ellipse(0, -125, 200, 165, 0, Math.PI, TAU);
    p.lineTo(200, -8); p.lineTo(-146, -8); p.lineTo(-146, 40); p.closePath();
    return p;
  }
  function tunnelPath() { // 火门甬道
    const p = new Path2D();
    p.moveTo(-380, 40); p.lineTo(-380, -22); p.quadraticCurveTo(-380, -52, -350, -52); p.lineTo(-200, -52); p.lineTo(-200, 40); p.closePath();
    return p;
  }
  function fluePath() {
    const p = new Path2D();
    p.rect(198, -40, 186, 32);
    return p;
  }
  const CH = chamberPath();
  const TUN = tunnelPath();
  const FLUE = fluePath();
  const MOUND = new Path2D('M -384 0 C -392 -205, -240 -356, 0 -362 C 240 -356, 376 -205, 368 0 Z');

  function drawBack() {
    const W = L.W; const H = L.H;
    back.width = Math.ceil(W * dpr); back.height = Math.ceil(H * dpr);
    const b = back.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gy = L.oy;
    const sky = b.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#252c43'); sky.addColorStop(0.45, '#4f4a63'); sky.addColorStop(0.8, '#a77468'); sky.addColorStop(1, '#d9a57e');
    b.fillStyle = sky; b.fillRect(0, 0, W, gy + 2);
    const Rs = rng(3);
    for (let i = 0; i < 70; i++) {
      const x = Rs() * W; const y = Rs() * gy * 0.55;
      b.fillStyle = `rgba(255,246,226,${0.15 + Rs() * 0.55})`;
      const s = Rs() < 0.1 ? 2 : 1.2;
      b.fillRect(x, y, s, s);
    }
    // 月
    const mx = L.portrait ? W * 0.18 : W * 0.1; const my = Math.max(L.headY + L.headH + 30, gy * 0.26); const mr = clamp(Math.min(W, H) * 0.032, 12, 26);
    const mg = b.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.5);
    mg.addColorStop(0, 'rgba(255,240,205,.18)'); mg.addColorStop(1, 'rgba(255,240,205,0)');
    b.fillStyle = mg; b.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    b.fillStyle = '#f6e7c3'; b.beginPath(); b.arc(mx, my, mr, 0, TAU); b.fill();
    b.fillStyle = '#353752'; b.beginPath(); b.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.9, 0, TAU); b.fill();
    // 远山、树
    drawRidge(b, -10, W + 10, gy - H * 0.1, H * 0.13, 5, '#2b2d40', 0.6, gy);
    drawRidge(b, -10, W + 10, gy - H * 0.04, H * 0.08, 9, '#1c1f2d', 0.7, gy);
    const tree = (x, y, s) => {
      b.fillStyle = '#171a26'; b.strokeStyle = '#171a26'; b.lineWidth = s * 0.06;
      b.beginPath(); b.moveTo(x, y); b.lineTo(x + s * 0.03, y - s * 0.7); b.stroke();
      for (let k = 0; k < 4; k++) { b.beginPath(); b.ellipse(x + (k % 2 ? 1 : -1) * s * 0.12, y - s * (0.5 + k * 0.14), s * (0.3 - k * 0.05), s * 0.09, 0, 0, TAU); b.fill(); }
    };
    tree(W * 0.04, gy, Math.min(W, H) * 0.22);
    tree(W * 0.94, gy, Math.min(W, H) * 0.18);
    // 地面
    const gg = b.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, '#4d3727'); gg.addColorStop(1, '#271b13');
    b.fillStyle = gg; b.fillRect(0, gy, W, H - gy);
    b.strokeStyle = 'rgba(20,12,6,.35)'; b.lineWidth = 1;
    const Rg = rng(12);
    for (let i = 0; i < 30; i++) { const x = Rg() * W; const y = gy + 4 + Rg() * (H - gy); b.beginPath(); b.moveTo(x, y); b.lineTo(x + 10 + Rg() * 40, y + (Rg() - 0.5) * 3); b.stroke(); }
    // 草
    b.strokeStyle = 'rgba(40,52,30,.8)'; b.lineWidth = 1.2;
    for (let i = 0; i < W / 6; i++) { const x = Rg() * W; const h = 3 + Rg() * 7; b.beginPath(); b.moveTo(x, gy + 1); b.lineTo(x + (Rg() - 0.5) * 4, gy - h); b.stroke(); }

    drawBlankStacks(b, gy);
    b.save();
    b.translate(L.ox, L.oy); b.scale(L.s, L.s);
    const u = 1 / L.s;
    // 窑前工作坑
    b.fillStyle = '#2d1f16';
    b.beginPath(); b.moveTo(-500, 0); b.lineTo(-470, 42); b.lineTo(-380, 42); b.lineTo(-380, 0); b.closePath(); b.fill();
    // 窑包（剖面）
    const mg2 = b.createLinearGradient(0, -362, 0, 0);
    mg2.addColorStop(0, '#6d4c34'); mg2.addColorStop(1, '#4a3223');
    b.fillStyle = mg2; b.fill(MOUND);
    b.save(); b.clip(MOUND);
    const Re = rng(21);
    b.strokeStyle = 'rgba(30,18,10,.28)'; b.lineWidth = 2;
    for (let y = -350; y < 0; y += 14 + Re() * 10) {
      b.beginPath(); b.moveTo(-400, y);
      for (let x = -400; x <= 400; x += 40) b.lineTo(x, y + Math.sin(x * 0.02 + y) * 3);
      b.stroke();
    }
    for (let i = 0; i < 90; i++) { b.fillStyle = Re() < 0.5 ? 'rgba(20,12,6,.3)' : 'rgba(200,170,130,.12)'; b.beginPath(); b.ellipse(-380 + Re() * 760, -360 + Re() * 360, 3 + Re() * 6, 2 + Re() * 3, Re() * 3, 0, TAU); b.fill(); }
    b.restore();
    // 窑顶的草
    b.strokeStyle = 'rgba(52,66,36,.9)'; b.lineWidth = 2.2 * Math.max(1, u * 0.6);
    for (let i = 0; i < 70; i++) {
      const a = Math.PI + 0.12 + (i / 70) * (Math.PI - 0.24);
      const x = Math.cos(a) * 376; const y = -Math.abs(Math.sin(a)) * 362 * (1 - 0.02 * Math.cos(a * 3));
      if (Math.abs(x) < 80 && y < -340) continue;
      b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * 9 + (Re() - 0.5) * 6, y - 10 - Re() * 10); b.stroke();
    }
    // 窨水池
    b.fillStyle = '#3a2819';
    b.beginPath(); b.ellipse(POND.x, POND.y + 2, 78, 11, 0, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(20,12,6,.8)'; b.lineWidth = 2.5; b.stroke();
    // 暗处：窑室、甬道、烟道
    b.fillStyle = '#140d0a'; b.fill(CH); b.fill(TUN); b.fill(FLUE);
    // 烟囱
    const cx0 = 380; const cx1 = 424; const top = -484;
    const cg = b.createLinearGradient(cx0, 0, cx1, 0);
    cg.addColorStop(0, '#7a4430'); cg.addColorStop(0.5, '#8e5238'); cg.addColorStop(1, '#5a3122');
    b.fillStyle = cg;
    b.beginPath(); b.moveTo(cx0 - 6, 0); b.lineTo(cx0, top); b.lineTo(cx1, top); b.lineTo(cx1 + 6, 0); b.closePath(); b.fill();
    b.save(); b.clip();
    b.strokeStyle = 'rgba(30,14,8,.55)'; b.lineWidth = 1.4;
    let rw = 0;
    for (let y = 0; y > top; y -= 12, rw++) {
      b.beginPath(); b.moveTo(cx0 - 10, y); b.lineTo(cx1 + 10, y); b.stroke();
      const off = rw % 2 ? 11 : 0;
      for (let x = cx0 - 10 + off; x < cx1 + 10; x += 22) { b.beginPath(); b.moveTo(x, y); b.lineTo(x, y - 12); b.stroke(); }
    }
    b.restore();
    b.fillStyle = '#4c2a1d'; b.fillRect(cx0 - 5, top - 10, cx1 - cx0 + 10, 12);
    b.strokeStyle = 'rgba(20,10,5,.8)'; b.lineWidth = 2;
    b.beginPath(); b.moveTo(cx0 - 6, 0); b.lineTo(cx0, top); b.lineTo(cx1, top); b.lineTo(cx1 + 6, 0); b.stroke();
    b.strokeRect(cx0 - 5, top - 10, cx1 - cx0 + 10, 12);
    // 柴堆
    const logs = [[-548, -12], [-520, -12], [-492, -12], [-534, -36], [-506, -36], [-520, -60]];
    for (const [lx, ly] of logs) {
      b.fillStyle = '#6b4526'; b.beginPath(); b.arc(lx, ly, 13, 0, TAU); b.fill();
      b.strokeStyle = '#2e1b0e'; b.lineWidth = 2; b.stroke();
      b.strokeStyle = 'rgba(210,170,110,.5)'; b.lineWidth = 1.2;
      b.beginPath(); b.arc(lx, ly, 7, 0, TAU); b.stroke();
      b.beginPath(); b.arc(lx, ly, 2.5, 0, TAU); b.stroke();
    }
    b.fillStyle = '#5a3a20'; b.save(); b.translate(-470, -8); b.rotate(-0.25); rr(b, -40, -7, 80, 14, 6); b.fill(); b.restore();
    b.restore();
  }

  // 前景：晾着的砖坯垛（盖着草帘）
  function drawBlankStacks(b, gy) {
    const room = L.fgBottom - gy;
    if (room < 70) return;
    const Rk = rng(31);
    const sc = clamp(L.s * 1.15, 0.3, 0.9);
    const bw = 34 * sc; const bh = 13 * sc;
    const base = gy + room * 0.82;
    const xs = L.portrait ? [L.W * 0.2, L.W * 0.62] : [L.W * 0.08, L.W * 0.3];
    for (const x0 of xs) {
      const rows = 5; const cols = 4;
      const sw = cols * bw * 1.12 + bw * 0.3;
      b.fillStyle = 'rgba(0,0,0,.28)'; b.beginPath(); b.ellipse(x0 + sw / 2 - bw * 0.2, base + 1, sw * 0.62, bh * 0.55, 0, 0, TAU); b.fill();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - (r % 2 ? 1 : 0); c++) {
          const x = x0 + c * bw * 1.12 + (r % 2 ? bw * 0.56 : 0); const y = base - (r + 1) * bh * 1.08;
          b.fillStyle = rgba(mixRgb('#8f7a63', '#a48d72', Rk()));
          b.fillRect(x, y, bw, bh);
          b.strokeStyle = 'rgba(30,20,12,.7)'; b.lineWidth = 1; b.strokeRect(x, y, bw, bh);
        }
      }
      // 草帘
      const w = cols * bw * 1.12 + bw * 0.3; const top = base - rows * bh * 1.08;
      b.fillStyle = '#b89a5a';
      b.beginPath(); b.moveTo(x0 - bw * 0.4, top + bh * 0.4); b.lineTo(x0 + w / 2 - bw * 0.2, top - bh * 1.8); b.lineTo(x0 + w, top + bh * 0.4); b.closePath(); b.fill();
      b.strokeStyle = 'rgba(80,60,25,.8)'; b.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const t = i / 11; b.beginPath(); b.moveTo(x0 + w / 2 - bw * 0.2, top - bh * 1.8); b.lineTo(lerp(x0 - bw * 0.4, x0 + w, t), top + bh * 0.4); b.stroke(); }
    }
  }

  function drawTub(b, tilt) {
    b.save();
    b.translate(TUB.x, TUB.y); b.rotate(tilt);
    b.fillStyle = '#7a5230'; b.strokeStyle = '#2e1b0e'; b.lineWidth = 2.5;
    b.beginPath(); b.moveTo(-26, -24); b.lineTo(26, -24); b.lineTo(21, 22); b.lineTo(-21, 22); b.closePath(); b.fill(); b.stroke();
    b.strokeStyle = '#3c3f44'; b.lineWidth = 4;
    b.beginPath(); b.moveTo(-25, -12); b.lineTo(25, -12); b.moveTo(-22, 12); b.lineTo(22, 12); b.stroke();
    b.fillStyle = '#4d7aa0'; b.beginPath(); b.ellipse(0, -24, 25, 5, 0, 0, TAU); b.fill();
    b.restore();
  }

  // ---------------------------------------------------------------- 静态前景层：窑壁砖、挡火墙、窑床
  function drawFront() {
    const W = L.W; const H = L.H;
    front.width = Math.ceil(W * dpr); front.height = Math.ceil(H * dpr);
    const b = front.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.translate(L.ox, L.oy); b.scale(L.s, L.s);
    const Rb = rng(5);
    const brick = () => rgba(mixRgb('#7c4430', '#955a3c', Rb()));
    const mortar = 'rgba(28,16,10,.9)';
    b.lineJoin = 'round';
    // 穹顶两层砖
    const courses = [[200, 165, 217, 182, 26], [217, 182, 234, 199, 28]];
    for (const [rx0, ry0, rx1, ry1, n] of courses) {
      const off = rx0 === 200 ? 0 : 0.5;
      for (let i = -1; i < n; i++) {
        const a0 = Math.PI + clamp((i + off) / n, 0, 1) * Math.PI; const a1 = Math.PI + clamp((i + 1 + off) / n, 0, 1) * Math.PI;
        if (a1 <= a0) continue;
        b.beginPath();
        b.moveTo(Math.cos(a0) * rx0, -125 + Math.sin(a0) * ry0);
        b.lineTo(Math.cos(a0) * rx1, -125 + Math.sin(a0) * ry1);
        b.lineTo(Math.cos(a1) * rx1, -125 + Math.sin(a1) * ry1);
        b.lineTo(Math.cos(a1) * rx0, -125 + Math.sin(a1) * ry0);
        b.closePath();
        b.fillStyle = brick(); b.fill();
        b.strokeStyle = mortar; b.lineWidth = 2; b.stroke();
      }
    }
    // 竖墙
    const wall = (x0, x1, y0, y1) => {
      let row = 0;
      for (let y = y1; y > y0 + 0.1; y -= 13, row++) {
        const yy = Math.max(y0, y - 13);
        const split = row % 2 ? [x0, (x0 + x1) / 2, x1] : [x0, x1];
        for (let k = 0; k < split.length - 1; k++) {
          b.fillStyle = brick(); b.fillRect(split[k], yy, split[k + 1] - split[k], y - yy);
          b.strokeStyle = mortar; b.lineWidth = 2; b.strokeRect(split[k], yy, split[k + 1] - split[k], y - yy);
        }
      }
    };
    wall(-234, -200, -125, -52);
    wall(200, 234, -125, -40);
    wall(200, 234, -8, 6);
    wall(-146, -128, -66, 40);
    // 窑床、火膛底
    let x = -128;
    while (x < 200) { const w = Math.min(36, 200 - x); b.fillStyle = brick(); b.fillRect(x, -8, w, 14); b.strokeStyle = mortar; b.lineWidth = 2; b.strokeRect(x, -8, w, 14); x += w; }
    x = -200;
    while (x < -146) { const w = Math.min(27, -146 - x); b.fillStyle = brick(); b.fillRect(x, 40, w, 12); b.strokeStyle = mortar; b.strokeRect(x, 40, w, 12); x += w; }
    // 甬道口砖券
    b.strokeStyle = '#2b180e'; b.lineWidth = 5;
    b.beginPath(); b.moveTo(-380, 40); b.lineTo(-380, -22); b.quadraticCurveTo(-380, -52, -350, -52); b.lineTo(-234, -52); b.stroke();
    // 剖面描边
    b.strokeStyle = 'rgba(18,10,6,.85)'; b.lineWidth = 3;
    b.stroke(MOUND);
    b.lineWidth = 2.5; b.stroke(CH);
    b.beginPath(); b.moveTo(234, -40); b.lineTo(384, -40); b.moveTo(234, -8); b.lineTo(384, -8); b.stroke();
  }

  // ---------------------------------------------------------------- 动态绘制
  const fireRgb = (t) => rampRgb(FIRE, clamp(t, 0, 1));
  const fireSprite = (t) => glowSprite(fireRgb(Math.round(clamp(t, 0, 1) * 40) / 40).map((v) => v | 0));

  function wareRgb(b) {
    const heat = smoothstep(0.2, 0.9, S.T);
    const raw = mixRgb('#8d7a66', '#a0583b', S.fired);
    let base = raw;
    if (S.quenched) base = mixRgb(mixRgb('#a2553a', '#6b7880', b.blueShow), [0, 0, 0], 0);
    const lit = mixRgb(base, fireRgb(S.T + 0.06), heat * 0.82);
    const v = 0.88 + b.v * 0.22;
    return [lit[0] * v, lit[1] * v, lit[2] * v];
  }

  function drawChamber() {
    const heat = smoothstep(0.06, 0.95, S.T);
    const glow = fireRgb(S.T + 0.1);
    g.save();
    g.translate(L.ox, L.oy); g.scale(L.s, L.s);
    // 窑室内的火光
    g.save();
    g.clip(CH);
    const cg = g.createRadialGradient(-150, -30, 10, -40, -140, 320);
    cg.addColorStop(0, rgba(mixRgb('#1a100c', fireRgb(S.T + 0.2), heat), 1));
    cg.addColorStop(0.6, rgba(mixRgb('#140c09', glow, heat * 0.85), 1));
    cg.addColorStop(1, rgba(mixRgb('#0f0907', fireRgb(S.T - 0.1), heat * 0.6), 1));
    g.fillStyle = cg; g.fillRect(-210, -300, 420, 350);
    // 火流（倒焰：从火膛上窜，沿穹顶翻到窑后，再从窑底吸火孔出去）
    if (S.F > 0.02 || S.T > 0.12) flameFlow(1);
    // 砖坯
    for (const b of ware) {
      const c = wareRgb(b);
      g.fillStyle = rgba(c);
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = `rgba(20,10,6,${0.55 - heat * 0.25})`; g.lineWidth = 1.4;
      g.strokeRect(b.x, b.y, b.w, b.h);
      if (b.crack) {
        g.strokeStyle = 'rgba(15,6,3,.95)'; g.lineWidth = 1.6;
        const Rc = rng(b.seed);
        g.beginPath(); g.moveTo(b.x + b.w * (0.2 + Rc() * 0.3), b.y);
        g.lineTo(b.x + b.w * (0.35 + Rc() * 0.3), b.y + b.h * 0.5); g.lineTo(b.x + b.w * (0.3 + Rc() * 0.4), b.y + b.h); g.stroke();
      }
    }
    g.restore();
    // 甬道与烟道里的光
    g.save(); g.clip(TUN);
    const tg = g.createLinearGradient(-200, 0, -390, 0);
    tg.addColorStop(0, rgba(fireRgb(S.T + 0.15), 0.95 * smoothstep(0.03, 0.5, Math.max(S.F, S.T * 0.8)) * (1 - S.sealK)));
    tg.addColorStop(1, rgba(fireRgb(S.T - 0.1), 0.2 * (1 - S.sealK)));
    g.fillStyle = tg; g.fillRect(-400, -60, 210, 110);
    g.restore();
    g.save(); g.clip(FLUE);
    const fg = g.createLinearGradient(198, 0, 390, 0);
    fg.addColorStop(0, rgba(fireRgb(S.T), 0.7 * heat)); fg.addColorStop(1, rgba(fireRgb(S.T - 0.2), 0.15 * heat));
    g.fillStyle = fg; g.fillRect(196, -42, 192, 36);
    if (S.F > 0.02 || S.T > 0.3) flameFlow(2);
    g.restore();
    // 火膛里的火苗
    drawFirebox();
    g.restore();
  }

  function flameFlow(part) {
    // 沿 FLOW 折线放一串发光团
    const segs = [];
    let total = 0;
    for (let i = 1; i < FLOW.length; i++) { const d = Math.hypot(FLOW[i][0] - FLOW[i - 1][0], FLOW[i][1] - FLOW[i - 1][1]); segs.push(d); total += d; }
    const at = (u) => {
      let d = u * total;
      for (let i = 0; i < segs.length; i++) {
        if (d <= segs[i]) { const k = d / segs[i]; return [lerp(FLOW[i][0], FLOW[i + 1][0], k), lerp(FLOW[i][1], FLOW[i + 1][1], k)]; }
        d -= segs[i];
      }
      return FLOW[FLOW.length - 1];
    };
    const inten = clamp(S.F * 0.8 + S.T * 0.5, 0, 1) * (1 - S.sealK * 0.9);
    if (inten < 0.02) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const n = 26;
    const speed = 0.16 + S.F * 0.22;
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < n; i++) {
        const u = ((i / n) + S.t * speed + k * 0.5 / n) % 1;
        if (part === 1 && u > 0.8) continue;
        if (part === 2 && u <= 0.76) continue;
        const [x, y] = at(u);
        const wob = Math.sin(S.t * 7 + i * 1.7 + k) * 10;
        const fade = (1 - u * 0.75);
        const size = (38 + 26 * S.F) * (0.7 + 0.3 * Math.sin(S.t * 9 + i)) * fade;
        g.globalAlpha = clamp(inten * fade * 0.55, 0, 1);
        const img = fireSprite(S.T + 0.12 * (1 - u));
        g.drawImage(img, x - size + wob * 0.3, y - size + wob, size * 2, size * 2);
      }
    }
    g.restore();
  }

  function drawFirebox() {
    const inten = clamp(S.F, 0, 1) * (1 - S.sealK);
    const ember = clamp(S.T * 1.2, 0, 1) * (1 - S.sealK * 0.7);
    g.save();
    // 炭火
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = -194 + i * 8; const y = 34 + Math.sin(i * 2.3) * 3;
      g.globalAlpha = 0.5 * ember + 0.3;
      g.drawImage(fireSprite(0.45 + ember * 0.35), x - 16, y - 12, 32, 24);
    }
    if (inten > 0.01) {
      for (let i = 0; i < 6; i++) {
        const bx = -192 + i * 8.5;
        const n = Math.sin(S.t * (7 + i) + i * 2.1) * 0.5 + Math.sin(S.t * 13 + i) * 0.25;
        const h = (28 + 140 * inten) * (0.75 + 0.25 * n);
        const sway = Math.sin(S.t * 5 + i) * 8 * inten;
        for (let layer = 0; layer < 3; layer++) {
          const lh = h * [1, 0.72, 0.45][layer]; const lw = [13, 9, 5][layer];
          const col = fireRgb([S.T * 0.8 + 0.2, S.T * 0.8 + 0.35, 0.95][layer]);
          g.globalAlpha = [0.55, 0.6, 0.7][layer] * clamp(inten * 1.4, 0, 1);
          g.fillStyle = rgba(col);
          g.beginPath();
          g.moveTo(bx - lw, 38);
          g.quadraticCurveTo(bx - lw * 0.9 + sway * 0.3, 38 - lh * 0.55, bx + sway, 38 - lh);
          g.quadraticCurveTo(bx + lw * 0.9 + sway * 0.3, 38 - lh * 0.55, bx + lw, 38);
          g.closePath(); g.fill();
        }
      }
    }
    g.restore();
  }

  function drawOverlays() {
    g.save();
    g.translate(L.ox, L.oy); g.scale(L.s, L.s);
    // 内壁受火映照
    const heat = smoothstep(0.15, 1, S.T);
    if (heat > 0.01) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(fireRgb(S.T), 0.35 * heat); g.lineWidth = 12;
      g.beginPath(); g.moveTo(-200, -60); g.lineTo(-200, -125); g.ellipse(0, -125, 200, 165, 0, Math.PI, TAU); g.lineTo(200, -40); g.stroke();
      g.restore();
    }
    // 火门外的光
    const spill = clamp(S.F * 0.9 + S.T * 0.3, 0, 1) * (1 - S.sealK);
    if (spill > 0.01) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const sg = g.createRadialGradient(-384, 0, 5, -384, 0, 170);
      sg.addColorStop(0, rgba(fireRgb(S.T + 0.1), 0.55 * spill)); sg.addColorStop(1, rgba(fireRgb(S.T), 0));
      g.fillStyle = sg; g.fillRect(-560, -170, 350, 260);
      g.restore();
    }
    // 封窑：火门泥封、烟囱盖石
    if (S.sealK > 0) {
      g.save(); g.globalAlpha = S.sealK;
      g.fillStyle = '#5c4430'; g.strokeStyle = '#24160c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-392, 40); g.lineTo(-392, -24); g.quadraticCurveTo(-392, -56, -360, -56); g.lineTo(-366, -56); g.lineTo(-366, 40); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(30,18,10,.5)'; g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-390, 30 - i * 15); g.lineTo(-368, 26 - i * 15); g.stroke(); }
      g.restore();
    }
    if (S.capK > 0) {
      const off = (1 - easeOutCubic(S.capK)) * 80;
      g.fillStyle = '#6d6a66'; g.strokeStyle = '#26221e'; g.lineWidth = 2.5;
      rr(g, 372 + off, -506, 60, 14, 3); g.fill(); g.stroke();
    }
    // 窨水池里的水
    if (S.q && S.q.water > 0) {
      g.fillStyle = `rgba(90,140,180,${0.55 * S.q.water})`;
      g.beginPath(); g.ellipse(POND.x, POND.y, 70 * (0.6 + 0.4 * S.q.water), 7, 0, 0, TAU); g.fill();
      g.strokeStyle = `rgba(210,235,255,${0.5 * S.q.water})`; g.lineWidth = 1.5;
      const rip = (S.t * 0.8) % 1;
      g.beginPath(); g.ellipse(POND.x, POND.y, 20 + rip * 50, 2 + rip * 5, 0, 0, TAU); g.stroke();
    }
    // 木桶（浇水时倾倒）
    {
      const pa = S.pourAnim;
      const tilt = pa < 0 ? 0 : pa < 0.25 ? easeOutCubic(pa / 0.25) * 1.25 : pa < 0.75 ? 1.25 : 1.25 * (1 - easeOutCubic((pa - 0.75) / 0.25));
      const lift = pa < 0 ? 0 : Math.sin(clamp(pa, 0, 1) * Math.PI) * 18;
      g.save(); g.translate(0, -lift);
      drawTub(g, tilt);
      g.restore();
      if (pa >= 0.18 && pa < 0.8) { // 水流
        const k = clamp((pa - 0.18) / 0.1, 0, 1) * clamp((0.8 - pa) / 0.1, 0, 1);
        g.strokeStyle = `rgba(120,170,215,${0.85 * k})`; g.lineWidth = 9; g.lineCap = 'round';
        g.beginPath(); g.moveTo(TUB.x + 26, TUB.y - 16 - lift); g.quadraticCurveTo(TUB.x + 70, TUB.y - 30 - lift, POND.x - 20, POND.y - 2); g.stroke();
        g.strokeStyle = `rgba(230,245,255,${0.6 * k})`; g.lineWidth = 3;
        g.beginPath(); g.moveTo(TUB.x + 26, TUB.y - 18 - lift); g.quadraticCurveTo(TUB.x + 70, TUB.y - 32 - lift, POND.x - 20, POND.y - 4); g.stroke();
      }
    }
    g.restore();
  }

  function drawGauge() {
    const x = L.gx; const y = L.gy; const w = L.gw; const h = L.gh;
    const yOf = (t) => y + h - t * h;
    g.save();
    // 外框
    rr(g, x - 5, y - 16, w + 10, h + 32, 10);
    g.fillStyle = 'rgba(30,24,20,.72)'; g.fill();
    g.strokeStyle = 'rgba(232,207,148,.55)'; g.lineWidth = 1.5; g.stroke();
    // 色带
    const gr = g.createLinearGradient(0, y + h, 0, y);
    for (const [t, c] of FIRE) gr.addColorStop(t, c);
    rr(g, x, y, w, h, 6); g.fillStyle = gr; g.fill();
    // 金框之外压暗，过热区画斜纹
    const inFire = S.phase === 'fire' || S.phase === 'trans';
    if (inFire) {
      const y0 = yOf(S.bandHi); const y1 = yOf(S.bandLo);
      const dz = yOf(clamp(S.bandHi + TOL, 0, 1));
      g.save(); rr(g, x, y, w, h, 6); g.clip();
      g.fillStyle = 'rgba(14,9,7,.5)';
      g.fillRect(x, y, w, y0 - y);
      g.fillRect(x, y1, w, y + h - y1);
      g.beginPath(); g.rect(x, y, w, Math.max(0, dz - y)); g.clip();
      g.strokeStyle = 'rgba(255,86,64,.6)'; g.lineWidth = 1.6;
      for (let yy = y - w; yy < dz + w; yy += 9) { g.beginPath(); g.moveTo(x, yy + w); g.lineTo(x + w, yy); g.stroke(); }
      g.restore();
      const inBand = S.T >= S.bandLo && S.T <= S.bandHi;
      const pulse = inBand ? 0.5 + 0.5 * Math.sin(S.t * 8) : 0;
      g.fillStyle = `rgba(255,248,220,${0.12 + pulse * 0.14})`; g.fillRect(x, y0, w, y1 - y0);
      g.strokeStyle = inBand ? '#ffe7a0' : '#e2bb62'; g.lineWidth = 4;
      g.shadowColor = 'rgba(255,205,110,.95)'; g.shadowBlur = inBand ? 12 + pulse * 10 : 5;
      rr(g, x - 7, y0 - 2, w + 14, y1 - y0 + 4, 4); g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = inBand ? '#ffe7a0' : '#e2bb62';
      for (const yy of [y0 - 2, y1 + 2]) { g.beginPath(); g.moveTo(x - 15, yy); g.lineTo(x - 7, yy - 5); g.lineTo(x - 7, yy + 5); g.closePath(); g.fill(); }
    }
    // 刻度与火色名
    g.font = fBody(clamp(w * 0.3, 11, 14)); g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const [t, name] of LABELS) {
      const yy = yOf(t);
      g.strokeStyle = 'rgba(255,245,225,.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + w - 7, yy); g.lineTo(x + w, yy); g.stroke();
      if (!L.portrait) { g.fillStyle = 'rgba(250,236,210,.85)'; g.fillText(name, x - 12, yy); }
    }
    // 当前火色指针
    const ty = yOf(S.T);
    g.fillStyle = '#fbf3e2'; g.strokeStyle = '#1d1b18'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + w + 16, ty - 9); g.lineTo(x + w + 3, ty); g.lineTo(x + w + 16, ty + 9); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(29,27,24,.9)'; g.fillRect(x - 2, ty - 1.5, w + 4, 3);
    g.fillStyle = rgba(fireRgb(S.T)); g.strokeStyle = '#fbf3e2'; g.lineWidth = 2;
    g.beginPath(); g.arc(x + w / 2, ty, Math.min(9, w * 0.26), 0, TAU); g.fill(); g.stroke();
    // 标题
    g.font = fBrush(clamp(w * 0.42, 14, 20)); g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillStyle = '#e8cf94'; g.fillText('火色', x + w / 2, y - 18);
    g.restore();
  }

  function drawHeader() {
    const W = L.W;
    const tw = clamp(W * 0.085, 58, 92); const th = 28;
    const step = tw * 1.18;
    const cx = W / 2 - (L.portrait ? 0 : 0);
    const y = L.headY;
    const cur = S.ruined ? S.pi : S.phase === 'fire' || S.phase === 'trans' ? S.pi : S.phase === 'done' ? 4 : 3;
    g.save();
    g.font = fBrush(clamp(tw * 0.3, 15, 21)); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * step;
      if (i < 3) {
        g.strokeStyle = i < cur ? 'rgba(131,184,165,.9)' : 'rgba(232,207,148,.35)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + tw / 2, y + th / 2); g.lineTo(x + step - tw / 2, y + th / 2); g.stroke();
      }
      rr(g, x - tw / 2, y, tw, th, th / 2);
      g.fillStyle = i < cur ? '#3f7f6f' : i === cur ? '#b23a2e' : 'rgba(30,24,20,.6)'; g.fill();
      g.strokeStyle = i === cur ? '#e8cf94' : 'rgba(232,207,148,.45)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = i <= cur ? '#fbf3e2' : 'rgba(251,243,226,.55)';
      g.fillText(i < cur ? `${TAB_NAMES[i]}✓` : TAB_NAMES[i], x, y + th / 2 + 1);
    }
    // 本阶段进度
    if (S.phase === 'fire' || S.phase === 'trans') {
      const P = PHASES[S.pi];
      const bw = step * 3 + tw; const bx = cx - bw / 2; const by = y + th + 9;
      const k = S.phase === 'trans' ? 0 : clamp(S.prog / P.need, 0, 1);
      rr(g, bx, by, bw, 8, 4); g.fillStyle = 'rgba(20,16,12,.65)'; g.fill();
      g.strokeStyle = 'rgba(232,207,148,.4)'; g.lineWidth = 1; g.stroke();
      if (k > 0) { rr(g, bx, by, bw * k, 8, 4); g.fillStyle = S.T >= S.bandLo && S.T <= S.bandHi ? '#83b8a5' : '#5f8a7c'; g.fill(); }
      // 一炷香（本阶段时限）
      const left = S.phase === 'trans' ? 1 : clamp(1 - S.phaseTime / P.limit, 0, 1);
      const ix = bx + bw + 16; const len = 34;
      g.strokeStyle = 'rgba(160,120,70,.9)'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ix, by + 8); g.lineTo(ix + len * left, by + 8 - len * left * 0.02); g.stroke();
      g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(ix + len * left, by + 8, 2.4, 0, TAU); g.fill();
      if (left < 0.3 && S.phase === 'fire') { g.fillStyle = `rgba(255,120,60,${0.4 + 0.4 * Math.sin(S.t * 10)})`; g.beginPath(); g.arc(ix + len * left, by + 8, 5, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(200,200,200,.35)';
      g.beginPath(); g.arc(ix + len * left + Math.sin(S.t * 2) * 2, by + 1, 1.6, 0, TAU); g.fill();
    }
    g.restore();
  }

  function drawPulse() {
    const q = S.q;
    if (!q || q.state === 'done') return;
    const [cx, cy] = K(PULSE.x, PULSE.y);
    const Rt = Math.max(30, PULSE.r * L.s);
    g.save();
    // 连线
    const [px, py] = K(POND.x, POND.y);
    g.strokeStyle = 'rgba(232,207,148,.35)'; g.setLineDash([3, 4]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx, cy + Rt * 1.3); g.lineTo(px, py - 4); g.stroke(); g.setLineDash([]);
    // 底盘
    g.fillStyle = 'rgba(20,24,34,.55)'; g.beginPath(); g.arc(cx, cy, Rt * 1.32, 0, TAU); g.fill();
    const r = pulseR();
    const err = Math.abs(r - 1);
    const near = q.state === 'wait' && err < q.tolG;
    // 金圈
    g.strokeStyle = near ? '#ffe08a' : '#c8a15a'; g.lineWidth = near ? 5 : 3.5;
    g.shadowColor = 'rgba(255,215,120,.9)'; g.shadowBlur = near ? 14 : 0;
    g.beginPath(); g.arc(cx, cy, Rt, 0, TAU); g.stroke();
    g.shadowBlur = 0;
    // 水圈
    const rr2 = Rt * r;
    const wg = g.createRadialGradient(cx, cy, rr2 * 0.2, cx, cy, rr2);
    wg.addColorStop(0, 'rgba(140,190,230,.15)'); wg.addColorStop(1, 'rgba(140,190,230,.45)');
    g.fillStyle = wg; g.beginPath(); g.arc(cx, cy, rr2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(200,232,255,.95)'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, rr2, 0, TAU); g.stroke();
    // 中间字
    g.font = fBrush(Rt * 0.62); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e8f3ff'; g.fillText('浇', cx, cy + 2);
    // 三次浇水的记录
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 16; const y = cy + Rt * 1.32 + 12;
      const res = q.res[i];
      g.fillStyle = res === 'perfect' ? '#e8cf94' : res === 'good' ? '#83b8a5' : res === 'miss' ? '#b23a2e' : 'rgba(255,255,255,.25)';
      g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
    }
    g.restore();
  }

  function drawWind() {
    if (S.windK <= 0.01) return;
    g.save();
    g.strokeStyle = `rgba(240,236,226,${0.28 * S.windK})`; g.lineWidth = 1.5; g.lineCap = 'round';
    for (const w of S.winds) {
      g.beginPath(); g.moveTo(w.x, w.y); g.quadraticCurveTo(w.x + w.l * 0.5, w.y - 6, w.x + w.l, w.y + 2); g.stroke();
    }
    g.restore();
  }

  function draw() {
    const W = L.W; const H = L.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(shake.x, shake.y);
    g.drawImage(back, -3, -3, W + 6, H + 6);
    drawWind();
    drawChamber();
    g.drawImage(front, 0, 0, W, H);
    drawOverlays();
    parts.draw(g);
    g.restore();
    drawGauge();
    drawHeader();
    drawPulse();
  }

  // ---------------------------------------------------------------- 输入
  function press(src) {
    if (S.phase === 'quench') { pour(); return; }
    held.add(src);
  }
  function release(src) { held.delete(src); }
  cv.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { cv.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    press(`p${e.pointerId}`);
  });
  const up = (e) => release(`p${e.pointerId}`);
  cv.canvas.addEventListener('pointerup', up);
  cv.canvas.addEventListener('pointercancel', up);
  cv.canvas.addEventListener('lostpointercapture', up);
  cv.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  keymap(ctx, {
    Space: () => { if (S.phase === 'quench') { btn.flash(); pour(); } else held.add('key'); },
    ArrowUp: () => { if (S.phase === 'quench') { btn.flash(); pour(); } else held.add('key'); },
    Enter: () => { if (S.phase === 'quench') { btn.flash(); pour(); } },
  });

  // ---------------------------------------------------------------- 逻辑
  const tut = { on: opts.tutorial ?? (ctx.attempt === 1 || easy), h: null, step: 0 };
  function tutHint(html, x, y, place, ms) {
    if (!tut.on) return;
    if (tut.h) tut.h.close();
    tut.h = hint(ctx, html, { x, y, place, ms });
  }

  function startPhase(i) {
    S.pi = i; S.phase = 'trans'; S.phaseT = 0; S.prog = 0; S.phaseTime = 0; S.inBandFor = 0;
    const P = PHASES[i];
    banner(ctx, P.name, P.sub, { dark: true, ms: 1800, top: '36%' });
    ctx.sfx(i === 0 ? 'drum' : 'gong');
    speak(P.say, { dur: 4, prio: 3 });
  }

  function phaseDone() {
    const P = PHASES[S.pi];
    ctx.sfx('chime');
    ctx.toast(S.quality >= 95 ? '好火候！' : `${P.name}已成`, 'gold');
    for (let i = 0; i < 18; i++) {
      const [x, y] = K(-40 + (Math.random() - 0.5) * 300, -150 + (Math.random() - 0.5) * 160);
      parts.add({ shape: 'glow', x, y, vy: -20 - Math.random() * 30, life: 0.9, size: 6, size1: 1, color: '#ffd98a', blend: 'lighter', alpha: 0.9 });
    }
    next();
  }
  function phaseTimeout() {
    const P = PHASES[S.pi];
    const miss = 1 - clamp(S.prog / P.need, 0, 1);
    const pen = Math.round(24 * miss);
    S.quality = Math.max(0, S.quality - pen);
    ctx.sfx('bad');
    ctx.toast('火候欠了', 'bad');
    speak(`一炷香烧完了，${P.name}的火候还欠些……只好将就。`, { prio: 3, warn: true });
    next();
  }
  function next() {
    if (S.pi < 2) startPhase(S.pi + 1);
    else startSeal();
  }

  function startSeal() {
    S.phase = 'seal'; S.phaseT = 0;
    held.clear();
    speak('火候到了——封窑！把火门和烟囱都封死，准备窨水。', { dur: 3.4, prio: 3 });
    ctx.sfx('door');
    btn.setOff(true);
  }

  function startQuench() {
    S.phase = 'quench'; S.phaseT = 0;
    const periods = easy ? [1.7, 1.55, 1.4] : [1.3, 1.12, 0.96];
    S.q = { i: 0, t: 0, state: 'wait', res: [], periods, period: periods[0], water: 0, tolP: easy ? 0.1 : 0.065, tolG: easy ? 0.24 : 0.15, showT: 0 };
    S.quenched = true;
    btn.setOff(false);
    btn.classList.remove('gold'); btn.classList.add('water');
    btn.setText('浇水');
    const ic = btn.querySelector('.liba-btn-ic'); if (ic) ic.innerHTML = ICON_WATER;
    speak('从窑顶洇水——水圈与金圈一合，就浇！', { dur: 3.4, prio: 3 });
    if (tut.on) {
      const [cx, cy] = K(PULSE.x, PULSE.y);
      tutHint('水圈与<b>金圈</b>重合时，点按浇水', cx, cy - Math.max(30, PULSE.r * L.s) * 1.4, 'above', 4200);
    }
  }

  function pulseR() {
    const q = S.q;
    const u = 0.5 - 0.5 * Math.cos((q.t / q.period) * TAU);
    return 0.35 + 0.9 * u;
  }

  function pour(auto = false) {
    const q = S.q;
    if (!q || q.state !== 'wait') return;
    const err = auto ? 1 : Math.abs(pulseR() - 1);
    const res = err < q.tolP ? 'perfect' : err < q.tolG ? 'good' : 'miss';
    q.res.push(res);
    q.state = 'pour'; q.showT = 0;
    S.pourAnim = 0;
    if (tut.h) { tut.h.close(); tut.h = null; }
    const [cx, cy] = K(PULSE.x, PULSE.y);
    const label = res === 'perfect' ? '妙！' : res === 'good' ? '好' : '偏了';
    parts.add({ shape: 'text', text: label, font: fBrush(clamp(34 * L.s * 1.6, 22, 40)), x: cx, y: cy - Math.max(30, PULSE.r * L.s) * 1.6, vy: -24, life: 1.2, hold: 0.6, size: 0.85, size1: 1.1, color: res === 'miss' ? '#ff9c8a' : res === 'perfect' ? '#ffe08a' : '#bfe3d4', stroke: 'rgba(20,20,30,.85)', lw: 5 });
    ctx.sfx(res === 'perfect' ? 'perfect' : res === 'good' ? 'good' : 'bad');
    ctx.sfx('water');
    if (res === 'good') S.quality = Math.max(0, S.quality - 4);
    if (res === 'miss') {
      S.quality = Math.max(0, S.quality - 12);
      speak(auto ? '水等凉了！' : pulseR() < 1 ? '哎，浇早了！' : '浇晚了！', { prio: 2, warn: true });
    } else if (res === 'perfect') speak('好水！', { prio: 2, dur: 1.6 });
    const amt = res === 'perfect' ? 0.34 : res === 'good' ? 0.28 : 0.12;
    for (const b of ware) {
      const k = res === 'miss' ? 0.3 + R() * 1.1 : 0.9 + R() * 0.2;
      b.blue = clamp(b.blue + amt * k, 0, 1);
    }
  }

  function crackEvent() {
    const cands = ware.filter((b) => !b.crack);
    if (!cands.length) return;
    const b = cands[Math.floor(R() * cands.length)];
    b.crack = 1;
    S.cracks++;
    ctx.sfx('crack');
    shake.add(4);
    ctx.toast('裂了！', 'bad');
    const [x, y] = K(b.x + b.w / 2, b.y + b.h / 2);
    for (let i = 0; i < 10; i++) parts.add({ shape: 'shard', x, y, vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 100, ay: 420, vr: (Math.random() - 0.5) * 12, life: 0.8, size: 4 + Math.random() * 3, color: '#b56a46' });
    parts.add({ shape: 'ring', x, y, size: 4, size1: 40, life: 0.4, color: '#ffcf8a', lw: 3 });
    speak(S.pi === 0 ? '急火炸坯！预热要慢！' : '坏了，砖坯烧裂了！火小些！', { prio: 2, warn: true, key: 'crack', cd: 2.5 });
  }

  function spawnFx(dt) {
    // 添柴：木柴飞进火门
    if (S.feeding) {
      S.logT -= dt;
      if (S.logT <= 0) {
        S.logT = 0.34;
        const [x0, y0] = K(-520, -60); const [x1, y1] = K(-380, 0);
        const dur = 0.45;
        parts.add({
          shape: 'fn', x: x0, y: y0, vx: (x1 - x0) / dur, vy: (y1 - y0) / dur - 220 * L.s * 1.6, ay: 2 * 220 * L.s * 1.6 / dur, vr: 9, life: dur, size: L.s,
          draw: (gg, p) => { gg.translate(p.x, p.y); gg.rotate(p.rot); gg.fillStyle = '#6b4526'; gg.strokeStyle = '#2e1b0e'; gg.lineWidth = 1.5; rr(gg, -22 * p.size, -6 * p.size, 44 * p.size, 12 * p.size, 5 * p.size); gg.fill(); gg.stroke(); },
        });
        setTimeout(() => {
          if (ctx.signal.aborted) return;
          const [sx, sy] = K(-372, -10);
          for (let i = 0; i < 8; i++) parts.add({ shape: 'spark', x: sx, y: sy, vx: -40 - Math.random() * 160, vy: -60 - Math.random() * 160, ay: 160, drag: 1.2, life: 0.6 + Math.random() * 0.5, size: 2.2, color: '#ffb54a', blend: 'lighter' });
        }, dur * 1000);
      }
      S.fireSfxT -= dt;
      if (S.fireSfxT <= 0) { S.fireSfxT = 0.75; ctx.sfx('fire'); }
    } else { S.logT = 0; S.fireSfxT = 0; }
    // 烟囱冒烟
    S.smokeT -= dt;
    const smoking = S.capK < 0.5;
    if (smoking && S.smokeT <= 0) {
      S.smokeT = 0.12;
      const [x, y] = K(402, -500);
      const dark = Math.round(clamp(S.feedT * 0.6, 0, 0.8) * 5) / 5;
      const col = mixRgb('#9a948c', '#2b2825', dark).map((v) => v | 0);
      const wind = 18 + S.windK * 120;
      parts.add({ shape: 'glow', x: x + (Math.random() - 0.5) * 8, y, vx: wind * (0.6 + Math.random() * 0.6), vy: -40 - Math.random() * 20, drag: 0.3, life: 3.2, size: 8 * Math.max(0.6, L.s * 1.4), size1: 34 * Math.max(0.6, L.s * 1.4), color: col, alpha: 0.32 + dark * 0.2, fadeIn: 0.3 });
    }
    // 火星
    S.sparkT -= dt;
    if (S.sparkT <= 0 && S.T > 0.25 && smoking) {
      S.sparkT = 0.35 / (0.3 + S.T);
      const [x, y] = K(402, -496);
      parts.add({ shape: 'spark', x, y, vx: (Math.random() - 0.3) * 50 + S.windK * 80, vy: -70 - Math.random() * 80, ay: 30, drag: 0.8, life: 1 + Math.random(), size: 1.8, color: '#ffb54a', blend: 'lighter' });
    }
  }

  function steamBurst() {
    const pts = [[POND.x, POND.y], [-160, -300], [150, -305], [-300, -150], [290, -160], [402, -505], [-372, -20]];
    for (let i = 0; i < 46; i++) {
      const [lx, ly] = pts[i % pts.length];
      const [x, y] = K(lx + (Math.random() - 0.5) * 60, ly + (Math.random() - 0.5) * 20);
      parts.add({ shape: 'glow', x, y, vx: (Math.random() - 0.5) * 60, vy: -50 - Math.random() * 60, drag: 0.6, life: 1.6 + Math.random(), size: 10 * Math.max(0.6, L.s * 1.5), size1: 46 * Math.max(0.6, L.s * 1.5), color: '#f4f1ea', alpha: 0.55, fadeIn: 0.15, delay: Math.random() * 0.4 });
    }
    // 渗水
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.1 + Math.random() * 1.2);
      const [x, y] = K(Math.cos(a) * 240, -125 + Math.sin(a) * 205);
      parts.add({ shape: 'spark', x, y, vx: Math.cos(a + Math.PI / 2 * side) * 10, vy: 60 + Math.random() * 40, life: 0.7, size: 2, color: '#8fc4ee', alpha: 0.9, delay: Math.random() * 0.3 });
    }
    ctx.sfx('steam');
    shake.add(2);
  }

  function updateQuench(dt) {
    const q = S.q;
    q.t += dt;
    if (q.state === 'wait') {
      if (q.t > 9) { pour(true); }
    } else if (q.state === 'pour') {
      q.showT += dt;
      if (q.showT > 0.45 && !q.steamed) { q.steamed = true; q.water = Math.min(1, q.water + 0.4); steamBurst(); S.T = Math.max(0.1, S.T - 0.12); }
      if (q.showT > 1.9) {
        q.steamed = false;
        q.i++;
        if (q.i >= 3) { finishQuench(); return; }
        q.state = 'wait'; q.t = 0; q.period = q.periods[q.i];
      }
    }
  }

  function finishQuench() {
    S.q.state = 'done';
    S.phase = 'done'; S.phaseT = 0;
    btn.setOff(true);
    const avg = ware.reduce((s, b) => s + b.blue, 0) / ware.length;
    const q = Math.round(S.quality);
    ctx.sfx('sparkle');
    banner(ctx, '出窑', `砖品 ${q}`, { dark: true, ms: 2200, top: '34%' });
    if (avg > 0.88 && q >= 90) speak('青了，青了！这一窑，青灰匀净，好砖！', { prio: 4, dur: 4 });
    else if (q >= PASS) speak('颜色还算匀，能用。', { prio: 4, dur: 4 });
    else speak('唉……这窑砖怕是用不得了。', { prio: 4, dur: 4, warn: true });
  }

  function finish() {
    if (S.result) return;
    const score = Math.round(clamp(S.quality, 0, 100));
    const success = score >= PASS;
    const perfect = score >= 95;
    let note;
    if (perfect) note = '一窑好砖，青灰匀净！封窑窨水，砖里的铁质在缺氧中还原，红砖便成了青砖。';
    else if (success) note = '砖出窑了。窨水封窑、隔绝空气，砖色由红转青——城墙用的正是这种青砖。';
    else if (S.ruined) note = '火太急，砖坯全裂了。添柴要一下一下地添，火有余势，快到金框就松手。';
    else note = `砖品 ${score}，不足 ${PASS}。火色要稳在金框里、别烧过头；窨水要看准水圈与金圈重合的一刻。`;
    S.result = { success, score, perfect, note, scoreText: `砖品 ${score}` };
    S.done(S.result);
  }

  function physics(dt) {
    const firing = S.phase === 'fire' || S.phase === 'trans';
    if (!ctx.keys.isDown('Space') && !ctx.keys.isDown('ArrowUp')) held.delete('key');
    S.feeding = firing && held.size > 0;
    if (S.feeding && !S.firstFeed) { S.firstFeed = true; if (tut.step === 1 && tut.h) { tut.h.close(); tut.h = null; } }
    btn.classList.toggle('hot', S.feeding);
    S.feedT = S.feeding ? Math.min(1.5, S.feedT + dt) : Math.max(0, S.feedT - dt * 0.7);
    if (firing) S.F += ((S.feeding ? 1.3 : 0) - 1.3 * S.F) * dt;
    else S.F = Math.max(0, S.F - dt * 0.9);
    S.F = clamp(S.F, 0, 1);
    const Teq = 0.05 + 0.97 * S.F;
    let dT = (Teq - S.T) * (easy ? 0.62 : 0.8);
    if (!firing) dT = (S.phase === 'quench' || S.phase === 'done' ? -0.03 : -0.02);
    // 风
    const G = S.gust;
    if (G.t < G.dur) {
      G.t += dt;
      const k = Math.sin(Math.PI * clamp(G.t / G.dur, 0, 1));
      dT -= G.str * k;
      S.windK = k;
    } else S.windK = Math.max(0, S.windK - dt);
    S.noise += ((R() * 2 - 1) - S.noise) * Math.min(1, dt * 1.3);
    if (firing) dT += S.noise * (easy ? 0.018 : 0.04);
    S.T = clamp(S.T + dT * dt, 0.03, 1);
    if (S.T > 0.4) S.fired = Math.min(1, S.fired + dt * 0.06 * S.T);
    // 风的安排
    if (S.phase === 'fire' && S.pi >= 1) {
      S.nextGust -= dt;
      if (S.nextGust <= 0) {
        S.nextGust = (easy ? 11 : 7) + R() * 5;
        S.gust = { t: 0, dur: 2.2 + R() * 1.2, str: easy ? 0.04 + R() * 0.02 : 0.07 + R() * 0.04 };
        ctx.sfx('whoosh');
        speak('起风了，看着火！', { prio: 2, key: 'wind', cd: 5 });
        S.winds = [];
        for (let i = 0; i < 9; i++) S.winds.push({ x: -200 - R() * L.W * 0.5, y: 30 + R() * (L.oy - 60), l: 60 + R() * 140, v: 400 + R() * 300 });
      }
    }
    for (const w of S.winds) { w.x += w.v * dt; if (w.x > L.W + 50) w.x = -w.l - R() * 200; }
  }

  function scoring(dt) {
    const P = PHASES[S.pi];
    const inBand = S.T >= S.bandLo && S.T <= S.bandHi;
    S.phaseTime += dt;
    if (inBand) {
      S.prog += dt; S.inBandFor += dt;
      if (!S.firstBand) {
        S.firstBand = true;
        if (tut.on && S.pi === 0) tutHint('火色在<b>金框</b>里，进度才会涨', L.gx - 8, L.gy + L.gh * (1 - (S.bandLo + S.bandHi) / 2), 'above', 3600);
      }
    } else { S.prog = Math.max(0, S.prog - dt * 0.35); S.inBandFor = 0; }
    if (S.T < S.bandLo - 0.04) S.lowFor += dt; else S.lowFor = 0;
    if (S.T > S.bandHi) S.highFor += dt; else S.highFor = 0;
    if (S.lowFor > 2.2) speak('火小了，添柴！', { key: 'low', cd: 5 });
    if (S.highFor > 0.5) speak('火太旺了，歇一歇！', { key: 'high', cd: 4, warn: true });
    if (S.inBandFor > 2.5) speak('稳住……', { key: 'steady', cd: 7, dur: 1.8 });
    if (S.inBandFor > 5.5) speak('好火候！', { key: 'good', cd: 9, dur: 1.8 });
    const over = S.T - (S.bandHi + TOL);
    if (over > 0) {
      const rate = Math.min(S.pi === 0 ? 20 : 16, over * (S.pi === 0 ? 140 : 105)) * (easy ? 0.6 : 1);
      const dmg = rate * dt;
      S.quality = Math.max(0, S.quality - dmg);
      S.crackAcc += dmg;
      if (S.crackAcc >= 4) { S.crackAcc -= 4; crackEvent(); }
    }
    if (S.quality <= 0) { ruined(); return; }
    if (S.prog >= P.need) phaseDone();
    else if (S.phaseTime >= P.limit) phaseTimeout();
  }

  function ruined() {
    S.phase = 'done'; S.phaseT = -0.6; S.ruined = true;
    held.clear();
    btn.setOff(true);
    ctx.sfx('shatter');
    shake.add(8);
    banner(ctx, '砖坯尽裂', '这一窑烧坏了', { dark: true, ms: 2200, top: '34%' });
    speak('火太急了……这一窑，全裂了。', { prio: 5, dur: 4, warn: true });
  }

  let hudKey = '';
  function updHud() {
    const q = Math.round(S.quality);
    let center;
    if (S.phase === 'fire' || S.phase === 'trans') center = `${PHASES[S.pi].name} · <b>${Math.round(clamp(S.prog / PHASES[S.pi].need, 0, 1) * 100)}</b>%`;
    else if (S.phase === 'seal') center = '封窑';
    else if (S.phase === 'quench') center = `窨水 · 第 <b>${Math.min(3, S.q.i + 1)}</b> / 3 桶`;
    else center = '出窑';
    const key = `${center}|${q}`;
    if (key === hudKey) return;
    hudKey = key;
    ctx.hud({
      center: `<span class="liba-hud">${center}</span>`,
      right: `<span class="liba-hud">砖品 <b class="${q >= PASS ? '' : 'bad'}">${q}</b></span>`,
    });
  }

  function update(dt) {
    if (S.freeze || hostPaused(ctx)) dt = 0; // 宿主「暂且离开？」确认框打开时，时间停住
    S.t += dt; S.phaseT += dt;
    if (Math.abs(ctx.w - L.W) > 0.5 || Math.abs(ctx.h - L.H) > 0.5) layout();
    parts.update(dt);
    shake.update(dt);
    if (sayTimer > 0) { sayTimer -= dt; if (sayTimer <= 0) say.classList.remove('show'); }
    physics(dt);
    // 金框平移到本阶段
    if (S.phase === 'fire' || S.phase === 'trans') {
      const P = PHASES[S.pi];
      const k = Math.min(1, dt * 3);
      S.bandLo = lerp(S.bandLo, P.lo - WIDEN, k); S.bandHi = lerp(S.bandHi, P.hi + WIDEN, k);
    }
    switch (S.phase) {
      case 'trans':
        if (S.phaseT > 1.9) {
          S.phase = 'fire'; S.phaseT = 0;
          if (S.pi === 0 && tut.on && tut.step === 0) {
            tut.step = 1;
            tutHint('<b>按住</b>添柴，火势渐旺；<b>松开</b>，火势渐弱', L.btnX + L.btnW / 2, L.btnY - 4, 'above', 6000);
          }
        }
        break;
      case 'fire':
        scoring(dt);
        break;
      case 'seal':
        S.sealK = clamp((S.phaseT - 0.2) / 0.6, 0, 1);
        S.capK = clamp((S.phaseT - 0.9) / 0.6, 0, 1);
        if (S.phaseT > 0.9 && !S.capSfx) { S.capSfx = true; ctx.sfx('stamp'); }
        if (S.phaseT > 1.6 && !S.qBanner) { S.qBanner = true; banner(ctx, '窨水', '窑顶洇水 · 砖色转青', { dark: true, ms: 1800, top: '34%' }); ctx.sfx('water'); }
        if (S.phaseT > 3.1) startQuench();
        break;
      case 'quench':
        updateQuench(dt);
        break;
      case 'done':
        if (S.phaseT > 2.8) finish();
        break;
      default:
    }
    if (S.pourAnim >= 0) { S.pourAnim += dt / 0.9; if (S.pourAnim > 1) S.pourAnim = -1; }
    for (const b of ware) b.blueShow += (b.blue - b.blueShow) * Math.min(1, dt * 1.6);
    spawnFx(dt);
    updHud();
  }

  // ---------------------------------------------------------------- 启动
  layout();
  ctx.onResize(() => { layout(); draw(); });
  startPhase(0);
  updHud();
  devHandle('__kiln', { S, L, ware, press, release, pour });
  ctx.loop((dt) => { update(dt); draw(); });
  return untilDone(ctx, (done) => { S.done = done; });
}
