// 金陵寻踪 · 音频引擎（全部声音由 Web Audio 实时合成，无外部资源）
// 公共接口（硬约定）：currentMusic / unlock / music / ambient / sfx / blip / jingle / setVolume / getVolume / mute / isMuted / duck
// 所有方法都不会抛异常；unlock 之前的调用是安全的（music/ambient 会被记住，解锁后立即开始；sfx/blip 被忽略）。
import { createEngine, sweepVoices, activeVoices, cacheBytes, holdParam, DEFAULT_VOL, clamp } from './audio/engine.js';
import { Player } from './audio/seq.js';
import { TRACKS } from './audio/tracks.js';
import { playSfx, playBlip, playJingle } from './audio/sfx.js';
import { Ambience } from './audio/ambient.js';

const LOOKAHEAD = 0.12, TICK_MS = 25;
const vols = { ...DEFAULT_VOL };
const st = {
  ctx: null, E: null, muted: false, hidden: false, timer: 0, dev: false,
  player: null, players: new Set(), amb: null, ambs: new Set(),
  want: { music: null, mFade: 1.5, amb: null, aVol: 1, aFade: 2 },
  lastBlip: 0, sfxCount: new Map(), tickN: 0, tickSum: 0, tickMax: 0,
};

function now() { return st.E ? st.E.ctx.currentTime : 0; }
function running() { return !!st.E && st.ctx.state === 'running' && (!st.hidden || st.dev); }

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function schedule() {
  const E = st.E;
  if (!E || !running()) return;
  const p0 = perfNow();
  const t = E.ctx.currentTime, hz = t + LOOKAHEAD;
  if (st.player && st.player.tasks.length) st.player.warmStep(3);
  for (const p of st.players) {
    if (p.stopAt != null && t > p.stopAt + 0.05) { st.players.delete(p); p.dispose(); continue; }
    if (p.stopAt == null || t < p.stopAt) p.tick(t, hz);
  }
  for (const a of st.ambs) {
    if (a.stopAt != null && t > a.stopAt + 0.05) { st.ambs.delete(a); a.dispose(); continue; }
    a.tick(t, hz);
  }
  sweepVoices(E);
  const ms = perfNow() - p0; // 调度耗时统计（调试用）
  st.tickN++; st.tickSum += ms; if (ms > st.tickMax) st.tickMax = ms;
}
function startTimer() { if (!st.timer && typeof setInterval !== 'undefined') st.timer = setInterval(schedule, TICK_MS); }
function stopTimer() { if (st.timer) { clearInterval(st.timer); st.timer = 0; } }

function startMusic(id, fade) {
  const E = st.E;
  if (!E) return;
  const t = E.ctx.currentTime;
  if (st.player) { st.player.stop(t, fade); st.player = null; }
  if (id == null) return;
  const key = TRACKS[id] ? id : 'level';
  const p = new Player(E, TRACKS[key], key, E.bus.music);
  p.start(t, Math.max(0.05, fade), fade > 0.3 ? 0.3 : 0.12);
  st.player = p; st.players.add(p);
  schedule();
}
function startAmbient(id, vol, fade) {
  const E = st.E;
  if (!E) return;
  const t = E.ctx.currentTime;
  if (st.amb) { st.amb.stop(t, Math.max(0.05, fade)); st.amb = null; }
  if (id == null) return;
  const a = new Ambience(E, String(id), vol);
  a.start(t, Math.max(0.05, fade));
  st.amb = a; st.ambs.add(a);
}

function onVisibility() {
  st.hidden = typeof document !== 'undefined' && !!document.hidden;
  const ctx = st.ctx;
  if (!ctx) return;
  try {
    if (st.hidden && !st.dev) {
      stopTimer();
      if (ctx.state === 'running') ctx.suspend().catch(() => {});
    } else {
      const p = ctx.state !== 'running' ? ctx.resume() : null;
      if (p && p.then) p.then(() => { startTimer(); schedule(); }).catch(() => {});
      startTimer();
    }
  } catch (e) { /* */ }
}

