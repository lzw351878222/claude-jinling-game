// 程序化像素纹理库：所有地表、墙体、屋瓦、木作、织物纹理都在这里用画布逐像素绘制。
// 约定：1 个世界单位（1 格）= 32 像素；纹理全部 NearestFilter + RepeatWrapping，保持像素质感。
import * as THREE from 'three';
import { rng, clamp } from '../core/util.js';

export const PPU = 32; // pixels per world unit

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function hex(c) {
  if (Array.isArray(c)) return c;
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(c, f) {
  const [r, g, b] = hex(c);
  return [clamp(Math.round(r * f), 0, 255), clamp(Math.round(g * f), 0, 255), clamp(Math.round(b * f), 0, 255)];
}
function mix(a, b, t) {
  a = hex(a); b = hex(b);
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/** 一张可逐像素绘制的画布 */
class Pix {
  constructor(w, h, seed = 1) {
    this.w = w; this.h = h;
    this.c = canvas(w, h);
    this.g = this.c.getContext('2d');
    this.img = this.g.createImageData(w, h);
    this.d = this.img.data;
    this.r = rng(seed);
  }
  set(x, y, col, a = 255) {
    x = ((x % this.w) + this.w) % this.w; y = ((y % this.h) + this.h) % this.h;
    const i = (y * this.w + x) * 4;
    const c = hex(col);
    if (a >= 255) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; return; }
    const t = a / 255;
    this.d[i] = this.d[i] + (c[0] - this.d[i]) * t;
    this.d[i + 1] = this.d[i + 1] + (c[1] - this.d[i + 1]) * t;
    this.d[i + 2] = this.d[i + 2] + (c[2] - this.d[i + 2]) * t;
    this.d[i + 3] = Math.max(this.d[i + 3], a);
  }
  get(x, y) {
    x = ((x % this.w) + this.w) % this.w; y = ((y % this.h) + this.h) % this.h;
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2]];
  }
  fill(col) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, col); }
  rect(x0, y0, w, h, col, a) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, col, a); }
  /** 每个像素按噪声在调色板里挑一个颜色 */
  noiseFill(pal, weights) {
    const tot = weights ? weights.reduce((s, v) => s + v, 0) : pal.length;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      let r = this.r() * tot, k = 0;
      if (weights) { while (r > weights[k]) { r -= weights[k]; k++; } } else k = Math.floor(r);
      this.set(x, y, pal[Math.min(k, pal.length - 1)]);
    }
  }
  /** 平滑值噪声（可平铺） */
  valueNoise(scale, seed = 0) {
    const gw = Math.max(1, Math.round(this.w / scale)), gh = Math.max(1, Math.round(this.h / scale));
    const r = rng(seed + 99);
    const grid = []; for (let i = 0; i < gw * gh; i++) grid.push(r());
    return (x, y) => {
      const fx = (x / this.w) * gw, fy = (y / this.h) * gh;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const g = (i, j) => grid[(((j % gh) + gh) % gh) * gw + (((i % gw) + gw) % gw)];
      const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
      return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    };
  }
  done() { this.g.putImageData(this.img, 0, 0); return this.c; }
}

