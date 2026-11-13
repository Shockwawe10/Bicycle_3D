// Varsen: the page. One fixed, transparent WebGL canvas draws the bike into every plate on screen (a scissor per
// plate), each with its own camera and its own state: assembled, mid-assembly, or at another size. The scrollcraft
// engine runs the cues, reveals and kinetic type; this file runs the plates, the detail tour, the chooser, the folio
// and the booking. Render on demand only.
import * as THREE from '../vendor/three@0.185.1/three.module.min.js';
import { SIZES, BY_SIZE, sizesForHeight } from './sizes.js';
import { makeMaterials, fadeSet, buildBike, buildSize, shadowBlob, measureBuilt, validateGeometry, assembly, assertStages, STAGES, CHART, yieldToMain, slice, EASE } from './bike.js';

const Q = new URLSearchParams(location.search), QA = Q.has('qa');
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const TOUCH = matchMedia('(pointer: coarse)').matches;
const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x), lerp = (a, b, t) => a + (b - a) * t, rad = d => d * Math.PI / 180;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const MM = 0.001;
assertStages();

window.__bike = { ready: false, steps: {}, THREE };
if (window.ScrollCraft) ScrollCraft.mount(document.body);

/* =====================================================================================
   Scroll progress, measured from the DOM (not from the engine), damped for the 3D.
   ===================================================================================== */
const sec = { front: $('#front'), glance: $('#glance'), build: $('#build'), detail: $('#detail'), yours: $('#yours'), book: $('#book') };
// It takes a rect measured at the top of the frame (measure()), so a frame reads layout once, before it writes.
function pinnedP(r) { const span = r.height - innerHeight; return span > 1 ? clamp01(-r.top / span) : (r.top < 0 ? 1 : 0); }
/* Every scroll-driven value follows its target on a critically damped spring (the exact solution, so it is the same at
   any frame rate). A first-order lag jumps to full speed the instant the target moves, which is what a wheel notch
   looked like; the spring starts and stops at zero speed and never overshoots. OMEGA 10: 90% of a step in 0.39 s,
   99% in 0.66 s; at a steady scroll it trails by 0.2 s of travel. */
const OMEGA = 10;
const damped = {}, dampedV = {};
function follow(key, target, dt) {
  const cur = damped[key];
  if (cur === undefined || RM.matches) { dampedV[key] = 0; return (damped[key] = target); }   // first frame, or reduced motion: no easing
  const v0 = dampedV[key] || 0, e0 = cur - target, ex = Math.exp(-OMEGA * dt), k = (v0 + OMEGA * e0) * dt;
  let e = (e0 + k) * ex, v = (v0 - OMEGA * k) * ex;
  if (Math.abs(e) < 1e-4 && Math.abs(v) < 1e-3) e = v = 0;   // settle exactly, so the loop stops
  dampedV[key] = v;
  return (damped[key] = target + e);
}

/* =====================================================================================
   Fading: alpha-hash twins (a deterministic stipple dissolve). Two twin sets, so two bikes can dissolve at once.
   ===================================================================================== */
const BASE_OF = new Map();                     // any material (base or twin) -> its base material
const FADE_INFO = new WeakMap();               // mesh -> { base, fade }
function makeFader(g, FADE, skip = null) {
  const meshes = [], walk = o => { if (o === skip) return; if (o.isMesh) meshes.push(o); o.children.forEach(walk); };
  walk(g);
  for (const m of meshes) { const base = BASE_OF.get(m.material) || m.material; m.material = base; FADE_INFO.set(m, { base, fade: FADE.get(base) }); }
  let lastA = -1;
  return a => {
    if (a === null) { lastA = -1; return; }
    if (a === lastA) return; lastA = a;
    g.visible = a > 0.002;
    const solid = a >= 0.998;
    for (const m of meshes) { const f = FADE_INFO.get(m); m.material = solid ? f.base : f.fade; }
    if (!solid) for (const m of meshes) m.material.opacity = a;
  };
}

/* =====================================================================================
   A bike, ready to pose: its faders, spinning wheels, cranks and the box the camera fits.
   ===================================================================================== */
const STAGE_BY_ID = Object.fromEntries(STAGES.map(s => [s.id, { ...s, offV: new THREE.Vector3(...s.off), q0: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...s.axis).normalize(), rad(s.deg)), ndsV: s.nds ? new THREE.Vector3(...s.nds).sub(new THREE.Vector3(...s.off)) : null }]));
const IDQ = new THREE.Quaternion();
function wrapBike(b, FADE) {
  const chain = b.parts.drivetrain.getObjectByName('chain');
  const faders = Object.fromEntries(Object.entries(b.parts).map(([k, g]) => [k, makeFader(g, FADE, k === 'drivetrain' ? chain : null)]));
  const w = { ...b, faders, chainFader: makeFader(chain, FADE), spins: { wheelF: b.parts.wheelF.getObjectByName('spin'), wheelR: b.parts.wheelR.getObjectByName('spin') },
    crank: b.parts.drivetrain.getObjectByName('crankset'), nds: b.parts.drivetrain.getObjectByName('crankNDS'), posed: null };
  b.root.updateMatrixWorld(true);
  w.box = new THREE.Box3().setFromObject(b.root);
  return w;
}
const ASSEMBLED = assembly(1);
/** Reduced motion: each part fades in where it belongs, in the same order and fade window. Nothing travels, rolls or turns. */
function assemblyInPlace(t) {
  const st = assembly(t);
  for (const ps of Object.values(st)) Object.assign(ps, { k: 0, spin: 0, crank: 0, nds: 0 });
  return st;
}
/** Pose a bike: st = assembly state; alpha multiplies every part's opacity (a whole-bike dissolve). */
function pose(b, st = ASSEMBLED, alpha = 1) {
  const key = st === ASSEMBLED ? `A${alpha}` : null;
  if (key && b.posed === key) return;
  for (const id of Object.keys(b.parts)) {
    const g = b.parts[id], s = STAGE_BY_ID[id], ps = st[id];
    g.position.copy(g.userData.home).addScaledVector(s.offV, ps.k);
    g.quaternion.slerpQuaternions(IDQ, s.q0, ps.k);
    b.faders[id](ps.opacity * alpha);
    if (b.spins[id]) b.spins[id].rotation.z = ps.spin;
  }
  const dt = st.drivetrain;
  b.crank.rotation.z = dt.crank;
  b.nds.position.copy(STAGE_BY_ID.drivetrain.ndsV).multiplyScalar(dt.nds);
  b.chainFader(dt.chain * alpha);
  b.posed = key;
}

/* =====================================================================================
   Cameras: fit a set of points into a plate at an azimuth/elevation (az from the drive-side profile toward the front).
   ===================================================================================== */
const UP = new THREE.Vector3(0, 1, 0), _w = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3();
function axes(az, el) {
  const a = rad(az), e = rad(el);
  _w.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  _r.crossVectors(UP, _w).normalize(); _u.crossVectors(_w, _r);
}
function fitDistance({ fov, corners, target, margin = 0.08 }, aspect) {   // smallest distance that puts every corner inside
  const tanV = Math.tan(rad(fov / 2)), tanH = tanV * aspect, s = 1 - margin;
  let d = 0;
  for (const c of corners) { _v.subVectors(c, target); const z = _v.dot(_w); d = Math.max(d, z + Math.abs(_v.dot(_r)) / (s * tanH), z + Math.abs(_v.dot(_u)) / (s * tanV)); }
  return d;
}
const _tg = new THREE.Vector3();
/** Fit a view into a plate; with `blend`, fit two volumes at the same angle and interpolate distance and target. */
function aim(cam, view, aspect) {
  axes(view.az, view.el);
  let d = fitDistance(view, aspect), target = view.target;
  if (view.from && view.blend < 1) {
    const d0 = fitDistance({ ...view, corners: view.from.corners, target: view.from.target }, aspect);
    d = lerp(d0, d, view.blend); target = _tg.lerpVectors(view.from.target, view.target, view.blend);
  }
  cam.fov = view.fov; cam.aspect = aspect;
  cam.position.copy(target).addScaledVector(_w, d); cam.up.copy(UP); cam.lookAt(target);
  cam.near = Math.max(0.02, d - 4); cam.far = d + 4;
  cam.updateProjectionMatrix();
}
/** The build's framing volumes (the original page's rule, STORYBOARD.md 3a): per stage window, what is visible in it.
    Landed parts count at home; a part moving in this window counts along its visible travel; later parts not at all. */
