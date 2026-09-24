// 建筑与道具生成器：地图定义里的 build(B) 通过这些函数摆放明代南京的一切。
import * as THREE from 'three';
import { Batch, box, cyl, quad, trs, roof, addRoof, archWall, mat } from './geo.js';
import { FloraBatch } from './flora.js';
import { rng } from '../core/util.js';

const R90 = Math.PI / 2;

/** 匾额 / 招牌贴图（书法字） */
const signCache = new Map();
export function signTexture(text, o = {}) {
  const key = text + JSON.stringify(o);
  if (signCache.has(key)) return signCache.get(key);
  const vertical = o.vertical ?? false;
  const n = [...text].length;
  const cw = 64;
  const W = vertical ? 96 : n * cw + 48, H = vertical ? n * cw + 48 : 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = o.bg || '#1e2a3a';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = o.border || '#c9a24a';
  g.lineWidth = 6; g.strokeRect(5, 5, W - 10, H - 10);
  g.lineWidth = 2; g.strokeRect(13, 13, W - 26, H - 26);
  g.fillStyle = o.color || '#e8c86a';
  g.font = `${cw - 6}px "JLBrush", "STXingkai", KaiTi, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...text];
  // 匾额从右往左读
  chars.forEach((ch, i) => {
    if (vertical) g.fillText(ch, W / 2, 24 + cw / 2 + i * cw + 2);
    else g.fillText(ch, W - 24 - cw / 2 - i * cw, H / 2 + 3);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  signCache.set(key, t);
  return t;
}

export function makeBuilder(world, ctx) {
  const batch = world.batch;
  const flora = new FloraBatch();
  let curFlora = flora; // 可修复部件里种的树进各自的批次
  const dyn = []; // 需要逐帧更新的对象（旗、灯笼摇曳）
  const extra = new THREE.Group(); // 不合并的网格（匾额、特殊材质）
  const R = rng(world.def.seed || 7);
  const H = (x, z) => world.heightAt(x, z);

  function addMesh(m) { extra.add(m); return m; }
  function solid(x, z, w, d) { world.markSolid(x, z, w, d, 1); }

  /** 局部坐标系：以 (cx, cy, cz) 为原点、绕 y 旋转 rot 的矩阵乘子 */
  function frame(cx, cy, cz, rot = 0) {
    const base = trs(cx, cy, cz, rot);
    return (m) => (m ? base.clone().multiply(m) : base.clone());
  }

  const B = {
    world, batch, flora, dyn, extra, rng: R,
    solid,
    /** 灯光登记：用于精灵受光、水面倒影、夜间真实点光源池 */
    light(x, y, z, color = '#ffb060', intensity = 1, o = {}) {
      world.lights.push({ x, y, z, color: new THREE.Color(color), intensity, radius: o.radius ?? 5, reflect: o.reflect });
    },
    tree(kind, x, z, o = {}) { curFlora.add(kind, x, z, { ...o, y: o.y ?? H(x, z) }); if (o.solid !== false && !['tuft', 'flowers', 'reeds', 'lotus'].includes(kind)) solid(Math.floor(x), Math.floor(z), 1, 1); },
    trees(kind, list, o = {}) { for (const [x, z, s] of list) B.tree(kind, x, z, { ...o, scale: s || o.scale }); },
    /** 在矩形区域随机撒草丛/花 */
    scatter(kind, x0, z0, x1, z1, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
        const tx = Math.floor(x), tz = Math.floor(z);
        if (!world.inBounds(tx, tz) || world.water[world.idx(tx, tz)] || world.solid[world.idx(tx, tz)]) continue;
        if (o.on && !o.on.includes(world.gtype[world.idx(tx, tz)])) continue;
        curFlora.add(kind, x, z, { y: H(x, z), scale: o.scale || (0.8 + R() * 0.4), variant: Math.floor(R() * 3) });
      }
    },

    // ------------------------------------------------------------ 殿堂
    /**
     * 殿/堂/阁：x,z 为占地左上角（格），w,d 为面阔进深（格）。
     * o: h 檐柱高, plat 台基高, roof 'xieshan'|'wudian'|'xuanshan', tile, wall, front 'lattice'|'door'|'open', sign, double, rot(0 朝南)
     */
    hall(o) {
      const { x, z, w, d } = o;
      const h = o.h ?? 2.6, plat = o.plat ?? 0.45, eave = o.eave ?? 0.75;
      const cx = x + w / 2, cz = z + d / 2;
      const y0 = o.y ?? H(cx, cz);
      const rot = (o.rot || 0) * R90;
      const F = frame(cx, y0, cz, rot);
      const grp = o.occluder ? 'occluder:' + (o.occluder === true ? `hall${x}_${z}` : o.occluder) : undefined;
      const add = (key, g, m, opt = {}) => batch.add(key, g, F(m), { group: grp, ...opt });
      const W = (o.rot || 0) % 2 ? d : w, D = (o.rot || 0) % 2 ? w : d;
      // 台基
      if (plat > 0) {
        add(o.platKey || 'stone_block_light', box(W + 0.5, plat, D + 0.5), trs(0, 0, 0));
        add('stone_grey', box(W + 0.62, 0.08, D + 0.62), trs(0, plat - 0.08, 0));
        // 踏跺
        const steps = Math.max(2, Math.round(plat / 0.15));
        const sw = Math.min(W * 0.5, 2.6);
        for (let k = 0; k < steps; k++) add('stone_block_light', box(sw, plat * (k + 1) / steps, 0.28), trs(0, 0, D / 2 + 0.25 + (steps - k) * 0.26 - 0.1));
      }
      const by = plat;
      const inset = 0.32;
      const bw = W - inset * 2, bd = D - inset * 2;
      // 墙体
      const wallKey = o.wall || 'plaster_red';
      add(wallKey, box(bw, h, 0.2), trs(0, by, -bd / 2 + 0.1));
      add(wallKey, box(0.2, h, bd), trs(-bw / 2 + 0.1, by, 0));
      add(wallKey, box(0.2, h, bd), trs(bw / 2 - 0.1, by, 0));
      // 前檐：柱、格扇
      const bays = o.bays || Math.max(1, Math.round(bw / 1.5));
      const bayW = bw / bays;
      const colR = o.colR ?? 0.12;
      for (let i = 0; i <= bays; i++) {
        const px = -bw / 2 + i * bayW;
        add(o.colKey || 'lacquer', cyl(colR, colR * 1.05, h, 8), trs(px, by, bd / 2));
        add('stone_grey', cyl(colR * 1.6, colR * 1.7, 0.12, 8), trs(px, by, bd / 2)); // 柱础
      }
      // 后檐与山面的柱（隐约可见）
      for (let i = 0; i <= bays; i += bays) for (const zz of [-bd / 2]) add(o.colKey || 'lacquer', cyl(colR, colR, h, 8), trs(-bw / 2 + i * bayW, by, zz));
      const front = o.front || 'lattice';
      for (let i = 0; i < bays; i++) {
        const px = -bw / 2 + (i + 0.5) * bayW;
        const isMid = i === Math.floor(bays / 2);
        if (front === 'open') continue;
        if (front === 'door' && isMid) { add('red_door', quad(bayW - colR * 2, h * 0.92), trs(px, by, bd / 2 - 0.12), { uv: 'keep' }); continue; }
        if (front === 'shop') { if (!isMid) add('wood', box(bayW - colR * 2, h * 0.36, 0.3), trs(px, by, bd / 2 - 0.1)); continue; }
        const lat = o.latticeKey || (i % 2 ? 'lattice' : 'lattice2');
        add(lat, quadUV(bayW - colR * 2, h * 0.95, 2, 1), trs(px, by, bd / 2 - 0.12), { uv: 'keep' });
      }
      if (front === 'open' || front === 'shop') add(o.floorKey || 'wood_floor', box(bw, 0.02, bd), trs(0, by, 0));
      // 额枋与斗拱带
      add('c:#2f5f6a', box(bw + 0.1, 0.24, 0.16), trs(0, by + h - 0.24, bd / 2 + 0.02));
      if (o.dougong !== false) {
        const dg = 0.36;
        add('dougong', box(bw + 0.4, dg, bd + 0.4), trs(0, by + h, 0));
      }
      const roofY = by + h + (o.dougong !== false ? 0.36 : 0);
      const rtype = o.roof || 'xieshan';
      const rise = o.rise ?? Math.min(W, D) * 0.4 + 0.3;
      if (o.double) {
        // 重檐：下檐一圈 + 上层屋身 + 上檐
        addRoof(batch, roof({ skirt: 0.42, w: bw + eave * 2 + 0.2, d: bd + eave * 2 + 0.2, rise: rise * 0.7, tile: o.tile || 'roof_grey', lift: 0.3 }), F(trs(0, roofY, 0)), grp);
        const uh = o.upperH ?? h * 0.55;
        const uw = bw * 0.78, ud = bd * 0.7;
        add(wallKey, box(uw, uh + 0.3, ud), trs(0, roofY + rise * 0.18, 0));
        for (let i = 0; i < 4; i++) add(o.latticeKey || 'lattice', quadUV(uw / 4 - 0.1, uh * 0.7, 1, 1), trs(-uw / 2 + (i + 0.5) * uw / 4, roofY + rise * 0.3, ud / 2 + 0.01), { uv: 'keep' });
        if (o.dougong !== false) add('dougong', box(uw + 0.3, 0.3, ud + 0.3), trs(0, roofY + rise * 0.18 + uh + 0.3, 0));
        addRoof(batch, roof({ type: rtype, w: uw + eave * 2, d: ud + eave * 2, rise: rise * 0.85, tile: o.tile || 'roof_grey', lift: 0.32, curve: 1.8 }), F(trs(0, roofY + rise * 0.18 + uh + 0.6, 0)), grp);
      } else {
        addRoof(batch, roof({ type: rtype, w: bw + eave * 2, d: bd + eave * 2, rise, tile: o.tile || 'roof_grey', lift: o.lift ?? 0.34, curve: o.curve ?? 1.75, gableKey: o.gableKey }), F(trs(0, roofY, 0)), grp);
      }
      // 匾额
      if (o.sign) {
        const t = signTexture(o.sign, o.signStyle || {});
        const sw = Math.min(bw * 0.5, 0.42 * [...o.sign].length + 0.4), sh = sw * (t.image.height / t.image.width);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshLambertMaterial({ map: t }));
        const p = new THREE.Vector3(0, by + h + 0.05 - sh / 2 - 0.02, bd / 2 + 0.22).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        m.position.set(cx + p.x, y0 + p.y, cz + p.z);
        m.rotation.y = rot;
        addMesh(m);
      }
      if (o.solid !== false) solid(x, z, w, d);
      if (o.walkPlat) world.setFloor(x, z, w, d, plat);
      return { roofY: y0 + roofY, top: y0 + roofY + rise };
    },

    // ------------------------------------------------------------ 江南民居（白墙黛瓦马头墙）
    house(o) {
      const { x, z, w, d } = o;
      const h = o.h ?? 2.5;
      const cx = x + w / 2, cz = z + d / 2;
      const y0 = o.y ?? H(cx, cz);
      const rot = (o.rot || 0) * R90;
      const F = frame(cx, y0, cz, rot);
      const grp = o.occluder ? 'occluder:' + (o.occluder === true ? `house${x}_${z}` : o.occluder) : undefined;
      const add = (key, g, m, opt = {}) => batch.add(key, g, F(m), { group: grp, ...opt });
      const W = (o.rot || 0) % 2 ? d : w, D = (o.rot || 0) % 2 ? w : d;
      const bw = W - 0.2, bd = D - 0.2;
      add('stone_block', box(bw + 0.1, 0.3, bd + 0.1), trs(0, 0, 0));
      add(o.wall || 'plaster', box(bw, h, bd), trs(0, 0.3, 0));
      // 墙裙（下部灰色）
      add('c:#8a8a84', box(bw + 0.02, 0.35, bd + 0.02), trs(0, 0.3, 0));
      // 门
      if (o.door !== false) {
        const dx = o.doorX ?? 0;
        add('c:#2a211b', box(1.0, 2.0, 0.08), trs(dx, 0.3, bd / 2 + 0.01));
        add(o.doorKey || 'wood_dark', quadUV(0.9, 1.9, 1, 1), trs(dx, 0.32, bd / 2 + 0.06), { uv: 'keep' });
        add('c:#3a3f44', box(1.3, 0.12, 0.35), trs(dx, 0.3 + 2.02, bd / 2 + 0.12)); // 门罩
        add('roof_dark', box(1.4, 0.08, 0.5), trs(dx, 0.3 + 2.14, bd / 2 + 0.16));
      }
      // 窗
      const nWin = o.windows ?? Math.max(0, Math.floor((bw - 1.6) / 1.6));
      for (let i = 0; i < nWin; i++) {
        const side = i % 2 ? 1 : -1;
        const wx = side * (0.9 + Math.floor(i / 2) * 1.4 + 0.4);
        if (Math.abs(wx) > bw / 2 - 0.4) continue;
        add('lattice3', quadUV(0.8, 0.8, 1, 0.5), trs(wx, 0.3 + (o.upper ? 1.6 : 1.1), bd / 2 + 0.02), { uv: 'keep' });
      }
      // 屋顶（沿面阔的两坡）
      const rise = o.rise ?? Math.min(1.6, bd * 0.36);
      const roofY = 0.3 + h;
      addRoof(batch, roof({ type: 'xuanshan', w: bw + 0.3, d: bd + 0.9, rise, tile: o.tile || 'roof_grey', lift: 0.08, curve: 1.3, gableInset: 0.18, gableKey: o.wall || 'plaster' }), F(trs(0, roofY, 0)), grp);
      // 马头墙：两山墙出屋面、层层跌落
      if (o.matou !== false) {
        for (const s of [-1, 1]) {
          const steps = 3;
          for (let k = 0; k < steps; k++) {
            const zc = (k - (steps - 1) / 2) * (bd / steps);
            const hh = rise * (1 - Math.abs(zc) / (bd / 2 + 0.2)) + 0.55;
            add(o.wall || 'plaster', box(0.26, hh, bd / steps + 0.02), trs(s * (bw / 2 + 0.02), roofY - 0.1, zc));
            add('roof_dark', box(0.46, 0.1, bd / steps + 0.12), trs(s * (bw / 2 + 0.02), roofY - 0.1 + hh, zc));
            add('c:#2c2e31', box(0.2, 0.14, 0.2), trs(s * (bw / 2 + 0.02), roofY - 0.1 + hh + 0.08, zc + bd / steps / 2 - 0.05));
          }
        }
      }
      if (o.solid !== false) solid(x, z, w, d);
    },

    // ------------------------------------------------------------ 城门（带拱券门洞，可穿行）
    cityGate(o) {
      const { x, z, w, d } = o; // 门洞沿 z 方向穿过；x..x+w 为城台宽，z..z+d 为进深
      const h = o.h ?? 6;
      const cx = x + w / 2, cz = z + d / 2;
      const y0 = o.y ?? 0;
      const grp = 'occluder:' + (o.name || `gate${x}_${z}`);
      const holes = (o.arches || [{ x: 0, w: 3, h: 2.6 }]).map((a) => ({ ...a }));
      const g = archWall(w, h, d, holes);
      batch.add(o.key || 'citybrick', g, trs(cx, y0, cz), { group: grp });
      // 门洞地面与门扇
      for (const a of holes) {
        batch.add('stone_grey', box(a.w, 0.02, d), trs(cx + a.x, y0, cz), { group: grp });
        if (o.doors) for (const s of [-1, 1]) batch.add('red_door', quadUV(a.w / 2, a.h + a.w / 2 - 0.3, 1, 1), trs(cx + a.x + s * a.w * 0.62, y0, cz - d / 2 + 0.3, s * 1.2), { uv: 'keep', group: grp });
        // 券脸（拱圈石）
        for (let i = 0; i <= 16; i++) {
          const t = Math.PI * i / 16;
          const r = a.w / 2 + 0.12;
          batch.add('stone_block_light', box(0.3, 0.3, 0.1), trs(cx + a.x + Math.cos(t) * r, y0 + a.h + Math.sin(t) * r - 0.15, cz + d / 2 + 0.02, 0, 1, 1, 1, 0, t - R90), { group: grp });
        }
        // 碰撞：门洞两侧实心，门洞可走
      }
      // 顶部垛口
      if (o.crenels !== false) {
        for (let i = 0; i < w; i += 1) {
          batch.add(o.key || 'citybrick', box(0.62, 0.55, 0.3), trs(x + i + 0.5, y0 + h, z + d - 0.15), { group: grp });
          batch.add(o.key || 'citybrick', box(0.62, 0.55, 0.3), trs(x + i + 0.5, y0 + h, z + 0.15), { group: grp });
        }
        batch.add(o.key || 'citybrick', box(w, 0.3, 0.3), trs(cx, y0 + h, z + d - 0.15), { group: grp });
      }
      batch.add('brick_pave', box(w - 0.02, 0.02, d - 0.02), trs(cx, y0 + h, cz), { group: grp });
      // 碰撞：整个城台实心，门洞列除外
      solid(x, z, w, d);
      for (const a of holes) {
        const hx0 = Math.floor(cx + a.x - a.w / 2 + 0.3), hx1 = Math.ceil(cx + a.x + a.w / 2 - 0.3);
        for (let tz = z; tz < z + d; tz++) for (let tx = hx0; tx < hx1; tx++) if (world.inBounds(tx, tz)) world.solid[world.idx(tx, tz)] = 0;
      }
      // 匾额
      if (o.sign) {
        const t = signTexture(o.sign, { vertical: false, bg: '#26303a', ...(o.signStyle || {}) });
        const sw = 0.55 * [...o.sign].length + 0.5, sh = sw * t.image.height / t.image.width;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshLambertMaterial({ map: t }));
        m.position.set(cx + (holes[0]?.x || 0), y0 + (holes[0]?.h || 2.6) + (holes[0]?.w || 3) / 2 + 0.3 + sh / 2, z + d + 0.04);
        addMesh(m);
        m.userData.occluder = o.name;
      }
      return { top: y0 + h, grp };
    },

    // ------------------------------------------------------------ 普通院墙（带瓦顶）
    wall(x0, z0, x1, z1, o = {}) {
      const h = o.h ?? 2.2, t = o.t ?? 0.35;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(-(z1 - z0), x1 - x0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const y0 = o.y ?? 0;
      batch.add(o.key || 'plaster', box(len, h, t), trs(mx, y0, mz, ang));
      if (o.cap !== false) {
        batch.add(o.capKey || 'roof_dark', box(len + 0.1, 0.1, t + 0.36), trs(mx, y0 + h, mz, ang));
        batch.add('c:#2c2e31', box(len + 0.1, 0.12, 0.12), trs(mx, y0 + h + 0.1, mz, ang));
      }
      if (o.base !== false) batch.add('c:#8a8a84', box(len + 0.02, 0.3, t + 0.02), trs(mx, y0, mz, ang));
      if (o.solid !== false) {
        const n = Math.ceil(len * 2);
        for (let k = 0; k <= n; k++) { const px = x0 + (x1 - x0) * k / n, pz = z0 + (z1 - z0) * k / n; const tx = Math.floor(px - (x1 > x0 ? 0.001 : -0.001) * 0), tz = Math.floor(pz); if (world.inBounds(tx, tz)) world.solid[world.idx(tx, tz)] = 1; }
      }
    },
    /** 木栅栏 */
    fence(x0, z0, x1, z1, o = {}) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 0.5));
      for (let k = 0; k <= n; k++) {
        const px = x0 + (x1 - x0) * k / n, pz = z0 + (z1 - z0) * k / n;
        batch.add(o.key || 'wood_light', box(0.1, o.h ?? 0.9, 0.1), trs(px, H(px, pz), pz));
      }
      const ang = Math.atan2(-(z1 - z0), x1 - x0);
      for (const hh of [0.3, 0.7]) batch.add(o.key || 'wood_light', box(len, 0.07, 0.05), trs((x0 + x1) / 2, H((x0 + x1) / 2, (z0 + z1) / 2) + hh, (z0 + z1) / 2, ang));
      if (o.solid !== false) { const m = Math.ceil(len * 2); for (let k = 0; k <= m; k++) { const px = x0 + (x1 - x0) * k / m, pz = z0 + (z1 - z0) * k / m; const tx = Math.floor(px), tz = Math.floor(pz); if (world.inBounds(tx, tz)) world.solid[world.idx(tx, tz)] = 1; } }
    },

    // ------------------------------------------------------------ 亭、牌坊、塔
    pavilion(o) {
      const { x, z } = o;
      const r = o.r ?? 1.4, h = o.h ?? 2.3, sides = o.sides ?? 6;
      const y0 = o.y ?? H(x, z);
      batch.add('stone_block_light', cyl(r + 0.4, r + 0.5, 0.35, sides), trs(x, y0, z, Math.PI / sides));
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
        batch.add('lacquer', cyl(0.09, 0.1, h, 6), trs(x + Math.cos(a) * r, y0 + 0.35, z + Math.sin(a) * r));
        if (o.bench !== false && i !== Math.floor(sides * 0.25)) {
          const a2 = a + Math.PI / sides;
          batch.add('wood', box(r * 1.0, 0.08, 0.3), trs(x + Math.cos(a2) * r * 0.88, y0 + 0.75, z + Math.sin(a2) * r * 0.88, -a2 + R90));
        }
      }
      batch.add('dougong', cyl(r + 0.15, r + 0.15, 0.3, sides), trs(x, y0 + 0.35 + h, z, Math.PI / sides));
      addRoof(batch, roof({ type: 'pyramid', sides, radius: r + 0.9, rise: o.rise ?? 1.5, tile: o.tile || 'roof_grey', lift: 0.45 }), trs(x, y0 + 0.35 + h + 0.3, z, sides === 4 ? 0 : 0));
      solid(Math.floor(x - r), Math.floor(z - r), Math.ceil(r * 2), Math.ceil(r * 2));
      if (o.open) world.solid.fill(0, 0, 0);
    },
    /** 牌坊：三间四柱 */
    pailou(o) {
      const { x, z } = o; // 中心
      const w = o.w ?? 7, h = o.h ?? 4.2;
      const y0 = o.y ?? H(x, z);
      const rot = (o.rot || 0) * R90;
      const F = frame(x, y0, z, rot);
      const cols = [-w / 2, -w / 6, w / 6, w / 2];
      for (const px of cols) {
        batch.add(o.colKey || 'lacquer', box(0.32, px === cols[1] || px === cols[2] ? h : h * 0.8, 0.32), F(trs(px, 0, 0)));
        batch.add('stone_block_light', box(0.6, 0.5, 0.6), F(trs(px, 0, 0)));
      }
      batch.add('c:#2f5f6a', box(w / 3 + 0.3, 0.3, 0.3), F(trs(0, h - 0.6, 0)));
      batch.add('dougong', box(w / 3 + 0.3, 0.28, 0.36), F(trs(0, h - 0.3, 0)));
      addRoof(batch, roof({ type: 'wudian', w: w / 3 + 1.4, d: 1.1, rise: 0.55, tile: o.tile || 'roof_blue', lift: 0.25, beasts: false }), F(trs(0, h - 0.05, 0)));
      for (const s of [-1, 1]) {
        batch.add('c:#2f5f6a', box(w / 3, 0.26, 0.28), F(trs(s * w / 3, h * 0.8 - 0.5, 0)));
        batch.add('dougong', box(w / 3, 0.24, 0.32), F(trs(s * w / 3, h * 0.8 - 0.25, 0)));
        addRoof(batch, roof({ type: 'wudian', w: w / 3 + 0.9, d: 0.95, rise: 0.42, tile: o.tile || 'roof_blue', lift: 0.22, beasts: false }), F(trs(s * w / 3, h * 0.8 - 0.02, 0)));
      }
      if (o.text) {
        const t = signTexture(o.text, { bg: o.signBg || '#1e3a4a', ...(o.signStyle || {}) });
        const sw = Math.min(w / 3 - 0.2, 0.5 * [...o.text].length + 0.4), sh = sw * t.image.height / t.image.width;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
        const p = new THREE.Vector3(0, h - 0.85 - sh / 2, 0.18).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        m.position.set(x + p.x, y0 + p.y, z + p.z); m.rotation.y = rot;
        addMesh(m);
      }
      for (const px of cols) { const p = new THREE.Vector3(px, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); solid(Math.floor(x + p.x), Math.floor(z + p.z), 1, 1); }
    },
    /** 八角多层塔（琉璃塔） */
    pagoda(o) {
      const { x, z } = o;
      const levels = o.levels ?? 9;
      const y0 = o.y ?? H(x, z);
      let r = o.r ?? 3.2, y = y0;
      const shrink = o.shrink ?? 0.9;
      const lh = o.levelH ?? 2.1;
      const lamps = [];
      const from = o.from ?? 0, to = o.to ?? levels; // 只建 [from, to) 层（分段修复用）
      const real = batch.add;
      if (from === 0) batch.add('stone_block_light', cyl(r + 1.3, r + 1.5, 0.8, 8), trs(x, y, z, Math.PI / 8));
      y += 0.8;
      for (let i = 0; i < levels; i++) {
        batch.add = i >= from && i < to ? real : () => {};
        const hh = lh * (i === 0 ? 1.25 : 1) * Math.pow(0.97, i);
        batch.add(o.bodyKey || 'porcelain', cyl(r, r * 1.02, hh, 8), trs(x, y, z, Math.PI / 8));
        // 拱门（每面一个，交替深色）
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const fx = Math.cos(a) * r * 0.93, fz = Math.sin(a) * r * 0.93;
          const dark = k % 2 === 0;
          batch.add(dark ? 'c:#2a2420' : 'glaze_yellow', box(r * 0.42, hh * 0.55, 0.06), trs(x + fx, y + hh * 0.12, z + fz, -a + R90));
          if (dark) batch.add('glaze_green', box(r * 0.56, 0.12, 0.08), trs(x + Math.cos(a) * r * 0.95, y + hh * 0.68, z + Math.sin(a) * r * 0.95, -a + R90));
        }
        // 腰檐
        const er = r + 0.95;
        addRoof(batch, roof({ type: 'pyramid', sides: 8, radius: er, rise: 0.9, tile: o.eaveTile || 'roof_green', lift: 0.35 }).filter(([k]) => k.startsWith('roof_')), trs(x, y + hh, z, Math.PI / 8 * 0));
        // 平座
        batch.add('glaze_white', cyl(r * shrink + 0.25, r * shrink + 0.3, 0.3, 8), trs(x, y + hh + 0.55, z, Math.PI / 8));
        // 檐角风铃/灯
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
          lamps.push([x + Math.cos(a) * (er + 0.05), y + hh + 0.05, z + Math.sin(a) * (er + 0.05)]);
        }
        y += hh + 0.55;
        r *= shrink;
      }
      batch.add = to >= levels ? real : () => {};
      // 塔刹
      addRoof(batch, roof({ type: 'pyramid', sides: 8, radius: r + 0.8, rise: 1.3, tile: o.eaveTile || 'roof_green', lift: 0.3 }).filter(([k]) => k.startsWith('roof_')), trs(x, y, z));
      for (let k = 0; k < 7; k++) batch.add('c:#d9b24a', cyl(0.28 - k * 0.025, 0.3 - k * 0.025, 0.14, 10), trs(x, y + 1.2 + k * 0.22, z));
      const orb = new THREE.SphereGeometry(0.34, 10, 8); orb.translate(0, 0, 0);
      batch.add('c:#e8c050', orb, trs(x, y + 3.0, z));
      batch.add = real;
      if (from === 0) solid(Math.floor(x - (o.r ?? 3.2) - 1), Math.floor(z - (o.r ?? 3.2) - 1), Math.ceil(((o.r ?? 3.2) + 1) * 2), Math.ceil(((o.r ?? 3.2) + 1) * 2));
      return { lamps, top: y + 3.2 };
    },

    // ------------------------------------------------------------ 桥
    /** 拱桥：沿 dir 方向跨越；x,z 为起点格，len 格数，w 宽（格） */
    bridge(o) {
      const { x, z, len } = o;
      const w = o.w ?? 2;
      const dir = o.dir || 'z'; // 'z' 南北向，'x' 东西向
      const peak = o.h ?? 1.2;
      world.addBridge({ x, z, len, w, dir, peak });
      // 桥身：沿跨度拉伸的拱形截面，顶面即桥面
      const L = len, mid = len / 2;
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(t * L - mid, Math.sin(t * Math.PI) * peak)); }
      const outline = [new THREE.Vector2(-mid, -0.9), ...pts, new THREE.Vector2(mid, -0.9)];
      const shape = new THREE.Shape(outline);
      const ar = Math.min(L * 0.3, peak * 1.5 + 0.4);
      const hole = new THREE.Path();
      hole.moveTo(ar, -0.9);
      hole.absarc(0, -0.9, ar, 0, Math.PI, false);
      hole.lineTo(ar, -0.9);
      shape.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 16 });
      if (dir === 'x') batch.add(o.key || 'stone_block_light', g, trs(x + mid, 0, z));
      else batch.add(o.key || 'stone_block_light', g, trs(x + w, 0, z + mid, -R90));
      // 栏板
      for (let i = 0; i <= len * 2; i++) {
        const t = i / (len * 2);
        const hgt = Math.sin(t * Math.PI) * peak;
        for (const side of [0, w]) {
          const px = dir === 'x' ? x + t * len : x + side, pz = dir === 'x' ? z + side : z + t * len;
          batch.add('stone_block_light', box(0.14, 0.62, 0.14), trs(px, hgt, pz));
        }
      }
      for (const side of [0, w]) {
        for (let i = 0; i < len * 2; i++) {
          const t0 = i / (len * 2), t1 = (i + 1) / (len * 2);
          const h0 = Math.sin(t0 * Math.PI) * peak, h1 = Math.sin(t1 * Math.PI) * peak;
          const seg = Math.hypot(len / (len * 2), h1 - h0);
          const px = dir === 'x' ? x + (t0 + t1) / 2 * len : x + side, pz = dir === 'x' ? z + side : z + (t0 + t1) / 2 * len;
          const slope = Math.atan2(h1 - h0, len / (len * 2));
          if (dir === 'x') batch.add('stone_block_light', box(seg, 0.42, 0.08), trs(px, (h0 + h1) / 2 + 0.02, pz, 0, 1, 1, 1, 0, slope));
          else batch.add('stone_block_light', box(0.08, 0.42, seg), trs(px, (h0 + h1) / 2 + 0.02, pz, 0, 1, 1, 1, -slope, 0));
        }
      }
    },

    // ------------------------------------------------------------ 船
    ship(o) {
      const { x, z } = o;
      const kind = o.kind || 'boat';
      const rot = (o.rot || 0);
      const y0 = o.y ?? -0.2;
      const L = o.len ?? (kind === 'treasure' ? 22 : kind === 'huafang' ? 6 : 4);
      const Bm = o.beam ?? (kind === 'treasure' ? 6 : kind === 'huafang' ? 1.9 : 1.3);
      const grp = o.group;
      const F = frame(x, y0, z, rot);
      const parts = o.parts || 'all'; // 'all' | 'hull'（不带桅帆）| 'rig'（只有桅帆）
      const add = (key, g, m, opt = {}) => { if (parts === 'rig' && !opt.rig) return; if (parts === 'hull' && opt.rig) return; batch.add(key, g, F(m), { group: grp, ...opt, rig: undefined }); };
      // 船体：沿 x 放样
      const seg = 16;
      const pos = [], idx = [];
      const prof = (t) => { // t 0 船尾 → 1 船头
        const beam = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08 + 0.02)), 0.6) * Bm / 2 * (t < 0.12 ? 0.8 + t * 1.6 : 1);
        const sheer = (kind === 'treasure' ? 1.7 : 0.55) + Math.pow(Math.abs(t - 0.45) * 2, 2) * (kind === 'treasure' ? 1.3 : 0.35) + (t < 0.12 ? (0.12 - t) * (kind === 'treasure' ? 12 : 3) : 0);
        const depth = (kind === 'treasure' ? 1.3 : 0.45) * (0.6 + 0.4 * Math.sin(Math.PI * t));
        return { beam, sheer, depth };
      };
      const ring = 7;
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        const { beam, sheer, depth } = prof(t);
        const px = (t - 0.5) * L;
        for (let k = 0; k < ring; k++) {
          const a = (k / (ring - 1)) * Math.PI; // 0 左舷顶 → π 右舷顶，经过船底
          const sx = -Math.cos(a);
          const yy = sheer - Math.sin(a) * (sheer + depth);
          pos.push(px, yy, sx * beam * (0.55 + 0.45 * Math.sin(a) ** 0.3 * 0 + 0.45));
        }
      }
      for (let i = 0; i < seg; i++) for (let k = 0; k < ring - 1; k++) {
        const a = i * ring + k, b = a + ring;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const hull = new THREE.BufferGeometry();
      hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      hull.setIndex(idx);
      hull.computeVertexNormals();
      add(o.hullKey || 'wood_dark', hull, null);
      // 甲板
      const deckPts = [];
      for (let i = 0; i <= seg; i++) { const t = i / seg; const { beam, sheer } = prof(t); deckPts.push([(t - 0.5) * L, sheer - 0.12, beam * 0.98]); }
      const dpos = [], didx = [];
      deckPts.forEach(([px, py, bz]) => { dpos.push(px, py, -bz, px, py, bz); });
      for (let i = 0; i < seg; i++) { const a = i * 2; didx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const deck = new THREE.BufferGeometry();
      deck.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
      deck.setIndex(didx); deck.computeVertexNormals();
      add('wood_floor', deck, null);
      // 船舷彩带
      add(kind === 'treasure' ? 'c:#9a2f24' : 'c:#6a3a24', box(L * 0.8, 0.18, Bm * 1.02), trs(L * 0.02, prof(0.5).sheer - 0.28, 0));
      if (kind === 'treasure') {
        // 艉楼
        add('wood', box(L * 0.18, 1.6, Bm * 0.8), trs(-L * 0.38, prof(0.12).sheer - 0.1, 0));
        add('c:#9a2f24', box(L * 0.19, 0.2, Bm * 0.82), trs(-L * 0.38, prof(0.12).sheer + 1.5, 0));
        if (parts !== 'rig') addRoof(batch, roof({ type: 'xieshan', w: L * 0.22, d: Bm * 0.95, rise: 0.8, tile: 'roof_dark', lift: 0.25, beasts: false }), F(trs(-L * 0.38, prof(0.12).sheer + 1.7, 0)), grp);
        for (let k = 0; k < 4; k++) add('lattice3', quadUV(0.6, 0.6, 1, 0.5), trs(-L * 0.38 - L * 0.06 + k * L * 0.04, prof(0.12).sheer + 0.5, Bm * 0.41, R90 * 0), { uv: 'keep' });
        // 船头龙目
        const eye = new THREE.CircleGeometry(0.32, 12);
        for (const s of [-1, 1]) {
          const eg = eye.clone(); eg.rotateY(s > 0 ? 0 : Math.PI);
          add('c:#f0e6c8', eg, trs(L * 0.43, prof(0.93).sheer - 0.5, s * (prof(0.93).beam + 0.02)));
          const pupil = new THREE.CircleGeometry(0.16, 10); pupil.rotateY(s > 0 ? 0 : Math.PI);
          add('c:#1a1a1a', pupil, trs(L * 0.43 + 0.04, prof(0.93).sheer - 0.5, s * (prof(0.93).beam + 0.03)));
        }
        // 桅与帆
        const masts = o.masts ?? 5;
        for (let m = 0; m < masts; m++) {
          const t = 0.22 + (m / Math.max(1, masts - 1)) * 0.62;
          const mh = (m === Math.floor(masts / 2) ? 13 : 10.5) * (o.mastScale ?? 1);
          const px = (t - 0.5) * L;
          const dy = prof(t).sheer;
          add('wood_dark', cyl(0.14, 0.2, mh, 6), trs(px, dy, 0), { rig: true });
          const sw = mh * 0.46, sh = mh * 0.62;
          const sg = new THREE.PlaneGeometry(sw, sh, 1, 1);
          add(o.sailKey || 'sail', sg, trs(px + 0.25, dy + mh - sh / 2 - 0.4, 0, R90 * 0.08 + R90), { uv: 'world', rig: true });
          for (let b = 0; b < 6; b++) add('c:#6a4a2a', box(0.06, 0.06, sw + 0.1), trs(px + 0.3, dy + mh - 0.6 - b * sh / 5.5, 0), { rig: true });
          // 旗
          add('c:#c43a2c', box(0.03, 0.5, 0.9), trs(px, dy + mh + 0.1, 0.45), { rig: true });
        }
      } else if (kind === 'huafang') {
        // 画舫：船舱 + 小屋顶 + 灯笼
        add('lacquer', box(L * 0.5, 1.3, Bm * 0.8), trs(0, prof(0.5).sheer - 0.1, 0));
        for (let k = 0; k < 3; k++) add('lattice', quadUV(L * 0.14, 0.9, 1, 0.5), trs(-L * 0.17 + k * L * 0.17, prof(0.5).sheer + 0.15, Bm * 0.41), { uv: 'keep' });
        addRoof(batch, roof({ type: 'xieshan', w: L * 0.62, d: Bm * 1.05, rise: 0.55, tile: 'roof_dark', lift: 0.25, beasts: false }), F(trs(0, prof(0.5).sheer + 1.2, 0)), grp);
        for (const s of [-1, 1]) {
          const p = new THREE.Vector3(s * L * 0.3, prof(0.5).sheer + 1.0, Bm * 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
          B.hangLantern(x + p.x, y0 + p.y, z + p.z, { color: '#ff5a3a' });
        }
      } else {
        // 小船：篷
        const hood = new THREE.CylinderGeometry(Bm * 0.45, Bm * 0.45, L * 0.35, 10, 1, true, 0, Math.PI);
        hood.rotateZ(R90); hood.rotateY(0);
        add('roof_thatch|ds', hood, trs(-L * 0.05, prof(0.5).sheer - 0.05, 0), { uv: 'world' });
      }
      if (o.solid !== false && parts !== 'rig') {
        const a = rot;
        for (let t = -L / 2; t <= L / 2; t += 0.5) for (let s = -Bm / 2; s <= Bm / 2; s += 0.5) {
          const px = x + Math.cos(a) * t + Math.sin(a) * s, pz = z - Math.sin(a) * t + Math.cos(a) * s;
          const tx = Math.floor(px), tz = Math.floor(pz);
          if (world.inBounds(tx, tz)) world.solid[world.idx(tx, tz)] = 1;
        }
      }
    },

    // ------------------------------------------------------------ 窑、棚、脚手架
    kiln(o) {
      const { x, z } = o;
      const r = o.r ?? 1.8;
      const y0 = H(x, z);
      const dome = new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.scale(1, 0.85, 1);
      batch.add(o.key || 'citybrick_warm', cyl(r, r + 0.1, 0.7, 12), trs(x, y0, z));
      batch.add(o.key || 'citybrick_warm', dome, trs(x, y0 + 0.7, z));
      batch.add('citybrick_warm', cyl(0.3, 0.38, 1.4, 8), trs(x + r * 0.35, y0 + 0.7 + r * 0.72, z - r * 0.2));
      // 窑门（发光）
      batch.add('c:#2a1a14', box(0.9, 0.9, 0.2), trs(x, y0, z + r - 0.05));
      if (o.fire !== false) {
        batch.add('e:#ff7a2a', box(0.62, 0.55, 0.1), trs(x, y0 + 0.05, z + r + 0.02), { shadow: false });
        B.light(x, y0 + 0.5, z + r + 0.5, '#ff8a3a', 1.4, { radius: 5 });
        B.glow(x, y0 + 0.4, z + r + 0.2, '#ff8a3a', 1.6);
      }
      solid(Math.floor(x - r), Math.floor(z - r), Math.ceil(r * 2), Math.ceil(r * 2));
      return { chimney: [x + r * 0.35, y0 + 0.7 + r * 0.72 + 1.4, z - r * 0.2], door: [x, y0 + 0.3, z + r + 0.1] };
    },
    shed(o) {
      const { x, z, w, d } = o;
      const h = o.h ?? 2.1;
      const y0 = H(x + w / 2, z + d / 2);
      for (const [px, pz] of [[x + 0.2, z + 0.2], [x + w - 0.2, z + 0.2], [x + 0.2, z + d - 0.2], [x + w - 0.2, z + d - 0.2]]) batch.add('wood', box(0.16, h, 0.16), trs(px, y0, pz));
      addRoof(batch, roof({ type: 'xuanshan', w: w + 0.5, d: d + 0.6, rise: o.rise ?? 0.9, tile: o.tile || 'roof_thatch', lift: 0.02, curve: 1.1, gableKey: 'wood' }), trs(x + w / 2, y0 + h, z + d / 2));
      if (o.solid) solid(x, z, w, d);
      else for (const [px, pz] of [[x, z], [x + w - 1, z], [x, z + d - 1], [x + w - 1, z + d - 1]]) solid(px, pz, 1, 1);
    },
    scaffold(o) {
      const { x, z, w, h } = o;
      const y0 = o.y ?? 0;
      const zz = z;
      for (let i = 0; i <= w; i += 1.5) batch.add('c:#b89a5a', cyl(0.05, 0.05, h, 5), trs(x + i, y0, zz));
      for (let k = 1; k * 1.4 < h; k++) {
        batch.add('c:#a88a4a', box(w, 0.06, 0.06), trs(x + w / 2, y0 + k * 1.4, zz));
        batch.add('wood_light', box(w, 0.06, 0.6), trs(x + w / 2, y0 + k * 1.4, zz - 0.3));
      }
      for (let i = 0; i < w; i += 1.5) batch.add('c:#a88a4a', box(0.05, h * 0.9, 0.05), trs(x + i + 0.75, y0 + h * 0.05, zz, 0, 1, 1, 1, 0, 0.5));
    },
    stall(o) {
      const { x, z } = o;
      const w = o.w ?? 2, d = o.d ?? 1.2;
      const y0 = H(x + w / 2, z + d / 2);
      batch.add('wood', box(w, 0.85, d * 0.7), trs(x + w / 2, y0, z + d * 0.55));
      for (const px of [x + 0.1, x + w - 0.1]) batch.add('wood_dark', box(0.08, 2.1, 0.08), trs(px, y0, z + d - 0.05));
      for (const px of [x + 0.1, x + w - 0.1]) batch.add('wood_dark', box(0.08, 2.3, 0.08), trs(px, y0, z + 0.05));
      const cloth = new THREE.PlaneGeometry(w + 0.3, d + 0.3);
      cloth.rotateX(-Math.PI / 2 + 0.28);
      batch.add('c:' + (o.awning || '#b8453a') + '|ds', cloth, trs(x + w / 2, y0 + 2.2, z + d / 2), { uv: 'world' });
      if (o.goods) for (let i = 0; i < 4; i++) batch.add('c:' + (o.goods[i % o.goods.length]), box(0.3, 0.2 + (i % 2) * 0.1, 0.3), trs(x + 0.35 + i * (w - 0.7) / 3, y0 + 0.85, z + d * 0.55));
      if (o.sign) {
        const t = signTexture(o.sign, { vertical: true, bg: o.signBg || '#f0e2c0', color: '#2a2018', border: '#8a3a2a' });
        const sh = 0.36 * [...o.sign].length + 0.3, sw = sh * t.image.width / t.image.height;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
        m.position.set(x + w + 0.25, y0 + 2.0 - sh / 2, z + d - 0.05);
        addMesh(m);
        dyn.push({ type: 'banner', mesh: m, base: m.rotation.y, ph: R() * 6 });
      }
      solid(Math.floor(x), Math.floor(z), Math.ceil(w), Math.ceil(d));
    },

    // ------------------------------------------------------------ 灯
    glow(x, y, z, color = '#ffb060', size = 1.2, o = {}) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: o.opacity ?? 0.55, toneMapped: false }));
      m.position.set(x, y, z);
      m.scale.set(size, size, 1);
      m.renderOrder = 6;
      m.userData.glow = { base: size, ph: R() * 6, night: o.nightOnly ?? true };
      addMesh(m);
      dyn.push({ type: 'glow', mesh: m });
      return m;
    },
    hangLantern(x, y, z, o = {}) {
      const col = o.color || '#ff5a3a';
      const g = new THREE.CylinderGeometry(0.2, 0.2, 0.36, 10);
      const body = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(o.lit === false ? 0.5 : 1.6), toneMapped: false }));
      body.scale.set(1, 1, 1);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8), new THREE.MeshLambertMaterial({ color: '#2a2018' }));
      cap.position.y = 0.21;
      const cap2 = cap.clone(); cap2.position.y = -0.21;
      const tassel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), new THREE.MeshLambertMaterial({ color: '#e0b040' }));
      tassel.position.y = -0.34;
      const grp = new THREE.Group();
      grp.add(body, cap, cap2, tassel);
      grp.position.set(x, y, z);
      addMesh(grp);
      dyn.push({ type: 'lantern', mesh: grp, ph: R() * 6, body });
      if (o.lit !== false) {
        B.light(x, y, z, col, o.intensity ?? 0.9, { radius: o.radius ?? 3.2 });
        B.glow(x, y, z, col, o.glow ?? 1.4);
      }
      return grp;
    },
    /** 一串灯笼（两点之间悬挂） */
    lanternString(x0, z0, x1, z1, y, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const sag = Math.sin(t * Math.PI) * 0.35;
        B.hangLantern(x0 + (x1 - x0) * t, y - sag, z0 + (z1 - z0) * t, { ...o, color: o.colors ? o.colors[i % o.colors.length] : o.color, glow: 1.1, intensity: 0.6 });
      }
      const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 13 }, (_, i) => { const t = i / 12; return new THREE.Vector3(x0 + (x1 - x0) * t, y + 0.25 - Math.sin(t * Math.PI) * 0.35, z0 + (z1 - z0) * t); }));
      addMesh(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#3a2a20' })));
    },
    lanternPost(x, z, o = {}) {
      const y0 = H(x, z);
      batch.add('stone_block_light', box(0.5, 0.25, 0.5), trs(x, y0, z));
      batch.add('stone_block_light', box(0.22, 1.1, 0.22), trs(x, y0 + 0.25, z));
      batch.add('stone_block_light', box(0.62, 0.12, 0.62), trs(x, y0 + 1.35, z));
      batch.add(o.lit === false ? 'c:#5a524a' : 'e:#ffb050', box(0.34, 0.36, 0.34), trs(x, y0 + 1.47, z), { shadow: false });
      addRoof(batch, roof({ type: 'pyramid', sides: 4, radius: 0.5, rise: 0.35, tile: 'stone_block_light' === 'x' ? '' : 'roof_dark', lift: 0.08, finialKey: 'c:#8a8a84' }), trs(x, y0 + 1.83, z));
      if (o.lit !== false) { B.light(x, y0 + 1.6, z, '#ffb050', 0.8, { radius: 3.5 }); B.glow(x, y0 + 1.6, z, '#ffb050', 1.3); }
      solid(Math.floor(x), Math.floor(z), 1, 1);
    },
    streetLamp(x, z) { // 现代路灯（序章）
      const y0 = H(x, z);
      batch.add('c:#3a3f44', cyl(0.07, 0.09, 3.4, 6), trs(x, y0, z));
      batch.add('c:#3a3f44', box(0.6, 0.08, 0.1), trs(x + 0.25, y0 + 3.4, z));
      batch.add('e:#ffe2a8', box(0.3, 0.14, 0.22), trs(x + 0.5, y0 + 3.3, z), { shadow: false });
      B.light(x + 0.5, y0 + 3.2, z, '#ffe0a0', 0.7, { radius: 5 });
      B.glow(x + 0.5, y0 + 3.25, z, '#ffe0a0', 1.6);
      solid(Math.floor(x), Math.floor(z), 1, 1);
    },

    // ------------------------------------------------------------ 小道具
    prop(kind, x, z, o = {}) {
      const y0 = o.y ?? H(x, z);
      const rot = o.rot || 0;
      const F = frame(x, y0, z, rot);
      const add = (key, g, m, opt) => batch.add(key, g, F(m), opt);
      const s = o.scale || 1;
      switch (kind) {
        case 'crate': add('wood_light', box(0.7 * s, 0.6 * s, 0.7 * s)); add('wood_dark', box(0.74 * s, 0.08, 0.74 * s), trs(0, 0.3 * s, 0)); break;
        case 'barrel': add('wood', cyl(0.3 * s, 0.26 * s, 0.75 * s, 10)); add('c:#3a3f44', cyl(0.31 * s, 0.31 * s, 0.05, 10), trs(0, 0.55 * s, 0)); add('c:#3a3f44', cyl(0.28 * s, 0.28 * s, 0.05, 10), trs(0, 0.12 * s, 0)); break;
        case 'jar': add('c:#5a4030', cyl(0.18 * s, 0.22 * s, 0.1, 10), trs(0, 0.55 * s, 0)); add('c:#6a4a32', new THREE.SphereGeometry(0.32 * s, 10, 8).translate(0, 0.32 * s, 0)); add('c:#b8453a', box(0.3 * s, 0.05, 0.3 * s), trs(0, 0.64 * s, 0)); break;
        case 'basket': add('roof_thatch', cyl(0.3 * s, 0.22 * s, 0.35 * s, 10)); add('c:' + (o.fill || '#d9c27a'), cyl(0.27 * s, 0.27 * s, 0.05, 10), trs(0, 0.3 * s, 0)); break;
        case 'bricks': { // 一垛城砖
          const n = o.n ?? 4;
          for (let yy = 0; yy < n; yy++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) add(o.key || 'citybrick', box(0.42, 0.2, 0.2), trs(-0.45 + i * 0.45, yy * 0.21, -0.12 + j * 0.24 + (yy % 2) * 0.05, yy % 2 ? R90 * 0 : 0));
          break;
        }
        case 'cart': add('wood', box(1.4, 0.12, 0.8), trs(0, 0.5, 0)); add('wood', box(1.4, 0.3, 0.06), trs(0, 0.62, 0.38)); add('wood', box(1.4, 0.3, 0.06), trs(0, 0.62, -0.38));
          for (const s2 of [-1, 1]) { const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12); wg.rotateX(R90); add('wood_dark', wg, trs(0, 0.45, s2 * 0.48)); }
          add('wood', box(1.2, 0.06, 0.06), trs(1.2, 0.55, 0.2)); add('wood', box(1.2, 0.06, 0.06), trs(1.2, 0.55, -0.2));
          if (o.load) for (let i = 0; i < 3; i++) add('citybrick', box(0.4, 0.2, 0.6), trs(-0.45 + i * 0.45, 0.62, 0));
          break;
        case 'well': add('stone_block', cyl(0.6, 0.65, 0.6, 10)); add('c:#1a2a30', cyl(0.45, 0.45, 0.02, 10), trs(0, 0.58, 0));
          for (const s2 of [-1, 1]) add('wood', box(0.1, 1.4, 0.1), trs(s2 * 0.6, 0, 0)); add('wood', box(1.4, 0.1, 0.1), trs(0, 1.35, 0));
          add('roof_dark', box(1.6, 0.08, 0.9), trs(0, 1.48, 0)); break;
        case 'table': add('wood', box(1.2 * s, 0.07, 0.7 * s), trs(0, 0.72, 0)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add('wood_dark', box(0.07, 0.72, 0.07), trs(a * 0.5 * s, 0, b * 0.28 * s)); break;
        case 'desk': add('wood_dark', box(1.4, 0.08, 0.7), trs(0, 0.68, 0)); add('wood_dark', box(0.1, 0.68, 0.6), trs(-0.62, 0, 0)); add('wood_dark', box(0.1, 0.68, 0.6), trs(0.62, 0, 0));
          add('paper', box(0.5, 0.01, 0.35), trs(-0.1, 0.76, 0.05)); add('c:#1a1a1a', box(0.12, 0.05, 0.2), trs(0.45, 0.76, 0)); break;
        case 'bench': add('wood', box(1.4, 0.07, 0.35), trs(0, 0.42, 0)); for (const a of [-1, 1]) add('wood_dark', box(0.08, 0.42, 0.3), trs(a * 0.55, 0, 0)); break;
        case 'bookshelf': add('books', box(o.w || 2, o.h || 2.2, 0.5), trs(0, 0, 0)); add('wood_dark', box((o.w || 2) + 0.1, 0.1, 0.55), trs(0, o.h || 2.2, 0)); break;
        case 'rock': add('stone_grey', new THREE.DodecahedronGeometry(0.5 * s, 0).scale(1, 0.7, 0.9).translate(0, 0.3 * s, 0)); break;
        case 'taihu': { // 太湖石
          for (let i = 0; i < 4; i++) add('c:#9aa0a4', new THREE.DodecahedronGeometry(0.35 * s, 0).scale(1, 1.3, 0.8).translate((i % 2 - 0.5) * 0.3, 0.4 + i * 0.45 * s, (i % 2) * 0.1));
          break;
        }
        case 'stele': add('stone_block_light', box(0.9, 0.4, 0.5)); add('c:#6a6e70', box(0.75, 1.7, 0.2), trs(0, 0.4, 0)); add('c:#5a5e60', box(0.85, 0.28, 0.26), trs(0, 2.1, 0)); break;
        case 'incense': add('c:#6a5a3a', cyl(0.38, 0.3, 0.5, 8), trs(0, 0.4, 0)); for (const a of [0, 2.1, 4.2]) add('c:#6a5a3a', box(0.08, 0.4, 0.08), trs(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25));
          add('e:#ff9a4a', box(0.02, 0.3, 0.02), trs(0, 0.9, 0), { shadow: false }); B.addEmitter?.('smoke', x, y0 + 1.2, z); break;
        case 'firewood': for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6); g.rotateZ(R90); add('wood', g, trs(0, 0.08 + Math.floor(i / 3) * 0.13, -0.15 + (i % 3) * 0.15)); } break;
        case 'limepit': add('c:#e8e6dc', box(1.8, 0.05, 1.2), trs(0, 0.02, 0)); add('stone_block', box(2.0, 0.2, 0.1), trs(0, 0, 0.62)); add('stone_block', box(2.0, 0.2, 0.1), trs(0, 0, -0.62)); add('stone_block', box(0.1, 0.2, 1.3), trs(1.0, 0, 0)); add('stone_block', box(0.1, 0.2, 1.3), trs(-1.0, 0, 0)); break;
        case 'cauldron': add('c:#2a2a2e', new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 0.62, 0)); add('c:#e8e2d0', cyl(0.5, 0.5, 0.02, 12), trs(0, 0.58, 0));
          add('citybrick', cyl(0.7, 0.75, 0.3, 10)); break;
        case 'anchor': add('c:#4a4e54', box(0.12, 1.2, 0.12), trs(0, 0, 0)); add('c:#4a4e54', box(0.9, 0.12, 0.12), trs(0, 0.1, 0)); add('c:#4a4e54', box(0.5, 0.1, 0.1), trs(0, 1.1, 0)); break;
        case 'rope': add('c:#b8a070', cyl(0.4, 0.42, 0.25, 12)); add('c:#9a8458', cyl(0.25, 0.25, 0.27, 10)); break;
        case 'timber': for (let i = 0; i < 5; i++) { const g = new THREE.CylinderGeometry(0.16, 0.18, 4, 7); g.rotateZ(R90); add('wood', g, trs(0, 0.17 + Math.floor(i / 3) * 0.3, -0.36 + (i % 3) * 0.36)); } break;
        case 'bell': add('wood_dark', box(0.12, 2.2, 0.12), trs(-0.7, 0, 0)); add('wood_dark', box(0.12, 2.2, 0.12), trs(0.7, 0, 0)); add('wood_dark', box(1.6, 0.14, 0.14), trs(0, 2.1, 0));
          add('c:#6a5a3a', cyl(0.3, 0.45, 0.9, 12), trs(0, 1.1, 0)); break;
        case 'drum': { const g = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 14); g.rotateX(R90); add('c:#a83a2a', g, trs(0, 1.0, 0)); add('wood_dark', box(0.1, 1.0, 0.1), trs(-0.4, 0, 0)); add('wood_dark', box(0.1, 1.0, 0.1), trs(0.4, 0, 0)); break; }
        case 'stonelion': add('stone_block_light', box(0.8, 0.5, 0.8)); add('c:#9a9c98', box(0.55, 0.6, 0.7), trs(0, 0.5, 0)); add('c:#a8aaa6', box(0.5, 0.5, 0.45), trs(0, 1.1, 0.15)); add('c:#8a8c88', box(0.54, 0.25, 0.2), trs(0, 1.15, 0.35)); break;
        case 'flagpole': add('c:#6a5a44', cyl(0.06, 0.08, o.h || 5, 6)); { const fg = new THREE.PlaneGeometry(1.2, 0.8, 4, 1); fg.translate(0.6, 0, 0); const m = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ color: o.color || '#c43a2c', side: THREE.DoubleSide })); m.position.set(x + 0.05, y0 + (o.h || 5) - 0.5, z); addMesh(m); dyn.push({ type: 'flag', mesh: m, ph: R() * 6 }); } break;
        case 'bamboo_rack': for (let i = 0; i < 3; i++) add('c:#b89a5a', cyl(0.04, 0.04, 1.8, 5), trs(-0.6 + i * 0.6, 0, 0)); add('c:#b89a5a', box(1.4, 0.05, 0.05), trs(0, 1.6, 0)); break;
        case 'bin': add('c:#3a6a4a', box(0.5, 0.8, 0.45)); add('c:#2a4a3a', box(0.54, 0.08, 0.5), trs(0, 0.8, 0)); break;
        case 'sign_modern': add('c:#5a3a2a', box(0.08, 1.1, 0.08)); add('c:#6a4a34', box(1.3, 0.8, 0.08), trs(0, 1.0, 0)); break;
        case 'screen': add('wood_dark', box(o.w || 2.4, 1.9, 0.1)); add('paper', box((o.w || 2.4) - 0.2, 1.6, 0.12), trs(0, 0.15, 0)); break;
        case 'chest': add('c:#7a2a22', box(0.9, 0.55, 0.55)); add('c:#c9a44a', box(0.92, 0.05, 0.57), trs(0, 0.3, 0)); break;
        case 'ladder': add('wood_light', box(0.06, 3, 0.06), trs(-0.25, 0, 0, 0, 1, 1, 1, -0.3, 0)); add('wood_light', box(0.06, 3, 0.06), trs(0.25, 0, 0, 0, 1, 1, 1, -0.3, 0)); break;
        default: break;
      }
      if (o.solid !== false) solid(Math.floor(x), Math.floor(z), 1, 1);
    },
    /** 独立的书法标牌（竖/横） */
    sign(text, x, y, z, o = {}) {
      const t = signTexture(text, o);
      const hgt = o.h ?? (o.vertical ? 0.36 * [...text].length + 0.3 : 0.6);
      const w = hgt * t.image.width / t.image.height;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.rotation.y = (o.rot || 0) * R90;
      addMesh(m);
      return m;
    },
    mesh: addMesh,
    /** 任意方块：底面中心在 (x, y, z)；o.rot 以 90° 为单位，o.solid 标记碰撞 */
    block(key, x, y, z, w, h, d, o = {}) {
      batch.add(key, box(w, h, d), trs(x, y, z, (o.rot || 0) * R90), o.shadow === false ? { shadow: false } : {});
      if (o.solid) solid(Math.floor(x - w / 2 + 0.01), Math.floor(z - d / 2 + 0.01), Math.max(1, Math.round(w)), Math.max(1, Math.round(d)));
    },
    /** 发光的字（城砖铭文、金色题字）：竖排，从右往左 */
    glowText(text, x, y, z, o = {}) {
      const cols = String(text).split('|');
      const n = Math.max(...cols.map((c) => [...c].length));
      const cw = 64;
      const c = document.createElement('canvas');
      c.width = cols.length * cw + 24; c.height = n * cw + 24;
      const g = c.getContext('2d');
      g.font = `${cw - 10}px "JLBrush", "STXingkai", KaiTi, serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = o.glow || '#ffcf6a'; g.shadowBlur = 14;
      g.fillStyle = o.color || '#ffe6a0';
      cols.forEach((col, ci) => [...col].forEach((ch, i) => g.fillText(ch, c.width - 12 - cw / 2 - ci * cw, 12 + cw / 2 + i * cw)));
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const size = o.size ?? 0.34;
      const w = c.width / cw * size, h = c.height / cw * size;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.rotation.y = (o.rot || 0) * R90;
      m.renderOrder = 7;
      addMesh(m);
      if (o.light !== false) B.light(x, y, z + 0.4, o.glow || '#ffcf6a', 0.6, { radius: 3 });
      return m;
    },
    /** 时之隙：一圈发光的漩涡门（竖立，面朝南） */
    portal(x, y, z, o = {}) {
      const r = o.r ?? 1.1;
      const col = o.color || '#9fd8ff';
      const grp = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r * (0.35 + k * 0.28), r * (0.55 + k * 0.28), 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6 - k * 0.3), transparent: true, opacity: 0.55 - k * 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
        grp.add(ring);
        dyn.push({ type: 'spin', mesh: ring, speed: (k % 2 ? -1 : 1) * (0.6 + k * 0.3) });
      }
      const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.4, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      grp.add(core);
      grp.position.set(x, y, z);
      grp.rotation.y = (o.rot || 0) * R90;
      grp.renderOrder = 8;
      addMesh(grp);
      B.light(x, y, z + 0.5, col, 1.6, { radius: 6 });
      B.glow(x, y, z + 0.2, col, r * 3.2, { nightOnly: false, opacity: 0.6 });
      return grp;
    },
    /** 神道石兽（极简几何）：kind 'lion'|'xiezhi'|'camel'|'elephant'|'qilin'|'horse'，pose 'stand'|'kneel' */
    beast(kind, x, z, o = {}) {
      const y0 = H(x, z);
      const F = frame(x, y0, z, (o.rot || 0) * R90);
      const k = 'c:' + (o.color || '#a3a49c');
      const k2 = 'c:' + (o.color2 || '#8f9189');
      const kneel = o.pose === 'kneel';
      const S = { elephant: 1.5, camel: 1.25, horse: 1.1, lion: 0.95, xiezhi: 0.95, qilin: 1.0 }[kind] || 1;
      const add = (key, g, m) => batch.add(key, g, F(m));
      add('stone_block', box(1.5 * S, 0.3, 0.9 * S), trs(0, 0, 0));
      const legH = kneel ? 0.12 : 0.55 * S;
      const bodyY = 0.3 + legH;
      const bl = (kind === 'elephant' ? 1.4 : 1.15) * S, bh = (kind === 'elephant' ? 0.85 : 0.6) * S, bw = (kind === 'elephant' ? 0.75 : 0.5) * S;
      if (!kneel) for (const [lx, lz] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) add(k2, box(0.2 * S, legH, 0.2 * S), trs(lx * bl, 0.3, lz * bw * 1.6));
      else add(k2, box(bl * 1.02, 0.18, bw * 1.1), trs(0, 0.3, 0));
      add(k, box(bl, bh, bw), trs(0, bodyY, 0));
      const hx = bl / 2 + 0.05 * S;
      if (kind === 'elephant') {
        add(k, box(0.55 * S, 0.6 * S, 0.62 * S), trs(hx + 0.1, bodyY + bh * 0.45, 0));
        add(k2, box(0.16 * S, 0.8 * S, 0.16 * S), trs(hx + 0.35 * S, bodyY - 0.05, 0));
        for (const sz of [-1, 1]) add(k2, box(0.08, 0.45 * S, 0.35 * S), trs(hx - 0.05, bodyY + bh * 0.5, sz * 0.36 * S));
      } else if (kind === 'camel') {
        add(k, box(0.4 * S, 0.3 * S, 0.34 * S), trs(-0.15 * S, bodyY + bh, 0));
        add(k, box(0.4 * S, 0.3 * S, 0.34 * S), trs(0.3 * S, bodyY + bh, 0));
        add(k2, box(0.18 * S, 0.7 * S, 0.2 * S), trs(hx, bodyY + bh * 0.5, 0));
        add(k, box(0.34 * S, 0.2 * S, 0.22 * S), trs(hx + 0.12 * S, bodyY + bh * 0.5 + 0.7 * S, 0));
      } else {
        const neck = kind === 'horse' ? 0.55 : 0.4;
        add(k2, box(0.26 * S, neck * S, 0.3 * S), trs(hx - 0.05, bodyY + bh * 0.6, 0));
        add(k, box(0.44 * S, 0.34 * S, 0.36 * S), trs(hx + 0.08 * S, bodyY + bh * 0.6 + neck * S - 0.08, 0));
        if (kind === 'lion') add(k2, box(0.3 * S, 0.5 * S, 0.52 * S), trs(hx - 0.1, bodyY + bh * 0.45, 0));
        if (kind === 'xiezhi') add(k2, box(0.06, 0.34 * S, 0.06), trs(hx + 0.08 * S, bodyY + bh * 0.6 + neck * S + 0.22 * S, 0));
        if (kind === 'qilin') for (const sz of [-1, 1]) add(k2, box(0.05, 0.22 * S, 0.05), trs(hx + 0.02, bodyY + bh * 0.6 + neck * S + 0.18 * S, sz * 0.1));
        if (kind === 'qilin') for (let q = 0; q < 3; q++) add(k2, box(0.22 * S, 0.1, 0.5 * S), trs(-bl * 0.2 + q * 0.2 * S, bodyY + bh, 0));
      }
      solid(Math.floor(x - 0.6 * S), Math.floor(z - 0.4), Math.ceil(1.2 * S) + 1, 1);
    },
  };
  // ------------------------------------------------------------ 可修复部件
  // B.stage('名', () => {...}) 里搭的东西默认隐藏，修复后出现；B.ruin('名', ...) 相反，修复后消失。
  let curStage = null;
  const rawAdd = batch.add.bind(batch);
  batch.add = (key, g, m, o = {}) => rawAdd(key, g, m, curStage ? { ...o, group: curStage } : o);
  const capture = (key, fn) => {
    const part = world.stagePart(key);
    const prev = curStage, prevFlora = curFlora;
    const solid0 = world.solid.slice();
    const nL = world.lights.length, nE = extra.children.length;
    curStage = key;
    curFlora = new FloraBatch();
    try { fn(B); } finally {
      const fm = curFlora.build();
      curStage = prev; curFlora = prevFlora;
      if (fm) { part.group.add(fm); part.flora.push(fm); }
      for (const m of extra.children.splice(nE)) { m.parent = null; part.group.add(m); }
      for (const L of world.lights.slice(nL)) { L.stage = key; part.lights.push(L); }
      for (let i = 0; i < world.solid.length; i++) {
        if (world.solid[i] && !solid0[i]) { part.solid.push(i); if (part.kind === 'stage') world.solid[i] = 0; }
      }
    }
    return part;
  };
  B.stage = (name, fn) => capture('stage:' + name, fn);
  B.ruin = (name, fn) => capture('ruin:' + name, fn);
  return B;
}

