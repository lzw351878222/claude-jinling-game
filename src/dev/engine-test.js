import { Game } from '../game/game.js';
import { audio } from '../core/audio.js';
import { EMIT } from '../engine/particles.js';

const G = new Game();
G.state = { flags: { alingJoined: true } };
window.G = G;

const map = {
  id: 'test', name: '测试', w: 40, h: 30, blockH: 6,
  env: new URLSearchParams(location.search).get('env') || 'day',
  ground: [
    '########################################',
    '########################################',
    '########################################',
    '#################......#################',
    '=========================,,,,,,,,,,,,,,,',
    '=========================,,,,,,,,,,,,,,,',
    '====================,,,,,,,,,,,,,,,,,,,,',
    '==========......,,,,,,,,,,,,,,,,,,,,,,,,',
    '..........................,,,,,,,,,,,,,,',
    '..........................,,,,,,,,,,,,,,',
    '.........................,,,,,,,,,,,,,,,',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '::::::::::::::,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,oooooooooooo,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,oooooooooooo,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,oooooooooooo,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,oooooooooooo,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
  ],
  spawns: { default: [16, 22, 'up'] },
  build(B) {
    B.cityGate({ x: 16, z: 0, w: 8, d: 4, h: 6, arches: [{ x: 0, w: 3, h: 2.4 }], sign: '聚宝门', name: 'gate' });
    B.hall({ x: 2, z: 4, w: 8, d: 4, roof: 'xieshan', tile: 'roof_yellow', sign: '文渊阁' });
    B.house({ x: 26, z: 5, w: 6, d: 4 });
    B.house({ x: 33, z: 5, w: 5, d: 4 });
    B.bridge({ x: 8, z: 11, len: 3, w: 2, dir: 'z', h: 0.7 });
    B.pavilion({ x: 30, z: 18, r: 1.4, sides: 6 });
    B.pagoda({ x: 34, z: 24, levels: 5, r: 2.0, levelH: 1.6 });
    B.tree('willow', 4, 14.5); B.tree('willow', 20, 14.5); B.tree('plum', 24, 20); B.tree('pine', 3, 24); B.tree('ginkgo', 26, 25); B.tree('bamboo', 6, 20); B.tree('maple', 14, 26);
    B.scatter('tuft', 0, 15, 40, 30, 60); B.scatter('flowers', 0, 15, 40, 30, 20);
    B.tree('reeds', 1, 14.2); B.tree('reeds', 30, 14.2);
    B.prop('bricks', 12, 9); B.prop('cart', 14, 9, { load: true }); B.prop('barrel', 22, 9); B.prop('jar', 23, 9); B.prop('well', 18, 18);
    B.kiln({ x: 6, z: 17, r: 1.6 });
    B.hangLantern(12.5, 2.4, 16); B.hangLantern(17.5, 2.4, 16); B.lanternPost(22, 16.5); B.lanternPost(10, 16.5);
    B.ship({ x: 28, z: 12.5, kind: 'huafang', rot: 0 });
    B.stall({ x: 12, z: 20, w: 2, sign: '元宵', awning: '#b8453a', goods: ['#e8e2d0', '#d9a52a'] });
    B.pailou({ x: 16, z: 26.5, w: 7, text: '天下文枢' });
  },
  npcs: [
    { id: 'zhou', name: '周老汉', look: { body: 'old', skin: 'tan', hair: 'grey', outfit: 'short', color: '#7a6048', color2: '#5a5048', hat: 'wangjin', beard: 'long', beardColor: '#cfcac2', eyes: 'narrow' }, x: 13.5, z: 18.5, talk: async () => {} },
    { id: 'guan', name: '李主事', look: { body: 'man', outfit: 'official', color: '#3e5a7a', color2: '#27384d', patch: '#3a5f8a', hat: 'wusha', beard: 'mustache', eyes: 'stern' }, x: 19.5, z: 20.5, talk: async () => {} },
    { id: 'girl', name: '小妹', look: { body: 'girl', outfit: 'skirt', color: '#e39aa8', color2: '#6f9a7f', hat: 'twinbuns', prop: 'plum' }, x: 22.5, z: 22, wander: [18, 19, 26, 26], talk: async () => {} },
  ],
  particles(P) { P.addEmitter(EMIT.petals(0, 15, 40, 30)); P.addEmitter(EMIT.dust(0, 15, 40, 30)); P.addEmitter(EMIT.smoke(6.6, 4.5, 16.4)); P.addEmitter(EMIT.embers(6, 0.8, 19)); },
};

(async () => {
  await document.fonts.load('40px JLBrush').catch(() => {});
  await G.loadMap(map);
  G.start();
  window.__shot = (name) => new Promise((res) => { G.captureNext = { name, res }; });
  const origFrame = G.frame.bind(G);
  G.frame = (dt) => {
    origFrame(dt);
    if (G.captureNext) {
      const { name, res } = G.captureNext; G.captureNext = null;
      G.canvas.toBlob(async (b) => { await fetch('/__save?name=' + name, { method: 'POST', body: b }); res(true); }, 'image/png');
    }
  };
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
})();
