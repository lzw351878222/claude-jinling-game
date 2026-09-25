// 自动试玩（开发自测）：node tools/autoplay.mjs [秒数=120] [宽x高] [截图前缀] [起始参数]
// 自动推进对话、点第一个选项、点章节卡、自动下消消乐（用提示）、点「闯关」，定时截图并输出控制台日志。
import { openPage } from './cdp.mjs';

const secs = Number(process.argv[2] || 120);
const [w, h] = (process.argv[3] || '1280x720').split('x').map(Number);
const prefix = process.argv[4] || 'play';
const query = process.argv[5] || '';
const p = await openPage(`http://localhost:5173/index.html${query}`, { w, h, mobile: w < 700 });
const t0 = Date.now();
let shotN = 0, lastShot = 0, lastKind = '';
const shot = async (tag) => { const f = `tools/.cache/shots/${prefix}-${String(++shotN).padStart(2, '0')}-${tag}.png`; await p.shot(f); console.log('shot', f); };

await p.wait(2500);
if (!query.includes('ch=')) {
  await shot('title');
  await p.clickText('开始旅程').catch(async () => { await p.clickText('重新开始'); await p.wait(500); await p.clickText('重新开始'); });
}
let mgSeen = 0;
let idleSince = 0;

while ((Date.now() - t0) / 1000 < secs) {
  const s = await p.eval(`(() => {
    const q = (sel) => document.querySelector(sel);
    const vis = (e) => e && e.offsetParent !== null;
    if (q('.chapcard')) return { k: 'chapcard' };
    if (q('.sealfx')) return { k: 'seal' };
    if (q('.getcard')) return { k: 'getcard' };
    if (q('.credits')) return { k: 'credits' };
    const mgCard = q('.mg-modal .jl-btn.primary'); if (mgCard) return { k: 'mgcard', t: mgCard.textContent };
    if (q('.mg-overlay')) return { k: 'minigame' };
    const m3Card = q('.m3-modal .jl-btn.primary'); if (m3Card) return { k: 'm3card', t: m3Card.textContent };
    if (q('.m3')) { const m = window.__m3; return { k: 'm3', busy: !m || m.ctl.busy, moves: m && m.board.moves }; }
    const ch = q('.choices'); if (ch) return { k: 'choice', t: ch.textContent };
    const d = q('.dlg'); if (d) return { k: 'dlg', done: d.classList.contains('done'), t: d.textContent.slice(0, 60) };
    const play = q('.hub-play.ready'); if (play && !q('.hub.hidden')) return { k: 'hub', t: play.textContent };
    if (q('.title')) return { k: 'title' };
    return { k: 'idle' };
  })()`).catch((e) => ({ k: 'err', e: String(e) }));
  if (s.k !== lastKind) { console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, JSON.stringify(s)); }
  const changed = s.k !== lastKind;
  if (s.k !== 'idle') idleSince = 0;
  lastKind = s.k;
  if (changed && ['chapcard', 'seal', 'hub', 'm3card', 'mgcard', 'minigame', 'credits', 'choice'].includes(s.k)) await shot(s.k);
  else if (Date.now() - lastShot > 15000) { lastShot = Date.now(); await shot(s.k); }
  switch (s.k) {
    case 'chapcard': await p.wait(1500); await p.click(w / 2, h / 2); break;
    case 'seal': case 'getcard': await p.wait(1600); await p.click(w / 2, h / 2); break;
    case 'dlg': await p.key('Space'); await p.wait(s.done ? 150 : 250); break;
    case 'choice': await p.key('Digit1', '1'); await p.wait(300); break;
    case 'm3card': case 'mgcard': await p.wait(600); await p.clickText(s.t, '.m3-modal .jl-btn.primary, .mg-modal .jl-btn.primary'); break;
    case 'm3':
      if (!s.busy) await p.eval(`(() => { const { board, ctl } = window.__m3; const h = board.findHint(); if (h) ctl.swap(h[0], h[1]); })()`);
      await p.wait(400); break;
    case 'minigame':
      if (!mgSeen) mgSeen = Date.now();
      if (Date.now() - mgSeen > 5000) { await shot('mg-play'); await p.eval('window.__mgWin && window.__mgWin()'); mgSeen = 0; }
      await p.wait(700); break;
    case 'hub': await p.wait(800); await p.clickText('', '.hub-play.ready'); break;
    case 'credits': await p.wait(3000); break;
    default:
      // 尾声里需要玩家自己走到石麒麟跟前：空闲太久就直接和它互动
      if (s.k === 'idle' && Date.now() - (idleSince || (idleSince = Date.now())) > 6000) {
        idleSince = 0;
        await p.eval(`(() => { const g = window.__app?.game; const t = g?.things?.find((x) => /石麒麟/.test(x.name || '')); if (t && !g.busy) g.interactWith({ kind: 'thing', thing: t }); })()`);
      }
      await p.wait(400);
  }
}
await shot('end');
const errs = p.logs.filter((l) => /error|exception|warn/i.test(l));
console.log('--- console (errors/warnings) ---\n' + errs.slice(0, 40).join('\n'));
await p.close();
