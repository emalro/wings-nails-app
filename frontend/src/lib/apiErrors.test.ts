import { describe, it, expect } from 'vitest'
import { getApiError, API_ERROR_MESSAGES } from './apiErrors'

/**
 * Helpers — build fake Axios errors with the exact 422 shape FastAPI
 * emits for PydanticCustomError. The helper stays decoupled from Axios
 * (no `import axios`) to keep the test pure-function.
 */
function makeAxios422(detail: unknown): unknown {
  return {
    response: {
      status: 422,
      data: { detail },
    },
  }
}

describe('getApiError', () => {
  it('returns custom Spanish message for Cita context (sena_excede_precio, no ñ)', () => {
    const err = makeAxios422([
      {
        type: 'sena_excede_precio',
        msg: 'La seña (2500.0) no puede superar el precio de la cita (2000.0)',
        ctx: { sena: 2500.0, precio: 2000.0 },
      },
    ])
    const e = getApiError(err)
    expect(e.status).toBe(422)
    expect(e.type).toBe('sena_excede_precio')
    expect(e.title).toBe(API_ERROR_MESSAGES['sena_excede_precio'].title)
    expect(e.message).toBe(API_ERROR_MESSAGES['sena_excede_precio'].message)
    expect(e.ctx).toEqual({ sena: 2500.0, precio: 2000.0 })
  })

  it('returns custom Spanish message for Servicio context (seña_excede_precio, with ñ)', () => {
    const err = makeAxios422([
      {
        type: 'seña_excede_precio',
        msg: 'La seña (3000.0) no puede superar el precio del servicio (2500.0)',
        ctx: { seña: 3000.0, precio: 2500.0 },
      },
    ])
    const e = getApiError(err)
    expect(e.status).toBe(422)
    expect(e.type).toBe('seña_excede_precio')
    expect(e.title).toBe(API_ERROR_MESSAGES['seña_excede_precio'].title)
    expect(e.message).toBe(API_ERROR_MESSAGES['seña_excede_precio'].message)
  })

  it('falls back to detail[0].msg for unknown 422 types', () => {
    const err = makeAxios422([
      {
        type: 'some_other_validation_error',
        msg: 'Invalid email format',
      },
    ])
    const e = getApiError(err)
    expect(e.status).toBe(422)
    expect(e.type).toBe('some_other_validation_error')
    expect(e.message).toBe('Invalid email format')
    expect(e.title).toBeUndefined()
  })

  it('handles 422 with detail as a bare string', () => {
    const err = makeAxios422('Forbidden word in description')
    const e = getApiError(err)
    expect(e.status).toBe(422)
    expect(e.message).toBe('Forbidden word in description')
  })

  it('returns generic error for non-Axios / network errors', () => {
    const e = getApiError(new Error('Network Error'))
    expect(e.status).toBe(0)
    expect(e.type).toBeUndefined()
    expect(e.message).toBe('Ocurrió un error. Intentá de nuevo.')
  })

  it('returns generic error for plain string errors', () => {
    const e = getApiError('something broke')
    expect(e.status).toBe(0)
    expect(e.message).toBe('Ocurrió un error. Intentá de nuevo.')
  })
})
