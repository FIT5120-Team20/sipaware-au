/**
 * On-device daily status is independent of positive-quantity drink snapshots.
 * Absence means unknown, never confirmed abstinence. Calendar keys have no UTC
 * instant: an alcohol-free day has a date, but no invented drinking time.
 */
import { differenceInLocalCalendarDays, type LocalCalendarDateKey } from '../utils/localCalendarDate'

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
