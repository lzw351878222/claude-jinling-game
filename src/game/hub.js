// 寻踪大厅：3D 场景上的「修复清单」与「闯关」按钮
import { el, html, isTouchDevice } from '../core/util.js';
import { audio } from '../core/audio.js';

export class Hub {
  constructor(app) {
    this.app = app;
    const layer = app.ui.layer;
    this.root = el('div', 'hub hidden', layer);
    this.list = el('div', 'hub-list jl-panel', this.root);
    this.listHead = html('div', 'hub-list-head', this.list, '');
    this.listBody = el('ol', 'hub-list-body', this.list);
    this.listHead.onclick = () => { this.list.classList.toggle('open'); audio.sfx('page'); };
    this.play = html('button', 'hub-play', this.root, '<span class="hp-sub"></span><span class="hp-main"></span><span class="hp-kind"></span>');
    this.play.onclick = () => this.press();
    this.waiter = null;
    this.touch = isTouchDevice();
    if (this.touch) this.root.classList.add('touch');
    window.addEventListener('keydown', (e) => {
      if (!this.waiter || this.app.ui.menuEl || this.app.game.busy) return;
      if (e.code === 'Enter' || e.code === 'KeyF' || e.code === 'KeyP') { e.preventDefault(); this.press(); }
    });
  }
  /** 显示本章清单；cur = 当前第几步 */
  show(ch, cur) {
    const steps = ch.steps || [];
    this.root.classList.remove('hidden');
    const done = Math.min(cur, steps.length);
    this.listHead.innerHTML = `<span class="hl-num">${ch.meta.num}</span><span class="hl-t">${ch.listTitle || '修复踪迹'}</span><span class="hl-p">${done}/${steps.length}</span>`;
    this.listBody.innerHTML = '';
    steps.forEach((s, i) => {
      const cls = i < cur ? 'done' : i === cur ? 'cur' : 'todo';
      // 已过的消消乐关：显示拿到的星（用的步越少星越多）
      const n = s.kind === 'level' && i < cur ? this.app.state?.levelStars?.[s.id] || 0 : 0;
      const stars = n ? `<b class="hl-stars" title="${n} 星">${'★'.repeat(n)}<s>${'★'.repeat(3 - n)}</s></b>` : '';
      html('li', cls, this.listBody, `<i></i><span>${i <= cur ? s.title : '？？？'}</span>${s.kind === 'mg' ? '<em>特别关</em>' : stars}`);
    });
    const s = steps[cur];
    if (s) {
      this.play.classList.toggle('mg', s.kind === 'mg');
      this.play.querySelector('.hp-sub').textContent = s.kind === 'mg' ? '特别关' : `第 ${this.levelNo(ch, cur)} 关`;
      this.play.querySelector('.hp-main').textContent = s.kind === 'mg' ? s.title.slice(0, 4) : '闯关';
      this.play.querySelector('.hp-kind').textContent = s.kind === 'mg' ? '' : s.title;
      this.play.style.display = '';
    } else this.play.style.display = 'none';
  }
  levelNo(ch, cur) {
    // 全局关卡序号（只数消消乐关卡）
    let n = 0;
    for (const c of this.app.chapters) {
      for (let i = 0; i < (c.steps || []).length; i++) {
        if (c.steps[i].kind === 'level') n++;
        if (c === ch && i === cur) return n;
      }
    }
    return n;
  }
  hide() { this.root.classList.add('hidden'); this.cancelWait(); }
  /** 等玩家按下「闯关」 */
  waitPlay() {
    this.cancelWait();
    this.play.classList.add('ready');
    return new Promise((res) => { this.waiter = res; });
  }
  cancelWait(v = 'abort') { if (this.waiter) { const w = this.waiter; this.waiter = null; w(v); } this.play.classList.remove('ready'); }
  press() {
    if (!this.waiter || this.app.game.busy || this.app.ui.menuEl) return;
    audio.sfx('button');
    audio.unlock();
    const w = this.waiter;
    this.waiter = null;
    this.play.classList.remove('ready');
    w('play');
  }
}
