import React, { useState, useEffect } from 'react'
import {
  useClientsList,
  useClient,
  useUpdateClient,
  useDeleteClient,
  useReactivateClient,
  useAddPhone,
  useUpdatePhone,
  useDeletePhone,
  useClientAppointments,
} from '../hooks'
import { useFormValidation } from '../hooks/useFormValidation'
import FieldError from './FieldError'
import type { ClienteRead, ClienteTelefonoRead, CitaRead } from '../api'
import DataTable from './DataTable'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\d{10,11}$/

function getPrimaryPhone(client: ClienteRead): string {
  const primary = client.telefonos.find(t => t.es_principal)
  return primary?.telefono || client.telefonos[0]?.telefono || '—'
}

function formatAppointmentDate(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso)
  const fecha = d.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const hora = d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  })
  return { fecha, hora }
}

function statusClass(estado: string): string {
  if (estado === 'Asistido') return 'status-asistido'
  if (estado === 'Pendiente') return 'status-pendiente'
  if (estado === 'Confirmado') return 'status-confirmado'
  return 'status-cancelado'
}

export default function ClientSection() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)

  // Edit form state
  const editForm = useFormValidation({
    nombre: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El nombre es requerido.' },
      ],
    },
    apellido: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El apellido es requerido.' },
      ],
    },
    dni: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El DNI es requerido.' },
        { validate: (v: string) => /^\d+$/.test(v.trim()), message: 'El DNI debe contener solo dígitos.' },
      ],
    },
    telefono: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length > 0, message: 'El teléfono es requerido.' },
        { validate: (v: string) => PHONE_RE.test(v.trim()), message: 'Formato de teléfono inválido (10-11 dígitos).' },
      ],
    },
    email: {
      initial: '',
      rules: [
        { validate: (v: string) => v.trim().length === 0 || EMAIL_RE.test(v.trim()), message: 'Email inválido.' },
      ],
    },
  })

  // Add phone form state
  const [addPhoneNumber, setAddPhoneNumber] = useState('')
  const [addPhoneLabel, setAddPhoneLabel] = useState('')

  // Edit phone label state
  const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null)
  const [editPhoneLabel, setEditPhoneLabel] = useState('')

  // Messages
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Debounce search query (300ms)
  useEffect(() => {
    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
      return () => clearTimeout(timer)
    }
    setDebouncedQuery('')
  }, [searchQuery])

  const { data: clients = [], isLoading } = useClientsList(debouncedQuery, showInactive)
  const { data: clientDetail } = useClient(selectedClientId)
  const { data: appointments = [] } = useClientAppointments(selectedClientId)

  const updateClientMutation = useUpdateClient()
  const deleteClientMutation = useDeleteClient()
  const reactivateClientMutation = useReactivateClient()
  const addPhoneMutation = useAddPhone()
  const updatePhoneMutation = useUpdatePhone()
  const deletePhoneMutation = useDeletePhone()

  // Populate edit form when selected client loads
  useEffect(() => {
    if (clientDetail) {
      editForm.setFields({
        nombre: clientDetail.nombre,
        apellido: clientDetail.apellido,
        dni: clientDetail.dni,
        telefono: clientDetail.telefonos.find(t => t.es_principal)?.telefono || clientDetail.telefonos[0]?.telefono || '',
        email: '',
      })
    }
  }, [clientDetail])

  const selectedClient = clientDetail || clients.find(c => c.id === selectedClientId)

  function selectClient(client: ClienteRead) {
    setSelectedClientId(client.id)
    editForm.setFields({
      nombre: client.nombre,
      apellido: client.apellido,
      dni: client.dni,
      telefono: client.telefonos.find(t => t.es_principal)?.telefono || client.telefonos[0]?.telefono || '',
      email: '',
    })
    setMessage(null)
  }

  function handleSaveEdit() {
    if (!selectedClientId) return
    if (!editForm.validate()) return
    setMessage(null)
    const { nombre, apellido, dni } = editForm.values
    updateClientMutation.mutate(
      { id: selectedClientId, payload: { nombre, apellido, dni } },
      {
        onSuccess: () => {
          setMessage('Datos actualizados.')
          setMessageType('success')
        },
        onError: (err: any) => {
          setMessage(err?.response?.data?.detail || 'Error al actualizar los datos.')
          setMessageType('error')
        },
      },
    )
  }

  function handleDeleteClient() {
    if (!selectedClientId) return
    if (!window.confirm('Desactivar esta clienta? Podras reactivarla despues.')) return
    deleteClientMutation.mutate(selectedClientId, {
      onSuccess: () => {
        setMessage('Clienta desactivada.')
        setMessageType('success')
      },
      onError: () => {
        setMessage('Error al desactivar la clienta.')
        setMessageType('error')
      },
    })
  }

  function handleReactivateClient() {
    if (!selectedClientId) return
    reactivateClientMutation.mutate(selectedClientId, {
      onSuccess: () => {
        setMessage('Clienta reactivada.')
        setMessageType('success')
      },
      onError: () => {
        setMessage('Error al reactivar la clienta.')
        setMessageType('error')
      },
    })
  }

  function handleAddPhone() {
    if (!selectedClientId || !addPhoneNumber) return
    const digits = addPhoneNumber.replace(/\D/g, '')
    if (digits.length < 7) {
      setMessage('El telefono debe tener al menos 7 digitos.')
      setMessageType('error')
      return
    }
    addPhoneMutation.mutate(
      { clientId: selectedClientId, payload: { telefono: digits, etiqueta: addPhoneLabel || null } },
      {
        onSuccess: () => {
          setAddPhoneNumber('')
          setAddPhoneLabel('')
          setMessage('Telefono agregado.')
          setMessageType('success')
        },
        onError: (err: any) => {
          setMessage(err?.response?.data?.detail || 'Error al agregar el telefono.')
          setMessageType('error')
        },
      },
    )
  }

  function handleEditPhoneLabel(phone: ClienteTelefonoRead) {
    setEditingPhoneId(phone.id)
    setEditPhoneLabel(phone.etiqueta || '')
  }

  function handleSavePhoneLabel(phoneId: number) {
    if (!selectedClientId) return
    updatePhoneMutation.mutate(
      { clientId: selectedClientId, phoneId, payload: { etiqueta: editPhoneLabel || null } },
      {
        onSuccess: () => {
          setEditingPhoneId(null)
          setEditPhoneLabel('')
        },
        onError: (err: any) => {
          setMessage(err?.response?.data?.detail || 'Error al actualizar la etiqueta.')
          setMessageType('error')
        },
      },
    )
  }

  function handleSetPrincipal(phoneId: number) {
    if (!selectedClientId) return
    updatePhoneMutation.mutate(
      { clientId: selectedClientId, phoneId, payload: { es_principal: true } },
      {
        onError: (err: any) => {
          setMessage(err?.response?.data?.detail || 'Error al cambiar el principal.')
          setMessageType('error')
        },
      },
    )
  }

  function handleDeletePhone(phoneId: number) {
    if (!selectedClientId) return
    if (!window.confirm('Eliminar este telefono?')) return
    deletePhoneMutation.mutate(
      { clientId: selectedClientId, phoneId },
      {
        onError: (err: any) => {
          setMessage(err?.response?.data?.detail || 'Error al eliminar el telefono.')
          setMessageType('error')
        },
      },
    )
  }

  return (
    <div className="client-section">
      {message && (
        <div className={`status-notice ${messageType}`} style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div className="client-section-layout">
        {/* ── Left: Search + List ── */}
        <div className="client-list-panel">
          <div className="client-search-bar">
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, DNI o telefono..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <label className="checkbox-row" style={{ marginTop: 12, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>

          <DataTable
            columns={[
              { key: 'nombre', label: 'Nombre', sortable: true, filterable: true },
              { key: 'apellido', label: 'Apellido', sortable: true, filterable: true },
              { key: 'dni', label: 'DNI', filterable: true },
              {
                key: '_telefono',
                label: 'Tel\u00E9fono',
                filterable: true,
                filterValue: (c: ClienteRead) => getPrimaryPhone(c),
                render: (_v: any, c: ClienteRead) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>{getPrimaryPhone(c)}</span>
                ),
              },
              { key: 'cantidad_turnos_tomados', label: 'Turnos', sortable: true },
              {
                key: 'actions',
                label: '',
                render: (_v: any, c: ClienteRead) => (
                  <button
                    type="button"
                    className="client-view-btn"
                    onClick={() => selectClient(c)}
                  >
                    Ver
                  </button>
                ),
              },
            ]}
            data={clients}
            keyExtractor={(c: ClienteRead) => c.id}
            isLoading={isLoading}
            emptyMessage={
              debouncedQuery.length >= 2
                ? 'No se encontraron clientas.'
                : 'No hay clientas registradas.'
            }
            searchPlaceholder="Buscar en resultados..."
            pageSize={20}
          />
        </div>

        {/* ── Right: Client Detail ── */}
        <div className="client-detail-panel">
          {selectedClient ? (
            <>
              <div className="client-detail-header">
                <h4>
                  {selectedClient.nombre} {selectedClient.apellido}
                </h4>
                <span
                  className={`client-status-badge ${selectedClient.activo ? 'active' : 'inactive'}`}
                >
                  {selectedClient.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Edit form */}
              <div className="client-edit-form">
                <div className="client-edit-row two-cols">
                  <label>
                    Nombre
                    <input
                      value={editForm.values.nombre}
                      onChange={(e) => editForm.setField('nombre', e.target.value)}
                      className={editForm.touched.nombre && editForm.errors.nombre ? 'input-error' : ''}
                    />
                    <FieldError name="nombre" errors={editForm.errors} touched={editForm.touched} />
                  </label>
                  <label>
                    Apellido
                    <input
                      value={editForm.values.apellido}
                      onChange={(e) => editForm.setField('apellido', e.target.value)}
                      className={editForm.touched.apellido && editForm.errors.apellido ? 'input-error' : ''}
                    />
                    <FieldError name="apellido" errors={editForm.errors} touched={editForm.touched} />
                  </label>
                </div>
                <div className="client-edit-row two-cols">
                  <label>
                    DNI
                    <input
                      value={editForm.values.dni}
                      onChange={(e) => editForm.setField('dni', e.target.value)}
                      className={editForm.touched.dni && editForm.errors.dni ? 'input-error' : ''}
                    />
                    <FieldError name="dni" errors={editForm.errors} touched={editForm.touched} />
                  </label>
                  <label>
                    Teléfono
                    <input
                      value={editForm.values.telefono}
                      onChange={(e) => editForm.setField('telefono', e.target.value)}
                      placeholder="3411234567"
                      className={editForm.touched.telefono && editForm.errors.telefono ? 'input-error' : ''}
                    />
                    <FieldError name="telefono" errors={editForm.errors} touched={editForm.touched} />
                  </label>
                </div>
                <div className="client-edit-row">
                  <label>
                    Email (opcional)
                    <input
                      type="email"
                      value={editForm.values.email}
                      onChange={(e) => editForm.setField('email', e.target.value)}
                      placeholder="cliente@email.com"
                      className={editForm.touched.email && editForm.errors.email ? 'input-error' : ''}
                    />
                    <FieldError name="email" errors={editForm.errors} touched={editForm.touched} />
                  </label>
                </div>
                <div className="client-edit-actions">
                  <button
                    className="button-primary"
                    style={{ width: 'auto', padding: '8px 20px', fontSize: '.85rem' }}
                    onClick={handleSaveEdit}
                    disabled={updateClientMutation.isPending || !editForm.isValid}
                  >
                    {updateClientMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                  </button>

                  {selectedClient.activo ? (
                    <button
                      className="action-btn danger"
                      onClick={handleDeleteClient}
                      disabled={deleteClientMutation.isPending}
                    >
                      {deleteClientMutation.isPending ? 'Desactivando...' : 'Desactivar'}
                    </button>
                  ) : (
                    <button
                      className="action-btn reactivate"
                      onClick={handleReactivateClient}
                      disabled={reactivateClientMutation.isPending}
                    >
                      {reactivateClientMutation.isPending ? 'Reactivando...' : 'Reactivar'}
                    </button>
                  )}
                </div>
              </div>

              {/* Phones */}
              <div className="client-subsection">
                <h5>Telefonos</h5>
                {selectedClient.telefonos.length === 0 ? (
                  <p className="client-empty-state">Sin telefonos registrados.</p>
                ) : (
                  <ul className="client-phones-list">
                    {selectedClient.telefonos.map((phone) => (
                      <li key={phone.id} className="client-phone-item">
                        <span className="client-phone-number">
                          {phone.es_principal && (
                            <span className="principal-indicator" title="Principal">*</span>
                          )}
                          {phone.telefono}
                          {phone.etiqueta && (
                            <span className="phone-label">{phone.etiqueta}</span>
                          )}
                          {phone.es_principal && (
                            <span className="principal-text">Principal</span>
                          )}
                        </span>

                        {editingPhoneId === phone.id ? (
                          <div className="phone-edit-inline">
                            <input
                              type="text"
                              value={editPhoneLabel}
                              onChange={(e) => setEditPhoneLabel(e.target.value)}
                              placeholder="Etiqueta"
                            />
                            <button
                              className="action-btn small"
                              onClick={() => handleSavePhoneLabel(phone.id)}
                            >
                              Guardar
                            </button>
                            <button
                              className="action-btn small muted"
                              onClick={() => setEditingPhoneId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="client-phone-actions">
                            <button
                              className="action-btn small"
                              onClick={() => handleEditPhoneLabel(phone)}
                              title="Editar etiqueta"
                            >
                              Editar
                            </button>
                            {!phone.es_principal && (
                              <button
                                className="action-btn small"
                                onClick={() => handleSetPrincipal(phone.id)}
                                title="Marcar como principal"
                              >
                                Principal
                              </button>
                            )}
                            {!phone.es_principal && (
                              <button
                                className="action-btn small danger"
                                onClick={() => handleDeletePhone(phone.id)}
                                title="Eliminar telefono"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="client-add-phone">
                  <input
                    type="text"
                    placeholder="Nuevo telefono..."
                    value={addPhoneNumber}
                    onChange={(e) => setAddPhoneNumber(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Etiqueta (opcional)"
                    value={addPhoneLabel}
                    onChange={(e) => setAddPhoneLabel(e.target.value)}
                  />
                  <button
                    className="button-primary"
                    style={{ width: 'auto', padding: '8px 16px', fontSize: '.85rem' }}
                    onClick={handleAddPhone}
                    disabled={addPhoneMutation.isPending || !addPhoneNumber}
                  >
                    {addPhoneMutation.isPending ? 'Agregando...' : 'Agregar telefono'}
                  </button>
                </div>
              </div>

              {/* Appointment history */}
              <div className="client-subsection">
                <h5>Turnos ({appointments.length})</h5>
                {appointments.length === 0 ? (
                  <p className="client-empty-state">Sin turnos registrados.</p>
                ) : (
                  <div className="client-appts-table-wrap">
                    <table className="client-appts-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Servicios</th>
                          <th>Estado</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((cita: CitaRead) => {
                          const { fecha, hora } = formatAppointmentDate(cita.fecha_hora_cita)
                          return (
                            <tr key={cita.id}>
                              <td>{fecha}</td>
                              <td>{hora}</td>
                              <td>{cita.servicios.map((s) => s.nombre_servicio).join(', ')}</td>
                              <td>
                                <span className={`appt-status ${statusClass(cita.estado_cita)}`}>
                                  {cita.estado_cita}
                                </span>
                              </td>
                              <td>${cita.precio_historico_cobrado.toLocaleString('es-AR')}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="client-detail-empty">
              <p>Seleccione una clienta para ver sus datos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