function buildVolumes(base) {
  const N = 96, samples = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, st = assembly(t); pose(base, st); base.root.updateMatrixWorld(true);
    const boxes = {};
    for (const [id, g] of Object.entries(base.parts)) if (st[id].opacity > 0.01) boxes[id] = new THREE.Box3().setFromObject(g);
    samples.push([t, boxes]);
  }
  pose(base, ASSEMBLED); base.root.updateMatrixWorld(true);
  const home = Object.fromEntries(Object.entries(base.parts).map(([id, g]) => [id, new THREE.Box3().setFromObject(g)]));
  const starts = [...new Set(STAGES.map(s => s.w[0]))].sort((x, y) => x - y);
  return starts.map((a, i) => {
    const next = i + 1 < starts.length ? starts[i + 1] : 1, box = new THREE.Box3(), own = STAGES.find(s => s.w[0] === a);
    for (const s of STAGES) {
      if (s.w[1] <= a) box.union(home[s.id]);
      else if (s.w[0] < next) for (const [t, bx] of samples) if (t >= Math.max(a, s.w[0]) - 1e-9 && t <= Math.min(next, s.w[1]) + 1e-9 && bx[s.id]) box.union(bx[s.id]);
    }
    return { a, dur: 0.15 * (own.w[1] - own.w[0]), corners: boxCorners(box), target: box.getCenter(new THREE.Vector3()) };
  });
}
/* The build's camera. The framing volumes are steps (a new one as each part starts), and stepping between them over a
   few percent of the scroll was the sharpest jolt on the page (measured: tools/check-smoothness.mjs). The camera follows
   a smoothed copy instead: the stepped framing (target, and distance in log space) sampled finely and smoothed with a
   Gaussian of sigma 0.03 of the build, led by one sigma so each part is mostly in frame as it fades in. One path per plate
   aspect (the fit depends on it), cached. */
const BUILD_FOV = 19, buildAz = tt => lerp(30, 16, tt), buildEl = tt => lerp(13, 7, tt);
const buildPaths = new Map();
function buildPath(aspect) {
  const key = aspect.toFixed(2);
  if (buildPaths.has(key)) return buildPaths.get(key);
  const V = gl.buildVols, N = 240, SIG = 0.03, raw = [];
  for (let i = 0; i <= N; i++) {
    const tt = clamp01(i / N + SIG);                   // led by one sigma
    let k = 0; while (k < V.length - 1 && tt >= V[k + 1].a) k++;
    axes(buildAz(tt), buildEl(tt));
    raw.push([V[k].target, Math.log(fitDistance({ fov: BUILD_FOV, corners: V[k].corners, target: V[k].target, margin: 0.06 }, aspect))]);
  }
  const R = Math.ceil(3 * SIG * N), wts = Array.from({ length: 2 * R + 1 }, (_, j) => Math.exp(-0.5 * ((j - R) / (SIG * N)) ** 2));
  const path = raw.map((_, i) => {
    const t = new THREE.Vector3(); let ld = 0, sw = 0;
    for (let j = -R; j <= R; j++) { const s = raw[Math.min(N, Math.max(0, i + j))], wt = wts[j + R]; t.addScaledVector(s[0], wt); ld += s[1] * wt; sw += wt; }
    return [t.multiplyScalar(1 / sw), ld / sw];
  });
  buildPaths.set(key, path);
  return path;
}
const _bt = new THREE.Vector3();
function aimBuild(cam, tt, aspect) {
  const path = buildPath(aspect), N = path.length - 1, x = clamp01(tt) * N, i = Math.min(N - 1, Math.floor(x)), f = x - i;
  _bt.lerpVectors(path[i][0], path[i + 1][0], f);
  const d = Math.exp(lerp(path[i][1], path[i + 1][1], f));
  axes(buildAz(tt), buildEl(tt));
  cam.fov = BUILD_FOV; cam.aspect = aspect;
  cam.position.copy(_bt).addScaledVector(_w, d); cam.up.copy(UP); cam.lookAt(_bt);
  cam.near = Math.max(0.02, d - 4); cam.far = d + 4;
  cam.updateProjectionMatrix();
}
const boxCorners = b => [0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
function ringCorners(b) {                           // yaw-invariant: the bike's turning circle at its bottom and top
  const r = Math.max(...boxCorners(b).map(v => Math.hypot(v.x, v.z))), out = [];
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; for (const y of [b.min.y, b.max.y]) out.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a))); }
  return out;
}

/* =====================================================================================
   The studio: a dark room with softboxes, captured as the environment the clearcoat reflects.
   ===================================================================================== */
function studioScene() {
  const s = new THREE.Scene(), room = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x060607, side: THREE.BackSide }));
  room.scale.set(24, 12, 24); room.position.y = 5; s.add(room);
  const box = (w, h, v, pos, at) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(v), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...at); s.add(m); };
  box(11, 2.2, 9, [0.5, 8, 1.5], [0, 0, 0]);       // overhead strip: the long highlight along the top tube
  box(2.2, 7, 7, [-7, 3.5, 5.5], [0, 1, 0]);       // key strip, front left
  box(1.6, 6, 5, [7, 3.2, -6], [0, 1, 0]);         // rim strip, back right: separates the black tyres from the black ground
  box(9, 1.2, 1.6, [0, 0.5, 9], [0, 1, 0]);        // low fill from the camera side
  return s;
}
async function buildEnvironment(r, scene) {       // PMREM without blocking: pre-compile its filters (three r185 internals)
  const pm = new THREE.PMREMGenerator(r), room = studioScene(), size = TOUCH ? 128 : 256, tm = r.toneMapping;
  r.toneMapping = THREE.NoToneMapping;
  if (typeof pm._allocateTargets === 'function' && typeof pm._setSize === 'function') {
    const cs = r.outputColorSpace, cam = new THREE.PerspectiveCamera();
    pm._setSize(size); const rt = pm._allocateTargets(), filters = new THREE.Scene();
    for (const m of [pm._ggxMaterial, pm._blurMaterial]) if (m) filters.add(new THREE.Mesh(pm._lodMeshes[0].geometry, m));
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    try { await Promise.all([r.compileAsync(room, cam), r.compileAsync(filters, cam)]); } catch { /* compile on use */ }
    r.outputColorSpace = cs; rt.dispose(); filters.clear(); await yieldToMain();
  }
  const env = pm.fromScene(room, 0.03, 0.1, 100, { size });
  r.toneMapping = tm;
  scene.environment = env.texture;
  room.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); pm.dispose();
  return env;
}
function floorPool() {                              // the pool of light the bike stands in (reads as the studio floor)
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.075, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0008; m.renderOrder = -2; m.name = 'floorPool';
  return fadeAtPlateEdges(m);
}
/* The floor quads are wider than a tight plate. Cut by the plate's scissor, the pool would leave a faint rectangle on
   the page ground, so the floor fades out toward the edges of whichever plate is being drawn. */
