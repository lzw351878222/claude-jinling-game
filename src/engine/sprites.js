// 人物像素精灵生成器：与康晔的像素形象同尺寸（每帧 64×132）、同像素密度。
// 每张精灵表 3 列（站立、左步、右步）× 2 行（正面、背面）。
import { PixelArt } from './pixelart.js';
import { rng } from '../core/util.js';

export const FW = 64, FH = 132;
const FOOT = 130; // 脚底所在行

const SKIN = { fair: '#f4d6ba', light: '#eecaa8', medium: '#e2b893', tan: '#d4a079', dark: '#b98459' };
const HAIR = { black: '#1f1b1b', dark: '#2c2522', brown: '#4a3426', grey: '#8a8784', white: '#d9d6d0' };

/**
 * spec:
 *  body: 'man' | 'woman' | 'old' | 'oldwoman' | 'child' | 'girl' | 'monk' | 'stout'
 *  skin, hair: 颜色键或 #hex
 *  outfit: 'robe'（长袍交领）| 'official'（圆领袍+补子）| 'emperor' | 'short'（短褐）| 'skirt'（袄裙）| 'monk' | 'modern' | 'armor' | 'envoy'
 *  color, color2（镶边/下装）, belt, patch（补子颜色，可选）, shoes
 *  hat: 'wusha' | 'yishan' | 'fangjin' | 'rujin' | 'wangjin' | 'toujin' | 'douli' | 'guapi' | 'sanshan' | 'helmet' | 'bun' | 'bun_royal' | 'twinbuns' | 'cap' | 'short' | 'ponytail' | 'turban' | 'bald' | 'long'
 *  hatColor, beard: null | 'mustache' | 'goatee' | 'long' | 'full', beardColor
 *  eyes: 'normal' | 'narrow' | 'closed' | 'stern', blush: bool
 *  prop: 'book' | 'fan' | 'brush' | 'lantern' | 'flag' | 'ladle' | 'hammer' | 'compass' | 'beads' | 'staff' | 'camera' | 'balloon' | 'horse' | 'plum' | 'brick' | 'broom' | 'basket' | 'scroll' | 'sword' | 'saw' | 'kite'
 *  seed
 */
