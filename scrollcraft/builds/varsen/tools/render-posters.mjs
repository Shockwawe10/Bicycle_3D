// Renders the no-WebGL posters from the live scene into assets/posters/*.webp.
//   node scrollcraft/builds/varsen/tools/render-posters.mjs [url]
// Needs the build served (the scroll-craft serve.mjs on port 4500) and Playwright with Chrome. Re-run after any change
// to the model, the materials or a plate's camera: the posters must show the scene the page renders.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:4500/?qa=1';
const out = new URL('../assets/posters/', import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', e => console.error('page error:', String(e)));
await page.goto(url);
await page.waitForFunction(() => window.__bike?.ready === true && window.__bike.sizesReady === true, null, { timeout: 90000 });
if (await page.evaluate(() => document.documentElement.classList.contains('no-webgl'))) throw new Error('WebGL is unavailable here: nothing to render');

const save = (name, dataUrl) => {
  if (!dataUrl.startsWith('data:image/webp')) throw new Error(`${name}: the browser did not encode WebP`);
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  writeFileSync(new URL(`${name}.webp`, out), bytes);
  console.log(`${name}.webp  ${(bytes.length / 1024).toFixed(0)} KB`);
};
const jobs = [['front'], ['build'], ...[0, 1, 2, 3, 4].map(i => ['tour', i]), ...[44, 49, 52, 54, 56, 58, 61].map(s => ['size', s])];
for (const [kind, arg] of jobs) {
  save(arg === undefined ? kind : `${kind}-${arg}`, await page.evaluate(([k, a]) => window.__bike.poster(k, a, 800), [kind, arg ?? null]));
}
await browser.close();
