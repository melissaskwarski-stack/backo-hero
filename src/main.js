import { ParticleSystem } from './ParticleSystem.js'
import { initScrollMorph } from './ScrollMorph.js'

let particleSystem = null

function init() {
  // Create Three.js canvas — sits behind all existing page content
  const canvas = document.createElement('canvas')
  canvas.id = 'three-particle-canvas'
  canvas.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:0',
    'pointer-events:none',
    'width:100%',
    'height:100%',
  ].join(';')
  document.body.prepend(canvas)

  particleSystem = new ParticleSystem(canvas)

  initScrollMorph(particleSystem)

  // Animation loop
  function loop() {
    particleSystem.tick()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

// Wait for DOM — page may still be loading when module executes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
