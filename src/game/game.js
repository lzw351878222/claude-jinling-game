// 游戏核心：地图加载、角色、玩家控制、互动、镜头、环境、粒子、主循环。
import * as THREE from 'three';
import { Renderer } from '../engine/renderer.js';
import { CameraRig } from '../engine/camera.js';
import { Env } from '../engine/env.js';
import { Particles } from '../engine/particles.js';
import { Input } from '../engine/input.js';
import { World } from '../engine/world.js';
import { makeBuilder, updateDyn } from '../engine/build.js';
import { Actor, textureFromCanvas, emoteTexture, PX } from '../engine/actors.js';
import { humanSheet, qilinSheet, giraffeSheet, silverfishSheet, bustCanvas } from '../engine/sprites.js';
import { ASSETS, loadImage } from '../assets.js';
import { audio } from '../core/audio.js';
import { clamp } from '../core/util.js';

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

export class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.renderer = new Renderer(this.canvas);
    this.scene = new THREE.Scene();
    this.rig = new CameraRig();
    this.env = new Env(this.scene, this.renderer);
    this.particles = new Particles();
    this.scene.add(this.particles.points);
    this.input = new Input();
    this.actors = new Map();
    this.things = [];
    this.triggers = [];
    this.world = null;
    this.mapDef = null;
    this.mapGroup = null;
    this.dyn = [];
    this.busy = 0;
    this.time = 0;
    this.paused = false;
    this.running = false;
    this.hooks = { update: new Set() };
    this.lightPool = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clickTarget = null;
    this.sheets = new Map();
    this.state = null; // 由 story/state 管理
    this.ui = null;    // 由 main 注入
    this.stepT = 0;
    for (let i = 0; i < 4; i++) {
      const L = new THREE.PointLight(0xffaa66, 0, 6, 1.6);
      L.castShadow = false;
      this.scene.add(L);
      this.lightPool.push(L);
    }
    this.renderer.setQuality(this.pickQuality());
    this.renderer.setup(this.scene, this.rig.camera);
    this.bindPointer();
  }
  pickQuality() {
    const saved = this.settings?.quality;
    if (saved) return saved;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
    return mobile ? 'medium' : 'high';
  }

  // ---------------------------------------------------------------- 精灵表
  async kangyeTexture() {
    if (this.sheets.has('kangye')) return this.sheets.get('kangye');
    const img = await loadImage(ASSETS.sheet);
    const t = textureFromCanvas(new THREE.Texture(img));
    t.image = img;
    t.needsUpdate = true;
    const entry = { tex: t, sheet: { fw: 64, fh: 132, cols: 3, rowsTotal: 4, rows: { front: 0, back: 1, front2: 2, back2: 3 } }, bust: null };
    this.sheets.set('kangye', entry);
    return entry;
  }
  sheetFor(look) {
    const key = typeof look === 'string' ? look : JSON.stringify(look);
    if (this.sheets.has(key)) return this.sheets.get(key);
    let entry;
    if (look === 'qilin') {
      const c = qilinSheet();
      entry = { tex: textureFromCanvas(c), canvas: c, sheet: { fw: 48, fh: 48, cols: 2, rowsTotal: 2, rows: { front: 0, back: 1 } } };
    } else if (look === 'giraffe') {
      const c = giraffeSheet();
      entry = { tex: textureFromCanvas(c), canvas: c, sheet: { fw: 96, fh: 176, cols: 2, rowsTotal: 1, rows: { front: 0, back: 0 } } };
    } else if (look === 'worm' || look === 'bigworm') {
      const c = silverfishSheet(look === 'bigworm');
      entry = { tex: textureFromCanvas(c), canvas: c, sheet: { fw: look === 'bigworm' ? 128 : 48, fh: look === 'bigworm' ? 64 : 24, cols: 4, rowsTotal: 1, rows: { front: 0, back: 0 } } };
    } else {
      const c = humanSheet(look);
      entry = { tex: textureFromCanvas(c), canvas: c, sheet: { fw: 64, fh: 132, cols: 3, rowsTotal: 2, rows: { front: 0, back: 1 } } };
    }
    this.sheets.set(key, entry);
    return entry;
  }
  bustOf(actor) {
    const look = actor?.data?.look;
    if (!look) return null;
    const e = this.sheetFor(look);
    if (!e.bust && e.canvas && e.sheet.fh === 132) e.bust = bustCanvas(e.canvas, 4).toDataURL();
    if (!e.bust && e.canvas) {
      const c = document.createElement('canvas');
      const s = Math.max(1, Math.floor(160 / e.sheet.fw));
      c.width = e.sheet.fw * s; c.height = Math.min(e.sheet.fh, 80) * s;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(e.canvas, 0, 0, e.sheet.fw, Math.min(e.sheet.fh, 80), 0, 0, c.width, c.height);
      e.bust = c.toDataURL();
    }
    return e.bust;
  }

  // ---------------------------------------------------------------- 地图
  async loadMap(def, spawnKey = 'default', opts = {}) {
    this.clearMap();
    this.mapDef = def;
    const world = new World(def);
    this.world = world;
    world.build();
    const B = makeBuilder(world, this);
    B.addEmitter = (kind, x, y, z) => this.particles.addEmitter(emitterFor(kind, x, y, z));
    def.build?.(B, this);
    world.finish();
    this.applyStages(opts.restored || new Set());
    const flora = B.flora.build();
    this.mapGroup = new THREE.Group();
    this.mapGroup.add(world.group);
    if (flora) { this.mapGroup.add(flora); this.floraMesh = flora; }
    this.mapGroup.add(B.extra);
    this.scene.add(this.mapGroup);
    this.dyn = B.dyn;
    // 环境
    const envName = typeof def.env === 'string' ? def.env : def.env?.preset || 'day';
    this.setEnv(envName, def.env?.over || {});
    const cam = def.camera || {};
    this.rig.setBase({ dist: cam.dist ?? 21, pitch: cam.pitch ?? 38, fov: cam.fov ?? 30 });
    this.rig.bounds = def.bounds || [0, 0, def.w, def.h];
    this.renderer.setTilt(def.tilt || { focus: 0.45, band: 0.17, amount: 2.0 });
    // 玩家
    const kt = await this.kangyeTexture();
    const sp = (def.spawns && def.spawns[spawnKey]) || def.spawns?.default || [def.w / 2, def.h / 2, 'down'];
    this.player = new Actor({ id: 'kangye', name: '康晔', texture: kt.tex, sheet: kt.sheet, x: sp[0], z: sp[1], dir: sp[2] || 'down', speed: 3.4 });
    this.player.variant = this.state?.flags?.nishang && !def.modernClothes ? '2' : '';
    this.player.data.look = null;
    this.actors.set('kangye', this.player);
    this.scene.add(this.player.group);
    this.rig.follow = this.player;
    // 阿麟
    if (def.noFollower !== true && this.state?.flags?.alingJoined) this.spawnFollower();
    // NPC 与可交互物
    for (const n of def.npcs || []) { if (!n.when || n.when(this)) this.spawnNpc(n); }
    this.things = (def.things || []).map((t) => ({ ...t }));
    this.triggers = (def.triggers || []).map((t) => ({ ...t, fired: false }));
    // 粒子
    this.particles.clear();
    this.particles.clearEmitters();
    def.particles?.(this.particles, this);
    // 音乐
    if (def.music !== undefined && !opts.keepMusic) audio.music(def.music);
    audio.ambient(def.ambient || null);
    this.rig.snap();
    this.ui?.setLocation(def.name, def.era);
    for (const [, a] of this.actors) a.animate(0, world, this.time, this.rig.camera);
    if (def.onLoad) def.onLoad(this);
    return world;
  }
  /** 切换光照预设（昼夜），同步水面颜色 */
  setEnv(envName, over = {}) {
    this.env.apply(envName, over);
    this.night = ['night', 'festival', 'rift'].includes(envName);
    const world = this.world;
    if (world?.waterMesh) {
      const wp = this.env.preset.water;
      const u = world.waterMesh.material.uniforms;
      u.uDeep.value.set(wp.deep); u.uShallow.value.set(wp.shallow); u.uSky.value.set(wp.sky);
      u.uFoam.value.set(wp.shallow).lerp(new THREE.Color(wp.sky), 0.55);
      u.uAlpha.value = this.night ? 0.93 : 0.88;
    }
  }
  clearMap() {
    for (const [, a] of this.actors) { this.scene.remove(a.group); a.dispose(); }
    this.actors.clear();
    this.follower = null;
    this.player = null;
    if (this.mapGroup) {
      this.scene.remove(this.mapGroup);
      this.mapGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.userData?.fadable) o.material.dispose();
      });
      this.mapGroup = null;
    }
    this.world = null;
    this.things = [];
    this.triggers = [];
    this.dyn = [];
    this.floraMesh = null;
  }
  spawnNpc(n) {
    const e = n.sprite === 'kangye' ? this.sheets.get('kangye') : this.sheetFor(n.look || { body: 'man' });
    const a = new Actor({ id: n.id, name: n.name, texture: e.tex, sheet: e.sheet, x: n.x, z: n.z, dir: n.dir || 'down', speed: n.speed ?? 2.4, scale: n.scale ?? 1, float: n.float, shadow: n.shadow });
    a.data = { ...n };
    a.data.look = n.look || (n.sprite === 'qilin' ? 'qilin' : null);
    if (n.look === 'worm' || n.look === 'bigworm') { a.flipRight = true; }
    this.actors.set(n.id, a);
    this.scene.add(a.group);
    if (n.solid !== false && this.world) a._solidTile = this.markActorSolid(a, true);
    return a;
  }
  spawnFollower() {
    const e = this.sheetFor('qilin');
    const f = new Actor({ id: 'aling', name: '阿麟', texture: e.tex, sheet: e.sheet, x: this.player.pos.x + 0.8, z: this.player.pos.z + 0.6, float: 1.05, speed: 4, shadowSize: 0.55 });
    f.data.look = 'qilin';
    f.trail = [];
    this.follower = f;
    this.actors.set('aling', f);
    this.scene.add(f.group);
    return f;
  }
  removeActor(id) {
    const a = this.actors.get(id);
    if (!a) return;
    if (a._solidTile) this.markActorSolid(a, false);
    this.scene.remove(a.group);
    a.dispose();
    this.actors.delete(id);
    if (id === 'aling') this.follower = null;
  }
  markActorSolid(a, on) {
    const tx = Math.floor(a.pos.x), tz = Math.floor(a.pos.z);
    if (!this.world.inBounds(tx, tz)) return null;
    const i = this.world.idx(tx, tz);
    if (on) { const prev = this.world.solid[i]; this.world.solid[i] = 1; return { i, prev }; }
    if (a._solidTile) { this.world.solid[a._solidTile.i] = a._solidTile.prev; a._solidTile = null; }
    return null;
  }
  actor(id) { return this.actors.get(id); }

  // ---------------------------------------------------------------- 指针（点击移动 / 点击交谈）
  bindPointer() {
    this.canvas.addEventListener('pointerdown', (e) => {
      audio.unlock();
      if (this.busy || this.paused || !this.world || !this.player) return;
      if (e.pointerType === 'touch' && this.input.joy.active) return;
      this.input.lastPointerType = e.pointerType;
      const hit = this.pick(e.clientX, e.clientY);
      if (!hit) return;
      if (hit.kind === 'actor' || hit.kind === 'thing') {
        this.clickTarget = hit;
        const tgt = hit.kind === 'actor' ? hit.actor.pos : { x: hit.thing.x, z: hit.thing.z };
        const d = Math.hypot(tgt.x - this.player.pos.x, tgt.z - this.player.pos.z);
        if (d < (hit.kind === 'thing' ? (hit.thing.r || 1.3) + 0.2 : 1.6)) { this.interactWith(hit); return; }
        this.walkPlayerTo(tgt.x, tgt.z, true);
      } else {
        this.clickTarget = null;
        this.walkPlayerTo(hit.point.x, hit.point.z);
        this.ui?.pingGround(e.clientX, e.clientY);
      }
    });
    this.canvas.addEventListener('wheel', (e) => { if (!this.busy) this.rig.zoom(e.deltaY > 0 ? 0.06 : -0.06); }, { passive: true });
  }
  pick(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    // 先检查角色（屏幕空间矩形）
    let best = null, bestD = 1e9;
    const cam = this.rig.camera;
    for (const [id, a] of this.actors) {
      if (id === 'kangye' || !a.visible || (!a.data.talk && !a.data.onTalk)) continue;
      const foot = tmpV.set(a.pos.x, a.group.position.y, a.pos.z).project(cam);
      const head = tmpV2.copy(a.headPos()).project(cam);
      const fx = (foot.x * 0.5 + 0.5) * rect.width, fy = (-foot.y * 0.5 + 0.5) * rect.height;
      const hy = (-head.y * 0.5 + 0.5) * rect.height;
      const hw = Math.max(18, (fy - hy) * 0.3);
      if (cx > fx - hw && cx < fx + hw && cy > hy - 6 && cy < fy + 6) {
        const d = Math.abs(cx - fx);
        if (d < bestD) { bestD = d; best = { kind: 'actor', actor: a }; }
      }
    }
    if (best) return best;
    for (const t of this.things) {
      if (t.when && !t.when(this)) continue;
      const p = tmpV.set(t.x, (this.world.heightAt(t.x, t.z) + (t.y ?? 0.6)), t.z).project(cam);
      const px = (p.x * 0.5 + 0.5) * rect.width, py = (-p.y * 0.5 + 0.5) * rect.height;
      if (Math.hypot(cx - px, cy - py) < 34) return { kind: 'thing', thing: t };
    }
    // 地面
    this.pointer.set((cx / rect.width) * 2 - 1, -(cy / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, cam);
    const targets = [this.world.groundMesh];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length) return { kind: 'ground', point: hits[0].point };
    // 退而求其次：与 y=0 平面求交
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, p)) return { kind: 'ground', point: p };
    return null;
  }
  walkPlayerTo(x, z, toInteract = false) {
    const p = this.player;
    let path = this.world.findPath(p.pos.x, p.pos.z, x, z);
    if (!path) return false;
    if (toInteract && path.length) {
      // 走到目标旁边即可
      const last = path[path.length - 1];
      const dx = last[0] - p.pos.x, dz = last[1] - p.pos.z;
      void dx; void dz;
    }
    path = path.slice(1).map(([px, pz]) => ({ x: px, z: pz }));
    if (!path.length) return false;
    this.autoPath = path;
    return true;
  }

  // ---------------------------------------------------------------- 互动
  nearestInteractable() {
    if (!this.player) return null;
    const p = this.player.pos;
    let best = null, bd = 1e9;
    for (const [id, a] of this.actors) {
      if (id === 'kangye' || id === 'aling' || !a.visible || !(a.data.talk || a.data.onTalk)) continue;
      if (a.data.when && !a.data.when(this)) continue;
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
      if (d < 1.7 && d < bd) { bd = d; best = { kind: 'actor', actor: a, label: a.data.verb || '交谈', name: a.name }; }
    }
    for (const t of this.things) {
      if (t.when && !t.when(this)) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < (t.r || 1.3) && d < bd) { bd = d; best = { kind: 'thing', thing: t, label: t.verb || '查看', name: t.name || '' }; }
    }
    return best;
  }
  async interactWith(hit) {
    if (this.busy) return;
    this.autoPath = null;
    this.clickTarget = null;
    this.player.moving = false;
    if (hit.kind === 'actor') {
      const a = hit.actor;
      this.player.faceTowards(a.pos.x, a.pos.z);
      if (!a.data.noTurn) a.faceTowards(this.player.pos.x, this.player.pos.z);
      await this.run(async () => { await (a.data.talk || a.data.onTalk)(this, a); });
      if (a.data.dir && !a.data.noTurnBack) a.dir = a.data.dir;
    } else {
      const t = hit.thing;
      this.player.faceTowards(t.x, t.z);
      await this.run(async () => { await t.talk(this, t); });
    }
  }
  /** 运行一段剧情脚本：期间锁定输入 */
  async run(fn) {
    this.busy++;
    this.input.enabled = false;
    this.ui?.setBusy(true);
    try { await fn(); } catch (e) { console.error('[剧情]', e); }
    finally {
      this.busy = Math.max(0, this.busy - 1);
      if (!this.busy) {
        this.input.enabled = true; this.ui?.setBusy(false); this.ui?.closeDialogue(); this.ui?.letterbox(false);
        // 结束剧情的那一下按键不能再触发新的互动
        this.input.pressed.clear();
        this.scriptEndT = this.time;
      }
    }
  }

  // ---------------------------------------------------------------- 主循环
  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }
  frame(dt) {
    if (this.sleeping) return;
    if (!this.paused) this.update(dt);
    this.renderer.render(dt);
    this.ui?.frame(dt);
  }
  /** 把当前画面渲染一帧并导出为图片（用作消消乐背景） */
  snapshot(type = 'image/jpeg', q = 0.72) {
    try {
      this.renderer.render(0);
      return this.canvas.toDataURL(type, q);
    } catch { return null; }
  }

  // ---------------------------------------------------------------- 可修复部件
  /** 按已修复集合设置所有部件的显隐（无动画） */
  applyStages(restored) {
    const w = this.world;
    if (!w) return;
    for (const part of w.stages.values()) {
      const on = part.kind === 'stage' ? restored.has(part.name) : !restored.has(part.name);
      this.setPart(part, on);
      part.group.scale.set(1, 1, 1);
    }
  }
  setPart(part, on) {
    const w = this.world;
    part.group.visible = on;
    part.on = on;
    for (const i of part.solid) w.solid[i] = on ? 1 : 0;
    for (const L of part.lights) L.off = !on;
  }
  stagePart(name, kind = 'stage') { return this.world?.stages.get(kind + ':' + name) || null; }
  /** 修复动画：stage 部件从地面长出、ruin 部件塌陷消失；返回部件中心（供镜头对准） */
  restoreStage(name, { dur = 1.1 } = {}) {
    const w = this.world;
    const grow = this.stagePart(name, 'stage');
    const ruin = this.stagePart(name, 'ruin');
    const jobs = [];
    if (ruin && ruin.on) {
      jobs.push(this.tweenPart(ruin, 1, 0.02, dur * 0.45).then(() => { this.setPart(ruin, false); ruin.group.scale.set(1, 1, 1); }));
      this.puff(ruin.pivot, ruin.size, '#b8ab94');
    }
    if (grow && !grow.on) {
      this.setPart(grow, true);
      grow.group.scale.set(1, 0.02, 1);
      jobs.push(new Promise((r) => setTimeout(r, ruin ? dur * 300 : 0)).then(() => {
        this.sparkleBurst(grow.pivot, grow.size);
        return this.tweenPart(grow, 0.02, 1, dur, true);
      }));
    }
    void w;
    return Promise.all(jobs);
  }
  tweenPart(part, from, to, dur, back = false) {
    return new Promise((res) => {
      let t = 0;
      const g = part.group;
      const f = (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        let e = back ? 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) : k * k;
        if (back && k >= 1) e = 1;
        const v = from + (to - from) * e;
        g.scale.set(1 + (1 - Math.min(1, v)) * 0.08, Math.max(0.001, v), 1 + (1 - Math.min(1, v)) * 0.08);
        if (k >= 1) { this.hooks.update.delete(f); res(); }
      };
      this.hooks.update.add(f);
    });
  }
  sparkleBurst(p, size) {
    const r = Math.max(1, Math.max(size.x, size.z) * 0.5);
    this.particles.burst(46, (rnd) => ({
      x: p.x + (rnd() - 0.5) * r * 2, y: p.y + rnd() * Math.max(1.5, size.y), z: p.z + (rnd() - 0.5) * r * 1.4,
      vx: (rnd() - 0.5) * 0.6, vy: 0.8 + rnd() * 1.4, vz: (rnd() - 0.5) * 0.6, size: 0.16 + rnd() * 0.18, shape: 'spark',
      color: rnd() < 0.5 ? '#ffe08a' : '#fff6d8', life: 1.2 + rnd() * 0.8, fade: 'inout', rot: rnd() * 6, vr: 2, drag: 0.4,
    }));
  }
  puff(p, size, col = '#a89e8e') {
    const r = Math.max(0.8, Math.max(size.x, size.z) * 0.5);
    this.particles.burst(24, (rnd) => ({
      x: p.x + (rnd() - 0.5) * r * 2, y: p.y + rnd() * 0.8, z: p.z + (rnd() - 0.5) * r * 1.4,
      vx: (rnd() - 0.5) * 1.2, vy: 0.3 + rnd() * 0.6, size: 0.8 + rnd() * 0.6, shape: 'smoke', color: col, alpha: 0.55, life: 1.8 + rnd(), grow: 1.4, drag: 0.8, rot: rnd() * 6, vr: 0.3,
    }));
  }
  update(dt) {
    this.time += dt;
    const t = this.time;
    const w = this.world;
    if (!w || !this.player) return;
    this.updatePlayer(dt);
    // 跟随者
    if (this.follower) this.updateFollower(dt);
    // 其他角色
    for (const [id, a] of this.actors) {
      if (id === 'kangye' || id === 'aling') continue;
      if (a.data.wander && !this.busy && !a.path) this.wander(a, dt);
      const hadPath = !!a.path;
      a.update(dt, w, t, this.rig.camera);
      if (hadPath && !a.path && a._solidTile) { this.markActorSolid(a, false); a._solidTile = this.markActorSolid(a, true); }
    }
    this.player.animate(dt, w, t, this.rig.camera);
    this.rig.update(dt);
    const focus = this.rig.target;
    this.env.update(dt, t, focus);
    w.update(dt, t, this.scene, this.rig);
    this.particles.update(dt, t, focus);
    this.particles.setScale(this.renderer.size.y * Math.min(window.devicePixelRatio || 1, this.renderer.quality.pixelRatio));
    updateDyn(this.dyn, t, this.night);
    const floras = this.floraMesh ? [this.floraMesh] : [];
    for (const part of w.stages.values()) if (part.on) floras.push(...part.flora);
    for (const fm of floras) {
      const u = fm.material.uniforms;
      u.uTime.value = t; u.uTilt.value = this.rig.pitch; u.uTint.value.copy(this.env.spriteTint);
    }
    this.updateLighting();
    this.updateOccluders(dt);
    this.checkTriggers();
    for (const f of this.hooks.update) f(dt, t);
    // 互动提示
    const near = this.busy ? null : this.nearestInteractable();
    this.ui?.showPrompt(near);
    const cool = this.time - (this.scriptEndT ?? -9) < 0.3;
    if (!this.busy && near && !cool && this.input.anyPressed(['KeyE', 'Space', 'KeyJ'])) this.interactWith(near);
    if (!this.busy && this.input.anyPressed(['Escape', 'Tab', 'KeyM'])) this.ui?.openMenu();
    if (!this.busy && this.input.anyPressed(['KeyC'])) this.ui?.openMenu('codex');
    this.input.endFrame();
  }
  updatePlayer(dt) {
    const p = this.player;
    const w = this.world;
    const mv = this.input.moveVec();
    let moving = false;
    if ((mv.x || mv.z) && !this.busy) {
      this.autoPath = null; this.clickTarget = null;
      const run = this.input.running();
      p.speed = run ? 5.2 : 3.4;
      const sp = p.speed * dt;
      moving = w.move(p.pos, mv.x * sp, mv.z * sp);
      if (Math.abs(mv.x) > Math.abs(mv.z)) p.dir = mv.x > 0 ? 'right' : 'left'; else p.dir = mv.z > 0 ? 'down' : 'up';
      if (!moving) { // 贴墙时尝试沿轴滑动
        moving = w.move(p.pos, mv.x * sp, 0) || w.move(p.pos, 0, mv.z * sp);
      }
    } else if (this.autoPath && this.autoPath.length && !this.busy) {
      p.speed = 3.8;
      const tgt = this.autoPath[0];
      const dx = tgt.x - p.pos.x, dz = tgt.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const sp = p.speed * dt;
      if (d < 0.08) this.autoPath.shift();
      else {
        const k = Math.min(sp, d) / d;
        const ok = w.move(p.pos, dx * k, dz * k);
        moving = ok;
        if (!ok) this.autoPath = null;
        if (Math.abs(dx) > Math.abs(dz) * 0.8) p.dir = dx > 0 ? 'right' : 'left'; else p.dir = dz > 0 ? 'down' : 'up';
      }
      if (this.clickTarget) {
        const tg = this.clickTarget;
        const tp = tg.kind === 'actor' ? tg.actor.pos : { x: tg.thing.x, z: tg.thing.z };
        const dd = Math.hypot(tp.x - p.pos.x, tp.z - p.pos.z);
        if (dd < (tg.kind === 'thing' ? (tg.thing.r || 1.3) : 1.55)) { this.autoPath = null; this.interactWith(tg); }
      }
      if (this.autoPath && !this.autoPath.length) this.autoPath = null;
    } else if (p.path) {
      p.update(dt, w, this.time, this.rig.camera);
      return;
    }
    p.moving = moving;
    if (moving) {
      this.stepT += dt * (p.speed > 4 ? 1.4 : 1);
      if (this.stepT > 0.3) { this.stepT = 0; audio.sfx('step', { vol: 0.35 }); }
    }
  }
  updateFollower(dt) {
    const f = this.follower, p = this.player;
    if (f.path) { f.update(dt, this.world, this.time, this.rig.camera); return; }
    if (f.hold) { f.moving = false; f.animate(dt, this.world, this.time, this.rig.camera); return; }
    // 跟在玩家身后偏一侧
    const off = { down: [-0.9, -0.7], up: [0.9, 0.8], left: [0.95, -0.4], right: [-0.95, -0.4] }[p.dir] || [0.8, -0.6];
    const gx = p.pos.x + off[0], gz = p.pos.z + off[1];
    const dx = gx - f.pos.x, dz = gz - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.15) {
      const sp = Math.min(d, (d > 3 ? 7 : 3.8) * dt);
      f.pos.x += (dx / d) * sp; f.pos.z += (dz / d) * sp;
      f.moving = d > 0.4;
      f.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
      if (f.dir === 'left' || f.dir === 'right') f.dir = 'down';
    } else f.moving = false;
    if (d > 10) { f.pos.x = gx; f.pos.z = gz; }
    f.frameOverride = { col: Math.floor(this.time * 3) % 2, row: f.dir === 'up' ? 'back' : 'front' };
    f.animate(dt, this.world, this.time, this.rig.camera);
    f.group.position.y = Math.max(f.group.position.y, this.world.heightAt(p.pos.x, p.pos.z));
  }
  wander(a, dt) {
    a._wt = (a._wt ?? Math.random() * 3) - dt;
    if (a._wt > 0) return;
    a._wt = 2.5 + Math.random() * 4;
    const [x0, z0, x1, z1] = a.data.wander;
    const tx = x0 + Math.random() * (x1 - x0), tz = z0 + Math.random() * (z1 - z0);
    if (Math.hypot(tx - this.player.pos.x, tz - this.player.pos.z) < 1.5) return;
    if (!this.world.canStand(tx, tz, 0.25)) return;
    if (a._solidTile) { this.markActorSolid(a, false); }
    a.walkTo([[tx, tz]], a.speed * 0.6).then(() => { if (!a._solidTile && a.data.solid !== false) a._solidTile = this.markActorSolid(a, true); });
  }
  updateLighting() {
    const tint = this.env.spriteTint;
    const lights = this.world.lights;
    const focus = this.rig.target;
    // 精灵受附近灯光影响
    for (const [, a] of this.actors) {
      a.tint.copy(tint);
      a.local.setRGB(0, 0, 0);
      if (!this.night && !this.mapDef?.spriteLights) continue;
      for (const L of lights) {
        if (L.off) continue;
        const d = Math.hypot(L.x - a.pos.x, L.z - a.pos.z);
        if (d > L.radius) continue;
        const k = (1 - d / L.radius) ** 2 * L.intensity * 0.55;
        a.local.r += L.color.r * k; a.local.g += L.color.g * k; a.local.b += L.color.b * k;
      }
    }
    // 真实点光源池：离镜头最近的 4 盏
    if (this.night && lights.length) {
      const sorted = lights.filter((L) => !L.off).sort((a, b) => ((a.x - focus.x) ** 2 + (a.z - focus.z) ** 2) - ((b.x - focus.x) ** 2 + (b.z - focus.z) ** 2));
      this.lightPool.forEach((PL, i) => {
        const L = sorted[i];
        if (L) { PL.position.set(L.x, L.y, L.z); PL.color.copy(L.color); PL.intensity = L.intensity * 6 * (1 + Math.sin(this.time * 8 + i) * 0.05); PL.distance = L.radius * 1.6; }
        else PL.intensity = 0;
      });
    } else for (const PL of this.lightPool) PL.intensity = 0;
  }
  updateOccluders(dt) {
    const w = this.world;
    if (!w.occluders.size) return;
    const cam = this.rig.camera.position;
    const head = tmpV.set(this.player.pos.x, this.player.group.position.y + 1.2, this.player.pos.z);
    const ray = new THREE.Ray(cam, tmpV2.copy(head).sub(cam).normalize());
    const dist = cam.distanceTo(head);
    for (const [, meshes] of w.occluders) {
      let hit = false;
      for (const m of meshes) {
        const bb = m.geometry.boundingBox;
        const p = ray.intersectBox(bb, new THREE.Vector3());
        if (p && cam.distanceTo(p) < dist - 0.4) { hit = true; break; }
      }
      for (const m of meshes) {
        const target = hit ? 0.28 : 1;
        const mat = m.material;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
        mat.transparent = mat.opacity < 0.99;
        mat.depthWrite = mat.opacity > 0.9;
      }
    }
  }
  checkTriggers() {
    if (this.busy) return;
    const p = this.player.pos;
    for (const tr of this.triggers) {
      if (tr.fired && tr.once !== false) continue;
      if (tr.when && !tr.when(this)) continue;
      const [x0, z0, x1, z1] = tr.rect;
      const inside = p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
      if (inside && !tr._inside) {
        tr._inside = true;
        tr.fired = true;
        this.autoPath = null;
        this.run(() => tr.run(this, tr));
        return;
      }
      if (!inside) tr._inside = false;
    }
  }
  emote(id, kind, dur) {
    const a = this.actors.get(id);
    if (a) a.emote(emoteTexture(kind), dur);
  }
  screenPos(v) {
    const p = tmpV.copy(v).project(this.rig.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
  }
}

import { EMIT } from '../engine/particles.js';
function emitterFor(kind, x, y, z) {
  if (kind === 'smoke') return { ...EMIT.smoke(x, y, z, '#9a948a'), rate: 1.5 };
  if (kind === 'embers') return EMIT.embers(x, y, z);
  if (kind === 'sparkle') return EMIT.sparkle(x, y, z);
  return EMIT.sparkle(x, y, z);
}
export { PX, clamp };
