/**
 * ParticleField.js — Dala-style 3D tumbling tetrahedra
 *
 * Architecture:
 *  · THREE.InstancedMesh with TetrahedronGeometry + wireframe
 *  · Per-instance gold colours via setColorAt
 *  · Spring-physics formation (scroll-continuous, NOT section-jump)
 *  · Mouse repulsion with z-axis turbulence
 *  · Per-particle tumble rotation (rvx / rvy / rvz)
 *  · FogExp2 for depth fade
 *  · Camera parallax with lerped mouse tracking
 */

import * as THREE from 'three'
import { buildShapes } from './Shapes.js'

const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent)
const COUNT = IS_MOBILE ? 440 : 940

const NUM_SHAPES = 6

// BACKO gold palette — 8 warm tones
const PALETTE = [
  0xE0B84F,  // classic gold
  0xF0C855,  // bright gold
  0xD4A840,  // warm gold
  0xFFD882,  // pale gold
  0xB8922A,  // deep amber
  0xC49B35,  // mid gold
  0xFFE09A,  // champagne
  0xA07828,  // dark amber
]

// Physics constants
const SPRING   = 0.019   // attraction toward shape target
const DECAY    = 0.87    // velocity damping each frame
const REPEL_R  = 62      // mouse repulsion radius (world units)
const REPEL_R2 = REPEL_R * REPEL_R
const REPEL_F  = 1.5     // peak repulsion force

export class ParticleField {
  constructor (canvas) {
    this._canvas = canvas
    this._setupRenderer()
    this._setupScene()
    this._setupMesh()
    this._setupBuffers()
    this._setupMouse()
    this._resize()
    window.addEventListener('resize', () => this._resize())
  }

