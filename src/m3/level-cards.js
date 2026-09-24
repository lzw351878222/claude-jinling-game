// 关卡开始卡 / 结算卡
import { el, html } from '../core/util.js';
import { audio } from '../core/audio.js';
import { goalIcon, goalName } from './art.js';

function card(root) {
  const m = el('div', 'm3-modal', root);
  const c = el('div', 'm3-card jl-panel', m);
  return { m, c };
}
function goalRow(parent, board) {
  const row = el('div', 'm3-card-goals', parent);
  for (const g of board.goals) {
    const d = el('div', 'm3-card-goal', row);
    const cv = el('canvas', '', d);
    cv.width = cv.height = 72;
    cv.getContext('2d').drawImage(goalIcon(g, 72), 0, 0);
    const n = g.type === 'boss' ? '' : `×${board.goalTarget(g)}`;
    html('div', '', d, `<b>${goalName(g)}</b>${n ? `<span>${n}</span>` : ''}`);
  }
}
function waitButton(btns) {
  return new Promise((resolve) => {
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); done(btns[0].v); }
    };
    const done = (v) => { window.removeEventListener('keydown', onKey); resolve(v); };
    for (const b of btns) b.el.onclick = () => { audio.sfx('button'); done(b.v); };
    setTimeout(() => window.addEventListener('keydown', onKey), 300);
  });
}

export async function introCard(root, def, board) {
  const { m, c } = card(root);
  html('div', 'm3-card-sub', c, def.chapterName || '');
  el('h2', 'jl-title', c, def.name || '寻踪');
  if (def.intro) el('div', 'm3-card-text', c, def.intro);
  goalRow(c, board);
  html('div', 'm3-card-moves', c, def.boss ? `步数 <b>${board.moves}</b> · 击退遗忘之蠹` : `步数 <b>${board.moves}</b>`);
  const act = el('div', 'mg-actions', c);
  const go = el('button', 'jl-btn primary', act, '开 始');
  audio.sfx('open');
  await waitButton([{ el: go, v: true }]);
  m.remove();
}

export async function winCard(root, def, board, stars) {
  const { m, c } = card(root);
  c.classList.add('win');
  html('div', 'm3-card-sub', c, def.chapterName || '');
  el('h2', 'jl-title', c, '踪迹已复原');
  const st = el('div', 'm3-stars', c);
  for (let k = 0; k < 3; k++) {
    const s = el('span', 'm3-bigstar' + (k < stars ? ' on' : ''), st, '★');
    s.style.animationDelay = `${0.3 + k * 0.28}s`;
    if (k < stars) setTimeout(() => audio.sfx('star', { note: 4 + k * 2 }), 300 + k * 280);
  }
  html('div', 'm3-card-moves', c, `得分 <b>${board.score}</b>`);
  if (def.outro) el('div', 'm3-card-text', c, def.outro);
  const act = el('div', 'mg-actions', c);
  const go = el('button', 'jl-btn primary', act, '继 续');
  await waitButton([{ el: go, v: 'ok' }]);
  m.remove();
}

export async function loseCard(root, def, board, canHelp) {
  const { m, c } = card(root);
  el('h2', 'jl-title', c, '步数用完了');
  el('div', 'm3-card-text', c, canHelp ? '阿麟摇了摇尾巴：「我还能借你五步，要不要？」' : '差一点点。换个思路，再来一次吧。');
  goalRow(c, board);
  const act = el('div', 'mg-actions', c);
  const btns = [];
  if (canHelp) btns.push({ el: el('button', 'jl-btn primary', act, '借五步'), v: 'help' });
  btns.push({ el: el('button', 'jl-btn' + (canHelp ? ' ghost' : ' primary'), act, '重新开始'), v: 'retry' });
  btns.push({ el: el('button', 'jl-btn ghost', act, '暂且离开'), v: 'quit' });
  const v = await waitButton(btns);
  m.remove();
  return v;
}

export async function confirmQuit(root) {
  const { m, c } = card(root);
  el('h2', 'jl-title', c, '暂且离开？');
  el('div', 'm3-card-text', c, '本关进度不会保留，随时可以回来重新挑战。');
  const act = el('div', 'mg-actions', c);
  const a = el('button', 'jl-btn primary', act, '离开');
  const b = el('button', 'jl-btn ghost', act, '继续');
  const v = await waitButton([{ el: b, v: false }, { el: a, v: true }]);
  m.remove();
  return v;
}
