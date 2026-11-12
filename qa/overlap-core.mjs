// Interpenetration scan of the built bike, run IN THE PAGE (pass overlapScan to page.evaluate; it must stay
// self-contained: no imports, no outer variables).
//
// Bodies: each part group, plus every descendant tagged userData.body (it moves inside its part: wheel spin,
// crankset, ...). Meshes of one body never move against each other, so only pairs of different bodies are tested.
// For each p the page poses the scene (window.__bike.pose), and every pair of visible bodies is tested triangle
// against triangle (one BVH per body, built once in body space). Depth of a triangle pair = the smallest push that
// separates the two triangles (separating-axis test over 2 normals + 9 edge-edge axes). Touching and coincident
// surfaces give a depth of ~0, so only depth > eps counts as an overlap.
// p advances adaptively: no vertex of any body moves more than maxMove between two samples.
// fits: designed shaft-in-bore fits, [{ shaft: 'part[/body]:mesh', host: 'part[/body]' }]. A hit between that shaft and any
// mesh of the host is reported under `fits`, not `overlaps`, with the shaft axis's largest distance from where it lies in
// the host at p = 1: zero means the shaft only slid along or turned about its own axis (its bore), never through a wall.
export async function overlapScan(opt = {}) {
  const { eps = 3e-4, maxMove = 1e-3, maxStep = 0.002, from = 0, to = 1, points = null, fits = [] } = opt;
  const B = window.__bike, T = B.THREE, t0 = performance.now();

  // ---------- bodies and their triangles (body space) ----------
  const bodies = [];
  const gather = (node, body) => {
    for (const c of node.children) {
      if (c.userData.body) { const b = { root: c, name: `${body.part}/${c.name}`, part: body.part, meshes: [] }; bodies.push(b); gather(c, b); }
      else { if (c.isMesh) body.meshes.push(c); gather(c, body); }
    }
  };
  for (const [id, g] of Object.entries(B.parts)) { const b = { root: g, name: id, part: id, meshes: [] }; bodies.push(b); gather(g, b); }
  B.pose(1);
  const meshNames = [], meshId = new Map(), idOf = s => { if (!meshId.has(s)) { meshId.set(s, meshNames.length); meshNames.push(s); } return meshId.get(s); };
  const inv = new T.Matrix4(), rel = new T.Matrix4(), mi = new T.Matrix4(), v = new T.Vector3();
  for (const b of bodies) {
    inv.copy(b.root.matrixWorld).invert();
    const chunks = []; let n = 0;
    for (const m of b.meshes) {
      const pos = m.geometry.attributes.position, idx = m.geometry.index, nt = Math.floor((idx ? idx.count : pos.count) / 3);
      const id = idOf(`${b.name}:${m.name || '?'}`), count = m.isInstancedMesh ? m.count : 1;
      rel.multiplyMatrices(inv, m.matrixWorld);
      for (let k = 0; k < count; k++) {
        if (m.isInstancedMesh) { m.getMatrixAt(k, mi); mi.premultiply(rel); } else mi.copy(rel);
        const vx = new Float64Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mi); vx[3 * i] = v.x; vx[3 * i + 1] = v.y; vx[3 * i + 2] = v.z; }
        const tri = new Float64Array(nt * 9);
        for (let t = 0; t < nt; t++) for (let c = 0; c < 3; c++) {
          const vi = idx ? idx.getX(3 * t + c) : 3 * t + c;
          tri[9 * t + 3 * c] = vx[3 * vi]; tri[9 * t + 3 * c + 1] = vx[3 * vi + 1]; tri[9 * t + 3 * c + 2] = vx[3 * vi + 2];
        }
        chunks.push([tri, id, nt]); n += nt;
      }
    }
    b.tri = new Float64Array(n * 9); b.mesh = new Uint32Array(n);
    let o = 0; for (const [tri, id, nt] of chunks) { b.tri.set(tri, o * 9); b.mesh.fill(id, o, o + nt); o += nt; }
    b.bvh = buildBVH(b.tri);
    b.box = [b.bvh.mn[0], b.bvh.mn[1], b.bvh.mn[2], b.bvh.mx[0], b.bvh.mx[1], b.bvh.mx[2]];
  }

  function buildBVH(tri) {
    const n = tri.length / 9, LEAF = 6, cen = new Float64Array(n * 3), lo = new Float64Array(n * 3), hi = new Float64Array(n * 3);
    for (let t = 0; t < n; t++) for (let a = 0; a < 3; a++) {
      const x0 = tri[9 * t + a], x1 = tri[9 * t + 3 + a], x2 = tri[9 * t + 6 + a];
      lo[3 * t + a] = Math.min(x0, x1, x2); hi[3 * t + a] = Math.max(x0, x1, x2); cen[3 * t + a] = (x0 + x1 + x2) / 3;
    }
    const order = new Int32Array(n); for (let i = 0; i < n; i++) order[i] = i;
    const MN = [], MX = [], L = [], R = [], S = [], C = [];
    const build = (s, e) => {
      const id = MN.length, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], cmn = [...mn], cmx = [...mx];
      for (let i = s; i < e; i++) { const t = order[i]; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], lo[3 * t + a]); mx[a] = Math.max(mx[a], hi[3 * t + a]); cmn[a] = Math.min(cmn[a], cen[3 * t + a]); cmx[a] = Math.max(cmx[a], cen[3 * t + a]); } }
      MN.push(mn); MX.push(mx); L.push(-1); R.push(-1); S.push(s); C.push(e - s);
      const ext = [0, 1, 2].map(a => cmx[a] - cmn[a]), axis = ext.indexOf(Math.max(...ext));
      if (e - s <= LEAF || ext[axis] < 1e-9) return id;
      const sl = Array.from(order.subarray(s, e)).sort((x, y) => cen[3 * x + axis] - cen[3 * y + axis]); order.set(sl, s);
      const m = (s + e) >> 1; L[id] = build(s, m); R[id] = build(m, e);
      return id;
    };
    build(0, n);
    return { mn: Float64Array.from(MN.flat()), mx: Float64Array.from(MX.flat()), L: Int32Array.from(L), R: Int32Array.from(R), S: Int32Array.from(S), C: Int32Array.from(C), order };
  }

  // ---------- triangle-triangle penetration depth (SAT), -1 if separated ----------
  const ax = new Float64Array(3);
  function depth(a, b) {                                   // a, b: Float64Array(9) in the same space
    for (let k = 0; k < 3; k++) {                          // quick AABB reject
      const amin = Math.min(a[k], a[3 + k], a[6 + k]), amax = Math.max(a[k], a[3 + k], a[6 + k]);
      const bmin = Math.min(b[k], b[3 + k], b[6 + k]), bmax = Math.max(b[k], b[3 + k], b[6 + k]);
      if (amax < bmin || bmax < amin) return -1;
    }
    const ea = [a[3] - a[0], a[4] - a[1], a[5] - a[2], a[6] - a[3], a[7] - a[4], a[8] - a[5], a[0] - a[6], a[1] - a[7], a[2] - a[8]];
    const eb = [b[3] - b[0], b[4] - b[1], b[5] - b[2], b[6] - b[3], b[7] - b[4], b[8] - b[5], b[0] - b[6], b[1] - b[7], b[2] - b[8]];
    let best = Infinity;
    const test = () => {
      const len = Math.hypot(ax[0], ax[1], ax[2]); if (len < 1e-14) return true;
      const x = ax[0] / len, y = ax[1] / len, z = ax[2] / len;
      const p0 = a[0] * x + a[1] * y + a[2] * z, p1 = a[3] * x + a[4] * y + a[5] * z, p2 = a[6] * x + a[7] * y + a[8] * z;
      const q0 = b[0] * x + b[1] * y + b[2] * z, q1 = b[3] * x + b[4] * y + b[5] * z, q2 = b[6] * x + b[7] * y + b[8] * z;
      const o = Math.min(Math.max(p0, p1, p2) - Math.min(q0, q1, q2), Math.max(q0, q1, q2) - Math.min(p0, p1, p2));
      if (o <= 0) return false;
      if (o < best) best = o; return true;
    };
    const cross = (u, i, w, j) => { ax[0] = u[i + 1] * w[j + 2] - u[i + 2] * w[j + 1]; ax[1] = u[i + 2] * w[j] - u[i] * w[j + 2]; ax[2] = u[i] * w[j + 1] - u[i + 1] * w[j]; };
    cross(ea, 0, ea, 3); if (!test()) return -1;
    cross(eb, 0, eb, 3); if (!test()) return -1;
    for (let i = 0; i < 9; i += 3) for (let j = 0; j < 9; j += 3) { cross(ea, i, eb, j); if (!test()) return -1; }
    return best === Infinity ? 0 : best;
  }

  // ---------- body pair: dual BVH traversal, A's triangles mapped into B's space ----------
  const ta = new Float64Array(9), tb = new Float64Array(9);
  function collide(A, Bb, M, out) {                        // M: column-major A-local -> B-local
    const a = A.bvh, b = Bb.bvh, stack = [0, 0];
    const m = M; let maxD = 0;
    while (stack.length) {
      const ib = stack.pop(), ia = stack.pop();
      const ex = (a.mx[3 * ia] - a.mn[3 * ia]) / 2, ey = (a.mx[3 * ia + 1] - a.mn[3 * ia + 1]) / 2, ez = (a.mx[3 * ia + 2] - a.mn[3 * ia + 2]) / 2;
      const cx0 = (a.mx[3 * ia] + a.mn[3 * ia]) / 2, cy0 = (a.mx[3 * ia + 1] + a.mn[3 * ia + 1]) / 2, cz0 = (a.mx[3 * ia + 2] + a.mn[3 * ia + 2]) / 2;
      const cx = m[0] * cx0 + m[4] * cy0 + m[8] * cz0 + m[12], cy = m[1] * cx0 + m[5] * cy0 + m[9] * cz0 + m[13], cz = m[2] * cx0 + m[6] * cy0 + m[10] * cz0 + m[14];
      const hx = Math.abs(m[0]) * ex + Math.abs(m[4]) * ey + Math.abs(m[8]) * ez, hy = Math.abs(m[1]) * ex + Math.abs(m[5]) * ey + Math.abs(m[9]) * ez, hz = Math.abs(m[2]) * ex + Math.abs(m[6]) * ey + Math.abs(m[10]) * ez;
      if (cx + hx < b.mn[3 * ib] || cx - hx > b.mx[3 * ib] || cy + hy < b.mn[3 * ib + 1] || cy - hy > b.mx[3 * ib + 1] || cz + hz < b.mn[3 * ib + 2] || cz - hz > b.mx[3 * ib + 2]) continue;
      const la = a.L[ia] < 0, lb = b.L[ib] < 0;
      if (la && lb) {
        for (let i = a.S[ia]; i < a.S[ia] + a.C[ia]; i++) {
          const t = a.order[i], src = A.tri;
          for (let c = 0; c < 3; c++) {
            const x = src[9 * t + 3 * c], y = src[9 * t + 3 * c + 1], z = src[9 * t + 3 * c + 2];
            ta[3 * c] = m[0] * x + m[4] * y + m[8] * z + m[12]; ta[3 * c + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; ta[3 * c + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
          }
          for (let j = b.S[ib]; j < b.S[ib] + b.C[ib]; j++) {
            const u = b.order[j]; for (let k = 0; k < 9; k++) tb[k] = Bb.tri[9 * u + k];
            const d = depth(ta, tb);
            if (d > eps) {
              const key = A.mesh[t] + ',' + Bb.mesh[u], o = out.get(key);
              if (!o || o.d < d) out.set(key, { d, at: [(tb[0] + tb[3] + tb[6]) / 3, (tb[1] + tb[4] + tb[7]) / 3, (tb[2] + tb[5] + tb[8]) / 3] });   // B space
              if (d > maxD) maxD = d;
            }
          }
        }
        continue;
      }
      if (lb || (!la && a.C[ia] >= b.C[ib])) stack.push(a.L[ia], ib, a.R[ia], ib);
      else stack.push(ia, b.L[ib], ia, b.R[ib]);
    }
    return maxD;
  }

  // ---------- designed fits: the shaft's axis (longest side of its own bounding box) in its body, and in the host at p = 1 ----------
  const bodyOf = name => bodies.findIndex(b => b.name === name), FIT = [];
  for (const f of fits) {
    const [sb, sm] = f.shaft.split(':'), si = bodyOf(sb), hi = bodyOf(f.host);
    const m = bodies[si]?.meshes.find(x => x.name === sm);
    if (!m || hi < 0) throw new Error(`overlapScan: fit ${f.shaft} in ${f.host} names no mesh/body`);
    m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox, size = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
    const ax = [size.x, size.y, size.z].indexOf(Math.max(size.x, size.y, size.z)), d = new T.Vector3().setComponent(ax, size.getComponent(ax) / 2);
    const toBody = new T.Matrix4().copy(bodies[si].root.matrixWorld).invert().multiply(m.matrixWorld);   // posed at p = 1 above
    const ends = [c.clone().sub(d), c.clone().add(d)].map(p => p.applyMatrix4(toBody));
    const hostFromShaft = new T.Matrix4().copy(bodies[hi].root.matrixWorld).invert().multiply(bodies[si].root.matrixWorld);
    const home = ends.map(p => p.clone().applyMatrix4(hostFromShaft));
    FIT.push({ ...f, si, hi, shaftMesh: idOf(f.shaft), ends, home, dir: home[1].clone().sub(home[0]).normalize(), ranges: [], maxDev: 0, last: -2 });
  }
  const offAxis = (F, hostFromShaft) => Math.max(...F.ends.map(p => {   // distance of the shaft's axis ends from the home axis line
    const q = p.clone().applyMatrix4(hostFromShaft).sub(F.home[0]); return q.sub(F.dir.clone().multiplyScalar(q.dot(F.dir))).length();
  }));

  // ---------- scan ----------
  const W = bodies.map(() => new T.Matrix4()), Winv = bodies.map(() => new T.Matrix4()), M = new T.Matrix4();
  const visibleNow = b => { for (let o = b.root; o && o !== B.gl.bike.root; o = o.parent) if (!o.visible) return false; return true; };
  const pairs = []; for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) pairs.push([i, j]);
  const cache = new Map();                                 // pair -> { rel: Float64Array(16), hits: Map }
  const agg = new Map();                                   // "meshA|meshB" -> stats
  const corners = b => { const r = []; for (let i = 0; i < 8; i++) r.push(new T.Vector3(i & 1 ? b.box[3] : b.box[0], i & 2 ? b.box[4] : b.box[1], i & 4 ? b.box[5] : b.box[2])); return r; };
  const C8 = bodies.map(corners);
  let samples = 0, pairTests = 0;
  function sample(p) {
    B.pose(p); samples++;
    const st = B.state(p), vis = bodies.map(visibleNow);
    bodies.forEach((b, i) => { W[i].copy(b.root.matrixWorld); Winv[i].copy(W[i]).invert(); });
    for (const [i, j] of pairs) {
      if (!vis[i] || !vis[j]) continue;
      M.multiplyMatrices(Winv[j], W[i]);
      const key = i + ',' + j, c = cache.get(key);
      let hits;
      if (c && c.rel.every((x, k) => Math.abs(x - M.elements[k]) < 1e-12)) hits = c.hits;
      else { hits = new Map(); pairTests++; collide(bodies[i], bodies[j], M.elements, hits); cache.set(key, { rel: Float64Array.from(M.elements), hits }); }
      for (const [k, { d, at }] of hits) {
        const [ma, mb] = k.split(',').map(Number), name = [meshNames[ma], meshNames[mb]].sort().join(' | ');
        const F = FIT.find(f => (f.si === i && f.hi === j && f.shaftMesh === ma) || (f.si === j && f.hi === i && f.shaftMesh === mb));
        if (F) {                                          // a designed fit: record where, and how far the shaft is off its bore axis
          const hostFromShaft = F.si === i ? M.clone() : M.clone().invert(), dev = offAxis(F, hostFromShaft);
          if (dev > F.maxDev) { F.maxDev = dev; F.pAtMax = p; }
          if (F.last === samples) continue;               // one record per sample, whatever the host mesh
          const last = F.ranges[F.ranges.length - 1];
          if (last && F.last === samples - 1) last[1] = p; else F.ranges.push([p, p]);
          F.last = samples; continue;
        }
        const op = [bodies[i].part, bodies[j].part].map(id => +st.parts[id].opacity.toFixed(3));
        const s = agg.get(name) || { pairs: name, ranges: [], maxDepth: 0, pAtMax: p, opacityAtMax: op, n: 0 };
        s.n++;
        if (d > s.maxDepth) {                             // where: bike-frame mm (BB origin, x forward, y up, z drive side)
          const w = new T.Vector3(...at).applyMatrix4(W[j]); B.gl.bike.root.worldToLocal(w);
          Object.assign(s, { maxDepth: d, pAtMax: p, opacityAtMax: op, atMm: w.toArray().map(x => Math.round(x * 1000)) });
        }
        const last = s.ranges[s.ranges.length - 1];
        if (last && s.lastSample === samples - 1) last[1] = p; else s.ranges.push([p, p]);
        s.lastSample = samples; agg.set(name, s);
      }
    }
  }
  if (points) for (const p of points) sample(p);
  else {
    const at = p => { B.pose(p); return bodies.map(b => b.root.matrixWorld.clone()); };
    const moved = (m0, m1) => { let d = 0; bodies.forEach((b, i) => C8[i].forEach(c => { d = Math.max(d, c.clone().applyMatrix4(m0[i]).distanceTo(c.clone().applyMatrix4(m1[i]))); })); return d; };
    let p = from, h = maxStep, prev = at(p);
    for (;;) {
      sample(p);
      if (p >= to) break;
      h = Math.min(maxStep, h * 2);
      let q, cur;
      for (;;) { q = Math.min(to, p + h); cur = at(q); if (moved(prev, cur) <= maxMove || h < 1e-7) break; h /= 2; }
      p = q; prev = cur;
    }
  }
  B.pose(B.p.shown);
  const out = [...agg.values()].map(({ lastSample, ...s }) => ({ ...s, maxDepthMm: +(s.maxDepth * 1000).toFixed(2), ranges: s.ranges.map(r => r.map(x => +x.toFixed(5))) }))
    .map(({ maxDepth, ...s }) => s).sort((x, y) => y.maxDepthMm - x.maxDepthMm);
  const fitsOut = FIT.map(f => ({ shaft: f.shaft, host: f.host, ranges: f.ranges.map(r => r.map(x => +x.toFixed(5))), maxDeviationMm: +(f.maxDev * 1000).toFixed(4), pAtMax: f.pAtMax ?? null }));
  return { ms: Math.round(performance.now() - t0), samples, pairTests, bodies: bodies.map(b => ({ name: b.name, triangles: b.mesh.length })), overlaps: out, fits: fitsOut };
}
