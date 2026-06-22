import React, { useState } from 'react'
import { useServices } from '../hooks'

interface AppointmentService {
  servicio_id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_unitario: number
  subtotal: number
}

interface CitaRead {
  id: number
  id_cliente: number
  cliente_nombre?: string
  fecha_hora_cita: string
  precio_historico_cobrado: number
  sena_historica_pagada: number
  comprobante_transferencia_url?: string
  comprobante_verificado_manual: boolean
  monto_recibido_en_caja: number
  estado_cita: string
  metodo_pago_sena: string
  fecha_registro_cita: string
  duracion_total_minutos: number
  servicios: AppointmentService[]
}

interface AppointmentModalProps {
  cita: CitaRead
  onClose: () => void
  onSave: (appointmentId: number, payload: Record<string, unknown>) => void
  onMarkAttended: (cita: CitaRead) => void
  onStatusChange?: (id: number, estado: string) => void
  onDelete?: (id: number) => void
  isPending?: boolean
  error?: string | null
}

const statusActions = ['Pendiente', 'Confirmado', 'Cancelado_Cliente']

const STATUS_COLORS: Record<string, string> = {
  Pendiente: '#F59E0B',
  Confirmado: '#10B981',
  Asistido: '#6B7280',
  Cancelado_Cliente: '#EF4444',
  Cancelado_Sistema_Vencimiento: '#EF4444',
}

const DEFAULT_COLOR = '#6B7280'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid var(--border, #e2e8f0)',
  borderRadius: '6px',
  fontSize: '0.95rem',
  background: 'var(--surface, #fff)',
  boxSizing: 'border-box',
}

