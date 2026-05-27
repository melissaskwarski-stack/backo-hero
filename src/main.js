import { ParticleField } from './ParticleField.js'

function init () {
  // ── Hide the old canvas-based animations ──────────────────────────────────
  // (they still run their rAF loops; we just make them invisible)
  const hideOld = document.createElement('style')
  hideOld.textContent =
    '#hero-canvas{display:none!important}' +
    '#particle-canvas{display:none!important}'
  document.head.appendChild(hideOld)

  // ── Three.js canvas — fixed behind all page content ───────────────────────
  const canvas = document.createElement('canvas')
  canvas.id = 'three-particle-canvas'
  canvas.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:1',            // same layer where old particle-canvas was
    'pointer-events:none',
    'width:100%',
    'height:100%',
  ].join(';')
  document.body.prepend(canvas)

  // ── Boot particle field ───────────────────────────────────────────────────
  const field = new ParticleField(canvas)

  // ── Animation loop ────────────────────────────────────────────────────────
  ;(function loop () {
    field.tick()
    requestAnimationFrame(loop)
  })()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
