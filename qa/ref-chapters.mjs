import fs from 'node:fs';
for (const m of ['desktop', 'mobile']) {
  const j = JSON.parse(fs.readFileSync(`qa/reference/${m}.json`));
  const maxY = j.samples[100].y, S = j.samples;
  const at = (p, f) => { const i = Math.min(99, Math.floor(p * 100)), k = p * 100 - i; const a = f(S[i]), b = f(S[i + 1]); return a + (b - a) * k; };
  const tops = m === 'desktop' ? [0, 950, 2750, 4550, 6350, 8150, 9950] : [0, 747, 2108, 3470, 4831, 6192, 7553];
  const names = ['intro', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'outro'];
  console.log(`\n${m}: maxY=${maxY}px = ${(maxY / j.doc.innerH).toFixed(2)} vh (doc ${j.doc.scrollH}px = ${(j.doc.scrollH / j.doc.innerH).toFixed(2)} vh)`);
  console.log('chapter  p-range          time-range(s)   cam travel  cam start -> end');
  for (let k = 0; k < 7; k++) {
    const p0 = tops[k] / maxY, p1 = Math.min(1, (tops[k + 1] ?? maxY) / maxY);
    const i0 = Math.round(p0 * 100), i1 = Math.round(p1 * 100);
    let travel = 0; for (let i = i0; i < i1; i++) travel += Math.hypot(...S[i + 1].cam.p.map((v, d) => v - S[i].cam.p[d]));
    console.log(names[k].padEnd(8), `[${p0.toFixed(3)}, ${p1.toFixed(3)})`.padEnd(17), `${at(p0, s => s.time).toFixed(2)} -> ${at(Math.min(p1, .999), s => s.time).toFixed(2)}`.padEnd(15), travel.toFixed(2).padStart(6) + ' m  ', JSON.stringify(S[i0].cam.p), '->', JSON.stringify(S[i1].cam.p));
  }
}
