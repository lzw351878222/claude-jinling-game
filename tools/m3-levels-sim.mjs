// 消消乐正式关卡批量模拟：node tools/m3-levels-sim.mjs [每关局数=200] [关卡id | 前缀 | 逗号列表]
//
// · 机器人策略与 tools/m3-sim.mjs 相同：每步走 board.findHint()（贪心：先特效组合，再挑最大的连消/能出特效的步）。
// · 回合流程照搬 controller.js：afterSwap → [settle(下落/收集物件) → cascade]* → endMove → bossTurn → 胜负 → 死局洗牌。
// · 不计"借五步"。每局一直下到胜利（上限 max(2×步数, 步数+25)），于是能同时算出任意步数上限下的胜率，给出建议步数。
// · 星级 = logic.starsFor，按"胜利那一刻剩余步数"计算；总分 = 消除得分 + 余步 × def.bonus（= controller.bonusRound）。
//   建议的 bonus = 胜局"每步消除得分"中位数的 5 倍；"省步一致率" = 任取两局胜局，剩步多的那局总分更高的比例（应 ≥ 93%）。
// · 不变量（同 m3-sim）：棋子只在可容纳的格子上、id 唯一、重力后无可补的空格、提示步有效、连锁不死循环、洗牌后无三连；
//   另查：开局无三连且有步可走、洗牌后仍无步（卡死）、关卡数据格式、intro 与目标数字是否一致。
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { Board, NAMES, starsFor, moveBonusOf } from '../src/m3/logic.js';
import { LEVELS, LEVEL_ORDER } from '../src/m3/levels.js';

// 目标胜率：[下限, 上限, 瞄准值]（章节区间 + 章内锯齿，终关最难）
const RANGE = { p: [99, 100], c1: [92, 99], c2: [85, 95], c3: [80, 92], c4: [75, 90], c5: [70, 88], final: [70, 85] };
const AIM = {
  p1: 100, p2: 99.5,
  'c1-1': 97, 'c1-2': 96, 'c1-3': 96, 'c1-4': 95, 'c1-5': 93,
  'c2-1': 93, 'c2-2': 92, 'c2-3': 90, 'c2-4': 88, 'c2-5': 86,
  'c3-1': 90, 'c3-2': 87, 'c3-3': 88, 'c3-4': 85, 'c3-5': 84, 'c3-6': 81,
  'c4-1': 88, 'c4-2': 85, 'c4-3': 87, 'c4-4': 81, 'c4-5': 77,
  'c5-1': 86, 'c5-2': 83, 'c5-3': 80, 'c5-4': 81, 'c5-5': 76, 'c5-6': 72,
  final: 76,
};
const rangeOf = (id) => RANGE[id === 'final' ? 'final' : id[0] === 'p' ? 'p' : id.split('-')[0]];
const starsOf = starsFor; // = controller.onWin
const capOf = (def) => Math.max(def.moves * 2, def.moves + 25);

