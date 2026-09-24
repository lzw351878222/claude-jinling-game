// 经史子集 —— 永乐五年（1407），文渊阁的书架倒了，典籍散落一地。
// 按四部分类把书归架：拖书到书架，或点书架、按 1–4。每放一本，都讲一句它为什么归在那一部。
//
// opts：count 本数（默认 12，简单 8）· pass 过关所需归对本数 · seed 随机种子 · tutorial true/false
import { clamp, lerp, rng, shuffle, easeOutCubic, easeInOutCubic, TAU, injectStyle, el } from '../core/util.js';
import css from './books.css';
import {
  useLibStyle, fBrush, fBody, fontsReady, Particles, Shake, hint, banner, keymap, untilDone, devHandle, hostPaused,
  rr, rgba, mixRgb, drawWood, paperTexture,
} from './lib-a.js';

const CATS = [
  { k: '经', sub: '儒家经典 · 小学', color: '#8cc3ae', deep: '#3f7f6f' },
  { k: '史', sub: '史传 · 地理 · 典制', color: '#ee9580', deep: '#b23a2e' },
  { k: '子', sub: '诸子 · 兵农医 · 小说杂家', color: '#aec2e6', deep: '#3a4a6b' },
  { k: '集', sub: '诗文 · 词赋 · 文评', color: '#ecd49a', deep: '#8a6a2c' },
];
// 分部依《四库全书总目》；均为永乐五年以前已有之书。hard = 容易放错、值得一讲的。
const BOOKS = [
  { t: '周易', c: 0, d: '以卦爻推演阴阳变化，“天行健，君子以自强不息”', why: '群经之首，归经部·易类' },
  { t: '尚书', c: 0, d: '上古虞、夏、商、周的典、谟、训、诰之文', why: '“五经”之一，归经部·书类' },
  { t: '诗经', c: 0, d: '“五经”之一，收风、雅、颂三百零五篇', why: '虽是诗歌，却是儒家经典，归经部，不入集部', hard: true },
  { t: '礼记', c: 0, d: '汉儒辑录的论礼文章，《大学》《中庸》皆出其中', why: '“三礼”之一，归经部·礼类' },
  { t: '春秋左传', c: 0, d: '相传左丘明为解《春秋》经而作的传', why: '解经之传随经而行，归经部·春秋类', hard: true },
  { t: '论语', c: 0, d: '孔子及其弟子的言行录，“学而时习之”', why: '“四书”之一，归经部' },
  { t: '孟子', c: 0, d: '“四书”之一，记孟子与弟子论仁政、性善', why: '《隋书·经籍志》本列子部儒家，宋代升为“四书”，四库归经部', hard: true },
  { t: '尔雅', c: 0, d: '最早的训诂辞书，解释古语词义', why: '文字训诂之学称“小学”，附于经部', hard: true },
  { t: '孝经', c: 0, d: '托为孔子为曾子讲述孝道', why: '儒家经典，归经部·孝经类' },
  { t: '史记', c: 1, d: '司马迁撰，上起黄帝，下至汉武帝', why: '纪传体通史，列正史之首，归史部' },
  { t: '汉书', c: 1, d: '东汉班固撰，记西汉一朝史事', why: '纪传体断代史，归史部·正史类' },
  { t: '三国志', c: 1, d: '西晋陈寿撰，分魏、蜀、吴三书', why: '正史之一，归史部' },
  { t: '资治通鉴', c: 1, d: '司马光主编，逐年记战国至五代一千三百六十二年事', why: '编年体通史，归史部·编年类' },
  { t: '水经注', c: 1, d: '北魏郦道元为《水经》作注，记江河源流、沿岸山川城邑', why: '书名有“经”，其实是地理书，归史部·地理类', hard: true },
  { t: '贞观政要', c: 1, d: '唐吴兢辑录唐太宗与魏徵等大臣论政之语', why: '记一朝君臣政事，归史部' },
  { t: '国语', c: 1, d: '分记周、鲁、齐、晋、郑、楚、吴、越八国之语', why: '分国记言的史书，归史部' },
  { t: '大唐西域记', c: 1, d: '玄奘口述、辩机撰文，记西行所见百余国', why: '记异域山川风俗，归史部·地理类' },
  { t: '通典', c: 1, d: '唐杜佑撰，记历代典章制度的沿革', why: '典章制度之书，归史部·政书类' },
  { t: '老子', c: 2, d: '“道可道，非常道”，五千余言', why: '道家之书，归子部' },
  { t: '庄子', c: 2, d: '庄周及其后学所著，“北冥有鱼”', why: '道家之书，归子部' },
  { t: '韩非子', c: 2, d: '集法、术、势之说于一身', why: '法家之书，归子部' },
  { t: '墨子', c: 2, d: '主张兼爱、非攻、尚贤、节用', why: '墨家之书，归子部（《四库》不设墨家，列入杂家类）' },
  { t: '孙子兵法', c: 2, d: '春秋孙武所著兵书，“知彼知己，百战不殆”', why: '兵书归子部·兵家类' },
  { t: '齐民要术', c: 2, d: '北魏贾思勰撰，讲农耕、畜牧、酿造', why: '农书归子部·农家类' },
  { t: '黄帝内经', c: 2, d: '托为黄帝与岐伯问答，论阴阳脏腑与针灸', why: '医书归子部·医家类' },
  { t: '世说新语', c: 2, d: '南朝宋刘义庆主持编撰，记汉末至东晋名士轶事', why: '古之“小说家”记琐闻轶事，归子部', hard: true },
  { t: '梦溪笔谈', c: 2, d: '北宋沈括的笔记，记天文历算、活板印书等', why: '笔记杂说，归子部·杂家类' },
  { t: '茶经', c: 2, d: '唐陆羽著，论茶之源、之具、之造、之饮', why: '谱录之书，归子部' },
  { t: '楚辞', c: 3, d: '西汉刘向辑屈原、宋玉等人作品，“路漫漫其修远兮”', why: '集部以《楚辞》居首' },
  { t: '文选', c: 3, d: '南朝梁昭明太子萧统所编，选先秦至梁的诗文', why: '众人诗文合编为“总集”，归集部' },
  { t: '李太白集', c: 3, d: '李白的诗文，“天生我材必有用”', why: '一人的诗文集称“别集”，归集部' },
  { t: '杜工部集', c: 3, d: '杜甫的诗集，后人誉为“诗史”', why: '虽号“诗史”，仍是诗集，归集部·别集类', hard: true },
  { t: '昌黎先生集', c: 3, d: '韩愈的诗文，苏轼赞其“文起八代之衰”', why: '一人的诗文集，归集部·别集类' },
  { t: '东坡集', c: 3, d: '苏轼的诗文，“横看成岭侧成峰”', why: '一人的诗文集，归集部·别集类' },
  { t: '花间集', c: 3, d: '后蜀赵崇祚编，收晚唐五代词五百首', why: '词选，归集部·词曲类' },
  { t: '乐府诗集', c: 3, d: '北宋郭茂倩编，汇辑历代乐府歌辞', why: '众人诗歌合编，归集部·总集类' },
  { t: '文心雕龙', c: 3, d: '南朝梁刘勰著，论文章体制与写作之道', why: '评论诗文之书，归集部·诗文评类', hard: true },
];
const COVERS = ['#2f3d5c', '#27334d', '#2c4a4a', '#7e6036', '#5b3a2a', '#3d4a35', '#4a3350', '#324258'];
const STREAK_WORDS = { 3: '连中三元！', 5: '学富五车！', 8: '博古通今！', 12: '一本不差！' };

