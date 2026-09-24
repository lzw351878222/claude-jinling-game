// 问史 · 与蠹一决 —— 终章 Boss 战（第二阶段：答题）
// 遗忘之蠹每一回合吞掉一段史实，留下一页残纸；康晔选出正确答案，以踪印还击。
// 答错或超时：蠹扑来，一盏心灯熄灭，同时给出正确答案与注解（这是记住它的机会）。
// 蠹的元气分三重：66% 时「五印合一」，康晔的印更重，并得到阿麟提示；33% 时蠹狂，限时变短。
//
// opts
//   unlocked   已解锁的《金陵志》条目 id 数组：优先出这些条目的题（不传则一视同仁）
//   maxChapter 可出题的最高章节（默认 5；更高章节的题只在其条目已解锁时出现）
//   seals      五枚踪印的字（默认取 story/chapters.js 的 SEALS：城砖、典籍、星槎、琉璃、灯火）
//   lamps      心灯数（默认 5）
//   seed       随机种子（调试用）
// 返回 { success, score, perfect, note, stats, missed }
//   perfect：一盏心灯都没熄；missed：答错的题所对应的金陵志条目 id（去重，可用于提示玩家复习）
// ctx.difficulty === 0（连败后的简单模式）：伤害更高、限时更长、每一重都有一次阿麟提示。
import { clamp, lerp, easeOutCubic, easeInOutCubic, TAU, rng, shuffle, el, html, injectStyle, cnNum } from '../core/util.js';
import { loadImage } from '../assets.js';
import { QUESTIONS } from '../story/questions.js';
import { CODEX, codexById } from '../story/codex.js';
import { SEALS } from '../story/chapters.js';
import css from './quiz.css';

const FONT_BRUSH = '"JLBrush", "STXingkai", "KaiTi", "STKaiti", "Kaiti SC", serif';
const FONT_BODY = '"KaiTi", "STKaiti", "Kaiti SC", "JLBrush", "Songti SC", "SimSun", serif';
const HP_MAX = 1000;
const PHASE_AT = [667, 334];
const PHASE_NAME = ['第一重', '第二重', '第三重'];
const CH_TAG = ['序章 · 中华门', '洪武 · 聚宝门', '永乐 · 文渊阁', '永乐 · 宝船厂', '宣德 · 琉璃塔', '万历 · 秦淮', '终章 · 金陵'];
const DEFAULT_SEALS = ['城砖', '典籍', '星槎', '琉璃', '灯火'];

const LINES = {
  intro: '它来了！别怕——你记得的，就是你的武器。',
  introEasy: '这次我一直都在。卡住了就喊“阿麟”，我帮你划掉两个错的！',
  firstWrong: '没关系。现在记住它，它就再也吃不掉了。',
  wrong: ['记下来，下一题扳回来！', '别慌，它只是啃掉了一页纸。', '这一条，回头再翻翻《金陵志》～', '深呼吸，我们还有心灯。'],
  timeout: '哎呀，时辰到了……',
  combo: ['三连！它的鳞片在往下掉！', '好！踪印连环！', '就是这样，一字一印！', '它在发抖——继续！'],
  lastLamp: '最后一盏心灯了……我陪着你。',
  awaken: '五印合一！你的每一印都更重了。需要时喊我——我能划掉两个错答案。',
  frenzy: '它急了，吞得更快了！稳住，一题一题来。',
  hint: '嗯……我记得，不是这两个。',
  win: '你做到了……我就知道，你记得。',
  lose: '心灯熄了，可你记得的，它夺不走。再来！',
};

// 阿麟：一只发光的小石麒麟（线描）
const LING_SVG = `<svg viewBox="0 0 100 90" aria-hidden="true"><g fill="rgba(150,230,200,.18)" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
<path d="M28 55 C17 55 9 46 13 36 C16 28 27 29 26 36 C25 41 19 41 20 36" fill="none"/>
<path d="M28 61 C20 66 11 63 8 55" fill="none"/>
<path d="M28 53 C30 44 42 40 53 42 C63 44 67 51 65 58 C63 65 51 67 41 66 C31 65 26 61 28 53 Z"/>
<path d="M34 64 L32 76 M42 66 L42 77 M55 65 L57 76 M62 61 L66 73" fill="none"/>
<path d="M28 77.5 h7 M38.5 78.5 h7 M53.5 77.5 h7 M62.5 74.5 h7" fill="none"/>
<path d="M56 45 C50 37 51 25 61 21 C70 17 79 21 82 28 C88 29 91 34 87 39 C84 42 79 42 75 42 C69 46 61 48 56 45 Z"/>
<path d="M62 21 C61 13 56 8 49 7" fill="none"/>
<path d="M56 27 C49 25 46 31 50 34 M52 37 C45 37 44 43 49 45" fill="none"/>
<circle cx="73" cy="29" r="2.6" fill="currentColor" stroke="none"/>
<path d="M82 35 q-3 2 -7 1" fill="none" stroke-width="1.8"/>
<path d="M38 51 q4 -4 8 0 M47 50 q4 -4 8 0 M42 57 q4 -4 8 0" fill="none" stroke-width="1.7"/>
<path d="M22 84 q4 -5 8 0 q4 -5 8 0 M50 84 q4 -5 8 0 q4 -5 8 0" fill="none" stroke-width="1.9"/>
</g></svg>`;

// 同一个页面会话里答过的题：重试时尽量换新题
const recentAsked = new Set();