// ------------------------------------------------------------------ 单局（worker 里跑）
function checkInvariants(b, where) {
  const ids = new Set();
  for (const c of b.cells) {
    if (!c.tile) continue;
    if (!b.canHold(c)) throw new Error(`${where}: 不可容纳的格子上有棋子 (${c.x},${c.y})`);
    if (ids.has(c.tile.id)) throw new Error(`${where}: 重复 id ${c.tile.id}`);
    ids.add(c.tile.id);
  }
}
function checkFull(b, where) {
  for (const c of b.cells) if (b.canHold(c) && !c.tile && b.canReceiveFromAbove(c.x, c.y)) throw new Error(`${where}: 重力后仍有空格 (${c.x},${c.y})`);
}
const countEmpty = (b) => b.cells.reduce((n, c) => n + (b.canHold(c) && !c.tile ? 1 : 0), 0);
function settle(b) { // = controller.settle
  for (let k = 0; k < 6; k++) { b.gravity(); if (!b.collectItems().length) break; }
}
function resolve(b, ev, where) { // = controller.resolve
  let step = 1;
  while (ev) {
    if (step > 100) throw new Error(`${where}: 连锁无限循环`);
    settle(b);
    checkInvariants(b, where);
    checkFull(b, where);
    step++;
    ev = b.cascade(step);
  }
  return step - 1;
}
function bossTurn(b, def) { // = controller.endTurn/bossTurn
  const every = def.boss.every || 3;
  if (!b.won() && b.movesUsed % every === 0) {
    const kinds = def.boss.acts || ['ink', 'worm'];
    b.bossAct(kinds[Math.floor(b.movesUsed / every) % kinds.length], def.boss.power || 3);
  }
}
function bonusRound(b, left) { // = controller.bonusRound（Math.random 换成棋盘 rng）
  const per = moveBonusOf(b.def);
  b.moves = left;
  b.scoreFrozen = true;
  const cells = b.cells.map((c, i) => [c, i]).filter(([c]) => b.canHold(c) && c.tile && c.tile.kind === 'normal' && !c.rope);
  for (let k = cells.length - 1; k > 0; k--) { const j = Math.floor(b.rng() * (k + 1)); [cells[k], cells[j]] = [cells[j], cells[k]]; }
  const picks = cells.slice(0, Math.min(left, 8));
  for (const [c] of picks) { c.tile.kind = b.rng() < 0.5 ? 'lineH' : 'lineV'; b.moves--; b.score += per; }
  b.score += b.moves * per;
  b.moves = 0;
  if (picks.length) { b.clearCells(picks.map(([, i]) => i), {}); settle(b); checkInvariants(b, 'bonus'); } // 结算只扫一遍、落一次（不连消）
  b.scoreFrozen = false;
}
function playGame(def, seed) {
  const where = `${def.id}#${seed}`;
  const M = def.moves, cap = capOf(def);
  const b = new Board(def, seed);
  checkInvariants(b, `${where} 开局`);
  if (b.findMatches().length) throw new Error(`${where}: 开局就有三连`);
  if (countEmpty(b)) throw new Error(`${where}: 开局有空格`);
  const r = { seed, X: -1, shuffles: 0, stuck: -1, maxEmpty: 0, emptyMoves: 0, bigEmpty: 0, chain: 0, atM: null, noStartMove: !b.hasMoves() };
  if (r.noStartMove) return r; // 控制器开局不检查死局，玩家会被卡住
  b.moves = 1e9;
  while (!b.won() && b.movesUsed < cap) {
    const h = b.findHint();
    if (!h) throw new Error(`${where}: 有步却找不到提示`);
    const [a, c] = h;
    b.doSwap(a, c);
    const ev = b.afterSwap(a, c);
    if (!ev) throw new Error(`${where}: 提示的步是无效步`);
    r.chain = Math.max(r.chain, resolve(b, ev, where));
    b.endMove();
    if (b.boss) bossTurn(b, def);
    checkInvariants(b, `${where} 回合末`);
    const e = countEmpty(b);
    if (b.movesUsed <= M) { r.maxEmpty = Math.max(r.maxEmpty, e); if (e) r.emptyMoves++; if (e >= 5) r.bigEmpty++; }
    if (b.movesUsed === M && !b.won()) r.atM = b.goals.map((g) => Math.max(0, b.goalTarget(g) - b.goalProgress(g)));
    if (b.won()) break;
    if (!b.hasMoves()) {
      b.shuffle();
      if (b.movesUsed < M) r.shuffles++;
      checkInvariants(b, `${where} 洗牌`);
      if (b.findMatches().length) throw new Error(`${where}: 洗牌后有三连`);
      if (!b.hasMoves()) { r.stuck = b.movesUsed; break; }
    }
  }
  if (b.won()) {
    r.X = b.movesUsed;
    if (r.X <= M) { r.scoreWin = b.score; r.rate = b.score / r.X; bonusRound(b, M - r.X); r.score = b.score; }
  }
  return r;
}
if (!isMainThread) {
  parentPort.on('message', (t) => {
    const def = t.def, out = [];
    for (let s = t.from; s < t.to; s++) {
      const seed = 1000 + s + 7919 * t.k;
      try { out.push(playGame(def, seed)); } catch (e) { out.push({ seed, error: String(e?.message || e) }); }
    }
    parentPort.postMessage({ id: t.id, out });
  });
}