const PLATE_PX = { value: new THREE.Vector4(0, 0, 1, 1) };   // the plate being drawn, drawing-buffer pixels: x, y, w, h
function fadeAtPlateEdges(mesh) {
  mesh.material.onBeforeCompile = sh => {
    sh.uniforms.uPlate = PLATE_PX;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec4 uPlate;\nvoid main() {').replace('#include <dithering_fragment>', `#include <dithering_fragment>
  vec2 q = (gl_FragCoord.xy - uPlate.xy) / uPlate.zw, ramp = vec2(0.12, 0.08);
  vec2 f = smoothstep(vec2(0.0), ramp, q) * smoothstep(vec2(0.0), ramp, 1.0 - q);
  gl_FragColor.a *= f.x * f.y;`);
  };
  return mesh;
}

/* =====================================================================================
   Adaptive pixel ratio from frame time (EMA + hysteresis), locked under ?qa.
   ===================================================================================== */
let SOFTWARE_GL = false;
const levels = sw => (sw ? [1.0, 0.85] : TOUCH ? [1.5, 1.25, 1.0, 0.85] : [2, 1.5, 1.25, 1.0]).map(x => Math.min(x, devicePixelRatio || 1));
let QUALITY = levels(false);
const quality = { i: 0, ema: 16.7, slow: 0, fast: 0, changedAt: 0, locked: QA };
function sampleFrame(dtMs, now) {
  if (quality.locked || !gl) return;
  quality.ema += (dtMs - quality.ema) * 0.1;
  quality.slow = quality.ema > 20 ? quality.slow + 1 : 0;
  quality.fast = quality.ema < 13 ? quality.fast + 1 : 0;
  if (quality.slow >= 12 && quality.i < QUALITY.length - 1) setQuality(quality.i + 1, now);
  else if (quality.fast >= 240 && quality.i > 0 && now - quality.changedAt > 4000) setQuality(quality.i - 1, now);
}
function setQuality(i, now = performance.now()) {
  quality.i = i; quality.slow = quality.fast = 0; quality.ema = 16.7; quality.changedAt = now;
  if (gl) { gl.renderer.setPixelRatio(QUALITY[i]); sizeCanvas(); kick(); }   // setSize clears the canvas: always redraw
}
const glName = r => { try { const x = r.getContext(), e = x.getExtension('WEBGL_debug_renderer_info'); return e ? String(x.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch { return ''; } };

/* =====================================================================================
   State shared by the plates.
   ===================================================================================== */
let gl = null, canvas = $('#gl');
const plateEls = Object.fromEntries($$('[data-plate]').map(el => [el.dataset.plate, el]));
const spin = { yaw: 0, vel: 0, drag: null };
const light = { t: 1 };                              // the arrival light sweep, 0 -> 1
const yours = { size: 56, from: null, to: null, t: 1, height: null };

/* ---------- plates: what each one shows ---------- */
function frontView(p) {
  const P = EASE.inOutSine(p);
  return { az: lerp(30, 4, P), el: lerp(7, 2.5, P), fov: 15, corners: gl.ring, target: gl.ringTarget, margin: 0.03 };
}

/* ---------- II, in detail: points on the bike; choose one and the camera flies in to that part ----------
   The overview frames the whole size 56 from the front three-quarter (az 40). Each part has its own view: an angle and
   a point on the part with the radius of the region round it (fitted to the plate at any aspect). The camera flies
   between any two views on the shorter way round, distance in log space (an even push-in), on smootherstep. `anchor`
   is where the point sits on the bike (root-local mm, z toward the drive side), projected into the plate each frame.
   Every path, overview to part and part to part, is checked by tools/check-detail-clearance.mjs. */
const OVERVIEW = { az: 40, el: 3, fov: 20, margin: 0.07 };
const PARTS = [
  { id: 'frame', az: 10, el: 3, fov: 24, part: 'frame', at: J => [J.DTH[0] * 0.58 * MM, J.DTH[1] * 0.58 * MM, 0], r: 0.3,
    // the middle of the top tube (on the wordmark the point would cover it): STT 4% toward BB to HTT 12% toward HTB
    anchor: J => [0.5 * (0.96 * J.STT[0] + 0.88 * J.HTT[0] + 0.12 * J.HTB[0]), 0.5 * (0.96 * J.STT[1] + 0.88 * J.HTT[1] + 0.12 * J.HTB[1]), 16] },
  { id: 'drivetrain', az: -14, el: 9, fov: 24, part: 'drivetrain', off: [-0.17, 0.0, 0.04], r: 0.33,
    anchor: () => [0, 0, 45] },                                                     // the crank spider
  { id: 'brakes', az: -136, el: 8, fov: 24, part: 'wheelR', off: [0.0, 0.0, -0.04], r: 0.21,
    anchor: J => [J.RA[0], J.RA[1], 0] },                                           // the rear hub, the rotor behind it
  { id: 'wheels', az: 24, el: 4, fov: 24, part: 'wheelF', off: [0.0, 0.0, 0.0], r: 0.4,
    anchor: J => [J.FA[0] + 296 * Math.cos(rad(40)), J.FA[1] + 296 * Math.sin(rad(40)), 14] },   // the rim decal
  { id: 'cockpit', az: 142, el: 14, fov: 24, part: 'handlebar', off: [0.0, -0.05, 0.0], r: 0.27,
    anchor: J => [(J.STEM[0] + J.BAR[0]) / 2, (J.STEM[1] + J.BAR[1]) / 2, 0] },     // the stem
];
// smootherstep: zero speed and zero acceleration at both ends, acceleration continuous in between
const smoother = u => u * u * u * (u * (u * 6 - 15) + 10);
const detail = { cur: -1, anim: null, focusSpot: null };        // cur -1: the overview
/** A view resolved for a plate aspect: angle, field of view, target and distance. */
function resolveView(i, aspect) {
  if (i < 0) {
    axes(OVERVIEW.az, OVERVIEW.el);
    const target = gl.detailTarget, d = fitDistance({ fov: OVERVIEW.fov, corners: gl.detailCorners, target, margin: OVERVIEW.margin }, aspect);
    return { az: OVERVIEW.az, el: OVERVIEW.el, fov: OVERVIEW.fov, target, d };
  }
  const s = PARTS[i], v = rad(s.fov / 2), h = Math.atan(Math.tan(v) * aspect);
  return { az: s.az, el: s.el, fov: s.fov, target: gl.partTargets[i], d: s.r / Math.sin(Math.min(v, h)) };
}
const shortArc = d => ((d % 360) + 540) % 360 - 180;               // the signed angle the shorter way round
function mixView(a, b, k) {
  return { az: a.az + shortArc(b.az - a.az) * k, el: lerp(a.el, b.el, k), fov: lerp(a.fov, b.fov, k),
    target: new THREE.Vector3().lerpVectors(a.target, b.target, k), d: Math.exp(lerp(Math.log(a.d), Math.log(b.d), k)) };
}
function detailView(aspect, now = performance.now()) {
  const A = detail.anim, to = resolveView(detail.cur, aspect);
  if (!A) return to;
  return mixView(A.from, to, smoother(clamp01(A.dur ? (now - A.t0) / A.dur : 1)));
}
function applyView(cam, v, aspect) {
  axes(v.az, v.el);
  cam.fov = v.fov; cam.aspect = aspect;
  cam.position.copy(v.target).addScaledVector(_w, v.d); cam.up.copy(UP); cam.lookAt(v.target);
  cam.near = Math.max(0.02, v.d - 4); cam.far = v.d + 4;
  cam.updateProjectionMatrix();
}
function plateSpec(name) {
  const t = performance.now();
  switch (name) {
    case 'front': {
      const p = RM.matches ? 0 : damped.front ?? 0;      // reduced motion: the camera holds its opening angle
      return { bikes: [[gl.base, ASSEMBLED, 1]], yaw: spin.yaw * (1 - smooth(0.05, 0.85, p)), view: frontView(p) };
    }
    case 'build': {
      const tb = damped.build ?? 0, tt = clamp01((tb - 0.06) / 0.86);
      if (RM.matches) return { bikes: [[gl.base, assemblyInPlace(tt), 1]], yaw: 0, view: gl.buildStill, t: tt };
      return { bikes: [[gl.base, assembly(tt), 1]], yaw: 0, cam: aspect => aimBuild(gl.camera, tt, aspect), t: tt };
    }
    case 'detail':
      return { bikes: [[gl.base, ASSEMBLED, 1]], yaw: 0, cam: aspect => applyView(gl.camera, detailView(aspect), aspect), t: detail.cur };
    case 'yours': {
      const out = yours.to && yours.t < 1 ? [[yours.from, ASSEMBLED, 1 - smooth(0, 0.45, yours.t)], [yours.to, ASSEMBLED, smooth(0.5, 1, yours.t)]] : [[bikeOf(yours.size) || gl.base, ASSEMBLED, 1]];
      const shown = yours.to && yours.t < 0.5 ? yours.from : (yours.to || bikeOf(yours.size) || gl.base);
      return { bikes: out.filter(([b, , a]) => b && a > 0.002), yaw: 0, view: gl.sizeView, dims: { bike: shown, p: 1 } };
    }
  }
  return null;
}
const bikeOf = size => gl?.bikes?.get(size) || null;

/* =====================================================================================
   Dimension lines, projected from the bike's own joints into the plate's SVG.
   ===================================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg';
/* A technical-drawing dimension: faint dashed extension lines from the measured points, a hairline with end ticks,
   and a two-weight label (spaced caps name, tabular figure). Nodes mark the points the numbers are measured between. */
function makeDims(svg) {
  const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.append(e); return e; };
  const dim = name => {
    const g = el('g', { class: `dims__dim dims__dim--${name}` });
    const ext = [el('line', { class: 'dims__ext' }, g), el('line', { class: 'dims__ext' }, g)];
    const line = el('line', { class: 'dims__line', pathLength: 1, 'stroke-dasharray': '1 1' }, g);
    const ticks = [el('line', { class: 'dims__tick' }, g), el('line', { class: 'dims__tick' }, g)];
    const text = el('text', { class: 'dims__label' }, g);
    const name_ = el('tspan', { class: 'dims__name' }, text), value = el('tspan', { class: 'dims__value', dx: '7' }, text);
    return { g, ext, line, ticks, text, name: name_, value };
  };
  const nodes = el('g', { class: 'dims__nodes' });
  return { svg, stack: dim('stack'), reach: dim('reach'), wb: dim('wb'), nodes: ['BB', 'HTT', 'RA', 'FA'].map(() => el('circle', { class: 'dims__node', r: '2.6' }, nodes)), nodesG: nodes };
}
// The dimension lines stay in their plate, above the plate's own canvas, so they scroll with it on the compositor.
const DIMS = Object.fromEntries($$('[data-plate] .dims').map(s => {
  const plate = s.closest('[data-plate]');
  if (plate.closest('.ch--graphite')) s.classList.add('dims--graphite');   // the text halo takes the chapter's ground
  return [plate.dataset.plate, makeDims(s)];
}));
const _p = new THREE.Vector3();
function project(bike, xmm, ymm, cam, w, h, zmm = 0) {
  _p.set(xmm * MM, ymm * MM, zmm * MM); bike.root.localToWorld(_p); _p.project(cam);
  return [(_p.x + 1) / 2 * w, (1 - _p.y) / 2 * h];
}
function drawDims(name, spec, cam, w, h) {
  const D = DIMS[name]; if (!D || !spec?.bike) return;
  const b = spec.bike, J = b.J, c = b.chart, R = c.tyreOD / 2, ground = J.RA[1] - R;
  const P = (x, y) => project(b, x, y, cam, w, h);
  const xs = J.FA[0] + R + 55, yr = J.HTT[1] + 75, yw = ground - 50;       // stack ahead of the front tyre, reach above, wheelbase below
  const BB = P(0, 0), HTT = P(J.HTT[0], J.HTT[1]), RA = P(J.RA[0], J.RA[1]), FA = P(J.FA[0], J.FA[1]);
  const s0 = P(xs, 0), s1 = P(xs, J.HTT[1]), r0 = P(0, yr), r1 = P(J.HTT[0], yr), w0 = P(J.RA[0], yw), w1 = P(J.FA[0], yw);
  const pr = spec.p, part = (a, b2) => clamp01((pr - a) / (b2 - a)), f = n => n.toFixed(1);
  const seg = (ln, a, z) => { ln.setAttribute('x1', f(a[0])); ln.setAttribute('y1', f(a[1])); ln.setAttribute('x2', f(z[0])); ln.setAttribute('y2', f(z[1])); };
  const draw = (d, from, a, z, k, name, value) => {
    seg(d.ext[0], from[0], a); seg(d.ext[1], from[1], z);
    seg(d.line, a, z); d.line.setAttribute('stroke-dashoffset', (1 - k).toFixed(3));
    const len = Math.hypot(z[0] - a[0], z[1] - a[1]) || 1, nx = -(z[1] - a[1]) / len * 5, ny = (z[0] - a[0]) / len * 5;
    for (const [t, p] of [[d.ticks[0], a], [d.ticks[1], z]]) seg(t, [p[0] - nx, p[1] - ny], [p[0] + nx, p[1] + ny]);
    for (const e of [...d.ext, ...d.ticks]) e.style.opacity = k.toFixed(2);
    if (d.name.textContent !== name) d.name.textContent = name;
    if (d.value.textContent !== value) d.value.textContent = value;
  };
  draw(D.stack, [BB, HTT], s0, s1, part(0, 0.4), 'STACK', `${c.stack}`);
  draw(D.reach, [BB, HTT], r0, r1, part(0.2, 0.6), 'REACH', `${c.reach}`);
  draw(D.wb, [RA, FA], w0, w1, part(0.4, 0.85), 'WHEELBASE', `${c.wheelbase}`);
  const place = (d, x, y, anchor, k, rot = 0) => {
    d.text.setAttribute('x', f(x)); d.text.setAttribute('y', f(y)); d.text.setAttribute('text-anchor', anchor);
    d.text.setAttribute('transform', rot ? `rotate(${rot} ${f(x)} ${f(y)})` : ''); d.text.style.opacity = k.toFixed(2);
  };
  // stack reads up the line, set just outside it; with no room at the plate's edge it goes on the inside
  const sx = (s0[0] + s1[0]) / 2, outside = sx + 22 < w;
  place(D.stack, outside ? sx + 16 : sx - 8, (s0[1] + s1[1]) / 2, 'middle', part(0.3, 0.45), -90);
  place(D.reach, (r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2 - 11, 'middle', part(0.5, 0.65));
  place(D.wb, (w0[0] + w1[0]) / 2, (w0[1] + w1[1]) / 2 + 20, 'middle', part(0.75, 0.9));
  const kn = part(0, 0.25);
  [BB, HTT, RA, FA].forEach((p, i) => { D.nodes[i].setAttribute('cx', f(p[0])); D.nodes[i].setAttribute('cy', f(p[1])); });
  D.nodesG.style.opacity = kn.toFixed(2);
}

/* =====================================================================================
   Rendering: one WebGL renderer, kept off screen; each plate shows the bike in its own 2D canvas, in the page.
   A fixed canvas drawn from the page's script could only follow the page a frame late while the browser scrolls it
   on its own thread, so a plate's bike swam against its own caption and dimension lines. Canvases in the page scroll
   with everything else. A plate is drawn only when its picture changes (its signature: size, light, camera, the
   bikes and their state), so scrolling past a still plate costs no rendering at all.
   ===================================================================================== */
function sizeCanvas() {
  if (!gl) return;
  const w = innerWidth, h = canvas.clientHeight || innerHeight;
  gl.renderer.setSize(w, h, false); gl.cw = w; gl.ch = h;
}
const plateGL = Object.fromEntries(Object.entries(plateEls).map(([name, el]) => {
  const cv = document.createElement('canvas'); cv.className = 'plate__gl'; cv.setAttribute('aria-hidden', 'true');
  const poster = el.querySelector('.plate__poster'); poster ? poster.after(cv) : el.prepend(cv);   // under the dims and the caption
  return [name, { cv, ctx: null, sig: '' }];
}));
const _vp = new THREE.Vector4();
function plateSignature(spec, r, pr) {
  const e = gl.camera.matrixWorld.elements, q = gl.camera.projectionMatrix.elements;
  let s = `${Math.round(r.width * pr)}x${Math.round(r.height * pr)}|${light.t.toFixed(3)}|${spec.yaw.toFixed(4)}|${RM.matches}`;
  for (const [b, st, a] of spec.bikes) s += `|${b.chart.size}:${a.toFixed(3)}:${st === ASSEMBLED ? 'A' : (spec.t ?? 0).toFixed(4)}`;
  for (let i = 0; i < 16; i++) s += ',' + e[i].toFixed(5);
  for (let i = 0; i < 16; i++) s += ',' + q[i].toFixed(5);
  return s;
}
/** Draw the scene (already posed and aimed) at the off-screen canvas's top-left, then copy it into the plate's canvas. */
function drawPlate(P, r) {
  const { renderer, scene, camera } = gl;
  if (r.width > gl.cw || r.height > gl.ch) {        // a plate larger than the screen: grow the drawing buffer to hold it
    const w = Math.max(gl.cw, Math.ceil(r.width)), h = Math.max(gl.ch, Math.ceil(r.height));
    renderer.setSize(w, h, false); gl.cw = w; gl.ch = h;
  }
  const y = gl.ch - r.height;
  renderer.setViewport(0, y, r.width, r.height); renderer.setScissor(0, y, r.width, r.height); renderer.setScissorTest(true);
  renderer.getCurrentViewport(_vp);                 // in drawing-buffer pixels, as GL rounded them
  PLATE_PX.value.copy(_vp);
  renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
  const w = _vp.z, h = _vp.w, srcY = canvas.height - (_vp.y + h);
  if (P.cv.width !== w || P.cv.height !== h) { P.cv.width = w; P.cv.height = h; }
  P.ctx ||= P.cv.getContext('2d');
  P.ctx.clearRect(0, 0, w, h); P.ctx.drawImage(canvas, 0, srcY, w, h, 0, 0, w, h);
}
function renderPlates(rects) {
  const { renderer, camera, spinner } = gl, H = innerHeight, pr = renderer.getPixelRatio();
  let drawn = 0;
  for (const [name, el] of Object.entries(plateEls)) {
    const r = rects[name], P = plateGL[name];
    // near the screen, not only on it: a plate is drawn half a screen before it arrives, never as it arrives
    if (r.bottom < -H * 0.5 || r.top > H * 1.5 || r.width < 4 || r.height < 4) continue;
    const spec = plateSpec(name); if (!spec) continue;
    for (const b of gl.all) b.root.visible = false;
    for (const [b, st, a] of spec.bikes) { b.root.visible = true; pose(b, st, a); }
    spinner.rotation.y = spec.yaw;
    if (spec.cam) spec.cam(r.width / r.height); else aim(camera, spec.view, r.width / r.height);
    camera.updateMatrixWorld();
    const sig = plateSignature(spec, r, pr);
    if (sig !== P.sig) { drawPlate(P, r); P.sig = sig; drawn++; }
    if (spec.dims?.bike) { spec.dims.bike.root.updateWorldMatrix(true, false); drawDims(name, spec.dims, camera, r.width, r.height); }
    if (trace.on && spec.bikes[0]) { const b = spec.bikes[0][0], J = b.J; b.root.updateWorldMatrix(true, false); trace.plates[name] = [[0, 0], J.FA, J.RA].flatMap(([x, y]) => project(b, x, y, camera, r.width, r.height).map(n => +n.toFixed(2))); }
    if (name === 'build') el.dataset.scVerifyState = spec.t.toFixed(3);
    if (name === 'detail') { el.dataset.scVerifyState = String(spec.t); placeSpots(camera, r); }
  }
  spinner.rotation.y = 0;
  return drawn;
}

/* =====================================================================================
   Posters: the same scene rendered once per plate, shown when WebGL is missing or its context is lost.
   tools/render-posters.mjs calls renderPoster and writes assets/posters/*.webp.
   ===================================================================================== */
const POSTERS = {
  front: () => [gl.base, frontView(0), 16 / 10],
  build: () => [gl.base, gl.buildStill, 4 / 3],
  size: s => [bikeOf(s), gl.sizeView, 16 / 10],
  detail: () => [gl.base, (cam, aspect) => applyView(cam, resolveView(-1, aspect), aspect), 16 / 10],
};
function renderPoster(kind, arg, cssW = 800) {
  const [bike, view, aspect] = POSTERS[kind](arg), cssH = Math.round(cssW / aspect);
  const { renderer, scene, camera } = gl, pr = renderer.getPixelRatio(), y = gl.ch - cssH;
  for (const b of gl.all) b.root.visible = b === bike;
  pose(bike, ASSEMBLED, 1); gl.spinner.rotation.y = 0; light.t = 1; applyLight();
  if (typeof view === 'function') view(camera, aspect); else aim(camera, view, aspect);
  renderer.setScissorTest(true); renderer.setViewport(0, y, cssW, cssH); renderer.setScissor(0, y, cssW, cssH);
  PLATE_PX.value.set(0, y * pr, cssW * pr, cssH * pr);
  renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
  const out = document.createElement('canvas'); out.width = Math.round(cssW * pr); out.height = Math.round(cssH * pr);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
  dirty = true; kick();                                 // the page's next frame redraws its plates over the region
  return out.toDataURL('image/webp', 0.9);
}
/** Without WebGL the chooser shows the chosen size's poster. */
const shownPoster = { yours: 0 };
function syncPosters() {
  if (!html.classList.contains('no-webgl')) return;
  const set = (name, key, file) => {
    if (shownPoster[name] === key) return;
    const el = plateEls[name]?.querySelector('.plate__poster');
    if (el) el.style.backgroundImage = `url(assets/posters/${file}.webp)`;
    shownPoster[name] = key;
  };
  set('yours', yours.size, `size-${yours.size}`);
}

/* =====================================================================================
   The loop: damped progress, plate rendering, DOM updates. Runs only while something moves.
   ===================================================================================== */
let raf = 0, last = 0, dirty = true;
// Smoothness trace (tools/check-smoothness.mjs): per frame, what it cost and where each plate put the bike within the
// plate (bottom bracket and both axles, plate px: the animation alone, not the page's scroll). Off unless a check turns it on.
const trace = { on: false, frames: [], plates: null };
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
/** Every layout read the frame needs, in one place at its start: section and plate rectangles. */
const measured = { sec: {}, plates: {} };
function measure() {
  for (const [k, el] of Object.entries(sec)) measured.sec[k] = el.getBoundingClientRect();
  for (const [k, el] of Object.entries(plateEls)) measured.plates[k] = el.getBoundingClientRect();
  return measured;
}
function frame(now) {
  raf = 0;
  const t0 = performance.now();
  if (trace.on) trace.plates = {};
  // after an idle stretch the first step is one frame long: the gap is not elapsed motion, and 0 would snap
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60, consecutive = last !== 0;
  let moving = false;
  const M = measure(), S = M.sec;
  const targets = { front: pinnedP(S.front), build: pinnedP(S.build) };
  for (const [k, v] of Object.entries(targets)) { const before = damped[k]; follow(k, v, dt); if (damped[k] !== v || dampedV[k]) moving = true; if (before !== damped[k]) dirty = true; }
  if (!spin.drag && spin.vel !== 0) {
    spin.yaw += spin.vel * dt; spin.yaw = Math.atan2(Math.sin(spin.yaw), Math.cos(spin.yaw)); spin.vel *= Math.exp(-dt / 0.45);
    if (Math.abs(spin.vel) < 0.02) spin.vel = 0; moving = true; dirty = true;
  }
  if (light.t < 1) { light.t = Math.min(1, light.t + dt / 1.8); moving = true; dirty = true; }
  if (detail.anim) {                                // a flight in II: draw every frame until it lands
    moving = true; dirty = true;
    if (now - detail.anim.t0 >= detail.anim.dur) { detail.anim = null; landed(); }
  }
  if (yours.to && yours.t < 1) {
    yours.t = Math.min(1, yours.t + dt / 0.75); moving = true; dirty = true;
    if (yours.t >= 1) { yours.size = yours.to.chart.size; yours.from = yours.to = null; }
  }
  updateDOM(M);
  if (gl?.ready) {
    applyLight();
    renderPlates(M.plates);
    if (consecutive && moving) sampleFrame(dt * 1000, now);
  }
  dirty = false;
  if (moving) { last = now; kick(); } else last = 0;
  if (trace.on) trace.frames.push({ now, cost: performance.now() - t0, y: scrollY, p: { ...damped }, plates: trace.plates });
}
addEventListener('scroll', () => { dirty = true; kick(); }, { passive: true });
addEventListener('resize', () => { sizeCanvas(); kick(); }, { passive: true });

/* ---------- the arrival light: the key comes up across the clearcoat ---------- */
function applyLight() {
  const e = EASE.outCubic(light.t), { key, rim } = gl;
  key.position.set(lerp(3.5, -2.2, e), lerp(0.6, 3.2, e), lerp(-2.5, 2.8, e));
  key.intensity = lerp(0.3, 2.3, e); rim.intensity = lerp(2.2, 1.7, e);
  gl.scene.environmentIntensity = lerp(0.3, 1.15, e);
}

const SIZE_LIST = SIZES.map(s => s.size);            // the chooser's sizes, in order (fade-set parity in ensureSize)

/* ---------- DOM: folio, the build's current step, the hero figure ---------- */
const folioLinks = Object.fromEntries($$('[data-folio]').map(a => [a.dataset.folio, a]));
const stepEls = $$('.step'), STEP_OF = ['frame', 'fork', 'wheels', 'wheels', 'drivetrain', 'cockpit', 'saddle'];
const frontFigure = $('.front__figure'), buildCue = $('.build-cue');
const dom = { chapter: '', step: '' };
function updateDOM(M) {                             // writes only: the rectangles were read in measure()
  const mid = innerHeight * 0.45;
  let chapter = '';
  for (const [k, el] of Object.entries(sec)) { const r = M.sec[k]; if (el.dataset.chapter && r.top <= mid && r.bottom > mid) chapter = el.dataset.chapter; }
  if (chapter !== dom.chapter) { for (const [k, a] of Object.entries(folioLinks)) a.setAttribute('aria-current', k === chapter ? 'true' : 'false'); dom.chapter = chapter; }
  const tb = clamp01(((damped.build ?? 0) - 0.06) / 0.86);
  let k = 0; STAGES.forEach((s, i) => { if (tb >= s.w[0] - 0.01) k = i; });
  const step = STEP_OF[k];
  if (step !== dom.step) { for (const e of stepEls) e.classList.toggle('is-now', e.dataset.step === step); dom.step = step; }
  if (buildCue) {                                   // "keep scrolling" while parts are still to come; gone as the saddle lands
    const o = (1 - smooth(0.86, 0.96, tb)).toFixed(3);
    if (buildCue.style.opacity !== o) buildCue.style.opacity = o;
  }
  const fp = damped.front ?? 0;                     // the hero figure rises and fades; under reduced motion it only fades
  if (frontFigure) frontFigure.style.transform = RM.matches ? 'none' : `translate3d(0, ${(-fp * 14).toFixed(2)}vh, 0)`, frontFigure.style.opacity = (1 - smooth(0.2, 0.8, fp)).toFixed(3);
  syncPosters();
}

/* =====================================================================================
   Drag to turn (frontispiece): the bike turns on its own vertical axis; momentum after release.
   ===================================================================================== */
const frontPlate = plateEls.front;
// The hero plate ends where its copy begins (CSS --front-copy): the copy's real height decides, fonts and wrapping included.
const frontCopy = $('.front__copy'), frontStage = frontPlate.closest('.front');
if (frontCopy && frontStage && 'ResizeObserver' in window) new ResizeObserver(() => { frontStage.style.setProperty('--front-copy', `${frontCopy.offsetHeight}px`); kick(); }).observe(frontCopy);
frontPlate.addEventListener('pointerdown', e => {
  if (!gl?.ready || (damped.front ?? 0) > 0.6 || (e.pointerType === 'mouse' && e.button !== 0)) return;
  spin.drag = { id: e.pointerId, x: e.clientX, t: e.timeStamp }; spin.vel = 0;
  frontPlate.setPointerCapture?.(e.pointerId); html.classList.add('spinning');
});
frontPlate.addEventListener('pointermove', e => {
  const d = spin.drag; if (!d || e.pointerId !== d.id) return;
  const dx = e.clientX - d.x, dtm = Math.max(1, e.timeStamp - d.t), k = Math.PI * 2 / innerWidth;
  spin.yaw += dx * k; spin.yaw = Math.atan2(Math.sin(spin.yaw), Math.cos(spin.yaw));
  spin.vel = 0.7 * spin.vel + 0.3 * (dx * k / dtm * 1000);
  d.x = e.clientX; d.t = e.timeStamp; dirty = true; kick();
});
const endDrag = e => { if (!spin.drag || e.pointerId !== spin.drag.id) return; spin.drag = null; html.classList.remove('spinning'); if (RM.matches) spin.vel = 0; kick(); };
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) frontPlate.addEventListener(ev, endDrag);
// The keyboard turns it too (the plate is focusable once WebGL is up): 15 degrees a press, a glide, or a step under reduced motion.
const KEY_TURN = Math.PI / 12;
frontPlate.addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (!gl?.ready || (damped.front ?? 0) > 0.6) return;
  e.preventDefault();
  const dir = e.key === 'ArrowRight' ? 1 : -1;     // as a drag to the right
  if (RM.matches) { spin.yaw = Math.atan2(Math.sin(spin.yaw + dir * KEY_TURN), Math.cos(spin.yaw + dir * KEY_TURN)); spin.vel = 0; }
  else spin.vel += dir * KEY_TURN / 0.45;           // momentum decays with tau 0.45 s, so the glide covers KEY_TURN
  dirty = true; kick();
});

/* =====================================================================================
   In detail: the points on the bike, and the column that says what each part is.
   ===================================================================================== */
const detailEl = $('[data-detail]'), spotsEl = $('.spots', detailEl), spotEls = $$('.spot', detailEl), partEls = $$('.part', detailEl);
const spotPos = spotEls.map(() => '');
/** Lay each point over its anchor, projected with the plate's own camera. Only at the overview: in a close-up the
    points are hidden, and a flight back shows them once it lands. */
function placeSpots(cam, r) {
  if (detail.cur >= 0 || detail.anim) return;
  const b = gl.base; b.root.updateWorldMatrix(true, false);
  PARTS.forEach((p, i) => {
    const [x, y, z] = p.anchor(b.J), q = project(b, x, y, cam, r.width, r.height, z);
    const key = `${q[0].toFixed(1)},${q[1].toFixed(1)}`;
    if (spotPos[i] === key) return;
    spotPos[i] = key;
    spotEls[i].style.transform = `translate(${q[0].toFixed(1)}px, ${q[1].toFixed(1)}px)`;
    spotEls[i].classList.toggle('spot--left', q[0] > r.width * 0.72);   // near the right edge: the label goes left
  });
}
function flyTo(i) {
  const r = plateEls.detail.getBoundingClientRect(), aspect = r.width / r.height, now = performance.now();
  const from = detailView(aspect, now), to = resolveView(i, aspect);
  const swing = Math.abs(shortArc(to.az - from.az)) + Math.abs(Math.log(to.d / from.d)) * 40;   // degrees, plus zoom
  detail.anim = { from, t0: now, dur: RM.matches ? 0 : Math.min(1300, 650 + swing * 3.2) };
  detail.cur = i; dirty = true; kick();
}
function openPart(i, focus = true) {
  if (!gl?.ready || i < 0 || i >= PARTS.length) return;
  flyTo(i);
  detailEl.classList.add('is-open', 'spots-off'); spotsEl.inert = true;
  partEls.forEach((el, k) => el.classList.toggle('is-open', k === i));
  if (focus) partEls[i].focus({ preventScroll: true });
}
function closeParts() {
  if (detail.cur < 0) return;
  // the column's buttons vanish as it swaps back, so remember now whether focus was here: it goes to this part's point
  detail.focusSpot = detailEl.contains(document.activeElement) ? spotEls[detail.cur] : null;
  flyTo(-1);
  detailEl.classList.remove('is-open');            // the column returns at once; the points when the camera lands
  partEls.forEach(el => el.classList.remove('is-open'));
}
function landed() {
  if (detail.cur >= 0) return;
  detailEl.classList.remove('spots-off'); spotsEl.inert = false;
  spotPos.fill('');                                 // re-place them for the plate as it is now
  if (detail.focusSpot) detail.focusSpot.focus({ preventScroll: true });
  detail.focusSpot = null;
}
spotEls.forEach((el, i) => el.addEventListener('click', () => openPart(i)));
// the points pulse only while the section is on screen: endless animations off screen still cost scroll frames
new IntersectionObserver(es => es.forEach(e => detailEl.classList.toggle('is-live', e.isIntersecting))).observe(detailEl);
let scrollIdle = 0;                                 // and not while the page is scrolling: it restarts 250 ms after it stops
addEventListener('scroll', () => {
  if (!scrollIdle) detailEl.classList.add('is-scrolling');
  clearTimeout(scrollIdle); scrollIdle = setTimeout(() => { detailEl.classList.remove('is-scrolling'); scrollIdle = 0; }, 250);
}, { passive: true });
$('[data-part-back]', detailEl).addEventListener('click', closeParts);
$$('[data-part-step]', detailEl).forEach(el => el.addEventListener('click', () => openPart((detail.cur + +el.dataset.partStep + PARTS.length) % PARTS.length)));
detailEl.addEventListener('keydown', e => {
  if (detail.cur < 0) return;
  if (e.key === 'Escape') { e.preventDefault(); closeParts(); }
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input')) {
    e.preventDefault(); openPart((detail.cur + (e.key === 'ArrowRight' ? 1 : -1) + PARTS.length) % PARTS.length);
  }
});

/* =====================================================================================
   Yours: height in, size out; the bike rebuilds itself at the chosen size; the size goes into the booking.
   ===================================================================================== */
const heightIn = $('#height'), heightOut = $('#height-out');
const radios = $$('input[name="size"]'), sheet = Object.fromEntries($$('[data-sheet]').map(e => [e.dataset.sheet, e]));
const yourSize = $$('[data-your-size]'), yoursCap = $('[data-yours-cap]');
function setSheet(c) {
  for (const k of ['stack', 'reach', 'ett', 'seatTube', 'standover', 'wheelbase', 'headAngle', 'trail']) sheet[k].textContent = c[k];
  for (const e of yourSize) e.textContent = c.size;
  if (yoursCap) yoursCap.textContent = `Plate 4. Size ${c.size}, rebuilt from its chart.`;
}
async function choose(size) {
  const c = BY_SIZE[size]; if (!c) return;
  for (const r of radios) r.checked = +r.value === size;
  setSheet(c);
  booking.size = size;
  if (!gl?.ready) { yours.size = size; syncPosters(); return; }
  let target = bikeOf(size);
  if (!target) { target = await ensureSize(size); }
  const current = yours.to || bikeOf(yours.size) || gl.base;
  if (target === current) { yours.size = size; kick(); return; }
  yours.from = current; yours.to = target; yours.t = 0; kick();   // a dissolve, opacity only: kept under reduced motion too
}
radios.forEach(r => r.addEventListener('change', () => { if (r.checked) choose(+r.value); }));
let heightTimer = 0;
heightIn.addEventListener('input', () => {
  clearTimeout(heightTimer);
  heightTimer = setTimeout(() => {
    const h = Math.round(+heightIn.value);
    for (const r of radios) r.classList.remove('is-suggested');
    if (!heightIn.value) { heightOut.textContent = 'Or pick a size below.'; return; }
    if (!(h >= 120 && h <= 230)) { heightOut.textContent = 'Give your height in centimetres.'; return; }
    const fit = sizesForHeight(h);
    if (!fit.length) { heightOut.textContent = `The reference chart runs from ${SIZES[0].heightCm[0]} to ${SIZES[SIZES.length - 1].heightCm[1]} cm. A fitting will size you.`; return; }
    if (fit.length === 1) heightOut.textContent = `At ${h} cm the reference chart puts you on a ${fit[0]}.`;
    else { heightOut.textContent = `At ${h} cm you sit between a ${fit[0]} and a ${fit[1]}. A fitting decides.`; for (const r of radios) if (+r.value === fit[1]) r.classList.add('is-suggested'); }
    choose(fit[0]);
  }, 260);
});

/* =====================================================================================
   Booking: Calendly, loaded only when asked for, with the chosen size passed in.
   ===================================================================================== */
const booking = { size: 56, url: (html.dataset.calendly || '').trim() };
const calOpen = $('[data-cal-open]'), calFrame = $('[data-cal-frame]'), calState = $('[data-cal-state]');
if (booking.url) {                                  // the markup starts honest (no calendar yet); a configured calendar opens it
  calOpen.disabled = false;
  calState.textContent = 'Pick a time and the fitting starts from your size.';
}
calOpen.addEventListener('click', () => {
  if (!booking.url) return;
  const u = new URL(booking.url);
  u.searchParams.set('embed_type', 'Inline'); u.searchParams.set('embed_domain', location.host || 'localhost');
  u.searchParams.set('hide_gdpr_banner', '1'); u.searchParams.set('a1', `Frame size ${booking.size} (from the Varsen size chooser)`);
  const f = document.createElement('iframe');
  f.src = u.toString(); f.title = 'Book a fitting'; f.loading = 'lazy'; f.referrerPolicy = 'strict-origin-when-cross-origin';
  calFrame.replaceChildren(f); calFrame.hidden = false; calOpen.hidden = true;
  calState.textContent = `Size ${booking.size} is in the booking. Pick a time.`;
});

/* =====================================================================================
   Init: renderer, model, studio, then the other six sizes in the background.
   ===================================================================================== */
const bikesInProgress = new Map();
function ensureSize(size) {
  if (bikeOf(size)) return Promise.resolve(bikeOf(size));
  if (!bikesInProgress.has(size)) bikesInProgress.set(size, (async () => {
    const parity = SIZE_LIST.indexOf(size) % 2;
    const b = wrapBike(await buildSize(gl.M, BY_SIZE[size], gl.base56), parity ? gl.FADE_B : gl.FADE_A);
    b.root.visible = false; gl.spinner.add(b.root); gl.bikes.set(size, b); gl.all.push(b);
    const v = validateGeometry(measureBuilt(b), b.chart);
    if (v.length) console.error(`Size ${size} geometry check failed:`, v);
    (window.__bike.sizeChecks ||= {})[size] = v;
    kick(); return b;
  })());
  return bikesInProgress.get(size);
}
async function initGL() {
  const t0 = performance.now();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(glName(renderer))) {
      renderer.dispose(); renderer.forceContextLoss();
      const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh); canvas = fresh;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
      SOFTWARE_GL = true; QUALITY = levels(true); window.__bike.softwareGL = true;
    }
  } catch { html.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(QUALITY[0]); renderer.autoClear = false; renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  gl = { renderer, cw: 0, ch: 0 }; sizeCanvas();
  await document.fonts.ready;
  const { M, FADE } = await makeMaterials(); await slice();
  const FADE_B = fadeSet(M);
  for (const set of [FADE, FADE_B]) for (const [base, twin] of set) { BASE_OF.set(base, base); BASE_OF.set(twin, base); }
  const raw = await buildBike(M, CHART);
  window.__bike.steps.chain = raw.chainMs;
  const measures = measureBuilt(raw), violations = validateGeometry(measures, CHART);
  Object.assign(window.__bike, { measures, violations, geometryOK: !violations.length, joints: raw.J });
  if (violations.length) { console.error('Geometry assertion failed:', violations); renderer.dispose(); html.classList.add('no-webgl', 'geometry-failed'); gl = null; return; }
  const scene = new THREE.Scene(), spinner = new THREE.Group(); spinner.name = 'spinner'; scene.add(spinner);
  const base = wrapBike(raw, FADE); spinner.add(base.root);
  const key = new THREE.DirectionalLight(0xfff6e8, 1.9), rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
  rim.position.set(1.4, 3.8, -4.4); scene.add(key, rim);
  const floor = new THREE.Group(); floor.add(floorPool(), fadeAtPlateEdges(shadowBlob())); scene.add(floor);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
  Object.assign(gl, { scene, camera, spinner, base, base56: raw, bikes: new Map([[56, base]]), all: [base], M, FADE_A: FADE, FADE_B, key, rim, floor });
  // fits: the hero ring, the build's travel, the chooser's largest frame
  gl.ring = ringCorners(base.box); gl.ringTarget = new THREE.Vector3(0, (base.box.min.y + base.box.max.y) / 2, 0);
  gl.buildVols = buildVolumes(base);
  gl.buildStill = { az: 16, el: 7, fov: 19, corners: boxCorners(base.box), target: base.box.getCenter(new THREE.Vector3()), margin: 0.06 };   // the build's last angle, held
  const big = base.box.clone(); big.expandByVector(new THREE.Vector3(0.05, 0.08, 0)); big.max.x += 0.09;   // until the 61 exists; replaced below
  gl.sizeView = { az: 5, el: 2, fov: 17, corners: boxCorners(big), target: big.getCenter(new THREE.Vector3()), margin: 0.08 };
  await yieldToMain(); let t1 = performance.now();
  gl.env = await buildEnvironment(renderer, scene); window.__bike.steps.environment = Math.round(performance.now() - t1);
  await yieldToMain(); t1 = performance.now();
  for (const variant of ['base', 'fade']) {                 // compile opaque and dissolve variants off the main thread
    base.root.traverse(o => { if (o.isMesh) { const f = FADE_INFO.get(o); if (f) o.material = variant === 'base' ? f.base : f.fade; } });
    aim(camera, frontView(0), 1.6);
    try { await renderer.compileAsync(scene, camera); } catch { /* compiles on first use */ }
    await yieldToMain();
  }
  for (const f of [...Object.values(base.faders), base.chainFader]) f(null);
  base.posed = null; pose(base, ASSEMBLED);
  // the tour's stops in world space, read off the assembled size 56 (the tour never shows another size)
  base.root.updateMatrixWorld(true);
  gl.detailCorners = boxCorners(base.box); gl.detailTarget = base.box.getCenter(new THREE.Vector3());
  gl.partTargets = PARTS.map(p => { const g = base.parts[p.part], o = p.at ? p.at(base.J) : p.off; return g.localToWorld(new THREE.Vector3(...o).divide(g.scale)); });
  window.__bike.steps.compile = Math.round(performance.now() - t1);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); html.classList.remove('gl-ready'); html.classList.add('no-webgl', 'gl-lost'); gl.ready = false; frontPlate.removeAttribute('tabindex'); syncPosters(); kick(); }, false);
  gl.ready = true;
  frontPlate.tabIndex = 0;                            // something to turn now: the plate takes focus and the arrow keys
  light.t = QA || RM.matches ? 1 : 0;
  dirty = true; frame(performance.now());
  html.classList.add('gl-ready');
  window.__bike.initMs = Math.round(performance.now() - t0);
  // the other six sizes, one at a time, in the background, so the chooser answers at once; the largest first, so its fit is final early
  for (const s of [61, 44, 49, 52, 54, 58]) {
    await ensureSize(s);
    if (s === 61) {
      const all = new THREE.Box3().union(base.box).union(bikeOf(61).box);
      all.expandByVector(new THREE.Vector3(0.02, 0.05, 0)); all.max.x += 0.11;   // the stack dimension stands ahead of the front tyre
      gl.sizeView = { az: 5, el: 2, fov: 17, corners: boxCorners(all), target: all.getCenter(new THREE.Vector3()), margin: 0.08 };
    }
    await yieldToMain();
  }
  window.__bike.sizesReady = true;
  kick();
}

/* =====================================================================================
   QA hooks: the overlap scan (qa/overlap-core.mjs) poses the size-56 assembly by build progress t.
   ===================================================================================== */
let qaBike = null;                                  // the bike the QA hooks expose: null = the size 56 (with its assembly)
const qaTarget = () => qaBike || gl?.base;
const defineLive = (o, src) => Object.defineProperties(o, Object.getOwnPropertyDescriptors(src));   // keeps the getters live (Object.assign would read them once)
defineLive(window.__bike, {
  BY_SIZE, SIZES, assembly, quality, setQuality, get QUALITY() { return QUALITY; }, get gl() { return gl && { ...gl, bike: { root: qaTarget().root } }; },
  get parts() { return qaTarget()?.parts; }, get scene() { return gl?.scene; }, get renderer() { return gl?.renderer; }, get camera() { return gl?.camera; },
  get p() { return { shown: 1 } }, state: t => ({ parts: qaBike ? ASSEMBLED : assembly(t) }),
  pose: t => { const q = qaTarget(); for (const b of gl.all) b.root.visible = b === q; gl.spinner.rotation.y = 0; pose(q, qaBike ? ASSEMBLED : assembly(t)); q.posed = null; q.root.updateMatrixWorld(true); dirty = true; },
  useSize: s => { qaBike = s === 56 ? null : bikeOf(s); return s === 56 || !!qaBike; },
  choose, ensureSize, bikeOf, get spin() { return { yaw: spin.yaw, vel: spin.vel } },
  poster: (kind, arg, cssW) => renderPoster(kind, arg, cssW),
  trace: { start: () => { trace.frames = []; trace.on = true; }, stop: () => { trace.on = false; return trace.frames; } },
  // the camera on a flight in II: from view a to view b (-1 the overview), k in 0..1 along it
  detailCam: (a, b, k, aspect) => { applyView(gl.camera, mixView(resolveView(a, aspect), resolveView(b, aspect), smoother(k)), aspect); return { pos: gl.camera.position.toArray(), near: gl.camera.near }; },
  parts: PARTS.length, openPart: i => openPart(i), closeParts: () => closeParts(), get detail() { return { cur: detail.cur, flying: !!detail.anim }; },
  settled: () => new Promise(res => { kick(); let n = 0; const chk = () => (++n > 3 && !raf ? res() : requestAnimationFrame(chk)); requestAnimationFrame(chk); }),
});

initGL().then(() => { window.__bike.ready = true; }, err => { console.error(err); html.classList.add('no-webgl'); window.__bike.ready = true; });
kick();
