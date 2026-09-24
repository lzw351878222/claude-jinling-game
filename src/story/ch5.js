// 第五章 · 灯市 —— 万历十五年（1587）上元，秦淮河
import { grid, spawnWorms, clearWorms, FX } from './common.js';

const W = 36, H = 26;
const HAI = { body: 'old', outfit: 'official', color: '#5a5a62', color2: '#3a3a40', patch: '#7a7a82', hat: 'wusha', beard: 'long', beardColor: '#e8e4dc', hair: 'white', eyes: 'narrow', seed: 101 };
const TANG = { body: 'man', outfit: 'robe', color: '#3a4a7a', color2: '#26304a', hat: 'fangjin', prop: 'fan', beard: 'mustache', seed: 102 };
const LAMP_COLS = ['#ff5a3a', '#ffb040', '#ff7a5a', '#ffd070'];

export default function ch5(D) {
  const map = {
    id: 'qinhuai', name: '秦淮河', era: '万历十五年（1587）· 上元',
    w: W, h: H, blockH: 3, seed: 111,
    env: { preset: 'festival' },
    camera: { dist: 22, pitch: 40, fov: 30 },
    music: 'festival', ambient: 'crowd',
    ground: grid(W, H, (x, z) => {
      if (z >= 11 && z <= 15) return '~';
      if (z === 10 || z === 16) return '=';
      if (z <= 2 && x >= 20) return '#';
      if (x >= 21 && z <= 9) return 'b';
      if (z <= 9) return (x >= 12 && x <= 17) ? 'j' : 'o';
      if (z >= 17 && z <= 18) return 'o';
      return (x + z) % 6 ? 'b' : 'B';
    }),
    spawns: { default: [18, 19.4, 'up'] },
    build(B) {
      // 北岸：夫子庙
      B.hall({ x: 8.5, z: 1, w: 12, d: 5, h: 2.8, roof: 'xieshan', tile: 'roof_grey', plat: 0.5, sign: '夫子庙', occluder: 'miao' });
      B.prop('stonelion', 11.4, 7.4); B.prop('stonelion', 18.6, 7.4);
      B.trees('pine', [[5.5, 3], [5.2, 7]]); B.tree('ginkgo', 2.5, 5);
      // 北岸东：江南贡院（明远楼 + 号舍）
      B.hall({ x: 25, z: 3, w: 5, d: 4, h: 2.3, roof: 'xieshan', tile: 'roof_dark', plat: 0.6, occluder: 'lou' });
      B.hall({ x: 25.8, z: 3.5, w: 3.4, d: 2.8, y: 3.3, h: 1.5, plat: 0.1, roof: 'xieshan', tile: 'roof_dark', occluder: 'lou', solid: false });
      for (let k = 0; k < 12; k++) {
        const x = 21.3 + k * 1.2;
        if (x > 24.4 && x < 30.6) continue;
        B.block('plaster', x, 0, 7.7, 1.0, 1.15, 0.5, { solid: true });
        B.block('c:#2a2420', x, 0.05, 7.97, 0.6, 0.85, 0.02, { shadow: false });
        B.block('roof_dark', x, 1.15, 7.7, 1.1, 0.1, 0.7);
      }
      // 北岸西：三山街书坊（世德堂）
      B.house({ x: 0.5, z: 3.2, w: 7, d: 4.6, upper: true });
      // 文德桥
      B.bridge({ x: 16, z: 10, len: 7, w: 4, dir: 'z', h: 1.1 });
      // 南岸：大照壁、乌衣巷人家、摊子
      B.block('plaster_red', 8.5, 0, 17.3, 7, 2.2, 0.4, { solid: true });
      B.block('roof_dark', 8.5, 2.2, 17.3, 7.3, 0.18, 0.7);
      B.house({ x: 0.5, z: 21.5, w: 6, d: 4.4, h: 2.2, occluder: 'h1' }); B.house({ x: 28.5, z: 21.5, w: 7, d: 4.4, h: 2.2, occluder: 'h2' });
      B.sign('乌衣巷', 7.2, 1.6, 21.2, { vertical: true, bg: '#26303a', h: 1.1 });
      B.trees('willow', [[1.5, 17], [24, 17], [34, 17.2], [9.5, 9.6], [31.2, 9.6]]);
      B.stall({ x: 12.6, z: 21.3, w: 2.2, sign: '元宵', awning: '#b8453a', goods: ['#f4f0e6', '#e8c070'] });
      B.stall({ x: 21.8, z: 21.3, w: 2.2, sign: '花灯', awning: '#3f7f6f', goods: ['#ff5a3a', '#ffb040'] });
      for (const x of [3.5, 26, 33]) B.lanternPost(x, 17.6);
      B.lanternString(20.6, 9.4, 35.4, 9.4, 2.6, 8, { colors: LAMP_COLS });
      // ---- 修复 1：荷花灯
      B.stage('hehua', () => {
        [[4, 12], [7, 13.6], [10.5, 12.2], [13, 14.2], [22, 12.4], [25.5, 14], [29, 12.3], [32.5, 13.8], [34.5, 12.2]].forEach(([x, z], i) => {
          B.tree('lotus', x, z, { scale: 0.7 });
          B.block('e:#ffc070', x, -0.22, z, 0.2, 0.12, 0.2, { shadow: false });
          if (i % 2 === 0) B.light(x, 0.2, z, '#ffb060', 0.7, { radius: 3, reflect: true });
          B.glow(x, 0, z, '#ffb060', 0.9);
        });
      });
      // ---- 修复 2：灯谜架
      B.stage('riddles', () => {
        B.block('wood_dark', 3.2, 0, 18.3, 0.12, 2.4, 0.12); B.block('wood_dark', 6.8, 0, 18.3, 0.12, 2.4, 0.12);
        B.lanternString(3.2, 18.3, 6.8, 18.3, 2.35, 4, { colors: LAMP_COLS });
        for (let i = 0; i < 4; i++) B.block('paper', 3.7 + i * 0.85, 1.3, 18.36, 0.22, 0.5, 0.02, { shadow: false });
      });
      // ---- 修复 3：世德堂
      B.stage('bookshop', () => {
        B.sign('世德堂', 5.6, 1.35, 7.86, { vertical: true, bg: '#1e2a3a', h: 1.25 });
        B.stall({ x: 1.2, z: 8.3, w: 2.4, d: 1.1, awning: '#6a4a8a', goods: ['#e8dcc0', '#c9b890'] });
        B.hangLantern(0.9, 2.3, 8.1, { color: '#ffb040' }); B.hangLantern(6.8, 2.3, 8.1, { color: '#ffb040' });
      });
      // ---- 修复 4：文德桥挂灯
      B.stage('bridge', () => {
        B.lanternString(16, 10.2, 16, 16.8, 2.2, 5, { colors: LAMP_COLS });
        B.lanternString(20, 10.2, 20, 16.8, 2.2, 5, { colors: LAMP_COLS });
        B.sign('文德桥', 18, 2.7, 16.9, { bg: '#26303a', h: 0.5 });
      });
      // ---- 修复 5：贡院
      B.stage('gongyuan', () => {
        B.sign('明远楼', 27.5, 4.55, 6.36, { bg: '#1e2a3a', h: 0.45 });
        B.hangLantern(25.6, 2.9, 7.4, { color: '#ffd070' }); B.hangLantern(29.4, 2.9, 7.4, { color: '#ffd070' });
        [['地', 21.9], ['宇', 23.1], ['洪', 31.7], ['荒', 32.9]].forEach(([t, x]) => B.sign(t, x, 1.62, 8.0, { vertical: true, bg: '#f0e2c0', color: '#2a2018', border: '#8a3a2a', h: 0.4 }));
      });
      // ---- 修复 6：灯船
      B.stage('boats', () => {
        B.ship({ x: 8, z: 13, kind: 'huafang', len: 6, beam: 1.9, solid: false });
        B.ship({ x: 27.5, z: 13.2, kind: 'huafang', len: 6, beam: 1.9, rot: Math.PI, solid: false });
      });
      // ---- 修复 7：鳌山灯
      B.stage('fireworks', () => {
        for (let k = 0; k < 5; k++) {
          const r = 1.6 - k * 0.28, y = k * 0.75;
          for (let a = 0; a < 8; a++) {
            const t = a / 8 * Math.PI * 2;
            B.block('e:' + LAMP_COLS[(a + k) % 4], 17.5 + Math.cos(t) * r, y + 0.4, 22.6 + Math.sin(t) * r * 0.6, 0.22, 0.26, 0.22, { shadow: false });
          }
        }
        B.light(17.5, 2.2, 22.8, '#ffb040', 1.6, { radius: 7 });
        B.glow(17.5, 2, 22.6, '#ffb040', 3.2, { opacity: 0.6 });
      });
    },
    particles(P, g) {
      P.addEmitter(FX.fireflies(0, 16, 36, 26));
      if (g.stagePart('fireworks')?.on) {
        P.addEmitter({ rate: 3, make: (r) => ({ x: 6 + r() * 24, y: 7 + r() * 4, z: 2 + r() * 8, vx: (r() - 0.5) * 2, vy: (r() - 0.5) * 2, vz: (r() - 0.5) * 2, size: 0.3 + r() * 0.3, shape: 'spark', color: LAMP_COLS[Math.floor(r() * 4)], alpha: 1, life: 1.2 + r(), fade: 'out', grav: 1.2, drag: 0.6 }) });
      }
    },
  };
  map.npcs = [
    { id: 'hai', name: '海瑞', sub: '南京右都御史', look: HAI, x: 13.6, z: 18.4, dir: 'up', voice: 'old' },
    { id: 'tang', name: '汤显祖', sub: '南京太常寺博士', look: TANG, x: 21.2, z: 18.6, dir: 'left', voice: 'male' },
    { id: 'shop', name: '唐掌柜', sub: '世德堂', look: { body: 'stout', outfit: 'robe', color: '#7a5a3a', color2: '#4a3828', hat: 'guapi', prop: 'book', seed: 103 }, x: 4.6, z: 9.2, dir: 'down', voice: 'male' },
    { id: 'xiucai', name: '秀才', look: { body: 'man', outfit: 'robe', color: '#4a6a5a', color2: '#2a4038', hat: 'rujin', prop: 'book', seed: 104 }, x: 24.6, z: 9.2, dir: 'up', voice: 'male' },
    { id: 'mi', name: '灯谜摊主', look: { body: 'old', outfit: 'short', color: '#8a5a3a', color2: '#5a4030', hat: 'wangjin', prop: 'lantern', beard: 'goatee', beardColor: '#cfcac2', seed: 105 }, x: 5, z: 19.2, dir: 'down', voice: 'old' },
    { id: 'kid1', name: '提兔子灯的孩子', look: { body: 'child', outfit: 'short', color: '#c43a2c', color2: '#6a3a2a', hat: 'twinbuns', prop: 'lantern', seed: 106 }, x: 11, z: 18.4, wander: [9, 17.8, 16, 19.5], voice: 'child' },
    { id: 'kid2', name: '看灯的小姑娘', look: { body: 'girl', outfit: 'skirt', color: '#f0a0b0', color2: '#8a6aa0', hat: 'twinbuns', prop: 'lantern', seed: 107 }, x: 25, z: 18.6, wander: [23, 17.8, 27, 19.5], voice: 'child' },
  ];
  const npc = Object.fromEntries(map.npcs.map((n) => [n.id, n]));
  npc.hai.talk = async () => {
    await D.say('hai', '老夫七十有三了。这一辈子，得罪的人比认识的人多。');
    await D.say('hai', '当年上疏之前，老夫先买好了一口棺材，跟家里人都交代过了——为官一任，总得有人说真话。');
  };
  npc.tang.talk = async () => {
    await D.say('tang', '在下临川汤显祖，在南京太常寺当个闲官。闲官好，闲了才能写戏。');
    await D.say('tang', '最近在改一部旧稿，叫《紫钗记》。写的是一枝紫玉钗……和一段痴情。');
  };
  npc.shop.talk = async () => {
    await D.say('shop', '三山街上书坊一家挨一家，咱们唐家的世德堂，刻的书插图最好看！');
    await D.say('shop', '不瞒姑娘说，小店正在张罗一部大书——讲一只石猴大闹天宫、保着和尚去西天取经。');
    D.codex('sanshanjie');
  };
  npc.xiucai.talk = async () => {
    if (!D.has('c5_gong')) {
      await D.say('xiucai', '明年就是大比之年，我特地来贡院看看号舍。可号舍墙上的字号，怎么都被啃花了……');
    } else {
      await D.say('xiucai', '原来贡院的号舍连「天」字都要避讳，天字第一号只是句俗话。受教了！');
    }
  };
  npc.mi.talk = async () => {
    await D.say('mi', '灯谜灯谜，猜中有赏！……哎，可惜谜底都被虫子啃了。');
  };
  npc.kid1.talk = async () => {
    await D.say('kid1', '明天正月十六，娘说要带我上城墙「走百病」！走一走，一年都不生病！');
    D.codex('zoubaibing');
  };
  npc.kid2.talk = async () => {
    await D.say('kid2', '姐姐你看，河上的灯连成一条线，像不像天上的银河掉下来了？');
  };
  map.things = [
    { x: 8.5, z: 18.2, r: 1.5, name: '大照壁', verb: '看看', talk: async () => {
      await D.say('kangye', '夫子庙对岸的大照壁，万历三年才修好，一百多米长。庙前的泮池，借的就是秦淮河的水。', 'q34');
      D.codex('fuzimiao');
    } },
  ];

  return {
    map,
    music: 'festival', ambient: 'crowd',
    listTitle: '点亮上元夜',
    sealDesc: '桨声灯影，一河星火。',
    async intro() {
      D.letterbox(true);
      spawnWorms(D, [[6, 19.5], [15, 19], [26, 18.6]]);
      await D.cam(17.5, 13, { dist: 28, pitch: 34, dur: 0.01 });
      await D.fade(0, 900, '#ffffff');
      await D.narrate('万历十五年，正月十五。秦淮河两岸本该灯火如昼——可今夜，河上黑沉沉的，连一盏灯都没有。');
      await D.cam(17.5, 17, { dist: 20, pitch: 40, dur: 2.2 });
      await D.say('mi', '怪了怪了！灯谜的谜底被虫子啃了，河灯的灯芯也被啃了，这元宵还怎么过？');
      await D.walk('kangye', 16.6, 18.6, { face: 'left' });
      await D.say('kangye', '万历十五年的上元节……阿麟，这一年很特别。', 'q34');
      await D.say('aling', '特别？本麟看着，跟别的年份也没什么两样。');
      await D.say('kangye', '就是因为「看着没什么两样」，所以才特别。', 'smile');
      await D.say('hai', '小姑娘，这么晚了，一个人出来看灯？');
      await D.say('kangye', '……海、海公？', 'front');
      await D.say('hai', '老夫姓海。怎么，认得老夫？');
      await D.think('海瑞，七十三岁，南京右都御史。这一年，他会在任上去世……', 'side');
    },
    steps: [
      {
        kind: 'level', id: 'c5-1', title: '放荷花灯', stage: 'hehua',
        async after() {
          clearWorms(D);
          await D.narrate('一盏盏荷花灯顺着秦淮河漂开，水面上亮起一条细细的光带。');
          await D.say('kid2', '亮了！河里的灯亮了！');
          D.codex('qinhuai_lanterns');
        },
      },
      {
        kind: 'level', id: 'c5-2', title: '挂起灯谜', stage: 'riddles',
        async after() {
          await D.walk('kangye', 5, 20.4, { face: 'up' });
          await D.say('mi', '谜底都补回来了！姑娘，来猜几个？猜中三个，老汉送你一盏兔子灯！');
          let ok = 0;
          await D.say('mi', '头一个：「日月同辉」——打一字。');
          let c = await D.choose(['明', '昌', '晶']);
          if (c === 0) { ok++; await D.say('mi', '明！日月合璧，正是咱们大明的「明」！'); } else await D.say('mi', '差了点——日月同辉，是个「明」字。');
          await D.say('mi', '第二个：「千里相逢」——打一字。');
          c = await D.choose(['逢', '重', '里']);
          if (c === 1) { ok++; await D.say('mi', '重！千里相逢，千加里，就是「重」。'); } else await D.say('mi', '是「重」字——千字叠在里字上头。');
          await D.say('mi', '最后一个：「一口咬掉牛尾巴」——打一字。');
          c = await D.choose(['吉', '午', '告']);
          if (c === 2) { ok++; await D.say('mi', '告！牛字去了尾巴，底下添个口！'); } else await D.say('mi', '是「告」字——牛没了尾巴，下面一个口。');
          if (ok === 3) { D.achieve('riddles_all'); await D.say('mi', '三个全中！打虎英雄啊，兔子灯拿好！'); }
          else await D.say('mi', '不要紧，灯谜嘛，图个乐呵。');
        },
      },
      {
        kind: 'mg', game: 'carve', title: '为世德堂刻版', stage: 'bookshop',
        async before() {
          await D.say('shop', '姑娘，救急！小店要刻的那部石猴取经的大书，写样的稿子被虫子啃得七零八落。刻工们对着反字，全乱套了！');
          await D.say('kangye', '雕版上的字是反的，印出来才是正的——我来帮您对。', 'serious');
        },
        async after() {
          await D.say('shop', '成了！等过几年全书刻完，就叫《新刻出像官板大字西游记》——世德堂的招牌，就靠它了！');
          await D.think('世德堂本《西游记》，万历二十年刊行，是现存最早的完整本。原来它的书版，有一块是我刻的。', 'smile');
          D.codex('shidetang', 'sanshanjie');
        },
      },
      {
        kind: 'level', id: 'c5-3', title: '文德桥挂灯', stage: 'bridge',
        async after() {
          await D.say('kangye', '文德桥……桥边那条小巷，就是乌衣巷吧？「旧时王谢堂前燕，飞入寻常百姓家。」', 'q34');
          await D.say('aling', '燕子年年都飞回来，一点也不记得原来的主人是谁——还是你们人记性好。');
          D.codex('wende_bridge', 'wuyixiang');
        },
      },
      {
        kind: 'level', id: 'c5-4', title: '找回号舍字号', stage: 'gongyuan',
        async after() {
          D.flag('c5_gong');
          await D.walk('kangye', 24, 9.4, { face: 'up' });
          await D.say('xiucai', '号舍的字号回来了！我要找「天字第一号」，考试时坐那里，准能高中！');
          await D.say('kangye', '号舍是按《千字文》编的没错——可贡院里，「天」「玄」这些字都要避开，哪来的天字号呀？', 'smile');
          await D.say('xiucai', '啊？那……那我岂不是白找了一晚上？');
          await D.say('kangye', '「天字第一号」是句俗话。与其找号舍，不如回去多读两页书。', 'smile');
          D.codex('gongyuan', 'qianziwen');
        },
      },
      {
        kind: 'level', id: 'c5-5', title: '灯船出巡', stage: 'boats',
        async after() {
          await D.walk('kangye', 19.6, 17.8, { face: 'right' });
          await D.say('tang', '桨声灯影……今夜的秦淮，真叫人心里发软。姑娘，若是写一部戏，头一句该怎么起？');
          await D.say('kangye', '（脱口而出）「情不知所起，一往而深。」', 'smile');
          D.emote('tang', '!');
          await D.say('tang', '好句！好句！情不知所起，一往而深……生者可以死，死可以生……');
          await D.say('tang', '姑娘，这一句，可否借给在下？将来写戏，想拿它做个开头。');
          await D.say('kangye', '（这本来就是您写的啊……）您拿去吧——就当是物归原主。', 'smile');
          await D.think('十一年后，汤显祖写成《牡丹亭》。题词里的第一句，就是这一句。', 'side');
          D.achieve('mudan');
          D.codex('tang_xianzu', 'mudan_line', 'qinhuai');
        },
      },
      {
        kind: 'level', id: 'c5-6', title: '万家灯火', stage: 'fireworks',
        async after() {
          D.sfx('firework');
          await D.cam(17.5, 16, { dist: 26, pitch: 34, dur: 1.4 });
          await D.narrate('鳌山灯一层层亮起，满天烟火映在秦淮河里。两岸的人都仰起了头。');
          await D.walk('kangye', 14.6, 18.6, { face: 'left' });
          await D.say('hai', '好看。老夫这一辈子，没几回像今夜这样，只是站着看灯。');
          const c = await D.choose(['「今年……后人会说，这是无关紧要的一年。」', '（什么也不说，陪他看灯）']);
          if (c === 0) {
            await D.say('kangye', '海公，您知道吗？很多年以后，有人写了一本书，说今年是「无关紧要的一年」。', 'serious');
            await D.say('hai', '无关紧要？哈哈……那样也好。天下太平，才会无事可记。');
            D.achieve('wanli');
          } else {
            await D.narrate('康晔什么也没说，只是陪着这位老人，看了很久很久的灯。');
          }
          await D.say('hai', '小姑娘，记住今晚的灯。人走了，灯还会一年一年地亮下去。');
          await D.think('这年秋天，海瑞在任上去世。出殡那天，南京城的百姓穿着白衣夹岸相送，百里不绝。', 'side');
          D.codex('hai_rui', 'wanli15');
        },
      },
    ],
    async outro() {
      await D.say('aling', '晔晔……五枚踪印，齐了。');
      D.g.sparkleBurst({ x: 17.5, y: 2, z: 18 }, { x: 3, y: 2, z: 2 });
      D.sfx('seal');
      await D.wait(600);
      D.shake(0.5, 1.2);
      D.music('tension');
      await D.narrate('秦淮河上的灯火忽然一齐摇晃起来。河面裂开一道漆黑的缝，缝里传出了沙沙的啃噬声。');
      await D.say({ name: '？？？', look: 'bigworm', voice: 'monster', foe: true }, '……记得……的人……找到……你了……');
      await D.say('kangye', '是它。', 'serious');
      await D.say('aling', '它把自己藏在时间最深的缝里。要结束这一切，只能跟过去。');
    },
  };
}
