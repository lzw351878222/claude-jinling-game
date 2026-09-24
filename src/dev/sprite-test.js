import { humanSheet, qilinSheet, giraffeSheet, silverfishSheet, bustCanvas } from '../engine/sprites.js';
import { ASSETS } from '../assets.js';
const looks = {
  zhou: { body: 'old', skin: 'tan', hair: 'grey', outfit: 'short', color: '#7a6048', color2: '#5a5048', hat: 'wangjin', beard: 'long', beardColor: '#cfcac2', eyes: 'narrow' },
  official: { body: 'man', outfit: 'official', color: '#3e5a7a', color2: '#27384d', belt: '#1c1c1c', patch: '#3a5f8a', hat: 'wusha', beard: 'mustache', eyes: 'stern' },
  zhu: { body: 'man', skin: 'medium', outfit: 'robe', color: '#6a5a44', color2: '#3a3026', hat: 'fangjin', beard: 'full', face: 'long' },
  emperor: { body: 'man', skin: 'medium', outfit: 'emperor', color: '#d8a531', color2: '#9a6f1a', belt: '#3a2a10', hat: 'yishan', beard: 'full', face: 'long' },
  empress: { body: 'woman', outfit: 'skirt', color: '#b8453a', color2: '#2f4a6a', hat: 'bun_royal' },
  xiejin: { body: 'man', outfit: 'official', color: '#3e5a7a', color2: '#27384d', patch: '#4a6a8a', hat: 'wusha', beard: 'long' },
  yao: { body: 'monk', skin: 'light', outfit: 'monk', color: '#2a2a2e', color2: '#1a1a1e', kasaya: '#6a3a2a', eyes: 'closed', beard: 'long', beardColor: '#e0ddd6', prop: 'beads' },
  zhenghe: { body: 'stout', skin: 'medium', outfit: 'official', color: '#a83a32', color2: '#6e231d', patch: '#c9a44a', hat: 'sanshan', eyes: 'stern' },
  sailor: { body: 'man', skin: 'dark', outfit: 'short', color: '#4a5a6a', color2: '#6a5a4a', hat: 'toujin', hatColor: '#8a3a2a', prop: 'compass' },
  hairui: { body: 'old', outfit: 'official', color: '#8a3a32', color2: '#5a2520', patch: '#b08a3a', hat: 'wusha', beard: 'long', beardColor: '#e8e5de', eyes: 'stern' },
  tang: { body: 'man', outfit: 'robe', color: '#5a7a9c', color2: '#1f2a36', hat: 'fangjin', beard: 'goatee', prop: 'fan' },
  girl: { body: 'girl', outfit: 'skirt', color: '#e39aa8', color2: '#6f9a7f', hat: 'twinbuns', prop: 'plum' },
  boy: { body: 'child', outfit: 'short', color: '#5a8a6a', color2: '#4a4a5a', hat: 'twinbuns', prop: 'horse' },
  guide: { body: 'woman', outfit: 'modern', color: '#c8453a', color2: '#2f3a52', hat: 'cap', hatColor: '#e8e8e8', prop: 'flag', shoes: '#f0f0f0' },
  tourist: { body: 'man', outfit: 'modern', color: '#e8e6e0', color2: '#3a4a6a', hat: 'short', prop: 'camera', shoes: '#333' },
  lady: { body: 'woman', outfit: 'skirt', color: '#a8c8a0', color2: '#5a6f9a', hat: 'bun', prop: 'lantern' },
  monk: { body: 'monk', outfit: 'monk', color: '#8a8478', color2: '#6a6458', kasaya: false, eyes: 'normal' },
  envoy: { body: 'man', skin: 'dark', outfit: 'envoy', color: '#efe8da', color2: '#b8a888', hat: 'turban', beard: 'full' },
  guard: { body: 'man', outfit: 'armor', color: '#8a2a22', color2: '#3a3a3a', hat: 'helmet', prop: 'sword', eyes: 'stern' },
  merchant: { body: 'stout', outfit: 'robe', color: '#6a4a7a', color2: '#3a2a4a', hat: 'guapi', beard: 'mustache', prop: 'book' },
};
document.body.style.cssText = 'background:#4a6a5a;overflow:auto;margin:0;padding:12px';
document.getElementById('app').style.position = 'static';
const wrap = document.getElementById('ui');
wrap.style.cssText = 'position:static;display:flex;flex-wrap:wrap;gap:10px;pointer-events:auto';
function show(c, label, scale = 2) {
  const d = document.createElement('div');
  d.style.cssText = 'background:#6a8a7a;padding:4px;color:#fff;font:12px sans-serif';
  const img = document.createElement('canvas');
  img.width = c.width * scale; img.height = c.height * scale;
  const g = img.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, img.width, img.height);
  d.appendChild(img); d.appendChild(document.createElement('br')); d.append(label);
  wrap.appendChild(d);
}
const kimg = new Image(); kimg.src = ASSETS.sheet;
kimg.onload = () => { const c = document.createElement('canvas'); c.width = 192; c.height = 264; c.getContext('2d').drawImage(kimg, 0, 0, 192, 264, 0, 0, 192, 264); show(c, '康晔(素材)'); 
  for (const [k, spec] of Object.entries(looks)) show(humanSheet(spec), k);
  show(qilinSheet(), '阿麟', 3); show(giraffeSheet(), '麒麟', 1); show(silverfishSheet(), '蠹', 3); show(silverfishSheet(true), '大蠹', 1);
  show(bustCanvas(humanSheet(looks.hairui), 3), '海瑞半身', 1);
};
import { saveAll } from './shot.js';
window.__save = () => saveAll('sprites.png');
setTimeout(() => window.__save(), 800);
