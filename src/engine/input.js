// 输入：键盘（WASD/方向键/E/空格/Esc…）、鼠标点击移动、触屏虚拟摇杆与按钮。
import { el, isTouchDevice } from '../core/util.js';

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();   // 本帧按下
    this.listeners = new Set();
    this.enabled = true;
    this.joy = { x: 0, z: 0, active: false };
    this.clicks = [];
    this.isTouch = isTouchDevice();
    this.lastPointerType = 'mouse';
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) { this.pressed.add(e.code); for (const f of this.listeners) f(e.code, e); }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.joy.x = this.joy.z = 0; });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  /** 当前移动向量（x 右为正，z 下为正），长度 ≤ 1 */
  moveVec() {
    if (!this.enabled) return { x: 0, z: 0 };
    let x = 0, z = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
    if (this.joy.active) { x = this.joy.x; z = this.joy.z; }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z };
  }
  running() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || (this.joy.active && Math.hypot(this.joy.x, this.joy.z) > 0.92); }
  consume(code) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  anyPressed(codes) { for (const c of codes) if (this.pressed.has(c)) { this.pressed.delete(c); return true; } return false; }
  endFrame() { this.pressed.clear(); }

  /** 在 UI 层上建立触屏摇杆与按钮 */
  buildTouchControls(root, { onAction, onMenu }) {
    const wrap = el('div', 'tc-wrap', root);
    const pad = el('div', 'tc-pad', wrap);
    const knob = el('div', 'tc-knob', pad);
    const act = el('button', 'tc-btn tc-act', wrap, '行');
    const menu = el('button', 'tc-btn tc-menu', wrap, '☰');
    let pid = null, cx = 0, cy = 0;
    const R = 46;
    pad.addEventListener('pointerdown', (e) => {
      pid = e.pointerId; pad.setPointerCapture(pid);
      const r = pad.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this.joy.active = true;
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== pid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.hypot(dx, dy) / R;
      this.joy.x = m < 0.18 ? 0 : dx / R;
      this.joy.z = m < 0.18 ? 0 : dy / R;
    };
    pad.addEventListener('pointermove', move);
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null; this.joy.active = false; this.joy.x = this.joy.z = 0;
      knob.style.transform = '';
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    act.addEventListener('pointerdown', (e) => { e.preventDefault(); onAction?.(); });
    menu.addEventListener('pointerdown', (e) => { e.preventDefault(); onMenu?.(); });
    this.touchUI = { wrap, act };
    return this.touchUI;
  }
  setActionLabel(t) { if (this.touchUI) this.touchUI.act.textContent = t || '行'; }
  showTouch(v) { if (this.touchUI) this.touchUI.wrap.style.display = v ? '' : 'none'; }
}
