// Varsen bike: the procedural model, as a module. Lifted from the original single-page build (index.html in the
// repository root, sections 1, 3 and 4) and extended for this site: every frame size from the published chart, a
// configurable paint, and the assembly order as data. Geometry sources: GEOMETRY.md in the repository root, and
// sizes.js for all seven sizes.
import * as THREE from '../vendor/three@0.185.1/three.module.min.js';
import { BY_SIZE, saddleHeight } from './sizes.js';

export const yieldToMain = () => new Promise(r => (globalThis.scheduler?.yield ? scheduler.yield().then(r) : setTimeout(r, 0)));
let sliceAt = 0;                                   // time-slicing for the build: yield whenever 8 ms have passed (keeps every task short)
export const slice = async () => { if (performance.now() - sliceAt > 8) { await yieldToMain(); sliceAt = performance.now(); } };

/* =====================================================================================
   1. GEOMETRY (pure). Chart in, joints (mm) out. Source and derivation: GEOMETRY.md.
   Frame: x forward, y up, z rider's right (drive side); origin = bottom-bracket centre.
   ===================================================================================== */
export const CHART = BY_SIZE[56];
export const CHART_RANGE = { wheelbase: [970, 1013], headAngle: [70.5, 74], wheelDiameter: [674 * 0.995, 674 * 1.005], ratio: [970 / 674, 1013 / 674] };
export const BUILD = {
  rimDepth: 45, rimFlange: 6, crank: 170, stemLength: 100, stemAngle: -6, stackAboveHT: 35, saddleHeight: 725,
  cassette: [11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 30], chainCog: 4, pitch: 12.7, frontOLD: 100, rearOLD: 142, crankDeg: -35,
};
/** The build constants for one frame size: everything not on the chart stays as on the 56; the saddle follows sizes.js. */
export const buildFor = (chart, inseamCm = null) => ({ ...BUILD, saddleHeight: saddleHeight(chart, inseamCm) });
// 12-speed chain and sprocket teeth (m): a 3.8 mm roller rests in a 4.0 mm seat; 1.6 mm teeth run between inner plates 2.2 mm apart
const CHAIN = { roller: 0.0038, seat: 0.004, tip: 0.003, tipW: 0.0016, teeth: 0.0016, inner: 0.0015, outer: 0.0023, plate: 0.0008, rollerLen: 0.0022 };
// dropout plates (m): inner face 0.2 mm outside the hub's end face, 7 mm thick, a 6.3 mm half-width slot for the 6 mm axle
const DROPOUT = { gap: 0.0002, thick: 0.007, bevel: 0.001, slot: 0.0063 };
const rad = d => d * Math.PI / 180, TAU = Math.PI * 2, MM = 0.001;

export function deriveJoints(c = CHART, b = BUILD) {
  const d = [Math.cos(rad(c.headAngle)), -Math.sin(rad(c.headAngle))];
  const n = [Math.sin(rad(c.headAngle)), Math.cos(rad(c.headAngle))];
  const s = [-Math.cos(rad(c.seatAngle)), Math.sin(rad(c.seatAngle))];
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const HTT = [c.reach, c.stack], HTB = add(HTT, d, c.headTube), STT = add([0, 0], s, c.seatTube), STEM = add(HTT, d, -b.stackAboveHT);
  const a = rad(90 - c.headAngle + b.stemAngle);
  const j = {
    BB: [0, 0], RA: [-Math.sqrt(c.chainstay ** 2 - c.bbDrop ** 2), c.bbDrop],
    FA: add(add(HTT, d, c.headTube + c.axleToCrown), n, c.forkOffset),
    HTT, HTB, STT, DTH: add(HTB, d, -50), SSJ: add(STT, s, -30), CROWN: HTB,
    STEM, BAR: add(STEM, [Math.cos(a), Math.sin(a)], b.stemLength),
    SADDLE: add([0, 0], s, b.saddleHeight), POST_TOP: add([0, 0], s, b.saddleHeight - 40),
  };
  for (const k in j) j[k] = j[k].map(x => Math.round(x * 100) / 100);
  return { j, d, n, s, chart: c, build: b };
}

/** Pure check of measured numbers against the chart. Returns the violations (empty = pass). */
export function validateGeometry(m, c = CHART, R = CHART_RANGE) {
  // Every size is held to its own published numbers (1 mm, 0.05 deg); the family ranges get the same 1 mm, so a size
  // on the range's edge (the 44's 970 mm wheelbase derives to 969.98) is not rejected for rounding.
  const v = [], within = (x, [lo, hi], label) => { if (!(x >= lo && x <= hi)) v.push(`${label} ${x.toFixed(2)} outside chart range ${lo.toFixed(2)}..${hi.toFixed(2)}`); };
  within(m.wheelbase, [R.wheelbase[0] - 1, R.wheelbase[1] + 1], 'wheelbase (mm)');
  within(m.wheelDiameter, R.wheelDiameter, 'wheel diameter (mm)');
  within(m.wheelbase / m.wheelDiameter, [(R.wheelbase[0] - 1) / 674, (R.wheelbase[1] + 1) / 674], 'wheelbase / wheel diameter');
  within(m.headAngle, R.headAngle, 'head angle (deg)');
  if (Math.abs(m.wheelbase - c.wheelbase) > 1) v.push(`wheelbase ${m.wheelbase.toFixed(2)} differs from chart ${c.wheelbase} by > 1 mm`);
  if (Math.abs(m.headAngle - c.headAngle) > 0.05) v.push(`head angle ${m.headAngle.toFixed(3)} differs from chart ${c.headAngle} by > 0.05 deg`);
  if (Math.abs(m.frontCenter - c.frontCenter) > 1) v.push(`front centre ${m.frontCenter.toFixed(2)} differs from chart ${c.frontCenter} by > 1 mm`);
  if (Math.abs(m.trail - c.trail) > 1) v.push(`trail ${m.trail.toFixed(2)} differs from chart ${c.trail} by > 1 mm`);
  return v;
}


/* =====================================================================================
   3. MATERIALS: one shared instance per surface, plus one shared fade twin of each.
   ===================================================================================== */
function canvasTexture(w, h, draw, { repeat = [1, 1], color = false } = {}) {   // small procedural textures (no image files)
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
async function makeTextures() {                   // one texture per slice: canvas text drawing is the costly part
  const tread = canvasTexture(512, 32, (x, w, h) => {       // file tread on the tyre shoulders (torus v ~ 0 and 1 = outer face)
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#4a4a4a'; x.lineWidth = 2;
    for (let i = -h; i < w + h; i += 6) for (const [y0, y1] of [[0, 9], [h - 9, h]]) { x.beginPath(); x.moveTo(i, y0); x.lineTo(i + (y1 - y0), y1); x.stroke(); }
  }, { repeat: [24, 1] });
  await slice();
  const tape = canvasTexture(64, 64, (x, w) => {            // bar-tape wrap ridges
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, w);
    x.strokeStyle = '#3c3c3c'; x.lineWidth = 6;
    for (let i = -w; i < 2 * w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + w, w); x.stroke(); }
  }, { repeat: [0.5, 0.5] });
  // A line of text that fills its strip: the measured cap height is `cap` of the texture's height, the line is
  // centred on it, and it is narrowed only if it would overrun 94% of the width. The texture has the strip's own
  // aspect, so the letters are not stretched when it is mapped on.
  const word = (text, aspect, cap, track, fill) => {
    const w = 2048, h = Math.round(w / aspect);
    const t = canvasTexture(w, h, (x) => {
      x.clearRect(0, 0, w, h); x.fillStyle = fill; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      const set = size => { x.font = `800 ${size}px "Archivo Expanded", sans-serif`; x.letterSpacing = `${(size * track).toFixed(1)}px`; };
      set(100); let size = 100 * h * cap / x.measureText('H').actualBoundingBoxAscent;
      set(size); const wide = x.measureText(text).width; if (wide > w * 0.94) set(size *= w * 0.94 / wide);
      x.fillText(text, w / 2, h / 2 + x.measureText('H').actualBoundingBoxAscent / 2);
    }, { color: true });
    t.anisotropy = 8;                               // the rims are often seen at a slant
    return t;
  };
  // decals in the page's own face (Archivo, expanded): black on the yellow frame, yellow on the black rims
  const [r0, r1] = rimStrip(), rimAspect = ((r0 + r1) / 2 * 2 * DECAL.rimArc) / (r1 - r0);
  await slice(); const decal = word('VARSEN', DECAL.tube[0] / DECAL.tube[1], 0.62, 0.16, LOOK.decalInk);
  await slice(); const rimDecal = word('VARSEN · CARBON 45', rimAspect, 0.6, 0.08, LOOK.rimInk);
  await slice();
  return { tread, tape, decal, rimDecal };
}
/** Decal sizes, shared by the textures and the geometry: the down-tube wordmark (length, height in metres), the rim
    strip's half-arc (radians) and its inset from the spoke bed and the hook (metres). */
