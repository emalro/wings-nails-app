import React, { useState, useEffect, useRef } from 'react'
import { useServices, useCreateClient, useClientSearch, useCreateManualAppointment } from '../hooks'
import { useFormValidation } from '../hooks/useFormValidation'
import FieldError from './FieldError'
import type { ClienteRead } from '../api'

interface ManualAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  onAppointmentCreated: () => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 14,
  padding: 28,
  maxWidth: 520,
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid var(--border, #e2e8f0)',
  borderRadius: 8,
  fontSize: '0.95rem',
  background: 'var(--surface, #fff)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.9rem',
  display: 'block',
  marginBottom: 6,
  color: 'var(--text, #1C1517)',
}

export default function ManualAppointmentModal({ isOpen, onClose, onAppointmentCreated }: ManualAppointmentModalProps) {
  const { data: services = [] } = useServices(false)
  const createClientMutation = useCreateClient()
  const createAppointmentMutation = useCreateManualAppointment()

  // Client search state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClienteRead | null>(null)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Quick client form state
  const [quickNombre, setQuickNombre] = useState('')
  const [quickApellido, setQuickApellido] = useState('')
  const [quickTelefono, setQuickTelefono] = useState('')
  const [quickDni, setQuickDni] = useState('')

  // Appointment state
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [estadoCita, setEstadoCita] = useState<string | null>(null) // null = default Pendiente
  const [metodoPago, setMetodoPago] = useState('Transferencia')
  const [error, setError] = useState<string | null>(null)

  const form = useFormValidation({
    cliente: {
      initial: false,
      rules: [
        { validate: (v: boolean) => v, message: 'Seleccioná una clienta' },
      ],
    },
    fecha: {
      initial: '',
      rules: [
        { validate: (v: string) => v.length > 0, message: 'La fecha es requerida' },
        {
          validate: (v: string) => {
            if (!v) return true // handled by required rule
            const today = new Date(new Date().toDateString())
            return new Date(v) >= today
          },
          message: 'La fecha no puede ser en el pasado',
        },
      ],
    },
    hora: {
      initial: '',
      rules: [
        { validate: (v: string) => v.length > 0, message: 'La hora es requerida' },
      ],
    },
    servicios: {
      initial: false,
      rules: [
        { validate: (v: boolean) => v, message: 'Seleccioná al menos un servicio' },
      ],
    },
  })

  // Sync complex state into form validation
  useEffect(() => {
    form.setField('cliente', !!selectedClient)
  }, [selectedClient])

  useEffect(() => {
    form.setField('servicios', selectedServiceIds.length > 0)
  }, [selectedServiceIds])

  useEffect(() => {
    form.setField('fecha', appointmentDate)
  }, [appointmentDate])

  useEffect(() => {
    form.setField('hora', appointmentTime)
  }, [appointmentTime])

  const { data: searchResults, isLoading: searchLoading } = useClientSearch(debouncedQuery)

  // Debounce search query (300ms)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setDebouncedQuery('')
      setShowDropdown(false)
      setSelectedClient(null)
      setShowQuickForm(false)
      setQuickNombre('')
      setQuickApellido('')
      setQuickTelefono('')
      setQuickDni('')
      setSelectedServiceIds([])
      setAppointmentDate('')
      setAppointmentTime('')
      setEstadoCita(null)
      setMetodoPago('Transferencia')
      setError(null)
      form.reset()
    }
  }, [isOpen])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearchQuery(value)
    setSelectedClient(null)
    setShowQuickForm(false)
    if (value.length >= 2) {
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }

  function handleSelectClient(client: ClienteRead) {
    setSelectedClient(client)
    setSearchQuery(`${client.nombre} ${client.apellido}`)
    setShowDropdown(false)
    setShowQuickForm(false)
  }

  function handleShowQuickForm() {
    setShowQuickForm(true)
    setShowDropdown(false)
    setQuickNombre('')
    setQuickApellido('')
    setQuickTelefono('')
  }

  async function handleCreateQuickClient() {
    if (!quickNombre || !quickApellido || !quickTelefono || !quickDni) return
    setError(null)
    try {
      const client = await createClientMutation.mutateAsync({
        nombre: quickNombre,
        apellido: quickApellido,
        telefono: quickTelefono,
        dni: quickDni,
      })
      setSelectedClient(client)
      setSearchQuery(`${client.nombre} ${client.apellido}`)
      setShowQuickForm(false)
      setQuickNombre('')
      setQuickApellido('')
      setQuickTelefono('')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al crear la clienta.')
    }
  }

  function getSelectedServices() {
    return services.filter((s: any) => selectedServiceIds.includes(s.id))
  }

  function isFormValid() {
    return (
      selectedClient &&
      selectedServiceIds.length > 0 &&
      appointmentDate &&
      appointmentTime
    )
  }

  function toggleService(serviceId: number) {
    setSelectedServiceIds(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    )
  }

  async function handleSubmit() {
    if (!form.validate()) {
      // Show first validation error
      const firstError = Object.values(form.errors).find(Boolean)
      if (firstError) setError(firstError)
      return
    }
    if (!selectedClient) return
    setError(null)

    const selectedServices = getSelectedServices()
    if (selectedServices.length === 0) return

    const totalAmount = selectedServices.reduce((sum: number, s: any) => sum + s.precio_actual, 0)
    const totalSena = selectedServices.reduce((sum: number, s: any) => sum + s.monto_sena_actual, 0)

    const fecha_hora_cita = `${appointmentDate}T${appointmentTime}:00`
    const payload: any = {
      id_cliente: selectedClient.id,
      fecha_hora_cita,
      precio_historico_cobrado: totalAmount,
      sena_historica_pagada: totalSena,
      metodo_pago_sena: metodoPago,
      servicios: selectedServices.map((s: any) => ({
        servicio_id: s.id,
        duracion_minutos: s.duracion_minutos,
        precio_unitario: s.precio_actual,
        subtotal: s.precio_actual,
      })),
    }
    if (estadoCita) {
      payload.estado_cita = estadoCita
    }

    try {
      await createAppointmentMutation.mutateAsync(payload)
      onAppointmentCreated()
      onClose()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Error al crear el turno.'
      setError(detail)
    }
  }

  if (!isOpen) return null

  return (
    <div className="manual-modal" style={overlayStyle} onClick={onClose}>
      <div className="manual-modal-content" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-display, Georgia, serif)' }}>
            Cargar Turno Manual
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}>&times;</button>
        </div>

        {error && (
          <div className="status-notice error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── Step 1: Client Search ── */}
        <div style={{ marginBottom: 20 }} ref={searchRef}>
          <label style={labelStyle}>Clienta</label>
          {selectedClient && !showQuickForm ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="client-search-input"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscá por nombre, apellido o teléfono..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => { setSelectedClient(null); setSearchQuery(''); setShowDropdown(false) }}
                style={{ padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="client-search-wrapper" style={{ position: 'relative' }}>
              <input
                className="client-search-input"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => { if (searchQuery.length >= 2) setShowDropdown(true) }}
                placeholder="Buscá por nombre, apellido o teléfono..."
                style={inputStyle}
              />
              {showDropdown && (
                <div className="search-dropdown" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1.5px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  maxHeight: 240,
                  overflowY: 'auto',
                  marginTop: 4,
                }}>
                  {searchLoading ? (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
                      Buscando...
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    searchResults.map((client: any) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-light, #F0E4EA)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <strong>{client.nombre} {client.apellido}</strong>
                        {' — '}{client.telefonos?.[0]?.telefono || ''}
                      </button>
                    ))
                  ) : debouncedQuery.length >= 2 ? (
                    <div style={{ padding: 16 }}>
                      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.9rem' }}>
                        No se encontraron clientas. Crear nueva ficha
                      </p>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={handleShowQuickForm}
                        style={{ padding: '10px 16px', fontSize: '0.9rem' }}
                      >
                        Crear nueva ficha
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Quick Client Form ── */}
        {showQuickForm && (
          <div className="quick-client-form" style={{
            marginBottom: 20,
            padding: 16,
            background: 'var(--primary-light, #F0E4EA)',
            borderRadius: 8,
            border: '1.5px solid var(--primary, #7A1F4A)',
          }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '1rem', fontFamily: 'var(--font-display, Georgia, serif)' }}>
              Nueva clienta
            </h4>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>Nombre *</label>
                <input value={quickNombre} onChange={e => setQuickNombre(e.target.value)} style={inputStyle} placeholder="Nombre" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>Apellido *</label>
                <input value={quickApellido} onChange={e => setQuickApellido(e.target.value)} style={inputStyle} placeholder="Apellido" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>Teléfono *</label>
                <input value={quickTelefono} onChange={e => setQuickTelefono(e.target.value)} style={inputStyle} placeholder="3411234567" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>DNI *</label>
                <input value={quickDni} onChange={e => setQuickDni(e.target.value)} style={inputStyle} placeholder="12345678" />
              </div>
              <button
                type="button"
                className="button-primary"
                onClick={handleCreateQuickClient}
                disabled={!quickNombre || !quickApellido || !quickTelefono || !quickDni || createClientMutation.isPending}
                style={{ padding: '12px 16px', fontSize: '0.9rem' }}
              >
                {createClientMutation.isPending ? 'Creando...' : 'Guardar y seleccionar'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Service Selector (multi) ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Servicios (podés elegir varios)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {services.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No hay servicios activos.</p>
            ) : (
              services.map((s: any) => {
                const isSelected = selectedServiceIds.includes(s.id)
                return (
                  <label
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      border: isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      borderRadius: 8,
                      background: isSelected ? 'var(--primary-light, #F0E4EA)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleService(s.id)}
                      style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                    />
                    <span style={{ flex: 1 }}>{s.nombre_servicio}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      ${s.precio_actual} &middot; {s.duracion_minutos} min
                    </span>
                  </label>
                )
              })
            )}
          </div>
          {selectedServiceIds.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 8 }}>
              {selectedServiceIds.length} servicio{selectedServiceIds.length !== 1 ? 's' : ''} seleccionado{selectedServiceIds.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── Step 3: Date and Time ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Fecha y hora</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input
              type="date"
              value={appointmentDate}
              onChange={e => setAppointmentDate(e.target.value)}
              style={inputStyle}
            />
            <input
              type="time"
              value={appointmentTime}
              onChange={e => setAppointmentTime(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* ── Step 4: Toggles ── */}
        <div style={{ marginBottom: 20, display: 'flex', gap: 20 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 8, color: 'var(--text)' }}>Estado</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setEstadoCita(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: estadoCita === null ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: estadoCita === null ? 'var(--primary-light)' : 'var(--surface)',
                  color: estadoCita === null ? 'var(--primary)' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Pendiente
              </button>
              <button
                type="button"
                onClick={() => setEstadoCita('Confirmado')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: estadoCita === 'Confirmado' ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: estadoCita === 'Confirmado' ? 'var(--primary-light)' : 'var(--surface)',
                  color: estadoCita === 'Confirmado' ? 'var(--primary)' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Confirmado
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 8, color: 'var(--text)' }}>Pago seña</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setMetodoPago('Transferencia')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: metodoPago === 'Transferencia' ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: metodoPago === 'Transferencia' ? 'var(--primary-light)' : 'var(--surface)',
                  color: metodoPago === 'Transferencia' ? 'var(--primary)' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Transferencia
              </button>
              <button
                type="button"
                onClick={() => setMetodoPago('Efectivo')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: metodoPago === 'Efectivo' ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: metodoPago === 'Efectivo' ? 'var(--primary-light)' : 'var(--surface)',
                  color: metodoPago === 'Efectivo' ? 'var(--primary)' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Efectivo
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary ── */}
        {selectedServiceIds.length > 0 && appointmentDate && appointmentTime && selectedClient && (
          <div style={{
            marginBottom: 20,
            padding: 16,
            background: 'var(--bg, #FAF7F5)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: '0.9rem',
          }}>
            <p style={{ margin: '4px 0' }}><strong>Clienta:</strong> {selectedClient.nombre} {selectedClient.apellido}</p>
            <p style={{ margin: '4px 0' }}><strong>Fecha:</strong> {appointmentDate} a las {appointmentTime}</p>
            {(() => {
              const selected = getSelectedServices()
              const total = selected.reduce((sum: number, s: any) => sum + s.precio_actual, 0)
              const sena = selected.reduce((sum: number, s: any) => sum + s.monto_sena_actual, 0)
              return selected.length > 0 ? (
                <>
                  {selected.map((s: any) => (
                    <p key={s.id} style={{ margin: '2px 0' }}><strong>Servicio:</strong> {s.nombre_servicio} — ${s.precio_actual}</p>
                  ))}
                  <p style={{ margin: '4px 0' }}><strong>Total:</strong> ${total}</p>
                  <p style={{ margin: '4px 0' }}><strong>Seña:</strong> ${sena} ({metodoPago})</p>
                </>
              ) : null
            })()}
            <p style={{ margin: '4px 0' }}><strong>Estado:</strong> {estadoCita || 'Pendiente'}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="button"
          className="button-primary"
          onClick={handleSubmit}
          disabled={!isFormValid() || createAppointmentMutation.isPending}
          style={{ marginTop: 4 }}
        >
          {createAppointmentMutation.isPending ? 'Guardando...' : 'Guardar Turno'}
        </button>
      </div>
    </div>
  )
}
