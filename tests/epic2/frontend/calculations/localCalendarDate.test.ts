import { describe, expect, it } from 'vitest'

import {
  differenceInLocalCalendarDays,
  getCurrentLocalCalendarDateKey,
  getRecordLocalCalendarDateKey,
  isWithinRollingSevenLocalCalendarDays,
  type LocalCalendarDateKey,
} from '../../../../frontend/src/features/drinks/utils/localCalendarDate'

describe('local calendar dates', () => {
  it('reconstructs the recorded date when UTC is on the previous day', () => {
    expect(
      getRecordLocalCalendarDateKey({
        consumedAt: '2026-08-31T14:05:00.000Z',
        consumedTimezoneOffsetMinutes: -600,
      }),
    ).toBe('2026-09-01')
  })

  it('reconstructs the recorded date for a timezone behind UTC', () => {
    expect(
      getRecordLocalCalendarDateKey({
        consumedAt: '2026-08-27T03:17:00.000Z',
        consumedTimezoneOffsetMinutes: 300,
      }),
    ).toBe('2026-08-26')
  })

  it('uses current device-local components for today', () => {
    expect(
      getCurrentLocalCalendarDateKey(new Date(2026, 8, 2, 23, 59)),
    ).toBe('2026-09-02')
  })

  it.each([
    ['cross-month', '2026-09-02', '2026-08-27', 6],
    ['cross-year', '2027-01-03', '2026-12-28', 6],
    ['leap day', '2028-03-01', '2028-02-29', 1],
  ] as const)(
    'counts %s boundaries as calendar days',
    (_name, later, earlier, expected) => {
      expect(
        differenceInLocalCalendarDays(
          later as LocalCalendarDateKey,
          earlier as LocalCalendarDateKey,
        ),
      ).toBe(expected)
    },
  )

  it('includes today and six days ago but excludes seven days ago and future dates', () => {
    const today = '2026-09-02' as LocalCalendarDateKey

    expect(
      isWithinRollingSevenLocalCalendarDays('2026-09-02', today),
    ).toBe(true)
    expect(
      isWithinRollingSevenLocalCalendarDays('2026-08-27', today),
    ).toBe(true)
    expect(
      isWithinRollingSevenLocalCalendarDays('2026-08-26', today),
    ).toBe(false)
    expect(
      isWithinRollingSevenLocalCalendarDays('2026-09-03', today),
    ).toBe(false)
  })

  it('does not depend on elapsed 24-hour periods across DST', () => {
    expect(
      differenceInLocalCalendarDays('2026-10-05', '2026-10-04'),
    ).toBe(1)
  })
})