// ------------------------------------------------------------------ 地表
function grass(seed = 1, tone = 0) {
  const p = new Pix(128, 128, seed);
  const base = tone === 1 ? ['#6f8f3e', '#7a9a45', '#86a64d', '#648437'] : tone === 2 ? ['#8a8a45', '#979650', '#a3a15a', '#7c7d3d'] : ['#5f8a3f', '#6b9747', '#77a350', '#557d38'];
  const n = p.valueNoise(24, seed);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const v = n(x, y) + p.r() * 0.35;
    p.set(x, y, base[v < 0.45 ? 3 : v < 0.75 ? 0 : v < 1.0 ? 1 : 2]);
  }
  // 草叶
  for (let i = 0; i < 520; i++) {
    const x = Math.floor(p.r() * 128), y = Math.floor(p.r() * 128);
    const hgt = 2 + Math.floor(p.r() * 3);
    const col = p.r() < 0.5 ? shade(base[2], 1.15) : shade(base[3], 0.85);
    for (let k = 0; k < hgt; k++) p.set(x + (k === hgt - 1 && p.r() < 0.5 ? 1 : 0), y - k, col);
  }
  // 零星小花
  const flowers = ['#f3efe0', '#f2d35b', '#e8a0b4', '#b9a3e3'];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(p.r() * 128), y = Math.floor(p.r() * 128);
    const c = flowers[Math.floor(p.r() * flowers.length)];
    p.set(x, y, c); if (p.r() < 0.5) { p.set(x + 1, y, c); p.set(x, y + 1, shade(c, 0.8)); }
  }
  return p.done();
}
function dirt(seed = 2, tone = 0) {
  const p = new Pix(128, 128, seed);
  const pal = tone === 1 ? ['#8a6a4a', '#95755a', '#7c5e40', '#a08063'] : tone === 2 ? ['#6a5040', '#735848', '#5e4637', '#7d6352'] : ['#a58a64', '#b09570', '#9a7f5a', '#bba27c'];
  const n = p.valueNoise(32, seed);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const v = n(x, y) * 0.7 + p.r() * 0.45;
    p.set(x, y, pal[v < 0.4 ? 2 : v < 0.7 ? 0 : v < 0.95 ? 1 : 3]);
  }
  for (let i = 0; i < 90; i++) { // 碎石
    const x = Math.floor(p.r() * 128), y = Math.floor(p.r() * 128);
    const c = p.r() < 0.5 ? '#c9b89a' : '#7d6a52';
    p.set(x, y, c); p.set(x + 1, y, shade(c, 0.85)); if (p.r() < 0.4) p.set(x, y - 1, shade(c, 1.1));
  }
  for (let i = 0; i < 6; i++) { // 车辙/裂纹
    let x = p.r() * 128, y = p.r() * 128;
    const dx = p.r() * 2 - 1, dy = p.r() * 0.6 - 0.3;
    for (let k = 0; k < 18; k++) { p.set(Math.floor(x), Math.floor(y), shade(pal[2], 0.82)); x += dx + (p.r() - 0.5); y += dy + (p.r() - 0.5); }
  }
  return p.done();
}
function stoneSlab(seed = 3, tone = 0) {
  // 青石板：错缝的长条石板
  const p = new Pix(128, 128, seed);
  const base = tone === 1 ? ['#9c9a92', '#a8a69d', '#8f8d85'] : tone === 2 ? ['#b7ab93', '#c3b89f', '#a89c84'] : ['#8d949a', '#98a0a6', '#838a90'];
  const grout = shade(base[2], 0.62);
  const rowH = 16;
  for (let row = 0; row < 128 / rowH; row++) {
    let x = row % 2 ? -Math.floor(p.r() * 20) - 8 : 0;
    while (x < 128) {
      const w = 24 + Math.floor(p.r() * 3) * 8;
      const tone2 = base[Math.floor(p.r() * base.length)];
      const f = 0.94 + p.r() * 0.12;
      for (let y = row * rowH; y < row * rowH + rowH; y++) {
        for (let xx = x; xx < x + w; xx++) {
          let c = shade(tone2, f + (p.r() - 0.5) * 0.06);
          if (y === row * rowH || xx === x) c = grout;
          else if (y === row * rowH + 1 || xx === x + 1) c = shade(tone2, f * 1.08);
          else if (y === row * rowH + rowH - 1) c = shade(tone2, f * 0.88);
          p.set(xx, y, c);
        }
      }
      if (p.r() < 0.25) { // 裂纹
        let cx = x + 4 + p.r() * (w - 8), cy = row * rowH + 3;
        for (let k = 0; k < 10; k++) { p.set(Math.floor(cx), Math.floor(cy), shade(tone2, 0.75)); cx += p.r() - 0.5; cy += 1; if (cy > row * rowH + rowH - 2) break; }
      }
      x += w;
    }
  }
  return p.done();
}
function cobble(seed = 4) {
  const p = new Pix(128, 128, seed);
  p.fill('#6f6a60');
  for (let i = 0; i < 260; i++) {
    const cx = p.r() * 128, cy = p.r() * 128, rx = 3 + p.r() * 3.5, ry = 2.5 + p.r() * 2.5;
    const col = ['#a39e92', '#b3ad9f', '#948f84', '#bdb3a1', '#8f8b83'][Math.floor(p.r() * 5)];
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) p.set(x, y, d > 0.7 ? shade(col, 0.82) : (y < cy - ry * 0.3 ? shade(col, 1.1) : col));
    }
  }
  return p.done();
}
function sand(seed = 5) {
  const p = new Pix(128, 128, seed);
  const pal = ['#d8c79e', '#cfbd92', '#e1d2ab', '#c5b389'];
  const n = p.valueNoise(20, seed);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const ripple = Math.sin((y + n(x, y) * 14) * 0.55) * 0.5 + 0.5;
    const v = ripple * 0.6 + p.r() * 0.4;
    p.set(x, y, pal[v < 0.3 ? 3 : v < 0.6 ? 1 : v < 0.85 ? 0 : 2]);
  }
  return p.done();
}
function mud(seed = 6) {
  const p = new Pix(128, 128, seed);
  const pal = ['#5d4a3a', '#66513f', '#544234', '#715c49'];
  const n = p.valueNoise(28, seed);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const v = n(x, y) * 0.7 + p.r() * 0.4;
    p.set(x, y, pal[v < 0.35 ? 2 : v < 0.7 ? 0 : v < 0.95 ? 1 : 3]);
  }
  // 水洼
  for (let i = 0; i < 4; i++) {
    const cx = p.r() * 128, cy = p.r() * 128, rx = 6 + p.r() * 8, ry = 3 + p.r() * 3;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) p.set(x, y, d > 0.75 ? '#4a3b2f' : (y < cy - ry * 0.2 ? '#8e9aa3' : '#6d7c86'));
    }
  }
  return p.done();
}
function woodFloor(seed = 7, tone = 0) {
  const p = new Pix(128, 128, seed);
  const base = tone === 1 ? ['#7a4f33', '#6c452c', '#855a3c'] : ['#a07a52', '#936d47', '#ad875e'];
  const plank = 16;
  for (let row = 0; row < 128 / plank; row++) {
    let x = -Math.floor(p.r() * 60);
    while (x < 128) {
      const w = 40 + Math.floor(p.r() * 50);
      const c = base[Math.floor(p.r() * base.length)];
      for (let y = row * plank; y < row * plank + plank; y++) for (let xx = x; xx < x + w; xx++) {
        let col = shade(c, 0.96 + 0.08 * Math.sin((xx + y * 0.3) * 0.35 + row) + (p.r() - 0.5) * 0.05);
        if (y === row * plank) col = shade(c, 0.6);
        else if (xx === x) col = shade(c, 0.7);
        else if (y === row * plank + 1) col = shade(c, 1.1);
        p.set(xx, y, col);
      }
      x += w;
    }
  }
  return p.done();
}
function brickPave(seed = 8, tone = 0) {
  // 人字纹 / 席纹铺地砖
  const p = new Pix(128, 128, seed);
  const base = tone === 1 ? ['#a9a39a', '#b5afa5', '#9d978e'] : ['#8a8f93', '#959a9e', '#7f8488'];
  const grout = tone === 1 ? '#7c766d' : '#5f6468';
  p.fill(grout);
  const u = 8;
  for (let by = 0; by < 128; by += u * 2) for (let bx = 0; bx < 128; bx += u * 2) {
    const horiz = ((bx + by) / (u * 2)) % 2 === 0;
    for (let k = 0; k < 2; k++) {
      const c = base[Math.floor(p.r() * base.length)];
      const x0 = horiz ? bx : bx + k * u, y0 = horiz ? by + k * u : by;
      const w = horiz ? u * 2 : u, h = horiz ? u : u * 2;
      for (let y = y0 + 1; y < y0 + h; y++) for (let x = x0 + 1; x < x0 + w; x++) {
        let col = shade(c, 0.97 + (p.r() - 0.5) * 0.06);
        if (y === y0 + 1 || x === x0 + 1) col = shade(c, 1.07);
        p.set(x, y, col);
      }
    }
  }
  return p.done();
}
function modernTile(seed = 9) {
  const p = new Pix(128, 128, seed);
  const base = ['#b9b6ae', '#c2bfb7', '#b1aea6'];
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
    const c = base[Math.floor(p.r() * 3)];
    for (let y = ty * 32; y < ty * 32 + 32; y++) for (let x = tx * 32; x < tx * 32 + 32; x++) {
      let col = shade(c, 0.98 + (p.r() - 0.5) * 0.05);
      if (x % 32 === 0 || y % 32 === 0) col = '#8d8a83';
      p.set(x, y, col);
    }
  }
  return p.done();
}
function interiorTile(seed = 10) {
  // 金砖（宫殿室内方砖）
  const p = new Pix(128, 128, seed);
  const base = ['#3d3b3a', '#45423f', '#38363a'];
  for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
    const c = base[Math.floor(p.r() * 3)];
    for (let y = ty * 32; y < ty * 32 + 32; y++) for (let x = tx * 32; x < tx * 32 + 32; x++) {
      let col = shade(c, 1 + (p.r() - 0.5) * 0.08 + 0.12 * Math.max(0, 1 - Math.hypot(x % 32 - 10, y % 32 - 10) / 18));
      if (x % 32 === 0 || y % 32 === 0) col = '#242221';
      p.set(x, y, col);
    }
  }
  return p.done();
}