const DECAL = { tube: [0.3, 0.034], rimArc: 0.62, rimInset: [0.012, 0.008] };
function rimStrip() {
  const flange = CHART.bsd / 2 * MM + BUILD.rimFlange * MM, bed = flange - BUILD.rimDepth * MM;
  return [bed + DECAL.rimInset[0], flange - DECAL.rimInset[1]];
}
/** The model's finish. Gloss yellow paint over black carbon; decals black on paint, yellow on the rims. */
export const LOOK = { paint: 0xffbe00, decalInk: '#121212', rimInk: '#ffc21a' };
export async function makeMaterials() {
  const T = await makeTextures();
  // blended, not alpha-tested: a hard 0.5 cut gave stair-stepped letters and broke thin strokes once the texture
  // was minified; blending keeps the mip-filtered edge. Drawn after the paint, so they never write depth.
  const decal = map => new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.02, depthWrite: false, roughness: 0.45, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: LOOK.paint, roughness: 0.26, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.34, metalness: 0.15 }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0x232528, roughness: 0.28, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    alloy: new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.3, metalness: 1 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.2, metalness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.45, metalness: 0.7 }),
    // Satin metals for the chain and the rotors: a mirror metal in a dark studio reflects black at most angles and the
    // part goes dark as the bike turns. Part diffuse, part metal: the key light reads on them from every side.
    chainOuter: new THREE.MeshStandardMaterial({ color: 0xccd0d5, roughness: 0.38, metalness: 0.3 }),
    chainInner: new THREE.MeshStandardMaterial({ color: 0xa6abb1, roughness: 0.42, metalness: 0.3 }),
    chainRoller: new THREE.MeshStandardMaterial({ color: 0x7c8086, roughness: 0.45, metalness: 0.3 }),
    rotor: new THREE.MeshStandardMaterial({ color: 0xd2d6da, roughness: 0.32, metalness: 0.35 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.88, metalness: 0, bumpMap: T.tread, bumpScale: 1.2 }),
    tape: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.82, metalness: 0, bumpMap: T.tape, bumpScale: 1.5 }),
    hood: new THREE.MeshStandardMaterial({ color: 0x19191a, roughness: 0.72, metalness: 0 }),
    saddle: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.6, metalness: 0 }),
    decal: decal(T.decal), rimDecal: decal(T.rimDecal),
  };
  // Fade twins use alpha hashing (a stochastic dissolve in the opaque pass), not blending: blended low-opacity
  // geometry rendered with 1-level run-to-run differences on GPU (qa/probe/gl-determinism.mjs); hashing is per-pixel deterministic.
  return { M, FADE: fadeSet(M) };
}
/** One fade twin per material. A second set lets two bikes dissolve at once with different opacities (a size crossfade). */
export const fadeSet = M => new Map(Object.values(M).map(m => { const c = m.clone(); c.alphaHash = true; c.transparent = false; return [m, c]; }));

/* =====================================================================================
   4. PARTS: procedural builders; each part is a Group whose origin is its mounting joint.
   Shapes: profile sweeps (superellipse cross-sections along a path, rotation-minimising frames, analytic normals),
   lathe and extruded outlines, rounded boxes. All dimensions come from the joints (GEOMETRY.md) or BUILD.
   ===================================================================================== */
const V = (x, y, z = 0) => new THREE.Vector3(x * MM, y * MM, z * MM);
const UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const mesh = (g, m, name = '') => { const o = new THREE.Mesh(g, m); o.name = name; return o; };
const lerp = (a, b, t) => a + (b - a) * t, sm = t => t * t * (3 - 2 * t);
let UNIT_SPHERE = null;                            // created per build: never share GPU resources across renderers (context restore rebuilds)

/** Rotation-minimising frames along a polyline (double reflection, Wang et al. 2008). */
function rmFrames(pts, up0) {
  const n = pts.length, T = [], U = [];
  for (let i = 0; i < n; i++) T.push(new THREE.Vector3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize());
  U[0] = up0.clone().addScaledVector(T[0], -up0.dot(T[0])).normalize();
  for (let i = 0; i < n - 1; i++) {
    const v1 = new THREE.Vector3().subVectors(pts[i + 1], pts[i]), c1 = v1.dot(v1);
    if (c1 < 1e-14) { U[i + 1] = U[i].clone(); continue; }
    const rL = U[i].clone().addScaledVector(v1, -2 / c1 * v1.dot(U[i])), tL = T[i].clone().addScaledVector(v1, -2 / c1 * v1.dot(T[i]));
    const v2 = new THREE.Vector3().subVectors(T[i + 1], tL), c2 = v2.dot(v2);
    U[i + 1] = (c2 < 1e-14 ? rL : rL.addScaledVector(v2, -2 / c2 * v2.dot(rL))).addScaledVector(T[i + 1], 0);
    U[i + 1].addScaledVector(T[i + 1], -U[i + 1].dot(T[i + 1])).normalize();
  }
  return { T, U };
}
/** Sweep a superellipse section along pts. prof(t) -> [w, h]: half-size along S (= U x T) and along U. UV in cm. */
function sweepGeometry(pts, prof, { up = Z, radial = 24, n = 2.5, caps = true } = {}) {
  const N = pts.length, { T, U } = rmFrames(pts, up), pos = [], nor = [], uv = [], idx = [], S = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
  const ring = [];
  let len = 0;
  for (let i = 0; i < N; i++) {
    if (i) len += pts[i].distanceTo(pts[i - 1]);
    S.crossVectors(U[i], T[i]);
    const [w, h] = prof(i / (N - 1)), r = [];
    let per = 0;
    for (let k = 0; k <= radial; k++) {
      const a = (k % radial) / radial * TAU, c = Math.cos(a), s = Math.sin(a);
      const x = Math.sign(c) * Math.abs(c) ** (2 / n) * w, y = Math.sign(s) * Math.abs(s) ** (2 / n) * h;
      const nx = Math.sign(c) * Math.abs(c) ** (2 - 2 / n) / w, ny = Math.sign(s) * Math.abs(s) ** (2 - 2 / n) / h;
      p.copy(pts[i]).addScaledVector(S, x).addScaledVector(U[i], y);
      if (k) per += p.distanceTo(q); q.copy(p);
      const nn = new THREE.Vector3().addScaledVector(S, nx).addScaledVector(U[i], ny).normalize();
      pos.push(p.x, p.y, p.z); nor.push(nn.x, nn.y, nn.z); uv.push(len * 100, per * 100); r.push(p.clone());
    }
    ring.push(r);
  }
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * (radial + 1) + k, b = a + radial + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  if (caps) for (const [i, sgn] of [[0, -1], [N - 1, 1]]) {
    const c = pos.length / 3; pos.push(pts[i].x, pts[i].y, pts[i].z); nor.push(T[i].x * sgn, T[i].y * sgn, T[i].z * sgn); uv.push(0, 0);
    for (let k = 0; k < radial; k++) { const v = ring[i][k]; pos.push(v.x, v.y, v.z); nor.push(T[i].x * sgn, T[i].y * sgn, T[i].z * sgn); uv.push(0, 0); }
    for (let k = 0; k < radial; k++) { const a = c + 1 + k, b = c + 1 + ((k + 1) % radial); sgn > 0 ? idx.push(c, a, b) : idx.push(c, b, a); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
/** Straight profiled tube a -> b built along local +y (local z = lateral), oriented like a cylinder: getWorldQuaternion gives the axis. */
function profTube(a, b, prof, mat, name = '', o = {}) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length(), segs = o.segs ?? 10;
  const pts = Array.from({ length: segs + 1 }, (_, i) => new THREE.Vector3(0, len * i / segs, 0));
  const m = mesh(sweepGeometry(pts, prof, { up: Z, ...o }), mat, name);
  m.position.copy(a); m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
const sweep = (points, prof, mat, name = '', o = {}) => mesh(sweepGeometry(points, prof, o), mat, name);
const curvePts = (pts, n) => new THREE.CatmullRomCurve3(pts, false, 'centripetal').getPoints(n);
function blob(p, [rx, ry, rz], mat, rotZ = 0, name = '') { const o = mesh(UNIT_SPHERE, mat, name); o.position.copy(p); o.scale.set(rx, ry, rz); o.rotation.z = rotZ; return o; }
function axleCyl(r, len, mat, name = '', seg = 24) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return mesh(g, mat, name); }
function rboxGeometry(w, h, d, r) {                // rounded box: rounded-rect outline, bevelled extrusion (outer size w x h x d)
  const bev = Math.min(r, d / 2) * 0.7, W = w - 2 * bev * 0.9, H = h - 2 * bev * 0.9, rr = Math.max(0.0002, Math.min(r, W / 2, H / 2) - bev * 0.9);
  const s = new THREE.Shape(), x0 = -W / 2, y0 = -H / 2;
  s.moveTo(x0 + rr, y0); s.lineTo(x0 + W - rr, y0); s.absarc(x0 + W - rr, y0 + rr, rr, -Math.PI / 2, 0); s.lineTo(x0 + W, y0 + H - rr);
  s.absarc(x0 + W - rr, y0 + H - rr, rr, 0, Math.PI / 2); s.lineTo(x0 + rr, y0 + H); s.absarc(x0 + rr, y0 + H - rr, rr, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + rr); s.absarc(x0 + rr, y0 + rr, rr, Math.PI, 1.5 * Math.PI);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0001, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 3, curveSegments: 5 });
  g.translate(0, 0, -(d - 2 * bev) / 2);
  return g;
}
const rbox = (w, h, d, r, mat, name = '') => mesh(rboxGeometry(w, h, d, r), mat, name);
/** Convex hull of two circles as a Shape (crank arms, plates, cages). */
function hullShape(c1, r1, c2, r2) {
  const dx = c2.x - c1.x, dy = c2.y - c1.y, L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), beta = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / L)));
  const s = new THREE.Shape();
  s.absarc(c1.x, c1.y, r1, ang + beta, ang - beta + TAU, false);
  s.absarc(c2.x, c2.y, r2, ang - beta, ang + beta, false);
  return s;
}
const extrude = (shapes, depth, bevel = 0, curveSegments = 12) => {
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2); return g;
};
/** Sprocket outline: a seating arc (radius CHAIN.seat) centred on every pitch point, so a roller (radius CHAIN.roller)
    resting there touches nothing, and straight flanks up to a flat tip. Gaps at phase + i * 2pi / teeth. */
