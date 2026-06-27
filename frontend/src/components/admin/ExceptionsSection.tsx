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
    <>
      <h3>Excepciones</h3>
      {exceptionMessage && <div className="status-notice success">{exceptionMessage}</div>}

      <div className="flex gap-2 flex-col sm:flex-row flex-wrap items-start sm:items-center mb-4">
        <input
          type="date"
          value={exceptionDate}
          onChange={e => setExceptionDate(e.target.value)}
          className="py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
        />
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={exceptionCerrado} onChange={e => setExceptionCerrado(e.target.checked)} />
          Cerrado
        </label>
        {!exceptionCerrado && (
          <>
            <select
              value={exceptionApertura}
              onChange={e => setExceptionApertura(e.target.value)}
              className="py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span>a</span>
            <select
              value={exceptionCierre}
              onChange={e => setExceptionCierre(e.target.value)}
              className="py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
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
        <ul className="list-none p-0">
          {exceptions.map((exc) => {
            const fecha = new Date(exc.fecha + 'T00:00:00')
            const fechaStr = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            return (
              <li key={exc.id} className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                <span>
                  <strong>{fechaStr}</strong>
                  {exc.cerrado
                    ? ' — Cerrado'
                    : ` — ${exc.hora_apertura} a ${exc.hora_cierre}`
                  }
                </span>
                <button
                  type="button"
                  className="danger py-1 px-3 text-sm"
                  onClick={() => handleDeleteException(exc.id)}
                >
                  Eliminar
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
