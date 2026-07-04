import { useEffect, useRef, useState } from 'react'

interface LightboxProps {
  open: boolean
  onClose: () => void
  src: string
  alt: string
  triggerRef: HTMLButtonElement | null
}

export function Lightbox({ open, onClose, src, alt, triggerRef }: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!open) return

    document.body.style.overflow = 'hidden'

    // Focus the close button after a paint
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 0)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      ref={dialogRef}
    >
      <div className="lightbox-content">
        <h2 id="lightbox-title" className="visually-hidden">
          {alt}
        </h2>
        {imgError ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px',
              color: '#ccc',
              fontStyle: 'italic',
              fontSize: '1rem',
            }}
          >
            Imagen no disponible
          </div>
        ) : (
          <img
            className="lightbox-image"
            src={src}
            alt={alt}
            onError={() => setImgError(true)}
          />
        )}
        <button
          ref={closeButtonRef}
          className="lightbox-close"
          onClick={onClose}
          aria-label="Cerrar lightbox"
        >
          ×
        </button>
      </div>
      <button
        className="lightbox-backdrop-close"
        onClick={onClose}
        aria-label="Cerrar lightbox"
      />
    </div>
  )
}