function gearShape(teeth, pitchR, holeR, phase = 0) {
  const s = new THREE.Shape(), step = TAU / teeth, rs = CHAIN.seat, tipR = pitchR + CHAIN.tip, half = CHAIN.tipW / 2 / tipR;
  for (let i = 0; i < teeth; i++) {
    const a = phase + i * step, px = pitchR * Math.cos(a), py = pitchR * Math.sin(a);
    for (let k = 0; k <= 6; k++) {                   // seat: from the -tangent side, through the inward point, to the +tangent side
      const b = a - Math.PI / 2 - k * Math.PI / 6;
      (i === 0 && k === 0 ? s.moveTo : s.lineTo).call(s, px + rs * Math.cos(b), py + rs * Math.sin(b));
    }
    const c = a + step / 2;
    s.lineTo(tipR * Math.cos(c - half), tipR * Math.sin(c - half)); s.lineTo(tipR * Math.cos(c + half), tipR * Math.sin(c + half));
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, TAU, true); s.holes.push(hole);
  return s;
}
const gearGeometry = (teeth, pitchR, thick, holeR, phase = 0) => extrude(gearShape(teeth, pitchR, holeR, phase), thick, 0, 24);
const pitchRadius = (teeth, pitch = BUILD.pitch) => pitch / (2 * Math.sin(Math.PI / teeth)) * MM;
const annulus = (r0, r1, thick) => { const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, TAU, false); const h = new THREE.Path(); h.absarc(0, 0, r0, 0, TAU, true); s.holes.push(h); return extrude(s, thick, 0, 48); };
/** Dropout plate with a slot for the axle: the hull of a circle at the axle (r1) and one at c2 (r2), with a slot of half
    width `slot` cut from the axle centre out through the edge along +x (mirror: along -x), the way the wheel comes in.
    `bevel` is the extrusion bevel, which grows the walls into the slot, so the cut is that much wider. */
function slottedPlate(c2, r1, r2, slot, mirror, bevel) {
  const h = slot + bevel, m = mirror ? -1 : 1;
  const pts = hullShape(new THREE.Vector2(0, 0), r1, new THREE.Vector2(c2.x * m, c2.y), r2).getPoints(24);
  if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-9) pts.pop();
  const n = pts.length, cross = y => {                // edge (k, k+1) that crosses y going up on the +x side
    for (let k = 0; k < n; k++) { const a = pts[k], b = pts[(k + 1) % n]; if (a.y < y && b.y >= y && a.x + b.x > 0) return k; }
    throw new Error('slottedPlate: the slot misses the outline');
  };
  const at = (k, y) => { const a = pts[k], b = pts[(k + 1) % n], t = (y - a.y) / (b.y - a.y); return new THREE.Vector2(a.x + (b.x - a.x) * t, y); };
  const lo = cross(-h), hi = cross(h), out = [];
  for (let k = (hi + 1) % n; ; k = (k + 1) % n) { out.push(pts[k]); if (k === lo) break; }
  out.push(at(lo, -h), new THREE.Vector2(0, -h));
  for (let k = 1; k < 12; k++) { const b = -Math.PI / 2 - k * Math.PI / 12; out.push(new THREE.Vector2(h * Math.cos(b), h * Math.sin(b))); }
  out.push(new THREE.Vector2(0, h), at(hi, h));
  return new THREE.Shape(out.map(p => new THREE.Vector2(p.x * m, p.y)));
}
/** Polygon with every corner rounded to radius r (crown side profile). */
function roundedShape(poly, r) {
  const s = new THREE.Shape(), n = poly.length;
  poly.forEach((p, i) => {
    const a = poly[(i + n - 1) % n], b = poly[(i + 1) % n], u = a.clone().sub(p).normalize(), v = b.clone().sub(p).normalize();
    const half = Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) / 2, d = r / Math.tan(half), p0 = p.clone().addScaledVector(u, d), p1 = p.clone().addScaledVector(v, d);
    const c = p.clone().addScaledVector(u.clone().add(v).normalize(), r / Math.sin(half));
    const a0 = Math.atan2(p0.y - c.y, p0.x - c.x), a1 = Math.atan2(p1.y - c.y, p1.x - c.x), cw = u.x * v.y - u.y * v.x > 0;
    i === 0 ? s.moveTo(p0.x, p0.y) : s.lineTo(p0.x, p0.y);
    s.absarc(c.x, c.y, r, a0, a1, cw);
  });
  return s;
}
/** Arc strip (rim decals): u runs along the arc, v from inner to outer radius; zAt(r) lays it on the rim's sidewall
    (its sign is the side), so the strip follows the wall instead of standing in front of its inner slope. */
