/**
 * Derives current consumption feedback from browser-local DrinkingRecords.
 *
 * Missing records are never manufactured as zero-consumption days. The
 * earliest eligible record only establishes whether a seven-day comparison
 * window is available; it does not prove the history is complete.
 */
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { LocalCalendarDateKey } from '../utils/localCalendarDate'
import {
  differenceInLocalCalendarDays,
  getRecordLocalCalendarDateKey,
  isWithinRollingSevenLocalCalendarDays,
} from '../utils/localCalendarDate'
import { sumStandardDrinks } from './standardDrinks'

export type RecordedHistorySpanStatus =
  | 'none'
  | 'under-seven-days'
  | 'seven-days-or-more'

export interface AlcoholConsumptionSummary {
  dailyStandardDrinks: number
  rollingSevenDayStandardDrinks: number
  earliestRecordedConsumptionDate: LocalCalendarDateKey | null
  recordedHistorySpanDays: number
  recordedHistorySpanStatus: RecordedHistorySpanStatus
  excludedFutureRecordCount: number
}

interface DatedRecord {
  record: DrinkingRecord
  localDate: LocalCalendarDateKey
}

export function calculateAlcoholConsumptionSummary(
  records: readonly DrinkingRecord[],
  today: LocalCalendarDateKey,
): AlcoholConsumptionSummary {
  const datedRecords: DatedRecord[] = records.map((record) => ({
    record,
    localDate: getRecordLocalCalendarDateKey(record),
  }))
  // Epic 1 permits future dates. They remain persisted and visible in history,
  // but cannot describe consumption that has occurred by today's local date.
  const eligibleRecords = datedRecords.filter(
    ({ localDate }) => differenceInLocalCalendarDays(today, localDate) >= 0,
  )
  const excludedFutureRecordCount = datedRecords.length - eligibleRecords.length
  const earliestRecordedConsumptionDate = eligibleRecords.reduce<
    LocalCalendarDateKey | null
  >(
    (earliest, { localDate }) =>
      earliest === null || localDate < earliest ? localDate : earliest,
    null,
  )
  const recordedHistorySpanDays = earliestRecordedConsumptionDate
    ? differenceInLocalCalendarDays(
        today,
        earliestRecordedConsumptionDate,
      ) + 1
    : 0
  const recordedHistorySpanStatus: RecordedHistorySpanStatus =
    recordedHistorySpanDays === 0
      ? 'none'
      : recordedHistorySpanDays < 7
        ? 'under-seven-days'
        : 'seven-days-or-more'

  return {
    dailyStandardDrinks: sumStandardDrinks(
      eligibleRecords
        .filter(({ localDate }) => localDate === today)
        .map(({ record }) => record),
    ),
    // This is a rolling collection of seven local dates, not a 168-hour range.
    rollingSevenDayStandardDrinks: sumStandardDrinks(
      eligibleRecords
        .filter(({ localDate }) =>
          isWithinRollingSevenLocalCalendarDays(localDate, today),
        )
        .map(({ record }) => record),
    ),
    earliestRecordedConsumptionDate,
    recordedHistorySpanDays,
    recordedHistorySpanStatus,
    excludedFutureRecordCount,
  }
}
