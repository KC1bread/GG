// TEMP: 无头驱动浏览器采集 [SPACE]/[PERF] 探针数据，定位卡顿根因。测完删除。
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.argv[2] || 'http://localhost:5174/';
const PORT = 9222;

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--window-size=1600,900',
  '--force-device-scale-factor=2',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  URL,
], { stdio: ['ignore', 'ignore', 'ignore'] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.url.includes('localhost'));
      if (page) return page;
    } catch {}
    await sleep(200);
  }
  throw new Error('no page target');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const logs = [];
    ws.onopen = () => resolve({ send, logs, ws });
    ws.onerror = (e) => reject(new Error('ws error'));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const t = msg.params.type;
        const args = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        logs.push(`[${t}] ${args}`);
      }
    };
    function send(method, params = {}) {
      return new Promise((res) => {
        const mid = ++id;
        pending.set(mid, res);
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
    }
  });
}

const key = (type, keyVal, code, vk, modifiers = 0) => ({
  type, key: keyVal, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers,
});

const target = await getTarget();
const cdp = await connect(target.webSocketDebuggerUrl);
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
console.log('== connected, waiting for app to boot ==');
await sleep(6000);

// 阶段 1：静止（不按键），2 秒
await sleep(2000);

// 阶段 2：加速 —— 按住 Shift（升 β）+ W（前进）约 8 秒
console.log('== accelerating (Shift+W) ==');
await cdp.send('Input.dispatchKeyEvent', key('keyDown', 'Shift', 'ShiftLeft', 16, 8));
await cdp.send('Input.dispatchKeyEvent', key('keyDown', 'w', 'KeyW', 87, 8));
await sleep(8000);
await cdp.send('Input.dispatchKeyEvent', key('keyUp', 'w', 'KeyW', 87, 8));
await cdp.send('Input.dispatchKeyEvent', key('keyUp', 'Shift', 'ShiftLeft', 16, 0));

// 阶段 3：静止收尾 2 秒
await sleep(2000);

console.log('=========== [SPACE] / [PERF] 采集结果 ===========');
for (const l of cdp.logs) {
  if (l.includes('[SPACE]') || l.includes('[PERF]')) console.log(l);
}
console.log('=========== 结束 ===========');

chrome.kill();
process.exit(0);
