// Print console output and errors of a page: node qa/debug-page.mjs [path] [ms]
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', m => console.log('console.' + m.type() + ':', m.text().slice(0, 400)));
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 600)));
p.on('requestfailed', r => console.log('REQFAIL:', r.url(), r.failure()?.errorText));
await p.goto('http://127.0.0.1:4173/' + (process.argv[2] || 'index.html?qa=1'));
await p.waitForTimeout(Number(process.argv[3] || 3000));
console.log('ready=', await p.evaluate(() => window.__bike?.ready), 'status=', await p.evaluate(() => document.getElementById('status')?.textContent));
if (process.argv[4]) await p.screenshot({ path: process.argv[4] });
await b.close();