// ------------------------------------------------------------------ 关卡数据检查（主线程）
const ITEM_WORD = { brick: '城砖', book: '大典', silk: '丝绸', glaze: '琉璃', hehua: '荷花灯' };
const LAYER_WORD = { ink: /墨/, rope: /绳/, rubble: /碎砖|碎木|残瓦|碎石|瓦砾/, worm: /蠹/, lamp: /灯/, boss: /蠹/ };
function validate(id, def) {
  const P = [], W = def.w, H = def.h;
  const err = (m) => P.push(m);
  if (def.id !== id) err(`id 不一致 ${def.id}`);
  if (!def.name || def.name.length < 2 || def.name.length > 4) err(`name 应为 2–4 字：${def.name}`);
  if (!def.chapterName) err('缺 chapterName');
  if (!def.intro || def.intro.length > 28) err(`intro 超过 28 字（${def.intro?.length}）`);
  if (!def.say || def.say.length > 16) err(`say 超过 16 字（${def.say?.length}）`);
  if (!['level', 'level2'].includes(def.music)) err(`music 应为 level/level2：${def.music}`);
  if (!(W >= 5 && W <= 9 && H >= 5 && H <= 10)) err(`尺寸越界 ${W}×${H}`);
  if (!(def.colors >= 4 && def.colors <= 6)) err(`colors 应为 4–6：${def.colors}`);
  if (!(def.moves >= 5)) err('moves 缺失');
  const grid = (k, re) => {
    const g = def[k];
    if (!g) return;
    if (g.length !== H) err(`${k} 行数 ${g.length} ≠ ${H}`);
    g.forEach((row, y) => {
      if (row.length !== W) err(`${k} 第 ${y} 行长度 ${row.length} ≠ ${W}`);
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (re && ch !== '.' && ch !== ' ' && !re.test(ch)) err(`${k} (${x},${y}) 非法字符 '${ch}'`);
        if (k !== 'mask' && ch !== '.' && ch !== ' ' && def.mask && def.mask[y]?.[x] === ' ') err(`${k} (${x},${y}) 落在空洞上`);
      }
    });
  };
  grid('mask'); grid('ink', /[12]/); grid('rope', /[12]/); grid('rubble', /[123]/); grid('lamp', /./); grid('worm', /./); grid('tiles', /[0-5hvbsI]/);
  const at = (k, x, y) => { const ch = def[k]?.[y]?.[x]; return ch && ch !== '.' && ch !== ' '; };
  const play = (x, y) => !def.mask || def.mask[y]?.[x] !== ' ';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at('rubble', x, y) && at('worm', x, y)) err(`(${x},${y}) 碎砖和蠹重叠`);
    if (at('rope', x, y) && (at('rubble', x, y) || at('worm', x, y))) err(`(${x},${y}) 绳索压在障碍上`);
  }
  for (let x = 0; x < W; x++) {
    const ys = []; for (let y = 0; y < H; y++) if (play(x, y)) ys.push(y);
    if (!ys.length) continue;
    if (def.items && ys[ys.length - 1] - ys[0] + 1 !== ys.length) err(`物件关：第 ${x} 列中间有空洞，物件会卡住`);
    if (def.noSpawn) err('不要用 noSpawn');
  }
  const goals = def.goals || [];
  if (goals.length < 1 || goals.length > 3) err(`目标数 ${goals.length}`);
  const b = new Board(def, 1);
  const nums = (def.intro.match(/\d+/g) || []).map(Number);
  for (const g of b.goals) {
    if (g.type === 'color') { if (!(g.color < def.colors)) err(`颜色目标 ${g.color} 不在 ${def.colors} 色内`); if (!def.intro.includes(NAMES[g.color])) err(`intro 没提到 ${NAMES[g.color]}`); }
    if (g.type === 'item') {
      if (!def.items || def.items.kind !== g.item) err('物件目标与 items 不符');
      else if (g.n > def.items.total) err(`物件目标 ${g.n} > total ${def.items.total}`);
      if (!def.intro.includes(ITEM_WORD[g.item])) err(`intro 没提到 ${ITEM_WORD[g.item]}`);
    }
    if (['ink', 'rope', 'rubble', 'worm', 'lamp'].includes(g.type) && !(g.n > 0)) err(`${g.type} 目标但棋盘上没有`);
    if (LAYER_WORD[g.type] && !LAYER_WORD[g.type].test(def.intro)) err(`intro 没提到 ${g.type}`);
    if (g.type === 'boss' && !def.boss) err('boss 目标缺 boss 定义');
    if (['color', 'item', 'score'].includes(g.type) && !nums.includes(g.n)) err(`intro 数字与目标 ${g.type}=${g.n} 不符`);
  }
  for (const n of nums) if (!b.goals.some((g) => b.goalTarget(g) === n)) err(`intro 里的数字 ${n} 不对应任何目标`);
  return P;
}

