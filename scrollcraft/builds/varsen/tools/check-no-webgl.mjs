// The Varsen build with WebGL unavailable: node scrollcraft/builds/varsen/tools/check-no-webgl.mjs <tag> <w> <h> [lost]
// "lost" loads with WebGL, then forces a context loss (WEBGL_lose_context) to test the same fallback mid-visit.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const [tag = 'nogl', w = '1440', h = '900', mode = 'none'] = process.argv.slice(2);
const lost = mode === 'lost';
const args = lost ? ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'];
const b = await chromium.launch({ channel: 'chrome', args });
const mobile = +w < 860;
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, ...(mobile ? { deviceScaleFactor: 2, hasTouch: true } : {}) });
const p = await ctx.newPage();
const errors = [], failed = [];
p.on('pageerror', e => errors.push(String(e).slice(0, 300)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
p.on('requestfailed', r => failed.push(r.url()));
p.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await p.goto('http://127.0.0.1:4500/?qa=1');
await p.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60000 });
if (lost) {
  await p.waitForFunction(() => window.__bike.sizesReady === true, null, { timeout: 60000 });
  await p.evaluate(() => window.__bike.renderer.getContext().getExtension('WEBGL_lose_context').loseContext());
  await p.waitForTimeout(300);
}
const state = await p.evaluate(() => ({ cls: document.documentElement.className, posters: [...document.querySelectorAll('.plate__poster')].map(e => getComputedStyle(e).display + ' ' + getComputedStyle(e).backgroundImage.slice(-30)) }));
console.log(JSON.stringify(state, null, 1));
const spots = [['front', 0], ['build', 0.1], ['build', 0.6], ['detail', 0], ['yours', 0.2], ['book', 0]];
const shots = [];
for (const [id, f] of spots) {
  await p.evaluate(([id, f]) => { const s = document.getElementById(id), top = s.getBoundingClientRect().top + scrollY, span = Math.max(0, s.offsetHeight - innerHeight); scrollTo(0, Math.round(top + f * span)); }, [id, f]);
  await p.waitForTimeout(450);
  const file = `qa/tmp/ng-${tag}-${id}-${f}.png`; await p.screenshot({ path: file }); shots.push(`${id} ${f}=${file}`);
}
// the chooser still drives the poster without WebGL
await p.evaluate(() => document.getElementById('yours').scrollIntoView());
await p.locator('input[name="size"][value="44"]').check({ force: true });
await p.waitForTimeout(450);
const yoursPoster = await p.evaluate(() => getComputedStyle(document.querySelector('[data-plate="yours"] .plate__poster')).backgroundImage);
console.log('yours poster after choosing 44:', yoursPoster.slice(-32));
const f2 = `qa/tmp/ng-${tag}-yours-44.png`; await p.screenshot({ path: f2 }); shots.push(`yours 44=${f2}`);
console.log('errors', JSON.stringify(errors), 'failed', JSON.stringify(failed));
await b.close();
execFileSync('node', ['qa/contact-sheet.mjs', `qa/tmp/ng-${tag}.png`, ...shots], { env: { ...process.env, COLS: '5', CELL: mobile ? '230' : '420' }, stdio: 'inherit' });
