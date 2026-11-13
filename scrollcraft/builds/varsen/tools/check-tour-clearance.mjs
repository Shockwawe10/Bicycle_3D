// Camera clearance on the detail tour: sample p, place the camera with the page's own aimTour, and measure the distance
// to every part's world bounding box (and the floor). node scrollcraft/builds/varsen/tools/check-tour-clearance.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://127.0.0.1:4500/?qa=1');
await p.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60000 });
const out = await p.evaluate(() => {
  const B = window.__bike, T = B.THREE, gl = B.gl, base = gl.base;
  for (const x of gl.all) x.root.visible = x === base;
  B.pose(1); base.root.updateMatrixWorld(true);
  const boxes = Object.entries(base.parts).map(([id, g]) => [id, new T.Box3().setFromObject(g)]);
  const res = {};
  for (const aspect of [0.8, 0.94, 1.2]) {
    let worst = { d: Infinity };
    for (let i = 0; i <= 600; i++) {
      const t = i / 600, { pos } = B.aimTour(t, aspect), v = new T.Vector3(...pos);
      for (const [id, bx] of boxes) { const d = bx.distanceToPoint(v); if (d < worst.d) worst = { d, id, t, pos: pos.map(n => +n.toFixed(3)) }; }
      const floor = v.y - base.box.min.y; if (floor < worst.d) worst = { d: floor, id: 'floor', t, pos: pos.map(n => +n.toFixed(3)) };
    }
    res[aspect] = { ...worst, d: +worst.d.toFixed(3), t: +worst.t.toFixed(3) };
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
