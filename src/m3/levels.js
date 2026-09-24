// 消消乐关卡表：LEVELS[id] → 关卡定义，LEVEL_ORDER 为通关顺序。
//
// 关卡定义字段（Board 构造函数 + 关卡界面使用）：
//   id, name（2–4 字标题）, chapterName, intro（≤28 字，须与目标一致）, say（康晔开场白 ≤16 字）
//   music: 'level' | 'level2'
//   w ≤ 9, h ≤ 10, moves, colors（4–6）
//   mask: 行字符串，' ' = 空洞，其它字符 = 可玩格（可选）
//   ink / rope / rubble / lamp / worm: 行字符串，数字 = 层数（墨 1–2、绳 1–2、碎砖 1–3），'.' = 无
//   items: { kind, total, start, rate, max }  需要落到每列最底可玩格的物件
//   tiles: 预设棋子（教程用）'0'-'5' 颜色，'.' 随机
//   goals: 1–3 个；ink/rope/rubble/worm/lamp 的数量由棋盘自动统计
//   star3: 分数条满格的分数（≈ 机器人胜局得分的 75 分位，含结算奖励）
//   boss: { hp, every, acts, power }  仅终章
//
// 难度校准：node tools/m3-levels-sim.mjs [每关局数=200] [关卡id或前缀]
import { LEVELS_A } from './levels-a.js';
import { LEVELS_B } from './levels-b.js';
import { LEVELS_C } from './levels-c.js';

export const LEVEL_ORDER = [
  'p1', 'p2',
  'c1-1', 'c1-2', 'c1-3', 'c1-4', 'c1-5',
  'c2-1', 'c2-2', 'c2-3', 'c2-4', 'c2-5',
  'c3-1', 'c3-2', 'c3-3', 'c3-4', 'c3-5', 'c3-6',
  'c4-1', 'c4-2', 'c4-3', 'c4-4', 'c4-5',
  'c5-1', 'c5-2', 'c5-3', 'c5-4', 'c5-5', 'c5-6',
  'final',
];

export const LEVELS = Object.fromEntries([...LEVELS_A, ...LEVELS_B, ...LEVELS_C].map((d) => [d.id, d]));
