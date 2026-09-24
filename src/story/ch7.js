// 尾声 · 名字 —— 洪武十九年（1386）聚宝门 → 二〇二六年 中华门 → 明孝陵石象路
import { grid, alingJoin, FX } from './common.js';
import { CH1_MAP, ZHOU, LI } from './ch1.js';
import { PROLOGUE_MAP } from './ch0.js';

const CH1_DONE = ['bricks', 'mortar', 'table', 'kiln', 'wall', 'gate'];

/** 明孝陵石象路：六种石兽，每种两对，一跪一立 */
function shixiangluMap(D, onPat) {
  const W = 30, H = 20;
  const KINDS = ['lion', 'xiezhi', 'camel', 'elephant', 'qilin', 'horse'];
  return {
    id: 'shixianglu', name: '明孝陵 · 石象路', era: '二〇二六年 · 秋', modernClothes: true,
    w: W, h: H, blockH: 3, seed: 131,
    env: { preset: 'morning' },
    camera: { dist: 20, pitch: 38, fov: 30 },
    music: 'home', ambient: 'wind',
    ground: grid(W, H, (x, z) => {
      if (z >= 9 && z <= 11) return 'o';
      if (z === 8 || z === 12) return ';';
      return (x * 7 + z * 3) % 5 ? ',' : '"';
    }),
    spawns: { default: [2.2, 10, 'right'] },
    build(B) {
      KINDS.forEach((k, i) => {
        const x0 = 3.2 + i * 4.3;
        for (const [dx, pose] of [[0, 'kneel'], [2.1, 'stand']]) {
          B.beast(k, x0 + dx, 7.3, { pose });
          B.beast(k, x0 + dx, 12.9, { pose });
        }
      });
      for (let x = 1; x < W; x += 3.2) { B.tree('ginkgo', x, 4.5 + (x % 2), { scale: 1.2 }); B.tree('ginkgo', x + 1.4, 16.2 - (x % 2), { scale: 1.2 }); }
      B.scatter('tuft', 0, 0, W, H, 40); B.scatter('flowers', 0, 13, W, H, 10);
    },
    particles(P) { P.addEmitter(FX.leaves(0, 0, W, H, '#e8c040')); P.addEmitter(FX.dust(0, 5, W, 15)); },
    things: [
      { x: 3.2 + 4 * 4.3 + 2.1, z: 8.4, r: 1.5, name: '站着的石麒麟', verb: '摸摸头', talk: async () => { await onPat(); } },
    ],
    npcs: [
      { id: 'tourist', name: '晨练的阿姨', look: { body: 'oldwoman', outfit: 'modern', color: '#c9473d', color2: '#3a3a44', hair: 'grey', seed: 132 }, x: 9, z: 10.6, wander: [6, 9.4, 14, 10.8], voice: 'female',
        talk: async () => {
          await D.say('tourist', '姑娘，这么早来看石像生？秋天的石象路最好看，银杏叶子一落，满地金黄。');
          await D.say('tourist', '这些石兽在这儿站了六百多年喽。有人说夜里它们会悄悄活过来——你信不信？');
          await D.say('kangye', '……信。', 'smile');
        } },
    ],
  };
}

