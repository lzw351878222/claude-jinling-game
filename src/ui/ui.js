// 游戏界面：HUD、对话、选项、过场覆盖层、菜单（金陵志/寻踪录/成就/设置/存档）
import { el, html, sleep, isTouchDevice } from '../core/util.js';
import { audio } from '../core/audio.js';
import { ASSETS } from '../assets.js';
import { paintIcon } from './icons.js';
import { CODEX, CODEX_CATEGORIES, codexById } from '../story/codex.js';
import { ACHIEVEMENTS } from '../story/achievements.js';
import { CHAPTERS } from '../story/chapters.js';
import { saveSettings, slotInfo, fmtTime, fmtDate } from '../game/state.js';

const TEXT_SPEED = { slow: 22, mid: 40, fast: 75, instant: 9999 };

export class UI {
  constructor(game, app) {
    this.game = game;
    this.app = app; // main 里的应用对象：存读档、设置、回标题
    this.root = document.getElementById('ui');
    this.layer = el('div', 'ui-layer', this.root);
    this.buildHud();
    this.dlgWrap = el('div', 'dlg-wrap', this.layer);
    this.fader = el('div', 'fader', this.layer);
    this.lbTop = el('div', 'letterbox top', this.layer);
    this.lbBot = el('div', 'letterbox bot', this.layer);
    this.toasts = el('div', 'toasts', this.layer);
    this.menuEl = null;
    this.busy = false;
    this.advanceWaiter = null;
    this.isTouch = isTouchDevice();
    if (this.isTouch) {
      game.input.buildTouchControls(this.layer, {
        onAction: () => { if (this.advanceWaiter) this.advanceWaiter(); else game.input.pressed.add('KeyE'); },
        onMenu: () => this.openMenu(),
      });
    }
    // 对话推进：键盘
    window.addEventListener('keydown', (e) => {
      if (this.menuEl || !this.advanceWaiter) return;
      if (['Space', 'Enter', 'KeyE', 'KeyJ', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); this.advanceWaiter(); }
    });
    // 点击画面空白处也能推进
    this.game.canvas.addEventListener('pointerdown', () => { if (this.advanceWaiter && !this.menuEl) this.advanceWaiter(); });
  }
  get settings() { return this.app.settings; }
  get state() { return this.game.state; }

