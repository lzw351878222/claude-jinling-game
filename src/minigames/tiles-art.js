// 转瓦 · 美术：琉璃瓦上的缠枝莲藤蔓、拱门纹样（白象 / 飞羊 / 飞天）
const TAU = Math.PI * 2;
const lerpN = (a, b, t) => a + (b - a) * t;

const VINE = {
  off: { stem: '#c4dccd', edge: '#1f4337', leaf: '#8fc3a6', leafEdge: '#1f4337', petal: '#ece2d2', petalEdge: '#4e4034', core: '#b89a6a', glow: null },
  on: { stem: '#ffe089', edge: '#7a4508', leaf: '#f3c95a', leafEdge: '#7a4508', petal: '#fff5d8', petalEdge: '#a8600c', core: '#ff9a3a', glow: 'rgba(255,196,70,.95)' },
};

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};
const bezTan = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  const x = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const y = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  return Math.atan2(y, x);
};

function leaf(g, x, y, ang, len, pal) {
  g.save();
  g.translate(x, y); g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.45, -len * 0.42, len, 0);
  g.quadraticCurveTo(len * 0.45, len * 0.42, 0, 0);
  g.fillStyle = pal.leaf; g.fill();
  g.lineWidth = Math.max(1, len * 0.08); g.strokeStyle = pal.leafEdge; g.stroke();
  g.beginPath(); g.moveTo(len * 0.1, 0); g.lineTo(len * 0.8, 0);
  g.lineWidth = Math.max(0.7, len * 0.05); g.stroke();
  g.restore();
}
function curl(g, x, y, ang, r, pal, dir = 1) {
  g.save();
  g.translate(x, y); g.rotate(ang);
  g.beginPath();
  const turns = 1.4, n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = dir * t * turns * TAU;
    const rr = r * (1 - t * 0.85);
    const px = t * r * 1.2 + Math.cos(a - Math.PI / 2) * rr * 0.6, py = Math.sin(a - Math.PI / 2) * rr * 0.6 + rr * 0.6 * dir;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.lineWidth = Math.max(1, r * 0.2); g.strokeStyle = pal.edge; g.lineCap = 'round'; g.stroke();
  g.restore();
}
function lotus(g, x, y, r, pal, open) {
  g.save();
  g.translate(x, y);
  g.lineWidth = Math.max(1, r * 0.09);
  g.strokeStyle = pal.petalEdge;
  if (open) {
    // 外瓣
    for (let i = 0; i < 8; i++) {
      g.save(); g.rotate(i / 8 * TAU + Math.PI / 8);
      g.beginPath(); g.moveTo(0, -r * 0.25);
      g.quadraticCurveTo(r * 0.42, -r * 0.62, 0, -r); g.quadraticCurveTo(-r * 0.42, -r * 0.62, 0, -r * 0.25);
      g.fillStyle = pal.petal; g.fill(); g.stroke(); g.restore();
    }
    // 内瓣
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate(i / 6 * TAU);
      g.beginPath(); g.moveTo(0, -r * 0.15);
      g.quadraticCurveTo(r * 0.3, -r * 0.45, 0, -r * 0.66); g.quadraticCurveTo(-r * 0.3, -r * 0.45, 0, -r * 0.15);
      g.fillStyle = pal.stem; g.fill(); g.stroke(); g.restore();
    }
    g.beginPath(); g.arc(0, 0, r * 0.26, 0, TAU); g.fillStyle = pal.core; g.fill(); g.stroke();
    g.fillStyle = pal.edge;
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(Math.cos(a) * r * 0.13, Math.sin(a) * r * 0.13, r * 0.035, 0, TAU); g.fill(); }
  } else {
    // 花苞
    g.beginPath(); g.moveTo(0, r * 0.35);
    g.bezierCurveTo(r * 0.55, r * 0.2, r * 0.4, -r * 0.45, 0, -r * 0.8);
    g.bezierCurveTo(-r * 0.4, -r * 0.45, -r * 0.55, r * 0.2, 0, r * 0.35);
    g.fillStyle = pal.petal; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, r * 0.3); g.quadraticCurveTo(r * 0.12, -r * 0.2, 0, -r * 0.7); g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, r * 0.38); g.quadraticCurveTo(s * r * 0.6, r * 0.4, s * r * 0.62, -r * 0.05); g.quadraticCurveTo(s * r * 0.3, r * 0.15, 0, r * 0.38);
      g.fillStyle = pal.leaf; g.fill(); g.strokeStyle = pal.leafEdge; g.stroke();
    }
  }
  g.restore();
}
function strokeStem(g, pathFn, sw, pal, glowPx) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (pal.glow && glowPx) { g.save(); g.shadowColor = pal.glow; g.shadowBlur = glowPx; pathFn(); g.lineWidth = sw + 3; g.strokeStyle = pal.edge; g.stroke(); g.restore(); }
  pathFn(); g.lineWidth = sw + 3; g.strokeStyle = pal.edge; g.stroke();
  pathFn(); g.lineWidth = sw; g.strokeStyle = pal.stem; g.stroke();
  // 高光细线
  pathFn(); g.lineWidth = Math.max(0.8, sw * 0.22); g.strokeStyle = 'rgba(255,255,255,.45)'; g.stroke();
}

