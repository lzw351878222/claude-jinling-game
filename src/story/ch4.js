// 第四章 · 琉璃 —— 宣德三年（1428），大报恩寺琉璃塔
import { grid, spawnWorms, clearWorms, FX } from './common.js';

const W = 34, H = 26;
const PX = 17, PZ = 7.5; // 塔心
const ZHENG_OLD = { body: 'stout', outfit: 'official', color: '#7a2a22', color2: '#4a1a14', patch: '#d9a52a', hat: 'sanshan', eyes: 'narrow', hair: 'grey', seed: 81 };

export default function ch4(D) {
  let lamps = [];
  const map = {
    id: 'baoen', name: '大报恩寺', era: '宣德三年（1428）',
    w: W, h: H, blockH: 3, seed: 91,
    env: { preset: 'day' },
    camera: { dist: 23, pitch: 38, fov: 30 },
    music: 'temple', ambient: 'wind',
    ground: grid(W, H, (x, z) => {
      if (z >= 18) {
        if (z === 18 || z === 19) return 'b';
        return (x >= 14 && x <= 19) ? 'o' : (x % 7 === 0 ? ',' : '.');
      }
      if (Math.hypot(x + 0.5 - PX, z + 0.5 - PZ) < 5.6) return 'j';
      if (x >= 15 && x <= 18) return 'j';
      return (x + z) % 4 ? '=' : '-';
    }),
    spawns: { default: [17, 16.5, 'up'] },
    build(B) {
      // 琉璃塔：下四层先立着，上面五层和塔刹要慢慢合拢
      const res = B.pagoda({ x: PX, z: PZ, levels: 9, r: 3.0, levelH: 2.0, to: 4 });
      lamps = res.lamps;
      // 东西配殿
      B.hall({ x: 1.5, z: 3, w: 7, d: 5, h: 2.6, roof: 'xieshan', tile: 'roof_green', plat: 0.4, occluder: 'westhall' });
      B.ruin('hall', () => {
        for (const [x, z] of [[26, 3.5], [29.2, 3.5], [32.4, 3.5], [26, 7.5], [32.4, 7.5]]) B.block('lacquer', x, 0.4, z, 0.26, 2.6, 0.26);
        B.block('stone_block_light', 29.2, 0, 5.5, 7.4, 0.4, 5.4);
        B.prop('timber', 29, 9.4, { solid: false });
      });
      B.stage('hall', () => { B.hall({ x: 25.5, z: 3, w: 7, d: 5, h: 2.6, roof: 'xieshan', tile: 'roof_green', plat: 0.4 }); });
      // 香炉、碑、树
      B.prop('incense', 17, 14.2); B.prop('stele', 6, 12.5); B.prop('stele', 28, 12.5);
      B.trees('ginkgo', [[3, 14.5], [31, 14.5]]); B.trees('pine', [[1.2, 9.5], [33, 9.8]]);
      B.tree('osmanthus', 10.5, 15.6); B.tree('osmanthus', 23.5, 15.6);
      // 寺墙与山门
      B.wall(0, 17.6, 14.2, 17.6, { h: 2.2, key: 'plaster_red' });
      B.wall(19.8, 17.6, 34, 17.6, { h: 2.2, key: 'plaster_red' });
      // 长干里：寻常人家与一口井
      B.house({ x: 1, z: 20, w: 6, d: 4.5, occluder: 'h1' }); B.house({ x: 8, z: 20.5, w: 5, d: 4.5, occluder: 'h2' });
      B.house({ x: 21, z: 20.5, w: 5, d: 4.5, occluder: 'h3' }); B.house({ x: 27, z: 20, w: 6, d: 4.5, occluder: 'h4' });
      B.prop('well', 17, 22.4);
      B.tree('plum', 13.2, 19.2); B.tree('willow', 20.4, 19.2);
      B.scatter('tuft', 0, 18, 34, 26, 18);
      // ---- 修复 1：琉璃构件
      B.stage('glaze', () => {
        const cols = ['c:#f2efe6', 'glaze_green', 'glaze_yellow', 'glaze_blue'];
        for (let i = 0; i < 8; i++) B.block(cols[i % 4], 8.5 + (i % 4) * 0.6, Math.floor(i / 4) * 0.3, 11.2, 0.55, 0.28, 0.5);
        for (let i = 0; i < 8; i++) B.block(cols[(i + 2) % 4], 24 + (i % 4) * 0.6, Math.floor(i / 4) * 0.3, 11.2, 0.55, 0.28, 0.5);
        B.prop('crate', 12, 11.3); B.prop('crate', 22.6, 11.3);
      });
      // ---- 修复 2：琉璃拱门
      B.ruin('arch', () => {
        for (let i = 0; i < 6; i++) B.block(['glaze_white', 'glaze_green', 'glaze_yellow'][i % 3], 15.4 + (i % 3) * 1.2, 0, 13.6 + Math.floor(i / 3) * 0.6, 0.7, 0.3, 0.45);
      });
      B.stage('arch', () => {
        for (const x of [15.1, 18.9]) { B.block('glaze_white', x, 0, 12.2, 0.7, 2.6, 0.7); B.block('glaze_green', x, 2.6, 12.2, 0.9, 0.2, 0.9); }
        B.block('glaze_yellow', 17, 2.6, 12.2, 4.6, 0.5, 0.8);
        B.block('glaze_green', 17, 3.1, 12.2, 5.0, 0.18, 1.0);
        B.block('glaze_blue', 17, 3.28, 12.2, 1.6, 0.5, 0.6);
        B.block('c:#f2efe6', 17, 3.35, 12.62, 1.2, 0.35, 0.04);
        B.glowText('报恩', 17, 3.53, 12.65, { size: 0.13, color: '#8a5a10', glow: '#ffe6a0', light: false });
      });
      // ---- 修复 3：塔身合拢（上四层）；修复 7：第九层与塔刹
      B.stage('pagoda', () => { B.pagoda({ x: PX, z: PZ, levels: 9, r: 3.0, levelH: 2.0, from: 4, to: 8 }); });
      B.stage('finial', () => {
        B.pagoda({ x: PX, z: PZ, levels: 9, r: 3.0, levelH: 2.0, from: 8, to: 9 });
        B.light(PX, 22, PZ, '#ffe6a0', 1.5, { radius: 8 });
        B.glow(PX, 21.6, PZ, '#ffe6a0', 3.2, { nightOnly: false, opacity: 0.55 });
      });
      // ---- 修复 4：风铃
      B.stage('bells', () => {
        for (const [x, y, z] of lamps.filter((_, i) => i % 2 === 0)) B.block('c:#d9b24a', x, y - 0.38, z, 0.12, 0.3, 0.12, { shadow: false });
      });
      // ---- 修复 6：长明灯
      B.stage('lamps', () => {
        lamps.forEach(([x, y, z], i) => {
          B.block('e:#ffc060', x, y - 0.2, z, 0.16, 0.16, 0.16, { shadow: false });
          if (i % 3 === 0) B.light(x, y, z, '#ffb050', 0.9, { radius: 4.5 });
          if (i % 2 === 0) B.glow(x, y - 0.1, z, '#ffb050', 1.1);
        });
      });
    },
    particles(P, g) {
      if (g.night) P.addEmitter(FX.fireflies(2, 12, 32, 18));
      else P.addEmitter(FX.petals(0, 10, 34, 26, '#fbe3a0'));
      P.addEmitter(FX.dust(0, 2, 34, 18));
    },
  };
  map.npcs = [
    { id: 'zheng2', name: '郑和', sub: '南京守备', look: ZHENG_OLD, x: 13.4, z: 14.6, dir: 'right', voice: 'male' },
    { id: 'jiang', name: '琉璃匠', look: { body: 'man', outfit: 'short', color: '#3f7f6f', color2: '#2a4a40', hat: 'toujin', prop: 'hammer', skin: 'tan', seed: 82 }, x: 10.6, z: 12.6, dir: 'right', voice: 'male' },
    { id: 'seng', name: '寺僧', look: { body: 'man', outfit: 'monk', color: '#8a7a5a', color2: '#5a4a3a', hat: 'bald', prop: 'beads', seed: 83 }, x: 22, z: 14.6, wander: [20, 13.5, 25, 16], voice: 'male' },
    { id: 'dugong', name: '督工官', look: { body: 'man', outfit: 'official', color: '#4a5a8a', color2: '#2a3450', patch: '#6a7aa0', hat: 'wusha', prop: 'scroll', beard: 'mustache', seed: 84 }, x: 20.4, z: 15.4, dir: 'left', voice: 'male' },
    { id: 'boy', name: '骑竹马的男孩', look: { body: 'child', outfit: 'short', color: '#4a6a9a', color2: '#2a3a5a', hat: 'short', prop: 'horse', seed: 85 }, x: 15.4, z: 22.6, wander: [14.6, 21.4, 19.6, 24.6], speed: 2.2, voice: 'child' },
    { id: 'girl', name: '拿青梅的女孩', look: { body: 'girl', outfit: 'skirt', color: '#e39aa8', color2: '#6f9a7f', hat: 'twinbuns', prop: 'plum', seed: 86 }, x: 18.8, z: 23.4, dir: 'left', voice: 'child' },
  ];
  const npc = Object.fromEntries(map.npcs.map((n) => [n.id, n]));
  npc.zheng2.talk = async () => {
    await D.say('zheng2', '这座塔，是先帝为了报答高皇帝和高皇后的养育之恩修的。永乐十年动工，到今天已经十六年了。');
    await D.say('zheng2', '咱家这辈子，下过六回西洋，如今在南京当个守备，督造一座塔……也算是另一种航行吧。');
  };
  npc.jiang.talk = async () => {
    await D.say('jiang', '塔上的琉璃，都是在城南聚宝山的官窑里烧的。五色琉璃得两次进窑：先烧素坯，再上釉复烧。');
    await D.say('jiang', '每一样构件都烧三份：一份上塔，两份编上号埋进土里备用。塔上哪块坏了，报个字号，挖出来补上，天衣无缝！');
    D.codex('jubaoshan_kiln', 'glazed_parts');
  };
  npc.seng.talk = async () => {
    await D.say('seng', '这块地方，自古就是佛门清净地。听老辈人说，旧寺的地宫里，还供着一座七宝阿育王塔呢。');
    D.codex('ashoka_pagoda');
  };
  npc.dugong.talk = async () => {
    await D.say('dugong', '陛下的敕书上写得明明白白：限今年八月以前完工，误了期限，一个也不饶！');
    D.codex('xuande');
  };
  const kids = async () => {
    await D.say('boy', '驾！驾！我的竹马跑得最快！');
    await D.say('girl', '你再绕着井跑，青梅都要被你撞掉啦！');
    await D.say('kangye', '（笑）「郎骑竹马来，绕床弄青梅。同居长干里，两小无嫌猜。」', 'smile');
    await D.say('boy', '姐姐念的是什么？');
    await D.say('kangye', '是很久以前一个大诗人，写你们长干里的小孩子的诗。', 'smile');
    D.achieve('qingmei');
    D.codex('changganli');
  };
  npc.boy.talk = kids;
  npc.girl.talk = kids;

  const self = {
    map,
    music: 'temple', ambient: 'wind',
    listTitle: '重光琉璃塔',
    sealDesc: '九级浮图，一百四十六盏长明灯。',
    beforeLoad(D2, restored) {
      const night = restored.has('lamps');
      map.env = { preset: night ? 'night' : 'day' };
      self.music = night ? 'night' : 'temple';
      self.ambient = night ? 'night' : 'wind';
    },
    async intro() {
      D.letterbox(true);
      spawnWorms(D, [[10, 11], [24, 11], [17, 16]]);
      await D.cam(PX, 10, { dist: 30, pitch: 32, dur: 0.01 });
      await D.fade(0, 900, '#ffffff');
      await D.narrate('宣德三年，长干里。大报恩寺的九层琉璃宝塔，已经修了整整十六年。');
      await D.cam(PX, 12, { dist: 22, pitch: 38, dur: 2.2 });
      await D.say('dugong', '（展开敕书）皇帝敕谕：大报恩寺自永乐十年兴工，至今未完。限今年八月以前，务必完工——误了期限，一个也不饶！');
      await D.say('jiang', '可是大人，琉璃构件上的墨书编号，全被虫子啃没了！哪块在第几层、朝哪一面，谁也分不清啊！');
      await D.walk('kangye', 15.6, 15.2, { face: 'left' });
      await D.say('zheng2', '……姑娘？');
      await D.say('zheng2', '十三年前，龙江船厂，替咱家补针路的——是你吧？你怎么……一点都没变？');
      await D.say('kangye', '郑公公，您……还记得我？', 'front');
      await D.say('zheng2', '咱家这把年纪，记性不如从前了。可救过船队的人，不会忘。');
      await D.say('aling', '（小声）糟了，时间对不上，你就说是……是驻颜有术。');
      await D.say('kangye', '……我家里人，都长得显小。', 'smile');
      await D.say('zheng2', '哈哈哈！好，好。那就再帮咱家一回吧。');
    },
    steps: [
      {
        kind: 'level', id: 'c4-1', title: '运来琉璃构件', stage: 'glaze',
        async after() {
          clearWorms(D);
          await D.say('jiang', '构件都运到了！白的、绿的、黄的、蓝的……可编号没了，还得一块块比对纹样。');
          D.codex('glazed_parts');
        },
      },
      {
        kind: 'mg', game: 'tiles', title: '拼回琉璃拱门', stage: 'arch',
        async before() {
          await D.say('jiang', '拱门上的缠枝莲纹得一笔连一笔，转对了方向，纹路才能接上。');
        },
        async after() {
          await D.say('jiang', '接上了！白象、飞羊、狮子、飞天……一样不差！');
          await D.say('kangye', '六百年后，这些琉璃拱门的构件还有一部分收在博物馆里……颜色一点都没褪。', 'smile');
        },
      },
      {
        kind: 'level', id: 'c4-2', title: '塔身合拢', stage: 'pagoda',
        async after() {
          await D.cam(PX, PZ + 2, { dist: 30, pitch: 30, dur: 1.4 });
          await D.narrate('五色琉璃一层层垒上去，白瓷的塔身在阳光下亮得晃眼。');
          await D.say('kangye', '九层八面，将近八十米……难怪欧洲人把它和金字塔、长城放在一起，叫它「南京瓷塔」。', 'front');
          D.codex('porcelain_tower');
        },
      },
      {
        kind: 'level', id: 'c4-3', title: '挂上风铃', stage: 'bells',
        async after() {
          D.sfx('chime');
          await D.narrate('风一吹，塔檐下的铃铎叮叮当当地响成一片。');
          await D.say('seng', '风铃一响，满城都听得见。');
        },
      },
      {
        kind: 'level', id: 'c4-4', title: '修好配殿', stage: 'hall',
        async after() {
          await D.say('dugong', '配殿也立起来了！照这个进度，八月之前准能完工。');
          await D.say('dugong', '……陛下若是问起来，本官一定如实禀报——是一位姑娘帮的忙。');
        },
      },
      {
        kind: 'mg', game: 'lamps', title: '点亮长明灯', stage: 'lamps',
        async before() {
          await D.say('zheng2', '塔成之日，要点长明灯。九层八面，里里外外一百四十六盏，昼夜不熄。');
          await D.say('zheng2', '可这灯芯被啃坏了，点这盏，灭那盏——姑娘，你来试试。');
        },
        async after() {
          await D.fade(1, 700);
          D.g.setEnv('night');
          self.music = 'night'; self.ambient = 'night';
          D.music('night');
          D.g.particles.clearEmitters(); map.particles(D.g.particles, D.g);
          await D.fade(0, 900);
          await D.cam(PX, PZ + 2, { dist: 30, pitch: 30, dur: 1.2 });
          await D.narrate('入夜，一百四十六盏长明灯一齐亮起。整座琉璃塔通体透亮，秦淮河上、长江之中的船家，远远都望得见。');
          await D.say('kangye', '……原来这就是「不夜之塔」。', 'front');
          D.codex('changming_lamps');
        },
      },
      {
        kind: 'level', id: 'c4-5', title: '九级塔刹', stage: 'finial',
        async after() {
          await D.cam(PX, PZ, { dist: 32, pitch: 28, dur: 1.4 });
          await D.narrate('最后一层合拢，塔刹上的宝珠在夜空里放出金光。');
          await D.say('zheng2', '成了……先帝若是看得见，该有多高兴。');
          await D.say('zheng2', '姑娘，陛下又要咱家出海了。这一回，咱家已经快六十了——怕是最后一趟了。');
          await D.say('kangye', '……郑公公，一路平安。', 'serious');
          await D.think('宣德五年，郑和第七次下西洋。一般认为，他在归航途中病逝，再也没有回到南京。', 'side');
        },
      },
    ],
    async outro() {
      await D.say('aling', '第四枚踪印。晔晔，你闻到了吗？那股味道就在附近。');
      await D.say('kangye', '……你刚才叫我什么？', 'smile');
      await D.say('aling', '咳！本麟什么都没说！快走，下一站是秦淮河——那里的灯，比这塔上还多。');
      D.g.sparkleBurst({ x: PX, y: 6, z: PZ + 3 }, { x: 2, y: 3, z: 2 });
      D.sfx('magic');
    },
  };
  return self;
}
