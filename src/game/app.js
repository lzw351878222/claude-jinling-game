// 应用主控：标题 → 各章（场景 + 修复清单 + 消消乐/特别关）→ 终章 → 尾声 → 片尾
import { Game } from './game.js';
import { UI } from '../ui/ui.js';
import { Director } from './director.js';
import { Hub } from './hub.js';
import { showTitle } from './title.js';
import { rollCredits } from './credits.js';
import { newState, loadSettings, loadMeta, saveMeta, saveGame, loadGame, latestSlot } from './state.js';
import { CHAPTERS } from '../story/chapters.js';
import { buildChapters } from '../story/index.js';
import { LEVELS } from '../m3/levels.js';
import { playLevel } from '../m3/level.js';
import { runMinigame } from '../minigames/host.js';
import { MINIGAMES } from '../minigames/index.js';
import { audio } from '../core/audio.js';

const PERFECT_ACH = { bricks: 'brick_perfect', kiln: 'kiln_perfect', bookworm: 'bookworm_perfect', books: 'books_perfect', star: 'star_perfect', tiles: 'tiles_perfect', carve: 'carve_perfect', quiz: 'quiz_perfect' };

export class App {
  constructor() {
    this.settings = loadSettings();
    this.meta = loadMeta();
    this.state = newState();
    this.game = new Game();
    this.game.settings = this.settings;
    if (this.settings.quality) this.game.renderer.setQuality(this.settings.quality);
    this.game.state = this.state;
    this.ui = new UI(this.game, this);
    this.game.ui = this.ui;
    this.D = new Director(this);
    this.hub = new Hub(this);
    this.chapters = buildChapters(this.D);
    this.inTitle = true;
    this.epoch = 0;
    for (const bus of ['master', 'music', 'sfx', 'ambient']) audio.setVolume(bus, this.settings[bus]);
    setInterval(() => { if (!this.inTitle && !document.hidden) this.state.playtime++; }, 1000);
    window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
    window.addEventListener('keydown', () => audio.unlock(), { capture: true });
  }
  get currentChapter() { return this.chapters[this.state.chapter]; }

  // ---------------------------------------------------------------- 启动与标题
  async title() {
    this.inTitle = true;
    this.hub.hide();
    this.ui.showHud(false);
    this.ui.letterbox(false);
    const choice = await showTitle(this);
    if (choice === 'continue') {
      const st = loadGame(latestSlot());
      this.setState(st || newState());
    } else this.setState(newState());
    this.inTitle = false;
    await this.runGame();
  }
  setState(st) {
    st.restored = st.restored || {};
    st.levelStars = st.levelStars || {};
    st.step = st.step || 0;
    this.state = st;
    this.game.state = st;
    this.ui.updateBadge();
  }

