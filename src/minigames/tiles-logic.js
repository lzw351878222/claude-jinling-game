// 转瓦 · 纯逻辑（可在 node 里单独验证）
// 每块瓦的纹样用四个方向位表示：北 1、东 2、南 4、西 8。点一下顺时针转 90°。
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const BIT = [1, 2, 4, 8];
export const OPP = [2, 3, 0, 1];

export const rotCW = (m, k = 1) => {
  k = ((k % 4) + 4) % 4;
  for (let i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};
export const period = (m) => (rotCW(m, 1) === m ? 1 : rotCW(m, 2) === m ? 2 : 4);
export const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);

/** 规范纹样：尽头 1、直 5、弯 3、丁字 7、十字 15；TYPE_OF[m] = [规范纹样, 顺转次数] */
export const CANON = [1, 5, 3, 7, 15];
export const TYPE_OF = (() => {
  const t = new Array(16).fill(null);
  for (const c of CANON) for (let k = 0; k < 4; k++) { const m = rotCW(c, k); if (!t[m]) t[m] = [c, k]; }
  return t;
})();

export const LEVELS = {
  normal: [
    { cols: 4, rows: 4, mask: null, loops: 0, motif: 'elephant', glaze: 'green', time: 100 },
    { cols: 5, rows: 5, mask: null, loops: 1, motif: 'goat', glaze: 'blue', time: 160 },
    { cols: 6, rows: 5, mask: ['.XXXX.', 'XXXXXX', 'XXXXXX', 'XX..XX', 'XX..XX'], loops: 2, motif: 'apsara', glaze: 'mixed', time: 230, arch: true },
  ],
  easy: [
    { cols: 3, rows: 3, mask: null, loops: 0, motif: 'elephant', glaze: 'green', time: 120 },
    { cols: 4, rows: 4, mask: null, loops: 0, motif: 'goat', glaze: 'blue', time: 180 },
    { cols: 5, rows: 4, mask: ['.XXX.', 'XXXXX', 'XX.XX', 'XX.XX'], loops: 1, motif: 'apsara', glaze: 'mixed', time: 240, arch: true },
  ],
};

/**
 * 生成一关：随机 Prim 生成树（+ 少量回路）→ 必然有解；再随机转乱（保证不是已解状态）。
 * 返回 { cols, rows, n, inMask(i), cells[], sol[], rot[], source, par }
 * sol[i]：正解纹样；rot[i]：打乱时顺转的次数（玩家每点一次 rot[i] 再 +1）。
 */
