import { describe, expect, it } from 'vitest'

import { calculateAlcoholConsumptionSummary } from '../../../../frontend/src/features/drinks/calculations/alcoholConsumptionSummary'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'
import type { LocalCalendarDateKey } from '../../../../frontend/src/features/drinks/utils/localCalendarDate'

const TODAY = '2026-09-02' as LocalCalendarDateKey

function record(
  id: string,
  localDate: LocalCalendarDateKey,
  overrides: Partial<DrinkingRecord> = {},
): DrinkingRecord {
  return {
    id,
    drinkType: 'beer',
    drinkName: `Drink ${id}`,
    servingVolumeMl: 375,
    abvPercent: 5,
    amountConsumed: 1,
    consumedAt: `${localDate}T12:00:00.000Z`,
    consumedTimezoneOffsetMinutes: 0,
    createdAt: `2026-09-02T13:00:00.000Z`,
    ...overrides,
  }
}

describe('alcohol consumption summary', () => {
  it('returns a no-history state without presenting synthetic zero days', () => {
    expect(calculateAlcoholConsumptionSummary([], TODAY)).toEqual({
      hasEligibleDrinkingRecordToday: false,
      dailyStandardDrinks: 0,
      rollingSevenDayStandardDrinks: 0,
      earliestRecordedConsumptionDate: null,
      recordedHistorySpanDays: 0,
      recordedHistorySpanStatus: 'none',
      excludedFutureRecordCount: 0,
    })
  })

  it('includes today, excludes yesterday from daily, and sums multiple records', () => {
    const summary = calculateAlcoholConsumptionSummary(
      [record('today-1', TODAY), record('today-2', TODAY), record('yesterday', '2026-09-01')],
      TODAY,
    )

    expect(summary.hasEligibleDrinkingRecordToday).toBe(true)
    expect(summary.dailyStandardDrinks).toBeCloseTo(2.95875, 12)
    expect(summary.rollingSevenDayStandardDrinks).toBeCloseTo(4.438125, 12)
  })

  it('includes a local-after-midnight record whose UTC date is yesterday', () => {
    const summary = calculateAlcoholConsumptionSummary(
      [
        record('local-midnight', TODAY, {
          consumedAt: '2026-09-01T14:05:00.000Z',
          consumedTimezoneOffsetMinutes: -600,
        }),
      ],
      TODAY,
    )

    expect(summary.hasEligibleDrinkingRecordToday).toBe(true)
    expect(summary.dailyStandardDrinks).toBeCloseTo(1.479375, 12)
  })

  it('has a zero daily total when only earlier eligible records exist', () => {
    const summary = calculateAlcoholConsumptionSummary(
      [record('yesterday', '2026-09-01')],
      TODAY,
    )

    expect(summary.hasEligibleDrinkingRecordToday).toBe(false)
    expect(summary.dailyStandardDrinks).toBe(0)
    expect(summary.recordedHistorySpanStatus).toBe('under-seven-days')
  })

  it('includes six days ago and excludes seven days ago from the rolling total', () => {
    const included = record('included', '2026-08-27')
    const excluded = record('excluded', '2026-08-26', {
      amountConsumed: 10,
    })
    const summary = calculateAlcoholConsumptionSummary(
      [included, excluded],
      TODAY,
    )

    expect(summary.rollingSevenDayStandardDrinks).toBeCloseTo(1.479375, 12)
    expect(summary.recordedHistorySpanDays).toBe(8)
    expect(summary.recordedHistorySpanStatus).toBe('seven-days-or-more')
  })

  it.each([
    ['2026-09-02', 1, 'under-seven-days'],
    ['2026-08-31', 3, 'under-seven-days'],
    ['2026-08-28', 6, 'under-seven-days'],
    ['2026-08-27', 7, 'seven-days-or-more'],
    ['2026-08-20', 14, 'seven-days-or-more'],
  ] as const)(
    'derives an inclusive history span from %s',
    (earliestDate, expectedDays, expectedStatus) => {
      const summary = calculateAlcoholConsumptionSummary(
        [record('earliest', earliestDate)],
        TODAY,
      )

      expect(summary.earliestRecordedConsumptionDate).toBe(earliestDate)
      expect(summary.recordedHistorySpanDays).toBe(expectedDays)
      expect(summary.recordedHistorySpanStatus).toBe(expectedStatus)
    },
  )

  it('derives the earliest consumption date rather than using creation order', () => {
    const summary = calculateAlcoholConsumptionSummary(
      [
        record('created-first', TODAY, {
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
        record('consumed-first', '2026-08-27', {
          createdAt: '2026-09-02T14:00:00.000Z',
        }),
      ],
      TODAY,
    )

    expect(summary.earliestRecordedConsumptionDate).toBe('2026-08-27')
    expect(summary.recordedHistorySpanDays).toBe(7)
  })

  it('excludes future records from every total and history-span field', () => {
    const summary = calculateAlcoholConsumptionSummary(
      [
        record('today', TODAY),
        record('future', '2026-09-03', { amountConsumed: 100 }),
      ],
      TODAY,
    )

    expect(summary.hasEligibleDrinkingRecordToday).toBe(true)
    expect(summary.dailyStandardDrinks).toBeCloseTo(1.479375, 12)
    expect(summary.rollingSevenDayStandardDrinks).toBeCloseTo(1.479375, 12)
    expect(summary.earliestRecordedConsumptionDate).toBe(TODAY)
    expect(summary.recordedHistorySpanDays).toBe(1)
    expect(summary.excludedFutureRecordCount).toBe(1)
  })

  it('treats future-only stored records as no eligible recorded history', () => {
    const summary = calculateAlcoholConsumptionSummary(
      [record('future', '2027-01-01')],
      TODAY,
    )

    expect(summary).toMatchObject({
      hasEligibleDrinkingRecordToday: false,
      dailyStandardDrinks: 0,
      rollingSevenDayStandardDrinks: 0,
      earliestRecordedConsumptionDate: null,
      recordedHistorySpanDays: 0,
      recordedHistorySpanStatus: 'none',
      excludedFutureRecordCount: 1,
    })
  })
})
