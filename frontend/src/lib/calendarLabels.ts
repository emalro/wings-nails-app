import { format, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { Views } from 'react-big-calendar'
import { capitalize } from './datetime'

/**
 * Compute the human-readable period label for the calendar toolbar.
 * Extracted from CalendarView.tsx so it can be unit tested without
 * loading the full react-big-calendar + useEffectiveHours module.
 *
 *   MONTH  -> "Junio 2026"
 *   WEEK   -> "15 — 21 de junio, 2026"
 *   AGENDA -> "15 — 21 de junio, 2026" (same span as WEEK)
 *   DAY    -> "15 de junio, 2026"
 */
export function getPeriodLabel(view: string, date: Date): string {
  if (view === Views.MONTH) {
    return capitalize(format(date, 'MMMM yyyy', { locale: es }))
  }
  if (view === Views.WEEK || view === Views.AGENDA) {
    const start = startOfWeek(date, { weekStartsOn: 1, locale: es })
    const end = endOfWeek(date, { weekStartsOn: 1, locale: es })
    return `${format(start, 'd', { locale: es })} — ${format(end, "d 'de' MMMM, yyyy", { locale: es })}`
  }
  // DAY (default)
  return format(date, "d 'de' MMMM, yyyy", { locale: es })
}
