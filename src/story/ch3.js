// 第三章 · 星槎 —— 永乐十三年（1415），龙江宝船厂
import { grid, spawnWorms, clearWorms, FX } from './common.js';

const W = 36, H = 24;
const ZHENG = { body: 'stout', outfit: 'official', color: '#9a2f24', color2: '#5a1c16', patch: '#d9a52a', hat: 'sanshan', eyes: 'normal', seed: 61 };
const MAHUAN = { body: 'man', outfit: 'robe', color: '#3a5a7a', color2: '#26384a', hat: 'fangjin', beard: 'goatee', prop: 'book', seed: 62 };
const HUOZHANG = { body: 'old', outfit: 'short', color: '#4a5a6a', color2: '#3a4048', hat: 'douli', beard: 'goatee', beardColor: '#bdb8ae', prop: 'compass', skin: 'tan', seed: 63 };
const SHIP = { x: 17, z: 4.2, len: 22, beam: 5.6 };

export default function ch3(D) {
  const map = {
    id: 'longjiang', name: '龙江宝船厂', era: '永乐十三年（1415）',
    w: W, h: H, blockH: 3, seed: 71,
    env: { preset: 'day' },
    camera: { dist: 22, pitch: 40, fov: 30 },
    music: 'shipyard', ambient: 'river',
    ground: grid(W, H, (x, z) => {
      if (z <= 8) return '~';
      if (z === 9) return 'w';
      if (z >= 22) return ',';
      if (x >= 28 && z >= 16) return '"';
      return (x + z) % 5 ? '.' : 'r';
    }),
    spawns: { default: [18, 19.5, 'up'] },
    build(B) {
      // 西边：船厂衙署（面朝东）；东边：工棚
      B.hall({ x: 0.5, z: 11, w: 6, d: 7, h: 2.5, roof: 'xuanshan', tile: 'roof_dark', plat: 0.35, rot: 1, occluder: 'office' });
      B.sign('宝船厂', 6.9, 1.6, 17.9, { vertical: true, bg: '#26303a', h: 1.4 });
      B.shed({ x: 29.5, z: 10.8, w: 5.5, d: 3.5 });
      B.prop('timber', 13, 21.2); B.prop('timber', 20, 21.4); B.prop('crate', 31, 15); B.prop('barrel', 32.4, 15.2);
      B.trees('willow', [[1.2, 21], [26.5, 22.4], [9, 22.8]]); B.tree('tree', 35, 15.5);
      // 船坞边的木栈道护栏（中间留出上船的口子）
      B.fence(0, 9.15, 13.5, 9.15); B.fence(20.5, 9.15, 36, 9.15);
      // 东南：「麒麟」的围栏
      B.fence(28, 16, 36, 16); B.fence(28, 16, 28, 18.4); B.fence(28, 20.2, 28, 23.4); B.fence(28, 23.4, 36, 23.4);
      B.prop('basket', 34.8, 17, { fill: '#6a9a4a' });
      B.tree('tree', 34.8, 21.6, { scale: 0.9 });
      // ---- 修复 1：丝绸瓷器
      B.stage('cargo', () => {
        for (let i = 0; i < 4; i++) B.block(['c:#c43a2c', 'c:#d9a52a', 'c:#3f7f6f', 'c:#e8e2d0'][i], 21.6 + i * 0.9, 0, 10.8, 0.8, 0.55, 0.6);
        for (let i = 0; i < 3; i++) B.block(['c:#b23a6a', 'c:#3a6fc4', 'c:#d9a52a'][i], 22 + i * 0.9, 0.55, 10.8, 0.8, 0.45, 0.6);
        B.prop('jar', 25.6, 10.6); B.prop('jar', 26.4, 11.1); B.prop('crate', 27.4, 10.7);
      });
      // ---- 修复 2：缆绳与锚
      B.stage('ropes', () => {
        B.prop('rope', 8.4, 10.6); B.prop('rope', 9.6, 11); B.prop('rope', 19.4, 10.6);
        B.prop('anchor', 11, 10.6); B.prop('anchor', 29.5, 9.8);
      });
      // ---- 修复 3：船身（之前只有龙骨和肋骨）
      B.ruin('hull', () => {
        B.block('wood_dark', SHIP.x, -0.2, SHIP.z, SHIP.len * 0.9, 0.4, 0.5);
        for (let i = 0; i < 11; i++) {
          const x = SHIP.x - SHIP.len * 0.4 + i * SHIP.len * 0.08;
          B.block('wood', x, -0.2, SHIP.z - SHIP.beam * 0.4, 0.25, 2.2, 0.2);
          B.block('wood', x, -0.2, SHIP.z + SHIP.beam * 0.4, 0.25, 2.2, 0.2);
          B.block('wood', x, 1.9, SHIP.z, 0.2, 0.2, SHIP.beam * 0.85);
        }
      });
      B.stage('hull', () => { B.ship({ x: SHIP.x, z: SHIP.z, kind: 'treasure', len: SHIP.len, beam: SHIP.beam, parts: 'hull', solid: false }); });
      // ---- 修复 4：海图台
      B.stage('chart', () => {
        B.prop('table', 11.5, 13.4, { scale: 1.4 });
        B.block('paper', 11.5, 0.82, 13.4, 1.5, 0.02, 0.9);
        B.glowText('针路', 11.5, 1.6, 13.9, { size: 0.16, light: false });
        B.prop('bamboo_rack', 13.6, 12.6);
      });
      // ---- 修复 5：风帆
      B.stage('sails', () => { B.ship({ x: SHIP.x, z: SHIP.z, kind: 'treasure', len: SHIP.len, beam: SHIP.beam, parts: 'rig', masts: 5, mastScale: 0.72 }); });
      // ---- 修复 6：天妃小庙
      B.stage('shrine', () => {
        B.pavilion({ x: 3.6, z: 20.2, r: 1.05, sides: 4, h: 1.9, tile: 'roof_dark', bench: false });
        B.sign('天妃', 3.6, 2.2, 21.5, { vertical: true, bg: '#7e2419', color: '#f0d890', border: '#d9a52a', h: 0.7 });
        B.hangLantern(2.6, 2.3, 21.4); B.hangLantern(4.6, 2.3, 21.4);
      });
      // ---- 修复 7：启航的旗
      B.stage('flags', () => {
        [[4, '#c43a2c'], [12.6, '#d9a52a'], [21.4, '#3f7f6f'], [30, '#c43a2c']].forEach(([x, c]) => B.prop('flagpole', x, 9.6, { h: 4.2, color: c, solid: false }));
        B.lanternString(13.6, 9.4, 20.4, 9.4, 3, 5, { colors: ['#ff5a3a', '#ffb040'] });
      });
    },
    particles(P) { P.addEmitter(FX.dust(0, 3, 36, 12, '#fff6dc')); },
  };
  map.npcs = [
    { id: 'zheng', name: '郑和', sub: '内官监太监', look: ZHENG, x: 17.4, z: 11.4, dir: 'down', voice: 'male' },
    { id: 'mahuan', name: '马欢', sub: '通事', look: MAHUAN, x: 23, z: 13.4, dir: 'left', voice: 'male' },
    { id: 'huozhang', name: '火长', sub: '领航', look: HUOZHANG, x: 11.6, z: 14.8, dir: 'up', voice: 'old' },
    { id: 'jiang', name: '造船匠', look: { body: 'man', outfit: 'short', color: '#6a5a4a', color2: '#4a4038', hat: 'toujin', prop: 'saw', skin: 'tan', seed: 64 }, x: 16, z: 19.8, wander: [11, 18.6, 22, 20.6], voice: 'male' },
    { id: 'giraffe', name: '「麒麟」', look: 'giraffe', x: 31.6, z: 19.4, dir: 'down', noTurn: true, wander: [29.6, 17.4, 34.6, 22.4], speed: 1.4, voice: 'qilin' },
  ];
  const npc = Object.fromEntries(map.npcs.map((n) => [n.id, n]));
  npc.zheng.talk = async () => {
    await D.say('zheng', '咱家这是第四回从西洋回来了。占城、满剌加、锡兰山、古里……最远的一回，到过忽鲁谟斯。');
    await D.say('zheng', '海上的风浪不怕，怕的是忘了回来的路。');
    D.codex('zheng_he');
  };
  npc.mahuan.talk = async () => {
    await D.say('mahuan', '在下马欢，会稽人，给船队当通事，也就是翻译。沿途各国的风俗、物产、说话，我都一一记在本子上。');
    await D.say('mahuan', '将来想把它整理成一部书，就叫……《瀛涯胜览》吧。');
    D.codex('ma_huan');
  };
  npc.huozhang.talk = async () => {
    if (!D.has('c3_chart')) {
      await D.say('huozhang', '针路簿是船队的命根子。哪一段用什么针、走几更、看哪颗星，全记在上面——现在被啃得七零八落！');
    } else {
      await D.say('huozhang', '白天看罗盘，夜里看星星。北辰星越往南越低，低到几指，就知道船到了哪里。');
      D.codex('qianxingban');
    }
  };
  npc.jiang.talk = async () => {
    await D.say('jiang', '这船厂有好几条作塘，就是挖在江边的大船坞。船在塘里造好，开闸放江水进来，船一浮起来，就能开进长江。');
    D.codex('longjiang_shipyard');
  };
  npc.giraffe.talk = async () => {
    if (D.has('giraffe_fed')) { await D.say('giraffe', '（「麒麟」低下长长的脖子，用脑袋轻轻蹭了蹭你。）'); return; }
    await D.say('giraffe', '（一头脖子长得不可思议的「麒麟」，正低头打量着你。）');
    await D.say('aling', '哼，什么麒麟，脖子那么长——本麟才是正经麒麟！');
    await D.say('kangye', '它饿了吧？喂它点什么好呢？', 'smile');
    const c = await D.choose(['一把青草', '树梢的嫩叶', '一个肉包子']);
    if (c === 1) {
      D.flag('giraffe_fed');
      D.sfx('good');
      await D.say('giraffe', '（「麒麟」伸长脖子，卷起嫩叶吃得津津有味。）');
      await D.say('kangye', '长颈鹿最爱吃高处的树叶。古人看它温顺、头上有角，就认定是仁兽麒麟。', 'smile');
      D.achieve('giraffe');
      D.codex('giraffe_qilin');
    } else if (c === 0) {
      await D.say('giraffe', '（「麒麟」闻了闻青草，勉强嚼了两口，又抬头望着树梢。）');
    } else {
      await D.say('giraffe', '（「麒麟」嫌弃地把头扭开了。）');
      await D.say('aling', '麒麟是仁兽，不吃荤！……这点它倒和本麟一样。');
    }
  };

  return {
    map,
    music: 'shipyard', ambient: 'river',
    listTitle: '整备宝船',
    sealDesc: '云帆高张，昼夜星驰。',
    async intro() {
      D.letterbox(true);
      spawnWorms(D, [[15, 11.2], [9.6, 12.2], [23.6, 12]]);
      await D.cam(17, 10, { dist: 28, pitch: 34, dur: 0.01 });
      await D.fade(0, 900, '#ffffff');
      await D.narrate('永乐十三年，龙江宝船厂。郑和的船队刚从西洋归来，作塘里却只剩一副光秃秃的龙骨。');
      await D.cam(17, 12, { dist: 21, pitch: 40, dur: 2.2 });
      await D.say('huozhang', '完了完了！针路簿被虫子啃了！下一回出洋的航路，全没了！');
      await D.say('zheng', '莫慌。船在，人在，路就还在。');
      await D.walk('kangye', 17.4, 13, { face: 'up' });
      await D.say('zheng', '这位姑娘，不像是船厂里的人。');
      await D.say('kangye', '我是……来帮忙的。那些啃坏针路簿的虫子，我认得。', 'serious');
      await D.say('zheng', '哦？那便有劳了。宝船要赶在季风之前修好，船厂上下正缺人手。');
      D.face('kangye', 'giraffe');
      D.emote('aling', '?');
      await D.say('aling', '那……那边那个脖子老长的，是什么东西？');
      await D.say('kangye', '长颈鹿。不过在这个年代，大家都叫它——「麒麟」。', 'smile');
      await D.say('aling', '胡说八道！本麟才是麒麟！');
    },
    steps: [
      {
        kind: 'level', id: 'c3-1', title: '装上丝绸瓷器', stage: 'cargo',
        async after() {
          clearWorms(D);
          await D.say('mahuan', '丝绸、瓷器、茶叶、铁器……这些都要带去换各国的香料、宝石和药材。');
          await D.say('mahuan', '姑娘，你把货码得真整齐，比码头上的老把式还利落。');
        },
      },
      {
        kind: 'level', id: 'c3-2', title: '备好缆绳与锚', stage: 'ropes',
        async after() {
          await D.say('zheng', '缆绳、铁锚都齐了。咱家常说，出海如行军：一样没备好，就一样都不能走。');
          D.codex('zheng_he');
        },
      },
      {
        kind: 'level', id: 'c3-3', title: '修补船身', stage: 'hull',
        async after() {
          await D.say('kangye', '好大的船……《明史》说宝船「修四十四丈、广十八丈」，真的有这么大吗？', 'front');
          await D.say('zheng', '船有大有小。这一艘，是船队里最大的几艘之一。');
          await D.think('宝船到底多大，六百年后的学者还在争论。船厂遗址挖出过十一米长的舵杆……光看舵，就知道小不了。', 'side');
          D.codex('treasure_ship', 'longjiang_shipyard');
        },
      },
      {
        kind: 'mg', game: 'star', title: '重走针路', stage: 'chart',
        async before() {
          await D.say('huozhang', '针路簿缺了好几页。要补回来，只能在海图上把整条航路重新走一遍——白天看罗盘，夜里看星。');
          await D.say('kangye', '单针、缝针、几更船……还有牵星板量北辰星。我试试！', 'serious');
        },
        async after() {
          D.flag('c3_chart');
          await D.say('huozhang', '一更也没算错！姑娘，你莫不是在海上跑过几十年的老火长？');
          await D.say('kangye', '我只是……在书里跑过很多遍。', 'smile');
          D.codex('zhenlu', 'qianxingban', 'zhenghe_map');
        },
      },
      {
        kind: 'level', id: 'c3-4', title: '升起风帆', stage: 'sails',
        async after() {
          await D.narrate('一面面红帆升上桅杆，江风一吹，鼓得满满的。');
          await D.say('zheng', '云帆高张，昼夜星驰——这是咱家最爱看的景象。');
        },
      },
      {
        kind: 'level', id: 'c3-5', title: '修好天妃小庙', stage: 'shrine',
        async after() {
          await D.say('zheng', '每回出海，都要先拜天妃。海上风浪莫测，求的是一个平安。');
          await D.say('zheng', '回来以后，陛下在龙江关建了天妃宫，又在狮子山下修了静海寺——四海平静，是咱们所有人的心愿。');
          D.codex('tianfei_jinghai');
        },
      },
      {
        kind: 'level', id: 'c3-6', title: '船队启航', stage: 'flags',
        async after() {
          await D.say('huozhang', '针路补齐，船也修好了——随时可以出洋！');
          await D.say('zheng', '姑娘，下一回出海，要不要跟咱家一起去看看？');
          await D.say('kangye', '……谢谢您。不过，我还有别的航路要走。', 'smile');
        },
      },
    ],
    async outro() {
      await D.say('aling', '踪印在船头发光呢——第三枚了。');
      D.g.sparkleBurst({ x: SHIP.x + 9, y: 2.5, z: SHIP.z + 1 }, { x: 1.5, y: 1.5, z: 1.5 });
      D.sfx('magic');
      await D.say('aling', '奇怪……蠹越来越少，可剩下的那只大的，气味越来越重了。它在往一个地方聚。');
      await D.say('kangye', '往哪儿？', 'serious');
      await D.say('aling', '……往塔那边。长干里，那座会发光的塔。');
    },
  };
}
