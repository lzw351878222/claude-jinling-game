// 牵星过洋 —— 「依针路，观北辰」
// 永乐十三年（1415），郑和船队。蠹啃掉了火长的针路簿，康晔在海图案上照着针路重走一遍：
// 罗盘二十四向（丹针正对一字、缝针取两字正中）定方向，「更」计船程；过洋时以牵星板量北辰星。
import { clamp, lerp, easeOutCubic, easeInOutCubic, rng, injectStyle, el } from '../core/util.js';
import { scope, waitFor, Tweens, Particles, tipLine, glow, offscreen, localXY, fontReady, button, approach, hostPaused, FONT_BRUSH } from './lib-b.js';
import { LEGS, WAYPOINTS, bearingName, dirVec, simulate, firstHit, starAlt, CN_GENG } from './star-data.js';
import { paintChart, paintEaten, paintShip, paintCompass, paintSky } from './star-art.js';
import css from './star.css';

injectStyle('star', css);

const TAU = Math.PI * 2;
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const zhi = (v) => { const n = Math.floor(v + 1e-6); const h = v - n >= 0.49; return n ? `${CN[n]}指${h ? '半' : ''}` : (h ? '半指' : '零'); };

export default {
  id: 'star',
  title: '牵星过洋',
  subtitle: '依针路，观北辰',
  rules: [
    '蠹啃掉了船队的<b>针路簿</b>。照着复原的针路，在海图上重走一遍：五虎门→占城→满剌加→锡兰山→古里。',
    '罗盘分<b>二十四向</b>：「丹坤针」是正对「坤」字；「坤申针」这样两字连称的<b>缝针</b>，指在两字正中。',
    '再选<b>更数</b>（一更约六十里），按「开船」。触礁、搁浅或偏航，都要耗去一缸<b>淡水</b>。',
    '过洋时不计更数：举起<b>牵星板</b>量北辰星的高低，读数与针路相合时<b>落帆</b>。',
  ],
  controls: '拖动罗盘或点 ◀ ▶ · 键盘 ←→ 转针、↑↓ 更数、空格 开船；过洋时 Q 牵星、空格 落帆',

  async play(ctx, opts = {}) {
    const easy = ctx.difficulty === 0;
    const R = rng((opts.seed != null ? Number(opts.seed) : (Date.now() & 0xffffff)) + ctx.attempt * 17);
    const S = scope(ctx);
    const tw = new Tweens(ctx.signal);
    const P = new Particles();
    // 到港容差（单位：更）。简单模式也必须针向、更数都对：0.3 会让二更航段里差一个缝针的方向也算到港
    const TOL = easy ? 0.25 : 0.2;
    const TOL_ALT = easy ? 0.3 : 0.2;
    const maxLives = easy ? 9 : 6;
    const startLeg = clamp(Number(opts.leg) || 0, 0, LEGS.length - 1);

    // ---------------------------------------------------------------- DOM
    const wrap = el('div', 'star-wrap', ctx.root);
    const chartBox = el('div', 'star-chart', wrap);
    const panel = el('div', 'star-panel', wrap);
    const scroll = el('div', 'star-scroll', panel);
    const scrollH = el('div', 'star-scroll-h', scroll);
    const scrollT = el('div', 'star-scroll-t', scroll);
    const compBox = el('div', 'star-comp', panel);
    const read = el('div', 'star-read', panel);
    const gengRow = el('div', 'star-geng', panel);
    const gengNote = el('div', 'star-gengnote', panel, '不计更数 · 以牵星为准');
    const actRow = el('div', 'star-act', panel);
    const tip = tipLine(chartBox);
    // 先定布局再建画布（画布按父元素尺寸取大小）
    let layoutMode = '';
    function applyLayout() {
      const w = ctx.w, h = ctx.h;
      const port = w / h < 1.0;
      const short = !port && h < 440;
      const mode = port ? 'port' : short ? 'land short' : 'land';
      if (mode !== layoutMode) {
        layoutMode = mode;
        wrap.className = `star-wrap ${mode}`;
        if (port) chartBox.appendChild(scroll); else panel.insertBefore(scroll, panel.firstChild);
      }
      if (port) wrap.style.setProperty('--ch', `${Math.round(clamp(h * 0.46, 200, h - 290))}px`);
      else wrap.style.setProperty('--pw', `${Math.round(short ? clamp(w * 0.5, 300, 460) : clamp(w * 0.32, 280, 400))}px`);
    }
    applyLayout();
    S.add(ctx.onResize(applyLayout));
    const cc = ctx.canvas(chartBox);
    const pc = ctx.canvas(compBox);
    const rotL = button(compBox, '◀', 'paper round star-rot l', () => turn(-1));
    const rotR = button(compBox, '▶', 'paper round star-rot r', () => turn(1));
    const gengBtns = [1, 2, 3, 4, 5].map((n) => button(gengRow, `${CN_GENG[n]}<small>更</small>`, 'paper small', () => setGeng(n)));
    const sailBtn = button(actRow, '开 船', 'verm', () => { if (onSail) onSail('sail'); });
    const starBtn = button(actRow, '牵 星', 'gold star-hide', () => toggleSky(true));
    const stopBtn = button(actRow, '落 帆', 'verm star-hide', () => requestStop());
    // 牵星夜空
    const sky = el('div', 'star-sky', ctx.root);
    const skyBox = el('div', 'star-skybox', sky);
    const skyRead = el('div', 'star-sky-read', sky);
    const skyTip = el('div', 'star-sky-tip', sky);
    const skyBar = el('div', 'star-sky-bar', sky);
    const bMinus = button(skyBar, '－', 'paper round', () => setBoard(board - 1));
    const bLabel = el('div', 'star-board', skyBar, '');
    const bPlus = button(skyBar, '＋', 'paper round', () => setBoard(board + 1));
    const halfBtn = button(skyBar, '加半指', 'paper small', () => { half = !half; halfBtn.classList.toggle('on', half); ctx.sfx('click'); updateBoard(); });
    const skyStop = button(skyBar, '落 帆', 'verm', () => requestStop());
    const skyClose = button(skyBar, '收 板', 'paper small', () => toggleSky(false));
    const kc = ctx.canvas(skyBox);
    void bMinus; void bPlus; void skyClose;

    // ---------------------------------------------------------------- 状态
    let li = startLeg, si = 0, curSeg = LEGS[li].segs[0];
    let needle = 0, needleDisp = 0, geng = 1;
    let mistakes = 0, lives = maxLives, segMistakes = 0;
    let phase = 'intro';
    const ship = { x: 0, y: 0, facing: -1, alpha: 1, tilt: 0 };
    let cam = { cx: -8.5, cy: 3.2, s: 30 }, camT = { ...cam };
    const done = [];
    let fogA = 1, night = 0, nightT = 0;
    let skyOpen = false, skyA = 0, board = 5, half = false, skyTaught = false;
    let starD = 0, starHit = null, starDone = null, stopReq = false, lastAligned = false;
    let onSail = null;
    let time = 0, needleGlow = 0;
    let passedGeng = 0;
    let routeFrom = null;
    // 已完成航段（opts.leg 调试时直接补上）
    for (let k = 0; k < startLeg; k++) for (const s of LEGS[k].segs) done.push({ seg: s, a: WAYPOINTS[s.from].p, b: WAYPOINTS[s.to].p });
    if (startLeg > 2) fogA = 0;

    const cur = () => curSeg;
    const legNow = () => LEGS[clamp(li, 0, LEGS.length - 1)];
    const narrow = () => ctx.w < 560;

    // ---------------------------------------------------------------- 相机
    function viewInset() {
      const top = layoutMode === 'port' ? scroll.offsetHeight + 12 : 10;
      return { top, bottom: 40, left: 10, right: 10 };
    }
    function fit(x0, y0, x1, y1, pad = 0.8, instant = false) {
      const W = cc.w, H = cc.h;
      const ins = viewInset();
      const bw = Math.max(3.2, x1 - x0 + pad * 2), bh = Math.max(2.4, y1 - y0 + pad * 2);
      const s = clamp(Math.min((W - ins.left - ins.right) / bw, (H - ins.top - ins.bottom) / bh), 18, 150);
      const midY = (ins.top + H - ins.bottom) / 2;
      camT = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - (midY - H / 2) / s, s };
      if (instant) cam = { ...camT };
    }
    const fitSeg = (sg, instant) => {
      const A = WAYPOINTS[sg.from].p, B = WAYPOINTS[sg.to].p;
      fit(Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[0], B[0]), Math.max(A[1], B[1]), sg.star ? 1.0 : 0.85, instant);
    };
    const fitAll = (instant) => fit(-17.4, -0.4, 0.3, 6.6, 0.4, instant);
    const toScr = (x, y) => [(x - cam.cx) * cam.s + cc.w / 2, (y - cam.cy) * cam.s + cc.h / 2];

    // ---------------------------------------------------------------- 绘制：海图
    let chartC = null, chartKey = '';
    function drawChart(t) {
      const w = cc.w, h = cc.h, g = cc.g;
      const key = `${w}x${h}|${cam.cx.toFixed(3)}|${cam.cy.toFixed(3)}|${cam.s.toFixed(2)}|${ctx.dpr}`;
      if (key !== chartKey) {
        chartKey = key;
        if (!chartC || chartC.w !== w || chartC.h !== h) chartC = offscreen(w, h, ctx.dpr);
        chartC.g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        paintChart(chartC.g, cam, w, h);
      }
      g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.drawImage(chartC.c, 0, 0, w, h);
      const s = cam.s;
      // 已复原的针路
      g.save();
      g.lineCap = 'round';
      for (const d of done) {
        const [x0, y0] = toScr(...d.a), [x1, y1] = toScr(...d.b);
        g.strokeStyle = 'rgba(178,58,46,.85)'; g.lineWidth = Math.max(1.6, s * 0.03); g.setLineDash([Math.max(4, s * 0.1), Math.max(3, s * 0.07)]);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        g.setLineDash([]);
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len > 70) {
          const fs = clamp(s * 0.17, 10, 15);
          let ang = Math.atan2(y1 - y0, x1 - x0);
          if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
          g.save(); g.translate((x0 + x1) / 2, (y0 + y1) / 2); g.rotate(ang);
          g.font = `${Math.round(fs)}px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'bottom';
          g.fillStyle = 'rgba(126,36,25,.9)';
          g.fillText(`${bearingName(d.seg.b)}针${d.seg.geng ? CN_GENG[d.seg.geng] + '更' : '牵星'}`, 0, -3);
          g.restore();
        }
      }
      g.restore();
      // 航点
      for (const [id, wp] of Object.entries(WAYPOINTS)) {
        if (id === 'ceylon' && fogA > 0.5) continue;
        const [x, y] = toScr(...wp.p);
        if (x < -80 || y < -40 || x > w + 80 || y > h + 40) continue;
        const r = clamp(s * 0.075, 3, 7);
        g.fillStyle = wp.port ? '#b23a2e' : 'rgba(178,58,46,.0)';
        g.strokeStyle = '#7e2419'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
        if (wp.port) { g.fillStyle = '#e8cf94'; g.beginPath(); g.arc(x, y, r * 0.4, 0, TAU); g.fill(); }
        const fs = clamp(s * 0.24, 12, 20);
        let ox = wp.lab[0] * s, oy = wp.lab[1] * s;
        const om = Math.hypot(ox, oy) || 1, want = clamp(om, 46, 84); // 至少离开船身，停泊时不被帆挡住
        ox *= want / om; oy *= want / om;
        const lx = x + ox, ly = y + oy;
        g.font = `${Math.round(fs)}px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw2 = g.measureText(wp.name).width + 10;
        g.fillStyle = 'rgba(248,241,224,.92)'; g.fillRect(lx - tw2 / 2, ly - fs * 0.62, tw2, fs * 1.24);
        g.strokeStyle = 'rgba(40,30,20,.7)'; g.lineWidth = 1; g.strokeRect(lx - tw2 / 2 + 0.5, ly - fs * 0.62 + 0.5, tw2 - 1, fs * 1.24 - 1);
        g.fillStyle = wp.port ? '#2a1d10' : '#5a4430'; g.fillText(wp.name, lx, ly + 1);
      }
      // 目标圈
      if ((phase === 'plan' || phase === 'sail') && !cur().star) {
        const [x, y] = toScr(...WAYPOINTS[cur().to].p);
        const rr = Math.max(9, TOL * s);
        const k = 0.5 + 0.5 * Math.sin(t * 3);
        g.strokeStyle = `rgba(178,58,46,${0.45 + 0.35 * k})`; g.lineWidth = 2; g.setLineDash([4, 4]);
        g.beginPath(); g.arc(x, y, rr + k * 3, 0, TAU); g.stroke(); g.setLineDash([]);
      }
      // 蠹蛀之处（锡兰山）
      if (fogA > 0.01) {
        const [x, y] = toScr(WAYPOINTS.ceylon.p[0] + 0.05, WAYPOINTS.ceylon.p[1] - 0.8);
        paintEaten(g, x, y, 1.25 * s * (0.4 + 0.6 * fogA), t, fogA, 5);
      }
      // 夜
      if (night > 0.01) {
        g.save();
        g.fillStyle = `rgba(12,20,44,${0.42 * night})`; g.fillRect(0, 0, w, h);
        const [sx, sy] = toScr(ship.x, ship.y);
        g.globalCompositeOperation = 'lighter';
        const lg = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(60, s * 1.6));
        lg.addColorStop(0, `rgba(255,190,110,${0.28 * night})`); lg.addColorStop(1, 'rgba(255,190,110,0)');
        g.fillStyle = lg; g.fillRect(0, 0, w, h);
        g.restore();
      }
      // 航向示意（短箭头）
      if (phase === 'plan') {
        const [sx, sy] = toScr(ship.x, ship.y);
        const [dx, dy] = dirVec(needle);
        const L = Math.max(28, s * 0.7);
        g.save();
        g.strokeStyle = 'rgba(178,58,46,.75)'; g.fillStyle = 'rgba(178,58,46,.75)'; g.lineWidth = 2; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(sx + dx * 12, sy + dy * 12); g.lineTo(sx + dx * L, sy + dy * L); g.stroke(); g.setLineDash([]);
        const ax = sx + dx * L, ay = sy + dy * L, a = Math.atan2(dy, dx);
        g.beginPath(); g.moveTo(ax + Math.cos(a) * 6, ay + Math.sin(a) * 6); g.lineTo(ax + Math.cos(a + 2.5) * 7, ay + Math.sin(a + 2.5) * 7); g.lineTo(ax + Math.cos(a - 2.5) * 7, ay + Math.sin(a - 2.5) * 7); g.closePath(); g.fill();
        g.restore();
      }
      // 船
      const [sx, sy] = toScr(ship.x, ship.y);
      paintShip(g, sx, sy - 4, clamp(s * 0.5, 30, 64), ship.facing, t, { night, tilt: ship.tilt, alpha: ship.alpha });
      P.draw(g);
      // 图框、北向、比例说明
      g.strokeStyle = 'rgba(59,53,45,.55)'; g.lineWidth = 1; g.strokeRect(4.5, 4.5, w - 9, h - 9);
      const nx = w - 26, ny = layoutMode === 'port' ? viewInset().top + 18 : 30;
      // 衬一块纸色圆底，免得与底下的地名叠在一起
      g.fillStyle = 'rgba(248,241,224,.88)'; g.beginPath(); g.arc(nx, ny + 3, 18, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(59,53,45,.35)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(178,58,46,.85)';
      g.beginPath(); g.moveTo(nx, ny - 13); g.lineTo(nx + 6, ny + 3); g.lineTo(nx, ny); g.lineTo(nx - 6, ny + 3); g.closePath(); g.fill();
      g.font = `13px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = 'rgba(40,30,20,.8)'; g.fillText('北', nx, ny + 5);
      g.font = `11px ${FONT_BRUSH}`; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = 'rgba(40,30,20,.55)';
      g.fillText('针路图 · 示意（一更约六十里，已缩略）', w - 10, h - 8);
    }

    // ---------------------------------------------------------------- 绘制：罗盘、夜空
    function compR() { return Math.max(40, Math.min(pc.w / 2 - 6, pc.h / 2 - 6, 170)); }
    function drawCompass(t) {
      const w = pc.w, h = pc.h, g = pc.g;
      g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const Rr = compR();
      const target = easy && segMistakes > 0 && !cur().star ? cur().b : (easy && segMistakes > 0 ? cur().b : -1);
      paintCompass(g, w / 2, h / 2, Rr, needleDisp, t, { hi: needle, target, glowT: needleGlow });
    }
    function drawSky(t) {
      const w = kc.w, h = kc.h, g = kc.g;
      g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      const alt = starAlt(ship.y);
      const reading = board + (half ? 0.5 : 0);
      const aligned = Math.abs(alt - reading) <= TOL_ALT;
      if (aligned && !lastAligned) ctx.sfx('chime');
      lastAligned = aligned;
      paintSky(g, w, h, t, { alt, board, half, sway: 1, aligned });
    }

    // ---------------------------------------------------------------- 主循环
    const fitCanvas = (c, box) => { if (Math.abs(c.w - box.clientWidth) > 1 || Math.abs(c.h - box.clientHeight) > 1) c.resize(); };
    let loopErr = false;
    const stopLoop = ctx.loop((dt) => {
      if (hostPaused(ctx)) dt = 0; // 「暂且离开？」确认框打开时，船与补间都停住
      time += dt;
      const t = time;
      tw.update(dt);
      P.update(dt);
      try { frame(dt, t); } catch (e) { if (!loopErr) { loopErr = true; console.error('[star]', e); } }
    });
    function frame(dt, t) {
      fitCanvas(cc, chartBox); fitCanvas(pc, compBox); if (skyOpen) fitCanvas(kc, skyBox);
      // 针
      let target = needle * 7.5;
      let diff = ((target - needleDisp + 540) % 360) - 180;
      needleDisp += diff * (1 - Math.exp(-16 * dt));
      needleGlow = Math.max(0, needleGlow - dt * 2);
      // 相机
      const k = 1 - Math.exp(-3.2 * dt);
      cam.cx += (camT.cx - cam.cx) * k; cam.cy += (camT.cy - cam.cy) * k; cam.s += (camT.s - cam.s) * k;
      if (Math.abs(camT.cx - cam.cx) < 1e-4 && Math.abs(camT.cy - cam.cy) < 1e-4 && Math.abs(camT.s - cam.s) < 1e-3) cam = { ...camT };
      night = approach(night, nightT, 2, dt);
      skyA = approach(skyA, skyOpen ? 1 : 0, 10, dt);
      // 过洋航行
      if (phase === 'star') starTick(dt);
      // 跟船
      if (phase === 'sail' || phase === 'star') {
        const [sx, sy] = toScr(ship.x, ship.y);
        const ins = viewInset();
        const m = 50;
        if (sx < m || sx > cc.w - m || sy < ins.top + m * 0.6 || sy > cc.h - ins.bottom - m * 0.6) {
          camT.cx += ((sx - cc.w / 2) / cam.s) * 0.04;
          camT.cy += ((sy - (ins.top + cc.h - ins.bottom) / 2) / cam.s) * 0.04;
        }
      }
      // 尾浪
      if ((phase === 'sail' || phase === 'star') && R() < dt * 14) {
        const [sx, sy] = toScr(ship.x, ship.y);
        P.emit(1, (q) => { q.x = sx - ship.facing * cam.s * 0.2; q.y = sy + 2; q.shape = 'ring'; q.size = 2; q.size1 = 9; q.life = 0.8; q.color = 'rgba(255,255,255,.7)'; q.lw = 1; });
      }
      drawChart(t);
      drawCompass(t);
      if (skyOpen) drawSky(t);
    }

    // ---------------------------------------------------------------- 界面状态
    function hud() {
      const n = narrow();
      const jars = `<span class="star-jars">${'<i class="f"></i>'.repeat(Math.max(0, lives))}${'<i></i>'.repeat(Math.max(0, maxLives - lives))}</span>`;
      ctx.hud({
        center: n ? `${Math.min(li, 3) + 1}/4 ${WAYPOINTS[legNow().to].name}` : `第${CN[Math.min(li, 3) + 1]}程 · ${legNow().title}`,
        right: n ? jars : `淡水 ${jars}`,
      });
    }
    function showInstruction() {
      const leg = legNow();
      scrollH.textContent = `针路 · 第${CN[li + 1]}程${leg.segs.length > 1 ? `（${si + 1}/${leg.segs.length}）` : ''}`;
      scrollT.innerHTML = cur().text;
      scroll.classList.remove('flash'); void scroll.offsetWidth; scroll.classList.add('flash');
    }
    function updateRead() {
      read.innerHTML = `${bearingName(needle)}针${needle % 2 ? '<small>（缝针）</small>' : ''}`;
    }
    function setControls(on) {
      const star = !!cur().star;
      rotL.disabled = rotR.disabled = !on;
      gengBtns.forEach((b, i) => { b.disabled = !on; b.classList.toggle('on', geng === i + 1); });
      gengRow.classList.toggle('star-hide', star);
      gengNote.classList.toggle('star-show', star);
      sailBtn.disabled = !on;
      sailBtn.setLabel(star ? '开 洋' : '开 船');
      sailBtn.classList.toggle('star-hide', phase === 'star');
      starBtn.classList.toggle('star-hide', phase !== 'star');
      stopBtn.classList.toggle('star-hide', phase !== 'star');
      compBox.classList.toggle('off', !on);
    }
    function turn(d) {
      if (phase !== 'plan') return;
      needle = (needle + d + 48) % 48;
      ctx.sfx('tick');
      updateRead();
    }
    function setGeng(n) {
      if (phase !== 'plan') return;
      geng = clamp(n, 1, 5);
      gengBtns.forEach((b, i) => b.classList.toggle('on', geng === i + 1));
      ctx.sfx('wood');
    }
    function setBoard(n) {
      board = clamp(n, 1, 12);
      ctx.sfx('wood');
      updateBoard();
    }
    function updateBoard() {
      bLabel.innerHTML = `<small>牵星板</small>${CN[board]}指`;
      skyRead.innerHTML = `所持：<b>${zhi(board + (half ? 0.5 : 0))}</b>`;
    }
    function toggleSky(on) {
      if (on && phase !== 'star') return;
      if (skyOpen === on) return;
      skyOpen = on;
      sky.classList.toggle('show', on);
      ctx.sfx(on ? 'open' : 'close');
      if (on) {
        kc.resize();
        updateBoard();
        if (!skyTaught) {
          skyTaught = true;
          skyTip.innerHTML = '北辰星随船南行而渐低。针路要「<b>三指半</b>」：选三指板、加半指象牙——星落到板的<b>上沿</b>时，按「落帆」。';
        } else skyTip.innerHTML = '';
      }
      starBtn.classList.toggle('pulse', false);
    }

    // 罗盘拖动
    let dragging = false;
    const angleFromEvent = (e) => {
      const p = localXY(pc.canvas, e);
      const dx = p.x - pc.w / 2, dy = p.y - pc.h / 2;
      return { a: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, r: Math.hypot(dx, dy) };
    };
    const setFromAngle = (a) => {
      const n = Math.round(a / 7.5) % 48;
      if (n !== needle) { needle = n; ctx.sfx('tick'); updateRead(); }
    };
    S.on(pc.canvas, 'pointerdown', (e) => {
      if (phase !== 'plan') return;
      const { a, r } = angleFromEvent(e);
      const Rr = compR();
      if (r > Rr * 1.05 || r < Rr * 0.12) return;
      dragging = true;
      try { pc.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      setFromAngle(a);
    });
    S.on(pc.canvas, 'pointermove', (e) => { if (dragging && phase === 'plan') setFromAngle(angleFromEvent(e).a); });
    const endDrag = () => { dragging = false; };
    S.on(pc.canvas, 'pointerup', endDrag);
    S.on(pc.canvas, 'pointercancel', endDrag);
    S.add(ctx.keys.onDown((code, e) => {
      if (hostPaused(ctx)) return;
      if (phase === 'plan') {
        if (code === 'ArrowLeft' || code === 'KeyA') { e.preventDefault(); turn(-1); }
        else if (code === 'ArrowRight' || code === 'KeyD') { e.preventDefault(); turn(1); }
        else if (code === 'ArrowUp' || code === 'KeyW') { e.preventDefault(); if (!cur().star) setGeng(geng + 1); }
        else if (code === 'ArrowDown' || code === 'KeyS') { e.preventDefault(); if (!cur().star) setGeng(geng - 1); }
        else if (/^Digit[1-5]$/.test(code) && !cur().star) { e.preventDefault(); setGeng(Number(code.slice(5))); }
        else if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { e.preventDefault(); if (onSail) onSail('sail'); }
      } else if (phase === 'star') {
        if (code === 'KeyQ' || code === 'KeyK' || code === 'Tab') { e.preventDefault(); toggleSky(!skyOpen); }
        else if (code === 'Escape' && skyOpen) { e.preventDefault(); toggleSky(false); }
        else if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { e.preventDefault(); requestStop(); }
        else if (skyOpen && (code === 'ArrowUp' || code === 'ArrowRight' || code === 'KeyW')) { e.preventDefault(); setBoard(board + 1); }
        else if (skyOpen && (code === 'ArrowDown' || code === 'ArrowLeft' || code === 'KeyS')) { e.preventDefault(); setBoard(board - 1); }
        else if (skyOpen && code === 'KeyH') { e.preventDefault(); halfBtn.click(); }
      }
    }));
    S.add(ctx.onResize(() => {
      hud();
      // 舞台尺寸变了（如手机转屏）：按新画布重新取景；航行中由跟船逻辑接管
      if (phase === 'plan') fitSeg(cur(), true);
      else if (phase === 'intro' || phase === 'done') fitAll(true);
    }));

    // ---------------------------------------------------------------- 航行
    function explain(sg, b, g2) {
      if (b !== sg.b) {
        const nm = bearingName(sg.b);
        const how = sg.b % 2 ? `「${nm}」是「${nm[0]}」「${nm[1]}」两字的正中` : `罗盘上要正对「${nm[1]}」字`;
        return `针路写的是「<b>${nm}针</b>」——${how}。`;
      }
      if (g2 !== sg.geng) return `针路写的是<b>${CN_GENG[sg.geng]}更</b>船，这回走了${CN_GENG[g2]}更。`;
      return '';
    }
    const LAND_NAME = { asia: '', hainan: '琼州', sumatra: '苏门答剌', borneo: '渤泥', ceylon: '锡兰山', taiwan: '', bintan: '' };
    function hitText(hit) {
      if (hit.kind === 'reef') return `撞上了${hit.name && hit.name !== '浅' && hit.name !== '礁' ? hit.name : '暗礁'}。`;
      if (hit.name === '岛') return '撞上了一座小岛。';
      const nm = hit.name in LAND_NAME ? LAND_NAME[hit.name] : hit.name;
      return nm ? `在${nm}搁浅了。` : '船搁在了岸边。';
    }
    async function crash(kind) {
      ctx.sfx(kind === 'reef' ? 'crack' : 'hit');
      ctx.sfx('splash');
      const [sx, sy] = toScr(ship.x, ship.y);
      P.emit(22, (q) => {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.4, sp = 40 + R() * 90;
        q.x = sx; q.y = sy; q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; q.ay = 220; q.life = 0.7 + R() * 0.4; q.size = 1.5 + R() * 2; q.color = 'rgba(235,245,250,.9)';
      });
      ctx.toast(kind === 'reef' ? '触礁了！' : '搁浅了！', 'bad');
      await tw.to(0.7, (e) => { ship.tilt = Math.sin(e * 22) * 0.25 * (1 - e) + e * 0.18; });
    }
    async function lostAnim(text) {
      ctx.sfx('bad');
      ctx.toast(text, 'bad');
      const [sx, sy] = toScr(ship.x, ship.y);
      P.emit(8, (q) => { q.x = sx + (R() - 0.5) * 30; q.y = sy + (R() - 0.5) * 10; q.vx = (R() - 0.5) * 10; q.vy = -6; q.life = 1.2; q.size = 10; q.size1 = 26; q.shape = 'smoke'; q.color = 'rgba(240,236,225,.6)'; });
      await tw.to(0.7, (e) => { ship.tilt = Math.sin(e * 9) * 0.12; });
    }
    async function resetShip(sg) {
      await tw.to(0.35, (e) => { ship.alpha = 1 - e; });
      const A = WAYPOINTS[sg.from].p;
      ship.x = A[0]; ship.y = A[1]; ship.tilt = 0;
      fitSeg(sg);
      await tw.to(0.35, (e) => { ship.alpha = e; });
    }
    async function arrive(B, name) {
      const x0 = ship.x, y0 = ship.y;
      await tw.to(0.35, (e) => { ship.x = lerp(x0, B[0], e); ship.y = lerp(y0, B[1], e); });
      ctx.sfx('bell');
      const [sx, sy] = toScr(B[0], B[1]);
      P.emit(16, (q) => {
        const a = R() * TAU, sp = 30 + R() * 60;
        q.x = sx; q.y = sy; q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; q.drag = 2.5; q.life = 0.8 + R() * 0.3; q.size = 2.5 + R() * 2; q.shape = 'star'; q.color = '#e8b949'; q.add = false; q.vr = 4;
      });
      ctx.toast(name ? `${name}到了！` : '好！', 'good');
    }
    async function sailNormal(sg, b, g2) {
      const A = WAYPOINTS[sg.from].p, B = WAYPOINTS[sg.to].p;
      const res = simulate(sg, b, g2, TOL);
      const [dx, dy] = dirVec(b);
      const dist = res.hit ? res.hit.d : g2;
      if (Math.abs(dx) > 0.05) ship.facing = dx < 0 ? -1 : 1;
      ctx.sfx('horn');
      passedGeng = 0;
      const dur = 0.45 + dist * 0.55;
      await tw.to(dur, (e) => {
        const d = dist * e;
        ship.x = A[0] + dx * d; ship.y = A[1] + dy * d;
        while (passedGeng < g2 && d >= passedGeng + 1 - 1e-6) {
          passedGeng++;
          ctx.sfx('wood');
          const [sx, sy] = toScr(ship.x, ship.y);
          P.emit(1, (q) => { q.x = sx; q.y = sy - 34; q.vy = -18; q.life = 1; q.shape = 'text'; q.text = `${CN_GENG[passedGeng]}更`; q.size = 16; q.color = '#7e2419'; });
        }
      }, { ease: (x) => x * x * (3 - 2 * x) });
      if (res.hit) { await crash(res.hit.kind); tip.set(`${hitText(res.hit)}${explain(sg, b, g2)}`, ''); return false; }
      if (!res.ok) { await lostAnim('偏航了'); tip.set(`没有到${WAYPOINTS[sg.to].name}。${explain(sg, b, g2) || '差了一点点。'}`, ''); return false; }
      await arrive(B, WAYPOINTS[sg.to].port ? WAYPOINTS[sg.to].name : null);
      return true;
    }
    // 过洋：船一直走，玩家牵星、落帆
    let starCtx = null;
    function starTick(dt) {
      const sg = starCtx.sg;
      // 星离针路读数还远时船行得快些，免得干等；接近三指半时回到原速，留足判断的时间
      const far = clamp((Math.abs(starAlt(ship.y) - sg.star) - 0.3) / 0.4, 0, 1);
      const speed = (skyOpen ? 0.24 : 0.4) * (easy ? 0.85 : 1) * (1 + far * 1.6);
      starD += speed * dt;
      const [dx, dy] = starCtx.dir;
      const A = WAYPOINTS[sg.from].p;
      ship.x = A[0] + dx * starD; ship.y = A[1] + dy * starD;
      const alt = starAlt(ship.y);
      if (starHit && starD >= starHit.d) { finishStar('hit'); return; }
      if (alt < sg.star - 0.75 || starD > 11) { finishStar('over'); return; }
      if (stopReq) { stopReq = false; judgeStop(); }
    }
    function requestStop() {
      if (phase !== 'star') return;
      stopReq = true;
    }
    function judgeStop() {
      const sg = starCtx.sg;
      const alt = starAlt(ship.y);
      const B = WAYPOINTS[sg.to].p;
      const err = Math.hypot(ship.x - B[0], ship.y - B[1]);
      ctx.sfx('whoosh');
      if (Math.abs(alt - sg.star) <= TOL_ALT && err <= 0.75) { finishStar('ok'); return; }
      const rightWay = starCtx.b === sg.b;
      if (rightWay && alt > sg.star + TOL_ALT) {
        // 早了：记一次失误，船继续走
        mistakes++; lives--; segMistakes++;
        hud();
        ctx.sfx('bad');
        ctx.toast('北辰星还高', 'bad');
        const msg = `北辰星约有${zhi(Math.round(alt * 2) / 2)}高，还没落到三指半——锡兰山还没到。`;
        tip.set(msg, 'dark');
        if (skyOpen) skyTip.innerHTML = msg;
        if (lives <= 0) finishStar('dead');
        return;
      }
      starCtx.stopAlt = alt;
      finishStar(rightWay ? 'late' : 'wrongway');
    }
    function finishStar(kind) {
      if (!starDone) return;
      const f = starDone; starDone = null;
      phase = 'sail';
      toggleSky(false);
      setControls(false);
      f(kind);
    }
    async function sailStar(sg, b) {
      const A = WAYPOINTS[sg.from].p;
      starCtx = { sg, b, dir: dirVec(b) };
      const [dx] = starCtx.dir;
      if (Math.abs(dx) > 0.05) ship.facing = dx < 0 ? -1 : 1;
      starHit = firstHit(A[0], A[1], b, 12);
      starD = 0; stopReq = false; lastAligned = false;
      ctx.sfx('horn');
      nightT = 1;
      phase = 'star';
      setControls(false);
      starBtn.classList.add('pulse');
      tip.set(`夜里放洋，看不见岸。按「<b>牵星</b>」量北辰星${ctx.isTouch ? '' : '（Q）'}，读数到了就「<b>落帆</b>」${ctx.isTouch ? '' : '（空格）'}。`, 'dark');
      if (!skyTaught) tw.after(1.4, () => { if (phase === 'star' && !skyOpen) toggleSky(true); });
      const outcome = await waitFor(ctx, (d) => { starDone = d; return () => { starDone = null; }; });
      if (outcome === 'ok') {
        nightT = 0;
        ctx.sfx('magic');
        tip.set('星与板齐——拨开海雾，锡兰山就在眼前！', '');
        await tw.to(1.0, (e) => { fogA = 1 - e; });
        await arrive(WAYPOINTS[sg.to].p, '锡兰山');
        return true;
      }
      if (outcome === 'dead') return false;
      if (outcome === 'hit') { await crash(starHit.kind); tip.set(`${hitText(starHit)}${explain(sg, b, sg.geng)}`, ''); }
      else if (outcome === 'late') { await lostAnim('驶过头了'); tip.set('北辰星已经低过三指半——锡兰山被甩在身后了。星一落到板的上沿就要落帆。', ''); }
      else if (outcome === 'over') { await lostAnim('驶过头了'); tip.set(`船已驶入大洋深处。${starCtx.b === sg.b ? '记得牵星：北辰星落到三指半时落帆。' : explain(sg, b, sg.geng)}`, ''); }
      else {
        await lostAnim('不见锡兰山');
        const atAlt = starCtx.stopAlt != null && Math.abs(starCtx.stopAlt - sg.star) <= TOL_ALT;
        tip.set(`${atAlt ? '星到了三指半，四下却是茫茫大海。' : '落帆一看，四下茫茫，不见锡兰山。'}${explain(sg, b, sg.geng)}`, '');
      }
      nightT = 0.4;
      return false;
    }

    // ---------------------------------------------------------------- 一段针路
    async function playSeg() {
      const sg = cur();
      segMistakes = 0;
      const A = WAYPOINTS[sg.from].p;
      ship.x = A[0]; ship.y = A[1]; ship.tilt = 0; ship.alpha = 1;
      fitSeg(sg);
      showInstruction();
      while (true) {
        phase = 'plan';
        setControls(true);
        updateRead();
        const act = await waitFor(ctx, (d) => { onSail = d; return () => { onSail = null; }; });
        void act;
        phase = 'sail';
        setControls(false);
        tip.hide();
        ctx.sfx('click');
        const b = needle, g2 = geng;
        const ok = sg.star ? await sailStar(sg, b) : await sailNormal(sg, b, g2);
        if (ok) {
          done.push({ seg: sg, a: WAYPOINTS[sg.from].p, b: WAYPOINTS[sg.to].p });
          return true;
        }
        if (!(sg.star && lives <= 0)) { mistakes++; lives--; segMistakes++; }
        hud();
        if (lives <= 0) return false;
        if (easy && segMistakes === 1) tip.set(`${tip.el.innerHTML} <br>罗盘上发金光的，就是针路要的方向。`, '');
        await tw.delay(1.3);
        await resetShip(sg);
      }
    }

    if (opts.debug) {
      window.__star = {
        get phase() { return phase; }, get leg() { return li; }, get seg() { return si; }, get lives() { return lives; }, get mistakes() { return mistakes; },
        get alt() { return starAlt(ship.y); }, get skyOpen() { return skyOpen; }, get ship() { return { ...ship }; },
        set: (b, g2) => { if (phase !== 'plan') return false; needle = b; updateRead(); if (g2) setGeng(g2); return true; },
        sail: () => { if (onSail) onSail('sail'); },
        answer: () => { const sg = cur(); needle = sg.b; if (sg.geng) geng = sg.geng; updateRead(); if (onSail) onSail('sail'); },
        stop: () => requestStop(), board: (n, h) => { board = n; half = !!h; updateBoard(); }, sky: (on) => toggleSky(on),
      };
    }

    // ---------------------------------------------------------------- 运行
    try {
      hud();
      setControls(false);
      updateRead();
      updateBoard();
      await fontReady('牵星过洋五虎门占城满剌加锡兰山古里丹坤针更北辰', 48);
      // 开场：全图 → 第一程
      const A0 = WAYPOINTS[LEGS[startLeg].segs[0].from].p;
      ship.x = A0[0]; ship.y = A0[1];
      fitAll(true);
      tip.set('宝船自五虎门开洋，驶向西洋……', '');
      await tw.delay(1.4);
      for (li = startLeg; li < LEGS.length; li++) {
        hud();
        for (si = 0; si < LEGS[li].segs.length; si++) {
          curSeg = LEGS[li].segs[si];
          const sg = curSeg;
          if (li === 0 && si === 0) tw.after(0.6, () => { if (phase === 'plan') tip.set('转动<b>罗盘</b>，让针正对「<b>坤</b>」字；再选「<b>四更</b>」，按「开船」。', ''); });
          else if (sg.b % 2 && !sg.star && !routeFrom) { routeFrom = true; tw.after(0.6, () => { if (phase === 'plan') tip.set(`「${bearingName(sg.b)}针」是<b>缝针</b>：指在「${bearingName(sg.b)[0]}」「${bearingName(sg.b)[1]}」两字正中的小刻度上。`, ''); }); }
          else if (sg.star) tw.after(0.6, () => { if (phase === 'plan') tip.set('这一段<b>不计更数</b>：定好丹庚针，按「开洋」，再用牵星板量北辰星。', ''); });
          else tip.hide();
          const ok = await playSeg();
          if (!ok) {
            tip.set('淡水耗尽，船队只得返航……', 'dark');
            ctx.toast('淡水耗尽', 'bad');
            await tw.delay(1.6);
            return {
              success: false, score: 0, perfect: false, mistakes,
              note: '淡水耗尽，船队只得返航。诀窍：丹针正对一字，缝针指两字正中；过洋时星落到板的上沿再落帆。',
            };
          }
          await tw.delay(0.35);
        }
        if (li < LEGS.length - 1) { ctx.sfx('quest'); await tw.delay(0.4); }
      }
      // 终场：全图
      phase = 'done';
      setControls(false);
      tip.set('针路复原！宝船循着针路，一程程驶到了古里。', '');
      fitAll();
      ctx.sfx('gong');
      ctx.toast('针路复原！', 'gold');
      await tw.delay(2.6);
      tip.hide();
      const perfect = mistakes === 0;
      const score = Math.max(40, 100 - 15 * mistakes);
      return {
        success: true,
        score,
        scoreText: `失误 ${mistakes} 次 · 得分 ${score} / 100`,
        perfect,
        mistakes,
        note: perfect
          ? '一处不差！宝船循针路，经占城、满剌加、锡兰山，终抵古里。过洋之时，舟师举牵星板量北辰星的高低，便知船行到了哪里。'
          : '针路复原！宝船经占城、满剌加、锡兰山，终抵古里。过洋之时，舟师举牵星板量北辰星的高低，便知船行到了哪里。',
      };
    } finally {
      stopLoop();
      S.dispose();
    }
  },
};
