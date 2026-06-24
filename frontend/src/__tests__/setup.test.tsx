import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('Smoke', () => {
  it('vitest works', () => {
    expect(1 + 1).toBe(2)
  })

  it('jsdom environment works', () => {
    const div = document.createElement('div')
    expect(div).toBeDefined()
  })

  it('can render a simple component', () => {
    render(<div data-testid="test">Hello Vitest</div>)
    expect(screen.getByTestId('test')).toHaveTextContent('Hello Vitest')
  })
})
