// 关卡开始卡 / 结算卡
import { el, html } from '../core/util.js';
import { audio } from '../core/audio.js';
import { goalIcon, goalName } from './art.js';
import { starLine, moveBonusOf } from './logic.js';

export const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
/** "省步有赏"的规则说明（开始卡、结算卡共用） */
function ruleLine(parent, def) {
  html('div', 'm3-card-rule', parent,
    `<span>剩 <b>${starLine(def.moves || 20)}</b> 步以上过关 <i>★★★</i></span><span>每省一步 <b>+${fmtNum(moveBonusOf(def))}</b> 分</span>`);
}

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
  ruleLine(c, def);
  const act = el('div', 'mg-actions', c);
  const go = el('button', 'jl-btn primary', act, '开 始');
  audio.sfx('open');
  await waitButton([{ el: go, v: true }]);
  m.remove();
}

/**
 * 结算卡：星级 + 分数明细（消除得分 + 余步奖励 = 总分）
 * @param {{ stars, used, left, per, matchScore, total, helped }} r
 */
export async function winCard(root, def, r) {
  const { m, c } = card(root);
  c.classList.add('win');
  html('div', 'm3-card-sub', c, def.chapterName || '');
  el('h2', 'jl-title', c, '踪迹已复原');
  const st = el('div', 'm3-stars', c);
  for (let k = 0; k < 3; k++) {
    const s = el('span', 'm3-bigstar' + (k < r.stars ? ' on' : ''), st, '★');
    s.style.animationDelay = `${0.3 + k * 0.28}s`;
    if (k < r.stars) setTimeout(() => audio.sfx('star', { note: 4 + k * 2 }), 300 + k * 280);
  }
  html('div', 'm3-card-moves', c, r.helped
    ? `用了 <b>${r.used}</b> 步（借了阿麟五步）`
    : `用了 <b>${r.used}</b> 步 · 省下 <b>${r.left}</b> 步`);
  const tb = el('div', 'm3-card-score', c);
  const row = (k, v, cls = '') => html('div', 'm3-score-row ' + cls, tb, `<span>${k}</span><b>${v}</b>`);
  row('消除得分', fmtNum(r.matchScore));
  row('余步奖励', r.left ? `${r.left} 步 × ${fmtNum(r.per)} = ${fmtNum(r.left * r.per)}` : (r.helped ? '借步过关不计' : '0'));
  row('总　分', fmtNum(r.total), 'total');
  if (r.stars < 3) {
    const need = starLine(def.moves || 20);
    html('div', 'm3-card-tip', c, r.helped
      ? '下次试试不借步过关：省下的步数越多，星越多、分越高。'
      : `省下 <b>${need}</b> 步以上过关就是三星——少走一步，就多一份余步奖励。`);
  }
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
