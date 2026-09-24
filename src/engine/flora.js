// 植物：程序化像素画树木花草 → 图集；以广告牌批量绘制（随风摆动、投射阴影）。
import * as THREE from 'three';
import { PixelArt } from './pixelart.js';
import { rng } from '../core/util.js';

const FPU = 32; // 植物像素 → 1 世界单位

function blobCanopy(pa, r, cx, cy, rx, ry, pal, n = 14) {
  // 多个圆团叠出树冠；先暗后亮
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.75;
    blobs.push([cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * 0.9, (0.35 + r() * 0.3) * Math.min(rx, ry)]);
  }
  blobs.sort((a, b) => b[1] - a[1]);
  const reg = pa.region();
  for (const [x, y, rr] of blobs) pa.ellipse(x, y, rr * 1.1, rr, pal[1], reg);
  for (const [x, y, rr] of blobs) {
    pa.ellipse(x - rr * 0.18, y - rr * 0.22, rr * 0.7, rr * 0.62, pal[2], reg);
    if (r() < 0.7) pa.ellipse(x - rr * 0.35, y - rr * 0.4, rr * 0.35, rr * 0.3, pal[3], reg);
  }
  // 底部阴影
  for (let y = 0; y < pa.h; y++) for (let x = 0; x < pa.w; x++) {
    const i = y * pa.w + x;
    if (pa.reg[i] !== reg) continue;
    if (y > cy + ry * 0.35 && (x + y) % 2 === 0) pa.col[i] = PixelArt.rgb(pal[0]);
  }
}
function trunk(pa, r, x0, y0, x1, y1, w0, w1, col) {
  const n = 12;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = x0 + (x1 - x0) * t + Math.sin(t * 5 + r() ) * 0.8, y = y0 + (y1 - y0) * t;
    const w = w0 + (w1 - w0) * t;
    pa.rect(x - w / 2, y, w, Math.abs(y1 - y0) / n + 1, col[0], -1);
    pa.rect(x - w / 2, y, Math.max(1, w * 0.3), Math.abs(y1 - y0) / n + 1, col[1], -1, true);
  }
}

