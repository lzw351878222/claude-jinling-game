// 镜头：固定朝北的斜俯视（HD-2D），平滑跟随、前瞻、边界约束、过场运镜与震屏。
import * as THREE from 'three';
import { clamp, easeInOutCubic, lerp } from '../core/util.js';

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 400);
    this.target = new THREE.Vector3(0, 0, 0);
    this.goal = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.dist = 21;
    this.pitch = THREE.MathUtils.degToRad(38);
    this.yaw = 0;
    this.follow = null;
    this.bounds = null; // [x0, z0, x1, z1]
    this.lookAhead = new THREE.Vector3();
    this.shakeT = 0; this.shakeAmp = 0;
    this.tween = null;
    this.userZoom = 1;
    this.baseDist = 21;
    this.basePitch = this.pitch;
    this.camera.userData.pitch = this.pitch;
  }
  setBase({ dist = 21, pitch = 38, fov = 30 } = {}) {
    this.baseDist = dist; this.dist = dist;
    this.basePitch = THREE.MathUtils.degToRad(pitch); this.pitch = this.basePitch;
    this.camera.fov = fov; this.camera.updateProjectionMatrix();
  }
  snap() {
    if (this.follow) this.goal.set(this.follow.pos.x, this.follow.group.position.y, this.follow.pos.z);
    this.clampGoal();
    this.target.copy(this.goal);
    this.vel.set(0, 0, 0);
    this.apply(0);
  }
  clampGoal() {
    if (!this.bounds) return;
    const [x0, z0, x1, z1] = this.bounds;
    // 视野半宽随距离变化
    const hw = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.dist * this.camera.aspect * 0.8;
    const hd = this.dist * 0.36;
    this.goal.x = x1 - x0 > hw * 2 ? clamp(this.goal.x, x0 + hw, x1 - hw) : (x0 + x1) / 2;
    this.goal.z = z1 - z0 > hd * 2 ? clamp(this.goal.z, z0 + hd * 0.8, z1 - hd * 0.9) : (z0 + z1) / 2;
  }
  shake(amp = 0.3, dur = 0.4) { this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, dur); }
  /** 过场：把镜头移到某点 / 改变距离、俯角；返回 Promise */
  moveTo({ x, z, y = null, dist = null, pitch = null, dur = 1.2 } = {}) {
    return new Promise((res) => {
      this.tween = {
        t: 0, dur: Math.max(0.01, dur),
        from: { x: this.target.x, y: this.target.y, z: this.target.z, dist: this.dist, pitch: this.pitch },
        to: { x: x ?? this.target.x, y: y ?? this.target.y, z: z ?? this.target.z, dist: dist ?? this.dist, pitch: pitch != null ? THREE.MathUtils.degToRad(pitch) : this.pitch },
        res,
      };
    });
  }
  /** 回到跟随模式 */
  release(dur = 0.8) {
    return new Promise((res) => {
      const f = this.follow;
      const gx = f ? f.pos.x : this.target.x, gz = f ? f.pos.z : this.target.z;
      this.goal.set(gx, f ? f.group.position.y : 0, gz); this.clampGoal();
      this.tween = {
        t: 0, dur, from: { x: this.target.x, y: this.target.y, z: this.target.z, dist: this.dist, pitch: this.pitch },
        to: { x: this.goal.x, y: this.goal.y, z: this.goal.z, dist: this.baseDist * this.userZoom, pitch: this.basePitch }, res, release: true,
      };
    });
  }
  zoom(delta) {
    this.userZoom = clamp(this.userZoom * (1 + delta), 0.7, 1.35);
    if (!this.tween) this.dist = this.baseDist * this.userZoom;
  }
  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = easeInOutCubic(Math.min(1, tw.t / tw.dur));
      this.target.set(lerp(tw.from.x, tw.to.x, k), lerp(tw.from.y, tw.to.y, k), lerp(tw.from.z, tw.to.z, k));
      this.dist = lerp(tw.from.dist, tw.to.dist, k);
      this.pitch = lerp(tw.from.pitch, tw.to.pitch, k);
      if (tw.t >= tw.dur) {
        this.tween = null;
        if (tw.release) this.cinematic = false;
        tw.res();
      }
    } else if (this.follow && !this.cinematic) {
      const f = this.follow;
      // 前瞻：沿移动方向略微领先
      const la = this.lookAhead;
      const tx = f.moving ? (f.dir === 'left' ? -1.4 : f.dir === 'right' ? 1.4 : 0) : 0;
      const tz = f.moving ? (f.dir === 'up' ? -1.0 : f.dir === 'down' ? 0.8 : 0) : 0;
      la.x += (tx - la.x) * Math.min(1, dt * 1.6);
      la.z += (tz - la.z) * Math.min(1, dt * 1.6);
      this.goal.set(f.pos.x + la.x, f.group.position.y * 0.8, f.pos.z + la.z);
      this.clampGoal();
      // 临界阻尼弹簧
      const w = 4.2;
      const ax = w * w * (this.goal.x - this.target.x) - 2 * w * this.vel.x;
      const ay = w * w * (this.goal.y - this.target.y) - 2 * w * this.vel.y;
      const az = w * w * (this.goal.z - this.target.z) - 2 * w * this.vel.z;
      this.vel.x += ax * dt; this.vel.y += ay * dt; this.vel.z += az * dt;
      this.target.x += this.vel.x * dt; this.target.y += this.vel.y * dt; this.target.z += this.vel.z * dt;
      const want = this.baseDist * this.userZoom;
      this.dist += (want - this.dist) * Math.min(1, dt * 4);
    }
    this.apply(dt);
  }
  apply(dt) {
    const c = this.camera;
    const y = Math.sin(this.pitch) * this.dist, h = Math.cos(this.pitch) * this.dist;
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * 2.5;
      sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    c.position.set(this.target.x + sx, this.target.y + y + sy, this.target.z + h);
    c.lookAt(this.target.x + sx, this.target.y + 0.9 + sy, this.target.z);
    c.userData.pitch = this.pitch;
    c.updateMatrixWorld();
  }
}
