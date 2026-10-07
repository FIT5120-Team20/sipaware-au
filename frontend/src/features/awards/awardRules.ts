import { isDrinkingRecord } from '../drinks/storage/drinkingRecordRepository'
import { isCalendarDate, isDailyCheckIn } from '../drinks/types/dailyCheckIn'
import { getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey } from '../drinks/utils/localCalendarDate'

export type AwardId = 'small-step' | 'keeping-track' | 'building-a-habit'
  | 'alcohol-free-start' | 'alcohol-free-progress' | 'know-your-patterns'

type AwardMetric = 'check-in' | 'creation-days' | 'alcohol-free-days' | 'trends-view'

export interface AwardDefinition {
  id: AwardId
  name: string
  condition: string
  metric: AwardMetric
  target: number
}

/** Product rules from Epic 6; no award measures how much alcohol was consumed. */
export const AWARDS: readonly AwardDefinition[] = [
  { id: 'small-step', name: 'Small Step', condition: 'Complete your first valid check-in.', metric: 'check-in', target: 1 },
  { id: 'keeping-track', name: 'Keeping Track', condition: 'Create check-ins on 7 different days. They do not need to be consecutive.', metric: 'creation-days', target: 7 },
  { id: 'building-a-habit', name: 'Building a Habit', condition: 'Create check-ins on 14 different days. They do not need to be consecutive.', metric: 'creation-days', target: 14 },
  { id: 'alcohol-free-start', name: 'Alcohol-Free Start', condition: 'Record your first alcohol-free day.', metric: 'alcohol-free-days', target: 1 },
  { id: 'alcohol-free-progress', name: 'Alcohol-Free Progress', condition: 'Record 5 different alcohol-free days. Past dates count too.', metric: 'alcohol-free-days', target: 5 },
  { id: 'know-your-patterns', name: 'Know Your Patterns', condition: 'View Trends when enough valid check-in history is available.', metric: 'trends-view', target: 1 },
]

export interface AwardProgress extends AwardDefinition {
  progress: number
  status: 'earned' | 'in-progress' | 'not-earned'
  newlyEarned: boolean
}

export interface AwardInput {
  // Validate stored rows before using them: old or damaged local data is possible.
  records: readonly unknown[]
  checkIns: readonly unknown[]
  earnedIds: readonly AwardId[]
  now: Date
  viewedTrends?: boolean
  // Deliberately unset until the team approves a definition of sufficient history.
  trendsMinimumDays?: number
}

/**
 * Pure calculation: reads no database, writes nothing, and sends no requests.
 * Creation dates use the viewer's current device timezone. Existing records
 * store consumption offsets, but do not store their creation-time timezone.
 */
export function calculateAwards(input: AwardInput): AwardProgress[] {
  if (!Number.isFinite(input.now.getTime())) throw new Error('A valid current time is required.')
  const today = getCurrentLocalCalendarDateKey(input.now)
  const creationDates = new Set<string>()
  const recordedDates = new Set<string>()
  const drinkingDates = new Set<string>()
  const alcoholFreeDates = new Set<string>()

  for (const record of input.records) {
    if (!isDrinkingRecord(record)) continue
    const date = getRecordLocalCalendarDateKey(record)
    if (!isCalendarDate(date) || date > today || Date.parse(record.createdAt) > input.now.getTime()) continue
    recordedDates.add(date)
    // Valid drink records require positive volume, servings and ABV. Even a
    // tiny amount that displays as 0.0 must override stale No alcohol metadata.
    drinkingDates.add(date)
    creationDates.add(getCurrentLocalCalendarDateKey(new Date(record.createdAt)))
  }

  for (const checkIn of input.checkIns) {
    if (!isDailyCheckIn(checkIn) || checkIn.kind !== 'alcohol-free') continue
    if (checkIn.date > today || Date.parse(checkIn.confirmedAt) > input.now.getTime()) continue
    // The existing check-in repository discards No alcohol metadata when a
    // drink exists on that date. Do not count that stale row as another day
    // of engagement before repository reconciliation has run.
    if (drinkingDates.has(checkIn.date)) continue
    recordedDates.add(checkIn.date)
    creationDates.add(getCurrentLocalCalendarDateKey(new Date(checkIn.confirmedAt)))
    alcoholFreeDates.add(checkIn.date)
  }

  const minimum = input.trendsMinimumDays
  const eligibleTrends = minimum !== undefined && Number.isInteger(minimum) && minimum > 0
    && recordedDates.size >= minimum && input.viewedTrends === true
  const values: Record<AwardMetric, number> = {
    'check-in': recordedDates.size > 0 ? 1 : 0,
    'creation-days': creationDates.size,
    'alcohol-free-days': alcoholFreeDates.size,
    'trends-view': eligibleTrends ? 1 : 0,
  }
  const previouslyEarned = new Set(input.earnedIds)

  return AWARDS.map(award => {
    const qualifies = values[award.metric] >= award.target
    const earned = previouslyEarned.has(award.id) || qualifies
    return {
      ...award,
      // Earned badges stay complete even after the source records are deleted.
      progress: earned ? award.target : Math.min(values[award.metric], award.target),
      status: earned ? 'earned' : values[award.metric] > 0 ? 'in-progress' : 'not-earned',
      newlyEarned: qualifies && !previouslyEarned.has(award.id),
    }
  })
}
