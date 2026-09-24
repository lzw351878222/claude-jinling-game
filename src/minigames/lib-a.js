// 验砖 / 窑火 / 捉蠹 / 经史子集 共用的小工具：
// 字体、颜色、粒子、震屏、按钮、教学提示、横幅、常用绘图原件，以及蠹鱼（衣鱼）的画法。
import { clamp, lerp, TAU, el, injectStyle, rng } from '../core/util.js';
import css from './lib-a.css';

export function useLibStyle() { injectStyle('lib-a', css); }

// ---------------------------------------------------------------- 字体
let FB = null;
let FBODY = null;
function readFonts() {
  if (FB) return;
  try {
    const cs = getComputedStyle(document.documentElement);
    FB = cs.getPropertyValue('--f-brush').trim();
    FBODY = cs.getPropertyValue('--f-body').trim();
  } catch { /* ignore */ }
  if (!FB) FB = '"JLBrush", "STXingkai", "KaiTi", serif';
  if (!FBODY) FBODY = '"KaiTi", "STKaiti", "JLBrush", serif';
}
/** 画布用的书法字体串 */
export const fBrush = (px) => { readFonts(); return `${(+px).toFixed(1)}px ${FB}`; };
/** 画布用的楷体正文字体串 */
export const fBody = (px, bold = false) => { readFonts(); return `${bold ? 'bold ' : ''}${(+px).toFixed(1)}px ${FBODY}`; };
/** 等书法字体就绪（最多 1.5 秒），否则画布上第一帧会用后备字体 */
export async function fontsReady() {
  readFonts();
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      document.fonts.load('40px "JLBrush"', '金陵寻踪'),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- 颜色
export function hexRgb(h) {
  if (Array.isArray(h)) return h;
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(c, a = 1) {
  const [r, g, b] = hexRgb(c);
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
export function mixRgb(a, b, t) {
  const A = hexRgb(a); const B = hexRgb(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}
export const mix = (a, b, t, alpha = 1) => rgba(mixRgb(a, b, t), alpha);
/** 多段渐变取色：stops = [[0,'#000'],[0.5,'#f00'],[1,'#fff']] */
export function rampRgb(stops, t) {
  t = clamp(t, stops[0][0], stops[stops.length - 1][0]);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1]; const [t1, c1] = stops[i];
      return mixRgb(c0, c1, (t - t0) / ((t1 - t0) || 1));
    }
  }
  return hexRgb(stops[stops.length - 1][1]);
}
/** HSL → [r,g,b] */
export function hslRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

// ---------------------------------------------------------------- 发光贴图（按颜色缓存）
const glowCache = new Map();
export function glowSprite(color) {
  const key = Array.isArray(color) ? color.map((v) => v | 0).join(',') : color;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(color, 1));
  gr.addColorStop(0.3, rgba(color, 0.6));
  gr.addColorStop(0.65, rgba(color, 0.18));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  if (glowCache.size > 200) glowCache.clear();
  glowCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- 粒子
export class Particles {
  constructor(max = 500) { this.list = []; this.max = max; }
  add(o) {
    const p = {
      x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, t: 0, life: 1, size: 4, size1: null,
      color: '#1d1b18', alpha: 1, fadeIn: 0, hold: 0, shape: 'circle', rot: 0, vr: 0, blend: null,
      text: '', font: null, stroke: null, lw: 2, delay: 0, ...o,
    };
    if (p.delay) p.t = -p.delay;
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
    return p;
  }
  burst(n, fn) { for (let i = 0; i < n; i++) this.add(fn(i)); }
  update(dt) {
    const a = this.list;
    let j = 0;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      p.t += dt;
      if (p.t < 0) { a[j++] = p; continue; }
      if (p.t >= p.life) continue;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      a[j++] = p;
    }
    a.length = j;
  }
  draw(g) {
    for (const p of this.list) {
      if (p.t < 0) continue;
      const k = p.t / p.life;
      let al = p.alpha;
      if (p.fadeIn && p.t < p.fadeIn) al *= p.t / p.fadeIn;
      if (k > p.hold) al *= 1 - (k - p.hold) / (1 - p.hold);
      if (al <= 0.003) continue;
      const s = p.size1 == null ? p.size : lerp(p.size, p.size1, k);
      g.save();
      g.globalAlpha = al;
      if (p.blend) g.globalCompositeOperation = p.blend;
      switch (p.shape) {
        case 'glow': {
          const img = glowSprite(p.color);
          g.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
          break;
        }
        case 'spark': {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const len = Math.min(s * 6, sp * 0.05 + s);
          g.strokeStyle = p.color; g.lineWidth = s * 0.6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len); g.stroke();
          break;
        }
        case 'rect':
          g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
          g.fillRect(-s / 2, -s * 0.32, s, s * 0.64);
          break;
        case 'shard':
          g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
          g.beginPath(); g.moveTo(-s * 0.5, -s * 0.3); g.lineTo(s * 0.55, -s * 0.1); g.lineTo(-s * 0.1, s * 0.45); g.closePath(); g.fill();
          if (p.stroke) { g.strokeStyle = p.stroke; g.lineWidth = 0.8; g.stroke(); }
          break;
        case 'ring':
          g.strokeStyle = p.color; g.lineWidth = Math.max(0.5, p.lw * (1 - k));
          g.beginPath();
          if (p.sy) g.ellipse(p.x, p.y, s, s * p.sy, 0, 0, TAU); else g.arc(p.x, p.y, s, 0, TAU);
          g.stroke();
          break;
        case 'leaf':
          g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color;
          g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.55, s, 0); g.quadraticCurveTo(0, s * 0.55, -s, 0); g.fill();
          g.strokeStyle = 'rgba(255,255,240,.45)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-s * 0.8, 0); g.lineTo(s * 0.8, 0); g.stroke();
          break;
        case 'text':
          g.translate(p.x, p.y); if (p.rot) g.rotate(p.rot);
          g.scale(s, s);
          g.font = p.font; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (p.stroke) { g.lineJoin = 'round'; g.strokeStyle = p.stroke; g.lineWidth = p.lw; g.strokeText(p.text, 0, 0); }
          g.fillStyle = p.color; g.fillText(p.text, 0, 0);
          break;
        case 'fn':
          p.draw(g, p, k, s);
          break;
        default:
          g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, Math.max(0.1, s), 0, TAU); g.fill();
      }
      g.restore();
    }
  }
  clear() { this.list.length = 0; }
}

