// Camera clearance on In detail's flights: node scrollcraft/builds/varsen/tools/check-detail-clearance.mjs [port]
// Every flight a visitor can start from rest: the overview to each part and back, and each Previous / Next step
// (part i to i + 1, wrapping, both ways). Each is sampled at 200 points with the page's own camera maths
// (window.__bike.detailCam) at plate aspects 0.6 to 1.5, and the camera's distance is taken to every part's world
// bounding box and to the floor. Fails if any is under MIN metres. A flight redirected mid-way starts from wherever the
// camera is; those are not enumerated here.
import { chromium } from 'playwright';
const port = process.argv[2] || '4500', MIN = 0.25, ASPECTS = [0.6, 0.8, 1.0, 1.2, 1.5];
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`http://127.0.0.1:${port}/?qa=1`);
await p.waitForFunction(() => window.__bike?.ready === true, null, { timeout: 60000 });
const out = await p.evaluate(({ ASPECTS }) => {
  const B = window.__bike, T = B.THREE, gl = B.gl, base = gl.base, n = B.partCount;
  B.pose(1); base.root.updateMatrixWorld(true);
  const boxes = Object.entries(base.parts).map(([id, g]) => [id, new T.Box3().setFromObject(g)]);
  const floorY = base.box.min.y, flights = [];
  for (let i = 0; i < n; i++) { flights.push([-1, i], [i, -1], [i, (i + 1) % n], [(i + 1) % n, i]); }
  const res = [];
  for (const [a, c] of flights) {
    let worst = { d: Infinity };
    for (const aspect of ASPECTS) for (let s = 0; s <= 200; s++) {
      const { pos } = B.detailCam(a, c, s / 200, aspect), v = new T.Vector3(...pos);
      for (const [id, bx] of boxes) { const d = bx.distanceToPoint(v); if (d < worst.d) worst = { d, id, k: s / 200, aspect }; }
      const f = v.y - floorY; if (f < worst.d) worst = { d: f, id: 'floor', k: s / 200, aspect };
    }
    res.push({ from: a, to: c, ...worst });
  }
  return res;
}, { ASPECTS });
await b.close();
const name = i => (i < 0 ? 'overview' : ['frame', 'drivetrain', 'brakes', 'wheels', 'cockpit'][i]);
let bad = 0;
for (const r of out) {
  const fail = r.d < MIN; bad += fail;
  console.log(`${name(r.from).padEnd(10)} -> ${name(r.to).padEnd(10)} closest ${r.d.toFixed(3)} m (${r.id}, k ${r.k.toFixed(2)}, aspect ${r.aspect})${fail ? '  FAIL' : ''}`);
}
const min = Math.min(...out.map(r => r.d));
console.log(bad ? `\n${bad} flights come within ${MIN} m of the bike` : `\nall ${out.length} flights clear: closest approach ${min.toFixed(3)} m`);
process.exitCode = bad ? 1 : 0;
