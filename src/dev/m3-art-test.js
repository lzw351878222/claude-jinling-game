import { tileSprite, rubbleSprite, wormSprite, ropeSprite, inkSprite, lampSprite } from '../m3/art.js';
import { saveCanvas } from './shot.js';

(async () => {
  await document.fonts.load('40px JLBrush').catch(() => {});
  const S = 96, pad = 8;
  const C = [0, 1, 2, 3, 4, 5];
  const rows = [
    C.map((c) => tileSprite({ color: c, kind: 'normal' }, S)),
    C.map((c) => tileSprite({ color: c, kind: c % 2 ? 'lineV' : 'lineH' }, S)),
    C.map((c) => tileSprite({ color: c, kind: 'burst' }, S)),
    ['brick', 'book', 'silk', 'glaze', 'hehua'].map((it) => tileSprite({ kind: 'item', item: it }, S)).concat([tileSprite({ kind: 'seal' }, S)]),
    [rubbleSprite(1, S), rubbleSprite(2, S), rubbleSprite(3, S), wormSprite(0, S), ropeSprite(1, S), ropeSprite(2, S)],
    [inkSprite(1, S), inkSprite(2, S), lampSprite(false, S), lampSprite(true, S)],
  ];
  const out = document.createElement('canvas');
  out.width = 6 * (S + pad) + pad;
  out.height = rows.length * (S + pad) + pad;
  const g = out.getContext('2d');
  rows.forEach((row, r) => row.forEach((c, k) => {
    const x = pad + k * (S + pad), y = pad + r * (S + pad);
    g.fillStyle = (r + k) % 2 ? '#efe4c8' : '#e6d8b8';
    g.fillRect(x, y, S, S);
    g.drawImage(c, x, y);
  }));
  await saveCanvas(out, 'm3-art.png');
  document.title = 'saved';
})();
