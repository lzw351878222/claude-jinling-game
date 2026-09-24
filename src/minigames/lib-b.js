// 牵星过洋 / 转瓦 / 点灯 / 刻版 共用的小工具（前缀 libb-）
import { clamp, lerp, easeOutCubic, rng, el, injectStyle } from '../core/util.js';
import css from './lib-b.css';

injectStyle('lib-b', css);

export const FONT_BRUSH = '"JLBrush", "STXingkai", "KaiTi", "STKaiti", "Kaiti SC", serif';
export const FONT_BODY = '"KaiTi", "STKaiti", "Kaiti SC", "JLBrush", "Songti SC", "STSong", "SimSun", serif';
export const FONT_UI = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

export const abortError = () => new DOMException('aborted', 'AbortError');

/** 统一管理监听器/定时器：结束或中止时全部撤销 */
export function scope(ctx) {
  const offs = [];
  const S = {
    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      const off = () => target.removeEventListener(type, fn, opts);
      offs.push(off);
      return off;
    },
    timeout(fn, ms) { const t = setTimeout(fn, ms); offs.push(() => clearTimeout(t)); return t; },
    add(off) { offs.push(off); return off; },
    dispose() { while (offs.length) { try { offs.pop()(); } catch { /* ignore */ } } },
  };
  ctx.signal.addEventListener('abort', S.dispose, { once: true });
  return S;
}

/**
 * 等待玩家操作：setup(done) 里注册监听，调用 done(v) 结束；可返回清理函数。
 * 宿主中止时 reject(AbortError)。
 */
export function waitFor(ctx, setup) {
  return new Promise((resolve, reject) => {
    if (ctx.signal.aborted) { reject(abortError()); return; }
    let finished = false;
    let cleanup = null;
    const finish = () => { finished = true; ctx.signal.removeEventListener('abort', onAbort); if (cleanup) { try { cleanup(); } catch { /* ignore */ } } };
    const onAbort = () => { if (finished) return; finish(); reject(abortError()); };
    ctx.signal.addEventListener('abort', onAbort, { once: true });
    const done = (v) => { if (finished) return; finish(); resolve(v); };
    const c = setup(done);
    if (finished) { if (typeof c === 'function') { try { c(); } catch { /* ignore */ } } } else cleanup = c || null;
  });
}

/** 补间动画（在游戏主循环里 update）；中止时自动 reject */
export class Tweens {
  constructor(signal) {
    this.list = [];
    this.signal = signal;
    if (signal) signal.addEventListener('abort', () => { const l = this.list; this.list = []; for (const t of l) t.rej(abortError()); }, { once: true });
  }
  to(dur, fn, { ease = easeOutCubic, delay = 0 } = {}) {
    const p = new Promise((res, rej) => {
      if (this.signal && this.signal.aborted) { rej(abortError()); return; }
      this.list.push({ t: -delay, dur: Math.max(1e-4, dur), fn, ease, res, rej });
    });
    p.catch(() => {});
    return p;
  }
  /** 纯延时（跟随游戏时间） */
  delay(sec) { return this.to(sec, () => {}); }
  /** sec 秒后调用 fn（不产生 Promise，中止时静默丢弃） */
  after(sec, fn) {
    this.list.push({ t: -sec, dur: 1e-4, fn: (e, k) => { if (k >= 1) fn(); }, ease: (x) => x, res: () => {}, rej: () => {} });
  }
  update(dt) {
    if (!this.list.length) return;
    let done = null;
    for (const tw of this.list.slice()) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.dur);
      try { tw.fn(tw.ease(k), k); } catch (e) { console.error(e); }
      if (k >= 1) (done || (done = [])).push(tw);
    }
    if (done) { this.list = this.list.filter((t) => !done.includes(t)); for (const t of done) t.res(); }
  }
  get busy() { return this.list.length > 0; }
}