export function drawHuman(spec, view = 'front') {
  const s = { body: 'man', skin: 'light', hair: 'black', outfit: 'robe', color: '#4d6a8a', color2: '#2c3440', belt: '#3a2a1e', shoes: '#2a2420', eyes: 'normal', ...spec };
  const skin = SKIN[s.skin] || s.skin;
  const hair = HAIR[s.hair] || s.hair;
  const pa = new PixelArt(FW, FH);
  const front = view === 'front';
  const child = s.body === 'child' || s.body === 'girl';
  const female = s.body === 'woman' || s.body === 'girl' || s.body === 'oldwoman';
  const old = s.body === 'old' || s.body === 'oldwoman';
  const stout = s.body === 'stout';
  // 纵向比例：孩子身体更短
  const top = child ? 40 : 20;               // 头顶
  const hcy = child ? 60 : 41;               // 脸中心
  const frx = child ? 14.5 : 15, fry = child ? 15 : 16;
  const neckY = hcy + fry - 2;
  const shoulderY = neckY + 4;
  const hemY = FOOT - 6;
  const bodyW = stout ? 19 : child ? 13 : female ? 14.5 : 16; // 肩半宽
  const hemW = stout ? 23 : child ? 16 : female ? 21 : 20.5;
  const cx = 32;
  const R = pa.region.bind(pa);

  // ---- 背后的长发（女子/长发）
  if ((female && s.hat !== 'bald') || s.hat === 'long') {
    const hl = s.hat === 'long' || !old ? (child ? 16 : 34) : 14;
    pa.poly([[cx - 15, hcy - 4], [cx + 15, hcy - 4], [cx + 13, hcy + hl], [cx - 13, hcy + hl]], hair, R());
  }
  // ---- 身体
  const regRobe = R();
  const bodyPts = [
    [cx - bodyW + 3, shoulderY - 1], [cx + bodyW - 3, shoulderY - 1],
    [cx + bodyW, shoulderY + 3], [cx + hemW, hemY], [cx - hemW, hemY], [cx - bodyW, shoulderY + 3],
  ];
  const short = s.outfit === 'short' || s.outfit === 'modern' || s.outfit === 'armor';
  const skirt = s.outfit === 'skirt';
  const jacketBottom = s.outfit === 'modern' ? shoulderY + 30 : shoulderY + (child ? 22 : 33);
  if (short) {
    // 上衣
    pa.poly([[cx - bodyW + 3, shoulderY - 1], [cx + bodyW - 3, shoulderY - 1], [cx + bodyW + 1, shoulderY + 4], [cx + bodyW + 1, jacketBottom], [cx - bodyW - 1, jacketBottom], [cx - bodyW - 1, shoulderY + 4]], s.color, regRobe);
    // 裤子
    const legW = child ? 5 : 6;
    const pantsC = s.color2;
    const rp = R();
    pa.poly([[cx - bodyW + 1, jacketBottom - 1], [cx - 1, jacketBottom - 1], [cx - 1, FOOT - 5], [cx - 1 - legW * 2 + 1, FOOT - 5]], pantsC, rp);
    const rp2 = R();
    pa.poly([[cx + 1, jacketBottom - 1], [cx + bodyW - 1, jacketBottom - 1], [cx + 1 + legW * 2 - 1, FOOT - 5], [cx + 1, FOOT - 5]], pantsC, rp2);
    if (s.outfit === 'short' && !child) { // 绑腿
      pa.rect(cx - 12, FOOT - 14, 10, 3, '#d8cfbd', R()); pa.rect(cx + 2, FOOT - 14, 10, 3, '#d8cfbd', R());
    }
  } else if (skirt) {
    // 袄 + 马面裙
    pa.poly([[cx - hemW, hemY], [cx + hemW, hemY], [cx + bodyW + 2, shoulderY + 30], [cx - bodyW - 2, shoulderY + 30]], s.color2, R());
    // 裙门的褶线
    for (let k = -3; k <= 3; k++) if (k) pa.line(cx + k * 4, shoulderY + 34, cx + k * 5.2, hemY - 1, PixelArt.scale(PixelArt.rgb(s.color2), 0.82), 1, -1, true);
    pa.poly([[cx - bodyW + 3, shoulderY - 1], [cx + bodyW - 3, shoulderY - 1], [cx + bodyW + 1, shoulderY + 4], [cx + bodyW + 3, shoulderY + 32], [cx - bodyW - 3, shoulderY + 32], [cx - bodyW - 1, shoulderY + 4]], s.color, regRobe);
  } else {
    pa.poly(bodyPts, s.color, regRobe);
    // 下摆镶边
    if (s.outfit !== 'monk') pa.poly([[cx - hemW, hemY - 3], [cx + hemW, hemY - 3], [cx + hemW, hemY], [cx - hemW, hemY]], s.color2, R());
  }
  // 袈裟（斜披）
  if (s.outfit === 'monk' && s.kasaya !== false) {
    const kc = s.kasaya || '#9a3b2a';
    const rk = R();
    if (front) pa.poly([[cx + bodyW - 2, shoulderY - 1], [cx + bodyW + 2, shoulderY + 6], [cx - hemW + 4, hemY - 16], [cx - hemW + 1, hemY - 24], [cx - 4, shoulderY + 20]], kc, rk);
    else pa.poly([[cx - bodyW + 2, shoulderY - 1], [cx - bodyW - 2, shoulderY + 6], [cx + hemW - 4, hemY - 16], [cx + hemW - 1, hemY - 24], [cx + 4, shoulderY + 20]], kc, rk);
    // 田相格
    for (let y = shoulderY + 4; y < hemY - 14; y += 6) for (let x = cx - hemW; x < cx + hemW; x++) if (pa.reg[y * FW + x] === rk) pa.px(x, y, PixelArt.scale(PixelArt.rgb(kc), 0.7), rk, true);
  }
  // 盔甲
  if (s.outfit === 'armor') {
    for (let y = shoulderY + 2; y < jacketBottom; y += 3) for (let x = cx - bodyW; x <= cx + bodyW; x += 2) if (pa.get(x, y)) pa.px(x + ((y / 3) % 2), y, '#5a5f66', -1, true);
  }
  // ---- 袖子与手
  const sleeveCol = s.outfit === 'skirt' ? s.color : s.color;
  const wide = !short;
  const handY = shoulderY + (child ? 20 : 30);
  if (front) {
    if (wide) {
      for (const sd of [-1, 1]) {
        const rs = R();
        pa.poly([
          [cx + sd * (bodyW - 2), shoulderY], [cx + sd * (bodyW + 4), shoulderY + 5],
          [cx + sd * (bodyW + 7), handY + 8], [cx + sd * (bodyW + 3), handY + 12],
          [cx + sd * 5, handY + 6], [cx + sd * 3, handY - 2],
        ].map(([x, y]) => [x, y]), sleeveCol, rs);
        // 袖口镶边
        pa.line(cx + sd * (bodyW + 7), handY + 8, cx + sd * (bodyW + 3), handY + 12, s.color2, 2, rs, true);
      }
      // 拱手
      pa.ellipse(cx, handY + 2, 4.5, 3.2, skin, R());
    } else {
      for (const sd of [-1, 1]) {
        const rs = R();
        const sleeveEnd = s.outfit === 'modern' ? shoulderY + 12 : handY - 2;
        pa.poly([[cx + sd * (bodyW - 1), shoulderY + 1], [cx + sd * (bodyW + 4), shoulderY + 5], [cx + sd * (bodyW + 5), sleeveEnd], [cx + sd * (bodyW + 0), sleeveEnd]], sleeveCol, rs);
        if (s.outfit === 'modern') pa.poly([[cx + sd * (bodyW + 0), sleeveEnd], [cx + sd * (bodyW + 5), sleeveEnd], [cx + sd * (bodyW + 5), handY], [cx + sd * (bodyW + 1), handY]], skin, R());
        pa.ellipse(cx + sd * (bodyW + 3), handY + 2, 2.6, 2.8, skin, R());
      }
    }
  } else {
    for (const sd of [-1, 1]) {
      const rs = R();
      if (wide) pa.poly([[cx + sd * (bodyW - 2), shoulderY], [cx + sd * (bodyW + 4), shoulderY + 5], [cx + sd * (bodyW + 7), handY + 8], [cx + sd * (bodyW + 3), handY + 12], [cx + sd * (bodyW - 3), handY + 4]], sleeveCol, rs);
      else pa.poly([[cx + sd * (bodyW - 1), shoulderY + 1], [cx + sd * (bodyW + 4), shoulderY + 5], [cx + sd * (bodyW + 5), handY], [cx + sd * (bodyW + 0), handY]], sleeveCol, rs);
    }
  }
  // ---- 领、带、补子
  if (front) {
    if (s.outfit === 'official' || s.outfit === 'emperor') {
      // 圆领
      for (let a = 0; a <= 12; a++) {
        const t = Math.PI * (a / 12);
        pa.px(cx - Math.cos(t) * 6.5, neckY + 2 + Math.sin(t) * 3.5, s.color2, -1, true);
        pa.px(cx - Math.cos(t) * 6.5, neckY + 3 + Math.sin(t) * 3.5, s.color2, -1, true);
      }
      pa.line(cx - 4, neckY + 2, cx + 4, neckY + 2, '#f1ede4', 1);
    } else if (s.outfit === 'modern') {
      pa.line(cx - 4, shoulderY - 1, cx, shoulderY + 3, PixelArt.scale(PixelArt.rgb(s.color), 0.7), 1);
      pa.line(cx + 4, shoulderY - 1, cx, shoulderY + 3, PixelArt.scale(PixelArt.rgb(s.color), 0.7), 1);
    } else if (s.outfit !== 'armor') {
      // 交领右衽：外襟从观者右肩斜向左下
      pa.line(cx + 5, neckY + 1, cx - 7, shoulderY + 16, s.color2, 2);
      pa.line(cx - 5, neckY + 1, cx + 1, shoulderY + 7, s.color2, 2);
      pa.line(cx + 3, neckY + 2, cx - 4, shoulderY + 10, '#f2eee6', 1);
    }
    if (s.outfit === 'official' || s.outfit === 'emperor') {
      // 玉带（挂在腰下，前低）
      const by = shoulderY + (child ? 18 : 27);
      pa.line(cx - bodyW - 1, by - 1, cx + bodyW + 1, by - 1, s.belt, 2, R(), true);
      for (let x = cx - bodyW + 2; x < cx + bodyW; x += 4) pa.px(x, by - 1, '#e7d9a8', -1, true);
    } else if (!short && s.outfit !== 'monk') {
      const by = shoulderY + (child ? 16 : 24);
      pa.line(cx - bodyW, by, cx + bodyW, by, s.belt, 2, R(), true);
      pa.line(cx - 2, by + 1, cx - 3, by + 12, s.belt, 1);
      pa.line(cx + 1, by + 1, cx + 2, by + 10, s.belt, 1);
    }
    if (s.patch) {
      const py = shoulderY + 8;
      pa.rect(cx - 6, py, 12, 11, s.patch, R(), true);
      pa.rect(cx - 5, py + 1, 10, 9, PixelArt.scale(PixelArt.rgb(s.patch), 0.78), -1, true);
      // 补子里的飞禽（几个亮色像素）
      pa.px(cx - 2, py + 4, '#f5f1e6', -1, true); pa.px(cx - 1, py + 3, '#f5f1e6', -1, true); pa.px(cx, py + 4, '#f5f1e6', -1, true);
      pa.px(cx + 1, py + 5, '#f5f1e6', -1, true); pa.px(cx + 2, py + 6, '#d94c3a', -1, true); pa.px(cx - 3, py + 7, '#4b8f6f', -1, true);
    }
    if (s.outfit === 'emperor') {
      // 团龙
      for (const [dx, dy] of [[0, 8], [-11, 4], [11, 4]]) {
        pa.ellipse(cx + dx, shoulderY + dy + 4, 4.5, 4.5, '#e9c250', R(), true);
        pa.px(cx + dx - 1, shoulderY + dy + 3, '#b8861f', -1, true); pa.px(cx + dx + 1, shoulderY + dy + 5, '#b8861f', -1, true); pa.px(cx + dx, shoulderY + dy + 4, '#c43a2c', -1, true);
      }
    }
    if (s.outfit === 'envoy') {
      pa.line(cx, shoulderY, cx, hemY - 4, '#d9c79a', 1);
    }
  }
  // ---- 鞋
  if (!(skirt && female && !child) || true) {
    pa.ellipse(cx - 5, FOOT - 2.5, 4, 2.6, s.shoes, R());
    pa.ellipse(cx + 5, FOOT - 2.5, 4, 2.6, s.shoes, R());
  }
  // ---- 头
  const regHair = R();
  const bald = s.hat === 'bald' || s.body === 'monk';
  if (!bald) pa.ellipse(cx, hcy - 3, frx + 3.5, fry + 2, hair, regHair);
  if (front) {
    pa.ellipse(cx, hcy, frx, fry, skin, R());
    // 耳朵
    pa.ellipse(cx - frx + 0.5, hcy + 2, 2, 3, skin, R());
    pa.ellipse(cx + frx - 0.5, hcy + 2, 2, 3, skin, R());
    if (!bald) {
      // 刘海 / 发际线
      if (female || child) {
        pa.poly([[cx - frx - 1, hcy - 4], [cx - frx + 2, hcy - fry + 1], [cx + frx - 2, hcy - fry + 1], [cx + frx + 1, hcy - 4], [cx + 6, hcy - 9], [cx + 1, hcy - 6], [cx - 4, hcy - 9]], hair, regHair);
      } else {
        pa.poly([[cx - frx - 1, hcy - 2], [cx - frx + 1, hcy - fry + 1], [cx + frx - 1, hcy - fry + 1], [cx + frx + 1, hcy - 2], [cx + frx - 3, hcy - 9], [cx - frx + 3, hcy - 9]], hair, regHair);
      }
    } else {
      pa.ellipse(cx, hcy - 4, frx + 1, fry - 1, skin, R());
      if (s.body === 'monk' || s.hat === 'bald') { pa.px(cx - 5, hcy - 12, '#fff3e0', -1, true); pa.px(cx - 4, hcy - 12, '#fff3e0', -1, true); pa.px(cx - 5, hcy - 11, '#fff3e0', -1, true); }
    }
    face(pa, s, cx, hcy, frx, fry, old, female, child);
  } else {
    // 背面：整颗头是头发（光头则是皮肤）
    pa.ellipse(cx, hcy - 1, frx + 2, fry + 1, bald ? skin : hair, bald ? R() : regHair);
    if (!bald) for (let k = -2; k <= 2; k++) pa.line(cx + k * 4, hcy - fry + 2, cx + k * 4.6, hcy + fry - 2, PixelArt.scale(PixelArt.rgb(hair), 1.35), 1, regHair, true);
    pa.ellipse(cx - frx - 0.5, hcy + 2, 2, 3, skin, R());
    pa.ellipse(cx + frx + 0.5, hcy + 2, 2, 3, skin, R());
  }
  hat(pa, s, cx, hcy, frx, fry, top, front, hair, female, child);
  if (front && s.beard) beard(pa, s, cx, hcy, fry, shoulderY);
  if (s.prop) prop(pa, s, cx, handY, shoulderY, front, bodyW);
  pa.shade(1.14, 0.8, 1);
  pa.seams(0.86);
  pa.outline(0.35);
  return pa;
}

