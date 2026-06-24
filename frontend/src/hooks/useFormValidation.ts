import { useState, useCallback, useMemo } from 'react'

interface ValidationRule<T> {
  validate: (value: T, allValues: Record<string, any>) => boolean
  message: string
}

interface FieldDef<T = any> {
  initial: T
  rules?: ValidationRule<T>[]
}

interface UseFormValidationReturn {
  values: Record<string, any>
  errors: Record<string, string | null>
  touched: Record<string, boolean>
  setField: (name: string, value: any) => void
  setFields: (fields: Record<string, any>) => void
  validate: () => boolean
  validateField: (name: string) => string | null
  reset: (newValues?: Record<string, any>) => void
  isValid: boolean
  isDirty: boolean
}

/**
 * A declarative form validation hook.
 *
 * Usage:
 * ```ts
 * const form = useFormValidation({
 *   email: { initial: '', rules: [{ validate: v => !!v, message: 'Requerido' }] },
 * })
 * form.setField('email', 'user@example.com')
 * form.validate() // true if all fields pass
 * ```
 */
export function useFormValidation(
  fields: Record<string, FieldDef>,
): UseFormValidationReturn {
  const initialValues = useMemo(() => {
    const acc: Record<string, any> = {}
    for (const [key, def] of Object.entries(fields)) {
      acc[key] = def.initial
    }
    return acc
  }, [fields])

  const [values, setValues] = useState<Record<string, any>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback(
    (name: string): string | null => {
      const def = fields[name]
      if (!def || !def.rules) return null

      const value = values[name]
      for (const rule of def.rules) {
        // Trim strings before validating
        const trimmed = typeof value === 'string' ? value.trim() : value
        if (!rule.validate(trimmed, values)) {
          return rule.message
        }
      }
      return null
    },
    [fields, values],
  )

  const setField = useCallback(
    (name: string, value: any) => {
      setValues((prev) => ({ ...prev, [name]: value }))
      setTouched((prev) => ({ ...prev, [name]: true }))

      // Validate immediately and update error
      const def = fields[name]
      if (def?.rules) {
        let error: string | null = null
        for (const rule of def.rules) {
          const trimmed = typeof value === 'string' ? value.trim() : value
          if (!rule.validate(trimmed, { ...values, [name]: value })) {
            error = rule.message
            break
          }
        }
        setErrors((prev) => ({ ...prev, [name]: error }))
      }
    },
    [fields, values],
  )

  const setFields = useCallback((newFields: Record<string, any>) => {
    setValues((prev) => ({ ...prev, ...newFields }))
    // Mark all set fields as touched and validate them
    const nextErrors: Record<string, string | null> = {}
    for (const [name, value] of Object.entries(newFields)) {
      setTouched((prev) => ({ ...prev, [name]: true }))
    }
    // Batch error update
    setErrors((prev) => {
      const updated = { ...prev }
      for (const [name, value] of Object.entries(newFields)) {
        updated[name] = null
        for (const rule of fields[name]?.rules ?? []) {
          const trimmed = typeof value === 'string' ? value.trim() : value
          if (!rule.validate(trimmed, { ...values, ...newFields })) {
            updated[name] = rule.message
            break
          }
        }
      }
      return updated
    })
  }, [fields, values])

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string | null> = {}
    let allValid = true
    const allTouched: Record<string, boolean> = {}

    for (const name of Object.keys(fields)) {
      allTouched[name] = true
      nextErrors[name] = null
      const def = fields[name]
      if (!def?.rules) continue

      const value = values[name]
      for (const rule of def.rules) {
        const trimmed = typeof value === 'string' ? value.trim() : value
        if (!rule.validate(trimmed, values)) {
          nextErrors[name] = rule.message
          allValid = false
          break
        }
      }
    }

    setErrors(nextErrors)
    setTouched((prev) => ({ ...prev, ...allTouched }))
    return allValid
  }, [fields, values])

  const reset = useCallback(
    (newValues?: Record<string, any>) => {
      setValues(newValues ?? initialValues)
      setErrors({})
      setTouched({})
    },
    [initialValues],
  )

  const isValid = useMemo(() => {
    for (const name of Object.keys(fields)) {
      if (errors[name] != null) return false
    }
    return true
  }, [errors, fields])

  const isDirty = useMemo(() => {
    for (const key of Object.keys(fields)) {
      const initial = initialValues[key]
      const current = values[key]
      if (typeof initial === 'string' && typeof current === 'string') {
        if (current.trim() !== initial.trim()) return true
      } else if (current !== initial) {
        return true
      }
    }
    return false
  }, [initialValues, values, fields])

  return {
    values,
    errors,
    touched,
    setField,
    setFields,
    validate,
    validateField,
    reset,
    isValid,
    isDirty,
  }
}