export default {
  id: 'quiz',
  title: '问史',
  subtitle: '与蠹一决',
  rules: [
    '遗忘之蠹要把金陵六百年的记忆一口吞下。它每啃去一段史实，就留下一页残纸——<b>选出正确答案</b>，把被吃掉的历史印回去！',
    '答对：康晔以<b>踪印</b>还击；<b>连对三题</b>，踪印连环，伤害更高；答得越快，得分越多。',
    '答错或超时：蠹扑上来，一盏<b>心灯</b>熄灭——但你会看到正确答案。五盏心灯全熄则失败。',
    '题目全都出自《金陵志》。读过的条目，就是你的武器。',
  ],
  controls: '鼠标 / 触屏点选 · 键盘 1–4 作答 · H 阿麟提示 · 回车 / 空格 继续',

  async play(ctx, opts = {}) {
    injectStyle('quiz', css);
    const easy = ctx.difficulty === 0;
    const R = rng(opts.seed != null ? opts.seed : ((Date.now() ^ Math.imul(ctx.attempt || 1, 2654435761)) >>> 0));
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let TS = 1; // 时间倍率（仅调试用）

    const CFG = {
      lamps: clamp(Math.round(opts.lamps || 5), 1, 9),
      time: easy ? [36, 32, 28] : [25, 22, 18],
      dmgMul: easy ? 1.45 : 1,
      hintsGain: easy ? [1, 1, 1] : [0, 1, 1],
    };
    const SEAL_CHARS = (Array.isArray(opts.seals) && opts.seals.length >= 5)
      ? opts.seals.slice(0, 5).map(String)
      : (Array.isArray(SEALS) && SEALS.length >= 5 ? SEALS.slice(0, 5).map((s) => String(s.ch || s)) : DEFAULT_SEALS);

    const S = {
      hp: HP_MAX, phase: 0, awakened: false,
      lamps: CFG.lamps, lampsLost: 0,
      combo: 0, maxCombo: 0, asked: 0, correct: 0, wrong: 0, timeouts: 0, score: 0,
      hints: CFG.hintsGain[0], hintsUsed: 0,
      timerOn: false, tLeft: 0, tTotal: 1, lastSec: -1, onTimeout: null,
      inkP: 0, inkTarget: 0,
      missed: new Set(), used: new Set(),
      lastCodex: null, lastChapter: -1,
      sayUntil: 0, wrongSaid: false, lastLampSaid: false,
      shakeAmp: 0, shakeT: 0, over: false,
    };

    // ------------------------------------------------------------ 题库
    const maxCh = Number.isFinite(opts.maxChapter) ? opts.maxChapter : 5;
    const unlockedSet = Array.isArray(opts.unlocked) && opts.unlocked.length ? new Set(opts.unlocked) : null;
    let pool = QUESTIONS.filter((q) => codexById[q.codex] && Array.isArray(q.options) && q.options.length === 4
      && (q.chapter <= maxCh || (unlockedSet && unlockedSet.has(q.codex))));
    if (pool.length < 8) pool = QUESTIONS.filter((q) => codexById[q.codex]);
    const isUnlocked = (q) => !unlockedSet || unlockedSet.has(q.codex);
    const LEVEL_PREF = [[1, 2], [1, 2, 3], [2, 3]];

    function pickQuestion() {
      let cands = pool.filter((q) => !S.used.has(q.id));
      if (!cands.length) { S.used.clear(); cands = pool.slice(); }
      let total = 0;
      const ws = cands.map((q) => {
        let w = 1;
        if (isUnlocked(q)) w *= 5;
        if (recentAsked.has(q.id)) w *= 0.3;
        if (LEVEL_PREF[S.phase].includes(q.level || 2)) w *= 1.7;
        if (q.codex === S.lastCodex) w *= 0.05;
        if (q.chapter === S.lastChapter) w *= 0.45;
        total += w;
        return w;
      });
      let r = R() * total;
      let q = cands[cands.length - 1];
      for (let i = 0; i < cands.length; i++) { r -= ws[i]; if (r <= 0) { q = cands[i]; break; } }
      S.used.add(q.id);
      recentAsked.add(q.id);
      if (recentAsked.size > 40) recentAsked.delete(recentAsked.values().next().value);
      S.lastCodex = q.codex; S.lastChapter = q.chapter;
      return q;
    }

    // 画面上飘的字，全取自金陵志
    const CHAR_POOL = (() => {
      const set = new Set();
      for (const e of CODEX) for (const ch of e.text) if (/[一-鿿]/.test(ch)) set.add(ch);
      return [...set];
    })();
    const randChar = (r = R) => CHAR_POOL[Math.floor(r() * CHAR_POOL.length)] || '史';
    const charsOf = (s) => [...s].filter((ch) => /[一-鿿]/.test(ch));

    // ------------------------------------------------------------ 定时 / 等待
    let clock = 0; // 动画时钟（随 rAF 前进）
    // 延时回调走 setTimeout：即使画面暂停（切到后台），流程也和 ctx.wait 保持同步；中止时统一清掉
    const timers = new Set();
    const later = (ms, fn) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (ctx.signal.aborted) return;
        try { fn(); } catch (e) { console.error(e); }
      }, Math.max(0, ms / TS));
      timers.add(id);
      return id;
    };
    const cancelLater = (id) => { clearTimeout(id); timers.delete(id); };
    const clearTimers = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
    ctx.signal.addEventListener('abort', clearTimers, { once: true });
    const wait = (ms) => ctx.wait(Math.max(0, ms / TS));
    // 宿主的「暂且离开？」确认框盖在舞台上时：限时暂停，按键不作数
    const hostPaused = () => {
      const wrap = ctx.root && ctx.root.parentElement;
      return !!(wrap && wrap.querySelector(':scope > .mg-modal'));
    };
    function waitFor(setup) {
      return new Promise((resolve, reject) => {
        if (ctx.signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
        let done = false;
        let cleanup = null;
        const end = () => { done = true; ctx.signal.removeEventListener('abort', onAbort); if (cleanup) { try { cleanup(); } catch { /* ignore */ } } };
        const finish = (v) => { if (done) return; end(); resolve(v); };
        const onAbort = () => { if (done) return; end(); reject(new DOMException('aborted', 'AbortError')); };
        ctx.signal.addEventListener('abort', onAbort, { once: true });
        cleanup = setup(finish) || null;
        if (done && cleanup) { try { cleanup(); } catch { /* ignore */ } }
      });
    }
    function waitOrTap(ms) {
      return waitFor((finish) => {
        const id = later(ms, finish);
        const onTap = () => finish();
        root.addEventListener('pointerdown', onTap);
        const off = ctx.keys.onDown((code) => { if (!hostPaused() && (code === 'Enter' || code === 'Space' || code === 'NumpadEnter')) finish(); });
        return () => { cancelLater(id); root.removeEventListener('pointerdown', onTap); off(); };
      });
    }

    // ------------------------------------------------------------ DOM
    const root = ctx.el('div', 'quiz-root');
    const shakeEl = el('div', 'quiz-shake', root);
    const bg = ctx.canvas(shakeEl);
    bg.canvas.classList.add('quiz-bg');
    const layoutEl = el('div', 'quiz-layout', shakeEl);
    const fx = ctx.canvas(shakeEl);
    fx.canvas.classList.add('quiz-fx');
    const fxDom = el('div', 'quiz-fxdom', shakeEl);
    const cardLayer = el('div', 'quiz-cardlayer', root);

    const top = el('div', 'quiz-top', layoutEl);
    const boss = el('div', 'quiz-boss hidden', top);
    el('div', 'quiz-boss-name', boss, '遗忘之蠹');
    const hpEl = el('div', 'quiz-hp', boss);
    const hpGhost = el('div', 'quiz-hp-ghost', hpEl);
    const hpFill = el('div', 'quiz-hp-fill', hpEl);
    hpFill.style.transition = 'width .22s ease-out';
    hpGhost.style.transition = 'width .7s ease-in .4s';
    for (const p of PHASE_AT) { const n = el('div', 'quiz-hp-notch', hpEl); n.style.left = (p / HP_MAX * 100) + '%'; }
    const phaseEl = el('div', 'quiz-boss-phase', boss, PHASE_NAME[0]);

    const arena = el('div', 'quiz-arena', layoutEl);
    const hero = el('div', 'quiz-hero', arena);
    const fan = el('div', 'quiz-fan', hero);
    const face = el('div', 'quiz-fan-face', fan);
    const A = ctx.assets || {};
    const portraitSerious = (A.portrait && (A.portrait.serious || A.portrait.front)) || '';
    const portraitSmile = (A.portrait && (A.portrait.smile || A.portrait.front)) || portraitSerious;
    const imgMain = el('img', 'quiz-fan-img', face);
    imgMain.alt = '';
    imgMain.draggable = false;
    if (portraitSerious) imgMain.src = portraitSerious;
    const imgSmile = el('img', 'quiz-fan-img alt', face);
    imgSmile.alt = '';
    imgSmile.draggable = false;
    if (portraitSmile) imgSmile.src = portraitSmile;
    el('div', 'quiz-fan-rim', fan);
    el('div', 'quiz-fan-handle', hero);
    el('div', 'quiz-name', hero, '康晔');
    const lampsWrap = el('div', 'quiz-lamps', hero);
    const lampEls = [];
    for (let i = 0; i < CFG.lamps; i++) {
      const l = el('div', 'quiz-lamp out', lampsWrap);
      el('i', 'l-body', l); el('i', 'l-cap top', l); el('i', 'l-cap bot', l); el('i', 'l-tail', l); el('i', 'l-smoke', l);
      lampEls.push(l);
    }
    const ling = html('div', 'quiz-ling', hero, LING_SVG);
    const bubble = el('div', 'quiz-bubble', hero);

    const page = el('div', 'quiz-page away', layoutEl);
    const pageBg = el('div', 'quiz-page-bg', page);
    const inkCv = el('canvas', 'quiz-ink', page);
    const inkG = inkCv.getContext('2d');
    const inner = el('div', 'quiz-page-inner', page);
    const head = el('div', 'quiz-head', inner);
    const qnum = el('div', 'quiz-qnum', head, '第一问');
    const tag = el('div', 'quiz-tag', head, '');
    const hintBtn = html('button', 'quiz-hintbtn', head, `${LING_SVG}<span>阿麟</span><span class="n"></span>`);
    hintBtn.type = 'button';
    hintBtn.title = '阿麟提示：划掉两个错误答案（H）';
    const hintN = hintBtn.querySelector('.n');
    const timerEl = el('div', 'quiz-timer', head, '');
    const qText = el('div', 'quiz-q', inner, '');
    const optsWrap = el('div', 'quiz-opts', inner);
    const optBtns = [0, 1, 2, 3].map((i) => {
      const b = el('button', 'quiz-opt', optsWrap);
      b.type = 'button';
      el('span', 'quiz-key', b, String(i + 1));
      b._t = el('span', 'quiz-opt-text', b, '');
      return b;
    });
    let current = null;

    // ------------------------------------------------------------ 布局
    const L = { W: 1, H: 1, A: { x: 0, y: 0, w: 1, h: 1 }, portrait: false, fanD: 120, hero: { x: 0, y: 0, r: 60 }, dpr: ctx.dpr };
    let bgGrad = null;
    function layout() {
      const rr = root.getBoundingClientRect();
      L.W = Math.max(1, rr.width); L.H = Math.max(1, rr.height);
      L.portrait = L.W < 640 || L.W < L.H * 1.02;
      root.classList.toggle('q-narrow', L.W < 600);
      root.classList.toggle('q-tiny', L.W < 370);
      root.classList.toggle('q-portrait', L.portrait);
      root.classList.toggle('q-short', L.H < 520);
      updateOneCol();
      const ar = arena.getBoundingClientRect();
      L.A = { x: ar.left - rr.left, y: ar.top - rr.top, w: Math.max(1, ar.width), h: Math.max(1, ar.height) };
      const f = L.portrait
        ? clamp(Math.min(L.A.w * 0.27, (L.A.h - 34) / 1.75), 54, 118)
        : clamp(Math.min((L.A.h - 44) / 1.75, L.A.w * 0.17), 70, 178);
      L.fanD = f;
      root.style.setProperty('--fan', f.toFixed(1) + 'px');
      const fr = fan.getBoundingClientRect();
      L.hero = { x: fr.left - rr.left + fr.width / 2, y: fr.top - rr.top + fr.height / 2, r: fr.width / 2 };
      placeLamps();
      placeBubble();
      sizeInk();
      monsterTargets(!M.placed);
      bgGrad = null;
    }
    function updateOneCol() {
      const longest = current ? Math.max(...current.q.options.map((o) => o.length)) : 0;
      root.classList.toggle('q-onecol', L.W < 340 || (L.W < 600 && longest > 12));
    }
    function placeLamps() {
      const f = L.fanD;
      const rad = f / 2 + Math.max(12, f * 0.13);
      const n = lampEls.length;
      const a0 = -200 * Math.PI / 180;
      const a1 = -70 * Math.PI / 180;
      const lw = clamp(f * 0.115, 12, 20);
      lampEls.forEach((l, i) => {
        const a = n === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * i / (n - 1);
        l.style.left = (f / 2 + Math.cos(a) * rad).toFixed(1) + 'px';
        l.style.top = (f / 2 + Math.sin(a) * rad).toFixed(1) + 'px';
        l.style.width = lw.toFixed(1) + 'px';
        l.style.height = (lw * 1.35).toFixed(1) + 'px';
        l.style.margin = `${(-lw * 0.675).toFixed(1)}px 0 0 ${(-lw / 2).toFixed(1)}px`;
        l.style.animationDelay = (i * -0.45) + 's';
      });
    }
    function placeBubble() {
      const f = L.fanD;
      const lingW = f * 0.5 + 10;
      const left = f * 0.86 + lingW + 4;
      bubble.style.left = left.toFixed(0) + 'px';
      bubble.style.top = (L.portrait ? -f * 0.42 : -f * 0.4).toFixed(0) + 'px';
      const heroLeft = L.hero.x - L.hero.r;
      bubble.style.maxWidth = Math.max(140, Math.min(300, L.W - heroLeft - left - 12)).toFixed(0) + 'px';
    }
    function sizeInk() {
      const r = page.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * L.dpr));
      const h = Math.max(1, Math.round(r.height * L.dpr));
      if (inkCv.width !== w || inkCv.height !== h) { inkCv.width = w; inkCv.height = h; }
      drawInk(S.inkP);
    }

    // ------------------------------------------------------------ 画布素材
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    function glowSprite(rgb) {
      const [c, g] = mk(64, 64);
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return c;
    }
    const GLOW = { silver: glowSprite('200,214,245'), gold: glowSprite('255,205,110'), red: glowSprite('255,70,40'), jade: glowSprite('130,230,195'), white: glowSprite('255,255,255') };
    const glyphCache = new Map();
    function glyph(ch, style) {
      const key = style + ch;
      let c = glyphCache.get(key);
      if (c) return c;
      const s = 64;
      let g;
      [c, g] = mk(s, s);
      g.font = `${s * 0.64}px ${FONT_BRUSH}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (style === 'gold') {
        g.shadowColor = 'rgba(255,180,60,.95)'; g.shadowBlur = 9; g.fillStyle = '#ffd98a';
        g.fillText(ch, s / 2, s / 2 + 2);
        g.shadowBlur = 0; g.fillStyle = 'rgba(255,248,222,.75)'; g.fillText(ch, s / 2, s / 2 + 2);
      } else if (style === 'silver') {
        g.shadowColor = 'rgba(160,185,235,.8)'; g.shadowBlur = 6; g.fillStyle = '#c9d4ea';
        g.fillText(ch, s / 2, s / 2 + 2);
      } else {
        g.fillStyle = '#16120d'; g.fillText(ch, s / 2, s / 2 + 2);
      }
      glyphCache.set(key, c);
      return c;
    }
    function inkBlobPath(g, cx, cy, r, jag, rot) {
      const n = jag.length;
      g.beginPath();
      for (let k = 0; k <= n; k++) {
        const a = rot + k / n * TAU;
        const rr = r * jag[k % n];
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    }
    function splatSprite(seed) {
      const r = rng(seed);
      const [c, g] = mk(128, 128);
      g.fillStyle = '#0b0907';
      const jag = Array.from({ length: 18 }, () => 0.72 + r() * 0.45);
      inkBlobPath(g, 64, 64, 34, jag, r() * TAU);
      g.fill();
      for (let k = 0; k < 5; k++) { // 墨团边缘再鼓出几个小包
        const a = r() * TAU, d = 22 + r() * 10;
        const j2 = Array.from({ length: 10 }, () => 0.75 + r() * 0.4);
        inkBlobPath(g, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 9 + r() * 9, j2, r() * TAU);
        g.fill();
      }
      for (let k = 0; k < 16; k++) { // 溅开的墨点（椭圆，朝外拉长）
        const a = r() * TAU, d = 40 + r() * 20, s = 1.2 + r() * 3.6;
        g.beginPath(); g.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, s * 1.6, s, a, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'destination-out'; // 墨色不匀：挖掉几处，像飞白
      g.globalAlpha = 0.35;
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(44 + r() * 40, 44 + r() * 40, 3 + r() * 7, 0, TAU); g.fill(); }
      return c;
    }
    const SPLATS = [11, 23, 37, 41, 53].map(splatSprite);
    function cloudSprite(seed) {
      const r = rng(seed);
      const [c, g] = mk(256, 256);
      for (let k = 0; k < 9; k++) {
        const x = 128 + (r() - 0.5) * 110, y = 128 + (r() - 0.5) * 70, rad = 40 + r() * 60;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      }
      return c;
    }
    const CLOUDS = [3, 7, 13].map(cloudSprite);
    // 蠹身上的残页：竖排文字、朱丝栏、墨渍与蛀洞
    function pageSprite(seed) {
      const r = rng(seed);
      const w = 120, h = 170;
      const [c, g] = mk(w, h);
      const pts = [];
      const jitter = (a) => (r() - 0.5) * a;
      for (let i = 0; i <= 8; i++) pts.push([i / 8 * w, 5 + jitter(9)]);
      for (let i = 1; i <= 10; i++) pts.push([w - 4 + jitter(7), i / 11 * h]);
      for (let i = 8; i >= 0; i--) pts.push([i / 8 * w, h - 5 + jitter(9)]);
      for (let i = 10; i >= 1; i--) pts.push([4 + jitter(7), i / 11 * h]);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.save();
      g.clip();
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#dccfb0'); gr.addColorStop(0.55, '#c9b894'); gr.addColorStop(1, '#a8946f');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,50,30,.38)'; g.lineWidth = 1;
      for (let x = 11; x < w; x += 17) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 4); g.stroke(); }
      g.font = `12.5px ${FONT_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(28,22,16,.82)';
      for (let col = 0; col < 6; col++) {
        const x = 19.5 + col * 17;
        if (x > w - 6) break;
        for (let row = 0; row < 11; row++) if (r() > 0.14) g.fillText(randChar(r), x, 13 + row * 14.4);
      }
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.62);
      vg.addColorStop(0, 'rgba(12,9,6,0)'); vg.addColorStop(0.7, 'rgba(12,9,6,.35)'); vg.addColorStop(1, 'rgba(12,9,6,.9)');
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 3; k++) {
        const x = r() * w, y = r() * h, s = 6 + r() * 16;
        const bg2 = g.createRadialGradient(x, y, 0, x, y, s);
        bg2.addColorStop(0, 'rgba(10,8,6,.8)'); bg2.addColorStop(1, 'rgba(10,8,6,0)');
        g.fillStyle = bg2; g.fillRect(x - s, y - s, s * 2, s * 2);
      }
      g.globalCompositeOperation = 'destination-out'; // 蛀洞
      for (let k = 0; k < 4 + r() * 4; k++) {
        const x = 8 + r() * (w - 16), y = 8 + r() * (h - 16);
        const jag = Array.from({ length: 9 }, () => 0.6 + r() * 0.6);
        inkBlobPath(g, x, y, 2.5 + r() * 5, jag, r() * TAU);
        g.fill();
      }
      g.restore();
      return c;
    }
    let PAGES = [];

    // ------------------------------------------------------------ 遗忘之蠹
    const M = {
      N: 14, alpha: 0, placed: false,
      head: { x: 0, y: 0 }, tail: { x: 0, y: 0 }, T: 40,
      tHead: { x: 0, y: 0 }, tTail: { x: 0, y: 0 }, tT: 40,
      hurt: 0, flash: 0, frenzy: 0, cracks: 0, dead: false,
      lungeT: -1, lungeDur: 0.55, lungeAmt: 0, lx: 0, ly: 0,
      biteT: -1, bite: 0,
      pts: [], plates: [], segs: [], marks: [],
    };
    for (let i = 0; i < M.N; i++) {
      M.segs.push({
        jag: Array.from({ length: 16 }, () => 0.86 + R() * 0.24),
        sprite: i, rot: (R() - 0.5) * 0.22,
        cracks: Array.from({ length: 2 }, () => Array.from({ length: 5 }, () => [(R() - 0.5) * 1.6, (R() - 0.5) * 1.8])),
      });
    }
    for (let i = 0; i <= M.N; i++) M.pts.push({ x: 0, y: 0 });
    for (let i = 0; i < M.N; i++) M.plates.push({ cx: 0, cy: 0, a: 0, hl: 1, hr: 1 });
    const prof = (u) => (u < 0.1 ? 0.72 + u / 0.1 * 0.28 : 1 - Math.pow((u - 0.1) / 0.9, 1.2) * 0.8);

    function monsterTargets(snap) {
      const Ar = L.A;
      let hx, hy, tx, ty, T;
      if (!L.portrait) {
        tx = Ar.x + Ar.w - Math.max(24, Ar.w * 0.045);
        hx = L.hero.x + L.hero.r + Math.max(46, Ar.w * 0.09);
        const len = Math.min(tx - hx, Ar.h * 2.7);
        hx = tx - Math.max(120, len);
        hy = Ar.y + Ar.h * 0.5;
        ty = hy - Ar.h * 0.07;
        T = clamp(len * 0.085, 18, Ar.h * 0.2);
      } else {
        tx = Ar.x + Ar.w - 6;
        hx = Math.min(L.hero.x + L.hero.r * 0.9 + 20, tx - 120);
        hy = Ar.y + Ar.h * 0.36;
        ty = Ar.y + Ar.h * 0.24;
        T = clamp((tx - hx) * 0.1, 13, Ar.h * 0.17);
      }
      M.tHead = { x: hx, y: hy };
      M.tTail = { x: tx, y: ty };
      M.tT = T;
      if (snap) { M.head = { ...M.tHead }; M.tail = { ...M.tTail }; M.T = T; M.placed = true; }
    }

    function updateMonster(dt, t) {
      const k = Math.min(1, dt * 5);
      M.head.x += (M.tHead.x - M.head.x) * k; M.head.y += (M.tHead.y - M.head.y) * k;
      M.tail.x += (M.tTail.x - M.tail.x) * k; M.tail.y += (M.tTail.y - M.tail.y) * k;
      M.T += (M.tT - M.T) * k;
      M.hurt = Math.max(0, M.hurt - dt * 2.2);
      M.flash = Math.max(0, M.flash - dt * 3.2);
      if (M.lungeT >= 0) {
        M.lungeT += dt;
        const p = M.lungeT / M.lungeDur;
        M.lungeAmt = p < 0.38 ? easeOutCubic(p / 0.38) * 0.62 : p < 0.55 ? 0.62 : p < 1 ? 0.62 * (1 - easeInOutCubic((p - 0.55) / 0.45)) : 0;
        if (p >= 1) { M.lungeT = -1; M.lungeAmt = 0; }
      }
      if (M.biteT >= 0) {
        M.biteT += dt;
        M.bite = Math.sin(Math.min(1, M.biteT / 0.45) * Math.PI);
        if (M.biteT > 0.45) { M.biteT = -1; M.bite = 0; }
      }
      const P = M.pts;
      const N = M.N;
      const hx = M.head.x, hy = M.head.y;
      const dx = M.tail.x - hx, dy = M.tail.y - hy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      const spd = [1.9, 2.3, 3.7][S.phase];
      const amp = len * (0.034 + 0.018 * M.frenzy);
      const bob = Math.sin(t * 0.9) * M.T * 0.22;
      const recoil = M.hurt * len * 0.05;
      const jit = M.T * 0.06 * (M.hurt + M.frenzy * 0.35);
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        let x = hx + dx * u, y = hy + dy * u + bob;
        const w = Math.sin(u * 5.4 - t * spd) * amp * (0.3 + u * 0.9);
        x += nx * w + ux * recoil * (1 - u * 0.6);
        y += ny * w + uy * recoil * (1 - u * 0.6);
        if (M.lungeAmt > 0) { const f = Math.pow(1 - u, 1.7) * M.lungeAmt; x += (M.lx - hx) * f; y += (M.ly - hy) * f; }
        if (M.bite > 0) { const f = Math.pow(1 - u, 2) * M.bite; y += M.T * 0.5 * f; x -= M.T * 0.3 * f; }
        if (jit > 0.01) { x += (R() - 0.5) * jit; y += (R() - 0.5) * jit; }
        P[i].x = x; P[i].y = y;
      }
      for (let i = 0; i < N; i++) {
        const a = P[i], b = P[i + 1];
        const pl = M.plates[i];
        pl.cx = (a.x + b.x) / 2; pl.cy = (a.y + b.y) / 2;
        pl.a = Math.atan2(b.y - a.y, b.x - a.x);
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        pl.hl = seg * 0.74;
        pl.hr = M.T * prof((i + 0.5) / N);
      }
      for (let i = M.marks.length - 1; i >= 0; i--) if (clock - M.marks[i].t0 > 1.9) M.marks.splice(i, 1);
    }

    function platePath(g, pl, sx, sy, jag) {
      const ca = Math.cos(pl.a), sa = Math.sin(pl.a);
      const hl = pl.hl * sx, hr = pl.hr * sy;
      const n = jag.length;
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const th = k / n * TAU;
        const cs = Math.cos(th), sn = Math.sin(th);
        const ex = Math.sign(cs) * Math.pow(Math.abs(cs), 0.8) * hl * jag[k];
        const ey = Math.sign(sn) * Math.pow(Math.abs(sn), 0.8) * hr * jag[k];
        const x = pl.cx + ex * ca - ey * sa, y = pl.cy + ex * sa + ey * ca;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
    }
    function filament(g, x, y, ang, len, w0, t, ph, curl, pass) {
      const n = 16;
      let px = x, py = y;
      const pts = [[x, y]];
      for (let k = 1; k <= n; k++) {
        const s = k / n;
        const a = ang + curl * s + Math.sin(t * 2.3 + ph + s * 3.2) * 0.34 * s;
        px += Math.cos(a) * len / n; py += Math.sin(a) * len / n;
        pts.push([px, py]);
      }
      for (let k = 0; k < n; k++) {
        const s = k / n;
        g.lineWidth = Math.max(pass ? 0.5 : 0.8, w0 * (1 - s * 0.86) * (pass ? 0.4 : 1));
        g.beginPath(); g.moveTo(pts[k][0], pts[k][1]); g.lineTo(pts[k + 1][0], pts[k + 1][1]); g.stroke();
      }
    }
    function drawMonster(g, t) {
      if (M.dead || M.alpha <= 0.01 || !PAGES.length) return;
      const N = M.N, PL = M.plates, P = M.pts;
      const len = Math.hypot(M.tail.x - M.head.x, M.tail.y - M.head.y) || 1;
      const ux = (P[N].x - P[N - 1].x), uy = (P[N].y - P[N - 1].y);
      const tailA = Math.atan2(uy, ux);
      const h0 = PL[0];
      const fwd = h0.a + Math.PI;
      g.save();
      // 银色辉光
      g.globalCompositeOperation = 'lighter';
      const glow = M.frenzy > 0 ? GLOW.red : GLOW.silver;
      for (let i = 0; i < N; i++) {
        const pl = PL[i];
        const rad = pl.hr * 2.5;
        g.globalAlpha = M.alpha * (0.1 + M.hurt * 0.14 + M.frenzy * 0.05);
        g.drawImage(glow, pl.cx - rad, pl.cy - rad, rad * 2, rad * 2);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = M.alpha;
      g.lineCap = 'round';
      // 尾丝三根
      const tx = P[N].x, ty = P[N].y;
      for (const [off, lf, ph] of [[-0.5, 0.3, 0], [0, 0.36, 1.7], [0.5, 0.3, 3.1]]) {
        g.strokeStyle = '#0c0b0a';
        filament(g, tx, ty, tailA + off, len * lf, M.T * 0.1, t, ph, off * 0.4, false);
        g.strokeStyle = M.frenzy ? 'rgba(255,170,150,.55)' : 'rgba(205,215,238,.5)';
        filament(g, tx, ty, tailA + off, len * lf, M.T * 0.1, t, ph, off * 0.4, true);
      }
      // 六足
      g.strokeStyle = 'rgba(160,170,192,.62)';
      for (let i = 1; i <= 3; i++) {
        const pl = PL[i];
        const ca = Math.cos(pl.a), sa = Math.sin(pl.a);
        for (const side of [-1, 1]) {
          const ph = t * (6 + S.phase * 2) + i * 1.7 + (side > 0 ? Math.PI : 0);
          const bx = pl.cx - sa * side * pl.hr * 0.7, by = pl.cy + ca * side * pl.hr * 0.7;
          const kx = bx - sa * side * pl.hr * 0.75 + ca * Math.sin(ph) * pl.hr * 0.35;
          const ky = by + ca * side * pl.hr * 0.75 + sa * Math.sin(ph) * pl.hr * 0.35;
          const fx2 = kx - sa * side * pl.hr * 0.45 + ca * (Math.sin(ph + 0.9) * pl.hr * 0.45 + pl.hr * 0.3);
          const fy2 = ky + ca * side * pl.hr * 0.45 + sa * (Math.sin(ph + 0.9) * pl.hr * 0.45 + pl.hr * 0.3);
          g.lineWidth = Math.max(1, M.T * 0.055);
          g.beginPath(); g.moveTo(bx, by); g.lineTo(kx, ky); g.lineTo(fx2, fy2); g.stroke();
        }
      }
      // 身体：从尾到头叠放的残页
      for (let i = N - 1; i >= 1; i--) {
        const pl = PL[i], sg = M.segs[i];
        g.globalAlpha = M.alpha;
        g.fillStyle = '#0a0908';
        platePath(g, pl, 1.1, 1.07, sg.jag);
        g.fill();
        const sp = PAGES[sg.sprite % PAGES.length];
        g.save();
        g.translate(pl.cx, pl.cy);
        g.rotate(pl.a + sg.rot);
        g.globalAlpha = M.alpha * (0.92 - M.frenzy * 0.22);
        g.drawImage(sp, -pl.hl * 0.95, -pl.hr * 0.9, pl.hl * 1.9, pl.hr * 1.8);
        g.restore();
        g.globalAlpha = M.alpha;
        g.strokeStyle = M.frenzy ? `rgba(255,150,125,${0.3 + M.hurt * 0.4})` : `rgba(212,224,246,${0.26 + M.hurt * 0.45})`;
        g.lineWidth = 1.3;
        platePath(g, pl, 1.1, 1.07, sg.jag);
        g.stroke();
      }
      // 头
      const ca = Math.cos(h0.a), sa = Math.sin(h0.a);
      const hx = h0.cx - ca * h0.hl * 0.25, hy = h0.cy - sa * h0.hl * 0.25;
      const headPl = { cx: hx, cy: hy, a: h0.a, hl: h0.hl * 1.25, hr: h0.hr * 0.98 };
      g.fillStyle = '#0d0c0b';
      platePath(g, headPl, 1, 1, M.segs[0].jag);
      g.fill();
      g.strokeStyle = M.frenzy ? 'rgba(255,150,125,.5)' : 'rgba(215,226,248,.45)';
      g.lineWidth = 1.5;
      g.stroke();
      // 口器
      const fx0 = hx - ca * headPl.hl * 0.95, fy0 = hy - sa * headPl.hl * 0.95;
      g.strokeStyle = 'rgba(190,198,215,.75)';
      g.lineWidth = Math.max(1.2, M.T * 0.07);
      for (const side of [-1, 1]) {
        const open = 0.25 + M.bite * 0.75;
        const bx = fx0 - sa * side * headPl.hr * 0.28, by = fy0 + ca * side * headPl.hr * 0.28;
        const a1 = fwd + side * open;
        const mx = bx + Math.cos(a1) * M.T * 0.32, my = by + Math.sin(a1) * M.T * 0.32;
        const a2 = fwd - side * 0.9;
        g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(mx, my, mx + Math.cos(a2) * M.T * 0.18, my + Math.sin(a2) * M.T * 0.18); g.stroke();
      }
      // 眼
      const eyeCol = M.frenzy ? '#ff6a4a' : '#eaf1ff';
      for (const side of [-1, 1]) {
        const ex = hx - ca * headPl.hl * 0.42 - sa * side * headPl.hr * 0.42;
        const ey = hy - sa * headPl.hl * 0.42 + ca * side * headPl.hr * 0.42;
        const er = Math.max(2, headPl.hr * 0.13);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = M.alpha * 0.8;
        const gs = M.frenzy ? GLOW.red : GLOW.silver;
        g.drawImage(gs, ex - er * 4, ey - er * 4, er * 8, er * 8);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = M.alpha;
        g.fillStyle = eyeCol;
        g.beginPath(); g.ellipse(ex, ey, er * 1.25, er, h0.a, 0, TAU); g.fill();
      }
      // 触角
      for (const side of [-1, 1]) {
        const bx = fx0 - sa * side * headPl.hr * 0.35, by = fy0 + ca * side * headPl.hr * 0.35;
        const ang = fwd + side * 0.42;
        g.strokeStyle = '#0c0b0a';
        filament(g, bx, by, ang, len * 0.52, M.T * 0.11, t * 0.9, side * 1.3, -side * 0.55, false);
        g.strokeStyle = M.frenzy ? 'rgba(255,175,155,.6)' : 'rgba(214,224,246,.55)';
        filament(g, bx, by, ang, len * 0.52, M.T * 0.11, t * 0.9, side * 1.3, -side * 0.55, true);
      }
      // 踪印留下的朱痕
      for (const mk2 of M.marks) {
        const pl = PL[clamp(mk2.i, 0, N - 1)];
        const age = clock - mk2.t0;
        const al = age < 0.1 ? age / 0.1 : 1 - clamp((age - 0.8) / 1.1, 0, 1);
        if (al <= 0) continue;
        const s = Math.min(pl.hr * 1.2, mk2.size);
        g.save();
        g.translate(pl.cx, pl.cy);
        g.rotate(pl.a * 0.3 - 0.12);
        g.globalAlpha = M.alpha * al * 0.9;
        g.fillStyle = mk2.gold ? '#c9331f' : '#b23a2e';
        g.fillRect(-s / 2, -s / 2, s, s);
        g.strokeStyle = mk2.gold ? '#ffe3a0' : 'rgba(255,235,220,.85)';
        g.lineWidth = Math.max(1.5, s * 0.05);
        g.strokeRect(-s / 2 + s * 0.08, -s / 2 + s * 0.08, s * 0.84, s * 0.84);
        g.fillStyle = mk2.gold ? '#fff0c8' : '#fbeee0';
        const chs = [...mk2.text];
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if (chs.length === 1) { g.font = `${s * 0.6}px ${FONT_BRUSH}`; g.fillText(chs[0], 0, s * 0.03); } else {
          g.font = `${s * 0.36}px ${FONT_BRUSH}`;
          g.fillText(chs[0], 0, -s * 0.2); g.fillText(chs[1], 0, s * 0.22);
        }
        g.restore();
      }
      // 受击时的金光
      if (M.flash > 0.02) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,222,150,${M.flash * 0.42})`;
        for (let i = 0; i < N; i++) { platePath(g, PL[i], 1.05, 1.02, M.segs[i].jag); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      }
      // 将碎之时的金色裂纹
      if (M.cracks > 0) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(255,226,160,${Math.min(1, M.cracks * 1.3)})`;
        g.lineWidth = 1.2 + M.cracks * 1.6;
        for (let i = 0; i < N; i++) {
          const pl = PL[i];
          const c2 = Math.cos(pl.a), s2 = Math.sin(pl.a);
          const nLines = M.cracks > 0.5 ? 2 : 1;
          for (let j = 0; j < nLines; j++) {
            const cr = M.segs[i].cracks[j];
            g.beginPath();
            cr.forEach(([ex, ey], k) => {
              const px = pl.cx + ex * pl.hl * 0.9 * c2 - ey * pl.hr * 0.9 * s2;
              const py = pl.cy + ex * pl.hl * 0.9 * s2 + ey * pl.hr * 0.9 * c2;
              if (k) g.lineTo(px, py); else g.moveTo(px, py);
            });
            g.stroke();
          }
        }
        g.globalCompositeOperation = 'source-over';
      }
      g.restore();
    }
    const plateNear = (x, y) => {
      let best = 3, bd = Infinity;
      M.plates.forEach((pl, i) => { const d = (pl.cx - x) ** 2 + (pl.cy - y) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    };

    // ------------------------------------------------------------ 背景
    const mems = [];
    const ash = [];
    const clouds = [];
    function seedBackground() {
      mems.length = 0; ash.length = 0; clouds.length = 0;
      const nm = Math.round(clamp(L.W * L.H / 26000, 14, 40));
      for (let i = 0; i < nm; i++) mems.push(newMem(true));
      for (let i = 0; i < 46; i++) ash.push({ x: R() * L.W, y: R() * L.H, vx: 4 + R() * 10, vy: -4 - R() * 10, s: 0.8 + R() * 2.2, a: 0.15 + R() * 0.3, ph: R() * TAU });
      for (let i = 0; i < 5; i++) clouds.push({ x: R() * L.W, y: L.H * (0.1 + R() * 0.7), s: Math.max(L.W, L.H) * (0.45 + R() * 0.4), vx: (R() < 0.5 ? -1 : 1) * (4 + R() * 7), a: 0.35 + R() * 0.35, sp: CLOUDS[i % CLOUDS.length] });
    }
    function newMem(anyY) {
      return { x: R() * L.W, y: anyY ? R() * L.H : L.H + 20, vy: -(5 + R() * 12), s: 14 + R() * 22, a: 0.05 + R() * 0.14, life: 0, max: 7 + R() * 9, ch: randChar(), ph: R() * TAU };
    }
    function drawBackground(dt, t) {
      const g = bg.g, W = bg.w, H = bg.h;
      if (!bgGrad) {
        bgGrad = g.createRadialGradient(W * 0.55, H * 0.38, 0, W * 0.55, H * 0.38, Math.max(W, H) * 0.8);
        bgGrad.addColorStop(0, '#1b2231'); bgGrad.addColorStop(0.45, '#0c1018'); bgGrad.addColorStop(1, '#030407');
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = bgGrad;
      g.fillRect(0, 0, W, H);
      for (const c of clouds) {
        c.x += c.vx * dt;
        if (c.x < -c.s) c.x = W + c.s * 0.5; else if (c.x > W + c.s) c.x = -c.s * 0.5;
        g.globalAlpha = c.a;
        g.drawImage(c.sp, c.x - c.s / 2, c.y - c.s / 2, c.s, c.s * 0.7);
      }
      for (let i = 0; i < mems.length; i++) {
        const m = mems[i];
        m.life += dt; m.y += m.vy * dt; m.x += Math.sin(t * 0.4 + m.ph) * 5 * dt;
        if (m.life > m.max || m.y < -30) { mems[i] = newMem(false); continue; }
        const a = m.a * Math.sin(Math.PI * m.life / m.max) * (S.awakened ? 0.8 : 1);
        g.globalAlpha = a;
        g.drawImage(glyph(m.ch, S.awakened ? 'gold' : 'silver'), m.x - m.s / 2, m.y - m.s / 2, m.s, m.s);
      }
      g.fillStyle = '#9aa3b5';
      for (const p of ash) {
        p.x += (p.vx + Math.sin(t + p.ph) * 6) * dt; p.y += p.vy * dt;
        if (p.y < -5) { p.y = H + 5; p.x = R() * W; }
        if (p.x > W + 5) p.x = -5;
        g.globalAlpha = p.a;
        g.fillRect(p.x, p.y, p.s, p.s * 0.6);
      }
      g.globalAlpha = 1;
      if (S.awakened) {
        const rad = Math.max(L.fanD * 3.2, 180);
        const gr = g.createRadialGradient(L.hero.x, L.hero.y, 0, L.hero.x, L.hero.y, rad);
        gr.addColorStop(0, 'rgba(255,214,140,.2)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
        g.fillStyle = gr; g.fillRect(L.hero.x - rad, L.hero.y - rad, rad * 2, rad * 2);
      }
      drawMonster(g, t);
      if (M.frenzy > 0 && !M.dead) {
        const pulse = 0.18 + Math.sin(t * 3.4) * 0.06;
        const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, 'rgba(120,10,0,0)'); gr.addColorStop(1, `rgba(120,10,0,${pulse})`);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    }

    // ------------------------------------------------------------ 特效层
    const sparks = [], glyphs = [], drops = [], splats = [], rings = [], texts = [], frags = [];
    function spawnSparks(x, y, n, color, speed = 260) {
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, v = speed * (0.3 + R() * 0.9);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0, max: 0.4 + R() * 0.6, s: 2 + R() * 3.5, c: color });
      }
    }
    function spawnGlyphBurst(x, y, n, chars, speed = 240) {
      const cs = chars.length ? chars : ['史'];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.7, v = speed * (0.35 + R() * 0.9);
        glyphs.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1 + R() * 0.9, s: 16 + R() * 20, ch: cs[i % cs.length], style: 'gold', drag: 2.2, grav: -30 });
      }
    }
    function spawnSuck(fromX, fromY, chars) {
      chars.forEach((ch, i) => {
        glyphs.push({ x: fromX + (R() - 0.5) * 120, y: fromY + (R() - 0.5) * 30, vx: (R() - 0.5) * 40, vy: -40 - R() * 40, life: -i * 0.03, max: 0.9, s: 16 + R() * 8, ch, style: 'gold', suck: true, drag: 0, grav: 0 });
      });
    }
    function ring(x, y, color, max = 0.5, r1 = 120) { rings.push({ x, y, life: 0, max, r1, c: color }); }
    function dmgText(x, y, str, big) {
      texts.push({ x, y, vy: -60, life: 0, max: 1.1, str, s: big ? 44 : 32, big });
    }
    function inkSplash(x, y) {
      const h0 = M.plates[0];
      for (let i = 0; i < 26; i++) {
        const sp = 1.8 + R() * 1.6;
        drops.push({ x: h0.cx, y: h0.cy, vx: (x - h0.cx) * sp + (R() - 0.5) * 300, vy: (y - h0.cy) * sp + (R() - 0.5) * 260 - 60, life: 0, max: 0.3 + R() * 0.3, s: 3 + R() * 7 });
      }
      const n = reduceMotion ? 2 : 5;
      for (let i = 0; i < n; i++) {
        splats.push({ x: x + (R() - 0.5) * L.fanD * 2.4, y: y + (R() - 0.5) * L.fanD * 1.6, s: L.fanD * (0.4 + R() * 0.7), rot: R() * TAU, life: -i * 0.05, max: 1.3 + R() * 0.6, sp: SPLATS[i % SPLATS.length] });
      }
    }
    function shatterMonster() {
      const count = Math.round(clamp(L.W * L.H / 700, 380, 1300));
      const per = Math.ceil(count / M.N);
      let cx = 0, cy = 0;
      M.plates.forEach((pl) => { cx += pl.cx; cy += pl.cy; });
      cx /= M.N; cy /= M.N;
      for (let i = 0; i < M.N; i++) {
        const pl = M.plates[i];
        const ca = Math.cos(pl.a), sa = Math.sin(pl.a);
        for (let k = 0; k < per; k++) {
          const ex = (R() * 2 - 1) * pl.hl, ey = (R() * 2 - 1) * pl.hr * 0.95;
          const x = pl.cx + ex * ca - ey * sa, y = pl.cy + ex * sa + ey * ca;
          const a = Math.atan2(y - cy, x - cx) + (R() - 0.5) * 0.9;
          const v = 60 + R() * 300;
          frags.push({
            x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, rot: R() * TAU, vr: (R() - 0.5) * 9,
            w: 3 + R() * 7, h: 2 + R() * 6, c: R() < 0.62 ? (R() < 0.5 ? '#d6c8a7' : '#bba77f') : '#16120e',
            life: 0, turn: 0.35 + R() * 1.1, gl: 2.2 + R() * 2.2, ch: randChar(), gs: 12 + R() * 16,
            gvy: -(16 + R() * 44), ph: R() * TAU,
          });
        }
      }
      M.dead = true;
    }
    function drawFx(dt) {
      const g = fx.g, W = fx.w, H = fx.h;
      g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt;
        const p = r.life / r.max;
        if (p >= 1) { rings.splice(i, 1); continue; }
        g.globalAlpha = (1 - p) * 0.9;
        g.strokeStyle = r.c;
        g.lineWidth = 2 + (1 - p) * 6;
        g.beginPath(); g.arc(r.x, r.y, 8 + easeOutCubic(p) * r.r1, 0, TAU); g.stroke();
      }
      for (let i = splats.length - 1; i >= 0; i--) {
        const s = splats[i];
        s.life += dt;
        if (s.life < 0) continue;
        const p = s.life / s.max;
        if (p >= 1) { splats.splice(i, 1); continue; }
        const sc = p < 0.08 ? easeOutCubic(p / 0.08) : 1;
        g.globalAlpha = p < 0.55 ? 0.88 : 0.88 * (1 - (p - 0.55) / 0.45);
        g.save(); g.translate(s.x, s.y); g.rotate(s.rot);
        g.drawImage(s.sp, -s.s * sc / 2, -s.s * sc / 2, s.s * sc, s.s * sc);
        g.restore();
      }
      g.fillStyle = '#0b0907';
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life += dt;
        if (d.life > d.max) {
          if (R() < 0.35) splats.push({ x: d.x, y: d.y, s: d.s * 5, rot: R() * TAU, life: 0, max: 0.9 + R() * 0.5, sp: SPLATS[i % SPLATS.length] });
          drops.splice(i, 1); continue;
        }
        d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 600 * dt;
        g.globalAlpha = 0.9;
        g.beginPath(); g.arc(d.x, d.y, d.s, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life > s.max) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - dt * 2.5; s.vy *= 1 - dt * 2.5; s.vy += 80 * dt;
        const a = 1 - s.life / s.max;
        g.globalAlpha = a;
        const gs = GLOW[s.c] || GLOW.gold;
        const r = s.s * 3;
        g.drawImage(gs, s.x - r, s.y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
      const hx = M.plates[0].cx, hy = M.plates[0].cy;
      for (let i = glyphs.length - 1; i >= 0; i--) {
        const q = glyphs[i];
        q.life += dt;
        if (q.life < 0) continue;
        if (q.life > q.max) { glyphs.splice(i, 1); continue; }
        let a;
        if (q.suck) {
          const p = q.life / q.max;
          const k = easeInOutCubic(clamp(p * 1.25, 0, 1));
          q.x = lerp(q.x, hx, k * 0.22); q.y = lerp(q.y, hy, k * 0.22);
          a = p < 0.15 ? p / 0.15 : 1 - clamp((p - 0.75) / 0.25, 0, 1);
        } else {
          q.x += q.vx * dt; q.y += q.vy * dt;
          q.vx *= 1 - dt * q.drag; q.vy *= 1 - dt * q.drag; q.vy += q.grav * dt;
          const p = q.life / q.max;
          a = p < 0.1 ? p / 0.1 : 1 - clamp((p - 0.5) / 0.5, 0, 1);
        }
        g.globalAlpha = a;
        g.drawImage(glyph(q.ch, q.style), q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      if (frags.length) {
        for (let i = frags.length - 1; i >= 0; i--) {
          const f = frags[i];
          f.life += dt;
          const tEnd = f.turn + 0.45 + f.gl;
          if (f.life > tEnd) { frags.splice(i, 1); continue; }
          const b = clamp((f.life - f.turn) / 0.45, 0, 1);
          if (b < 1) {
            f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - dt * 1.9; f.vy *= 1 - dt * 1.9; f.vy += 26 * dt; f.rot += f.vr * dt;
            g.globalAlpha = 1 - b;
            const c = Math.cos(f.rot), s = Math.sin(f.rot);
            g.setTransform(L.dpr * c, L.dpr * s, -L.dpr * s, L.dpr * c, L.dpr * f.x, L.dpr * f.y);
            g.fillStyle = f.c;
            g.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
            g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
          } else {
            f.vy += (f.gvy - f.vy) * Math.min(1, dt * 2); f.vx *= 1 - dt * 2;
            f.x += (f.vx + Math.sin(clock * 1.3 + f.ph) * 10) * dt; f.y += f.vy * dt;
          }
          if (b > 0) {
            const gp = (f.life - f.turn - 0.45) / f.gl;
            g.globalAlpha = b * (gp > 0.5 ? 1 - (gp - 0.5) / 0.5 : 1);
            g.drawImage(glyph(f.ch, 'gold'), f.x - f.gs / 2, f.y - f.gs / 2, f.gs, f.gs);
          }
        }
      }
      for (let i = texts.length - 1; i >= 0; i--) {
        const t2 = texts[i];
        t2.life += dt;
        if (t2.life > t2.max) { texts.splice(i, 1); continue; }
        t2.y += t2.vy * dt; t2.vy *= 1 - dt * 2;
        const p = t2.life / t2.max;
        const sc = p < 0.15 ? 1.5 - easeOutCubic(p / 0.15) * 0.5 : 1;
        g.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        g.font = `${t2.s * sc}px ${FONT_BRUSH}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 5; g.strokeStyle = 'rgba(40,20,0,.85)'; g.lineJoin = 'round';
        g.strokeText(t2.str, t2.x, t2.y);
        g.fillStyle = t2.big ? '#fff1c2' : '#ffd98a';
        g.fillText(t2.str, t2.x, t2.y);
      }
      g.globalAlpha = 1;
    }

    // ------------------------------------------------------------ 残页上的墨渍（倒计时）
    let inkPlan = [];
    function newInkPlan() {
      inkPlan = [];
      for (let j = 0; j < 16; j++) {
        const e = R();
        let ax, ay;
        if (e < 0.5) { ax = 1.01; ay = R(); } else if (e < 0.78) { ax = 0.5 + R() * 0.5; ay = -0.03; } else { ax = 0.55 + R() * 0.45; ay = 1.03; }
        inkPlan.push({ ax, ay, s: R() * 0.62, r: 0.16 + R() * 0.24, jag: Array.from({ length: 13 }, () => 0.72 + R() * 0.5), rot: R() * TAU });
      }
    }
    function drawInk(p) {
      const g = inkG, w = inkCv.width, h = inkCv.height;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      if (p <= 0.001) return;
      const base = Math.min(w, h * 2.3);
      for (const b of inkPlan) {
        const k = clamp((p - b.s) / (1 - b.s), 0, 1);
        if (k <= 0) continue;
        const r = b.r * base * easeOutCubic(k);
        g.fillStyle = 'rgba(20,15,10,.22)';
        inkBlobPath(g, b.ax * w, b.ay * h, r * 1.3, b.jag, b.rot);
        g.fill();
        g.fillStyle = 'rgba(20,15,10,.86)';
        inkBlobPath(g, b.ax * w, b.ay * h, r, b.jag, b.rot + 0.4);
        g.fill();
      }
      if (p > 0.72) {
        const k = (p - 0.72) / 0.28;
        const gr = g.createLinearGradient(w, 0, w * 0.2, 0);
        gr.addColorStop(0, `rgba(20,15,10,${0.55 * k})`); gr.addColorStop(1, 'rgba(20,15,10,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    }
    function tornClip() {
      const pts = [];
      const nx = 24;
      for (let i = 0; i <= nx; i++) pts.push([i / nx * 100, R() * 2.4]);
      for (let i = 1; i < 6; i++) pts.push([100 - R() * 0.8, i / 6 * 100]);
      for (let i = nx; i >= 0; i--) pts.push([i / nx * 100, 100 - R() * 2.8]);
      for (let i = 5; i > 0; i--) pts.push([R() * 0.7, i / 6 * 100]);
      return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`;
    }

    // ------------------------------------------------------------ 界面小件
    let lastHover = 0;
    const hoverSfx = () => { const n = performance.now(); if (n - lastHover > 90) { lastHover = n; ctx.sfx('hover'); } };
    function setHud() {
      ctx.hud({ center: `第 ${Math.max(1, S.asked)} 问 · ${PHASE_NAME[S.phase]}`, right: `得分 ${S.score}` });
    }
    function updateHp(hit) {
      const pct = clamp(S.hp / HP_MAX * 100, 0, 100);
      hpFill.style.width = pct + '%';
      hpGhost.style.width = pct + '%';
      if (hit) { hpEl.classList.remove('hit'); void hpEl.offsetWidth; hpEl.classList.add('hit'); }
    }
    function updateHintBtn() {
      hintN.textContent = S.hints > 0 ? `×${S.hints}` : '';
      const usable = S.hints > 0 && current && !current.locked && !current.erased.size;
      hintBtn.disabled = !usable;
      hintBtn.classList.toggle('ready', !!usable);
      hintBtn.style.display = (S.hints > 0 || S.awakened || easy) ? '' : 'none';
    }
    function say(text, ms = 2800) {
      bubble.textContent = text;
      bubble.classList.add('show');
      ling.classList.remove('cheer'); void ling.offsetWidth; ling.classList.add('cheer');
      S.sayUntil = clock + ms / 1000;
    }
    function banner(big, small, kind, ms) {
      const b = el('div', 'quiz-banner in' + (kind ? ' ' + kind : ''), cardLayer);
      el('span', 'big', b, big);
      if (small) el('span', 'small', b, small);
      later(ms, () => { b.classList.remove('in'); b.classList.add('out'); later(480, () => b.remove()); });
      return b;
    }
    function shake(amp) { S.shakeAmp = Math.max(S.shakeAmp, amp * (reduceMotion ? 0.3 : 1)); }
    function updateShake(dt) {
      if (S.shakeAmp < 0.3) { if (S.shakeAmp) { S.shakeAmp = 0; shakeEl.style.transform = ''; } return; }
      S.shakeT += dt;
      const a = S.shakeAmp;
      const x = Math.sin(S.shakeT * 71) * a * 0.8 + (R() - 0.5) * a * 0.5;
      const y = Math.cos(S.shakeT * 53) * a * 0.6 + (R() - 0.5) * a * 0.4;
      shakeEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(x * 0.02).toFixed(3)}deg)`;
      S.shakeAmp *= Math.pow(0.02, dt);
    }
    function lightLamp(i, quiet) {
      const l = lampEls[i];
      if (!l) return;
      l.classList.remove('out', 'dying');
      l.classList.add('lit-in');
      later(700, () => l.classList.remove('lit-in'));
      if (!quiet) ctx.sfx('lamp_on');
    }
    function loseLamp() {
      if (S.lamps <= 0) return;
      S.lamps--; S.lampsLost++;
      const l = lampEls[S.lamps];
      l.classList.add('dying');
      later(850, () => l.classList.add('out'));
      ctx.sfx('lamp_off');
      const r = l.getBoundingClientRect(), rr = root.getBoundingClientRect();
      spawnSparks(r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2, 10, 'gold', 90);
    }
    function sealText(q) {
      if (q && q.chapter >= 1 && q.chapter <= 5) return SEAL_CHARS[q.chapter - 1] || '印';
      return '印';
    }
    function makeSeal(text, size, gold) {
      const s = el('div', 'quiz-seal' + (gold ? ' gold' : ''));
      s.style.width = s.style.height = size.toFixed(0) + 'px';
      const chs = [...text];
      if (chs.length <= 1) { s.textContent = text; s.style.fontSize = (size * 0.62).toFixed(0) + 'px'; } else if (chs.length === 2) {
        s.classList.add('v2'); s.textContent = text; s.style.fontSize = (size * 0.4).toFixed(0) + 'px';
      } else {
        s.classList.add('v4');
        for (const ch of [chs[2], chs[0], chs[3], chs[1]]) el('span', '', s, ch || '');
        s.style.fontSize = (size * 0.33).toFixed(0) + 'px';
      }
      return s;
    }
    const blurActive = () => { try { const a = document.activeElement; if (a && root.contains(a)) a.blur(); } catch { /* ignore */ } };

    // ------------------------------------------------------------ 出题 / 作答
    function showQuestion(q) {
      const order = shuffle([0, 1, 2, 3], R);
      current = { q, order, correctPos: order.indexOf(q.answer), erased: new Set(), locked: false };
      qnum.textContent = `第${S.asked <= 99 ? cnNum(S.asked) : S.asked}问`;
      tag.textContent = CH_TAG[q.chapter] || '';
      qText.textContent = q.q;
      optBtns.forEach((b, i) => { b._t.textContent = q.options[order[i]]; b.className = 'quiz-opt'; b.disabled = false; });
      updateOneCol();
      const clip = tornClip();
      pageBg.style.clipPath = clip; pageBg.style.webkitClipPath = clip;
      inkCv.style.clipPath = clip; inkCv.style.webkitClipPath = clip;
      newInkPlan();
      S.inkP = 0; S.inkTarget = 0;
      S.tTotal = CFG.time[S.phase]; S.tLeft = S.tTotal; S.lastSec = -1;
      timerEl.textContent = String(S.tTotal);
      timerEl.classList.remove('urgent');
      updateHintBtn();
      setHud();
    }
    function waitAnswer() {
      return waitFor((finish) => {
        S.timerOn = true;
        const choose = (pos) => {
          if (!current || current.locked || current.erased.has(pos)) return;
          finish({ pos, timeout: false });
        };
        optBtns.forEach((b, i) => { b.onclick = () => choose(i); b.onpointerenter = hoverSfx; });
        hintBtn.onclick = () => useHint();
        const off = ctx.keys.onDown((code, e) => {
          if (hostPaused()) return;
          const m = /^(?:Digit|Numpad)([1-4])$/.exec(code);
          if (m) { if (e && e.preventDefault) e.preventDefault(); choose(+m[1] - 1); } else if (code === 'KeyH') useHint();
        });
        S.onTimeout = () => finish({ pos: -1, timeout: true });
        return () => {
          S.timerOn = false; S.onTimeout = null;
          if (current) current.locked = true;
          off();
          optBtns.forEach((b) => { b.onclick = null; b.onpointerenter = null; b.disabled = true; });
          hintBtn.onclick = null;
          updateHintBtn();
          blurActive();
        };
      });
    }
    function useHint() {
      if (!current || current.locked || S.hints <= 0 || current.erased.size) return;
      S.hints--; S.hintsUsed++;
      const wrong = [0, 1, 2, 3].filter((p) => p !== current.correctPos);
      const pick = shuffle(wrong, R).slice(0, 2);
      current.erased = new Set(pick);
      pick.forEach((p, k) => later(120 + k * 200, () => {
        optBtns[p].classList.add('is-erased');
        optBtns[p].disabled = true;
        const r = optBtns[p].getBoundingClientRect(), rr = root.getBoundingClientRect();
        spawnSparks(r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2, 14, 'jade', 160);
      }));
      ctx.sfx('magic');
      say(LINES.hint, 2200);
      updateHintBtn();
    }
    function updateTimer(dt) {
      if (!S.timerOn) {
        if (Math.abs(S.inkP - S.inkTarget) > 0.002) { S.inkP += (S.inkTarget - S.inkP) * Math.min(1, dt * 5); drawInk(S.inkP); }
        return;
      }
      if (hostPaused()) return;
      S.tLeft -= dt;
      const sec = Math.max(0, Math.ceil(S.tLeft));
      if (sec !== S.lastSec) {
        S.lastSec = sec;
        timerEl.textContent = String(sec);
        const urgent = sec <= 5;
        timerEl.classList.toggle('urgent', urgent);
        if (urgent && sec > 0) ctx.sfx('tick');
      }
      S.inkP = clamp(1 - S.tLeft / S.tTotal, 0, 1);
      drawInk(S.inkP);
      if (S.tLeft <= 0 && S.onTimeout) S.onTimeout();
    }

    function monsterBitePoint() {
      const i = 2 + Math.floor(R() * 4);
      const pl = M.plates[i];
      return { x: pl.cx, y: pl.cy, i };
    }

    async function nextPage(q) {
      page.classList.add('swap');
      await wait(200);
      M.biteT = 0;
      ctx.sfx('squish');
      const pr = page.getBoundingClientRect(), rr = root.getBoundingClientRect();
      spawnSuck(pr.left - rr.left + pr.width * 0.5, pr.top - rr.top + 10, charsOf(q.options[q.answer] + codexById[q.codex].title).slice(0, 8));
      showQuestion(q);
      page.classList.remove('swap', 'away');
      page.classList.remove('enter'); void page.offsetWidth; page.classList.add('enter');
      ctx.sfx('page');
      later(700, () => page.classList.remove('enter'));
      await wait(320);
    }

    async function sealAttack(q, dmg, big) {
      const text = sealText(q);
      const tgt = monsterBitePoint();
      const size = (L.portrait ? 46 : 66) * (big ? 1.35 : 1) * (S.awakened ? 1.12 : 1);
      const gold = S.awakened || big;
      const s = makeSeal(text, size, gold);
      fxDom.appendChild(s);
      const from = { x: L.hero.x, y: L.hero.y };
      const midX = lerp(from.x, tgt.x, 0.55);
      const midY = Math.min(from.y, tgt.y) - Math.max(40, L.A.h * 0.24);
      const kf = (x, y, sc, r, o) => ({ transform: `translate(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px) scale(${sc}) rotate(${r}deg)`, opacity: o });
      const dur = 540 / TS;
      hero.classList.remove('strike'); void hero.offsetWidth; hero.classList.add('strike');
      ctx.sfx('whoosh');
      s.animate([
        kf(from.x, from.y, 0.3, -30, 0),
        { ...kf(from.x, from.y - 24, 1.05, -18, 1), offset: 0.16 },
        { ...kf(midX, midY, 1.5, -8, 1), offset: 0.6 },
        { ...kf(tgt.x, tgt.y, 0.86, -6, 1), offset: 0.9 },
        kf(tgt.x, tgt.y, 1, -6, 1),
      ], { duration: dur, easing: 'ease-in', fill: 'forwards' });
      await wait(540 * 0.9);
      // 落印
      ctx.sfx('stamp');
      ctx.sfx(big ? 'perfect' : 'hit');
      if (S.awakened) ctx.sfx('seal');
      const pl = M.plates[tgt.i];
      const hitX = pl.cx, hitY = pl.cy;
      shake(big ? 17 : 10);
      M.hurt = 1; M.flash = 1;
      M.marks.push({ i: tgt.i, t0: clock, text, gold, size: size * 0.9 });
      const chars = charsOf(q.options[q.answer] + codexById[q.codex].title + q.explain);
      spawnGlyphBurst(hitX, hitY, big ? 34 : 20, shuffle(chars, R));
      spawnSparks(hitX, hitY, big ? 46 : 26, gold ? 'gold' : 'white', big ? 360 : 260);
      ring(hitX, hitY, gold ? 'rgba(255,214,120,1)' : 'rgba(255,240,225,1)', 0.5, big ? 170 : 110);
      if (big) ring(hitX, hitY, 'rgba(212,81,63,1)', 0.7, 240);
      const shown = Math.round(dmg);
      dmgText(hitX, hitY - pl.hr - 10, `-${shown}`, big);
      S.hp = Math.max(0, S.hp - dmg);
      updateHp(true);
      s.animate([{ opacity: 1, transform: s.style.transform || getComputedStyle(s).transform }, { opacity: 0 }], { duration: 260 / TS, fill: 'forwards', composite: 'replace' });
      later(300, () => s.remove());
    }

    function showRestore(q) {
      const d = el('div', 'quiz-restore', cardLayer);
      el('b', '', d, '— 复 原 —');
      d.appendChild(document.createTextNode(q.explain));
      const y = L.portrait ? L.A.y + Math.max(46, L.A.h * 0.2) : L.A.y + L.A.h * 0.84;
      d.style.top = y.toFixed(0) + 'px';
      later(2400, () => d.remove());
    }

    async function showCard(q, res) {
      const c = el('div', 'quiz-card', cardLayer);
      const topRow = el('div', 'quiz-card-top', c);
      el('span', 'quiz-card-title', topRow, res.timeout ? '时辰已到——' : '蠹吞掉的是——');
      const ans = el('div', 'quiz-card-ans', c);
      el('b', '', ans, '正解');
      ans.appendChild(document.createTextNode(q.options[q.answer]));
      el('div', 'quiz-card-exp', c, q.explain);
      const src = el('div', 'quiz-card-src', c, '——见《金陵志 · ');
      el('em', '', src, codexById[q.codex] ? codexById[q.codex].title : '');
      src.appendChild(document.createTextNode('》'));
      const foot = el('div', 'quiz-card-foot', c);
      el('small', '', foot, ctx.isTouch ? '点“继续”翻页' : '回车 / 空格 继续');
      const btn = el('button', 'jl-btn primary', foot, '继 续');
      btn.type = 'button';
      // 让卡片落在战场中央，但不越出舞台
      const ch = c.getBoundingClientRect().height;
      const cy = clamp(L.A.y + L.A.h * 0.5, ch / 2 + 6, L.H - ch / 2 - 6);
      c.style.top = cy.toFixed(0) + 'px';
      ctx.sfx('open');
      await waitFor((finish) => {
        let armed = false;
        later(350, () => { armed = true; });
        btn.onclick = () => finish();
        const off = ctx.keys.onDown((code) => { if (armed && !hostPaused() && (code === 'Enter' || code === 'Space' || code === 'NumpadEnter')) finish(); });
        setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch { /* ignore */ } }, 60);
        return () => { off(); btn.onclick = null; };
      });
      ctx.sfx('page');
      c.classList.add('out');
      later(240, () => c.remove());
      await wait(120);
    }

    async function onCorrect(res) {
      const q = current.q;
      S.correct++; S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      optBtns[res.pos].classList.add('is-right');
      optBtns.forEach((b, i) => { if (i !== res.pos) b.classList.add('is-dim'); });
      ctx.sfx('good');
      S.inkTarget = 0;
      const comboHit = S.combo % 3 === 0;
      const quick = S.tLeft / S.tTotal > 0.6;
      const base = S.awakened ? 75 : 60;
      const bonus = comboHit ? (S.awakened ? 60 : 50) : 0;
      const dmg = (base + bonus + (quick ? 10 : 0)) * CFG.dmgMul;
      S.score += 100 + Math.round(Math.max(0, S.tLeft) * 4) + (S.combo - 1) * 20 + (comboHit ? 80 : 0);
      setHud();
      await sealAttack(q, dmg, comboHit);
      showRestore(q);
      if (comboHit) {
        banner(`${cnNum(S.combo)}连`, '踪印连环', 'combo', 1200);
        say(LINES.combo[Math.floor(R() * LINES.combo.length)], 2000);
      }
      await waitOrTap(1900);
    }

    async function onWrong(res) {
      const q = current.q;
      S.wrong++; S.combo = 0;
      S.missed.add(q.codex);
      if (res.timeout) { S.timeouts++; ctx.sfx('error'); page.classList.remove('shiver'); void page.offsetWidth; page.classList.add('shiver'); } else {
        optBtns[res.pos].classList.add('is-wrong');
        ctx.sfx('bad');
      }
      optBtns[current.correctPos].classList.add('is-answer');
      optBtns.forEach((b, i) => { if (i !== current.correctPos && i !== res.pos) b.classList.add('is-dim'); });
      S.inkTarget = 1;
      await wait(420);
      // 蠹扑上来
      ctx.sfx('swoosh'); ctx.sfx('scurry');
      M.lx = L.hero.x; M.ly = L.hero.y; M.lungeT = 0; M.lungeDur = 0.6;
      await wait(250);
      ctx.sfx('squish'); ctx.sfx('hurt'); ctx.sfx('ink');
      shake(15);
      inkSplash(L.hero.x, L.hero.y);
      hero.classList.remove('hurt'); void hero.offsetWidth; hero.classList.add('hurt');
      loseLamp();
      setHud();
      await wait(620);
      if (S.lamps === 1 && !S.lastLampSaid) { S.lastLampSaid = true; say(LINES.lastLamp, 3200); } else if (res.timeout) say(LINES.timeout, 2400);
      else if (!S.wrongSaid) { S.wrongSaid = true; say(LINES.firstWrong, 3200); } else if (R() < 0.45) say(LINES.wrong[Math.floor(R() * LINES.wrong.length)], 2400);
      await showCard(q, res);
    }

    // ------------------------------------------------------------ 五印合一
    let cut = null;
    async function cutinAwaken() {
      S.timerOn = false;
      ctx.sfx('magic'); ctx.sfx('bell');
      const ov = el('div', 'qc-cutin' + (L.portrait ? ' qc-portrait' : ''), root);
      el('div', 'qc-bg', ov);
      el('div', 'qc-rays', ov);
      el('div', 'qc-halo', ov);
      const pc = el('canvas', '', ov);
      const fig = el('img', 'qc-figure', ov);
      fig.alt = '';
      fig.draggable = false;
      if (A.outfit) fig.src = A.outfit;
      const sealsWrap = el('div', 'qc-seals', ov);
      el('div', 'qc-title', ov, '五印合一');
      const lines = el('div', 'qc-lines', ov);
      const flash = el('div', 'qc-flash', ov);
      const skip = el('div', 'qc-skip', ov, ctx.isTouch ? '轻触继续' : '点击 / 回车继续');
      const r0 = pc.getBoundingClientRect();
      pc.width = Math.round(r0.width * L.dpr); pc.height = Math.round(r0.height * L.dpr);
      cut = { g: pc.getContext('2d'), w: r0.width, h: r0.height, petals: [], acc: 0 };
      const minWH = Math.min(L.W, L.H);
      const size = clamp(minWH * 0.13, 40, 78);
      const rad = L.portrait ? minWH * 0.3 : minWH * 0.33;
      const sealEls = SEAL_CHARS.map((txt, k) => {
        const a = -Math.PI / 2 + k * TAU / 5;
        const s = makeSeal(txt, size, false);
        s.classList.add('qc-seal');
        s.style.opacity = '0';
        sealsWrap.appendChild(s);
        const x = Math.cos(a) * rad - size / 2, y = Math.sin(a) * rad - size / 2;
        later(500 + k * 230, () => {
          s.style.opacity = '';
          s.animate([
            { transform: `translate(${x}px, ${y}px) scale(2.4) rotate(-16deg)`, opacity: 0 },
            { transform: `translate(${x}px, ${y}px) scale(.92) rotate(-6deg)`, opacity: 1, offset: 0.6 },
            { transform: `translate(${x}px, ${y}px) scale(1) rotate(-7deg)`, opacity: 1 },
          ], { duration: 460, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
          ctx.sfx('stamp');
        });
        return { s, x, y, k };
      });
      later(2050, () => {
        ctx.sfx('whoosh');
        for (const { s, x, y, k } of sealEls) {
          s.animate([
            { transform: `translate(${x}px, ${y}px) scale(1) rotate(-7deg)`, opacity: 1 },
            { transform: `translate(${-size / 2}px, ${-size / 2}px) scale(.35) rotate(${200 + k * 20}deg)`, opacity: 0.9 },
          ], { duration: 520, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' });
        }
      });
      later(2560, () => {
        sealEls.forEach(({ s }) => s.remove());
        flash.classList.add('go');
        ctx.sfx('sparkle'); ctx.sfx('chime');
        const big = makeSeal('明', size * 1.5, true);
        big.classList.add('qc-seal');
        sealsWrap.appendChild(big);
        big.animate([
          { transform: `translate(${-size * 0.75}px, ${-size * 0.75}px) scale(.3)`, opacity: 0 },
          { transform: `translate(${-size * 0.75}px, ${-size * 0.75}px) scale(1.25)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${-size * 0.75}px, ${-size * 0.75}px) scale(1)`, opacity: 1 },
        ], { duration: 700, easing: 'ease-out', fill: 'forwards' });
        for (let i = 0; i < 40; i++) cut.petals.push(newPetal(true, true));
      });
      const textLines = ['历史不会被遗忘——', '因为有人记得。'];
      let delay = 2.75;
      textLines.forEach((ln) => {
        const span = el('span', 'ln', lines);
        for (const ch of ln) {
          const c = el('span', 'ch' + (ch === '—' ? ' dash' : ''), span, ch);
          c.style.animationDelay = delay.toFixed(2) + 's';
          delay += ch === '—' ? 0.05 : 0.13;
        }
        delay += 0.35;
      });
      later(1600, () => skip.classList.add('on'));
      const t0 = clock;
      await waitFor((finish) => {
        const id = later(6600, finish);
        const tap = () => { if (clock - t0 > 1.6) finish(); };
        ov.addEventListener('pointerdown', tap);
        const off = ctx.keys.onDown((code) => { if (!hostPaused() && (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') && clock - t0 > 1.6) finish(); });
        return () => { cancelLater(id); ov.removeEventListener('pointerdown', tap); off(); };
      });
      // 回到战场
      S.awakened = true;
      hero.classList.add('awake');
      imgMain.style.filter = 'brightness(1.04) saturate(1.05)';
      ctx.sfx('sparkle');
      ov.classList.add('out');
      later(520, () => { ov.remove(); cut = null; });
      spawnSparks(L.hero.x, L.hero.y, 40, 'gold', 300);
      ring(L.hero.x, L.hero.y, 'rgba(255,220,140,1)', 0.8, L.fanD * 1.4);
      await wait(420);
      say(LINES.awaken, 4200);
    }
    function newPetal(anyY, burst) {
      const w = cut ? cut.w : L.W, h = cut ? cut.h : L.H;
      const gold = R() < 0.3;
      return {
        x: burst ? w * (L.portrait ? 0.5 : 0.42) : R() * w * 1.1 - w * 0.05,
        y: burst ? h * 0.4 : (anyY ? R() * h : -20),
        vx: burst ? (R() - 0.5) * 520 : 18 + R() * 40, vy: burst ? (R() - 0.7) * 420 : 30 + R() * 50,
        rot: R() * TAU, vr: (R() - 0.5) * 4, s: 5 + R() * 7, life: 0, max: burst ? 1.6 + R() : 6 + R() * 4,
        c: gold ? '#f3cf7c' : (R() < 0.5 ? '#ffffff' : '#ffe1ea'), ph: R() * TAU, burst,
      };
    }
    function drawCut(dt) {
      const c = cut;
      const g = c.g;
      g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      g.clearRect(0, 0, c.w, c.h);
      c.acc += dt;
      while (c.acc > 0.06) { c.acc -= 0.06; if (c.petals.length < 90) c.petals.push(newPetal(false, false)); }
      for (let i = c.petals.length - 1; i >= 0; i--) {
        const p = c.petals[i];
        p.life += dt;
        if (p.life > p.max || p.y > c.h + 30) { c.petals.splice(i, 1); continue; }
        if (p.burst) { p.vx *= 1 - dt * 1.6; p.vy = p.vy * (1 - dt * 1.6) + 60 * dt; }
        p.x += (p.vx + Math.sin(clock * 1.7 + p.ph) * 20) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const a = Math.min(1, p.life * 3) * (p.burst ? 1 - p.life / p.max : 1);
        g.save();
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.globalAlpha = a * 0.9;
        g.fillStyle = p.c;
        g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55 * Math.abs(Math.sin(clock * 2 + p.ph)) + p.s * 0.15, 0, 0, TAU); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
    }

    async function cutinFrenzy() {
      S.timerOn = false;
      ctx.sfx('gong'); ctx.sfx('crack'); ctx.sfx('scurry');
      const ov = el('div', 'qc-frenzy', root);
      el('div', 'qf-bg', ov);
      M.frenzy = 1;
      boss.classList.add('frenzy');
      shake(22);
      const h0 = M.plates[0];
      for (let i = 0; i < 4; i++) splats.push({ x: h0.cx + (R() - 0.5) * L.W * 0.5, y: h0.cy + (R() - 0.5) * L.H * 0.4, s: L.fanD * (0.6 + R() * 0.8), rot: R() * TAU, life: -i * 0.08, max: 1.6, sp: SPLATS[i % SPLATS.length] });
      spawnSparks(h0.cx, h0.cy, 30, 'red', 320);
      banner('蠹 · 狂', '它吞噬得更快了——', 'red', 1500);
      await wait(1900);
      ov.remove();
      say(LINES.frenzy, 3200);
    }

    async function toPhase(p) {
      S.phase = p;
      phaseEl.textContent = PHASE_NAME[p];
      setHud();
      page.classList.add('away');
      if (p === 1) await cutinAwaken(); else await cutinFrenzy();
      S.hints = Math.min(2, S.hints + (CFG.hintsGain[p] || 0));
      updateHintBtn();
      setHud();
    }

    // ------------------------------------------------------------ 胜负
    async function victorySeq() {
      S.over = true;
      page.classList.add('away');
      ctx.sfx('crack');
      const t0 = clock;
      await waitFor((finish) => {
        const tick = () => {
          M.cracks = clamp((clock - t0) / 0.9, 0, 1);
          shake(3 + M.cracks * 5);
          if (M.cracks >= 1) finish(); else later(40, tick);
        };
        tick();
      });
      ctx.sfx('shatter'); ctx.sfx('firework');
      shake(26);
      const h0 = M.plates[Math.floor(M.N / 3)];
      ring(h0.cx, h0.cy, 'rgba(255,230,170,1)', 0.8, Math.max(L.W, L.H) * 0.6);
      shatterMonster();
      boss.classList.add('hidden');
      const veil = el('div', 'quiz-veil dawn', cardLayer);
      later(30, () => veil.classList.add('on'));
      imgSmile.classList.add('on');
      await wait(900);
      ctx.sfx('sparkle'); ctx.sfx('chime');
      banner('千字归来', '被吞下的历史，一字一字，回来了。', 'gold', 3300);
      say(LINES.win, 3400);
      await wait(700);
      await waitOrTap(2800);
    }
    async function defeatSeq() {
      S.over = true;
      page.classList.add('away');
      ctx.sfx('ink'); ctx.sfx('wave');
      M.lx = L.hero.x; M.ly = L.hero.y; M.lungeT = 0; M.lungeDur = 0.9;
      await wait(350);
      inkSplash(L.hero.x, L.hero.y);
      shake(18);
      const veil = el('div', 'quiz-veil dusk', cardLayer);
      later(30, () => veil.classList.add('on'));
      banner('心灯尽熄', '……可你记得的，它夺不走。', '', 2600);
      say(LINES.lose, 2800);
      await wait(600);
      await waitOrTap(2400);
    }

    // ------------------------------------------------------------ 启动
    const imgs = [portraitSerious, portraitSmile, A.outfit].filter(Boolean);
    await Promise.race([
      Promise.all(imgs.map((u) => loadImage(u).catch(() => null))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
    if (document.fonts && document.fonts.load) {
      try {
        await Promise.race([
          document.fonts.load(`40px ${FONT_BRUSH}`, '问史遗忘之蠹康晔千字归来心灯尽熄'),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      } catch { /* ignore */ }
    }
    if (ctx.signal.aborted) throw new DOMException('aborted', 'AbortError');
    PAGES = [101, 202, 303, 404, 505, 606, 707].map(pageSprite);
    layout();
    seedBackground();
    ctx.onResize(() => { layout(); });
    updateHp(false);
    setHud();

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      window.__quiz = {
        get state() { return { hp: S.hp, phase: S.phase, lamps: S.lamps, asked: S.asked, correct: S.correct, wrong: S.wrong, combo: S.combo, hints: S.hints, score: S.score, waiting: !!(current && !current.locked && S.timerOn), over: S.over }; },
        answer(ok = true) {
          if (!current || current.locked || !S.timerOn) return false;
          const pos = ok ? current.correctPos : [0, 1, 2, 3].find((p) => p !== current.correctPos && !current.erased.has(p));
          optBtns[pos].click();
          return true;
        },
        hint: () => useHint(),
        speed: (v) => { TS = clamp(+v || 1, 0.1, 8); },
        timeout: () => { if (S.timerOn) S.tLeft = 0.01; },
      };
    }

    ctx.loop((dtRaw, t) => {
      const dt = dtRaw * TS;
      clock += dt;
      updateTimer(dt);
      updateMonster(dt, clock);
      updateShake(dt);
      if (S.sayUntil && clock > S.sayUntil) { S.sayUntil = 0; bubble.classList.remove('show'); }
      drawBackground(dt, clock);
      drawFx(dt);
      if (cut) drawCut(dt);
    });

    // 开场：蠹自墨中浮现，心灯一盏盏亮起
    ctx.sfx('drum');
    const tIntro = clock;
    const fadeIn = () => { M.alpha = clamp((clock - tIntro) / 1.3, 0, 1); if (M.alpha < 1) later(30, fadeIn); };
    fadeIn();
    later(150, () => {
      const pl = M.plates[4];
      for (let i = 0; i < 4; i++) splats.push({ x: pl.cx + (R() - 0.5) * M.T * 6, y: pl.cy + (R() - 0.5) * M.T * 3, s: M.T * (1.4 + R() * 1.4), rot: R() * TAU, life: -i * 0.1, max: 1.4, sp: SPLATS[i % SPLATS.length] });
      ctx.sfx('ink');
    });
    later(450, () => { boss.classList.remove('hidden'); ctx.sfx('gong'); banner('问史', '与蠹一决', '', 1500); });
    lampEls.forEach((_, i) => later(700 + i * 150, () => lightLamp(i, false)));
    await wait(1500);
    say(easy ? LINES.introEasy : LINES.intro, 3000);
    await wait(700);

    // ------------------------------------------------------------ 主循环：一问一答
    let success = false;
    for (;;) {
      const q = pickQuestion();
      S.asked++;
      await nextPage(q);
      const res = await waitAnswer();
      if (!res.timeout && res.pos === current.correctPos) await onCorrect(res);
      else await onWrong(res);
      if (S.hp <= 0) { success = true; break; }
      if (S.lamps <= 0) break;
      while (S.phase < 2 && S.hp <= PHASE_AT[S.phase]) await toPhase(S.phase + 1);
    }

    const perfect = success && S.lampsLost === 0;
    if (success) S.score += S.lamps * 150 + (perfect ? 500 : 0);
    setHud();
    if (success) await victorySeq(); else await defeatSeq();

    const stats = {
      asked: S.asked, correct: S.correct, wrong: S.wrong, timeouts: S.timeouts,
      maxCombo: S.maxCombo, lamps: S.lamps, hintsUsed: S.hintsUsed, easy,
    };
    const note = success
      ? `答对 ${S.correct} 问，最高连击 ${S.maxCombo}，心灯余 ${S.lamps} 盏。${perfect ? '一盏心灯都没有熄灭！' : '被吞下的历史，一字一字，都回来了。'}`
      : `答对 ${S.correct} 问，遗忘之蠹还剩${Math.ceil(S.hp / HP_MAX * 100)}%元气。再翻翻《金陵志》——它啃掉的，我们一样找得回来。`;
    return { success, score: S.score, perfect, note, stats, missed: [...S.missed] };
  },
};