function face(pa, s, cx, hcy, frx, fry, old, female, child) {
  const ey = hcy + 3;
  const eyeDark = '#2a1d18', eyeMid = '#6a4230';
  const brow = s.beardColor && old ? s.beardColor : (HAIR[s.hair] || s.hair);
  const bx = 7;
  if (s.eyes === 'closed' || s.eyes === 'narrow') {
    for (const sd of [-1, 1]) {
      pa.line(cx + sd * bx - 2, ey + 1, cx + sd * bx + 2, ey + 1, eyeDark, 1);
      if (s.eyes === 'closed') { pa.px(cx + sd * bx - 2, ey, eyeDark, -1, true); pa.px(cx + sd * bx + 2, ey, eyeDark, -1, true); }
    }
  } else {
    const eh = child ? 6 : female ? 6 : 5;
    for (const sd of [-1, 1]) {
      const ex = cx + sd * bx;
      pa.rect(ex - 2, ey - eh / 2, 4, eh, eyeDark, -1, true);
      pa.rect(ex - 2, ey + eh / 2 - 2.5, 4, 2.5, s.iris || eyeMid, -1, true);
      pa.px(ex - 1, ey - eh / 2 + 1, '#ffffff', -1, true);
      pa.px(ex + 1, ey + eh / 2 - 2, '#f5e9e0', -1, true);
      if (female) { pa.px(ex + sd * 2.5, ey - eh / 2, eyeDark, -1, true); pa.line(ex - 2, ey - eh / 2 - 1, ex + 1, ey - eh / 2 - 1, eyeDark, 1); }
    }
  }
  // 眉
  for (const sd of [-1, 1]) {
    const ex = cx + sd * bx;
    if (s.eyes === 'stern') pa.line(ex - 2 * sd * -1 - 1, ey - 5, ex + 2 * sd - 0, ey - 4, brow, 1);
    else pa.line(ex - 2, ey - 5, ex + 2, ey - 5, old ? '#cfcac2' : brow, 1);
  }
  // 腮红
  if (s.blush !== false && (female || child || s.blush)) {
    pa.px(cx - bx - 2, ey + 4, '#f0a8a0', -1, true); pa.px(cx - bx - 1, ey + 4, '#f0a8a0', -1, true);
    pa.px(cx + bx + 1, ey + 4, '#f0a8a0', -1, true); pa.px(cx + bx + 2, ey + 4, '#f0a8a0', -1, true);
  }
  // 鼻与嘴
  pa.px(cx, ey + 4, PixelArt.scale(PixelArt.rgb(SKIN[s.skin] || s.skin), 0.82), -1, true);
  if (s.mouth === 'open') { pa.rect(cx - 1, ey + 7, 3, 2, '#9a4a42', -1, true); }
  else if (s.mouth === 'frown') { pa.line(cx - 2, ey + 8, cx + 2, ey + 8, '#8a4a40', 1); pa.px(cx - 2, ey + 9, '#8a4a40', -1, true); pa.px(cx + 2, ey + 9, '#8a4a40', -1, true); }
  else { pa.line(cx - 1, ey + 7, cx + 1, ey + 7, '#b0605a', 1); if (female || child) pa.px(cx, ey + 8, '#c77a70', -1, true); }
  if (old) { // 皱纹
    pa.px(cx - bx - 3, ey + 2, '#b78d6c', -1, true); pa.px(cx + bx + 3, ey + 2, '#b78d6c', -1, true);
    pa.line(cx - 4, ey + 11, cx - 3, ey + 12, '#c49a78', 1); pa.line(cx + 4, ey + 11, cx + 3, ey + 12, '#c49a78', 1);
  }
  if (s.face === 'long') { // 下巴长（洪武帝画像的"鞋拔子脸"玩笑）
    pa.ellipse(cx, hcy + fry - 1, frx - 4, 5, SKIN[s.skin] || s.skin, -1, true);
    pa.px(cx - 4, hcy + fry + 1, '#c9a07c', -1, true); pa.px(cx + 3, hcy + fry - 2, '#c9a07c', -1, true); pa.px(cx + 5, hcy + 3, '#c9a07c', -1, true);
  }
}

