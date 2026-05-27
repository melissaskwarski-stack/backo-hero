/**
 * ParticleField.js — Dala-style 3D tumbling tetrahedra + ambient dust + floating balls
 *
 * Three visual layers (all in the same Three.js scene):
 *
 *  1. Tetrahedra (InstancedMesh, TetrahedronGeometry wireframe)
 *     • Spring-physics formation — morphs between 6 shapes on scroll
 *     • Mouse repulsion with z-axis turbulence
 *     • Per-particle tumble rotation
 *
 *  2. Dust (Points, PointsMaterial)
 *     • ~280 tiny particles far behind the formation
 *     • Constant slow drift, wraps at boundaries
 *     • Adds depth / atmosphere
 *
 *  3. Balls (InstancedMesh, SphereGeometry, solid)
 *     • ~130 small round particles scattered through the scene
 *     • Gentle random-walk drift — no spring morphing
 *     • Adds variety alongside the angular tetrahedra
 */

import * as THREE from 'three'
import { buildShapes } from './Shapes.js'

const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent)

// ── Particle counts ─────────────────────────────────────────────────────────
const COUNT      = IS_MOBILE ?  800 : 1800    // tetrahedra (high density for crisp shapes)
const DUST_COUNT = IS_MOBILE ?  100 :  240    // background dust points
const BALL_COUNT = IS_MOBILE ?   40 :  100    // small floating balls

const NUM_SHAPES = 6

// ── BACKO gold palette ──────────────────────────────────────────────────────
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

// ── Tetrahedra physics ──────────────────────────────────────────────────────
// SPRING up 3× → particles snap to shape decisively
// DECAY lowered → more damping, fewer wobbles after settling
const SPRING   = 0.058
const DECAY    = 0.82
const REPEL_R  = 62
const REPEL_R2 = REPEL_R * REPEL_R
const REPEL_F  = 1.8

export class ParticleField {
  constructor (canvas) {
    this._canvas = canvas
    this._setupRenderer()
    this._setupScene()
    this._setupMesh()       // tetrahedra
    this._setupDust()       // background dust
    this._setupBalls()      // floating small balls
    this._setupBuffers()    // tetrahedra physics buffers
    this._setupMouse()
    this._resize()
    window.addEventListener('resize', () => this._resize())
  }

  // ── Renderer ───────────────────────────────────────────────────────────────
  _setupRenderer () {
    this._renderer = new THREE.WebGLRenderer({
      canvas: this._canvas,
      antialias: false,
      alpha: true,
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

    this._camTX = 0; this._camTY = 0
    this._camX  = 0; this._camY  = 0

    this._dummy = new THREE.Object3D()   // reused for all InstancedMesh updates
  }

  // ── Tetrahedra InstancedMesh ───────────────────────────────────────────────
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

    const col = new THREE.Color()
    for (let i = 0; i < COUNT; i++) {
      col.setHex(PALETTE[i % PALETTE.length])
      col.multiplyScalar(0.50 + Math.random() * 0.50)
      this._mesh.setColorAt(i, col)
    }
    this._mesh.instanceColor.needsUpdate = true

    // Per-instance scale: smaller range — at high density, large tetrahedra
    // would smudge the crisp shape silhouettes.
    this._scales = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      this._scales[i] = 0.9 + Math.pow(Math.random(), 1.6) * 2.4
    }
  }

  // ── Background dust (Points) ───────────────────────────────────────────────
  _setupDust () {
    this._dustPos = new Float32Array(DUST_COUNT * 3)
    this._dustVel = new Float32Array(DUST_COUNT * 3)

    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3
      this._dustPos[i3]   = (Math.random() - 0.5) * 560
      this._dustPos[i3+1] = (Math.random() - 0.5) * 360
      this._dustPos[i3+2] = -40 - Math.random() * 140        // z: −40 to −180

      this._dustVel[i3]   = (Math.random() - 0.5) * 0.11
      this._dustVel[i3+1] = (Math.random() - 0.5) * 0.09
      this._dustVel[i3+2] = (Math.random() - 0.5) * 0.035
    }

