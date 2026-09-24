// 验砖 —— 洪武十年（1377），聚宝门工地。
// 替工部验砖：城砖侧面刻着府县提调官、司吏、窑匠、造砖人夫的名字（物勒工名，以考其诚），
// 敲之声清者为好砖；缺名、有裂、生烧发红、声闷、铭文被啃的一律退回。
//
// opts：count 砖数（默认 12，简单 8）· time 限时秒数（默认 100，0 为不限；简单模式不限时）
//       pass 过关所需验对块数 · seed 随机种子 · tutorial true/false 强制开关教学提示
import { clamp, lerp, rng, shuffle, easeOutCubic, easeInOutCubic, TAU, injectStyle, el } from '../core/util.js';
import css from './bricks.css';
import {
  useLibStyle, fBrush, fontsReady, Particles, Shake, gameButton, hint, banner, keymap, untilDone, devHandle, hostPaused,
  rr, rgba, mixRgb, hslRgb, drawSeal, drawRidge, drawWood, drawSilverfish,
} from './lib-a.js';

// ---------------------------------------------------------------- 铭文素材（府名、县名均为明初实有；人名虚构）
const PREFS = [
  { fu: '袁州府', xian: ['宜春县', '分宜县', '萍乡县', '万载县'] },
  { fu: '吉安府', xian: ['庐陵县', '泰和县', '吉水县', '永丰县', '安福县'] },
  { fu: '临江府', xian: ['清江县', '新淦县', '新喻县'] },
  { fu: '南昌府', xian: ['南昌县', '新建县', '丰城县', '进贤县'] },
  { fu: '饶州府', xian: ['鄱阳县', '余干县', '乐平县', '浮梁县'] },
  { fu: '太平府', xian: ['当涂县', '芜湖县', '繁昌县'] },
];
const FU_TITLE = ['同知', '通判'];
const XIAN_TITLE = ['主簿', '县丞'];
const SURNAMES = '王李张刘陈杨黄赵吴周徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆孔白崔毛邱秦江顾侯邵孟龙万段雷钱汤尹黎易常武乔贺龚文';
const GIVEN_OFF = ['仲辉', '德', '文彬', '思敬', '伯安', '守中', '以德', '原善', '子正', '克明', '士弘', '彦章', '景和', '允恭', '宗礼', '存义', '汝霖', '希贤'];
const GIVEN_LI = ['彦', '良', '清', '进', '礼', '贵', '成', '安', '荣', '禄', '宽', '俊', '海', '通'];
const GIVEN_MIN = ['大', '二', '三', '四', '五', '六', '七', '八', '九', '十', '福', '寿', '旺', '保', '胜', '贵'];
const ROLE_NAME = { xianGuan: '县提调官', yao: '窑匠', ren: '造砖人夫' };
const FLAW_TEXT = {
  crack: '砖身有裂纹',
  fired: '火候不足，砖色发红',
  dull: '敲之声闷，内有暗伤',
  worm: '铭文被啃，名字无从查考',
};
const FLAW_TAG = { crack: '有裂', fired: '色红', dull: '声闷', worm: '字残' };

const ICON_OK = '<svg viewBox="0 0 24 24"><path d="M4 12.5 L9.5 18 L20 5.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NO = '<svg viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
const ICON_MALLET = '<svg viewBox="0 0 24 24"><g transform="rotate(-38 12 12)"><rect x="3.5" y="4" width="12" height="7.5" rx="1.6" fill="currentColor"/><rect x="8.3" y="11" width="2.6" height="11" rx="1.2" fill="currentColor"/></g></svg>';

function weighted(R, items) {
  let s = 0;
  for (const [, w] of items) s += w;
  let r = R() * s;
  for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
  return items[0][0];
}

function planFlaws(R, N, easy) {
  let list;
  if (!easy && N === 12) list = ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'missing', 'missing', 'crack', 'fired', 'dull', 'worm'];
  else if (easy && N === 8) list = ['ok', 'ok', 'ok', 'ok', 'missing', 'crack', 'fired', 'worm'];
  else {
    const pool = easy ? ['missing', 'crack', 'fired', 'worm'] : ['missing', 'crack', 'fired', 'dull', 'worm', 'missing'];
    const nBad = Math.max(1, Math.round(N / 2));
    list = [];
    for (let i = 0; i < nBad; i++) list.push(pool[i % pool.length]);
    if (N >= 4 && !list.includes('worm')) list[list.length - 1] = 'worm';
    while (list.length < N) list.push('ok');
  }
  for (let tries = 0; tries < 300; tries++) {
    const s = shuffle(list, R);
    if (N > 2 && s[0] !== 'ok') continue;
    const wi = s.indexOf('worm');
    if (wi >= 0 && wi < Math.min(easy ? 2 : 3, N - 1)) continue;
    let run = false;
    for (let i = 2; i < N; i++) if (s[i] === s[i - 1] && s[i] === s[i - 2]) run = true;
    for (let i = 1; i < N; i++) if (s[i] !== 'ok' && s[i] === s[i - 1]) run = true;
    if (run) continue;
    return s;
  }
  return list;
}

function makeBrick(R, flaw, easy, idx) {
  const used = new Set();
  const nm = (list) => {
    for (let k = 0; k < 40; k++) {
      const n = SURNAMES[Math.floor(R() * SURNAMES.length)] + R.pick(list);
      if (!used.has(n)) { used.add(n); return n; }
    }
    return '王五';
  };
  const P = R.pick(PREFS);
  const xian = R.pick(P.xian);
  const E = {
    fuGuan: { label: `${P.fu}提调官${R.pick(FU_TITLE)}`, name: nm(GIVEN_OFF) },
    fuLi: { label: '司吏', name: nm(GIVEN_LI) },
    xianGuan: { label: `${xian}提调官${R.pick(XIAN_TITLE)}`, name: nm(GIVEN_OFF) },
    xianLi: { label: '司吏', name: nm(GIVEN_LI) },
    zong: { label: '总甲', name: nm(GIVEN_MIN) },
    jia: { label: '甲首', name: nm(GIVEN_MIN) },
    xiao: { label: '小甲', name: nm(GIVEN_MIN) },
    yao: { label: '窑匠', name: nm(GIVEN_MIN) },
    ren: { label: '造砖人夫', name: nm(GIVEN_MIN) },
  };
  const b = {
    idx, flaw, E, seed: (R() * 1e9) | 0, withJia: R() < 0.6, bad: flaw !== 'ok', missing: null,
    sound: 'good', knocked: 0, tone: null, patch: false, bite: null, patchEnd: R() < 0.5 ? 0 : 1,
  };
  if (flaw === 'missing') b.missing = easy ? R.pick(['yao', 'ren']) : weighted(R, [['yao', 4], ['ren', 3], ['xianGuan', 2]]);
  if (flaw === 'crack' || flaw === 'fired' || flaw === 'dull') b.sound = 'bad';
  if (flaw === 'fired') {
    b.tone = easy ? hslRgb(12 + R() * 16, 0.42, 0.5) : hslRgb(16 + R() * 18, 0.21 + R() * 0.05, 0.5 + R() * 0.05);
    b.patch = true;
  } else {
    b.tone = hslRgb(203 + R() * 14, 0.05 + R() * 0.045, 0.44 + R() * 0.09);
  }
  if (flaw === 'worm') b.bite = R.pick(['fuGuan', 'xianGuan', 'yao', 'ren']);
  return b;
}

export default {
  id: 'bricks',
  title: '验砖',
  subtitle: '物勒工名，以考其诚',
  rules: [
    '洪武年间筑南京城，每块城砖都刻着<b>府县提调官、司吏、窑匠、造砖人夫</b>的名字，出了次品可一路追查到人。',
    '按<b>「敲」</b>听声：好砖声音清越，有金石之声；声音发闷的内有暗伤。',
    '<b>缺名</b>、<b>有裂纹</b>、<b>颜色发红</b>（火候不足）、<b>声闷</b>、<b>字迹残缺</b>的砖一律<b>退回</b>；青灰匀净、铭文齐全的才<b>合格</b>。',
    '一轮十二块砖，限时一百秒，验对十块即可过关。',
  ],
  controls: '鼠标 / 触屏点按钮 · 键盘：K 或空格 敲，A / ← 合格，D / → 退回',
  async play(ctx, opts = {}) {
    useLibStyle();
    injectStyle('bricks', css);
    await fontsReady();
    return run(ctx, opts);
  },
};