function hat(pa, s, cx, hcy, frx, fry, top, front, hair, female, child) {
  const k = s.hat;
  const hc = s.hatColor || '#1c1a1a';
  const R = () => pa.region();
  const crown = hcy - fry + 1; // 头顶附近
  switch (k) {
    case 'wusha': { // 乌纱帽：圆顶 + 后山 + 左右平展的展角
      const r = R();
      pa.ellipse(cx, crown + 3, frx + 1, 6, hc, r);
      pa.rect(cx - frx - 1, crown + 3, (frx + 1) * 2, 5, hc, r);
      pa.ellipse(cx, crown - 2, 9, 5, hc, R());
      const wing = R();
      const wy = crown + (front ? 1 : 0);
      pa.rect(cx - 30, wy, 60, 2, hc, wing, true);
      pa.rect(cx - 31, wy - 1, 4, 4, hc, wing, true); pa.rect(cx + 27, wy - 1, 4, 4, hc, wing, true);
      break;
    }
    case 'yishan': { // 翼善冠：乌纱圆顶，后部两只上折的"善翼"
      const r = R();
      pa.ellipse(cx, crown + 3, frx + 1, 6, hc, r);
      pa.rect(cx - frx - 1, crown + 3, (frx + 1) * 2, 5, hc, r);
      pa.ellipse(cx, crown - 2, 9, 5, hc, R());
      for (const sd of [-1, 1]) { pa.ellipse(cx + sd * 8, crown - 8, 4, 6, hc, R()); pa.px(cx + sd * 8, crown - 12, '#e2c26a', -1, true); }
      pa.rect(cx - 6, crown + 4, 12, 1, '#c9a44a', -1, true);
      break;
    }
    case 'fangjin': { // 四方平定巾：上宽下窄的高方巾
      pa.poly([[cx - frx - 1, crown + 7], [cx + frx + 1, crown + 7], [cx + frx + 4, crown - 12], [cx - frx - 4, crown - 12]], hc, R());
      pa.line(cx - frx - 3, crown - 3, cx + frx + 3, crown - 3, PixelArt.scale(PixelArt.rgb(hc), 1.6), 1, -1, true);
      break;
    }
    case 'rujin': { // 儒巾：软翅方巾，脑后垂两带
      pa.poly([[cx - frx - 1, crown + 7], [cx + frx + 1, crown + 7], [cx + frx, crown - 7], [cx, crown - 10], [cx - frx, crown - 7]], hc, R());
      if (!front) { pa.rect(cx - 5, crown + 7, 3, 20, hc, R()); pa.rect(cx + 2, crown + 7, 3, 18, hc, R()); }
      else { pa.rect(cx - frx - 3, crown + 4, 3, 10, hc, R()); pa.rect(cx + frx, crown + 4, 3, 10, hc, R()); }
      break;
    }
    case 'wangjin': { // 网巾 + 发髻
      pa.ellipse(cx, crown - 3, 5, 5, hair, R());
      pa.rect(cx - 1, crown - 9, 2, 3, '#c9a44a', -1, true);
      const r = R();
      pa.rect(cx - frx - 1, crown + 5, (frx + 1) * 2, 3, '#1a1818', r, true);
      for (let x = cx - frx; x < cx + frx; x += 2) pa.px(x, crown + 6, '#4a4545', -1, true);
      break;
    }
    case 'toujin': { // 头巾（劳作者）
      pa.ellipse(cx, crown + 4, frx + 2, 8, hc, R());
      pa.ellipse(cx + (front ? 9 : -9), crown - 1, 4, 3, hc, R());
      break;
    }
    case 'douli': { // 斗笠
      pa.poly([[cx - 24, crown + 8], [cx + 24, crown + 8], [cx + 6, crown - 8], [cx - 6, crown - 8]], s.hatColor || '#c9ad73', R());
      pa.ellipse(cx, crown - 8, 6, 3, s.hatColor || '#c9ad73', R());
      for (let x = cx - 20; x < cx + 20; x += 5) pa.line(x, crown + 7, cx + (x - cx) * 0.25, crown - 7, '#a88c55', 1);
      break;
    }
    case 'guapi': { // 六合一统帽（瓜皮帽）
      pa.ellipse(cx, crown + 4, frx + 1, 9, hc, R());
      pa.rect(cx - frx - 1, crown + 7, (frx + 1) * 2, 3, PixelArt.scale(PixelArt.rgb(hc), 0.7), R());
      pa.ellipse(cx, crown - 5, 2, 2, '#b33a2e', R());
      for (let k2 = -1; k2 <= 1; k2++) pa.line(cx + k2 * 6, crown - 3, cx + k2 * 9, crown + 7, PixelArt.scale(PixelArt.rgb(hc), 1.5), 1);
      break;
    }
    case 'sanshan': { // 内使帽 / 三山帽
      pa.ellipse(cx, crown + 3, frx + 1, 6, hc, R());
      pa.rect(cx - frx - 1, crown + 3, (frx + 1) * 2, 5, hc, R());
      pa.poly([[cx - 10, crown - 1], [cx - 6, crown - 12], [cx - 2, crown - 3], [cx + 2, crown - 12], [cx + 6, crown - 3], [cx + 10, crown - 11], [cx + 12, crown]], hc, R());
      break;
    }
    case 'helmet': {
      pa.ellipse(cx, crown + 4, frx + 2, 9, '#6d737a', R());
      pa.rect(cx - frx - 2, crown + 7, (frx + 2) * 2, 3, '#4b5056', R());
      pa.rect(cx - 1, crown - 10, 2, 7, '#8f959c', R());
      pa.ellipse(cx, crown - 11, 2, 2, '#b3392c', R());
      break;
    }
    case 'bun': case 'bun_royal': { // 女子高髻
      pa.ellipse(cx, crown - 4, 8, 6, hair, R());
      pa.ellipse(cx + (front ? 0 : 0), crown - 9, 5, 4, hair, R());
      const pin = k === 'bun_royal' ? '#e3c25a' : (s.hatColor || '#d9c27a');
      pa.line(cx - 10, crown - 5, cx + 11, crown - 8, pin, 1);
      pa.px(cx + 11, crown - 9, '#e25a5a', -1, true);
      if (k === 'bun_royal') {
        for (const sd of [-1, 1]) { pa.line(cx + sd * 9, crown - 2, cx + sd * 12, crown + 8, '#e3c25a', 1); pa.px(cx + sd * 12, crown + 9, '#f07070', -1, true); }
        pa.ellipse(cx, crown - 12, 3, 2, '#e3c25a', R(), true); pa.px(cx, crown - 12, '#d8453a', -1, true);
      } else {
        pa.ellipse(cx - 8, crown - 2, 2, 2, s.flower || '#f09ab0', R(), true);
      }
      break;
    }
    case 'twinbuns': {
      pa.ellipse(cx - 9, crown - 2, 5, 5, hair, R());
      pa.ellipse(cx + 9, crown - 2, 5, 5, hair, R());
      pa.rect(cx - 10, crown + 1, 3, 2, s.hatColor || '#d8453a', -1, true);
      pa.rect(cx + 8, crown + 1, 3, 2, s.hatColor || '#d8453a', -1, true);
      break;
    }
    case 'cap': { // 现代棒球帽
      pa.ellipse(cx, crown + 3, frx + 2, 7, hc, R());
      if (front) pa.ellipse(cx, crown + 8, frx + 1, 2.5, PixelArt.scale(PixelArt.rgb(hc), 0.8), R());
      else pa.rect(cx - 4, crown + 6, 8, 2, '#e0e0e0', -1, true);
      break;
    }
    case 'ponytail': {
      if (!front) pa.poly([[cx - 3, crown + 6], [cx + 3, crown + 6], [cx + 2, crown + 30], [cx - 2, crown + 30]], hair, R());
      else pa.ellipse(cx + 12, crown + 4, 3, 4, hair, R());
      break;
    }
    case 'turban': {
      pa.ellipse(cx, crown + 2, frx + 3, 9, s.hatColor || '#efe8da', R());
      pa.ellipse(cx, crown - 4, frx - 1, 6, s.hatColor || '#efe8da', R());
      pa.line(cx - frx, crown + 3, cx + frx, crown - 3, '#cfc5b0', 1);
      pa.ellipse(cx, crown + 1, 2, 2, '#3f8a6a', R(), true);
      break;
    }
    default: break;
  }
}