// ------------------------------------------------------------------ 主线程：调度 + 汇总
/** 并行跑若干关（可以是临时变体），返回 { key: [单局记录...] }；jobs = [{ key, def, k }] */
export async function runGames(jobs, N, problems = []) {
  const tasks = [];
  const CH = Math.max(5, Math.ceil(N / 8));
  for (const j of jobs) for (let s = 0; s < N; s += CH) tasks.push({ key: j.key, def: j.def, k: j.k ?? 0, from: s, to: Math.min(N, s + CH) });
  const res = Object.fromEntries(jobs.map((j) => [j.key, []]));
  const nW = Math.max(1, Math.min(os.cpus().length - 2, tasks.length, 28));
  await new Promise((done) => {
    let next = 0, live = nW;
    for (let w = 0; w < nW; w++) {
      const wk = new Worker(new URL(import.meta.url));
      const busy = new Map();
      const feed = () => { if (next < tasks.length) { busy.set(wk, tasks[next]); wk.postMessage(tasks[next++]); } else { wk.terminate(); if (--live === 0) done(); } };
      wk.on('message', (m) => { res[busy.get(wk).key].push(...m.out); feed(); });
      wk.on('error', (e) => { problems.push(`worker 出错：${e.message}`); if (--live === 0) done(); });
      feed();
    }
  });
  return res;
}
/** 胜局所需步数的分位数（-1 = 上限内没赢） */
export function xQuant(rs, ps = [0.5, 0.8, 0.9, 0.95]) {
  const xs = rs.filter((r) => !r.error).map((r) => (r.X > 0 ? r.X : 999)).sort((a, b) => a - b);
  return ps.map((p) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]);
}
export { playGame, starsOf };
/** 建议的每步奖励：每步消除得分中位数 × 5，取整到 500 / 1000 */
export function suggestBonus(wins) {
  const rs = wins.map((r) => r.rate).filter((x) => x > 0).sort((a, b) => a - b);
  if (!rs.length) return 5000;
  const k = rs[Math.floor(rs.length / 2)] * 5;
  return Math.max(2000, k >= 10000 ? Math.round(k / 1000) * 1000 : Math.round(k / 500) * 500);
}
/** 省步一致率：任取两局胜局（剩步不同），剩步多的那局总分更高的比例 */
export function concordance(wins, M) {
  let ok = 0, tot = 0;
  for (const a of wins) for (const b of wins) {
    const la = M - a.X, lb = M - b.X;
    if (la > lb) { tot++; if (a.score > b.score) ok++; }
  }
  return tot ? (ok / tot) * 100 : 100;
}