function arcStripGeometry(r0, r1, a0, a1, segs, zAt, mirror, rings = 6) {
  const pos = [], uv = [], idx = [], R1 = rings + 1, front = zAt((r0 + r1) / 2) > 0;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = lerp(a1, a0, t);
    for (let j = 0; j <= rings; j++) { const v = j / rings, r = lerp(r0, r1, v); pos.push(r * Math.cos(a), r * Math.sin(a), zAt(r)); uv.push(mirror ? 1 - t : t, v); }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rings; j++) {
    const v00 = i * R1 + j, v01 = v00 + 1, v10 = v00 + R1, v11 = v10 + 1;
    front ? idx.push(v00, v10, v01, v01, v10, v11) : idx.push(v00, v01, v10, v01, v11, v10);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let G0;
async function buildFrame(J, M) {                 // origin = BB
  const g = new THREE.Group(); g.name = 'frame';
  const P = k => V(...J[k]), along = (k, mm) => V(J[k][0] + G0.d[0] * mm, J[k][1] + G0.d[1] * mm);
  const dtA = P('DTH'), dtB = P('BB'), dtDir = new THREE.Vector3().subVectors(dtA, dtB);
  // aero main triangle: tapered head tube, deep down tube that widens into the BB, truncated seat tube, flattened top tube
  // head tube: from its bottom face at HTB (the fork crown docks under it) to the headset cover 9 mm above HTT
  g.add(profTube(along('HTB', 0), along('HTT', -9), t => [lerp(0.031, 0.027, t) - 0.0025 * Math.sin(Math.PI * t), lerp(0.0255, 0.0215, t)], M.paint, 'headTube', { n: 2.3, segs: 12, radial: 28 }));
  await slice();
  g.add(profTube(P('STT').lerp(P('BB'), 0.04), P('HTT').lerp(P('HTB'), 0.12), t => [lerp(0.0145, 0.0165, t), lerp(0.0165, 0.0155, t)], M.paint, 'topTube', { n: 2.6 }),
    profTube(dtA, dtB, t => [lerp(0.0245, 0.031, t), lerp(0.0195, 0.03, sm(t))], M.paint, 'downTube', { n: 2.8, segs: 14, radial: 28 }));
  await slice();
  g.add(
    profTube(P('BB'), P('STT'), t => [lerp(0.0215, 0.0175, t), lerp(0.024, 0.0145, sm(t))], M.paint, 'seatTube', { n: 2.5, segs: 12 }));
  await slice();
  // smooth junctions: blended lugs at the BB, head tube and seat cluster
  g.add(blob(P('BB').add(new THREE.Vector3(0.004, 0.006, 0)), [0.044, 0.04, 0.036], M.paint, 0, 'lugBB'),
    blob(dtA.clone().addScaledVector(dtDir.clone().normalize(), -0.012), [0.033, 0.03, 0.026], M.paint, Math.atan2(dtDir.y, dtDir.x), 'lugDownTube'),
    blob(along('HTT', 15), [0.025, 0.022, 0.021], M.paint, 0, 'lugTopTube'),   // 15 mm below the head-tube top in every size (10% of the 56's tube)
    blob(P('STT').lerp(P('BB'), 0.03), [0.02, 0.028, 0.0175], M.paint, rad(16), 'lugSeat'),
    blob(P('SSJ'), [0.017, 0.02, 0.0175], M.paint, 0, 'lugSeatStay'));
  const bb = axleCyl(0.0215, 0.074, M.dark, 'bbShell'); g.add(bb);   // ends 1 mm inside the spider and the 36T ring
  // rear dropouts: plates whose inner faces sit 0.2 mm outside the hub's end faces (142 mm), with a slot open to the rear,
  // since the wheel rolls in from behind; both stays end on the plates, outside the hub, the cassette and the rotor
  const zDrop = DROPOUT.gap + BUILD.rearOLD / 2 * MM + DROPOUT.thick / 2;
  for (const side of [1, -1]) {
    const cs = side > 0 ? 1.08 : 1;            // drive-side chainstay is the stiffer one (deeper, not wider)
    // chainstay: where it passes the rim (14.2 mm each side) it is also inside the chainrings (36T inner face at 39.8 mm),
    // so it runs between them, slim sideways, then flares out to the dropout
    const csPath = curvePts([V(0, 0, 22 * side), V(-60, 11, 24.5 * side), V(-105, 19, 26.5 * side), V(-255, 46, 52 * side), V(J.RA[0] + 28, J.RA[1] - 3, zDrop * 1000 * side)], 32);
    g.add(sweep(csPath, t => [lerp(0.0165, 0.0095, t) * cs, lerp(0.0105, 0.0068, t)], M.paint, 'chainstay', { up: Z, n: 3 }),
      profTube(V(J.SSJ[0], J.SSJ[1], 11 * side), V(J.RA[0] + 16, J.RA[1] + 16, zDrop * 1000 * side), t => [lerp(0.0085, 0.0074, t), lerp(0.0066, 0.0056, t)], M.paint, 'seatstay', { n: 2.6 }));
    const drop = mesh(extrude(slottedPlate(new THREE.Vector2(0.022, 0.008), 0.014, 0.012, DROPOUT.slot, true, DROPOUT.bevel), DROPOUT.thick - 2 * DROPOUT.bevel, DROPOUT.bevel), M.dark, 'dropout');
    drop.position.copy(V(J.RA[0], J.RA[1])).setZ(zDrop * side); g.add(drop);
    await slice();
  }
  // rear flat-mount caliper on the non-drive chainstay, outboard of the rotor
  const cal = rbox(0.056, 0.024, 0.022, 0.008, M.dark, 'rearCaliper'); cal.position.copy(V(J.RA[0] + 52, J.RA[1] + 26, -67.5)); cal.rotation.z = rad(-12); g.add(cal);
  // wordmark on both sides of the down tube, where its section is flattest. The tube widens towards the BB, so a flat
  // card would sink into it at that end (it took the V): every vertex is set onto the tube's own superellipse section
  // (the same profile as the tube above: half-depth w, half-width h, exponent 2.8), 0.7 mm proud of it.
  const [DW, DH] = DECAL.tube, dtLen = dtA.distanceTo(dtB), dtU = dtB.clone().sub(dtA).normalize(), dtS = new THREE.Vector3(-dtU.y, dtU.x, 0);
  const tubeZ = (t, s) => { const w = lerp(0.0245, 0.031, t), h = lerp(0.0195, 0.03, sm(t)); return h * Math.max(0, 1 - Math.abs(s / w) ** 2.8) ** (1 / 2.8); };
  const tMid = 0.42, mid = dtA.clone().lerp(dtB, tMid), ang = Math.atan2(dtB.y - dtA.y, dtB.x - dtA.x) + Math.PI;
  for (const side of [1, -1]) {
    const d = mesh(new THREE.PlaneGeometry(DW, DH, 48, 6), M.decal, 'decal');
    d.position.copy(mid);
    d.rotation.set(0, side > 0 ? 0 : Math.PI, side > 0 ? ang : -ang);
    d.updateMatrix();
    const inv = d.matrix.clone().invert(), pos = d.geometry.attributes.position, p = new THREE.Vector3(), rel = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {           // the card stays parallel to the frame plane, so only z changes
      p.fromBufferAttribute(pos, i).applyMatrix4(d.matrix); rel.subVectors(p, dtA).setZ(0);
      p.z = side * (tubeZ(Math.min(1, Math.max(0, rel.dot(dtU) / dtLen)), rel.dot(dtS)) + 0.0007);
      p.applyMatrix4(inv); pos.setXYZ(i, p.x, p.y, p.z);
    }
    d.geometry.computeVertexNormals();
    g.add(d);
  }
  return g;
}
async function buildFork(J, M) {                  // origin = CROWN
  const g = new THREE.Group(); g.name = 'fork';
  const c = J.CROWN, dV = new THREE.Vector3(G0.d[0], G0.d[1], 0), nV = new THREE.Vector3(G0.n[0], G0.n[1], 0), L = (x, y, z = 0) => V(x - c[0], y - c[1], z);
  const steerLen = (G0.chart.headTube + BUILD.stackAboveHT + 18) * MM;
  g.add(mesh(new THREE.CylinderGeometry(0.0143, 0.019, steerLen, 20), M.carbon, 'steerer'));
  g.children[0].position.copy(dV.clone().multiplyScalar(-steerLen / 2)); g.children[0].quaternion.setFromUnitVectors(UP, dV.clone().negate());
  // crown: a side profile (along the steering normal and up the axis) extruded across the fork with rounded edges. Its top
  // sits 0.6 mm under the head tube's bottom face, so the fork docks without entering the frame; its underside clears the tyre.
  const cb = 0.004, crown = mesh(extrude(roundedShape([[-14, -18], [21, -18], [25, -4.6], [-25, -4.6]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), 0.003), 0.12 - 2 * cb, cb, 6), M.paint, 'crown');
  crown.rotation.z = Math.atan2(nV.y, nV.x); g.add(crown);
  const FAl = L(J.FA[0], J.FA[1]), zPlate = DROPOUT.gap + BUILD.frontOLD / 2 * MM + DROPOUT.thick / 2;
  for (const side of [1, -1]) {
    // blade: from inside the crown down to 22 mm above the axle, where the slotted dropout plate takes over (slot open to the
    // front: the wheel rolls in from ahead). The blade ends outboard of the hub's end face.
    const top = nV.clone().multiplyScalar(0.01).add(new THREE.Vector3(0, -0.014, 0.048 * side));
    const up2 = new THREE.Vector3(top.x - FAl.x, top.y - FAl.y, 0).normalize(), bot = FAl.clone().addScaledVector(up2, 0.022).setZ(0.0585 * side);
    const mid = top.clone().lerp(bot, 0.55).addScaledVector(nV, 0.006);          // slight forward bow, as moulded blades have
    g.add(sweep(curvePts([top, mid, bot], 16), t => [lerp(0.019, 0.0105, t), lerp(0.0125, 0.008, t)], M.paint, 'forkLeg', { up: Z, n: 2.4, radial: 22 }));
    const tip = mesh(extrude(slottedPlate(new THREE.Vector2(bot.x - FAl.x, bot.y - FAl.y), 0.013, 0.009, DROPOUT.slot, false, DROPOUT.bevel), DROPOUT.thick - 2 * DROPOUT.bevel, DROPOUT.bevel), M.dark, 'forkDropout');
    tip.position.copy(FAl).setZ(zPlate * side); g.add(tip);
    await slice();
  }
  const cal = rbox(0.056, 0.024, 0.022, 0.008, M.dark, 'frontCaliper'); cal.position.copy(L(J.FA[0] - 22, J.FA[1] + 48, -58)); cal.rotation.z = rad(74); g.add(cal);
  return g;
}
function sharedWheelGeometry() {                  // one blade and one nipple geometry for all four instanced meshes
  return { blade: new THREE.BoxGeometry(0.0022, 1, 0.0009), nipple: new THREE.CylinderGeometry(0.0016, 0.0016, 1, 8) };
}
async function buildWheel(rear, M, shared, CH) {  // origin = axle; wheel plane XY, axle z (yields between sub-assemblies)
  const g = new THREE.Group(); g.name = rear ? 'wheelR' : 'wheelF';
  const spin = new THREE.Group(); spin.name = 'spin'; spin.userData.body = true; g.add(spin);   // body: moves inside its part (QA overlap scan)
  const R = CHART.bsd / 2 * MM;
  spin.add(mesh(new THREE.TorusGeometry((CHART.bsd / 2 + CHART.tyreWidth / 2) * MM, CHART.tyreWidth / 2 * MM, 20, 160), M.rubber, rear ? 'tyreR' : 'tyreF'));
  // deep aero rim: hooked bead seat, U-shaped body, rounded spoke bed
  const flange = R + BUILD.rimFlange * MM, bed = flange - BUILD.rimDepth * MM;
  const prof = [[bed + 0.0005, 0], [bed + 0.002, -0.0055], [bed + 0.008, -0.0105], [bed + 0.02, -0.0135], [flange - 0.012, -0.0142], [flange - 0.002, -0.0141], [flange, -0.0128], [flange, -0.0112], [flange - 0.003, -0.0105], [R - 0.001, -0.0105],
    [R - 0.001, 0.0105], [flange - 0.003, 0.0105], [flange, 0.0112], [flange, 0.0128], [flange - 0.002, 0.0141], [flange - 0.012, 0.0142], [bed + 0.02, 0.0135], [bed + 0.008, 0.0105], [bed + 0.002, 0.0055], [bed + 0.0005, 0]]
    .map(([r, z]) => new THREE.Vector2(r, z));
  const rim = new THREE.LatheGeometry(prof, 120); rim.rotateX(Math.PI / 2); spin.add(mesh(rim, M.rim, 'rim'));
  await slice();
  // the outer sidewall, spoke bed to hook (prof[18] down to prof[14], the +z side): the decal strip lies on it, 0.2 mm proud
  const wall = prof.slice(14, 19).reverse(), wallZ = r => {
    for (let k = 1; k < wall.length; k++) if (r <= wall[k].x) return lerp(wall[k - 1].y, wall[k].y, (r - wall[k - 1].x) / (wall[k].x - wall[k - 1].x));
    return wall[wall.length - 1].y;
  };
  const [s0, s1] = rimStrip();
  for (const side of [1, -1]) for (const a of [Math.PI / 2, -Math.PI / 2])
    spin.add(mesh(arcStripGeometry(s0, s1, a - DECAL.rimArc, a + DECAL.rimArc, 72, r => side * (wallZ(r) + 0.0002), side < 0), M.rimDecal, 'rimDecal'));
  const valve = axleCyl(0.003, 0.034, M.steel, 'valve'); valve.rotation.set(0, 0, 0); valve.geometry.rotateX(-Math.PI / 2); valve.position.set(0, -(bed - 0.012), 0); spin.add(valve);
  // hub: shell with flanges (lathe), end caps
  const old = (rear ? BUILD.rearOLD : BUILD.frontOLD) * MM, fl = rear ? [[0.020, 0.024], [-0.030, 0.024]] : [[0.032, 0.022], [-0.032, 0.022]];
  const hubProf = [[0.006, -old / 2], [0.0125, -old / 2], [0.0125, fl[1][0] - 0.004], [fl[1][1], fl[1][0] - 0.002], [fl[1][1], fl[1][0] + 0.002], [0.0155, fl[1][0] + 0.006],   // end faces at the OLD
    [0.0175, 0], [0.0155, fl[0][0] - 0.006], [fl[0][1], fl[0][0] - 0.002], [fl[0][1], fl[0][0] + 0.002], [0.0125, fl[0][0] + 0.004], [0.0125, old / 2], [0.006, old / 2]].map(([r, z]) => new THREE.Vector2(r, z));
  const hub = new THREE.LatheGeometry(hubProf, 40); hub.rotateX(Math.PI / 2); spin.add(mesh(hub, M.alloy, 'hub'));
  await slice();
  // bladed spokes (one InstancedMesh, 24) and their nipples (another, 24)
  const pairs = [], N = 12, spokeR = bed + 0.002;
  fl.forEach(([z, r], side) => {
    for (let k = 0; k < N; k++) {
      const th = (k / N) * TAU + side * (TAU / (2 * N)), rimTh = rear ? th + (k % 2 ? 1 : -1) * rad(60) : th;   // rear two-cross: 720 x 2 / 24 = 60 deg
      pairs.push([new THREE.Vector3(r * Math.cos(th), r * Math.sin(th), z), new THREE.Vector3(spokeR * Math.cos(rimTh), spokeR * Math.sin(rimTh), side ? -0.002 : 0.002)]);
    }
  });
  const spokes = new THREE.InstancedMesh(shared.blade, M.steel, pairs.length); spokes.name = rear ? 'spokesR' : 'spokesF';
  const nipples = new THREE.InstancedMesh(shared.nipple, M.alloy, pairs.length); nipples.name = rear ? 'nipplesR' : 'nipplesF';
  const m4 = new THREE.Matrix4(), xa = new THREE.Vector3(), ya = new THREE.Vector3(), za = new THREE.Vector3(), mid = new THREE.Vector3();
  pairs.forEach(([a, b], i) => {
    ya.subVectors(b, a); const len = ya.length(); ya.normalize();
    xa.crossVectors(Z, ya).normalize(); za.crossVectors(xa, ya);                    // blade width lies in the wheel plane
    m4.makeBasis(xa, ya, za).scale(new THREE.Vector3(1, len, 1)).setPosition(mid.copy(a).addScaledVector(ya, len / 2)); spokes.setMatrixAt(i, m4);
    m4.makeBasis(xa, ya, za).scale(new THREE.Vector3(1, 0.012, 1)).setPosition(mid.copy(b).addScaledVector(ya, -0.004)); nipples.setMatrixAt(i, m4);
  });
  for (const im of [spokes, nipples]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.computeBoundingBox(); spin.add(im); }
  await slice();
  // disc rotor: slotted braking band + six-arm carrier (non-drive side)
  // polygons, not arcs: 30 slots at 40 curve segments each cost 54-72 ms of triangulation at 4x CPU per wheel
  const rotorR = (rear ? 70 : 80) * MM, rz = rear ? -0.055 : -0.042;
  const ring = (cx, cy, r, n, ccw) => Array.from({ length: n }, (_, i) => { const a = (ccw ? 1 : -1) * i / n * TAU; return new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)); });
  const band = new THREE.Shape(ring(0, 0, rotorR, 72, true));
  band.holes.push(new THREE.Path(ring(0, 0, rotorR - 0.016, 72, false)));
  for (let k = 0; k < 30; k++) { const a = k / 30 * TAU, rr = rotorR - (k % 2 ? 0.0055 : 0.0105); band.holes.push(new THREE.Path(ring(rr * Math.cos(a), rr * Math.sin(a), 0.0019, 10, false))); }
  await slice();
  const rotor = mesh(extrude(band, 0.0018, 0, 40), M.rotor, 'rotor'); rotor.position.z = rz; spin.add(rotor);
  await slice();
  const arms = [], ringS = new THREE.Shape(); ringS.absarc(0, 0, 0.024, 0, TAU, false); const ringH = new THREE.Path(); ringH.absarc(0, 0, 0.0125, 0, TAU, true); ringS.holes.push(ringH); arms.push(ringS);
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.2, r1 = rotorR - 0.0135; arms.push(hullShape(new THREE.Vector2(0.021 * Math.cos(a), 0.021 * Math.sin(a)), 0.006, new THREE.Vector2(r1 * Math.cos(a + 0.18), r1 * Math.sin(a + 0.18)), 0.0045)); }
  const carrier = mesh(extrude(arms, 0.0022, 0, 16), M.dark, 'rotorCarrier'); carrier.position.z = rz - 0.0004; spin.add(carrier);
  // thru-axle, flush with both dropout plates' outer faces, and its lever just outside the non-drive plate
  const plateOut = old / 2 + DROPOUT.gap + DROPOUT.thick;
  const axle = axleCyl(0.006, 2 * plateOut, M.dark, 'thruAxle'); g.add(axle);
  const lever = rbox(0.05, 0.009, 0.006, 0.003, M.dark, 'axleLever'); lever.position.set(rear ? -0.02 : 0.02, 0, -plateOut - 0.0035); lever.rotation.z = rad(rear ? 20 : -20); g.add(lever);   // rear: points back, clear of the stays
  if (rear) {                                      // the cassette sits on the freehub: it arrives with the wheel and turns with it
    const cas = new THREE.Group(); cas.name = 'cassette'; spin.add(cas);
    for (const [i, t] of BUILD.cassette.entries()) {   // the chain's cog has its gaps where the chain's rollers land (solveChain)
      const cog = mesh(gearGeometry(t, pitchRadius(t), CHAIN.teeth, 0.011, i === BUILD.chainCog ? CH.phase.cog : 0), M.steel, 'cog');
      cog.position.z = 0.060 - i * 0.0036; cas.add(cog); await slice();
    }
    const freehub = mesh(annulus(0.0061, 0.0125, 0.044), M.dark, 'cassetteCarrier'); freehub.position.z = 0.04; cas.add(freehub);   // bored for the axle
  }
  return g;
}
/** The chain on 52 x 15, link by link (drive-side plane, metres, BB origin). Every pin sits on a sprocket's pitch point or
    on a straight run, exactly one pitch from the next, and the loop closes on a whole, even number of links: the lower
    pulley swings about the upper one (the cage angle) until it does, as a real derailleur cage takes up the slack.
    Returns the pins in loop order and each sprocket's tooth phase (the angle of one gap), so every roller lands in a seat. */
