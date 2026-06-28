/**
 * apiErrors — Normalize Axios/Pydantic errors into a friendly ApiError shape.
 *
 * Backend raises PydanticCustomError for `seña > precio` (and other rules);
 * FastAPI's 422 response has `detail: [{type, loc, msg, input, ctx}, ...]`.
 * The `type` string is the canonical contract between backend and frontend:
 *
 *   - Servicio* emitters:    "seña_excede_precio" (with ñ)
 *   - Cita* emitters:        "sena_excede_precio"  (no ñ)
 *
 * Both spellings are live in production. Callers use `getApiError(err).message`
 * to get a Spanish-language alert (or the generic fallback for unknown types).
 */

export type ApiErrorType = 'seña_excede_precio' | 'sena_excede_precio' | 'other'

export interface ApiError {
  status: number
  type?: string
  title?: string
  message: string
  ctx?: Record<string, unknown>
}

const GENERIC_422 = 'Datos inválidos. Revisá los campos.'
const GENERIC_ERROR = 'Ocurrió un error. Intentá de nuevo.'

/**
 * Per-type lookup table. Both spellings map to the same `title` (visual
 * emphasis on the alert heading) but distinct `message` (context-specific
 * copy: "servicio" vs "turno").
 */
export const API_ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  'seña_excede_precio': {
    title: 'Seña mayor al precio',
    message: 'La seña no puede ser mayor que el precio del servicio. Ajustá uno de los dos valores.',
  },
  'sena_excede_precio': {
    title: 'Seña mayor al precio',
    message: 'La seña no puede ser mayor que el precio del turno. Ajustá uno de los dos valores.',
  },
}

/**
 * Normalize any error into a stable ApiError shape.
 *
 * - 422 with detail[0].type in the lookup table → custom Spanish alert
 * - 422 with detail[0].type unknown             → falls back to detail[0].msg
 * - 422 with detail as a bare string            → uses the string directly
 * - Anything else (409/500/network/etc.)       → generic error message
 */
export function getApiError(err: unknown): ApiError {
  const ax = err as {
    response?: { status?: number; data?: { detail?: unknown } }
    message?: string
  }
  const status = ax?.response?.status ?? 0
  const detail = ax?.response?.data?.detail

  if (status === 422 && Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as {
      type?: string
      msg?: string
      ctx?: Record<string, unknown>
    }
    if (first?.type && API_ERROR_MESSAGES[first.type]) {
      const m = API_ERROR_MESSAGES[first.type]
      return {
        status,
        type: first.type,
        title: m.title,
        message: m.message,
        ctx: first.ctx,
      }
    }
    return {
      status,
      type: first?.type,
      message: first?.msg || GENERIC_422,
      ctx: first?.ctx,
    }
  }

  if (status === 422 && typeof detail === 'string') {
    return { status, message: detail }
  }

  return { status, message: GENERIC_ERROR }
}
