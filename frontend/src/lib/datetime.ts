/**
 * datetime — Argentina date/time formatting utilities.
 *
 * Centralizes the "Argentina format" for the whole frontend so every
 * date/time display is consistent:
 *   - Dates: DD/MM/YYYY
 *   - Times: HH:MM (24-hour)
 *   - Day names: short (lun/mar/mié/jue/vie/sáb/dom) or long
 *     (lunes/martes/miércoles/jueves/viernes/sábado/domingo)
 *   - Month names: long (enero/febrero/...)
 *
 * The backend serializes datetimes as naive ISO strings that represent
 * the studio's wall-clock time in Argentina (UTC-3). We display them
 * as-is without timezone math, since they are already "Argentina time"
 * by convention.
 *
 * If a string is null/undefined or unparseable, functions return '' so
 * the UI can render an empty cell without crashing.
 */

const SHORT_DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const LONG_DAY_NAMES = [
  'domingo', 'lunes', 'martes', 'miércoles',
  'jueves', 'viernes', 'sábado',
]
const LONG_MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function toDate(input: string | Date | null | undefined): Date | null {
  if (input == null || input === '') return null
  const d = input instanceof Date ? input : new Date(input)
  return isNaN(d.getTime()) ? null : d
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Format as DD/MM/YYYY. Argentina convention.
 */
export function formatDate(input: string | Date | null | undefined): string {
  const d = toDate(input)
  if (!d) return ''
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Format as DD/MM (no year). Useful for calendar cells / month views.
 */
export function formatDateShort(input: string | Date | null | undefined): string {
  const d = toDate(input)
  if (!d) return ''
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
}

/**
 * Format as HH:MM (24-hour). Argentina convention.
 */
export function formatTime(input: string | Date | null | undefined): string {
  const d = toDate(input)
  if (!d) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Format as DD/MM/YYYY HH:MM.
 */
export function formatDateTime(input: string | Date | null | undefined): string {
  const d = toDate(input)
  if (!d) return ''
  return `${formatDate(d)} ${formatTime(d)}`
}

/**
 * Short day name (lun, mar, mié, jue, vie, sáb, dom) — the "diminutivo"
 * used in calendar headers and compact lists.
 */
export function formatDayNameShort(input: string | Date | null | undefined): string {
  const d = toDate(input)
  if (!d) return ''
  return SHORT_DAY_NAMES[d.getDay()]
}

/**
 * Long day name (lunes, martes, miércoles, jueves, viernes, sábado, domingo).
 * For headers, formal references, and long-form date strings.
 */
export function formatDayNameLong(input: string | Date | null | undefined): string {
  const d = toDate(input)
  if (!d) return ''
  return LONG_DAY_NAMES[d.getDay()]
}

/**
 * Long month name (enero, febrero, ...). For month headers.
 */
export function formatMonthName(input: string | Date | null | undefined): string {
  const d = toDate(input)
  if (!d) return ''
  return LONG_MONTH_NAMES[d.getMonth()]
}

/**
 * Capitalize the first letter of a Spanish day/month name. Use after
 * formatDayNameShort/formatDayNameLong/formatMonthName when the word
 * appears at the start of a sentence or in a header.
 */
export function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toLocaleUpperCase('es-AR') + s.slice(1)
}