function pickRound(R, n, easy) {
  const per = Math.floor(n / 4);
  let extra = n - per * 4;
  const out = [];
  for (let c = 0; c < 4; c++) {
    const pool = shuffle(BOOKS.filter((b) => b.c === c), R);
    const k = per + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    let hard = 0;
    for (const b of pool) {
      if (out.filter((o) => o.c === c).length >= k) break;
      if (b.hard && hard >= (easy ? 0 : 1)) continue;
      out.push(b);
      if (b.hard) hard++;
    }
  }
  for (let tries = 0; tries < 200; tries++) {
    const s = shuffle(out, R);
    if (s.length > 1 && s[0].hard) continue;
    let bad = false;
    for (let i = 2; i < s.length; i++) if (s[i].c === s[i - 1].c && s[i].c === s[i - 2].c) bad = true;
    if (!bad) return s;
  }
  return out;
}

export default {
  id: 'books',
  title: '经史子集',
  subtitle: '为文渊阁归架',
  rules: [
    '书架倒了，典籍散落一地。按<b>经、史、子、集</b>四部把书归回书架——这四部之名，定于《隋书·经籍志》。',
    '<b>经</b>：儒家经典与“小学”；<b>史</b>：史书、地理、典章；<b>子</b>：诸子百家、兵农医、小说杂家；<b>集</b>：诗文词赋与文评。',
    '把书<b>拖到</b>书架上，或直接<b>点书架</b>。每放一本，都会讲它为什么归在那一部。',
    '一轮十二本，归对十本即可过关。',
  ],
  controls: '鼠标 / 触屏拖动或点选 · 键盘 1 经 2 史 3 子 4 集',
  async play(ctx, opts = {}) {
    useLibStyle();
    injectStyle('books', css);
    await fontsReady();
    return run(ctx, opts);
  },
};

