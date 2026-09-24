// 消消乐逻辑自动化测试：node tools/m3-sim.mjs [局数]
// 用"提示"策略自动下棋，检查不变量：重力后无空格、id 唯一、无死循环、死局会洗牌、目标可达成。
import { Board } from '../src/m3/logic.js';

const N = Number(process.argv[2] || 300);
const defs = [
  { name: '基础', w: 8, h: 8, colors: 5, moves: 30, goals: [{ type: 'color', color: 0, n: 25 }] },
  { name: '6色', w: 8, h: 9, colors: 6, moves: 30, goals: [{ type: 'score', n: 8000 }] },
  { name: '墨渍', w: 8, h: 8, colors: 5, moves: 30, ink: ['........', '..1111..', '.122221.', '.122221.', '.122221.', '.122221.', '..1111..', '........'], goals: [{ type: 'ink' }] },
  { name: '碎砖+洞', w: 8, h: 9, colors: 5, moves: 35, mask: ['........', '........', '..    ..', '........', '........', '........', '........', '........', '........'], rubble: ['........', '........', '........', '..3..3..', '........', '........', '1......1', '11....11', '........'], goals: [{ type: 'rubble' }] },
  { name: '绳索', w: 8, h: 8, colors: 5, moves: 30, rope: ['........', '........', '.11..11.', '.1....1.', '.1....1.', '.11..11.', '........', '........'], goals: [{ type: 'rope' }] },
  { name: '蠹', w: 8, h: 8, colors: 5, moves: 35, worm: ['........', '........', '........', '...11...', '...11...', '........', '........', '........'], goals: [{ type: 'worm' }] },
  { name: '运砖', w: 8, h: 9, colors: 5, moves: 35, items: { kind: 'brick', total: 4, max: 2, start: 2, rate: 0.25 }, goals: [{ type: 'item', item: 'brick', n: 4 }] },
  { name: '点灯', w: 9, h: 9, colors: 5, moves: 32, lamp: ['.........', '.1111111.', '.1.....1.', '.1.111.1.', '.1.1.1.1.', '.1.111.1.', '.1.....1.', '.1111111.', '.........'], goals: [{ type: 'lamp' }] },
  { name: 'Boss', w: 8, h: 8, colors: 5, moves: 40, boss: { hp: 150 }, goals: [{ type: 'boss' }] },
];

function checkInvariants(b, where) {
  const ids = new Set();
  for (const c of b.cells) {
    if (c.tile) {
      if (!b.canHold(c)) throw new Error(`${where}: 不可容纳的格子上有棋子 (${c.x},${c.y})`);
      if (ids.has(c.tile.id)) throw new Error(`${where}: 重复 id ${c.tile.id}`);
      ids.add(c.tile.id);
    }
  }
}
function checkFull(b, where) {
  for (const c of b.cells) {
    if (!b.canHold(c) || c.tile) continue;
    // 允许：上方被永久挡住且斜向也拿不到（极少数布局）
    if (b.canReceiveFromAbove(c.x, c.y)) throw new Error(`${where}: 重力后仍有空格 (${c.x},${c.y})`);
  }
}

let wins = 0, games = 0, shuffles = 0, totalMoves = 0, cascadesMax = 0;
const perDef = {};
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const def = defs[g % defs.length];
  const b = new Board(def, 1000 + g);
  checkInvariants(b, `${def.name} 开局`);
  if (b.findMatches().length && !def.tiles) throw new Error(`${def.name}: 开局就有三连`);
  games++;
  let moves = 0;
  while (!b.won() && !b.lost() && moves < 200) {
    if (!b.hasMoves()) { b.shuffle(); shuffles++; checkInvariants(b, `${def.name} 洗牌`); if (b.findMatches().length) throw new Error('洗牌后有三连'); }
    const h = b.findHint();
    if (!h) throw new Error(`${def.name}: 有步却找不到提示`);
    const [a, c] = h;
    b.doSwap(a, c);
    let ev = b.afterSwap(a, c);
    if (!ev) throw new Error(`${def.name}: 提示的步是无效步`);
    let step = 1, guard = 0;
    while (ev && guard++ < 100) {
      b.gravity();
      checkInvariants(b, `${def.name} 重力`);
      b.collectItems();
      b.gravity();
      checkFull(b, `${def.name} 补充`);
      step++;
      ev = b.cascade(step);
    }
    if (guard >= 100) throw new Error('连锁无限循环');
    cascadesMax = Math.max(cascadesMax, step);
    if (b.boss && b.movesUsed % 3 === 2) { b.bossAct(b.movesUsed % 2 ? 'ink' : 'worm', 2); }
    b.endMove();
    checkInvariants(b, `${def.name} 回合末`);
    moves++;
  }
  totalMoves += moves;
  const won = b.won();
  if (won) wins++;
  perDef[def.name] = perDef[def.name] || { games: 0, wins: 0, moves: 0 };
  perDef[def.name].games++; perDef[def.name].moves += moves; if (won) perDef[def.name].wins++;
}
console.log(`局数 ${games}，胜 ${wins}（${(wins / games * 100).toFixed(0)}%），平均步数 ${(totalMoves / games).toFixed(1)}，洗牌 ${shuffles} 次，最长连锁 ${cascadesMax}，用时 ${Date.now() - t0}ms`);
for (const [k, v] of Object.entries(perDef)) console.log(`  ${k.padEnd(6)} 胜率 ${(v.wins / v.games * 100).toFixed(0).padStart(3)}%  平均用步 ${(v.moves / v.games).toFixed(1)}`);
