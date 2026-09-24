// 金陵寻踪 · 入口
import { App } from './game/app.js';
import { el, html, sleep } from './core/util.js';
import { ASSETS, loadImage } from './assets.js';

async function boot() {
  const ui = document.getElementById('ui');
  const ld = html('div', 'loading', ui, '<div class="ld"><div class="jl-seal ld-seal">金陵</div><div class="ld-t">金陵寻踪</div><div class="ld-bar"><i></i></div></div>');
  const bar = ld.querySelector('.ld-bar i');
  const set = (k) => { bar.style.width = `${Math.round(k * 100)}%`; };
  set(0.1);
  try { await Promise.race([document.fonts.load('40px JLBrush'), sleep(2500)]); } catch { /* 字体失败也能玩 */ }
  set(0.3);
  const imgs = [ASSETS.title, ASSETS.sheet, ...Object.values(ASSETS.portrait), ASSETS.outfit, ASSETS.bodyFront];
  let n = 0;
  await Promise.all(imgs.map((u) => loadImage(u).catch(() => null).then(() => set(0.3 + 0.5 * (++n / imgs.length)))));
  let app;
  try {
    app = new App();
  } catch (e) {
    console.error(e);
    ld.querySelector('.ld-t').textContent = '抱歉，这台设备暂时无法运行（需要 WebGL）';
    return;
  }
  window.__app = app;
  set(1);
  app.game.start();
  await sleep(250);
  ld.classList.add('out');
  setTimeout(() => ld.remove(), 900);
  // 开发用：?ch=章&step=步 直接跳到某章某步（之前的修复全部完成）
  const q = new URLSearchParams(location.search);
  if (typeof __DEV__ !== 'undefined' && __DEV__ && q.get('ch')) {
    const { newState } = await import('./game/state.js');
    const st = newState();
    st.chapter = Number(q.get('ch'));
    st.step = Number(q.get('step') || 0);
    st.restored = {};
    app.chapters.forEach((c, i) => {
      if (i < st.chapter) st.restored[i] = (c.steps || []).map((x) => x.stage).filter(Boolean);
      if (i === st.chapter) st.restored[i] = (c.steps || []).slice(0, st.step).map((x) => x.stage).filter(Boolean);
    });
    if (st.step > 0 || q.get('skipintro')) st.flags[`ch${st.chapter}_in`] = true;
    if (st.chapter > 0) st.flags.alingJoined = true;
    if (st.chapter >= 7) st.flags.nishang = true;
    app.setState(st);
    app.inTitle = false;
    await app.runGame();
    return;
  }
  await app.title();
}
void el;
boot();