/** 以北为基准画一种规范纹样（中心在原点，边长 T） */
export function paintVine(g, type, T, on, isSource) {
  const pal = on ? VINE.on : VINE.off;
  const h = T / 2;
  const sw = Math.max(3, T * 0.085);
  const glowPx = on ? T * 0.12 : 0;
  const S = [[0, -h], [h * 0.34, -h * 0.34], [-h * 0.34, h * 0.34], [0, h]]; // 北→南 S 形
  const W = [[-h, 0], [-h * 0.34, -h * 0.34], [h * 0.34, h * 0.34], [h, 0]]; // 西→东
  const pathS = () => { g.beginPath(); g.moveTo(...S[0]); g.bezierCurveTo(...S[1], ...S[2], ...S[3]); };
  const pathW = () => { g.beginPath(); g.moveTo(...W[0]); g.bezierCurveTo(...W[1], ...W[2], ...W[3]); };
  const leafOn = (P, t, side, len) => { const [x, y] = bez(...P, t); const a = bezTan(...P, t); leaf(g, x, y, a + side * 0.9, len, pal); };
  const L = T * 0.2;
  switch (type) {
    case 1: { // 尽头：藤梢一朵莲
      const E = [[0, -h], [h * 0.3, -h * 0.62], [-h * 0.3, -h * 0.36], [0, -h * 0.06]];
      leafOn(E, 0.42, 1, L);
      strokeStem(g, () => { g.beginPath(); g.moveTo(...E[0]); g.bezierCurveTo(...E[1], ...E[2], ...E[3]); }, sw, pal, glowPx);
      curl(g, -h * 0.05, -h * 0.55, Math.PI * 0.9, T * 0.08, pal, -1);
      lotus(g, 0, h * 0.06, T * 0.23, pal, on);
      break;
    }
    case 5: { // 直：S 形藤
      leafOn(S, 0.26, 1, L); leafOn(S, 0.74, -1, L);
      strokeStem(g, pathS, sw, pal, glowPx);
      curl(g, h * 0.08, 0, 0, T * 0.08, pal, 1);
      curl(g, -h * 0.08, 0, Math.PI, T * 0.08, pal, 1);
      break;
    }
    case 3: { // 弯：绕东北角的弧
      const arc = () => { g.beginPath(); g.arc(h, -h, h, Math.PI, Math.PI / 2, true); };
      const mx = h - h * Math.SQRT1_2, my = -h + h * Math.SQRT1_2;
      leaf(g, mx, my, Math.PI * 0.75, L * 1.05, pal);
      strokeStem(g, arc, sw, pal, glowPx);
      curl(g, h - h * 0.8, -h + h * 0.28, Math.PI * 0.25 + Math.PI, T * 0.07, pal, 1);
      g.save(); g.fillStyle = pal.core; g.strokeStyle = pal.petalEdge; g.lineWidth = 1;
      g.beginPath(); g.arc(mx - h * 0.08, my + h * 0.08, T * 0.035, 0, TAU); g.fill(); g.stroke(); g.restore();
      break;
    }
    case 7: { // 丁字：S 形 + 向东一枝
      const B = [[0, 0], [h * 0.35, -h * 0.34], [h * 0.62, h * 0.3], [h, 0]];
      leafOn(S, 0.2, -1, L); leafOn(S, 0.8, -1, L); leafOn(B, 0.55, -1, L * 0.9);
      strokeStem(g, pathS, sw, pal, glowPx);
      strokeStem(g, () => { g.beginPath(); g.moveTo(...B[0]); g.bezierCurveTo(...B[1], ...B[2], ...B[3]); }, sw * 0.9, pal, glowPx);
      lotus(g, 0, 0, T * 0.13, pal, on);
      break;
    }
    case 15: { // 十字：两藤交缠，当心一朵莲
      leafOn(S, 0.22, 1, L); leafOn(W, 0.78, 1, L);
      strokeStem(g, pathS, sw, pal, glowPx);
      strokeStem(g, pathW, sw, pal, glowPx);
      lotus(g, 0, 0, T * 0.2, pal, on);
      break;
    }
    default: break;
  }
  if (isSource) {
    // 宝珠 + 火焰
    g.save();
    g.shadowColor = 'rgba(255,190,80,.95)'; g.shadowBlur = T * 0.18;
    g.fillStyle = '#ffcf6a';
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate(i / 6 * TAU);
      g.beginPath(); g.moveTo(-T * 0.06, -T * 0.08); g.quadraticCurveTo(0, -T * 0.3, T * 0.06, -T * 0.08); g.closePath(); g.fill();
      g.restore();
    }
    const pg = g.createRadialGradient(-T * 0.04, -T * 0.04, 0, 0, 0, T * 0.13);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.5, '#ffe9a8'); pg.addColorStop(1, '#e2912c');
    g.fillStyle = pg; g.beginPath(); g.arc(0, 0, T * 0.12, 0, TAU); g.fill();
    g.shadowBlur = 0; g.lineWidth = 1.5; g.strokeStyle = '#8a4a0c'; g.stroke();
    g.restore();
  }
}

