// 剧情导演：把对话、走位、运镜、收录金陵志、修复动画等封装成简单的剧情指令。
// 各章剧情脚本写成 async (D) => { await D.say('kangye', '……'); ... }
import { ASSETS } from '../assets.js';
import { audio } from '../core/audio.js';
import { sleep } from '../core/util.js';
import { codexById, CODEX } from '../story/codex.js';
import { ACHIEVEMENTS } from '../story/achievements.js';
import { bustCanvas } from '../engine/sprites.js';

// 康晔的立绘表情
const FACES = { front: 'front', smile: 'smile', serious: 'serious', q34: 'q34', side: 'side', think: 'side', sad: 'serious', happy: 'smile', surprise: 'front' };

export class Director {
  constructor(app) {
    this.app = app;
    this.cast = {}; // 不在场时的备用角色表：id → { name, look, voice, sub }
  }
  get g() { return this.app.game; }
  get ui() { return this.app.ui; }
  get st() { return this.app.state; }

  // ---------------------------------------------------------------- 对话
  /** 说话人信息：'kangye' | 'aling' | NPC id | { name, look, voice } */
  speaker(who) {
    if (who === 'kangye') return { name: '康晔', voice: 'kangye', nameClass: '' };
    if (who === 'aling') return { name: '阿麟', voice: 'qilin', nameClass: 'aling', portrait: { src: this.bust('qilin'), pixel: true, small: true } };
    const a = typeof who === 'string' ? this.g.actor(who) : null;
    const d = a ? a.data : (typeof who === 'object' ? who : (this.cast[who] || { name: String(who) }));
    const look = d.look || (a?.data?.sprite === 'qilin' ? 'qilin' : null);
    return {
      name: d.name || a?.name || '',
      sub: d.sub,
      voice: d.voice || 'male',
      nameClass: d.foe ? 'foe' : 'npc',
      portrait: look ? { src: this.bust(look), pixel: true, small: look === 'qilin' || look === 'worm' || look === 'bigworm' } : null,
    };
  }
  bust(look) {
    const e = this.g.sheetFor(look);
    if (!e.bust && e.canvas) {
      if (e.sheet.fh === 132) e.bust = bustCanvas(e.canvas, 4).toDataURL();
      else {
        const c = document.createElement('canvas');
        const s = Math.max(1, Math.floor(160 / e.sheet.fw));
        c.width = e.sheet.fw * s; c.height = Math.min(e.sheet.fh, 80) * s;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(e.canvas, 0, 0, e.sheet.fw, Math.min(e.sheet.fh, 80), 0, 0, c.width, c.height);
        e.bust = c.toDataURL();
      }
    }
    return e.bust;
  }
  /** 说一句话。康晔可带表情：D.say('kangye', '……', 'smile') */
  async say(who, text, face) {
    const sp = this.speaker(who);
    let portrait = sp.portrait;
    if (who === 'kangye') portrait = { src: ASSETS.portrait[FACES[face] || 'q34'] || ASSETS.portrait.q34 };
    const a = typeof who === 'string' ? this.g.actor(who) : null;
    if (a && this.g.player && a !== this.g.player && who !== 'aling') {
      if (!a.data.noTurn) a.faceTowards(this.g.player.pos.x, this.g.player.pos.z);
    }
    await this.ui.say({ name: sp.name, sub: sp.sub, portrait, text, voice: sp.voice, nameClass: sp.nameClass });
  }
  /** 康晔的心里话 */
  think(text, face = 'side') { return this.ui.say({ name: '康晔', portrait: { src: ASSETS.portrait[FACES[face] || 'side'] }, text, style: 'thought', voice: 'kangye' }); }
  /** 旁白 */
  narrate(text) { return this.ui.say({ text, style: 'narrate', voice: 'narrator' }); }
  /** 喊话（大字） */
  shout(who, text, face) {
    const sp = this.speaker(who);
    const portrait = who === 'kangye' ? { src: ASSETS.portrait[FACES[face] || 'serious'] } : sp.portrait;
    return this.ui.say({ name: sp.name, portrait, text, style: 'shout', voice: sp.voice, nameClass: sp.nameClass });
  }
  async choose(options) { const i = await this.ui.choose(options); return i; }
  end() { this.ui.closeDialogue(); }

