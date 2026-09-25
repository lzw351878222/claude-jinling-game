// 消消乐核心逻辑（纯数据，不碰 DOM，可在 Node 里跑自动化测试）
//
// 棋子：{ id, color: 0..5（-1 = 无色：宝印/物件）, kind: 'normal'|'lineH'|'lineV'|'burst'|'seal'|'item', item?: 'brick'|'book'|... }
// 格子：{ mask, tile, ink: 0..2, rope: 0..2, rubble: 0..3, worm: bool, lamp: 0|1|2 (0 无, 1 未点亮, 2 已点亮) }
//
// 一次玩家操作的流程由控制器驱动：
//   swap → (特效组合 combo) → [ resolve() → gravity() ]* → collectItems → endMove()
// 每个函数都返回描述性的事件，供渲染层播放动画。

export const COLORS = 6;
export const NAMES = ['灯笼', '通宝', '玉佩', '青花', '梅花', '紫砂'];

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (n) => Math.floor(f() * n);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

const isSpecial = (t) => t && (t.kind === 'lineH' || t.kind === 'lineV' || t.kind === 'burst' || t.kind === 'seal');
export { isSpecial };

// ---------------------------------------------------------------- 星级与余步奖励
// 用的步数越少，星越多、分越高：
//   星级看过关时剩几步——剩 ≥ 四分之一（至少 3 步）三星，剩 ≥ 2 步两星，否则一星；
//   总分 = 消除得分 + 余步 × 每步奖励（def.bonus，约为该关每步消除得分中位数的 5 倍，
//   由 tools/m3-levels-sim.mjs 校准），所以省下一步远比多走一步消得多划算。
export const starLine = (M) => Math.max(3, Math.ceil(M * 0.25));
export const starsFor = (left, M) => (left >= starLine(M) ? 3 : left >= 2 ? 2 : 1);
export const moveBonusOf = (def) => def.bonus || 5000;
/** 连消倍率上限：连消越深每颗越值钱，但封顶，免得一次运气好的长连消盖过省步 */
const CASCADE_CAP = 3;

