import { isCalendarDate } from '../types/dailyCheckIn'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { HistoryRecord } from '../utils/historyCalendar'
import { getCurrentLocalCalendarDateKey, type LocalCalendarDateKey } from '../utils/localCalendarDate'
import { sumStandardDrinks, formatStandardDrinks } from './standardDrinks'

export type ConsumptionRange = 7 | 28

// Provisional project warning rule, independent of NHMRC guideline references.
export const DRIVING_AWARENESS_RULE = { windowHours: 12, warningStandardDrinks: 1.67 } as const
export const DRIVING_OBSERVATION_MS = DRIVING_AWARENESS_RULE.windowHours * 60 * 60 * 1000

export function localCalendarDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function shiftCalendarDate(date: string, days: number): LocalCalendarDateKey {
  const shifted = localCalendarDate(date)
  shifted.setDate(shifted.getDate() + days)
  return getCurrentLocalCalendarDateKey(shifted)
}

export function getRecordedDays(records: readonly HistoryRecord[], alcoholFreeDates: readonly string[], today: string) {
  const totals = new Map<string, number>()
  for (const record of records) {
    if (!isCalendarDate(record.date) || record.date > today) continue
    totals.set(record.date, (totals.get(record.date) ?? 0) + record.standardDrinks)
  }
  // A real drinking record takes precedence over any stale zero-day confirmation.
  const confirmedAlcoholFreeDates = new Set(alcoholFreeDates.filter(date =>
    isCalendarDate(date) && date <= today && !totals.has(date)))
  const knownDates = new Set([...totals.keys(), ...confirmedAlcoholFreeDates])
  return { totals, confirmedAlcoholFreeDates, knownDates }
}

type RecordedDays = ReturnType<typeof getRecordedDays>

function periodTotals(data: RecordedDays, end: string, days: number) {
  const dates = Array.from({ length: days }, (_, index) => shiftCalendarDate(end, index - days + 1))
  const total = dates.reduce((sum, date) => sum + (data.totals.get(date) ?? 0), 0)
  const knownDays = dates.filter(date => data.knownDates.has(date)).length
  const alcoholFreeDays = dates.filter(date => data.confirmedAlcoholFreeDates.has(date)).length
  return { start: dates[0], end, total, knownDays, alcoholFreeDays, complete: knownDays === days }
}

export type DailyConsumptionPoint = {
  date: LocalCalendarDateKey
  total: number | null
  status: 'drinking' | 'alcohol-free' | 'unrecorded'
}

export function dailyConsumptionPoints(data: RecordedDays, today: string, range: ConsumptionRange): DailyConsumptionPoint[] {
  return Array.from({ length: range }, (_, index): DailyConsumptionPoint => {
    const date = shiftCalendarDate(today, index - range + 1)
    const status = data.totals.has(date) ? 'drinking'
      : data.confirmedAlcoholFreeDates.has(date) ? 'alcohol-free' : 'unrecorded'
    const total = status === 'drinking' ? data.totals.get(date) ?? 0 : status === 'alcohol-free' ? 0 : null
    return { date, total, status }
  })
}

export function compareRecordedPeriods(data: RecordedDays, today: string) {
  const current = periodTotals(data, today, 28)
  const previous = periodTotals(data, shiftCalendarDate(today, -28), 28)
  // Observed data on every date is required in both periods; missing days never
  // create an apparent reduction or an extra alcohol-free day.
  const canCompare = current.complete && previous.complete
  const change = previous.total > 0 ? (current.total - previous.total) / previous.total * 100 : null
  return { current, previous, canCompare, change, alcoholFreeChange: current.alcoholFreeDays - previous.alcoholFreeDays }
}

export function recordedProgressMessage(comparison: ReturnType<typeof compareRecordedPeriods>): string {
  if (!comparison.canCompare) return 'More records needed for comparison.'
  if (comparison.change === null) {
    return comparison.current.total > 0
      ? `${formatStandardDrinks(comparison.current.total)} SD more recorded drinking`
      : 'No drinking recorded in either period'
  }
  if (Math.abs(comparison.change) < 0.5) return 'About the same recorded drinking'
  return `${Math.round(Math.abs(comparison.change))}% ${comparison.change < 0 ? 'less' : 'more'} recorded drinking`
}

export function personalisedRecordedInsight(data: RecordedDays, today: string, comparison: ReturnType<typeof compareRecordedPeriods>) {
  if (!comparison.current.complete) {
    return { message: 'More records needed to identify a pattern.', detail: 'A day needs a drinking record or a confirmed No alcohol check-in to count towards recording coverage.' }
  }
  if (comparison.current.alcoholFreeDays === 28) {
    return { message: 'You confirmed all of the last 28 days alcohol-free.', detail: 'This counts explicit No alcohol check-ins only.' }
  }
  let weekendTotal = 0, weekdayTotal = 0, weekendDays = 0, weekdayDays = 0
  let weekendDrinkingDays = 0, weekdayDrinkingDays = 0
  for (let index = 0; index < 28; index++) {
    const date = shiftCalendarDate(today, -index)
    const total = data.totals.get(date) ?? 0
    const day = localCalendarDate(date).getDay()
    if (day === 0 || day === 6) {
      weekendTotal += total; weekendDays++
      if (total > 0) weekendDrinkingDays++
    } else {
      weekdayTotal += total; weekdayDays++
      if (total > 0) weekdayDrinkingDays++
    }
  }
  const weekendAverage = weekendTotal / weekendDays
  const weekdayAverage = weekdayTotal / weekdayDays
  const detail = `Last 28 days: ${formatStandardDrinks(weekendAverage)} SD per weekend day and ${formatStandardDrinks(weekdayAverage)} SD per weekday, including confirmed alcohol-free days.`
  if (weekendDrinkingDays >= 3 && weekendAverage > weekdayAverage * 1.25) {
    return { message: 'You tend to record more drinking on weekends.', detail }
  }
  if (weekdayDrinkingDays >= 8 && weekdayAverage > weekendAverage * 1.25) {
    return { message: 'Your recorded daily intake tends to be higher on weekdays.', detail }
  }
  if (comparison.canCompare && comparison.change !== null && Math.abs(comparison.change) >= 5) {
    return {
      message: `Your recent recorded intake is ${comparison.change < 0 ? 'lower' : 'higher'} than in the previous period.`,
      detail: `${formatStandardDrinks(comparison.current.total)} SD in the last 28 days, compared with ${formatStandardDrinks(comparison.previous.total)} SD in the previous 28 days.`,
    }
  }
  return { message: 'No clear drinking pattern in your recent records.', detail: 'Patterns use recorded intake and explicit alcohol-free check-ins from the last 28 days.' }
}

export function recentDrivingAwareness(records: readonly DrinkingRecord[], now: number) {
  const cutoff = now - DRIVING_OBSERVATION_MS
  const recent = records.filter(record => {
    const consumed = Date.parse(record.consumedAt)
    return Number.isFinite(consumed) && consumed > cutoff && consumed <= now
  })
  const total = sumStandardDrinks(recent)
  const state: 'none' | 'risk' | 'caution' = recent.length === 0 ? 'none' : total >= DRIVING_AWARENESS_RULE.warningStandardDrinks ? 'risk' : 'caution'
  return { total, state }
}