// ------------------------------------------------------------------ 墙体
function cityBrick(seed = 11, tone = 0) {
  // 明城墙大城砖：丁顺错缝，青灰斑驳，偶有铭文刻痕与苔痕
  const p = new Pix(64, 64, seed);
  const base = tone === 1 ? ['#8e8a80', '#9a968b', '#848077', '#a39f93'] : ['#7f8589', '#8a9094', '#757b7f', '#93989b', '#6f7478'];
  const mortar = tone === 1 ? '#b4ad9d' : '#a7a69c';
  p.fill(mortar);
  const bh = 8;
  for (let row = 0; row < 64 / bh; row++) {
    const bw = 16;
    const off = row % 2 ? 8 : 0;
    for (let x0 = -off; x0 < 64; x0 += bw) {
      const c = base[Math.floor(p.r() * base.length)];
      const f = 0.92 + p.r() * 0.14;
      for (let y = row * bh + 1; y < row * bh + bh; y++) for (let x = x0 + 1; x < x0 + bw; x++) {
        let col = shade(c, f + (p.r() - 0.5) * 0.07);
        if (y === row * bh + 1) col = shade(c, f * 1.1);
        if (y === row * bh + bh - 1 || x === x0 + bw - 1) col = shade(c, f * 0.85);
        p.set(x, y, col);
      }
      if (p.r() < 0.18) { // 铭文刻痕
        const tx = x0 + 4 + Math.floor(p.r() * 6), ty = row * bh + 3;
        for (let k = 0; k < 3; k++) { p.set(tx + k * 2, ty, shade(c, 0.7)); p.set(tx + k * 2, ty + 2, shade(c, 0.72)); }
      }
    }
  }
  return p.done();
}
function plasterWhite(seed = 12) {
  const p = new Pix(64, 64, seed);
  const n = p.valueNoise(16, seed);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = n(x, y);
    let c = mix('#efece4', '#d9d4c7', v * 0.8 + p.r() * 0.15);
    if (p.r() < 0.004) c = '#b9b3a4';
    p.set(x, y, c);
  }
  // 雨痕
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(p.r() * 64);
    const len = 8 + Math.floor(p.r() * 20);
    for (let y = 0; y < len; y++) p.set(x, y, mix(p.get(x, y), [170, 165, 150], 0.25 * (1 - y / len)));
  }
  return p.done();
}
function plasterRed(seed = 13) {
  const p = new Pix(64, 64, seed);
  const n = p.valueNoise(16, seed);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = n(x, y);
    p.set(x, y, mix('#a8392c', '#8d2d23', v * 0.8 + p.r() * 0.2));
  }
  return p.done();
}
function woodPlank(seed = 14, tone = 0) {
  const p = new Pix(64, 64, seed);
  const base = tone === 1 ? ['#5a3b28', '#634230', '#4f3423'] : tone === 2 ? ['#8b6a47', '#977553', '#7e5f3f'] : ['#74523a', '#7e5b41', '#6a4a33'];
  const pw = 8;
  for (let col = 0; col < 64 / pw; col++) {
    const c = base[Math.floor(p.r() * base.length)];
    for (let y = 0; y < 64; y++) for (let x = col * pw; x < col * pw + pw; x++) {
      let cc = shade(c, 0.95 + 0.1 * Math.sin(y * 0.4 + x * 0.9 + col * 3) * (p.r() * 0.6 + 0.4));
      if (x === col * pw) cc = shade(c, 0.6);
      else if (x === col * pw + 1) cc = shade(c, 1.12);
      p.set(x, y, cc);
    }
    if (p.r() < 0.5) { const ky = Math.floor(p.r() * 60); p.set(col * pw + 4, ky, shade(c, 0.55)); p.set(col * pw + 4, ky + 1, shade(c, 0.6)); }
  }
  return p.done();
}
function lacquerRed(seed = 15) {
  const p = new Pix(32, 32, seed);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const hl = x < 6 ? 1.15 : x > 26 ? 0.78 : 1;
    p.set(x, y, shade(mix('#b0362a', '#9c2e24', p.r() * 0.5), hl));
  }
  return p.done();
}
function lattice(seed = 16, style = 0) {
  // 格扇门窗：深色木框 + 窗纸，style 0 方格 1 冰裂 2 菱花
  const p = new Pix(32, 64, seed);
  p.fill('#e9dfc6');
  const wood = '#5a3a26', woodHi = '#7a5438';
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
    if (x < 2 || x > 29 || y < 2 || y > 61 || (y > 40 && y < 44)) p.set(x, y, x < 1 || y < 1 ? woodHi : wood);
  }
  // 裙板
  for (let y = 44; y < 62; y++) for (let x = 2; x < 30; x++) p.set(x, y, (x === 4 || x === 27 || y === 46 || y === 59) ? '#6d4a31' : '#80583a');
  // 窗棂
  for (let y = 2; y < 41; y++) for (let x = 2; x < 30; x++) {
    let on = false;
    if (style === 0) on = x % 6 === 4 || y % 6 === 4;
    else if (style === 1) on = ((x + y) % 7 === 0 && x % 3) || ((x - y + 64) % 9 === 0);
    else on = (x + y) % 8 === 0 || (x - y + 64) % 8 === 0;
    if (on) p.set(x, y, wood);
    else p.set(x, y, mix('#efe6cf', '#d9ccad', (y / 41) * 0.5));
  }
  return p.done();
}
function redDoor(seed = 17) {
  // 朱漆大门：门钉 + 铺首
  const p = new Pix(64, 96, seed);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 64; x++) {
    let c = mix('#a3322a', '#8a2a22', p.r() * 0.4);
    if (x === 31 || x === 32) c = '#5a1a14';
    if (x < 2 || x > 61 || y < 2) c = '#6e211a';
    p.set(x, y, c);
  }
  for (let r = 0; r < 7; r++) for (let k = 0; k < 3; k++) for (const side of [0, 1]) {
    const cx = (side ? 38 : 8) + k * 9, cy = 10 + r * 11;
    p.set(cx, cy, '#e8c36a'); p.set(cx + 1, cy, '#c9a14a'); p.set(cx, cy + 1, '#b08a3a'); p.set(cx + 1, cy + 1, '#8f6d2c');
  }
  for (const cx of [26, 37]) { // 铺首衔环
    for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; p.set(Math.round(cx + Math.cos(t) * 3), Math.round(52 + Math.sin(t) * 3), '#d4ae55'); }
  }
  return p.done();
}
function stoneBlock(seed = 18, tone = 0) {
  // 须弥座 / 台基条石
  const p = new Pix(64, 32, seed);
  const base = tone === 1 ? ['#c9c3b5', '#d3cdbf', '#bfb9ab'] : ['#a7a59e', '#b1afa7', '#9c9a93'];
  const bh = 16;
  for (let row = 0; row < 2; row++) {
    let x = row ? -12 : 0;
    while (x < 64) {
      const w = 20 + Math.floor(p.r() * 16);
      const c = base[Math.floor(p.r() * base.length)];
      for (let y = row * bh; y < row * bh + bh; y++) for (let xx = x; xx < x + w; xx++) {
        let col = shade(c, 0.97 + (p.r() - 0.5) * 0.06);
        if (y === row * bh || xx === x) col = shade(c, 0.68);
        else if (y === row * bh + 1) col = shade(c, 1.08);
        p.set(xx, y, col);
      }
      x += w;
    }
  }
  return p.done();
}
function porcelainWhite(seed = 19) {
  // 琉璃塔白瓷砖：釉面光泽
  const p = new Pix(32, 32, seed);
  p.fill('#b9bcb4');
  for (let by = 0; by < 32; by += 8) for (let bx = (by / 8) % 2 ? -8 : 0; bx < 32; bx += 16) {
    for (let y = by + 1; y < by + 8; y++) for (let x = bx + 1; x < bx + 16; x++) {
      let c = mix('#f3f2ea', '#e2e1d8', p.r() * 0.5);
      if (y === by + 1 && x < bx + 10) c = '#ffffff';
      if (y === by + 7) c = '#cfd0c7';
      p.set(x, y, c);
    }
  }
  return p.done();
}
function glazeTile(seed = 20, color = 'green') {
  const cols = { green: ['#2f8c6a', '#3fa07b', '#237257'], yellow: ['#d9a52a', '#e8bb45', '#b88a1d'], blue: ['#2f5f9c', '#4476b4', '#244a7a'], white: ['#ecebe2', '#fafaf4', '#d0cfc5'] }[color];
  const p = new Pix(32, 32, seed);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    let c = cols[0];
    if ((x + y) % 11 === 0 && y < 16) c = cols[1];
    if (x % 16 === 0 || y % 16 === 0) c = cols[2];
    if ((x % 16 === 2 || y % 16 === 2) && p.r() < 0.6) c = cols[1];
    p.set(x, y, c);
  }
  return p.done();
}

