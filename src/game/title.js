// 标题画面
import { el, html, sleep } from '../core/util.js';
import { audio } from '../core/audio.js';
import { ASSETS } from '../assets.js';
import { hasAnySave, latestSlot, slotInfo, fmtTime } from './state.js';
import { CHAPTERS } from '../story/chapters.js';

export function showTitle(app) {
  return new Promise((resolve) => {
    const root = document.getElementById('ui');
    const t = el('div', 'title', root);
    const bg = el('div', 'title-bg', t);
    bg.style.backgroundImage = `url(${ASSETS.title})`;
    el('div', 'title-shade', t);
    const fx = el('canvas', 'title-fx', t);
    html('div', 'title-main', t, `
      <div class="title-logo">金陵寻踪</div>
      <div class="title-side"><span class="jl-seal title-seal">康晔</span><div class="title-sub">一砖一名 · 六百年</div></div>`);
    const menu = el('div', 'title-menu', t);
    const press = el('div', 'title-press', t, '轻触任意处');
    const clears = app.meta.clears || 0;
    html('div', 'title-foot', t, `献给 康晔${clears ? ` · 已走完旅程 ${clears} 次` : ''}<br>金陵寻踪 · 二〇二六`);

    let done = false;
    const finish = async (v) => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey);
      stopFx();
      audio.sfx('ok');
      t.classList.add('out');
      await sleep(1100);
      t.remove();
      resolve(v);
    };
    const btn = (label, fn, dis = false) => {
      const b = el('button', 'title-btn', menu, label);
      b.disabled = dis;
      b.onmouseenter = () => audio.sfx('hover');
      b.onclick = (e) => { e.stopPropagation(); audio.unlock(); fn(); };
      return b;
    };
    const save = hasAnySave() ? slotInfo(latestSlot()) : null;
    if (save) {
      const ch = CHAPTERS.find((c) => c.id === save.chapter);
      const b = btn('继续旅程', () => finish('continue'));
      b.title = `${ch ? ch.num + '「' + ch.title + '」' : ''} · 游历 ${fmtTime(save.playtime)}`;
    }
    btn(save ? '重新开始' : '开始旅程', async () => {
      if (save && !(await confirmNew(t))) return;
      finish('new');
    });
    btn('金陵志', () => { audio.sfx('open'); app.ui.openMenu('codex', { title: true }); });
    btn('设置', () => { audio.sfx('open'); app.ui.openMenu('settings', { title: true }); });
    const onKey = (e) => {
      if (app.ui.menuEl) return;
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); menu.querySelector('.title-btn:not([disabled])')?.click(); }
    };
    window.addEventListener('keydown', onKey);
    t.addEventListener('pointerdown', () => {
      audio.unlock();
      if (!press.hidden) { press.hidden = true; audio.music('title'); }
    });
    audio.music('title');
    const stopFx = runFx(fx);
  });
}

function confirmNew(parent) {
  return new Promise((resolve) => {
    const m = el('div', 'mg-modal', parent);
    m.style.cssText = 'position:absolute;inset:0;z-index:5;background:rgba(5,7,12,.6)';
    const c = el('div', 'mg-card jl-panel', m);
    el('h2', 'jl-title', c, '重新开始？').style.fontSize = '34px';
    el('div', 'mg-note', c, '自动存档会被新的旅程覆盖（手动存档不受影响，金陵志与成就也会保留）。');
    const a = el('div', 'mg-actions', c);
    const yes = el('button', 'jl-btn primary', a, '重新开始');
    const no = el('button', 'jl-btn ghost', a, '再想想');
    yes.onclick = () => { audio.sfx('ok'); m.remove(); resolve(true); };
    no.onclick = () => { audio.sfx('cancel'); m.remove(); resolve(false); };
  });
}

/** 标题上的光尘与梅瓣 */
function runFx(canvas) {
  const g = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const P = [];
  let raf = 0, stopped = false, last = performance.now();
  const resize = () => { canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; };
  resize();
  window.addEventListener('resize', resize);
  const spawn = (init) => {
    const petal = Math.random() < 0.28;
    P.push({
      x: Math.random() * canvas.width, y: init ? Math.random() * canvas.height : (petal ? -20 : canvas.height + 20),
      vx: (petal ? 18 + Math.random() * 20 : (Math.random() - 0.5) * 8) * dpr, vy: (petal ? 22 + Math.random() * 18 : -(8 + Math.random() * 16)) * dpr,
      r: (petal ? 4 + Math.random() * 3 : 1 + Math.random() * 2.2) * dpr, petal, ph: Math.random() * 6, rot: Math.random() * 6, a: 0.4 + Math.random() * 0.5,
    });
  };
  for (let i = 0; i < 60; i++) spawn(true);
  const tick = (now) => {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.ph += dt; p.rot += dt * 1.5;
      p.x += (p.vx + Math.sin(p.ph * 1.3) * 10 * dpr) * dt; p.y += p.vy * dt;
      if (p.y < -30 || p.y > canvas.height + 30 || p.x > canvas.width + 30) { P.splice(i, 1); spawn(false); continue; }
      g.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.ph * 2));
      if (p.petal) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = '#f5c9d2'; g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2); g.fill(); g.restore();
      } else {
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(1, 'rgba(255,236,190,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}