const PAINTERS = {
  tree: (seed) => { // 槐/樟：圆冠
    const r = rng(seed); const pa = new PixelArt(128, 150);
    trunk(pa, r, 64, 146, 62, 80, 12, 7, ['#5a4030', '#7a5a42']);
    blobCanopy(pa, r, 64, 62, 54, 46, ['#2e5a2e', '#3f7a3a', '#5a9a48', '#86bd5e'], 18);
    pa.shade(1.08, 0.85, 1); pa.outline(0.4); return pa;
  },
  willow: (seed) => { // 柳：弯曲的主干、拱起的枝、垂下的细长柳丝
    const r = rng(seed); const pa = new PixelArt(136, 168);
    // 主干（略弯）
    for (let y = 166; y > 62; y--) {
      const t = (166 - y) / 104;
      const x = 66 + Math.sin(t * 2.2) * 7;
      const w = 12 - t * 6;
      pa.rect(x - w / 2, y, w, 1, '#4f3a2c', -1);
      pa.rect(x - w / 2, y, Math.max(1, w * 0.3), 1, '#6e5440', -1, true);
      if (y % 9 === 0) pa.px(x + w * 0.2, y, '#3a2a20', -1, true);
    }
    // 拱枝
    const arches = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42 + (r() - 0.5) * 0.2;
      const len = 34 + r() * 22;
      let x = 66 + Math.sin(2.2) * 7, y = 64;
      const pts = [];
      for (let k = 0; k < len; k++) {
        const t = k / len;
        x += Math.cos(a) * 1.0; y += Math.sin(a) * 1.0 + t * 1.6;
        pts.push([x, y]);
        pa.px(x, y, '#4a3628', -1, true);
      }
      arches.push(pts);
    }
    // 柳丝：从拱枝上垂下，末端随风微弯
    for (const pts of arches) {
      for (let s = 4; s < pts.length; s += 2 + Math.floor(r() * 2)) {
        const [sx, sy] = pts[s];
        const len = 40 + r() * 70;
        const sway = (r() - 0.5) * 0.18;
        for (let k = 0; k < len; k++) {
          const x = sx + Math.sin(k * 0.05 + s) * 1.2 + k * k * sway * 0.004, y = sy + k;
          if (y >= 160) break;
          const c = (k + s) % 4 === 0 ? '#6f9e3e' : (k % 7 === 0 ? '#b8d97a' : '#8fbd52');
          pa.px(x, y, c, -1, true);
          if (k % 3 === 1 && k < len - 4) pa.px(x + (s % 2 ? 1 : -1), y, '#a8d06a', -1, true);
        }
      }
    }
    // 稀疏的顶部叶团
    for (let i = 0; i < 14; i++) {
      const x = 30 + r() * 76, y = 36 + r() * 26;
      pa.ellipse(x, y, 5 + r() * 5, 3 + r() * 2, r() < 0.5 ? '#7fae4a' : '#9cc85e', -1, true);
      pa.ellipse(x - 1, y - 1, 2.5, 1.5, '#c2e07e', -1, true);
    }
    pa.outline(0.42); return pa;
  },
  plum: (seed) => { // 梅
    const r = rng(seed); const pa = new PixelArt(112, 132);
    const br = (x, y, a, len, w, depth) => {
      let cx = x, cy = y;
      for (let k = 0; k < len; k++) {
        cx += Math.cos(a) * 1.0; cy += Math.sin(a) * 1.0;
        if (k % 7 === 0) a += (r() - 0.5) * 0.9;
        pa.rect(cx - w / 2, cy - w / 2, w, w, '#3a2a24', -1);
        if (depth > 0 && r() < 0.06) br(cx, cy, a + (r() < 0.5 ? -0.8 : 0.8), len * 0.6, Math.max(1, w - 1), depth - 1);
        if (w <= 2 && r() < 0.35) {
          const c = r() < 0.7 ? '#f4b8c6' : '#ffffff';
          pa.ellipse(cx + (r() - 0.5) * 4, cy + (r() - 0.5) * 4, 1.8, 1.8, c, -1, true);
          pa.px(cx, cy, '#e0708a', -1, true);
        }
      }
    };
    br(56, 128, -Math.PI / 2 + 0.1, 50, 6, 2);
    br(56, 96, -Math.PI / 2 - 0.7, 55, 4, 2);
    br(58, 88, -Math.PI / 2 + 0.8, 50, 4, 2);
    br(55, 70, -Math.PI / 2, 45, 3, 2);
    pa.outline(0.5); return pa;
  },
  pine: (seed) => { // 松（文人画式层叠针叶）
    const r = rng(seed); const pa = new PixelArt(128, 170);
    trunk(pa, r, 64, 166, 70, 40, 11, 5, ['#5a3a2a', '#7a5238']);
    const layers = [[64, 36, 34], [44, 64, 30], [84, 76, 32], [58, 96, 38], [80, 118, 30], [48, 124, 26]];
    for (const [x, y, w] of layers) {
      const reg = pa.region();
      pa.ellipse(x, y, w, 10, '#2c4a36', reg);
      pa.ellipse(x - 3, y - 3, w * 0.8, 6, '#3d6446', reg);
      for (let k = 0; k < w; k += 3) pa.px(x - w * 0.7 + k * 1.3, y - 6 + (k % 2), '#5f8a5a', -1, true);
    }
    pa.outline(0.45); return pa;
  },
  ginkgo: (seed) => {
    const r = rng(seed); const pa = new PixelArt(120, 170);
    trunk(pa, r, 60, 166, 60, 60, 11, 6, ['#5a4636', '#7a624e']);
    blobCanopy(pa, r, 60, 70, 46, 58, ['#b8861f', '#d9a52a', '#f0c53f', '#fbe27a'], 20);
    pa.shade(1.06, 0.88, 1); pa.outline(0.42); return pa;
  },
  maple: (seed) => {
    const r = rng(seed); const pa = new PixelArt(120, 140);
    trunk(pa, r, 60, 136, 58, 70, 10, 5, ['#4f3a2c', '#6e5440']);
    blobCanopy(pa, r, 60, 58, 50, 42, ['#8a2a1e', '#b8402a', '#d9603a', '#f09a5a'], 16);
    pa.shade(1.06, 0.88, 1); pa.outline(0.42); return pa;
  },
  osmanthus: (seed) => {
    const r = rng(seed); const pa = new PixelArt(96, 110);
    trunk(pa, r, 48, 106, 48, 60, 8, 5, ['#4f3a2c', '#6e5440']);
    blobCanopy(pa, r, 48, 50, 40, 34, ['#244a2c', '#33633a', '#4a7f4a', '#6a9a5a'], 14);
    for (let i = 0; i < 40; i++) { const x = 14 + r() * 68, y = 22 + r() * 56; if (pa.get(Math.round(x), Math.round(y))) pa.px(x, y, '#f2c14e', -1, true); }
    pa.outline(0.42); return pa;
  },
  bamboo: (seed) => {
    const r = rng(seed); const pa = new PixelArt(80, 170);
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * 11 + r() * 4, top = 10 + r() * 30;
      for (let y = top; y < 168; y++) {
        const c = (Math.floor(y) % 22 === 0) ? '#3f6a2a' : '#6a9a3a';
        pa.rect(x, y, 4, 1, c, -1); pa.px(x, y, '#8fbd5a', -1, true);
      }
      for (let k = 0; k < 7; k++) { // 竹叶
        const ly = top + 6 + k * 16 + r() * 6, dir = r() < 0.5 ? -1 : 1;
        for (let j = 0; j < 12; j++) pa.px(x + 2 + dir * j, ly + j * 0.35, j < 3 ? '#4f7f34' : '#7fae4a', -1, true);
        for (let j = 0; j < 9; j++) pa.px(x + 2 + dir * j, ly + 2 + j * 0.5, '#5f8c3a', -1, true);
      }
    }
    pa.outline(0.5); return pa;
  },
  bush: (seed) => {
    const r = rng(seed); const pa = new PixelArt(56, 40);
    blobCanopy(pa, r, 28, 24, 24, 14, ['#2e5a2e', '#3f7a3a', '#5a9a48', '#86bd5e'], 8);
    if (r() < 0.5) for (let i = 0; i < 8; i++) pa.px(8 + r() * 40, 14 + r() * 18, r() < 0.5 ? '#f09ab0' : '#f7f0e0', -1, true);
    pa.outline(0.42); return pa;
  },
  reeds: (seed) => {
    const r = rng(seed); const pa = new PixelArt(48, 64);
    for (let i = 0; i < 14; i++) {
      const x = 4 + r() * 40, top = 6 + r() * 26;
      for (let y = top; y < 64; y++) pa.px(x + (y - top) * 0.05 * (i % 2 ? 1 : -1), y, y % 9 ? '#8a9a5a' : '#6a7a42', -1, true);
      if (r() < 0.6) pa.ellipse(x, top, 1.6, 4, '#d8c8a0', -1, true);
    }
    pa.outline(0.5); return pa;
  },
  tuft: (seed) => {
    const r = rng(seed); const pa = new PixelArt(24, 16);
    for (let i = 0; i < 9; i++) { const x = 3 + r() * 18, h = 5 + r() * 9; for (let y = 0; y < h; y++) pa.px(x + (i % 2 ? y * 0.12 : -y * 0.12), 15 - y, y > h - 3 ? '#8fbd5a' : '#5a8a3a', -1, true); }
    return pa;
  },
  flowers: (seed) => {
    const r = rng(seed); const pa = new PixelArt(28, 20);
    const col = ['#e8505a', '#f2c14e', '#f7f0e0', '#c98ae0'][seed % 4];
    for (let i = 0; i < 6; i++) { const x = 4 + r() * 20, y = 6 + r() * 8; pa.line(x, y, x, 19, '#4f7f34', 1); pa.ellipse(x, y, 2, 2, col, -1, true); pa.px(x, y, '#fff6c0', -1, true); }
    return pa;
  },
  lotus: (seed) => { // 荷花（立在水面）
    const r = rng(seed); const pa = new PixelArt(40, 40);
    pa.line(20, 16, 21, 39, '#4f7f34', 1);
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.35; pa.ellipse(20 + Math.cos(a) * 5, 12 + Math.sin(a) * 5, 3, 5, k % 2 ? '#f4a8c0' : '#f8c8d8', -1, true); }
    pa.ellipse(20, 12, 2.5, 2.5, '#f2d35b', -1, true);
    pa.outline(0.5); return pa;
  },
};

