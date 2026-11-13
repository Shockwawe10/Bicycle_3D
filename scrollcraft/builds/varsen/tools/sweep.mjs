// Screenshot the Varsen build at section positions: node scrollcraft/builds/varsen/tools/sweep.mjs <tag> <w> <h> <spec> [query] [engine]
// spec: "front:0,front:0.5,chart:0.45,build:0.3" -> section id : progress through it (0 = its top at the viewport top)
import { chromium, webkit } from 'playwright';
import { execFileSync } from 'node:child_process';
const [tag = 'v', w = '1440', h = '900', spec = 'front:0', query = '?qa=1', eng = 'chrome'] = process.argv.slice(2);
const type = eng === 'webkit' ? webkit : chromium;
const launch = eng === 'webkit' ? {} : { channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] };
const mobile = +w < 860;
const b = await type.launch(launch);
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, ...(mobile ? { deviceScaleFactor: 2, isMobile: eng === 'webkit', hasTouch: true } : {}) });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 400)));
p.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });
await p.goto('http://127.0.0.1:4500/' + query);
await p.waitForFunction(() => window.__bike?.ready === true && window.__bike.sizesReady === true, null, { timeout: 60000 });
await p.waitForTimeout(400);
const shots = [];
for (const item of spec.split(',')) {
  const [id, f] = item.split(':');
  await p.evaluate(([id, f]) => { const s = document.getElementById(id), top = s.getBoundingClientRect().top + scrollY, span = Math.max(0, s.offsetHeight - innerHeight); scrollTo(0, Math.round(top + +f * span)); }, [id, f]);
  await p.waitForTimeout(120); await p.evaluate(() => window.__bike.settled()); await p.waitForTimeout(250);
  const file = `qa/tmp/vs-${tag}-${id}-${f}.png`; await p.screenshot({ path: file }); shots.push(`${id} ${f}=${file}`);
}
await b.close();
execFileSync('node', ['qa/contact-sheet.mjs', `qa/tmp/vs-${tag}.png`, ...shots], { env: { ...process.env, COLS: String(Math.min(4, shots.length)), CELL: mobile ? '230' : '420' }, stdio: 'inherit' });
