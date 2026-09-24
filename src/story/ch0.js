// 序章 · 城砖上的名字 —— 二〇二六年秋，中华门瓮城
import { grid, spawnWorms, clearWorms, alingJoin, alingAt, FX } from './common.js';

const W = 32, H = 22;
const GATE_X = 16; // 城门中轴
const CAVE_L = 10.9, CAVE_R = 21.1; // 两个藏兵洞

export const PROLOGUE_MAP = (o = {}) => ({
  id: 'prologue', name: '中华门', era: o.night ? '二〇二六年 · 夜' : '二〇二六年 · 秋', modernClothes: true,
  w: W, h: H, blockH: 6, seed: 11,
  env: o.night ? { preset: 'night' } : { preset: 'dusk' },
  camera: { dist: 19, pitch: 40, fov: 30 },
  tilt: { focus: 0.5, band: 0.2, amount: 1.8 },
  music: o.night ? 'home' : 'modern', ambient: 'wind',
  ground: grid(W, H, (x, z) => {
    if (x <= 2 || x >= 29) return z <= 14 ? '#' : (z > 16 ? '"' : ',');
    if (z <= 4) return '=';
    if (x >= 13 && x <= 18) return 'm';
    if (z >= 15 && (x <= 7 || x >= 24)) return ',';
    if (z >= 17) return (x + z) % 2 ? ',' : '"';
    return '=';
  }),
  spawns: { default: [16, 17.5, 'up'], cave: [CAVE_L, 6.2, 'up'] },
  build(B) {
    // 最里面一道城门：中间是大门洞，两侧两个藏兵洞
    B.cityGate({ x: 8, z: 0, w: 16, d: 5, h: 6, name: 'gate', sign: '中华门',
      arches: [{ x: 0, w: 3.4, h: 3.2 }, { x: CAVE_L - GATE_X, w: 1.9, h: 2.0 }, { x: CAVE_R - GATE_X, w: 1.9, h: 2.0 }], doors: true });
    // 大门洞关着（不能走），藏兵洞到底是一堵墙
    B.world.markSolid(14, 0, 4, 3);
    for (const cx of [CAVE_L, CAVE_R]) {
      B.block('citybrick', cx, 0, 1.2, 2.1, 2.3, 0.5);
      B.world.markSolid(Math.floor(cx) - 1, 0, 3, 2);
    }
    // 藏兵洞最深处：那块刻着名字的砖
    B.glowText('康晔', CAVE_L + 0.35, 0.95, 1.5, { size: 0.16, color: '#fff0c8', glow: '#ffd27a' });
    B.glowText('造砖人夫', CAVE_L - 0.1, 0.95, 1.5, { size: 0.12, color: '#e8dcc0', glow: '#c8a860', light: false });
    // 城墙顶的垛口在两侧墙上也来一排
    for (let z = 0; z <= 14; z += 1) { B.block('citybrick', 1.5, 6, z + 0.5, 0.6, 0.5, 0.6); B.block('citybrick', 30.5, 6, z + 0.5, 0.6, 0.5, 0.6); }
    // 现代的瓮城广场
    for (const [x, z] of [[5, 16], [26, 16], [5, 20], [26, 20]]) B.tree('ginkgo', x, z, { scale: 1.15 });
    B.tree('ginkgo', 9.5, 19.5); B.tree('ginkgo', 22.5, 19.5);
    B.scatter('tuft', 3, 15, 29, 22, 26); B.scatter('flowers', 3, 17, 29, 22, 8);
    B.prop('bench', 9, 13); B.prop('bench', 23, 13);
    B.prop('bin', 12, 13.5); B.prop('sign_modern', 20.5, 8.5);
    B.streetLamp(12.5, 9); B.streetLamp(19.5, 9); B.streetLamp(7, 14); B.streetLamp(25, 14);
    // ---- 修复：城砖上的铭文
    B.ruin('inscription', () => {
      for (const [x, y] of [[12.2, 2.2], [13.0, 3.6], [19.2, 2.8], [20.1, 1.6], [18.6, 4.1], [11.5, 4.3]]) B.block('c:#c9ced6', x, y, 5.03, 0.5, 0.22, 0.06, { shadow: false });
    });
    B.stage('inscription', () => {
      B.glowText('袁州府提调官同知王仲辉|司吏黄彦|宜春县提调官主簿李德', 12.4, 2.6, 5.06, { size: 0.2 });
      B.glowText('窑匠周大|造砖人夫陈三|天下平', 19.7, 2.6, 5.06, { size: 0.2 });
      B.glowText('万万年', 23.3, 4.4, 5.06, { size: 0.22 });
    });
    // ---- 修复：时之隙
    B.stage('portal', () => { B.portal(CAVE_L, 1.05, 2.4, { r: 0.95 }); });
  },
  npcs: o.night ? [] : [
    { id: 'guide', name: '导游', look: { body: 'woman', outfit: 'modern', color: '#c9473d', color2: '#2c3440', hat: 'ponytail', prop: 'flag', seed: 3 }, x: 15, z: 12.5, dir: 'down', voice: 'female', talk: null },
    { id: 'kid', name: '小朋友', look: { body: 'child', outfit: 'modern', color: '#f0c040', color2: '#3a5a8a', hat: 'short', prop: 'balloon', seed: 5 }, x: 20, z: 14.5, wander: [18, 13, 23, 16], voice: 'child', talk: null },
    { id: 'dishu', name: '写地书的老先生', look: { body: 'old', outfit: 'modern', color: '#ece6d6', color2: '#5a5a5a', hair: 'white', prop: 'brush', eyes: 'narrow', seed: 7 }, x: 8.5, z: 16.5, dir: 'right', voice: 'old', talk: null },
    { id: 'photo', name: '摄影爱好者', look: { body: 'man', outfit: 'modern', color: '#3a6a5a', color2: '#2a2a30', hat: 'cap', prop: 'camera', seed: 9 }, x: 24.5, z: 9.5, dir: 'up', voice: 'male', talk: null },
  ],
  particles(P) {
    P.addEmitter(FX.leaves(3, 12, 29, 22, '#e8c040'));
    P.addEmitter(FX.dust(3, 5, 29, 20));
  },
});

