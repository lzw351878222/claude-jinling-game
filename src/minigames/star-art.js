// 牵星过洋 · 美术：海图（郑和航海图意趣）、宝船、罗盘、牵星夜空
import { rng } from '../core/util.js';
import { FONT_BRUSH, glow, roundRect, mix } from './lib-b.js';
import { LAND, ISLANDS, REEFS, LABELS, inPoly, clearance, DIR24 } from './star-data.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- 预计算：山、浪
function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; } return a / 2; }
const onBorder = (x, y) => y <= -2.3 || y >= 8.5 || x >= 2.15 || x <= -18.35;
export const PEAKS = (() => {
  const R = rng(1415);
  const out = [];
  for (const L of LAND) {
    const pts = L.pts;
    const sgn = polyArea(pts) > 0 ? 1 : -1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (onBorder(a[0], a[1]) && onBorder(b[0], b[1])) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.floor(len / 0.3));
      // 内法线
      const nx = -(b[1] - a[1]) / len * sgn, ny = (b[0] - a[0]) / len * sgn;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        for (const depth of [0.2, 0.46]) {
          if (depth > 0.3 && R() < 0.45) continue;
          const x = a[0] + (b[0] - a[0]) * f + nx * depth + (R() - 0.5) * 0.08;
          const y = a[1] + (b[1] - a[1]) * f + ny * depth + (R() - 0.5) * 0.08;
          if (!inPoly(x, y, pts)) continue;
          if (clearance(x, y) > -0.09) continue;
          out.push({ x, y, w: (0.2 + R() * 0.14) * (depth > 0.3 ? 1.3 : 1), h: (0.13 + R() * 0.1) * (depth > 0.3 ? 1.35 : 1), hue: R(), seed: R() });
        }
      }
    }
  }
  for (const c of ISLANDS) out.push({ x: c.x, y: c.y + c.r * 0.2, w: c.r * 1.9, h: c.r * 1.3, hue: 0.5, seed: 0.3, island: true });
  out.sort((p, q) => p.y - q.y);
  return out;
})();
export const WAVES = (() => {
  const R = rng(7);
  const out = [];
  for (let i = 0; i < 900 && out.length < 230; i++) {
    const x = -18.6 + R() * 21, y = -2.2 + R() * 10.6;
    if (clearance(x, y) < 0.22) continue;
    out.push({ x, y, s: 0.08 + R() * 0.06, p: R() * TAU });
  }
  return out;
})();