  // ── Renderer ───────────────────────────────────────────────────────────────
  _setupRenderer () {
    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: false,
      alpha: true,                  // transparent bg → body black shows through
      powerPreference: 'high-performance',
    })
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  }

  // ── Scene, fog, camera ─────────────────────────────────────────────────────
  _setupScene () {
    this._scene = new THREE.Scene()
    this._scene.fog = new THREE.FogExp2(0x000000, 0.0020)

    this._camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1200)
    this._camera.position.set(0, 0, 220)

    // Smooth camera parallax state
    this._camTX = 0; this._camTY = 0   // targets
    this._camX  = 0; this._camY  = 0   // current (lerped)
  }

  // ── InstancedMesh ──────────────────────────────────────────────────────────
  _setupMesh () {
    const geo = new THREE.TetrahedronGeometry(1, 0)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.90,
    })

    this._mesh = new THREE.InstancedMesh(geo, mat, COUNT)
    this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this._scene.add(this._mesh)

    // Per-instance colour variation
    const col = new THREE.Color()
    for (let i = 0; i < COUNT; i++) {
      col.setHex(PALETTE[i % PALETTE.length])
      col.multiplyScalar(0.50 + Math.random() * 0.50)
      this._mesh.setColorAt(i, col)
    }
    this._mesh.instanceColor.needsUpdate = true

    // Per-instance scale: mix of tiny and larger
    this._scales = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      // Cube-root distribution → more small than large, but some big ones
      this._scales[i] = 1.2 + Math.pow(Math.random(), 1.4) * 4.0
    }

    // Reusable dummy for matrix computation
    this._dummy = new THREE.Object3D()
  }

  // ── Physics & rotation buffers ─────────────────────────────────────────────
  _setupBuffers () {
    // Positions
    this._px = new Float32Array(COUNT)
    this._py = new Float32Array(COUNT)
    this._pz = new Float32Array(COUNT)

    // Velocities
    this._vx = new Float32Array(COUNT)
    this._vy = new Float32Array(COUNT)
    this._vz = new Float32Array(COUNT)

    // Euler angles (tumble)
    this._rx = new Float32Array(COUNT)
    this._ry = new Float32Array(COUNT)
    this._rz = new Float32Array(COUNT)

    // Angular velocities — randomised per particle
    this._rvx = new Float32Array(COUNT)
    this._rvy = new Float32Array(COUNT)
    this._rvz = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      this._rvx[i] = (Math.random() - 0.5) * 0.042
      this._rvy[i] = (Math.random() - 0.5) * 0.046
      this._rvz[i] = (Math.random() - 0.5) * 0.024
      this._rx[i]  = Math.random() * Math.PI * 2
      this._ry[i]  = Math.random() * Math.PI * 2
      this._rz[i]  = Math.random() * Math.PI * 2
    }

    // Pre-build all 6 shape targets
    this._shapes = buildShapes(COUNT)

    // Seed initial positions from shape 0 (scatter)
    const s0 = this._shapes[0]
    for (let i = 0; i < COUNT; i++) {
      this._px[i] = s0[i*3]
      this._py[i] = s0[i*3+1]
      this._pz[i] = s0[i*3+2]
    }
  }

  // ── Mouse / touch interaction ──────────────────────────────────────────────
  _setupMouse () {
    // Mouse world position on z=0 plane
    this._mw = new THREE.Vector3(99999, 99999, 0)
    this._mouse2d = new THREE.Vector2(99999, 99999)
    this._raycaster = new THREE.Raycaster()
    this._plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)  // z = 0

    const onMove = (cx, cy) => {
      this._mouse2d.x =  (cx / innerWidth)  * 2 - 1
      this._mouse2d.y = -(cy / innerHeight) * 2 + 1
      // Camera parallax target
      this._camTX = this._mouse2d.x * 10
      this._camTY = this._mouse2d.y *  6
    }

    window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY), { passive: true })
    window.addEventListener('touchmove', e => {
      const t = e.touches[0]
      onMove(t.clientX, t.clientY)
    }, { passive: true })
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  _resize () {
    const W = innerWidth, H = innerHeight
    this._renderer.setSize(W, H, false)
    this._camera.aspect = W / H
    this._camera.updateProjectionMatrix()
  }

  // ── Main tick (called every rAF) ───────────────────────────────────────────
  tick () {
    this._updateMouse()
    this._updateParticles()
    this._updateCamera()
    this._renderer.render(this._scene, this._camera)
  }

  _updateMouse () {
    this._raycaster.setFromCamera(this._mouse2d, this._camera)
    this._raycaster.ray.intersectPlane(this._plane, this._mw)
  }

  _updateParticles () {
    // Scroll progress 0–1 → lerp between consecutive shapes
    const scroll = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
    const raw = Math.min(scroll * (NUM_SHAPES - 1), NUM_SHAPES - 1.001)
    const iA = Math.floor(raw)
    const iB = iA + 1
    const tl  = raw - iA

    const sA = this._shapes[iA]
    const sB = this._shapes[iB]

    const mx = this._mw.x
    const my = this._mw.y

    const dummy = this._dummy

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3

      // ── Shape target (lerp A→B) ──────────────────────
      const tx = sA[i3]   + (sB[i3]   - sA[i3])   * tl
      const ty = sA[i3+1] + (sB[i3+1] - sA[i3+1]) * tl
      const tz = sA[i3+2] + (sB[i3+2] - sA[i3+2]) * tl

      // ── Spring pull toward target ────────────────────
      let fx = (tx - this._px[i]) * SPRING
      let fy = (ty - this._py[i]) * SPRING
      let fz = (tz - this._pz[i]) * SPRING * 0.35  // lighter z spring

      // ── Mouse repulsion ──────────────────────────────
      const dx = this._px[i] - mx
      const dy = this._py[i] - my
      const d2 = dx * dx + dy * dy
      if (d2 < REPEL_R2) {
        const d   = Math.sqrt(d2) + 0.001
        const str = (1 - d / REPEL_R) * REPEL_F
        fx += (dx / d) * str
        fy += (dy / d) * str
        fz += (Math.random() - 0.5) * str * 1.4   // z turbulence → 3-D look
      }

      // ── Velocity integration ─────────────────────────
      this._vx[i] = (this._vx[i] + fx) * DECAY
      this._vy[i] = (this._vy[i] + fy) * DECAY
      this._vz[i] = (this._vz[i] + fz) * DECAY

      // ── Position integration ─────────────────────────
      this._px[i] += this._vx[i]
      this._py[i] += this._vy[i]
      this._pz[i] += this._vz[i]

      // ── Tumble rotation ──────────────────────────────
      this._rx[i] += this._rvx[i]
      this._ry[i] += this._rvy[i]
      this._rz[i] += this._rvz[i]

      // ── Instance matrix ──────────────────────────────
      dummy.position.set(this._px[i], this._py[i], this._pz[i])
      dummy.rotation.set(this._rx[i], this._ry[i], this._rz[i])
      dummy.scale.setScalar(this._scales[i])
      dummy.updateMatrix()
      this._mesh.setMatrixAt(i, dummy.matrix)
    }

    this._mesh.instanceMatrix.needsUpdate = true
  }

  _updateCamera () {
    // Smooth lerp toward mouse-driven parallax offset
    this._camX += (this._camTX - this._camX) * 0.055
    this._camY += (this._camTY - this._camY) * 0.055
    this._camera.position.x = this._camX
    this._camera.position.y = this._camY
    this._camera.lookAt(0, 0, 0)
  }
}
