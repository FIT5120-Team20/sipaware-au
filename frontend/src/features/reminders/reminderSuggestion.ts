import { isDrinkingRecord } from '../drinks/storage/drinkingRecordRepository'
import { isDailyCheckIn } from '../drinks/types/dailyCheckIn'
import { getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey } from '../drinks/utils/localCalendarDate'
export interface ReminderSuggestion { time: string; matchingDays: number; totalDays: number }
/** Current device timezone; creation offsets were not stored in legacy records.
 * Circular windows include midnight. Ties prefer the earliest window start.
 * The recommended time is the median in the winning window, rounded to a minute.
 */
export function suggestReminder(records: readonly unknown[], checkIns: readonly unknown[], now = new Date()): ReminderSuggestion | null {
  if (!Number.isFinite(now.getTime())) return null
  const today = getCurrentLocalCalendarDateKey(now)
  const first = new Map<string, number>()
  function add(timestamp: string) {
    const date = new Date(timestamp)
    if (!Number.isFinite(date.getTime()) || date > now) return
    const key = getCurrentLocalCalendarDateKey(date)
    const previous = first.get(key)
    if (previous === undefined || date.getTime() < previous) first.set(key, date.getTime())
  }
  const drinkingDates = new Set<string>()
  for (const record of records) {
    if (isDrinkingRecord(record) && getRecordLocalCalendarDateKey(record) <= today && Date.parse(record.createdAt) <= now.getTime()) {
      drinkingDates.add(getRecordLocalCalendarDateKey(record)); add(record.createdAt)
    }
  }
  for (const row of checkIns) {
    if (isDailyCheckIn(row) && row.kind === 'alcohol-free' && row.date <= today && !drinkingDates.has(row.date)) add(row.confirmedAt)
  }
  if (first.size < 7) return null
  const minutes = [...first.values()].map(value => { const date = new Date(value); return date.getHours() * 60 + date.getMinutes() }).sort((a, b) => a - b)
  let best: number[] = []
  for (const start of minutes) {
    const window = minutes.map(value => (value - start + 1440) % 1440).filter(value => value <= 120).sort((a, b) => a - b)
    if (window.length > best.length) best = window.map(value => start + value)
  }
  if (best.length / first.size < .7) return null
  const middle = Math.floor(best.length / 2)
  const minute = Math.round(best.length % 2 ? best[middle] : (best[middle - 1] + best[middle]) / 2) % 1440
  return { time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, matchingDays: best.length, totalDays: first.size }
}
