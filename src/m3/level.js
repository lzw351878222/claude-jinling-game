// 消消乐关卡流程：连接逻辑（Board）、视图（BoardView）、界面（LevelUI）与控制器
import { Board } from './logic.js';
import { BoardView } from './view.js';
import { LevelUI } from './level-ui.js';
import { Controller } from './controller.js';

let active = null;
export const isLevelActive = () => !!active;

/**
 * 玩一关，直到过关或玩家离开。
 * @param {object} def 关卡定义（见 levels.js）
 * @param {object} opts { seed, bg, dim, music, tools: { hammer, free } }
 * @returns {Promise<{ win, stars, score, movesLeft, quit }>}
 */
export async function playLevel(def, opts = {}) {
  let seed = (opts.seed ?? Date.now()) >>> 0;
  let attempt = 0;
  for (;;) {
    attempt++;
    const res = await runOnce(def, seed, { ...opts, attempt });
    if (res.result === 'retry') { seed = (seed + 7919) >>> 0; continue; }
    return { ...res, attempts: attempt };
  }
}

function runOnce(def, seed, opts) {
  return new Promise((resolve) => {
    const board = new Board(def, seed);
    const ui = new LevelUI(def, board);
    active = ui;
    if (opts.bg) ui.setBg(opts.bg, opts.dim ?? 0.45);
    let ctl = null;
    const view = new BoardView(ui.canvas, board, { onSwap: (a, b) => ctl?.swap(a, b) });
    ctl = new Controller(def, board, view, ui, opts);
    if (typeof __DEV__ !== 'undefined' && __DEV__) window.__m3 = { board, view, ctl, ui };
    const onResize = () => { const r = ui.stage.getBoundingClientRect(); view.resize(r.width, r.height); };
    ctl.finish = (r) => {
      ctl.alive = false;
      window.removeEventListener('resize', onResize);
      ui.destroy();
      active = null;
      resolve(r);
    };
    window.addEventListener('resize', onResize);
    requestAnimationFrame(() => { onResize(); ctl.start(); });
  });
}
