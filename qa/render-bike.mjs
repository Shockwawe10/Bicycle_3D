// Render the Phase-1 procedural bike to a transparent PNG for the design comps.
// node qa/render-bike.mjs <paintHex> <out.png> [az] [w] [h]
import { chromium } from 'playwright';
const [paint, out, az = '-24', w = '1600', h = '1000'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await p.goto(`http://127.0.0.1:4173/index.html?comp=1&paint=${paint}&az=${az}&el=8`);
await p.waitForFunction(() => window.__bike?.ready); await p.waitForTimeout(800);
await p.screenshot({ path: out, omitBackground: true });
await b.close(); console.log('wrote', out);
