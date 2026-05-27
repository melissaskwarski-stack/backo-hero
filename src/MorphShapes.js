// ── MORPH SHAPE GENERATORS ──
// Each function returns a flat Float32Array of [x,y,z, x,y,z, ...] target positions

function fibSphere(count, radius) {
  const out = new Float32Array(count * 3)
  const phi = Math.PI * (Math.sqrt(5) - 1) // golden angle
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = phi * i
    out[i * 3]     = radius * r * Math.cos(theta)
    out[i * 3 + 1] = radius * y
    out[i * 3 + 2] = radius * r * Math.sin(theta)
  }
  return out
}

// Shape 0: Hub Globe — uniform sphere, radius 52
export function shape0_Globe(count) {
  return fibSphere(count, 52)
}

// Shape 1: Constellation — wide flat scatter, long sparse connections
export function shape1_Constellation(count) {
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    out[i * 3]     = (Math.random() - 0.5) * 190
    out[i * 3 + 1] = (Math.random() - 0.5) * 84
    out[i * 3 + 2] = (Math.random() - 0.5) * 60
  }
  return out
}

// Shape 2: Two Clusters — left AI cluster + right Human cluster
export function shape2_TwoClusters(count) {
  const out = new Float32Array(count * 3)
  const half = Math.floor(count / 2)
  for (let i = 0; i < count; i++) {
    if (i < half) {
      // Left cluster (AI): tight, center -46
      out[i * 3]     = -46 + (Math.random() - 0.5) * 44
      out[i * 3 + 1] = (Math.random() - 0.5) * 44
      out[i * 3 + 2] = (Math.random() - 0.5) * 44
    } else {
      // Right cluster (Human): looser, center +46
      out[i * 3]     = 46 + (Math.random() - 0.5) * 56
      out[i * 3 + 1] = (Math.random() - 0.5) * 56
      out[i * 3 + 2] = (Math.random() - 0.5) * 56
    }
  }
  return out
}

// Shape 3: Circuit Grid — 14-column grid, mostly flat
export function shape3_CircuitGrid(count) {
  const out = new Float32Array(count * 3)
  const cols = 14
  const rows = Math.ceil(count / cols)
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    out[i * 3]     = -72 + (col / Math.max(cols - 1, 1)) * 144
    out[i * 3 + 1] = rows > 1 ? -40 + (row / (rows - 1)) * 80 : 0
    out[i * 3 + 2] = (Math.random() - 0.5) * 12
  }
  return out
}

// Shape 4: Organic Ring — ellipse with heavy scatter, warm + human
export function shape4_OrganicRing(count) {
  const out = new Float32Array(count * 3)
  const rx = 55, ry = 38
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
    out[i * 3]     = rx * Math.cos(angle) + (Math.random() - 0.5) * 36
    out[i * 3 + 1] = ry * Math.sin(angle) + (Math.random() - 0.5) * 36
    out[i * 3 + 2] = (Math.random() - 0.5) * 56
  }
  return out
}

// Shape 5: Globe Reform — same sphere geometry, particles converge back
export function shape5_GlobeReform(count) {
  return fibSphere(count, 52)
}

// Connection thresholds per state
export const CONNECTION_THRESHOLDS = [58, 95, 42, 36, 65, 58]

// Target colors per state (gold spectrum shift per shape)
// [r, g, b] normalized
export const STATE_COLORS = [
  [0.878, 0.722, 0.310], // 0: gold #E0B84F
  [0.961, 0.843, 0.471], // 1: bright gold #F5D778
  [0.878, 0.722, 0.310], // 2: gold
  [1.000, 0.875, 0.471], // 3: bright fast gold
  [0.961, 0.941, 0.910], // 4: cream #F5F0E8
  [0.878, 0.722, 0.310], // 5: gold
]