async function main() {
  const N = Number(process.argv[2] || 200);
  const filt = process.argv[3];
  const ids = LEVEL_ORDER.filter((id) => !filt || filt.split(',').some((f) => id === f || id.startsWith(f)));
  const problems = [];
  if (new Set(LEVEL_ORDER).size !== LEVEL_ORDER.length) problems.push('LEVEL_ORDER 有重复');
  for (const id of LEVEL_ORDER) if (!LEVELS[id]) problems.push(`LEVELS 缺 ${id}`);
  for (const id of Object.keys(LEVELS)) if (!LEVEL_ORDER.includes(id)) problems.push(`LEVEL_ORDER 缺 ${id}`);
  for (const id of ids) for (const p of validate(id, LEVELS[id])) problems.push(`${id}: ${p}`);
  const t0 = Date.now();
  const res = await runGames(ids.map((id) => ({ key: id, def: LEVELS[id], k: LEVEL_ORDER.indexOf(id) })), N, problems);
  const nW = Math.min(os.cpus().length - 2, 28);
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  const q = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const gstr = (def) => def.goals.map((g) => g.type === 'color' ? `${NAMES[g.color]}${g.n}` : g.type === 'item' ? `${g.item}${g.n}` : g.type === 'boss' ? `boss${def.boss.hp}` : `${g.type}${new Board(def, 1).goals.find((x) => x.type === g.type).n}`).join('+');
  console.log('id     名称      尺寸   色 步  目标                    胜率   区间      瞄准  均用步(剩%)  ★3/★2/★1 %   每步奖励 建议   一致率  洗牌  卡死 建议步  所需步 p50/p80/p90/p95');
  const rows = [];
  for (const id of ids) {
    const def = LEVELS[id], M = def.moves, rs = res[id];
    for (const r of rs) if (r.error) problems.push(`${id}: ${r.error}`);
    const ok = rs.filter((r) => !r.error), n = ok.length;
    const wins = ok.filter((r) => r.X > 0 && r.X <= M);
    const st = [0, 0, 0, 0]; for (const r of wins) st[starsOf(M - r.X, M)]++;
    const used = wins.reduce((s, r) => s + r.X, 0) / (wins.length || 1);
    const [lo, hi] = rangeOf(id), aim = AIM[id];
    const winAt = (m) => pct(ok.filter((r) => r.X > 0 && r.X <= m).length, n);
    let sug = M, best = 1e9;
    for (let m = 5; m <= capOf(def); m++) { const d = Math.abs(winAt(m) - aim) + (winAt(m) < lo ? 50 : 0); if (d < best) { best = d; sug = m; } }
    const wr = pct(wins.length, n);
    const flag = wr < lo ? 'LOW ' : wr > hi ? 'HIGH' : ' ok ';
    const stuck = ok.filter((r) => r.stuck >= 0 && r.stuck < M).length, noStart = ok.filter((r) => r.noStartMove).length;
    const per = moveBonusOf(def), sugPer = suggestBonus(wins), conc = concordance(wins, M);
    const shuf = ok.reduce((s, r) => s + r.shuffles, 0) / (n || 1);
    const emptyAvg = ok.reduce((s, r) => s + r.emptyMoves, 0) / (n || 1) / M, maxEmpty = Math.max(0, ...ok.map((r) => r.maxEmpty));
    const bigAvg = ok.reduce((s, r) => s + r.bigEmpty, 0) / (n || 1) / M, empty90 = q(ok.map((r) => r.maxEmpty), 0.9);
    rows.push({ id, wr, used, st, n: wins.length });
    console.log(`${id.padEnd(6)} ${def.name.padEnd(4, '　')}  ${`${def.w}×${def.h}`.padEnd(5)} ${def.colors}  ${String(M).padStart(2)}  ${gstr(def).padEnd(22)} ${wr.toFixed(1).padStart(5)}% ${flag} ${`${lo}-${hi}`.padEnd(6)} ${String(aim).padStart(4)}  ${used.toFixed(1).padStart(4)} (${pct(M - used, M).toFixed(0).padStart(2)}%)   ${st.slice(1).reverse().map((v) => pct(v, wins.length).toFixed(0).padStart(3)).join('/')}   ${String(per).padStart(6)} ${String(sugPer).padStart(6)}  ${conc.toFixed(0).padStart(4)}%  ${shuf.toFixed(2)}  ${String(stuck + noStart).padStart(3)}   ${String(sug).padStart(3)}   ${xQuant(ok).join('/')}`);
    // 输局瓶颈：到步数用完时各目标还差多少
    const losses = ok.filter((r) => r.atM);
    if (losses.length && def.goals.length > 1) {
      const miss = def.goals.map((g, k) => { const L = losses.filter((r) => r.atM[k] > 0); return `${g.type}${g.color ?? ''}:${pct(L.length, losses.length).toFixed(0)}%(差${(L.reduce((s, r) => s + r.atM[k], 0) / (L.length || 1)).toFixed(1)})`; });
      console.log(`         输局时未完成 → ${miss.join('  ')}`);
    }
    if (maxEmpty > 2 || emptyAvg > 0.25) console.log(`         注意：落不下棋子的空格 最多 ${maxEmpty} 格（90% 的局 ≤ ${empty90} 格），${(emptyAvg * 100).toFixed(1)}% 的回合有空格，${(bigAvg * 100).toFixed(1)}% 的回合 ≥5 格`);
    if (!def.bonus) problems.push(`${id}: 缺 bonus（每步奖励），建议 ${sugPer}`);
    else if (Math.abs(per - sugPer) / sugPer > 0.25) console.log(`         bonus：现 ${per} → 建议 ${sugPer}（每步消除得分中位数 × 5）`);
    if (wins.length >= 20 && conc < 90) problems.push(`${id}: 省步一致率只有 ${conc.toFixed(0)}%（剩步多的局总分反而低），调大 bonus`);
    if (noStart) problems.push(`${id}: ${noStart} 局开局无步可走`);
    if (stuck) problems.push(`${id}: ${stuck} 局洗牌后仍无步可走（卡死）`);
  }
  console.log(`\n共 ${ids.length} 关 × ${N} 局，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s，${nW} 线程`);
  if (problems.length) { console.log(`\n问题 ${problems.length} 条：`); for (const p of problems.slice(0, 60)) console.log('  ✗ ' + p); process.exitCode = 1; }
  else console.log('不变量与关卡数据检查全部通过。');
}
if (isMainThread && import.meta.url === pathToFileURL(process.argv[1]).href) main();
