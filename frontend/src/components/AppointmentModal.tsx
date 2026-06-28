import React, { useState } from 'react'
import { getStatusColor, getStatusVar } from '../lib/statusColors'
import { formatDate, formatTime } from '../lib/datetime'

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

export default function AppointmentModal({ cita, onClose, onSave, onMarkAttended, onStatusChange, onDelete, isPending, error }: AppointmentModalProps) {
  // Status badge color comes from the shared module. The fallback to
  // getStatusVar() returns a CSS-var reference for unknown statuses.
  const statusColor = getStatusColor(cita.estado_cita) || getStatusVar(cita.estado_cita)
  // The warm-gold --status-pending fails AA on white; use a dark text
  // when the badge sits on a pending background.
  const isPendingStatus = cita.estado_cita === 'Pendiente'
  const statusTextColor = isPendingStatus ? 'var(--on-background)' : 'var(--on-primary)'
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="m-0 text-1.25rem">
              {cita.cliente_nombre || `Cliente #${cita.id_cliente}`}
            </h3>
            {editing && <span className="text-xs text-[var(--primary)] font-semibold">✏️ Modo edición</span>}
          </div>
          <button type="button" onClick={onClose} className="bg-none border-none text-1.5rem cursor-pointer leading-none py-1 px-2 rounded">&times;</button>
        </div>

        {displayError && (
          <div className="bg-[var(--status-cancelled)]/10 text-[var(--status-cancelled)] py-2 px-3 rounded-md mb-3 text-[0.9rem]">
            {displayError}
          </div>
        )}

        {editing ? (
          /* ── EDIT MODE ── */
          <div>
            <div className="mb-4">
              <label className="block mb-1 font-medium text-[0.9rem]">Fecha y hora</label>
              <input
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="modal-input"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1 font-medium text-[0.9rem]">Precio total ($)</label>
              <input
                type="number"
                value={editPrecio}
                onChange={(e) => setEditPrecio(e.target.value)}
                className="modal-input"
                min={0}
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1 font-medium text-[0.9rem]">Seña pagada ($)</label>
              <input
                type="number"
                value={editSena}
                onChange={(e) => setEditSena(e.target.value)}
                className="modal-input"
                min={0}
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1 font-medium text-[0.9rem]">Método de pago (seña)</label>
              <select value={editMetodoPago} onChange={(e) => setEditMetodoPago(e.target.value)} className="modal-input">
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Ninguno">Ninguno</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mb-5 font-medium text-[0.9rem]">
              <input
                type="checkbox"
                checked={editVerificadoManual}
                onChange={(e) => setEditVerificadoManual(e.target.checked)}
              />
              Comprobante verificado manualmente (sin comprobante)
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                className="button-primary flex-1"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="py-3 px-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <>
            <div className="mb-4">
              <p className="my-1"><strong>Teléfono:</strong> {cita.id_cliente}</p>
              <p className="my-1">
                <strong>Fecha:</strong>{' '}
                {formatDate(cita.fecha_hora_cita)}
              </p>
              <p className="my-1">
                <strong>Horario:</strong>{' '}
                {formatTime(cita.fecha_hora_cita) || '--:--'}
              </p>
              <p className="my-1">
                <strong>Duración:</strong> {cita.duracion_total_minutos} min
              </p>
              <p className="my-1">
                <strong>Estado:</strong>{' '}
                <span
                  className="inline-block py-0.5 px-2 rounded text-[0.85rem] font-semibold"
                  style={{ backgroundColor: statusColor, color: statusTextColor }}
                >
                  {cita.estado_cita}
                </span>
              </p>
              {cita.comprobante_verificado_manual && (
                <p className="my-1 text-[var(--status-pending)] text-[0.85rem]">
                  ✓ Pago verificado manualmente
                </p>
              )}
            </div>

            {cita.servicios.length > 0 && (
              <div className="mb-4">
                <h4 className="mt-0 mb-2 text-1rem">Servicios</h4>
                <table className="w-full border-collapse text-[0.9rem]">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-1 px-2">Servicio</th>
                      <th className="text-center py-1 px-2">Duración</th>
                      <th className="text-right py-1 px-2">Precio</th>
                      <th className="text-right py-1 px-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cita.servicios.map((s) => (
                      <tr key={s.servicio_id} className="border-b border-[var(--border)]">
                        <td className="py-1 px-2">{s.nombre_servicio}</td>
                        <td className="text-center py-1 px-2">{s.duracion_minutos} min</td>
                        <td className="text-right py-1 px-2">${s.precio_unitario.toFixed(2)}</td>
                        <td className="text-right py-1 px-2">${s.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mb-4">
              <p className="my-1"><strong>Total:</strong> ${cita.precio_historico_cobrado.toFixed(2)}</p>
              <p className="my-1">
                <strong>Seña pagada:</strong> ${cita.sena_historica_pagada.toFixed(2)} ({cita.metodo_pago_sena})
              </p>
              <p className="my-1"><strong>Saldo restante:</strong> ${balance.toFixed(2)}</p>
              <p className="my-1">
                <strong>Recibido en caja:</strong> ${cita.monto_recibido_en_caja.toFixed(2)}
              </p>
            </div>

            {isConfirmado && (
              <button
                type="button"
                className="button-primary w-full mb-3"
                onClick={() => onMarkAttended(cita)}
              >
                Marcar como Asistido
              </button>
            )}

            {/* ── Editar button ── */}
            <button
              type="button"
              className="w-full py-3 px-5 rounded-lg border border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] font-semibold cursor-pointer text-[0.95rem] mb-3"
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

            <div className="flex flex-col gap-2">
              <label className="font-medium text-[0.9rem]">Cambiar estado</label>
              <select
                value={cita.estado_cita}
                onChange={(e) => onStatusChange?.(cita.id, e.target.value)}
                className="modal-input"
              >
                {statusActions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <button
                type="button"
                className="w-full py-2.5 px-5 rounded-lg border border-[var(--status-cancelled)] bg-[var(--status-cancelled)]/10 text-[var(--status-cancelled)] font-semibold cursor-pointer text-[0.9rem]"
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
