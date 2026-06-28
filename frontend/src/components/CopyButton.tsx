import { useState, useCallback } from 'react'
import { FaRegCopy, FaCheck } from 'react-icons/fa'

interface CopyButtonProps {
  value: string
  label: string
}

/**
 * CopyButton — small icon button that copies a string to the clipboard.
 *
 * Uses navigator.clipboard.writeText() (modern API, requires HTTPS or
 * localhost). Falls back to the legacy document.execCommand('copy')
 * trick for older browsers / non-secure contexts. Silently no-ops if
 * both fail — the user can always copy the value manually.
 *
 * After a successful copy, the icon swaps to a checkmark for 2s as
 * visual feedback, and the `title` updates accordingly. The label
 * prop is used for both aria-label (always) and title (default state).
 */
export default function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
      } else {
        // Fallback for older browsers / non-HTTPS contexts.
        const textArea = document.createElement('textarea')
        textArea.value = value
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silent fail — user can still copy the value manually.
    }
  }, [value])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={copied ? '¡Copiado!' : label}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] active:scale-95 transition-colors"
    >
      {copied ? <FaCheck size={16} /> : <FaRegCopy size={16} />}
    </button>
  )
}