export default function AppointmentModal({ cita, onClose, onSave, onMarkAttended, onStatusChange, onDelete, isPending, error }: AppointmentModalProps) {
  const statusColor = STATUS_COLORS[cita.estado_cita] || DEFAULT_COLOR
  const balance = cita.precio_historico_cobrado - cita.sena_historica_pagada
  const isConfirmado = cita.estado_cita === 'Confirmado'
  const [editing, setEditing] = useState(false)

  // Edit form state
  const originalDate = cita.fecha_hora_cita.slice(0, 16)
  const [editDate, setEditDate] = useState(originalDate)
  const [editPrecio, setEditPrecio] = useState(String(cita.precio_historico_cobrado))
  const [editSena, setEditSena] = useState(String(cita.sena_historica_pagada))
  const [editMetodoPago, setEditMetodoPago] = useState(cita.metodo_pago_sena)
  const [editVerificadoManual, setEditVerificadoManual] = useState(cita.comprobante_verificado_manual)
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleSave() {
    setSaveError(null)
    const payload: Record<string, unknown> = {}

    if (editDate !== originalDate) {
      payload.fecha_hora_cita = editDate + ':00'
    }
    if (Number(editPrecio) !== cita.precio_historico_cobrado) {
      payload.precio_historico_cobrado = Number(editPrecio)
    }
    if (Number(editSena) !== cita.sena_historica_pagada) {
      payload.sena_historica_pagada = Number(editSena)
    }
    if (editMetodoPago !== cita.metodo_pago_sena) {
      payload.metodo_pago_sena = editMetodoPago
    }
    if (editVerificadoManual !== cita.comprobante_verificado_manual) {
      payload.comprobante_verificado_manual = editVerificadoManual
    }

    if (Object.keys(payload).length === 0) {
      setEditing(false)
      return
    }

    onSave(cita.id, payload)
    setEditing(false)
  }

  const displayError = error || saveError

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
              {cita.cliente_nombre || `Cliente #${cita.id_cliente}`}
            </h3>
            {editing && <span style={{ fontSize: '0.8rem', color: 'var(--primary, #7A1F4A)', fontWeight: 600 }}>✏️ Modo edición</span>}
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {displayError && (
          <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: '0.9rem' }}>
            {displayError}
          </div>
        )}

        {editing ? (
          /* ── EDIT MODE ── */
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 500, fontSize: '0.9rem', display: 'block', marginBottom: 4 }}>Fecha y hora</label>
              <input
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 500, fontSize: '0.9rem', display: 'block', marginBottom: 4 }}>Precio total ($)</label>
              <input
                type="number"
                value={editPrecio}
                onChange={(e) => setEditPrecio(e.target.value)}
                style={inputStyle}
                min={0}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 500, fontSize: '0.9rem', display: 'block', marginBottom: 4 }}>Seña pagada ($)</label>
              <input
                type="number"
                value={editSena}
                onChange={(e) => setEditSena(e.target.value)}
                style={inputStyle}
                min={0}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 500, fontSize: '0.9rem', display: 'block', marginBottom: 4 }}>Método de pago (seña)</label>
              <select value={editMetodoPago} onChange={(e) => setEditMetodoPago(e.target.value)} style={inputStyle}>
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Ninguno">Ninguno</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20, fontWeight: 500, fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={editVerificadoManual}
                onChange={(e) => setEditVerificadoManual(e.target.checked)}
              />
              Comprobante verificado manualmente (sin comprobante)
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="button-primary"
                style={{ flex: 1 }}
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{ padding: '12px 20px', borderRadius: '6px', border: '1.5px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <>
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '4px 0' }}><strong>Teléfono:</strong> {cita.id_cliente}</p>
              <p style={{ margin: '4px 0' }}>
                <strong>Fecha:</strong>{' '}
                {new Date(cita.fecha_hora_cita).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>Horario:</strong>{' '}
                {new Date(cita.fecha_hora_cita).toLocaleTimeString('es-AR', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>Duración:</strong> {cita.duracion_total_minutos} min
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>Estado:</strong>{' '}
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, backgroundColor: statusColor, color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                  {cita.estado_cita}
                </span>
              </p>
              {cita.comprobante_verificado_manual && (
                <p style={{ margin: '4px 0', color: '#F59E0B', fontSize: '0.85rem' }}>
                  ✓ Pago verificado manualmente
                </p>
              )}
            </div>

            {cita.servicios.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Servicios</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Servicio</th>
                      <th style={{ textAlign: 'center', padding: '4px 8px' }}>Duración</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Precio</th>
                      <th style={{ textAlign: 'right', padding: '4px 8px' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cita.servicios.map((s) => (
                      <tr key={s.servicio_id} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <td style={{ padding: '4px 8px' }}>{s.nombre_servicio}</td>
                        <td style={{ textAlign: 'center', padding: '4px 8px' }}>{s.duracion_minutos} min</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>${s.precio_unitario.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>${s.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '4px 0' }}><strong>Total:</strong> ${cita.precio_historico_cobrado.toFixed(2)}</p>
              <p style={{ margin: '4px 0' }}>
                <strong>Seña pagada:</strong> ${cita.sena_historica_pagada.toFixed(2)} ({cita.metodo_pago_sena})
              </p>
              <p style={{ margin: '4px 0' }}><strong>Saldo restante:</strong> ${balance.toFixed(2)}</p>
              <p style={{ margin: '4px 0' }}>
                <strong>Recibido en caja:</strong> ${cita.monto_recibido_en_caja.toFixed(2)}
              </p>
            </div>

            {isConfirmado && (
              <button
                type="button"
                className="button-primary"
                style={{ width: '100%', padding: '12px 20px', marginBottom: 12 }}
                onClick={() => onMarkAttended(cita)}
              >
                Marcar como Asistido
              </button>
            )}

            {/* ── Editar button ── */}
            <button
              type="button"
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '6px',
                border: '1.5px solid var(--primary, #7A1F4A)',
                background: 'var(--primary-light, #F0E4EA)',
                color: 'var(--primary, #7A1F4A)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.95rem',
                marginBottom: 12,
              }}
              onClick={() => {
                setEditDate(cita.fecha_hora_cita.slice(0, 16))
                setEditPrecio(String(cita.precio_historico_cobrado))
                setEditSena(String(cita.sena_historica_pagada))
                setEditMetodoPago(cita.metodo_pago_sena)
                setEditVerificadoManual(cita.comprobante_verificado_manual)
                setSaveError(null)
                setEditing(true)
              }}
            >
              ✏️ Editar datos
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Cambiar estado</label>
              <select
                value={cita.estado_cita}
                onChange={(e) => onStatusChange?.(cita.id, e.target.value)}
                style={inputStyle}
              >
                {statusActions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1.5px solid #EF4444',
                  background: '#FEF2F2',
                  color: '#EF4444',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
                onClick={() => {
                  if (window.confirm('¿Eliminar esta cita definitivamente? Esta acción no se puede deshacer.')) {
                    onDelete?.(cita.id)
                  }
                }}
              >
                Eliminar cita
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
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
  borderRadius: 12,
  padding: 24,
  maxWidth: 500,
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.5rem',
  cursor: 'pointer',
  lineHeight: 1,
  padding: '4px 8px',
  borderRadius: 4,
}