// ---------------------------------------------------------------- 震屏
export class Shake {
  constructor() { this.amp = 0; this.x = 0; this.y = 0; }
  add(v) { this.amp = Math.min(20, this.amp + v); }
  update(dt) {
    this.amp = Math.max(0, this.amp - (this.amp * 7 + 4) * dt);
    const a = this.amp;
    this.x = (Math.random() * 2 - 1) * a;
    this.y = (Math.random() * 2 - 1) * a * 0.8;
  }
}

// ---------------------------------------------------------------- DOM 小部件
/**
 * 游戏按钮：按下即触发（手感更跟手），支持按住。tabIndex=-1，避免空格/回车再次触发 click。
 */
export function gameButton(parent, { text = '', icon = '', cls = '', key = '', onPress, onRelease } = {}) {
  const b = el('button', `liba-btn ${cls}`, parent);
  b.type = 'button';
  b.tabIndex = -1;
  b.innerHTML = `${icon ? `<span class="liba-btn-ic">${icon}</span>` : ''}<span class="liba-btn-t">${text}</span>${key ? `<span class="liba-key">${key}</span>` : ''}`;
  let held = false;
  b.addEventListener('pointerdown', (e) => {
    if (b.classList.contains('off')) return;
    e.preventDefault();
    held = true;
    b.classList.add('down');
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (onPress) onPress(e);
  });
  const up = (e) => {
    if (!held) return;
    held = false;
    b.classList.remove('down');
    if (onRelease) onRelease(e);
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.setText = (t) => { const s = b.querySelector('.liba-btn-t'); if (s) s.textContent = t; };
  b.setOff = (off) => b.classList.toggle('off', !!off);
  b.flash = () => { b.classList.add('kb'); setTimeout(() => b.classList.remove('kb'), 120); };
  b.isHeld = () => held;
  return b;
}

/** 教学提示气泡。at(x, y, 'above'|'below') 指向舞台上的某一点。 */
export function hint(ctx, htmlStr, { x = null, y = null, place = 'above', ms = 0, cls = '', bob = true, arrow = true } = {}) {
  const h = el('div', `liba-hint ${cls}${bob ? ' bob' : ''}`, ctx.root);
  h.innerHTML = htmlStr;
  let timer = 0;
  const api = {
    el: h,
    closed: false,
    at(px, py, pl = place) {
      if (api.closed) return api;
      const w = h.offsetWidth || 200;
      const W = ctx.w || ctx.root.clientWidth;
      const left = clamp(px, w / 2 + 6, W - w / 2 - 6);
      h.style.left = `${left}px`;
      h.style.top = `${py}px`;
      h.style.transform = pl === 'below' ? 'translate(-50%, 10px)' : pl === 'center' ? 'translate(-50%, -50%)' : 'translate(-50%, calc(-100% - 10px))';
      h.classList.toggle('arrow-down', arrow && pl === 'above');
      h.classList.toggle('arrow-up', arrow && pl === 'below');
      h.style.setProperty('--ax', `${clamp(px - left, -w / 2 + 14, w / 2 - 14)}px`);
      return api;
    },
    close() {
      if (api.closed) return;
      api.closed = true;
      clearTimeout(timer);
      h.classList.add('out');
      setTimeout(() => h.remove(), 320);
    },
  };
  if (x != null) api.at(x, y, place);
  else api.at((ctx.w || 400) / 2, (ctx.h || 400) * 0.2, 'center');
  if (ms) timer = setTimeout(api.close, ms);
  ctx.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return api;
}

/** 大字横幅（开场地点、阶段名） */
export function banner(ctx, title, sub = '', { dark = false, ms = 1700, top = null } = {}) {
  const b = el('div', `liba-banner${dark ? ' dark' : ''}`, ctx.root);
  b.innerHTML = `<div class="liba-banner-t">${title}</div>${sub ? `<div class="liba-banner-s">${sub}</div>` : ''}`;
  if (top != null) b.style.top = top;
  b.style.animationDuration = `${ms}ms`;
  const t = setTimeout(() => b.remove(), ms + 60);
  ctx.signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  return b;
}

/** 键盘映射：{ KeyA: fn, ... }，命中的键会 preventDefault；宿主确认框打开时不响应 */
export function keymap(ctx, map) {
  return ctx.keys.onDown((code, e) => {
    if (hostPaused(ctx)) return;
    const f = map[code];
    if (f) { e.preventDefault(); f(e); }
  });
}

/** 一个会随 ctx.signal 中止而 reject 的 Promise；executor(resolve) */
export function untilDone(ctx, executor) {
  return new Promise((resolve, reject) => {
    if (ctx.signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
    const onAbort = () => reject(new DOMException('aborted', 'AbortError'));
    ctx.signal.addEventListener('abort', onAbort, { once: true });
    executor((v) => { ctx.signal.removeEventListener('abort', onAbort); resolve(v); });
  });
}

/** 在 window/document 上挂监听，中止时自动移除；返回 off() */
export function listen(ctx, target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  const off = () => target.removeEventListener(type, fn, opts);
  ctx.signal.addEventListener('abort', off, { once: true });
  return off;
}

/**
 * 宿主的模态框（如点 × 弹出的「暂且离开？」）正盖在舞台上。
 * 这时应当暂停计时、忽略按键，免得玩家在确认框前白白丢了时间或误操作。
 */
export function hostPaused(ctx) {
  const wrap = ctx.root && ctx.root.parentElement;
  return !!(wrap && wrap.querySelector(':scope > .mg-modal'));
}

/** 开发构建里把调试句柄挂到 window 上（生产构建会被剔除） */
export function devHandle(name, obj) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) { try { window[name] = obj; } catch { /* ignore */ } }
}

