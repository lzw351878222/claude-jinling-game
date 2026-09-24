// 牵星过洋 · 数据与几何（纯逻辑，可在 node 里验证）
// 海图坐标：x 向东、y 向南，单位为「更」（一更船程，约六十里；图为示意，距离已缩略）。
export const DIR24 = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];

/** 48 个半向（每 7.5°）：偶数为丹针（正对一字），奇数为缝针（两字正中） */
export function bearingName(i48) {
  i48 = ((i48 % 48) + 48) % 48;
  if (i48 % 2 === 0) return '丹' + DIR24[i48 / 2];
  const a = (i48 - 1) / 2, b = (a + 1) % 24;
  // 缝针取名：天干/八卦字在前，地支字在后（丁未、坤申、乾戌、壬亥……）
  return a % 2 === 1 ? DIR24[a] + DIR24[b] : DIR24[b] + DIR24[a];
}
export const deg = (i48) => i48 * 7.5;
export const dirVec = (i48) => { const r = deg(i48) * Math.PI / 180; return [Math.sin(r), -Math.cos(r)]; };

export const CN_GENG = ['', '一', '二', '三', '四', '五'];

// ---------------------------------------------------------------- 航路
const P0 = [0, 0];
const walk = (p, i48, d) => { const [dx, dy] = dirVec(i48); return [p[0] + dx * d, p[1] + dy * d]; };
const W1 = walk(P0, 30, 4); // 丹坤 四更 → 占城
const W2a = walk(W1, 27, 4); // 丁未 四更 → 龙牙门
const W2 = walk(W2a, 40, 2); // 丹戌 二更 → 满剌加
const W3a = walk(W2, 41, 4); // 乾戌 四更 → 翠蓝山
export const STAR_DIST = 5;
const W3 = walk(W3a, 34, STAR_DIST); // 丹庚 → 锡兰山（佛堂山下）
const W4a = walk(W3, 36, 2); // 丹酉 二更 → 小葛兰外洋
const W4 = walk(W4a, 45, 3); // 壬亥 三更 → 古里

// lab：地名签相对航点的方向（放在船身两侧或下方，避开停泊时的帆和进出港的航线）
export const WAYPOINTS = {
  wuhu: { name: '五虎门', p: P0, port: true, lab: [0.7, 0.12] },
  champa: { name: '占城', p: W1, port: true, lab: [0.55, 0.05] },
  longya: { name: '龙牙门', p: W2a, port: false, lab: [0.62, 0.2] },
  malacca: { name: '满剌加', p: W2, port: true, lab: [0.6, -0.12] },
  cuilan: { name: '翠蓝山', p: W3a, port: false, lab: [0.7, -0.15] },
  ceylon: { name: '锡兰山', p: W3, port: true, lab: [0.2, 0.42] },
  xiaogelan: { name: '小葛兰', p: W4a, port: false, lab: [-0.2, 0.42] },
  calicut: { name: '古里', p: W4, port: true, lab: [-0.62, 0.02] },
};

/** 四程、七段针路 */
export const LEGS = [
  {
    from: 'wuhu', to: 'champa', title: '五虎门 → 占城',
    segs: [{ from: 'wuhu', to: 'champa', b: 30, geng: 4, text: '五虎门开船，用<b>丹坤针</b>，<i>四更</i>船，取占城。' }],
  },
  {
    from: 'champa', to: 'malacca', title: '占城 → 满剌加',
    segs: [
      { from: 'champa', to: 'longya', b: 27, geng: 4, text: '占城开船，用<b>丁未针</b>，<i>四更</i>船，过昆仑山，到龙牙门。' },
      { from: 'longya', to: 'malacca', b: 40, geng: 2, text: '入龙牙门，用<b>丹戌针</b>，<i>二更</i>船，取满剌加。' },
    ],
  },
  {
    from: 'malacca', to: 'ceylon', title: '满剌加 → 锡兰山', ocean: true,
    segs: [
      { from: 'malacca', to: 'cuilan', b: 41, geng: 4, text: '满剌加开船，用<b>乾戌针</b>，<i>四更</i>船，见翠蓝山。' },
      { from: 'cuilan', to: 'ceylon', b: 34, geng: 0, star: 3.5, text: '翠蓝山放洋，用<b>丹庚针</b>，不计更数，以<i>北辰星三指半</i>为准，取锡兰山。' },
    ],
  },
  {
    from: 'ceylon', to: 'calicut', title: '锡兰山 → 古里',
    segs: [
      { from: 'ceylon', to: 'xiaogelan', b: 36, geng: 2, text: '锡兰山开船，用<b>丹酉针</b>，<i>二更</i>船，见小葛兰。' },
      { from: 'xiaogelan', to: 'calicut', b: 45, geng: 3, text: '用<b>壬亥针</b>，<i>三更</i>船，取古里。' },
    ],
  },
];

/** 北辰星高度（指）：随纬度（y）线性变化——向南一更，星低一指（图为示意） */
export const STAR_A = 3.5 + W3[1];
export const starAlt = (y) => STAR_A - y;

