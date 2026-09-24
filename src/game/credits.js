// 片尾字幕
import { el, html, sleep } from '../core/util.js';
import { audio } from '../core/audio.js';
import { ASSETS } from '../assets.js';
import { CHAPTERS } from '../story/chapters.js';
import { CODEX } from '../story/codex.js';
import { fmtTime } from './state.js';

export function rollCredits(app) {
  return new Promise((resolve) => {
    const st = app.state;
    audio.music('ending');
    audio.ambient(null);
    const root = document.getElementById('ui');
    const c = el('div', 'credits', root);
    const bg = el('div', 'cr-bg', c);
    bg.style.backgroundImage = `url(${ASSETS.title})`;
    const roll = el('div', 'cr-roll', c);
    const chapters = CHAPTERS.map((ch) => `<div class="cr-p">${ch.num} · ${ch.title}　<span style="opacity:.6">${ch.era}</span></div>`).join('');
    const codexN = CODEX.filter((e) => st.codex.includes(e.id)).length;
    html('div', '', roll, `
      <div class="cr-h">金陵寻踪</div>
      <div class="cr-p">一砖一名 · 六百年</div>
      <img class="cr-img" src="${ASSETS.outfit}" alt="">
      <div class="cr-s">主演</div>
      <div class="cr-p">康晔</div>
      <div class="cr-s">旅伴</div>
      <div class="cr-p">阿麟 · 明孝陵神道的小石麒麟</div>
      <div class="cr-s">登场人物</div>
      <div class="cr-p">周老汉 · 李主事 · 老员外与马夫人</div>
      <div class="cr-p">解缙 · 姚广孝 · 沈度</div>
      <div class="cr-p">郑和 · 马欢 · 火长 · 「麒麟」</div>
      <div class="cr-p">琉璃匠 · 长干里的两个孩子</div>
      <div class="cr-p">海瑞 · 汤显祖 · 世德堂唐掌柜</div>
      <div class="cr-p">以及 · 遗忘之蠹</div>
      <div class="cr-s">旅程</div>
      ${chapters}
      <div class="cr-s">这一次</div>
      <div class="cr-p">游历 ${fmtTime(st.playtime)} · 金陵志 ${codexN} / ${CODEX.length} 篇 · 踪印 ${st.seals.length} 枚</div>
      <div class="cr-s">史料</div>
      <div class="cr-p">《明史》《礼记·月令》《瀛涯胜览》</div>
      <div class="cr-p">《武备志·郑和航海图》《牡丹亭》</div>
      <div class="cr-p">南京城墙砖文 · 大报恩寺遗址 · 龙江宝船厂遗址</div>
      <div class="cr-s">字体</div>
      <div class="cr-p">马善政毛笔楷书（SIL Open Font License）</div>
      <div class="cr-s">策划 · 美术 · 程序 · 音乐</div>
      <div class="cr-p">Claude</div>
      <div class="cr-p" style="opacity:.7">画面、音乐与音效皆由代码生成</div>
      <div class="cr-s">献给</div>
      <div class="cr-p">喜欢明朝的康晔</div>
      <div class="cr-p" style="margin-top:36px">历史不会被遗忘——</div>
      <div class="cr-p">因为有人记得。</div>
      <div class="cr-end">完</div>`);
    let y = window.innerHeight;
    let speed = 38;
    let raf = 0, last = performance.now(), finished = false;
    const total = () => roll.offsetHeight;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      y -= speed * dt;
      const end = -(total() - window.innerHeight * 0.62);
      if (y <= end) { y = end; if (!finished) { finished = true; setTimeout(() => { c.onclick = close; }, 600); } }
      roll.style.transform = `translate(-50%, ${y - window.innerHeight}px)`;
      raf = requestAnimationFrame(tick);
    };
    roll.style.top = '100%';
    raf = requestAnimationFrame(tick);
    c.onclick = () => { speed = speed > 100 ? 38 : 220; };
    const onKey = (e) => { if (e.code === 'Escape' || (finished && (e.code === 'Enter' || e.code === 'Space'))) close(); };
    window.addEventListener('keydown', onKey);
    async function close() {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      c.style.transition = 'opacity 1.2s ease';
      c.style.opacity = '0';
      await sleep(1250);
      c.remove();
      resolve();
    }
  });
}