// ---------------------------------------------------------------- 海图静态层
export function paintChart(g, cam, w, h) {
  const { cx, cy, s } = cam;
  const X = (x) => (x - cx) * s + w / 2, Y = (y) => (y - cy) * s + h / 2;
  // 海（纸色 + 淡青）
  const sg = g.createLinearGradient(0, 0, 0, h);
  sg.addColorStop(0, '#e6e2cc'); sg.addColorStop(1, '#dcdcc6');
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  // 海水纹
  g.strokeStyle = 'rgba(70,110,108,.38)'; g.lineWidth = 1;
  for (const wv of WAVES) {
    const x = X(wv.x), y = Y(wv.y);
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    const r = Math.max(3, Math.min(10, wv.s * s));
    g.beginPath();
    for (let k = 0; k < 3; k++) { const rr = r * (1 - k * 0.3); g.moveTo(x - rr, y); g.arc(x, y, rr, Math.PI, TAU); }
    g.moveTo(x + r, y); g.arc(x + r * 2, y, r, Math.PI, TAU);
    g.stroke();
  }
  const path = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); };
  // 近岸浅水晕
  g.save();
  g.lineJoin = 'round';
  for (const L of LAND) { path(L.pts); g.strokeStyle = 'rgba(95,150,140,.26)'; g.lineWidth = Math.max(6, s * 0.22); g.stroke(); }
  for (const c of ISLANDS) { g.beginPath(); g.arc(X(c.x), Y(c.y), c.r * s + Math.max(3, s * 0.1), 0, TAU); g.fillStyle = 'rgba(95,150,140,.22)'; g.fill(); }
  g.restore();
  // 陆地
  for (const L of LAND) {
    path(L.pts);
    const lg = g.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, '#ead9ae'); lg.addColorStop(1, '#dcc592');
    g.fillStyle = lg; g.fill();
  }
  for (const c of ISLANDS) { g.beginPath(); g.arc(X(c.x), Y(c.y), Math.max(2.5, c.r * s), 0, TAU); g.fillStyle = '#e4d1a2'; g.fill(); }
  // 山（青绿）
  for (const p of PEAKS) {
    const x = X(p.x), y = Y(p.y);
    const pw = Math.max(5, p.w * s), ph = Math.max(4, p.h * s);
    if (x < -pw || y < -ph * 2 || x > w + pw || y > h + ph) continue;
    const top = p.hue < 0.5 ? '#6f9f86' : '#5b86a0';
    const gr = g.createLinearGradient(0, y - ph, 0, y);
    gr.addColorStop(0, top); gr.addColorStop(0.7, mix(top, '#e3cf9c', 0.55)); gr.addColorStop(1, '#e0cb96');
    g.beginPath();
    g.moveTo(x - pw / 2, y);
    g.quadraticCurveTo(x - pw * 0.22, y - ph * 0.55, x - pw * 0.06, y - ph);
    g.quadraticCurveTo(x + pw * 0.05, y - ph * 1.04, x + pw * 0.14, y - ph * 0.82);
    g.quadraticCurveTo(x + pw * 0.3, y - ph * 0.55, x + pw / 2, y);
    g.closePath();
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(40,34,26,.75)'; g.lineWidth = 0.9; g.stroke();
    if (pw > 9) {
      g.strokeStyle = 'rgba(40,50,40,.35)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x - pw * 0.05, y - ph * 0.85); g.quadraticCurveTo(x - pw * 0.1, y - ph * 0.4, x - pw * 0.2, y - ph * 0.1); g.stroke();
    }
  }
  // 海岸墨线
  g.save(); g.lineJoin = 'round';
  for (const L of LAND) {
    path(L.pts);
    g.strokeStyle = '#2c251c'; g.lineWidth = Math.max(1.2, Math.min(2.4, s * 0.03)); g.stroke();
  }
  for (const c of ISLANDS) { g.beginPath(); g.arc(X(c.x), Y(c.y), Math.max(2.5, c.r * s), 0, TAU); g.strokeStyle = '#2c251c'; g.lineWidth = 1.2; g.stroke(); }
  g.restore();
  // 礁石（石塘）
  for (const r of REEFS) {
    const x = X(r.x), y = Y(r.y), rr = r.r * s;
    const R = rng(Math.round(r.x * 100));
    g.save();
    g.fillStyle = 'rgba(140,110,70,.14)'; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.fillStyle = '#2c251c';
    const n = Math.max(6, Math.round(rr * rr / 18));
    for (let i = 0; i < Math.min(n, 60); i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * rr * 0.9;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (R() < 0.3) { g.fillRect(px - 2, py - 0.5, 4, 1); g.fillRect(px - 0.5, py - 2, 1, 4); } else { g.beginPath(); g.arc(px, py, 1 + R() * 0.8, 0, TAU); g.fill(); }
    }
    g.restore();
  }
  // 地名
  const fs = Math.max(11, Math.min(20, s * 0.26));
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const L of LABELS) {
    const x = X(L.x), y = Y(L.y);
    if (x < -60 || y < -30 || x > w + 60 || y > h + 30) continue;
    g.font = `${Math.round(L.small ? fs * 0.85 : fs)}px ${FONT_BRUSH}`;
    g.fillStyle = L.sea ? 'rgba(50,90,90,.55)' : 'rgba(40,32,22,.8)';
    if (L.sea) { [...L.t].forEach((ch, i) => g.fillText(ch, x + (i - (L.t.length - 1) / 2) * fs * 1.25, y)); } else g.fillText(L.t, x, y);
  }
  for (const c of [...ISLANDS, ...REEFS]) {
    if (!c.name || c.noLabel) continue;
    const x = X(c.x), y = Y(c.y);
    g.font = `${Math.round(fs * 0.8)}px ${FONT_BRUSH}`; g.fillStyle = 'rgba(40,32,22,.78)';
    g.fillText(c.name, x, y + Math.max(c.r * s, 3) + fs * 0.7);
  }
}