// ---------------------------------------------------------------- 绘图原件
export function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 不规则墨团路径（平滑闭合曲线） */
export function blobPath(g, x, y, r, seed = 1, n = 12, jag = 0.35, sy = 1) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.3;
    const rad = r * (1 - jag / 2 + R() * jag);
    pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * sy]);
  }
  g.beginPath();
  const l = pts[n - 1];
  g.moveTo((l[0] + pts[0][0]) / 2, (l[1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i]; const q = pts[(i + 1) % n];
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  g.closePath();
}

/** 墨点飞溅 */
export function drawSplat(g, x, y, r, seed = 1, color = '#1d1b18', alpha = 1) {
  const R = rng(seed);
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = color;
  blobPath(g, x, y, r, seed, 11, 0.5);
  g.fill();
  const n = 6 + Math.floor(R() * 6);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const d = r * (1.05 + R() * 1.1);
    const s = r * (0.07 + R() * 0.17);
    const px = x + Math.cos(a) * d; const py = y + Math.sin(a) * d;
    g.beginPath(); g.arc(px, py, s, 0, TAU); g.fill();
    if (R() < 0.5) { // 拖尾
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r * 0.7 + Math.cos(a + 1.57) * s * 0.6, y + Math.sin(a) * r * 0.7 + Math.sin(a + 1.57) * s * 0.6);
      g.lineTo(px, py);
      g.lineTo(x + Math.cos(a) * r * 0.7 - Math.cos(a + 1.57) * s * 0.6, y + Math.sin(a) * r * 0.7 - Math.sin(a + 1.57) * s * 0.6);
      g.fill();
    }
  }
  g.restore();
}

