/**
 * On-device daily status is independent of positive-quantity drink snapshots.
 * Absence means unknown, never confirmed abstinence. Calendar keys have no UTC
 * instant: an alcohol-free day has a date, but no invented drinking time.
 */
import { differenceInLocalCalendarDays, getRecordLocalCalendarDateKey, type LocalCalendarDateKey } from '../utils/localCalendarDate'
import type { DrinkingRecord } from './drinkingRecord'

export type DailyCheckIn = {
  id: string
  kind: 'alcohol-free'
  date: string
  confirmedAt: string
} | {
  id: 'tracking-start'
  kind: 'tracking-start'
  date: string
}

export interface DailyCheckInState {
  startedOn: string
  alcoholFreeDates: string[]
}

export function isCalendarDate(value: unknown): value is LocalCalendarDateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  try {
    return Number.isFinite(differenceInLocalCalendarDays(value as LocalCalendarDateKey, value as LocalCalendarDateKey))
  } catch { return false }
}

export function checkInId(date: string) { return 'day:' + date }

export function displayCheckInDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function isDailyCheckIn(value: unknown): value is DailyCheckIn {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<DailyCheckIn> & { confirmedAt?: unknown }
  if (!isCalendarDate(row.date)) return false
  return row.kind === 'tracking-start' ? row.id === 'tracking-start'
    : row.kind === 'alcohol-free' && row.id === checkInId(row.date)
      && typeof row.confirmedAt === 'string' && Number.isFinite(Date.parse(row.confirmedAt))
}

/** Earliest known use survives later deletion; older migrated records still count. */
export function historyStartDate(state: DailyCheckInState, records: readonly DrinkingRecord[], today: string) {
  return [state.startedOn, ...state.alcoholFreeDates, ...records.map(getRecordLocalCalendarDateKey), today]
    .filter(date => isCalendarDate(date) && date <= today).sort()[0] ?? today
}

/**
 * Generate only the selected month's local calendar slots (at most 31).
 * No elapsed-millisecond arithmetic, future slots or pre-use missing history.
 */
export function historyMonthDates(year: number, month: number, start: string, today: string): string[] {
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: last }, (_, index) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(last - index).padStart(2, '0')}`,
  ).filter(date => date >= start && date <= today)
}
