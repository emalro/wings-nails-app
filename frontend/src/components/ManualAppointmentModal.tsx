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
    // `new Date('YYYY-MM-DD')` se parsea como UTC; agregar hora lo fuerza a horario local
    form.setField('fecha', appointmentDate ? `${appointmentDate}T00:00:00` : '')
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
    <div className="manual-modal modal-overlay" onClick={onClose}>
      <div className="manual-modal-content modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="m-0 text-1.25rem font-[var(--font-display)]">
            Cargar Turno Manual
          </h3>
          <button type="button" onClick={onClose} className="bg-none border-none text-1.5rem cursor-pointer leading-none py-1 px-2">&times;</button>
        </div>

        {error && (
          <div className="status-notice error mb-4">
            {error}
          </div>
        )}

        {/* ── Step 1: Client Search ── */}
        <div className="mb-5" ref={searchRef}>
          <label className="block font-semibold text-[0.9rem] text-[var(--text)] mb-1.5">Clienta</label>
          {selectedClient && !showQuickForm ? (
            <div className="flex items-center gap-2">
              <input
                className="client-search-input modal-input flex-1"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscá por nombre, apellido o teléfono..."
              />
              <button
                type="button"
                onClick={() => { setSelectedClient(null); setSearchQuery(''); setShowDropdown(false) }}
                className="py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] cursor-pointer font-semibold text-[0.85rem]"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="client-search-wrapper relative">
              <input
                className="client-search-input modal-input"
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscá por nombre, apellido o teléfono..."
              />
              {showDropdown && (
                <div className="search-dropdown">
                  {searchLoading ? (
                    <div className="py-4 text-center text-[var(--muted)] text-[0.9rem]">
                      Buscando...
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    searchResults.map((client: any) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className="search-dropdown-item"
                      >
                        <strong>{client.nombre} {client.apellido}</strong>
                        {' — '}{client.telefonos?.[0]?.telefono || ''}
                      </button>
                    ))
                  ) : debouncedQuery.length >= 2 ? (
                    <div className="p-4">
                      <p className="mt-0 mb-3 text-[var(--muted)] text-[0.9rem]">
                        No se encontraron clientas. Crear nueva ficha
                      </p>
                      <button
                        type="button"
                        className="button-primary py-2 px-4 text-[0.9rem]"
                        onClick={handleShowQuickForm}
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
          <div className="quick-client-form mb-5">
            <h4 className="m-0 mb-3 text-1rem font-[var(--font-display)]">
              Nueva clienta
            </h4>
            <div className="grid gap-3">
              <div>
                <label className="block font-semibold text-[0.85rem] mb-1">Nombre *</label>
                <input value={quickNombre} onChange={e => setQuickNombre(e.target.value)} className="modal-input" placeholder="Nombre" />
              </div>
              <div>
                <label className="block font-semibold text-[0.85rem] mb-1">Apellido *</label>
                <input value={quickApellido} onChange={e => setQuickApellido(e.target.value)} className="modal-input" placeholder="Apellido" />
              </div>
              <div>
                <label className="block font-semibold text-[0.85rem] mb-1">Teléfono *</label>
                <input value={quickTelefono} onChange={e => setQuickTelefono(e.target.value)} className="modal-input" placeholder="3411234567" />
              </div>
              <div>
                <label className="block font-semibold text-[0.85rem] mb-1">DNI *</label>
                <input value={quickDni} onChange={e => setQuickDni(e.target.value)} className="modal-input" placeholder="12345678" />
              </div>
              <button
                type="button"
                className="button-primary py-3 px-4 text-[0.9rem]"
                onClick={handleCreateQuickClient}
                disabled={!quickNombre || !quickApellido || !quickTelefono || !quickDni || createClientMutation.isPending}
              >
                {createClientMutation.isPending ? 'Creando...' : 'Guardar y seleccionar'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Service Selector (multi) ── */}
        <div className="mb-5">
          <label className="block font-semibold text-[0.9rem] text-[var(--text)] mb-1.5">Servicios (podés elegir varios)</label>
          <div className="flex flex-col gap-2">
            {services.length === 0 ? (
              <p className="text-[var(--muted)] text-[0.9rem]">No hay servicios activos.</p>
            ) : (
              services.map((s: any) => {
                const isSelected = selectedServiceIds.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={`service-pick-row ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleService(s.id)}
                      className="service-pick-checkbox"
                    />
                    <span className="flex-1">{s.nombre_servicio}</span>
                    <span className="text-[var(--muted)] text-[0.85rem]">
                      ${s.precio_actual} &middot; {s.duracion_minutos} min
                    </span>
                  </label>
                )
              })
            )}
          </div>
          {selectedServiceIds.length > 0 && (
            <p className="text-[0.85rem] text-[var(--muted)] mt-2">
              {selectedServiceIds.length} servicio{selectedServiceIds.length !== 1 ? 's' : ''} seleccionado{selectedServiceIds.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── Step 3: Date and Time ── */}
        <div className="mb-5">
          <label className="block font-semibold text-[0.9rem] text-[var(--text)] mb-1.5">Fecha y hora</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={appointmentDate}
              onChange={e => setAppointmentDate(e.target.value)}
              className="modal-input"
            />
            <input
              type="time"
              value={appointmentTime}
              onChange={e => setAppointmentTime(e.target.value)}
              className="modal-input"
            />
          </div>
        </div>

        {/* ── Step 4: Toggles ── */}
        <div className="mb-5 flex flex-col md:flex-row gap-5">
          <div>
            <label className="block font-semibold text-[0.9rem] mb-2 text-[var(--text)]">Estado</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEstadoCita(null)}
                className={`pill-toggle ${estadoCita === null ? 'selected' : ''}`}
              >
                Pendiente
              </button>
              <button
                type="button"
                onClick={() => setEstadoCita('Confirmado')}
                className={`pill-toggle ${estadoCita === 'Confirmado' ? 'selected' : ''}`}
              >
                Confirmado
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[0.9rem] mb-2 text-[var(--text)]">Pago seña</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMetodoPago('Transferencia')}
                className={`pill-toggle ${metodoPago === 'Transferencia' ? 'selected' : ''}`}
              >
                Transferencia
              </button>
              <button
                type="button"
                onClick={() => setMetodoPago('Efectivo')}
                className={`pill-toggle ${metodoPago === 'Efectivo' ? 'selected' : ''}`}
              >
                Efectivo
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary ── */}
        {selectedServiceIds.length > 0 && appointmentDate && appointmentTime && selectedClient && (
          <div className="summary-block mb-5">
            <p className="my-1"><strong>Clienta:</strong> {selectedClient.nombre} {selectedClient.apellido}</p>
            <p className="my-1"><strong>Fecha:</strong> {appointmentDate} a las {appointmentTime}</p>
            {(() => {
              const selected = getSelectedServices()
              const total = selected.reduce((sum: number, s: any) => sum + s.precio_actual, 0)
              const sena = selected.reduce((sum: number, s: any) => sum + s.monto_sena_actual, 0)
              return selected.length > 0 ? (
                <>
                  {selected.map((s: any) => (
                    <p key={s.id} className="my-0.5"><strong>Servicio:</strong> {s.nombre_servicio} — ${s.precio_actual}</p>
                  ))}
                  <p className="my-1"><strong>Total:</strong> ${total}</p>
                  <p className="my-1"><strong>Seña:</strong> ${sena} ({metodoPago})</p>
                </>
              ) : null
            })()}
            <p className="my-1"><strong>Estado:</strong> {estadoCita || 'Pendiente'}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="button"
          className="button-primary"
          onClick={handleSubmit}
          disabled={!isFormValid() || createAppointmentMutation.isPending}
        >
          {createAppointmentMutation.isPending ? 'Guardando...' : 'Guardar Turno'}
        </button>
      </div>
    </div>
  )
}