  // ---------------------------------------------------------------- 角色与镜头
  actor(id) { return id === 'kangye' ? this.g.player : this.g.actor(id); }
  /** 走到某处（自动寻路）；run 为 true 时不等待 */
  async walk(id, x, z, { speed, run = false, face } = {}) {
    const a = this.actor(id);
    if (!a || !this.g.world) return;
    let path = this.g.world.findPath(a.pos.x, a.pos.z, x, z);
    path = path ? path.slice(1).map(([px, pz]) => ({ x: px, z: pz })) : [];
    if (path.length) path[path.length - 1] = { x, z };
    else path = [{ x, z }];
    const solid = a._solidTile;
    if (solid) this.g.markActorSolid(a, false);
    const p = a.walkTo(path, speed).then(() => {
      if (solid && a.data.solid !== false) a._solidTile = this.g.markActorSolid(a, true);
      if (face) this.face(id, face);
    });
    if (!run) await p;
    return p;
  }
  face(id, dir) {
    const a = this.actor(id);
    if (!a) return;
    if (['up', 'down', 'left', 'right'].includes(dir)) a.dir = dir;
    else { const b = this.actor(dir); if (b) a.faceTowards(b.pos.x, b.pos.z); }
  }
  emote(id, kind = '!', dur = 1.6) { this.g.emote(id === 'kangye' ? 'kangye' : id, kind, dur); if (kind === '!') audio.sfx('pluck', { note: 9, vol: 0.5 }); }
  /** 镜头移到某点 */
  cam(x, z, { dist = null, pitch = null, dur = 1.2 } = {}) { this.g.rig.cinematic = true; return this.g.rig.moveTo({ x, z, y: this.g.world ? this.g.world.heightAt(x, z) : 0, dist, pitch, dur }); }
  camOn(id, o = {}) { const a = this.actor(id); if (a) return this.cam(a.pos.x, a.pos.z, o); return Promise.resolve(); }
  camBack(dur = 0.9) { return this.g.rig.release(dur); }
  shake(a = 0.3, d = 0.4) { if (this.app.settings.shake !== false) this.g.rig.shake(a, d); }
  spawn(npc) { return this.g.spawnNpc(npc); }
  remove(id) { this.g.removeActor(id); }
  wait(ms) { return sleep(ms); }
  fade(to = 1, ms = 600, color) { return this.ui.fade(to, ms, color); }
  letterbox(on) { this.ui.letterbox(on); }
  bigText(text, o) { return this.ui.bigText(text, o); }
  sfx(n, o) { audio.sfx(n, o); }
  music(id) { audio.music(id); }

  // ---------------------------------------------------------------- 进度
  flag(k, v = true) { this.st.flags[k] = v; }
  has(k) { return !!this.st.flags[k]; }
  /** 收录金陵志 */
  codex(...ids) {
    for (const id of ids) {
      const e = codexById[id];
      if (!e) { console.warn('[金陵志] 没有这个词条', id); continue; }
      if (this.st.codex.includes(id)) continue;
      this.st.codex.push(id);
      this.app.metaAdd('codex', id);
      this.ui.codexToast(e);
      const n = this.st.codex.length;
      if (n >= Math.ceil(CODEX.length / 2)) this.achieve('codex_half');
      if (n >= CODEX.length) this.achieve('codex_all');
    }
  }
  achieve(id) {
    if (this.st.achievements.includes(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.st.achievements.push(id);
    this.app.metaAdd('achievements', id);
    this.ui.toast(a.name, { icon: a.icon, label: '成就达成', kind: 'gold', dur: 3200 });
    audio.jingle?.('item');
  }
  /** 剧情中途把操控交还玩家，直到 waitFn() 完成（例如走到某处、和某物互动） */
  async explore(waitFn) {
    const g = this.g;
    const saved = g.busy;
    this.ui.closeDialogue(true);
    this.letterbox(false);
    g.busy = 0; g.input.enabled = true; this.ui.setBusy(false); this.ui.showHud(true);
    this.g.rig.release(0.8);
    // 恢复时把剧情的锁叠加回去：waitFn 常在一段互动脚本（game.run，busy=1）里完成，
    // 若取 max，互动脚本一结束 busy 就归零，玩家会在后续过场里重新拿回操控、再次触发互动
    try { await waitFn(); } finally { g.busy += saved; g.input.enabled = false; this.ui.setBusy(true); }
  }
  /** 剧情中换场景：黑场 → 载入 → 淡入 */
  async goto(map, { restored = [], spawn = 'default', color = '#000', ms = 700, hold = 200 } = {}) {
    await this.fade(1, ms, color);
    await this.g.loadMap(map, spawn, { restored: new Set(restored) });
    this.ui.setLocation(map.name, map.era);
    await this.wait(hold);
    await this.fade(0, ms, color);
  }
  /** 修复动画：镜头移到部件，部件长出来 */
  async restore(name, { look = true, hold = 700 } = {}) {
    const part = this.g.stagePart(name, 'stage') || this.g.stagePart(name, 'ruin');
    if (!part) { console.warn('[修复] 没有这个部件', name); return; }
    if (look) await this.cam(part.pivot.x, part.pivot.z, { dur: 1.0, dist: Math.max(15, this.g.rig.baseDist * 0.85) });
    audio.jingle?.('restore');
    audio.sfx('magic');
    await this.g.restoreStage(name);
    this.app.markRestored(name);
    await this.wait(hold);
  }
}
