import { describe, it, expect } from 'vitest'
import { parseLocalISODateTime } from './datetime'

describe('parseLocalISODateTime', () => {
  it('parses YYYY-MM-DDTHH:MM as local time', () => {
    const d = parseLocalISODateTime('2026-06-29T09:00')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5) // June = 5
    expect(d!.getDate()).toBe(29)
    expect(d!.getHours()).toBe(9)
    expect(d!.getMinutes()).toBe(0)
  })

  it('parses YYYY-MM-DDTHH:MM:SS as local time', () => {
    const d = parseLocalISODateTime('2026-06-29T09:00:30')
    expect(d).not.toBeNull()
    expect(d!.getSeconds()).toBe(30)
  })

  it('strips an explicit Z suffix without shifting wall-clock (REQ-DCO contract)', () => {
    // The backend never emits Z (the @field_serializer strips tzinfo), but if
    // a future bug ever leaks one, parseLocalISODateTime must NOT treat the
    // string as UTC and shift by 3h for Argentina. The contract is
    // wall-clock = wall-clock, regardless of any offset suffix.
    const withZ = parseLocalISODateTime('2026-06-29T09:00Z')
    const withoutZ = parseLocalISODateTime('2026-06-29T09:00')
    expect(withZ!.getHours()).toBe(withoutZ!.getHours())
    expect(withZ!.getHours()).toBe(9)
  })

  it('returns null for null/empty/unparseable input', () => {
    expect(parseLocalISODateTime(null)).toBeNull()
    expect(parseLocalISODateTime(undefined)).toBeNull()
    expect(parseLocalISODateTime('')).toBeNull()
    expect(parseLocalISODateTime('not-a-date')).toBeNull()
  })
})