// ---------------------------------------------------------------- 纹样（200×140 画框，朝右）
function elephant(g, pal) {
  const { fill, dark, line, gold } = pal;
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 3; g.strokeStyle = line;
  const leg = (x, y, w, h, col) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w + 1, y + h - 5); g.quadraticCurveTo(x + w / 2, y + h + 3, x - 1, y + h - 5); g.closePath(); g.fill(); g.stroke();
  };
  leg(64, 88, 17, 36, dark); leg(128, 88, 17, 36, dark);
  // 尾
  g.beginPath(); g.moveTo(42, 66); g.quadraticCurveTo(30, 80, 33, 98); g.stroke();
  // 身
  g.fillStyle = fill; g.beginPath(); g.ellipse(95, 72, 56, 33, 0, 0, TAU); g.fill(); g.stroke();
  leg(48, 90, 18, 38, fill); leg(112, 92, 18, 36, fill);
  // 鞍鞯 + 莲座
  g.fillStyle = gold; g.beginPath(); g.moveTo(70, 45); g.lineTo(122, 45); g.lineTo(126, 88); g.quadraticCurveTo(96, 96, 66, 88); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = line; g.lineWidth = 2; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(68, 84); g.quadraticCurveTo(96, 92, 124, 84); g.stroke(); g.setLineDash([]);
  g.fillStyle = fill; g.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) { const x = 78 + i * 9; g.beginPath(); g.moveTo(x - 6, 45); g.quadraticCurveTo(x, 28, x + 6, 45); g.closePath(); g.fill(); g.stroke(); }
  g.lineWidth = 3;
  // 头
  g.fillStyle = fill; g.beginPath(); g.ellipse(150, 58, 24, 26, -0.2, 0, TAU); g.fill(); g.stroke();
  // 耳
  g.beginPath(); g.moveTo(140, 40); g.bezierCurveTo(120, 34, 112, 66, 124, 82); g.bezierCurveTo(132, 90, 146, 84, 144, 70); g.closePath(); g.fillStyle = dark; g.fill(); g.stroke();
  // 鼻
  g.fillStyle = fill;
  g.beginPath(); g.moveTo(166, 64); g.bezierCurveTo(182, 80, 182, 104, 172, 118); g.bezierCurveTo(167, 126, 156, 124, 159, 116); g.bezierCurveTo(166, 104, 163, 90, 152, 80); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(164 + i * 2, 86 + i * 8); g.lineTo(172 + i * 1, 84 + i * 8); g.stroke(); }
  // 牙
  g.lineWidth = 6; g.strokeStyle = line; g.beginPath(); g.moveTo(160, 80); g.quadraticCurveTo(172, 92, 188, 86); g.stroke();
  g.lineWidth = 3.5; g.strokeStyle = '#fffaf0'; g.beginPath(); g.moveTo(160, 80); g.quadraticCurveTo(172, 92, 188, 86); g.stroke();
  // 眼
  g.fillStyle = line; g.beginPath(); g.ellipse(156, 52, 2.6, 2, 0, 0, TAU); g.fill();
}
function goat(g, pal) {
  const { fill, dark, line, gold } = pal;
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = line; g.lineWidth = 3;
  // 远侧腿
  const limb = (pts, w, col) => {
    g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]);
    g.lineWidth = w + 5; g.strokeStyle = line; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke();
    g.lineWidth = 3; g.strokeStyle = line;
  };
  limb([[124, 84], [142, 104], [158, 102]], 7, dark);
  limb([[70, 86], [54, 104], [34, 110]], 7, dark);
  // 翼（在身后）
  g.fillStyle = gold;
  g.beginPath(); g.moveTo(112, 62);
  g.bezierCurveTo(100, 36, 82, 18, 50, 10);
  g.bezierCurveTo(60, 22, 58, 26, 48, 28);
  g.bezierCurveTo(62, 34, 58, 40, 46, 44);
  g.bezierCurveTo(62, 48, 66, 54, 58, 60);
  g.bezierCurveTo(76, 60, 84, 64, 92, 70);
  g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 1.8;
  for (const [a, b, c, d] of [[100, 50, 70, 28], [96, 58, 64, 44], [92, 64, 66, 58]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2, (b + d) / 2 - 6, c, d); g.stroke(); }
  g.lineWidth = 3;
  // 尾
  g.beginPath(); g.moveTo(52, 70); g.bezierCurveTo(40, 60, 42, 50, 50, 52); g.stroke();
  // 身
  g.fillStyle = fill; g.beginPath(); g.ellipse(94, 76, 46, 21, -0.08, 0, TAU); g.fill(); g.stroke();
  // 颈与头
  g.beginPath(); g.moveTo(120, 66); g.bezierCurveTo(130, 56, 138, 44, 146, 38); g.lineTo(158, 44); g.bezierCurveTo(150, 56, 144, 70, 136, 80); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(158, 44, 15, 9, 0.45, 0, TAU); g.fill(); g.stroke();
  // 须
  g.fillStyle = dark; g.beginPath(); g.moveTo(166, 54); g.lineTo(163, 68); g.lineTo(158, 55); g.closePath(); g.fill(); g.stroke();
  // 角（盘曲）
  g.lineWidth = 6; g.strokeStyle = line;
  g.beginPath(); g.moveTo(152, 36); g.bezierCurveTo(138, 20, 118, 26, 122, 40); g.bezierCurveTo(125, 48, 136, 46, 134, 38); g.stroke();
  g.lineWidth = 3.5; g.strokeStyle = gold;
  g.beginPath(); g.moveTo(152, 36); g.bezierCurveTo(138, 20, 118, 26, 122, 40); g.bezierCurveTo(125, 48, 136, 46, 134, 38); g.stroke();
  g.lineWidth = 3; g.strokeStyle = line;
  // 近侧腿（奔跃）
  limb([[118, 88], [134, 110], [152, 114]], 8, fill);
  limb([[64, 88], [52, 112], [38, 124]], 8, fill);
  // 眼、耳
  g.fillStyle = line; g.beginPath(); g.arc(160, 41, 2.2, 0, TAU); g.fill();
  g.fillStyle = dark; g.beginPath(); g.ellipse(146, 42, 7, 3.5, 0.9, 0, TAU); g.fill(); g.stroke();
  // 身上细纹
  g.save(); g.globalAlpha *= 0.45; g.lineWidth = 1.4; g.strokeStyle = line;
  for (const [x, y] of [[84, 70], [100, 74], [114, 68]]) { g.beginPath(); g.moveTo(x - 7, y + 4); g.quadraticCurveTo(x, y - 4, x + 7, y + 4); g.stroke(); }
  g.restore();
}
function apsara(g, pal) {
  const { fill, dark, line, gold, ribbon, ribbon2 } = pal;
  g.lineJoin = 'round'; g.lineCap = 'round';
  // 飘带
  const band = (d, w, col) => {
    g.beginPath(); d();
    g.lineWidth = w + 4; g.strokeStyle = line; g.stroke();
    g.lineWidth = w; g.strokeStyle = col; g.stroke();
  };
  band(() => { g.moveTo(140, 50); g.bezierCurveTo(110, 16, 72, 34, 44, 18); g.bezierCurveTo(32, 12, 18, 16, 8, 26); }, 6, ribbon);
  band(() => { g.moveTo(126, 66); g.bezierCurveTo(100, 100, 62, 104, 34, 90); g.bezierCurveTo(22, 84, 12, 90, 4, 100); }, 6, ribbon2);
  band(() => { g.moveTo(132, 58); g.bezierCurveTo(116, 42, 92, 56, 70, 48); }, 4, ribbon);
  // 祥云
  g.lineWidth = 2.5; g.strokeStyle = line; g.fillStyle = fill;
  for (const [x, y, s] of [[70, 118, 1], [118, 124, 0.8]]) {
    g.beginPath(); g.arc(x, y, 9 * s, Math.PI, 0); g.arc(x + 14 * s, y, 7 * s, Math.PI, 0); g.arc(x + 26 * s, y + 2, 5 * s, Math.PI, 0.2); g.lineTo(x - 9 * s, y + 4); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(x, y, 4 * s, Math.PI, Math.PI * 2.2); g.stroke();
  }
  // 裙与腿（向左后方飘）
  g.lineWidth = 3; g.strokeStyle = line;
  g.fillStyle = gold;
  g.beginPath(); g.moveTo(126, 58); g.bezierCurveTo(104, 62, 80, 74, 50, 68); g.bezierCurveTo(60, 84, 96, 90, 126, 80); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 1.6;
  for (const k of [0.3, 0.55, 0.8]) { g.beginPath(); g.moveTo(lerpN(126, 56, k), lerpN(64, 72, k)); g.quadraticCurveTo(lerpN(126, 56, k) - 6, lerpN(76, 82, k), lerpN(126, 56, k) - 14, lerpN(80, 80, k)); g.stroke(); }
  g.lineWidth = 3;
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(46, 68, 8, 4.5, -0.3, 0, TAU); g.fill(); g.stroke();
  // 上身
  g.beginPath(); g.moveTo(150, 50); g.bezierCurveTo(142, 46, 126, 52, 118, 62); g.bezierCurveTo(118, 76, 134, 78, 142, 70); g.bezierCurveTo(150, 64, 156, 58, 150, 50); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = dark; g.beginPath(); g.moveTo(122, 64); g.bezierCurveTo(128, 70, 136, 72, 142, 68); g.lineTo(140, 72); g.bezierCurveTo(132, 76, 124, 74, 120, 68); g.closePath(); g.fill();
  // 前臂托莲
  g.lineWidth = 7; g.strokeStyle = line; g.beginPath(); g.moveTo(144, 56); g.quadraticCurveTo(162, 62, 176, 54); g.stroke();
  g.lineWidth = 4; g.strokeStyle = fill; g.beginPath(); g.moveTo(144, 56); g.quadraticCurveTo(162, 62, 176, 54); g.stroke();
  g.lineWidth = 2; g.strokeStyle = line; g.fillStyle = '#f4b0a8';
  for (let i = -2; i <= 2; i++) { g.save(); g.translate(182, 50); g.rotate(i * 0.45); g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(5, -4, 0, -11); g.quadraticCurveTo(-5, -4, 0, 4); g.fill(); g.stroke(); g.restore(); }
  // 后臂上扬
  g.lineWidth = 7; g.strokeStyle = line; g.beginPath(); g.moveTo(134, 56); g.quadraticCurveTo(126, 44, 118, 36); g.stroke();
  g.lineWidth = 4; g.strokeStyle = fill; g.beginPath(); g.moveTo(134, 56); g.quadraticCurveTo(126, 44, 118, 36); g.stroke();
  // 头、髻、头光
  g.lineWidth = 2.5; g.strokeStyle = gold; g.beginPath(); g.arc(156, 40, 18, 0, TAU); g.stroke();
  g.lineWidth = 3; g.strokeStyle = line; g.fillStyle = fill;
  g.beginPath(); g.arc(156, 42, 11, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = dark; g.beginPath(); g.arc(153, 29, 6.5, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(146, 41); g.quadraticCurveTo(150, 30, 164, 35); g.lineTo(156, 38); g.closePath(); g.fill();
  g.fillStyle = line; g.beginPath(); g.arc(161, 43, 1.5, 0, TAU); g.fill();
  g.strokeStyle = '#c2553f'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(162, 48); g.quadraticCurveTo(164, 49, 166, 48); g.stroke();
}

export const MOTIFS = {
  elephant: { name: '白象', draw: elephant, pal: { fill: '#fbf8ef', dark: '#e3dccb', line: '#8a6a2c', gold: '#e3b852' } },
  goat: { name: '飞羊', draw: goat, pal: { fill: '#f3cf6a', dark: '#d9a52a', line: '#6a4410', gold: '#8fd0b0' } },
  apsara: { name: '飞天', draw: apsara, pal: { fill: '#fbf6ea', dark: '#2c3a5a', line: '#6a4a1c', gold: '#e3b852', ribbon: '#4fae88', ribbon2: '#5b86c4' } },
};

/** 把纹样画进 (x,y,w,h) 框内，alpha 0..1 */
export function drawMotif(g, key, x, y, w, h, alpha) {
  if (alpha <= 0.01) return;
  const m = MOTIFS[key];
  const s = Math.min(w / 200, h / 140);
  g.save();
  g.globalAlpha = alpha;
  g.translate(x + (w - 200 * s) / 2, y + (h - 140 * s) / 2);
  g.scale(s, s);
  g.shadowColor = 'rgba(40,20,0,.45)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
  m.draw(g, m.pal);
  g.restore();
}
