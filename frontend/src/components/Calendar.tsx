import React, { useEffect, useState } from 'react'
import { useBusySlots, useEffectiveHours } from '../hooks'

type TimeSlot = {
  hour: number
  minute: number
  available: boolean
}

type CalendarProps = {
  selectedDateTime: string
  onDateTimeChange: (dateTime: string) => void
  serviceDuration: number
}

export default function Calendar({ selectedDateTime, onDateTimeChange, serviceDuration }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : ''
  const { data: busySlots = [] } = useBusySlots(dateStr)
  const { data: effectiveHours, isLoading: loadingHours } = useEffectiveHours(dateStr)

  useEffect(() => {
    if (selectedDate) {
      generateTimeSlots(selectedDate)
    }
  }, [selectedDate, busySlots, serviceDuration, effectiveHours])

  function generateTimeSlots(date: Date) {
    if (!effectiveHours?.abierto) {
      setTimeSlots([])
      return
    }
    const slots: TimeSlot[] = []
    const startHour = parseInt(effectiveHours.hora_apertura!.split(':')[0])
    const endHour = parseInt(effectiveHours.hora_cierre!.split(':')[0])
    const intervalMinutes = 30

    // REQ-BKG-006: filter out past slots when selected date is today
    const now = new Date()
    const isToday = date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        // REQ-BKG-006: skip past slots for today
        if (isToday && (hour < currentHour || (hour === currentHour && minute < currentMinute))) {
          continue
        }

        const slotStart = new Date(date)
        slotStart.setHours(hour, minute, 0, 0)
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + serviceDuration)

        const isAvailable = !(busySlots as Array<{ start: string; end: string }>).some(busy => {
          const busyStart = new Date(busy.start)
          const busyEnd = new Date(busy.end)
          return slotStart < busyEnd && slotEnd > busyStart
        })

        slots.push({
          hour,
          minute,
          available: isAvailable,
        })
      }
    }

    setTimeSlots(slots)
  }

  function getDaysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  function getFirstDayOfMonth(date: Date) {
    // Monday-first: shift so Monday=0, Tuesday=1, ..., Sunday=6
    return (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7
  }

  function handleDateClick(day: number) {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(newDate)
  }

  function handleTimeSelect(hour: number, minute: number) {
    if (!selectedDate) return
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    const hourStr = String(hour).padStart(2, '0')
    const minStr = String(minute).padStart(2, '0')
    const dateTimeStr = `${year}-${month}-${day}T${hourStr}:${minStr}`
    onDateTimeChange(dateTimeStr)
  }

  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const calendarDays = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={previousMonth} type="button">←</button>
        <h3>{monthName}</h3>
        <button onClick={nextMonth} type="button">→</button>
      </div>

      <div className="calendar-grid">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}
        {calendarDays.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="calendar-empty"></div>

          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
          const isToday = date.getTime() === today.getTime()
          const isPast = date < today
          const isSelected = selectedDate && date.getTime() === selectedDate.getTime()
          const hasAvailability = !isPast

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDateClick(day)}
              className={`calendar-day ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}`}
              disabled={isPast}
            >
              {day}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <div className="time-slots-container">
          <h4>⏰ Horarios disponibles - {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
          {loadingHours ? (
            <p>Cargando horarios...</p>
          ) : !effectiveHours ? (
            <p>No se pudieron cargar los horarios.</p>
          ) : !effectiveHours.abierto ? (
            <p>❌ El local está cerrado este día.</p>
          ) : timeSlots.length === 0 ? (
            <p>❌ No hay horarios disponibles. El local cierra antes de que termine el servicio.</p>
          ) : timeSlots.every(s => !s.available) ? (
            <>
              <p>⏰ Todos los horarios están ocupados para esta fecha.</p>
              <p className="hint mt-3 text-[.8rem] text-[var(--muted)]">
                Los horarios ocupados no muestran datos de otras clientas por protección de datos personales.
              </p>
            </>
          ) : (
            <>
              <div className="time-slots-grid">
                {timeSlots.map((slot, idx) => {
                  const slotDateTime = selectedDate
                    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}T${String(slot.hour).padStart(2,'0')}:${String(slot.minute).padStart(2,'0')}`
                    : ''
                  const isSelected = slotDateTime === selectedDateTime

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleTimeSelect(slot.hour, slot.minute)}
                      className={`time-slot ${!slot.available ? 'unavailable' : ''} ${isSelected ? 'selected' : ''}`}
                      disabled={!slot.available}
                    >
                      {slot.available
                        ? `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
                        : 'Ocupado'}
                    </button>
                  )
                })}
              </div>
              <p className="hint mt-3 text-[.8rem] text-[var(--muted)]">
                Los horarios ocupados no muestran datos de otras clientas por protección de datos personales.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
