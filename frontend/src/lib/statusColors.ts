// frontend/src/lib/statusColors.ts
//
// Shared status-color module — REQ-VIS-009 / REQ-VIS-010.
//
// The four appointment status colors are defined as CSS custom properties
// in :root (--status-confirmed, --status-pending, --status-cancelled,
// --status-attended) and are exposed through this module. The module
// intentionally contains ZERO raw hex literals — every value resolves
// from the CSS variable system so a future token update flows through
// without a code change.
//
// Two surfaces are provided:
//   - STATUS_VARS  : 'var(--status-*)' reference strings. Preferred for
//                    inline style objects; the browser resolves them at
//                    paint time.
//   - STATUS_COLORS: resolved hex strings, read once at module load via
//                    getComputedStyle. Used when a consumer needs a
//                    concrete color value (e.g. a JS chart library).

export type AppointmentStatus =
  | 'Pendiente'
  | 'Confirmado'
  | 'Asistido'
  | 'Cancelado_Cliente'
  | 'Cancelado_Sistema_Vencimiento'
  | string // Allow unknown status with a sane fallback.

function readVar(name: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return ''
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const STATUS_VAR_NAMES: Readonly<Record<AppointmentStatus, string>> = {
  Pendiente:                     '--status-pending',
  Confirmado:                    '--status-confirmed',
  Asistido:                      '--status-attended',
  Cancelado_Cliente:             '--status-cancelled',
  Cancelado_Sistema_Vencimiento: '--status-cancelled',
} as const

// Module-side resolved values. The fallback string is intentionally an
// empty value so the consumer (e.g. react-big-calendar) treats the
// status as "use the default background" rather than picking a stale
// hard-coded hex.
export const STATUS_COLORS: Readonly<Record<AppointmentStatus, string>> = {
  Pendiente:                     readVar('--status-pending'),
  Confirmado:                    readVar('--status-confirmed'),
  Asistido:                      readVar('--status-attended'),
  Cancelado_Cliente:             readVar('--status-cancelled'),
  Cancelado_Sistema_Vencimiento: readVar('--status-cancelled'),
} as const

// CSS-var reference strings — preferred for inline style objects.
export const STATUS_VARS: Readonly<Record<AppointmentStatus, string>> = {
  Pendiente:                     'var(--status-pending)',
  Confirmado:                    'var(--status-confirmed)',
  Asistido:                      'var(--status-attended)',
  Cancelado_Cliente:             'var(--status-cancelled)',
  Cancelado_Sistema_Vencimiento: 'var(--status-cancelled)',
} as const

/**
 * Returns the CSS-var reference for a given status. Unknown statuses
 * fall back to 'var(--status-pending)' so they surface in a clearly-
 * readable tone rather than silent white-on-white.
 */
export function getStatusVar(status: string): string {
  const v = (STATUS_VARS as Record<string, string | undefined>)[status]
  return v ?? 'var(--status-pending)'
}

/**
 * Returns the resolved hex value for a given status. Used by
 * react-big-calendar's eventPropGetter which expects a concrete color
 * value rather than a CSS variable reference. Returns an empty string
 * for unknown statuses so the consumer can fall back to a default.
 */
export function getStatusColor(status: string): string {
  const v = (STATUS_COLORS as Record<string, string | undefined>)[status]
  return v ?? ''
}