const sealCache = new Map();
/** 印章贴图（带斑驳），text 1~4 字 */
export function sealSprite(text, size, { color = '#b23a2e', ink = '#fbeee0', round = false, seed = 7 } = {}) {
  const key = `${text}|${Math.round(size)}|${color}|${ink}|${round}|${seed}`;
  let c = sealCache.get(key);
  if (c) return c;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const S = Math.ceil(size * dpr);
  c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const s = size;
  const R = rng(seed);
  g.fillStyle = color;
  if (round) { g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, TAU); g.fill(); } else { rr(g, 1, 1, s - 2, s - 2, s * 0.1); g.fill(); }
  g.strokeStyle = ink; g.lineWidth = Math.max(1, s * 0.045);
  if (round) { g.beginPath(); g.arc(s / 2, s / 2, s * 0.4, 0, TAU); g.stroke(); } else { rr(g, s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.05); g.stroke(); }
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...text];
  if (chars.length === 1) { g.font = fBrush(s * 0.6); g.fillText(chars[0], s / 2, s * 0.53); }
  else if (chars.length === 2) { g.font = fBrush(s * 0.36); g.fillText(chars[0], s / 2, s * 0.32); g.fillText(chars[1], s / 2, s * 0.7); }
  else {
    g.font = fBrush(s * 0.33);
    const pos = [[0.68, 0.32], [0.68, 0.7], [0.32, 0.32], [0.32, 0.7]];
    chars.slice(0, 4).forEach((ch, i) => g.fillText(ch, s * pos[i][0], s * pos[i][1]));
  }
  // 斑驳
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    g.globalAlpha = 0.35 + R() * 0.6;
    g.beginPath(); g.arc(R() * s, R() * s, 0.4 + R() * s * 0.025, 0, TAU); g.fill();
  }
  g.globalAlpha = 0.25;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(R() * s, R() * s, s * (0.06 + R() * 0.08), 0, TAU); g.fill(); }
  if (sealCache.size > 60) sealCache.clear();
  sealCache.set(key, c);
  return c;
}
export function drawSeal(g, x, y, size, text, { rot = -0.1, alpha = 1, scale = 1, ...o } = {}) {
  const img = sealSprite(text, size, o);
  g.save();
  g.translate(x, y); g.rotate(rot); g.scale(scale, scale);
  g.globalAlpha *= alpha;
  g.drawImage(img, -size / 2, -size / 2, size, size);
  g.restore();
}

/** 竖排文字（自上而下），textBaseline 用 middle */
export function vtext(g, str, x, y, size, step = 1.08) {
  const chars = [...str];
  for (let i = 0; i < chars.length; i++) g.fillText(chars[i], x, y + i * size * step);
}

