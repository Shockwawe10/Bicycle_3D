// The Varsen build with JavaScript off: node scrollcraft/builds/varsen/tools/check-no-js.mjs <w> <h>
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const [w = '1440', h = '900'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const mobile = +w < 860;
const p = await (await b.newContext({ javaScriptEnabled: false, viewport: { width: +w, height: +h }, ...(mobile ? { deviceScaleFactor: 2 } : {}) })).newPage();
const failed = [];
p.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await p.goto('http://127.0.0.1:4500/'); await p.waitForTimeout(800);
const hidden = await p.evaluate(() => [...document.querySelectorAll('h1, h2, h3, p, dd, .action, label')].filter(e => {
  const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
  for (let n = e; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).opacity === '0') return true;
  return false;
}).map(e => e.tagName + ': ' + e.textContent.trim().slice(0, 40)));
console.log('text hidden by opacity 0:', hidden.length ? hidden : 'none');
const shots = [];
for (const id of ['front', 'glance', 'build', 'detail', 'yours', 'book']) {
  await p.evaluate(id => document.getElementById(id).scrollIntoView({ behavior: 'instant' }), id); await p.waitForTimeout(300);   // instant: the page scrolls smoothly, a capture would land mid-way
  const f = `qa/tmp/nojs-${w}-${id}.png`; await p.screenshot({ path: f }); shots.push(`${id}=${f}`);
}
// Enter in the height field must not navigate (no form to submit)
await p.evaluate(() => document.getElementById('yours').scrollIntoView());
const before = p.url();
await p.locator('#height').fill('176'); await p.locator('#height').press('Enter'); await p.waitForTimeout(500);
console.log('after Enter in the height field, URL:', p.url() === before ? 'unchanged' : p.url());
console.log('failed', JSON.stringify(failed));
await b.close();
execFileSync('node', ['qa/contact-sheet.mjs', `qa/tmp/nojs-${w}.png`, ...shots], { env: { ...process.env, COLS: '4', CELL: mobile ? '230' : '420' }, stdio: 'inherit' });
