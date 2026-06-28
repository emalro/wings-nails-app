import React, { useEffect, useState, useRef } from 'react'

/**
 * ScrollToTop — REQ-VIS-013.
 *
 * Floating glass button (only glass element in the design) that appears
 * after the user has scrolled more than 400px. Clicking it scrolls the
 * page back to the top and moves focus to <main id=\"main\">.
 *
 * Visibility is via display: none (not aria-hidden) when not visible, so
 * the element is fully removed from the accessibility tree AND the tab
 * order. The prefers-reduced-motion media query is consulted directly so
 * the scroll uses behavior: 'auto' (instant) when the user prefers
 * reduced motion — the global CSS rule in index.css zeros the
 * transition.
 */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  const rafRef = useRef<number | null>(null)
  const tickingRef = useRef(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = () => {
      // No-op: the click handler reads the latest value each time.
    }
    reducedMotion.addEventListener('change', onMotionChange)

    function update() {
      tickingRef.current = false
      setVisible(window.scrollY > 400)
    }
    function onScroll() {
      if (tickingRef.current) return
      tickingRef.current = true
      rafRef.current = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      reducedMotion.removeEventListener('change', onMotionChange)
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  function handleClick() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    // Move focus to <main id=\"main\"> after the scroll lands. The
    // tabIndex={-1} on <main> allows programmatic focus without making
    // it a tab stop on initial page load.
    window.requestAnimationFrame(() => {
      const main = document.getElementById('main')
      if (main) main.focus({ preventScroll: true })
    })
  }

  if (!visible) return null

  return (
    <button
      type="button"
      className="scroll-to-top"
      aria-label="Volver arriba"
      onClick={handleClick}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  )
}
