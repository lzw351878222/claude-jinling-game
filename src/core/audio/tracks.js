// 金陵寻踪 · 曲目注册表（所有 id 必须存在；未知 id 由 audio.music 回退到 level）
import { title, level, level2, map } from './tracks1.js';
import { modern, hongwu, library, shipyard } from './tracks2.js';
import { temple, night, festival } from './tracks3.js';
import { boss, rift, tension, sad, mystery } from './tracks4.js';
import { ending, minigame, home, sea } from './tracks5.js';

export const TRACKS = {
  title, level, level2, map, modern, hongwu, library, shipyard, temple, night, festival,
  boss, rift, tension, sad, ending, minigame, mystery, home, sea,
};
export const TRACK_IDS = Object.keys(TRACKS);

// 混音表：各曲整体音量（离线测量后校准；目标：活泼曲 RMS≈-24dB、安静曲≈-27~-29dB、峰值≤-7dBFS，默认音量下）
const GAINS = {
  title: 1.5, level: 0.92, level2: 0.87, map: 1.36, modern: 1.4, hongwu: 0.8, library: 1.17, shipyard: 0.84, temple: 1.1, night: 1.8,
  festival: 0.75, boss: 0.6, rift: 1.38, tension: 0.94, sad: 1.62, ending: 1.33, minigame: 1.25, mystery: 1.68, home: 1.88, sea: 1.35,
};
for (const [id, g] of Object.entries(GAINS)) if (TRACKS[id]) TRACKS[id].gain = g;