/** 粒子系统（画布） */
export class Particles {
  constructor() { this.ps = []; }
  emit(n, init) {
    for (let i = 0; i < n; i++) {
      const p = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, t: 0, life: 1, size: 3, size1: null, color: '#fff', alpha: 1, rot: 0, vr: 0, shape: 'dot', add: false, fadeIn: 0 };
      init(p, i);
      this.ps.push(p);
    }
  }
  update(dt) {
    const ps = this.ps;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) { ps.splice(i, 1); continue; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }
  clear() { this.ps.length = 0; }
  draw(g, filter) {
    for (const p of this.ps) {
      if (filter && !filter(p)) continue;
      const k = p.t / p.life;
      let a = p.alpha * (1 - k);
      if (p.fadeIn) a *= clamp(p.t / p.fadeIn, 0, 1);
      if (a <= 0.003) continue;
      const s = p.size1 == null ? p.size : lerp(p.size, p.size1, k);
      g.save();
      g.globalAlpha = a;
      if (p.add) g.globalCompositeOperation = 'lighter';
      switch (p.shape) {
        case 'glow': {
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
          gr.addColorStop(0, p.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, s, 0, 7); g.fill();
          break;
        }
        case 'spark': {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const l = Math.min(s * 4, sp * 0.05 + s);
          g.strokeStyle = p.color; g.lineWidth = Math.max(0.8, s * 0.5); g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * l, p.y - p.vy / sp * l); g.stroke();
          break;
        }
        case 'chip': {
          g.translate(p.x, p.y); g.rotate(p.rot);
          g.fillStyle = p.color; g.beginPath();
          g.moveTo(-s, -s * 0.35); g.lineTo(s * 0.8, -s * 0.5); g.lineTo(s, s * 0.3); g.lineTo(-s * 0.6, s * 0.45); g.closePath(); g.fill();
          break;
        }
        case 'star': {
          g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
          g.beginPath();
          for (let j = 0; j < 8; j++) { const r = j % 2 ? s * 0.28 : s; const an = j * Math.PI / 4; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
          g.closePath(); g.fill();
          break;
        }
        case 'ring': {
          g.strokeStyle = p.color; g.lineWidth = p.lw || 2;
          g.beginPath(); g.arc(p.x, p.y, s, 0, 7); g.stroke();
          break;
        }
        case 'smoke': {
          const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
          gr.addColorStop(0, p.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, s, 0, 7); g.fill();
          break;
        }
        case 'petal': {
          g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
          g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, 7); g.fill();
          break;
        }
        case 'text': {
          g.fillStyle = p.color; g.font = `${s}px ${FONT_BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(p.text, p.x, p.y);
          break;
        }
        default: {
          g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, s, 0, 7); g.fill();
        }
      }
      g.restore();
    }
  }
}

/** 游戏内按钮（不抢焦点，避免空格误触） */
export function button(parent, label, cls = '', onClick = null) {
  const b = el('button', 'libb-btn ' + cls, parent);
  b.type = 'button';
  b.tabIndex = -1;
  const t = el('span', 'libb-btn-t', b);
  t.innerHTML = label;
  b.addEventListener('mousedown', (e) => e.preventDefault());
  if (onClick) b.addEventListener('click', (e) => { if (b.disabled) return; onClick(e); b.blur(); });
  b.setLabel = (s) => { t.innerHTML = s; };
  return b;
}

/** 屏幕底部/任意位置的提示条 */
export function tipLine(parent, cls = '') {
  const box = el('div', 'libb-tip ' + cls, parent);
  let cur = '';
  return {
    el: box,
    set(html, kind = '') {
      if (html === cur && box.dataset.kind === kind) return;
      cur = html;
      box.dataset.kind = kind;
      box.classList.remove('show');
      void box.offsetWidth;
      box.innerHTML = html;
      if (html) box.classList.add('show');
    },
    hide() { cur = ''; box.classList.remove('show'); },
  };
}

/** 等字体（最多 timeout 毫秒，不会卡住） */
export async function fontReady(sample = '金陵', size = 48, timeout = 1500) {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      document.fonts.load(`${size}px "JLBrush"`, sample),
      new Promise((r) => setTimeout(r, timeout)),
    ]);
  } catch { /* ignore */ }
}

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 柔光（加色） */
export function glow(g, x, y, r, color, a = 1) {
  if (r <= 0 || a <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

/** 生成一张噪点纹理画布（用作 pattern） */
export function noiseCanvas(size, seed, { r = 90, gC = 70, b = 40, alpha = 0.08, fibers = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const R = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = R();
    img.data[i * 4] = r; img.data[i * 4 + 1] = gC; img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.floor(v * v * 255 * alpha);
  }
  g.putImageData(img, 0, 0);
  if (fibers) {
    g.strokeStyle = `rgba(${r},${gC},${b},${alpha * 0.9})`;
    g.lineWidth = 0.6;
    for (let i = 0; i < fibers; i++) {
      const x = R() * size, y = R() * size, l = 6 + R() * 22, an = R() * Math.PI;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(an) * l * 0.5 + (R() - 0.5) * 6, y + Math.sin(an) * l * 0.5 + (R() - 0.5) * 6, x + Math.cos(an) * l, y + Math.sin(an) * l);
      g.stroke();
    }
  }
  return c;
}

/** 离屏画布 */
export function offscreen(w, h, dpr = 1) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, g, w, h, dpr };
}

/** 指针在元素内的坐标（CSS px） */
export function localXY(elm, e) {
  const r = elm.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/** 画一行毛笔字（带描边/阴影可选） */
export function brushText(g, text, x, y, size, color, { align = 'center', base = 'middle', stroke = null, lw = 3, font = FONT_BRUSH, shadow = null } = {}) {
  g.save();
  g.font = `${size}px ${font}`;
  g.textAlign = align; g.textBaseline = base;
  if (shadow) { g.shadowColor = shadow; g.shadowBlur = size * 0.3; }
  if (stroke) { g.lineJoin = 'round'; g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(text, x, y); }
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}

/** 竖排文字 */
export function vText(g, text, x, y, size, color, { gap = 1.08, font = FONT_BRUSH, stroke = null, lw = 3 } = {}) {
  g.save();
  g.font = `${size}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...text];
  chars.forEach((ch, i) => {
    const yy = y + i * size * gap;
    if (stroke) { g.lineJoin = 'round'; g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(ch, x, yy); }
    g.fillStyle = color; g.fillText(ch, x, yy);
  });
  g.restore();
}

export const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

const colorCache = new Map();
/** '#rrggbb' → [r,g,b] */
export function hex(c) {
  let v = colorCache.get(c);
  if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; colorCache.set(c, v); }
  return v;
}
/** 两色插值 → css 颜色串 */
export function mix(a, b, t, alpha = 1) {
  const A = hex(a), B = hex(b);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return `rgba(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)},${alpha})`;
}
export const rgba = (c, a) => { const A = hex(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; };

/** 小字号数字转中文（1~12） */
export const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/**
 * 宿主的模态框（如点 × 弹出的「暂且离开？」）正盖在舞台上。
 * 这时应当暂停计时、忽略按键，免得玩家在确认框前白白丢了时间或误操作。
 */
export function hostPaused(ctx) {
  const wrap = ctx.root && ctx.root.parentElement;
  return !!(wrap && wrap.querySelector(':scope > .mg-modal'));
}

/** 手机竖屏等小舞台判断 */
export const isNarrow = (ctx) => ctx.w < 560;

export { clamp, lerp, easeOutCubic, rng };
