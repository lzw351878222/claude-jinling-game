// 消消乐关卡控制器
import { introCard, winCard, loseCard, confirmQuit } from './level-cards.js';
import { audio } from '../core/audio.js';
import { ASSETS } from '../assets.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Controller {
  constructor(def, board, view, ui, opts) {
    Object.assign(this, { def, board, view, ui, opts });
    this.alive = true;
    this.busy = true;
    this.idle = 0;
    this.helped = false;
    this.tool = null;
    this.chainMax = 0;
    this.last = performance.now();
  }
  start() {
    const tick = (now) => {
      if (!this.alive) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.view.update(dt);
      this.view.draw();
      if (!this.busy) {
        this.idle += dt;
        if (this.idle > 6 && !this.view.hint) this.view.setHint(this.board.findHint());
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    this.ui.quit.onclick = async () => {
      audio.sfx('button');
      if (this.busy && !this.waitingInput) return;
      if (await confirmQuit(this.ui.root)) this.finish({ win: false, quit: true, stars: 0, score: this.board.score });
    };
    this.setupTools();
    this.run();
  }
  async run() {
    this.ui.update();
    await introCard(this.ui.root, this.def, this.board);
    audio.music(this.opts.music || 'level');
    await this.view.syncAll(true);
    audio.sfx('shuffle');
    if (this.def.say) this.ui.say(this.def.say, 'smile', 2600);
    this.unlock();
  }
  unlock() { this.busy = false; this.waitingInput = true; this.view.locked = false; this.idle = 0; }
  lock() { this.busy = true; this.waitingInput = false; this.view.locked = true; this.view.setHint(null); }

  // ---------------------------------------------------------------- 玩家操作
  async swap(a, b) {
    if (this.busy) return;
    const B = this.board;
    if (this.tool === 'free') return this.freeSwap(a, b);
    if (!B.canTrySwap(a, b)) return;
    this.lock();
    const valid = B.swapValid(a, b);
    B.doSwap(a, b);
    audio.sfx('swap');
    if (!valid) {
      await this.view.swap(a, b, true);
      B.doSwap(a, b);
      audio.sfx('swap_back');
      this.unlock();
      return;
    }
    await this.view.swap(a, b);
    const ev = B.afterSwap(a, b);
    if (!ev) { B.doSwap(a, b); await this.view.swap(b, a); this.unlock(); return; }
    await this.resolve(ev);
    await this.endTurn();
  }
  isComboPair(a, b) {
    const ta = this.board.cells[a].tile, tb = this.board.cells[b].tile;
    if (!ta || !tb || ta.kind === 'item' || tb.kind === 'item') return false;
    const sp = (t) => t.kind !== 'normal';
    return ta.kind === 'seal' || tb.kind === 'seal' || (sp(ta) && sp(tb));
  }
  async freeSwap(a, b) {
    const B = this.board;
    if (!B.adjacent(a, b) || !B.movable(B.cells[a]) || !B.movable(B.cells[b])) return;
    this.lock();
    this.useTool('free');
    B.doSwap(a, b);
    audio.sfx('swap');
    await this.view.swap(a, b);
    const ev = B.afterSwap(a, b);
    if (ev) await this.resolve(ev);
    else await this.settle();
    this.ui.update();
    await this.checkState(false);
  }
  /** 播放一次清除 + 下落，并继续连锁 */
  async resolve(ev) {
    let step = 1;
    while (ev) {
      this.playSounds(ev, step);
      if (step >= 3) this.view.combo(`连消 ×${step}`, step);
      await this.view.playClear(ev, step);
      this.flyGoals(ev);
      this.ui.update();
      await this.settle();
      step++;
      ev = this.board.cascade(step);
    }
    this.chainMax = Math.max(this.chainMax, step - 1);
  }
  /** 下落、补充、收集物件，直到稳定 */
  async settle() {
    const B = this.board;
    for (let k = 0; k < 6; k++) {
      const g = B.gravity();
      if (g.paths.size) { audio.sfx('drop', { vol: 0.5 }); await this.view.playFall(g); }
      const got = B.collectItems();
      if (!got.length) break;
      audio.sfx('collect');
      const tgt = this.ui.goalPoint((x) => x.type === 'item');
      await this.view.playCollect(got, tgt);
      this.ui.pulseGoal((x) => x.type === 'item');
      this.ui.update();
    }
  }
  playSounds(ev, step) {
    if (ev.cleared.length) audio.sfx('match', { combo: step });
    for (const fx of ev.effects) {
      if (fx.type === 'line' || fx.type === 'cross') audio.sfx('line');
      else if (fx.type === 'burst') audio.sfx('burst');
      else audio.sfx('colorbomb');
    }
    if (ev.created.length) audio.sfx('special');
    if (ev.hits.length || ev.inks.length || ev.ropes.length) audio.sfx('obstacle');
    if (ev.lamps.length) audio.sfx('lamp_lit');
    if (ev.effects.some((f) => f.combo)) audio.sfx('combo_big');
  }
  flyGoals(ev) {
    for (const c of ev.cleared) {
      if (c.tile.color < 0) continue;
      const hit = this.board.goals.some((g) => g.type === 'color' && g.color === c.tile.color && !this.board.goalDone(g));
      if (hit) this.ui.pulseGoal((g) => g.type === 'color' && g.color === c.tile.color);
    }
    if (ev.inks.length) this.ui.pulseGoal((g) => g.type === 'ink');
    if (ev.lamps.length) this.ui.pulseGoal((g) => g.type === 'lamp');
    if (ev.ropes.length) this.ui.pulseGoal((g) => g.type === 'rope');
    if (ev.hits.length) this.ui.pulseGoal((g) => g.type === 'rubble' || g.type === 'worm' || g.type === 'boss');
  }

  // ---------------------------------------------------------------- 回合结束
  async endTurn() {
    const B = this.board;
    const end = B.endMove();
    if (end.spread) { audio.sfx('worm'); await this.view.playSpread(end.spread); }
    if (B.boss && !B.won() && B.movesUsed % (this.def.boss.every || 3) === 0) await this.bossTurn();
    this.ui.update();
    if (this.chainMax >= 4) this.ui.say(this.chainMax >= 6 ? '一气呵成！' : '好一串连消！', 'smile');
    this.chainMax = 0;
    if (B.moves === 5 && !B.won()) { audio.sfx('moves_low'); this.ui.say('只剩五步了，稳住。', 'serious'); }
    await this.checkState(true);
  }
  async bossTurn() {
    const B = this.board;
    const kinds = this.def.boss.acts || ['ink', 'worm'];
    const kind = kinds[Math.floor(B.movesUsed / (this.def.boss.every || 3)) % kinds.length];
    this.ui.bossEl?.classList.add('act');
    audio.sfx('ink');
    const hits = B.bossAct(kind, this.def.boss.power || 3);
    await this.view.playBossHits(hits);
    setTimeout(() => this.ui.bossEl?.classList.remove('act'), 500);
    this.view.shake = 8;
  }
  async checkState() {
    const B = this.board;
    if (B.won()) return this.onWin();
    if (B.moves <= 0) return this.onLose();
    if (!B.hasMoves()) {
      await this.ui.banner('重新洗牌');
      B.shuffle();
      audio.sfx('shuffle');
      await this.view.playShuffle();
    }
    this.unlock();
  }
  async onWin() {
    this.lock();
    audio.sfx('level_win');
    await this.ui.banner('踪迹复原！', 'win');
    await this.bonusRound();
    const B = this.board;
    const ratio = B.moves / (this.def.moves || 20);
    const stars = B.moves >= Math.max(3, (this.def.moves || 20) * 0.25) ? 3 : ratio > 0.08 || B.moves >= 2 ? 2 : 1;
    this.ui.update();
    await winCard(this.ui.root, this.def, B, stars);
    this.finish({ win: true, stars, score: B.score, movesLeft: B.moves });
  }
  /** 剩余步数化作毛笔，逐一扫过棋盘加分 */
  async bonusRound() {
    const B = this.board;
    let n = Math.min(B.moves, 10);
    while (n-- > 0 && B.moves > 0) {
      const cells = B.cells.map((c, i) => [c, i]).filter(([c]) => B.canHold(c) && c.tile && c.tile.kind === 'normal' && !c.rope);
      if (!cells.length) break;
      const [c, i] = cells[Math.floor(Math.random() * cells.length)];
      c.tile.kind = Math.random() < 0.5 ? 'lineH' : 'lineV';
      B.moves--;
      this.ui.update();
      audio.sfx('special');
      await wait(120);
      const ev = B.clearCells([i], {});
      await this.resolve(ev);
    }
    B.score += B.moves * 300;
    B.moves = 0;
    this.ui.update();
  }
  async onLose() {
    this.lock();
    audio.sfx('level_fail');
    this.ui.say('差一点……', 'serious');
    const v = await loseCard(this.ui.root, this.def, this.board, !this.helped);
    if (v === 'help') {
      this.helped = true;
      this.board.moves += 5;
      this.ui.update();
      this.ui.say('谢谢你，阿麟！', 'smile');
      this.unlock();
      return;
    }
    this.finish({ win: false, result: v === 'retry' ? 'retry' : 'quit', stars: 0, score: this.board.score });
  }

  // ---------------------------------------------------------------- 道具
  setupTools() {
    const inv = this.opts.tools || { hammer: 2, free: 2 };
    this.inv = inv;
    this.toolBtns = {};
    this.toolBtns.hammer = this.ui.addTool('hammer', '锤', inv.hammer, () => this.pickTool('hammer'), '木槌');
    this.toolBtns.free = this.ui.addTool('free', '换', inv.free, () => this.pickTool('free'), '乾坤换');
    this.ui.setToolCount(this.toolBtns.hammer, inv.hammer);
    this.ui.setToolCount(this.toolBtns.free, inv.free);
    this.view.onTap = (i) => this.useHammer(i);
  }
  pickTool(id) {
    if (this.busy || this.inv[id] <= 0) return;
    this.tool = this.tool === id ? null : id;
    for (const k in this.toolBtns) this.toolBtns[k].classList.toggle('on', this.tool === k);
    this.view.tapMode = this.tool === 'hammer';
    if (this.tool === 'hammer') this.ui.say('点一格，把它敲掉。', 'q34', 2200);
    if (this.tool === 'free') this.ui.say('随便换两颗相邻的，不必成三。', 'q34', 2200);
  }
  useTool(id) {
    this.inv[id]--;
    this.ui.setToolCount(this.toolBtns[id], this.inv[id]);
    this.tool = null;
    this.view.tapMode = false;
    for (const k in this.toolBtns) this.toolBtns[k].classList.remove('on');
  }
  async useHammer(i) {
    if (this.busy || this.tool !== 'hammer') return;
    const B = this.board;
    const c = B.cells[i];
    if (!c.mask || (!c.tile && !c.rubble && !c.worm)) return;
    this.lock();
    this.useTool('hammer');
    audio.sfx('hammer');
    this.view.shake = 6;
    const ev = B.clearCells([], { extraEffects: [{ type: 'tool', i, x: i % B.w, y: Math.floor(i / B.w), cells: [i] }] });
    await this.resolve(ev);
    this.ui.update();
    await this.checkState();
  }
}
void ASSETS;