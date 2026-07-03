import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lightbox } from './Lightbox'

const mockImage = 'https://example.com/test.jpg'
const mockAlt = 'Test image'

describe('Lightbox', () => {
  it('opens when trigger button is clicked', async () => {
    const user = userEvent.setup()
    render(<Lightbox isOpen onClose={vi.fn()} imageSrc={mockImage} imageAlt={mockAlt} triggerRef={null} />)
    const img = screen.getByAltText(mockAlt)
    await waitFor(() => expect(img).toBeInTheDocument())
    expect(img).toHaveAttribute('src', mockImage)
  })

  it('closes when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Lightbox isOpen onClose={onClose} imageSrc={mockImage} imageAlt={mockAlt} triggerRef={null} />)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('closes when backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Lightbox isOpen onClose={onClose} imageSrc={mockImage} imageAlt={mockAlt} triggerRef={null} />)
    const backdrop = screen.getByRole('button', { name: /cerrar lightbox/i })
    await user.click(backdrop)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('has aria-modal and correct labelling for accessibility', () => {
    const { container } = render(<Lightbox isOpen onClose={vi.fn()} imageSrc={mockImage} imageAlt={mockAlt} triggerRef={null} />)
    // The Lightbox root element has role="dialog" and aria-modal
    const dialog = container.firstChild as HTMLElement
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'lightbox-title')
  })
})