export function generate(level, R) {
  const { cols, rows } = level;
  const n = cols * rows;
  const ok = new Array(n).fill(false);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) ok[y * cols + x] = !level.mask || level.mask[y][x] === 'X';
  const cells = [];
  for (let i = 0; i < n; i++) if (ok[i]) cells.push(i);
  const nb = (i, d) => {
    const x = (i % cols) + DX[d], y = Math.floor(i / cols) + DY[d];
    if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
    const j = y * cols + x;
    return ok[j] ? j : -1;
  };
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const sol = new Array(n).fill(0);
    const inTree = new Array(n).fill(false);
    const start = cells[Math.floor(R() * cells.length)];
    inTree[start] = true;
    const frontier = [];
    const pushEdges = (i) => { for (let d = 0; d < 4; d++) { const j = nb(i, d); if (j >= 0 && !inTree[j]) frontier.push([i, d, j]); } };
    pushEdges(start);
    let count = 1;
    while (frontier.length) {
      // 随机取一条边；若出发块已是三通，最多重抽三次（尽量不出十字）
      let k = Math.floor(R() * frontier.length);
      for (let r = 0; r < 3 && bits(sol[frontier[k][0]]) >= 3; r++) k = Math.floor(R() * frontier.length);
      const [i, d, j] = frontier[k];
      frontier[k] = frontier[frontier.length - 1]; frontier.pop();
      if (inTree[j]) continue;
      sol[i] |= BIT[d]; sol[j] |= BIT[OPP[d]];
      inTree[j] = true; count++;
      pushEdges(j);
    }
    if (count !== cells.length) continue;
    // 额外回路
    let loops = level.loops || 0, guard = 0;
    while (loops > 0 && guard++ < 200) {
      const i = cells[Math.floor(R() * cells.length)], d = Math.floor(R() * 4), j = nb(i, d);
      if (j < 0 || (sol[i] & BIT[d])) continue;
      if (bits(sol[i]) >= 3 || bits(sol[j]) >= 3) continue;
      sol[i] |= BIT[d]; sol[j] |= BIT[OPP[d]];
      loops--;
    }
    // 质量：十字最多 1 个；尽头（莲花）至少 2 个；直+十字（不太需要思考的块）不超过三成
    const crosses = cells.filter((i) => sol[i] === 15).length;
    const ends = cells.filter((i) => bits(sol[i]) === 1).length;
    const dull = cells.filter((i) => sol[i] === 5 || sol[i] === 10 || sol[i] === 15).length;
    const score = (crosses > 1 ? 10 : 0) + (ends < 2 ? 10 : 0) + Math.max(0, dull - cells.length * 0.3);
    if (!best || score < best.score) best = { sol, score };
    if (score === 0) break;
  }
  const sol = best.sol;
  // 源头：优先选中间偏上、至少两通的块（拱门取拱心）
  let source = -1, bestD = 1e9;
  const cx = (cols - 1) / 2, cy = level.arch ? 0 : (rows - 1) / 2;
  for (const i of cells) {
    const x = i % cols, y = Math.floor(i / cols);
    const d = Math.hypot(x - cx, (y - cy) * 1.1) - (bits(sol[i]) >= 2 ? 0.6 : 0) + (x < cx ? 0.01 : 0);
    if (d < bestD) { bestD = d; source = i; }
  }
  // 打乱
  const rot = new Array(n).fill(0);
  for (let tries = 0; tries < 100; tries++) {
    for (const i of cells) {
      const p = period(sol[i]);
      rot[i] = p === 1 ? 0 : (R() < 0.82 ? 1 + Math.floor(R() * 3) : 0);
    }
    const needed = cells.filter((i) => rotCW(sol[i], rot[i]) !== sol[i]).length;
    const puzzle = { cols, rows, n, ok, cells, sol, rot, source };
    if (needed >= Math.max(2, Math.ceil(cells.length * 0.6)) && !analyze(puzzle, current(puzzle)).solved) break;
  }
  const puzzle = { cols, rows, n, ok, cells, sol, rot: rot.slice(), source, nb };
  puzzle.par = parOf(puzzle, puzzle.rot);
  return puzzle;
}

/** 当前纹样 */
export function current(p, rot = p.rot) {
  const cur = new Array(p.n).fill(0);
  for (const i of p.cells) cur[i] = rotCW(p.sol[i], rot[i]);
  return cur;
}

/** 回到正解最少还要点几下（只顺转） */
export function parOf(p, rot) {
  let s = 0;
  for (const i of p.cells) { const per = period(p.sol[i]); s += ((4 - (rot[i] % 4)) % 4) % per; }
  return s;
}

/** 检查：每个口都接上、不出界、全部与源头连通 */
export function analyze(p, cur) {
  const { cols, rows, ok } = p;
  const nbr = (i, d) => {
    const x = (i % cols) + DX[d], y = Math.floor(i / cols) + DY[d];
    if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
    const j = y * cols + x;
    return ok[j] ? j : -1;
  };
  let loose = 0;
  for (const i of p.cells) for (let d = 0; d < 4; d++) {
    if (!(cur[i] & BIT[d])) continue;
    const j = nbr(i, d);
    if (j < 0 || !(cur[j] & BIT[OPP[d]])) loose++;
  }
  const depth = new Array(p.n).fill(-1);
  depth[p.source] = 0;
  const q = [p.source];
  while (q.length) {
    const i = q.shift();
    for (let d = 0; d < 4; d++) {
      if (!(cur[i] & BIT[d])) continue;
      const j = nbr(i, d);
      if (j < 0 || depth[j] >= 0 || !(cur[j] & BIT[OPP[d]])) continue;
      depth[j] = depth[i] + 1;
      q.push(j);
    }
  }
  const reached = p.cells.filter((i) => depth[i] >= 0).length;
  return { solved: loose === 0 && reached === p.cells.length, loose, reached, depth };
}