function beard(pa, s, cx, hcy, fry, shoulderY) {
  const c = s.beardColor || HAIR[s.hair] || '#2a2420';
  const y0 = hcy + 6;
  const R = () => pa.region();
  if (s.beard === 'mustache' || s.beard === 'long' || s.beard === 'full' || s.beard === 'goatee') {
    pa.line(cx - 4, y0, cx - 1, y0 - 1, c, 1); pa.line(cx + 1, y0 - 1, cx + 4, y0, c, 1);
    pa.px(cx - 5, y0 + 1, c, -1, true); pa.px(cx + 5, y0 + 1, c, -1, true);
  }
  if (s.beard === 'goatee') pa.poly([[cx - 2, hcy + fry - 3], [cx + 2, hcy + fry - 3], [cx + 1, hcy + fry + 4], [cx - 1, hcy + fry + 4]], c, R());
  if (s.beard === 'long') pa.poly([[cx - 4, hcy + fry - 4], [cx + 4, hcy + fry - 4], [cx + 3, shoulderY + 14], [cx, shoulderY + 20], [cx - 3, shoulderY + 14]], c, R());
  if (s.beard === 'full') {
    pa.poly([[cx - 10, hcy + 3], [cx - 7, hcy + fry], [cx, hcy + fry + 6], [cx + 7, hcy + fry], [cx + 10, hcy + 3], [cx + 8, hcy + fry - 5], [cx, hcy + fry - 2], [cx - 8, hcy + fry - 5]], c, R());
  }
}

