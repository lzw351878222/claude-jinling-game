// 几何与材质工具：静态几何按材质批量合并；世界坐标烘焙 UV；中式屋顶生成器。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tex, PPU } from './textures.js';

// ------------------------------------------------------------------ 材质
const matCache = new Map();
/**
 * 材质键：
 *   'roof_grey'            纹理材质（Lambert）
 *   'c:#aa3322'            纯色 Lambert
 *   'e:#ffcc66'            自发光（Basic，参与泛光）
 *   'roof_grey|ds'         双面
 */
export function mat(key) {
  if (matCache.has(key)) return matCache.get(key);
  const [base, flag] = key.split('|');
  let m;
  if (base.startsWith('c:')) {
    m = new THREE.MeshLambertMaterial({ color: new THREE.Color(base.slice(2)) });
  } else if (base.startsWith('e:')) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(base.slice(2)).multiplyScalar(2.2), toneMapped: false });
  } else if (base.startsWith('g:')) {
    // 半透明发光（光晕、光柱）
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(base.slice(2)), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  } else {
    m = new THREE.MeshLambertMaterial({ map: tex(base) });
    if (base.startsWith('roof_') || base === 'sail' || base === 'paper') m.side = THREE.DoubleSide;
  }
  if (flag === 'ds') m.side = THREE.DoubleSide;
  m.name = key;
  matCache.set(key, m);
  return m;
}

// ------------------------------------------------------------------ 批量合并
export class Batch {
  constructor() { this.groups = new Map(); }
  /**
   * @param {string} key 材质键
   * @param {THREE.BufferGeometry} geo
   * @param {THREE.Matrix4} [m] 变换
   * @param {object} [o] { uv: 'world' | 'keep', group: 'occluder:x', shadow: true, receive: true }
   */
  add(key, geo, m, o = {}) {
    let g = geo.index ? geo : geo;
    if (m) { g = g.clone(); g.applyMatrix4(m); }
    if (!g.index) g = indexify(g);
    if (!g.attributes.normal) g.computeVertexNormals();
    if ((o.uv || 'world') === 'world') worldUV(g, key);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    const gk = (o.group || 'static') + '§' + key + '§' + (o.shadow === false ? 0 : 1);
    if (!this.groups.has(gk)) this.groups.set(gk, []);
    this.groups.get(gk).push(g);
  }
  /** 合并成 Mesh，返回 { root, occluders: Map(name→Mesh[]), stages: Map('stage:x'|'ruin:x' → Mesh[]) } */
  build() {
    const root = new THREE.Group();
    const occluders = new Map();
    const stages = new Map();
    for (const [gk, list] of this.groups) {
      const [group, key, sh] = gk.split('§');
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      let material = mat(key);
      if (group.startsWith('occluder:')) {
        material = material.clone();
        material.transparent = true;
        material.userData.fadable = true;
      }
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = sh === '1' && !key.startsWith('e:') && !key.startsWith('g:');
      mesh.receiveShadow = !key.startsWith('e:') && !key.startsWith('g:');
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (group.startsWith('stage:') || group.startsWith('ruin:')) {
        if (!stages.has(group)) stages.set(group, []);
        stages.get(group).push(mesh);
        for (const g of list) g.dispose();
        continue;
      }
      root.add(mesh);
      if (group.startsWith('occluder:')) {
        const name = group.slice(9);
        if (!occluders.has(name)) occluders.set(name, []);
        occluders.get(name).push(mesh);
      }
      for (const g of list) g.dispose();
    }
    this.groups.clear();
    return { root, occluders, stages };
  }
}

function indexify(g) {
  const n = g.attributes.position.count;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}

