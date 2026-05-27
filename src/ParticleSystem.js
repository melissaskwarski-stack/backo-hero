import * as THREE from 'three'
import {
  shape0_Globe, shape1_Constellation, shape2_TwoClusters,
  shape3_CircuitGrid, shape4_OrganicRing, shape5_GlobeReform,
  CONNECTION_THRESHOLDS, STATE_COLORS
} from './MorphShapes.js'

const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768
export const PARTICLE_COUNT = IS_MOBILE ? 180 : 320
const AMBIENT_COUNT = 100
const MAX_LINES = IS_MOBILE ? 200 : 600
const REPEL_DIST = 48

const SHAPE_FNS = [
  shape0_Globe, shape1_Constellation, shape2_TwoClusters,
  shape3_CircuitGrid, shape4_OrganicRing, shape5_GlobeReform
]

// Gold-spectrum particle colors
const GOLD_COLORS = [
  new THREE.Color(0xE0B84F), // gold
  new THREE.Color(0xF5F0E8), // cream
  new THREE.Color(0xFFF8F0), // warm white
  new THREE.Color(0x8A7030), // deep gold
]

const vertexShader = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;
    gl_PointSize = aSize * (200.0 / max(depth, 1.0));
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;
    float core = exp(-d * d * 9.0);
    float halo = exp(-d * d * 1.8) * 0.38;
    float alpha = (core + halo) * vAlpha;
    gl_FragColor = vec4(vColor * alpha, alpha);
  }
