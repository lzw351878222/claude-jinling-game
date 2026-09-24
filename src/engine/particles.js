// 粒子：花瓣、尘埃、火星、烟、萤火、金光、墨丝、雪。CPU 更新 + 一个 Points 批量绘制。
import * as THREE from 'three';
import { rng } from '../core/util.js';

const SHAPES = { soft: 0, petal: 1, spark: 2, smoke: 3, ember: 4, leaf: 5, ink: 6, snow: 7 };

function atlas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const cell = (i) => [(i % 4) * 64, Math.floor(i / 4) * 64];
  // 0 soft
  { const [x, y] = cell(0); const gr = g.createRadialGradient(x + 32, y + 32, 0, x + 32, y + 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, 64, 64); }
  // 1 petal（梅花瓣）
  { const [x, y] = cell(1); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + 32, y + 32, 22, 14, 0.5, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 22, y + 26, 5, 3, 0.5, 0, Math.PI * 2); g.fill(); }
  // 2 spark（十字星）
  { const [x, y] = cell(2); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 32, y + 4); g.lineTo(x + 36, y + 28); g.lineTo(x + 60, y + 32); g.lineTo(x + 36, y + 36); g.lineTo(x + 32, y + 60); g.lineTo(x + 28, y + 36); g.lineTo(x + 4, y + 32); g.lineTo(x + 28, y + 28); g.closePath(); g.fill(); }
  // 3 smoke
  { const [x, y] = cell(3); for (let k = 0; k < 6; k++) { const gr = g.createRadialGradient(x + 22 + k * 4, y + 26 + (k % 3) * 5, 0, x + 22 + k * 4, y + 26 + (k % 3) * 5, 18); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, 64, 64); } }
  // 4 ember（方块像素火星）
  { const [x, y] = cell(4); g.fillStyle = '#fff'; g.fillRect(x + 24, y + 24, 16, 16); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x + 18, y + 18, 28, 28); }
  // 5 leaf（银杏叶扇形）
  { const [x, y] = cell(5); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 32, y + 52); g.arc(x + 32, y + 52, 26, -Math.PI * 0.82, -Math.PI * 0.18); g.closePath(); g.fill(); }
  // 6 ink（墨点）
  { const [x, y] = cell(6); g.fillStyle = '#fff'; g.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, r = 16 + (k % 2) * 8; g.lineTo(x + 32 + Math.cos(a) * r, y + 32 + Math.sin(a) * r); } g.closePath(); g.fill(); }
  // 7 snow
  { const [x, y] = cell(7); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 32, y + 32, 10, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Particles {
  constructor(max = 1600) {
    this.max = max;
    this.count = 0;
    this.p = []; // {x,y,z,vx,vy,vz,life,max,size,shape,r,g,b,a,rot,vr,drag,grav,wave,fade}
    const g = new THREE.BufferGeometry();
    this.aPos = new Float32Array(max * 3);
    this.aCol = new Float32Array(max * 4);
    this.aSize = new Float32Array(max);
    this.aShape = new Float32Array(max);
    this.aRot = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.aCol, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('shape', new THREE.BufferAttribute(this.aShape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rot', new THREE.BufferAttribute(this.aRot, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: atlas() }, uScale: { value: 600 } },
      vertexShader: /* glsl */`
        attribute vec4 color; attribute float size; attribute float shape; attribute float rot;
        varying vec4 vCol; varying float vShape; varying float vRot;
        uniform float uScale;
        void main() {
          vCol = color; vShape = shape; vRot = rot;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        varying vec4 vCol; varying float vShape; varying float vRot;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
          vec2 cell = vec2(mod(vShape, 4.0), floor(vShape / 4.0));
          vec2 uv = (cell + p) / vec2(4.0, 2.0);
          vec4 t = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
          float a = t.a * vCol.a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vCol.rgb * t.rgb, a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.additive = new THREE.Points(g, this.mat); // 占位（未使用）
    this.emitters = [];
    this.r = rng(77);
  }
  setScale(h) { this.mat.uniforms.uScale.value = h * 0.9; }
  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    const c = new THREE.Color(o.color || '#ffffff');
    this.p.push({
      x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: 0, max: o.life || 2, size: o.size || 0.3, shape: SHAPES[o.shape || 'soft'] ?? 0,
      r: c.r, g: c.g, b: c.b, a: o.alpha ?? 1, rot: o.rot || 0, vr: o.vr || 0,
      drag: o.drag ?? 0.2, grav: o.grav ?? 0, wave: o.wave || 0, fade: o.fade || 'inout', grow: o.grow || 0, ph: this.r() * 6.28,
    });
  }
  /** 连续发射器：fn(r) 返回粒子参数；rate 每秒个数；area 发射区域 */
  addEmitter(e) { e.acc = 0; this.emitters.push(e); return e; }
  clearEmitters() { this.emitters.length = 0; }
  burst(n, fn) { for (let i = 0; i < n; i++) this.spawn(fn(this.r, i)); }
  update(dt, t, focus) {
    for (const e of this.emitters) {
      if (e.enabled === false) continue;
      if (e.near && focus && Math.hypot(e.near[0] - focus.x, e.near[1] - focus.z) > (e.near[2] || 26)) continue;
      e.acc += e.rate * dt;
      while (e.acc >= 1) { e.acc -= 1; this.spawn(e.make(this.r, focus, t)); }
    }
    const P = this.p;
    let n = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.life += dt;
      if (q.life >= q.max || n >= this.max) continue;
      q.vy -= q.grav * dt;
      const d = Math.max(0, 1 - q.drag * dt);
      q.vx *= d; q.vy *= d; q.vz *= d;
      q.x += (q.vx + (q.wave ? Math.sin(t * 1.7 + q.ph) * q.wave : 0)) * dt;
      q.y += q.vy * dt;
      q.z += (q.vz + (q.wave ? Math.cos(t * 1.3 + q.ph) * q.wave * 0.5 : 0)) * dt;
      q.rot += q.vr * dt;
      const k = q.life / q.max;
      let a = q.a;
      if (q.fade === 'inout') a *= Math.min(1, k * 5) * Math.min(1, (1 - k) * 3);
      else if (q.fade === 'out') a *= 1 - k;
      else if (q.fade === 'twinkle') a *= (0.5 + 0.5 * Math.sin(t * 9 + q.ph)) * Math.min(1, (1 - k) * 3);
      this.aPos[n * 3] = q.x; this.aPos[n * 3 + 1] = q.y; this.aPos[n * 3 + 2] = q.z;
      this.aCol[n * 4] = q.r; this.aCol[n * 4 + 1] = q.g; this.aCol[n * 4 + 2] = q.b; this.aCol[n * 4 + 3] = a;
      this.aSize[n] = q.size * (1 + q.grow * k);
      this.aShape[n] = q.shape;
      this.aRot[n] = q.rot;
      P[n++] = q; // 就地压缩：存活的粒子前移
    }
    P.length = n;
    this.count = n;
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'color', 'size', 'shape', 'rot']) this.geo.attributes[a].needsUpdate = true;
  }
  clear() { this.p.length = 0; this.count = 0; this.geo.setDrawRange(0, 0); }
}

// 常用发射器模板 ----------------------------------------------------
export const EMIT = {
  dust: (x0, z0, x1, z1, col = '#fff6dc') => ({ rate: 6, make: (r) => ({ x: x0 + r() * (x1 - x0), y: 0.5 + r() * 3, z: z0 + r() * (z1 - z0), vx: 0.05, vy: 0.03, size: 0.07 + r() * 0.06, color: col, alpha: 0.7, life: 5 + r() * 4, wave: 0.15, drag: 0 }) }),
  petals: (x0, z0, x1, z1, col = '#f6c6d0') => ({ rate: 5, make: (r) => ({ x: x0 + r() * (x1 - x0), y: 5 + r() * 3, z: z0 + r() * (z1 - z0), vx: 0.5 + r() * 0.3, vy: -0.5 - r() * 0.3, size: 0.18 + r() * 0.1, shape: 'petal', color: r() < 0.3 ? '#ffffff' : col, alpha: 0.95, life: 9, wave: 0.6, rot: r() * 6, vr: (r() - 0.5) * 3, drag: 0 }) }),
  leaves: (x0, z0, x1, z1, col = '#e8b83a') => ({ rate: 3, make: (r) => ({ x: x0 + r() * (x1 - x0), y: 5 + r() * 3, z: z0 + r() * (z1 - z0), vx: 0.3 + r() * 0.3, vy: -0.6, size: 0.25 + r() * 0.1, shape: 'leaf', color: r() < 0.4 ? '#d9962a' : col, alpha: 1, life: 9, wave: 0.8, rot: r() * 6, vr: (r() - 0.5) * 2.5, drag: 0 }) }),
  fireflies: (x0, z0, x1, z1) => ({ rate: 3, make: (r) => ({ x: x0 + r() * (x1 - x0), y: 0.4 + r() * 2, z: z0 + r() * (z1 - z0), vx: (r() - 0.5) * 0.3, vy: (r() - 0.5) * 0.2, vz: (r() - 0.5) * 0.3, size: 0.12, color: '#d8ff9a', alpha: 1, life: 6, fade: 'twinkle', wave: 0.3, drag: 0 }) }),
  embers: (x, y, z) => ({ rate: 14, near: [x, z], make: (r) => ({ x: x + (r() - 0.5) * 0.8, y, z: z + (r() - 0.5) * 0.5, vx: (r() - 0.5) * 0.4, vy: 1.2 + r() * 1.2, size: 0.06 + r() * 0.05, shape: 'ember', color: r() < 0.5 ? '#ffb040' : '#ff6a2a', alpha: 1, life: 1.2 + r(), wave: 0.4, drag: 0.5 }) }),
  smoke: (x, y, z, col = '#8a8580') => ({ rate: 4, near: [x, z], make: (r) => ({ x: x + (r() - 0.5) * 0.3, y, z, vx: 0.25 + r() * 0.2, vy: 0.8 + r() * 0.4, size: 0.9 + r() * 0.5, shape: 'smoke', color: col, alpha: 0.5, life: 4 + r() * 2, grow: 2.2, drag: 0.15, rot: r() * 6, vr: 0.2 }) }),
  sparkle: (x, y, z, col = '#ffe08a') => ({ rate: 3, near: [x, z], make: (r) => ({ x: x + (r() - 0.5) * 0.7, y: y + r() * 0.8, z: z + (r() - 0.5) * 0.4, vy: 0.3, size: 0.16 + r() * 0.12, shape: 'spark', color: col, alpha: 1, life: 1.2, fade: 'inout', rot: r() * 6, vr: 1.5, drag: 0 }) }),
  ink: (x0, z0, x1, z1) => ({ rate: 8, make: (r) => ({ x: x0 + r() * (x1 - x0), y: 0.2 + r() * 2, z: z0 + r() * (z1 - z0), vx: (r() - 0.5) * 0.4, vy: 0.3 + r() * 0.5, size: 0.25 + r() * 0.3, shape: 'ink', color: '#0c0b10', alpha: 0.85, life: 3, grow: 0.8, rot: r() * 6, vr: (r() - 0.5), drag: 0.3 }) }),
  snow: (x0, z0, x1, z1) => ({ rate: 30, make: (r) => ({ x: x0 + r() * (x1 - x0), y: 7, z: z0 + r() * (z1 - z0), vx: 0.2, vy: -0.8 - r() * 0.3, size: 0.07 + r() * 0.05, shape: 'snow', color: '#ffffff', alpha: 0.9, life: 9, wave: 0.3, drag: 0 }) }),
};
