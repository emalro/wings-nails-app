import React, { useState } from 'react'
import { useServices, useBusySlots, useCreateClient, useCreateAppointment } from '../hooks'
import Calendar from '../components/Calendar'

type Service = {
  id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_actual: number
  monto_sena_actual: number
  descripcion: string
}

export default function Reservar() {
  const [selectedService, setSelectedService] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fechaHora, setFechaHora] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const { data: services = [], isLoading } = useServices()
  const fecha = fechaHora ? fechaHora.split('T')[0] : ''
  const { data: busySlots = [] } = useBusySlots(fecha)

  const createClientMutation = useCreateClient()
  const createAppointmentMutation = useCreateAppointment()

  const selected = services.find((s: Service) => s.id === selectedService)
  const totalAmount = selected ? selected.precio_actual : 0
  const depositAmount = selected ? selected.monto_sena_actual : 0

  function isBusySlot(dateTime: string, durationMinutes: number) {
    const selectedStart = new Date(dateTime)
    const selectedEnd = new Date(selectedStart.getTime() + durationMinutes * 60000)
    return (busySlots as Array<{ start: string; end: string }>).some(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return selectedStart < slotEnd && slotStart < selectedEnd
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedService) {
      setMessageType('error')
      setMessage('Seleccioná un servicio antes de continuar.')
      return
    }
    if (!fechaHora) {
      setMessageType('error')
      setMessage('Elegí fecha y hora para tu turno.')
      return
    }
    if (isBusySlot(fechaHora, selected!.duracion_minutos)) {
      setMessageType('error')
      setMessage('La fecha y hora elegida se solapa con otra reserva. Elegí otra franja.')
      return
    }
    try {
      const client = await createClientMutation.mutateAsync({ nombre, apellido, telefono })
      const appointmentPayload = {
        id_cliente: client.id,
        fecha_hora_cita: fechaHora,
        precio_historico_cobrado: selected!.precio_actual,
        sena_historica_pagada: selected!.monto_sena_actual,
        servicios: [{
          servicio_id: selected!.id,
          duracion_minutos: selected!.duracion_minutos,
          precio_unitario: selected!.precio_actual,
          subtotal: selected!.precio_actual,
        }],
      }
      const appt = await createAppointmentMutation.mutateAsync(appointmentPayload)
      setMessageType('success')
      setMessage(`Turno creado: #${appt.id}. Queda en estado ${appt.estado_cita}.`)
      setNombre('')
      setApellido('')
      setTelefono('')
      setFechaHora('')
      setSelectedService(null)
    } catch (err: any) {
      setMessageType('error')
      setMessage(err?.response?.data?.detail || 'No se pudo crear el turno.')
    }
  }

  return (
    <div className="content" style={{ paddingTop: 20, paddingBottom: 48 }}>
      <div className="page-header" style={{ padding: '28px 0 32px' }}>
        <h2>Reservá tu turno</h2>
        <p>Elegí el servicio, completá tus datos y proponé fecha y hora.</p>
      </div>

      {message && (
        <div className={`status-notice ${messageType}`}>{message}</div>
      )}

      <div className="section-header" style={{ textAlign: 'left', marginBottom: 24 }}>
        <span className="overline">Servicios</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginTop: 4 }}>
          Seleccioná un servicio
        </h2>
      </div>

      {isLoading ? (
        <div className="empty-state">Cargando servicios...</div>
      ) : services.length === 0 ? (
        <div className="empty-state">No hay servicios disponibles.</div>
      ) : (
        <div className="service-grid" style={{ marginBottom: 40 }}>
          {services.map((service: Service) => (
            <button
              key={service.id}
              type="button"
              className={`service-card ${selectedService === service.id ? 'selected' : ''}`}
              onClick={() => setSelectedService(service.id)}
            >
              <div className="service-card-top">
                <span className="service-card-title">{service.nombre_servicio}</span>
                <span className="service-card-price">${service.precio_actual}</span>
              </div>
              <p className="service-card-desc">{service.descripcion}</p>
              <div className="service-card-meta">
                <span>{service.duracion_minutos} min</span>
                <span>Seña ${service.monto_sena_actual}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 28 }}>
        <div className="form-card">
          <h3>Tus datos</h3>
          <form onSubmit={handleSubmit}>
            <div className="input-row">
              <div className="input-group">
                <label>Nombre</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" required />
              </div>
              <div className="input-group">
                <label>Apellido</label>
                <input value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Apellido" required />
              </div>
            </div>

            <div className="input-group">
              <label>Teléfono (WhatsApp)</label>
              <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="3411234567" required />
            </div>

            <div className="input-group">
              <label>Fecha y hora</label>
              {selected && (
                <Calendar
                  selectedDateTime={fechaHora}
                  onDateTimeChange={setFechaHora}
                  serviceDuration={selected.duracion_minutos}
                />
              )}
              {!selected && <p className="hint">Primero seleccioná un servicio.</p>}
            </div>

            <button
              className="button-primary"
              type="submit"
              disabled={createClientMutation.isPending || createAppointmentMutation.isPending}
              style={{ marginTop: 8 }}
            >
              {createClientMutation.isPending || createAppointmentMutation.isPending
                ? 'Enviando...'
                : 'Solicitar turno'}
            </button>
          </form>
        </div>

        <div className="summary-card">
          <h3>Resumen</h3>
          {!selected ? (
            <p>Seleccioná un servicio para ver el detalle.</p>
          ) : (
            <>
              <p><strong>Servicio:</strong> {selected.nombre_servicio}</p>
              <p><strong>Duración:</strong> {selected.duracion_minutos} min</p>
              <p><strong>Total:</strong> ${totalAmount}</p>
              <p><strong>Seña:</strong> ${depositAmount}</p>
              <p className="hint">
                El turno queda en estado <strong>Pendiente</strong> hasta validar la seña.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
