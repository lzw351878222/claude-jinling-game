// 消消乐关卡调试页：/m3-test.html?l=<关卡id>
import { playLevel } from '../m3/level.js';
import { audio } from '../core/audio.js';

const DEMO = {
  id: 'demo', name: '试炼', chapterName: '调试 · 消消乐', intro: '消掉 20 个灯笼，擦去墨渍。', say: '来吧！',
  w: 8, h: 9, moves: 25, colors: 5,
  ink: ['........', '........', '..1111..', '..1221..', '..1221..', '..1111..', '........', '........', '........'],
  rubble: ['........', '........', '........', '........', '........', '........', '1......1', '........', '........'],
  goals: [{ type: 'color', color: 0, n: 20 }, { type: 'ink' }], bonus: 6000,
};
const BOSS = { ...DEMO, id: 'boss', name: '遗忘之蠹', goals: [{ type: 'boss' }], boss: { hp: 120, every: 3, acts: ['ink', 'worm'], power: 2 }, ink: null, rubble: null };

(async () => {
  await document.fonts.load('40px JLBrush').catch(() => {});
  const q = new URLSearchParams(location.search);
  let def = q.get('l') === 'boss' ? BOSS : DEMO;
  try { const m = await import('../m3/levels.js'); if (m.LEVELS?.[q.get('l')]) def = m.LEVELS[q.get('l')]; } catch { /* 关卡表尚未生成 */ }
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  if (q.get('auto')) setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' })), 600);
  const r = await playLevel(def, { seed: Number(q.get('seed') || 1) });
  console.log('LEVEL_RESULT', JSON.stringify(r));
  document.title = 'done';
})();
