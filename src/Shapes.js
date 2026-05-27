/**
 * Shapes.js — 6 target point-cloud formations for ParticleField.
 *
 * Scroll journey:
 *   0  SA Globe    → hero          (South America outline traced on globe)
 *   1  Light Bulb  → pitch         (rotational surface: bulb + neck + base)
 *   2  Scatter     → two-paths     (disperse / float freely in middle)
 *   3  Grid Field  → ai-agents     (circuit structure)
 *   4  Two Clusters → human-agents (paired orbs)
 *   5  Brain       → final-cta     (two-lobe silhouette, BUILD effect)
 *
 * Camera: z = 220, FOV = 55°  → visible half-height at z=0 ≈ 115 units.
 * Each function returns Float32Array(n * 3) — x, y, z interleaved.
 * z-axis compressed ~0.42 so shapes read clearly from front-facing camera.
 *
 * IMPORTANT: All recognisable shapes (saGlobe, lightBulb, brain) use ZERO
 * positional jitter — particles snap to exact surface positions. Spring
 * physics in ParticleField.js handles the "alive" feel.
 */

export function buildShapes (count) {
  return [
    saGlobe(count),      // 0 – hero (South America coastline + sparse globe)
    lightBulb(count),    // 1 – pitch/video
    scatter(count),      // 2 – two-paths (disperse)
    gridField(count),    // 3 – ai-agents
    twoClusters(count),  // 4 – human-agents
    brain(count),        // 5 – final-cta (BUILD effect)
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 0: SOUTH AMERICA GLOBE
// ═══════════════════════════════════════════════════════════════════════════
// Globe (R=88) oriented so South America faces the camera.
// Particle allocation:
//   55%  – traced evenly along the SA coastline polygon (crisp outline)
//   10%  – sparse fill inside SA (thin interior dots, makes continent feel solid)
//   35%  – fibonacci-distributed across the rest of the sphere (globe context)
function saGlobe (n) {
  const a = new Float32Array(n * 3)
  const R = 88

  // Y-axis rotation: brings lon=−60° (centre of SA) to face camera (+z).
  const ROT  = 150 * Math.PI / 180
  const cosR = Math.cos(ROT)
  const sinR = Math.sin(ROT)

  function project (lat_deg, lon_deg) {
    const lat = lat_deg * Math.PI / 180
    const lon = lon_deg * Math.PI / 180
    const x   = R * Math.cos(lat) * Math.cos(lon)
    const y   = R * Math.sin(lat)
    const z   = R * Math.cos(lat) * Math.sin(lon)
    return [
      x * cosR - z * sinR,
      y,
      (x * sinR + z * cosR) * 0.42,
    ]
  }

  // ── SA outline polygon [lon°, lat°] — clockwise from northern Colombia ─
  const SA = [
    [-73,12],[-67,11],[-63,11],[-62,10.5],[-60,11],[-59,11],
    [-61,9],[-60,8.5],[-58,7],[-57,6],[-57,4],
    [-53,3.5],[-51,4],[-50,2],[-49,0.5],
    [-48,-1.5],[-46,-2],[-44,-2.5],[-38,-4],[-35,-8],
    [-35,-11],[-37,-12],[-38.5,-16],[-39,-22],
    [-43,-23],[-47,-28],[-48,-29],[-51,-32],
    [-53,-34],[-54,-34],[-56,-35],[-58,-40],
    [-62,-46],[-65,-50],[-67,-54],[-70,-55],
    [-70,-52],[-74,-44],[-75,-42],[-73,-40],
    [-73,-36],[-71,-32],[-72,-30],[-70,-24],
    [-70,-18],[-75,-14],[-77,-10],[-80,-3],
    [-80,0],[-78,2],[-77,7],[-75,10],[-73,12],
  ]

  // Pre-compute segment lengths for even spacing along perimeter
  const segLens = []
  let perimeter = 0
  for (let i = 0; i < SA.length - 1; i++) {
    const dx = SA[i+1][0] - SA[i][0]
    const dy = SA[i+1][1] - SA[i][1]
    const len = Math.sqrt(dx*dx + dy*dy)
    segLens.push(len)
    perimeter += len
  }

  function inSA (lat, lon) {
    let inside = false
    const np = SA.length
    let j = np - 1
    for (let i = 0; i < np; i++) {
      const xi = SA[i][0], yi = SA[i][1]
      const xj = SA[j][0], yj = SA[j][1]
      if (((yi > lat) !== (yj > lat)) &&
          (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
      j = i
    }
    return inside
  }

  const nOutline = Math.floor(n * 0.55)   // crisp coastline
  const nFill    = Math.floor(n * 0.10)   // sparse interior
  const nGlobe   = n - nOutline - nFill   // sphere background

  let idx = 0

  // ── COASTLINE: trace evenly along perimeter ────────────────────────────
  for (let i = 0; i < nOutline; i++) {
    let d = (i / nOutline) * perimeter
    let seg = 0
    while (seg < segLens.length - 1 && d > segLens[seg]) {
      d -= segLens[seg]
      seg++
    }
    const localT = d / segLens[seg]
    const lon = SA[seg][0] + (SA[seg+1][0] - SA[seg][0]) * localT
    const lat = SA[seg][1] + (SA[seg+1][1] - SA[seg][1]) * localT
    const [px, py, pz] = project(lat, lon)
    a[idx*3]   = px
    a[idx*3+1] = py
    a[idx*3+2] = pz
    idx++
  }

  // ── INTERIOR FILL: sparse random inside polygon ────────────────────────
  let filled = 0
  while (filled < nFill) {
    const lat = -56 + Math.random() * 68
    const lon = -82 + Math.random() * 48
    if (!inSA(lat, lon)) continue
    const [px, py, pz] = project(lat, lon)
    a[idx*3]   = px
    a[idx*3+1] = py
    a[idx*3+2] = pz
    idx++
    filled++
  }

  // ── GLOBE CONTEXT: fibonacci sphere (skip SA region) ──────────────────
  const GR = Math.PI * (Math.sqrt(5) - 1)
  let placed = 0, attempt = 0
  while (placed < nGlobe && attempt < nGlobe * 4) {
    const seed = placed + attempt
    const u = 1 - (seed / (nGlobe * 1.15)) * 2   // ~-1 to +1 over loop
    const r_norm = Math.sqrt(Math.max(0, 1 - u*u))
    const phi = GR * seed

    // Direct 3D position on sphere
    const xS = R * r_norm * Math.cos(phi)
    const yS = R * u
    const zS = R * r_norm * Math.sin(phi)

    // Convert to lat/lon to test SA overlap
    const lat = Math.asin(u) * 180 / Math.PI
    const lonRaw = Math.atan2(zS, xS) * 180 / Math.PI
    attempt++

    // Skip if this point lands on SA (avoid double-density)
    if (lat > -57 && lat < 13) {
      // The point hasn't been rotated yet, so we need to figure out which lon
      // it would correspond to when we test against the unrotated SA polygon.
      // Since we rotate AFTER projection, the raw lon (atan2(zS, xS)) IS the
      // pre-rotation longitude. Test as-is.
      if (lonRaw > -83 && lonRaw < -33 && inSA(lat, lonRaw)) continue
    }

    // Apply rotation (same as project would do)
    const xRot = xS * cosR - zS * sinR
    const zRot = xS * sinR + zS * cosR

    a[idx*3]   = xRot
    a[idx*3+1] = yS
    a[idx*3+2] = zRot * 0.42
    idx++
    placed++
  }
  // Fallback if loop exited early
  while (idx < n) {
    const u = 1 - (placed / (nGlobe - 1)) * 2
    const r_norm = Math.sqrt(Math.max(0, 1 - u*u))
    const phi = GR * placed
    const xS = R * r_norm * Math.cos(phi)
    const yS = R * u
    const zS = R * r_norm * Math.sin(phi)
    a[idx*3]   = xS * cosR - zS * sinR
    a[idx*3+1] = yS
    a[idx*3+2] = (xS * sinR + zS * cosR) * 0.42
    idx++; placed++
  }

  return a
}

// ═══════════════════════════════════════════════════════════════════════════
// 1: LIGHT BULB
// ═══════════════════════════════════════════════════════════════════════════
// Rotational surface (revolved around y-axis), three regions:
//   65%  – Bulb: sphere section, R=55, centred at y=+20, top to neck transition
//   20%  – Neck: cylinder, r=12, y from −45 to −25
//   15%  – Base: cylinder, r=20, y from −65 to −45
// Bulb angle parameter spans 0 → 145° (top pole → neck shoulder).
// ZERO positional jitter — surface is exact.
function lightBulb (n) {
  const a     = new Float32Array(n * 3)
  const nBulb = Math.floor(n * 0.65)
  const nNeck = Math.floor(n * 0.20)
  const nBase = n - nBulb - nNeck

  // ── BULB: sphere section ───────────────────────────────────────────────
  const Rbulb  = 55
  const cyBulb = 20
  const angMax = Math.acos((-25 - cyBulb) / Rbulb)   // ≈ 2.534 rad (145°)

  for (let i = 0; i < nBulb; i++) {
    // Bias toward equator using sqrt to spread density more naturally
    const angle = angMax * Math.sqrt(Math.random())
    const theta = Math.random() * Math.PI * 2
    const r     = Rbulb * Math.sin(angle)
    const y     = cyBulb + Rbulb * Math.cos(angle)
    a[i*3]   = r * Math.cos(theta)
    a[i*3+1] = y
    a[i*3+2] = r * Math.sin(theta) * 0.42
  }

  // ── NECK: cylinder r=12, y from −45 to −25 ─────────────────────────────
  for (let i = 0; i < nNeck; i++) {
    const idx   = nBulb + i
    const theta = Math.random() * Math.PI * 2
    const y     = -25 - Math.random() * 20
    a[idx*3]   = 12 * Math.cos(theta)
    a[idx*3+1] = y
    a[idx*3+2] = 12 * Math.sin(theta) * 0.42
  }

  // ── BASE: cylinder r=20, y from −65 to −45 ─────────────────────────────
  for (let i = 0; i < nBase; i++) {
    const idx   = nBulb + nNeck + i
    const theta = Math.random() * Math.PI * 2
    const y     = -45 - Math.random() * 20
    a[idx*3]   = 20 * Math.cos(theta)
    a[idx*3+1] = y
    a[idx*3+2] = 20 * Math.sin(theta) * 0.42
  }

  return a
}

// ═══════════════════════════════════════════════════════════════════════════
// 2: SCATTER / FLOAT
// ═══════════════════════════════════════════════════════════════════════════
// Wide random dispersion (this is the ONE shape where jitter is the point).
function scatter (n) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i*3]   = (Math.random() - 0.5) * 380
    a[i*3+1] = (Math.random() - 0.5) * 240
    a[i*3+2] = (Math.random() - 0.5) * 110
  }
  return a
}

// ═══════════════════════════════════════════════════════════════════════════
// 3: CIRCUIT GRID
// ═══════════════════════════════════════════════════════════════════════════
// Regular grid with very small (±1.2) jitter so cells don't moiré.
function gridField (n) {
  const a    = new Float32Array(n * 3)
  const cols = Math.round(Math.sqrt(n * 2.3))
  const rows = Math.ceil(n / cols)
  const dx   = 250 / cols
  const dy   = 166 / rows
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    a[i*3]   = -125 + c * dx + (Math.random() - 0.5) * 1.2
    a[i*3+1] =  -83 + r * dy + (Math.random() - 0.5) * 1.2
    a[i*3+2] = (Math.random() - 0.5) * 18
  }
  return a
}

