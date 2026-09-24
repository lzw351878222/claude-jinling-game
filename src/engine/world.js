// 世界：解析字符地图 → 地表（混合着色）、台基/城墙块、台阶、水面；提供高度、碰撞、寻路查询。
import * as THREE from 'three';
import { tex, PPU } from './textures.js';
import { Batch, box, mat, trs } from './geo.js';
import { hash2 } from '../core/util.js';

// 地表类型（顺序即图集槽位）
export const GROUND_TYPES = ['grass', 'dirt', 'stone', 'cobble', 'sand', 'mud', 'wood_floor', 'brick_pave', 'modern', 'jinzhuan', 'grass_dry', 'grass_lush', 'dirt_red', 'stone_warm', 'wood_floor_dark', 'brick_pave_warm'];
const GT = Object.fromEntries(GROUND_TYPES.map((n, i) => [n, i]));

export const DEFAULT_LEGEND = {
  ',': { g: 'grass' }, ';': { g: 'grass_dry' }, '"': { g: 'grass_lush' },
  '.': { g: 'dirt' }, 'r': { g: 'dirt_red' }, '=': { g: 'stone' }, '-': { g: 'stone_warm' },
  'o': { g: 'cobble' }, ':': { g: 'sand' }, '%': { g: 'mud' }, 'w': { g: 'wood_floor' }, 'W': { g: 'wood_floor_dark' },
  'b': { g: 'brick_pave' }, 'B': { g: 'brick_pave_warm' }, 'm': { g: 'modern' }, 'j': { g: 'jinzhuan' },
  '~': { g: 'mud', water: true },
  '#': { g: 'stone', block: true },          // 实心块（城墙等），高度 map.blockH
  'X': { g: 'dirt', solid: true },           // 不可走（仅碰撞）
  ' ': { g: 'grass', solid: true, hidden: true },
};

const LEVEL = (ch) => {
  if (ch >= '0' && ch <= '9') return (ch.charCodeAt(0) - 48) * 0.5;
  if (ch >= 'a' && ch <= 'k') return 5 + (ch.charCodeAt(0) - 97) * 0.5;
  return null;
};
const STEP_MAX = 0.36;

export class World {
  constructor(def) {
    this.def = def;
    this.w = def.w;
    this.h = def.h;
    this.legend = { ...DEFAULT_LEGEND, ...(def.legend || {}) };
    this.blockH = def.blockH ?? 4;
    const n = this.w * this.h;
    this.gtype = new Uint8Array(n);
    this.floor = new Float32Array(n);
    this.solid = new Uint8Array(n);
    this.water = new Uint8Array(n);
    this.block = new Uint8Array(n);
    this.stair = new Array(n).fill(null);
    this.blockTop = new Array(n).fill(null);
    this.hidden = new Uint8Array(n);
    this.bridgeAt = new Int16Array(n).fill(-1);
    this.bridges = [];
    this.group = new THREE.Group();
    this.occluders = new Map();
    this.lights = []; // 灯笼等光源 {x,y,z,color,intensity}
    this.stages = new Map(); // 可修复部件
    this.parse();
  }
  idx(x, z) { return z * this.w + x; }
  inBounds(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }

