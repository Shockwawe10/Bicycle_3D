// Scroll the page to several p values (native scroll), wait for the damped p to settle, screenshot, build a sheet.
// node qa/sweep.mjs <tag> <w> <h> [webkit|chrome] [p,p,...] [query]
import { webkit, chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const [tag = 'd', w = '1440', h = '900', eng = 'chrome', ps = '0,0.25,0.5,0.75,1', query = 'qa=1'] = process.argv.slice(2);
const type = eng === 'webkit' ? webkit : chromium;
const launch = eng === 'webkit' ? {} : { channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] };
const ctxo = { viewport: { width: +w, height: +h }, ...(eng === 'webkit' && +w < 1000 ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) };
const b = await type.launch(launch); const page = await (await b.newContext(ctxo)).newPage();
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
await page.goto(`http://127.0.0.1:4173/index.html?${query}`); await page.waitForFunction(() => window.__bike?.ready, null, { timeout: 60000 }); await page.waitForTimeout(700);
const shots = [];
for (const p of ps.split(',').map(Number)) {
  await page.evaluate(p => { const L = window.__bike.layout; window.scrollTo(0, L.storyTop + p * L.span); }, p);
  await page.evaluate(() => window.__bike.settled()); await page.waitForTimeout(150);
  const f = `qa/shots/sweep-${tag}-p${String(Math.round(p * 100)).padStart(3, '0')}.png`; await page.screenshot({ path: f }); shots.push(`p${p}=${f}`);
  console.log(p, JSON.stringify(await page.evaluate(() => ({ shown: +window.__bike.p.shown.toFixed(4), view: window.__bike.gl?.view && { az: +window.__bike.gl.view.az.toFixed(1), el: +window.__bike.gl.view.el.toFixed(1), d: +window.__bike.gl.view.distance.toFixed(2), vol: window.__bike.gl.view.volume } }))));
}
await b.close();
execFileSync('node', ['qa/contact-sheet.mjs', `qa/shots/sweep-${tag}.png`, ...shots], { env: { ...process.env, COLS: String(Math.min(5, shots.length)), CELL: +w < 1000 ? '230' : '380' }, stdio: 'inherit' });
