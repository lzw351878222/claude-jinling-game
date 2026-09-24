// 角色：像素精灵广告牌（视觉上正对相机、深度按竖直平面计算，避免"躺进"身后的墙），
// 行走动画、朝向、路径移动、情绪气泡、脚下圆影。
import * as THREE from 'three';
import { FW, FH } from './sprites.js';

export const PX = 1 / 48; // 精灵像素 → 世界单位

const spriteVS = /* glsl */`
  uniform vec4 uFrame;       // uv 偏移(x,y) 与缩放(z,w)
  uniform float uTilt;       // 朝相机倾斜角（绕 x 轴）
  uniform float uFlip;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = vec2(uFlip > 0.5 ? 1.0 - uv.x : uv.x, uv.y) * uFrame.zw + uFrame.xy;
    vec3 p = position;
    vec3 vis = vec3(p.x, p.y * cos(uTilt), -p.y * sin(uTilt));
    vec4 mvVis = modelViewMatrix * vec4(vis, 1.0);
    vec4 mvLog = modelViewMatrix * vec4(p, 1.0);
    vec4 clipVis = projectionMatrix * mvVis;
    vec4 clipLog = projectionMatrix * mvLog;
    gl_Position = clipVis;
    gl_Position.z = clipLog.z / clipLog.w * clipVis.w;
    vec4 mvPosition = mvVis;
    #include <fog_vertex>
  }
`;
const spriteFS = /* glsl */`
  uniform sampler2D map;
  uniform vec3 uTint;
  uniform float uFlash, uAlpha, uGlow;
  uniform vec3 uGlowColor;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.5) discard;
    vec3 col = c.rgb * uTint;
    col = mix(col, vec3(1.0), uFlash);
    col += uGlowColor * uGlow;
    gl_FragColor = vec4(col, uAlpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

let blobTex = null;
function getBlobTex() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

export function makeSpriteMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      map: { value: texture },
      uFrame: { value: new THREE.Vector4(0, 0, 1, 1) },
      uTilt: { value: 0.6 },
      uFlip: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uFlash: { value: 0 },
      uAlpha: { value: 1 },
      uGlow: { value: 0 },
      uGlowColor: { value: new THREE.Color(1, 0.9, 0.6) },
    }]),
    vertexShader: spriteVS,
    fragmentShader: spriteFS,
    fog: true,
    transparent: false,
  });
}

export function textureFromCanvas(c) {
  const t = c.isTexture ? c : new THREE.Texture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const DIR_ROW = { down: 'front', left: 'front', right: 'front', up: 'back' };

export class Actor {
  /**
   * @param {object} o
   *  id, name, texture(THREE.Texture), sheet: { fw, fh, cols, rows: { front: r, back: r, front2?: r, back2?: r } }
   *  x, z, dir, speed, scale, float(悬浮高度), shadow(true)
   */
  constructor(o) {
    this.id = o.id;
    this.name = o.name || '';
    this.data = o;
    this.pos = new THREE.Vector3(o.x ?? 0, 0, o.z ?? 0);
    this.dir = o.dir || 'down';
    this.speed = o.speed ?? 3.2;
    this.scale = o.scale ?? 1;
    this.floatH = o.float ?? 0;
    this.sheet = { fw: FW, fh: FH, cols: 3, rowsTotal: 2, rows: { front: 0, back: 1 }, ...(o.sheet || {}) };
    this.variant = ''; // '' 或 '2'（例如霓裳）
    this.path = null;
    this.onArrive = null;
    this.walkT = 0;
    this.moving = false;
    this.bob = 0;
    this.lean = 0;
    this.visible = true;
    this.frameOverride = null;
    this.emoteMesh = null;
    this.emoteT = 0;
    this.local = new THREE.Color(0, 0, 0);
    this.tint = new THREE.Color(1, 1, 1);
    this.flash = 0;
    this.group = new THREE.Group();
    const w = this.sheet.fw * PX * this.scale, h = this.sheet.fh * PX * this.scale;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    this.material = makeSpriteMaterial(o.texture);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.group.add(this.mesh);
    if (o.shadow !== false) {
      const sg = new THREE.PlaneGeometry(1, 1);
      sg.rotateX(-Math.PI / 2);
      this.shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: getBlobTex(), transparent: true, depthWrite: false, opacity: 0.9 }));
      this.shadowSize = o.shadowSize ?? 0.95 * this.scale;
      this.shadow.scale.set(this.shadowSize, 1, this.shadowSize * 0.55);
      this.shadow.renderOrder = 0;
      this.group.add(this.shadow);
    }
    this.hitH = h * 0.85;
    this.hitW = w * 0.6;
    this.setFrame(0, 'front');
  }
  setTexture(tex, sheet) {
    this.material.uniforms.map.value = tex;
    if (sheet) this.sheet = { ...this.sheet, ...sheet };
  }
  setFrame(col, rowName) {
    const s = this.sheet;
    const row = s.rows[rowName + this.variant] ?? s.rows[rowName] ?? 0;
    const u = this.material.uniforms.uFrame.value;
    u.set(col / s.cols, 1 - (row + 1) / s.rowsTotal, 1 / s.cols, 1 / s.rowsTotal);
  }
  face(dir) { this.dir = dir; }
  faceTowards(x, z) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    if (Math.abs(dx) > Math.abs(dz)) this.dir = dx > 0 ? 'right' : 'left';
    else this.dir = dz > 0 ? 'down' : 'up';
  }
  /** 沿路径点行走；返回 Promise，走到终点时 resolve */
  walkTo(points, speed) {
    if (!points || !points.length) return Promise.resolve();
    this.path = points.map((p) => (Array.isArray(p) ? { x: p[0], z: p[1] } : p));
    if (speed) this._pathSpeed = speed; else this._pathSpeed = null;
    return new Promise((res) => { this.onArrive = res; });
  }
  stop() {
    this.path = null;
    this.moving = false;
    if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
  }
  emote(canvasTex, dur = 1.6) {
    if (!this.emoteMesh) {
      const g = new THREE.PlaneGeometry(0.62, 0.62);
      this.emoteMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }));
      this.emoteMesh.renderOrder = 20;
      this.group.add(this.emoteMesh);
    }
    this.emoteMesh.material.map = canvasTex;
    this.emoteMesh.material.needsUpdate = true;
    this.emoteMesh.visible = true;
    this.emoteT = dur;
  }
  update(dt, world, t, camera) {
    // 路径移动
    if (this.path && this.path.length) {
      const tgt = this.path[0];
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const sp = (this._pathSpeed || this.speed) * dt;
      if (d <= sp) {
        this.pos.x = tgt.x; this.pos.z = tgt.z;
        this.path.shift();
        if (!this.path.length) { this.path = null; this.moving = false; if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); } }
      } else {
        this.pos.x += (dx / d) * sp; this.pos.z += (dz / d) * sp;
        this.moving = true;
        if (Math.abs(dx) > Math.abs(dz) * 0.8) this.dir = dx > 0 ? 'right' : 'left'; else this.dir = dz > 0 ? 'down' : 'up';
      }
    }
    this.animate(dt, world, t, camera);
  }
  animate(dt, world, t, camera) {
    // 动画帧：站 / 左步 / 站 / 右步
    let col = 0;
    if (this.moving) {
      this.walkT += dt * (this.speed > 4 ? 10 : 8);
      const ph = Math.floor(this.walkT) % 4;
      col = ph === 1 ? 1 : ph === 3 ? 2 : 0;
      this.bob = (ph === 0 || ph === 2) ? 0.035 : 0;
      this.lean += ((this.dir === 'left' ? 1 : this.dir === 'right' ? -1 : 0) * 0.06 - this.lean) * Math.min(1, dt * 10);
    } else {
      this.walkT = 0;
      this.bob = Math.sin(t * 2.2 + this.pos.x) * 0.012;
      this.lean += (0 - this.lean) * Math.min(1, dt * 8);
    }
    if (this.frameOverride) { col = this.frameOverride.col; }
    const rowName = this.frameOverride?.row || DIR_ROW[this.dir] || 'front';
    this.setFrame(col, rowName);
    this.material.uniforms.uFlip.value = this.dir === 'right' && this.flipRight ? 1 : 0;
    const gy = world ? world.heightAt(this.pos.x, this.pos.z) : 0;
    const fy = this.floatH ? this.floatH + Math.sin(t * 2.4 + (this.id?.length || 0)) * 0.08 : 0;
    this.group.position.set(this.pos.x, gy, this.pos.z);
    this.mesh.position.set(0, this.bob + fy, 0);
    this.mesh.rotation.z = this.lean;
    if (camera) this.material.uniforms.uTilt.value = camera.userData.pitch ?? 0.6;
    if (this.shadow) {
      this.shadow.position.set(0, 0.03, 0.02);
      const k = this.floatH ? 0.7 - Math.sin(t * 2.4) * 0.05 : 1;
      this.shadow.scale.set(this.shadowSize * k, 1, this.shadowSize * 0.55 * k);
    }
    // 光照：场景色 + 附近灯光
    const u = this.material.uniforms;
    u.uTint.value.copy(this.tint).add(this.local);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 2.5); }
    u.uFlash.value = this.flash;
    if (this.emoteMesh && this.emoteMesh.visible) {
      this.emoteT -= dt;
      const hh = this.sheet.fh * PX * this.scale;
      const pop = Math.min(1, (1.6 - this.emoteT) * 6);
      this.emoteMesh.position.set(0.25, hh * 0.92 + fy + Math.sin(t * 6) * 0.03, 0.1);
      this.emoteMesh.scale.setScalar(0.5 + 0.5 * pop);
      if (camera) this.emoteMesh.quaternion.copy(camera.quaternion);
      if (this.emoteT <= 0) this.emoteMesh.visible = false;
    }
    this.group.visible = this.visible;
  }
  /** 头顶位置（世界坐标），给 UI 投影用 */
  headPos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.group.position.y + this.sheet.fh * PX * this.scale * 0.95 + (this.floatH || 0), this.pos.z);
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    if (this.shadow) { this.shadow.geometry.dispose(); this.shadow.material.dispose(); }
    if (this.emoteMesh) { this.emoteMesh.geometry.dispose(); this.emoteMesh.material.dispose(); }
  }
}

// ------------------------------------------------------------------ 情绪气泡贴图
const emoteCache = new Map();
export function emoteTexture(kind) {
  if (emoteCache.has(kind)) return emoteCache.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  // 气泡
  g.fillStyle = '#fbf6ea';
  g.strokeStyle = '#2a2420';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(3, 3, 26, 21, 6);
  g.fill(); g.stroke();
  g.beginPath(); g.moveTo(11, 23); g.lineTo(9, 30); g.lineTo(17, 23); g.fillStyle = '#fbf6ea'; g.fill();
  g.beginPath(); g.moveTo(11, 24); g.lineTo(9, 30); g.lineTo(16, 24); g.stroke();
  g.fillStyle = '#fbf6ea'; g.fillRect(10, 21, 7, 3);
  const col = { '!': '#c0392b', '?': '#2c5d8a', '…': '#3a3530', '♪': '#3f7f6f', '❤': '#d94c5a', '怒': '#c0392b', '汗': '#4a8ac0', '光': '#d9a52a' }[kind] || '#2a2420';
  g.fillStyle = col;
  g.font = 'bold 18px "JLBrush", KaiTi, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const glyph = { '怒': '💢', '汗': '💧', '光': '✦' }[kind] || kind;
  g.fillText(glyph, 16, 14);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  emoteCache.set(kind, t);
  return t;
}