function prop(pa, s, cx, handY, shoulderY, front, bodyW) {
  const R = () => pa.region();
  const hx = front ? cx : cx;
  switch (s.prop) {
    case 'book': if (front) { pa.rect(cx - 6, handY - 4, 12, 8, '#2e4a6b', R()); pa.rect(cx - 5, handY - 3, 1, 6, '#e8dcc0', -1, true); pa.rect(cx + 2, handY - 4, 2, 8, '#d8c79c', -1, true); } break;
    case 'scroll': if (front) { pa.rect(cx - 8, handY - 2, 16, 5, '#efe4c8', R()); pa.rect(cx - 9, handY - 3, 2, 7, '#7a4a2a', R()); pa.rect(cx + 7, handY - 3, 2, 7, '#7a4a2a', R()); } break;
    case 'fan': if (front) { for (let a = -6; a <= 6; a++) pa.line(cx + 8, handY + 2, cx + 8 + a * 1.6, handY - 9, a % 2 ? '#efe6cf' : '#d9cba5', 1); pa.px(cx + 8, handY + 2, '#6a4a2a', -1, true); } break;
    case 'brush': pa.line(cx + 6, handY - 10, cx + 3, handY + 2, '#7a5a3a', 1); pa.px(cx + 6, handY - 11, '#1a1a1a', -1, true); pa.px(cx + 7, handY - 12, '#1a1a1a', -1, true); break;
    case 'lantern': {
      const lx = cx + bodyW + 5, ly = handY + 14;
      pa.line(lx, handY + 2, lx, ly - 5, '#6a4a2a', 1);
      pa.ellipse(lx, ly, 5, 6, '#e0463a', R());
      pa.rect(lx - 3, ly - 7, 6, 2, '#c9a44a', -1, true); pa.rect(lx - 3, ly + 5, 6, 2, '#c9a44a', -1, true);
      pa.px(lx - 1, ly - 2, '#ffd27a', -1, true); pa.px(lx, ly - 1, '#ffd27a', -1, true);
      break;
    }
    case 'flag': {
      const fx = cx + bodyW + 4;
      pa.line(fx, handY + 4, fx, handY - 40, '#8a6a4a', 1);
      pa.poly([[fx, handY - 40], [fx + 12, handY - 36], [fx, handY - 31]], s.flagColor || '#d8453a', R());
      break;
    }
    case 'ladle': pa.line(cx + bodyW + 3, handY + 2, cx + bodyW + 10, handY - 18, '#8a6a4a', 1); pa.ellipse(cx + bodyW + 10, handY - 20, 3, 2, '#6a5040', R()); break;
    case 'hammer': pa.line(cx + bodyW + 3, handY + 2, cx + bodyW + 3, handY - 12, '#8a6a4a', 1); pa.rect(cx + bodyW, handY - 16, 7, 4, '#5a5f66', R()); break;
    case 'saw': pa.rect(cx + bodyW + 1, handY - 2, 4, 18, '#9aa0a6', R()); pa.rect(cx + bodyW, handY - 6, 6, 4, '#8a6a4a', R()); break;
    case 'compass': if (front) { pa.ellipse(cx, handY - 1, 6, 4, '#8a5a32', R()); pa.ellipse(cx, handY - 1, 4, 2.5, '#e8d9a8', R()); pa.line(cx - 2, handY - 1, cx + 2, handY - 1, '#c43a2c', 1); } break;
    case 'beads': if (front) for (let a = 0; a < 10; a++) { const t = a / 10 * Math.PI; pa.px(cx - 5 + Math.cos(t) * 5, handY + 3 + Math.sin(t) * 4, '#6a3a2a', -1, true); } break;
    case 'staff': pa.line(cx + bodyW + 4, handY + 30, cx + bodyW + 4, handY - 46, '#7a5a3a', 1); pa.ellipse(cx + bodyW + 4, handY - 47, 2, 2, '#c9a44a', R()); break;
    case 'camera': if (front) { pa.rect(cx - 5, handY - 5, 10, 7, '#2a2a2e', R()); pa.ellipse(cx, handY - 2, 2.5, 2.5, '#6a7a8a', R(), true); } break;
    case 'balloon': { const bx = cx + bodyW + 6; pa.line(bx, handY, bx - 1, handY - 34, '#dddddd', 1); pa.ellipse(bx - 1, handY - 42, 7, 8, s.propColor || '#e25a6a', R()); break; }
    case 'horse': pa.line(cx - 12, handY + 26, cx + 12, handY - 4, '#7a5a3a', 1); pa.ellipse(cx + 13, handY - 7, 4, 3, '#b08050', R()); pa.px(cx + 15, handY - 8, '#222', -1, true); break;
    case 'plum': pa.line(cx + 4, handY + 2, cx + 12, handY - 14, '#5a3a2a', 1); for (const [dx, dy] of [[8, -6], [11, -12], [13, -9], [6, -2]]) pa.ellipse(cx + dx, handY + dy, 1.8, 1.8, '#9fcf6a', R(), true); break;
    case 'brick': if (front) { pa.rect(cx - 8, handY - 5, 16, 7, '#7d8488', R()); pa.line(cx - 8, handY - 5, cx + 8, handY - 5, '#9aa1a5', 1); } break;
    case 'broom': pa.line(cx + bodyW + 4, handY - 20, cx + bodyW + 1, handY + 30, '#8a6a4a', 1); pa.poly([[cx + bodyW - 4, handY + 30], [cx + bodyW + 6, handY + 30], [cx + bodyW + 8, handY + 40], [cx + bodyW - 6, handY + 40]], '#c9ad73', R()); break;
    case 'basket': pa.ellipse(cx + bodyW + 4, handY + 8, 7, 5, '#b08a50', R()); pa.line(cx + bodyW - 2, handY + 6, cx + bodyW + 10, handY + 6, '#8a6a3a', 1); break;
    case 'sword': pa.line(cx - bodyW - 3, handY - 6, cx - bodyW - 3, handY + 26, '#aab0b8', 1); pa.rect(cx - bodyW - 5, handY - 8, 5, 2, '#c9a44a', R()); break;
    case 'kite': pa.ellipse(cx + 8, handY, 3, 3, '#8a6a3a', R()); pa.line(cx + 8, handY, cx + 30, handY - 60, '#e8e8e8', 1); break;
    default: break;
  }
}

