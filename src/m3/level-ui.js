// 消消乐关卡界面（DOM）：顶栏、目标、步数、分数星、康晔立绘气泡、道具、结算卡
import { el, html, sleep } from '../core/util.js';
import { audio } from '../core/audio.js';
import { ASSETS } from '../assets.js';
import { goalIcon, goalName } from './art.js';

export class LevelUI {
  constructor(def, board) {
    this.def = def;
    this.board = board;
    const root = document.getElementById('ui') || document.body;
    this.root = el('div', 'm3', root);
    this.bg = el('div', 'm3-bg', this.root);
    const top = el('div', 'm3-top', this.root);
    this.movesEl = html('div', 'm3-moves', top, '<div class="m3-moves-n">0</div><div class="m3-moves-l">步</div>');
    this.goalsEl = el('div', 'm3-goals', top);
    const right = el('div', 'm3-score', top);
    this.scoreEl = el('div', 'm3-score-n', right, '0');
    const bar = el('div', 'm3-bar', right);
    this.barFill = el('i', '', bar);
    this.starEls = [0, 1, 2].map((k) => { const s = el('b', 'm3-star', bar, '★'); s.style.left = `${[40, 70, 96][k]}%`; return s; });
    this.titleEl = html('div', 'm3-title', this.root, `<span>${def.chapterName || ''}</span>${def.name || ''}`);
    this.stage = el('div', 'm3-stage', this.root);
    this.canvas = el('canvas', 'm3-canvas', this.stage);
    // 康晔立绘 + 气泡
    this.port = el('div', 'm3-port', this.root);
    const img = el('img', '', this.port);
    img.src = ASSETS.portrait.smile;
    img.alt = '';
    this.portImg = img;
    this.bubble = el('div', 'm3-bubble', this.root);
    // 道具
    this.tools = el('div', 'm3-tools', this.root);
    this.quit = el('button', 'm3-quit', this.root, '×');
    this.quit.title = '离开关卡';
    this.goalCells = [];
    for (const g of board.goals) {
      const d = el('div', 'm3-goal', this.goalsEl);
      const c = el('canvas', '', d);
      c.width = c.height = 64;
      c.getContext('2d').drawImage(goalIcon(g, 64), 0, 0);
      const n = el('span', 'm3-goal-n', d);
      d.title = goalName(g);
      this.goalCells.push({ g, d, n });
    }
    if (def.boss) {
      this.root.classList.add('has-boss');
      this.bossEl = html('div', 'm3-boss', this.root, '<div class="m3-boss-name">遗忘之蠹</div><div class="m3-boss-bar"><i></i></div>');
      this.bossFill = this.bossEl.querySelector('i');
    }
    this.lastMoves = null;
  }
  setBg(url, dim = 0.45) {
    if (url) this.bg.style.backgroundImage = `url(${url})`;
    this.bg.style.setProperty('--dim', String(dim));
  }
  addTool(id, label, count, onClick, name = '') {
    const b = html('button', 'm3-tool', this.tools, `<span class="m3-tool-i">${label}</span><span class="m3-tool-c">${count}</span>${name ? `<span class="m3-tool-name">${name}</span>` : ''}`);
    b.dataset.id = id;
    b.onclick = () => { audio.sfx('button'); onClick(b); };
    return b;
  }
  setToolCount(b, n) { b.querySelector('.m3-tool-c').textContent = String(n); b.disabled = n <= 0; }
  update() {
    const b = this.board;
    const m = Math.max(0, b.moves);
    if (m !== this.lastMoves) {
      this.movesEl.querySelector('.m3-moves-n').textContent = String(m);
      this.movesEl.classList.toggle('low', m <= 5);
      if (this.lastMoves != null) { this.movesEl.classList.remove('bump'); void this.movesEl.offsetWidth; this.movesEl.classList.add('bump'); }
      this.lastMoves = m;
    }
    this.scoreEl.textContent = String(b.score);
    const target = this.def.star3 || 1;
    this.barFill.style.width = `${Math.min(100, b.score / target * 100)}%`;
    for (const gc of this.goalCells) {
      const done = b.goalDone(gc.g);
      const left = Math.max(0, b.goalTarget(gc.g) - b.goalProgress(gc.g));
      gc.n.textContent = done ? '✓' : String(left);
      gc.d.classList.toggle('done', done);
    }
    if (this.bossFill && b.boss) this.bossFill.style.width = `${b.boss.hp / b.boss.max * 100}%`;
  }
  /** 目标图标的屏幕中心（给"飞入目标栏"动画用） */
  goalPoint(pred) {
    const gc = this.goalCells.find((x) => pred(x.g));
    if (!gc) return null;
    const r = gc.d.getBoundingClientRect(), s = this.canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  }
  pulseGoal(pred) {
    const gc = this.goalCells.find((x) => pred(x.g));
    if (!gc) return;
    gc.d.classList.remove('pulse'); void gc.d.offsetWidth; gc.d.classList.add('pulse');
  }
  say(text, face = 'smile', ms = 1800) {
    this.portImg.src = ASSETS.portrait[face] || ASSETS.portrait.smile;
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.bubble.classList.remove('show'), ms);
  }
  banner(text, cls = '') {
    const b = el('div', 'm3-banner ' + cls, this.root, text);
    setTimeout(() => b.remove(), 1600);
    return sleep(1300);
  }
  destroy() { this.root.classList.add('out'); setTimeout(() => this.root.remove(), 420); }
}
