/**
 * Shapes.js — 6 target point-cloud formations for ParticleField.
 * Each returns a Float32Array of length count*3 (x, y, z interleaved).
 * Coordinates are in world-space units; camera sits at z=220, FOV=55.
 * Visible half-height at z=0 ≈ 115 units.
 */

export function buildShapes (count) {
  return [
    scatter(count),       // 0 – hero: wide dispersion fills viewport
    globe(count),         // 1 – pitch: fibonacci sphere
    twoClusters(count),   // 2 – two-paths: AI vs Human orbs
    gridField(count),     // 3 – ai-agents: circuit grid
    torusRing(count),     // 4 – human-agents: orbital ring
    vortex(count),        // 5 – final-cta: corkscrew converging up
  ]
}

// ─── 0: Scatter ────────────────────────────────────────────────────────────
// Particles scattered across full viewport — chaotic / open
function scatter (n) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a[i*3]   = (Math.random() - 0.5) * 380   // ±190 — slightly wider than viewport
    a[i*3+1] = (Math.random() - 0.5) * 240   // ±120
    a[i*3+2] = (Math.random() - 0.5) * 110   // depth
  }
  return a
}

// ─── 1: Globe (Fibonacci sphere) ───────────────────────────────────────────
function globe (n) {
  const a = new Float32Array(n * 3)
  const R = 88
  const GR = Math.PI * (Math.sqrt(5) - 1)  // golden angle ≈ 2.399 rad
  for (let i = 0; i < n; i++) {
    const y    = 1 - (i / (n - 1)) * 2
    const r    = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = GR * i
    a[i*3]   = R * r * Math.cos(theta)
    a[i*3+1] = R * y
    a[i*3+2] = R * r * Math.sin(theta)
  }
  return a
}

// ─── 2: Two clusters ───────────────────────────────────────────────────────
function twoClusters (n) {
  const a = new Float32Array(n * 3)
  const half = Math.floor(n * 0.5)
  for (let i = 0; i < n; i++) {
    const left  = i < half
    const cx = left ? -72 : 72
    const cy = left ?  22 : -22
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)
    const rad   = 54 * Math.cbrt(Math.random())   // uniform in sphere
    a[i*3]   = cx + rad * Math.sin(phi) * Math.cos(theta)
    a[i*3+1] = cy + rad * Math.cos(phi) * 0.82
    a[i*3+2] = rad * Math.sin(phi) * Math.sin(theta) * 0.48
  }
  return a
}

// ─── 3: Circuit grid ───────────────────────────────────────────────────────
function gridField (n) {
  const a = new Float32Array(n * 3)
  const cols = Math.round(Math.sqrt(n * 2.3))
  const rows = Math.ceil(n / cols)
  const dx = 250 / cols
  const dy = 166 / rows
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    a[i*3]   = -125 + c * dx + (Math.random() - 0.5) * 5.5
    a[i*3+1] =  -83 + r * dy + (Math.random() - 0.5) * 5.5
    a[i*3+2] = (Math.random() - 0.5) * 30
  }
  return a
}

// ─── 4: Torus ring ─────────────────────────────────────────────────────────
// Flat ellipse-ish ring (foreshortened in z so it looks angled)
function torusRing (n) {
  const a = new Float32Array(n * 3)
  const R = 84    // major radius
  const r = 16    // tube radius
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2
    const phi   = Math.random() * Math.PI * 2
    const rr    = r * Math.sqrt(Math.random())  // uniform in disc
    a[i*3]   = (R + rr * Math.cos(phi)) * Math.cos(theta)
    a[i*3+1] = rr * Math.sin(phi) * 0.45          // flatten
    a[i*3+2] = (R + rr * Math.cos(phi)) * Math.sin(theta) * 0.38
  }
  return a
}

// ─── 5: Vortex / corkscrew ─────────────────────────────────────────────────
function vortex (n) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const t     = i / n                          // 0 → 1
    const angle = t * Math.PI * 9.5              // 4.75 rotations
    const rad   = (1 - t) * 92 + 5              // wide → tight at top
    a[i*3]   = rad * Math.cos(angle) + (Math.random() - 0.5) * 9
    a[i*3+1] = (t - 0.5) * 180 + (Math.random() - 0.5) * 8
    a[i*3+2] = rad * Math.sin(angle) * 0.42 + (Math.random() - 0.5) * 9
  }
  return a
}
