import React, { useState } from 'react'
import { useServices, useBusySlots, useCreateClient, useCreateAppointment, useConfig } from '../hooks'
import Calendar from '../components/Calendar'
import type { ConfigType } from '../api'

type Service = {
  id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_actual: number
  monto_sena_actual: number
  descripcion: string
}

type Step = 'service' | 'form' | 'confirm' | 'payment'

type CreatedAppointment = {
  id: number
  cliente_nombre: string
  fecha_hora_cita: string
  servicios: { nombre_servicio: string; precio_unitario: number }[]
  precio_historico_cobrado: number
  sena_historica_pagada: number
}

type FieldErrors = {
  nombre?: string
  apellido?: string
  telefono?: string
  dni?: string
  fechaHora?: string
}

export default function Reservar() {
  const [step, setStep] = useState<Step>('service')
  const [selectedServices, setSelectedServices] = useState<number[]>([])
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [dni, setDni] = useState('')
  const [fechaHora, setFechaHora] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [appointment, setAppointment] = useState<CreatedAppointment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const { data: services = [], isLoading } = useServices()
  const fecha = fechaHora ? fechaHora.split('T')[0] : ''
  const { data: busySlots = [] } = useBusySlots(fecha)
  const { data: config } = useConfig()

  const createClientMutation = useCreateClient()
  const createAppointmentMutation = useCreateAppointment()

  const selectedServiceList = services.filter((s: Service) => selectedServices.includes(s.id))
  const totalAmount = selectedServiceList.reduce((sum: number, s: Service) => sum + s.precio_actual, 0)
  const depositAmount = selectedServiceList.reduce((sum: number, s: Service) => sum + s.monto_sena_actual, 0)
  const totalDuration = selectedServiceList.reduce((sum: number, s: Service) => sum + s.duracion_minutos, 0)

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

  // ── Field validation ────────────────────────────────────────────────

  function validateField(name: string, value: string): string | undefined {
    switch (name) {
      case 'nombre': return !value.trim() ? 'El nombre es obligatorio.' : undefined
      case 'apellido': return !value.trim() ? 'El apellido es obligatorio.' : undefined
      case 'telefono':
        if (!value.trim()) return 'El teléfono es obligatorio.'
        if (!/^\d{6,}$/.test(value.trim())) return 'Ingresá al menos 6 dígitos.'
        return undefined
      case 'dni':
        if (!value.trim()) return 'El DNI es obligatorio.'
        if (!/^\d{7,8}$/.test(value.trim())) return 'El DNI debe tener 7 u 8 dígitos.'
        return undefined
      case 'fechaHora': return !value ? 'Elegí fecha y hora para tu turno.' : undefined
      default: return undefined
    }
  }

  function handleBlur(name: string) {
    setTouched(prev => ({ ...prev, [name]: true }))
    const value = { nombre, apellido, telefono, dni, fechaHora }[name] || ''
    const error = validateField(name, value)
    setFieldErrors(prev => ({ ...prev, [name]: error }))
  }

  function handleFieldChange(name: string, value: string, setter: (v: string) => void) {
    setter(value)
    if (touched[name]) {
      const error = validateField(name, value)
      setFieldErrors(prev => ({ ...prev, [name]: error }))
    }
  }

  function hasAnyError(fields: FieldErrors): boolean {
    return Object.values(fields).some(e => !!e)
  }

  function validateAllFields(): FieldErrors {
    const errs: FieldErrors = {}
    const fields = [
      ['nombre', nombre],
      ['apellido', apellido],
      ['telefono', telefono],
      ['dni', dni],
      ['fechaHora', fechaHora],
    ] as const
    for (const [name, value] of fields) {
      const error = validateField(name, value)
      if (error) errs[name as keyof FieldErrors] = error
    }
    return errs
  }

  function markAllTouched() {
    setTouched({ nombre: true, apellido: true, telefono: true, dni: true, fechaHora: true })
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
    const errs = validateAllFields()
    setFieldErrors(errs)
    markAllTouched()

    if (hasAnyError(errs)) {
      setMessageType('error')
      setMessage('Corregí los campos marcados antes de continuar.')
      return
    }
    if (isBusySlot(fechaHora, totalDuration)) {
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
      const client = await createClientMutation.mutateAsync({ nombre, apellido, telefono, dni })
      const appointmentPayload = {
        id_cliente: client.id,
        fecha_hora_cita: fechaHora,
        precio_historico_cobrado: totalAmount,
        sena_historica_pagada: depositAmount,
        servicios: selectedServiceList.map((s: Service) => ({
          servicio_id: s.id,
          duracion_minutos: s.duracion_minutos,
          precio_unitario: s.precio_actual,
          subtotal: s.precio_actual,
        })),
      }
      const appt = await createAppointmentMutation.mutateAsync(appointmentPayload) as CreatedAppointment
      setAppointment(appt)
      setSubmitting(false)
      setStep('payment')
    } catch (err: any) {
      setSubmitting(false)
      if (err?.response?.status === 409) {
        setMessageType('error')
        setMessage('El horario elegido ya fue reservado por otra persona. Elegí otro horario.')
      } else if (err?.response?.status === 422) {
        setMessageType('error')
        setMessage(err?.response?.data?.detail || 'Datos inválidos. Revisá los campos.')
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
    if (!configData?.whatsapp_number || !appointment) return null
    const number = configData.whatsapp_number
    const fechaObj = new Date(appointment.fecha_hora_cita)
    const fecha = fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
    const hora = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const servicio = appointment.servicios.map(s => s.nombre_servicio).join(', ')
    const total = appointment.precio_historico_cobrado
    const sena = appointment.sena_historica_pagada

    const template = [
      'Hola! Te envio el comprobante de la seña de mi turno.',
      '',
      `Nombre: ${appointment.cliente_nombre}`,
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
        <div className="section-header" style={{ textAlign: 'left', marginBottom: 24 }}>
          <span className="overline">Paso 1 de 4</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginTop: 4 }}>
            Seleccioná uno o más servicios
          </h2>
        </div>

        {isLoading ? (
          <div className="empty-state">Cargando servicios...</div>
        ) : services.length === 0 ? (
          <div className="empty-state">No hay servicios disponibles.</div>
        ) : (
          <div className="service-grid" style={{ marginBottom: 32 }}>
            {services.map((service: Service) => {
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
                      {isSelected && <span style={{ marginRight: 6 }}>✓</span>}
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
          <div className="summary-card" style={{ marginBottom: 16 }}>
            <p style={{ margin: 0 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 28 }}>
        <div className="form-card">
          <div className="section-header" style={{ textAlign: 'left', marginBottom: 20 }}>
            <span className="overline">Paso 2 de 4</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginTop: 4 }}>
              Tus datos
            </h2>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Nombre</label>
              <input
                value={nombre}
                onChange={e => handleFieldChange('nombre', e.target.value, setNombre)}
                onBlur={() => handleBlur('nombre')}
                placeholder="Nombre"
                className={touched.nombre && fieldErrors.nombre ? 'input-error' : ''}
                required
              />
              {touched.nombre && fieldErrors.nombre && (
                <span className="field-error">{fieldErrors.nombre}</span>
              )}
            </div>
            <div className="input-group">
              <label>Apellido</label>
              <input
                value={apellido}
                onChange={e => handleFieldChange('apellido', e.target.value, setApellido)}
                onBlur={() => handleBlur('apellido')}
                placeholder="Apellido"
                className={touched.apellido && fieldErrors.apellido ? 'input-error' : ''}
                required
              />
              {touched.apellido && fieldErrors.apellido && (
                <span className="field-error">{fieldErrors.apellido}</span>
              )}
            </div>
          </div>

          <div className="input-group">
            <label>DNI</label>
            <input
              value={dni}
              onChange={e => handleFieldChange('dni', e.target.value, setDni)}
              onBlur={() => handleBlur('dni')}
              placeholder="12345678"
              className={touched.dni && fieldErrors.dni ? 'input-error' : ''}
              required
            />
            {touched.dni && fieldErrors.dni && (
              <span className="field-error">{fieldErrors.dni}</span>
            )}
          </div>

          <div className="input-group">
            <label>Teléfono (WhatsApp)</label>
            <input
              value={telefono}
              onChange={e => handleFieldChange('telefono', e.target.value, setTelefono)}
              onBlur={() => handleBlur('telefono')}
              placeholder="3411234567"
              className={touched.telefono && fieldErrors.telefono ? 'input-error' : ''}
              required
            />
            {touched.telefono && fieldErrors.telefono && (
              <span className="field-error">{fieldErrors.telefono}</span>
            )}
          </div>

          <div className="input-group">
            <label>Fecha y hora</label>
            <Calendar
              selectedDateTime={fechaHora}
              onDateTimeChange={(dt: string) => {
                handleFieldChange('fechaHora', dt, setFechaHora)
              }}
              serviceDuration={totalDuration || 60}
            />
            {touched.fechaHora && fieldErrors.fechaHora && (
              <span className="field-error">{fieldErrors.fechaHora}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button" onClick={handleBackToService} style={{ padding: '12px 20px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontWeight: 600, cursor: 'pointer' }}>
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
              {selectedServiceList.map((s: Service) => (
                <p key={s.id}><strong>{s.nombre_servicio}</strong> — ${s.precio_actual}</p>
              ))}
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
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
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div className="section-header" style={{ textAlign: 'left', marginBottom: 20 }}>
          <span className="overline">Paso 3 de 4</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginTop: 4 }}>
            Confirmá tu turno
          </h2>
        </div>

        {message && (
          <div className={`status-notice ${messageType}`} style={{ marginBottom: 16 }}>
            {message}
          </div>
        )}

        <div className="summary-card" style={{ marginBottom: 20 }}>
          <h3>Resumen de la reserva</h3>
          {selectedServiceList.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', color: 'var(--muted)', verticalAlign: 'top' }}>Servicios</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                    {selectedServiceList.map((s: Service) => (
                      <div key={s.id}>{s.nombre_servicio} — ${s.precio_actual}</div>
                    ))}
                  </td>
                </tr>
                <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>Duración total</td><td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{totalDuration} min</td></tr>
                <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>Total</td><td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>${totalAmount}</td></tr>
                <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>Seña</td><td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>${depositAmount}</td></tr>
                {fechaHora && (
                  <tr><td style={{ padding: '6px 0', color: 'var(--muted)' }}>Fecha y hora</td><td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{new Date(fechaHora).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} {new Date(fechaHora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</td></tr>
                )}
              </tbody>
            </table>
          )}
          <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={{ padding: '4px 0', color: 'var(--muted)' }}>Nombre</td><td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{nombre} {apellido}</td></tr>
              <tr><td style={{ padding: '4px 0', color: 'var(--muted)' }}>DNI</td><td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{dni}</td></tr>
              <tr><td style={{ padding: '4px 0', color: 'var(--muted)' }}>Teléfono</td><td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{telefono}</td></tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={handleBackToForm}
            disabled={submitting}
            style={{ padding: '12px 20px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontWeight: 600, cursor: 'pointer' }}
          >
            Volver
          </button>
          <button
            className="button-primary"
            onClick={handleConfirm}
            disabled={submitting}
            style={{ flex: 1 }}
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
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div className="section-header" style={{ textAlign: 'left', marginBottom: 20 }}>
          <span className="overline">Paso 4 de 4</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginTop: 4 }}>
            Datos de pago
          </h2>
        </div>

        <div className="summary-card" style={{ marginBottom: 20 }}>
          <h3>Turno creado con éxito</h3>
          {appointment && (
            <div style={{ marginTop: 12 }}>
              <p><strong>N° de turno:</strong> #{appointment.id}</p>
              <p><strong>Cliente:</strong> {appointment.cliente_nombre}</p>
            </div>
          )}
          <p className="hint" style={{ marginTop: 12 }}>
            El turno queda en estado <strong>Pendiente</strong>. Para confirmarlo, enviá el comprobante de la seña.
          </p>
        </div>

        <div className="summary-card" style={{ marginBottom: 20 }}>
          <h3>Seña a abonar</h3>
          <p style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent)', margin: '12px 0' }}>
            ${depositAmount}
          </p>
        </div>

        {hasCbu ? (
          <div className="summary-card" style={{ marginBottom: 20 }}>
            <h3>Datos bancarios</h3>
            {config?.cbu_alias && (
              <p><strong>Alias:</strong> {config.cbu_alias}</p>
            )}
            {config?.cbu_number && (
              <p><strong>CBU:</strong> {config.cbu_number}</p>
            )}
          </div>
        ) : (
          <div className="summary-card" style={{ marginBottom: 20 }}>
            <p className="hint" style={{ textAlign: 'center', margin: 0 }}>
              Consultá por WhatsApp para recibir los datos bancarios.
            </p>
          </div>
        )}

        {hasWhatsApp ? (
          <a
            href={whatsappUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="button-primary"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', width: '100%' }}
          >
            Enviar comprobante por WhatsApp
          </a>
        ) : (
          <p className="hint" style={{ textAlign: 'center' }}>
            Contactanos para coordinar el pago.
          </p>
        )}
      </div>
    )
  }

  // ── Main Render ─────────────────────────────────────────────────────

  return (
    <div className="content" style={{ paddingTop: 20, paddingBottom: 48 }}>
      <div className="page-header" style={{ padding: '28px 0 32px' }}>
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
