// Phase 1 behaviour: the bike is built from the published chart, and the page refuses a bike that is not.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const mdJoints = () => Object.fromEntries(fs.readFileSync('GEOMETRY.md', 'utf8').replace(/−/g, '-').replace(/\r/g, '').split('\n')
  .map(l => l.match(/^\| ([A-Z_]+) \|[^|]*\|[^|]*\| (-?[\d.]+) \| (-?[\d.]+) \|$/)).filter(Boolean)
  .map(m => [m[1], [Number(m[2]), Number(m[3])]]));

async function ready(page) {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => requests.push(r.url()));
  await page.goto('/index.html?qa=1');
  await page.waitForFunction(() => window.__bike && window.__bike.ready === true, null, { timeout: 60_000 });
  return { errors, requests };
}

test('page joints equal the GEOMETRY.md joint table (0.1 mm)', async ({ page }) => {
  const { errors } = await ready(page);
  const want = mdJoints();
  expect(Object.keys(want).length).toBeGreaterThanOrEqual(13);
  const got = await page.evaluate(() => window.__bike.joints);
  for (const [k, [x, y]] of Object.entries(want)) {
    expect(got[k], k).toBeTruthy();
    expect(Math.abs(got[k][0] - x), `${k}.x`).toBeLessThanOrEqual(0.1);
    expect(Math.abs(got[k][1] - y), `${k}.y`).toBeLessThanOrEqual(0.1);
  }
  expect(errors).toEqual([]);
});

test('built scene passes the startup assertion and sits in the chart range', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(() => ({ ok: window.__bike.geometryOK, v: window.__bike.violations, m: window.__bike.measures }));
  expect(r.v).toEqual([]);
  expect(r.ok).toBe(true);
  expect(r.m.wheelbase).toBeGreaterThanOrEqual(970); expect(r.m.wheelbase).toBeLessThanOrEqual(1013);
  expect(Math.abs(r.m.wheelbase - 991)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.m.wheelDiameter - 674)).toBeLessThanOrEqual(674 * 0.005);
  expect(r.m.headAngle).toBeGreaterThanOrEqual(70.5); expect(r.m.headAngle).toBeLessThanOrEqual(74);
  expect(Math.abs(r.m.headAngle - 73.5)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(r.m.trail - 53.5)).toBeLessThanOrEqual(1);
});

test('the assertion rejects a bike outside the chart', async ({ page }) => {
  await ready(page);
  const v = await page.evaluate(() => {
    const ok = window.__bike.measures;
    return {
      steep: window.__bike.validateGeometry({ ...ok, headAngle: 80 }),
      long: window.__bike.validateGeometry({ ...ok, wheelbase: 1100 }),
      smallWheel: window.__bike.validateGeometry({ ...ok, wheelDiameter: 584 }),
      good: window.__bike.validateGeometry(ok),
    };
  });
  expect(v.good).toEqual([]);
  expect(v.steep.join(' ')).toMatch(/head ?angle/i);
  expect(v.long.join(' ')).toMatch(/wheelbase/i);
  expect(v.smallWheel.join(' ')).toMatch(/wheel ?diameter/i);
});

test('parts are procedural: torus tyres, instanced spokes, no downloaded models', async ({ page }) => {
  const { requests } = await ready(page);
  const s = await page.evaluate(() => {
    const out = { tyres: [], spokes: [], parts: Object.keys(window.__bike.parts) };
    window.__bike.scene.traverse(o => {
      if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.name.startsWith('tyre')) out.tyres.push(o.geometry.parameters);
      if (o.isInstancedMesh && o.name.startsWith('spokes')) out.spokes.push(o.count);
    });
    return out;
  });
  expect(s.parts).toEqual(['frame', 'fork', 'wheelF', 'wheelR', 'drivetrain', 'handlebar', 'saddle']);
  expect(s.tyres).toHaveLength(2);
  for (const t of s.tyres) expect(Math.round((t.radius + t.tube) * 2000)).toBe(674);
  expect(s.spokes).toEqual([24, 24]);
  const foreign = requests.filter(u => !/^http:\/\/127\.0\.0\.1:4173\/(index\.html|vendor\/three@0\.185\.1\/[\w.]+\.js)(\?|$)/.test(u) && !u.startsWith('data:'));
  expect(foreign).toEqual([]);
  expect(requests.some(u => /\.(glb|gltf|obj|fbx|ktx2|hdr|exr)(\?|$)/i.test(u))).toBe(false);
});
