// 小游戏宿主：统一的外框、说明页、结算页、重试/跳过逻辑。
//
// ── 小游戏模块约定 ───────────────────────────────────────────────
// export default {
//   id: 'kiln',
//   title: '窑火',                 // 标题（书法字体显示）
//   subtitle: '烧出一窑青砖',       // 副标题
//   rules: ['规则一', '规则二'],     // 说明页的要点
//   controls: '鼠标 / 触屏 / 空格',  // 可选：操作提示
//   async play(ctx, opts) { ...; return { success, score, perfect, note } }
// }
// play() 只负责玩法本身；说明页、结算页、重试都由宿主处理。
// play() 可以 throw / 被 ctx.signal 中止（玩家点了关闭）。
//
// ── ctx ─────────────────────────────────────────────────────────
// ctx.root        舞台 DOM 容器（position:relative，填满可用区域）
// ctx.w / ctx.h   舞台尺寸（CSS px），ctx.onResize(cb) 监听变化，返回取消函数
// ctx.dpr         设备像素比（最多 2）
// ctx.isTouch     是否触屏设备
// ctx.sfx(name, opts)  播放音效
// ctx.loop(fn)    启动 rAF 循环 fn(dt, t)，dt 秒（≤0.05），返回 stop()
// ctx.wait(ms)    Promise 延时（被中止时 reject）
// ctx.el(tag, cls, parent, text)   创建元素（parent 默认 ctx.root）
// ctx.canvas(parent?)  在 parent（默认 ctx.root）里建一张铺满的高清画布 → { canvas, g, w, h, resize() }
// ctx.toast(text, kind)  舞台中央浮字（'good' | 'bad' | 'gold' | undefined）
// ctx.hud({ center, right })  设置顶部信息栏（HTML 字符串）
// ctx.keys.isDown(code) / ctx.keys.onDown(fn(code, e)) → off
// ctx.assets      图片素材 URL（康晔立绘等）
// ctx.signal      AbortSignal：宿主关闭时触发
// ctx.difficulty  1 = 正常；0 = 简单（连续失败后自动降低）
// ctx.attempt     第几次尝试（从 1 开始）
import { el, html, sleep, isTouchDevice } from '../core/util.js';
import { audio } from '../core/audio.js';
import { ASSETS } from '../assets.js';

let active = null;
export const isMinigameActive = () => !!active;

/**
 * 运行一个小游戏，返回 { success, score, perfect, skipped, quit }
 * @param {object} game 小游戏模块
 * @param {object} opts 传给 play 的参数；opts.allowSkip=false 可以禁止跳过
 */