`

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    // Scene + Camera
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1200)
    this.camera.position.z = 145

    // Particle state arrays
    this.px = new Float32Array(PARTICLE_COUNT)
    this.py = new Float32Array(PARTICLE_COUNT)
    this.pz = new Float32Array(PARTICLE_COUNT)
    this.vx = new Float32Array(PARTICLE_COUNT)
    this.vy = new Float32Array(PARTICLE_COUNT)
    this.vz = new Float32Array(PARTICLE_COUNT)
    this.ox = new Float32Array(PARTICLE_COUNT) // orbit targets
    this.oy = new Float32Array(PARTICLE_COUNT)
    this.oz = new Float32Array(PARTICLE_COUNT)
    this.fromX = new Float32Array(PARTICLE_COUNT) // morph start snapshot
    this.fromY = new Float32Array(PARTICLE_COUNT)
    this.fromZ = new Float32Array(PARTICLE_COUNT)

    // Morph state
    this.currentState = 0
    this.morphing = false
    this.morphProgress = 0
    this.morphSpeed = 0.022
    this.state5Scale = 1.0

    // Connection threshold for current state
    this.connThreshold = CONNECTION_THRESHOLDS[0]

    // Mouse
    this.mouseX = 0
    this.mouseY = 0
    this.mouseWorldX = 0
    this.mouseWorldY = 0
    this.mouseSpeed = 0
    this._prevMouseX = 0
    this._prevMouseY = 0
    this.targetCamRotX = 0
    this.targetCamRotY = 0

    // Globe rotation for shapes 0 and 5
    this.globeRotY = 0

    this._buildParticles()
    this._buildAmbient()
    this._buildLines()
    this._bindEvents()

    // Start on shape 0
    this._applyShape(0)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.px[i] = this.ox[i]
      this.py[i] = this.oy[i]
      this.pz[i] = this.oz[i]
    }
  }

  _buildParticles() {
    const posArr = new Float32Array(PARTICLE_COUNT * 3)
    const sizeArr = new Float32Array(PARTICLE_COUNT)
    const colorArr = new Float32Array(PARTICLE_COUNT * 3)
    const alphaArr = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizeArr[i] = 0.6 + Math.random() * 1.8
      const c = GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)]
      colorArr[i * 3]     = c.r
      colorArr[i * 3 + 1] = c.g
      colorArr[i * 3 + 2] = c.b
      alphaArr[i] = 0.75 + Math.random() * 0.25
    }

    this._particleColorArr = colorArr

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colorArr, 3))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphaArr, 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.particleGeo = geo
    this.particleMesh = new THREE.Points(geo, mat)
    this.scene.add(this.particleMesh)
    this._posAttr = geo.getAttribute('position')
    this._colorAttr = geo.getAttribute('aColor')
  }

  _buildAmbient() {
    const posArr = new Float32Array(AMBIENT_COUNT * 3)
    const sizeArr = new Float32Array(AMBIENT_COUNT)
    const colorArr = new Float32Array(AMBIENT_COUNT * 3)
    const alphaArr = new Float32Array(AMBIENT_COUNT)
    this._ambVx = new Float32Array(AMBIENT_COUNT)
    this._ambVy = new Float32Array(AMBIENT_COUNT)
    this._ambVz = new Float32Array(AMBIENT_COUNT)

    for (let i = 0; i < AMBIENT_COUNT; i++) {
      posArr[i * 3]     = (Math.random() - 0.5) * 400
      posArr[i * 3 + 1] = (Math.random() - 0.5) * 300
      posArr[i * 3 + 2] = -80 + Math.random() * 60
      this._ambVx[i] = (Math.random() - 0.5) * 0.04
      this._ambVy[i] = (Math.random() - 0.5) * 0.04
      this._ambVz[i] = 0
      sizeArr[i] = 0.4 + Math.random() * 0.8
      const c = GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)]
      colorArr[i * 3]     = c.r
      colorArr[i * 3 + 1] = c.g
      colorArr[i * 3 + 2] = c.b
      alphaArr[i] = 0.25
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colorArr, 3))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphaArr, 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this._ambGeo = geo
    this._ambPosAttr = geo.getAttribute('position')
    this.scene.add(new THREE.Points(geo, mat))
  }

  _buildLines() {
    const posArr = new Float32Array(MAX_LINES * 2 * 3)
    const colorArr = new Float32Array(MAX_LINES * 2 * 3)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this._lineGeo = geo
    this._linePosAttr = geo.getAttribute('position')
    this._lineColorAttr = geo.getAttribute('color')
    this._lineMesh = new THREE.LineSegments(geo, mat)
    this.scene.add(this._lineMesh)

    // Per-particle connection count — reused each frame to avoid GC
    this._connCount = new Uint8Array(PARTICLE_COUNT)
  }

  _bindEvents() {
    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1
      this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1

      const dx = e.clientX - this._prevMouseX
      const dy = e.clientY - this._prevMouseY
      this.mouseSpeed = Math.sqrt(dx * dx + dy * dy)
      this._prevMouseX = e.clientX
      this._prevMouseY = e.clientY

      // Target camera rotation
      this.targetCamRotX = this.mouseY * 0.12
      this.targetCamRotY = this.mouseX * 0.18
    }, { passive: true })

    window.addEventListener('deviceorientation', (e) => {
      if (!IS_MOBILE) return
      this.targetCamRotX = (e.beta - 45) * 0.004
      this.targetCamRotY = e.gamma * 0.006
    }, { passive: true })

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  // ── Apply a new shape's target positions to ox/oy/oz ──
  _applyShape(stateIndex) {
    const fn = SHAPE_FNS[stateIndex]
    const targets = fn(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.ox[i] = targets[i * 3]
      this.oy[i] = targets[i * 3 + 1]
      this.oz[i] = targets[i * 3 + 2]
    }

    // Update connection threshold
    this.connThreshold = CONNECTION_THRESHOLDS[stateIndex]

    // Shift particle colors toward state color
    const sc = STATE_COLORS[stateIndex]
    const ca = this._particleColorArr
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const base = GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)]
      ca[i * 3]     = base.r * 0.6 + sc[0] * 0.4
      ca[i * 3 + 1] = base.g * 0.6 + sc[1] * 0.4
      ca[i * 3 + 2] = base.b * 0.6 + sc[2] * 0.4
    }
    this._colorAttr.needsUpdate = true
  }

  // ── Public: trigger morph to a new state ──
  triggerMorph(newState) {
    if (newState === this.currentState && !this.morphing) return
    this.currentState = newState

    // Snapshot current positions
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.fromX[i] = this.px[i]
      this.fromY[i] = this.py[i]
      this.fromZ[i] = this.pz[i]
    }

    // Generate new targets
    this._applyShape(newState)

    // State 5: globe reform starts small, grows to full
    this.state5Scale = newState === 5 ? 0.7 : 1.0
    this._state5TargetScale = 1.0

    this.morphing = true
    this.morphProgress = 0
  }

  // ── Ease in-out cubic ──
  _easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  // ── Unproject mouse to world plane z=0 ──
  _unprojectMouse() {
    const vec = new THREE.Vector3(this.mouseX, this.mouseY, 0.5)
    vec.unproject(this.camera)
    const dir = vec.sub(this.camera.position).normalize()
    const d = -this.camera.position.z / dir.z
    this.mouseWorldX = this.camera.position.x + dir.x * d
    this.mouseWorldY = this.camera.position.y + dir.y * d
  }

  tick() {
    // ── Camera rotation lerp ──
    if (!IS_MOBILE) {
      this.camera.rotation.x += (this.targetCamRotX - this.camera.rotation.x) * 0.04
      this.camera.rotation.y += (this.targetCamRotY - this.camera.rotation.y) * 0.04
    } else {
      this.camera.rotation.x += (this.targetCamRotX - this.camera.rotation.x) * 0.06
      this.camera.rotation.y += (this.targetCamRotY - this.camera.rotation.y) * 0.06
    }

    // ── Globe auto-rotate for states 0 and 5 ──
    if (this.currentState === 0 || this.currentState === 5) {
      this.globeRotY += 0.0007
    }

    // ── Morph progress ──
    if (this.morphing) {
      this.morphProgress = Math.min(1, this.morphProgress + this.morphSpeed)
      if (this.morphProgress >= 1) this.morphing = false

      // State 5 scale-up
      if (this.currentState === 5) {
        this.state5Scale += (this._state5TargetScale - this.state5Scale) * 0.018
      }
    }

    // ── Unproject mouse ──
    this._unprojectMouse()
    const mouseForce = Math.min(3.0, 1.0 + this.mouseSpeed * 0.018)
    this.mouseSpeed *= 0.88 // decay

    const { px, py, pz, vx, vy, vz, ox, oy, oz } = this

    // ── Update particle positions ──
    const ep = this._easeInOut(this.morphProgress)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Globe auto-rotation: rotate targets for states 0 and 5
      let targetX = ox[i], targetY = oy[i], targetZ = oz[i]
      if ((this.currentState === 0 || this.currentState === 5) && !this.morphing) {
        const cos = Math.cos(this.globeRotY)
        const sin = Math.sin(this.globeRotY)
        const rx = targetX * cos - targetZ * sin
        const rz = targetX * sin + targetZ * cos
        targetX = rx; targetZ = rz
      }

      // State 5 scale
      if (this.currentState === 5) {
        targetX *= this.state5Scale
        targetY *= this.state5Scale
        targetZ *= this.state5Scale
      }

      // Morph lerp
      if (this.morphing) {
        const mx = this.fromX[i] + (targetX - this.fromX[i]) * ep
        const my = this.fromY[i] + (targetY - this.fromY[i]) * ep
        const mz = this.fromZ[i] + (targetZ - this.fromZ[i]) * ep
        // Spring toward morph target
        vx[i] += (mx - px[i]) * 0.06
        vy[i] += (my - py[i]) * 0.06
        vz[i] += (mz - pz[i]) * 0.06
      } else {
        // Spring return to orbit target
        vx[i] += (targetX - px[i]) * 0.015
        vy[i] += (targetY - py[i]) * 0.015
        vz[i] += (targetZ - pz[i]) * 0.015
      }

      // Mouse repulsion
      const dx = px[i] - this.mouseWorldX
      const dy = py[i] - this.mouseWorldY
      const d2 = dx * dx + dy * dy
      if (d2 < REPEL_DIST * REPEL_DIST && d2 > 0.01) {
        const d = Math.sqrt(d2)
        const force = (1 - d / REPEL_DIST) * mouseForce * 0.9
        vx[i] += (dx / d) * force
        vy[i] += (dy / d) * force
        vz[i] += (dx / d) * force * 0.2 // small Z push for depth effect
      }

      // Circuit grid travelling wave (state 3)
      if (this.currentState === 3 && !this.morphing) {
        const cols = 14
        const row = Math.floor(i / cols)
        const wave = Math.sin(performance.now() * 0.002 + row * 0.95) * 0.15
        vy[i] += wave
      }

      // Organic ring swirl (state 4)
      if (this.currentState === 4 && !this.morphing) {
        const swirl = 0.00005
        const nx = px[i] * Math.cos(swirl) - py[i] * Math.sin(swirl)
        const ny = px[i] * Math.sin(swirl) + py[i] * Math.cos(swirl)
        vx[i] += (nx - px[i]) * 0.08
        vy[i] += (ny - py[i]) * 0.08
      }

      // Velocity decay
      vx[i] *= 0.86
      vy[i] *= 0.86
      vz[i] *= 0.86

      // Integrate
      px[i] += vx[i]
      py[i] += vy[i]
      pz[i] += vz[i]

      // Write to geometry
      this._posAttr.array[i * 3]     = px[i]
      this._posAttr.array[i * 3 + 1] = py[i]
      this._posAttr.array[i * 3 + 2] = pz[i]
    }
    this._posAttr.needsUpdate = true

    // ── Update ambient background dots ──
    const ambPos = this._ambPosAttr.array
    const avx = this._ambVx, avy = this._ambVy
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      ambPos[i * 3]     += avx[i]
      ambPos[i * 3 + 1] += avy[i]
      if (Math.abs(ambPos[i * 3]) > 200) avx[i] *= -1
      if (Math.abs(ambPos[i * 3 + 1]) > 150) avy[i] *= -1
    }
    this._ambPosAttr.needsUpdate = true

    // ── Update connection lines ──
    this._updateLines()

    this.renderer.render(this.scene, this.camera)
  }

  _updateLines() {
    const linePosArr = this._linePosAttr.array
    const lineColArr = this._lineColorAttr.array
    const thresh = this.connThreshold
    const thresh2 = thresh * thresh
    const minDist2 = 5 * 5 // skip connections between particles that are almost overlapping (pole clustering)
    const MAX_CONN = 7    // max connections per particle — prevents pole starburst
    let lineCount = 0

    this._connCount.fill(0)

    for (let i = 0; i < PARTICLE_COUNT && lineCount < MAX_LINES; i++) {
      if (this._connCount[i] >= MAX_CONN) continue
      for (let j = i + 1; j < PARTICLE_COUNT && lineCount < MAX_LINES; j++) {
        if (this._connCount[j] >= MAX_CONN) continue
        const dx = this.px[i] - this.px[j]
        const dy = this.py[i] - this.py[j]
        const dz = this.pz[i] - this.pz[j]
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 > minDist2 && d2 < thresh2) {
          const base = lineCount * 6
          linePosArr[base]     = this.px[i]
          linePosArr[base + 1] = this.py[i]
          linePosArr[base + 2] = this.pz[i]
          linePosArr[base + 3] = this.px[j]
          linePosArr[base + 4] = this.py[j]
          linePosArr[base + 5] = this.pz[j]

          // Color: average of both particles' colors
          const ci = this._particleColorArr
          const r = (ci[i * 3] + ci[j * 3]) * 0.5
          const g = (ci[i * 3 + 1] + ci[j * 3 + 1]) * 0.5
          const b = (ci[i * 3 + 2] + ci[j * 3 + 2]) * 0.5
          lineColArr[base]     = r; lineColArr[base + 1] = g; lineColArr[base + 2] = b
          lineColArr[base + 3] = r; lineColArr[base + 4] = g; lineColArr[base + 5] = b

          this._connCount[i]++
          this._connCount[j]++
          lineCount++
        }
      }
    }

    this._lineGeo.setDrawRange(0, lineCount * 2)
    this._linePosAttr.needsUpdate = true
    this._lineColorAttr.needsUpdate = true
  }
}