// ---------------------------------------------------------------- 陆地、岛屿、礁石（示意）
export const LAND = [
  // 大陆：福建、广东、交趾、占城、真腊、暹罗、满剌加半岛、缅甸、榜葛剌、天竺南端
  { name: 'asia', pts: [
    [2.2, -2.4], [2.2, -1.1], [1.2, -0.72], [0.52, -0.42], [0.1, -0.22], [-0.3, 0.02], [-0.78, 0.32], [-1.26, 0.6], [-1.74, 0.82],
    [-2.22, 1.02], [-2.5, 1.08], [-2.58, 1.4], [-2.72, 1.2], [-3.05, 1.08], [-3.34, 1.26], [-3.36, 1.72], [-3.22, 2.22], [-3.06, 2.58],
    [-2.99, 2.78], [-3.08, 3.02], [-3.3, 3.34], [-3.6, 3.64], [-3.88, 3.94], [-4.12, 4.26], [-4.34, 3.98], [-4.52, 3.52], [-4.66, 3.1],
    [-4.9, 3.18], [-4.84, 3.84], [-4.72, 4.56], [-4.62, 5.28], [-4.52, 5.86], [-4.45, 6.2], [-4.8, 6.06], [-5.2, 5.82], [-5.62, 5.57],
    [-6.02, 5.34], [-6.46, 5.02], [-6.88, 4.56], [-7.24, 4.04], [-7.52, 3.5], [-7.7, 2.9], [-7.86, 2.26], [-8.1, 1.62], [-8.6, 1.02],
    [-9.4, 0.7], [-10.3, 0.42], [-11.3, 0.12], [-12.4, -0.16], [-13.3, -0.06], [-13.78, 0.62], [-14.18, 1.4], [-14.5, 2.2], [-14.74, 2.8],
    [-14.96, 3.3], [-15.28, 3.68], [-15.56, 3.9], [-15.82, 3.66], [-16.06, 3.3], [-16.34, 2.74], [-16.52, 2.44], [-16.8, 2.02], [-17.05, 1.64],
    [-17.3, 1.0], [-17.58, 0.22], [-17.88, -0.6], [-18.2, -1.5], [-18.4, -2.4],
  ] },
  { name: 'hainan', pts: [[-2.1, 1.34], [-1.95, 1.55], [-2.04, 1.86], [-2.34, 1.99], [-2.6, 1.86], [-2.66, 1.56], [-2.46, 1.37]] },
  { name: 'sumatra', pts: [
    [-4.5, 6.92], [-5.2, 6.57], [-6.0, 6.17], [-6.8, 5.67], [-7.6, 5.07], [-8.15, 4.52], [-8.36, 4.32], [-8.5, 4.56], [-8.24, 5.12],
    [-7.62, 6.02], [-6.92, 7.02], [-6.2, 8.0], [-5.9, 8.6], [-3.5, 8.6], [-3.62, 7.95], [-4.06, 7.32],
  ] },
  { name: 'borneo', pts: [[-2.3, 5.8], [-1.6, 5.2], [-0.6, 4.95], [0.4, 5.05], [1.4, 5.4], [2.2, 5.7], [2.2, 8.6], [-2.5, 8.6], [-2.72, 7.4], [-2.55, 6.5]] },
  { name: 'ceylon', pts: [
    [W3[0], W3[1] - 0.16], [W3[0] - 0.24, W3[1] - 0.3], [W3[0] - 0.4, W3[1] - 0.74], [W3[0] - 0.36, W3[1] - 1.34], [W3[0] - 0.2, W3[1] - 1.9],
    [W3[0] + 0.1, W3[1] - 1.76], [W3[0] + 0.34, W3[1] - 1.26], [W3[0] + 0.46, W3[1] - 0.76], [W3[0] + 0.38, W3[1] - 0.38], [W3[0] + 0.2, W3[1] - 0.22],
  ] },
  // 小岛
  { name: 'taiwan', pts: [[1.05, -0.35], [1.3, -0.1], [1.34, 0.4], [1.12, 0.66], [0.98, 0.3]] },
  { name: 'bintan', pts: [[-4.2, 6.76], [-3.98, 6.74], [-3.92, 6.9], [-4.12, 6.98]] },
];
export const ISLANDS = [
  { x: -3.98, y: 4.52, r: 0.2, name: '昆仑山' },
  { x: -1.74, y: 1.28, r: 0.07, name: '七洲' }, { x: -1.62, y: 1.36, r: 0.06 }, { x: -1.84, y: 1.2, r: 0.05 },
  { x: -9.04, y: 2.86, r: 0.1, name: '翠蓝山', noLabel: true }, // 海图上已有航点签，不重复标注 { x: -9.28, y: 3.46, r: 0.09 }, { x: -8.96, y: 3.66, r: 0.12 }, { x: -9.52, y: 2.72, r: 0.07 },
  { x: -9.56, y: 1.18, r: 0.08 }, { x: -9.6, y: 1.58, r: 0.1, name: '安达曼' }, { x: -9.54, y: 1.98, r: 0.08 },
  { x: -16.95, y: 5.6, r: 0.06, name: '溜山' }, { x: -17.1, y: 6.0, r: 0.05 }, { x: -17.02, y: 6.4, r: 0.06 }, { x: -17.2, y: 6.85, r: 0.05 },
];
export const REEFS = [
  { x: -1.42, y: 2.12, r: 0.3, name: '万里石塘' },
  { x: -14.62, y: 2.58, r: 0.18, name: '浅' },
  { x: -0.95, y: 3.9, r: 0.22, name: '石星' },
  { x: -4.9, y: 7.05, r: 0.08 },
];
export const LABELS = [
  { t: '福建', x: 0.6, y: -1.1 }, { t: '广东', x: -1.6, y: 0.35 }, { t: '交趾', x: -3.7, y: 1.5 }, { t: '真腊', x: -3.9, y: 3.4 },
  { t: '暹罗', x: -5.3, y: 2.7 }, { t: '苏门答剌', x: -7.1, y: 5.55, small: true }, { t: '榜葛剌', x: -10.6, y: -0.3 },
  { t: '柯枝', x: -16.1, y: 2.35, small: true }, { t: '渤泥', x: -0.4, y: 5.55 }, { t: '爪哇海', x: -2.6, y: 7.6, sea: true },
  { t: '大洋', x: -12.2, y: 6.2, sea: true }, { t: '南海', x: -0.6, y: 2.9, sea: true },
];
export const SHIP_R = 0.05;

