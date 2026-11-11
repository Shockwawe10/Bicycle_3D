// Derive the joint-coordinate table from the chart's primary numbers (prints GEOMETRY.md's tables).
// The page re-derives the same joints at startup; qa/tests/geometry.spec.mjs checks both agree to 0.1 mm.
// Frame: x forward, y up, z to the rider's right (drive side). Origin: bottom-bracket centre. Units: mm.
export const CHART = { // Specialized Tarmac SL7 frameset, size 56 (specialized.com via bikeinsights.com)
  stack: 555, reach: 398, headTube: 151, headAngle: 73.5, seatAngle: 73.5, seatTube: 496,
  chainstay: 410, bbDrop: 72, forkOffset: 44.4, axleToCrown: 366,
  wheelbase: 991, frontCenter: 592, trail: 53.5, topTubeEff: 563, topTubeSlope: 8.4,
  tyreWidth: 26, tyreOD: 674, bsd: 622,
};
export const BUILD = { // components (assumptions, see GEOMETRY.md section 3)
  rimDepth: 45, rimFlange: 6, crank: 170, stemLength: 100, stemAngle: -6, stackAboveHT: 35,
  saddleHeight: 725, barWidth: 420, ringTeeth: [52, 36], cassette: [11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 30],
  chainPitch: 12.7, frontOLD: 100, rearOLD: 142, crankAngleDeg: -35,
};
const rad = d => d * Math.PI / 180;
export function deriveJoints(c = CHART, b = BUILD) {
  const d = [Math.cos(rad(c.headAngle)), -Math.sin(rad(c.headAngle))];   // down the steering axis
  const n = [Math.sin(rad(c.headAngle)), Math.cos(rad(c.headAngle))];    // forward normal to it
  const s = [-Math.cos(rad(c.seatAngle)), Math.sin(rad(c.seatAngle))];   // up the seat tube
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const HTT = [c.reach, c.stack];
  const HTB = add(HTT, d, c.headTube);
  const FA = add(add(HTT, d, c.headTube + c.axleToCrown), n, c.forkOffset);
  const RA = [-Math.sqrt(c.chainstay ** 2 - c.bbDrop ** 2), c.bbDrop];
  const STT = add([0, 0], s, c.seatTube);
  const stemDir = (() => { const a = rad(90 - c.headAngle + b.stemAngle); return [Math.cos(a), Math.sin(a)]; })();
  const STEM = add(HTT, d, -b.stackAboveHT);
  const BAR = add(STEM, stemDir, b.stemLength);
  const j = {
    BB: [0, 0], RA, FA, HTT, HTB, STT,
    DTH: add(HTB, d, -25),          // down tube meets head tube 25 mm above its bottom
    SSJ: add(STT, s, -30),          // seat stays meet seat tube 30 mm below its top
    CROWN: HTB,                     // fork crown at head-tube bottom (zero lower stack)
    STEM, BAR,
    SADDLE: add([0, 0], s, b.saddleHeight),
    POST_TOP: add([0, 0], s, b.saddleHeight - 40),
  };
  const r2 = v => v.map(x => Math.round(x * 100) / 100);
  for (const k in j) j[k] = r2(j[k]);
  return j;
}
export function derivedMeasures(j, c = CHART) {
  const wheelbase = j.FA[0] - j.RA[0];
  const frontCenter = Math.hypot(j.FA[0], j.FA[1]);
  const headAngle = Math.atan2(j.HTT[1] - j.HTB[1], j.HTB[0] - j.HTT[0]) * 180 / Math.PI;
  const R = c.bsd / 2 + c.tyreWidth;                       // tyre outer radius
  const trail = (R * Math.cos(rad(headAngle)) - c.forkOffset) / Math.sin(rad(headAngle));
  const topTubeSlope = Math.atan2(j.HTT[1] - j.STT[1], j.HTT[0] - j.STT[0]) * 180 / Math.PI;
  const effTopTube = j.HTT[0] + c.stack / Math.tan(rad(c.seatAngle));
  return { wheelbase, frontCenter, headAngle, wheelDiameter: 2 * R, trail, topTubeSlope, effTopTube, ratio: wheelbase / (2 * R) };
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('derive-joints.mjs')) {
  const j = deriveJoints(); const m = derivedMeasures(j);
  console.log('| Joint | x (mm) | y (mm) |\n|---|---:|---:|');
  for (const [k, v] of Object.entries(j)) console.log(`| ${k} | ${v[0].toFixed(2)} | ${v[1].toFixed(2)} |`);
  console.log('\n| Derived | value | chart | delta |\n|---|---:|---:|---:|');
  const ch = { wheelbase: CHART.wheelbase, frontCenter: CHART.frontCenter, headAngle: CHART.headAngle, wheelDiameter: CHART.tyreOD, trail: CHART.trail, topTubeSlope: CHART.topTubeSlope, effTopTube: CHART.topTubeEff };
  for (const [k, v] of Object.entries(ch)) console.log(`| ${k} | ${m[k].toFixed(2)} | ${v} | ${(m[k] - v).toFixed(2)} |`);
  console.log(`| wheelbase / wheel diameter | ${m.ratio.toFixed(4)} | 970/674 .. 1013/674 = ${(970 / 674).toFixed(4)} .. ${(1013 / 674).toFixed(4)} | |`);
}