export class Board {
  /**
   * @param {object} def 关卡定义（见 levels.js）
   * @param {number} seed
   */
  constructor(def, seed = 1) {
    this.def = def;
    this.w = def.w;
    this.h = def.h;
    this.rng = makeRng(seed);
    this.nColors = def.colors ?? 5;
    this.colorSet = def.colorSet || [0, 1, 2, 3, 4, 5].slice(0, this.nColors);
    this.nextId = 1;
    this.cells = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const m = def.mask ? (def.mask[y]?.[x] ?? ' ') : '.';
      this.cells.push({ x, y, mask: m !== ' ', tile: null, ink: 0, rope: 0, rubble: 0, worm: false, lamp: 0 });
    }
    const layer = (rows, fn) => { if (!rows) return; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const ch = rows[y]?.[x]; if (ch && ch !== '.' && ch !== ' ') fn(this.cell(x, y), ch); } };
    layer(def.ink, (c, ch) => { if (c.mask) c.ink = +ch || 1; });
    layer(def.rope, (c, ch) => { if (c.mask) c.rope = +ch || 1; });
    layer(def.rubble, (c, ch) => { if (c.mask) c.rubble = +ch || 1; });
    layer(def.worm, (c) => { if (c.mask) c.worm = true; });
    layer(def.lamp, (c) => { if (c.mask) c.lamp = 1; });
    // 出口（物件落到这里即收集）：每列最底下的可玩格
    this.exit = new Set();
    for (let x = 0; x < this.w; x++) for (let y = this.h - 1; y >= 0; y--) { const c = this.cell(x, y); if (c.mask) { this.exit.add(this.idx(x, y)); break; } }
    // 生成口：每列最上面的可玩格
    this.spawner = new Set();
    for (let x = 0; x < this.w; x++) for (let y = 0; y < this.h; y++) { const c = this.cell(x, y); if (c.mask) { if (!(def.noSpawn || '').includes(x)) this.spawner.add(this.idx(x, y)); break; } }
    this.items = def.items ? { ...def.items, spawned: 0, collected: 0 } : null;
    this.score = 0;
    this.scoreFrozen = false;
    this.moves = def.moves ?? 25;
    this.movesUsed = 0;
    this.stats = { colors: new Array(COLORS).fill(0), ink: 0, rope: 0, rubble: 0, worm: 0, lamp: 0, item: 0, specials: 0 };
    this.wormClearedThisMove = false;
    this.boss = def.boss ? { hp: def.boss.hp, max: def.boss.hp } : null;
    this.goals = (def.goals || []).map((g) => ({ ...g }));
    this.fillInitial();
    for (const g of this.goals) {
      if (['ink', 'rope', 'rubble', 'worm', 'lamp'].includes(g.type) && g.n == null) g.n = this.countLayer(g.type);
    }
  }
  idx(x, y) { return y * this.w + x; }
  cell(x, y) { return this.cells[y * this.w + x]; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  at(x, y) { return this.inb(x, y) ? this.cells[y * this.w + x] : null; }
  canHold(c) { return c && c.mask && !c.rubble && !c.worm; }
  movable(c) { return this.canHold(c) && c.tile && !c.rope; }
  countLayer(type) {
    let n = 0;
    for (const c of this.cells) {
      if (!c.mask) continue;
      if (type === 'ink') n += c.ink;
      else if (type === 'rope') n += c.rope ? 1 : 0;
      else if (type === 'rubble') n += c.rubble ? 1 : 0;
      else if (type === 'worm') n += c.worm ? 1 : 0;
      else if (type === 'lamp') n += c.lamp === 1 ? 1 : 0;
    }
    return n;
  }
  newTile(color, kind = 'normal', item) {
    const t = { id: this.nextId++, color, kind };
    if (item) t.item = item;
    return t;
  }
  randColor(exclude) {
    const pool = exclude ? this.colorSet.filter((c) => !exclude.includes(c)) : this.colorSet;
    return (pool.length ? pool : this.colorSet)[this.rng.int((pool.length ? pool : this.colorSet).length)];
  }

  // ---------------------------------------------------------------- 初始化
  fillInitial() {
    const pre = this.def.tiles; // 预设棋子（教程用）：字符 0-5 颜色，h/v/b/s 特效，B 物件
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.cell(x, y);
      if (!this.canHold(c)) continue;
      const ch = pre?.[y]?.[x];
      if (ch && ch !== '.' && ch !== ' ') {
        if (ch >= '0' && ch <= '5') c.tile = this.newTile(+ch);
        else if (ch === 'h') c.tile = this.newTile(this.randColor(), 'lineH');
        else if (ch === 'v') c.tile = this.newTile(this.randColor(), 'lineV');
        else if (ch === 'b') c.tile = this.newTile(this.randColor(), 'burst');
        else if (ch === 's') c.tile = this.newTile(-1, 'seal');
        else if (ch === 'I' && this.items) { c.tile = this.newTile(-1, 'item', this.items.kind); this.items.spawned++; }
        continue;
      }
      // 避免开局即有三连
      const ex = [];
      const l1 = this.at(x - 1, y), l2 = this.at(x - 2, y), u1 = this.at(x, y - 1), u2 = this.at(x, y - 2);
      if (l1?.tile && l2?.tile && l1.tile.color === l2.tile.color) ex.push(l1.tile.color);
      if (u1?.tile && u2?.tile && u1.tile.color === u2.tile.color) ex.push(u1.tile.color);
      c.tile = this.newTile(this.randColor(ex));
    }
    // 开局放置物件
    if (this.items && this.items.start) {
      let n = this.items.start;
      const tops = [...this.spawner].sort(() => this.rng() - 0.5);
      for (const i of tops) { if (n <= 0) break; const c = this.cells[i]; if (c.tile && c.tile.kind === 'normal' && !c.rope) { c.tile = this.newTile(-1, 'item', this.items.kind); this.items.spawned++; n--; } }
    }
    if (!this.def.tiles) { let guard = 0; while ((this.findMatches().length || !this.hasMoves()) && guard++ < 50) this.reshuffleColors(); }
  }

  // ---------------------------------------------------------------- 匹配
  /** 找出所有三连及以上的组（相连的横竖连线合并成一组），并判定生成的特效 */
  findMatches(swapCells = []) {
    const W = this.w, H = this.h;
    const colorAt = (x, y) => {
      const c = this.at(x, y);
      if (!c || !this.canHold(c) || !c.tile) return -2;
      const t = c.tile;
      if (t.kind === 'seal' || t.kind === 'item' || t.color < 0) return -2;
      return t.color;
    };
    const runs = [];
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const col = colorAt(x, y);
        let e = x + 1;
        if (col >= 0) while (e < W && colorAt(e, y) === col) e++;
        if (col >= 0 && e - x >= 3) runs.push({ dir: 'h', color: col, cells: Array.from({ length: e - x }, (_, k) => this.idx(x + k, y)) });
        x = e;
      }
    }
    for (let x = 0; x < W; x++) {
      let y = 0;
      while (y < H) {
        const col = colorAt(x, y);
        let e = y + 1;
        if (col >= 0) while (e < H && colorAt(x, e) === col) e++;
        if (col >= 0 && e - y >= 3) runs.push({ dir: 'v', color: col, cells: Array.from({ length: e - y }, (_, k) => this.idx(x, y + k)) });
        y = e;
      }
    }
    // 合并共享格子的连线
    const parent = runs.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map();
    runs.forEach((r, i) => r.cells.forEach((c) => { if (owner.has(c)) parent[find(i)] = find(owner.get(c)); else owner.set(c, i); }));
    const groups = new Map();
    runs.forEach((r, i) => { const k = find(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    const out = [];
    for (const rs of groups.values()) {
      const cells = [...new Set(rs.flatMap((r) => r.cells))];
      const color = rs[0].color;
      const maxH = Math.max(0, ...rs.filter((r) => r.dir === 'h').map((r) => r.cells.length));
      const maxV = Math.max(0, ...rs.filter((r) => r.dir === 'v').map((r) => r.cells.length));
      let special = null;
      if (maxH >= 5 || maxV >= 5) special = 'seal';
      else if (maxH >= 3 && maxV >= 3) special = 'burst';
      else if (maxH === 4) special = 'lineV';
      else if (maxV === 4) special = 'lineH';
      // 特效生成位置：优先玩家挪动的那颗；否则 L/T 的交点；否则连线中部
      let at = null;
      if (special) {
        at = swapCells.find((c) => cells.includes(c) && !this.cells[c].rope) ?? null;
        if (at == null && special === 'burst') {
          const hs = new Set(rs.filter((r) => r.dir === 'h').flatMap((r) => r.cells));
          at = rs.filter((r) => r.dir === 'v').flatMap((r) => r.cells).find((c) => hs.has(c) && !this.cells[c].rope) ?? null;
        }
        if (at == null) { const free = cells.filter((c) => !this.cells[c].rope); at = free[Math.floor(free.length / 2)] ?? null; }
        if (at == null) special = null;
      }
      out.push({ cells, color, special, at, runs: rs.length });
    }
    return out;
  }

  // ---------------------------------------------------------------- 交换
  adjacent(a, b) {
    const ax = a % this.w, ay = Math.floor(a / this.w), bx = b % this.w, by = Math.floor(b / this.w);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }
  canTrySwap(a, b) {
    return this.adjacent(a, b) && this.movable(this.cells[a]) && this.movable(this.cells[b]);
  }
  /** 试探交换是否有效（不改变棋盘） */
  swapValid(a, b) {
    if (!this.canTrySwap(a, b)) return false;
    const ta = this.cells[a].tile, tb = this.cells[b].tile;
    if (ta.kind === 'seal' && tb.kind !== 'item') return true;
    if (tb.kind === 'seal' && ta.kind !== 'item') return true;
    if (isSpecial(ta) && isSpecial(tb)) return true;
    this.cells[a].tile = tb; this.cells[b].tile = ta;
    const ok = this.findMatches().length > 0;
    this.cells[a].tile = ta; this.cells[b].tile = tb;
    return ok;
  }
  doSwap(a, b) {
    const ta = this.cells[a].tile;
    this.cells[a].tile = this.cells[b].tile;
    this.cells[b].tile = ta;
  }
  hasMoves() { return !!this.findHint(true); }
  /** 找一步可走的棋（尽量找能出特效的） */
  findHint(any = false) {
    let best = null, bestScore = -1;
    for (let i = 0; i < this.cells.length; i++) {
      const x = i % this.w;
      for (const j of [i + 1, i + this.w]) {
        if (j >= this.cells.length || (j === i + 1 && (x + 1) >= this.w)) continue;
        if (!this.swapValid(i, j)) continue;
        if (any) return [i, j];
        const ta = this.cells[i].tile, tb = this.cells[j].tile;
        let s = 1;
        if (isSpecial(ta) || isSpecial(tb)) s = 6;
        else {
          this.doSwap(i, j);
          const ms = this.findMatches([i, j]);
          this.doSwap(i, j);
          for (const m of ms) s = Math.max(s, m.cells.length + (m.special === 'seal' ? 6 : m.special ? 3 : 0));
        }
        s += this.rng() * 0.5;
        if (s > bestScore) { bestScore = s; best = [i, j]; }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- 消除
  /**
   * 对一组待清除的格子执行清除，连锁触发特效。
   * @returns 事件 { cleared:[{i,tile,by}], effects:[...], hits:[{i,kind,left}], created:[{i,tile}], score }
   */
  clearCells(initial, { matchGroups = [], cascade = 1, extraEffects = [] } = {}) {
    const ev = { cleared: [], effects: [], hits: [], created: [], inks: [], lamps: [], ropes: [], score: 0, bossDmg: 0 };
    const toClear = new Map(); // i → by
    const queue = [];
    const triggered = new Set();
    const createAt = new Map(); // 本步将生成特效的位置 → spec
    for (const g of matchGroups) if (g.special && g.at != null) createAt.set(g.at, { kind: g.special, color: g.special === 'seal' ? -1 : g.color });
    const damagedBlocker = new Set();
    const add = (i, by) => {
      if (i < 0 || i >= this.cells.length) return;
      const c = this.cells[i];
      if (!c.mask) return;
      // 障碍：特效直接打
      if (by !== 'match' && (c.rubble || c.worm)) { this.hitBlocker(i, ev, damagedBlocker); return; }
      if (!c.tile) { if (by !== 'match') this.hitFloor(i, ev); return; }
      if (toClear.has(i)) return;
      toClear.set(i, by);
      const t = c.tile;
      if (isSpecial(t) && !triggered.has(t.id) && !c.rope && !(createAt.has(i) && by === 'match' && t.kind === 'normal')) queue.push(i);
    };
    for (const i of initial) add(i, 'match');
    for (const fx of extraEffects) queue.push({ fx });
    // 匹配产生的相邻伤害
    for (const i of initial) {
      const x = i % this.w, y = Math.floor(i / this.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.at(x + dx, y + dy);
        if (n && (n.rubble || n.worm)) this.hitBlocker(this.idx(x + dx, y + dy), ev, damagedBlocker);
      }
    }
    let guard = 0;
    while (queue.length && guard++ < 500) {
      const q = queue.shift();
      let fx;
      if (typeof q === 'object') fx = q.fx;
      else {
        const t = this.cells[q].tile;
        if (!t || triggered.has(t.id)) continue;
        triggered.add(t.id);
        fx = this.effectOf(q, t);
      }
      if (!fx) continue;
      ev.effects.push(fx);
      for (const i of fx.cells) add(i, fx.type);
      for (const nf of fx.spawnEffects || []) queue.push({ fx: nf });
    }
    // 执行清除
    for (const [i, by] of toClear) {
      const c = this.cells[i];
      const t = c.tile;
      if (!t) continue;
      if (t.kind === 'item') continue; // 物件不会被消掉
      if (c.rope) {
        c.rope--;
        ev.ropes.push(i);
        if (!c.rope) this.stats.rope++;
        ev.score += 100;
        continue;
      }
      c.tile = null;
      ev.cleared.push({ i, tile: t, by });
      if (t.color >= 0) this.stats.colors[t.color]++;
      ev.score += (t.kind === 'normal' ? 60 : 120) * Math.min(cascade, CASCADE_CAP);
      if (this.boss) ev.bossDmg += t.kind === 'normal' ? 1 : 3;
      this.hitFloor(i, ev);
    }
    // 生成特效棋子
    for (const [i, spec] of createAt) {
      const c = this.cells[i];
      if (!this.canHold(c) || c.tile) continue;
      const t = this.newTile(spec.color, spec.kind);
      c.tile = t;
      ev.created.push({ i, tile: t });
      this.stats.specials++;
      ev.score += spec.kind === 'seal' ? 600 : spec.kind === 'burst' ? 300 : 200;
    }
    if (this.scoreFrozen) ev.score = 0; // 结算时余步化成的毛笔只按"每步奖励"计分
    this.score += ev.score;
    if (this.boss) { this.boss.hp = Math.max(0, this.boss.hp - ev.bossDmg); }
    return ev;
  }
  hitFloor(i, ev) {
    const c = this.cells[i];
    if (c.ink) { c.ink--; ev.inks.push(i); this.stats.ink++; ev.score += 100; }
    if (c.lamp === 1) { c.lamp = 2; ev.lamps.push(i); this.stats.lamp++; ev.score += 150; }
  }
  hitBlocker(i, ev, once) {
    if (once.has(i)) return;
    once.add(i);
    const c = this.cells[i];
    if (c.worm) {
      c.worm = false;
      this.stats.worm++;
      this.wormClearedThisMove = true;
      ev.hits.push({ i, kind: 'worm', left: 0 });
      ev.score += 200;
      if (this.boss) ev.bossDmg += 2;
    } else if (c.rubble) {
      c.rubble--;
      if (!c.rubble) this.stats.rubble++;
      ev.hits.push({ i, kind: 'rubble', left: c.rubble });
      ev.score += 150;
      if (this.boss) ev.bossDmg += 1;
    }
  }
  /** 单个特效棋子被触发时的作用范围 */
  effectOf(i, t) {
    const x = i % this.w, y = Math.floor(i / this.w);
    const cells = [];
    if (t.kind === 'lineH') { for (let k = 0; k < this.w; k++) cells.push(this.idx(k, y)); return { type: 'line', dir: 'h', i, x, y, cells }; }
    if (t.kind === 'lineV') { for (let k = 0; k < this.h; k++) cells.push(this.idx(x, k)); return { type: 'line', dir: 'v', i, x, y, cells }; }
    if (t.kind === 'burst') { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.inb(x + dx, y + dy)) cells.push(this.idx(x + dx, y + dy)); return { type: 'burst', i, x, y, r: 1, cells }; }
    if (t.kind === 'seal') {
      // 被连带触发的宝印：清掉场上最多的那种颜色
      const cnt = new Array(COLORS).fill(0);
      for (const c of this.cells) if (c.tile && c.tile.color >= 0 && this.canHold(c)) cnt[c.tile.color]++;
      const col = cnt.indexOf(Math.max(...cnt));
      return this.sealColor(i, col);
    }
    return null;
  }
  sealColor(i, col, toKind = null) {
    const cells = [i];
    const x = i % this.w, y = Math.floor(i / this.w);
    const targets = [];
    for (let k = 0; k < this.cells.length; k++) {
      const c = this.cells[k];
      if (k !== i && this.canHold(c) && c.tile && c.tile.color === col && c.tile.kind !== 'item') { cells.push(k); targets.push(k); }
    }
    const fx = { type: 'seal', i, x, y, color: col, targets, cells };
    if (toKind) {
      // 宝印 + 特效：同色全部变成该特效并一起触发
      fx.convert = toKind;
      fx.cells = [i];
      fx.spawnEffects = [];
      for (const k of targets) {
        const t = this.cells[k].tile;
        const kind = toKind === 'line' ? (this.rng() < 0.5 ? 'lineH' : 'lineV') : toKind;
        t.kind = kind;
        const sub = this.effectOf(k, t);
        if (sub) { sub.cells.push(k); fx.spawnEffects.push(sub); }
      }
    }
    return fx;
  }
  /** 两个特效互换时的组合效果 */
  comboEffect(a, b) {
    const ta = this.cells[a].tile, tb = this.cells[b].tile;
    const kinds = [ta.kind, tb.kind];
    const has = (k) => kinds.includes(k);
    const bx = b % this.w, by = Math.floor(b / this.w);
    const isLine = (k) => k === 'lineH' || k === 'lineV';
    // 宝印 + 宝印：清屏
    if (ta.kind === 'seal' && tb.kind === 'seal') {
      const cells = this.cells.map((_, k) => k).filter((k) => this.cells[k].mask);
      return { type: 'seal2', i: b, x: bx, y: by, cells, targets: cells, combo: true };
    }
    if (has('seal')) {
      const [si, oi] = ta.kind === 'seal' ? [a, b] : [b, a];
      const other = this.cells[oi].tile;
      if (other.kind === 'normal') { const fx = this.sealColor(si, other.color); fx.cells.push(oi); return fx; }
      const fx = this.sealColor(si, other.color, isLine(other.kind) ? 'line' : other.kind === 'burst' ? 'burst' : null);
      fx.cells.push(oi);
      fx.combo = true;
      return fx;
    }
    const cells = new Set();
    const addRow = (y) => { if (y >= 0 && y < this.h) for (let k = 0; k < this.w; k++) cells.add(this.idx(k, y)); };
    const addCol = (x) => { if (x >= 0 && x < this.w) for (let k = 0; k < this.h; k++) cells.add(this.idx(x, k)); };
    if (isLine(ta.kind) && isLine(tb.kind)) { addRow(by); addCol(bx); cells.add(a); return { type: 'cross', i: b, x: bx, y: by, w: 0, cells: [...cells], combo: true }; }
    if ((isLine(ta.kind) && tb.kind === 'burst') || (ta.kind === 'burst' && isLine(tb.kind))) {
      for (let d = -1; d <= 1; d++) { addRow(by + d); addCol(bx + d); }
      cells.add(a);
      return { type: 'cross', i: b, x: bx, y: by, w: 1, cells: [...cells], combo: true };
    }
    if (ta.kind === 'burst' && tb.kind === 'burst') {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (this.inb(bx + dx, by + dy)) cells.add(this.idx(bx + dx, by + dy));
      cells.add(a);
      return { type: 'burst', i: b, x: bx, y: by, r: 2, cells: [...cells], combo: true };
    }
    return null;
  }
  /**
   * 玩家交换之后的第一次结算：特效组合、宝印、或普通匹配。
   * 返回 null 表示这次交换无效（控制器应把棋子换回去）。
   */
  afterSwap(a, b) {
    const ta = this.cells[a].tile, tb = this.cells[b].tile;
    const combo = (isSpecial(ta) && isSpecial(tb)) || ta.kind === 'seal' || tb.kind === 'seal';
    if (combo && ta.kind !== 'item' && tb.kind !== 'item') {
      const fx = this.comboEffect(a, b);
      if (fx) {
        // 参与组合的两颗先标记为已触发，防止重复
        const ev = this.clearCells([], { extraEffects: [fx], cascade: 1 });
        for (const k of [a, b]) {
          const c = this.cells[k];
          if (c.tile && isSpecial(c.tile)) { ev.cleared.push({ i: k, tile: c.tile, by: 'combo' }); c.tile = null; this.hitFloor(k, ev); }
        }
        ev.comboFx = fx;
        return ev;
      }
    }
    const groups = this.findMatches([a, b]);
    if (!groups.length) return null;
    return this.clearCells(groups.flatMap((g) => g.cells), { matchGroups: groups, cascade: 1 });
  }
  /** 连锁：找匹配并清除；没有匹配时返回 null */
  cascade(step) {
    const groups = this.findMatches();
    if (!groups.length) return null;
    return this.clearCells(groups.flatMap((g) => g.cells), { matchGroups: groups, cascade: step });
  }

  // ---------------------------------------------------------------- 重力与补充
  /**
   * 让棋子下落、斜向滑落、从生成口补充，直到稳定。
   * @returns { paths: Map(id → [cellIndex...]), spawned: [{id, i, tile, above}] }
   */
  gravity() {
    const paths = new Map();
    const spawned = [];
    const track = (t, i) => { if (!paths.has(t.id)) paths.set(t.id, []); paths.get(t.id).push(i); };
    const spawnCount = new Map();
    let changed = true, guard = 0;
    while (changed && guard++ < 400) {
      changed = false;
      // 竖直下落（自下而上扫描）
      for (let y = this.h - 1; y >= 0; y--) for (let x = 0; x < this.w; x++) {
        const i = this.idx(x, y);
        const c = this.cells[i];
        if (!this.canHold(c) || c.tile) continue;
        const up = this.at(x, y - 1);
        if (up && this.canHold(up) && up.tile && !up.rope) {
          if (!paths.has(up.tile.id)) track(up.tile, this.idx(x, y - 1));
          c.tile = up.tile; up.tile = null; track(c.tile, i); changed = true; continue;
        }
        if (this.spawner.has(i) && !(up && up.mask && this.canHold(up))) {
          const t = this.spawnTile();
          c.tile = t;
          const n = (spawnCount.get(x) || 0) + 1; spawnCount.set(x, n);
          spawned.push({ id: t.id, i, tile: t, above: n });
          track(t, i);
          changed = true;
        }
      }
      if (changed) continue;
      // 斜向滑落：只填补正上方被挡住（洞、障碍、绳子）的空格
      for (let y = this.h - 1; y >= 1; y--) for (let x = 0; x < this.w; x++) {
        const i = this.idx(x, y);
        const c = this.cells[i];
        if (!this.canHold(c) || c.tile) continue;
        const up = this.at(x, y - 1);
        const blockedAbove = !up || !up.mask || !this.canHold(up) || (up.tile && up.rope) || (!up.tile && !this.canReceiveFromAbove(x, y - 1));
        if (!blockedAbove) continue;
        for (const dx of this.rng() < 0.5 ? [-1, 1] : [1, -1]) {
          const d = this.at(x + dx, y - 1);
          if (!d || !this.canHold(d) || !d.tile || d.rope) continue;
          // 源格正下方如果能接着往下掉，就让它先直落
          const below = this.at(x + dx, y);
          if (below && this.canHold(below) && !below.tile) continue;
          if (!paths.has(d.tile.id)) track(d.tile, this.idx(x + dx, y - 1));
          c.tile = d.tile; d.tile = null; track(c.tile, i);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
    return { paths, spawned };
  }
  canReceiveFromAbove(x, y) {
    // 某格若为空，它上面一路能否拿到棋子（有生成口或有可落的棋子）
    for (let yy = y; yy >= 0; yy--) {
      const c = this.at(x, yy);
      if (!c || !c.mask || !this.canHold(c)) return false;
      if (c.tile) return !c.rope;
      if (this.spawner.has(this.idx(x, yy))) return true;
    }
    return false;
  }
  spawnTile() {
    const it = this.items;
    if (it && it.spawned < it.total) {
      let onBoard = 0;
      for (const c of this.cells) if (c.tile && c.tile.kind === 'item') onBoard++;
      if (onBoard < (it.max ?? 1) && this.rng() < (it.rate ?? 0.18)) { it.spawned++; return this.newTile(-1, 'item', it.kind); }
    }
    return this.newTile(this.randColor());
  }
  /** 落到底的物件被收集 */
  collectItems() {
    const got = [];
    for (const i of this.exit) {
      const c = this.cells[i];
      if (c.tile && c.tile.kind === 'item') { got.push({ i, tile: c.tile }); c.tile = null; this.stats.item++; if (this.items) this.items.collected++; if (!this.scoreFrozen) this.score += 500; }
    }
    return got;
  }

  // ---------------------------------------------------------------- 回合结束
  endMove() {
    this.moves--;
    this.movesUsed++;
    const ev = { spread: null };
    // 蠹：本回合没有消灭任何一只，就蔓延一格
    if (!this.wormClearedThisMove) {
      const worms = this.cells.filter((c) => c.worm);
      const cand = [];
      for (const w of worms) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.at(w.x + dx, w.y + dy);
        if (n && this.canHold(n) && n.tile && n.tile.kind === 'normal' && !n.rope) cand.push([w, n]);
      }
      if (cand.length) {
        const [from, to] = cand[this.rng.int(cand.length)];
        const eaten = to.tile;
        to.tile = null;
        to.worm = true;
        ev.spread = { from: this.idx(from.x, from.y), to: this.idx(to.x, to.y), eaten };
      }
    }
    this.wormClearedThisMove = false;
    return ev;
  }
  /** Boss 行动：往棋盘上泼墨或放蠹 */
  bossAct(kind = 'ink', n = 3) {
    const out = [];
    const cand = this.cells.filter((c) => this.canHold(c) && c.tile && c.tile.kind === 'normal' && !c.rope && !c.worm);
    for (let k = 0; k < n && cand.length; k++) {
      const c = cand.splice(this.rng.int(cand.length), 1)[0];
      const i = this.idx(c.x, c.y);
      if (kind === 'ink') { c.ink = Math.min(2, c.ink + 1); out.push({ i, kind: 'ink' }); }
      else if (kind === 'worm') { const eaten = c.tile; c.tile = null; c.worm = true; out.push({ i, kind: 'worm', eaten }); }
      else if (kind === 'rope') { c.rope = 1; out.push({ i, kind: 'rope' }); }
    }
    return out;
  }

  // ---------------------------------------------------------------- 目标
  goalProgress(g) {
    switch (g.type) {
      case 'color': return Math.min(g.n, this.stats.colors[g.color]);
      case 'ink': return Math.min(g.n, this.stats.ink);
      case 'rope': return Math.min(g.n, this.stats.rope);
      case 'rubble': return Math.min(g.n, this.stats.rubble);
      case 'worm': return this.countLayer('worm') === 0 ? g.n : Math.min(g.n - 1, this.stats.worm);
      case 'lamp': return Math.min(g.n, this.stats.lamp);
      case 'item': return Math.min(g.n, this.stats.item);
      case 'score': return Math.min(g.n, this.score);
      case 'boss': return this.boss ? this.boss.max - this.boss.hp : 0;
      default: return 0;
    }
  }
  goalTarget(g) { return g.type === 'boss' ? this.boss.max : g.n; }
  goalDone(g) { return this.goalProgress(g) >= this.goalTarget(g); }
  won() { return this.goals.length > 0 && this.goals.every((g) => this.goalDone(g)); }
  lost() { return !this.won() && this.moves <= 0; }

  // ---------------------------------------------------------------- 洗牌
  reshuffleColors() {
    const cells = this.cells.filter((c) => this.canHold(c) && c.tile && c.tile.kind === 'normal' && !c.rope);
    const cols = cells.map((c) => c.tile.color);
    for (let k = cols.length - 1; k > 0; k--) { const j = this.rng.int(k + 1); [cols[k], cols[j]] = [cols[j], cols[k]]; }
    cells.forEach((c, k) => { c.tile.color = cols[k]; });
  }
  /** 死局时洗牌：只动普通棋子的位置，保证无三连、有步可走 */
  shuffle() {
    const cells = this.cells.filter((c) => this.canHold(c) && c.tile && c.tile.kind === 'normal' && !c.rope);
    const tiles = cells.map((c) => c.tile);
    for (let tries = 0; tries < 80; tries++) {
      for (let k = tiles.length - 1; k > 0; k--) { const j = this.rng.int(k + 1); [tiles[k], tiles[j]] = [tiles[j], tiles[k]]; }
      cells.forEach((c, k) => { c.tile = tiles[k]; });
      if (!this.findMatches().length && this.hasMoves()) return cells.map((c) => ({ id: c.tile.id, i: this.idx(c.x, c.y) }));
    }
    // 实在不行：重新随机颜色
    let guard = 0;
    do { for (const c of cells) c.tile.color = this.randColor(); } while ((this.findMatches().length || !this.hasMoves()) && guard++ < 200);
    return cells.map((c) => ({ id: c.tile.id, i: this.idx(c.x, c.y) }));
  }
}