// ------------------------------------------------------------------ 屋瓦
function roofTiles(seed = 21, kind = 'grey') {
  // 筒瓦屋面：u 沿檐口方向，v 沿坡向下（纹理 v=0 在屋脊）
  const pal = {
    grey: { a: '#5c6166', b: '#6b7176', c: '#484c50', hi: '#80868b', end: '#3c4043' },
    dark: { a: '#44474b', b: '#505358', c: '#35383b', hi: '#62666b', end: '#2c2e31' },
    yellow: { a: '#d4a02a', b: '#e2b23e', c: '#a8791b', hi: '#f4d57c', end: '#8c6415' },
    green: { a: '#2e8466', b: '#3a9676', c: '#1f604a', hi: '#6fc4a0', end: '#184c3b' },
    blue: { a: '#2d5b93', b: '#3a6ba6', c: '#1f4169', hi: '#77a0d4', end: '#18325a' },
    thatch: { a: '#a88f5a', b: '#b69c65', c: '#8b7448', hi: '#cbb37d', end: '#6f5b37' },
  }[kind];
  const p = new Pix(32, 32, seed);
  if (kind === 'thatch') {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = Math.sin(x * 1.7 + y * 0.2) * 0.5 + p.r() * 0.6;
      p.set(x, y, v < 0.2 ? pal.c : v < 0.6 ? pal.a : v < 0.9 ? pal.b : pal.hi);
    }
    for (let x = 0; x < 32; x++) if (x % 3 === 0) p.set(x, 31, pal.end);
    return p.done();
  }
  const colW = 8; // 每 1/4 单位一垄
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const cx = x % colW;
    let c;
    if (cx === 0) c = pal.c; // 板瓦沟
    else if (cx === 1 || cx === 7) c = pal.a;
    else if (cx === 3 || cx === 4) c = pal.hi; // 筒瓦高光
    else c = pal.b;
    if (y % 8 === 0) c = shade(c, 0.86); // 瓦片搭接
    if (y % 8 === 1 && cx > 1 && cx < 7) c = shade(c, 1.06);
    if (p.r() < 0.04) c = shade(c, 0.9);
    p.set(x, y, c);
  }
  return p.done();
}