let paperTex = null;
/** 宣纸纹理（平铺用画布） */
export function paperTexture() {
  if (paperTex) return paperTex;
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d');
  const R = rng(99);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(110,86,50,${0.04 + R() * 0.07})` : `rgba(255,252,240,${0.05 + R() * 0.08})`;
    g.fillRect(R() * 192, R() * 192, 1 + R() * 1.5, 1 + R() * 1.5);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(120,95,55,${0.04 + R() * 0.05})`;
    g.lineWidth = 0.5 + R() * 0.6;
    const x = R() * 192; const y = R() * 192; const a = R() * TAU; const l = 6 + R() * 20;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  paperTex = c;
  return c;
}
/** 用宣纸纹理铺满当前路径 */
export function paperFill(g, alpha = 1) {
  const p = g.createPattern(paperTexture(), 'repeat');
  g.save(); g.globalAlpha *= alpha; g.fillStyle = p; g.fill(); g.restore();
}

/** 木纹矩形 */
export function drawWood(g, x, y, w, h, { base = '#8a5a35', dark = '#5b3920', light = '#a87549', seed = 1, vertical = false, lines = 16, alpha = 0.3 } = {}) {
  const R = rng(seed);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  const gr = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, light); gr.addColorStop(0.45, base); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = rgba(dark, alpha);
  g.lineCap = 'round';
  const L = vertical ? h : w; const S = vertical ? w : h;
  for (let i = 0; i < lines; i++) {
    const off = R() * S; const amp = 0.5 + R() * 2.5; const f = 0.008 + R() * 0.02; const ph = R() * 10;
    g.lineWidth = 0.5 + R() * 1.3;
    g.beginPath();
    for (let d = 0; d <= L; d += 12) {
      const o = off + Math.sin(d * f + ph) * amp;
      if (vertical) { if (d === 0) g.moveTo(x + o, y + d); else g.lineTo(x + o, y + d); } else if (d === 0) g.moveTo(x + d, y + o); else g.lineTo(x + d, y + o);
    }
    g.stroke();
  }
  // 木节
  for (let i = 0; i < Math.round(L / 260); i++) {
    const cx = vertical ? x + R() * w : x + R() * w; const cy = vertical ? y + R() * h : y + R() * h;
    g.strokeStyle = rgba(dark, alpha * 1.3); g.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { g.beginPath(); g.ellipse(cx, cy, k * 3.5 * (vertical ? 0.5 : 1.6), k * 3.5 * (vertical ? 1.6 : 0.5), 0, 0, TAU); g.stroke(); }
  }
  g.restore();
}

/** 远山（水墨晕染） */
export function drawRidge(g, x0, x1, baseY, amp, seed, color, alpha, bottom) {
  const R = rng(seed);
  const ph = [R() * 10, R() * 10, R() * 10];
  const f = [1.2 + R(), 3 + R() * 2, 7 + R() * 4];
  const top = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = 0.55 * Math.sin(u * f[0] * Math.PI + ph[0]) + 0.3 * Math.sin(u * f[1] * Math.PI + ph[1]) + 0.15 * Math.sin(u * f[2] * Math.PI + ph[2]);
    top.push([lerp(x0, x1, u), baseY - amp * (0.5 + 0.5 * v)]);
  }
  g.save();
  g.beginPath();
  g.moveTo(x0, bottom);
  for (const [x, y] of top) g.lineTo(x, y);
  g.lineTo(x1, bottom);
  g.closePath();
  const gr = g.createLinearGradient(0, baseY - amp, 0, bottom);
  gr.addColorStop(0, rgba(color, alpha));
  gr.addColorStop(0.55, rgba(color, alpha * 0.55));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fill();
  // 山脊线
  g.strokeStyle = rgba(color, Math.min(1, alpha * 1.4));
  g.lineWidth = 1.2;
  g.beginPath();
  top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  g.restore();
}

