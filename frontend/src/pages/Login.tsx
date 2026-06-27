import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useConfig } from '../hooks'
import { useFormValidation } from '../hooks/useFormValidation'
import FieldError from '../components/FieldError'

type FlashReason = 'auth-required' | 'session-expired'

interface FlashMessage {
  text: string
  // CSS variable name (without the var() wrapper). Resolved at render so
  // a future token rename flows through without a code change.
  tokenName: '--status-pending' | '--status-cancelled'
  textTokenName: '--on-background' | '--on-primary'
}

const FLASH_MESSAGES: Record<FlashReason, FlashMessage> = {
  'auth-required': {
    text: 'Debe iniciar sesión para acceder al panel de administración',
    tokenName: '--status-pending',
    // Warm gold is the documented exception that fails AA on white; use
    // a dark text color when the banner sits on a --status-pending
    // background.
    textTokenName: '--on-background',
  },
  'session-expired': {
    text: 'Su sesión ha expirado. Inicie sesión nuevamente.',
    tokenName: '--status-cancelled',
    textTokenName: '--on-primary',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function whatsappUrl(number: string): string {
  if (!number) return '#'
  return `https://wa.me/${number.replace(/[^0-9]/g, '')}`
}

export default function Login() {
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<FlashMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const { data: config } = useConfig()
  const whatsappHelpUrl = config?.whatsapp_number
    ? whatsappUrl(config.whatsapp_number)
    : ''

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
    if (reason && (reason === 'auth-required' || reason === 'session-expired')) {
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
    <div className="max-w-[400px] mx-[auto] my-16 px-4">
      <h1 className="text-center mb-8 font-[var(--font-display)] text-[var(--on-background)]">Ingresar</h1>
      {flash && (
        <div
          className="py-3 px-4 rounded-md mb-4 text-center font-semibold"
          style={{
            backgroundColor: `var(${flash.tokenName})`,
            color: `var(${flash.textTokenName})`,
          }}
        >
          {flash.text}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block mb-1 font-semibold">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.values.email}
            onChange={(e) => form.setField('email', e.target.value)}
            autoComplete="username"
            className={`modal-input ${form.touched.email && form.errors.email ? 'input-error' : ''}`}
          />
          <FieldError name="email" errors={form.errors} touched={form.touched} />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block mb-1 font-semibold">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={form.values.password}
            onChange={(e) => form.setField('password', e.target.value)}
            autoComplete="current-password"
            className={`modal-input ${form.touched.password && form.errors.password ? 'input-error' : ''}`}
          />
          <FieldError name="password" errors={form.errors} touched={form.touched} />
        </div>
        {error && (
          <div className="text-[var(--status-cancelled)] mb-4 text-center">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || !form.isValid || !form.isDirty}
          className="navbar-cta w-full text-center"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      {whatsappHelpUrl && (
        <p className="text-center mt-4 text-sm text-[var(--on-surface-variant)]">
          ¿Problemas para ingresar?{' '}
          <a
            href={whatsappHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--primary)] hover:underline"
            aria-label="Contactar por WhatsApp"
          >
            Escribinos
          </a>
        </p>
      )}
    </div>
  )
}