async function run(ctx, opts) {
  const easy = ctx.difficulty === 0;
  const N = Math.max(4, opts.count || (easy ? 8 : 12));
  const PASS = opts.pass ?? (easy ? Math.ceil(N * 0.75) : Math.ceil((N * 10) / 12));
  const R = rng(opts.seed ?? ((Date.now() ^ (ctx.attempt * 4231)) >>> 0));
  const list = pickRound(R, N, easy).map((b, i) => ({ ...b, i, cover: COVERS[Math.floor(R() * COVERS.length)] }));
  const dpr = ctx.dpr;

  const cv = ctx.canvas();
  const g = cv.g;
  const bg = document.createElement('canvas');
  const ui = ctx.el('div', 'books-ui');
  const desc = el('div', 'books-desc', ui);
  desc.innerHTML = '<div class="bd-t"></div><div class="bd-d"></div><div class="bd-q">归入哪一部？</div>';
  const descT = desc.querySelector('.bd-t'); const descD = desc.querySelector('.bd-d');
  const teach = el('div', 'books-teach', ui);
  const streakEl = el('div', 'books-streak', ui);
  const parts = new Particles(400);
  const shake = new Shake();
  const L = {};
  const S = {
    phase: 'intro', phaseT: 0, t: 0, idx: -1, cur: null, bx: 0, by: 0, rot: 0, sc: 1, lift: 0,
    drag: null, hover: -1, tap: -1, correct: 0, wrong: 0, streak: 0, tries: 0, hintShelf: -1,
    shelves: [[], [], [], []], flash: [0, 0, 0, 0].map(() => ({ t: 0, good: true })), fly: null,
    done: null, result: null, freeze: false, pile: [],
  };
  // 书架上原本没倒的几本
  for (let c = 0; c < 4; c++) S.shelves[c].push({ cover: COVERS[Math.floor(R() * COVERS.length)], w: 0.62 + R() * 0.26, old: true, t: 9 });
  for (let i = 0; i < N; i++) S.pile.push({ r: (R() - 0.5) * 0.9, dx: (R() - 0.5), dy: R(), cover: list[i].cover });

  // ---------------------------------------------------------------- 布局
  function layout() {
    const W = ctx.w; const H = ctx.h;
    L.W = W; L.H = H;
    L.land = W / H >= 1.0;
    L.sh = [];
    if (L.land) {
      const top = H * 0.55; const hh = H - top - 12; const gap = 14; const sw = (W - 32 - gap * 3) / 4;
      for (let i = 0; i < 4; i++) L.sh.push({ x: 16 + i * (sw + gap), y: top, w: sw, h: hh });
      L.shelfTop = top;
      L.bookH = clamp(Math.min(top - 44, H * 0.42), 120, 320); L.bookW = L.bookH * 0.68;
      L.homeX = W * 0.34; L.homeY = (top - 8) / 2 + 6;
      const dl = L.homeX + L.bookW / 2 + 34; const dw = Math.min(W - dl - 26, 460);
      desc.style.cssText = `left:${dl}px;top:${Math.max(12, L.homeY - L.bookH * 0.45)}px;width:${dw}px;`;
      teach.style.cssText = `left:${dl}px;width:${dw}px;top:auto;bottom:${H - top + 12}px;`;
      L.pileX = Math.max(60, L.homeX - L.bookW / 2 - 110); L.pileY = top - 26; L.pileS = clamp(L.bookW * 0.38, 40, 80);
      L.showPile = L.homeX - L.bookW / 2 > 150;
    } else {
      const gap = 12; const sw = (W - 32 - gap) / 2; const shH = clamp(H * 0.17, 96, 150);
      const top = H - 12 - shH * 2 - gap;
      for (let i = 0; i < 4; i++) L.sh.push({ x: 16 + (i % 2) * (sw + gap), y: top + Math.floor(i / 2) * (shH + gap), w: sw, h: shH });
      L.shelfTop = top;
      const teachH = 60; const descH = 104;
      L.bookH = clamp(top - 12 - teachH - descH - 26, 110, 260); L.bookW = L.bookH * 0.68;
      L.homeX = W / 2; L.homeY = 14 + L.bookH / 2;
      desc.style.cssText = `left:12px;right:12px;top:${L.homeY + L.bookH / 2 + 14}px;`;
      teach.style.cssText = `left:12px;right:12px;top:auto;bottom:${H - top + 8}px;`;
      L.pileX = (W - L.bookW) / 4; L.pileY = L.homeY + L.bookH * 0.3; L.pileS = clamp(L.bookW * 0.34, 28, 56);
      L.showPile = (W - L.bookW) / 2 > 70;
    }
    for (const s of L.sh) {
      s.ph = clamp(s.h * 0.34, 44, 58);
      s.inner = { x: s.x + 10, y: s.y + s.ph + 12, w: s.w - 20, h: s.h - s.ph - 22 };
    }
    if (S.phase === 'ready' && !S.drag) { S.bx = L.homeX; S.by = L.homeY; }
    drawBackground();
  }

  function drawBackground() {
    const W = L.W; const H = L.H;
    bg.width = Math.ceil(W * dpr); bg.height = Math.ceil(H * dpr);
    const b = bg.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 墙
    const wg = b.createLinearGradient(0, 0, 0, L.shelfTop);
    wg.addColorStop(0, '#e8dcc2'); wg.addColorStop(1, '#d9c7a4');
    b.fillStyle = wg; b.fillRect(0, 0, W, L.shelfTop + 20);
    b.globalAlpha = 0.6; b.fillStyle = b.createPattern(paperTexture(), 'repeat'); b.fillRect(0, 0, W, L.shelfTop + 20); b.globalAlpha = 1;
    // 梁
    drawWood(b, 0, 0, W, 10, { base: '#4a2e1b', light: '#5c3a22', dark: '#321d10', seed: 2, lines: 3 });
    // 窗棂与光
    const wx = L.land ? W * 0.78 : W * 0.8; const wy = L.land ? L.shelfTop * 0.12 : 8; const ww = L.land ? Math.min(W * 0.16, 190) : W * 0.16; const wh = L.land ? L.shelfTop * 0.5 : ww * 1.2;
    if (L.land) {
      const beam = b.createLinearGradient(wx, wy, wx - W * 0.25, L.shelfTop);
      beam.addColorStop(0, 'rgba(255,240,200,.35)'); beam.addColorStop(1, 'rgba(255,240,200,0)');
      b.fillStyle = beam;
      b.beginPath(); b.moveTo(wx, wy); b.lineTo(wx + ww, wy); b.lineTo(wx + ww - W * 0.2, L.shelfTop); b.lineTo(wx - W * 0.3, L.shelfTop); b.closePath(); b.fill();
    }
    b.fillStyle = '#f6eed8'; b.fillRect(wx, wy, ww, wh);
    b.strokeStyle = '#5a3a22'; b.lineWidth = 2.5; b.strokeRect(wx, wy, ww, wh);
    b.lineWidth = 1.4;
    for (let i = 1; i < 5; i++) { b.beginPath(); b.moveTo(wx + (ww * i) / 5, wy); b.lineTo(wx + (ww * i) / 5, wy + wh); b.stroke(); }
    for (let i = 1; i < 6; i++) { b.beginPath(); b.moveTo(wx, wy + (wh * i) / 6); b.lineTo(wx + ww, wy + (wh * i) / 6); b.stroke(); }
    // 地面
    const fy = L.shelfTop - 30;
    drawWood(b, 0, fy, W, H - fy, { base: '#8a5c38', light: '#9c6a42', dark: '#6a4428', seed: 8, lines: 18, alpha: 0.22 });
    b.fillStyle = 'rgba(40,20,8,.25)'; b.fillRect(0, fy, W, 3);
    // 散落的书页
    const Rp = rng(17);
    for (let i = 0; i < 5; i++) {
      const x = Rp() * W; const y = fy + 8 + Rp() * 20; const s = 26 + Rp() * 16;
      b.save(); b.translate(x, y); b.rotate((Rp() - 0.5) * 0.9);
      b.fillStyle = '#efe6cf'; b.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
      b.strokeStyle = 'rgba(178,58,46,.5)'; b.lineWidth = 0.7; b.strokeRect(-s / 2 + 2, -s * 0.35 + 2, s - 4, s * 0.7 - 4);
      b.strokeStyle = 'rgba(30,25,20,.4)'; b.lineWidth = 1;
      for (let k = 1; k < 5; k++) { b.beginPath(); b.moveTo(-s / 2 + (s * k) / 5, -s * 0.28); b.lineTo(-s / 2 + (s * k) / 5, s * 0.2); b.stroke(); }
      b.restore();
    }
  }

  // ---------------------------------------------------------------- 绘制：书、书架
  function drawBook(b, x, y, rot, sc, alpha = 1, lift = 0) {
    const w = L.bookW; const h = L.bookH;
    g.save();
    g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    g.globalAlpha *= alpha;
    const x0 = -w / 2; const y0 = -h / 2;
    g.fillStyle = `rgba(30,18,6,${0.22 + lift * 0.12})`;
    rr(g, x0 + 5 + lift * 8, y0 + 8 + lift * 12, w, h, 4); g.fill();
    const th = Math.max(4, w * 0.04);
    g.fillStyle = '#eadfc3'; rr(g, x0 - th * 0.7, y0 + th * 0.9, w, h, 3); g.fill();
    g.strokeStyle = 'rgba(120,100,70,.55)'; g.lineWidth = 0.7;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0 - th * 0.7 * (k / 4), y0 + h + th * 0.9 * (k / 4)); g.lineTo(x0 + w - th * 0.7 * (1 - k / 4), y0 + h + th * 0.9 * (k / 4)); g.stroke(); }
    const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
    gr.addColorStop(0, rgba(mixRgb(b.cover, '#ffffff', 0.12))); gr.addColorStop(1, rgba(mixRgb(b.cover, '#000000', 0.2)));
    rr(g, x0, y0, w, h, 3); g.fillStyle = gr; g.fill();
    g.save(); rr(g, x0, y0, w, h, 3); g.clip();
    g.globalAlpha *= 0.4; g.fillStyle = g.createPattern(paperTexture(), 'repeat'); g.fillRect(x0, y0, w, h);
    g.restore();
    // 包角
    g.fillStyle = rgba(mixRgb(b.cover, '#000000', 0.45));
    const cz = w * 0.13;
    g.beginPath(); g.moveTo(x0 + w, y0); g.lineTo(x0 + w - cz, y0); g.lineTo(x0 + w, y0 + cz); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x0 + w, y0 + h); g.lineTo(x0 + w - cz, y0 + h); g.lineTo(x0 + w, y0 + h - cz); g.closePath(); g.fill();
    // 线装：四眼订线在右侧
    const hx = x0 + w - w * 0.085; const lw = Math.max(1.2, w * 0.013);
    g.strokeStyle = '#efe6d0'; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hx, y0 + h * 0.035); g.lineTo(hx, y0 + h * 0.965); g.stroke();
    for (const f of [0.035, 0.12, 0.37, 0.63, 0.88, 0.965]) { g.beginPath(); g.moveTo(hx, y0 + h * f); g.lineTo(x0 + w, y0 + h * f); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.45)';
    for (const f of [0.12, 0.37, 0.63, 0.88]) { g.beginPath(); g.arc(hx, y0 + h * f, lw * 0.9, 0, TAU); g.fill(); }
    // 题签
    const sw = w * 0.22; const sh = h * 0.6; const sx = x0 + w * 0.12; const sy = y0 + h * 0.07;
    g.fillStyle = '#f5eed9'; g.fillRect(sx, sy, sw, sh);
    g.strokeStyle = 'rgba(80,60,30,.5)'; g.lineWidth = 1; g.strokeRect(sx + 2.5, sy + 2.5, sw - 5, sh - 5);
    const chars = [...b.t];
    const cs = Math.min(sw * 0.72, (sh - 12) / (chars.length * 1.04));
    g.font = fBrush(cs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1d1b18';
    const oy = sy + (sh - chars.length * cs * 1.04) / 2 + cs * 0.52;
    chars.forEach((ch, i) => g.fillText(ch, sx + sw / 2, oy + i * cs * 1.04));
    g.restore();
  }

  function drawSlab(cx, bottom, w, h, cover, alpha) {
    g.save(); g.globalAlpha *= alpha;
    g.fillStyle = cover; g.fillRect(cx - w / 2, bottom - h, w, h);
    g.fillStyle = '#ece2c6'; g.fillRect(cx - w / 2 + 1, bottom - h + 1.6, w - 2, h - 3.2);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.strokeRect(cx - w / 2 + 0.5, bottom - h + 0.5, w - 1, h - 1);
    g.fillStyle = '#f8f3e6'; g.fillRect(cx + w * 0.3, bottom - h + 1, Math.max(3, w * 0.06), h - 2);
    g.restore();
  }

  function tiersOf(s) { return s.inner.h > 150 ? 3 : s.inner.h > 96 ? 2 : 1; }
  function slabH(s) { return clamp(s.inner.h / tiersOf(s) / 6, 6, 12); }
  function stackBase(s) { return s.inner.y + s.inner.h - 4; }
  function stackTop(i) {
    const s = L.sh[i];
    return stackBase(s) - S.shelves[i].length * slabH(s);
  }
  // 上层书格里原有的藏书（不动的背景）
  function drawOldStock(seed, x, bottom, w, h) {
    const Rs = rng(seed);
    let sx = x;
    g.save();
    g.globalAlpha *= 0.8;
    while (sx < x + w - 14) {
      const sw = Math.min(x + w - sx, 24 + Rs() * 30);
      if (sw < 14) break;
      const cover = COVERS[Math.floor(Rs() * COVERS.length)];
      if (Rs() < 0.32) {
        const hh = h * (0.55 + Rs() * 0.4);
        g.fillStyle = cover; g.fillRect(sx, bottom - hh, sw, hh);
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; g.strokeRect(sx + 0.5, bottom - hh + 0.5, sw - 1, hh - 1);
        g.fillStyle = '#efe6d0'; g.fillRect(sx + sw - 5, bottom - hh * 0.7, 3, 4); g.fillRect(sx + sw - 5, bottom - hh * 0.35, 3, 4);
        g.fillStyle = '#eadfc4'; g.fillRect(sx + sw * 0.2, bottom - hh + 3, sw * 0.3, Math.min(8, hh * 0.3));
      } else {
        let yy = bottom;
        const n = 2 + Math.floor(Rs() * 5);
        for (let k = 0; k < n && bottom - yy < h - 6; k++) {
          const bh = 4 + Rs() * 4; const inset = (Rs() - 0.5) * 3;
          g.fillStyle = COVERS[Math.floor(Rs() * COVERS.length)]; g.fillRect(sx + inset, yy - bh, sw, bh);
          g.fillStyle = '#e6dbbf'; g.fillRect(sx + inset + 1, yy - bh + 1, sw - 2, bh - 2);
          yy -= bh;
        }
      }
      sx += sw + 4 + Rs() * 6;
    }
    g.restore();
  }

  function drawShelves() {
    for (let i = 0; i < 4; i++) {
      const s = L.sh[i]; const C = CATS[i]; const f = S.flash[i];
      const hov = S.hover === i;
      const hintK = S.hintShelf === i ? 0.5 + 0.5 * Math.sin(S.t * 6) : 0;
      const dx = !f.good && f.t > 0 ? Math.sin(S.t * 70) * 5 * f.t : 0;
      g.save();
      g.translate(dx, 0);
      // 光晕
      const glow = Math.max(hov ? 1 : 0, f.t, hintK * 0.8);
      if (glow > 0.01) {
        g.save();
        g.shadowColor = !f.good && f.t > 0 ? 'rgba(210,60,40,.9)' : C.color; g.shadowBlur = 22 * glow;
        g.strokeStyle = !f.good && f.t > 0 ? `rgba(210,60,40,${glow})` : rgba(C.color, glow);
        g.lineWidth = 4; rr(g, s.x - 2, s.y - 2, s.w + 4, s.h + 4, 8); g.stroke();
        g.restore();
      }
      // 柜身
      const wg = g.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
      wg.addColorStop(0, '#6f4629'); wg.addColorStop(1, '#4b2d17');
      rr(g, s.x, s.y, s.w, s.h, 6); g.fillStyle = wg; g.fill();
      g.strokeStyle = 'rgba(20,10,4,.8)'; g.lineWidth = 2; g.stroke();
      // 牌匾
      rr(g, s.x + 6, s.y + 6, s.w - 12, s.ph, 4);
      g.fillStyle = hov ? '#3a2216' : '#2a1810'; g.fill();
      g.strokeStyle = rgba(C.color, 0.85); g.lineWidth = 1.5; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = fBrush(s.ph * 0.56); g.fillStyle = C.color;
      g.fillText(C.k, s.x + s.w / 2, s.y + 6 + s.ph * 0.36);
      g.font = fBody(clamp(s.w * 0.07, 11, 14)); g.fillStyle = 'rgba(246,234,208,.8)';
      g.fillText(C.sub, s.x + s.w / 2, s.y + 6 + s.ph * 0.8, s.w - 20);
      if (!ctx.isTouch) {
        g.font = fBody(12); g.fillStyle = 'rgba(246,234,208,.5)'; g.textAlign = 'left';
        g.fillText(String(i + 1), s.x + 12, s.y + 16);
      }
      // 书格（分层：上层是原有藏书，最下一层放归架的书）
      const n = s.inner;
      g.fillStyle = '#23150b'; g.fillRect(n.x, n.y, n.w, n.h);
      const tiers = tiersOf(s); const tH = n.h / tiers;
      for (let k = 0; k < tiers; k++) {
        const ty = n.y + k * tH;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(n.x, ty, n.w, 6);
        if (k < tiers - 1) drawOldStock(i * 17 + k * 5 + 3, n.x + 5, ty + tH - 4, n.w - 10, tH - 12);
        g.fillStyle = '#5c3a22'; g.fillRect(n.x - 2, ty + tH - 4, n.w + 4, 5);
        g.fillStyle = 'rgba(255,220,170,.12)'; g.fillRect(n.x - 2, ty + tH - 4, n.w + 4, 1.2);
      }
      const sh = slabH(s); const base = stackBase(s);
      S.shelves[i].forEach((bk, k) => {
        const drop = bk.t < 0.25 ? (1 - easeOutCubic(bk.t / 0.25)) * 18 : 0;
        drawSlab(n.x + n.w / 2 + ((k * 37) % 7 - 3), base - k * sh - drop, n.w * bk.w, sh, bk.cover, bk.old ? 0.55 : 1);
      });
      g.restore();
    }
  }

  function drawPile() {
    if (!L.showPile) return;
    // 当前这本一经取出就不再算在书堆里（包括落架后的 'after' 阶段，免得书堆闪回一本）
    const left = Math.max(0, N - (S.idx + 1));
    const s = L.pileS;
    for (let i = 0; i < left; i++) {
      const p = S.pile[i];
      const x = L.pileX + p.dx * s * 0.8; const y = L.pileY - i * s * 0.16 - p.dy * 4;
      g.save(); g.translate(x, y); g.rotate(p.r);
      g.fillStyle = 'rgba(20,10,4,.25)'; g.fillRect(-s / 2 + 3, -s * 0.35 + 4, s, s * 0.7);
      g.fillStyle = '#eadfc3'; g.fillRect(-s / 2 - 2, -s * 0.35 + 2, s, s * 0.7);
      g.fillStyle = p.cover; g.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
      g.fillStyle = '#f5eed9'; g.fillRect(-s / 2 + s * 0.1, -s * 0.3, s * 0.14, s * 0.4);
      g.restore();
    }
  }

  function draw() {
    const W = L.W; const H = L.H;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(shake.x, shake.y);
    g.drawImage(bg, -3, -3, W + 6, H + 6);
    drawPile();
    drawShelves();
    if (S.cur && S.phase !== 'intro' && S.phase !== 'over') {
      let x = S.bx; let y = S.by; let rot = S.rot; let sc = S.sc; let al = 1;
      if (S.phase === 'shake') x += Math.sin(S.phaseT * 55) * 9 * (1 - S.phaseT / 0.5);
      if (S.phase === 'fly' && S.fly) {
        const F = S.fly; const k = easeInOutCubic(clamp(S.phaseT / F.dur, 0, 1));
        x = lerp(F.x0, F.x1, k); y = lerp(F.y0, F.y1, k) - Math.sin(k * Math.PI) * 60;
        rot = lerp(F.r0, F.r1, k); sc = lerp(F.s0, F.s1, k); al = 1 - Math.max(0, (k - 0.75) / 0.25);
      }
      if (S.phase === 'ready' && !S.drag) y += Math.sin(S.t * 2) * 3;
      drawBook(S.cur, x, y, rot, sc, al, S.lift);
    }
    parts.draw(g);
    g.restore();
  }

  // ---------------------------------------------------------------- 逻辑
  function shelfAt(x, y) {
    for (let i = 0; i < 4; i++) { const s = L.sh[i]; if (x >= s.x - 6 && x <= s.x + s.w + 6 && y >= s.y - 10 && y <= s.y + s.h + 6) return i; }
    return -1;
  }
  function onBook(x, y) {
    const w = L.bookW * S.sc; const h = L.bookH * S.sc;
    return Math.abs(x - S.bx) <= w / 2 + 12 && Math.abs(y - S.by) <= h / 2 + 12;
  }

  function showStreak() {
    if (S.streak >= 2) {
      streakEl.innerHTML = `连对 <b>×${S.streak}</b>`;
      streakEl.classList.add('show');
      streakEl.classList.toggle('hot', S.streak >= 5);
      streakEl.classList.remove('pop'); void streakEl.offsetWidth; streakEl.classList.add('pop');
    } else streakEl.classList.remove('show');
  }
  function sayTeach(htmlStr, kind) {
    teach.innerHTML = htmlStr;
    teach.className = `books-teach show ${kind}`;
    void teach.offsetWidth; teach.classList.add('pop');
  }

  const tut = { on: opts.tutorial ?? (ctx.attempt === 1 || easy), h: null, shown: false };
  function nextBook() {
    S.idx++;
    if (S.idx >= N) { endRound(); return; }
    S.cur = list[S.idx];
    S.tries = 0; S.hintShelf = -1; S.lift = 0;
    S.phase = 'enter'; S.phaseT = 0;
    S.ex = L.showPile ? L.pileX : -L.bookW; S.ey = L.showPile ? L.pileY : L.homeY;
    descT.textContent = `《${S.cur.t}》`;
    descD.textContent = S.cur.d;
    desc.classList.remove('show');
    ctx.sfx('page');
  }

  function choose(i) {
    if (S.phase !== 'ready' || !S.cur || i < 0) return;
    const b = S.cur; const C = CATS[i];
    S.tries++;
    if (tut.h) { tut.h.close(); tut.h = null; }
    if (i === b.c) {
      if (S.tries === 1) {
        S.correct++; S.streak++;
        const word = STREAK_WORDS[S.streak];
        ctx.toast(word || '好！', word ? 'gold' : 'good');
        ctx.sfx(S.streak >= 3 ? 'perfect' : 'good');
      } else ctx.sfx('good');
      showStreak();
      sayTeach(`<b>✓ 《${b.t}》</b>——${b.why}`, 'good');
      flyTo(i, true);
    } else {
      ctx.sfx('bad');
      shake.add(3);
      S.flash[i] = { t: 1, good: false };
      if (S.tries === 1) { S.wrong++; S.streak = 0; showStreak(); ctx.toast('可惜', 'bad'); }
      S.phase = 'shake'; S.phaseT = 0;
      S.shakeTarget = i;
      if (easy) {
        S.hintShelf = b.c;
        sayTeach(`<b>✗ 不在${C.k}部</b>——再想想，看看发光的那一格`, 'bad');
      } else {
        sayTeach(`<b>✗ 《${b.t}》不在${C.k}部</b>——${b.why}`, 'bad');
      }
    }
  }

  function flyTo(i, good) {
    const s = L.sh[i];
    const sh = slabH(s);
    S.fly = { x0: S.bx, y0: S.by, r0: S.rot, s0: S.sc, x1: s.inner.x + s.inner.w / 2, y1: stackTop(i) - sh / 2, r1: -Math.PI / 2 + (R() - 0.5) * 0.1, s1: Math.max(0.12, sh / L.bookW), dur: 0.5, shelf: i, good };
    S.phase = 'fly'; S.phaseT = 0; S.drag = null; S.hover = -1; S.lift = 0;
    desc.classList.remove('show');
    ctx.sfx('whoosh');
  }

  function landed() {
    const F = S.fly; const i = F.shelf; const C = CATS[i];
    S.shelves[i].push({ cover: S.cur.cover, w: 0.66 + R() * 0.24, t: 0 });
    S.flash[i] = { t: 1, good: true };
    ctx.sfx('wood');
    const s = L.sh[i];
    for (let k = 0; k < 16; k++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.4; const sp = 80 + R() * 160;
      parts.add({ shape: k % 3 ? 'circle' : 'spark', x: s.x + s.w / 2, y: s.y + s.ph, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 160, drag: 2.5, life: 0.7 + R() * 0.4, size: 2 + R() * 2.5, color: C.color });
    }
    S.phase = 'after'; S.phaseT = 0;
  }

  function endRound() {
    S.phase = 'over'; S.phaseT = 0;
    desc.classList.remove('show');
    ctx.sfx('seal');
    banner(ctx, '归架完毕', `归对 ${S.correct} / ${N} 本`, { ms: 1900, top: '30%' });
  }

  function finish() {
    if (S.result) return;
    const success = S.correct >= PASS;
    const perfect = S.correct === N;
    let note;
    if (perfect) note = '一本不差！经、史、子、集四部之名，定于《隋书·经籍志》。不过正在编修的《永乐大典》并不按四部，而是“用韵以统字，用字以系事”。';
    else if (success) note = '书都归了架。有趣的是，正在编修的《永乐大典》却不按经史子集，而是“用韵以统字，用字以系事”——按韵目排列。';
    else note = `归对 ${S.correct} 本，需 ${PASS} 本。记住：经是儒家经典与小学，史是史书地理典章，子是诸子百家，集是诗文词赋。`;
    S.result = { success, score: S.correct, perfect, note, scoreText: `归对 ${S.correct} / ${N} 本` };
    S.done(S.result);
  }

  let hudKey = '';
  function updHud() {
    const n = clamp(S.idx + 1, 1, N);
    const key = `${n}|${S.correct}|${S.wrong}`;
    if (key === hudKey) return;
    hudKey = key;
    ctx.hud({
      center: `<span class="liba-hud">第 <b>${n}</b> / ${N} 本</span>`,
      right: `<span class="liba-hud"><span class="good">✓ ${S.correct}</span><span class="bad">✗ ${S.wrong}</span></span>`,
    });
  }

  function update(dt) {
    if (S.freeze || hostPaused(ctx)) dt = 0; // 宿主「暂且离开？」确认框打开时，时间停住
    S.t += dt; S.phaseT += dt;
    if (Math.abs(ctx.w - L.W) > 0.5 || Math.abs(ctx.h - L.H) > 0.5) layout();
    parts.update(dt);
    shake.update(dt);
    for (const f of S.flash) f.t = Math.max(0, f.t - dt * 1.6);
    for (const sh of S.shelves) for (const bk of sh) bk.t += dt;
    S.lift += ((S.drag ? 1 : 0) - S.lift) * Math.min(1, dt * 12);
    switch (S.phase) {
      case 'intro':
        if (S.phaseT > 1.3) nextBook();
        break;
      case 'enter': {
        const k = easeOutCubic(clamp(S.phaseT / 0.45, 0, 1));
        S.bx = lerp(S.ex, L.homeX, k); S.by = lerp(S.ey, L.homeY, k) - Math.sin(k * Math.PI) * 40;
        S.rot = lerp(-0.5, 0, k); S.sc = lerp(0.4, 1, k);
        if (S.phaseT > 0.45) {
          S.phase = 'ready'; S.phaseT = 0; S.bx = L.homeX; S.by = L.homeY; S.rot = 0; S.sc = 1;
          desc.classList.add('show');
          if (tut.on && !tut.shown) {
            tut.shown = true;
            const txt = `把书<b>拖到</b>对应的书架上<br>也可以直接<b>点书架</b>${ctx.isTouch ? '' : '（或按 1–4）'}`;
            if (L.land) {
              const r = desc.getBoundingClientRect(); const rs = ctx.root.getBoundingClientRect();
              tut.h = hint(ctx, txt, { x: r.left - rs.left + r.width / 2, y: r.bottom - rs.top + 8, place: 'below', arrow: false });
            } else {
              // 竖屏：放在说明框与书架之间的空处（那里之后显示讲解），别挡住书上的题签
              const r = desc.getBoundingClientRect(); const rs = ctx.root.getBoundingClientRect();
              const y0 = r.bottom - rs.top; const gap = L.shelfTop - y0;
              const y = gap >= 64 ? y0 + gap / 2 : L.homeY + L.bookH * 0.3;
              tut.h = hint(ctx, txt, { x: L.W / 2, y, place: 'center', arrow: false, bob: false });
            }
          }
        }
        break;
      }
      case 'ready':
        if (!S.drag) {
          S.bx += (L.homeX - S.bx) * Math.min(1, dt * 12); S.by += (L.homeY - S.by) * Math.min(1, dt * 12);
          S.rot += (0 - S.rot) * Math.min(1, dt * 10); S.sc += (1 - S.sc) * Math.min(1, dt * 10);
        }
        break;
      case 'shake':
        if (S.phaseT > 0.5) {
          if (easy) { S.phase = 'ready'; S.phaseT = 0; }
          else { S.flash[S.cur.c] = { t: 1.4, good: true }; flyTo(S.cur.c, false); }
        }
        break;
      case 'fly':
        if (S.phaseT >= S.fly.dur) landed();
        break;
      case 'after':
        if (S.phaseT > (S.fly && !S.fly.good ? 0.9 : 0.35)) { S.fly = null; nextBook(); }
        break;
      case 'over':
        if (S.phaseT > 2) finish();
        break;
      default:
    }
    updHud();
  }

  // ---------------------------------------------------------------- 输入
  const pos = (e) => { const r = cv.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (S.phase !== 'ready') return;
    const [x, y] = pos(e);
    if (onBook(x, y)) {
      S.drag = { id: e.pointerId, ox: x - S.bx, oy: y - S.by, sx: x, sy: y, moved: false, lx: x };
      try { cv.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      ctx.sfx('page');
      return;
    }
    S.tap = shelfAt(x, y);
  });
  cv.canvas.addEventListener('pointermove', (e) => {
    const [x, y] = pos(e);
    if (S.drag && e.pointerId === S.drag.id) {
      const d = S.drag;
      if (Math.hypot(x - d.sx, y - d.sy) > 6) d.moved = true;
      S.bx = x - d.ox * 0.8; S.by = y - d.oy * 0.8;
      S.rot = clamp((x - d.lx) * 0.02, -0.25, 0.25); d.lx = x;
      S.sc += (0.78 - S.sc) * 0.3;
      S.hover = shelfAt(x, y);
      if (S.hover < 0) S.hover = shelfAt(S.bx, S.by + L.bookH * 0.3 * S.sc);
    }
  });
  const up = (e) => {
    const [x, y] = pos(e);
    if (S.drag && e.pointerId === S.drag.id) {
      const d = S.drag; const target = S.hover;
      S.drag = null; S.hover = -1;
      if (d.moved && target >= 0) choose(target);
      else if (!d.moved) {
        // 书上方常常紧贴舞台顶边，提示放在书的下半截（不挡题签）
        if ((!tut.h || tut.h.closed) && S.phase === 'ready') tut.h = hint(ctx, '把书<b>拖到</b>书架上，或直接<b>点书架</b>', { x: L.homeX, y: L.homeY + L.bookH * 0.3, place: 'center', ms: 2600, bob: false });
      }
      return;
    }
    if (S.tap >= 0) { const i = shelfAt(x, y); if (i === S.tap) choose(i); S.tap = -1; }
  };
  cv.canvas.addEventListener('pointerup', up);
  cv.canvas.addEventListener('pointercancel', () => { S.drag = null; S.hover = -1; S.tap = -1; });
  cv.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const keyPick = (i) => () => { if (S.phase === 'ready' && !S.drag && !hostPaused(ctx)) choose(i); };
  keymap(ctx, {
    Digit1: keyPick(0), Digit2: keyPick(1), Digit3: keyPick(2), Digit4: keyPick(3),
    Numpad1: keyPick(0), Numpad2: keyPick(1), Numpad3: keyPick(2), Numpad4: keyPick(3),
  });

  // ---------------------------------------------------------------- 启动
  layout();
  ctx.onResize(() => { layout(); draw(); });
  banner(ctx, '永乐五年', easy ? '文渊阁 · 这回只归八本' : '文渊阁 · 书架倒了', { ms: 1600, top: '30%' });
  ctx.sfx('drum');
  updHud();
  devHandle('__books', { S, L, list, choose });
  ctx.loop((dt) => { update(dt); draw(); });
  return untilDone(ctx, (done) => { S.done = done; });
}
