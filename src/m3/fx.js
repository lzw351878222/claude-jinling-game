// 消消乐动效：补间、粒子、飘字、特效扫光
export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inQuad: (t) => t * t,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/** 补间管理：tw.to(obj, {x: 1}, 0.2, ease.outCubic) → Promise */
export class Tweens {
  constructor() { this.list = []; this.speed = 1; }
  to(obj, props, dur, fn = ease.outCubic, delay = 0) {
    return new Promise((resolve) => {
      const from = {};
      for (const k in props) from[k] = obj[k];
      this.list.push({ obj, from, props, dur: Math.max(0.001, dur), fn, t: -delay, resolve });
    });
  }
  wait(sec) { return this.to({ v: 0 }, { v: 1 }, sec, ease.linear); }
  update(dt) {
    dt *= this.speed;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(1, tw.t / tw.dur);
      const e = tw.fn(k);
      for (const p in tw.props) tw.obj[p] = tw.from[p] + (tw.props[p] - tw.from[p]) * e;
      if (k >= 1) { this.list.splice(i, 1); tw.resolve(); }
    }
  }
  finishAll() { for (const tw of this.list) { for (const p in tw.props) tw.obj[p] = tw.props[p]; tw.resolve(); } this.list.length = 0; }
  get busy() { return this.list.length > 0; }
}

/** 粒子（坐标单位：像素） */
export class Sparks {
  constructor() { this.p = []; }
  burst(x, y, color, n = 10, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 180) * (0.4 + Math.random() * 0.8);
      this.p.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 60), g: o.gravity ?? 420,
        life: 0, max: (o.life ?? 0.6) * (0.7 + Math.random() * 0.6), size: (o.size ?? 5) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(color) ? color[k % color.length] : color, shape: o.shape || (Math.random() < 0.5 ? 'dot' : 'petal'), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
      });
    }
  }
  trail(x, y, color, o = {}) {
    this.p.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, g: 0, life: 0, max: o.life ?? 0.35, size: o.size ?? 6, color, shape: 'dot', rot: 0, vr: 0 });
  }
  update(dt) {
    const P = this.p;
    let n = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.life += dt;
      if (q.life >= q.max) continue;
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      q.vx *= 0.985; q.vy *= 0.985;
      P[n++] = q;
    }
    P.length = n;
  }
  draw(g) {
    for (const q of this.p) {
      const a = 1 - q.life / q.max;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = q.color;
      if (q.shape === 'petal') {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
        g.beginPath(); g.ellipse(0, 0, q.size, q.size * 0.55, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      } else if (q.shape === 'star') {
        const r = q.size;
        g.beginPath(); g.moveTo(q.x, q.y - r); g.lineTo(q.x + r * 0.3, q.y - r * 0.3); g.lineTo(q.x + r, q.y); g.lineTo(q.x + r * 0.3, q.y + r * 0.3);
        g.lineTo(q.x, q.y + r); g.lineTo(q.x - r * 0.3, q.y + r * 0.3); g.lineTo(q.x - r, q.y); g.lineTo(q.x - r * 0.3, q.y - r * 0.3); g.closePath(); g.fill();
      } else {
        g.beginPath(); g.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}

/** 飘字 */
export class Floaters {
  constructor() { this.list = []; }
  add(text, x, y, o = {}) { this.list.push({ text, x, y, t: 0, dur: o.dur ?? 0.9, size: o.size ?? 26, color: o.color || '#fff6d8', stroke: o.stroke || '#5a2a12', rise: o.rise ?? 50, font: o.font || '"JLBrush", KaiTi, serif', pop: o.pop ?? true }); }
  update(dt) { this.list = this.list.filter((f) => (f.t += dt) < f.dur); }
  draw(g) {
    for (const f of this.list) {
      const k = f.t / f.dur;
      const s = f.pop ? (k < 0.15 ? 0.6 + k / 0.15 * 0.5 : k < 0.3 ? 1.1 - (k - 0.15) / 0.15 * 0.1 : 1) : 1;
      g.save();
      g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      g.translate(f.x, f.y - f.rise * ease.outCubic(k));
      g.scale(s, s);
      g.font = `${f.size}px ${f.font}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = f.size * 0.2; g.strokeStyle = f.stroke; g.strokeText(f.text, 0, 0);
      g.fillStyle = f.color; g.fillText(f.text, 0, 0);
      g.restore();
    }
  }
}

/** 特效扫光（笔、烟花、宝印）：画在棋盘坐标系里 */
export class Sweeps {
  constructor() { this.list = []; }
  add(o) { this.list.push({ t: 0, dur: 0.45, ...o }); }
  update(dt) { this.list = this.list.filter((s) => (s.t += dt) < s.dur); }
  draw(g, S, ox, oy, W, H) {
    for (const s of this.list) {
      const k = s.t / s.dur;
      g.save();
      if (s.type === 'line') {
        const a = 1 - k;
        g.globalAlpha = a;
        const cx = ox + (s.x + 0.5) * S, cy = oy + (s.y + 0.5) * S;
        const half = (s.dir === 'h' ? W : H) * S * Math.min(1, k * 2.2);
        const thick = S * (0.55 - k * 0.3) * (s.wide ? 3 : 1);
        const gr = s.dir === 'h' ? g.createLinearGradient(cx - half, 0, cx + half, 0) : g.createLinearGradient(0, cy - half, 0, cy + half);
        gr.addColorStop(0, 'rgba(255,236,170,0)'); gr.addColorStop(0.5, 'rgba(255,248,220,0.95)'); gr.addColorStop(1, 'rgba(255,236,170,0)');
        g.fillStyle = 'rgba(20,16,14,0.55)';
        if (s.dir === 'h') g.fillRect(cx - half, cy - thick / 2 - 4, half * 2, thick + 8); else g.fillRect(cx - thick / 2 - 4, cy - half, thick + 8, half * 2);
        g.fillStyle = gr;
        if (s.dir === 'h') g.fillRect(cx - half, cy - thick / 2, half * 2, thick); else g.fillRect(cx - thick / 2, cy - half, thick, half * 2);
      } else if (s.type === 'burst') {
        const cx = ox + (s.x + 0.5) * S, cy = oy + (s.y + 0.5) * S;
        const r = S * (s.r + 0.5) * ease.outCubic(k) * 1.15;
        g.globalAlpha = 1 - k;
        g.strokeStyle = '#ffe08a'; g.lineWidth = S * 0.18 * (1 - k);
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(255,220,140,0.35)';
        g.beginPath(); g.arc(cx, cy, r * 0.9, 0, Math.PI * 2); g.fill();
      } else if (s.type === 'seal') {
        const cx = ox + (s.x + 0.5) * S, cy = oy + (s.y + 0.5) * S;
        g.globalAlpha = Math.min(1, (1 - k) * 2);
        g.strokeStyle = 'rgba(255,230,160,0.9)';
        g.lineWidth = S * 0.08;
        for (const tIdx of s.targets || []) {
          const tx = ox + ((tIdx % W) + 0.5) * S, ty = oy + (Math.floor(tIdx / W) + 0.5) * S;
          const m = Math.min(1, k * 3);
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (tx - cx) * m, cy + (ty - cy) * m); g.stroke();
        }
        const r = S * 1.6 * ease.outCubic(k);
        g.fillStyle = 'rgba(192,40,30,0.25)';
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }
}
