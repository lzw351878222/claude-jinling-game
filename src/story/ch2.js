// 第二章 · 文渊 —— 永乐五年（1407），文渊阁
import { grid, spawnWorms, clearWorms, FX } from './common.js';

const W = 32, H = 24;
const XIE = { body: 'man', outfit: 'official', color: '#3a6a5a', color2: '#26443a', patch: '#4a7a6a', hat: 'wusha', beard: 'goatee', eyes: 'normal', seed: 41 };
const YAO = { body: 'old', outfit: 'monk', color: '#26262c', color2: '#1a1a20', hat: 'bald', beard: 'long', beardColor: '#d8d4cc', eyes: 'narrow', prop: 'beads', seed: 42 };
const SHEN = { body: 'man', outfit: 'robe', color: '#5a4a6a', color2: '#3a3044', hat: 'fangjin', beard: 'long', beardColor: '#2a2420', prop: 'brush', seed: 43 };

export default function ch2(D) {
  const map = {
    id: 'wenyuan', name: '文渊阁', era: '永乐五年（1407）',
    w: W, h: H, blockH: 3, seed: 51,
    env: { preset: 'morning' },
    camera: { dist: 20, pitch: 41, fov: 30 },
    music: 'library', ambient: 'library',
    ground: grid(W, H, (x, z) => {
      if (z === 0 || x === 0 || x === W - 1) return '#';
      if (z <= 6 && x >= 9 && x <= 22) return 'j';
      if (x >= 24 && x <= 27 && z >= 19 && z <= 22) return '~';
      if (z >= 18) return (x + z) % 3 ? ',' : '"';
      if (x >= 14 && x <= 17) return 'B';
      if (x <= 3 || x >= 28) return 'W';
      return 'b';
    }),
    spawns: { default: [15.5, 19.5, 'up'] },
    build(B) {
      // 文渊阁正殿（匾额要等沈度重写）
      B.hall({ x: 9.5, z: 1, w: 13, d: 5.2, h: 3, roof: 'xieshan', tile: 'roof_yellow', plat: 0.5, occluder: 'hall', bays: 5 });
      // 东西两侧窄廊
      B.hall({ x: 1, z: 7, w: 3, d: 10, h: 2.3, roof: 'xuanshan', tile: 'roof_grey', plat: 0.3, rot: 1, front: 'open' });
      B.hall({ x: 28, z: 7, w: 3, d: 10, h: 2.3, roof: 'xuanshan', tile: 'roof_grey', plat: 0.3, rot: 3, front: 'open' });
      B.tree('pine', 7.5, 3.5); B.tree('pine', 24.5, 3.6); B.prop('stele', 26.5, 5.2);
      // 南边的小园：池、太湖石、竹、桂
      B.tree('lotus', 25.4, 19.6); B.tree('lotus', 26.8, 20.6); B.tree('lotus', 25, 21.2);
      B.prop('taihu', 28.6, 19.2, { scale: 0.9 }); B.prop('taihu', 22.6, 21.2, { scale: 0.7 });
      B.trees('bamboo', [[2.2, 19.5], [3.2, 21], [4.6, 20.2], [1.8, 22]]);
      B.tree('osmanthus', 8.5, 19.8); B.tree('osmanthus', 21.8, 18.3); B.tree('plum', 11.2, 21.6);
      B.prop('incense', 15.5, 11.2);
      B.scatter('tuft', 1, 18, 31, 23, 16); B.scatter('flowers', 5, 18, 12, 23, 6);
      // ---- 修复 1：书案
      B.stage('desks', () => {
        for (const [x, z] of [[6.5, 9.6], [9.8, 9.6], [6.5, 12.4], [9.8, 12.4], [21.4, 15.2], [24.6, 15.2]]) B.prop('desk', x, z);
      });
      // ---- 修复 2：芸草
      B.stage('yunxiang', () => {
        for (const [x, z] of [[13, 7.3], [18, 7.3], [13, 16.4], [18, 16.4]]) { B.prop('jar', x, z, { scale: 0.8 }); B.tree('bush', x, z + 0.05, { scale: 0.5, solid: false }); }
      });
      // ---- 修复 3：书架
      B.stage('shelves1', () => { for (const x of [5.6, 8.2, 10.8]) B.prop('bookshelf', x, 15.3, { w: 2.2, h: 2.1 }); });
      // ---- 修复 4：经史子集
      B.stage('shelves2', () => {
        [['经', 19.6], ['史', 22.2], ['子', 24.8], ['集', 27.4]].forEach(([t, x]) => {
          B.prop('bookshelf', x, 9.4, { w: 2.2, h: 2.1 });
          B.sign(t, x, 2.75, 9.72, { vertical: true, bg: '#f0e2c0', color: '#2a2018', border: '#8a3a2a', h: 0.62 });
        });
      });
      // ---- 修复 5：匾额
      B.stage('plaque', () => { B.sign('文渊阁', 16, 3.25, 6.3, { bg: '#1e3a4a', h: 0.8 }); });
      // ---- 修复 6：廊灯
      B.stage('lanterns', () => {
        for (const z of [9, 13.2]) { B.lanternPost(13, z); B.lanternPost(18.6, z); }
        B.hangLantern(11.6, 3.5, 6.7, { color: '#ffb050' }); B.hangLantern(20.4, 3.5, 6.7, { color: '#ffb050' });
      });
      // ---- 修复 7：大典
      B.stage('dadian', () => {
        B.prop('table', 15.5, 8.4, { scale: 1.3 });
        for (let k = 0; k < 6; k++) B.block('c:#d9b24a', 14.9 + (k % 3) * 0.45, 0.8 + Math.floor(k / 3) * 0.15, 8.4, 0.4, 0.14, 0.3);
        B.block('c:#b23a2e', 16.1, 1.1, 8.4, 0.12, 0.3, 0.3);
      });
    },
    particles(P) { P.addEmitter(FX.dust(2, 6, 30, 22, '#fff2cc')); P.addEmitter(FX.petals(2, 16, 30, 24, '#f7e8a0')); },
  };
  map.npcs = [
    { id: 'xie', name: '解缙', sub: '翰林学士', look: XIE, x: 15.5, z: 10.2, dir: 'down', voice: 'male' },
    { id: 'shen', name: '沈度', sub: '翰林典籍', look: SHEN, x: 20.6, z: 12.4, dir: 'left', voice: 'male' },
    { id: 's1', name: '誊录生', look: { body: 'man', outfit: 'robe', color: '#4a5a7a', color2: '#2a3040', hat: 'rujin', prop: 'book', seed: 44 }, x: 8.2, z: 11, dir: 'down', voice: 'male' },
    { id: 's2', name: '老誊录生', look: { body: 'old', outfit: 'robe', color: '#6a5a4a', color2: '#3a3028', hat: 'rujin', beard: 'goatee', beardColor: '#bdb8ae', prop: 'scroll', seed: 45 }, x: 23, z: 12.6, wander: [20, 11.5, 26, 13.5], voice: 'old' },
    { id: 'yao', name: '姚广孝', sub: '道衍', look: YAO, x: 8.8, z: 13.8, dir: 'right', voice: 'old' },
    { id: 'tong', name: '小书童', look: { body: 'child', outfit: 'short', color: '#7a8a5a', color2: '#4a5040', hat: 'twinbuns', prop: 'broom', seed: 46 }, x: 12, z: 18.5, wander: [9, 17.5, 20, 19.5], voice: 'child' },
  ];
  const npc = Object.fromEntries(map.npcs.map((n) => [n.id, n]));
  npc.xie.talk = async () => {
    await D.say('xie', '陛下说了：凡书契以来经史子集百家之书，天文地志、阴阳医卜、僧道技艺之言，统统备辑为一书，毋厌浩繁！');
    await D.say('xie', '毋厌浩繁——说得轻巧，两千多号人抄了两年，还没抄完哪！');
  };
  npc.shen.talk = async () => {
    await D.say('shen', '写字如做人，一笔一画都要端正。台阁里的字，要让万国使臣一看，便知大明气象。');
  };
  npc.s1.talk = async () => {
    await D.say('s1', '我一天要抄好几千字，手腕都快断了。可一想到这书要流传千秋万代……还是接着抄吧。');
  };
  npc.s2.talk = async () => {
    await D.say('s2', '老朽抄过《文献大成》，如今又来抄大典。前后一百多人编的书，陛下嫌不够齐全，这回动了两千多人。');
    await D.say('s2', '抄完的书都按韵排——想找「天」字，就到「天」字底下去翻。');
  };
  npc.yao.talk = async () => {
    await D.say('yao', '贫僧年少出家，却偏偏学了一肚子兵法术数。世人叫我黑衣宰相——黑衣是真的，宰相是虚的。');
  };
  npc.tong.talk = async () => {
    await D.say('tong', '先生们说，书房里要放芸草，蠹鱼闻了就不敢来。可是我闻着……挺香的呀？');
  };
  map.things = [
    { x: 15.5, z: 12.4, r: 1.3, name: '香炉', verb: '看看', talk: async () => {
      await D.say('kangye', '香炉里燃着一线香。满院子都是墨香、纸香、芸草香——这就是「书香」吧。', 'smile');
    } },
  ];

  return {
    map,
    music: 'library', ambient: 'library',
    listTitle: '护书文渊阁',
    sealDesc: '书能散佚，读书的种子不会。',
    async intro() {
      D.letterbox(true);
      spawnWorms(D, [[11, 10.8], [20, 11], [5.5, 12.4], [15.5, 14]]);
      await D.cam(15.5, 11, { dist: 24, pitch: 36, dur: 0.01 });
      await D.fade(0, 900, '#ffffff');
      await D.narrate('永乐五年，京师。文渊阁里，两千多名文士正在誊录一部前所未有的大书。');
      await D.cam(15.5, 11.5, { dist: 20, pitch: 41, dur: 2 });
      await D.say('xie', '怪事！怪事！昨夜刚誊好的三卷，今早一翻——白纸一张！连个墨点都没剩下！');
      await D.walk('kangye', 15.5, 12.8, { face: 'up' });
      await D.say('xie', '你是新来的誊录生？字写得怎么样？……罢了罢了，先别管字了，快来帮忙！');
      await D.say('kangye', '（小声）阿麟，是蠹吧？', 'serious');
      await D.say('aling', '是它们。这里的纸多，它们吃得更欢了。');
      D.music('mystery');
      await D.cam(10.5, 13, { dist: 15, pitch: 38, dur: 1.2 });
      await D.say({ name: '黑衣老僧', look: YAO, voice: 'old' }, '阿弥陀佛。施主身边那位小友，倒是许久不见了。');
      D.emote('aling', '!');
      await D.say('aling', '他……他看得见本麟？！');
      await D.say('yao', '贫僧法号道衍，俗姓姚。施主不必惊慌——该来的，总会来。');
      await D.think('道衍……姚广孝？「黑衣宰相」？', 'side');
      D.music('library');
      await D.camBack(1);
    },
    steps: [
      {
        kind: 'level', id: 'c2-1', title: '摆好誊录的书案', stage: 'desks',
        async after() {
          await D.say('xie', '书案摆齐了！快，笔墨伺候，能抄一卷是一卷。');
          D.codex('wenyuange');
        },
      },
      {
        kind: 'mg', game: 'bookworm', title: '护书捉蠹', stage: 'yunxiang',
        async before() {
          D.sfx('scurry');
          await D.say('s1', '啊！书架底下爬出来好多银虫子——往书页上爬过去了！');
          await D.say('kangye', '捉蠹！一只也别让它们啃到字！', 'serious');
        },
        async after() {
          clearWorms(D);
          await D.say('yao', '书中夹上芸草，蠹鱼便不敢近。古人管书房叫芸窗，管藏书之所叫芸台、芸阁，就是这个缘故。');
          D.codex('yunxiang');
        },
      },
      {
        kind: 'level', id: 'c2-2', title: '扶起书架', stage: 'shelves1',
        async after() {
          await D.say('xie', '好好好！姑娘手脚麻利，脑子想必也灵光。解某出个上联，你来对下联！');
          await D.say('xie', '上联：「门对千竿竹」。');
          let ok = 0;
          let c = await D.choose(['家藏万卷书', '窗含千秋雪', '门泊万里船']);
          if (c === 0) { ok++; await D.say('xie', '妙！「家藏万卷书」——竹对书，千对万，工工整整！'); } else await D.say('xie', '唔……意思有了，对仗差了一点。正解是「家藏万卷书」。');
          await D.say('xie', '再来！上联：「天作棋盘星作子，谁人敢下」。');
          c = await D.choose(['风吹柳絮雪吹花，何处堪寻', '地为琵琶路为弦，哪个能弹', '山当笔架月当灯，何人来写']);
          if (c === 1) { ok++; await D.say('xie', '「地为琵琶路为弦，哪个能弹」——好气魄！天对地，下对弹，你这丫头有意思！'); } else await D.say('xie', '差一点点。天对地，棋盘对琵琶——「地为琵琶路为弦，哪个能弹」。');
          if (ok === 2) D.achieve('couplets');
          await D.think('这两副对子，后世都说是解缙对的……原来是真的？还是后人附会？', 'smile');
          D.codex('xie_jin');
        },
      },
      {
        kind: 'mg', game: 'books', title: '经史子集归架', stage: 'shelves2',
        async before() {
          await D.say('xie', '东廊的书架也倒了，书全混在一处！经史子集，得一本本分清楚。');
        },
        async after() {
          await D.say('xie', '经、史、子、集，各归其位。有了这四部，天下的书就都找得着家了。');
          await D.say('kangye', '不过大典本身不按四部排——按韵排，对吧？用《洪武正韵》，以韵统字，以字系事。', 'q34');
          await D.say('xie', '哟，你连这都知道？');
          D.codex('jingshiziji', 'hongwu_zhengyun');
        },
      },
      {
        kind: 'level', id: 'c2-3', title: '重写文渊阁匾额', stage: 'plaque',
        async after() {
          await D.say('shen', '匾额上的字也被啃没了。无妨，沈某再写一遍便是。');
          await D.narrate('沈度提笔，一气写下「文渊阁」三字，端庄匀净，雍容大方。');
          await D.say('s1', '沈学士的字，连陛下都夸是「我朝王羲之」！');
          D.codex('shen_du');
        },
      },
      {
        kind: 'level', id: 'c2-4', title: '点亮廊灯', stage: 'lanterns',
        async after() {
          await D.walk('kangye', 10.8, 14.2, { face: 'left' });
          D.music('mystery');
          await D.say('yao', '灯亮了。施主可知，这满院的书，有多少是差一点就再也见不到的？');
          await D.say('yao', '当年大军南下，贫僧跟燕王说过一句话：城破之日，方孝孺必不肯降，千万莫杀他——杀了他，天下读书的种子就绝了。');
          await D.say('kangye', '……可他还是杀了。', 'serious');
          await D.say('yao', '是啊。贫僧劝得住千军万马，劝不住一个人的怒气。');
          await D.say('yao', '书能烧，人能杀。可只要还有一个人记得，种子就还在土里。施主，你就是那个记得的人。');
          D.codex('yao_guangxiao', 'fang_xiaoru');
          D.music('library');
        },
      },
      {
        kind: 'level', id: 'c2-5', title: '大典成册', stage: 'dadian',
        async after() {
          await D.walk('kangye', 15.5, 10.8, { face: 'up' });
          await D.say('xie', '成了！正文两万两千八百多卷，凡例目录六十卷，一万一千多册……这是自有文字以来，最大的一部书！');
          await D.say('kangye', '（小声）可惜后来正本不知所终，嘉靖年间抄的副本，传到今天只剩四百来册……', 'serious');
          await D.say('aling', '所以才更要记得它。');
          D.codex('yongle_dadian', 'zhu_di');
        },
      },
    ],
    async outro() {
      await D.say('yao', '孝陵的小麒麟，你家主人那边，替贫僧问一声安。');
      await D.say('aling', '……哼，这老和尚，怪得很。');
      await D.say('yao', '去吧。下一站，是海。');
      D.g.sparkleBurst({ x: 15.5, y: 1.2, z: 8.2 }, { x: 1.5, y: 1, z: 1 });
      D.sfx('magic');
    },
  };
}