const texSizeCache = new Map();
function texSize(key) {
  if (texSizeCache.has(key)) return texSizeCache.get(key);
  let s = [1, 1];
  if (!key.includes(':')) {
    const base = key.split('|')[0];
    const t = tex(base);
    s = [t.image.width / PPU, t.image.height / PPU];
  }
  texSizeCache.set(key, s);
  return s;
}
/** 按法线方向把世界坐标投影成 UV（盒式三向贴图），保证相邻构件纹理连续 */
export function worldUV(g, key) {
  const [tw, th] = texSize(key);
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = -z; }
    else if (nx >= nz) { u = n.getX(i) > 0 ? -z : z; v = y; }
    else { u = n.getZ(i) > 0 ? x : -x; v = y; }
    uv[i * 2] = u / tw;
    uv[i * 2 + 1] = v / th;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ------------------------------------------------------------------ 基本体
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
/** 平移/旋转(y)/缩放 矩阵 */
export function trs(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
/** 以底面中心为原点的盒子 */
export function box(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}
/** 圆柱（底面为原点） */
export function cyl(rTop, rBot, h, seg = 8) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false);
  g.translate(0, h / 2, 0);
  return g;
}
/** 面朝 +z 的竖直矩形，UV 0..1（用于门窗、匾额等整张贴图） */
export function quad(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  return g;
}
/** 带拱门洞的墙体：宽 w、高 h、厚 d，拱洞宽 aw、拱脚高 ah（半圆拱） */
export function archWall(w, h, d, holes) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  // 用外轮廓 + 孔洞；底边在洞口处断开，所以直接画带缺口的外轮廓
  const hs = holes.slice().sort((a, b) => a.x - b.x);
  const pts = [[-w / 2, 0]];
  for (const hole of hs) {
    const x0 = hole.x - hole.w / 2, x1 = hole.x + hole.w / 2;
    pts.push([x0, 0]);
    pts.push([x0, hole.h]);
    const r = hole.w / 2;
    for (let i = 1; i < 12; i++) {
      const t = Math.PI - (i / 12) * Math.PI;
      pts.push([hole.x + Math.cos(t) * r, hole.h + Math.sin(t) * r]);
    }
    pts.push([x1, hole.h]);
    pts.push([x1, 0]);
  }
  pts.push([w / 2, 0], [w / 2, h], [-w / 2, h]);
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -d / 2);
  return g;
}
/** 拱券内壁（半圆筒 + 直壁），用于城门洞内侧 */
export function archTunnel(aw, ah, d) {
  const pts = [];
  const r = aw / 2;
  pts.push(new THREE.Vector2(-r, 0), new THREE.Vector2(-r, ah));
  for (let i = 1; i < 12; i++) { const t = Math.PI - (i / 12) * Math.PI; pts.push(new THREE.Vector2(Math.cos(t) * r, ah + Math.sin(t) * r)); }
  pts.push(new THREE.Vector2(r, ah), new THREE.Vector2(r, 0));
  const pos = [], nor = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x, ty = next.y - prev.y;
    let nx = ty, ny = -tx; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    // 法线指向洞内
    if (nx * -a.x + ny * (ah - a.y) < 0) { nx = -nx; ny = -ny; }
    pos.push(a.x, a.y, -d / 2, a.x, a.y, d / 2);
    nor.push(nx, ny, 0, nx, ny, 0);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, e = i * 2 + 3;
    idx.push(a, c, b, b, c, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------------ 屋顶
/**
 * 通用坡面：P(u,v) → [x,y,z]；u 沿檐口，v 从檐口(0)到屋脊(1)。
 * 生成的 UV：u 按檐口实际长度，v 按坡长，使筒瓦垄沿坡向下。
 */
function slopePatch(P, nu, nv) {
  const pos = [], uv = [], idx = [];
  // 估计檐口与坡长用于 UV
  const eaveLen = dist(P(0, 0), P(1, 0));
  const slopeLen = dist(P(0.5, 0), P(0.5, 1));
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const p = P(u, v);
      pos.push(p[0], p[1], p[2]);
      uv.push(((u - 0.5) * eaveLen) / 1.0, (1 - v) * slopeLen / 1.0);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 保证法线朝上
  const n = g.attributes.normal;
  let up = 0; for (let i = 0; i < n.count; i++) up += n.getY(i);
  if (up < 0) { g.index.array.reverse(); g.computeVertexNormals(); }
  return g;
}
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

/**
 * 中式屋顶。坐标以屋顶中心为原点，檐口高度 y=0，屋脊沿 x 轴。
 * @param {object} o
 *  type: 'wudian' 庑殿 | 'xieshan' 歇山 | 'xuanshan' 悬山 | 'pyramid' 攒尖（o.sides 边数）
 *  w, d: 檐口外缘尺寸（已含出檐）；rise: 举高；curve: 凹曲程度；lift: 翼角起翘；ridgeTex: 屋脊材质
 * @returns {Array<[key, geometry]>}
 */
export function roof(o) {
  const type = o.type || 'xieshan';
  const W = o.w, D = o.d;
  const R = o.rise ?? Math.min(W, D) * 0.42;
  const curve = o.curve ?? 1.7;
  const lift = o.lift ?? 0.35;
  const tile = o.tile || 'roof_grey';
  const ridgeKey = o.ridgeKey || (tile === 'roof_yellow' ? 'c:#b8861f' : tile === 'roof_green' ? 'c:#1e5c47' : tile === 'roof_blue' ? 'c:#1d3c66' : tile === 'roof_thatch' ? 'c:#7a6440' : 'c:#3b3f43');
  const prof = (v) => R * (0.18 * v + 0.82 * Math.pow(v, curve));
  const out = [];
  const nu = 10, nv = 6;
  // 翼角起翘：靠近檐口两端时抬升，并略向外伸（出翘）
  const cornerLift = (u, v) => {
    const e = Math.max(0, Math.abs(u - 0.5) * 2 - 0.55) / 0.45;
    return lift * e * e * Math.pow(1 - v, 2);
  };
  if (type === 'pyramid') {
    const n = o.sides || 4;
    const rad = o.radius || W / 2;
    const ang0 = n === 4 ? Math.PI / 4 : (n === 8 ? Math.PI / 8 : Math.PI / 2 / n * 2);
    for (let k = 0; k < n; k++) {
      const a0 = ang0 + (k / n) * Math.PI * 2, a1 = ang0 + ((k + 1) / n) * Math.PI * 2;
      const c0 = [Math.cos(a0) * rad, Math.sin(a0) * rad], c1 = [Math.cos(a1) * rad, Math.sin(a1) * rad];
      const P = (u, v) => {
        const ex = c0[0] + (c1[0] - c0[0]) * u, ez = c0[1] + (c1[1] - c0[1]) * u;
        const x = ex * (1 - v), z = ez * (1 - v);
        const cl = cornerLift(u, v);
        const outw = 1 + cl * 0.18;
        return [x * outw, prof(v) + cl, z * outw];
      };
      out.push([tile, slopePatch(P, 6, nv)]);
    }
    // 宝顶
    out.push([o.finialKey || 'c:#c9a24a', cyl(0.02, R * 0.12, R * 0.22, 8).translate(0, R, 0)]);
    const ball = new THREE.SphereGeometry(R * 0.1, 8, 6); ball.translate(0, R * 1.25, 0);
    out.push([o.finialKey || 'c:#c9a24a', ball]);
    return out;
  }
  let vs, Wg;
  if (o.skirt) {
    // 重檐的下层檐：只生成四坡的下半截（v ∈ [0, skirt]）
    const sk = o.skirt;
    const Wr = Math.max(0.2, W - D);
    const hxS = (v) => W / 2 - (W / 2 - Wr / 2) * v;
    const zS = (v) => (D / 2) * (1 - v);
    for (const s of [1, -1]) {
      out.push([tile, slopePatch((u, v) => { const vv = v * sk; const cl = cornerLift(u, vv); return [(u - 0.5) * 2 * hxS(vv) * (1 + cl * 0.12), prof(vv) + cl, s * zS(vv) * (1 + cl * 0.1)]; }, nu, 3)]);
      out.push([tile, slopePatch((u, v) => { const vv = v * sk; const cl = cornerLift(u, vv); return [s * hxS(vv) * (1 + cl * 0.1), prof(vv) + cl, (u - 0.5) * 2 * zS(vv) * (1 + cl * 0.12)]; }, 8, 3)]);
    }
    for (const s of [1, -1]) {
      const pts = []; for (let i = 0; i <= nu; i++) { const u = i / nu; const cl = cornerLift(u, 0); pts.push([(u - 0.5) * 2 * hxS(0) * (1 + cl * 0.12), cl, s * zS(0) * (1 + cl * 0.1)]); }
      out.push([o.fasciaKey || 'c:#2c2622', ribbon(pts, 0.12)]);
      const pts2 = []; for (let i = 0; i <= 8; i++) { const u = i / 8; const cl = cornerLift(u, 0); pts2.push([s * hxS(0) * (1 + cl * 0.1), cl, (u - 0.5) * 2 * zS(0) * (1 + cl * 0.12)]); }
      out.push([o.fasciaKey || 'c:#2c2622', ribbon(pts2, 0.12)]);
    }
    return out;
  }
  if (type === 'wudian') { vs = 1; Wg = Math.max(0.2, W - D); }
  else if (type === 'xuanshan') { vs = 0; Wg = W; }
  else { vs = 0.45; Wg = Math.max(W * 0.45, W - D * 0.9); }
  const halfX = (v) => {
    if (vs <= 0) return W / 2;
    if (v <= vs) return W / 2 - (W / 2 - Wg / 2) * (v / vs);
    return Wg / 2;
  };
  const zAt = (v) => (D / 2) * (1 - v);
  // 前后坡
  for (const s of [1, -1]) {
    const P = (u, v) => {
      const hx = halfX(v);
      const x = (u - 0.5) * 2 * hx;
      const cl = vs > 0 ? cornerLift(u, v) : 0;
      return [x * (1 + cl * 0.12), prof(v) + cl, s * zAt(v) * (1 + cl * 0.1)];
    };
    out.push([tile, slopePatch(P, nu, nv)]);
  }
  // 两山：庑殿/歇山的侧坡
  if (vs > 0) {
    for (const s of [1, -1]) {
      const vTop = vs;
      const P = (u, v) => {
        const vv = v * vTop;
        const hz = zAt(vv);
        const x = s * halfX(vv);
        const z = (u - 0.5) * 2 * hz;
        const cl = cornerLift(u, vv);
        return [x * (1 + cl * 0.1), prof(vv) + cl, z * (1 + cl * 0.12)];
      };
      out.push([tile, slopePatch(P, 8, Math.max(2, Math.round(nv * vTop)))]);
    }
  }
  // 山花（歇山）或山墙（悬山）三角
  if (vs < 1) {
    const yb = prof(vs), zb = zAt(vs), yt = prof(1);
    for (const s of [1, -1]) {
      const inset = type === 'xuanshan' ? (o.gableInset ?? 0.35) : 0.04;
      const x = s * (Wg / 2 - inset);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([x, yb - (type === 'xuanshan' ? 0.05 : 0), -zb, x, yb - (type === 'xuanshan' ? 0.05 : 0), zb, x, yt - 0.02, 0], 3));
      g.setIndex(s > 0 ? [0, 2, 1] : [0, 1, 2]);
      g.computeVertexNormals();
      out.push([o.gableKey || (type === 'xuanshan' ? 'plaster' : 'plaster_red'), g]);
    }
  }
  // 正脊
  const ridgeLen = Wg + 0.1;
  const rh = o.ridgeH ?? Math.max(0.18, R * 0.12);
  out.push([ridgeKey, box(ridgeLen, rh, 0.16).translate(0, prof(1) - 0.04, 0)]);
  // 鸱吻
  for (const s of [1, -1]) {
    const g = box(0.14, rh * 2.2, 0.2);
    g.translate(s * (ridgeLen / 2 - 0.02), prof(1) - 0.04, 0);
    out.push([ridgeKey, g]);
    const g2 = box(0.22, 0.08, 0.2); g2.translate(s * (ridgeLen / 2 - 0.12), prof(1) + rh * 2.0, 0);
    out.push([ridgeKey, g2]);
  }
  // 垂脊/戗脊：沿坡面交线放一串小方块（庑殿/歇山）
  if (vs > 0) {
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const v0 = (i / steps) * vs, v1 = ((i + 1) / steps) * vs;
        const a = [sx * halfX(v0) * (1 + cornerLift(1, v0) * 0.12), prof(v0) + cornerLift(1, v0), sz * zAt(v0) * (1 + cornerLift(1, v0) * 0.1)];
        const b = [sx * halfX(v1) * (1 + cornerLift(1, v1) * 0.12), prof(v1) + cornerLift(1, v1), sz * zAt(v1) * (1 + cornerLift(1, v1) * 0.1)];
        const len = dist(a, b);
        const g = box(0.1, 0.1, len + 0.02);
        g.translate(0, 0, -len / 2);
        const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(0, 1, 0));
        m.setPosition(a[0], a[1] - 0.02, a[2]);
        g.applyMatrix4(m);
        out.push([ridgeKey, g]);
        if (i < 3 && o.beasts !== false) { // 仙人走兽
          const bst = box(0.07, 0.1, 0.07);
          bst.translate(a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5 + 0.06, a[2] + (b[2] - a[2]) * 0.5);
          out.push([ridgeKey, bst]);
        }
      }
      if (vs < 1) { // 歇山的垂脊：从山花顶沿前后坡下到 vs
        const a = [sx * (Wg / 2 - 0.04), prof(1), 0];
        const b = [sx * (Wg / 2 - 0.04), prof(vs), sz * zAt(vs)];
        const len = dist(a, b);
        const g = box(0.09, 0.09, len);
        g.translate(0, 0, -len / 2);
        const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(0, 1, 0));
        m.setPosition(a[0], a[1] - 0.03, a[2]);
        g.applyMatrix4(m);
        out.push([ridgeKey, g]);
      }
    }
  }
  // 檐口封檐板（让屋面有厚度感）
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const hx = halfX(0);
      const cl = vs > 0 ? cornerLift(u, 0) : 0;
      pts.push([(u - 0.5) * 2 * hx * (1 + cl * 0.12), cl, s * zAt(0) * (1 + cl * 0.1)]);
    }
    out.push([o.fasciaKey || 'c:#2c2622', ribbon(pts, 0.12)]);
  }
  if (vs > 0) {
    for (const s of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const cl = cornerLift(u, 0);
        pts.push([s * halfX(0) * (1 + cl * 0.1), cl, (u - 0.5) * 2 * zAt(0) * (1 + cl * 0.12)]);
      }
      out.push([o.fasciaKey || 'c:#2c2622', ribbon(pts, 0.12)]);
    }
  }
  return out;
}
/** 沿折线的竖直窄带（高 h，向下） */
function ribbon(pts, h) {
  const pos = [], idx = [];
  for (const p of pts) { pos.push(p[0], p[1], p[2], p[0], p[1] - h, p[2]); }
  for (let i = 0; i < pts.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 把 roof() 的输出按变换加进 batch */
export function addRoof(batch, parts, m, group) {
  for (const [key, g] of parts) {
    const isTile = key.startsWith('roof_');
    batch.add(isTile ? key + '|ds' : key, g, m, { uv: isTile ? 'keep' : 'world', group });
  }
}