function solveChain(J) {
  const P = BUILD.pitch * MM, V2 = (x, y) => new THREE.Vector2(x, y), ring0 = 0;
  const RA = V2(J.RA[0] * MM, J.RA[1] * MM), U = RA.clone().add(V2(0.012, -0.066)), cage = 0.071, psi0 = rad(-101);
  const layout = psi => [[V2(0, 0), 52, 1], [RA, BUILD.cassette[BUILD.chainCog], 1], [U, 11, -1], [U.clone().add(V2(Math.cos(psi), Math.sin(psi)).multiplyScalar(cage)), 11, 1]]
    .map(([c, N, dir]) => ({ c, N, dir, r: pitchRadius(N), step: TAU / N }));   // travel order; dir: +1 wrapped counter-clockwise (drive-side view)
  const tang = (A, B) => {                          // the straight run from A to B: its end points on the two pitch circles
    const D = B.c.clone().sub(A.c), L = D.length(), beta = Math.asin((A.r * A.dir - B.r * B.dir) / L);
    const u = D.normalize().rotateAround(V2(0, 0), beta), n = V2(u.y, -u.x);
    return [A.c.clone().addScaledVector(n, A.r * A.dir), B.c.clone().addScaledVector(n, B.r * B.dir)];
  };
  const ang = (s, p) => Math.atan2(p.y - s.c.y, p.x - s.c.x), wrap = (x, m) => ((x % m) + m) % m, signed = x => wrap(x + Math.PI, TAU) - Math.PI;
  function walk(psi) {                              // pins from the ring's front, all the way round; err: where it lands back on the ring
    const S = layout(psi), n = S.length;
    S.forEach((s, i) => { const [a, b] = tang(s, S[(i + 1) % n]); s.out = a; S[(i + 1) % n].in = b; });
    S.forEach(s => { s.aIn = ang(s, s.in); s.span = wrap(s.dir * (ang(s, s.out) - s.aIn), TAU); });
    const along = (s, a) => wrap(s.dir * (a - s.aIn), TAU), phase = [ring0, 0, 0, 0];
    let i = 0, onArc = true, p = V2(S[0].r * Math.cos(ring0), S[0].r * Math.sin(ring0));
    const pins = [p];
    for (let guard = 0; guard < 400; guard++) {
      const s = S[i], t = S[(i + 1) % n], d = t.in.clone().sub(s.out), len = d.length(); d.normalize();
      if (onArc) {
        const a = ang(s, p) + s.dir * s.step;
        if (along(s, a) <= s.span) { p = V2(s.c.x + s.r * Math.cos(a), s.c.y + s.r * Math.sin(a)); pins.push(p); continue; }
        const w = s.out.clone().sub(p), b = w.dot(d), lam = -b + Math.sqrt(b * b - (w.lengthSq() - P * P));
        if (lam > len) throw new Error('solveChain: a straight run shorter than a link');
        p = s.out.clone().addScaledVector(d, lam); pins.push(p); onArc = false; continue;
      }
      const q = p.clone().addScaledVector(d, P);
      if (q.clone().sub(s.out).dot(d) <= len) { p = q; pins.push(p); continue; }
      // onto the next sprocket: the point of its pitch circle one pitch from p, just past where the run meets it
      const D = t.c.clone().sub(p), L = D.length(), x = (L * L + P * P - t.r * t.r) / (2 * L), y = Math.sqrt(Math.max(0, P * P - x * x));
      const m = p.clone().addScaledVector(D, x / L), perp = V2(-D.y / L, D.x / L);
      const next = [m.clone().addScaledVector(perp, y), m.clone().addScaledVector(perp, -y)].map(c => [c, signed(t.dir * (ang(t, c) - t.aIn))])
        .filter(([, a]) => a > -1e-9).sort((u, v) => u[1] - v[1])[0][0];
      i = (i + 1) % n; onArc = true;
      if (i === 0) return { err: signed((ang(t, next) - ring0) * t.N) / t.N, pins, back: next, S, phase };
      p = next; pins.push(p); phase[i] = ang(t, p);
    }
    throw new Error('solveChain: the loop does not close');
  }
  // search outward from the nominal cage angle, both ways in 0.25 deg steps; refine each sign change of the closure error
  // (Illinois regula falsi, ~10 walks) and keep the first one with an even number of links
  const root = (a, fa, b, fb) => {
    for (let k = 0; k < 60 && Math.abs(fb) > 1e-15 && Math.abs(b - a) > 1e-15; k++) {
      const c = b - fb * (b - a) / (fb - fa), fc = walk(c).err;
      if (fc * fb < 0) { a = b; fa = fb; } else fa /= 2;
      b = c; fb = fc;
    }
    const r = walk(b), ringS = r.S[0], rest = Math.round(wrap(ring0 - ang(ringS, r.back), TAU) / ringS.step);
    return { psi: b, r, rest, links: r.pins.length + rest };
  };
  const last = { 1: [psi0, walk(psi0).err], [-1]: null }; last[-1] = last[1];
  let best = null;
  for (let k = 1; k <= 80 && !best; k++) for (const side of [1, -1]) {
    const psi = psi0 + side * rad(0.25 * k), err = walk(psi).err, [p0, e0] = last[side];
    if (Math.sign(e0) !== Math.sign(err) && Math.abs(e0 - err) < Math.PI / 52) {     // a real crossing, not the error's wrap
      const c = root(p0, e0, psi, err);
      if (c.links % 2 === 0 && (!best || Math.abs(c.psi - psi0) < Math.abs(best.psi - psi0))) best = c;
    }
    last[side] = [psi, err];
  }
  if (!best) throw new Error('solveChain: no even closure');
  const { r } = best, ringS = r.S[0], pins = [...r.pins];
  for (let k = best.rest; k >= 1; k--) { const a = ring0 - k * ringS.step; pins.push(V2(ringS.r * Math.cos(a), ringS.r * Math.sin(a))); }
  const gap = Math.max(...pins.map((p, k) => Math.abs(p.distanceTo(pins[(k + 1) % pins.length]) - P)));
  if (gap > 1e-6) throw new Error(`solveChain: a link is off pitch by ${(gap * 1000).toFixed(4)} mm`);
  return { pins, links: pins.length, U: r.S[2].c, Lw: r.S[3].c, phase: { ring: ring0, cog: r.phase[1], U: r.phase[2], Lw: r.phase[3] }, cage: best.psi };
}
async function buildDrivetrain(J, M, CH) {        // origin = BB (yields between sub-assemblies); CH = solveChain(J)
  const g = new THREE.Group(); g.name = 'drivetrain';
  const crank = new THREE.Group(); crank.name = 'crankset'; crank.userData.body = true; g.add(crank);
  const nds = new THREE.Group(); nds.name = 'crankNDS'; nds.userData.body = true; crank.add(nds);   // non-drive arm: fitted from its own side
  crank.add(axleCyl(0.0121, 0.15, M.alloy, 'spindle'));
  const r52 = pitchRadius(52), r36 = pitchRadius(36), zc = 0.060 - BUILD.chainCog * 0.0036;   // chainline: the 15T cog's plane
  // rings: a thin toothed plate (the chain's inner plates run either side of it) on a thicker body, inside the chain's reach
  for (const [nm, N, r, hole, z, mat, ph] of [['ring52', 52, r52, 0.017, zc, M.dark, CH.phase.ring], ['ring36', 36, r36, 0.013, zc - 0.005, M.alloy, 0]]) {
    const teeth = mesh(gearGeometry(N, r, CHAIN.teeth, r - hole, ph), mat, nm); teeth.position.z = z;
    const body = mesh(annulus(r - hole, r - 0.0065, 0.0032), mat, nm); body.position.z = z + 0.0008;
    crank.add(teeth, body);
  }
  await slice();
  const t0 = rad(BUILD.crankDeg), L = BUILD.crank * MM, spider = [];
  for (let k = 0; k < 4; k++) {                   // four-arm spider with bolt bosses
    const a = t0 + k * TAU / 4 + TAU / 8, e = new THREE.Vector2(Math.cos(a) * (r52 - 0.022), Math.sin(a) * (r52 - 0.022));
    spider.push(hullShape(new THREE.Vector2(0, 0), 0.02, e, 0.0075));
  }
  const sp = mesh(extrude(spider, 0.006, 0.001), M.carbon, 'spider'); sp.position.z = 0.043; crank.add(sp);
  for (let k = 0; k < 4; k++) { const a = t0 + k * TAU / 4 + TAU / 8, bolt = axleCyl(0.004, 0.011, M.alloy, 'ringBolt', 12); bolt.position.set(Math.cos(a) * (r52 - 0.022), Math.sin(a) * (r52 - 0.022), 0.0435); crank.add(bolt); }
  for (const side of [1, -1]) {                   // forged-look arms: hull of the spindle eye and the pedal eye, bevelled
    const host = side > 0 ? crank : nds;
    const t = t0 + (side > 0 ? 0 : Math.PI), arm = mesh(extrude(hullShape(new THREE.Vector2(0, 0), 0.0215, new THREE.Vector2(L, 0), 0.0115), 0.012, 0.0028), M.carbon, 'crankArm');
    arm.position.z = 0.072 * side; arm.rotation.z = t; host.add(arm);
    const pe = new THREE.Vector3(Math.cos(t) * L, Math.sin(t) * L, 0);
    const spindle = axleCyl(0.0055, 0.06, M.steel, 'pedalSpindle', 12); spindle.position.copy(pe).setZ(0.1 * side); host.add(spindle);
    const body = mesh(extrude(hullShape(new THREE.Vector2(-0.03, 0), 0.02, new THREE.Vector2(0.034, 0), 0.026), 0.013, 0.002, 16), M.dark, 'pedal');
    body.geometry.rotateX(Math.PI / 2); body.position.copy(pe).setZ(0.122 * side); host.add(body);
  }
  await slice();
  // chain on 52 x 15 (solveChain): a roller in a seat of every sprocket it wraps; outer and inner plate pairs alternate.
  // Its own group: it fades in last, once the cranks have stopped (STORYBOARD 2, S4).
  const chain = new THREE.Group(); chain.name = 'chain'; chain.userData.body = true; g.add(chain);
  const pins = CH.pins, pitch = BUILD.pitch * MM, RA = V(...J.RA), jr = pitchRadius(11);
  const outerG = extrude(hullShape(new THREE.Vector2(-pitch / 2, 0), 0.0043, new THREE.Vector2(pitch / 2, 0), 0.0043), CHAIN.plate, 0, 10);
  const innerG = extrude(hullShape(new THREE.Vector2(-pitch / 2, 0), 0.0039, new THREE.Vector2(pitch / 2, 0), 0.0039), CHAIN.plate, 0, 10);
  const rollerG = new THREE.CylinderGeometry(CHAIN.roller, CHAIN.roller, CHAIN.rollerLen, 12); rollerG.rotateX(Math.PI / 2);
  const plates = [['chainOuter', outerG, M.chainOuter, CHAIN.outer, 0], ['chainInner', innerG, M.chainInner, CHAIN.inner, 1]];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  for (const [name, geo, mat, off, parity] of plates) {
    const links = pins.map((p, i) => [p, pins[(i + 1) % pins.length], i]).filter(([, , i]) => i % 2 === parity);
    const im = new THREE.InstancedMesh(geo, mat, links.length * 2); im.name = name;
    links.forEach(([a, b], k) => {
      q.setFromAxisAngle(Z, Math.atan2(b.y - a.y, b.x - a.x));
      for (const s of [1, -1]) im.setMatrixAt(2 * k + (s > 0 ? 0 : 1), m4.compose(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, zc + off * s), q, one));
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.computeBoundingBox(); chain.add(im);
  }
  const rollers = new THREE.InstancedMesh(rollerG, M.chainRoller, pins.length); rollers.name = 'chainRoller';
  pins.forEach((p, i) => rollers.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.y, zc), q.identity(), one)));
  rollers.instanceMatrix.needsUpdate = true; rollers.computeBoundingSphere(); rollers.computeBoundingBox(); chain.add(rollers);
  await slice();
  // rear derailleur: hanger, knuckle, parallelogram, cage plates, pulleys (positions from solveChain: the cage takes up the slack)
  const U = CH.U, Lw = CH.Lw, rearOut = BUILD.rearOLD / 2 * MM + DROPOUT.gap + DROPOUT.thick;
  for (const [c, nm, ph] of [[U, 'pulleyU', CH.phase.U], [Lw, 'pulleyL', CH.phase.Lw]]) {
    const p = mesh(gearGeometry(11, jr, CHAIN.teeth, 0.004, ph), M.dark, nm); p.position.set(c.x, c.y, zc); g.add(p);
    const hub = mesh(annulus(0.004, jr - 0.0065, 0.0036), M.dark, nm); hub.position.set(c.x, c.y, zc); g.add(hub);
    const bolt = axleCyl(0.0042, 0.012, M.alloy, 'pulleyBolt', 12); bolt.position.set(c.x, c.y, zc); g.add(bolt);
  }
  for (const side of [1, -1]) {                   // cage plates just outside the chain's outer plates
    const plate = mesh(extrude(hullShape(new THREE.Vector2(U.x, U.y), 0.0165, new THREE.Vector2(Lw.x, Lw.y), 0.019), 0.0016, 0.0004), side > 0 ? M.carbon : M.dark, 'cage');
    plate.position.z = zc + 0.0042 * side; g.add(plate);
  }
  // hanger on the outer face of the drive-side dropout plate; the knuckle hangs below the plate
  const hanger = mesh(extrude(hullShape(new THREE.Vector2(RA.x, RA.y), 0.012, new THREE.Vector2(RA.x + 0.004, RA.y - 0.034), 0.008), 0.005, 0.001), M.dark, 'hanger'); hanger.position.z = rearOut + 0.0004 + 0.0035; g.add(hanger);
  const knuckle = rbox(0.026, 0.034, 0.02, 0.008, M.dark, 'rdKnuckle'); knuckle.position.set(RA.x + 0.006, RA.y - 0.037, rearOut + 0.004); knuckle.rotation.z = rad(18); g.add(knuckle);
  const link = rbox(0.016, 0.048, 0.012, 0.005, M.carbon, 'rdLink'); link.position.set(RA.x + 0.014, RA.y - 0.054, 0.068); link.rotation.z = rad(-28); g.add(link);
  const pivot = rbox(0.022, 0.022, 0.018, 0.007, M.dark, 'rdPivot'); pivot.position.set(U.x + 0.004, U.y + 0.006, zc + 0.012); g.add(pivot);
  // front derailleur: braze-on body and a curved outer cage following the 52T ring
  const arc = new THREE.Shape(), rOut = r52 + 0.016, rIn = r52 + 0.007, a0 = rad(95), a1 = rad(150);
  arc.absarc(0, 0, rOut, a0, a1, false); arc.absarc(0, 0, rIn, a1, a0, true);
  const fdCage = mesh(extrude(arc, 0.0014, 0.0003, 24), M.dark, 'fdCage'); fdCage.position.z = 0.052; g.add(fdCage);
  const fdBody = rbox(0.03, 0.022, 0.024, 0.008, M.dark, 'fdBody'); fdBody.position.copy(V(-46, 142, 40)); fdBody.rotation.z = rad(-18); g.add(fdBody);
  return g;
}
async function buildHandlebar(J, M) {             // origin = STEM; one-piece carbon bar and stem
  const g = new THREE.Group(); g.name = 'handlebar';
  const Bl = V(...J.BAR).sub(V(...J.STEM)), up = new THREE.Vector3(-G0.d[0], -G0.d[1], 0);
  g.add(sweep(curvePts([new THREE.Vector3(), Bl.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.002, 0)), Bl], 14), t => [lerp(0.021, 0.019, t), lerp(0.02, 0.0175, t)], M.carbon, 'stem', { up: UP, n: 3.2 }));
  g.add(sweep([up.clone().multiplyScalar(-0.022), up.clone().multiplyScalar(0.024)], () => [0.0215, 0.0215], M.carbon, 'stemClamp', { up: Z, n: 2.6 }),
    sweep([up.clone().multiplyScalar(0.024), up.clone().multiplyScalar(0.031)], t => [0.019 - 0.003 * t, 0.019 - 0.003 * t], M.dark, 'topCap', { up: Z, n: 2 }));
  // spacer between the head tube's top cover (HTT + 9 mm = STEM - 26 mm) and the stem clamp, 0.2 mm clear of each
  for (const [z0, z1, r] of [[-0.0258, -0.0222, 0.0212]]) g.add(sweep([up.clone().multiplyScalar(z0), up.clone().multiplyScalar(z1)], () => [r, r], M.dark, 'spacer', { up: Z, n: 2 }));
  g.add(blob(Bl, [0.022, 0.0175, 0.04], M.carbon, 0, 'barClamp'));
  for (const side of [1, -1]) {
    const P3 = (x, y, z) => new THREE.Vector3(x, y, z * side).add(Bl);
    const path = curvePts([P3(0, 0, 0), P3(0, 0, 0.06), P3(0.002, 0, 0.13), P3(0.012, -0.001, 0.178), P3(0.042, -0.008, 0.203), P3(0.074, -0.03, 0.21), P3(0.082, -0.07, 0.21), P3(0.064, -0.108, 0.21), P3(0.022, -0.125, 0.21), P3(-0.042, -0.129, 0.21)], 90);
    const k = Math.round(path.length * 0.42), aero = t => [lerp(0.0135, 0.0118, sm(Math.max(0, (t - 0.55) / 0.45))), lerp(0.0062, 0.0118, sm(Math.max(0, (t - 0.55) / 0.45)))];
    g.add(sweep(path.slice(0, k + 1), aero, M.carbon, 'barTops', { up: UP, n: 2.4, caps: false }));
    g.add(sweep(path.slice(k - 2), t => (t > 0.985 ? [0.0102, 0.0102] : [0.0127, 0.0127]), M.tape, 'barTape', { up: UP, n: 2, radial: 20 }));
    // hood: clamps on the forward bend and rises forward to the horn (base on the bar surface, not floating)
    const hood = sweep(curvePts([P3(0.05, -0.014, 0.207), P3(0.072, -0.02, 0.21), P3(0.094, -0.011, 0.21), P3(0.11, 0.0, 0.21)], 18),
      t => [0.0118 + 0.0025 * Math.sin(Math.PI * t), 0.0125 + 0.006 * Math.sin(Math.PI * Math.min(1, t * 1.15))], M.hood, 'hood', { up: UP, n: 2.3, radial: 20 });
    const lever = sweep(curvePts([P3(0.106, -0.012, 0.21), P3(0.108, -0.042, 0.211), P3(0.099, -0.08, 0.212), P3(0.086, -0.104, 0.212)], 16),
      t => [lerp(0.0045, 0.0035, t), lerp(0.0095, 0.0065, t)], M.dark, 'lever', { up: Z, n: 2.4, radial: 14 });
    g.add(hood, lever);
    await slice();
  }
  return g;
}
async function buildSaddle(J, M) {                // origin = STT
  const g = new THREE.Group(); g.name = 'saddle';
  const T0 = V(...J.STT), sV = new THREE.Vector3(G0.s[0], G0.s[1], 0), top = V(...J.POST_TOP).sub(T0);
  g.add(profTube(sV.clone().multiplyScalar(-0.06), top, () => [0.0175, 0.0115], M.carbon, 'seatpost', { n: 2.6 }));
  const clamp = rbox(0.06, 0.016, 0.032, 0.006, M.dark, 'postClamp'); clamp.position.copy(top).add(new THREE.Vector3(0, 0.006, 0)); g.add(clamp);
  for (const dx of [-0.018, 0.018]) { const bolt = axleCyl(0.004, 0.036, M.steel, 'clampBolt', 12); bolt.position.copy(top).add(new THREE.Vector3(dx, 0.006, 0)); g.add(bolt); }
  const C = V(...J.SADDLE).sub(T0).add(new THREE.Vector3(0.012, -0.012, 0)), Lh = 0.13;
  const width = t => t < 0.08 ? 0.0715 * Math.sqrt(1 - ((0.08 - t) / 0.08) ** 2) : t < 0.38 ? 0.0715 : lerp(0.0715, 0.017, sm(Math.min(1, (t - 0.38) / 0.55)));
  const axis = curvePts([-Lh, -0.06, 0, 0.06, Lh].map(x => new THREE.Vector3(x, 0.011 * (x / Lh) ** 2 * 1.1 - 0.004 * (x / Lh), 0).add(C)), 40);
  await slice();
  g.add(sweep(axis, t => [Math.max(0.006, width(t)), lerp(0.0125, 0.0075, t)], M.saddle, 'saddleShell', { up: UP, n: 3.6, radial: 32 }));
  g.add(sweep(axis.map(p => p.clone().add(new THREE.Vector3(0, -0.0105, 0))), t => [Math.max(0.005, width(t) * 0.93), lerp(0.0032, 0.0024, t)], M.carbon, 'saddleBase', { up: UP, n: 4, radial: 28 }));
  for (const side of [1, -1]) {
    const rail = curvePts([[0.098, 0.016, 0.011], [0.06, 0.004, 0.02], [-0.05, 0.004, 0.025], [-0.088, 0.016, 0.034]].map(([x, y, z]) => new THREE.Vector3(x, y, z * side).add(top)), 24);
    g.add(sweep(rail, () => [0.0035, 0.0035], M.steel, 'rail', { up: UP, n: 2, radial: 12 }));
  }
  return g;
}
// Builds run one at a time: every builder reads G0 (the joints of the size being built), so two interleaved async
// builds would swap joints mid-build.
let queueTail = Promise.resolve();
const queued = job => (queueTail = queueTail.then(job, job));
export const MOUNT = { frame: 'BB', fork: 'CROWN', wheelF: 'FA', wheelR: 'RA', drivetrain: 'BB', handlebar: 'STEM', saddle: 'STT' };
const place = (root, parts, J, chart) => {
  for (const [k, part] of Object.entries(parts)) { part.userData.home = V(...J[MOUNT[k]]); part.position.copy(part.userData.home); root.add(part); }
  root.position.set(-(J.FA[0] + J.RA[0]) / 2 * MM, (chart.bsd / 2 + chart.tyreWidth - chart.bbDrop) * MM, 0);   // tyres on y = 0, centred on x = 0
};
/** Drop shared GPU resources (after a lost context: never share them across renderers). */
export const resetShared = () => { UNIT_SPHERE = null; };