  // ---------------------------------------------------------------- 章节
  async runGame() {
    const epoch = ++this.epoch;
    while (epoch === this.epoch) {
      const ch = this.currentChapter;
      if (!ch) break;
      const r = await this.runChapter(ch, epoch);
      if (epoch !== this.epoch || r === 'abort') return;
      if (r === 'end') break;
    }
    if (epoch !== this.epoch) return;
    // 通关
    this.D.achieve('clear');
    this.meta.clears = (this.meta.clears || 0) + 1;
    saveMeta(this.meta);
    await rollCredits(this);
    this.game.clearMap();
    await this.ui.fade(0, 10);
    await this.title();
  }
  restoredSet(chId) { return new Set(this.state.restored[chId] || []); }
  markRestored(name) {
    const id = this.state.chapter;
    const arr = this.state.restored[id] || (this.state.restored[id] = []);
    if (!arr.includes(name)) arr.push(name);
  }
  async runChapter(ch, epoch) {
    const st = this.state;
    const alive = () => epoch === this.epoch;
    const fresh = !st.flags[`ch${ch.id}_in`];
    this.hub.hide();
    this.ui.showHud(false);
    await this.ui.fade(1, 450);
    this.game.player && (this.game.player.moving = false);
    const restored = ch.forceStages ? new Set(ch.forceStages) : this.restoredSet(ch.id);
    ch.beforeLoad?.(this.D, restored);
    await this.game.loadMap(ch.map, 'default', { restored });
    if (!alive()) return 'abort';
    if (!fresh && st.pos && st.pos.ch === ch.id && this.game.world.canStand(st.pos.x, st.pos.z)) {
      this.game.player.pos.x = st.pos.x; this.game.player.pos.z = st.pos.z; this.game.player.dir = st.pos.dir || 'down';
      this.game.rig.snap();
    }
    ch.onEnter?.(this.D, fresh);
    audio.music(ch.music ?? null);
    audio.ambient(ch.ambient ?? null);
    if (fresh) {
      st.step = 0;
      st.flags[`ch${ch.id}_in`] = true;
      if (ch.meta.num) await this.ui.chapterCard(ch.meta);
    }
    await this.ui.fade(0, 700);
    if (!alive()) return 'abort';
    if (fresh && ch.intro) {
      await this.game.run(() => ch.intro(this.D));
      if (!alive()) return 'abort';
    }
    this.autosave();
    // ---- 修复循环
    while (st.step < (ch.steps || []).length) {
      const step = ch.steps[st.step];
      this.ui.showHud(true);
      this.hub.show(ch, st.step);
      this.ui.setQuest(step.quest || ch.quest || `完成「${step.title}」`, false);
      const act = await this.hub.waitPlay();
      if (act !== 'play' || !alive()) return 'abort';
      if (step.before) { await this.game.run(() => step.before(this.D)); if (!alive()) return 'abort'; }
      const ok = await this.playStep(ch, step);
      if (!alive()) return 'abort';
      if (!ok) continue;
      st.step++;
      this.hub.show(ch, st.step);
      this.hub.hide();
      await this.game.run(async () => {
        if (step.stage) await this.D.restore(step.stage);
        if (step.after) await step.after(this.D);
        this.D.end();
        await this.D.camBack();
      });
      if (!alive()) return 'abort';
      this.autosave();
    }
    // ---- 章末
    this.hub.hide();
    this.ui.setQuest(null, false);
    if (ch.outro) { await this.game.run(() => ch.outro(this.D)); if (!alive()) return 'abort'; }
    const meta = ch.meta;
    if (meta.seal && !st.seals.includes(meta.seal)) {
      st.seals.push(meta.seal);
      const all = CHAPTERS.filter((c) => c.seal).map((c) => ({ ch: c.seal, on: st.seals.includes(c.seal) }));
      await this.ui.sealStamp({ seal: meta.seal, name: meta.sealName, desc: ch.sealDesc || '', all });
    }
    st.chapter++;
    st.step = 0;
    st.pos = null;
    this.autosave();
    return ch.last ? 'end' : 'next';
  }
  /** 进行一步：消消乐或特别关。返回是否成功 */
  async playStep(ch, step) {
    const st = this.state;
    this.hub.hide();
    this.ui.showHud(false);
    this.ui.closeDialogue(true);
    const bg = this.game.snapshot();
    this.game.sleeping = true;
    let ok = false;
    try {
      if (step.kind === 'level') {
        const def = LEVELS[step.id];
        if (!def) throw new Error('缺少关卡 ' + step.id);
        const r = await playLevel(def, { bg, dim: 0.35, music: step.music || def.music || 'level' });
        ok = !!r.win;
        if (ok) st.levelStars[step.id] = Math.max(st.levelStars[step.id] || 0, r.stars || 1);
      } else {
        const game = MINIGAMES[step.game];
        if (!game) throw new Error('缺少小游戏 ' + step.game);
        const opts = typeof step.opts === 'function' ? step.opts(this) : (step.opts || {});
        const r = await runMinigame(game, { music: 'minigame', ...opts });
        ok = !!r.success;
        if (ok && r.perfect && PERFECT_ACH[step.game]) this.D.achieve(PERFECT_ACH[step.game]);
        if (ok && step.game === 'lamps') this.D.achieve('lamps');
        if (ok) st.minigames[step.game] = { score: r.score || 0, perfect: !!r.perfect, skipped: !!r.skipped };
      }
    } catch (e) {
      console.error('[关卡]', e);
      ok = false;
    } finally {
      this.game.sleeping = false;
      audio.music(ch.music ?? null);
      audio.ambient(ch.ambient ?? null);
      this.ui.showHud(true);
    }
    return ok;
  }

  // ---------------------------------------------------------------- 存档
  save(slot) {
    const st = this.state;
    const p = this.game.player;
    if (p && this.currentChapter) st.pos = { ch: this.currentChapter.id, x: p.pos.x, z: p.pos.z, dir: p.dir };
    const ch = CHAPTERS.find((c) => c.id === st.chapter);
    return saveGame(slot, st, { mapName: ch ? ch.place : '', era: ch ? ch.era : '' });
  }
  autosave() { if (!this.inTitle) this.save('auto'); }
  async load(slot) {
    const st = loadGame(slot);
    if (!st) return;
    this.epoch++;
    this.hub.cancelWait();
    this.setState(st);
    this.inTitle = false;
    await this.runGame();
  }
  async backToTitle() {
    this.autosave();
    this.epoch++;
    this.hub.cancelWait();
    await this.ui.fade(1, 500);
    this.ui.closeDialogue(true);
    this.hub.hide();
    this.ui.showHud(false);
    this.game.clearMap();
    audio.ambient(null);
    await this.title();
  }
  metaAdd(kind, id) {
    const arr = this.meta[kind] || (this.meta[kind] = []);
    if (!arr.includes(id)) { arr.push(id); saveMeta(this.meta); }
  }
}
