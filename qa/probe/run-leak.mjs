import { chromium } from 'playwright';
const b = await chromium.launch();
for (const q of ['', '?warm']) { const p = await b.newPage(); await p.goto('http://127.0.0.1:4173/qa/probe/leak.html' + q); await p.waitForFunction(() => window.OUT, null, { timeout: 30000 }); console.log(q || 'nowarm', JSON.stringify(await p.evaluate(() => window.OUT))); await p.close(); }
await b.close();