// ---------------------------------------------------------------- 碰撞
function segHitDist(ox, oy, dx, dy, ax, ay, bx, by) {
  // 射线 o + t*d 与线段 ab 的交点 t
  const ex = bx - ax, ey = by - ay;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-12) return Infinity;
  const t = ((ax - ox) * ey - (ay - oy) * ex) / den;
  const u = ((ax - ox) * dy - (ay - oy) * dx) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}
function pointSegDist(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay;
  const l2 = ex * ex + ey * ey;
  let t = l2 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - ex * t, py - ay - ey * t);
}
export function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** 离最近的陆地/礁石的距离（负数表示在陆上） */
export function clearance(x, y) {
  let d = Infinity;
  for (const L of LAND) {
    const pts = L.pts;
    let m = Infinity;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; m = Math.min(m, pointSegDist(x, y, a[0], a[1], b[0], b[1])); }
    d = Math.min(d, inPoly(x, y, pts) ? -m : m);
  }
  for (const c of ISLANDS) d = Math.min(d, Math.hypot(x - c.x, y - c.y) - c.r);
  for (const c of REEFS) d = Math.min(d, Math.hypot(x - c.x, y - c.y) - c.r);
  return d;
}
/** 沿方向航行，第一次碰到陆地/礁石的距离（没碰到返回 Infinity）；kind: 'land'|'reef' */
export function firstHit(x0, y0, i48, maxD, step = 0.02) {
  const [dx, dy] = dirVec(i48);
  // 精确：多边形边
  let best = Infinity, kind = null, name = null;
  for (const L of LAND) {
    const pts = L.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const t = segHitDist(x0, y0, dx, dy, a[0], a[1], b[0], b[1]);
      if (t < best && t > 1e-6) { best = t; kind = 'land'; name = L.name; }
    }
  }
  // 圆（岛、礁）
  for (const [arr, k] of [[ISLANDS, 'land'], [REEFS, 'reef']]) {
    for (const c of arr) {
      const fx = x0 - c.x, fy = y0 - c.y;
      const b = fx * dx + fy * dy, cc = fx * fx + fy * fy - (c.r + SHIP_R) ** 2;
      const disc = b * b - cc;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 1e-6 && t < best) { best = t; kind = k; name = c.name || (k === 'reef' ? '礁' : '岛'); }
    }
  }
  // 贴岸：船身半径
  for (let t = step; t < Math.min(best, maxD); t += step) {
    const x = x0 + dx * t, y = y0 + dy * t;
    let near = false;
    for (const L of LAND) {
      const pts = L.pts;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (pointSegDist(x, y, a[0], a[1], b[0], b[1]) < SHIP_R * 0.6) { near = true; break; } }
      if (near) { if (t < best) { best = t; kind = 'land'; name = L.name; } break; }
    }
    if (near) break;
  }
  return best <= maxD ? { d: best, kind, name } : null;
}

/** 模拟一段：返回 { ok, hit, end, err } */
export function simulate(seg, i48, geng, tol) {
  const A = WAYPOINTS[seg.from].p, B = WAYPOINTS[seg.to].p;
  const hit = firstHit(A[0], A[1], i48, geng);
  const [dx, dy] = dirVec(i48);
  if (hit) return { ok: false, hit, end: [A[0] + dx * hit.d, A[1] + dy * hit.d] };
  const end = [A[0] + dx * geng, A[1] + dy * geng];
  const err = Math.hypot(end[0] - B[0], end[1] - B[1]);
  return { ok: err <= tol, hit: null, end, err };
}