export async function runMinigame(game, opts = {}) {
  if (active) throw new Error('已有小游戏在运行');
  const root = document.getElementById('ui') || document.body;
  const overlay = el('div', 'mg-overlay', root);
  const frame = el('div', 'mg-frame', overlay);
  const hud = el('div', 'mg-hud', frame);
  const hudLeft = html('div', 'mg-hud-left', hud, `${game.title}${game.subtitle ? `<small>${game.subtitle}</small>` : ''}`);
  const hudCenter = el('div', 'mg-hud-center', hud);
  const hudRightWrap = el('div', 'mg-hud-right', hud);
  const hudRight = el('span', '', hudRightWrap);
  const closeBtn = el('button', 'mg-close', hudRightWrap, '×');
  closeBtn.title = '离开';
  const stageWrap = el('div', 'mg-stage', frame);
  active = { overlay };

  const prevMusic = audio.currentMusic;
  if (opts.music !== false) audio.music(opts.music || 'minigame');

  let attempt = 0;
  let fails = 0;
  let final = null;
  let quitRequested = false;
  let currentAbort = null;
  let forceWin = false;
  // 开发自测：window.__mgWin() 直接判定过关
  if (typeof __DEV__ !== 'undefined' && __DEV__) window.__mgWin = () => { forceWin = true; currentAbort?.abort(); };

  closeBtn.onclick = async () => {
    audio.sfx('click');
    if (quitRequested) return;
    const ok = await confirmModal(stageWrap, '暂且离开？', '进度不会保存，可以随时回来再试。', '离开', '继续');
    if (ok) {
      quitRequested = true;
      if (currentAbort) currentAbort.abort();
    }
  };

  // 说明页
  const started = await introModal(stageWrap, game);
  if (!started) quitRequested = true;

  while (!quitRequested) {
    attempt++;
    const stage = el('div', 'mg-stage-inner', stageWrap);
    stage.style.cssText = 'position:absolute;inset:0;';
    const toastLayer = el('div', 'mg-toast-layer', stageWrap);
    const abort = new AbortController();
    currentAbort = abort;
    const ctx = makeCtx({ stage, toastLayer, hudCenter, hudRight, signal: abort.signal, attempt, difficulty: fails >= 2 ? 0 : 1 });
    let result;
    try {
      result = await game.play(ctx, opts);
    } catch (e) {
      if (!abort.signal.aborted) console.error(`[小游戏 ${game.id}]`, e);
      result = { success: false, score: 0 };
    }
    ctx._dispose();
    if (forceWin) { forceWin = false; result = { success: true, score: 0, note: '（调试：直接过关）' }; }
    if (quitRequested) { stage.remove(); toastLayer.remove(); break; }
    result = result || { success: false };
    if (result.success) {
      audio.sfx('win');
      await resultModal(stageWrap, game, result, true, false);
      final = { ...result, attempts: attempt };
      stage.remove(); toastLayer.remove();
      break;
    }
    fails++;
    audio.sfx('fail');
    const canSkip = opts.allowSkip !== false && fails >= 2;
    const choice = await resultModal(stageWrap, game, result, false, canSkip);
    stage.remove(); toastLayer.remove();
    if (choice === 'skip') { final = { success: true, skipped: true, score: 0, attempts: attempt }; break; }
    if (choice === 'quit') { quitRequested = true; break; }
  }

  if (!final) final = { success: false, quit: true, score: 0, attempts: attempt };
  overlay.classList.add('closing');
  await sleep(300);
  overlay.remove();
  active = null;
  if (opts.music !== false && opts.restoreMusic !== false) audio.music(prevMusic || null);
  return final;
}

function makeCtx({ stage, toastLayer, hudCenter, hudRight, signal, attempt, difficulty }) {
  const disposers = [];
  const resizeCbs = new Set();
  const ctx = {
    root: stage,
    w: stage.clientWidth || 800,
    h: stage.clientHeight || 500,
    dpr: Math.min(2, window.devicePixelRatio || 1),
    isTouch: isTouchDevice(),
    signal,
    attempt,
    difficulty,
    assets: ASSETS,
    sfx: (name, o) => audio.sfx(name, o),
    wait: (ms) => new Promise((res, rej) => {
      const t = setTimeout(res, ms);
      signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
    }),
    el: (tag, cls, parent, text) => el(tag, cls, parent || stage, text),
    onResize(cb) { resizeCbs.add(cb); return () => resizeCbs.delete(cb); },
    loop(fn) {
      let raf = 0; let last = performance.now(); let stopped = false;
      const tick = (now) => {
        if (stopped || signal.aborted) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        try { fn(dt, now / 1000); } catch (e) { console.error(e); stopped = true; return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const stop = () => { stopped = true; cancelAnimationFrame(raf); };
      disposers.push(stop);
      return stop;
    },
    canvas(parent) {
      const host = parent || stage;
      const canvas = el('canvas', 'mg-canvas', host);
      const g = canvas.getContext('2d');
      const obj = { canvas, g, w: 0, h: 0 };
      obj.resize = () => {
        const r = host.getBoundingClientRect();
        obj.w = Math.max(1, Math.round(r.width));
        obj.h = Math.max(1, Math.round(r.height));
        canvas.width = Math.round(obj.w * ctx.dpr);
        canvas.height = Math.round(obj.h * ctx.dpr);
        g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      };
      obj.resize();
      resizeCbs.add(obj.resize);
      return obj;
    },
    toast(text, kind) {
      const t = el('div', 'mg-toast' + (kind ? ' ' + kind : ''), toastLayer, text);
      setTimeout(() => t.remove(), 1150);
    },
    hud({ center, right } = {}) {
      if (center != null) hudCenter.innerHTML = center;
      if (right != null) hudRight.innerHTML = right;
    },
    keys: (() => {
      const down = new Set();
      const listeners = new Set();
      const kd = (e) => {
        if (e.repeat) return;
        down.add(e.code);
        for (const f of listeners) f(e.code, e);
      };
      const ku = (e) => down.delete(e.code);
      const blur = () => down.clear();
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      window.addEventListener('blur', blur);
      disposers.push(() => {
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        window.removeEventListener('blur', blur);
      });
      return {
        isDown: (code) => down.has(code),
        onDown(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      };
    })(),
    _dispose() { for (const d of disposers) { try { d(); } catch { /* ignore */ } } resizeCbs.clear(); ro.disconnect(); },
  };
  const ro = new ResizeObserver(() => {
    ctx.w = stage.clientWidth; ctx.h = stage.clientHeight;
    for (const cb of resizeCbs) cb(ctx.w, ctx.h);
  });
  ro.observe(stage);
  hudCenter.innerHTML = '';
  hudRight.innerHTML = '';
  return ctx;
}

function modal(parent) {
  const m = el('div', 'mg-modal', parent);
  const card = el('div', 'mg-card jl-panel', m);
  return { m, card };
}

function introModal(parent, game) {
  return new Promise((resolve) => {
    const { m, card } = modal(parent);
    el('h2', 'jl-title', card, game.title);
    if (game.subtitle) el('div', 'mg-subtitle', card, game.subtitle);
    if (game.rules?.length) {
      const ul = el('ul', 'mg-rules', card);
      for (const r of game.rules) html('li', '', ul, r);
    }
    if (game.controls) el('div', 'mg-controls', card, game.controls);
    const actions = el('div', 'mg-actions', card);
    const go = el('button', 'jl-btn primary', actions, '开 始');
    const done = (v) => {
      window.removeEventListener('keydown', onKey);
      m.remove();
      resolve(v);
    };
    const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); audio.sfx('ok'); done(true); } };
    window.addEventListener('keydown', onKey);
    go.onclick = () => { audio.sfx('ok'); done(true); };
    setTimeout(() => go.focus(), 50);
  });
}

