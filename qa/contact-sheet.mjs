// Build one contact-sheet PNG from several screenshots: node qa/contact-sheet.mjs out.png "label=path" ...
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const [out, ...items] = process.argv.slice(2);
const cells = items.map(s => { const [label, file] = s.split('='); return `<figure><img src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"><figcaption>${label}</figcaption></figure>`; }).join('');
const cols = Number(process.env.COLS || 5), w = Number(process.env.CELL || 300);
const html = `<style>body{margin:0;background:#222;font:12px system-ui;color:#eee;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px}figure{margin:0}img{width:${w}px;display:block}figcaption{padding:2px 0}</style>${cells}`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: cols * (w + 6) + 6, height: 200 } });
await p.setContent(html); await p.waitForTimeout(300); await p.screenshot({ path: out, fullPage: true }); await b.close();
console.log('wrote', path.resolve(out));
