import React from 'react'

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

interface MarkAttendedModalProps {
  cita: CitaRead
  onClose: () => void
  onConfirm: (appointmentId: number, montoRecibido: number) => void
  isPending?: boolean
  error?: string | null
}

export default function MarkAttendedModal({ cita, onClose, onConfirm, isPending = false, error = null }: MarkAttendedModalProps) {
  const [monto, setMonto] = React.useState<number>(cita.precio_historico_cobrado)
  const balance = cita.precio_historico_cobrado - cita.sena_historica_pagada

  function handleConfirm() {
    onConfirm(cita.id, monto)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="m-0 text-[1.25rem] font-[var(--font-display)]">
            Marcar como Asistido
          </h3>
          <button type="button" onClick={onClose} className="bg-none border-none text-1.5rem cursor-pointer leading-none py-1 px-2 rounded">&times;</button>
        </div>

        <p className="mb-4 text-[var(--text-secondary)]">
          {cita.cliente_nombre || `Cliente #${cita.id_cliente}`} — {new Date(cita.fecha_hora_cita).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>

        <div className="mb-4">
          <div className="flex justify-between items-center py-1 text-[0.95rem]">
            <span>Precio total</span>
            <span className="font-semibold">${cita.precio_historico_cobrado.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 text-[0.95rem]">
            <span>Seña pagada</span>
            <span className="font-semibold text-[var(--text-secondary)]">
              -${cita.sena_historica_pagada.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-t border-[var(--border)] pt-2 text-[0.95rem]">
            <span>Saldo restante</span>
            <span className="font-bold text-[1.1rem]">${balance.toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-1.5 font-medium text-[0.9rem]">
            Monto recibido en caja
          </label>
          <input
            type="number"
            step={0.01}
            min={0}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            className="modal-input font-semibold text-base"
          />
        </div>

        {error && (
          <div className="text-[#EF4444] text-[0.9rem] mb-3 py-2 px-3 bg-[#FEF2F2] rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            className="button-primary flex-1"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Guardando...' : 'Confirmar asistencia'}
          </button>
          <button
            type="button"
            className="px-5 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-semibold cursor-pointer"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
        </div>

        {error && (
          <button
            type="button"
            className="mt-2 w-full py-2.5 px-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-semibold cursor-pointer"
            onClick={handleConfirm}
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}
