/**
 * Shapes.js — 6 target point-cloud formations for ParticleField.
 *
 * Scroll journey:
 *   0  Globe       → hero         (elegant opening sphere)
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
    globe(count),        // 0 – hero
    lightBulb(count),    // 1 – pitch/video
    scatter(count),      // 2 – two-paths (disperse)
    gridField(count),    // 3 – ai-agents
    twoClusters(count),  // 4 – human-agents
    brain(count),        // 5 – final-cta (BUILD effect)
  ]
}

// ─── 0: Globe (Fibonacci sphere) ───────────────────────────────────────────
function globe (n) {
  const a  = new Float32Array(n * 3)
  const R  = 88
  const GR = Math.PI * (Math.sqrt(5) - 1)  // golden angle ≈ 2.399 rad
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