export default function prologue(D) {
  const map = PROLOGUE_MAP();
  const npc = Object.fromEntries(map.npcs.map((n) => [n.id, n]));
  // ---- 路人
  npc.guide.talk = async () => {
    await D.say('guide', '各位游客，我们现在站的地方就是中华门的瓮城。它明代叫【聚宝门】，1931年才改名中华门。');
    await D.say('guide', '整座城门东西宽一百一十八米多，三道瓮城、四道券门——敌人冲进来，就成了「瓮中之鳖」。');
    await D.say('guide', '城台里还藏着二十七个藏兵洞。大家看两侧，南京城墙有三十五公里长，是世界上现存规模最大的古代城垣之一。');
    D.codex('zhonghuamen', 'city_wall');
  };
  npc.kid.talk = async () => {
    await D.say('kid', '姐姐，城墙的砖上为什么都有字呀？');
    await D.say('kangye', '那是造砖的人签的名字。哪块砖出了毛病，顺着名字就能找到是谁烧的。', 'smile');
    await D.say('kid', '那……砖上会有我的名字吗？');
    await D.say('kangye', '说不定哦。等你找到了，记得告诉我。', 'smile');
  };
  npc.dishu.talk = async () => {
    await D.say('dishu', '（老先生用蘸水的大笔在地上写了两个字：「金陵」）');
    await D.say('dishu', '水写的字，一会儿就干了。这城墙上的字，六百多年还在。姑娘，你说是哪个更像人的记性？');
    await D.say('kangye', '……都像吧。有的会干，有的会留下来。', 'q34');
    await D.say('dishu', '说得好。留下来的，都是有人一遍遍记着的。');
    D.codex('jinling');
  };
  npc.photo.talk = async () => {
    await D.say('photo', '黄昏的时候，城砖会泛出一点暖色，是一天里最好拍的时候。');
    await D.say('photo', '奇怪，刚才取景框里好像有一道银光，一闪就没了……大概是反光吧。');
  };
  const readBrick = (k) => {
    D.flag('pb_' + k);
    if (['wall', 'cave', 'name'].every((x) => D.has('pb_' + x))) D.achieve('all_bricks');
  };
  map.things = [
    { x: 13, z: 5.8, r: 1.4, name: '城砖', verb: '读铭文', talk: async () => {
      await D.say('kangye', '「袁州府提调官同知王仲辉，司吏黄彦……窑匠周大，造砖人夫陈三。」', 'q34');
      await D.say('kangye', '从府县的官员一直到烧砖的工匠，层层署名。一块砖，就是一份责任状。', 'smile');
      D.codex('brick_inscription');
      readBrick('wall');
    } },
    { x: CAVE_R, z: 5.4, r: 1.3, name: '藏兵洞', verb: '查看', talk: async () => {
      await D.say('kangye', '藏兵洞。据说整座城门里有二十七个，能藏兵三千。', 'q34');
      await D.say('kangye', '洞顶是砖砌的拱券，冬暖夏凉……在里面说话，回声能荡好久。', 'smile');
      D.codex('cangbingdong');
      readBrick('cave');
    } },
    { x: CAVE_L, z: 3.2, r: 1.2, name: '那块砖', verb: '看看', when: () => D.has('p_found'), talk: async () => {
      await D.think('「造砖人夫 康晔」。一笔一画，确实是我的名字。', 'side');
      await D.think('六百年前的砖上，为什么会有我的名字？');
      readBrick('name');
    } },
  ];

  return {
    id: 0,
    map,
    music: 'modern', ambient: 'wind',
    listTitle: '寻回铭文',
    quest: '点右下角的「闯关」，把被啃掉的铭文拼回来',
    sealDesc: '',
    async intro() {
      D.letterbox(true);
      D.g.player.pos.set(16, 0, 18.5);
      D.g.player.dir = 'up';
      await D.cam(16, 12, { dist: 23, pitch: 34, dur: 0.01 });
      await D.narrate('二〇二六年，秋。南京，中华门。');
      await D.cam(16, 9, { dist: 19, pitch: 40, dur: 2.6 });
      await D.walk('kangye', 14.5, 7.5);
      await D.think('每次来，都忍不住要把城砖上的字再读一遍。', 'smile');
      await D.walk('kangye', 13, 6.2, { face: 'up' });
      await D.say('kangye', '「袁州府提调官同知王仲辉，司吏黄彦……窑匠周大，造砖人夫陈三。」', 'q34');
      await D.say('kangye', '六百多年前的人，把名字一个个刻在砖上。哪块砖出了问题，顺着名字就能找到人——这叫【物勒工名】。', 'smile');
      D.codex('brick_inscription');
      D.achieve('first_brick');
      await D.wait(300);
      D.emote('kangye', '?');
      await D.think('咦……左边那个藏兵洞里，怎么有光？');
      await D.walk('kangye', CAVE_L, 5.8);
      await D.walk('kangye', CAVE_L, 2.9, { face: 'up' });
      await D.cam(CAVE_L, 3.2, { dist: 12, pitch: 36, dur: 1.2 });
      await D.say('kangye', '最里面这一块……「造砖人夫」……', 'q34');
      D.emote('kangye', '!');
      D.shake(0.12, 0.3);
      await D.shout('kangye', '「康、晔」？！', 'front');
      D.flag('p_found');
      await D.think('同名同姓？可这笔画……就像是我自己刻上去的。');
      D.codex('kangye');
      // 蠹出现
      D.sfx('scurry');
      await D.walk('kangye', CAVE_L, 6.4, { speed: 5 });
      D.g.player.dir = 'down';
      spawnWorms(D, [[12.6, 6.6], [15.2, 7.2], [18.8, 6.4], [20.8, 7.4]]);
      await D.cam(16, 8, { dist: 17, pitch: 40, dur: 1.0 });
      D.shake(0.2, 0.5);
      await D.narrate('砖缝里钻出了几条银灰色的小虫。它们爬过的地方，城砖上的铭文一个字、一个字地消失了。');
      D.g.player.dir = 'up';
      await D.say('kangye', '字……被啃掉了？！', 'serious');
      // 阿麟登场
      const al = alingAt(D, CAVE_L + 1.2, 7.4);
      D.g.sparkleBurst(al.pos, { x: 1, y: 1.2, z: 1 });
      D.sfx('magic');
      await D.wait(500);
      await D.say('aling', '别愣着！它们在吃名字！');
      D.face('kangye', 'aling');
      await D.say('kangye', '……一只巴掌大的小石麒麟？还会说话？', 'front');
      await D.say('aling', '本麟是明孝陵神道上的石麒麟，你叫我阿麟就好。');
      await D.say('aling', '这些小虫叫【蠹】。它们吃的不是纸，也不是砖，是人们的记忆——被它们吃过的名字，就再也没人记得了。');
      await D.say('kangye', '那怎么办？总不能看着它们把整座城墙都啃光吧？', 'serious');
      await D.say('aling', '你看得见它们，说明你记得。记得的人，就能把踪迹找回来。');
      await D.say('aling', '把一样的纹样凑成三个，被啃掉的踪迹就会复原——这叫「寻踪」。来，本麟教你！');
      D.letterbox(false);
      alingJoin(D);
      await D.camBack(1.0);
    },
    steps: [
      {
        kind: 'level', id: 'p1', title: '拼回被啃掉的铭文', stage: 'inscription',
        async after() {
          clearWorms(D);
          await D.say('kangye', '字回来了！', 'smile');
          await D.say('aling', '不错嘛，一学就会。');
          await D.say('aling', '不过这几只只是小的。蠹是从「那边」钻过来的——它们的窝，在六百年前。');
          await D.say('kangye', '六百年前？', 'q34');
          await D.say('aling', '本麟在孝陵的神道上站了六百多年，头一回见它们闹得这么凶。再拼一次，本麟就能把路打开。');
          D.codex('aling', 'du');
        },
      },
      {
        kind: 'level', id: 'p2', title: '打开时之隙', stage: 'portal',
        async after() {
          await D.say('aling', '时之隙开了。蠹从这里来，也只有从这里过去，才能堵住它们的来路。');
          await D.say('kangye', '六百年前……那时候，聚宝门应该正在修吧？', 'q34');
          await D.say('aling', '洪武年间。满工地都是烧砖的、运砖的、砌墙的。怕不怕？');
          const c = await D.choose(['怕什么，走！', '……能顺便看看朱元璋长什么样吗？']);
          if (c === 0) await D.say('kangye', '怕什么，走！我倒要看看，是谁把我的名字刻在那块砖上的。', 'smile');
          else {
            await D.say('kangye', '……能顺便看看朱元璋长什么样吗？画像上那张脸，到底是不是真的那么长？', 'smile');
            await D.say('aling', '嘘！这话在洪武年间可不能乱说。');
          }
          D.codex('xiaoling');
        },
      },
    ],
    async outro() {
      D.letterbox(true);
      await D.walk('kangye', CAVE_L, 4.2, { face: 'up' });
      await D.say('aling', '跟紧本麟。穿过去的时候，不要回头。');
      D.sfx('whoosh');
      await D.fade(1, 900, '#ffffff');
      D.letterbox(false);
      await D.bigText('六百年', { hold: 900, small: '洪武十年 · 聚宝门' });
    },
  };
}