/** The full bike at one size (the size 56 for everything but the size chapter). One part per task. */
export function buildBike(M, chart = CHART, inseam = null) {
  return queued(async () => {
    G0 = deriveJoints(chart, buildFor(chart, inseam)); const J = G0.j;
    UNIT_SPHERE ||= new THREE.SphereGeometry(1, 24, 16);
    const root = new THREE.Group(); root.name = `bike-${chart.size}`;
    const c0 = performance.now(), spokeGeo = sharedWheelGeometry(), CH = solveChain(J);   // the chain decides the cog's, the ring's and the pulleys' tooth phases
    const chainMs = +(performance.now() - c0).toFixed(1); await slice();
    const builders = { frame: () => buildFrame(J, M), fork: () => buildFork(J, M), wheelF: () => buildWheel(false, M, spokeGeo, CH), wheelR: () => buildWheel(true, M, spokeGeo, CH), drivetrain: () => buildDrivetrain(J, M, CH), handlebar: () => buildHandlebar(J, M), saddle: () => buildSaddle(J, M) };
    const parts = {};
    for (const [k, build] of Object.entries(builders)) { parts[k] = await build(); await slice(); }
    place(root, parts, J, chart);
    return { root, parts, J, CH, chart, chainMs };
  });
}

/** Another size, sharing what does not change with size. The frame, fork and cockpit are regenerated from that size's
    chart. Wheels and saddle are clones of the base bike's (shared geometry), placed at this size's joints. The
    drivetrain is shared while the bottom-bracket drop matches; sizes 44 to 52 drop 74 mm, not 72, which moves the
    rear axle, so their chain is solved again and the cassette turned to seat it. */
