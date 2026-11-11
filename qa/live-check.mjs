// Smoke-check a deployed page at iPhone size: loads, builds the bike, geometry OK, no errors, and the bike is VISIBLE
// (dark pixels in the bike region) at p = 0, 0.5 and 1. A blank canvas fails.
// node qa/live-check.mjs [chrome|webkit] [url]
//   chrome: adaptive quality live (real canvas resizes on a quality step).
//   webkit: quality locked (?qa=1): Playwright's Windows WebKit cannot present a resized WebGL canvas at all
//           (qa/probe/resize.html reproduces it with raw WebGL), so a quality step there blanks the screenshot.
import { webkit, chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const engine = process.argv[2] || 'chrome';
const base = process.argv[3] || 'https://shockwawe10.github.io/Bicycle_3D/';
const url = engine === 'webkit' ? base + (base.includes('?') ? '&' : '?') + 'qa=1' : base;
const type = engine === 'webkit' ? webkit : chromium;
const launch = engine === 'webkit' ? {} : { channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] };
const b = await type.launch(launch), page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/^Refused to apply a stylesheet because its hash/.test(m.text())) errors.push(m.text()); });
const res = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
await page.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60_000 });
await page.waitForTimeout(800);
const s = await page.evaluate(() => ({ geometryOK: window.__bike.geometryOK, glReady: document.documentElement.classList.contains('gl-ready') }));
const visible = {};
for (const p of [0, 0.5, 1]) {
  await page.evaluate(async p => { const L = window.__bike.layout; scrollTo(0, Math.round(L.storyTop + p * L.span)); await window.__bike.settled(); }, p);
  await page.waitForTimeout(300);
  const f = `qa/results/live-${engine}-p${p * 100}.png`;
  const rect = await page.evaluate(() => window.__bike.layout.rect);
  await page.screenshot({ path: f });
  const dark = Number(execFileSync('py', ['-3.11', '-c', `from PIL import Image\nim=Image.open(r'${f}').convert('L');k=im.size[0]/390\nbox=tuple(int(v*k) for v in (${rect.x},${rect.y},${rect.x + rect.w},${rect.y + rect.h}))\nprint(sum(1 for v in im.crop(box).tobytes() if v<70))`]).toString());
  visible[p] = { darkPixels: dark, quality: await page.evaluate(() => window.__bike.quality.i) };
}
if (engine === 'chrome') {                           // force one adaptive step at rest: the canvas is resized and must be redrawn
  await page.evaluate(async () => { window.__bike.setQuality(1); for (let k = 0; k < 4; k++) await new Promise(r => requestAnimationFrame(r)); });
  const f = 'qa/results/live-chrome-after-quality-step.png', rect = await page.evaluate(() => window.__bike.layout.rect);
  await page.screenshot({ path: f });
  visible.afterQualityStep = { darkPixels: Number(execFileSync('py', ['-3.11', '-c', `from PIL import Image
im=Image.open(r'${f}').convert('L');k=im.size[0]/390
box=tuple(int(v*k) for v in (${rect.x},${rect.y},${rect.x + rect.w},${rect.y + rect.h}))
print(sum(1 for v in im.crop(box).tobytes() if v<70))`]).toString()), quality: await page.evaluate(() => window.__bike.quality.i) };
}
const ok = res.status() === 200 && s.geometryOK && s.glReady && errors.length === 0 && Object.values(visible).every(v => v.darkPixels > 500);
console.log(JSON.stringify({ engine, url, status: res.status(), ...s, visible, errors, ok }));
await b.close();
process.exit(ok ? 0 : 1);
