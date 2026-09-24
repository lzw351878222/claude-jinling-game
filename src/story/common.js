// 各章剧本共用的小工具
import { EMIT } from '../engine/particles.js';

/** 在若干位置放出小蠹（银灰色的蠹鱼），返回它们的 id */
export function spawnWorms(D, spots, prefix = 'worm') {
  const ids = [];
  spots.forEach(([x, z], i) => {
    const id = `${prefix}${i}`;
    if (D.g.actor(id)) return;
    D.spawn({ id, name: '蠹', look: 'worm', x, z, dir: 'down', solid: false, noTurn: true, wander: [x - 1.2, z - 0.8, x + 1.2, z + 0.8], speed: 1.6, voice: 'monster' });
    ids.push(id);
  });
  return ids;
}
/** 驱散场上所有小蠹（一阵烟） */
export function clearWorms(D, prefix = 'worm') {
  for (const [id, a] of [...D.g.actors]) {
    if (!id.startsWith(prefix)) continue;
    D.g.puff(a.pos, { x: 0.6, y: 0.5, z: 0.6 }, '#c9ced6');
    D.remove(id);
  }
}
/** 阿麟入队：场景里若已有同名角色则先移除 */
export function alingJoin(D) {
  D.flag('alingJoined');
  const old = D.g.actor('aling');
  if (old && !D.g.follower) D.remove('aling');
  if (!D.g.follower) D.g.spawnFollower();
}
/** 阿麟在剧情里单独出现（非跟随） */
export function alingAt(D, x, z) {
  if (D.g.follower) { const f = D.g.follower; f.pos.x = x; f.pos.z = z; return f; }
  return D.spawn({ id: 'aling', name: '阿麟', sprite: 'qilin', look: 'qilin', x, z, float: 1.05, solid: false, voice: 'qilin', noTurn: true });
}
/** 常用粒子 */
export const FX = EMIT;
/** 看板娘式的小提示：在清单旁边闪一下 */
export function hint(D, text) { D.ui.toast(text, { icon: '麟', label: '阿麟', kind: 'jade', dur: 3600 }); }

/** 用函数生成字符地图：grid(w, h, (x, z) => 字符) */
export function grid(w, h, fn) {
  const rows = [];
  for (let z = 0; z < h; z++) { let r = ''; for (let x = 0; x < w; x++) r += fn(x, z) || ','; rows.push(r); }
  return rows;
}
