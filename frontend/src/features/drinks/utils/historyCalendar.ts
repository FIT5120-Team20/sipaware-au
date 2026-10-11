import { isCalendarDate } from '../types/dailyCheckIn'

export type HistoryRecord = {
  id: string
  drinkName: string
  date: string
  time: string
  standardDrinks: number
}
export type HistoryDateGroup = [date: string, records: HistoryRecord[]]
export type HistoryDayStatus = 'above' | 'within' | 'alcohol-free' | 'unrecorded'

/** Complete calendar slots are presentation only; they never become saved days. */
export function calendarMonthDates(year: number, month: number): string[] {
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, day) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`,
  )
}

/** Only committed records and explicit confirmations produce History groups. */
export function groupHistoryRecords(records: readonly HistoryRecord[], alcoholFreeDates: readonly string[]): HistoryDateGroup[] {
  const groups = new Map<string, HistoryRecord[]>()
  for (const date of alcoholFreeDates) if (isCalendarDate(date)) groups.set(date, [])
  for (const record of records) groups.set(record.date, [...(groups.get(record.date) ?? []), record])
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => [date, items.sort((a, b) => b.time.localeCompare(a.time))])
}

/** Null leaves recorded drinking unclassified until the API reference is available. */
export function historyDayStatus(records: readonly HistoryRecord[], alcoholFree: boolean, dailyGuideline: number | null): HistoryDayStatus | null {
  // A real drinking snapshot always takes precedence over stale confirmations.
  if (!records.length) return alcoholFree ? 'alcohol-free' : 'unrecorded'
  if (dailyGuideline === null || !Number.isFinite(dailyGuideline) || dailyGuideline <= 0) return null
  const total = records.reduce((sum, record) => sum + record.standardDrinks, 0)
  return total > dailyGuideline ? 'above' : 'within'
}