const drivetrainByDrop = new Map();
export function buildSize(M, chart, base) {
  return queued(async () => {
    G0 = deriveJoints(chart, buildFor(chart)); const J = G0.j;
    UNIT_SPHERE ||= new THREE.SphereGeometry(1, 24, 16);
    const root = new THREE.Group(); root.name = `bike-${chart.size}`;
    let CH = base.CH;
    if (chart.bbDrop !== base.chart.bbDrop) CH = solveChain(J);
    if (!drivetrainByDrop.has(base.chart.bbDrop)) drivetrainByDrop.set(base.chart.bbDrop, { dt: base.parts.drivetrain, CH: base.CH });
    let dt = drivetrainByDrop.get(chart.bbDrop);
    if (!dt) { dt = { dt: await buildDrivetrain(J, M, CH), CH }; drivetrainByDrop.set(chart.bbDrop, dt); }
    CH = dt.CH;
    const parts = {};
    parts.frame = await buildFrame(J, M); await slice();
    parts.fork = await buildFork(J, M); await slice();
    parts.wheelF = base.parts.wheelF.clone();
    parts.wheelR = base.parts.wheelR.clone();
    const cas = parts.wheelR.getObjectByName('cassette'); cas.rotation.z = CH.phase.cog - base.CH.phase.cog;   // seat the chain's rollers
    parts.drivetrain = dt.dt.clone();
    parts.handlebar = await buildHandlebar(J, M); await slice();
    parts.saddle = base.parts.saddle.clone();
    place(root, parts, J, chart);
    return { root, parts, J, CH, chart };
  });
}

