import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFormValidation } from '../hooks/useFormValidation'
import FieldError from '../components/FieldError'

const FLASH_MESSAGES: Record<string, { text: string; color: string }> = {
  'auth-required': {
    text: 'Debe iniciar sesión para acceder al panel de administración',
    color: '#d97706',
  },
  'session-expired': {
    text: 'Su sesión ha expirado. Inicie sesión nuevamente.',
    color: '#dc2626',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ text: string; color: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()

  const form = useFormValidation({
    email: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El email es requerido' },
        { validate: (v: string) => EMAIL_RE.test(v.trim()), message: 'Formato de email inválido' },
      ],
    },
    password: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'La contraseña es requerida' },
        { validate: (v: string) => v.trim().length >= 6, message: 'Mínimo 6 caracteres' },
      ],
    },
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('reason')
    if (reason && FLASH_MESSAGES[reason]) {
      setFlash(FLASH_MESSAGES[reason])
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.validate()) return
    setError(null)
    setFlash(null)
    setSubmitting(true)

    try {
      await login(form.values.email.trim(), form.values.password)
      window.location.href = '/admin'
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Credenciales inválidas'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Ingresar</h1>
      {flash && (
        <div
          style={{
            backgroundColor: flash.color,
            color: '#fff',
            padding: '0.75rem 1rem',
            borderRadius: 6,
            marginBottom: '1rem',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {flash.text}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.values.email}
            onChange={(e) => form.setField('email', e.target.value)}
            autoComplete="username"
            className={form.touched.email && form.errors.email ? 'input-error' : ''}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
          <FieldError name="email" errors={form.errors} touched={form.touched} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={form.values.password}
            onChange={(e) => form.setField('password', e.target.value)}
            autoComplete="current-password"
            className={form.touched.password && form.errors.password ? 'input-error' : ''}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
          <FieldError name="password" errors={form.errors} touched={form.touched} />
        </div>
        {error && (
          <div style={{ color: '#dc2626', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !form.isValid || !form.isDirty}
          className="navbar-cta"
          style={{ width: '100%', textAlign: 'center' }}
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}