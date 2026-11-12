// Scan the scroll story for parts that pass through each other (qa/overlap-core.mjs does the work in the page).
// node qa/overlap.mjs [out.json] [from] [to]      e.g. node qa/overlap.mjs qa/results/overlaps.json 0 1
import { chromium } from 'playwright';
import fs from 'node:fs';
import { overlapScan } from './overlap-core.mjs';
import { fits } from './tests/spec-data.mjs';
const [out = 'qa/results/overlaps.json', from = '0', to = '1'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:4173/index.html?qa=1');
await page.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60_000 });
const r = await page.evaluate(overlapScan, { from: +from, to: +to, fits: fits() });
await b.close();
fs.writeFileSync(out, JSON.stringify({ errors, ...r }, null, 1));
console.log(`${r.samples} samples, ${r.pairTests} pair tests, ${r.ms} ms; bodies: ${r.bodies.map(x => `${x.name} ${x.triangles}`).join(', ')}`);
if (errors.length) console.log('page errors:', errors);
for (const o of r.overlaps) console.log(`${String(o.maxDepthMm).padStart(7)} mm  ${o.pairs.padEnd(58)} p ${o.ranges.map(([a, z]) => a === z ? a : `${a}-${z}`).join(', ').slice(0, 120)}  (max at ${o.pAtMax.toFixed(4)} [${o.atMm}] mm, opacity ${o.opacityAtMax})`);
console.log(`${r.overlaps.length} overlapping mesh pairs`);
for (const f of r.fits) console.log(`fit  ${f.shaft} in ${f.host}: p ${f.ranges.map(([a, z]) => a === z ? a : `${a}-${z}`).join(', ') || 'never'}; off its axis by at most ${f.maxDeviationMm} mm`);