  parse() {
    const { def } = this;
    for (let z = 0; z < this.h; z++) {
      const row = def.ground[z] || '';
      const hrow = def.heights ? (def.heights[z] || '') : '';
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] ?? ' ';
        const L = this.legend[ch] || this.legend[' '];
        const i = this.idx(x, z);
        this.gtype[i] = GT[L.g] ?? 0;
        if (L.water) this.water[i] = 1;
        if (L.solid) this.solid[i] = 1;
        if (L.hidden) this.hidden[i] = 1;
        if (L.block) { this.block[i] = 1; this.solid[i] = 1; this.floor[i] = L.h ?? this.blockH; this.blockTop[i] = L; }
        if (L.floor != null) this.floor[i] = L.floor;
        const hc = hrow[x];
        if (hc && hc !== ' ' && hc !== '.') {
          const lv = LEVEL(hc);
          if (lv != null) this.floor[i] = lv;
          else if ('^v<>'.includes(hc)) this.stair[i] = hc;
        }
      }
    }
    // 台阶两端高度
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      const i = this.idx(x, z);
      const s = this.stair[i];
      if (!s) continue;
      const lowN = { '^': [0, 1], 'v': [0, -1], '<': [1, 0], '>': [-1, 0] }[s];
      const hi = [-lowN[0], -lowN[1]];
      const hLow = this.floorAtTile(x + lowN[0], z + lowN[1], true);
      const hHigh = this.floorAtTile(x + hi[0], z + hi[1], true);
      this.stair[i] = { dir: s, lo: hLow, hi: hHigh };
      this.floor[i] = (hLow + hHigh) / 2;
    }
  }
  floorAtTile(x, z, raw = false) {
    if (!this.inBounds(x, z)) return 0;
    const i = this.idx(x, z);
    if (raw && this.stair[i] && typeof this.stair[i] === 'string') return 0;
    return this.floor[i];
  }
  /** 连续坐标上的地面高度 */
  heightAt(x, z) {
    const tx = Math.floor(x), tz = Math.floor(z);
    if (!this.inBounds(tx, tz)) return 0;
    const i = this.idx(tx, tz);
    const bi = this.bridgeAt[i];
    if (bi >= 0) {
      const b = this.bridges[bi];
      const t = Math.min(1, Math.max(0, (b.dir === 'x' ? x - b.x : z - b.z) / b.len));
      return Math.sin(t * Math.PI) * b.peak;
    }
    const s = this.stair[i];
    if (s && typeof s === 'object') {
      const fx = x - tx, fz = z - tz;
      let t;
      if (s.dir === '^') t = 1 - fz; else if (s.dir === 'v') t = fz; else if (s.dir === '<') t = 1 - fx; else t = fx;
      return s.lo + (s.hi - s.lo) * t;
    }
    if (this.water[i]) return -0.35;
    return this.floor[i];
  }
  walkableTile(x, z) {
    if (!this.inBounds(x, z)) return false;
    const i = this.idx(x, z);
    return !this.solid[i] && (!this.water[i] || this.bridgeAt[i] >= 0);
  }
  /** 登记一座桥（桥面高度沿跨度连续变化） */
  addBridge(b) {
    const k = this.bridges.push(b) - 1;
    for (let i = 0; i < b.len; i++) for (let j = 0; j < b.w; j++) {
      const tx = b.dir === 'x' ? b.x + i : b.x + j, tz = b.dir === 'x' ? b.z + j : b.z + i;
      if (!this.inBounds(tx, tz)) continue;
      const id = this.idx(tx, tz);
      this.bridgeAt[id] = k;
      this.solid[id] = 0;
    }
    return k;
  }
  /** 从 (x0,z0) 走到 (x1,z1) 是否允许（碰撞半径 r） */
  canStand(x, z, r = 0.28, fromH = null) {
    const pts = [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r], [x, z]];
    for (const [px, pz] of pts) {
      const tx = Math.floor(px), tz = Math.floor(pz);
      if (!this.walkableTile(tx, tz)) return false;
      if (fromH != null) {
        const h = this.heightAt(px, pz);
        if (Math.abs(h - fromH) > STEP_MAX) return false;
      }
    }
    return true;
  }
  /** 带滑墙的移动解算 */
  move(pos, dx, dz, r = 0.28) {
    const h0 = this.heightAt(pos.x, pos.z);
    let moved = false;
    if (dx && this.canStand(pos.x + dx, pos.z, r, h0)) { pos.x += dx; moved = true; }
    const h1 = this.heightAt(pos.x, pos.z);
    if (dz && this.canStand(pos.x, pos.z + dz, r, h1)) { pos.z += dz; moved = true; }
    return moved;
  }
  markSolid(x0, z0, w, d, v = 1) {
    for (let z = Math.floor(z0); z < Math.ceil(z0 + d); z++) for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
      if (this.inBounds(x, z)) this.solid[this.idx(x, z)] = v;
    }
  }
  setFloor(x0, z0, w, d, h) {
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) if (this.inBounds(x, z)) this.floor[this.idx(x, z)] = h;
  }

  // ---------------------------------------------------------------- 寻路（A*，8 方向，不切角）
  findPath(sx, sz, gx, gz, maxIter = 6000) {
    const W = this.w, H = this.h;
    const start = [Math.floor(sx), Math.floor(sz)];
    let goal = [Math.floor(gx), Math.floor(gz)];
    if (!this.inBounds(...goal)) return null;
    if (!this.walkableTile(...goal)) {
      // 目标不可走：找最近可走格
      let best = null, bd = 1e9;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const x = goal[0] + dx, z = goal[1] + dz;
        if (this.walkableTile(x, z)) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [x, z]; } }
      }
      if (!best) return null;
      goal = best;
    }
    const key = (x, z) => z * W + x;
    const open = new Map();
    const came = new Map();
    const g = new Map();
    const sk = key(...start);
    g.set(sk, 0);
    open.set(sk, { x: start[0], z: start[1], f: 0 });
    const hfun = (x, z) => { const dx = Math.abs(x - goal[0]), dz = Math.abs(z - goal[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    let it = 0;
    while (open.size && it++ < maxIter) {
      let cur = null, ck = -1;
      for (const [k, v] of open) if (!cur || v.f < cur.f) { cur = v; ck = k; }
      open.delete(ck);
      if (cur.x === goal[0] && cur.z === goal[1]) {
        const path = [[goal[0] + 0.5, goal[1] + 0.5]];
        let k = ck;
        while (came.has(k)) { k = came.get(k); path.push([(k % W) + 0.5, Math.floor(k / W) + 0.5]); }
        path.reverse();
        path[path.length - 1] = [gx, gz].every((v, i) => Math.floor(v) === goal[i]) ? [gx, gz] : path[path.length - 1];
        return this.smooth(path, sx, sz);
      }
      const h0 = this.floorFor(cur.x, cur.z);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cur.x + dx, nz = cur.z + dz;
        if (!this.walkableTile(nx, nz)) continue;
        if (dx && dz && (!this.walkableTile(cur.x + dx, cur.z) || !this.walkableTile(cur.x, cur.z + dz))) continue;
        if (!this.edgeOk(cur.x, cur.z, nx, nz, h0)) continue;
        const nk = key(nx, nz);
        const ng = g.get(ck) + (dx && dz ? 1.414 : 1);
        if (!g.has(nk) || ng < g.get(nk)) {
          g.set(nk, ng);
          came.set(nk, ck);
          open.set(nk, { x: nx, z: nz, f: ng + hfun(nx, nz) });
        }
      }
    }
    return null;
  }
  floorFor(x, z) { return this.heightAt(x + 0.5, z + 0.5); }
  edgeOk(x0, z0, x1, z1) {
    // 用两格交界处的高度判断能否跨越
    const mx = (x0 + x1) / 2 + 0.5, mz = (z0 + z1) / 2 + 0.5;
    const ha = this.heightAt(x0 + 0.5 + (x1 - x0) * 0.45, z0 + 0.5 + (z1 - z0) * 0.45);
    const hb = this.heightAt(x1 + 0.5 - (x1 - x0) * 0.45, z1 + 0.5 - (z1 - z0) * 0.45);
    return Math.abs(ha - hb) <= STEP_MAX + 0.05 && Math.abs(this.heightAt(mx, mz) - ha) <= STEP_MAX + 0.3;
  }
  smooth(path, sx, sz) {
    if (path.length < 3) return path;
    const out = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1 && !this.lineClear(path[i], path[j])) j--;
      out.push(path[j]);
      i = j;
    }
    return out;
  }
  lineClear(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(d / 0.25);
    let h = this.heightAt(a[0], a[1]);
    for (let k = 1; k <= n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
      if (!this.canStand(x, z, 0.3, h)) return false;
      h = this.heightAt(x, z);
    }
    return true;
  }

  // ---------------------------------------------------------------- 构建网格
  build() {
    const batch = new Batch();
    this.batch = batch;
    this.buildGround();
    this.buildBlocks(batch);
    this.buildWater();
    return batch;
  }
  finish() {
    const { root, occluders, stages } = this.batch.build();
    this.group.add(root);
    for (const [k, v] of occluders) this.occluders.set(k, v);
    for (const [k, meshes] of stages) this.stagePart(k).group.add(...meshes);
    // 可修复部件：以底部中心为轴心，便于"从地面长出来"的动画
    for (const part of this.stages.values()) {
      const g = part.group;
      if (!g.children.length) continue;
      const bb = new THREE.Box3().setFromObject(g);
      const pivot = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.min.y, (bb.min.z + bb.max.z) / 2);
      for (const c of g.children) { c.position.sub(pivot); c.updateMatrix(); }
      g.position.copy(pivot);
      part.pivot = pivot;
      part.size = bb.getSize(new THREE.Vector3());
      this.group.add(g);
    }
    this.batch = null;
  }
  /** 取得（或新建）一个可修复部件：'stage:名' 修复后出现；'ruin:名' 修复后消失 */
  stagePart(key) {
    if (!this.stages) this.stages = new Map();
    if (!this.stages.has(key)) {
      const g = new THREE.Group();
      this.stages.set(key, { key, name: key.split(':')[1], kind: key.split(':')[0], group: g, solid: [], lights: [], flora: [], pivot: new THREE.Vector3(), size: new THREE.Vector3() });
    }
    return this.stages.get(key);
  }

  buildGround() {
    const W = this.w, H = this.h;
    // 1) 类型贴图（每格一个像素，外扩边缘用最近格）
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { data[i * 4] = this.gtype[i]; data[i * 4 + 1] = this.water[i] ? 255 : 0; data[i * 4 + 3] = 255; }
    const splat = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    splat.magFilter = THREE.NearestFilter; splat.minFilter = THREE.NearestFilter;
    splat.needsUpdate = true;
    this.splat = splat;
    // 2) 图集：16 槽，每槽 128px（= 4 单位）
    const atlasC = document.createElement('canvas');
    atlasC.width = 512; atlasC.height = 512;
    const ag = atlasC.getContext('2d');
    GROUND_TYPES.forEach((name, k) => {
      const img = tex(name).image;
      ag.drawImage(img, (k % 4) * 128, Math.floor(k / 4) * 128, 128, 128);
    });
    const atlas = new THREE.CanvasTexture(atlasC);
    atlas.magFilter = THREE.NearestFilter; atlas.minFilter = THREE.NearestFilter; atlas.generateMipmaps = false;
    atlas.colorSpace = THREE.SRGBColorSpace;
    this.groundAtlas = atlas;
    const noise = tex('water_noise');
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSplat = { value: splat };
      sh.uniforms.uAtlas = { value: atlas };
      sh.uniforms.uNoise = { value: noise };
      sh.uniforms.uMapSize = { value: new THREE.Vector2(W, H) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vJLW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvJLW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vJLW;
          uniform sampler2D uSplat, uAtlas, uNoise;
          uniform vec2 uMapSize;
          float jlType(vec2 p) {
            vec2 t = clamp(floor(p), vec2(0.0), uMapSize - 1.0);
            return floor(texture2D(uSplat, (t + 0.5) / uMapSize).r * 255.0 + 0.5);
          }
          vec3 jlSample(float type, vec2 wp) {
            vec2 local = fract(wp / 4.0);
            vec2 slot = vec2(mod(type, 4.0), floor(type / 4.0));
            vec2 auv = (slot * 128.0 + 0.5 + local * 127.0) / 512.0;
            return texture2D(uAtlas, vec2(auv.x, 1.0 - auv.y)).rgb;
          }`)
        .replace('#include <map_fragment>', `
          vec2 wp = vJLW.xz;
          vec2 pq = floor(wp * ${PPU}.0) / ${PPU}.0;
          vec2 jit = (texture2D(uNoise, pq * 0.11).rg - 0.5) * 0.62 + (texture2D(uNoise, pq * 0.37).rg - 0.5) * 0.22;
          float tA = jlType(pq + jit);
          vec3 gcol = jlSample(tA, pq);
          // 不同地表交界处加一道浅暗边
          float tB = jlType(pq + jit + vec2(0.09, 0.0));
          float tC = jlType(pq + jit + vec2(0.0, 0.09));
          if (tB != tA || tC != tA) gcol *= 0.86;
          diffuseColor.rgb *= gcol;
        `);
    };
    this.groundMat = m;
    // 3) 几何：每个非水、非隐藏格一块（按高度），外围再铺一圈裙边
    const pos = [], nor = [], idx = [];
    let vi = 0;
    const quadAt = (x0, z0, x1, z1, y) => {
      pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
      for (let k = 0; k < 4; k++) nor.push(0, 1, 0);
      idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
      vi += 4;
    };
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, z);
      if (this.water[i] || this.block[i] || this.stair[i] || this.hidden[i]) continue;
      quadAt(x, z, x + 1, z + 1, this.floor[i]);
    }
    const S = this.def.skirt ?? 14;
    // 裙边（地图外）：四条大带
    quadAt(-S, -S, W + S, 0, 0); quadAt(-S, H, W + S, H + S, 0);
    quadAt(-S, 0, 0, H, 0); quadAt(W, 0, W + S, H, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.name = 'ground';
    this.group.add(mesh);
    this.groundMesh = mesh;
  }

  buildBlocks(batch) {
    const W = this.w, H = this.h;
    const sideKey = this.def.blockSide || 'citybrick';
    const topKey = this.def.blockTopKey || 'stone_grey';
    const platSide = this.def.platformSide || 'stone_block';
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, z);
      if (this.hidden[i]) continue;
      if (this.block[i]) {
        const L = this.blockTop[i];
        const hgt = this.floor[i];
        batch.add(L.side || sideKey, box(1, hgt, 1), trs(x + 0.5, 0, z + 0.5));
        continue;
      }
      if (this.stair[i]) {
        const s = this.stair[i];
        const steps = Math.max(2, Math.round((s.hi - s.lo) / 0.18));
        for (let k = 0; k < steps; k++) {
          const t0 = k / steps, t1 = (k + 1) / steps;
          const hgt = s.lo + (s.hi - s.lo) * (k + 1) / steps;
          let bx, bz, bw, bd;
          if (s.dir === '^') { bx = x; bz = z + 1 - t1; bw = 1; bd = 1 - t0; }
          else if (s.dir === 'v') { bx = x; bz = z + t0; bw = 1; bd = 1 - t0; }
          else if (s.dir === '<') { bx = x + 1 - t1; bz = z; bw = 1 - t0; bd = 1; }
          else { bx = x + t0; bz = z; bw = 1 - t0; bd = 1; }
          if (hgt > 0.01) batch.add(this.def.stairKey || 'stone_block_light', box(bw, hgt, bd), trs(bx + bw / 2, 0, bz + bd / 2));
        }
        continue;
      }
      const f = this.floor[i];
      if (f > 0.01 && !this.water[i]) {
        // 台基侧面：只在比邻格低的方向画
        const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dz] of nb) {
          const nx = x + dx, nz = z + dz;
          const nf = this.inBounds(nx, nz) ? (this.water[this.idx(nx, nz)] ? -0.7 : (this.stair[this.idx(nx, nz)] ? f : this.floor[this.idx(nx, nz)])) : 0;
          if (nf >= f - 0.001) continue;
          const hgt = f - nf;
          const face = new THREE.PlaneGeometry(1, hgt);
          face.translate(0, nf + hgt / 2, 0);
          const ry = dx === 1 ? Math.PI / 2 : dx === -1 ? -Math.PI / 2 : dz === 1 ? 0 : Math.PI;
          batch.add(this.def.platformSideAt?.(x, z) || platSide, face, trs(x + 0.5 + dx * 0.5, 0, z + 0.5 + dz * 0.5, ry));
        }
      }
    }
    // 城墙顶面与垛口
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, z);
      if (!this.block[i] || this.hidden[i]) continue;
      const L = this.blockTop[i];
      const hgt = this.floor[i];
      batch.add(L.top || topKey, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, hgt + 0.001, 0), trs(x + 0.5, 0, z + 0.5));
      if (L.crenel !== false && this.def.crenels !== false) {
        const open = (dx, dz) => { const nx = x + dx, nz = z + dz; return !this.inBounds(nx, nz) || !this.block[this.idx(nx, nz)]; };
        for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
          if (!open(dx, dz)) continue;
          // 垛墙：两个垛口 + 矮墙
          const m = trs(x + 0.5 + dx * 0.42, hgt, z + 0.5 + dz * 0.42, ry);
          batch.add(L.side || sideKey, box(1, 0.35, 0.16), m);
          const m1 = trs(x + 0.5 + dx * 0.42 + (dz ? -0.25 : 0), hgt + 0.35, z + 0.5 + dz * 0.42 + (dx ? -0.25 : 0), ry);
          batch.add(L.side || sideKey, box(0.34, 0.3, 0.16), m1);
          const m2 = trs(x + 0.5 + dx * 0.42 + (dz ? 0.25 : 0), hgt + 0.35, z + 0.5 + dz * 0.42 + (dx ? 0.25 : 0), ry);
          batch.add(L.side || sideKey, box(0.34, 0.3, 0.16), m2);
        }
      }
    }
    // 水岸
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, z);
      if (!this.water[i]) continue;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, nz = z + dz;
        if (!this.inBounds(nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (this.water[ni]) continue;
        const top = this.stair[ni] ? 0 : this.floor[ni];
        const hgt = top + 0.75;
        const face = new THREE.PlaneGeometry(1, hgt);
        face.translate(0, top - hgt / 2, 0);
        const ry = dx === 1 ? -Math.PI / 2 : dx === -1 ? Math.PI / 2 : dz === 1 ? Math.PI : 0;
        batch.add(this.def.bankKey || 'stone_block', face, trs(x + 0.5 + dx * 0.5, 0, z + 0.5 + dz * 0.5, ry));
      }
      // 河床
      batch.add('c:#3d4a45', new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), trs(x + 0.5, -0.75, z + 0.5), { shadow: false });
    }
  }

  buildWater() {
    const W = this.w, H = this.h;
    const pos = [], shore = [], idx = [];
    let vi = 0;
    const isW = (x, z) => this.inBounds(x, z) && this.water[this.idx(x, z)];
    const extraSkirt = this.def.waterSkirt; // 例如 'south'：地图外延伸一片水
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      if (!isW(x, z)) continue;
      const cs = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]];
      for (const [cx, cz] of cs) {
        pos.push(cx, -0.16, cz);
        let land = 0;
        for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const tx = cx + ox, tz = cz + oz; if (this.inBounds(tx, tz) && !isW(tx, tz)) land = 1; }
        shore.push(land);
      }
      idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
      vi += 4;
    }
    if (extraSkirt) {
      for (const r of extraSkirt) { // [x0,z0,x1,z1]
        pos.push(r[0], -0.16, r[1], r[2], -0.16, r[1], r[2], -0.16, r[3], r[0], -0.16, r[3]);
        shore.push(0, 0, 0, 0);
        idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2); vi += 4;
      }
    }
    if (!vi) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
    g.setIndex(idx);
    const m = makeWaterMaterial();
    const mesh = new THREE.Mesh(g, m);
    mesh.name = 'water';
    mesh.renderOrder = 2;
    this.group.add(mesh);
    this.waterMesh = mesh;
  }

  update(dt, t, scene, cam) {
    if (this.waterMesh) {
      const u = this.waterMesh.material.uniforms;
      u.uTime.value = t;
      if (scene.fog) { u.uFogColor.value.copy(scene.fog.color); u.uFogNear.value = scene.fog.near; u.uFogFar.value = scene.fog.far; }
      // 最近的 8 盏灯做倒影
      if (this.lights.length && cam) {
        const cx = cam.target.x, cz = cam.target.z;
        const sorted = this.lights.filter((L) => !L.off).sort((a, b) => ((a.x - cx) ** 2 + (a.z - cz) ** 2) - ((b.x - cx) ** 2 + (b.z - cz) ** 2));
        for (let k = 0; k < 8; k++) {
          const L = sorted[k];
          if (L && L.reflect !== false) { u.uLightPos.value[k].set(L.x, L.y, L.z, L.intensity ?? 1); u.uLightCol.value[k].copy(L.color); }
          else u.uLightPos.value[k].set(0, 0, 0, 0);
        }
      }
    }
  }
  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

export function makeWaterMaterial() {
  const lp = [], lc = [];
  for (let k = 0; k < 8; k++) { lp.push(new THREE.Vector4()); lc.push(new THREE.Color()); }
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uNoise: { value: tex('water_noise') },
      uDeep: { value: new THREE.Color('#2f5a60') },
      uShallow: { value: new THREE.Color('#4f8a86') },
      uSky: { value: new THREE.Color('#cfe3e8') },
      uFoam: { value: new THREE.Color('#e8efe6') },
      uAlpha: { value: 0.88 },
      uFogColor: { value: new THREE.Color('#9fb3bf') },
      uFogNear: { value: 30 },
      uFogFar: { value: 80 },
      uLightPos: { value: lp },
      uLightCol: { value: lc },
    },
    vertexShader: /* glsl */`
      attribute float aShore;
      varying float vShore;
      varying vec3 vW;
      varying float vDepth;
      void main() {
        vShore = aShore;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime, uAlpha, uFogNear, uFogFar;
      uniform sampler2D uNoise;
      uniform vec3 uDeep, uShallow, uSky, uFoam, uFogColor;
      uniform vec4 uLightPos[8];
      uniform vec3 uLightCol[8];
      varying float vShore;
      varying vec3 vW;
      varying float vDepth;
      void main() {
        vec2 p = floor(vW.xz * 16.0) / 16.0;
        float n1 = texture2D(uNoise, p * 0.045 + vec2(uTime * 0.012, uTime * 0.006)).r;
        float n2 = texture2D(uNoise, p * 0.09 - vec2(uTime * 0.01, -uTime * 0.016)).g;
        float wv = n1 * 0.6 + n2 * 0.4;
        vec3 col = mix(uDeep, uShallow, smoothstep(0.3, 0.8, wv));
        float band = abs(fract(wv * 6.0 + uTime * 0.05) - 0.5);
        col += uSky * (1.0 - smoothstep(0.0, 0.06, band)) * 0.22 * smoothstep(0.45, 0.7, wv);
        float sp = texture2D(uNoise, p * 0.23 + vec2(uTime * 0.03, 0.0)).b;
        col += uSky * step(0.975, sp) * 0.5;
        float foam = smoothstep(0.45, 0.95, vShore + (n2 - 0.5) * 0.5);
        col = mix(col, uFoam, foam * 0.45);
        // 灯影
        for (int k = 0; k < 8; k++) {
          vec4 L = uLightPos[k];
          if (L.w <= 0.0) continue;
          float dx = vW.x - L.x;
          float dz = vW.z - L.z;
          if (dz < -0.2) continue;
          float wob = sin(dz * 7.0 + uTime * 2.5 + wv * 8.0) * 0.12;
          float s = exp(-(dx + wob) * (dx + wob) * 6.0) * exp(-max(dz, 0.0) * 0.28) * (0.55 + 0.45 * step(0.5, fract(dz * 3.0 + uTime * 0.7 + n1)));
          col += uLightCol[k] * s * L.w * 0.9;
        }
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, uAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
}
