---
name: instanced-spokes
description: Build bicycle wheel spokes (radial or n-cross lacing) as one InstancedMesh per wheel from hub-flange and rim points, with correct bounds. Use for procedural wheels in three.js or any many-identical-rods-between-points case.
---

# Instanced spokes

1. **One unit geometry, shared:** `new CylinderGeometry(r, r, 1, 5, 1, true)`, along +y with height 1.
2. **Endpoints per spoke,** in the wheel's local frame (wheel plane XY, axle z):
   - hub point `(rf*cos(t), rf*sin(t), zFlange)`
   - rim point `(rr*cos(f), rr*sin(f), +-0.002)`, alternating sides
   - per side, N/2 spokes with t_k = k * 2pi / (N/2), the second side offset by half a step
   - **radial:** f = t
   - **c-cross:** f = t +- c * 720deg / N, alternating the sign spoke to spoke (2-cross on 24 spokes is +-60deg)
3. **Matrix** from a to b: `d = b - a`, `len = |d|`, `mid = a + d/2`,
   `q = setFromUnitVectors((0,1,0), normalize(d))`, `scale = (1, len, 1)`, `m.compose(mid, q, scale)`.
4. Use `new InstancedMesh(geo, sharedSteel, count)` → `setMatrixAt` → `instanceMatrix.needsUpdate = true`,
   **then `computeBoundingSphere()` and `computeBoundingBox()`.** Without these, culling and
   `Box3.setFromObject` use the unit geometry and get the size wrong.
5. Put the InstancedMesh inside the wheel's `spin` group, so spinning the wheel spins all spokes at
   no per-spoke cost. One draw call per wheel.
6. The same pattern serves a chain: links placed by arc length along a polyline, rotated with
   `atan2` of the tangent. Route the polyline with exact tangent lines between circles, using a
   signed radius: positive for counter-clockwise wrap, negative for clockwise.

Verify by counting `isInstancedMesh` objects and their `count` (24 per wheel), and by checking the
tyre's bounding box against the rim spec (BSD + 2 x tyre width).
