// 存档与设置：全部存在 localStorage（失败时静默降级为仅内存）。
import { store } from '../core/util.js';

const SAVE_KEY = (slot) => `jinling.save.${slot}`;
const SETTINGS_KEY = 'jinling.settings';
const META_KEY = 'jinling.meta';

export function newState() {
  return {
    v: 1,
    chapter: 0,
    map: 'prologue',
    spawn: 'default',
    pos: null,
    flags: {},
    codex: [],
    codexSeen: [],
    seals: [],
    achievements: [],
    items: [],
    quest: null,
    playtime: 0,
    startedAt: Date.now(),
    savedAt: 0,
    minigames: {},
    backlog: [],
  };
}

export const DEFAULT_SETTINGS = {
  master: 0.9, music: 0.55, sfx: 0.8, ambient: 0.6,
  textSpeed: 'mid', quality: null, shake: true, hints: true,
};

export function loadSettings() { return { ...DEFAULT_SETTINGS, ...(store.get(SETTINGS_KEY) || {}) }; }
export function saveSettings(s) { store.set(SETTINGS_KEY, s); }

/** 全局元数据（跨存档）：已解锁的金陵志、成就、通关次数——让图鉴在新周目也保留 */
export function loadMeta() { return { codex: [], achievements: [], clears: 0, ...(store.get(META_KEY) || {}) }; }
export function saveMeta(m) { store.set(META_KEY, m); }

export function saveGame(slot, state, extra = {}) {
  const data = { ...state, savedAt: Date.now(), ...extra };
  data.backlog = (state.backlog || []).slice(-40);
  return store.set(SAVE_KEY(slot), data);
}
export function loadGame(slot) {
  const d = store.get(SAVE_KEY(slot));
  if (!d || d.v !== 1) return null;
  return { ...newState(), ...d };
}
export function deleteSave(slot) { store.del(SAVE_KEY(slot)); }
export function slotInfo(slot) {
  const d = store.get(SAVE_KEY(slot));
  if (!d) return null;
  return { chapter: d.chapter, mapName: d.mapName || '', era: d.era || '', playtime: d.playtime || 0, savedAt: d.savedAt || 0, seals: (d.seals || []).length, codex: (d.codex || []).length };
}
export function hasAnySave() { return ['auto', 1, 2, 3].some((s) => !!store.get(SAVE_KEY(s))); }
export function latestSlot() {
  let best = null, bt = 0;
  for (const s of ['auto', 1, 2, 3]) { const i = slotInfo(s); if (i && i.savedAt > bt) { bt = i.savedAt; best = s; } }
  return best;
}
export function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h} 时 ${m} 分` : `${m} 分`;
}
export function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}