/** 让 PlaneGeometry 的 UV 在 u、v 方向重复 */
export function quadUV(w, h, ru = 1, rv = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  return g;
}

let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

/** 每帧更新动态装饰：旗帜飘动、灯笼摇曳、光晕呼吸 */
export function updateDyn(dyn, t, night) {
  for (const d of dyn) {
    if (d.type === 'flag') {
      const p = d.mesh.geometry.attributes.position;
      if (!d.orig) d.orig = p.array.slice();
      for (let i = 0; i < p.count; i++) {
        const x = d.orig[i * 3];
        p.setZ(i, Math.sin(t * 3 + x * 2.5 + d.ph) * 0.12 * x);
      }
      p.needsUpdate = true;
    } else if (d.type === 'lantern') {
      d.mesh.rotation.z = Math.sin(t * 1.3 + d.ph) * 0.06;
    } else if (d.type === 'glow') {
      const u = d.mesh.userData.glow;
      const k = 1 + Math.sin(t * 2.3 + u.ph) * 0.06 + Math.sin(t * 7.1 + u.ph) * 0.03;
      d.mesh.scale.set(u.base * k, u.base * k, 1);
      d.mesh.visible = !u.night || night;
    } else if (d.type === 'banner') {
      d.mesh.rotation.y = d.base + Math.sin(t * 1.2 + d.ph) * 0.12;
    } else if (d.type === 'spin') {
      d.mesh.rotation.z = t * d.speed;
    }
  }
}

export { mat };
