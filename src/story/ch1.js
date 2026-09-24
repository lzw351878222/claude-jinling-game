// 第一章 · 窑火 —— 洪武十年（1377），聚宝门工地
import { grid, spawnWorms, clearWorms, FX } from './common.js';

const W = 34, H = 24;
export const ZHOU = { body: 'old', skin: 'tan', hair: 'grey', outfit: 'short', color: '#7a6048', color2: '#5a5048', hat: 'wangjin', beard: 'long', beardColor: '#cfcac2', eyes: 'narrow', seed: 21 };
export const LI = { body: 'man', outfit: 'official', color: '#3e5a7a', color2: '#27384d', patch: '#3a5f8a', hat: 'wusha', beard: 'mustache', eyes: 'stern', seed: 22 };
export const ZHU = { body: 'stout', outfit: 'robe', color: '#6a5840', color2: '#3a3028', hat: 'fangjin', beard: 'full', beardColor: '#2a2420', eyes: 'narrow', seed: 23 };
export const MA = { body: 'woman', outfit: 'skirt', color: '#8a5a4a', color2: '#5a6a5a', hat: 'bun', seed: 24 };

/** 聚宝门工地；o.epilogue = 尾声（洪武十九年，城墙告成） */
export const CH1_MAP = (o = {}) => ({
  id: 'jubaomen', name: '聚宝门', era: o.epilogue ? '洪武十九年（1386）' : '洪武十年（1377）',
  w: W, h: H, blockH: 5.5, seed: 31,
  env: { preset: o.epilogue ? 'morning' : 'day' },
  camera: { dist: 21, pitch: 40, fov: 30 },
  music: o.epilogue ? 'title' : 'hongwu', ambient: o.epilogue ? 'wind' : 'construction',
  ground: grid(W, H, (x, z) => {
    if (z <= 3 && x <= 10) return 'X';
    if (z <= 3 && x >= 24) return '#';
    if (z <= 4 && x >= 11 && x <= 23) return 'o';
    if (z >= 20 && z <= 22) return '~';
    if (z >= 23) return ',';
    if (x >= 15 && x <= 18) return 'o';
    if (x <= 9 && z >= 9 && z <= 15) return 'r';
    if (z === 19 || x === 0 || x === 33) return ',';
    if ((x <= 2 || x >= 31) && z >= 14) return '"';
    return '.';
  }),
  spawns: { default: [16.5, 18, 'up'] },
  build(B) {
    // 城台与门洞（门洞通向城内，这里不让走）
    B.cityGate({ x: 11, z: 0, w: 13, d: 5, h: 6.3, name: 'gate', arches: [{ x: 0, w: 3.4, h: 3.1 }], doors: true });
    B.world.markSolid(15, 0, 4, 3);
    // 护城河与长干桥
    B.bridge({ x: 15, z: 19, len: 5, w: 4, dir: 'z', h: 0.9 });
    B.trees('willow', [[4, 23.4], [11, 23.6], [23, 23.5], [30, 23.4]]);
    B.tree('reeds', 2, 19.6); B.tree('reeds', 27, 19.7); B.tree('reeds', 8, 19.5);
    // 窑（冷的）与柴垛
    B.kiln({ x: 5.2, z: 11.6, r: 1.9, fire: false });
    B.prop('firewood', 8.4, 13.4); B.prop('firewood', 2.6, 14.4);
    // 石灰池、工棚、茶摊
    B.prop('limepit', 11.5, 11);
    B.shed({ x: 26, z: 6.5, w: 4, d: 3 });
    B.prop('crate', 27, 10.5); B.prop('barrel', 28.4, 10.6); B.prop('jar', 29.4, 10.4);
    B.stall({ x: 25, z: 14, w: 2.2, sign: '茶', awning: '#8a6a4a', goods: ['#e8e2d0', '#6a8a5a'] });
    B.prop('bench', 26, 16.3);
    B.prop('cart', 9.8, 17, { rot: 0 });
    B.prop('timber', 29.5, 18);
    B.scatter('tuft', 0, 5, 34, 19, 30, { on: [1, 12] }); B.scatter('tuft', 0, 19, 34, 24, 20);
    B.tree('tree', 31.5, 13.5); B.tree('pine', 1.2, 17.2);
    // 城墙东段（已完工的那一截）
    for (let x = 24; x < 34; x++) B.block('citybrick', x + 0.5, 5.5, 3.6, 0.62, 0.55, 0.3);
    // ---- 修复 1：城砖
    B.stage('bricks', () => {
      for (const [x, z] of [[8.3, 7.4], [9.8, 7.6], [21.2, 7.2], [22.7, 7.6], [12.4, 16.8], [24, 11.2]]) B.prop('bricks', x, z, { n: 4 });
      B.prop('cart', 21.5, 16.6, { load: true, solid: false });
    });
    // ---- 修复 2：糯米灰浆
    B.stage('mortar', () => {
      B.prop('cauldron', 13.4, 13.2);
      B.prop('basket', 11.8, 13.6, { fill: '#f2eee0' });
      B.prop('jar', 14.9, 12.2);
    });
    // ---- 修复 3：验砖台
    B.stage('table', () => {
      B.prop('table', 20, 10.2);
      for (let k = 0; k < 3; k++) B.block('citybrick', 19.6 + k * 0.42, 0.76, 10.2, 0.4, 0.2, 0.2);
      B.sign('验', 21.4, 1.9, 9.6, { vertical: true, bg: '#f0e2c0', color: '#8a2a1a', border: '#8a3a2a', h: 0.8 });
      B.block('wood_dark', 21.4, 0, 9.6, 0.1, 1.6, 0.1);
    });
    // ---- 修复 4：脚手架
    B.stage('scaffold', () => { B.scaffold({ x: 0.6, z: 4.3, w: 9.6, h: 5 }); });
    // ---- 修复 5：窑火
    B.stage('kiln', () => {
      B.block('e:#ff7a2a', 5.2, 0.05, 13.52, 0.62, 0.55, 0.1, { shadow: false });
      B.light(5.2, 0.6, 14.2, '#ff8a3a', 1.6, { radius: 5.5 });
      B.glow(5.2, 0.5, 13.9, '#ff8a3a', 1.8, { nightOnly: false, opacity: 0.45 });
      B.prop('bricks', 3.2, 9.2, { n: 3, key: 'citybrick' });
    });
    // ---- 修复 6：城墙缺口
    B.ruin('wall', () => {
      const hs = [2.2, 3.1, 1.5, 2.6, 1.2, 0.8, 1.8, 2.9, 3.6, 4.2, 4.8];
      hs.forEach((h, i) => B.block('citybrick', i + 0.5, 0, 1.75, 1.02, h, 3.5));
      for (const [x, z] of [[2.5, 4.4], [5, 4.6], [6.3, 4.2]]) B.prop('rock', x, z, { scale: 0.7, solid: false });
    });
    B.stage('wall', () => {
      B.block('citybrick', 5.5, 0, 1.75, 11, 5.5, 3.5);
      for (let x = 0; x < 11; x++) B.block('citybrick', x + 0.5, 5.5, 3.35, 0.62, 0.55, 0.3);
      B.world.markSolid(0, 0, 11, 4);
    });
    // ---- 修复 7：城楼
    B.stage('gate', () => {
      B.hall({ x: 12.5, z: 0.6, w: 10, d: 3.8, y: 6.3, h: 2.1, plat: 0.15, roof: 'xieshan', tile: 'roof_grey', solid: false });
      for (const x of [11.4, 23.6]) B.prop('flagpole', x, 4.6, { y: 6.3, h: 3.2, color: '#c43a2c', solid: false });
      B.sign('聚宝门', 17.5, 5.55, 5.08, { bg: '#26303a', h: 0.78 });
    });
    if (o.epilogue) {
      B.lanternString(11, 4.9, 24, 4.9, 4.6, 7, { colors: ['#ff5a3a', '#ffb040'] });
      for (const x of [13, 21]) B.prop('flagpole', x, 18.4, { h: 4, color: '#d9a52a' });
    }
  },
  npcs: [],
  particles(P, g) {
    P.addEmitter(FX.dust(0, 4, 34, 20, '#f2e2c0'));
    if (g.stagePart('kiln')?.on) { P.addEmitter(FX.smoke(5.9, 4.4, 10.9)); P.addEmitter(FX.embers(5.2, 0.8, 13.9)); }
    if (g.stagePart('mortar')?.on) P.addEmitter({ ...FX.smoke(13.4, 1.0, 13.2, '#f4f0e8'), rate: 2 });
  },
});

