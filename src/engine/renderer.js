// 渲染器与后期：移轴景深（HD-2D 微缩感）、泛光、调色暗角、胶片颗粒。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.5 },     // 焦平面的屏幕 y（0 下 1 上）
    uBand: { value: 0.18 },     // 清晰带半宽
    uAmount: { value: 2.6 },    // 最大模糊半径（像素）
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uDir, uRes;
    uniform float uFocus, uBand, uAmount;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - uFocus) - uBand);
      float r = clamp(d * 3.2, 0.0, 1.0);
      r = r * r * uAmount;
      vec2 step = uDir / uRes * r;
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
      sum += texture2D(tDiffuse, vUv + step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv - step * 1.3846153846) * 0.3162162162;
      sum += texture2D(tDiffuse, vUv + step * 3.2307692308) * 0.0702702703;
      sum += texture2D(tDiffuse, vUv - step * 3.2307692308) * 0.0702702703;
      gl_FragColor = sum;
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uSat: { value: 1.06 },
    uContrast: { value: 1.04 },
    uLift: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uGrain: { value: 0.035 },
    uFade: { value: 0 },          // 整体渐黑（过场）
    uFadeColor: { value: new THREE.Vector3(0, 0, 0) },
    uInk: { value: 0 },           // 墨染（蠹出现时画面边缘墨色侵蚀）
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uSat, uContrast, uGrain, uFade, uInk, uFlash;
    uniform vec3 uLift, uTint, uFadeColor;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = col * uTint + uLift;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      vec2 q = vUv - 0.5;
      float vig = 1.0 - dot(q, q) * uVignette * 2.2;
      col *= clamp(vig, 0.0, 1.0);
      // 墨染
      if (uInk > 0.0) {
        float n = noise(vUv * 6.0 + uTime * 0.15) * 0.6 + noise(vUv * 17.0 - uTime * 0.1) * 0.4;
        float edge = length(q * vec2(1.3, 1.0));
        float m = smoothstep(0.75 - uInk * 0.55, 0.95 - uInk * 0.55, edge + n * 0.25);
        col = mix(col, vec3(0.05, 0.05, 0.07), m * 0.92);
      }
      col += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      col = mix(col, vec3(1.0, 0.98, 0.92), uFlash);
      col = mix(col, uFadeColor, uFade);
      gl_FragColor = vec4(col, c.a);
    }
  `,
};

export const QUALITY = {
  high: { pixelRatio: 2, shadows: 2048, bloom: true, tilt: true, grade: true },
  medium: { pixelRatio: 1.5, shadows: 1024, bloom: true, tilt: true, grade: true },
  low: { pixelRatio: 1, shadows: 0, bloom: false, tilt: false, grade: true },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.qualityName = 'high';
    this.quality = QUALITY.high;
    this.scene = null;
    this.camera = null;
    this.composer = null;
    this.size = new THREE.Vector2(1, 1);
    this.grade = null;
    this.tiltH = null;
    this.tiltV = null;
    this.bloom = null;
    this.time = 0;
    window.addEventListener('resize', () => this.resize());
  }
  setQuality(name) {
    this.qualityName = QUALITY[name] ? name : 'high';
    this.quality = QUALITY[this.qualityName];
    this.renderer.shadowMap.enabled = this.quality.shadows > 0;
    if (this.scene && this.camera) this.setup(this.scene, this.camera);
  }
  setup(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const q = this.quality;
    const prevGrade = this.grade ? { ...Object.fromEntries(Object.entries(this.grade.uniforms).map(([k, v]) => [k, v.value])) } : null;
    if (this.composer) this.composer.dispose();
    const composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = null; this.tiltH = null; this.tiltV = null;
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.92);
      composer.addPass(this.bloom);
    }
    if (q.tilt) {
      this.tiltH = new ShaderPass(TiltShiftShader);
      this.tiltV = new ShaderPass(TiltShiftShader);
      this.tiltV.uniforms.uDir.value.set(0, 1);
      composer.addPass(this.tiltH);
      composer.addPass(this.tiltV);
    }
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    if (prevGrade) for (const [k, v] of Object.entries(prevGrade)) {
      if (k === 'tDiffuse') continue;
      const u = this.grade.uniforms[k];
      if (u && u.value && u.value.copy) u.value.copy(v); else if (u) u.value = v;
    }
    this.composer = composer;
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.size.set(w, h);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
      const rw = w * pr, rh = h * pr;
      for (const p of [this.tiltH, this.tiltV]) if (p) p.uniforms.uRes.value.set(rw, rh);
      if (this.bloom) this.bloom.setSize(Math.round(w * pr / 2), Math.round(h * pr / 2));
    }
  }
  setTilt({ focus = 0.45, band = 0.16, amount = 2.4 } = {}) {
    for (const p of [this.tiltH, this.tiltV]) if (p) { p.uniforms.uFocus.value = focus; p.uniforms.uBand.value = band; p.uniforms.uAmount.value = amount; }
  }
  setBloom({ strength = 0.55, radius = 0.55, threshold = 0.92 } = {}) {
    if (!this.bloom) return;
    this.bloom.strength = strength; this.bloom.radius = radius; this.bloom.threshold = threshold;
  }
  gradeUniforms() { return this.grade ? this.grade.uniforms : null; }
  render(dt) {
    this.time += dt;
    if (this.grade) this.grade.uniforms.uTime.value = this.time;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
