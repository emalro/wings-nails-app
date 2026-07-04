import React, { useState } from 'react'
import { useServices, useBusySlots, useConfig } from '../hooks'
import { useSEO } from '../hooks/useSEO'
import { useFormValidation } from '../hooks/useFormValidation'
import { formatDate, formatDateShort, formatTime, formatDayNameLong, formatMonthName, capitalize } from '../lib/datetime'
import { getApiError } from '../lib/apiErrors'
import { normalizePhone } from '../lib/phone'
import FieldError from '../components/FieldError'
import Calendar from '../components/Calendar'
import CopyButton from '../components/CopyButton'
import HoneypotField from '../components/HoneypotField'
import {
  lookupOrCreatePublicClient,
  createPublicAppointment,
  type ConfigType,
  type Servicio,
} from '../api'

type Step = 'service' | 'form' | 'confirm' | 'payment'

// REQ-PUB-002: /public/appointments returns minimal info
// ({id, fecha_hora_cita, estado_cita}) — no cliente_nombre, no servicios
// breakdown. We derive the payment-step summary from form.values and
// selectedServiceList locally so the UI is unchanged.
type CreatedAppointment = {
  id: number
  fecha_hora_cita: string
  estado_cita: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// A-17: the canonical phone format is digits-only (10-11 digits for AR).
// The form strips formatting before submitting via normalizePhone(), so
// validation runs on the normalized string. See frontend/src/lib/phone.ts.
const PHONE_RE = /^\d{10,11}$/

export default function Reservar() {
  useSEO({
    title: 'Reservar Turno',
    description: 'Reservá tu turno de manicuría online en Nails Studio. Elegí servicio, fecha y horario en Rosario, Santa Fe.',
    canonical: 'https://wings-nails-app.vercel.app/reservar',
  })

  const [step, setStep] = useState<Step>('service')
  const [selectedServices, setSelectedServices] = useState<number[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [appointment, setAppointment] = useState<CreatedAppointment | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useFormValidation({
    nombre: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El nombre es obligatorio.' },
      ],
    },
    apellido: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El apellido es obligatorio.' },
      ],
    },
    telefono: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El teléfono es obligatorio.' },
        // A-17: validate on the normalized (digits-only) string so users
        // can paste a formatted phone and still get accurate feedback.
        { validate: (v: string) => PHONE_RE.test(normalizePhone(v)), message: 'Ingresá un teléfono válido (10-11 dígitos).' },
      ],
    },
    dni: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El DNI es obligatorio.' },
        { validate: (v: string) => /^\d{7,8}$/.test(v.trim()), message: 'El DNI debe tener 7 u 8 dígitos.' },
      ],
    },
    fechaHora: {
      initial: '',
      rules: [
        { validate: (v: string) => v.length > 0, message: 'Elegí fecha y hora para tu turno.' },
        { validate: (v: string) => !v || new Date(v) > new Date(), message: 'La fecha debe ser futura.' },
      ],
    },
    observaciones: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length <= 500, message: 'Máximo 500 caracteres.' },
      ],
    },
  })

  const { data: services = [], isLoading } = useServices()
  const fecha = form.values.fechaHora ? form.values.fechaHora.split('T')[0] : ''
  const { data: busySlots = [] } = useBusySlots(fecha)
  const { data: config } = useConfig()

  const selectedServiceList = services.filter((s: Servicio) => selectedServices.includes(s.id))
  const totalAmount = selectedServiceList.reduce((sum: number, s: Servicio) => sum + s.precio_actual, 0)
  const depositAmount = selectedServiceList.reduce((sum: number, s: Servicio) => sum + s.monto_sena_actual, 0)
  const totalDuration = selectedServiceList.reduce((sum: number, s: Servicio) => sum + s.duracion_minutos, 0)

  function isBusySlot(dateTime: string, durationMinutes: number) {
    const selectedStart = new Date(dateTime)
    const selectedEnd = new Date(selectedStart.getTime() + durationMinutes * 60000)
    return (busySlots as Array<{ start: string; end: string }>).some(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return selectedStart < slotEnd && slotStart < selectedEnd
    })
  }

  function toggleService(serviceId: number) {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    )
    setMessage(null)
  }

  // ── Navigation ──────────────────────────────────────────────────────

  function handleNextToForm() {
    if (selectedServices.length === 0) {
      setMessageType('error')
      setMessage('Seleccioná al menos un servicio para continuar.')
      return
    }
    setStep('form')
    setMessage(null)
  }

  function handleNextToConfirm() {
    if (!form.validate()) {
      setMessageType('error')
      setMessage('Corregí los campos marcados antes de continuar.')
      return
    }
    if (isBusySlot(form.values.fechaHora, totalDuration)) {
      setMessageType('error')
      setMessage('El horario elegido se solapa con otra reserva. Elegí otra franja.')
      return
    }
    setStep('confirm')
    setMessage(null)
  }

  async function handleConfirm() {
    if (selectedServices.length === 0) return
    setSubmitting(true)
    setMessage(null)

    try {
      // Step 1: lookup-or-create cliente via the unauthenticated
      // /public/clients endpoint (REQ-PUB-001). The server returns
      // only {id, was_existing} — no PII echoed.
      const client = await lookupOrCreatePublicClient({
        nombre: form.values.nombre,
        apellido: form.values.apellido,
        // A-17: strip formatting before sending so the backend never
        // sees "+54 (0341) 555-1234" — only digits.
        telefono: normalizePhone(form.values.telefono),
        dni: form.values.dni,
        // honeypot: always empty for legitimate visitors (the
        // HoneypotField input is off-screen and never filled by
        // humans). Naive bots that auto-fill every DOM input will
        // send a non-empty value and the server returns a silent 200
        // with no DB write (D2, REQ-PUB-005).
        honeypot: '',
      })
      // Step 2: create the cita via /public/appointments
      // (REQ-PUB-002). NO id_cliente in the payload — the server
      // resolves the client via DNI. estado_cita is hardcoded to
      // 'Pendiente' on the server.
      const appt = await createPublicAppointment({
        dni: form.values.dni,
        fecha_hora_cita: form.values.fechaHora,
        precio_historico_cobrado: totalAmount,
        sena_historica_pagada: depositAmount,
        servicios: selectedServiceList.map((s: Servicio) => ({
          servicio_id: s.id,
          duracion_minutos: s.duracion_minutos,
          precio_unitario: s.precio_actual,
          subtotal: s.precio_actual,
        })),
        honeypot: '',
      })
      setAppointment(appt as CreatedAppointment)
      setSubmitting(false)
      setStep('payment')
    } catch (err: any) {
      setSubmitting(false)
      if (err?.response?.status === 409) {
        setMessageType('error')
        setMessage('El horario elegido ya fue reservado por otra persona. Elegí otro horario.')
      } else if (err?.response?.status === 404) {
        setMessageType('error')
        setMessage('DNI no disponible. Contactá a la administración.')
      } else if (err?.response?.status === 422) {
        setMessageType('error')
        setMessage(getApiError(err).message)
      } else {
        setMessageType('error')
        setMessage('Ocurrió un error. Intentá de nuevo.')
      }
    }
  }

  function handleBackToService() {
    setStep('service')
    setMessage(null)
  }

  function handleBackToForm() {
    setStep('form')
    setMessage(null)
  }

  // ── WhatsApp helpers ────────────────────────────────────────────────

  function buildWhatsAppUrl(configData: ConfigType | undefined) {
    if (!configData?.whatsapp_number || !appointment) return undefined
    const number = configData.whatsapp_number
    const fecha = formatDateShort(appointment.fecha_hora_cita)
    const hora = formatTime(appointment.fecha_hora_cita)
    // REQ-PUB-002: /public/appointments returns minimal info — no
    // servicios breakdown. Derive the WhatsApp message from local
    // form state (selectedServiceList + form.values) so the summary
    // is identical to the pre-change UI.
    const servicio = selectedServiceList.map((s: Servicio) => s.nombre_servicio).join(', ')
    const total = totalAmount
    const sena = depositAmount
    const cliente_nombre = `${form.values.nombre} ${form.values.apellido}`.trim()

    const template = [
      'Hola! Te envio el comprobante de la seña de mi turno.',
      '',
      `Nombre: ${cliente_nombre}`,
      `Fecha: ${fecha}`,
      `Hora: ${hora}`,
      `Servicio: ${servicio}`,
      `Total: $${total}`,
      `Seña: $${sena}`,
    ].join('\n')

    return `https://wa.me/${number}?text=${encodeURIComponent(template)}`
  }

  // ── Render: Step 1 - Service Selection ──────────────────────────────

  function renderServiceStep() {
    return (
      <>
        <div className="section-header text-left mb-6">
          <span className="overline">Paso 1 de 4</span>
          <h2 className="font-[var(--font-display)] text-[1.4rem] mt-1">
            Seleccioná uno o más servicios
          </h2>
        </div>

        {isLoading ? (
          <div className="empty-state">Cargando servicios...</div>
        ) : services.length === 0 ? (
          <div className="empty-state">No hay servicios disponibles.</div>
        ) : (
          <div className="service-grid mb-8">
            {services.map((service: Servicio) => {
              const isSelected = selectedServices.includes(service.id)
              return (
                <button
                  key={service.id}
                  type="button"
                  className={`service-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleService(service.id)}
                >
                  <div className="service-card-top">
                    <span className="service-card-title">
                      {isSelected && <span className="mr-1.5">✓</span>}
                      {service.nombre_servicio}
                    </span>
                    <span className="service-card-price">${service.precio_actual}</span>
                  </div>
                  <p className="service-card-desc">{service.descripcion}</p>
                  <div className="service-card-meta">
                    <span>{service.duracion_minutos} min</span>
                    <span>Seña ${service.monto_sena_actual}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {selectedServices.length > 0 && (
          <div className="summary-card mb-4">
            <p className="m-0">
              <strong>{selectedServices.length} servicio{selectedServices.length !== 1 ? 's' : ''} seleccionado{selectedServices.length !== 1 ? 's' : ''}</strong>
              {' — '}Total: <strong>${totalAmount}</strong>
              {' | '}Seña: <strong>${depositAmount}</strong>
              {' | '}Duración: <strong>{totalDuration} min</strong>
            </p>
          </div>
        )}

        <button className="button-primary" onClick={handleNextToForm} disabled={selectedServices.length === 0}>
          Continuar
        </button>
      </>
    )
  }

  // ── Render: Step 2 - Form + Calendar ────────────────────────────────

  function renderFormStep() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-7">
        <div className="form-card">
          <div className="section-header text-left mb-5">
            <span className="overline">Paso 2 de 4</span>
            <h2 className="font-[var(--font-display)] text-[1.4rem] mt-1">
              Tus datos
            </h2>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Nombre</label>
              <input
                value={form.values.nombre}
                onChange={e => form.setField('nombre', e.target.value)}
                placeholder="Nombre"
                className={form.touched.nombre && form.errors.nombre ? 'input-error' : ''}
                required
              />
              <FieldError name="nombre" errors={form.errors} touched={form.touched} />
            </div>
            <div className="input-group">
              <label>Apellido</label>
              <input
                value={form.values.apellido}
                onChange={e => form.setField('apellido', e.target.value)}
                placeholder="Apellido"
                className={form.touched.apellido && form.errors.apellido ? 'input-error' : ''}
                required
              />
              <FieldError name="apellido" errors={form.errors} touched={form.touched} />
            </div>
          </div>

          <div className="input-group">
            <label>DNI</label>
            <input
              value={form.values.dni}
              onChange={e => form.setField('dni', e.target.value)}
              placeholder="12345678"
              className={form.touched.dni && form.errors.dni ? 'input-error' : ''}
              required
            />
            <FieldError name="dni" errors={form.errors} touched={form.touched} />
          </div>

          <div className="input-group">
            <label>Teléfono (WhatsApp)</label>
            <input
              value={form.values.telefono}
              onChange={e => form.setField('telefono', e.target.value)}
              placeholder="3411234567"
              className={form.touched.telefono && form.errors.telefono ? 'input-error' : ''}
              required
            />
            <FieldError name="telefono" errors={form.errors} touched={form.touched} />
          </div>

          <div className="input-group">
            <label>Fecha y hora</label>
            <Calendar
              selectedDateTime={form.values.fechaHora}
              onDateTimeChange={(dt: string) => {
                form.setField('fechaHora', dt)
              }}
              serviceDuration={totalDuration || 60}
            />
            <FieldError name="fechaHora" errors={form.errors} touched={form.touched} />
          </div>

          <div className="input-group">
            <label>Observaciones</label>
            <textarea
              value={form.values.observaciones}
              onChange={e => form.setField('observaciones', e.target.value)}
              placeholder="Detalles adicionales para tu turno..."
              maxLength={500}
              rows={3}
              className={`w-full p-2 rounded-md border border-gray-300 resize-y font-[inherit] ${form.touched.observaciones && form.errors.observaciones ? 'input-error' : ''}`}
              required
            />
            <div className="flex justify-between items-center">
              <FieldError name="observaciones" errors={form.errors} touched={form.touched} />
              <span className="text-xs text-[var(--muted)]">{form.values.observaciones.length}/500</span>
            </div>
          </div>

          {/* HoneypotField (REQ-PUB-005, D2). The field is rendered
              off-screen inside the form so naive bots that auto-fill
              every DOM input submit a non-empty 'website' name. The
              form handler never reads .value — the payload is built
              with honeypot: '' in step 3. The server returns silent
              200 on a non-empty honeypot so the bot gets no signal. */}
          <HoneypotField />

          <div className="flex gap-3 mt-4">
            <button type="button" onClick={handleBackToService} className="px-5 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-semibold cursor-pointer">
              Volver
            </button>
            <button className="button-primary" onClick={handleNextToConfirm}>
              Revisar turno
            </button>
          </div>
        </div>

        <div className="summary-card">
          <h3>Resumen</h3>
          {selectedServiceList.length === 0 ? (
            <p>Seleccioná un servicio para ver el detalle.</p>
          ) : (
            <>
              {selectedServiceList.map((s: Servicio) => (
                <p key={s.id}><strong>{s.nombre_servicio}</strong> — ${s.precio_actual}</p>
              ))}
              <hr className="my-2 border-none border-t border-[var(--border)]" />
              <p><strong>Duración total:</strong> {totalDuration} min</p>
              <p><strong>Total:</strong> ${totalAmount}</p>
              <p><strong>Seña total:</strong> ${depositAmount}</p>
              <p className="hint">
                El turno queda en estado <strong>Pendiente</strong> hasta validar la seña.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Render: Step 3 - Confirm ────────────────────────────────────────

  function renderConfirmStep() {
    return (
      <div className="max-w-[500px] mx-auto">
        <div className="section-header text-left mb-5">
          <span className="overline">Paso 3 de 4</span>
          <h2 className="font-[var(--font-display)] text-1.4rem mt-1">
            Confirmá tu turno
          </h2>
        </div>

        {message && (
          <div className={`status-notice ${messageType} mb-4`}>
            {message}
          </div>
        )}

        <div className="summary-card mb-5">
          <h3>Resumen de la reserva</h3>
          {selectedServiceList.length > 0 && (
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="py-1.5 text-[var(--muted)] align-top">Servicios</td>
                  <td className="py-1.5 text-right font-semibold">
                    {selectedServiceList.map((s: Servicio) => (
                      <div key={s.id}>{s.nombre_servicio} — ${s.precio_actual}</div>
                    ))}
                  </td>
                </tr>
                <tr><td className="py-1.5 text-[var(--muted)]">Duración total</td><td className="py-1.5 text-right font-semibold">{totalDuration} min</td></tr>
                <tr><td className="py-1.5 text-[var(--muted)]">Total</td><td className="py-1.5 text-right font-semibold">${totalAmount}</td></tr>
                <tr><td className="py-1.5 text-[var(--muted)]">Seña</td><td className="py-1.5 text-right font-semibold">${depositAmount}</td></tr>
                {form.values.fechaHora && (
                  <tr><td className="py-1.5 text-[var(--muted)]">Fecha y hora</td><td className="py-1.5 text-right font-semibold">{capitalize(formatDayNameLong(form.values.fechaHora))} {new Date(form.values.fechaHora).getDate()} de {formatMonthName(form.values.fechaHora)} de {new Date(form.values.fechaHora).getFullYear()} — {formatTime(form.values.fechaHora)} hs</td></tr>
                )}
              </tbody>
            </table>
          )}
          <hr className="my-3 border-none border-t border-[var(--border)]" />
          <table className="w-full border-collapse">
            <tbody>
              <tr><td className="py-1 text-[var(--muted)]">Nombre</td><td className="py-1 text-right font-semibold">{form.values.nombre} {form.values.apellido}</td></tr>
              <tr><td className="py-1 text-[var(--muted)]">DNI</td><td className="py-1 text-right font-semibold">{form.values.dni}</td></tr>
              <tr><td className="py-1 text-[var(--muted)]">Teléfono</td><td className="py-1 text-right font-semibold">{form.values.telefono}</td></tr>
              {form.values.observaciones.trim() && (
                <tr><td className="py-1 text-[var(--muted)]">Observaciones</td><td className="py-1 text-right font-semibold">{form.values.observaciones}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleBackToForm}
            disabled={submitting}
            className="px-5 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-semibold cursor-pointer"
          >
            Volver
          </button>
          <button
            className="button-primary flex-1"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Confirmando...' : 'Confirmar turno'}
          </button>
        </div>
      </div>
    )
  }

  // ── Render: Step 4 - Payment ────────────────────────────────────────

  function renderPaymentStep() {
    const whatsappUrl = buildWhatsAppUrl(config as ConfigType | undefined)
    const hasCbu = config?.cbu_alias || config?.cbu_number
    const hasWhatsApp = config?.whatsapp_number

    return (
      <div className="max-w-[500px] mx-auto">
        <div className="section-header text-left mb-5">
          <span className="overline">Paso 4 de 4</span>
          <h2 className="font-[var(--font-display)] text-1.4rem mt-1">
            Datos de pago
          </h2>
        </div>

        <div className="summary-card mb-5">
          <h3>Turno creado con éxito</h3>
          {appointment && (
            <div className="mt-3">
              <p><strong>N° de turno:</strong> #{appointment.id}</p>
              {/* REQ-PUB-002: /public/appointments returns minimal
                  info; derive cliente_nombre from form.values so the
                  UX is unchanged from the previous admin-path version. */}
              <p><strong>Cliente:</strong> {form.values.nombre} {form.values.apellido}</p>
            </div>
          )}
          <p className="hint mt-3">
            El turno queda en estado <strong>Pendiente</strong>. Para confirmarlo, enviá el comprobante de la seña.
          </p>
        </div>

        <div className="summary-card mb-5">
          <h3>Seña a abonar</h3>
          <p className="text-1.8rem font-bold text-[var(--primary)] my-3">
            ${depositAmount}
          </p>
        </div>

        {hasCbu ? (
          <div className="summary-card mb-5">
            <h3>Datos bancarios</h3>
            {config?.cbu_alias && (
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 break-all"><strong>Alias:</strong> {config.cbu_alias}</p>
                <CopyButton value={config.cbu_alias} label="Copiar alias" />
              </div>
            )}
            {config?.cbu_number && (
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 break-all"><strong>CBU:</strong> {config.cbu_number}</p>
                <CopyButton value={config.cbu_number} label="Copiar CBU" />
              </div>
            )}
          </div>
        ) : (
          <div className="summary-card mb-5">
            <p className="hint text-center m-0">
              Consultá por WhatsApp para recibir los datos bancarios.
            </p>
          </div>
        )}

        {hasWhatsApp ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button-primary inline-flex items-center justify-center gap-2 no-underline w-full"
          >
            Enviar comprobante por WhatsApp
          </a>
        ) : (
          <p className="hint text-center">
            Contactanos para coordinar el pago.
          </p>
        )}
      </div>
    )
  }

  // ── Main Render ─────────────────────────────────────────────────────

  return (
    <div className="content pt-5 pb-12">
      <div className="page-header py-7 px-0 pb-8">
        <h2>Reservá tu turno</h2>
        <p>Elegí el servicio, completá tus datos y proponé fecha y hora.</p>
      </div>

      {step === 'service' && renderServiceStep()}
      {step === 'form' && renderFormStep()}
      {step === 'confirm' && renderConfirmStep()}
      {step === 'payment' && renderPaymentStep()}
    </div>
  )
}