// ═══════════════════════════════════════════════════════════════════════════
// 4: TWO CLUSTERS
// ═══════════════════════════════════════════════════════════════════════════
// Two solid spheres at (∓72, ±22). Uniform-volume sample, no positional jitter.
function twoClusters (n) {
  const a    = new Float32Array(n * 3)
  const half = Math.floor(n * 0.5)
  for (let i = 0; i < n; i++) {
    const left  = i < half
    const cx    = left ? -72 : 72
    const cy    = left ?  22 : -22
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const rad   = 54 * Math.cbrt(Math.random())
    a[i*3]   = cx + rad * Math.sin(phi) * Math.cos(theta)
    a[i*3+1] = cy + rad * Math.cos(phi) * 0.82
    a[i*3+2] = rad * Math.sin(phi) * Math.sin(theta) * 0.48
  }
  return a
}

// ═══════════════════════════════════════════════════════════════════════════
// 5: BRAIN
// ═══════════════════════════════════════════════════════════════════════════
// Two spherical lobes with a single subtle wrinkle frequency.
// Visible cleft at x=±5. ZERO positional jitter.
function brain (n) {
  const a   = new Float32Array(n * 3)
  const R   = 55
  const cx  = 30

  function wrinkleR (cosP, theta) {
    const phi = Math.acos(Math.max(-1, Math.min(1, cosP)))
    return R * (1 + 0.07 * Math.sin(5 * phi) * Math.cos(7 * theta))
  }

  // Left lobe (centre at x = −cx) ─────────────────────────────────────────
  const nLeft = Math.floor(n * 0.5)
  let placed = 0
  while (placed < nLeft) {
    const cosP  = 2 * Math.random() - 1
    const sinP  = Math.sqrt(Math.max(0, 1 - cosP * cosP))
    const theta = Math.random() * Math.PI * 2
    const r     = wrinkleR(cosP, theta)
    const xW    = -cx + r * sinP * Math.cos(theta)
    if (xW > 5) continue                    // cleft

    a[placed*3]   = xW
    a[placed*3+1] = r * cosP * 0.85
    a[placed*3+2] = r * sinP * Math.sin(theta) * 0.50
    placed++
  }

  // Right lobe (centre at x = +cx) ────────────────────────────────────────
  const nRight = n - nLeft
  placed = 0
  while (placed < nRight) {
    const cosP  = 2 * Math.random() - 1
    const sinP  = Math.sqrt(Math.max(0, 1 - cosP * cosP))
    const theta = Math.random() * Math.PI * 2
    const r     = wrinkleR(cosP, theta)
    const xW    = cx + r * sinP * Math.cos(theta)
    if (xW < -5) continue

    const idx = nLeft + placed
    a[idx*3]   = xW
    a[idx*3+1] = r * cosP * 0.85
    a[idx*3+2] = r * sinP * Math.sin(theta) * 0.50
    placed++
  }

  return a
}