export default function ch1(D) {
  D.cast.zhu = { name: '老员外', look: ZHU, voice: 'male' };
  D.cast.ma = { name: '马夫人', look: MA, voice: 'female' };
  const map = CH1_MAP();
  map.npcs = [
    { id: 'zhou', name: '周老汉', sub: '窑匠', look: ZHOU, x: 7.6, z: 11.8, dir: 'right', voice: 'old' },
    { id: 'li', name: '李主事', sub: '工部', look: LI, x: 18.6, z: 9.2, dir: 'down', voice: 'male' },
    { id: 'fu1', name: '运砖的民夫', look: { body: 'man', outfit: 'short', color: '#6a6a5a', color2: '#4a4a40', hat: 'toujin', prop: 'brick', skin: 'tan', seed: 25 }, x: 13, z: 8, wander: [11, 6, 22, 9], voice: 'male' },
    { id: 'fu2', name: '砌墙的匠人', look: { body: 'man', outfit: 'short', color: '#5a6a7a', color2: '#3a4048', hat: 'toujin', prop: 'hammer', skin: 'medium', seed: 26 }, x: 27.5, z: 5.2, dir: 'up', voice: 'male' },
    { id: 'kid', name: '小石头', sub: '周老汉的孙子', look: { body: 'child', outfit: 'short', color: '#8a6a4a', color2: '#5a4a3a', hat: 'twinbuns', seed: 27 }, x: 10.5, z: 14.5, wander: [9, 13, 13, 16], voice: 'child' },
  ];
  const npc = Object.fromEntries(map.npcs.map((n) => [n.id, n]));
  npc.zhou.talk = async () => {
    if (!D.has('c1_kiln')) {
      await D.say('zhou', '烧砖这活儿，讲究的是火候。火小了，砖是红的，一敲就闷；火大了，又会烧裂。');
      await D.say('zhou', '老汉烧了四十年砖，砖上的名字从来没丢过——直到这几天，冒出来那些银灰色的虫子……');
    } else {
      await D.say('zhou', '青砖出窑，敲起来当当响！姑娘，这一窑有你一半的功劳。');
    }
  };
  npc.li.talk = async () => {
    await D.say('li', '本官奉工部之命，督造京师城垣。每一块砖都要验过，不合格的，从哪个府县来，就退回哪个府县。');
    await D.say('li', '圣上说了，这城要修得比天下任何一座城都坚固。咱们应天府，可是天子脚下。');
    D.codex('yingtian');
  };
  npc.fu1.talk = async () => {
    await D.say('fu1', '这批砖是从江西袁州来的，走水路，顺着长江漂了一个多月呢。');
    await D.say('fu1', '听说城墙要用的砖，得有好几亿块。俺这辈子怕是数不过来咯。');
  };
  npc.fu2.talk = async () => {
    await D.say('fu2', '砌墙讲究一个「顺」字：砖要一丁一顺地摆，灰浆要抹得满满当当。');
    await D.say('fu2', '东边这截是去年砌好的，你摸摸，缝里硬得跟石头一样。');
  };
  npc.kid.talk = async () => {
    await D.say('kid', '姐姐，你身边那块小石头是会动的吗？我刚才好像看见它眨眼睛了！');
    await D.say('aling', '（阿麟一动不动，假装自己是块普通的石头。）');
    await D.say('kangye', '……你看错啦。', 'smile');
  };
  map.things = [
    { x: 12.8, z: 10.2, r: 1.6, name: '石灰池', verb: '看看', talk: async () => {
      await D.say('kangye', '一池生石灰。明代的城墙灰浆，就是拿它和糯米汤一起调的。', 'q34');
    } },
    { x: 20, z: 11.4, r: 1.3, name: '验过的砖', verb: '敲敲', when: () => D.has('c1_table'), talk: async () => {
      D.sfx('knock_good');
      await D.say('kangye', '当——声音又清又长。这才是合格的城砖。', 'smile');
      D.codex('wulegongming');
    } },
  ];

  return {
    map,
    music: 'hongwu', ambient: 'construction',
    listTitle: '重修聚宝门',
    sealDesc: '砖上一行名，城下六百年。',
    async intro() {
      D.letterbox(true);
      D.g.player.pos.set(16.5, 0, 22.2); D.g.player.dir = 'up';
      if (D.g.follower) { D.g.follower.pos.set(17.5, 0, 22.8); }
      spawnWorms(D, [[9, 8.6], [21.8, 8.4], [13.2, 15.6]]);
      await D.cam(16.5, 12, { dist: 26, pitch: 34, dur: 0.01 });
      await D.fade(0, 900, '#ffffff');
      await D.narrate('洪武十年，应天府。聚宝门的城台已经立了起来，可工地上却乱成了一锅粥。');
      await D.cam(16.5, 11, { dist: 21, pitch: 40, dur: 2.2 });
      await D.walk('kangye', 16.8, 15.5);
      await D.say('li', '这一批砖，名字全被啃花了！没有名字，谁知道是哪个窑、哪个人烧的？统统退回去重烧！');
      await D.say('zhou', '主事老爷，使不得！这可是窑里熬了三天三夜的砖啊……');
      await D.walk('kangye', 17.4, 11.2, { face: 'up' });
      D.emote('zhou', '?');
      await D.say('zhou', '哟，这是哪家的姑娘？穿得跟画上的仙姑似的。');
      await D.say('kangye', '我……我是从南边来的，会认几个字。', 'q34');
      await D.say('aling', '（悄悄）他们看不见本麟。在他们眼里，本麟就是块路边的石头。');
      await D.say('li', '会认字？好得很。工部正缺人手——砖上的名字要是补不回来，这一窑砖就全废了。');
      await D.say('kangye', '交给我吧。', 'smile');
      await D.think('那些银灰色的蠹，果然也钻到这里来了。');
    },
    steps: [
      {
        kind: 'level', id: 'c1-1', title: '运回城砖', stage: 'bricks',
        async after() {
          clearWorms(D);
          await D.say('zhou', '砖都运回来了，名字也清清楚楚！姑娘好本事。');
          await D.say('kangye', '周师傅，这砖上刻的「窑匠周大」……是您吗？', 'q34');
          await D.say('zhou', '正是老汉！排行老大，就叫周大。砖上刻了名，一辈子的脸面都在上头。');
          await D.think('六百年后，我在中华门读到的，就是他的名字……', 'smile');
        },
      },
      {
        kind: 'level', id: 'c1-2', title: '熬一锅糯米灰浆', stage: 'mortar',
        async after() {
          D.spawn({ id: 'ma', name: '马夫人', look: MA, x: 12.2, z: 14.6, dir: 'up', voice: 'female' });
          await D.say('ma', '大伙儿歇一歇，糯米汤熬好了——可不是给你们喝的，是给墙「喝」的。');
          await D.say('kangye', '糯米汤拌石灰？', 'q34');
          await D.say('ma', '糯米熬得稠稠的，调进石灰里，砌出来的墙又韧又结实。我家那口子说了，这城要守千年万年。');
          D.codex('nuomi_mortar');
          await D.think('这位夫人走起路来稳稳当当的……一双脚，没有裹过。');
        },
      },
      {
        kind: 'mg', game: 'bricks', title: '验砖', stage: 'table',
        async before() {
          await D.say('li', '光有名字还不够。敲一敲，看一看：声音清亮、颜色青灰的收下；发闷、发红、有裂纹的，退回！');
          await D.say('li', '还有那些被啃掉名字的，一块也不许混进去。');
        },
        async after() {
          D.flag('c1_table');
          await D.say('li', '好眼力！这就是朝廷的规矩——物勒工名，以考其诚。哪块砖出了事，都跑不了。');
          D.codex('wulegongming');
        },
      },
      {
        kind: 'level', id: 'c1-3', title: '搭起脚手架', stage: 'scaffold',
        async after() {
          D.spawn({ id: 'zhu', name: '老员外', look: ZHU, x: 12.6, z: 6.6, dir: 'down', voice: 'male' });
          await D.walk('kangye', 12.6, 8.6, { face: 'up' });
          await D.say('zhu', '姑娘，你说这城墙，能守多少年？');
          await D.say('kangye', '……六百年后，它还站在这儿。', 'serious');
          await D.say('zhu', '六百年？好大的口气！……不过，咱就爱听这话。');
          await D.say('zhu', '早年有位老先生跟咱讲过九个字：高筑墙，广积粮，缓称王。墙，是头一件。');
          await D.think('「高筑墙，广积粮，缓称王」——这是朱升给朱元璋的建议！这位老员外，该不会……');
          const c = await D.choose(['您……该不会就是……', '老员外，您这下巴可真……有福相。', '（什么也不说，笑一笑）']);
          if (c === 0) {
            await D.say('kangye', '您……该不会就是……', 'front');
            await D.say('zhu', '嘘——咱今天就是个出来看热闹的老头儿。');
            D.achieve('emperor');
          } else if (c === 1) {
            await D.say('kangye', '老员外，您这下巴可真……有福相。', 'smile');
            await D.say('zhu', '哈哈哈！你这丫头，胆子比城墙还厚！');
            D.achieve('emperor');
          } else {
            await D.say('zhu', '笑什么？咱脸上长字了不成？');
          }
          await D.say('zhu', '过年的时候，咱还要让家家户户门上贴副对子，图个吉利。姑娘也来凑个热闹。');
          D.codex('chunlian');
        },
      },
      {
        kind: 'mg', game: 'kiln', title: '烧一窑青砖', stage: 'kiln',
        async before() {
          await D.say('zhou', '坏了坏了——窑边墙上记火候的口诀，被那些银虫子啃掉了一半！这一窑要是烧坏了，就赶不上合龙了！');
          await D.say('kangye', '周师傅，我来帮您看火。', 'serious');
          await D.say('zhou', '先小火预热，再猛火烧透，然后保温，最后从窑顶窨水——砖才会由红转青。记住了？');
        },
        async after() {
          D.flag('c1_kiln');
          await D.say('zhou', '出窑咯——青砖！你听，敲起来当当响！');
          await D.say('kangye', '原来窨水是为了让窑里缺氧，把铁「还原」成青色……书上看过一百遍，不如亲手烧一窑。', 'smile');
          D.codex('qingzhuan');
        },
      },
      {
        kind: 'level', id: 'c1-4', title: '补上城墙缺口', stage: 'wall',
        async after() {
          D.shake(0.35, 0.6);
          D.sfx('scurry');
          await D.narrate('城墙刚合拢，一条比猫还大的银色蠹鱼从墙根窜了出来，一头钻进了地缝。');
          await D.say('aling', '那是只大的！它们的头儿，还躲在更深的地方。');
          await D.say('kangye', '更深的地方……是说时间更深处？', 'serious');
          await D.say('aling', '嗯。它从哪里来，本麟还闻不出来。但每修好一处，它的踪迹就清楚一分。');
          D.codex('city_wall');
        },
      },
      {
        kind: 'level', id: 'c1-5', title: '城门合龙', stage: 'gate',
        async after() {
          if (!D.g.actor('zhu')) D.spawn({ id: 'zhu', name: '老员外', look: ZHU, x: 13.2, z: 7, dir: 'down', voice: 'male' });
          if (!D.g.actor('ma')) D.spawn({ id: 'ma', name: '马夫人', look: MA, x: 14.2, z: 7.4, dir: 'down', voice: 'female' });
          await D.walk('kangye', 16.5, 8.8, { face: 'up' });
          await D.say('zhou', '城楼立起来喽！听老辈人讲，这南门屡筑屡塌，后来借了沈万三的聚宝盆埋在门下，才算立住——所以叫聚宝门。');
          await D.say('kangye', '这个传说我也听过。不过，更可能是因为城门外有座聚宝山。', 'smile');
          await D.say('zhu', '沈万三？哼。一个富户，出钱帮着修了三分之一的城墙也就罢了，还要替朝廷犒赏三军——他想做什么？');
          await D.say('ma', '他有钱是他的事。可他出钱修城，于国有功；真要因为富就治他的罪，天下人要怎么想？');
          await D.say('ma', '民富敌国，那是他自己不祥。老天自会罚他，用不着咱们动手。');
          await D.say('zhu', '……罢了罢了，听你的。');
          await D.think('《明史》里写过这一段——马皇后替沈秀求情。这位「马夫人」，是马皇后！', 'side');
          D.codex('jubaopen', 'empress_ma', 'zhu_yuanzhang');
        },
      },
    ],
    async outro() {
      await D.walk('kangye', 17, 9.5, { face: 'up' });
      await D.say('zhou', '姑娘，等这城墙全部完工那天，老汉请你喝酒！');
      await D.say('kangye', '一言为定！', 'smile');
      await D.say('aling', '看城门上头——蠹啃过的地方，留下了一道「踪」。');
      D.g.sparkleBurst({ x: 17.5, y: 4, z: 5 }, { x: 2, y: 2, z: 1 });
      D.sfx('magic');
      await D.say('aling', '修好了，踪就化成了印。集齐五枚踪印，就能找到蠹的老巢。');
    },
  };
}
