// Reproduce one jump-vs-sequential pair and save both screenshots plus the scene state for each.
import { chromium } from 'playwright';
const target = Number(process.argv[2] || 0.356), prev = Number(process.argv[3] || 0.628);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/index.html?qa=1'); await page.waitForFunction(() => window.__bike?.ready); await page.waitForTimeout(700);
const go = p => page.evaluate(async p => { const L = window.__bike.layout; scrollTo(0, Math.round(L.storyTop + p * L.span)); await window.__bike.settled(); }, p);
const snap = () => page.evaluate(() => { const B = window.__bike, o = {}; for (const [id, g] of Object.entries(B.parts)) { const m = []; g.traverse(x => x.isMesh && m.push((x.material.transparent || x.material.alphaHash) ? +x.material.opacity.toFixed(4) : 1)); o[id] = { v: g.visible, op: [...new Set(m)] }; } return { shown: B.p.shown, view: B.gl.view, cam: B.camera.position.toArray().map(x => +x.toFixed(6)), o }; });
for (let k = 1; k <= 8; k++) await go(target * k / 8);
const s1 = await snap(); await page.screenshot({ path: 'qa/tmp/seq.png' });
await go(prev); await go(target);
const s2 = await snap(); await page.screenshot({ path: 'qa/tmp/jump.png' });
await page.evaluate(() => { const B = window.__bike; B.renderer.render(B.scene, B.camera); }); await page.waitForTimeout(100); await page.screenshot({ path: 'qa/tmp/jump2.png' });
console.log('seq ', JSON.stringify(s1)); console.log('jump', JSON.stringify(s2));
await b.close();