// ------------------------------------------------------------------ 其它
function sailCloth(seed = 22) {
  // 宝船硬帆：赭红帆布 + 竹制帆骨
  const p = new Pix(64, 64, seed);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    let c = mix('#a3432d', '#8e3726', p.r() * 0.35 + 0.2 * Math.sin(x * 0.2));
    if (y % 16 === 0 || y % 16 === 1) c = y % 16 === 0 ? '#c9a66b' : '#8a6a3c';
    if (x % 32 === 0) c = shade(c, 0.85);
    p.set(x, y, c);
  }
  return p.done();
}
function bookSpines(seed = 23) {
  // 书架上的线装书（平放书函）
  const p = new Pix(64, 64, seed);
  p.fill('#3a2718');
  const cols = ['#2b3f5c', '#3b5a4a', '#6b2a24', '#c9b27a', '#2f3b52', '#5a4632', '#e3d7b8'];
  for (let shelf = 0; shelf < 4; shelf++) {
    const y0 = shelf * 16 + 2;
    let x = 1;
    while (x < 62) {
      const w = 5 + Math.floor(p.r() * 8);
      const h = 9 + Math.floor(p.r() * 4);
      const c = cols[Math.floor(p.r() * cols.length)];
      for (let y = y0 + (13 - h); y < y0 + 13; y++) for (let xx = x; xx < Math.min(62, x + w); xx++) {
        let cc = c;
        if (y === y0 + (13 - h)) cc = shade(c, 1.2);
        if (xx === x) cc = shade(c, 0.7);
        if ((y - y0) % 3 === 0 && c === '#e3d7b8') cc = '#b9ab88';
        p.set(xx, y, cc);
      }
      if (p.r() < 0.5) for (let y = y0 + 13 - h + 2; y < y0 + 11; y++) p.set(x + Math.floor(w / 2), y, '#f0e6cc'); // 书签
      x += w + (p.r() < 0.2 ? 2 : 0);
    }
    for (let xx = 0; xx < 64; xx++) { p.set(xx, shelf * 16 + 15, '#6e4a2e'); p.set(xx, shelf * 16, '#2a1b10'); }
  }
  return p.done();
}
function paperTex(seed = 24) {
  const p = new Pix(32, 32, seed);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) p.set(x, y, mix('#f1e8d2', '#e2d6b8', p.r() * 0.5));
  return p.done();
}
function waterNoiseTex(seed = 25) {
  // 水面着色器用的可平铺噪声（R/G 两通道）
  const w = 128;
  const c = canvas(w, w);
  const g = c.getContext('2d');
  const img = g.createImageData(w, w);
  const r = rng(seed);
  const grid = 16;
  const pts = [];
  for (let i = 0; i < grid * grid; i++) pts.push([r(), r()]);
  const n1 = new Pix(w, w, seed).valueNoise(16, seed);
  const n2 = new Pix(w, w, seed + 1).valueNoise(8, seed + 7);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    img.data[i] = Math.floor(n1(x, y) * 255);
    img.data[i + 1] = Math.floor(n2(x, y) * 255);
    img.data[i + 2] = Math.floor(r() * 255);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function hedge(seed = 26) {
  const p = new Pix(32, 32, seed);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const v = p.r();
    p.set(x, y, v < 0.25 ? '#2f5a2c' : v < 0.6 ? '#3d6d36' : v < 0.9 ? '#4b7f40' : '#6a9a52');
  }
  return p.done();
}
function dougong(seed = 27) {
  // 斗拱 + 旋子彩画：青绿相间的斗、拱，下沿一条额枋
  const p = new Pix(64, 16, seed);
  p.fill('#2a3a44');
  for (let k = 0; k < 4; k++) {
    const x0 = k * 16;
    for (let y = 2; y < 12; y++) for (let x = x0 + 2; x < x0 + 14; x++) {
      let c = y < 5 ? '#3f7f78' : y < 8 ? '#2f5f8a' : '#3f7f78';
      if (y === 2 || x === x0 + 2) c = '#7fb8a8';
      if (y === 11 || x === x0 + 13) c = '#1d2d33';
      if (y >= 5 && y < 8 && (x < x0 + 5 || x > x0 + 10)) c = '#2a3a44';
      p.set(x, y, c);
    }
    p.set(x0 + 7, 6, '#e8c86a'); p.set(x0 + 8, 6, '#e8c86a');
  }
  for (let x = 0; x < 64; x++) { p.set(x, 12, '#b8402a'); p.set(x, 13, '#9a3222'); p.set(x, 14, '#2f5f8a'); p.set(x, 15, '#1d3d5a'); }
  return p.done();
}
function blank(color) {
  const p = new Pix(4, 4, 1);
  p.fill(color);
  return p.done();
}

