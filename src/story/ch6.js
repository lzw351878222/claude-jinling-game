// 终章 · 金陵 —— 时之隙：遗忘之蠹
import { grid, alingJoin } from './common.js';

const W = 30, H = 22;
const CX = 15, CZ = 11; // 中央浮岛
const FOE = { name: '遗忘之蠹', look: 'bigworm', voice: 'monster', foe: true };
// 五块碎片：各章的一角
const SHARDS = [
  { x: 4, z: 5, seal: '砖' }, { x: 26, z: 5, seal: '典' }, { x: 3.5, z: 15.5, seal: '槎' },
  { x: 26.5, z: 15.5, seal: '琉' }, { x: 15, z: 19.8, seal: '灯' },
];

export default function ch6(D) {
  const onIsland = (x, z) => Math.hypot(x + 0.5 - CX, (z + 0.5 - CZ) * 1.15) < 6.2;
  const map = {
    id: 'rift', name: '时之隙', era: '六百年的缝隙',
    w: W, h: H, blockH: 3, seed: 121, skirt: 0,
    env: { preset: 'rift' },
    camera: { dist: 22, pitch: 42, fov: 30 },
    music: 'rift', ambient: 'wind', noFollower: false,
    ground: grid(W, H, (x, z) => {
      if (onIsland(x, z)) return Math.hypot(x + 0.5 - CX, z + 0.5 - CZ) < 2.2 ? 'j' : '=';
      for (const s of SHARDS) if (Math.hypot(x + 0.5 - s.x, z + 0.5 - s.z) < 2.1) return 'X';
      return ' ';
    }),
    spawns: { default: [CX, CZ + 3.5, 'up'] },
    build(B) {
      // 中央浮岛与碎片的「根」：往下收窄的石块
      for (let k = 0; k < 4; k++) B.block('c:#2a2238', CX, -0.9 * (k + 1), CZ, 9 - k * 2.2, 0.9, 7.6 - k * 1.8);
      const [a, b, c, d, e] = SHARDS;
      for (const s of SHARDS) for (let k = 0; k < 3; k++) B.block('c:#2a2238', s.x, -0.8 * (k + 1), s.z, 2.6 - k * 0.8, 0.8, 2.6 - k * 0.8);
      for (let i = 0; i < 3; i++) B.block('citybrick', a.x - 1 + i, 0, a.z, 1, 2.2 - i * 0.5, 1.2);
      B.prop('bookshelf', b.x, b.z, { w: 2, h: 2 }); B.block('c:#d9b24a', b.x + 1.2, 0, b.z + 0.8, 0.5, 0.3, 0.4);
      B.ship({ x: c.x, z: c.z, kind: 'boat', len: 3.2, beam: 1.1, y: 0.2, solid: false });
      B.pagoda({ x: d.x, z: d.z, levels: 3, r: 0.8, levelH: 0.9 });
      B.lanternPost(e.x - 0.8, e.z); B.hangLantern(e.x + 0.8, 1.6, e.z, { color: '#ffb040' });
      // 五枚踪印（发光）
      for (const s of SHARDS) B.glowText(s.seal, s.x, 3.2, s.z + 1.2, { size: 0.5, color: '#ffe0b0', glow: '#ff6a4a' });
      // ---- 修复：光回到六百年的碎片上
      B.stage('light', () => {
        for (const s of SHARDS) { B.light(s.x, 2, s.z, '#ffe6a0', 1.4, { radius: 6 }); B.glow(s.x, 1.5, s.z, '#ffe6a0', 3, { nightOnly: false, opacity: 0.5 }); }
        B.light(CX, 3, CZ, '#fff2c8', 2, { radius: 10 });
        B.portal(CX, 1.4, CZ - 4.2, { r: 1.2, color: '#ffe6a0' });
      });
    },
    particles(P) {
      P.addEmitter({ rate: 10, make: (r) => ({ x: r() * W, y: -2 + r() * 8, z: r() * H, vx: (r() - 0.5) * 0.2, vy: 0.2 + r() * 0.3, size: 0.2 + r() * 0.3, shape: r() < 0.5 ? 'ink' : 'spark', color: r() < 0.5 ? '#0c0b10' : '#c8b8ff', alpha: 0.7, life: 5, fade: 'inout', drag: 0 }) });
    },
  };
  D.cast.foe = FOE;
  const spawnFoe = () => {
    if (D.g.actor('foe')) return D.g.actor('foe');
    return D.spawn({ id: 'foe', ...FOE, x: CX, z: CZ - 3.6, dir: 'down', scale: 2.6, float: 0.9, noTurn: true, solid: false });
  };

  return {
    map,
    music: 'rift', ambient: 'wind',
    listTitle: '与蠹一决',
    sealDesc: '',
    onEnter(D2, fresh) { alingJoin(D); if (!fresh) spawnFoe(); },
    async intro() {
      D.letterbox(true);
      D.g.player.pos.set(CX, 0, CZ + 4); D.g.player.dir = 'up';
      await D.cam(CX, CZ, { dist: 30, pitch: 36, dur: 0.01 });
      await D.narrate('时之隙。六百年的碎片悬浮在黑暗里：一截城墙、一架书、一只船、一座塔、一盏灯。');
      await D.cam(CX, CZ, { dist: 22, pitch: 42, dur: 2 });
      await D.say('aling', '五枚踪印都在发光……它就在这里。');
      D.shake(0.4, 1);
      D.sfx('scurry');
      const foe = spawnFoe();
      D.g.puff(foe.pos, { x: 3, y: 2, z: 2 }, '#1a1626');
      D.music('tension');
      await D.wait(700);
      await D.say('foe', '……沙……沙……你……又……来了……');
      await D.say('kangye', '你就是啃掉那些名字的蠹？', 'serious');
      await D.say('foe', '名字……砖上的名字……书里的字……船上的针路……塔上的灯……我吃了六百年……');
      await D.say('foe', '被忘记的东西……不会痛。没人记得的名字……就让它们……安安静静地……消失……有什么不好？');
      await D.say('kangye', '不好。', 'serious');
      await D.say('kangye', '那些名字后面，是一个个活生生的人。窑匠周大，誊录生，火长，琉璃匠……他们会被忘记，可他们不该被抹掉。', 'serious');
      await D.say('aling', '晔晔，小心！传说蠹鱼吃了三次「神仙」二字，就会化成「脉望」。这只蠹吃了六百年的名字——它想变成的，是让所有人都什么也不记得的东西！');
      D.codex('maiwang');
      await D.say('foe', '还剩……最后一个……砖上那个名字……吃掉它……就再也……没有人……会回来找了……');
      await D.say('kangye', '那你得先问问我，答不答应。', 'serious');
    },
    steps: [
      {
        kind: 'level', id: 'final', title: '击退遗忘之蠹', music: 'boss',
        async before() { await D.say('aling', '用寻踪之术打它！每修回一处踪迹，它就弱一分！'); },
        async after() {
          D.shake(0.5, 1);
          await D.say('foe', '……不……不可能……你……怎么还……记得……');
          await D.narrate('遗忘之蠹缩成一团，扯下一张张残破的书页裹住自己。书页上的字，全是被它吃掉的历史。');
          await D.say('foe', '那就……问你……看你……还记得……多少……');
        },
      },
      {
        kind: 'mg', game: 'quiz', title: '问史', stage: 'light',
        opts: (app) => ({ unlocked: app.state.codex.slice(), maxChapter: 5, music: 'boss' }),
        async before() {
          await D.say('kangye', '来吧。你吃掉的每一个字，我都替它们记着。', 'serious');
        },
        async after() {
          D.music('ending');
          const foe = D.g.actor('foe');
          if (foe) { D.g.sparkleBurst(foe.pos, { x: 4, y: 3, z: 3 }); D.g.puff(foe.pos, { x: 3, y: 2, z: 2 }, '#e8dcc0'); D.remove('foe'); }
          D.sfx('shatter');
          await D.narrate('遗忘之蠹碎成了千万片纸屑。每一片纸屑上，都浮起一个金色的字，慢慢飘回六百年的碎片里去。');
          D.flag('nishang');
          D.g.player.variant = '2';
          D.g.sparkleBurst(D.g.player.pos, { x: 1.5, y: 2, z: 1.5 });
          D.sfx('magic');
          await D.say('aling', '晔晔……你的衣服……');
          await D.say('kangye', '……五枚踪印的光？', 'front');
          await D.say('aling', '是踪印认了你。六百年的名字，都记住你了。');
          D.achieve('nishang');
          D.codex('ming_dynasty');
        },
      },
    ],
    async outro() {
      await D.say('kangye', '结束了吗？', 'q34');
      await D.say('aling', '蠹散了，可「遗忘」永远不会真的消失——只要有人记得，它就赢不了。');
      await D.say('kangye', '……阿麟，还有一件事没做完。', 'serious');
      await D.say('aling', '嗯？');
      await D.say('kangye', '那块砖。砖上的名字，总得有人去刻。', 'smile');
      await D.walk('kangye', CX, CZ - 3.2, { face: 'up' });
      D.sfx('whoosh');
      await D.fade(1, 1000, '#ffffff');
    },
  };
}
