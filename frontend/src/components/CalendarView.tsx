import React from 'react'
import { Calendar, dateFnsLocalizer, EventPropGetter, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, endOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useEffectiveHours } from '../hooks'
import { getStatusColor, getStatusVar } from '../lib/statusColors'

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
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1, locale: es }),
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

// Spanish translations for react-big-calendar's built-in messages. The
// custom Toolbar at the bottom of this file only overrides the view names
// (Día/Semana/Mes); the remaining strings (allDay, noEventsInRange,
// showMore, navigation, etc.) come from this `messages` prop.
const calendarMessages = {
  allDay: 'Todo el día',
  previous: 'Atrás',
  next: 'Adelante',
  yesterday: 'Ayer',
  tomorrow: 'Mañana',
  today: 'Hoy',
  agenda: 'Agenda',
  week: 'Semana',
  work_week: 'Semana laboral',
  day: 'Día',
  month: 'Mes',
  noEventsInRange: 'No hay turnos en este rango.',
  showMore: (total: number) => `+${total} más`,
}

// Status colors are sourced from the shared lib/statusColors module; the
// values resolve from --status-* CSS variables defined in :root. There
// are no raw hex literals here — see REQ-VIS-010.

export default function CalendarView({ appointments, loading, onEventClick }: CalendarViewProps) {
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const [view, setView] = React.useState<string>(isMobile ? Views.DAY : Views.WEEK)
  const [date, setDate] = React.useState(new Date())

  const dateStr = format(date, 'yyyy-MM-dd')
  const { data: effectiveHours } = useEffectiveHours(dateStr)

  // Build the min/max the calendar should display. We start from the
  // studio's effective opening/closing hours and narrow to the earliest/
  // latest appointment in the current view (day or week) with a 1h
  // padding, so empty hours at the edges are not displayed when no
  // appointment falls in them. Falls back to apertura/cierre when there
  // are no appointments in view.
  const viewBounds = React.useMemo(() => {
    if (!appointments.length) return null
    const isWeek = view === Views.WEEK
    const bounds = isWeek
      ? {
          start: startOfWeek(date, { weekStartsOn: 1, locale: es }),
          end: endOfWeek(date, { weekStartsOn: 1, locale: es }),
        }
      : {
          start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
          end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0),
        }
    const inView = appointments.filter((cita) => {
      const [dp, tp] = cita.fecha_hora_cita.split('T')
      const [y, mo, d] = dp.split('-').map(Number)
      const [h, mi] = (tp || '00:00').split(':').map(Number)
      const start = new Date(y, mo - 1, d, h, mi)
      return start >= bounds.start && start < bounds.end
    })
    if (!inView.length) return null
    let minStart: Date | null = null
    let maxEnd: Date | null = null
    for (const cita of inView) {
      const [dp, tp] = cita.fecha_hora_cita.split('T')
      const [y, mo, d] = dp.split('-').map(Number)
      const [h, mi] = (tp || '00:00').split(':').map(Number)
      const start = new Date(y, mo - 1, d, h, mi)
      const end = new Date(start.getTime() + cita.duracion_total_minutos * 60 * 1000)
      if (!minStart || start < minStart) minStart = start
      if (!maxEnd || end > maxEnd) maxEnd = end
    }
    return { min: minStart!, max: maxEnd! }
  }, [appointments, date, view])

  const aperturaTime = effectiveHours?.abierto && effectiveHours.hora_apertura
    ? new Date(`${dateStr}T${effectiveHours.hora_apertura}`)
    : undefined
  const cierreTime = effectiveHours?.abierto && effectiveHours.hora_cierre
    ? new Date(`${dateStr}T${effectiveHours.hora_cierre}`)
    : undefined

  const minTime = viewBounds?.min
    ? new Date(Math.max(
        aperturaTime ? aperturaTime.getTime() : 0,
        viewBounds.min.getTime() - 60 * 60 * 1000
      ))
    : aperturaTime
  const maxTime = viewBounds?.max
    ? new Date(Math.min(
        cierreTime ? cierreTime.getTime() : Number.MAX_SAFE_INTEGER,
        viewBounds.max.getTime() + 60 * 60 * 1000
      ))
    : cierreTime

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
    // react-big-calendar expects a concrete color value here, so we
    // resolve the CSS-var reference to the actual hex at runtime via
    // getStatusColor. The fallback to getStatusVar() returns a CSS
    // variable reference which the browser can also use for
    // backgroundColor in modern engines — but the resolved value keeps
    // the calendar renderer predictable across all browsers.
    const color = getStatusColor(event.status) || getStatusVar(event.status)
    // The warm-gold --status-pending is the documented exception that
    // does not pass WCAG 2.2 AA on white. We use a dark text on
    // pending events (matching the spec's REQ-A11Y-004 contrast
    // guidance) and white text on every other status.
    const isPending = event.status === 'Pendiente'
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        borderRadius: '4px',
        opacity: 0.9,
        color: isPending ? 'var(--on-background)' : '#fff',
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
      <div className="text-center py-12 text-[var(--text-secondary)]">
        Cargando turnos...
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div>
        <Toolbar view={view} onViewChange={setView} onToday={goToToday} onBack={goBack} onForward={goForward} />
        <div className="text-center py-12 text-[var(--text-secondary)]">
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
        className="h-[500px] md:h-[calc(100vh-200px)]"
        view={view as any}
        date={date}
        min={minTime}
        max={maxTime}
        formats={calendarFormats}
        messages={calendarMessages}
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
    <div className="flex gap-2 mb-3 flex-wrap items-center">
      <button type="button" onClick={onBack} className="btn-toolbar">&larr;</button>
      <button type="button" onClick={onToday} className="btn-toolbar">Hoy</button>
      <button type="button" onClick={onForward} className="btn-toolbar">&rarr;</button>
      <div className="ml-auto flex gap-1">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            className={`btn-toolbar ${view === v.key ? 'bg-[var(--primary)] text-white font-semibold' : ''}`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
