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
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
            Marcar como Asistido
          </h3>
          <button type="button" onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        <p style={{ marginBottom: 16, color: 'var(--text-secondary, #64748b)' }}>
          {cita.cliente_nombre || `Cliente #${cita.id_cliente}`} — {new Date(cita.fecha_hora_cita).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>

        <div style={{ marginBottom: 16 }}>
          <div style={rowStyle}>
            <span>Precio total</span>
            <span style={{ fontWeight: 600 }}>${cita.precio_historico_cobrado.toFixed(2)}</span>
          </div>
          <div style={rowStyle}>
            <span>Seña pagada</span>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
              -${cita.sena_historica_pagada.toFixed(2)}
            </span>
          </div>
          <div style={{ ...rowStyle, borderTop: '1.5px solid var(--border, #e2e8f0)', paddingTop: 8 }}>
            <span>Saldo restante</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>${balance.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.9rem' }}>
            Monto recibido en caja
          </label>
          <input
            type="number"
            step={0.01}
            min={0}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1.5px solid var(--border, #e2e8f0)',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 600,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#EF4444', fontSize: '0.9rem', marginBottom: 12, padding: '8px 12px', backgroundColor: '#FEF2F2', borderRadius: 6 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="button-primary"
            style={{ flex: 1, padding: '12px 20px' }}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Guardando...' : 'Confirmar asistencia'}
          </button>
          <button
            type="button"
            style={{ padding: '12px 20px', borderRadius: '6px', border: '1.5px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', fontWeight: 600, cursor: 'pointer' }}
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
        </div>

        {error && (
          <button
            type="button"
            style={{ marginTop: 8, width: '100%', padding: '10px 20px', borderRadius: '6px', border: '1.5px solid var(--border, #e2e8f0)', background: 'var(--surface, #fff)', fontWeight: 600, cursor: 'pointer' }}
            onClick={handleConfirm}
          >
            Reintentar
          </button>
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
  zIndex: 1100,
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  fontSize: '0.95rem',
}