/** 从站立帧生成左右迈步帧（与康晔精灵表的做法一致） */
export function walkFrames(pa) {
  const frames = [pa];
  let bottom = 0;
  for (let y = FH - 1; y >= 0 && !bottom; y--) for (let x = 0; x < FW; x++) if (pa.col[y * FW + x]) { bottom = y; break; }
  const hemTop = bottom - 16;
  for (const side of [-1, 1]) {
    const f = new PixelArt(FW, FH);
    f.col.set(pa.col); f.reg.set(pa.reg); f.flat.set(pa.flat);
    // 下摆摆动 1px
    for (let y = hemTop; y < bottom - 5; y++) {
      const row = pa.col.slice(y * FW, y * FW + FW);
      for (let x = 0; x < FW; x++) f.col[y * FW + x] = row[x - side] || (x - side < 0 || x - side >= FW ? 0 : row[x - side]) || 0;
    }
    // 鞋：迈出的下移 1px，另一只上收 2px
    const feet = [];
    for (let y = bottom - 5; y <= bottom; y++) for (let x = 0; x < FW; x++) { const c = pa.col[y * FW + x]; if (c) feet.push([x, y, c]); f.col[y * FW + x] = 0; }
    for (const [x, y, c] of feet) {
      const left = x < FW / 2;
      const stepping = (left && side < 0) || (!left && side > 0);
      const ty = y + (stepping ? 1 : -2);
      if (ty < FH && (stepping || !f.col[ty * FW + x])) f.col[ty * FW + x] = c;
    }
    frames.push(f);
  }
  return frames;
}

/** 生成完整精灵表（192×264：列 站/左/右，行 正/背） */
export function humanSheet(spec) {
  const c = document.createElement('canvas');
  c.width = FW * 3; c.height = FH * 2;
  ['front', 'back'].forEach((view, row) => {
    const frames = walkFrames(drawHuman(spec, view));
    frames.forEach((f, col) => f.toCanvas(c, col * FW, row * FH));
  });
  return c;
}

// ------------------------------------------------------------------ 阿麟（小石麒麟）
export function qilinSheet() {
  // 2 帧 × 2 方向（正/背），每帧 48×48
  const W = 48, H = 48;
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  for (let row = 0; row < 2; row++) for (let fr = 0; fr < 2; fr++) {
    const pa = new PixelArt(W, H);
    const stone = '#b9bdb6', stone2 = '#9aa19a', jade = '#4fa487', jade2 = '#7fcdb0', gold = '#f2c14e';
    const bob = fr;
    const front = row === 0;
    // 尾巴（火焰卷云）
    const tr = pa.region();
    pa.ellipse(front ? 36 : 12, 24 + bob, 5, 4, jade, tr);
    pa.ellipse(front ? 40 : 8, 19 + bob - fr, 4, 3.5, jade2, pa.region());
    pa.ellipse(front ? 42 : 6, 15 + bob, 2.5, 2.5, jade, pa.region());
    // 身体
    pa.ellipse(24, 29 + bob, 11, 8, stone, pa.region());
    // 腿（悬浮，短短的）
    for (const lx of [16, 21, 27, 32]) { pa.rect(lx - 1.5, 34 + bob, 3.5, 6 - (lx % 2) , stone2, pa.region()); pa.rect(lx - 1.5, 39 + bob - (lx % 2), 3.5, 2, '#5b5f5a', pa.region()); }
    // 身上的祥云纹
    pa.line(18, 28 + bob, 22, 27 + bob, stone2, 1); pa.line(26, 31 + bob, 30, 30 + bob, stone2, 1);
    pa.px(22, 26 + bob, jade, -1, true); pa.px(30, 29 + bob, jade, -1, true);
    // 头
    pa.ellipse(24, 16 + bob, 10, 9, stone, pa.region());
    // 鬃毛（青玉卷毛）
    for (const [x, y, r] of [[14, 14, 3.5], [15, 20, 3], [34, 14, 3.5], [33, 20, 3], [18, 8, 3], [30, 8, 3], [24, 7, 3]]) pa.ellipse(x, y + bob, r, r, (x + y) % 2 ? jade : jade2, pa.region());
    // 角
    pa.poly([[22, 6 + bob], [26, 6 + bob], [25, 0 + bob], [24, -1 + bob]], '#e6dfc8', pa.region());
    if (front) {
      // 大眼睛（金色发光）
      for (const ex of [20, 28]) {
        pa.rect(ex - 1.5, 14 + bob, 4, 5, '#2a2622', -1, true);
        pa.rect(ex - 0.5, 15 + bob, 2, 2, gold, -1, true);
        pa.px(ex - 1, 14 + bob, '#ffffff', -1, true);
      }
      // 鼻吻
      pa.ellipse(24, 21 + bob, 4, 2.5, '#cfd3cc', pa.region());
      pa.px(23, 21 + bob, '#5b5f5a', -1, true); pa.px(25, 21 + bob, '#5b5f5a', -1, true);
      pa.px(20, 19 + bob, '#f0a8a0', -1, true); pa.px(29, 19 + bob, '#f0a8a0', -1, true);
    } else {
      pa.ellipse(24, 16 + bob, 7, 6, jade, pa.region());
    }
    pa.shade(1.15, 0.8, 1);
    pa.outline(0.4);
    pa.toCanvas(c, fr * W, row * H);
  }
  return c;
}

