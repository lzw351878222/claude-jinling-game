// 金陵志图标：32×32 程序化像素小画
import { PixelArt } from '../engine/pixelart.js';
import { drawHuman } from '../engine/sprites.js';

const cache = new Map();
const INK = '#2a2420', RED = '#b23a2e', GOLD = '#d9a52a', JADE = '#3f8a70', GREY = '#8a9094', PAPER = '#efe4c8', BLUE = '#2f5f8a', WOOD = '#7a5236';

function roofArc(pa, x0, x1, y, h, col) {
  pa.poly([[x0 - 2, y], [x1 + 2, y], [x1 - 3, y - h], [x0 + 3, y - h]], col);
  pa.px(x0 - 3, y - 1, col); pa.px(x1 + 3, y - 1, col);
}

const DRAW = {
  gate: (p) => { p.rect(3, 14, 26, 14, GREY); p.ellipse(16, 22, 5, 5, INK); p.rect(11, 22, 10, 6, INK); for (let x = 3; x < 29; x += 4) p.rect(x, 11, 3, 3, GREY); roofArc(p, 9, 23, 10, 5, '#4a4f55'); p.rect(11, 10, 10, 1, RED); },
  wall: (p) => { p.rect(2, 12, 28, 16, GREY); for (let x = 2; x < 30; x += 5) p.rect(x, 8, 3, 4, GREY); for (let y = 14; y < 28; y += 4) for (let x = (y / 4) % 2 ? 2 : 4; x < 30; x += 6) p.rect(x, y, 5, 1, '#6a7074', -1, true); },
  brick: (p) => { p.poly([[4, 12], [24, 8], [29, 12], [9, 16]], '#9aa2a6'); p.poly([[4, 12], [9, 16], [9, 26], [4, 22]], '#6a7276'); p.poly([[9, 16], [29, 12], [29, 22], [9, 26]], '#7f878b'); for (let k = 0; k < 4; k++) p.line(13 + k * 4, 16 - k, 13 + k * 4, 21 - k, INK, 1); },
  person: (p) => { p.ellipse(16, 11, 6, 6, '#eecaa8'); p.ellipse(16, 8, 7, 4, INK); p.poly([[8, 29], [24, 29], [21, 17], [11, 17]], BLUE); },
  emperor: (p) => { p.ellipse(16, 13, 6, 6, '#e2b893'); p.ellipse(16, 8, 6, 3, INK); p.ellipse(11, 5, 2, 3, INK); p.ellipse(21, 5, 2, 3, INK); p.poly([[7, 30], [25, 30], [22, 19], [10, 19]], GOLD); p.ellipse(16, 24, 3, 3, '#b8861f'); p.poly([[13, 18], [19, 18], [18, 22], [14, 22]], INK); },
  empress: (p) => { p.ellipse(16, 13, 6, 6, '#f4d6ba'); p.ellipse(16, 7, 7, 4, INK); p.rect(9, 6, 14, 1, GOLD); p.px(16, 3, RED); p.poly([[7, 30], [25, 30], [22, 19], [10, 19]], RED); p.rect(10, 25, 12, 5, BLUE); },
  official: (p) => { p.ellipse(16, 13, 6, 6, '#eecaa8'); p.ellipse(16, 8, 7, 4, INK); p.rect(2, 8, 28, 2, INK); p.poly([[7, 30], [25, 30], [22, 19], [10, 19]], '#a83a32'); p.rect(13, 21, 6, 5, GOLD); },
  scholar: (p) => { p.ellipse(16, 13, 6, 6, '#eecaa8'); p.poly([[9, 10], [23, 10], [25, 2], [7, 2]], INK); p.poly([[7, 30], [25, 30], [22, 19], [10, 19]], '#5a7a9c'); p.line(16, 19, 12, 27, PAPER, 1); },
  monk: (p) => { p.ellipse(16, 12, 7, 7, '#eecaa8'); p.px(13, 9, '#fff'); p.poly([[7, 30], [25, 30], [22, 19], [10, 19]], '#2a2a2e'); p.poly([[21, 19], [24, 21], [10, 30], [8, 27]], '#8a3a2a'); for (let a = 0; a < 8; a++) p.px(12 + a, 21 + (a % 2), '#6a3a2a'); },
  general: (p) => { p.ellipse(16, 13, 6, 6, '#e2b893'); p.ellipse(16, 8, 8, 5, GREY); p.rect(15, 1, 2, 5, GREY); p.poly([[7, 30], [25, 30], [22, 19], [10, 19]], RED); for (let y = 20; y < 30; y += 2) p.line(10, y, 22, y, '#6a2a22', 1); },
  woman: (p) => { p.ellipse(16, 13, 6, 6, '#f4d6ba'); p.ellipse(16, 8, 7, 5, INK); p.ellipse(16, 3, 4, 3, INK); p.px(22, 5, RED); p.poly([[7, 30], [25, 30], [22, 19], [10, 19]], '#e39aa8'); },
  book: (p) => { p.rect(6, 6, 20, 22, BLUE); p.rect(8, 8, 16, 18, '#3a6a9a'); p.rect(20, 9, 3, 15, PAPER); for (let y = 8; y < 26; y += 4) p.px(7, y, PAPER); p.rect(26, 7, 2, 21, PAPER); },
  scroll: (p) => { p.rect(8, 6, 16, 20, PAPER); for (let y = 9; y < 24; y += 3) p.line(11, y, 21, y, '#8a7a5a', 1); p.rect(6, 4, 20, 3, WOOD); p.rect(6, 25, 20, 3, WOOD); },
  brush: (p) => { p.line(8, 26, 22, 6, WOOD, 2); p.poly([[20, 5], [26, 3], [24, 9]], INK); p.ellipse(9, 26, 3, 2, INK); },
  ship: (p) => { p.poly([[2, 20], [30, 18], [26, 26], [6, 26]], '#6a4a32'); p.rect(3, 20, 26, 1, RED); p.rect(15, 4, 2, 16, WOOD); p.poly([[10, 5], [22, 5], [21, 16], [11, 16]], '#a3432d'); for (let y = 7; y < 16; y += 3) p.line(11, y, 21, y, '#c9a66b', 1); },
  star: (p) => { const c = [16, 15]; for (let a = 0; a < 5; a++) { const t = a / 5 * Math.PI * 2 - Math.PI / 2; p.line(c[0], c[1], c[0] + Math.cos(t) * 11, c[1] + Math.sin(t) * 11, GOLD, 2); } p.ellipse(16, 15, 4, 4, '#fbe27a'); },
  compass: (p) => { p.ellipse(16, 16, 13, 13, '#8a5a32'); p.ellipse(16, 16, 10, 10, PAPER); for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; p.px(16 + Math.cos(t) * 9, 16 + Math.sin(t) * 9, INK); } p.line(16, 16, 16, 8, RED, 1); p.line(16, 16, 16, 24, INK, 1); },
  pagoda: (p) => { let w = 12, y = 29; for (let i = 0; i < 6; i++) { p.rect(16 - w / 2, y - 3, w, 3, '#f0efe6'); roofArc(p, 16 - w / 2 - 1, 16 + w / 2 + 1, y - 3, 1, JADE); y -= 4.4; w -= 1.6; } p.rect(15, 1, 2, 4, GOLD); },
  lamp: (p) => { p.rect(15, 2, 2, 6, INK); p.ellipse(16, 16, 8, 9, '#ffd27a'); p.ellipse(16, 16, 5, 6, '#fff3c0'); p.rect(11, 6, 10, 2, WOOD); p.rect(11, 24, 10, 2, WOOD); },
  lantern: (p) => { p.rect(15, 1, 2, 5, INK); p.ellipse(16, 16, 10, 9, '#e0463a'); for (let x = 9; x < 24; x += 4) p.line(x, 9, x, 23, '#b8302a', 1); p.rect(11, 6, 10, 3, GOLD); p.rect(11, 24, 10, 3, GOLD); p.rect(15, 27, 2, 4, '#e0b040'); },
  seal: (p) => { p.rect(5, 5, 22, 22, RED); p.rect(8, 8, 16, 16, '#d8574a'); p.rect(10, 10, 12, 12, RED); p.line(12, 13, 20, 13, PAPER, 1); p.line(16, 11, 16, 21, PAPER, 1); p.line(12, 19, 20, 19, PAPER, 1); },
  qilin: (p) => { p.ellipse(16, 20, 9, 6, '#b9bdb6'); p.ellipse(16, 11, 7, 6, '#b9bdb6'); p.ellipse(9, 9, 3, 3, JADE); p.ellipse(23, 9, 3, 3, JADE); p.ellipse(16, 5, 3, 2, JADE); p.rect(13, 10, 2, 3, INK); p.rect(18, 10, 2, 3, INK); p.px(13, 10, GOLD); p.px(18, 10, GOLD); p.poly([[15, 4], [17, 4], [16, 0]], '#e6dfc8'); for (const x of [10, 14, 18, 22]) p.rect(x, 25, 2, 4, '#9aa19a'); },
  bug: (p) => { for (let i = 0; i < 7; i++) p.ellipse(22 - i * 2.4, 16, 4.5 - i * 0.5, 3.6 - i * 0.4, i % 2 ? '#c9ced6' : '#aeb5bf'); p.line(24, 14, 30, 8, '#8a919b', 1); p.line(24, 18, 30, 24, '#8a919b', 1); for (const dy of [-4, 0, 4]) p.line(7, 16, 1, 16 + dy, '#8a919b', 1); },
  bridge: (p) => { p.rect(0, 22, 32, 8, '#4f8a86'); p.poly([[1, 22], [31, 22], [27, 12], [5, 12]], '#c9c3b5'); p.ellipse(16, 22, 6, 5, '#2f5a60'); for (let x = 6; x < 28; x += 4) p.rect(x, 9, 1, 3, '#a8a296'); },
  temple: (p) => { p.rect(8, 16, 16, 12, '#a8392c'); p.rect(12, 20, 8, 8, '#5a2a22'); roofArc(p, 6, 26, 16, 6, '#d4a02a'); p.rect(4, 28, 24, 2, '#c9c3b5'); },
  kiln: (p) => { p.ellipse(16, 22, 12, 11, '#9a7a62'); p.rect(4, 22, 24, 8, '#9a7a62'); p.ellipse(16, 26, 5, 4, '#ff7a2a'); p.ellipse(16, 27, 3, 2, '#ffd27a'); p.rect(21, 8, 4, 8, '#8a6a52'); p.ellipse(24, 5, 3, 2, '#9a948a'); p.ellipse(27, 2, 2, 1.5, '#b0aaa0'); },
  mortar: (p) => { p.ellipse(16, 20, 12, 7, '#6a5a4a'); p.ellipse(16, 18, 10, 5, '#efece2'); p.line(20, 4, 14, 18, WOOD, 2); p.px(11, 17, '#fff'); p.px(19, 19, '#e8e2d0'); },
  bowl: (p) => { p.poly([[4, 14], [28, 14], [24, 26], [8, 26]], GOLD); p.ellipse(16, 14, 12, 3, '#fbe27a'); for (const [x, c] of [[11, '#e8e2d0'], [16, '#d9a52a'], [21, '#c9d8e0']]) p.ellipse(x, 11, 3, 3, c); p.rect(10, 26, 12, 2, '#b8861f'); },
  giraffe: (p) => { p.rect(10, 20, 3, 10, '#e6b25c'); p.rect(20, 20, 3, 10, '#e6b25c'); p.ellipse(16, 20, 8, 5, '#e6b25c'); p.poly([[18, 18], [22, 17], [20, 4], [17, 5]], '#e6b25c'); p.ellipse(21, 4, 4, 3, '#e6b25c'); for (const [x, y] of [[13, 19], [18, 21], [19, 11], [19, 14]]) p.ellipse(x, y, 1.5, 1.5, '#9a5a2a'); p.px(22, 3, INK); },
  map: (p) => { p.rect(4, 6, 24, 20, PAPER); p.poly([[6, 20], [12, 12], [17, 16], [25, 9], [26, 22], [6, 24]], '#b8d0a8'); p.line(8, 10, 24, 20, RED, 1); p.rect(4, 5, 24, 2, WOOD); p.rect(4, 26, 24, 2, WOOD); },
  exam: (p) => { for (let i = 0; i < 4; i++) { p.rect(3 + i * 7, 12, 6, 16, '#8a8f93'); p.rect(4 + i * 7, 16, 4, 10, '#3a3530'); } roofArc(p, 3, 29, 12, 3, '#5c6166'); p.rect(12, 4, 8, 6, RED); p.px(16, 7, PAPER); },
  flower: (p) => { p.line(16, 30, 16, 14, '#4f7f34', 1); for (let a = 0; a < 5; a++) { const t = a / 5 * Math.PI * 2; p.ellipse(16 + Math.cos(t) * 5, 11 + Math.sin(t) * 5, 3.5, 3.5, '#f4b8c6'); } p.ellipse(16, 11, 2.5, 2.5, '#f2d35b'); },
  moon: (p) => { p.ellipse(16, 13, 10, 10, '#f5ecc8'); p.ellipse(20, 10, 3, 2, '#e2d6a8'); p.rect(2, 24, 28, 6, '#2f5a70'); p.rect(10, 25, 12, 1, '#f5ecc8'); p.rect(12, 27, 8, 1, '#e2d6a8'); },
  tomb: (p) => { p.rect(4, 22, 24, 7, '#8a8f84'); p.ellipse(16, 22, 11, 7, '#6a7a5a'); p.rect(13, 12, 6, 10, '#9a9c98'); p.rect(12, 11, 8, 2, '#8a8c88'); },
};

export function iconCanvas(name, size = 32) {
  const key = name + size;
  if (cache.has(key)) return cache.get(key);
  const pa = new PixelArt(32, 32);
  (DRAW[name] || DRAW.scroll)(pa);
  pa.shade(1.12, 0.84, 1);
  pa.outline(0.4);
  const c = pa.toCanvas();
  cache.set(key, c);
  return c;
}
/** 画到给定画布上（放大、像素风） */
export function paintIcon(target, name) {
  const src = iconCanvas(name);
  const g = target.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, target.width, target.height);
  g.drawImage(src, 0, 0, target.width, target.height);
}
export const ICON_NAMES = Object.keys(DRAW);
void drawHuman;
