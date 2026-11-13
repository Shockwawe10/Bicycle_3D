// Turn the hero bike through 360 degrees (arrow keys, 45-degree steps) and sheet the frames: node scrollcraft/builds/varsen/tools/check-turn.mjs <tag>
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const tag = process.argv[2] || 'turn';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://127.0.0.1:4500/?qa=1');
await p.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60000 });
await p.waitForTimeout(800);
await p.locator('[data-plate="front"]').focus();
const shots = [];
for (let i = 0; i < 8; i++) {
  const box = await p.locator('[data-plate="front"]').boundingBox();
  const f = `qa/tmp/${tag}-${i * 45}.png`;
  await p.screenshot({ path: f, clip: { x: box.x + box.width * 0.2, y: box.y, width: box.width * 0.6, height: box.height } });
  shots.push(`${i * 45} deg=${f}`);
  for (let k = 0; k < 3; k++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(60); }
  await p.waitForTimeout(1600);
}
await b.close();
execFileSync('node', ['qa/contact-sheet.mjs', `qa/tmp/${tag}.png`, ...shots], { env: { ...process.env, COLS: '4', CELL: '420' }, stdio: 'inherit' });
