import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const SECTION_MAP = [
  { id: 'hero',          state: 0 },
  { id: 'pitch',         state: 1 },
  { id: 'two-paths',     state: 2 },
  { id: 'ai-agents',     state: 3 },
  { id: 'human-agents',  state: 4 },
  { id: 'final-cta',     state: 5 },
]

export function initScrollMorph(particleSystem) {
  // GSAP ScrollTrigger — fires when section crosses 50% of viewport
  SECTION_MAP.forEach(({ id, state }) => {
    const el = document.getElementById(id)
    if (!el) return

    ScrollTrigger.create({
      trigger: el,
      start: 'top 50%',
      onEnter: () => particleSystem.triggerMorph(state),
      onEnterBack: () => particleSystem.triggerMorph(state),
    })
  })

  // IntersectionObserver fallback (mobile / no GSAP)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      const mapping = SECTION_MAP.find((m) => m.id === entry.target.id)
      if (mapping) particleSystem.triggerMorph(mapping.state)
    })
  }, { threshold: 0.25, rootMargin: '-10% 0px -40% 0px' })

  SECTION_MAP.forEach(({ id }) => {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  })
}
