import { describe, it, expect } from 'vitest'
import { normalizePhone, isValidPhone } from './phone'

describe('normalizePhone (A-17)', () => {
  it('strips spaces, dashes, parens, and plus signs', () => {
    expect(normalizePhone('+54 (0341) 555-1234')).toBe('5403415551234')
  })

  it('preserves digits-only input', () => {
    expect(normalizePhone('3415211877')).toBe('3415211877')
  })

  it('returns empty string for null/empty/non-string', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
    expect(normalizePhone('')).toBe('')
  })

  it('isValidPhone matches the backend >= 7 digits rule', () => {
    expect(isValidPhone('1234567')).toBe(true)
    expect(isValidPhone('123456')).toBe(false)
    expect(isValidPhone('+54 11 5555-1234')).toBe(true) // 12 digits after strip
    expect(isValidPhone(null)).toBe(false)
  })
})
