// 消消乐棋子美术（一）：六种"记忆碎片"与下落物件，Canvas2D 矢量绘制
export const FONT = '"JLBrush", "STXingkai", "KaiTi", serif';

export function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
export function rad(g, x, y, r0, r1, stops, fx, fy) { const gr = g.createRadialGradient(fx ?? x, fy ?? y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
export function gloss(g, x, y, rx, ry, a = 0.55) {
  g.save();
  g.fillStyle = lin(g, x, y - ry, x, y + ry, [[0, `rgba(255,255,255,${a})`], [1, 'rgba(255,255,255,0)']]);
  g.beginPath(); g.ellipse(x, y, rx, ry, -0.25, 0, Math.PI * 2); g.fill();
  g.restore();
}
export function softShadow(g, S, y = 0.86, w = 0.3) {
  g.save();
  g.fillStyle = 'rgba(40,24,10,0.26)';
  g.beginPath(); g.ellipse(S / 2, S * y, S * w, S * 0.055, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}
export function ink(g, lw, col = '#3a1d12') { g.lineWidth = lw; g.strokeStyle = col; g.stroke(); }
export function twinkle(g, x, y, r, col = '#fff') {
  g.save(); g.fillStyle = col;
  g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.25, y - r * 0.25); g.lineTo(x + r, y); g.lineTo(x + r * 0.25, y + r * 0.25);
  g.lineTo(x, y + r); g.lineTo(x - r * 0.25, y + r * 0.25); g.lineTo(x - r, y); g.lineTo(x - r * 0.25, y - r * 0.25); g.closePath(); g.fill();
  g.restore();
}
function label(g, text, x, y, size, col) {
  g.fillStyle = col; g.font = `${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

// 0 灯笼 ------------------------------------------------------------
function lantern(g, S) {
  softShadow(g, S, 0.9, 0.24);
  const cx = S / 2, cy = S * 0.52, rx = S * 0.31, ry = S * 0.29;
  g.strokeStyle = '#6b4a2a'; g.lineWidth = S * 0.025;
  g.beginPath(); g.moveTo(cx, S * 0.08); g.lineTo(cx, S * 0.2); g.stroke();
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx, cy, S * 0.02, rx * 1.1, [[0, '#ffc09a'], [0.35, '#ff5a3c'], [1, '#b8201a']], cx - rx * 0.3, cy - ry * 0.35);
  g.fill(); ink(g, S * 0.035);
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
  g.strokeStyle = 'rgba(120,20,10,0.5)'; g.lineWidth = S * 0.02;
  for (const k of [0.25, 0.62]) { g.beginPath(); g.ellipse(cx, cy, rx * k, ry, 0, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  for (const [yy, h] of [[cy - ry - S * 0.02, S * 0.1], [cy + ry - S * 0.08, S * 0.1]]) {
    g.beginPath(); g.roundRect(cx - rx * 0.62, yy, rx * 1.24, h, S * 0.03);
    g.fillStyle = lin(g, 0, yy, 0, yy + h, [[0, '#ffe08a'], [1, '#b8861f']]); g.fill(); ink(g, S * 0.025);
  }
  g.strokeStyle = '#e8b83a'; g.lineWidth = S * 0.02;
  for (const dx of [-0.04, 0, 0.04]) { g.beginPath(); g.moveTo(cx + dx * S, cy + ry + S * 0.03); g.lineTo(cx + dx * S * 1.4, S * 0.95); g.stroke(); }
  gloss(g, cx - rx * 0.35, cy - ry * 0.45, rx * 0.35, ry * 0.2, 0.6);
  label(g, '福', cx, cy + S * 0.02, S * 0.22, 'rgba(255,232,170,0.92)');
}

// 1 洪武通宝（钱文按"上下右左"排列） ---------------------------------
function coin(g, S) {
  softShadow(g, S, 0.88, 0.28);
  const cx = S / 2, cy = S * 0.5, r = S * 0.37;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx, cy, S * 0.02, r, [[0, '#fff0a8'], [0.5, '#f0c043'], [1, '#b07d18']], cx - r * 0.35, cy - r * 0.4);
  g.fill(); ink(g, S * 0.035, '#5a3a0a');
  g.beginPath(); g.arc(cx, cy, r * 0.84, 0, Math.PI * 2); g.lineWidth = S * 0.02; g.strokeStyle = 'rgba(120,80,10,0.6)'; g.stroke();
  const h = r * 0.34;
  g.beginPath(); g.rect(cx - h, cy - h, h * 2, h * 2);
  g.fillStyle = '#6b4a12'; g.fill(); ink(g, S * 0.025, '#4a300a');
  const col = '#7a4e0c', fs = S * 0.16;
  label(g, '洪', cx, cy - r * 0.6, fs, col); label(g, '武', cx, cy + r * 0.62, fs, col);
  label(g, '通', cx + r * 0.6, cy + S * 0.005, fs, col); label(g, '宝', cx - r * 0.6, cy + S * 0.005, fs, col);
  gloss(g, cx - r * 0.35, cy - r * 0.5, r * 0.35, r * 0.16, 0.65);
}

// 2 玉佩（玉牌 + 红绳） ---------------------------------------------
function jade(g, S) {
  softShadow(g, S, 0.9, 0.24);
  const cx = S / 2;
  g.strokeStyle = '#c0281e'; g.lineWidth = S * 0.03;
  g.beginPath(); g.moveTo(cx, S * 0.04); g.lineTo(cx, S * 0.2); g.stroke();
  g.fillStyle = '#d8342a'; g.beginPath(); g.arc(cx, S * 0.13, S * 0.045, 0, Math.PI * 2); g.fill();
  const x = S * 0.25, y = S * 0.2, w = S * 0.5, h = S * 0.62;
  g.beginPath(); g.roundRect(x, y, w, h, S * 0.12);
  g.fillStyle = lin(g, x, y, x + w, y + h, [[0, '#b8f0d4'], [0.35, '#5cc896'], [1, '#1d7a50']]);
  g.fill(); ink(g, S * 0.035, '#12402c');
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, S * 0.12); g.clip();
  g.strokeStyle = 'rgba(230,255,240,0.55)'; g.lineWidth = S * 0.025;
  g.beginPath(); g.arc(S * 0.44, S * 0.44, S * 0.08, Math.PI, Math.PI * 2.5); g.stroke();
  g.beginPath(); g.arc(S * 0.56, S * 0.64, S * 0.08, 0, Math.PI * 1.5); g.stroke();
  g.restore();
  g.beginPath(); g.arc(cx, y + S * 0.08, S * 0.035, 0, Math.PI * 2); g.fillStyle = '#12402c'; g.fill();
  gloss(g, x + w * 0.3, y + h * 0.18, w * 0.22, h * 0.1, 0.6);
  g.strokeStyle = '#d8342a'; g.lineWidth = S * 0.02;
  for (const dx of [-0.03, 0.03]) { g.beginPath(); g.moveTo(cx + dx * S, y + h); g.lineTo(cx + dx * S * 1.6, S * 0.97); g.stroke(); }
}

// 3 青花梅瓶 --------------------------------------------------------
function vase(g, S) {
  softShadow(g, S, 0.92, 0.22);
  const cx = S / 2;
  const path = () => {
    g.beginPath();
    g.moveTo(cx - S * 0.07, S * 0.1); g.lineTo(cx + S * 0.07, S * 0.1); g.lineTo(cx + S * 0.06, S * 0.17);
    g.bezierCurveTo(cx + S * 0.36, S * 0.2, cx + S * 0.32, S * 0.52, cx + S * 0.2, S * 0.74);
    g.lineTo(cx + S * 0.16, S * 0.9); g.lineTo(cx - S * 0.16, S * 0.9); g.lineTo(cx - S * 0.2, S * 0.74);
    g.bezierCurveTo(cx - S * 0.32, S * 0.52, cx - S * 0.36, S * 0.2, cx - S * 0.06, S * 0.17);
    g.closePath();
  };
  path();
  g.fillStyle = rad(g, cx - S * 0.08, S * 0.38, S * 0.02, S * 0.42, [[0, '#ffffff'], [0.6, '#eef2f6'], [1, '#c9d2dc']]);
  g.fill(); ink(g, S * 0.032, '#1b2e55');
  g.save(); path(); g.clip();
  g.strokeStyle = '#2a4f9e'; g.fillStyle = '#2a4f9e'; g.lineWidth = S * 0.028;
  g.beginPath(); g.moveTo(cx - S * 0.3, S * 0.27); g.lineTo(cx + S * 0.3, S * 0.27); g.stroke();
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.arc(cx + k * S * 0.07, S * 0.27, S * 0.03, 0, Math.PI); g.stroke(); }
  g.lineWidth = S * 0.024;
  g.beginPath(); g.moveTo(cx - S * 0.28, S * 0.52); g.bezierCurveTo(cx - S * 0.15, S * 0.4, cx - S * 0.05, S * 0.64, cx + S * 0.08, S * 0.5);
  g.bezierCurveTo(cx + S * 0.18, S * 0.4, cx + S * 0.24, S * 0.58, cx + S * 0.3, S * 0.5); g.stroke();
  for (const [px, py] of [[-0.12, 0.47], [0.13, 0.46]]) {
    g.fillStyle = '#2a4f9e'; g.beginPath(); g.ellipse(cx + S * px, S * py, S * 0.05, S * 0.035, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#eef2f6'; g.beginPath(); g.arc(cx + S * px, S * py, S * 0.015, 0, Math.PI * 2); g.fill();
  }
  g.lineWidth = S * 0.03; g.beginPath(); g.moveTo(cx - S * 0.25, S * 0.76); g.lineTo(cx + S * 0.25, S * 0.76); g.stroke();
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx + k * S * 0.07, S * 0.78); g.lineTo(cx + k * S * 0.07 + S * 0.02, S * 0.88); g.stroke(); }
  g.restore();
  gloss(g, cx - S * 0.12, S * 0.36, S * 0.06, S * 0.12, 0.7);
}

// 4 梅花 ------------------------------------------------------------
function plum(g, S) {
  softShadow(g, S, 0.86, 0.26);
  const cx = S / 2, cy = S * 0.49;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * (Math.PI * 2 / 5);
    const px = cx + Math.cos(a) * S * 0.19, py = cy + Math.sin(a) * S * 0.19;
    g.beginPath(); g.arc(px, py, S * 0.165, 0, Math.PI * 2);
    g.fillStyle = rad(g, px, py, S * 0.01, S * 0.17, [[0, '#fff0f4'], [0.45, '#ffb3c8'], [1, '#e0507c']], cx, cy);
    g.fill(); ink(g, S * 0.03, '#7a1e3c');
  }
  g.beginPath(); g.arc(cx, cy, S * 0.1, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx, cy, 0, S * 0.1, [[0, '#fff6c0'], [1, '#f0a0b8']]); g.fill();
  g.strokeStyle = '#b8861f'; g.lineWidth = S * 0.018;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * S * 0.09, cy + Math.sin(a) * S * 0.09); g.stroke();
    g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(cx + Math.cos(a) * S * 0.095, cy + Math.sin(a) * S * 0.095, S * 0.018, 0, Math.PI * 2); g.fill();
  }
  gloss(g, cx - S * 0.18, cy - S * 0.25, S * 0.08, S * 0.04, 0.6);
}

// 5 紫砂壶 ----------------------------------------------------------
function teapot(g, S) {
  softShadow(g, S, 0.88, 0.3);
  const cx = S / 2, cy = S * 0.56;
  const body = rad(g, cx, cy, S * 0.02, S * 0.34, [[0, '#c98ab8'], [0.45, '#8e5a86'], [1, '#4e2a4a']], cx - S * 0.1, cy - S * 0.12);
  g.beginPath(); g.moveTo(cx - S * 0.22, cy - S * 0.02); g.quadraticCurveTo(cx - S * 0.38, cy - S * 0.06, cx - S * 0.42, cy - S * 0.2);
  g.lineTo(cx - S * 0.35, cy - S * 0.2); g.quadraticCurveTo(cx - S * 0.32, cy - S * 0.02, cx - S * 0.2, cy + S * 0.08); g.closePath();
  g.fillStyle = body; g.fill(); ink(g, S * 0.03, '#2e1430');
  g.beginPath(); g.ellipse(cx + S * 0.3, cy - S * 0.01, S * 0.1, S * 0.13, 0, -Math.PI / 2, Math.PI / 2);
  g.lineWidth = S * 0.06; g.strokeStyle = '#2e1430'; g.stroke(); g.lineWidth = S * 0.035; g.strokeStyle = '#7a4a72'; g.stroke();
  g.beginPath(); g.ellipse(cx, cy, S * 0.29, S * 0.22, 0, 0, Math.PI * 2);
  g.fillStyle = body; g.fill(); ink(g, S * 0.035, '#2e1430');
  g.beginPath(); g.ellipse(cx, cy - S * 0.2, S * 0.15, S * 0.05, 0, 0, Math.PI * 2); g.fillStyle = '#7a4a72'; g.fill(); ink(g, S * 0.025, '#2e1430');
  g.beginPath(); g.arc(cx, cy - S * 0.26, S * 0.045, 0, Math.PI * 2); g.fillStyle = '#9a6a92'; g.fill(); ink(g, S * 0.025, '#2e1430');
  g.strokeStyle = 'rgba(40,10,40,0.45)'; g.lineWidth = S * 0.015;
  g.beginPath(); g.ellipse(cx, cy + S * 0.02, S * 0.25, S * 0.05, 0, 0, Math.PI); g.stroke();
  gloss(g, cx - S * 0.1, cy - S * 0.1, S * 0.1, S * 0.05, 0.55);
}

export const PAINT_TILE = [lantern, coin, jade, vase, plum, teapot];

// ------------------------------------------------------------------ 下落物件
export const PAINT_ITEM = {
  brick(g, S) { // 城砖：侧面刻着窑匠的名字
    softShadow(g, S, 0.86, 0.34);
    const p = (x, y) => [S * x, S * y];
    const face = (pts, col) => { g.beginPath(); g.moveTo(...p(...pts[0])); for (const q of pts.slice(1)) g.lineTo(...p(...q)); g.closePath(); g.fillStyle = col; g.fill(); ink(g, S * 0.03, '#2a3034'); };
    face([[0.12, 0.42], [0.62, 0.3], [0.9, 0.4], [0.4, 0.53]], '#a9b1b5');
    face([[0.12, 0.42], [0.4, 0.53], [0.4, 0.78], [0.12, 0.66]], '#6f777b');
    face([[0.4, 0.53], [0.9, 0.4], [0.9, 0.64], [0.4, 0.78]], '#8a9296');
    g.save(); g.translate(S * 0.65, S * 0.6); g.rotate(-0.25); label(g, '窑匠', 0, 0, S * 0.1, '#3a4246'); g.restore();
  },
  book(g, S) { // 《永乐大典》册
    softShadow(g, S, 0.88, 0.32);
    const x = S * 0.2, y = S * 0.14, w = S * 0.6, h = S * 0.7;
    g.fillStyle = '#efe4c8'; g.fillRect(x + S * 0.05, y + S * 0.04, w, h);
    g.beginPath(); g.rect(x, y, w, h); g.fillStyle = lin(g, x, y, x + w, y + h, [[0, '#d9b24a'], [1, '#9a7420']]); g.fill(); ink(g, S * 0.03, '#4a3408');
    g.fillStyle = '#f2ead4'; g.fillRect(x + w * 0.58, y + h * 0.08, w * 0.26, h * 0.6);
    g.strokeStyle = '#4a3408'; g.lineWidth = S * 0.012; g.strokeRect(x + w * 0.58, y + h * 0.08, w * 0.26, h * 0.6);
    label(g, '大', x + w * 0.71, y + h * 0.22, S * 0.1, '#2a2018'); label(g, '典', x + w * 0.71, y + h * 0.4, S * 0.1, '#2a2018');
    g.strokeStyle = '#efe4c8'; g.lineWidth = S * 0.012;
    for (const k of [0.2, 0.45, 0.7]) { g.beginPath(); g.moveTo(x + S * 0.02, y + h * k); g.lineTo(x + S * 0.09, y + h * k); g.stroke(); }
    gloss(g, x + w * 0.25, y + h * 0.18, w * 0.18, h * 0.06, 0.4);
  },
  silk(g, S) { // 丝绸一匹
    softShadow(g, S, 0.86, 0.32);
    g.save(); g.translate(S / 2, S / 2); g.rotate(-0.3);
    g.beginPath(); g.roundRect(-S * 0.34, -S * 0.2, S * 0.6, S * 0.4, S * 0.04);
    g.fillStyle = lin(g, 0, -S * 0.2, 0, S * 0.2, [[0, '#e05a4a'], [0.5, '#b8302a'], [1, '#7a1a14']]); g.fill(); ink(g, S * 0.03, '#3a0a08');
    g.strokeStyle = '#f2c14e'; g.lineWidth = S * 0.02;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(-S * 0.04 + k * S * 0.1, 0, S * 0.04, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.ellipse(S * 0.27, 0, S * 0.08, S * 0.2, 0, 0, Math.PI * 2); g.fillStyle = '#f09080'; g.fill(); ink(g, S * 0.03, '#3a0a08');
    g.beginPath(); g.ellipse(S * 0.27, 0, S * 0.03, S * 0.08, 0, 0, Math.PI * 2); g.fillStyle = '#7a1a14'; g.fill();
    g.restore();
  },
  glaze(g, S) { // 琉璃构件
    softShadow(g, S, 0.86, 0.3);
    const cx = S / 2;
    g.beginPath(); g.moveTo(cx, S * 0.12); g.lineTo(S * 0.84, S * 0.42); g.lineTo(S * 0.74, S * 0.84); g.lineTo(S * 0.26, S * 0.84); g.lineTo(S * 0.16, S * 0.42); g.closePath();
    g.fillStyle = lin(g, 0, S * 0.12, 0, S * 0.84, [[0, '#fbe27a'], [0.5, '#d9a52a'], [1, '#9a6a12']]); g.fill(); ink(g, S * 0.035, '#4a2a06');
    g.beginPath(); g.moveTo(cx, S * 0.26); g.lineTo(S * 0.7, S * 0.46); g.lineTo(S * 0.63, S * 0.74); g.lineTo(S * 0.37, S * 0.74); g.lineTo(S * 0.3, S * 0.46); g.closePath();
    g.fillStyle = lin(g, 0, S * 0.26, 0, S * 0.74, [[0, '#7fd6a8'], [1, '#1d7a50']]); g.fill(); ink(g, S * 0.02, '#12402c');
    label(g, '琉', cx, S * 0.55, S * 0.16, '#fff');
    gloss(g, cx - S * 0.12, S * 0.32, S * 0.1, S * 0.04, 0.7);
  },
  hehua(g, S) { // 荷花灯
    softShadow(g, S, 0.86, 0.3);
    const cx = S / 2, cy = S * 0.6;
    g.fillStyle = 'rgba(255,220,120,0.35)'; g.beginPath(); g.arc(cx, cy - S * 0.05, S * 0.32, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx, cy + S * 0.14, S * 0.34, S * 0.1, 0, 0, Math.PI * 2); g.fillStyle = '#3f8a5a'; g.fill(); ink(g, S * 0.025, '#123a22');
    for (let k = -3; k <= 3; k++) {
      g.save(); g.translate(cx, cy + S * 0.1); g.rotate(k * 0.36);
      g.beginPath(); g.ellipse(0, -S * 0.2, S * 0.08, S * 0.2, 0, 0, Math.PI * 2);
      g.fillStyle = lin(g, 0, -S * 0.4, 0, 0, [[0, '#fff0f4'], [1, '#e8709a']]); g.fill(); ink(g, S * 0.022, '#7a1e3c');
      g.restore();
    }
    g.beginPath(); g.arc(cx, cy - S * 0.02, S * 0.07, 0, Math.PI * 2); g.fillStyle = '#ffe07a'; g.fill();
  },
};
export const ITEM_NAMES = { brick: '城砖', book: '大典', silk: '丝绸', glaze: '琉璃构件', hehua: '荷花灯' };
