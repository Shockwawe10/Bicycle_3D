// Close-up renders of the assembled bike + triangle/draw-call budget. node qa/closeup.mjs [tag]
// Views are relative to part origins (joints), so they stay valid while parts gain detail.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const tag = process.argv[2] || 'now';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.5 });
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
await page.goto('http://127.0.0.1:4173/index.html?qa=1');
await page.waitForFunction(() => window.__bike?.ready, null, { timeout: 60000 });
await page.evaluate(async () => { const L = window.__bike.layout; scrollTo(0, L.storyTop + L.span); await window.__bike.settled(); });
await page.waitForTimeout(400);
const budget = await page.evaluate(() => { const B = window.__bike, r = B.renderer; r.render(B.scene, B.camera);
  let meshes = 0; B.scene.traverse(o => { if (o.isMesh) meshes++; }); return { triangles: r.info.render.triangles, calls: r.info.render.calls, meshes, geometries: r.info.memory.geometries, textures: r.info.memory.textures }; });
console.log(JSON.stringify(budget));
const views = { full: null, cockpit: ['handlebar', [0.05, -0.03, 0], 0.75, 35, 18], front: ['wheelF', [0, 0.05, 0], 1.0, 25, 8], drivetrain: ['drivetrain', [-0.18, 0, 0], 0.85, -20, 8], saddle: ['saddle', [-0.04, 0.2, 0], 0.65, 30, 20], bb: ['drivetrain', [0, 0, 0.04], 0.55, 10, 5] };
const shots = [];
for (const [name, v] of Object.entries(views)) {
  await page.evaluate(v => {
    const B = window.__bike, T = B.THREE, cam = B.camera;
    for (const e of document.querySelectorAll('.beats, .top')) e.style.visibility = v ? 'hidden' : '';
    if (v) {
      const [part, off, dist, az, el] = v, t = B.parts[part].getWorldPosition(new T.Vector3()).add(new T.Vector3(...off));
      const a = az * Math.PI / 180, e = el * Math.PI / 180;
      cam.clearViewOffset(); cam.position.copy(t).add(new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist));
      cam.near = 0.02; cam.far = 20; cam.lookAt(t); cam.updateProjectionMatrix();
    }
    B.renderer.render(B.scene, cam);
  }, v);
  const f = `qa/shots/closeup-${tag}-${name}.png`;
  await page.screenshot({ path: f, clip: v ? { x: 0, y: 0, width: 900, height: 600 } : undefined }); shots.push(`${name}=${f}`);
}
await b.close();
execFileSync('node', ['qa/contact-sheet.mjs', `qa/shots/closeup-${tag}.png`, ...shots], { env: { ...process.env, COLS: '3', CELL: '420' }, stdio: 'inherit' });