export default function ch7(D) {
  const map = CH1_MAP({ epilogue: true });
  const ZHOU_OLD = { ...ZHOU, hair: 'white', beardColor: '#f2eee6', seed: 141 };
  map.npcs = [
    { id: 'zhou9', name: '周老汉', sub: '窑匠', look: ZHOU_OLD, x: 15.2, z: 8.6, dir: 'down', voice: 'old' },
    { id: 'li9', name: '李郎中', sub: '工部', look: { ...LI, seed: 142 }, x: 19.4, z: 8.4, dir: 'down', voice: 'male' },
    { id: 'shitou', name: '石头', sub: '周老汉的孙子', look: { body: 'man', outfit: 'short', color: '#8a6a4a', color2: '#5a4a3a', hat: 'toujin', seed: 143 }, x: 13.6, z: 9.6, dir: 'right', voice: 'male' },
    { id: 'w1', name: '民夫', look: { body: 'man', outfit: 'short', color: '#6a6a5a', color2: '#4a4a40', hat: 'toujin', skin: 'tan', seed: 144 }, x: 22, z: 12, wander: [20, 10, 26, 14], voice: 'male' },
    { id: 'w2', name: '民夫', look: { body: 'man', outfit: 'short', color: '#5a6a7a', color2: '#3a4048', hat: 'toujin', seed: 145 }, x: 10, z: 12.5, wander: [8, 11, 13, 14], voice: 'male' },
  ];
  let resolvePat = null;
  const onPat = async () => {
    await D.narrate('石麒麟的头被六百年的风雨磨得圆润光滑，晒得暖暖的。');
    D.g.sparkleBurst({ x: 3.2 + 4 * 4.3 + 2.1, y: 1.5, z: 7.3 }, { x: 1, y: 1, z: 1 });
    D.sfx('chime');
    await D.say('aling', '（很轻很轻的声音）……本麟就知道，你会来的。');
    await D.say('kangye', '阿麟……', 'smile');
    D.achieve('qilin_pat');
    if (resolvePat) { const r = resolvePat; resolvePat = null; r(); }
  };

  return {
    map,
    forceStages: CH1_DONE,
    music: 'title', ambient: 'wind',
    onEnter() { alingJoin(D); },
    steps: [],
    async intro() {
      // ---- 一、洪武十九年，聚宝门
      D.letterbox(true);
      D.g.player.pos.set(16.5, 0, 12.2); D.g.player.dir = 'up';
      if (D.g.follower) D.g.follower.pos.set(17.5, 0, 12.8);
      await D.cam(16.5, 9, { dist: 24, pitch: 36, dur: 0.01 });
      await D.fade(0, 1200, '#ffffff');
      await D.narrate('洪武十九年，聚宝门。京城的城墙，终于合龙了。');
      D.sfx('firework');
      await D.cam(16.5, 10, { dist: 19, pitch: 40, dur: 1.8 });
      await D.say('shitou', '爷爷！爷爷你看——是那个仙姑姐姐！');
      await D.say('zhou9', '……姑娘？真的是你！九年了，老汉还当你是天上的仙姑，再也不回来了！');
      await D.walk('kangye', 15.2, 10.6, { face: 'up' });
      await D.say('kangye', '周师傅。您说过，城墙完工那天请我喝酒。', 'smile');
      await D.say('zhou9', '说过！说过！石头，拿碗来！');
      await D.narrate('一碗米酒递到手里。康晔抿了一口，辣得直皱眉头，周老汉笑得胡子都翘了起来。');
      await D.say('zhou9', '还有一样东西，老汉留了九年。');
      await D.narrate('周老汉从怀里捧出一块青砖。砖侧刻着府县、提调官、司吏……还有「窑匠周大」。最后一行，空着。');
      await D.say('zhou9', '这是那年你帮着烧的那一窑里，最好的一块。造砖人夫那一行，老汉一直空着没刻。');
      await D.say('zhou9', '这城墙里，有你的一份力气。姑娘，把你的名字刻上去吧。');
      await D.think('原来……原来是这样。', 'side');
      await D.narrate('康晔接过刻刀，一笔一画，在砖上刻下了两个字。');
      D.sfx('brush');
      await D.shout('kangye', '「康——晔」。', 'smile');
      await D.say('zhou9', '好名字！日光灿灿的「晔」。这块砖，老汉亲手把它砌进城门里的藏兵洞，保它六百年都不坏！');
      D.codex('wall_completed');
      await D.say('aling', '晔晔……时之隙要关了。');
      await D.say('zhou9', '去吧，去吧！姑娘——六百年后，替老汉看看，这城墙还在不在！');
      await D.say('kangye', '在的。它一直都在。', 'smile');
      // ---- 二、二〇二六年，中华门
      D.letterbox(false);
      await D.goto(PROLOGUE_MAP({ night: true }), { restored: ['inscription'], spawn: 'cave', color: '#ffffff', ms: 1100 });
      D.music('home');
      D.letterbox(true);
      await D.narrate('二〇二六年，秋夜。中华门。');
      await D.walk('kangye', 10.9, 3.0, { face: 'up' });
      await D.cam(10.9, 3.2, { dist: 12, pitch: 36, dur: 1.4 });
      await D.say('kangye', '「造砖人夫 康晔」……', 'q34');
      await D.say('kangye', '原来，是我自己刻的。', 'smile');
      D.music('sad');
      await D.walk('kangye', 10.9, 6.2, { face: 'down' });
      await D.say('aling', '晔晔，本麟该回去了。神道上空着一个位置，六百年都没空过。');
      await D.say('kangye', '……还能再见吗？', 'serious');
      await D.say('aling', '去孝陵的时候，从石象路走。站着的那对麒麟里，左边那只——就是本麟。');
      await D.say('aling', '摸摸本麟的头，本麟就知道你来了。');
      await D.say('kangye', '一言为定。', 'smile');
      const f = D.g.follower;
      if (f) { D.g.sparkleBurst(f.pos, { x: 1, y: 1.2, z: 1 }); D.sfx('magic'); D.remove('aling'); }
      D.flag('alingJoined', false);
      await D.wait(900);
      // ---- 三、明孝陵石象路
      D.letterbox(false);
      await D.goto(shixiangluMap(D, onPat), { ms: 1200 });
      D.music('home');
      await D.narrate('几天以后。明孝陵，石象路。');
      await D.think('狮子、獬豸、骆驼、象、麒麟、马……六种石兽，每种两对，一对跪卧，一对站立。', 'smile');
      await D.think('站着的那对麒麟，左边那只……', 'side');
      D.ui.setQuest('去找站着的那对石麒麟，左边那只', true);
      // 放开手脚，让玩家自己走过去
      await D.explore(() => new Promise((r) => { resolvePat = r; }));
      D.ui.setQuest(null, false);
      await D.cam(D.g.player.pos.x, D.g.player.pos.z - 2, { dist: 24, pitch: 34, dur: 2.2 });
      await D.narrate('风一吹，银杏叶落了满地。六百年前的城砖、书页、船帆、塔灯和花灯，都在这座城里，好好地待着。');
      await D.narrate('历史不会被遗忘——因为有人记得。');
      await D.fade(1, 1800);
    },
  };
}
