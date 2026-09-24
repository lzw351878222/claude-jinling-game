// 场景环境：光照预设（晨、昼、黄昏、夜、室内、时隙）、天空、雾、精灵色调。
import * as THREE from 'three';

export const PRESETS = {
  day: {
    sky: ['#9cc3dc', '#d9e8ea'], fog: '#c9d8dc', fogNear: 26, fogFar: 70,
    hemiSky: '#cfe3f0', hemiGround: '#8a7a5e', hemi: 1.15,
    sun: '#fff1dc', sunI: 2.3, sunDir: [-0.45, 0.85, 0.55], amb: 0.25,
    tint: '#ffffff', exposure: 1.0,
    grade: { tint: [1.02, 1.0, 0.97], lift: [0.0, 0.0, 0.01], sat: 1.08, contrast: 1.05, vignette: 0.28 },
    water: { deep: '#2f6168', shallow: '#56928c', sky: '#dcebee' },
    bloom: { strength: 0.35, radius: 0.5, threshold: 0.95 },
  },
  morning: {
    sky: ['#b8cfe0', '#f2e2cc'], fog: '#e3dccd', fogNear: 22, fogFar: 64,
    hemiSky: '#e8e6dc', hemiGround: '#8a7a5e', hemi: 1.1,
    sun: '#ffe2b8', sunI: 2.0, sunDir: [0.6, 0.6, 0.6], amb: 0.25,
    tint: '#fff8ee', exposure: 1.0,
    grade: { tint: [1.03, 1.0, 0.95], lift: [0.01, 0.005, 0.0], sat: 1.04, contrast: 1.03, vignette: 0.3 },
    water: { deep: '#3a6670', shallow: '#6a9a94', sky: '#f2e6d4' },
    bloom: { strength: 0.4, radius: 0.55, threshold: 0.93 },
  },
  dusk: {
    sky: ['#3d4a78', '#f0a060'], fog: '#c98a6a', fogNear: 20, fogFar: 58,
    hemiSky: '#e0a080', hemiGround: '#4a3a4a', hemi: 0.95,
    sun: '#ffb070', sunI: 2.6, sunDir: [0.85, 0.35, 0.3], amb: 0.22,
    tint: '#ffe0c4', exposure: 1.0,
    grade: { tint: [1.06, 0.96, 0.9], lift: [0.02, 0.0, 0.03], sat: 1.12, contrast: 1.06, vignette: 0.4 },
    water: { deep: '#3a3e5a', shallow: '#8a6a6a', sky: '#f5b27e' },
    bloom: { strength: 0.55, radius: 0.6, threshold: 0.88 },
  },
  night: {
    sky: ['#0b1224', '#1f2c4a'], fog: '#141d33', fogNear: 18, fogFar: 52,
    hemiSky: '#5a6ea0', hemiGround: '#1a1a26', hemi: 0.55,
    sun: '#9fb4e8', sunI: 0.75, sunDir: [-0.3, 0.8, 0.5], amb: 0.12,
    tint: '#a8b4d8', exposure: 1.0,
    grade: { tint: [0.95, 0.98, 1.08], lift: [0.0, 0.01, 0.03], sat: 1.1, contrast: 1.08, vignette: 0.5 },
    water: { deep: '#0e1a2c', shallow: '#1d3048', sky: '#6a82b8' },
    bloom: { strength: 0.95, radius: 0.7, threshold: 0.72 },
  },
  festival: {
    sky: ['#120e24', '#3a2440'], fog: '#2a1a2e', fogNear: 18, fogFar: 54,
    hemiSky: '#8a6a9a', hemiGround: '#2a1a1a', hemi: 0.6,
    sun: '#c0a8e0', sunI: 0.6, sunDir: [-0.3, 0.8, 0.5], amb: 0.14,
    tint: '#d8b8b0', exposure: 1.05,
    grade: { tint: [1.06, 0.98, 0.98], lift: [0.02, 0.0, 0.02], sat: 1.16, contrast: 1.08, vignette: 0.48 },
    water: { deep: '#140e22', shallow: '#2a1e3a', sky: '#b86a5a' },
    bloom: { strength: 1.05, radius: 0.72, threshold: 0.7 },
  },
  interior: {
    sky: ['#2a2018', '#3a2c20'], fog: '#2a2018', fogNear: 22, fogFar: 60,
    hemiSky: '#f2d8b0', hemiGround: '#5a4030', hemi: 1.0,
    sun: '#ffe0b0', sunI: 1.6, sunDir: [-0.5, 0.9, 0.45], amb: 0.3,
    tint: '#fff0dc', exposure: 1.0,
    grade: { tint: [1.05, 1.0, 0.92], lift: [0.01, 0.0, 0.0], sat: 1.05, contrast: 1.05, vignette: 0.45 },
    water: { deep: '#2f6168', shallow: '#56928c', sky: '#dcebee' },
    bloom: { strength: 0.5, radius: 0.6, threshold: 0.88 },
  },
  rift: {
    sky: ['#07060c', '#1c1430'], fog: '#120c1e', fogNear: 20, fogFar: 60,
    hemiSky: '#8a7ac8', hemiGround: '#2a1a1a', hemi: 0.7,
    sun: '#e8d0ff', sunI: 1.1, sunDir: [-0.2, 0.9, 0.4], amb: 0.2,
    tint: '#d8d0f0', exposure: 1.05,
    grade: { tint: [1.0, 0.97, 1.08], lift: [0.02, 0.0, 0.04], sat: 1.05, contrast: 1.1, vignette: 0.55 },
    water: { deep: '#0a0814', shallow: '#221a38', sky: '#c8a8ff' },
    bloom: { strength: 1.0, radius: 0.75, threshold: 0.7 },
  },
};