export class FloraAtlas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024; this.canvas.height = 1024;
    this.g = this.canvas.getContext('2d');
    this.shelfX = 0; this.shelfY = 0; this.shelfH = 0;
    this.entries = new Map();
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }
  get(kind, variant = 0) {
    const key = kind + ':' + variant;
    if (this.entries.has(key)) return this.entries.get(key);
    const painter = PAINTERS[kind];
    if (!painter) throw new Error('未知植物 ' + kind);
    const pa = painter(1000 + variant * 37 + kind.length * 7);
    if (this.shelfX + pa.w + 2 > 1024) { this.shelfX = 0; this.shelfY += this.shelfH + 2; this.shelfH = 0; }
    const x = this.shelfX, y = this.shelfY;
    pa.toCanvas(this.canvas, x, y);
    this.shelfX += pa.w + 2;
    this.shelfH = Math.max(this.shelfH, pa.h);
    const e = { u0: x / 1024, v0: 1 - (y + pa.h) / 1024, u1: (x + pa.w) / 1024, v1: 1 - y / 1024, w: pa.w / FPU, h: pa.h / FPU };
    this.entries.set(key, e);
    this.texture.needsUpdate = true;
    return e;
  }
}

let sharedAtlas = null;
export function floraAtlas() { if (!sharedAtlas) sharedAtlas = new FloraAtlas(); return sharedAtlas; }

