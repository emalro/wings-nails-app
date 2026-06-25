import React from 'react'

interface FieldErrorProps {
  name: string
  errors?: Record<string, string | null>
  touched?: Record<string, boolean>
  className?: string
}

/**
 * Inline field error display.
 * Shows the error message only when the field is both touched AND has an error.
 * Renders nothing when the field is valid or untouched.
 */
export default function FieldError({
  name,
  errors,
  touched,
  className = '',
}: FieldErrorProps) {
  if (!errors || !touched) return null
  if (!touched[name]) return null
  const error = errors[name]
  if (!error) return null

  return (
    <span className={`field-error ${className}`.trim()} role="alert">
      {error}
    </span>
  )
}