async function run(ctx, opts) {
  const easy = ctx.difficulty === 0;
  const N = Math.max(1, opts.count || (easy ? 8 : 12));
  const TIME = easy ? 0 : (opts.time ?? 100);
  const PASS = opts.pass ?? (easy ? Math.ceil(N * 0.75) : Math.ceil((N * 10) / 12));
  const seed = opts.seed ?? ((Date.now() ^ (ctx.attempt * 7919)) >>> 0);
  const R = rng(seed);
  const flaws = planFlaws(R, N, easy);
  const bricks = flaws.map((f, i) => makeBrick(R, f, easy, i));
  const usedMiss = []; // 两块缺名砖缺的不是同一个人
  for (const b of bricks) {
    if (b.flaw !== 'missing') continue;
    if (usedMiss.includes(b.missing)) {
      const alt = (easy ? ['yao', 'ren'] : ['yao', 'ren', 'xianGuan']).find((r) => !usedMiss.includes(r));
      if (alt) b.missing = alt;
    }
    usedMiss.push(b.missing);
  }
  const dpr = ctx.dpr;

  // ---------------------------------------------------------------- 画布与界面
  const cv = ctx.canvas();
  const g = cv.g;
  const bg = document.createElement('canvas');
  const ui = ctx.el('div', 'bricks-ui');
  const plaque = el('div', 'bricks-plaque', ui);
  plaque.innerHTML = `<div class="bp-t">验砖须知</div>
    <div class="bp-h"><span class="bp-lg">铭文</span>须具</div>
    <div class="bp-tags"><span class="bp-tag">府县提调官</span><span class="bp-tag">司吏</span><span class="bp-tag">窑匠</span><span class="bp-tag">造砖人夫</span></div>
    <div class="bp-h">退回</div>
    <div class="bp-tags"><span class="bp-tag no">缺名</span><span class="bp-tag no">有裂</span><span class="bp-tag no">色红</span><span class="bp-tag no">声闷</span><span class="bp-tag no">字残</span></div>`;
  const feed = el('div', 'bricks-feed', ui);
  const btnRow = el('div', 'bricks-btns', ui);
  const showKeys = !ctx.isTouch;
  const bAccept = gameButton(btnRow, { text: '合格', icon: ICON_OK, cls: 'jade', key: showKeys ? 'A' : '', onPress: () => decide(true) });
  const bKnock = gameButton(btnRow, { text: '敲', icon: ICON_MALLET, cls: 'ink bricks-knock', key: showKeys ? 'K' : '', onPress: () => knock() });
  const bReject = gameButton(btnRow, { text: '退回', icon: ICON_NO, cls: 'verm', key: showKeys ? 'D' : '', onPress: () => decide(false) });

  const parts = new Particles(400);
  const shake = new Shake();
  const L = {};
  const S = {
    phase: 'intro', phaseT: 0, t: 0, idx: -1, cur: null, landed: false, stamped: false, stampDur: 0.5,
    time: TIME, timerOn: false, correct: 0, wrong: 0, streak: 0, knockT: -1, hitDone: false, vib: 0,
    acc: [], rej: [], flyTo: null, fish: null, firstWormSeen: false, done: null, result: null, workers: [],
  };

  // ---------------------------------------------------------------- 布局
  function layout() {
    const W = ctx.w; const H = ctx.h;
    L.W = W; L.H = H;
    L.portrait = W / H < 1.0;
    if (L.portrait) {
      L.btnH = clamp(Math.round(H * 0.09), 52, 66);
      L.gap = 10;
      L.btnW = Math.min(150, (W - 24 - L.gap * 2) / 3);
      L.btnY = H - L.btnH - 12;
      L.stripH = 60;
      L.feedY = L.btnY - 22;
      const top = L.stripH + 26; const bottom = L.feedY - 24;
      let fh = bottom - top; let fw = fh / 3.4;
      if (fw > W * 0.42) { fw = W * 0.42; fh = fw * 3.4; }
      L.fw = fw; L.fh = fh; L.bx = (W - fw) / 2; L.by = bottom - fh; L.tableY = bottom;
      L.wallH = clamp(H * 0.07, 34, 70);
      L.horizon = top + fh * 0.3;
      L.gateX = W * 0.17;
    } else {
      L.btnH = clamp(Math.round(H * 0.095), 50, 68);
      L.gap = 16;
      L.btnW = clamp(W * 0.13, 112, 176);
      L.btnY = H - L.btnH - 14;
      L.feedY = L.btnY - 24;
      const top = 30; const bottom = L.feedY - 26;
      let fh = bottom - top; let fw = fh / 3.4;
      if (fw > W * 0.3) { fw = W * 0.3; fh = fw * 3.4; }
      L.fw = fw; L.fh = fh; L.bx = W * 0.5 - fw / 2; L.by = bottom - fh; L.tableY = bottom;
      L.wallH = clamp(H * 0.12, 44, 110);
      L.horizon = L.by + fh * 0.44;
      L.gateX = W * 0.24;
    }
    L.narrow = L.fw < 128;
    L.nc = L.narrow ? 3 : 4;
    L.mx = L.fw * 0.1; L.my = L.fw * 0.12;
    L.pad = L.fw * 0.045;
    const frameW = L.fw - 2 * L.mx; const frameH = L.fh - 2 * L.my;
    L.cs = Math.min(((frameW - 2 * L.pad) / L.nc) * 0.84, (frameH - 2 * L.pad) / 16.4);
    L.d = L.fw * 0.16;
    // 左右两堆
    const side = L.bx;
    if (L.portrait) {
      L.pileW = clamp(side * 0.66, 30, 84);
      L.accX = side * 0.5; L.rejX = L.W - side * 0.5;
      L.perRow = 1;
    } else {
      L.pileW = clamp(Math.min(side * 0.3, L.fh * 0.3), 40, 118);
      L.accX = L.bx - Math.max(L.pileW * 1.35, W * 0.13);
      L.rejX = L.bx + L.fw + Math.max(L.pileW * 1.35, W * 0.13);
      L.perRow = 2;
    }
    L.pileH = L.pileW * 0.3;
    // 木槌
    L.ml = Math.min(clamp(L.fh * 0.24, 48, 132), (W - L.bx - L.fw - 10) / 1.25);
    L.hitX = L.bx + L.fw; L.hitY = L.by + L.fh * 0.16;
    L.pivotX = L.hitX + L.ml * 1.13; L.pivotY = L.hitY;
    placeUI();
    drawBackground();
  }

  function placeUI() {
    btnRow.style.setProperty('--bw', `${L.btnW}px`);
    btnRow.style.setProperty('--bh', `${L.btnH}px`);
    btnRow.style.setProperty('--gap', `${L.gap}px`);
    btnRow.style.setProperty('--bf', `${clamp(L.btnH * 0.42, 20, 28)}px`);
    btnRow.style.top = `${L.btnY}px`;
    feed.style.top = `${L.feedY}px`;
    if (L.portrait) {
      plaque.classList.add('strip');
      plaque.style.cssText = 'left:8px;right:8px;top:6px;width:auto;';
    } else {
      plaque.classList.remove('strip');
      const w = clamp(L.W * 0.18, 168, 236);
      plaque.style.cssText = `left:18px;top:34px;width:${w}px;`;
    }
  }

  // ---------------------------------------------------------------- 背景（工地远景 + 验砖台）
  function drawBackground() {
    const W = L.W; const H = L.H;
    bg.width = Math.ceil(W * dpr); bg.height = Math.ceil(H * dpr);
    const b = bg.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const Rb = rng(1377);
    const hz = L.horizon;
    const sky = b.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#f2e9d6'); sky.addColorStop(1, '#e6d6b8');
    b.fillStyle = sky; b.fillRect(0, 0, W, hz + 1);
    const sr = Math.min(W, H) * 0.055;
    b.fillStyle = 'rgba(190,70,50,.15)';
    b.beginPath(); b.arc(W * 0.84, Math.max(sr + 10, hz * 0.3), sr, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(150,128,96,.2)'; b.lineWidth = 2; b.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = Rb() * W; const y = hz * (0.12 + Rb() * 0.5); const l = W * (0.06 + Rb() * 0.12);
      b.beginPath(); b.moveTo(x, y); b.bezierCurveTo(x + l * 0.3, y - 5, x + l * 0.7, y + 4, x + l, y - 2); b.stroke();
    }
    const wh = L.wallH;
    drawRidge(b, -10, W + 10, hz - wh * 0.7, wh * 1.2, 11, '#7b8791', 0.26, hz);
    drawRidge(b, -10, W + 10, hz - wh * 0.35, wh * 0.8, 23, '#66727c', 0.28, hz);
    drawWall(b);
    drawGate(b, Rb);
    // 地面
    const gr = b.createLinearGradient(0, hz, 0, L.tableY);
    gr.addColorStop(0, '#d6c39c'); gr.addColorStop(1, '#c8b086');
    b.fillStyle = gr; b.fillRect(0, hz, W, L.tableY - hz + 2);
    b.strokeStyle = 'rgba(110,85,50,.18)'; b.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      const y = lerp(hz + 6, L.tableY - 4, Rb()); const x = Rb() * W; const l = 20 + Rb() * 80;
      b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo(x + l / 2, y + (Rb() - 0.5) * 4, x + l, y); b.stroke();
    }
    // 远处的砖垛
    for (let i = 0; i < 6; i++) {
      const x = Rb() * W; const y = lerp(hz + 8, (hz + L.tableY) / 2, Rb());
      const s = lerp(0.5, 1, (y - hz) / Math.max(1, L.tableY - hz)) * wh * 0.28;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3 - r; c++) {
          b.fillStyle = r % 2 ? '#8b9398' : '#7e878c';
          b.fillRect(x + c * s * 1.05 + r * s * 0.5, y - (r + 1) * s * 0.42, s, s * 0.4);
          b.strokeStyle = 'rgba(29,27,24,.35)'; b.lineWidth = 0.8;
          b.strokeRect(x + c * s * 1.05 + r * s * 0.5, y - (r + 1) * s * 0.42, s, s * 0.4);
        }
      }
    }
    drawTable(b);
    // 工人
    if (!S.workers.length) {
      const Rw = rng(8);
      for (let i = 0; i < 5; i++) S.workers.push({ u: Rw(), v: (Rw() < 0.5 ? -1 : 1) * (0.012 + Rw() * 0.014), ph: Rw() * 10, lane: Rw() });
    }
  }

  function drawWall(b) {
    const W = L.W; const hz = L.horizon; const wh = L.wallH; const top = hz - wh;
    const gr = b.createLinearGradient(0, top, 0, hz);
    gr.addColorStop(0, '#9aa2a6'); gr.addColorStop(1, '#7d868c');
    b.fillStyle = gr; b.fillRect(0, top, W, wh);
    const course = Math.max(4, wh / 12);
    b.strokeStyle = 'rgba(40,46,52,.13)'; b.lineWidth = 1;
    let row = 0;
    for (let y = top + course; y < hz - 1; y += course, row++) {
      b.beginPath(); b.moveTo(0, y); b.lineTo(W, y);
      const bw = course * 2.6; const off = (row % 2) * bw / 2;
      for (let x = off; x < W; x += bw) { b.moveTo(x, y - course); b.lineTo(x, y); }
      b.stroke();
    }
    const m = clamp(wh * 0.2, 6, 18);
    b.fillStyle = '#8f989d'; b.strokeStyle = 'rgba(29,27,24,.35)'; b.lineWidth = 1;
    for (let x = -m * 0.4; x < W; x += m * 1.75) { b.fillRect(x, top - m * 0.75, m, m * 0.75 + 1); b.strokeRect(x + 0.5, top - m * 0.75 + 0.5, m - 1, m * 0.75); }
    b.strokeStyle = 'rgba(29,27,24,.5)'; b.lineWidth = 1.4;
    b.beginPath(); b.moveTo(0, top); b.lineTo(W, top); b.stroke();
    const sh = b.createLinearGradient(0, hz - wh * 0.35, 0, hz);
    sh.addColorStop(0, 'rgba(60,50,40,0)'); sh.addColorStop(1, 'rgba(60,50,40,.16)');
    b.fillStyle = sh; b.fillRect(0, hz - wh * 0.35, W, wh * 0.35);
  }

  function drawGate(b, Rb) {
    const hz = L.horizon; const wh = L.wallH;
    const gx = L.gateX; const gw = wh * 3.1; const gh = wh * 1.5; const top = hz - gh;
    b.save();
    b.beginPath();
    b.moveTo(gx - gw / 2, hz); b.lineTo(gx - gw / 2 + gw * 0.035, top); b.lineTo(gx + gw / 2 - gw * 0.035, top); b.lineTo(gx + gw / 2, hz); b.closePath();
    const gr = b.createLinearGradient(0, top, 0, hz);
    gr.addColorStop(0, '#a3aaad'); gr.addColorStop(1, '#848c91');
    b.fillStyle = gr; b.fill();
    b.strokeStyle = 'rgba(29,27,24,.55)'; b.lineWidth = 1.5; b.stroke();
    b.save(); b.clip();
    b.strokeStyle = 'rgba(40,46,52,.12)'; b.lineWidth = 1;
    for (let y = top + wh / 12; y < hz; y += wh / 12) { b.beginPath(); b.moveTo(gx - gw, y); b.lineTo(gx + gw, y); b.stroke(); }
    b.restore();
    // 城门洞
    const aw = gw * 0.21; const ah = gh * 0.55;
    b.beginPath();
    b.moveTo(gx - aw / 2, hz); b.lineTo(gx - aw / 2, hz - ah + aw / 2); b.arc(gx, hz - ah + aw / 2, aw / 2, Math.PI, 0); b.lineTo(gx + aw / 2, hz); b.closePath();
    const ag = b.createLinearGradient(0, hz - ah, 0, hz);
    ag.addColorStop(0, '#2b3035'); ag.addColorStop(1, '#4a5157');
    b.fillStyle = ag; b.fill();
    b.strokeStyle = 'rgba(29,27,24,.5)'; b.lineWidth = 1.2;
    b.beginPath(); b.arc(gx, hz - ah + aw / 2, aw / 2 + 4, Math.PI, 0); b.stroke();
    // 城楼（尚在营造）
    const m = clamp(wh * 0.2, 6, 18);
    b.fillStyle = '#959da1';
    for (let x = gx - gw / 2 + gw * 0.04; x < gx + gw / 2 - gw * 0.04 - m; x += m * 1.75) b.fillRect(x, top - m * 0.7, m, m * 0.7 + 1);
    const pw = gw * 0.74; const ph = gh * 0.8; const py = top - m * 0.7;
    b.strokeStyle = 'rgba(78,54,30,.8)'; b.lineWidth = Math.max(1.6, wh * 0.035); b.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const x = gx - pw / 2 + (pw * i) / 5; b.beginPath(); b.moveTo(x, py); b.lineTo(x, py - ph * 0.6); b.stroke(); }
    b.beginPath(); b.moveTo(gx - pw / 2 - 6, py - ph * 0.6); b.lineTo(gx + pw / 2 + 6, py - ph * 0.6); b.stroke();
    b.beginPath(); b.moveTo(gx - pw / 2, py - ph * 0.3); b.lineTo(gx + pw / 2, py - ph * 0.3); b.stroke();
    b.lineWidth = Math.max(1.1, wh * 0.024);
    b.beginPath(); b.moveTo(gx - pw * 0.62, py - ph * 0.6); b.lineTo(gx, py - ph); b.lineTo(gx + pw * 0.62, py - ph * 0.6); b.stroke();
    b.beginPath(); b.moveTo(gx, py - ph); b.lineTo(gx, py - ph * 0.6); b.stroke();
    // 竹脚手架
    b.strokeStyle = 'rgba(120,98,56,.55)'; b.lineWidth = 1;
    const sx0 = gx - pw / 2 - pw * 0.14; const sx1 = gx + pw / 2 + pw * 0.14;
    for (let i = 0; i < 9; i++) { const x = lerp(sx0, sx1, i / 8); b.beginPath(); b.moveTo(x, hz - gh * 0.25); b.lineTo(x + (Rb() - 0.5) * 3, py - ph * (0.72 + Rb() * 0.3)); b.stroke(); }
    for (let j = 0; j < 4; j++) { const y = py - ph * 0.17 * j - gh * 0.08; b.beginPath(); b.moveTo(sx0 - 3, y); b.lineTo(sx1 + 3, y); b.stroke(); }
    for (let i = 0; i < 8; i++) { const x = lerp(sx0, sx1, i / 8); const y = py - ph * 0.17 * (i % 3) - gh * 0.08; b.beginPath(); b.moveTo(x, y); b.lineTo(x + (sx1 - sx0) / 8, y - ph * 0.17); b.stroke(); }
    // 吊杆
    const hx = sx1 + pw * 0.14;
    b.strokeStyle = 'rgba(78,54,30,.75)'; b.lineWidth = 2;
    b.beginPath(); b.moveTo(hx, hz); b.lineTo(hx - pw * 0.04, py - ph * 1.08); b.stroke();
    b.beginPath(); b.moveTo(hx - pw * 0.04, py - ph * 1.08); b.lineTo(hx - pw * 0.36, py - ph * 0.92); b.stroke();
    b.lineWidth = 0.8;
    b.beginPath(); b.moveTo(hx - pw * 0.36, py - ph * 0.92); b.lineTo(hx - pw * 0.36, py - ph * 0.5); b.stroke();
    b.fillStyle = 'rgba(96,74,44,.85)'; b.fillRect(hx - pw * 0.36 - 5, py - ph * 0.5, 10, 6);
    b.restore();
    L.flags = [{ x: sx0 + 2, y: py - ph * 0.98 }, { x: hx - pw * 0.04, y: py - ph * 1.08 }];
  }

  function drawTable(b) {
    const W = L.W; const H = L.H; const ty = L.tableY;
    const th = clamp(H * 0.03, 10, 20);
    L.tableTh = th;
    drawWood(b, 0, ty - th * 0.45, W, th, { base: '#a2734b', light: '#bd8d5f', dark: '#80563a', seed: 5, lines: 9, alpha: 0.26 });
    b.fillStyle = 'rgba(40,24,10,.55)'; b.fillRect(0, ty + th * 0.55, W, 2);
    drawWood(b, 0, ty + th * 0.55 + 2, W, H - ty, { base: '#6c4427', light: '#83553a', dark: '#472a15', seed: 9, lines: 22, alpha: 0.3 });
    const sh = b.createLinearGradient(0, ty + th * 0.55, 0, ty + th * 0.55 + 18);
    sh.addColorStop(0, 'rgba(20,10,0,.35)'); sh.addColorStop(1, 'rgba(20,10,0,0)');
    b.fillStyle = sh; b.fillRect(0, ty + th * 0.55 + 2, W, 18);
    // 案上的砚台与毛笔、账簿
    const s = clamp(H * 0.05, 20, 38);
    const ix = L.portrait ? W * 0.08 : L.W * 0.08;
    if (!L.portrait) {
      b.fillStyle = '#2b2a2c'; rr(b, ix, ty - s * 0.28, s * 1.5, s * 0.36, 4); b.fill();
      b.fillStyle = '#111'; b.beginPath(); b.ellipse(ix + s * 0.75, ty - s * 0.2, s * 0.5, s * 0.1, 0, 0, TAU); b.fill();
      b.strokeStyle = '#6b4a2a'; b.lineWidth = 3; b.lineCap = 'round';
      b.beginPath(); b.moveTo(ix + s * 1.8, ty - s * 0.12); b.lineTo(ix + s * 3.1, ty - s * 0.32); b.stroke();
      b.strokeStyle = '#1d1b18'; b.lineWidth = 4;
      b.beginPath(); b.moveTo(ix + s * 1.8, ty - s * 0.12); b.lineTo(ix + s * 1.62, ty - s * 0.09); b.stroke();
      const lx = W - ix - s * 2.2;
      b.fillStyle = '#e9dcc0'; rr(b, lx, ty - s * 0.3, s * 2.2, s * 0.32, 2); b.fill();
      b.fillStyle = '#3c4a66'; rr(b, lx, ty - s * 0.36, s * 2.2, s * 0.1, 2); b.fill();
      b.strokeStyle = 'rgba(29,27,24,.4)'; b.lineWidth = 1; rr(b, lx, ty - s * 0.36, s * 2.2, s * 0.38, 2); b.stroke();
    }
  }

  // ---------------------------------------------------------------- 砖面（离屏绘制）
  function columnsOf(b) {
    const cols = [['fuGuan', 'fuLi'], ['xianGuan', 'xianLi']];
    if (b.withJia && !L.narrow) cols.push(['zong', 'jia', 'xiao']);
    cols.push(['yao', 'ren']);
    return cols;
  }

  function renderBrick(b) {
    const fw = L.fw; const fh = L.fh;
    const key = `${fw.toFixed(1)}|${fh.toFixed(1)}|${L.nc}`;
    if (b.cv && b.key === key) return;
    b.key = key;
    const c = b.cv || (b.cv = document.createElement('canvas'));
    c.width = Math.ceil(fw * dpr); c.height = Math.ceil(fh * dpr);
    const q = c.getContext('2d');
    q.setTransform(dpr, 0, 0, dpr, 0, 0);
    const Rr = rng(b.seed);
    const rad = Math.min(fw, fh) * 0.035;
    rr(q, 0, 0, fw, fh, rad);
    const gr = q.createLinearGradient(0, 0, fw * 0.6, fh);
    gr.addColorStop(0, rgba(mixRgb(b.tone, [255, 255, 255], 0.1)));
    gr.addColorStop(0.5, rgba(b.tone));
    gr.addColorStop(1, rgba(mixRgb(b.tone, [0, 0, 0], 0.12)));
    q.fillStyle = gr; q.fill();
    q.save();
    rr(q, 0, 0, fw, fh, rad); q.clip();
    for (let i = 0; i < 8; i++) {
      const x = Rr() * fw; const y = Rr() * fh; const r = fw * (0.3 + Rr() * 0.6);
      const rg = q.createRadialGradient(x, y, 0, x, y, r);
      const light = Rr() < 0.5;
      rg.addColorStop(0, light ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = rg; q.fillRect(0, 0, fw, fh);
    }
    if (b.patch) { // 生烧：一头泛红
      const y0 = b.patchEnd ? fh : 0;
      const rg = q.createRadialGradient(fw * 0.5, y0, 0, fw * 0.5, y0, fh * (easy ? 1.1 : 0.75));
      rg.addColorStop(0, easy ? 'rgba(200,90,45,.45)' : 'rgba(196,96,52,.38)');
      rg.addColorStop(1, 'rgba(196,96,52,0)');
      q.fillStyle = rg; q.fillRect(0, 0, fw, fh);
    }
    const n = Math.round((fw * fh) / 20);
    for (let i = 0; i < n; i++) {
      q.fillStyle = Rr() < 0.5 ? `rgba(20,20,22,${0.05 + Rr() * 0.12})` : `rgba(255,255,255,${0.04 + Rr() * 0.1})`;
      const s = 0.6 + Rr() * 1.4;
      q.fillRect(Rr() * fw, Rr() * fh, s, s);
    }
    const pores = 6 + Math.floor(Rr() * 9);
    for (let i = 0; i < pores; i++) {
      const x = Rr() * fw; const y = Rr() * fh; const r = 0.7 + Rr() * 1.7;
      q.fillStyle = 'rgba(15,15,18,.42)'; q.beginPath(); q.arc(x, y, r, 0, TAU); q.fill();
      q.fillStyle = 'rgba(255,255,255,.16)'; q.beginPath(); q.arc(x + 0.5, y + 0.6, r * 0.75, 0, Math.PI); q.fill();
    }
    // 棱边明暗
    q.lineWidth = 4;
    q.strokeStyle = 'rgba(255,255,255,.13)';
    q.beginPath(); q.moveTo(0, fh); q.lineTo(0, 0); q.lineTo(fw, 0); q.stroke();
    q.strokeStyle = 'rgba(0,0,0,.2)';
    q.beginPath(); q.moveTo(fw, 0); q.lineTo(fw, fh); q.lineTo(0, fh); q.stroke();
    q.restore();
    // 崩角
    q.save();
    q.globalCompositeOperation = 'destination-out';
    const chips = 2 + Math.floor(Rr() * 3);
    for (let i = 0; i < chips; i++) {
      const side = Math.floor(Rr() * 4); const p = 0.08 + Rr() * 0.84; const r = 1.5 + Rr() * 3.2;
      const x = side === 0 ? p * fw : side === 1 ? fw : side === 2 ? p * fw : 0;
      const y = side === 0 ? 0 : side === 1 ? p * fh : side === 2 ? fh : p * fh;
      q.beginPath(); q.arc(x, y, r, 0, TAU); q.fill();
    }
    q.restore();
    rr(q, 0.75, 0.75, fw - 1.5, fh - 1.5, rad);
    q.strokeStyle = 'rgba(29,27,24,.55)'; q.lineWidth = 1.5; q.stroke();

    // 印框
    const fx = L.mx; const fy = L.my; const fW = fw - 2 * L.mx; const fH = fh - 2 * L.my;
    q.strokeStyle = 'rgba(12,12,16,.42)'; q.lineWidth = 1.5; q.strokeRect(fx, fy, fW, fH);
    q.strokeStyle = 'rgba(255,255,255,.2)'; q.lineWidth = 1; q.strokeRect(fx + 1.3, fy + 1.3, fW, fH);
    // 铭文
    const cols = columnsOf(b);
    const colW = (fW - 2 * L.pad) / cols.length;
    const cs = L.cs;
    b.chars = []; b.colX = []; b.blank = null; b.colW = colW;
    cols.forEach((col, ci) => {
      const x = fx + fW - L.pad - colW * (ci + 0.5);
      b.colX.push(x);
      let y = fy + L.pad + cs * 0.55;
      let any = false;
      for (const key of col) {
        const e = b.E[key];
        const miss = key === b.missing;
        if (miss && !easy) continue;
        if (any) y += cs * 0.62;
        any = true;
        const text = miss ? e.label : e.label + e.name;
        for (const ch of text) { b.chars.push({ ch, x, y, key }); y += cs; }
        if (miss) { b.blank = { x, y0: y - cs * 0.5, y1: y - cs * 0.5 + e.name.length * cs }; y += e.name.length * cs; }
      }
    });
    q.font = fBrush(cs * 0.94); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const ch of b.chars) {
      q.fillStyle = 'rgba(255,255,255,.26)'; q.fillText(ch.ch, ch.x + 0.8, ch.y + 1);
      q.fillStyle = 'rgba(24,24,28,.84)'; q.fillText(ch.ch, ch.x, ch.y);
    }
    if (b.blank) { // 简单模式：缺名处凿空
      const { x, y0, y1 } = b.blank;
      q.fillStyle = 'rgba(0,0,0,.12)'; q.fillRect(x - cs * 0.45, y0, cs * 0.9, y1 - y0);
      q.strokeStyle = 'rgba(178,58,46,.55)'; q.setLineDash([4, 3]); q.lineWidth = 1.4;
      q.strokeRect(x - cs * 0.45, y0, cs * 0.9, y1 - y0); q.setLineDash([]);
    }
    // 瑕疵框（判定后圈出来）
    b.box = null;
    if (b.flaw === 'missing') {
      const ci = cols.findIndex((col) => col.includes(b.missing));
      const x = b.colX[ci];
      b.box = { x: x - colW * 0.55, y: fy + 2, w: colW * 1.1, h: fH - 4, label: `缺${ROLE_NAME[b.missing]}` };
    }
    // 裂纹
    if (b.flaw === 'crack') {
      const fromLeft = Rr() < 0.5;
      let x = fromLeft ? -2 : fw + 2; let y = fh * (0.22 + Rr() * 0.5);
      const pts = [[x, y]];
      const dir = fromLeft ? 1 : -1;
      const span = fw * (easy ? 1.1 : 0.8 + Rr() * 0.25);
      let runX = 0;
      while (runX < span) {
        const dx = fw * (0.07 + Rr() * 0.09); runX += dx; x += dir * dx; y += (Rr() - 0.3) * fw * 0.16;
        pts.push([x, y]);
      }
      const br = [];
      for (let k = 0; k < 2; k++) {
        const s0 = pts[2 + Math.floor(Rr() * (pts.length - 3))];
        let bx = s0[0]; let by = s0[1]; const bp = [[bx, by]];
        const bd = Rr() < 0.5 ? -1 : 1;
        for (let j = 0; j < 3; j++) { bx += dir * fw * 0.05 * Rr(); by += bd * fw * (0.05 + Rr() * 0.06); bp.push([bx, by]); }
        br.push(bp);
      }
      const path = (ps, ox, oy) => { q.beginPath(); ps.forEach(([px, py], i) => (i ? q.lineTo(px + ox, py + oy) : q.moveTo(px + ox, py + oy))); };
      q.lineJoin = 'miter'; q.lineCap = 'round';
      q.strokeStyle = 'rgba(255,255,255,.24)'; q.lineWidth = easy ? 2 : 1.2; path(pts, 1, 1.1); q.stroke();
      q.strokeStyle = 'rgba(16,12,10,.94)'; q.lineWidth = easy ? 3.2 : 2; path(pts, 0, 0); q.stroke();
      q.lineWidth = easy ? 1.6 : 1;
      for (const bp of br) { path(bp, 0, 0); q.stroke(); }
      // 起裂处的缺口
      q.fillStyle = 'rgba(16,12,10,.9)';
      q.beginPath(); q.moveTo(pts[0][0], pts[0][1] - 3); q.lineTo(pts[1][0], pts[1][1]); q.lineTo(pts[0][0], pts[0][1] + 3); q.closePath(); q.fill();
      const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]).concat(br.flat().map((p) => p[1]));
      const x0 = clamp(Math.min(...xs), 0, fw); const x1 = clamp(Math.max(...xs), 0, fw);
      b.box = { x: x0 - 8, y: Math.min(...ys) - 10, w: x1 - x0 + 16, h: Math.max(...ys) - Math.min(...ys) + 20, label: '有裂' };
    }
    // 蠹蚀
    if (b.flaw === 'worm') {
      const list = b.chars.filter((c) => c.key === b.bite);
      const nameLen = b.E[b.bite].name.length;
      const targets = list.slice(Math.max(0, list.length - nameLen - 1));
      b.holes = [];
      for (const c of targets) {
        const k = 2 + Math.floor(Rr() * 2);
        for (let i = 0; i < k; i++) b.holes.push({ x: c.x + (Rr() - 0.5) * cs * 0.55, y: c.y + (Rr() - 0.5) * cs * 0.6, r: cs * (easy ? 0.3 : 0.22 + Rr() * 0.1) });
      }
      q.strokeStyle = 'rgba(214,226,234,.9)'; q.lineWidth = 2.4;
      for (const h of b.holes) { q.beginPath(); q.arc(h.x, h.y, h.r, 0, TAU); q.stroke(); }
      for (const h of b.holes) {
        const rg = q.createRadialGradient(h.x - h.r * 0.3, h.y - h.r * 0.3, 0, h.x, h.y, h.r);
        rg.addColorStop(0, '#17181b'); rg.addColorStop(1, '#3e434a');
        q.fillStyle = rg; q.beginPath(); q.arc(h.x, h.y, h.r, 0, TAU); q.fill();
      }
      for (let i = 0; i < 22; i++) {
        const h = b.holes[Math.floor(Rr() * b.holes.length)];
        const a = Rr() * TAU; const d = h.r * (1.1 + Rr() * 0.9);
        q.fillStyle = `rgba(228,238,245,${0.4 + Rr() * 0.5})`;
        q.beginPath(); q.arc(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 0.5 + Rr() * 0.9, 0, TAU); q.fill();
      }
      const hx = b.holes.map((h) => h.x); const hy = b.holes.map((h) => h.y);
      b.box = { x: Math.min(...hx) - cs * 0.6, y: Math.min(...hy) - cs * 0.6, w: Math.max(...hx) - Math.min(...hx) + cs * 1.2, h: Math.max(...hy) - Math.min(...hy) + cs * 1.2, label: '字残' };
    }
    if (b.flaw === 'fired') b.box = { x: 6, y: 6, w: fw - 12, h: fh - 12, label: '色红' };
    if (b.flaw === 'dull') b.box = { x: 6, y: 6, w: fw - 12, h: fh - 12, label: '声闷' };
  }

  // ---------------------------------------------------------------- 绘制
  function drawBrick(b, cx, cy, rot, sc, jx, extras) {
    const fw = L.fw; const fh = L.fh; const d = L.d;
    g.save();
    g.translate(cx + jx, cy); g.rotate(rot); g.scale(sc, sc);
    const x0 = -fw / 2; const y0 = -fh / 2;
    g.lineJoin = 'round';
    g.fillStyle = rgba(mixRgb(b.tone, [255, 255, 255], 0.14));
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + d, y0 - d * 0.55); g.lineTo(x0 + fw + d, y0 - d * 0.55); g.lineTo(x0 + fw, y0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(29,27,24,.5)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = rgba(mixRgb(b.tone, [0, 0, 0], 0.32));
    g.beginPath(); g.moveTo(x0 + fw, y0); g.lineTo(x0 + fw + d, y0 - d * 0.55); g.lineTo(x0 + fw + d, y0 + fh - d * 0.55); g.lineTo(x0 + fw, y0 + fh); g.closePath(); g.fill();
    g.stroke();
    g.drawImage(b.cv, x0, y0, fw, fh);
    if (b.holes) { // 银光流转
      for (let i = 0; i < b.holes.length; i++) {
        const h = b.holes[i];
        const a = S.t * 2.2 + i * 1.7;
        g.strokeStyle = `rgba(240,248,255,${0.35 + 0.3 * Math.sin(S.t * 3 + i)})`;
        g.lineWidth = 1.3;
        g.beginPath(); g.arc(x0 + h.x, y0 + h.y, h.r + 0.6, a, a + 1.1); g.stroke();
      }
    }
    if (extras) extras(x0, y0);
    g.restore();
  }

  function brushEllipse(cx, cy, rx, ry, k, color) {
    g.strokeStyle = color; g.lineCap = 'round';
    const a0 = -2.3; const a1 = a0 + TAU * 1.06 * k;
    let prev = null;
    for (let a = a0; a <= a1; a += 0.1) {
      const w = 2.2 + 1.6 * Math.sin((a - a0) * 1.2);
      const x = cx + Math.cos(a) * rx * (1 + 0.04 * Math.sin(a * 3)); const y = cy + Math.sin(a) * ry * (1 + 0.03 * Math.cos(a * 2));
      if (prev) { g.lineWidth = w; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(x, y); g.stroke(); }
      prev = [x, y];
    }
  }

  function stampExtras(b, alpha) {
    return (x0, y0) => {
      const fw = L.fw; const fh = L.fh;
      // 瑕疵圈注
      if (b.bad && b.box && S.phaseT > 0.16) {
        const k = S.phase === 'stamp' ? clamp((S.phaseT - 0.16) / 0.3, 0, 1) : 1;
        g.save(); g.globalAlpha = alpha;
        const bx = b.box;
        if (b.flaw === 'fired') { g.fillStyle = `rgba(210,80,40,${0.18 * k})`; g.fillRect(x0, y0, fw, fh); }
        brushEllipse(x0 + bx.x + bx.w / 2, y0 + bx.y + bx.h / 2, bx.w / 2 + 6, bx.h / 2 + 6, k, 'rgba(178,58,46,.9)');
        if (k > 0.6) {
          const fs = clamp(fw * 0.26, 16, 30);
          g.font = fBrush(fs); g.textAlign = 'center'; g.textBaseline = 'middle';
          const ly = clamp(y0 + bx.y - fs * 0.8, y0 + fs * 0.5, y0 + fh - fs);
          g.lineWidth = 4; g.strokeStyle = 'rgba(251,246,234,.95)'; g.strokeText(bx.label, x0 + fw / 2, ly);
          g.fillStyle = '#b23a2e'; g.fillText(bx.label, x0 + fw / 2, ly);
        }
        g.restore();
      }
      // 验讫 / 退回印
      const st = S.phaseT;
      const k = S.phase === 'stamp' ? clamp(st / 0.12, 0, 1) : 1;
      const sc = lerp(2.3, 1, easeOutCubic(k));
      const size = clamp(fw * 0.62, 34, 96);
      drawSeal(g, x0 + fw / 2, y0 + fh * 0.64, size, b.decision ? '验讫' : '退', {
        color: b.decision ? '#b23a2e' : '#2b2622', rot: b.decision ? -0.12 : 0.1, alpha: k * alpha, scale: sc, seed: b.idx + 3,
      });
    };
  }

  function drawSmallBrick(b, x, y, rot, w) {
    const h = w * 0.3;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = rgba(b.tone);
    rr(g, -w / 2, -h / 2, w, h, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, h * 0.25);
    g.strokeStyle = 'rgba(29,27,24,.6)'; g.lineWidth = 1; rr(g, -w / 2, -h / 2, w, h, 2); g.stroke();
    if (b.flaw === 'crack') { g.strokeStyle = 'rgba(16,12,10,.85)'; g.beginPath(); g.moveTo(-w * 0.1, -h / 2); g.lineTo(0, 0); g.lineTo(-w * 0.05, h / 2); g.stroke(); }
    if (b.flaw === 'worm') { g.fillStyle = '#2a2d31'; g.beginPath(); g.arc(w * 0.15, 0, h * 0.18, 0, TAU); g.fill(); g.strokeStyle = 'rgba(220,232,240,.8)'; g.stroke(); }
    g.restore();
  }

  function accSlot(i) {
    const per = L.perRow; const row = Math.floor(i / per); const col = i % per;
    const off = per === 2 ? (col - 0.5) * L.pileW * 1.04 + (row % 2 ? L.pileW * 0.12 : -L.pileW * 0.12) : (row % 2 ? 2 : -2);
    return { x: L.accX + off, y: L.tableY - L.pileH * (row + 0.5) - 1, rot: 0 };
  }
  function rejSlot(i) {
    const Rs = rng(i * 131 + 7);
    const row = Math.floor(i / Math.max(1, L.perRow)); const col = i % L.perRow;
    const off = L.perRow === 2 ? (col - 0.5) * L.pileW * 0.9 : 0;
    return { x: L.rejX + off + (Rs() - 0.5) * L.pileW * 0.35, y: L.tableY - L.pileH * (row * 0.8 + 0.55), rot: (Rs() - 0.5) * 0.55 };
  }

  function drawWorker(x, y, s, dir, ph) {
    g.save(); g.translate(x, y); g.scale(dir, 1);
    g.strokeStyle = 'rgba(46,40,32,.62)'; g.fillStyle = 'rgba(46,40,32,.62)';
    g.lineWidth = Math.max(1, s * 0.07); g.lineCap = 'round';
    const st = Math.sin(ph) * s * 0.16;
    g.beginPath(); g.moveTo(0, -s * 0.42); g.lineTo(st, 0); g.moveTo(0, -s * 0.42); g.lineTo(-st, 0); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.13, -s * 0.4); g.lineTo(s * 0.13, -s * 0.4); g.lineTo(s * 0.07, -s * 0.8); g.lineTo(-s * 0.07, -s * 0.8); g.closePath(); g.fill();
    g.beginPath(); g.arc(0, -s * 0.88, s * 0.075, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-s * 0.19, -s * 0.9); g.lineTo(0, -s * 1.02); g.lineTo(s * 0.19, -s * 0.9); g.closePath(); g.fill();
    const bob = Math.abs(Math.sin(ph)) * s * 0.03;
    g.beginPath(); g.moveTo(-s * 0.46, -s * 0.79 + bob); g.lineTo(s * 0.46, -s * 0.79 + bob); g.stroke();
    for (const sx of [-0.42, 0.42]) {
      g.beginPath(); g.moveTo(sx * s, -s * 0.79 + bob); g.lineTo(sx * s, -s * 0.52 + bob); g.stroke();
      g.fillRect(sx * s - s * 0.1, -s * 0.52 + bob, s * 0.2, s * 0.13);
    }
    g.restore();
  }

  function drawFlag(x, y, s, ph) {
    g.fillStyle = 'rgba(178,58,46,.85)';
    const w1 = Math.sin(S.t * 5 + ph) * s * 0.1; const w2 = Math.sin(S.t * 5 + ph + 1.4) * s * 0.14;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + s * 0.5, y + w1, x + s, y + s * 0.2 + w2);
    g.quadraticCurveTo(x + s * 0.5, y + s * 0.45 + w1, x, y + s * 0.5);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(78,54,30,.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x, y + s * 0.9); g.stroke();
  }

  function drawMallet(ang) {
    const ml = L.ml;
    g.save(); g.translate(L.pivotX, L.pivotY); g.rotate(ang);
    g.lineJoin = 'round';
    // 柄
    g.fillStyle = '#9a6b3f'; g.strokeStyle = 'rgba(29,20,10,.75)'; g.lineWidth = 1.3;
    rr(g, -ml, -ml * 0.04, ml * 1.06, ml * 0.08, ml * 0.03); g.fill(); g.stroke();
    g.fillStyle = '#5a3a1e'; rr(g, -ml * 0.12, -ml * 0.05, ml * 0.18, ml * 0.1, ml * 0.03); g.fill();
    // 槌头
    const hw = ml * 0.26; const hh = ml * 0.46;
    const gr = g.createLinearGradient(-ml - hw / 2, 0, -ml + hw / 2, 0);
    gr.addColorStop(0, '#6e4526'); gr.addColorStop(0.5, '#a8774a'); gr.addColorStop(1, '#6a4224');
    g.fillStyle = gr; rr(g, -ml - hw / 2, -hh / 2, hw, hh, ml * 0.05); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(40,24,10,.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-ml - hw / 2, -hh * 0.32); g.lineTo(-ml + hw / 2, -hh * 0.32); g.moveTo(-ml - hw / 2, hh * 0.32); g.lineTo(-ml + hw / 2, hh * 0.32); g.stroke();
    g.restore();
  }

  function malletAngle() {
    const rest = 0.78 + Math.sin(S.t * 2.1) * 0.03;
    const k = S.knockT;
    if (k < 0) return S.phase === 'ready' || S.phase === 'enter' ? rest : rest + 0.25;
    if (k < 0.06) return lerp(rest, 1.1, k / 0.06);
    if (k < 0.1) return lerp(1.1, 0, (k - 0.06) / 0.04);
    if (k < 0.14) return 0.04;
    return lerp(0.04, rest, easeOutCubic(clamp((k - 0.14) / 0.24, 0, 1)));
  }

  function draw() {
    const W = L.W; const H = L.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(shake.x, shake.y);
    g.drawImage(bg, -2, -2, W + 4, H + 4);
    // 工人
    const ws = clamp(L.wallH * 0.62, 16, 44);
    for (const w of S.workers) {
      const x = ((w.u % 1) + 1) % 1 * (W + 60) - 30;
      const y = L.horizon + 4 + w.lane * Math.min(26, (L.tableY - L.horizon) * 0.3);
      drawWorker(x, y, ws * (0.85 + w.lane * 0.3), Math.sign(w.v), S.t * 7 + w.ph);
    }
    if (L.flags) L.flags.forEach((f, i) => drawFlag(f.x, f.y, clamp(L.wallH * 0.3, 10, 24), i * 2));
    // 两堆
    const pw = L.pileW;
    S.acc.forEach((b, i) => { const s = accSlot(i); drawSmallBrick(b, s.x, s.y, s.rot, pw); });
    S.rej.forEach((b, i) => { const s = rejSlot(i); drawSmallBrick(b, s.x, s.y, s.rot, pw); });
    // 堆名
    g.font = fBrush(clamp(L.pileW * 0.32, 13, 22)); g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(246,234,208,.8)';
    g.fillText('合格', L.accX, L.tableY + L.tableTh * 0.9);
    g.fillText('退回', L.rejX, L.tableY + L.tableTh * 0.9);
    // 当前砖
    const b = S.cur;
    const cx0 = L.bx + L.fw / 2; const cy0 = L.by + L.fh / 2;
    if (b && S.phase !== 'intro') {
      let cx = cx0; let cy = cy0; let rot = 0; let sc = 1; let alpha = 1;
      if (S.phase === 'enter') {
        const k = clamp(S.phaseT / 0.5, 0, 1);
        const drop = L.by + L.fh + 80;
        if (k < 0.7) { const u = k / 0.7; cy = cy0 - (1 - u * u) * drop; } else { const u = (k - 0.7) / 0.3; cy = cy0 - Math.sin(u * Math.PI) * drop * 0.03; }
      } else if (S.phase === 'leave' && S.flyTo) {
        const k = easeInOutCubic(clamp(S.phaseT / 0.45, 0, 1));
        const T = S.flyTo;
        cx = lerp(cx0, T.x, k); cy = lerp(cy0, T.y, k) - Math.sin(k * Math.PI) * L.fh * 0.25;
        rot = lerp(0, (b.decision ? -Math.PI / 2 : Math.PI / 2) + T.rot, k);
        sc = lerp(1, L.pileW / L.fh, k);
        alpha = 1 - k;
      }
      // 影子
      if (S.phase !== 'leave') {
        const lift = clamp((cy0 - cy) / (L.fh * 0.8), 0, 1);
        g.fillStyle = `rgba(30,18,6,${0.28 * (1 - lift)})`;
        g.beginPath(); g.ellipse(cx0 + L.d * 0.5, L.tableY + 2, L.fw * (0.72 - lift * 0.3), L.tableTh * 0.35, 0, 0, TAU); g.fill();
      }
      const jx = S.vib > 0 ? Math.sin(S.t * 95) * S.vib * 1.6 : 0;
      const extras = (S.phase === 'stamp' || S.phase === 'leave') ? stampExtras(b, alpha) : null;
      drawBrick(b, cx, cy, rot, sc, jx, extras);
      // 余音：两侧的颤纹
      if (S.vib > 0 && b.sound === 'good') {
        g.strokeStyle = `rgba(200,161,90,${S.vib})`; g.lineWidth = 2; g.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const r = L.fw * 0.18 + k * 9 + (1 - S.vib) * 16;
          for (const side of [-1, 1]) {
            const x = side < 0 ? L.bx - 6 : L.bx + L.fw + L.d + 6;
            g.beginPath(); g.arc(x - side * r, cy0, r, side < 0 ? Math.PI - 0.5 : -0.5, side < 0 ? Math.PI + 0.5 : 0.5); g.stroke();
          }
        }
      }
    }
    // 被惊走的蠹鱼
    if (S.fish && S.fish.t >= 0 && S.fish.t < 1.6) {
      const f = S.fish; const k = f.t / 1.6;
      const x = lerp(f.x0, f.x1, easeInOutCubic(k)); const y = f.y0 + Math.sin(f.t * 10) * 5 + (f.y1 - f.y0) * k;
      const x2 = lerp(f.x0, f.x1, easeInOutCubic(Math.min(1, k + 0.02))); const y2 = f.y0 + Math.sin((f.t + 0.03) * 10) * 5 + (f.y1 - f.y0) * (k + 0.02);
      drawSilverfish(g, x, y, Math.atan2(y2 - y, x2 - x), clamp(L.cs * 1.3, 16, 32), { t: S.t, rate: 22, gait: S.t * 40 });
    }
    // 木槌
    drawMallet(malletAngle());
    parts.draw(g);
    g.restore();
    // 时限条
    if (TIME) {
      const k = clamp(S.time / TIME, 0, 1);
      g.fillStyle = 'rgba(59,53,45,.15)'; g.fillRect(0, 0, W, 5);
      g.fillStyle = k < 0.2 ? (Math.sin(S.t * 10) > 0 ? '#b23a2e' : '#d4513f') : k < 0.4 ? '#c8a15a' : '#3f7f6f';
      g.fillRect(0, 0, W * k, 5);
    }
  }

  // ---------------------------------------------------------------- 逻辑
  let feedTimer = 0;
  function say(text, kind, dur = 2.2) {
    feed.textContent = text;
    feed.className = `bricks-feed show ${kind || 'info'}`;
    feedTimer = dur;
  }

  let hudKey = '';
  function updHud() {
    const sec = Math.ceil(S.time);
    const n = clamp(S.idx + 1, 1, N);
    const key = `${n}|${sec}|${S.correct}|${S.wrong}`;
    if (key === hudKey) return;
    hudKey = key;
    const center = `<span class="liba-hud">第 <b>${n}</b> / ${N} 块${TIME ? ` · <span class="${sec <= 15 ? 'warn' : ''}">余 ${sec} 秒</span>` : ''}</span>`;
    const right = `<span class="liba-hud"><span class="good">✓ ${S.correct}</span><span class="bad">✗ ${S.wrong}</span></span>`;
    ctx.hud({ center, right });
  }

  const tut = { on: opts.tutorial ?? (ctx.attempt === 1 || easy), step: 0, h: null };
  function relRect(elm) {
    const r = elm.getBoundingClientRect(); const s = ctx.root.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  }
  function tutReady() {
    if (!tut.on || tut.step !== 0) return;
    tut.step = 1;
    const r = relRect(bKnock);
    tut.h = hint(ctx, '先<b>敲</b>一敲，听听声音', { x: r.x + r.w / 2, y: r.y - 2, place: 'above' });
  }
  function tutKnock() {
    if (!tut.on || tut.step !== 1) return;
    tut.step = 2;
    if (tut.h) tut.h.close();
    const text = '再看铭文：<b>提调官、司吏、窑匠、造砖人夫</b>缺一不可；<br>有裂纹、颜色发红、字迹残缺的也要<b>退回</b>';
    if (L.portrait) tut.h = hint(ctx, text, { x: L.W / 2, y: L.feedY - 10, place: 'above', bob: false, arrow: false });
    else {
      const x = (L.bx + L.fw + L.d + L.W) / 2;
      tut.h = hint(ctx, text, { x, y: L.by + L.fh * 0.5, place: 'center', bob: false, arrow: false });
      tut.h.el.style.maxWidth = `${Math.max(200, L.W - L.bx - L.fw - L.d - 30)}px`;
      tut.h.at(x, L.by + L.fh * 0.5, 'center');
    }
  }
  function tutDecide() {
    if (tut.step >= 3) return;
    tut.step = 3;
    if (tut.h) { tut.h.close(); tut.h = null; }
  }

  function nextBrick() {
    S.idx++;
    if (S.idx >= N) { endRound(); return; }
    S.cur = bricks[S.idx];
    renderBrick(S.cur);
    S.phase = 'enter'; S.phaseT = 0; S.landed = false; S.stamped = false; S.flyTo = null;
    ctx.sfx('swoosh');
  }

  function land() {
    S.landed = true;
    ctx.sfx('wood');
    shake.add(2.2);
    const y = L.tableY;
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      parts.add({ x: L.bx + L.fw / 2 + side * L.fw * (0.3 + Math.random() * 0.25), y: y - 2, vx: side * (40 + Math.random() * 90), vy: -20 - Math.random() * 40, ay: 120, drag: 3, life: 0.6 + Math.random() * 0.4, size: 2 + Math.random() * 3, size1: 5, color: '#b7a07a', alpha: 0.7 });
    }
  }

  function onReady() {
    const b = S.cur;
    tutReady();
    if (b.flaw === 'worm' && !S.firstWormSeen && b.holes && b.holes.length) {
      S.firstWormSeen = true;
      const h = b.holes[b.holes.length - 1];
      const x0 = L.bx + h.x; const y0 = L.by + h.y;
      S.fish = { t: -0.55, x0, y0, x1: L.W + 60, y1: y0 + L.fh * 0.25, said: false };
    }
  }

  function knock() {
    if (S.phase !== 'ready') return;
    if (S.knockT >= 0 && S.knockT < 0.3) return;
    S.knockT = 0; S.hitDone = false;
  }

  function impact() {
    const b = S.cur;
    if (!b) return;
    b.knocked++;
    const good = b.sound === 'good';
    const ix = L.hitX; const iy = L.hitY;
    if (good) {
      ctx.sfx('knock_good');
      S.vib = 1;
      for (let k = 0; k < 3; k++) parts.add({ shape: 'ring', x: ix, y: iy, size: 6, size1: L.fh * 0.75, lw: 3.2, life: 1.1, delay: k * 0.13, color: '#c8a15a', alpha: 0.85, sy: 0.92 });
      parts.add({ shape: 'text', text: '铿——', font: fBrush(clamp(L.fw * 0.3, 20, 34)), x: ix + L.ml * 0.3, y: iy - 18, vy: -26, life: 1.1, hold: 0.55, size: 0.8, size1: 1.15, color: '#8a6a2c', stroke: 'rgba(251,246,234,.95)', lw: 5 });
      say(easy ? '声音清越，有金石之声——是好声' : '声音清越，有金石之声', 'info', 1.6);
    } else {
      ctx.sfx('knock_bad');
      shake.add(2.5);
      parts.add({ shape: 'ring', x: ix, y: iy, size: 5, size1: L.fh * 0.16, lw: 2.5, life: 0.32, color: '#6b6152', alpha: 0.8 });
      for (let i = 0; i < 10; i++) parts.add({ x: ix - 4, y: iy + (Math.random() - 0.5) * 10, vx: -20 - Math.random() * 50, vy: -10 + Math.random() * 30, ay: 260, life: 0.7, size: 1.5 + Math.random() * 2, color: rgba(mixRgb(b.tone, [60, 50, 40], 0.3)), alpha: 0.8 });
      parts.add({ shape: 'text', text: easy ? '噗——闷！' : '噗', font: fBrush(clamp(L.fw * 0.26, 18, 30)), x: ix + L.ml * 0.3, y: iy - 12, vy: -10, life: 0.9, hold: 0.5, size: 1, color: easy ? '#b23a2e' : '#5b544a', stroke: 'rgba(251,246,234,.95)', lw: 5 });
      say(easy ? '声音发闷——这块砖有暗伤！' : '声音发闷', easy ? 'bad' : 'info', 1.6);
    }
    tutKnock();
  }

  function decide(accept) {
    if (S.phase !== 'ready') return;
    (accept ? bAccept : bReject).flash();
    const b = S.cur;
    b.decision = accept;
    const correct = accept !== b.bad;
    b.correct = correct;
    S.phase = 'stamp'; S.phaseT = 0; S.stamped = false;
    S.stampDur = b.bad ? 0.95 : 0.5;
    if (correct) {
      S.correct++; S.streak++;
      ctx.sfx(S.streak >= 3 ? 'perfect' : 'good');
      ctx.toast(S.streak >= 5 ? '妙！' : S.streak >= 3 ? '好眼力！' : '好！', S.streak >= 3 ? 'gold' : 'good');
      if (b.bad) say(`✓ 退得对——${b.flaw === 'missing' ? `缺了${ROLE_NAME[b.missing]}的名字` : FLAW_TEXT[b.flaw]}`, 'good');
      else say('✓ 好砖：青灰匀净，铭文齐全', 'good');
    } else {
      S.wrong++; S.streak = 0;
      ctx.sfx('bad');
      ctx.toast('可惜', 'bad');
      shake.add(4);
      if (b.bad) {
        const why = b.flaw === 'missing' ? `缺了${ROLE_NAME[b.missing]}的名字` : FLAW_TEXT[b.flaw];
        say(`✗ 可惜——${why}${b.flaw === 'dull' && !b.knocked ? '（敲一敲就知道）' : ''}`, 'bad', 2.6);
      } else say('✗ 这本是块好砖', 'bad', 2.4);
    }
    tutDecide();
  }

  function endRound() {
    S.phase = 'over'; S.phaseT = 0;
    ctx.sfx('seal');
    banner(ctx, '验毕', `验对 ${S.correct} / ${N} 块`, { ms: 1700 });
  }

  function timeout() {
    if (S.phase === 'over') return;
    const left = N - S.correct - S.wrong;
    S.wrong += left;
    S.timeUp = true;
    S.phase = 'over'; S.phaseT = 0;
    ctx.sfx('gong');
    ctx.toast('时辰到！', 'bad');
    say(`时辰到——还有 ${left} 块没验`, 'bad', 3);
  }

  function finish() {
    if (S.result) return;
    const perfect = S.correct === N;
    const success = S.correct >= PASS;
    let note;
    if (perfect) note = '一块不差！物勒工名，以考其诚——六百多年后，这些名字仍刻在南京城墙上。';
    else if (success) note = '验砖完毕，次砖都已退回。只是那块被啃掉字的砖……是什么东西干的？';
    else if (S.timeUp) note = '时辰到了。验砖要诀：看铭文齐不齐、有无裂纹、颜色是否青灰，再敲一敲听声。';
    else note = `差了一点（需验对 ${PASS} 块）。要诀：看铭文齐不齐、有无裂纹、颜色是否青灰，再敲一敲听声。`;
    S.result = { success, score: S.correct, perfect, note, scoreText: `验对 ${S.correct} / ${N} 块` };
    S.done(S.result);
  }

  function update(dt) {
    if (S.freeze || hostPaused(ctx)) dt = 0; // 宿主「暂且离开？」确认框打开时，时间停住
    S.t += dt; S.phaseT += dt;
    if (Math.abs(ctx.w - L.W) > 0.5 || Math.abs(ctx.h - L.H) > 0.5) { layout(); if (S.cur) renderBrick(S.cur); }
    parts.update(dt);
    shake.update(dt);
    S.vib = Math.max(0, S.vib - dt * 2);
    for (const w of S.workers) w.u += w.v * dt;
    if (feedTimer > 0) { feedTimer -= dt; if (feedTimer <= 0) feed.classList.remove('show'); }
    if (S.knockT >= 0) {
      S.knockT += dt;
      if (!S.hitDone && S.knockT >= 0.1) { S.hitDone = true; impact(); }
      if (S.knockT > 0.4) S.knockT = -1;
    }
    if (S.fish) {
      S.fish.t += dt;
      if (S.fish.t >= 0 && !S.fish.said) { S.fish.said = true; ctx.sfx('scurry'); ctx.toast('字……被啃掉了？'); }
      if (S.fish.t > 1.7) S.fish = null;
    }
    switch (S.phase) {
      case 'intro':
        if (S.phaseT > 1.25) nextBrick();
        break;
      case 'enter':
        if (!S.landed && S.phaseT > 0.35) land();
        if (S.phaseT > 0.5) { S.phase = 'ready'; S.phaseT = 0; S.timerOn = true; onReady(); }
        break;
      case 'ready':
        if (TIME && S.timerOn) {
          const before = Math.ceil(S.time);
          S.time = Math.max(0, S.time - dt);
          const after = Math.ceil(S.time);
          if (after !== before && after <= 10 && after > 0) ctx.sfx(after <= 3 ? 'countdown' : 'tick');
          if (S.time <= 0) timeout();
        }
        break;
      case 'stamp':
        if (!S.stamped && S.phaseT > 0.1) { S.stamped = true; ctx.sfx('stamp'); shake.add(2.5); }
        if (S.phaseT > S.stampDur) {
          S.phase = 'leave'; S.phaseT = 0;
          const b = S.cur;
          S.flyTo = b.decision ? accSlot(S.acc.length) : rejSlot(S.rej.length);
          ctx.sfx('whoosh');
        }
        break;
      case 'leave':
        if (S.phaseT > 0.45) {
          const b = S.cur;
          (b.decision ? S.acc : S.rej).push(b);
          b.cv = null;
          S.cur = null;
          nextBrick();
        }
        break;
      case 'over':
        if (S.phaseT > 1.7) finish();
        break;
      default:
    }
    updHud();
  }

  // ---------------------------------------------------------------- 启动
  layout();
  ctx.onResize(() => { layout(); if (S.cur) renderBrick(S.cur); draw(); });
  keymap(ctx, {
    KeyK: () => { bKnock.flash(); knock(); },
    Space: () => { bKnock.flash(); knock(); },
    KeyA: () => decide(true),
    ArrowLeft: () => decide(true),
    KeyD: () => decide(false),
    ArrowRight: () => decide(false),
  });
  banner(ctx, '洪武十年', easy ? '聚宝门 · 这回只验八块，不限时辰' : '聚宝门 · 验收城砖', { ms: 1900, top: '38%' });
  ctx.sfx('drum');
  updHud();
  devHandle('__bricks', { S, bricks, L, decide, knock });
  ctx.loop((dt) => { update(dt); draw(); });
  return untilDone(ctx, (done) => { S.done = done; });
}