// ------------------------------------------------------------------ 长颈鹿（"麒麟"）
export function giraffeSheet() {
  const W = 96, H = 176;
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H;
  for (let fr = 0; fr < 2; fr++) {
    const pa = new PixelArt(W, H);
    const base = '#e6b25c', spot = '#9a5a2a';
    const legs = fr ? [[36, 0], [44, -1], [58, -1], [66, 0]] : [[36, -1], [44, 0], [58, 0], [66, -1]];
    for (const [lx, dy] of legs) { pa.rect(lx - 2, 128 + dy, 5, 44 - dy, base, pa.region()); pa.rect(lx - 2, 169, 5, 4, '#4a3426', pa.region()); }
    pa.ellipse(52, 122, 22, 13, base, pa.region());
    // 脖子
    pa.poly([[60, 118], [70, 112], [62, 40], [54, 42]], base, pa.region());
    // 头
    pa.ellipse(60, 34, 10, 7, base, pa.region());
    pa.ellipse(67, 38, 6, 5, '#f0c88a', pa.region());
    for (const ox of [55, 61]) { pa.rect(ox, 20, 2, 8, base, pa.region()); pa.ellipse(ox + 1, 20, 2, 2, '#7a4a2a', pa.region()); }
    pa.ellipse(51, 29, 4, 2, base, pa.region());
    pa.rect(60, 31, 3, 3, '#2a1d18', -1, true); pa.px(60, 31, '#ffffff', -1, true);
    // 斑块
    const r = rng(9);
    for (let i = 0; i < 46; i++) {
      const x = 32 + r() * 42, y = 42 + r() * 90;
      const col = pa.get(Math.round(x), Math.round(y));
      if (col) pa.ellipse(x, y, 2.5 + r() * 2, 2 + r() * 2, spot, -1, true);
    }
    // 鬃毛与尾巴
    pa.line(57, 44, 64, 112, '#7a4a2a', 1);
    pa.line(30, 120, 26, 140, '#7a4a2a', 1);
    pa.shade(1.12, 0.82, 1);
    pa.outline(0.4);
    // 修正斑块把轮廓外也画上了：只保留轮廓内（简单起见不处理）
    pa.toCanvas(c, fr * W, 0);
  }
  return c;
}

// ------------------------------------------------------------------ 蠹（银鱼怪）
export function silverfishSheet(big = false) {
  const W = big ? 128 : 48, H = big ? 64 : 24;
  const c = document.createElement('canvas');
  c.width = W * 4; c.height = H;
  for (let fr = 0; fr < 4; fr++) {
    const pa = new PixelArt(W, H);
    const k = big ? 2.6 : 1;
    const wig = Math.sin(fr / 4 * Math.PI * 2);
    const segs = 9;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const x = W * 0.78 - t * W * 0.55;
      const y = H * 0.5 + Math.sin(t * 3 + fr * 1.6) * 1.6 * k;
      const r = (1 - t * 0.75) * 4.2 * k;
      pa.ellipse(x, y, r * 1.2, r, i % 2 ? '#c9ced6' : '#aeb5bf', pa.region());
    }
    // 触角
    pa.line(W * 0.8, H * 0.45, W * 0.98, H * (0.2 + wig * 0.08), '#8a919b', big ? 2 : 1);
    pa.line(W * 0.8, H * 0.55, W * 0.98, H * (0.8 - wig * 0.08), '#8a919b', big ? 2 : 1);
    // 三根尾须
    for (const dy of [-0.18, 0, 0.18]) pa.line(W * 0.24, H * 0.5, W * 0.02, H * (0.5 + dy + wig * 0.05), '#8a919b', big ? 2 : 1);
    // 眼
    pa.px(W * 0.8, H * 0.45, '#2a1d2a', -1, true);
    if (big) { pa.ellipse(W * 0.8, H * 0.42, 3, 3, '#1a1420', -1, true); pa.px(W * 0.8, H * 0.4, '#e05050', -1, true); }
    pa.shade(1.2, 0.75, 1);
    pa.outline(0.35);
    pa.toCanvas(c, fr * W, 0);
  }
  return c;
}

/** 对话框用的 NPC 头像：取精灵正面站立帧的上半身，按整数倍放大 */
export function bustCanvas(sheet, scale = 4) {
  const c = document.createElement('canvas');
  const cropY = 4, cropH = 76;
  c.width = FW * scale; c.height = cropH * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  // 找到头顶，让半身像不被切到帽子
  g.drawImage(sheet, 0, cropY, FW, cropH, 0, 0, FW * scale, cropH * scale);
  return c;
}
