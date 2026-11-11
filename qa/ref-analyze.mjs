import fs from 'node:fs';
const m = process.argv[2] || 'desktop';
const j = JSON.parse(fs.readFileSync(`qa/reference/${m}.json`));
console.log(m, 'names', j.names.join(' | '));
const D = 30.0333;
console.log(' p    y      time  t/D    cam.pos               cam.fov  vb.pos                 vb.scale  part0                      blockTops(op<1 marked)');
for (const s of j.samples.filter((_, i) => i % 5 === 0)) {
  console.log(s.p.toFixed(2).padStart(4), String(s.y).padStart(6), s.time.toFixed(2).padStart(6), (s.time / D).toFixed(3), JSON.stringify(s.cam.p).padEnd(24), String(s.cam.fov.toFixed?.(1) ?? s.cam.fov).padStart(5), JSON.stringify(s.vb?.p).padEnd(24), JSON.stringify(s.vb?.s?.[0]), JSON.stringify(s.parts[0]).padEnd(28), s.blocks.map(b => b[0] + (b[1] < 1 ? '*' + b[1] : '')).join(','));
}
// time-vs-p linearity
const lin = j.samples.map(s => Math.abs(s.time / D - s.p)); console.log('max |t/D - p| =', Math.max(...lin).toFixed(4));
// camera motion speed per 1% p -> where camera moves
const sp = j.samples.slice(1).map((s, i) => Math.hypot(...s.cam.p.map((v, k) => v - j.samples[i].cam.p[k])));
console.log('camera speed per 1%p (x100):', sp.map(v => Math.round(v * 100)).join(' '));
const bk = j.samples.slice(1).map((s, i) => Math.hypot(...s.parts[0].slice(0,3).map((v, k) => v - j.samples[i].parts[0][k])));
console.log('bike(part0) speed per 1%p (x100):', bk.map(v => Math.round(v * 100)).join(' '));
// damping series -> time constant: fraction of the jump covered over time
const ds = j.damping; const target = ds[ds.length - 1][1], start = ds[0][1];
const at = f => ds.find(([, t]) => (t - start) / (target - start) >= f)?.[0];
console.log('damping: start', start, 'target', target, '50% at', at(.5), 'ms, 90% at', at(.9), 'ms, 99% at', at(.99), 'ms');