export const audio = {
  currentMusic: null,

  unlock() {
    try {
      if (!st.ctx) {
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        let ctx, E;
        try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
        try { E = createEngine(ctx, vols); } catch (e) { try { ctx.close(); } catch (e2) { /* */ } return; } // 失败则下次手势再试
        st.ctx = ctx; st.E = E;
        E.master.gain.value = st.muted ? 0 : vols.master;
        if (typeof document !== 'undefined') {
          st.hidden = !!document.hidden;
          document.addEventListener('visibilitychange', onVisibility);
        }
        if (st.want.music) startMusic(st.want.music, Math.min(st.want.mFade, 1.2));
        if (st.want.amb) startAmbient(st.want.amb, st.want.aVol, Math.min(st.want.aFade, 1.5));
        startTimer();
      }
      if (st.ctx.state !== 'running' && (!st.hidden || st.dev)) {
        const p = st.ctx.resume();
        if (p && p.then) p.then(() => { startTimer(); schedule(); }).catch(() => {});
        try { // 旧版 iOS：在用户手势内播放一个静音采样以解锁
          const s = st.ctx.createBufferSource();
          s.buffer = st.ctx.createBuffer(1, 1, st.ctx.sampleRate);
          s.connect(st.ctx.destination); s.start(0);
        } catch (e) { /* */ }
      }
    } catch (e) { /* */ }
  },

  music(id, opts) {
    try {
      const fade = opts && opts.fade != null && Number.isFinite(+opts.fade) ? Math.max(0, +opts.fade) : 1.5;
      id = id == null || id === '' ? null : String(id);
      const same = id === this.currentMusic;
      this.currentMusic = id;
      st.want.music = id; st.want.mFade = fade;
      if (!st.E) return;
      const key = id == null ? null : TRACKS[id] ? id : 'level';
      if (same && (key == null ? !st.player : st.player && st.player.id === key)) return;
      if (key != null && st.player && st.player.id === key) return; // 回退后同一首：不重启
      startMusic(key, fade);
    } catch (e) { /* */ }
  },

  ambient(id, opts) {
    try {
      const fade = opts && opts.fade != null && Number.isFinite(+opts.fade) ? Math.max(0, +opts.fade) : 2;
      const vol = opts && opts.vol != null ? clamp(+opts.vol || 0, 0, 2) : 1;
      id = id == null || id === '' ? null : String(id);
      const same = id === st.want.amb;
      st.want.amb = id; st.want.aVol = vol; st.want.aFade = fade;
      if (!st.E) return;
      if (same && ((id == null && !st.amb) || (st.amb && st.amb.id === id))) {
        if (st.amb) st.amb.setVol(vol, now());
        return;
      }
      startAmbient(id, vol, fade);
    } catch (e) { /* */ }
  },

  sfx(name, opts) {
    try {
      if (!running() || st.muted || vols.sfx <= 0 || vols.master <= 0) return;
      const E = st.E, t = E.ctx.currentTime;
      // 同名音效限流：同一时刻最多 4 个（消除连锁时会大量触发）
      const key = String(name), rec = st.sfxCount.get(key);
      if (rec && t - rec.t < 0.03) { if (rec.n >= 4) return; rec.n++; } else st.sfxCount.set(key, { t, n: 1 });
      playSfx(E, key, opts && typeof opts === 'object' ? opts : {}, t + 0.004);
    } catch (e) { /* */ }
  },

  blip(voice = 'narrator') {
    try {
      if (!running() || st.muted) return;
      const t = st.E.ctx.currentTime;
      if (t - st.lastBlip < 0.045) return;
      st.lastBlip = t;
      playBlip(st.E, String(voice || 'narrator'), t + 0.003);
    } catch (e) { /* */ }
  },

  jingle(name) {
    try {
      if (!running() || st.muted) return;
      const len = playJingle(st.E, String(name), st.E.ctx.currentTime + 0.01) || 1.5;
      this.duck(0.35, Math.max(0.6, len - 0.4));
    } catch (e) { /* */ }
  },

  setVolume(bus, v) {
    try {
      if (!(bus in vols)) return;
      vols[bus] = clamp(+v || 0, 0, 1);
      if (!st.E) return;
      const t = now();
      if (bus === 'master') { if (!st.muted) st.E.master.gain.setTargetAtTime(vols.master, t, 0.03); }
      else for (const g of st.E.bus[bus].vol) g.setTargetAtTime(vols[bus], t, 0.03);
    } catch (e) { /* */ }
  },
  getVolume(bus) { return bus in vols ? vols[bus] : 1; },

  mute(b = true) {
    try {
      st.muted = !!b;
      if (st.E) st.E.master.gain.setTargetAtTime(st.muted ? 0 : vols.master, now(), 0.04);
    } catch (e) { /* */ }
  },
  isMuted() { return st.muted; },

  duck(amount = 0.45, seconds = 1.2) {
    try {
      if (!st.E) return;
      const t = now(), a = clamp(+amount || 0, 0, 1), s = Math.max(0, +seconds || 0);
      for (const g of st.E.bus.music.duck) {
        holdParam(g, t);
        g.linearRampToValueAtTime(a, t + 0.08);
        g.setValueAtTime(a, t + 0.08 + s);
        g.linearRampToValueAtTime(1, t + 0.08 + s + 0.6);
      }
    } catch (e) { /* */ }
  },

  // —— 仅供调试 ——
  _stats() {
    const E = st.E;
    return E ? { state: st.ctx.state, time: +E.ctx.currentTime.toFixed(3), voices: activeVoices(E), scheduled: E.voices.length, players: st.players.size, ambs: st.ambs.size, cache: E.cache.size, cacheMB: +(cacheBytes(E) / 1048576).toFixed(1), music: st.player && st.player.id, hidden: st.hidden, tickAvgMs: +(st.tickSum / Math.max(1, st.tickN)).toFixed(3), tickMaxMs: +st.tickMax.toFixed(2) } : { state: 'locked' };
  },
  _dev(on = true) { st.dev = !!on; if (on && st.ctx) { startTimer(); } },
  _resetTiming() { st.tickN = 0; st.tickSum = 0; st.tickMax = 0; },
};
