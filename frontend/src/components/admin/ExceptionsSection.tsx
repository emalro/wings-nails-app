import React from 'react'

type Exception = {
  id: number
  fecha: string
  cerrado: boolean
  hora_apertura: string | null
  hora_cierre: string | null
}

type ExceptionsSectionProps = {
  exceptionDate: string
  setExceptionDate: React.Dispatch<React.SetStateAction<string>>
  exceptionCerrado: boolean
  setExceptionCerrado: React.Dispatch<React.SetStateAction<boolean>>
  exceptionApertura: string
  setExceptionApertura: React.Dispatch<React.SetStateAction<string>>
  exceptionCierre: string
  setExceptionCierre: React.Dispatch<React.SetStateAction<string>>
  exceptionMessage: string | null
  exceptionsLoading: boolean
  exceptions: Exception[]
  createExceptionMutation: { isPending: boolean }
  handleAddException: () => void
  handleDeleteException: (id: number) => void
}

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

export default function ExceptionsSection({
  exceptionDate,
  setExceptionDate,
  exceptionCerrado,
  setExceptionCerrado,
  exceptionApertura,
  setExceptionApertura,
  exceptionCierre,
  setExceptionCierre,
  exceptionMessage,
  exceptionsLoading,
  exceptions,
  createExceptionMutation,
  handleAddException,
  handleDeleteException,
}: ExceptionsSectionProps) {
  return (
    <div className="admin-card" style={{ marginTop: 16 }}>
      <h3>Excepciones</h3>
      {exceptionMessage && <div className="status-notice success">{exceptionMessage}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          type="date"
          value={exceptionDate}
          onChange={e => setExceptionDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={exceptionCerrado} onChange={e => setExceptionCerrado(e.target.checked)} />
          Cerrado
        </label>
        {!exceptionCerrado && (
          <>
            <select
              value={exceptionApertura}
              onChange={e => setExceptionApertura(e.target.value)}
              style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)' }}
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span>a</span>
            <select
              value={exceptionCierre}
              onChange={e => setExceptionCierre(e.target.value)}
              style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)' }}
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        )}
        <button
          className="button-primary"
          onClick={handleAddException}
          disabled={createExceptionMutation.isPending || !exceptionDate}
        >
          {createExceptionMutation.isPending ? 'Agregando...' : 'Agregar'}
        </button>
      </div>

      {exceptionsLoading ? (
        <p>Cargando excepciones...</p>
      ) : exceptions.length === 0 ? (
        <p>No hay excepciones.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {exceptions.map((exc) => {
            const fecha = new Date(exc.fecha + 'T00:00:00')
            const fechaStr = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            return (
              <li key={exc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>
                  <strong>{fechaStr}</strong>
                  {exc.cerrado
                    ? ' — Cerrado'
                    : ` — ${exc.hora_apertura} a ${exc.hora_cierre}`
                  }
                </span>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDeleteException(exc.id)}
                  style={{ padding: '4px 12px', fontSize: '.85rem' }}
                >
                  Eliminar
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}