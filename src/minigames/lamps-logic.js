// 点灯 · 纯逻辑（可在 node 里单独验证）
// 八盏灯围成一圈：点第 i 盏 → 它和左右两盏翻转；带金链的灯还会带动链子另一头的灯。
export const N = 8;
export const FULL = (1 << N) - 1;
export const bit = (i) => 1 << (((i % N) + N) % N);
export const popcount = (x) => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };

/**
 * 规则：links = [[a,b], ...] 金链相连的灯对。
 * 注意：若八盏灯全部与对面相连，翻转矩阵在 GF(2) 上不可逆（核有 4 个元素，最少步数最多只有 4），
 * 所以第九层只用两道相邻的金链（0↔4、1↔5）——此时矩阵可逆，每个局面都有唯一解。
 */
export function buildRule(links = []) {
  const partner = new Array(N).fill(-1);
  for (const [a, b] of links) { partner[a] = b; partner[b] = a; }
  const tog = [];
  for (let i = 0; i < N; i++) {
    let m = bit(i - 1) | bit(i) | bit(i + 1);
    if (partner[i] >= 0) m |= bit(partner[i]);
    tog.push(m);
  }
  // 穷举 2^8 种按法：effect → 最少按法
  const best = new Array(1 << N).fill(-1);
  for (let s = 0; s < 1 << N; s++) {
    let e = 0;
    for (let i = 0; i < N; i++) if ((s >> i) & 1) e ^= tog[i];
    if (best[e] < 0 || popcount(s) < popcount(best[e])) best[e] = s;
  }
  const reachable = best.filter((v) => v >= 0).length;
  return {
    tog, partner, links, reachable,
    /** 从 state 点亮全部灯的最少按法（位掩码），无解返回 -1 */
    solve: (state) => best[state ^ FULL],
    dist: (state) => { const s = best[state ^ FULL]; return s < 0 ? 99 : popcount(s); },
  };
}

/** 从全亮状态随机按 minLen 盏（不重复）生成题目；保证最少步数恰为 minLen */
export function genPuzzle(rule, minLen, R) {
  const idx = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let tries = 0; tries < 2000; tries++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let state = FULL;
    for (const i of idx.slice(0, minLen)) state ^= rule.tog[i];
    if (state === FULL) continue;
    if (rule.dist(state) !== minLen) continue;
    const dark = N - popcount(state);
    if (dark < 2 || dark > 7) continue;
    return state;
  }
  // 兜底：只保证可解
  let state = FULL;
  for (let i = 0; i < minLen; i++) state ^= rule.tog[(i * 3) % N];
  return state === FULL ? (FULL ^ rule.tog[0]) : state;
}

export const STOREYS = [
  { floor: 1, name: '第一层', min: [2, 3], links: [] },
  { floor: 5, name: '第五层', min: [3, 4], links: [] },
  { floor: 9, name: '第九层', min: [4, 5], links: [[0, 4], [1, 5]] },
];
