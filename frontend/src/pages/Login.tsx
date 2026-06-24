import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'

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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ text: string; color: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('reason')
    if (reason && FLASH_MESSAGES[reason]) {
      setFlash(FLASH_MESSAGES[reason])
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFlash(null)
    setSubmitting(true)

    try {
      await login(email, password)
      navigate({ to: '/admin' })
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc' }}
          />
        </div>
        {error && (
          <div style={{ color: '#dc2626', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="navbar-cta"
          style={{ width: '100%', textAlign: 'center' }}
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}