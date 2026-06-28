import React from 'react'

/**
 * Skip link — REQ-A11Y-001.
 *
 * The first focusable element on every page. Activating the link moves
 * keyboard focus to <main id="main">. Visually hidden until focused via
 * the .skip-link utility class in index.css @layer base.
 *
 * Mounted as the first child of <div className="page-wrap"> in App.tsx
 * (not via a portal — see design.md §4.2 for the justification).
 */
export default function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      Saltar al contenido principal
    </a>
  )
}