// ------------------------------------------------------------------ 注册表
const makers = {
  grass: () => grass(1), grass_dry: () => grass(2, 2), grass_lush: () => grass(3, 1),
  dirt: () => dirt(2), dirt_red: () => dirt(3, 1), dirt_dark: () => dirt(4, 2),
  stone: () => stoneSlab(3), stone_warm: () => stoneSlab(4, 2), stone_grey: () => stoneSlab(5, 1),
  cobble: () => cobble(4), sand: () => sand(5), mud: () => mud(6),
  wood_floor: () => woodFloor(7), wood_floor_dark: () => woodFloor(8, 1),
  brick_pave: () => brickPave(8), brick_pave_warm: () => brickPave(9, 1),
  modern: () => modernTile(9), jinzhuan: () => interiorTile(10),
  citybrick: () => cityBrick(11), citybrick_warm: () => cityBrick(12, 1),
  plaster: () => plasterWhite(12), plaster_red: () => plasterRed(13),
  wood: () => woodPlank(14), wood_dark: () => woodPlank(15, 1), wood_light: () => woodPlank(16, 2),
  lacquer: () => lacquerRed(15), lattice: () => lattice(16, 0), lattice2: () => lattice(17, 2), lattice3: () => lattice(18, 1),
  red_door: () => redDoor(17), stone_block: () => stoneBlock(18), stone_block_light: () => stoneBlock(19, 1),
  porcelain: () => porcelainWhite(19),
  glaze_green: () => glazeTile(20, 'green'), glaze_yellow: () => glazeTile(21, 'yellow'), glaze_blue: () => glazeTile(22, 'blue'), glaze_white: () => glazeTile(23, 'white'),
  roof_grey: () => roofTiles(21, 'grey'), roof_dark: () => roofTiles(22, 'dark'), roof_yellow: () => roofTiles(23, 'yellow'),
  roof_green: () => roofTiles(24, 'green'), roof_blue: () => roofTiles(25, 'blue'), roof_thatch: () => roofTiles(26, 'thatch'),
  sail: () => sailCloth(22), books: () => bookSpines(23), paper: () => paperTex(24), hedge: () => hedge(26),
  water_noise: () => waterNoiseTex(25),
  dougong: () => dougong(27),
  white: () => blank('#ffffff'), black: () => blank('#101010'),
};

const texCache = new Map();
/** 取得（并缓存）一张像素纹理 */
export function tex(name) {
  if (texCache.has(name)) return texCache.get(name);
  const mk = makers[name];
  if (!mk) throw new Error('未知纹理 ' + name);
  const t = new THREE.CanvasTexture(mk());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = name === 'water_noise' ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
  t.colorSpace = name === 'water_noise' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  texCache.set(name, t);
  return t;
}
/** 纹理的世界尺寸（单位）：用于计算 UV 重复 */
export function texWorldSize(name) {
  const t = tex(name);
  return [t.image.width / PPU, t.image.height / PPU];
}
export const TEXTURE_NAMES = Object.keys(makers);
export { Pix, shade, mix, hex };
