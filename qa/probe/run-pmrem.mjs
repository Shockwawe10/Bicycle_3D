import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
for (const q of ['?warm', '?warm&aa', '?warm&alpha', '?warm&hp', '?warm&aa&alpha&hp']) { const p = await b.newPage(); await p.goto('http://127.0.0.1:4173/qa/probe/pmrem.html' + q); await p.waitForFunction(() => window.T, null, { timeout: 30000 }); console.log(q || 'cold', JSON.stringify(await p.evaluate(() => window.T))); await p.close(); }
await b.close();
