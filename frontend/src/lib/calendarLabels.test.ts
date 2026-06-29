import { describe, it, expect } from 'vitest'
import { Views } from 'react-big-calendar'
import { getPeriodLabel } from './calendarLabels'

describe('getPeriodLabel', () => {
  it('returns month name + year for MONTH view', () => {
    // June 15, 2026
    const date = new Date(2026, 5, 15)
    const label = getPeriodLabel(Views.MONTH, date)
    expect(label).toBe('Junio 2026')
  })

  it('returns day + month + year for DAY view', () => {
    // June 15, 2026
    const date = new Date(2026, 5, 15)
    const label = getPeriodLabel(Views.DAY, date)
    expect(label).toBe('15 de junio, 2026')
  })

  it('returns week range (start — end) for WEEK view', () => {
    // Wednesday, June 17, 2026 — week is Mon Jun 15 to Sun Jun 21
    const date = new Date(2026, 5, 17)
    const label = getPeriodLabel(Views.WEEK, date)
    expect(label).toBe('15 — 21 de junio, 2026')
  })

  it('returns the same week range for AGENDA view as WEEK', () => {
    // Agenda spans a week; reuse the same label format
    const date = new Date(2026, 5, 17)
    expect(getPeriodLabel(Views.AGENDA, date)).toBe(getPeriodLabel(Views.WEEK, date))
  })

  it('uses the es-AR locale for month names', () => {
    const january = new Date(2026, 0, 15)
    expect(getPeriodLabel(Views.MONTH, january)).toBe('Enero 2026')
    const december = new Date(2026, 11, 15)
    expect(getPeriodLabel(Views.MONTH, december)).toBe('Diciembre 2026')
  })
})
