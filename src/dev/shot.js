// 调试：把画布 POST 给开发服务器保存（tools/.cache/shots/）
export async function saveCanvas(canvas, name) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  await fetch('/__save?name=' + encodeURIComponent(name), { method: 'POST', body: blob });
}
/** 把页面里所有 canvas 按网格拼成一张图保存 */
export async function saveAll(name, bg = '#5a7a6a', maxW = 1600) {
  const list = [...document.querySelectorAll('canvas')].filter((c) => c.width > 0 && c.id !== 'gl');
  let x = 0, y = 0, rowH = 0; const pos = [];
  for (const c of list) { if (x + c.width > maxW) { x = 0; y += rowH + 8; rowH = 0; } pos.push([c, x, y]); x += c.width + 8; rowH = Math.max(rowH, c.height); }
  const out = document.createElement('canvas'); out.width = maxW; out.height = y + rowH;
  const g = out.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, out.width, out.height); g.imageSmoothingEnabled = false;
  for (const [c, px, py] of pos) g.drawImage(c, px, py);
  await saveCanvas(out, name);
  return out.width + 'x' + out.height;
}