  // ================================================================ HUD
  buildHud() {
    const hud = el('div', 'hud hidden', this.layer);
    this.hud = hud;
    this.hudLoc = html('div', 'hud-loc', hud, '<span class="jl-seal seal">踪</span><div><div class="place"></div><div class="era"></div></div>');
    this.hudQuest = html('div', 'hud-quest empty', hud, '<span class="qlabel">寻踪</span><span class="qt"></span>');
    const btns = el('div', 'hud-btns', hud);
    this.btnCodex = html('button', 'hud-btn', btns, '志<span class="badge"></span>');
    this.btnCodex.title = '金陵志（C）';
    this.btnCodex.onclick = () => { audio.sfx('open'); this.openMenu('codex'); };
    this.btnMenu = el('button', 'hud-btn', btns, '☰');
    this.btnMenu.title = '菜单（Esc）';
    this.btnMenu.onclick = () => { audio.sfx('open'); this.openMenu(); };
    this.hudKeys = html('div', 'hud-keys', hud, '<b>WASD</b>移动 <b>E</b>交谈/查看 <b>Enter</b>闯关 <b>C</b>金陵志 <b>Esc</b>菜单 · 鼠标可点地面行走、点人物交谈');
    this.prompt = el('div', 'hud-prompt', this.layer);
    this.prompt.onclick = () => { if (this.promptTarget) this.game.interactWith(this.promptTarget); };
    this.promptTarget = null;
  }
  showHud(v) { this.hud.classList.toggle('hidden', !v); this.game.input.showTouch(v); }
  setLocation(place, era) {
    this.hudLoc.querySelector('.place').textContent = place || '';
    this.hudLoc.querySelector('.era').textContent = era || '';
  }
  setQuest(text, flash = true) {
    this.state.quest = text || null;
    const q = this.hudQuest;
    q.querySelector('.qt').textContent = text || '';
    q.classList.toggle('empty', !text);
    if (text && flash) { q.classList.remove('flash'); void q.offsetWidth; q.classList.add('flash'); audio.jingle?.('quest'); }
  }
  updateBadge() {
    const st = this.state;
    const n = st ? st.codex.filter((id) => !st.codexSeen.includes(id)).length : 0;
    this.btnCodex.querySelector('.badge').textContent = n ? String(n) : '';
  }
  setBusy(b) {
    this.busy = b;
    if (b) this.prompt.classList.remove('show');
  }
  showPrompt(near) {
    this.promptTarget = near;
    if (!near || this.busy || this.menuEl) { this.prompt.classList.remove('show'); return; }
    const g = this.game;
    const pos = near.kind === 'actor' ? near.actor.headPos() : { x: near.thing.x, y: g.world.heightAt(near.thing.x, near.thing.z) + (near.thing.y ?? 1.2) + 0.4, z: near.thing.z };
    const sp = g.screenPos(pos);
    const key = this.isTouch ? '行' : 'E';
    const html2 = `<span class="k">${key}</span>${near.name ? `<span class="n">${near.name}</span>` : ''}<span class="v">${near.label}</span>`;
    if (this.prompt._h !== html2) { this.prompt.innerHTML = html2; this.prompt._h = html2; }
    this.prompt.style.left = sp.x + 'px';
    this.prompt.style.top = (sp.y - 8) + 'px';
    this.prompt.classList.add('show');
    this.game.input.setActionLabel(near.label?.slice(0, 1) || '行');
  }
  pingGround(x, y) {
    const p = el('div', 'ping', this.layer);
    p.style.left = x + 'px'; p.style.top = y + 'px';
    setTimeout(() => p.remove(), 520);
  }
  toast(text, { icon = '踪', label = '', kind = '', dur = 2600 } = {}) {
    const t = html('div', 'toast', this.toasts, `<span class="ti ${kind}">${icon}</span><div>${label ? `<div class="tl">${label}</div>` : ''}<div class="tt">${text}</div></div>`);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 380); }, dur);
  }
  frame() {
    if (this.hudKeys && this.game.time > 40 && !this.hudKeys._hid) { this.hudKeys._hid = true; this.hudKeys.style.opacity = '0'; }
  }

  // ================================================================ 对话
  /**
   * @param {object} o { name, portrait: {src, pixel, small}, text, style: 'normal'|'thought'|'narrate'|'shout', voice, nameClass, sub }
   */
  async say(o) {
    const st = this.state;
    if (st) { st.backlog.push({ n: o.name || '', t: o.text }); if (st.backlog.length > 80) st.backlog.shift(); }
    this.closeDialogue(true);
    const dlg = el('div', 'dlg' + (o.style && o.style !== 'normal' ? ' ' + o.style : '') + (o.portrait ? '' : ' noport'), this.dlgWrap);
    this.dlg = dlg;
    if (o.portrait && o.style !== 'narrate') {
      const port = el('div', 'dlg-port', dlg);
      const img = el('img', o.portrait.pixel ? 'pix' + (o.portrait.small ? ' small' : '') : '', port);
      img.src = o.portrait.src;
      img.alt = '';
      el('div', 'dlg-handle', dlg);
    }
    if (o.name && o.style !== 'narrate') {
      const nm = html('div', 'dlg-name ' + (o.nameClass || ''), dlg, `${o.name}${o.sub ? `<span class="sub">${o.sub}</span>` : ''}`);
      void nm;
    }
    const textEl = el('div', 'dlg-text', dlg);
    el('div', 'dlg-next', dlg);
    dlg.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (this.advanceWaiter) this.advanceWaiter(); });
    // 打字机
    const segs = parseMarkup(o.text);
    const speed = TEXT_SPEED[this.settings.textSpeed] || 40;
    let skip = false;
    let resolveType;
    const typing = new Promise((r) => { resolveType = r; });
    this.advanceWaiter = () => { skip = true; };
    (async () => {
      let count = 0;
      for (const seg of segs) {
        const span = el('span', seg.cls || '', textEl);
        for (const ch of seg.text) {
          span.textContent += ch;
          count++;
          if (skip || speed >= 9999) continue;
          if (count % 2 === 0 && ch.trim()) audio.blip(o.voice || 'narrator');
          let d = 1000 / speed;
          if ('，、；'.includes(ch)) d += 90;
          else if ('。！？…—'.includes(ch)) d += 170;
          await sleep(d);
        }
      }
      resolveType();
    })();
    await typing;
    dlg.classList.add('done');
    await new Promise((r) => {
      this.advanceWaiter = () => { this.advanceWaiter = null; audio.sfx('click', { vol: 0.4 }); r(); };
      if (o.auto) setTimeout(() => { if (this.advanceWaiter) this.advanceWaiter(); }, o.auto);
    });
  }
  closeDialogue(instant = false) {
    const d = this.dlg;
    if (!d) return;
    this.dlg = null;
    if (instant) { d.remove(); return; }
    d.classList.add('dlg-out');
    setTimeout(() => d.remove(), 230);
  }
  /** 选项：返回所选下标 */
  choose(options, { prompt } = {}) {
    return new Promise((resolve) => {
      const holder = this.dlg || el('div', 'dlg noport', this.dlgWrap);
      if (!this.dlg) { holder.style.minHeight = '0'; holder.style.padding = '0'; holder.style.background = 'none'; holder.style.border = 'none'; holder.style.boxShadow = 'none'; }
      if (prompt && !this.dlg) { /* 仅选项 */ }
      const box = el('div', 'choices', holder);
      let sel = 0;
      const btns = options.map((t, i) => {
        const b = html('button', 'choice', box, `<span class="num">${i + 1}</span>${t}`);
        b.style.animationDelay = (i * 0.06) + 's';
        b.onpointerdown = (e) => e.stopPropagation();
        b.onclick = (e) => { e.stopPropagation(); done(i); };
        b.onmouseenter = () => { sel = i; paint(); };
        return b;
      });
      const paint = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
      paint();
      const onKey = (e) => {
        if (this.menuEl) return;
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= options.length) { e.preventDefault(); done(n - 1); return; }
        if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = (sel + options.length - 1) % options.length; paint(); audio.sfx('hover'); e.preventDefault(); }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = (sel + 1) % options.length; paint(); audio.sfx('hover'); e.preventDefault(); }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); done(sel); }
      };
      const prevWaiter = this.advanceWaiter;
      this.advanceWaiter = null;
      window.addEventListener('keydown', onKey, true);
      const done = (i) => {
        window.removeEventListener('keydown', onKey, true);
        audio.sfx('ok');
        box.remove();
        if (holder !== this.dlg) holder.remove();
        void prevWaiter;
        resolve(i);
      };
    });
  }

  // ================================================================ 覆盖层
  fade(to, ms = 600, color = '#000') {
    const f = this.fader;
    f.style.background = color;
    f.style.transitionDuration = ms + 'ms';
    f.classList.toggle('block', to > 0.5);
    void f.offsetWidth;
    f.style.opacity = String(to);
    return sleep(ms + 20);
  }
  letterbox(on) { this.lbTop.classList.toggle('on', on); this.lbBot.classList.toggle('on', on); }
  async bigText(text, { hold = 1800, small = '' } = {}) {
    const b = html('div', 'bigtext', this.layer, `<div class="bt">${text}${small ? `<small>${small}</small>` : ''}</div>`);
    await sleep(1200 + hold);
    b.classList.add('out');
    await sleep(900);
    b.remove();
  }
  chapterCard(ch) {
    return new Promise((resolve) => {
      audio.jingle?.('chapter');
      const c = html('div', 'chapcard', this.layer, `
        <div class="cc-scroll">
          <div class="cc-num">${ch.num}</div>
          <div class="cc-title">${ch.title}</div>
          <div class="cc-era">${ch.era}${ch.place ? ' · ' + ch.place : ''}</div>
          <div class="jl-seal cc-seal">康晔</div>
        </div>
        <div class="cc-skip">点击继续</div>`);
      let done = false;
      const finish = async () => {
        if (done) return; done = true;
        c.classList.add('out');
        await sleep(800);
        c.remove();
        resolve();
      };
      setTimeout(() => audio.sfx('stamp'), 2150);
      setTimeout(finish, 5200);
      setTimeout(() => { c.onclick = finish; }, 900);
    });
  }
  sealStamp({ seal, name, desc, all }) {
    return new Promise((resolve) => {
      const row = (all || []).map((s) => `<span class="${s.on ? 'on' : ''}">${s.ch}</span>`).join('');
      const c = html('div', 'sealfx', this.layer, `
        <div class="sf-paper">
          <div class="sf-cap">寻得踪印</div>
          <div class="sf-seal">${seal}</div>
          <div class="sf-name">${name}</div>
          <div class="sf-desc">${desc || ''}</div>
          ${row ? `<div class="sf-row">${row}</div>` : ''}
        </div>`);
      setTimeout(() => { audio.jingle?.('seal'); audio.sfx('stamp'); this.game.rig.shake(0.25, 0.3); }, 550);
      let done = false;
      const finish = async () => { if (done) return; done = true; c.classList.add('out'); await sleep(600); c.remove(); resolve(); };
      setTimeout(() => { c.onclick = finish; }, 1400);
      const onKey = (e) => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { window.removeEventListener('keydown', onKey); finish(); } };
      setTimeout(() => window.addEventListener('keydown', onKey), 1400);
      setTimeout(finish, 6500);
    });
  }
  /** 获得物品 / 金陵志新条目的大卡片（等待确认） */
  getCard({ label, title, desc, icon }) {
    return new Promise((resolve) => {
      const c = html('div', 'getcard', this.layer, `<div class="gc jl-panel"><div class="gc-l">${label || '获得'}</div>${icon ? '<canvas class="gc-icon" width="96" height="96"></canvas>' : ''}<div class="gc-t">${title}</div>${desc ? `<div class="gc-d">${desc}</div>` : ''}<div class="gc-h">点击继续</div></div>`);
      if (icon) paintIcon(c.querySelector('canvas'), icon);
      audio.jingle?.('item');
      let done = false;
      const finish = async () => { if (done) return; done = true; window.removeEventListener('keydown', onKey); c.classList.add('out'); await sleep(300); c.remove(); resolve(); };
      const onKey = (e) => { if (['Space', 'Enter', 'KeyE', 'Escape'].includes(e.code)) finish(); };
      setTimeout(() => { c.onclick = finish; window.addEventListener('keydown', onKey); }, 450);
    });
  }
  codexToast(entry) {
    this.toast(`【${entry.title}】`, { icon: '志', label: '金陵志 · 新收录', kind: 'jade' });
    audio.jingle?.('codex');
    this.updateBadge();
  }

  // ================================================================ 菜单
  openMenu(tab = 'journal', { title = false } = {}) {
    if (this.menuEl) return;
    if (!title && (this.game.busy || this.app.inTitle || this.game.sleeping)) return;
    this.menuTitle = title;
    this.game.paused = true;
    audio.duck?.(0.6, 0.4);
    const m = el('div', 'menu' + (title ? ' over-title' : ''), this.layer);
    this.menuEl = m;
    const box = el('div', 'menu-box jl-panel', m);
    const tabs = el('div', 'menu-tabs', box);
    el('div', 'mt-title', tabs, '寻踪录');
    const body = el('div', 'menu-body', box);
    const close = el('button', 'mg-close menu-close', body, '×');
    close.onclick = () => this.closeMenu();
    const page = el('div', 'menu-page jl-scroll', body);
    const defs = [
      ['journal', '寻踪', '旅程与踪印'],
      ['codex', '金陵志', '人物·地点·器物·典故'],
      ['ach', '成就', ''],
      ['backlog', '回顾', '对话记录'],
      ['settings', '设置', '声音·画面·文字'],
      ['save', '存档', '存档与读档'],
    ];
    const tabBtns = {};
    for (const [id, name, sub] of defs) {
      if (title && !['codex', 'ach', 'settings'].includes(id)) continue;
      const b = html('button', 'menu-tab', tabs, `${name}${sub ? `<span class="mt-sub">${sub}</span>` : ''}`);
      b.onclick = () => { audio.sfx('page'); show(id); };
      tabBtns[id] = b;
    }
    el('div', 'spacer', tabs);
    if (!title) {
      const tb = html('button', 'menu-tab', tabs, '回标题<span class="mt-sub">进度已自动保存</span>');
      tb.onclick = async () => { audio.sfx('click'); this.closeMenu(); await this.app.backToTitle(); };
    }
    const show = (id) => {
      for (const k in tabBtns) tabBtns[k].classList.toggle('on', k === id);
      page.innerHTML = '';
      page.scrollTop = 0;
      if (id === 'journal') this.pageJournal(page);
      else if (id === 'codex') this.pageCodex(page);
      else if (id === 'ach') this.pageAch(page);
      else if (id === 'backlog') this.pageBacklog(page);
      else if (id === 'settings') this.pageSettings(page);
      else if (id === 'save') this.pageSave(page);
    };
    show(tab);
    this.menuKey = (e) => { if (e.code === 'Escape' || (e.code === 'KeyC' && tab === 'codex')) { e.preventDefault(); this.closeMenu(); } };
    setTimeout(() => window.addEventListener('keydown', this.menuKey), 50);
    m.addEventListener('pointerdown', (e) => { if (e.target === m) this.closeMenu(); });
  }
  closeMenu() {
    if (!this.menuEl) return;
    const m = this.menuEl;
    this.menuEl = null;
    window.removeEventListener('keydown', this.menuKey);
    m.classList.add('out');
    setTimeout(() => m.remove(), 220);
    this.game.paused = false;
    this.menuTitle = false;
    audio.sfx('close');
    this.updateBadge();
  }
  pageJournal(p) {
    const st = this.state;
    html('h2', '', p, '寻踪录');
    el('div', 'mp-sub', p, `已游历 ${fmtTime(st.playtime)} · 金陵志 ${st.codex.length} 篇`);
    if (st.quest) html('div', 'jr-quest', p, `<b style="font-family:var(--f-brush);color:var(--vermilion-dark);letter-spacing:.1em">当前 · </b>${st.quest}`);
    const seals = el('div', 'jr-seals', p);
    for (const ch of CHAPTERS.filter((c) => c.seal)) {
      const on = st.seals.includes(ch.seal);
      html('div', 'jr-seal', seals, `<div class="s ${on ? 'on' : ''}">${ch.seal}</div><div class="l">${on ? ch.sealName : '？'}</div>`);
    }
    for (const ch of CHAPTERS) {
      const reached = st.chapter >= ch.id;
      const d = el('div', 'jr-ch' + (reached ? '' : ' locked'), p);
      html('h4', '', d, `${ch.num} · ${reached ? ch.title : '？？'}<small>${reached ? ch.era : ''}</small>`);
      el('p', '', d, reached ? ch.summary : '尚未抵达。');
    }
  }
  pageCodex(p, cat = 'all', detailId = null) {
    const st = this.state;
    p.innerHTML = '';
    const unlocked = new Set([...(st?.codex || []), ...(this.app.meta?.codex || [])]);
    if (detailId) {
      const e = codexById[detailId];
      const back = el('button', 'jl-btn small ghost cx-back', p, '‹ 返回');
      back.onclick = () => { audio.sfx('page'); this.pageCodex(p, cat); };
      const d = el('div', 'cx-detail', p);
      const cv = el('canvas', '', d); cv.width = 96; cv.height = 96; paintIcon(cv, e.icon);
      const right = el('div', '', d);
      el('h3', '', right, e.title);
      const catName = CODEX_CATEGORIES.find((c) => c.id === e.cat)?.name || '';
      el('div', 'cx-meta', right, `${catName} · ${e.era || ''}`);
      el('div', 'cx-text', right, e.text);
      if (e.quote) html('div', 'cx-quote', right, `「${e.quote}」${e.quoteSrc ? `<small>—— ${e.quoteSrc}</small>` : ''}`);
      if (e.id === 'kangye') { const im = el('img', '', right); im.src = ASSETS.bodyFront; im.style.cssText = 'height:260px;margin-top:14px;mix-blend-mode:multiply;border-radius:6px'; }
      if (st && !st.codexSeen.includes(e.id)) st.codexSeen.push(e.id);
      return;
    }
    html('h2', '', p, '金陵志');
    const total = CODEX.length, got = CODEX.filter((e) => unlocked.has(e.id)).length;
    el('div', 'mp-sub', p, `已收录 ${got} / ${total} 篇 —— 与人交谈、查看闪光处、完成章节都会收录新篇`);
    html('div', 'cx-progress', p, `<i style="width:${(got / total * 100).toFixed(1)}%"></i>`);
    const cats = el('div', 'cx-cats', p);
    for (const c of [{ id: 'all', name: '全部' }, ...CODEX_CATEGORIES]) {
      const b = el('button', 'cx-cat' + (c.id === cat ? ' on' : ''), cats, c.name);
      b.onclick = () => { audio.sfx('page'); this.pageCodex(p, c.id); };
    }
    const grid = el('div', 'cx-grid', p);
    for (const e of CODEX) {
      if (cat !== 'all' && e.cat !== cat) continue;
      const on = unlocked.has(e.id);
      const isNew = on && st && !st.codexSeen.includes(e.id);
      const b = el('button', 'cx-item' + (on ? '' : ' locked') + (isNew ? ' new' : ''), grid);
      const cv = el('canvas', '', b); cv.width = 32; cv.height = 32;
      if (on) paintIcon(cv, e.icon);
      html('div', '', b, on ? `<div class="cxt">${e.title}</div><div class="cxe">${e.era || ''}</div>` : `<div class="cxt">？？？</div><div class="cxe">${CHAPTERS.find((c) => c.id === e.chapter)?.num || ''}</div>`);
      if (on) b.onclick = () => { audio.sfx('page'); this.pageCodex(p, cat, e.id); };
    }
  }
  pageAch(p) {
    const got = new Set([...(this.state?.achievements || []), ...(this.app.meta?.achievements || [])]);
    html('h2', '', p, '成就');
    el('div', 'mp-sub', p, `已达成 ${ACHIEVEMENTS.filter((a) => got.has(a.id)).length} / ${ACHIEVEMENTS.length}`);
    const list = el('div', 'ach-list', p);
    for (const a of ACHIEVEMENTS) {
      const on = got.has(a.id);
      html('div', 'ach' + (on ? ' on' : ''), list, `<div class="ai">${on ? a.icon : '？'}</div><div><div class="an">${a.name}</div><div class="ad">${on || !a.secret ? a.desc : '（隐藏成就）'}</div></div>`);
    }
  }
  pageBacklog(p) {
    html('h2', '', p, '回顾');
    el('div', 'mp-sub', p, '最近的对话');
    const list = (this.state?.backlog || []).slice(-60);
    if (!list.length) el('div', 'mp-sub', p, '（暂无）');
    for (const l of list) {
      const d = el('div', '', p);
      d.style.cssText = 'padding:8px 0;border-bottom:1px dashed rgba(59,53,45,.2);font-size:17px;line-height:1.7';
      d.innerHTML = (l.n ? `<b style="font-family:var(--f-brush);color:var(--vermilion-dark);letter-spacing:.08em;margin-right:.6em">${l.n}</b>` : '') + parseMarkup(l.t).map((s) => s.cls ? `<span class="${s.cls}" style="color:var(--vermilion-dark)">${esc(s.text)}</span>` : esc(s.text)).join('');
    }
    setTimeout(() => { p.scrollTop = p.scrollHeight; }, 30);
  }
  pageSettings(p) {
    const s = this.settings;
    html('h2', '', p, '设置');
    el('div', 'mp-sub', p, '修改会自动保存');
    const slider = (label, key, bus) => {
      const r = el('div', 'set-row', p);
      el('label', '', r, label);
      const i = el('input', '', r);
      i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = s[key];
      i.oninput = () => { s[key] = Number(i.value); audio.setVolume(bus, s[key]); saveSettings(s); };
      i.onchange = () => audio.sfx('click');
    };
    slider('总音量', 'master', 'master');
    slider('音乐', 'music', 'music');
    slider('音效', 'sfx', 'sfx');
    slider('环境声', 'ambient', 'ambient');
    const seg = (label, key, opts, onSet) => {
      const r = el('div', 'set-row', p);
      el('label', '', r, label);
      const g = el('div', 'seg', r);
      for (const [v, t] of opts) {
        const b = el('button', s[key] === v ? 'on' : '', g, t);
        b.onclick = () => { s[key] = v; saveSettings(s); audio.sfx('click'); [...g.children].forEach((c) => c.classList.toggle('on', c === b)); onSet?.(v); };
      }
    };
    seg('文字速度', 'textSpeed', [['slow', '慢'], ['mid', '中'], ['fast', '快'], ['instant', '瞬']]);
    seg('画面品质', 'quality', [['high', '高'], ['medium', '中'], ['low', '低']], (v) => { this.game.renderer.setQuality(v); if (this.game.world && this.game.env.name) this.game.env.apply(this.game.env.name, this.game.mapDef?.env?.over || {}); });
    seg('镜头震动', 'shake', [[true, '开'], [false, '关']]);
    const r = el('div', 'set-row', p);
    el('label', '', r, '全屏');
    const fb = el('button', 'jl-btn small ghost', r, document.fullscreenElement ? '退出全屏' : '进入全屏');
    fb.onclick = () => { audio.sfx('click'); if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); setTimeout(() => { fb.textContent = document.fullscreenElement ? '退出全屏' : '进入全屏'; }, 300); };
    const about = el('div', 'mp-sub', p);
    about.style.marginTop = '22px';
    about.innerHTML = '玩法：在每一章的场景里点右下角的「闯关」进行消消乐或特别关，每过一关，场景就修复一处。<br>场景里：WASD / 方向键移动，Shift 快走，E / 空格 交谈与推进，Enter 闯关，C 金陵志，Esc 菜单；也可以用鼠标点击地面行走、点击人物交谈；手机上用左下摇杆与右下按钮。<br>消消乐：拖动或先后点选两颗相邻的棋子交换，三个相同即可消除；四连出「笔」、L/T 形出「烟花」、五连出「宝印」。';
  }
  pageSave(p) {
    html('h2', '', p, '存档');
    el('div', 'mp-sub', p, '剧情中的关键节点会自动存档');
    const slots = el('div', 'slots', p);
    for (const slot of ['auto', 1, 2, 3]) {
      const info = slotInfo(slot);
      const d = el('div', 'slot', slots);
      const ch = info ? CHAPTERS.find((c) => c.id === info.chapter) : null;
      html('div', '', d, `<div class="sn">${slot === 'auto' ? '自动存档' : '存档 ' + slot}${info ? ' · ' + (ch ? ch.num + '「' + ch.title + '」' : '') : ''}</div><div class="sd">${info ? `${info.mapName || ''} · 游历 ${fmtTime(info.playtime)} · 踪印 ${info.seals} · ${fmtDate(info.savedAt)}` : '空'}</div>`);
      const a = el('div', 'sa', d);
      if (slot !== 'auto') {
        const sb = el('button', 'jl-btn small', a, '存');
        sb.onclick = () => { if (this.app.save(slot)) { audio.sfx('stamp'); this.toast('已存档', { icon: '存' }); this.pageSave((p.innerHTML = '', p)); } };
      }
      if (info) {
        const lb = el('button', 'jl-btn small primary', a, '读');
        lb.onclick = async () => { audio.sfx('ok'); this.closeMenu(); await this.app.load(slot); };
      }
    }
  }
}

function esc(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
/** 【重点】→ 朱色；〔淡〕→ 灰 */
export function parseMarkup(text) {
  const out = [];
  let buf = '', cls = '';
  for (const ch of text) {
    if (ch === '【') { if (buf) out.push({ text: buf, cls }); buf = ''; cls = 'hl'; continue; }
    if (ch === '】' && cls === 'hl') { out.push({ text: buf, cls }); buf = ''; cls = ''; continue; }
    if (ch === '〔') { if (buf) out.push({ text: buf, cls }); buf = ''; cls = 'dim'; continue; }
    if (ch === '〕' && cls === 'dim') { out.push({ text: buf, cls }); buf = ''; cls = ''; continue; }
    buf += ch;
  }
  if (buf) out.push({ text: buf, cls });
  return out;
}