/** 一批植物广告牌 */
export class FloraBatch {
  constructor() { this.items = []; }
  add(kind, x, z, o = {}) { this.items.push({ kind, x, z, y: o.y || 0, s: o.scale || 1, v: o.variant ?? Math.floor(Math.random() * 3), sway: o.sway ?? (kind === 'willow' ? 1.4 : kind === 'bamboo' ? 1.1 : kind === 'reeds' ? 1.2 : 0.5), flip: o.flip ?? (Math.random() < 0.5) }); }
  build() {
    const atlas = floraAtlas();
    const pos = [], uv = [], sw = [], idx = [];
    let vi = 0;
    for (const it of this.items) {
      const e = atlas.get(it.kind, it.v % 3);
      const w = e.w * it.s, h = e.h * it.s;
      const x0 = it.x - w / 2, x1 = it.x + w / 2;
      const [ua, ub] = it.flip ? [e.u1, e.u0] : [e.u0, e.u1];
      pos.push(x0, it.y, it.z, x1, it.y, it.z, x1, it.y + h, it.z, x0, it.y + h, it.z);
      uv.push(ua, e.v0, ub, e.v0, ub, e.v1, ua, e.v1);
      const ph = (it.x * 0.37 + it.z * 0.61) % 6.28;
      sw.push(0, ph, it.y, 0, ph, it.y, it.sway * h * 0.05, ph, it.y, it.sway * h * 0.05, ph, it.y);
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
    if (!vi) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        map: { value: atlas.texture }, uTime: { value: 0 }, uTilt: { value: 0.6 }, uTint: { value: new THREE.Color(1, 1, 1) }, uWind: { value: 1 },
      }]),
      vertexShader: /* glsl */`
        attribute vec3 aSway;
        uniform float uTime, uTilt, uWind;
        varying vec2 vUv;
        #include <common>
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          // 以底边为轴朝相机倾斜：需要每个广告牌自己的底边高度，这里用 y 相对局部估计（植物底边 y≈0）
          vec3 p = position;
          float h = p.y - aSway.z;
          vec3 vis = vec3(p.x + sin(uTime * 1.6 + aSway.y) * aSway.x * uWind, aSway.z + h * cos(uTilt), p.z - h * sin(uTilt));
          vec4 clipVis = projectionMatrix * modelViewMatrix * vec4(vis, 1.0);
          vec4 clipLog = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_Position = clipVis;
          gl_Position.z = clipLog.z / clipLog.w * clipVis.w;
          vec4 mvPosition = modelViewMatrix * vec4(vis, 1.0);
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D map;
        uniform vec3 uTint;
        varying vec2 vUv;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          vec4 c = texture2D(map, vUv);
          if (c.a < 0.5) discard;
          gl_FragColor = vec4(c.rgb * uTint, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      fog: true,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.texture, alphaTest: 0.5 });
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }
}
