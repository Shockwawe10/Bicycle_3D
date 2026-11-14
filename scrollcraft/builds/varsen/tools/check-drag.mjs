// The hero's drag-to-turn: node scrollcraft/builds/varsen/tools/check-drag.mjs [port]
// 1. drag left fast, reverse right a short way, release: the bike must keep turning right (the way the finger last moved)
// 2. drag, hold still 300 ms, release: the bike must not move after release
// 3. touch-drag on a 3x phone with 400 ms holds: no sharp-at-rest pass may run while the finger is down
// Exit code 1 on any failure.
import { chromium } from 'playwright';
const port = process.argv[2] || '4500', url = `http://127.0.0.1:${port}/?qa=1`, wrap = d => Math.atan2(Math.sin(d), Math.cos(d));
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const ready = async p => { await p.goto(url); await p.waitForFunction(() => window.__bike?.ready && window.__bike.sizesReady, null, { timeout: 90000 }); await p.evaluate(() => window.__bike.settled()); await p.waitForTimeout(400); };
let fails = 0; const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); await ready(p);
const box = await p.locator('[data-plate="front"]').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const yaw = () => p.evaluate(() => window.__bike.spin.yaw);
await p.mouse.move(cx, cy); await p.mouse.down();
for (let k = 1; k <= 10; k++) { await p.mouse.move(cx - k * 30, cy); await p.waitForTimeout(16); }
for (let k = 1; k <= 3; k++) { await p.mouse.move(cx - 300 + k * 10, cy); await p.waitForTimeout(16); }
let y0 = await yaw(); await p.mouse.up(); await p.waitForTimeout(1500); let d = wrap(await yaw() - y0);
check(d > 0.05, `reverse then release: turns with the last motion (+${d.toFixed(2)} rad)`);
await p.mouse.move(cx, cy); await p.mouse.down();
for (let k = 1; k <= 10; k++) { await p.mouse.move(cx + k * 30, cy); await p.waitForTimeout(16); }
await p.waitForTimeout(300); y0 = await yaw(); await p.mouse.up(); await p.waitForTimeout(1500); d = wrap(await yaw() - y0);
check(Math.abs(d) < 0.01, `hold still then release: no fling (${d.toFixed(3)} rad)`);
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const q = await ctx.newPage(), cdp = await ctx.newCDPSession(q); await ready(q);
const qb = await q.locator('[data-plate="front"]').boundingBox(), qx = qb.x + qb.width / 2, qy = qb.y + qb.height / 2;
const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: qy }] });
const before = await q.evaluate(() => (window.__bike.restMs || []).length);
let x = qx; await touch('touchStart', x);
for (let k = 1; k <= 16; k++) { x = qx - k * 9; await touch('touchMove', x); await q.waitForTimeout(k % 5 === 0 ? 400 : 16); }
const during = await q.evaluate(() => (window.__bike.restMs || []).length) - before; await touch('touchEnd', x);
check(during === 0, `touch drag with 400 ms holds: ${during} sharp-at-rest passes while the finger was down`);
await b.close(); process.exitCode = fails ? 1 : 0;