    const geo     = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(this._dustPos, 3)
    posAttr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', posAttr)

    const mat = new THREE.PointsMaterial({
      color: 0xE0B84F,
      size: 2.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })

    this._dustPoints = new THREE.Points(geo, mat)
    this._scene.add(this._dustPoints)
  }

  // ── Floating small balls (InstancedMesh, solid spheres) ───────────────────
  _setupBalls () {
    this._ballPx = new Float32Array(BALL_COUNT)
    this._ballPy = new Float32Array(BALL_COUNT)
    this._ballPz = new Float32Array(BALL_COUNT)
    this._ballVx = new Float32Array(BALL_COUNT)
    this._ballVy = new Float32Array(BALL_COUNT)
    this._ballVz = new Float32Array(BALL_COUNT)
    this._ballRx = new Float32Array(BALL_COUNT)
    this._ballRy = new Float32Array(BALL_COUNT)
    this._ballSc = new Float32Array(BALL_COUNT)   // per-ball scale

    for (let i = 0; i < BALL_COUNT; i++) {
      this._ballPx[i] = (Math.random() - 0.5) * 340
      this._ballPy[i] = (Math.random() - 0.5) * 220
      this._ballPz[i] = (Math.random() - 0.5) * 150

      this._ballVx[i] = (Math.random() - 0.5) * 0.16
      this._ballVy[i] = (Math.random() - 0.5) * 0.13
      this._ballVz[i] = (Math.random() - 0.5) * 0.08

      this._ballRx[i] = Math.random() * Math.PI * 2
      this._ballRy[i] = Math.random() * Math.PI * 2

      // Mix of tiny and slightly larger balls
      this._ballSc[i] = 0.5 + Math.pow(Math.random(), 1.6) * 2.0
    }

    // Low-poly sphere — cheap geometry for many instances
    const geo = new THREE.SphereGeometry(0.85, 7, 5)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.70,
    })

    this._ballMesh = new THREE.InstancedMesh(geo, mat, BALL_COUNT)
    this._ballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this._scene.add(this._ballMesh)

    // Gold colour per ball (slightly brighter range than tetrahedra)
    const col = new THREE.Color()
    for (let i = 0; i < BALL_COUNT; i++) {
      col.setHex(PALETTE[(i + 2) % PALETTE.length])   // offset for variety
      col.multiplyScalar(0.65 + Math.random() * 0.35)
      this._ballMesh.setColorAt(i, col)
    }
    this._ballMesh.instanceColor.needsUpdate = true
  }

  // ── Tetrahedra physics buffers ─────────────────────────────────────────────
  _setupBuffers () {
    this._px = new Float32Array(COUNT)
    this._py = new Float32Array(COUNT)
    this._pz = new Float32Array(COUNT)
    this._vx = new Float32Array(COUNT)
    this._vy = new Float32Array(COUNT)
    this._vz = new Float32Array(COUNT)

    this._rx  = new Float32Array(COUNT)
    this._ry  = new Float32Array(COUNT)
    this._rz  = new Float32Array(COUNT)
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

    // Pre-compute all 6 shape targets
    this._shapes = buildShapes(COUNT)

    // Seed positions from shape 0 (globe)
    const s0 = this._shapes[0]
    for (let i = 0; i < COUNT; i++) {
      this._px[i] = s0[i*3]
      this._py[i] = s0[i*3+1]
      this._pz[i] = s0[i*3+2]
    }
  }

  // ── Mouse / touch ──────────────────────────────────────────────────────────
  _setupMouse () {
    this._mw       = new THREE.Vector3(99999, 99999, 0)
    this._mouse2d  = new THREE.Vector2(99999, 99999)
    this._raycaster = new THREE.Raycaster()
    this._plane    = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

    const onMove = (cx, cy) => {
      this._mouse2d.x =  (cx / innerWidth)  * 2 - 1
      this._mouse2d.y = -(cy / innerHeight) * 2 + 1
      this._camTX = this._mouse2d.x * 10
      this._camTY = this._mouse2d.y *  6
    }

    window.addEventListener('mousemove',
      e => onMove(e.clientX, e.clientY), { passive: true })
    window.addEventListener('touchmove', e => {
      onMove(e.touches[0].clientX, e.touches[0].clientY)
    }, { passive: true })
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  _resize () {
    const W = innerWidth, H = innerHeight
    this._renderer.setSize(W, H, false)
    this._camera.aspect = W / H
    this._camera.updateProjectionMatrix()
  }

  // ── Main tick ──────────────────────────────────────────────────────────────
  tick () {
    this._updateMouse()
    this._updateParticles()    // tetrahedra (spring physics + morphing)
    this._updateDust()         // background drift
    this._updateBalls()        // floating balls
    this._updateCamera()
    this._renderer.render(this._scene, this._camera)
  }

  _updateMouse () {
    this._raycaster.setFromCamera(this._mouse2d, this._camera)
    this._raycaster.ray.intersectPlane(this._plane, this._mw)
  }

  // ── Tetrahedra spring physics ──────────────────────────────────────────────
  _updateParticles () {
    // Scroll 0→1 maps to shape progress 0→(NUM_SHAPES−1)
    const scroll = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
    const raw    = Math.min(scroll * (NUM_SHAPES - 1), NUM_SHAPES - 1.001)
    const iA     = Math.floor(raw)
    const iB     = iA + 1

    // SMOOTHSTEP easing: slow at section boundaries, fast in middle of morph.
    // This means particles HOLD their crisp shape near each scroll waypoint
    // instead of constantly drifting between forms.
    const tLin = raw - iA
    const tl   = tLin * tLin * (3 - 2 * tLin)

    const sA = this._shapes[iA]
    const sB = this._shapes[iB]

    const mx = this._mw.x
    const my = this._mw.y

    const dummy = this._dummy

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3

      // ── Target: lerp between consecutive shapes ──────────────────────────
      const tx = sA[i3]   + (sB[i3]   - sA[i3])   * tl
      const ty = sA[i3+1] + (sB[i3+1] - sA[i3+1]) * tl
      const tz = sA[i3+2] + (sB[i3+2] - sA[i3+2]) * tl

      // ── Spring pull ──────────────────────────────────────────────────────
      let fx = (tx - this._px[i]) * SPRING
      let fy = (ty - this._py[i]) * SPRING
      let fz = (tz - this._pz[i]) * SPRING * 0.35

      // ── Mouse repulsion ──────────────────────────────────────────────────
      const dx = this._px[i] - mx
      const dy = this._py[i] - my
      const d2 = dx * dx + dy * dy
      if (d2 < REPEL_R2) {
        const d   = Math.sqrt(d2) + 0.001
        const str = (1 - d / REPEL_R) * REPEL_F
        fx += (dx / d) * str
        fy += (dy / d) * str
        fz += (Math.random() - 0.5) * str * 1.4
      }

      // ── Integrate ────────────────────────────────────────────────────────
      this._vx[i] = (this._vx[i] + fx) * DECAY
      this._vy[i] = (this._vy[i] + fy) * DECAY
      this._vz[i] = (this._vz[i] + fz) * DECAY

      this._px[i] += this._vx[i]
      this._py[i] += this._vy[i]
      this._pz[i] += this._vz[i]

      // ── Tumble rotation ──────────────────────────────────────────────────
      this._rx[i] += this._rvx[i]
      this._ry[i] += this._rvy[i]
      this._rz[i] += this._rvz[i]

      // ── Instance matrix ──────────────────────────────────────────────────
      dummy.position.set(this._px[i], this._py[i], this._pz[i])
      dummy.rotation.set(this._rx[i], this._ry[i], this._rz[i])
      dummy.scale.setScalar(this._scales[i])
      dummy.updateMatrix()
      this._mesh.setMatrixAt(i, dummy.matrix)
    }

    this._mesh.instanceMatrix.needsUpdate = true
  }

  // ── Dust drift ─────────────────────────────────────────────────────────────
  _updateDust () {
    const BX = 290, BY = 190, ZMIN = -185, ZMAX = -35

    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3
      this._dustPos[i3]   += this._dustVel[i3]
      this._dustPos[i3+1] += this._dustVel[i3+1]
      this._dustPos[i3+2] += this._dustVel[i3+2]

      // Wrap at boundaries
      if (this._dustPos[i3]   >  BX)   this._dustPos[i3]   = -BX
      if (this._dustPos[i3]   < -BX)   this._dustPos[i3]   =  BX
      if (this._dustPos[i3+1] >  BY)   this._dustPos[i3+1] = -BY
      if (this._dustPos[i3+1] < -BY)   this._dustPos[i3+1] =  BY
      if (this._dustPos[i3+2] > ZMAX)  this._dustPos[i3+2] = ZMIN
      if (this._dustPos[i3+2] < ZMIN)  this._dustPos[i3+2] = ZMAX
    }

    this._dustPoints.geometry.attributes.position.needsUpdate = true
  }

  // ── Floating balls ─────────────────────────────────────────────────────────
  _updateBalls () {
    const ACCEL = 0.0007       // tiny random walk acceleration per frame
    const DECAY_B = 0.984      // slow velocity decay → persistent gentle drift
    const MAX_V = 0.20
    const dummy = this._dummy

    for (let i = 0; i < BALL_COUNT; i++) {
      // Random-walk nudge
      this._ballVx[i] += (Math.random() - 0.5) * ACCEL
      this._ballVy[i] += (Math.random() - 0.5) * ACCEL
      this._ballVz[i] += (Math.random() - 0.5) * ACCEL * 0.5

      // Damp
      this._ballVx[i] *= DECAY_B
      this._ballVy[i] *= DECAY_B
      this._ballVz[i] *= DECAY_B

      // Speed cap
      this._ballVx[i] = Math.max(-MAX_V, Math.min(MAX_V, this._ballVx[i]))
      this._ballVy[i] = Math.max(-MAX_V, Math.min(MAX_V, this._ballVy[i]))

      // Move
      this._ballPx[i] += this._ballVx[i]
      this._ballPy[i] += this._ballVy[i]
      this._ballPz[i] += this._ballVz[i]

      // Soft bounce at boundaries (flip and attenuate)
      if (Math.abs(this._ballPx[i]) > 290) { this._ballPx[i] *= -0.96; this._ballVx[i] *= -0.6 }
      if (Math.abs(this._ballPy[i]) > 170) { this._ballPy[i] *= -0.96; this._ballVy[i] *= -0.6 }
      if (Math.abs(this._ballPz[i]) > 130) { this._ballPz[i] *= -0.96; this._ballVz[i] *= -0.6 }

      // Slow rotation
      this._ballRx[i] += 0.008 + i * 0.00025
      this._ballRy[i] += 0.011 + i * 0.00020

      // Instance matrix
      dummy.position.set(this._ballPx[i], this._ballPy[i], this._ballPz[i])
      dummy.rotation.set(this._ballRx[i], this._ballRy[i], 0)
      dummy.scale.setScalar(this._ballSc[i])
      dummy.updateMatrix()
      this._ballMesh.setMatrixAt(i, dummy.matrix)
    }

    this._ballMesh.instanceMatrix.needsUpdate = true
  }

  // ── Camera parallax ────────────────────────────────────────────────────────
  _updateCamera () {
    this._camX += (this._camTX - this._camX) * 0.055
    this._camY += (this._camTY - this._camY) * 0.055
    this._camera.position.x = this._camX
    this._camera.position.y = this._camY
    this._camera.lookAt(0, 0, 0)
  }
}
