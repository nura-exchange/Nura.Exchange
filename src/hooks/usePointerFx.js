import { useEffect } from 'react'

// Pointer-driven polish, no per-card listeners:
//  - cards get a soft spotlight that follows the cursor (--mx / --my)
//  - the hero image drifts slightly against the pointer (--px / --py)
// Skipped on touch devices and when the user prefers reduced motion.
export function usePointerFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover)').matches) return
    let raf = 0
    let last = null
    const apply = () => {
      raf = 0
      const e = last
      if (!e) return
      const card = e.target.closest?.('[data-fx], .mover, .trade-card, .insight, .hs-bar')
      if (card) {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${e.clientX - r.left}px`)
        card.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
      const hero = document.querySelector('.hero-frame')
      if (hero) {
        const r = hero.getBoundingClientRect()
        if (e.clientY > r.top - 80 && e.clientY < r.bottom + 80) {
          hero.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
          hero.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
        }
      }
    }
    const root = document.documentElement
    const onMove = e => {
      last = e
      root.style.setProperty('--gx', `${e.clientX}px`)
      root.style.setProperty('--gy', `${e.clientY}px`)
      if (!raf) raf = requestAnimationFrame(apply)
    }
    // Click ripple on buttons
    const onDown = e => {
      const btn = e.target.closest?.('.pill, .seg-btn, .tape-item, .hs-chip, .mover, .tabbar-btn, .nav-tab')
      if (!btn || btn.disabled) return
      const r = btn.getBoundingClientRect()
      const size = Math.max(r.width, r.height) * 1.6
      const dot = document.createElement('span')
      dot.className = 'ripple'
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
      if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative'
      btn.style.overflow = btn.style.overflow || 'hidden'
      btn.appendChild(dot)
      setTimeout(() => dot.remove(), 700)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
}
