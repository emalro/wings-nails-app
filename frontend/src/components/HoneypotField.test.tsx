import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HoneypotField } from './HoneypotField'

describe('HoneypotField', () => {
  it('renders a hidden text input with the right DOM attributes (D7)', () => {
    const { container } = render(<HoneypotField />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    // DOM name is plausibly "website" (D7) — JSON key is "honeypot"
    expect(input.name).toBe('website')
    expect(input.value).toBe('')
    expect(input.getAttribute('aria-hidden')).toBe('true')
    expect(input.tabIndex).toBe(-1)
    expect(input.getAttribute('autocomplete')).toBe('off')
  })

  it('is positioned off-screen (not display:none — that defeats bot detection)', () => {
    const { container } = render(<HoneypotField />)
    const input = container.querySelector('input') as HTMLInputElement
    // position: absolute with left: -9999px is the recommended
    // off-screen pattern: the field is in the DOM and rendered (so a
    // naive bot that submits the form fills it) but visually hidden
    // (so a human user doesn't see or fill it).
    expect(input.style.position).toBe('absolute')
    expect(input.style.left).toBe('-9999px')
  })
})
