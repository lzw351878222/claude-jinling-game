// 宿主自检用的最小示例
export default {
  id: '_demo',
  title: '示例',
  subtitle: '宿主自检',
  rules: ['点击<b>中间的按钮</b>即可过关。', '第一次故意失败，用来测试重试。'],
  controls: '鼠标 / 触屏',
  async play(ctx) {
    const { canvas, g } = ctx.canvas();
    ctx.hud({ center: '第 ' + ctx.attempt + ' 次', right: '难度 ' + ctx.difficulty });
    let t0 = 0;
    const stop = ctx.loop((dt, t) => {
      t0 += dt;
      const w = ctx.w, h = ctx.h;
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#b23a2e';
      g.beginPath(); g.arc(w / 2 + Math.cos(t0) * 80, h / 2, 30, 0, 7); g.fill();
    });
    const b = ctx.el('button', 'jl-btn', null, '过关');
    b.style.cssText = 'position:absolute;left:50%;bottom:30px;transform:translateX(-50%)';
    await new Promise((res) => { b.onclick = res; ctx.signal.addEventListener('abort', res); });
    stop();
    ctx.toast('好！', 'good');
    await ctx.wait(400);
    return { success: ctx.attempt > 1, score: 100, note: ctx.attempt > 1 ? '通过' : '故意失败一次' };
  },
};