function resultModal(parent, game, result, success, canSkip) {
  return new Promise((resolve) => {
    const { m, card } = modal(parent);
    const seal = el('div', 'mg-result-seal' + (success ? '' : ' fail'), card, success ? (result.perfect ? '无瑕' : '功成') : '再试');
    if (!success) seal.style.fontSize = '40px';
    audio.sfx(success ? 'stamp' : 'wood');
    if (result.score != null && result.score !== 0 && result.scoreText !== false) {
      // 按「 · 」分段，每段不拆行：窄屏上只在分隔处换行
      const sc = el('div', 'mg-score', card);
      const parts = (result.scoreText || `得分 ${result.score}`).split(' · ');
      parts.forEach((t, k) => { if (k) sc.append(' '); el('span', '', sc, k < parts.length - 1 ? `${t} ·` : t); });
    }
    el('div', 'mg-note', card, result.note || (success ? '做得好！' : '差一点点，再来一次吧。'));
    const actions = el('div', 'mg-actions', card);
    const finish = (v) => { window.removeEventListener('keydown', onKey); m.remove(); resolve(v); };
    let primary;
    if (success) {
      primary = el('button', 'jl-btn primary', actions, '继 续');
      primary.onclick = () => { audio.sfx('ok'); finish('continue'); };
    } else {
      primary = el('button', 'jl-btn primary', actions, '再试一次');
      primary.onclick = () => { audio.sfx('ok'); finish('retry'); };
      if (canSkip) {
        const skip = el('button', 'jl-btn ghost', actions, '跳过此关');
        skip.onclick = () => { audio.sfx('click'); finish('skip'); };
      }
      const quit = el('button', 'jl-btn ghost', actions, '暂且离开');
      quit.onclick = () => { audio.sfx('click'); finish('quit'); };
    }
    const onKey = (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); primary.click(); } };
    setTimeout(() => { window.addEventListener('keydown', onKey); primary.focus(); }, 400);
  });
}

function confirmModal(parent, title, text, yes, no) {
  return new Promise((resolve) => {
    const { m, card } = modal(parent);
    m.style.zIndex = 20;
    el('h2', 'jl-title', card, title).style.fontSize = '34px';
    el('div', 'mg-note', card, text);
    const actions = el('div', 'mg-actions', card);
    const a = el('button', 'jl-btn primary', actions, yes);
    const b = el('button', 'jl-btn ghost', actions, no);
    a.onclick = () => { audio.sfx('click'); m.remove(); resolve(true); };
    b.onclick = () => { audio.sfx('click'); m.remove(); resolve(false); };
  });
}
