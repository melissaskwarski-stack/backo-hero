/**
 * Shapes.js — 6 target point-cloud formations for ParticleField.
 *
 * Scroll journey:
 *   0  SA Globe    → hero         (South America facing camera — BACKO's home)
 *   1  Light Bulb  → pitch        (AI = illumination)
 *   2  Scatter     → two-paths    (disperse / float freely in middle)
 *   3  Grid Field  → ai-agents    (circuit structure)
 *   4  Two Clusters → human-agents (paired orbs)
 *   5  Brain       → final-cta   (dramatic BUILD: particles fly inward)
 *
 * Camera: z = 220, FOV = 55°  → visible half-height at z=0 ≈ 115 units.
 * Each function returns Float32Array(n * 3) — x, y, z interleaved.
 * z-axis compressed ~0.42 so shapes read clearly from a front-facing camera.
 */

export function buildShapes (count) {
  return [
    saGlobe(count),      // 0 – hero (South America prominent)
    lightBulb(count),    // 1 – pitch/video
    scatter(count),      // 2 – two-paths (disperse)
    gridField(count),    // 3 – ai-agents
    twoClusters(count),  // 4 – human-agents
    brain(count),        // 5 – final-cta (BUILD effect)
  ]
}

// ─── 0: South America Globe ────────────────────────────────────────────────
// Full globe (R=88) oriented so South America faces the camera.
// 58 % of particles land on the South American landmass → continent is
// visibly denser than the surrounding ocean / rest of Earth.
// Geographic rotation: Y-axis +150° brings lon=−60° (SA centre) to +z.
function saGlobe (n) {
  const a = new Float32Array(n * 3)
  const R = 88

  // ── Y-axis rotation to face South America toward camera ──────────────────
  // Verified: point (lat=0, lon=−60°) → x'=0, z'=+R after this rotation.
  const ROT  = 150 * Math.PI / 180   // 150 degrees
  const cosR = Math.cos(ROT)          // −0.866
  const sinR = Math.sin(ROT)          // +0.500

  function project (lat_deg, lon_deg) {
    const lat = lat_deg * Math.PI / 180
    const lon = lon_deg * Math.PI / 180
    const x   = R * Math.cos(lat) * Math.cos(lon)
    const y   = R * Math.sin(lat)
    const z   = R * Math.cos(lat) * Math.sin(lon)
    // Standard Y-axis rotation: x′ = x·cos−z·sin, z′ = x·sin+z·cos
    return [
      x * cosR - z * sinR,
      y,
      (x * sinR + z * cosR) * 0.42,   // z-compress for front-facing camera
    ]
  }

  // ── Simplified South America outline polygon [lon°, lat°] ─────────────────
  // ~54 vertices, clockwise from northernmost Colombia, verified non-self-intersecting.
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

  // Point-in-polygon — ray casting (ray in +lon direction)
  function inSA (lat, lon) {
    let inside = false
    const np = SA.length
    let j = np - 1
    for (let i = 0; i < np; i++) {
      const xi = SA[i][0], yi = SA[i][1]   // polygon lon, lat
      const xj = SA[j][0], yj = SA[j][1]
      if (((yi > lat) !== (yj > lat)) &&
          (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
      j = i
    }
    return inside
  }

  const nSA    = Math.floor(n * 0.58)  // 58 % dense on SA continent
  const nGlobe = n - nSA               // 42 % spread across rest of globe

  let idx = 0

  // ── South America particles ───────────────────────────────────────────────
  // Rejection-sample in SA bounding box; ~73 % fill rate → ~1.37 avg attempts
  while (idx < nSA) {
    const lat = -56 + Math.random() * 68   // bounding box lat [−56 → +12]
    const lon = -82 + Math.random() * 48   // bounding box lon [−82 → −34]
    if (!inSA(lat, lon)) continue
    const [px, py, pz] = project(lat, lon)
    a[idx*3]   = px + (Math.random() - 0.5) * 4
    a[idx*3+1] = py + (Math.random() - 0.5) * 4
    a[idx*3+2] = pz + (Math.random() - 0.5) * 2
    idx++
  }

  // ── Rest of globe ─────────────────────────────────────────────────────────
  // Proper uniform sphere surface sampling via asin (area-weighted latitude).
  let placed = 0
  while (placed < nGlobe) {
    const lat = Math.asin(2 * Math.random() - 1) * (180 / Math.PI)
    const lon = -180 + Math.random() * 360
    // Skip SA region to avoid over-crowding
    if (lat > -57 && lat < 13 && lon > -83 && lon < -33 && inSA(lat, lon)) continue
    const [px, py, pz] = project(lat, lon)
    a[idx*3]   = px + (Math.random() - 0.5) * 3
    a[idx*3+1] = py + (Math.random() - 0.5) * 3
    a[idx*3+2] = pz + (Math.random() - 0.5) * 2
    idx++
    placed++
  }

  return a
}

// ─── (plain globe helper, kept for reference) ──────────────────────────────
function globe (n) {
  const a  = new Float32Array(n * 3)
  const R  = 88
  const GR = Math.PI * (Math.sqrt(5) - 1)
  for (let i = 0; i < n; i++) {
    const y     = 1 - (i / (n - 1)) * 2
    const r     = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GR * i
    a[i*3]   = R * r * Math.cos(theta)
    a[i*3+1] = R * y
    a[i*3+2] = R * r * Math.sin(theta) * 0.42
  }
  return a
}

// ─── 1: Light Bulb ─────────────────────────────────────────────────────────
// Three regions: bulb (spherical cap, R=65), neck (cylinder r=14), base (cylinder r=18).
// No rejection loops — inverse-CDF for uniform surface area in bulb.
function lightBulb (n) {
  const a     = new Float32Array(n * 3)
  const nBulb = Math.floor(n * 0.65)
  const nNeck = Math.floor(n * 0.20)
  const nBase = n - nBulb - nNeck

  // ── Bulb: spherical cap, R=65, centre y=+15 ─────────────────────────────
  // Cuts off at y=−28 (where neck starts).
  // cosMin = (neckTop − cy) / R = (−28 − 15) / 65 ≈ −0.6615
  // Inverse-CDF: cosP ∈ [cosMin, 1] → exact surface-area weighting.
  const R_bulb  = 65
  const cy_bulb = 15
  const cosMin  = (-28 - cy_bulb) / R_bulb   // ≈ −0.6615

  for (let i = 0; i < nBulb; i++) {
    const cosP  = 1 + (cosMin - 1) * Math.random()
    const sinP  = Math.sqrt(Math.max(0, 1 - cosP * cosP))
    const theta = Math.random() * Math.PI * 2
    a[i*3]   = R_bulb * sinP * Math.cos(theta) + (Math.random() - 0.5) * 5
    a[i*3+1] = R_bulb * cosP + cy_bulb         + (Math.random() - 0.5) * 5
    a[i*3+2] = R_bulb * sinP * Math.sin(theta) * 0.42 + (Math.random() - 0.5) * 4
  }

  // ── Neck: cylinder r=14, y from −45 to −28 ──────────────────────────────
  for (let i = 0; i < nNeck; i++) {
    const idx   = nBulb + i
    const theta = Math.random() * Math.PI * 2
    a[idx*3]   = 14 * Math.cos(theta) + (Math.random() - 0.5) * 4
    a[idx*3+1] = -45 + Math.random() * 17 + (Math.random() - 0.5) * 3
    a[idx*3+2] = 14 * Math.sin(theta) * 0.42 + (Math.random() - 0.5) * 3
  }

  // ── Base: cylinder r=18, y from −68 to −50 ──────────────────────────────
  for (let i = 0; i < nBase; i++) {
    const idx   = nBulb + nNeck + i
    const theta = Math.random() * Math.PI * 2
    a[idx*3]   = 18 * Math.cos(theta) + (Math.random() - 0.5) * 4
    a[idx*3+1] = -68 + Math.random() * 18 + (Math.random() - 0.5) * 3
    a[idx*3+2] = 18 * Math.sin(theta) * 0.42 + (Math.random() - 0.5) * 3
  }

  return a
}

// ─── 2: Scatter / Float ────────────────────────────────────────────────────
// Wide random dispersion — particles look like they're floating freely.
function scatter (n) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i*3]   = (Math.random() - 0.5) * 380
    a[i*3+1] = (Math.random() - 0.5) * 240
    a[i*3+2] = (Math.random() - 0.5) * 110
  }
  return a
}

