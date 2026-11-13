// Interpenetration scan of the Varsen build: the size-56 assembly over its whole build progress, then every size assembled.
// node scrollcraft/builds/varsen/tools/check-overlaps.mjs (from the repo root; the build served on port 4500). Writes lab-overlaps.json.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { overlapScan } from '../../../../qa/overlap-core.mjs';
import { fits } from '../../../../qa/tests/spec-data.mjs';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
await page.goto('http://127.0.0.1:4500/?qa=1');
await page.waitForFunction(() => window.__bike?.ready === true && window.__bike.sizesReady === true, null, { timeout: 90_000 });
const out = {};
const F = fits();
for (const size of [56, 44, 49, 52, 54, 58, 61]) {
  await page.evaluate(s => window.__bike.useSize(s), size);
  const r = await page.evaluate(overlapScan, size === 56 ? { fits: F } : { points: [1], fits: F });
  out[size] = r;
  console.log(`size ${size}: ${r.samples} samples, ${r.overlaps.length} overlapping pairs; fits off-axis max ${Math.max(0, ...r.fits.map(f => f.maxDeviationMm))} mm`);
  for (const o of r.overlaps) console.log(`   ${String(o.maxDepthMm).padStart(6)} mm  ${o.pairs}  at p ${o.pAtMax.toFixed(3)} [${o.atMm}]`);
}
await page.evaluate(() => window.__bike.useSize(56));
fs.writeFileSync('scrollcraft/builds/varsen/lab-overlaps.json', JSON.stringify(out, null, 1));
await b.close();
