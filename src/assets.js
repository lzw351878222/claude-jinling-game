// 康晔的人物素材（由 tools/process_assets.py 从「人物素材」生成，构建时以 data URL 内联）
import title from './assets/title.jpg';
import pFront from './assets/portrait_front.jpg';
import p34 from './assets/portrait_34.jpg';
import pSide from './assets/portrait_side.jpg';
import pSmile from './assets/portrait_smile.jpg';
import pSerious from './assets/portrait_serious.jpg';
import pBack from './assets/portrait_back.jpg';
import bodyFront from './assets/body_front.jpg';
import bodyBack from './assets/body_back.jpg';
import outfit from './assets/outfit_front.jpg';
import sheet from './assets/kangye_sheet.png';

export const ASSETS = {
  title,
  portrait: { front: pFront, q34: p34, side: pSide, smile: pSmile, serious: pSerious, back: pBack },
  bodyFront,
  bodyBack,
  outfit,
  // 像素精灵表：每帧 64x132，3 列（站立、左步、右步）x 4 行（正面、背面、霓裳正面、霓裳背面）
  sheet,
  sheetFrame: { w: 64, h: 132, cols: 3, rows: 4 },
};

const cache = new Map();
/** 预加载图片，返回 HTMLImageElement */
export function loadImage(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
  cache.set(url, p);
  return p;
}