export class Env {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 2.5;
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 0.5; sc.far = 90;
    this.amb = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(this.hemi, this.sun, this.sun.target, this.amb);
    this.fog = new THREE.Fog(0xffffff, 20, 60);
    scene.fog = this.fog;
    this.skyTex = null;
    this.preset = null;
    this.spriteTint = new THREE.Color(1, 1, 1);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.stars = null;
  }
  apply(name, over = {}) {
    const p = { ...PRESETS[name] || PRESETS.day, ...over };
    this.preset = p;
    this.name = name;
    this.hemi.color.set(p.hemiSky); this.hemi.groundColor.set(p.hemiGround); this.hemi.intensity = p.hemi;
    this.sun.color.set(p.sun); this.sun.intensity = p.sunI;
    this.sunDir.set(...p.sunDir).normalize();
    this.amb.intensity = p.amb;
    this.fog.color.set(p.fog); this.fog.near = p.fogNear; this.fog.far = p.fogFar;
    this.spriteTint.set(p.tint);
    this.setSky(p.sky);
    const shadows = this.renderer.quality.shadows;
    this.sun.castShadow = shadows > 0;
    if (shadows > 0) { this.sun.shadow.mapSize.set(shadows, shadows); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    const gu = this.renderer.gradeUniforms();
    if (gu) {
      gu.uTint.value.set(...p.grade.tint); gu.uLift.value.set(...p.grade.lift);
      gu.uSat.value = p.grade.sat; gu.uContrast.value = p.grade.contrast; gu.uVignette.value = p.grade.vignette;
    }
    this.renderer.setBloom(p.bloom);
    this.renderer.renderer.toneMappingExposure = p.exposure;
    this.setStars(name === 'night' || name === 'festival' || name === 'rift');
  }
  setSky([top, bottom]) {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    if (this.skyTex) this.skyTex.dispose();
    this.skyTex = new THREE.CanvasTexture(c);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTex;
  }
  setStars(on) {
    if (on && !this.stars) {
      const n = 600, pos = new Float32Array(n * 3), sz = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
        const r = 160;
        pos[i * 3] = Math.cos(th) * Math.cos(ph) * r; pos[i * 3 + 1] = Math.sin(ph) * r + 10; pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
        sz[i] = Math.random() < 0.08 ? 2.4 : 1.2;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'attribute float size; varying float vS; uniform float uTime; void main(){ vS = size; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (1.0 + 0.3*sin(uTime*2.0 + position.x)); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float vS; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vec3(0.9,0.92,1.0)*(1.0-d*1.6), 1.0); }',
        transparent: true, depthWrite: false, fog: false,
      });
      this.stars = new THREE.Points(g, m);
      this.stars.frustumCulled = false;
      this.scene.add(this.stars);
    }
    if (this.stars) this.stars.visible = on;
  }
  /** 让阴影相机与太阳跟随镜头目标 */
  update(dt, t, focus) {
    const d = 40;
    this.sun.position.set(focus.x + this.sunDir.x * d, focus.y + this.sunDir.y * d, focus.z + this.sunDir.z * d);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
    if (this.stars) { this.stars.position.copy(focus); this.stars.material.uniforms.uTime.value = t; }
  }
}
