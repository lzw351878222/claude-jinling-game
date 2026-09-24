// 消消乐棋盘视图：布局、绘制、棋子动画、触摸/鼠标输入
import { tileSprite, rubbleSprite, wormSprite, ropeSprite, inkSprite, lampSprite, TILE_COLORS } from './art.js';
import { Tweens, Sparks, Floaters, Sweeps, ease } from './fx.js';

export class BoardView {
  constructor(canvas, board, { onSwap, onTap } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.board = board;
    this.onSwap = onSwap;
    this.onTap = onTap;
    this.disp = new Map();
    this.tw = new Tweens();
    this.sparks = new Sparks();
    this.floaters = new Floaters();
    this.sweeps = new Sweeps();
    this.sel = -1;
    this.hint = null;
    this.hintT = 0;
    this.locked = true;
    this.shake = 0;
    this.time = 0;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.S = 64; this.ox = 0; this.oy = 0;
    this.cw = 0; this.ch = 0;
    this.bindInput();
  }
  // ---------------------------------------------------------------- 布局
  resize(w, h) {
    this.cw = w; this.ch = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const b = this.board, pad = 14;
    this.S = Math.max(24, Math.floor(Math.min((w - pad * 2) / b.w, (h - pad * 2) / b.h, 92)));
    this.ox = Math.round((w - this.S * b.w) / 2);
    this.oy = Math.round((h - this.S * b.h) / 2);
  }
  cx(i) { return this.ox + ((i % this.board.w) + 0.5) * this.S; }
  cy(i) { return this.oy + (Math.floor(i / this.board.w) + 0.5) * this.S; }
  cellAt(px, py) {
    const x = Math.floor((px - this.ox) / this.S), y = Math.floor((py - this.oy) / this.S);
    if (!this.board.inb(x, y)) return -1;
    return this.board.idx(x, y);
  }
  /** 为所有棋子建立显示状态（放在格子位置） */
  syncAll(dropIn = false) {
    const b = this.board;
    this.disp.clear();
    b.cells.forEach((c, i) => {
      if (!c.tile) return;
      const d = { x: i % b.w, y: Math.floor(i / b.w), s: 1, a: 1, r: 0 };
      if (dropIn) { d.y -= b.h + 1 + Math.random() * 0.5; }
      this.disp.set(c.tile.id, d);
    });
    if (dropIn) {
      const ps = [];
      b.cells.forEach((c, i) => {
        if (!c.tile) return;
        const d = this.disp.get(c.tile.id);
        const ty = Math.floor(i / b.w);
        ps.push(this.tw.to(d, { y: ty }, 0.55 + ty * 0.03, ease.outBounce, (i % b.w) * 0.03));
      });
      return Promise.all(ps);
    }
    return Promise.resolve();
  }
  // ---------------------------------------------------------------- 输入
  bindInput() {
    let down = null;
    const pos = (e) => { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const [x, y] = pos(e);
      const i = this.cellAt(x, y);
      if (this.onTap && this.tapMode) { if (i >= 0) this.onTap(i); return; }
      if (this.locked || i < 0) return;
      down = { i, x, y, moved: false };
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!down || this.locked) return;
      const [x, y] = pos(e);
      const dx = x - down.x, dy = y - down.y;
      if (Math.hypot(dx, dy) < this.S * 0.35) return;
      const b = this.board;
      const sx = down.i % b.w, sy = Math.floor(down.i / b.w);
      let tx = sx, ty = sy;
      if (Math.abs(dx) > Math.abs(dy)) tx += dx > 0 ? 1 : -1; else ty += dy > 0 ? 1 : -1;
      const from = down.i;
      down = null;
      this.sel = -1;
      if (b.inb(tx, ty)) this.onSwap?.(from, b.idx(tx, ty));
    });
    const up = () => {
      if (!down || this.locked) { down = null; return; }
      const i = down.i;
      down = null;
      const b = this.board;
      if (this.sel >= 0 && this.sel !== i && b.adjacent(this.sel, i)) { const a = this.sel; this.sel = -1; this.onSwap?.(a, i); return; }
      this.sel = this.sel === i ? -1 : (b.movable(b.cells[i]) ? i : -1);
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', () => { down = null; });
  }
  // ---------------------------------------------------------------- 动画 API
  async swap(a, b, back = false) {
    const B = this.board;
    const ta = B.cells[a].tile, tb = B.cells[b].tile; // 注意：调用时逻辑层可能已交换
    const da = this.disp.get(ta?.id), db = this.disp.get(tb?.id);
    const pa = { x: a % B.w, y: Math.floor(a / B.w) }, pb = { x: b % B.w, y: Math.floor(b / B.w) };
    const dur = 0.16;
    const ps = [];
    if (da) ps.push(this.tw.to(da, pa, dur, ease.outCubic));
    if (db) ps.push(this.tw.to(db, pb, dur, ease.outCubic));
    await Promise.all(ps);
    if (back) {
      const ps2 = [];
      if (da) ps2.push(this.tw.to(da, pb, dur, ease.outCubic));
      if (db) ps2.push(this.tw.to(db, pa, dur, ease.outCubic));
      await Promise.all(ps2);
    }
  }
  async playClear(ev, cascade = 1) {
    const B = this.board;
    const S = this.S;
    const ps = [];
    for (const fx of ev.effects) {
      if (fx.type === 'line') this.sweeps.add({ type: 'line', dir: fx.dir, x: fx.x, y: fx.y, dur: 0.42 });
      else if (fx.type === 'cross') { this.sweeps.add({ type: 'line', dir: 'h', x: fx.x, y: fx.y, wide: fx.w > 0, dur: 0.5 }); this.sweeps.add({ type: 'line', dir: 'v', x: fx.x, y: fx.y, wide: fx.w > 0, dur: 0.5 }); }
      else if (fx.type === 'burst') this.sweeps.add({ type: 'burst', x: fx.x, y: fx.y, r: fx.r, dur: 0.45 });
      else if (fx.type === 'seal' || fx.type === 'seal2') this.sweeps.add({ type: 'seal', x: fx.x, y: fx.y, targets: fx.targets, dur: 0.6 });
      if (fx.type !== 'line') this.shake = Math.max(this.shake, fx.combo ? 10 : 6);
    }
    let k = 0;
    for (const c of ev.cleared) {
      const d = this.disp.get(c.tile.id);
      if (!d) continue;
      d.ghost = c.tile;
      const delay = c.by === 'match' ? 0 : Math.min(0.25, (k++) * 0.012);
      const col = c.tile.color >= 0 ? TILE_COLORS[c.tile.color] : '#ffe08a';
      ps.push(this.tw.to(d, { s: 1.25 }, 0.07, ease.outCubic, delay).then(() => {
        this.sparks.burst(this.cx(c.i), this.cy(c.i), [col, '#fff6d8'], c.by === 'match' ? 7 : 5, { size: S * 0.08, speed: S * 3 });
        return this.tw.to(d, { s: 0, a: 0 }, 0.14, ease.inQuad);
      }).then(() => this.disp.delete(c.tile.id)));
    }
    for (const h of ev.hits) {
      this.sparks.burst(this.cx(h.i), this.cy(h.i), h.kind === 'worm' ? ['#c9ced6', '#8a919b'] : ['#9aa2a6', '#6d767a'], 9, { size: S * 0.09, speed: S * 3.2, shape: 'dot' });
    }
    for (const i of ev.inks) this.sparks.burst(this.cx(i), this.cy(i), ['#2a2a34', '#50505c'], 6, { size: S * 0.07, speed: S * 2.4 });
    for (const i of ev.lamps) this.sparks.burst(this.cx(i), this.cy(i), ['#ffe08a', '#ffb050'], 10, { size: S * 0.08, speed: S * 2.8, shape: 'star', gravity: 60, up: 40 });
    for (const i of ev.ropes) this.sparks.burst(this.cx(i), this.cy(i), ['#c9a060', '#8a6a3a'], 6, { size: S * 0.06, speed: S * 2.2 });
    for (const c of ev.created) {
      const d = { x: c.i % B.w, y: Math.floor(c.i / B.w), s: 0.2, a: 1, r: 0 };
      this.disp.set(c.tile.id, d);
      ps.push(this.tw.to(d, { s: 1 }, 0.3, ease.outBack, 0.12));
      this.sparks.burst(this.cx(c.i), this.cy(c.i), ['#fff6c8', '#ffd24a'], 12, { size: S * 0.07, speed: S * 2.6, shape: 'star', gravity: 80 });
    }
    // 分数飘字
    if (ev.score && ev.cleared.length) {
      const c0 = ev.cleared[Math.floor(ev.cleared.length / 2)];
      this.floaters.add('+' + ev.score, this.cx(c0.i), this.cy(c0.i), { size: Math.round(S * 0.32), color: '#fff6d8', rise: S * 0.8, dur: 0.8 });
    }
    await Promise.all(ps);
    await this.tw.wait(0.05);
  }
  async playFall(res) {
    const B = this.board;
    const ps = [];
    for (const [id, path] of res.paths) {
      const d0 = this.disp.get(id);
      const sp = res.spawned.find((s) => s.id === id);
      const endI = path[path.length - 1];
      const ex = endI % B.w, ey = Math.floor(endI / B.w);
      let d = d0;
      if (!d) { d = { x: ex, y: ey - (sp ? sp.above : 1) - 0.2, s: 1, a: 1, r: 0 }; this.disp.set(id, d); }
      const dist = Math.hypot(ex - d.x, ey - d.y);
      if (dist < 0.01) continue;
      const dur = 0.12 + Math.sqrt(dist) * 0.11;
      ps.push(this.tw.to(d, { x: ex, y: ey }, dur, ease.inQuad).then(() => this.tw.to(d, { s: 1 }, 0.001)));
    }
    await Promise.all(ps);
    // 落地轻弹
    for (const [id] of res.paths) { const d = this.disp.get(id); if (d) { d.s = 0.92; this.tw.to(d, { s: 1 }, 0.14, ease.outBack); } }
  }
  async playCollect(got, target) {
    const ps = [];
    for (const g2 of got) {
      const d = this.disp.get(g2.tile.id);
      if (!d) continue;
      d.ghost = g2.tile;
      const tx = target ? (target.x - this.ox) / this.S - 0.5 : d.x, ty = target ? (target.y - this.oy) / this.S - 0.5 : d.y - 2;
      ps.push(this.tw.to(d, { s: 1.3 }, 0.12, ease.outCubic).then(() => this.tw.to(d, { x: tx, y: ty, s: 0.4, a: 0.2 }, 0.5, ease.inOutSine)).then(() => this.disp.delete(g2.tile.id)));
      this.sparks.burst(this.cx(g2.i), this.cy(g2.i), ['#ffe08a', '#fff6d8'], 14, { shape: 'star', size: this.S * 0.08, speed: this.S * 3 });
    }
    await Promise.all(ps);
  }
  async playShuffle() {
    const B = this.board;
    const ps = [];
    B.cells.forEach((c, i) => {
      if (!c.tile) return;
      const d = this.disp.get(c.tile.id);
      if (!d) return;
      const tx = i % B.w, ty = Math.floor(i / B.w);
      ps.push(this.tw.to(d, { x: (B.w - 1) / 2, y: (B.h - 1) / 2, s: 0.6 }, 0.25, ease.inQuad).then(() => this.tw.to(d, { x: tx, y: ty, s: 1 }, 0.35, ease.outBack)));
    });
    await Promise.all(ps);
  }
  async playSpread(sp) {
    if (!sp) return;
    const d = this.disp.get(sp.eaten.id);
    if (d) d.ghost = sp.eaten;
    this.sparks.burst(this.cx(sp.to), this.cy(sp.to), ['#c9ced6', '#e9dfc4'], 10, { size: this.S * 0.07 });
    if (d) await this.tw.to(d, { s: 0, a: 0, r: 1.2 }, 0.3, ease.inQuad);
    this.disp.delete(sp.eaten.id);
  }
  async playBossHits(list) {
    for (const h of list) {
      if (h.kind === 'worm' && h.eaten) { const d = this.disp.get(h.eaten.id); if (d) { d.ghost = h.eaten; await this.tw.to(d, { s: 0, a: 0 }, 0.12); this.disp.delete(h.eaten.id); } }
      this.sparks.burst(this.cx(h.i), this.cy(h.i), ['#1a1a24', '#50505c'], 8, { size: this.S * 0.08 });
    }
    await this.tw.wait(0.2);
  }
  combo(text, n) {
    const x = this.ox + this.board.w * this.S / 2, y = this.oy + this.board.h * this.S * 0.42;
    this.floaters.add(text, x, y, { size: Math.round(this.S * (0.7 + Math.min(0.5, n * 0.06))), color: '#ffe08a', stroke: '#7e2419', rise: this.S * 0.6, dur: 1.1 });
  }
  setHint(pair) { this.hint = pair; this.hintT = 0; }
  // ---------------------------------------------------------------- 绘制
  update(dt) {
    this.time += dt;
    this.tw.update(dt);
    this.sparks.update(dt);
    this.floaters.update(dt);
    this.sweeps.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.hint) this.hintT += dt;
  }
  draw() {
    const g = this.g, B = this.board, S = this.S, dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.cw, this.ch);
    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    const ox = this.ox, oy = this.oy;
    // 棋盘外框（沿着可玩格的形状）
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
    const pass = (m, col, r) => { g.fillStyle = col; B.cells.forEach((c, i) => { if (c.mask) rr(ox + (i % B.w) * S - m, oy + Math.floor(i / B.w) * S - m, S + m * 2, S + m * 2, r); }); };
    pass(12, '#2a1a10', 14); pass(8, '#c8a15a', 11); pass(5, '#4a2e1c', 8);
    // 格子
    B.cells.forEach((c, i) => {
      if (!c.mask) return;
      const x = ox + (i % B.w) * S, y = oy + Math.floor(i / B.w) * S;
      g.fillStyle = ((i % B.w) + Math.floor(i / B.w)) % 2 ? '#efe4c8' : '#e5d6b6';
      g.fillRect(x, y, S, S);
      if (c.lamp) g.drawImage(lampSprite(c.lamp === 2, Math.round(S * dpr)), x, y, S, S);
      if (c.ink) g.drawImage(inkSprite(c.ink, Math.round(S * dpr)), x, y, S, S);
    });
    // 选中与提示
    if (this.sel >= 0) { g.fillStyle = 'rgba(255,220,120,0.55)'; g.fillRect(ox + (this.sel % B.w) * S + 2, oy + Math.floor(this.sel / B.w) * S + 2, S - 4, S - 4); }
    // 棋子
    const SP = Math.round(S * dpr);
    const hintIds = new Set();
    if (this.hint && this.hintT > 0) for (const i of this.hint) { const t = B.cells[i]?.tile; if (t) hintIds.add(t.id); }
    g.save();
    g.beginPath(); g.rect(ox - 2, oy - 2, B.w * S + 4, B.h * S + 4); g.clip();
    for (const c of B.cells) {
      if (!c.tile) continue;
      const d = this.disp.get(c.tile.id);
      if (!d) continue;
      this.drawTile(g, c.tile, d, SP, hintIds.has(c.tile.id));
    }
    // 正在飞走/消失、但已从逻辑层移除的棋子
    for (const [id, d] of this.disp) {
      if (d._drawn === this.frameNo) continue;
      if (d.ghost) this.drawTile(g, d.ghost, d, SP, false);
    }
    g.restore();
    // 绳索与障碍
    B.cells.forEach((c, i) => {
      const x = ox + (i % B.w) * S, y = oy + Math.floor(i / B.w) * S;
      if (c.rope && c.tile) g.drawImage(ropeSprite(c.rope, SP), x, y, S, S);
      if (c.rubble) g.drawImage(rubbleSprite(c.rubble, SP), x, y, S, S);
      if (c.worm) g.drawImage(wormSprite(Math.floor(this.time * 6 + i) % 4, SP), x, y, S, S);
    });
    this.sweeps.draw(g, S, ox, oy, B.w, B.h);
    this.sparks.draw(g);
    this.floaters.draw(g);
    g.restore();
    this.frameNo = (this.frameNo || 0) + 1;
  }
  drawTile(g, t, d, SP, hint) {
    const S = this.S;
    let x = this.ox + d.x * S, y = this.oy + d.y * S;
    let s = d.s;
    if (hint) { const w = Math.sin(this.hintT * 10) * 0.08 * Math.min(1, this.hintT); s *= 1 + Math.abs(w); }
    if (s <= 0.01 || d.a <= 0.01) return;
    d._drawn = this.frameNo;
    const special = t.kind !== 'normal' && t.kind !== 'item';
    g.save();
    g.globalAlpha = d.a;
    g.translate(x + S / 2, y + S / 2);
    if (d.r) g.rotate(d.r);
    if (special) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + t.id);
      g.fillStyle = t.kind === 'seal' ? `rgba(255,120,90,${0.18 + pulse * 0.2})` : `rgba(255,230,150,${0.15 + pulse * 0.18})`;
      g.beginPath(); g.arc(0, 0, S * 0.5, 0, Math.PI * 2); g.fill();
    }
    g.scale(s, s);
    g.drawImage(tileSprite(t, SP), -S / 2, -S / 2, S, S);
    g.restore();
  }
}
