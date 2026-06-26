import React from 'react'
import { Calendar, dateFnsLocalizer, EventPropGetter, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useEffectiveHours } from '../hooks'

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

interface CalendarEvent {
  title: string
  start: Date
  end: Date
  resource: CitaRead
  status: string
}

interface CalendarViewProps {
  appointments: CitaRead[]
  loading: boolean
  onEventClick: (cita: CitaRead) => void
}

const locales = {
  es,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

const calendarFormats = {
  monthHeaderFormat: 'MMMM yyyy',
  dayHeaderFormat: 'cccc dd/MM/yyyy',
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    format(start, 'dd/MM/yyyy', { locale: es }) + ' — ' + format(end, 'dd/MM/yyyy', { locale: es }),
  timeGutterFormat: 'HH:mm',
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    format(start, 'HH:mm', { locale: es }) + ' - ' + format(end, 'HH:mm', { locale: es }),
  agendaDateFormat: 'ccc dd/MM',
  agendaTimeFormat: 'HH:mm',
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    format(start, 'HH:mm', { locale: es }) + ' - ' + format(end, 'HH:mm', { locale: es }),
}

const STATUS_COLORS: Record<string, string> = {
  Pendiente: '#F59E0B',
  Confirmado: '#10B981',
  Asistido: '#6B7280',
  Cancelado_Cliente: '#EF4444',
  Cancelado_Sistema_Vencimiento: '#EF4444',
}

const DEFAULT_COLOR = '#6B7280'

export default function CalendarView({ appointments, loading, onEventClick }: CalendarViewProps) {
  const [view, setView] = React.useState<string>(Views.WEEK)
  const [date, setDate] = React.useState(new Date())

  const dateStr = format(date, 'yyyy-MM-dd')
  const { data: effectiveHours } = useEffectiveHours(dateStr)

  const minTime = effectiveHours?.abierto && effectiveHours.hora_apertura
    ? new Date(`${dateStr}T${effectiveHours.hora_apertura}`)
    : undefined

  const maxTime = effectiveHours?.abierto && effectiveHours.hora_cierre
    ? new Date(`${dateStr}T${effectiveHours.hora_cierre}`)
    : undefined

  const events: CalendarEvent[] = appointments.map((cita) => {
    // REQ-DCO-001/003: parse naive datetime string without UTC conversion
    const [datePart, timePart] = cita.fecha_hora_cita.split('T')
    const [hours, minutes] = (timePart || '00:00').split(':').map(Number)
    const start = new Date(parseInt(datePart.slice(0,4)), parseInt(datePart.slice(5,7)) - 1, parseInt(datePart.slice(8,10)), hours, minutes)
    const end = new Date(start.getTime() + cita.duracion_total_minutos * 60 * 1000)
    return {
      title: cita.cliente_nombre || `Cita #${cita.id}`,
      start,
      end,
      resource: cita,
      status: cita.estado_cita,
    }
  })

  const eventPropGetter: EventPropGetter<CalendarEvent> = (event) => {
    const color = STATUS_COLORS[event.status] || DEFAULT_COLOR
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        borderRadius: '4px',
        opacity: 0.85,
        color: '#fff',
        fontSize: '0.85rem',
        fontWeight: 500,
        padding: '2px 4px',
      },
    }
  }

  function handleSelectEvent(event: CalendarEvent) {
    onEventClick(event.resource)
  }

  function goToToday() {
    setDate(new Date())
  }

  function goBack() {
    setDate((d) => {
      if (view === Views.DAY) return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
      if (view === Views.WEEK) return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)
      return new Date(d.getFullYear(), d.getMonth() - 1, 1)
    })
  }

  function goForward() {
    setDate((d) => {
      if (view === Views.DAY) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      if (view === Views.WEEK) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
      return new Date(d.getFullYear(), d.getMonth() + 1, 1)
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
        Cargando turnos...
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div>
        <Toolbar view={view} onViewChange={setView} onToday={goToToday} onBack={goBack} onForward={goForward} />
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          Sin turnos registrados
        </div>
      </div>
    )
  }

  return (
    <div>
      <Toolbar view={view} onViewChange={setView} onToday={goToToday} onBack={goBack} onForward={goForward} />
      <Calendar<CalendarEvent>
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        style={{ height: 500 }}
        view={view as any}
        date={date}
        min={minTime}
        max={maxTime}
        formats={calendarFormats}
        onView={(v) => setView(v)}
        onNavigate={(d) => setDate(d)}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventPropGetter}
        popup
        selectable
        toolbar={false}
      />
    </div>
  )
}

interface ToolbarProps {
  view: string
  onViewChange: (view: string) => void
  onToday: () => void
  onBack: () => void
  onForward: () => void
}

function Toolbar({ view, onViewChange, onToday, onBack, onForward }: ToolbarProps) {
  const views = [
    { key: Views.DAY, label: 'Día' },
    { key: Views.WEEK, label: 'Semana' },
    { key: Views.MONTH, label: 'Mes' },
  ]

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" onClick={onBack} style={btnStyle}>&larr;</button>
      <button type="button" onClick={onToday} style={btnStyle}>Hoy</button>
      <button type="button" onClick={onForward} style={btnStyle}>&rarr;</button>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            style={{
              ...btnStyle,
              background: view === v.key ? 'var(--accent, #7c3aed)' : 'var(--surface, #fff)',
              color: view === v.key ? '#fff' : 'inherit',
              fontWeight: view === v.key ? 600 : 400,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1.5px solid var(--border, #e2e8f0)',
  borderRadius: '6px',
  background: 'var(--surface, #fff)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
}