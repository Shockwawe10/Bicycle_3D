// Print console output, errors and key page state: node qa/debug-page.mjs [path] [waitMs] [screenshot.png] [w] [h]
import { chromium } from 'playwright';
const [path = 'index.html?qa=1', wait = '3000', shot, w = '1440', h = '900'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', m => { if (!/X4122|Program Info Log/.test(m.text())) console.log('console.' + m.type() + ':', m.text().slice(0, 400)); });
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 600)));
p.on('requestfailed', r => console.log('REQFAIL:', r.url(), r.failure()?.errorText));
await p.goto('http://127.0.0.1:4173/' + path);
await p.waitForTimeout(Number(wait));
const info = await p.evaluate(() => {
  const B = window.__bike;
  return B ? { ready: B.ready, ok: B.geometryOK, v: B.violations, initMs: B.initMs, cls: document.documentElement.className, rect: B.layout?.rect, view: B.gl?.view, quality: B.quality?.i } : 'no __bike';
});
console.log(JSON.stringify(info));
if (shot) await p.screenshot({ path: shot });
await b.close();
