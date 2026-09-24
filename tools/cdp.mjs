// 极简 Chrome 调试协议客户端（开发自测用，零依赖）
//   import { openPage } from './cdp.mjs';
//   const p = await openPage('http://localhost:5173/', { w: 1280, h: 720 });
//   await p.eval('1+1'); await p.shot('a.png'); await p.click(100, 200); await p.key('Enter'); await p.close();
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* 还没起来 */ }
    await sleep(250);
  }
  throw new Error('Chrome 调试端口没有响应');
}

export async function openPage(url, { w = 1280, h = 720, port = 9333 + Math.floor(Math.random() * 400), mobile = false, headless = true } = {}) {
  const prof = path.resolve('tools/.cache/cdp-prof-' + port);
  fs.mkdirSync(prof, { recursive: true });
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader', `--window-size=${w},${h}`, '--hide-scrollbars', 'about:blank'];
  if (headless) args.unshift('--headless=new');
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  const list = await waitJson(`http://127.0.0.1:${port}/json`);
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    else if (d.method === 'Runtime.consoleAPICalled') logs.push(`[${d.params.type}] ` + d.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (d.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  await sleep(1500);
  const page = {
    logs,
    send,
    async eval(expr, awaitPromise = true) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async shot(file, opts = {}) {
      const r = await send('Page.captureScreenshot', { format: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: 80, ...opts });
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    async click(x, y) {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });
    },
    async drag(x0, y0, x1, y1, steps = 8) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
      for (let k = 1; k <= steps; k++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * k / steps, y: y0 + (y1 - y0) * k / steps, button: 'left', buttons: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
    },
    async key(code, key = code) {
      const map = { Enter: ['Enter', '\r', 13], Space: [' ', ' ', 32], Escape: ['Escape', '', 27] };
      const [k, text, vk] = map[code] || [key, key.length === 1 ? key : '', 0];
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, text, windowsVirtualKeyCode: vk });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk });
    },
    async clickText(text, sel = 'button, .choice, .title-btn, [data-click]') {
      const pos = await page.eval(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.offsetParent !== null && e.textContent.includes(${JSON.stringify(text)})); const e = els[els.length - 1]; if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
      if (!pos) throw new Error('找不到按钮：' + text);
      await page.click(pos[0], pos[1]);
      return pos;
    },
    wait: sleep,
    async close() { try { ws.close(); } catch { /* 忽略 */ } proc.kill(); await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch { /* 忽略 */ } },
  };
  return page;
}
