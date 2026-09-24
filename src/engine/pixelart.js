// 像素画光栅器：自己做扫描线填充（无抗锯齿），按「区域」自动加高光/暗部与描边，
// 让程序生成的人物与康晔的像素形象在风格上接近。
export class PixelArt {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.col = new Uint32Array(w * h);     // 0 = 透明；否则 0xAABBGGRR
    this.reg = new Int16Array(w * h).fill(-1);
    this.flat = new Uint8Array(w * h);     // 1 = 不参与自动明暗（眼睛、描边等细节）
    this.nextReg = 0;
  }
  static rgb(hex) {
    if (typeof hex === 'number') return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }
  static scale(c, f) {
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return (255 << 24) | (cl(b * f) << 16) | (cl(g * f) << 8) | cl(r * f);
  }
  static mix(c1, c2, t) {
    const r = (c1 & 255) + ((c2 & 255) - (c1 & 255)) * t;
    const g = ((c1 >> 8) & 255) + (((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * t;
    const b = ((c1 >> 16) & 255) + (((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * t;
    return (255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r);
  }
  region() { return this.nextReg++; }
  px(x, y, color, reg = -1, flat = false) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.col[i] = PixelArt.rgb(color);
    this.reg[i] = reg;
    this.flat[i] = flat ? 1 : 0;
  }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.col[y * this.w + x]; }
  clear(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.col[i] = 0; this.reg[i] = -1; }
  /** 实心椭圆 */
  ellipse(cx, cy, rx, ry, color, reg = this.region(), flat = false) {
    const c = PixelArt.rgb(color);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const dx = Math.sqrt(1 - dy * dy) * rx;
      for (let x = Math.round(cx - dx); x < Math.round(cx + dx); x++) this.px(x, y, c, reg, flat);
    }
    return reg;
  }
  rect(x, y, w, h, color, reg = this.region(), flat = false) {
    const c = PixelArt.rgb(color);
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.px(xx, yy, c, reg, flat);
    return reg;
  }
  /** 多边形（扫描线，偶奇规则） */
  poly(pts, color, reg = this.region(), flat = false) {
    const c = PixelArt.rgb(color);
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c, reg, flat);
    }
    return reg;
  }
  /** 粗线（Bresenham + 笔宽） */
  line(x0, y0, x1, y1, color, w = 1, reg = -1, flat = true) {
    const c = PixelArt.rgb(color);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
      if (w <= 1) this.px(x, y, c, reg, flat);
      else for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) this.px(x + dx - (w >> 1), y + dy - (w >> 1), c, reg, flat);
    }
  }
  /** 按区域自动明暗：左上边缘提亮、右下边缘压暗，并按纵向做轻微渐变 */
  shade(light = 1.16, dark = 0.78, band = 1) {
    const { w, h } = this;
    const out = this.col.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!this.col[i] || this.flat[i]) continue;
      const r = this.reg[i];
      const same = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && this.reg[yy * w + xx] === r && this.col[yy * w + xx];
      let f = 1;
      let tl = false, br = false;
      for (let k = 1; k <= band; k++) {
        if (!same(x - k, y) || !same(x, y - k)) tl = true;
        if (!same(x + k, y) || !same(x, y + k)) br = true;
      }
      if (br && !tl) f = dark; else if (tl && !br) f = light; else if (tl && br) f = 0.95;
      else if (!same(x + band + 1, y + band + 1)) f = 0.9;
      out[i] = PixelArt.scale(this.col[i], f);
    }
    this.col = out;
  }
  /** 外描边：取相邻像素颜色的暗化版 */
  outline(f = 0.38, color = null) {
    const { w, h } = this;
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.col[i]) continue;
      let src = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = this.get(x + dx, y + dy);
        if (c && ((c >>> 24) & 255) === 255) { src = c; break; }
      }
      if (src) add.push([i, color != null ? PixelArt.rgb(color) : PixelArt.scale(src, f)]);
    }
    for (const [i, c] of add) { this.col[i] = c; this.reg[i] = -2; this.flat[i] = 1; }
  }
  /** 内部区域交界线：不同区域相邻处让下面/右边的像素略暗（勾出衣褶结构） */
  seams(f = 0.82) {
    const { w, h } = this;
    const out = this.col.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!this.col[i] || this.flat[i]) continue;
      const r = this.reg[i];
      const up = y > 0 ? this.reg[i - w] : r, left = x > 0 ? this.reg[i - 1] : r;
      if ((up !== r && up >= 0 && this.col[i - w]) || (left !== r && left >= 0 && this.col[i - 1])) out[i] = PixelArt.scale(this.col[i], f);
    }
    this.col = out;
  }
  toCanvas(canvas, ox = 0, oy = 0) {
    const c = canvas || document.createElement('canvas');
    if (!canvas) { c.width = this.w; c.height = this.h; }
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.col);
    if (canvas) {
      const tmp = document.createElement('canvas'); tmp.width = this.w; tmp.height = this.h;
      tmp.getContext('2d').putImageData(img, 0, 0);
      g.drawImage(tmp, ox, oy);
    } else g.putImageData(img, 0, 0);
    return c;
  }
  /** 把另一张 PixelArt 叠上来（透明像素跳过） */
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.col[y * src.w + x];
      if (!c) continue;
      const tx = x + ox, ty = y + oy;
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
      const i = ty * this.w + tx;
      this.col[i] = c; this.reg[i] = src.reg[y * src.w + x]; this.flat[i] = src.flat[y * src.w + x];
    }
  }
}
