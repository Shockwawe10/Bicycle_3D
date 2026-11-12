// GEOMETRY.md section 6: no part passes through another at any p, and the only shared space is a shaft in its bore.
// The scan (qa/overlap-core.mjs) runs in the page against the real meshes; the geometry is the same in every browser,
// so it runs once, in Chrome.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { overlapScan } from '../overlap-core.mjs';
import { fits } from './spec-data.mjs';

test('no part passes through another at any p; designed fits stay on their bore axis', async ({ page }) => {
  test.skip(test.info().project.name !== 'chrome-desktop', 'same geometry in every browser: scanned once, in Chrome');
  test.setTimeout(300_000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/index.html?qa=1');
  await page.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60_000 });
  const F = fits();
  expect(F.length, 'designed fits parsed from GEOMETRY.md').toBeGreaterThanOrEqual(5);
  const r = await page.evaluate(overlapScan, { fits: F });
  fs.writeFileSync('qa/results/overlaps.json', JSON.stringify(r, null, 1));
  expect(r.samples, 'p samples (no part moves more than 1 mm between two)').toBeGreaterThan(2000);
  expect(r.overlaps.map(o => `${o.pairs} at p ${o.pAtMax} [${o.atMm}] mm, ${o.maxDepthMm} mm deep`), 'parts passing through each other').toEqual([]);
  for (const f of r.fits) {
    expect(f.ranges.length, `${f.shaft} in ${f.host}: listed in GEOMETRY.md but never in its bore`).toBeGreaterThan(0);
    expect(f.maxDeviationMm, `${f.shaft} in ${f.host}: off its bore axis at p ${f.pAtMax}`).toBeLessThanOrEqual(0.05);
  }
  expect(errors).toEqual([]);
});