/** 小王冠（蠹王用） */
export function drawCrown(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#e8c35a'; g.strokeStyle = '#6b4a14'; g.lineWidth = Math.max(1, s * 0.08); g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-s * 0.55, s * 0.3); g.lineTo(-s * 0.6, -s * 0.25); g.lineTo(-s * 0.28, s * 0.02); g.lineTo(0, -s * 0.42);
  g.lineTo(s * 0.28, s * 0.02); g.lineTo(s * 0.6, -s * 0.25); g.lineTo(s * 0.55, s * 0.3); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#b23a2e';
  g.beginPath(); g.arc(0, s * 0.12, s * 0.1, 0, TAU); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- 蠹鱼
const SF_BODY = { base: ['#58616a', '#c1cad2', '#f1f5f8', '#b3bcc5', '#545d66'], line: 'rgba(38,46,54,.42)' };
const SF_ARMOR = { base: ['#303a45', '#76869a', '#c9d6e3', '#6f7f92', '#2e3843'], line: 'rgba(16,22,30,.7)' };
const SF_KING = { base: ['#5a4a2c', '#cbb27a', '#fff3cf', '#c2a66a', '#57462a'], line: 'rgba(70,50,20,.55)' };
/**
 * 画一只蠹鱼（衣鱼）：胡萝卜形、分节、银光，两根长触须、三根尾丝、六条短腿。
 * x,y 为身体中心，ang 为头的朝向，L 为身长（不含须）。
 * o: { t 时间, rate 摆动频率, wig 摆动幅度, alpha, armor(0/1), king, hurt 0..1 闪白, flat 0..1 压扁, gait 腿动 }
 * 返回头部的屏幕坐标 {hx, hy}
 */
export function drawSilverfish(g, x, y, ang, L, o = {}) {
  const t = o.t || 0;
  const ph = t * (o.rate ?? 9);
  const wig = o.wig ?? 1;
  const gait = o.gait ?? ph * 1.7;
  const pal = o.king ? SF_KING : o.armor ? SF_ARMOR : SF_BODY;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  if (o.flat) g.scale(1 - o.flat * 0.15, 1 + o.flat * 0.8);
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  const N = 12;
  const P = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    P.push([L * (0.46 - s), Math.sin(s * 4.2 - ph) * L * 0.05 * wig * (0.2 + s)]);
  }
  const wAt = (s) => L * 0.27 * Math.min(1, Math.pow((s + 0.03) / 0.15, 0.5)) * Math.pow(Math.max(0, 1 - s * 0.94), 1.05);
  const Lf = []; const Rt = []; const Nn = [];
  for (let i = 0; i <= N; i++) {
    const a = P[Math.max(0, i - 1)]; const b = P[Math.min(N, i + 1)];
    let tx = b[0] - a[0]; let ty = b[1] - a[1];
    const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
    const nx = -ty; const ny = tx; const w = wAt(i / N) / 2;
    Nn.push([nx, ny, w]);
    Lf.push([P[i][0] + nx * w, P[i][1] + ny * w]);
    Rt.push([P[i][0] - nx * w, P[i][1] - ny * w]);
  }
  const lw = Math.max(0.7, L * 0.018);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // 腿（三对）
  g.strokeStyle = o.king ? '#6a5530' : '#5c646d';
  g.lineWidth = lw * 1.1;
  for (let k = 0; k < 3; k++) {
    const i = 2 + k;
    for (const side of [1, -1]) {
      const [nx, ny, w] = Nn[i];
      const sw = Math.sin(gait + k * 2.1 + (side > 0 ? 0 : Math.PI)) * 0.55;
      const bx = P[i][0] + nx * w * side * 0.9; const by = P[i][1] + ny * w * side * 0.9;
      const ll = L * 0.15;
      const kx = bx + (nx * side * Math.cos(sw) + Math.sin(sw) * 0.6) * ll; const ky = by + (ny * side * Math.cos(sw)) * ll;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(kx, ky); g.lineTo(kx - L * 0.06 + Math.sin(sw) * L * 0.05, ky + side * L * 0.03); g.stroke();
    }
  }
  // 尾丝（三根）
  const tail = P[N];
  g.strokeStyle = o.king ? '#8a7446' : '#7d8791';
  g.lineWidth = lw;
  for (const [a0, len] of [[-0.5, 0.55], [0, 0.62], [0.5, 0.55]]) {
    const a = Math.PI + a0 + Math.sin(ph * 0.9 + a0 * 3) * 0.12;
    const ex = tail[0] + Math.cos(a) * L * len; const ey = tail[1] + Math.sin(a) * L * len;
    const cx = tail[0] + Math.cos(a) * L * len * 0.5 + Math.sin(ph + a0) * L * 0.06;
    const cy = tail[1] + Math.sin(a) * L * len * 0.5 + Math.cos(ph * 1.3 + a0) * L * 0.06;
    g.beginPath(); g.moveTo(tail[0], tail[1]); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
  }
  // 触须（两根，长）
  const head = P[0];
  for (const side of [1, -1]) {
    const a = side * (0.38 + Math.sin(t * 5.3 + side) * 0.14);
    const len = L * (o.king ? 0.75 : 0.95);
    const sx = head[0] + L * 0.02; const sy = head[1] + side * L * 0.04;
    const ex = sx + Math.cos(a) * len; const ey = sy + Math.sin(a) * len;
    const cx = sx + Math.cos(a * 0.4) * len * 0.55; const cy = sy + Math.sin(a * 0.4) * len * 0.55 + Math.sin(t * 7 + side) * L * 0.06;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
  }
  // 身体
  const body = () => {
    g.beginPath();
    g.moveTo(Lf[0][0], Lf[0][1]);
    for (let i = 1; i <= N; i++) g.lineTo(Lf[i][0], Lf[i][1]);
    for (let i = N; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]);
    // 圆头
    const hw = Nn[0][2];
    g.quadraticCurveTo(head[0] + hw * 1.6, head[1], Lf[0][0], Lf[0][1]);
    g.closePath();
  };
  const gr = g.createLinearGradient(0, -L * 0.14, 0, L * 0.14);
  pal.base.forEach((c, i) => gr.addColorStop(i / 4, c));
  body();
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = o.king ? 'rgba(60,40,10,.7)' : 'rgba(30,36,44,.65)';
  g.lineWidth = lw;
  g.stroke();
  // 分节
  g.save();
  body(); g.clip();
  g.strokeStyle = pal.line;
  g.lineWidth = Math.max(0.6, L * 0.014) * (o.armor ? 1.6 : 1);
  for (let i = 1; i < N; i++) {
    const [nx, ny, w] = Nn[i];
    g.beginPath();
    g.moveTo(Lf[i][0], Lf[i][1]);
    g.quadraticCurveTo(P[i][0] - w * 0.55, P[i][1], Rt[i][0], Rt[i][1]);
    g.stroke();
    if (o.armor && i < N - 2) { // 甲片高光
      g.fillStyle = 'rgba(220,235,250,.5)';
      g.beginPath(); g.arc(P[i][0] - w * 0.2 + nx * w * 0.5, P[i][1] + ny * w * 0.5, Math.max(0.6, L * 0.012), 0, TAU); g.fill();
    }
  }
  // 流光
  const sp = ((t * 0.55) % 1.6) - 0.3;
  const X = L * (0.46 - sp);
  const sh = g.createLinearGradient(X - L * 0.16, 0, X + L * 0.16, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, o.king ? 'rgba(255,240,190,.75)' : 'rgba(255,255,255,.6)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh;
  g.fillRect(-L, -L * 0.3, L * 2, L * 0.6);
  if (o.hurt) { g.fillStyle = `rgba(255,255,255,${o.hurt})`; g.fillRect(-L, -L * 0.3, L * 2, L * 0.6); }
  g.restore();
  // 眼睛
  const er = Math.max(1.1, L * 0.034);
  for (const side of [1, -1]) {
    const ex = head[0] - L * 0.05; const ey = head[1] + side * L * 0.068;
    g.fillStyle = o.king ? '#9b1c12' : '#141414';
    g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath(); g.arc(ex + er * 0.35, ey - er * 0.35 * side, er * 0.38, 0, TAU); g.fill();
  }
  g.restore();
  const hx = x + Math.cos(ang) * L * 0.36; const hy = y + Math.sin(ang) * L * 0.36;
  return { hx, hy };
}