// ─── 3: Circuit grid ───────────────────────────────────────────────────────
function gridField (n) {
  const a    = new Float32Array(n * 3)
  const cols = Math.round(Math.sqrt(n * 2.3))
  const rows = Math.ceil(n / cols)
  const dx   = 250 / cols
  const dy   = 166 / rows
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    a[i*3]   = -125 + c * dx + (Math.random() - 0.5) * 5.5
    a[i*3+1] =  -83 + r * dy + (Math.random() - 0.5) * 5.5
    a[i*3+2] = (Math.random() - 0.5) * 28
  }
  return a
}

// ─── 4: Two clusters ───────────────────────────────────────────────────────
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

// ─── 5: Brain ──────────────────────────────────────────────────────────────
// Two connected lobes with sinusoidal wrinkle bumps (brain folds).
// Cleft enforced via rejection: ~20% rejection rate, <1.25 avg iterations.
// Centred at origin, lobes at x = ±32.
// y × 0.88, z × 0.52 compression for natural forward-facing read.
//
// Build effect: previous shape (two-clusters or scatter) is wide/spread,
// so morphing HERE pulls every particle dramatically inward → assembly look.
function brain (n) {
  const a          = new Float32Array(n * 3)
  const R          = 60          // lobe radius (with wrinkle peaks ≈ ×1.28 → 77)
  const cx         = 34          // lobe-centre offset from world origin
  const cleftLimit = 6           // world-x gap: particles must not cross ±6

  // Wrinkle scale factor: three-frequency sinusoidal bumps
  function wrinkleFactor (cosP, theta) {
    const phi = Math.acos(Math.max(-1, Math.min(1, cosP)))
    return 1
      + 0.15 * Math.sin(5  * phi) * Math.cos(6  * theta)
      + 0.09 * Math.sin(10 * phi) * Math.cos(11 * theta)
      + 0.05 * Math.sin(16 * phi) * Math.cos(19 * theta)
  }

  // ── Left lobe (centre at x = −cx) ────────────────────────────────────────
  const nLeft = Math.floor(n * 0.5)
  let placed  = 0
  while (placed < nLeft) {
    const cosP  = 2 * Math.random() - 1
    const sinP  = Math.sqrt(Math.max(0, 1 - cosP * cosP))
    const theta = Math.random() * Math.PI * 2
    const r     = R * wrinkleFactor(cosP, theta)
    const xW    = -cx + r * sinP * Math.cos(theta)

    if (xW > cleftLimit) continue                   // cut cleft

    const idx = placed
    a[idx*3]   = xW                              + (Math.random() - 0.5) * 5
    a[idx*3+1] = r * cosP * 0.88                + (Math.random() - 0.5) * 5
    a[idx*3+2] = r * sinP * Math.sin(theta) * 0.52 + (Math.random() - 0.5) * 5
    placed++
  }

  // ── Right lobe (centre at x = +cx) ───────────────────────────────────────
  const nRight = n - nLeft
  placed = 0
  while (placed < nRight) {
    const cosP  = 2 * Math.random() - 1
    const sinP  = Math.sqrt(Math.max(0, 1 - cosP * cosP))
    const theta = Math.random() * Math.PI * 2
    const r     = R * wrinkleFactor(cosP, theta)
    const xW    = cx + r * sinP * Math.cos(theta)

    if (xW < -cleftLimit) continue                  // cut cleft

    const idx = nLeft + placed
    a[idx*3]   = xW                              + (Math.random() - 0.5) * 5
    a[idx*3+1] = r * cosP * 0.88                + (Math.random() - 0.5) * 5
    a[idx*3+2] = r * sinP * Math.sin(theta) * 0.52 + (Math.random() - 0.5) * 5
    placed++
  }

  return a
}
