// 场景检查：node tools/scene-shot.mjs <章> [前缀]  → 未修复 / 全部修复 两张俯瞰图
import { openPage } from './cdp.mjs';
const ch = process.argv[2] || '1';
const prefix = process.argv[3] || `scene${ch}`;
const p = await openPage(`http://localhost:5173/index.html?ch=${ch}&step=0&skipintro=1`, { w: 1280, h: 720 });
await p.wait(5000);
const overview = (dist) => p.eval(`(() => { const g = window.__app.game; const w = g.world; g.rig.cinematic = true; g.rig.moveTo({ x: w.w / 2, z: w.h / 2 - 1, y: 0, dist: ${dist}, pitch: 44, dur: 0.01 }); return w.w + 'x' + w.h; })()`);
console.log('map', await overview(30));
await p.wait(1200);
await p.shot(`tools/.cache/shots/${prefix}-a.png`);
await p.eval(`(() => { const g = window.__app.game; const names = new Set([...g.world.stages.values()].map(s => s.name)); g.applyStages(names); if (g.mapDef.particles) { g.particles.clearEmitters(); g.mapDef.particles(g.particles, g); } return [...names].join(','); })()`).then((r) => console.log('stages', r));
await p.wait(1500);
await p.shot(`tools/.cache/shots/${prefix}-b.png`);
await p.eval(`(() => { const g = window.__app.game; g.rig.moveTo({ x: g.player.pos.x, z: g.player.pos.z - 3, y: 0, dist: 20, pitch: 40, dur: 0.01 }); })()`);
await p.wait(1000);
await p.shot(`tools/.cache/shots/${prefix}-c.png`);
console.log(p.logs.filter((l) => /error|exception/i.test(l)).join('\n'));
await p.close();
