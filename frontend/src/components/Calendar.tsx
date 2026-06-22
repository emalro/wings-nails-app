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

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
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
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
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
        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(day => (
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
          ) : !effectiveHours?.abierto ? (
            <p>Sin horarios disponibles para esta fecha</p>
          ) : timeSlots.length === 0 ? (
            <p>Sin horarios disponibles para esta fecha</p>
          ) : (
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
                    {String(slot.hour).padStart(2, '0')}:{String(slot.minute).padStart(2, '0')}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