// ---------------------------------------------------------------- 蠹蛀的洞（隐去的海图）
export function paintEaten(g, x, y, r, t, a, seed = 3) {
  if (a <= 0.01) return;
  const R = rng(seed);
  const pts = [];
  const n = 26;
  for (let i = 0; i < n; i++) { const ang = i / n * TAU; const rr = r * (0.72 + R() * 0.38); pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.85]); }
  g.save();
  g.globalAlpha = a;
  const blob = (k) => {
    g.beginPath();
    pts.forEach(([px, py], i) => { const qx = x + (px - x) * k, qy = y + (py - y) * k; if (i) g.lineTo(qx, qy); else g.moveTo(qx, qy); });
    g.closePath();
  };
  blob(1.06); g.fillStyle = 'rgba(120,90,50,.35)'; g.fill();
  blob(1); g.fillStyle = '#4a3322'; g.fill();
  const hg = g.createRadialGradient(x, y, 0, x, y, r);
  hg.addColorStop(0, 'rgba(20,12,6,.6)'); hg.addColorStop(1, 'rgba(20,12,6,0)');
  g.fillStyle = hg; g.fill();
  g.strokeStyle = 'rgba(235,220,190,.8)'; g.lineWidth = 2; g.setLineDash([2, 3]); blob(1); g.stroke(); g.setLineDash([]);
  // 边上的小蛀孔
  for (let i = 0; i < 9; i++) {
    const ang = R() * TAU, d = r * (1.1 + R() * 0.35);
    g.beginPath(); g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.85, 2 + R() * 4, 0, TAU); g.fillStyle = '#4a3322'; g.fill();
  }
  // 问号
  g.font = `${Math.round(r * 0.55)}px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = `rgba(235,220,190,${0.35 + 0.15 * Math.sin(t * 2)})`; g.fillText('？', x, y);
  g.restore();
}

// ---------------------------------------------------------------- 宝船（侧视）
export function paintShip(g, x, y, size, facing, t, { night = 0, tilt = 0, alpha = 1 } = {}) {
  if (alpha <= 0.01) return;
  const s = size / 60;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(tilt + Math.sin(t * 2.2) * 0.04);
  g.scale(facing < 0 ? -s : s, s);
  // 水花/倒影
  g.fillStyle = 'rgba(40,70,70,.25)';
  g.beginPath(); g.ellipse(0, 9, 30, 4, 0, 0, TAU); g.fill();
  // 帆（后→前）
  const sail = (mx, top, bot, wdt, col) => {
    g.fillStyle = col; g.strokeStyle = '#3a1510'; g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(mx, top); g.quadraticCurveTo(mx + wdt * 0.7, top + 2, mx + wdt, top + 4);
    g.quadraticCurveTo(mx + wdt * 1.12, (top + bot) / 2, mx + wdt * 0.95, bot);
    g.lineTo(mx, bot); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(60,15,10,.55)'; g.lineWidth = 0.8;
    for (let k = 1; k < 5; k++) { const yy = top + (bot - top) * k / 5; g.beginPath(); g.moveTo(mx, yy); g.quadraticCurveTo(mx + wdt * 0.6, yy + 1.5, mx + wdt * 1.02, yy - 0.5); g.stroke(); }
  };
  // 桅
  g.strokeStyle = '#3a2412'; g.lineWidth = 2;
  for (const [mx, top] of [[-14, -38], [2, -46], [16, -34]]) { g.beginPath(); g.moveTo(mx, 2); g.lineTo(mx, top); g.stroke(); }
  sail(-14, -35, -6, 11, '#b8382c');
  sail(2, -43, -4, 13, '#c9442f');
  sail(16, -31, -6, 10, '#b8382c');
  // 旗
  const fw = Math.sin(t * 6) * 1.5;
  g.fillStyle = '#e8c35a'; g.beginPath(); g.moveTo(2, -46); g.lineTo(11, -44 + fw); g.lineTo(2, -41); g.closePath(); g.fill();
  // 船身
  g.fillStyle = '#4a2c18'; g.strokeStyle = '#1e120a'; g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(-30, -8); g.lineTo(-24, -6); g.lineTo(24, -6); g.lineTo(32, -12);
  g.quadraticCurveTo(30, 2, 20, 7); g.lineTo(-20, 7); g.quadraticCurveTo(-30, 2, -30, -8); g.closePath();
  g.fill(); g.stroke();
  // 艉楼
  g.fillStyle = '#5a3620'; g.fillRect(-30, -14, 12, 8); g.strokeRect(-30, -14, 12, 8);
  g.fillStyle = '#e8c35a'; g.fillRect(-28, -12, 3, 3); g.fillRect(-23, -12, 3, 3);
  // 朱漆腰线、船眼
  g.fillStyle = '#b8382c'; g.fillRect(-24, -4, 48, 2.5);
  g.fillStyle = '#f3ead0'; g.beginPath(); g.arc(24, -2, 2.2, 0, TAU); g.fill();
  g.fillStyle = '#1e120a'; g.beginPath(); g.arc(24.6, -2, 1.1, 0, TAU); g.fill();
  if (night > 0.05) {
    g.globalAlpha = alpha * night;
    glow(g, -24, -10, 16, 'rgba(255,190,90,.8)', 1);
  }
  g.restore();
}

// ---------------------------------------------------------------- 罗盘
export function paintCompass(g, cx, cy, R, angDeg, t, { hi = -1, target = -1, glowT = 0 } = {}) {
  // 盘身
  g.save();
  g.shadowColor = 'rgba(30,15,5,.45)'; g.shadowBlur = R * 0.12; g.shadowOffsetY = R * 0.04;
  const bg = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
  bg.addColorStop(0, '#7a4a2a'); bg.addColorStop(1, '#3e2414');
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.restore();
  g.strokeStyle = '#c8a15a'; g.lineWidth = Math.max(1.5, R * 0.025);
  g.beginPath(); g.arc(cx, cy, R * 0.97, 0, TAU); g.stroke();
  // 字圈
  const ig = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 0.93);
  ig.addColorStop(0, '#efe2c2'); ig.addColorStop(1, '#e2cfa2');
  g.fillStyle = ig; g.beginPath(); g.arc(cx, cy, R * 0.92, 0, TAU); g.arc(cx, cy, R * 0.6, 0, TAU, true); g.fill('evenodd');
  g.strokeStyle = '#6b4a24'; g.lineWidth = 1;
  g.beginPath(); g.arc(cx, cy, R * 0.92, 0, TAU); g.stroke();
  g.beginPath(); g.arc(cx, cy, R * 0.6, 0, TAU); g.stroke();
  g.beginPath(); g.arc(cx, cy, R * 0.69, 0, TAU); g.stroke();
  // 目标提示（简单模式）
  if (target >= 0) {
    const a = (target * 7.5 - 90) * Math.PI / 180;
    const k = 0.55 + 0.45 * Math.sin(t * 5);
    glow(g, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8, R * 0.2, 'rgba(255,200,80,.9)', k);
    g.strokeStyle = `rgba(230,160,40,${0.6 + 0.4 * k})`; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6); g.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92); g.stroke();
  }
  // 刻度
  for (let i = 0; i < 48; i++) {
    const a = (i * 7.5 - 90) * Math.PI / 180;
    const r0 = R * 0.6, r1 = i % 2 ? R * 0.645 : R * 0.69;
    g.strokeStyle = i % 2 ? 'rgba(80,50,20,.7)' : '#3b2410'; g.lineWidth = i % 2 ? 1 : 1.6;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
  }
  // 二十四向
  const fs = Math.max(10, R * 0.15);
  g.font = `${Math.round(fs)}px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) {
    const a = (i * 15 - 90) * Math.PI / 180;
    const x = cx + Math.cos(a) * R * 0.805, y = cy + Math.sin(a) * R * 0.805;
    const on = hi >= 0 && (hi === i * 2 || (hi % 2 === 1 && (i * 2 === hi - 1 || i * 2 === (hi + 1) % 48)));
    if (on) { g.fillStyle = 'rgba(232,190,90,.55)'; g.beginPath(); g.arc(x, y, fs * 0.66, 0, TAU); g.fill(); }
    g.fillStyle = i % 6 === 0 ? '#a8261c' : '#2a1a0c';
    g.fillText(DIR24[i], x, y + fs * 0.04);
  }
  // 水池
  const wg = g.createRadialGradient(cx - R * 0.12, cy - R * 0.14, R * 0.05, cx, cy, R * 0.58);
  wg.addColorStop(0, '#4f7f80'); wg.addColorStop(0.7, '#2a4d52'); wg.addColorStop(1, '#162a2e');
  g.fillStyle = wg; g.beginPath(); g.arc(cx, cy, R * 0.58, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(200,230,225,.18)'; g.lineWidth = 1;
  for (let k = 0; k < 3; k++) { const rr = R * (0.2 + ((t * 0.08 + k / 3) % 1) * 0.36); g.globalAlpha = 1 - rr / (R * 0.58); g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); }
  g.globalAlpha = 1;
  // 针
  const a = (angDeg - 90) * Math.PI / 180;
  const nx = Math.cos(a), ny = Math.sin(a), px = -ny, py = nx;
  const L1 = R * 0.56, L2 = R * 0.34, wd = R * 0.055;
  if (glowT > 0) glow(g, cx + nx * L1 * 0.8, cy + ny * L1 * 0.8, R * 0.25, 'rgba(255,190,90,.8)', glowT);
  g.save();
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
  g.fillStyle = '#d23a2a';
  g.beginPath(); g.moveTo(cx + nx * L1, cy + ny * L1); g.lineTo(cx + px * wd, cy + py * wd); g.lineTo(cx - px * wd, cy - py * wd); g.closePath(); g.fill();
  g.fillStyle = '#2d3238';
  g.beginPath(); g.moveTo(cx - nx * L2, cy - ny * L2); g.lineTo(cx + px * wd, cy + py * wd); g.lineTo(cx - px * wd, cy - py * wd); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.moveTo(cx + nx * L1, cy + ny * L1); g.lineTo(cx + px * wd * 0.5, cy + py * wd * 0.5); g.lineTo(cx, cy); g.closePath(); g.fill();
  const pg = g.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, R * 0.07);
  pg.addColorStop(0, '#fff3c4'); pg.addColorStop(1, '#a8761c');
  g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, R * 0.065, 0, TAU); g.fill();
}

