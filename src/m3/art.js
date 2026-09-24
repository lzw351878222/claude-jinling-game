// 消消乐美术（二）：特效棋子、障碍、底层标记、缓存
import { FONT, lin, rad, gloss, softShadow, ink, twinkle, PAINT_TILE, PAINT_ITEM, ITEM_NAMES } from './art-tiles.js';

export const TILE_COLORS = ['#e2493a', '#e8b93a', '#3fae7c', '#3a6fc4', '#ef7fa6', '#8e5a86'];
export const TILE_NAMES = ['灯笼', '通宝', '玉佩', '青花', '梅花', '紫砂'];
export { ITEM_NAMES };

// ------------------------------------------------------------------ 特效覆盖
/** 笔：一道横或竖的墨色笔触，两端金色箭头 */
function brushOverlay(g, S, horizontal) {
  g.save();
  g.translate(S / 2, S / 2);
  if (!horizontal) g.rotate(Math.PI / 2);
  g.fillStyle = 'rgba(24,18,14,0.8)';
  g.beginPath();
  g.moveTo(-S * 0.47, -S * 0.07); g.bezierCurveTo(-S * 0.2, -S * 0.11, S * 0.2, -S * 0.06, S * 0.47, -S * 0.09);
  g.lineTo(S * 0.45, S * 0.08); g.bezierCurveTo(S * 0.2, S * 0.1, -S * 0.2, S * 0.06, -S * 0.46, S * 0.09);
  g.closePath(); g.fill();
  g.fillStyle = lin(g, -S * 0.5, 0, S * 0.5, 0, [[0, 'rgba(255,230,150,0)'], [0.5, 'rgba(255,244,200,0.95)'], [1, 'rgba(255,230,150,0)']]);
  g.fillRect(-S * 0.46, -S * 0.02, S * 0.92, S * 0.04);
  g.fillStyle = '#ffe9a8'; g.strokeStyle = '#3a1d12'; g.lineWidth = S * 0.02;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * S * 0.48, 0); g.lineTo(s * S * 0.36, -S * 0.09); g.lineTo(s * S * 0.36, S * 0.09); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
}
/** 烟花：金色光晕 + 一圈五彩花瓣 */
function burstOverlay(g, S) {
  g.save();
  const cx = S / 2, cy = S / 2;
  g.fillStyle = rad(g, cx, cy, S * 0.2, S * 0.5, [[0, 'rgba(255,230,140,0)'], [0.7, 'rgba(255,214,110,0.55)'], [1, 'rgba(255,214,110,0)']]);
  g.fillRect(0, 0, S, S);
  const cols = ['#ff6a5a', '#ffd24a', '#6ad0a0', '#6aa0ff', '#ff9ad0', '#c890ff'];
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    const px = cx + Math.cos(a) * S * 0.42, py = cy + Math.sin(a) * S * 0.42;
    g.save(); g.translate(px, py); g.rotate(a);
    g.beginPath(); g.ellipse(0, 0, S * 0.07, S * 0.035, 0, 0, Math.PI * 2);
    g.fillStyle = cols[k % cols.length]; g.fill();
    g.lineWidth = S * 0.012; g.strokeStyle = 'rgba(60,30,10,0.6)'; g.stroke();
    g.restore();
  }
  twinkle(g, cx + S * 0.34, cy - S * 0.36, S * 0.07, '#fff6c8');
  twinkle(g, cx - S * 0.38, cy + S * 0.3, S * 0.05, '#fff6c8');
  g.restore();
}
/** 宝印：金印 + 蹲兽钮 + 朱文"宝" */
function paintSeal(g, S) {
  softShadow(g, S, 0.9, 0.3);
  const cx = S / 2;
  const x = S * 0.18, y = S * 0.46, w = S * 0.64, h = S * 0.38;
  g.beginPath(); g.roundRect(x, y, w, h, S * 0.05);
  g.fillStyle = lin(g, x, y, x, y + h, [[0, '#f7e7a6'], [0.5, '#d9a52a'], [1, '#8a5a10']]); g.fill(); ink(g, S * 0.035, '#4a2a06');
  g.beginPath(); g.moveTo(x + w * 0.15, y);
  g.bezierCurveTo(x + w * 0.1, y - S * 0.2, x + w * 0.35, y - S * 0.34, cx, y - S * 0.32);
  g.bezierCurveTo(x + w * 0.65, y - S * 0.34, x + w * 0.9, y - S * 0.2, x + w * 0.85, y); g.closePath();
  g.fillStyle = rad(g, cx, y - S * 0.2, S * 0.02, S * 0.3, [[0, '#fff3c0'], [0.6, '#e8b93a'], [1, '#9a6a12']], cx - S * 0.08, y - S * 0.26); g.fill(); ink(g, S * 0.03, '#4a2a06');
  g.fillStyle = '#4a2a06';
  g.beginPath(); g.arc(cx - S * 0.07, y - S * 0.17, S * 0.022, 0, Math.PI * 2); g.arc(cx + S * 0.07, y - S * 0.17, S * 0.022, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c0281e'; g.beginPath(); g.roundRect(x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.64, S * 0.02); g.fill();
  g.fillStyle = '#fff3e0'; g.font = `${S * 0.2}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('宝', cx, y + h * 0.52);
  gloss(g, cx - S * 0.1, y - S * 0.22, S * 0.1, S * 0.05, 0.7);
}

// ------------------------------------------------------------------ 障碍
function paintRubble(g, S, hp) {
  softShadow(g, S, 0.9, 0.38);
  const pieces = [[0.3, 0.64, 0.24, 0.14, -0.2], [0.68, 0.66, 0.24, 0.13, 0.25], [0.5, 0.46, 0.26, 0.14, 0.08], [0.33, 0.33, 0.16, 0.1, -0.4], [0.7, 0.36, 0.15, 0.1, 0.5]];
  const n = hp >= 3 ? 5 : hp === 2 ? 4 : 3;
  for (let k = 0; k < n; k++) {
    const [x, y, w, h, r] = pieces[k];
    g.save(); g.translate(S * x, S * y); g.rotate(r);
    g.beginPath(); g.roundRect(-S * w / 2, -S * h / 2, S * w, S * h, S * 0.02);
    g.fillStyle = lin(g, 0, -S * h / 2, 0, S * h / 2, [[0, '#bcc3c7'], [1, '#6d767a']]); g.fill(); ink(g, S * 0.025, '#2a3034');
    g.restore();
  }
  if (hp > 1) {
    g.font = `bold ${S * 0.2}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = S * 0.05; g.strokeStyle = '#2a3034'; g.strokeText(String(hp), S * 0.84, S * 0.18);
    g.fillStyle = '#fff'; g.fillText(String(hp), S * 0.84, S * 0.18);
  }
}
function paintWorm(g, S, frame = 0) {
  // 蠹：卷曲在一片残纸上的银色小虫
  softShadow(g, S, 0.88, 0.34);
  g.save();
  g.translate(S / 2, S / 2);
  g.rotate(-0.2);
  g.beginPath(); g.moveTo(-S * 0.36, -S * 0.3); g.lineTo(S * 0.3, -S * 0.36); g.lineTo(S * 0.38, S * 0.2); g.lineTo(S * 0.1, S * 0.36); g.lineTo(-S * 0.34, S * 0.3); g.closePath();
  g.fillStyle = '#e9dfc4'; g.fill(); ink(g, S * 0.02, '#8a7a5a');
  g.strokeStyle = 'rgba(40,30,20,0.35)'; g.lineWidth = S * 0.012;
  for (const y of [-0.18, -0.06, 0.06, 0.18]) { g.beginPath(); g.moveTo(-S * 0.25, S * y); g.lineTo(S * 0.18, S * y - S * 0.02); g.stroke(); }
  g.restore();
  const wig = Math.sin(frame * 1.7) * S * 0.015;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = S * (0.7 - t * 0.44), y = S * (0.48 + Math.sin(t * 3 + frame) * 0.04) + wig;
    const r = S * (0.1 - t * 0.055);
    g.beginPath(); g.ellipse(x, y, r * 1.25, r, 0, 0, Math.PI * 2);
    g.fillStyle = i % 2 ? '#c9ced6' : '#aeb5bf'; g.fill(); ink(g, S * 0.018, '#4a5058');
  }
  g.strokeStyle = '#6a717b'; g.lineWidth = S * 0.018;
  g.beginPath(); g.moveTo(S * 0.78, S * 0.44); g.quadraticCurveTo(S * 0.9, S * 0.3, S * 0.95, S * 0.26); g.stroke();
  g.beginPath(); g.moveTo(S * 0.78, S * 0.5); g.quadraticCurveTo(S * 0.92, S * 0.56, S * 0.96, S * 0.66); g.stroke();
  for (const dy of [-0.08, 0, 0.08]) { g.beginPath(); g.moveTo(S * 0.28, S * 0.5); g.lineTo(S * 0.08, S * (0.5 + dy * 1.6)); g.stroke(); }
  g.fillStyle = '#2a1d2a'; g.beginPath(); g.arc(S * 0.77, S * 0.45, S * 0.02, 0, Math.PI * 2); g.fill();
}
function paintRope(g, S, n) {
  g.save();
  const draw = (x0, y0, x1, y1) => {
    g.lineCap = 'round';
    g.lineWidth = S * 0.1; g.strokeStyle = '#5a4020'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.lineWidth = S * 0.07; g.strokeStyle = '#c9a060'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.lineWidth = S * 0.015; g.strokeStyle = '#8a6a3a';
    const n2 = 7;
    for (let k = 1; k < n2; k++) { const t = k / n2; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; g.beginPath(); g.moveTo(x - S * 0.025, y - S * 0.025); g.lineTo(x + S * 0.025, y + S * 0.025); g.stroke(); }
  };
  draw(S * 0.06, S * 0.08, S * 0.94, S * 0.92);
  if (n >= 2) draw(S * 0.94, S * 0.08, S * 0.06, S * 0.92);
  g.fillStyle = '#b08040'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.07, 0, Math.PI * 2); g.fill(); ink(g, S * 0.015, '#5a4020');
  g.restore();
}
/** 底层：墨渍（1 层淡、2 层浓） */
function paintInk(g, S, n) {
  g.save();
  g.fillStyle = n >= 2 ? 'rgba(20,20,28,0.72)' : 'rgba(30,30,40,0.42)';
  g.beginPath();
  const pts = 14;
  for (let k = 0; k <= pts; k++) {
    const a = k / pts * Math.PI * 2;
    const r = S * (0.42 + ((k * 37) % 7) / 7 * 0.08);
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    if (k === 0) g.moveTo(x, y); else g.quadraticCurveTo(S / 2 + Math.cos(a - 0.2) * r * 1.08, S / 2 + Math.sin(a - 0.2) * r * 1.08, x, y);
  }
  g.fill();
  g.fillStyle = n >= 2 ? 'rgba(10,10,16,0.5)' : 'rgba(20,20,30,0.25)';
  for (const [x, y, r] of [[0.12, 0.2, 0.05], [0.86, 0.78, 0.06], [0.84, 0.14, 0.035]]) { g.beginPath(); g.arc(S * x, S * y, S * r, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
/** 底层：长明灯（未点亮/已点亮） */
function paintLamp(g, S, lit) {
  g.save();
  if (lit) {
    g.fillStyle = rad(g, S / 2, S / 2, 0, S * 0.55, [[0, 'rgba(255,214,120,0.85)'], [0.6, 'rgba(255,170,80,0.35)'], [1, 'rgba(255,170,80,0)']]);
    g.fillRect(0, 0, S, S);
  }
  const cx = S / 2, cy = S * 0.62;
  g.globalAlpha = lit ? 0.9 : 0.55;
  g.beginPath(); g.ellipse(cx, cy, S * 0.26, S * 0.09, 0, 0, Math.PI * 2); g.fillStyle = lit ? '#d9a52a' : '#8a8478'; g.fill();
  g.beginPath(); g.moveTo(cx - S * 0.26, cy); g.quadraticCurveTo(cx, cy + S * 0.25, cx + S * 0.26, cy); g.fillStyle = lit ? '#b8861f' : '#6a655c'; g.fill();
  if (lit) {
    g.beginPath(); g.moveTo(cx, cy - S * 0.34); g.quadraticCurveTo(cx + S * 0.1, cy - S * 0.12, cx, cy - S * 0.04); g.quadraticCurveTo(cx - S * 0.1, cy - S * 0.12, cx, cy - S * 0.34);
    g.fillStyle = '#fff2b0'; g.fill();
  } else {
    g.strokeStyle = '#6a655c'; g.lineWidth = S * 0.02; g.beginPath(); g.moveTo(cx, cy - S * 0.04); g.lineTo(cx, cy - S * 0.14); g.stroke();
  }
  g.restore();
}

// ------------------------------------------------------------------ 缓存与对外接口
const cache = new Map();
function sprite(key, S, paint) {
  const k = key + '@' + S;
  let c = cache.get(k);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = Math.max(8, Math.round(S));
  const g = c.getContext('2d');
  paint(g, c.width);
  cache.set(k, c);
  return c;
}
export function clearArtCache() { cache.clear(); }

/** 棋子贴图：{ color, kind, item } */
export function tileSprite(t, S) {
  if (t.kind === 'item') return sprite('item-' + t.item, S, (g, s) => (PAINT_ITEM[t.item] || PAINT_ITEM.brick)(g, s));
  if (t.kind === 'seal') return sprite('seal', S, paintSeal);
  const base = (g, s) => PAINT_TILE[t.color](g, s);
  if (t.kind === 'lineH' || t.kind === 'lineV') {
    return sprite(`${t.kind}-${t.color}`, S, (g, s) => { base(g, s); brushOverlay(g, s, t.kind === 'lineH'); });
  }
  if (t.kind === 'burst') {
    return sprite(`burst-${t.color}`, S, (g, s) => {
      burstOverlay(g, s);
      g.save(); g.translate(s * 0.12, s * 0.12); g.scale(0.76, 0.76); base(g, s); g.restore();
    });
  }
  return sprite('t' + t.color, S, base);
}
export const rubbleSprite = (hp, S) => sprite('rubble' + hp, S, (g, s) => paintRubble(g, s, hp));
export const wormSprite = (frame, S) => sprite('worm' + (frame % 4), S, (g, s) => paintWorm(g, s, frame % 4));
export const ropeSprite = (n, S) => sprite('rope' + n, S, (g, s) => paintRope(g, s, n));
export const inkSprite = (n, S) => sprite('ink' + n, S, (g, s) => paintInk(g, s, n));
export const lampSprite = (lit, S) => sprite('lamp' + (lit ? 1 : 0), S, (g, s) => paintLamp(g, s, lit));

/** 目标面板用的小图标 */
export function goalIcon(goal, S) {
  switch (goal.type) {
    case 'color': return tileSprite({ color: goal.color, kind: 'normal' }, S);
    case 'item': return tileSprite({ kind: 'item', item: goal.item }, S);
    case 'ink': return inkSprite(2, S);
    case 'rope': return ropeSprite(1, S);
    case 'rubble': return rubbleSprite(1, S);
    case 'worm': return wormSprite(0, S);
    case 'lamp': return lampSprite(true, S);
    case 'boss': return wormSprite(1, S);
    default: return tileSprite({ kind: 'seal' }, S);
  }
}
export function goalName(goal) {
  switch (goal.type) {
    case 'color': return TILE_NAMES[goal.color];
    case 'item': return ITEM_NAMES[goal.item] || '物件';
    case 'ink': return '墨渍';
    case 'rope': return '绳索';
    case 'rubble': return '碎砖';
    case 'worm': return '蠹';
    case 'lamp': return '长明灯';
    case 'score': return '得分';
    case 'boss': return '遗忘之蠹';
    default: return '';
  }
}