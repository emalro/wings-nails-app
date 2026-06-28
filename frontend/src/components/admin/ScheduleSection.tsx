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
    <>
      {scheduleMessage && <div className="status-notice success">{scheduleMessage}</div>}

      <h4>Horario semanal</h4>
      {weeklyLoading ? (
        <p>Cargando horarios...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-1">Día</th>
                <th className="text-center py-2 px-1">Activo</th>
                <th className="text-center py-2 px-1">Apertura</th>
                <th className="text-center py-2 px-1">Cierre</th>
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((label, dia) => {
                const dayData = scheduleForm[dia] || { activo: false, hora_apertura: '09:00', hora_cierre: '18:00' }
                return (
                  <tr key={dia}>
                    <td className="py-1.5 px-1 font-semibold whitespace-nowrap">{label}</td>
                    <td className="text-center py-1.5 px-1">
                      <input
                        type="checkbox"
                        checked={dayData.activo}
                        onChange={e => setScheduleForm({
                          ...scheduleForm,
                          [dia]: { ...dayData, activo: e.target.checked },
                        })}
                      />
                    </td>
                    <td className="text-center py-1.5 px-1">
                      <select
                        value={dayData.hora_apertura}
                        onChange={e => setScheduleForm({
                          ...scheduleForm,
                          [dia]: { ...dayData, hora_apertura: e.target.value },
                        })}
                        disabled={!dayData.activo}
                        className="py-1 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                      >
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="text-center py-1.5 px-1">
                      <select
                        value={dayData.hora_cierre}
                        onChange={e => setScheduleForm({
                          ...scheduleForm,
                          [dia]: { ...dayData, hora_cierre: e.target.value },
                        })}
                        disabled={!dayData.activo}
                        className="py-1 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                      >
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <button
        className="button-primary mt-3"
        onClick={handleSaveWeekly}
        disabled={updateWeeklyMutation.isPending}
      >
        {updateWeeklyMutation.isPending ? 'Guardando...' : 'Guardar horario semanal'}
      </button>
    </>
  )
}