/* =====================================================================================
   ASSEMBLY ORDER: the original page's stages (STORYBOARD.md section 2 in the repository root), overlap-checked there,
   as pure data. t in [0, 1] is the build chapter's progress; each part has its own window inside it.
   ===================================================================================== */
const W = (a, b) => [(a - 0.14) / 0.70, (b - 0.14) / 0.70];   // the original windows, 0.14..0.84, mapped onto 0..1
export const STAGES = [
  { id: 'frame', w: W(0.14, 0.24), off: [0, 0.06, 0], axis: [0, 1, 0], deg: -32, o0: 1, ease: 'inOutCubic' },
  { id: 'fork', w: W(0.24, 0.35), off: [0.0852, -0.2876, 0], axis: [0, 1, 0], deg: 0, o0: 0, ease: 'outCubic' },
  { id: 'wheelF', w: W(0.35, 0.45), off: [0.30, 0, 0], axis: [0, 1, 0], deg: 0, o0: 0, ease: 'outCubic', roll: true },
  { id: 'wheelR', w: W(0.39, 0.49), off: [-0.30, 0, 0], axis: [0, 1, 0], deg: 0, o0: 0, ease: 'outCubic', roll: true },
  { id: 'drivetrain', w: W(0.49, 0.62), off: [0, 0, 0.26], axis: [0, 1, 0], deg: 0, o0: 0, ease: 'outCubic', crank: 360, crankEnd: 0.8, nds: [0, 0, -0.26], chain: [0.9, 1] },
  { id: 'handlebar', w: W(0.62, 0.73), off: [-0.0625, 0.2109, 0], axis: [-0.28402, 0.95882, 0], deg: 70, o0: 0, ease: 'outCubic' },
  { id: 'saddle', w: W(0.73, 0.84), off: [-0.0682, 0.2301, 0], axis: [0, 1, 0], deg: 0, o0: 0, ease: 'outCubic' },
];
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const EASE = { inCubic: t => t * t * t, outCubic: t => 1 - (1 - t) ** 3, inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2), inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2 };
const smooth01 = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TYRE_R = CHART.tyreOD / 2 * MM;
/** Every part at build progress t (pure). k: 0 = home, 1 = start pose. Same rules as the original story:
    parts fade in over the first 30% of their window, wheels roll without slip, cranks pedal forward and stop at 0.8
    of the drivetrain's window, the non-drive arm comes from its own side, the chain appears last. */
export function assembly(t) {
  const out = {};
  for (const s of STAGES) {
    const u = clamp01((t - s.w[0]) / (s.w[1] - s.w[0])), e = EASE[s.ease](u), k = 1 - e;
    const x = { u, k, opacity: s.o0 === 1 ? 1 : smooth01(0, 0.3, u), spin: 0, crank: 0, nds: 0, chain: 1 };
    if (s.roll) x.spin = -s.off[0] / TYRE_R * k;
    if (s.crank) { x.crank = (s.crank * Math.PI / 180) * (1 - EASE.outCubic(clamp01(u / s.crankEnd))); x.nds = k; x.chain = smooth01(s.chain[0], s.chain[1], u); }
    out[s.id] = x;
  }
  return out;
}
/** Fade windows must not overlap: one shared set of fade twins serves the whole build. Checked at startup. */
export function assertStages() {
  const fades = STAGES.filter(s => s.o0 === 0).flatMap(s => [[s.w[0], s.w[0] + 0.3 * (s.w[1] - s.w[0])], ...(s.chain ? [s.chain.map(f => s.w[0] + f * (s.w[1] - s.w[0]))] : [])]).sort((x, y) => x[0] - y[0]);
  for (let k = 1; k < fades.length; k++) if (fades[k][0] < fades[k - 1][1] - 1e-9) throw new Error('assembly: fade windows overlap');
}

/** Measure the assembled scene (mm) for the startup assertion. */
export function measureBuilt({ root, parts }) {
  root.updateMatrixWorld(true);
  const local = o => root.worldToLocal(o.getWorldPosition(new THREE.Vector3())).multiplyScalar(1000);
  const FA = local(parts.wheelF), RA = local(parts.wheelR), BB = local(parts.frame.getObjectByName('bbShell'));
  const tyre = parts.wheelF.getObjectByName('tyreF'); tyre.geometry.computeBoundingBox();
  const bb = tyre.geometry.boundingBox, wheelDiameter = (bb.max.x - bb.min.x) * 1000;
  const ht = parts.frame.getObjectByName('headTube'), axis = UP.clone().applyQuaternion(ht.getWorldQuaternion(new THREE.Quaternion()));
  const headAngle = Math.atan2(axis.y, -axis.x) * 180 / Math.PI, c = local(ht), tGround = (FA.y - wheelDiameter / 2 - c.y) / axis.y;
  return { wheelbase: FA.x - RA.x, wheelDiameter, headAngle, frontCenter: Math.hypot(FA.x - BB.x, FA.y - BB.y), trail: c.x + axis.x * tGround - FA.x };
}