// ---------------------------------------------------------------- 牵星夜空
const SKY_STARS = (() => { const R = rng(99); return Array.from({ length: 150 }, () => ({ x: R(), y: R(), r: R() < 0.9 ? 0.5 + R() * 0.8 : 1.2 + R() * 0.8, p: R() * TAU })); })();
export function paintSky(g, w, h, t, { alt, board, half, tol, sway = 0, aligned = false, speedK = 1 }) {
  const hy = h * 0.8;
  const sky = g.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#050914'); sky.addColorStop(0.65, '#101a34'); sky.addColorStop(1, '#27304f');
  g.fillStyle = sky; g.fillRect(0, 0, w, hy);
  const reading = board + (half ? 0.5 : 0);
  const range = Math.max(6.2, reading + 1.6, alt + 1.4);
  const ppz = (hy - 26) / range;
  // 星（随纬度整体升降）
  for (const s of SKY_STARS) {
    const x = s.x * w, y = s.y * hy * 1.4 - (alt - 4) * ppz * 0.6;
    if (y < 0 || y > hy - 4) continue;
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.p));
    g.fillStyle = `rgba(235,240,255,${a * 0.8})`; g.beginPath(); g.arc(x, y, s.r, 0, TAU); g.fill();
  }
  // 海
  const sea = g.createLinearGradient(0, hy, 0, h);
  sea.addColorStop(0, '#1b2440'); sea.addColorStop(1, '#070a14');
  g.fillStyle = sea; g.fillRect(0, hy, w, h - hy);
  g.strokeStyle = 'rgba(160,180,220,.18)'; g.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const yy = hy + 6 + i * i * 0.9, off = (t * 12 * (1 + i * 0.1) + i * 37) % 60;
    if (yy > h) break;
    g.beginPath();
    for (let x = -60 + off; x < w; x += 60) { g.moveTo(x, yy); g.quadraticCurveTo(x + 15, yy - 2, x + 30, yy); }
    g.stroke();
  }
  // 地平线
  g.strokeStyle = 'rgba(200,210,240,.55)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, hy); g.lineTo(w, hy); g.stroke();
  const bx = w * 0.5;
  const sy = hy - alt * ppz;
  // 牵星板（下沿贴着海平线）。高 = 指数 × 每指像素；竖屏窄舞台上板宽封顶，免得一块板把整个夜空盖住
  const side = board * ppz;
  const bw = Math.min(side, w * 0.56);
  const sw = Math.sin(t * 1.7) * sway;
  g.save();
  g.translate(bx, hy);
  g.rotate(sw * 0.01);
  const x0 = -bw / 2, y0 = -side;
  // 牵绳
  g.strokeStyle = 'rgba(210,190,150,.7)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, -side * 0.5); g.quadraticCurveTo(bw * 0.1, (h - hy) * 0.5, 0, h - hy + 4); g.stroke();
  const wg = g.createLinearGradient(x0, y0, x0 + bw, 0);
  wg.addColorStop(0, '#3a2a1e'); wg.addColorStop(0.5, '#23180f'); wg.addColorStop(1, '#161009');
  g.globalAlpha = 0.93;
  g.fillStyle = wg; g.fillRect(x0, y0, bw, side);
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,230,190,.12)'; g.lineWidth = 1;
  for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x0 + bw * k / 6, y0 + 2); g.quadraticCurveTo(x0 + bw * k / 6 + 3, y0 + side / 2, x0 + bw * k / 6 - 1, -2); g.stroke(); }
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.5; g.strokeRect(x0, y0, bw, side);
  // 标签
  const lab = `${['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][board]}指`;
  g.fillStyle = '#efe2c2'; const lw = Math.max(26, Math.min(bw * 0.8, 44)), lh = 16;
  if (bw > 30 && side > 24) { g.fillRect(x0 + 4, y0 + 4, lw, lh); g.fillStyle = '#2a1a0c'; g.font = `12px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, x0 + 4 + lw / 2, y0 + 4 + lh / 2 + 1); }
  // 象牙半指
  let topY = y0;
  if (half) {
    const hh = 0.5 * ppz, hw = Math.max(18, Math.min(bw * 0.6, 0.9 * ppz));
    g.fillStyle = '#f1e6cc'; g.strokeStyle = '#a58a5a'; g.lineWidth = 1;
    g.fillRect(-hw / 2, y0 - hh, hw, hh); g.strokeRect(-hw / 2, y0 - hh, hw, hh);
    topY = y0 - hh;
  }
  // 上沿
  g.strokeStyle = aligned ? '#ffd86a' : 'rgba(255,240,210,.8)';
  g.lineWidth = aligned ? 3 : 1.6;
  if (aligned) { g.shadowColor = 'rgba(255,200,80,.95)'; g.shadowBlur = 14; }
  g.beginPath(); g.moveTo(x0 - 8, topY); g.lineTo(-x0 + 8, topY); g.stroke();
  g.restore();
  // 北辰星：画在板之后。落到板上沿以下时（板举高了 / 星已低过读数）淡淡透出，让玩家始终知道它在哪
  const behind = sy > hy - reading * ppz + 3;
  const sa = behind ? 0.42 : 1;
  glow(g, bx, sy, 26, 'rgba(190,210,255,.8)', 0.9 * sa);
  g.save();
  g.globalAlpha = sa;
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx, sy, 2.6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(bx - 9, sy); g.lineTo(bx + 9, sy); g.moveTo(bx, sy - 9); g.lineTo(bx, sy + 9); g.stroke();
  g.font = `${Math.round(Math.max(13, w * 0.026))}px ${FONT_BRUSH}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(210,225,255,.9)'; g.fillText('北辰星', bx + 14, sy - 12);
  g.restore();
  // 刻度尺（左侧）
  g.font = `12px ${FONT_BRUSH}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(200,210,240,.62)';
  const CNZ = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四'];
  for (let z = 1; z <= Math.floor(range); z++) {
    const yy = hy - z * ppz;
    g.fillRect(8, yy, 7, 1);
    g.fillText(`${CNZ[z] || z}指`, 18, yy);
  }
  return { hy, ppz, topY: hy - reading * ppz, reading };
}
