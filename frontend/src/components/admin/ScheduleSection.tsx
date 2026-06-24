import React from 'react'

type ScheduleForm = Record<number, { activo: boolean; hora_apertura: string; hora_cierre: string }>

type ScheduleSectionProps = {
  scheduleForm: ScheduleForm
  setScheduleForm: React.Dispatch<React.SetStateAction<ScheduleForm>>
  weeklyLoading: boolean
  updateWeeklyMutation: { isPending: boolean }
  scheduleMessage: string | null
  handleSaveWeekly: () => void
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

export default function ScheduleSection({
  scheduleForm,
  setScheduleForm,
  weeklyLoading,
  updateWeeklyMutation,
  scheduleMessage,
  handleSaveWeekly,
}: ScheduleSectionProps) {
  return (
    <div className="admin-card" style={{ marginTop: 24 }}>
      <h3>Horarios de Atención</h3>
      {scheduleMessage && <div className="status-notice success">{scheduleMessage}</div>}

      <h4>Horario semanal</h4>
      {weeklyLoading ? (
        <p>Cargando horarios...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Día</th>
              <th style={{ textAlign: 'center', padding: '8px 4px' }}>Activo</th>
              <th style={{ textAlign: 'center', padding: '8px 4px' }}>Apertura</th>
              <th style={{ textAlign: 'center', padding: '8px 4px' }}>Cierre</th>
            </tr>
          </thead>
          <tbody>
            {DAY_LABELS.map((label, dia) => {
              const dayData = scheduleForm[dia] || { activo: false, hora_apertura: '09:00', hora_cierre: '18:00' }
              return (
                <tr key={dia}>
                  <td style={{ padding: '6px 4px', fontWeight: 600 }}>{label}</td>
                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                    <input
                      type="checkbox"
                      checked={dayData.activo}
                      onChange={e => setScheduleForm({
                        ...scheduleForm,
                        [dia]: { ...dayData, activo: e.target.checked },
                      })}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                    <select
                      value={dayData.hora_apertura}
                      onChange={e => setScheduleForm({
                        ...scheduleForm,
                        [dia]: { ...dayData, hora_apertura: e.target.value },
                      })}
                      disabled={!dayData.activo}
                      style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)' }}
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                    <select
                      value={dayData.hora_cierre}
                      onChange={e => setScheduleForm({
                        ...scheduleForm,
                        [dia]: { ...dayData, hora_cierre: e.target.value },
                      })}
                      disabled={!dayData.activo}
                      style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)' }}
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <button
        className="button-primary"
        onClick={handleSaveWeekly}
        disabled={updateWeeklyMutation.isPending}
        style={{ marginTop: 12 }}
      >
        {updateWeeklyMutation.isPending ? 'Guardando...' : 'Guardar horario semanal'}
      </button>
    </div>
  )
}