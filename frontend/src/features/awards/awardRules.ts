import { isDrinkingRecord } from '../drinks/storage/drinkingRecordRepository'
import { isCalendarDate, isDailyCheckIn, type AlcoholFreeCheckIn } from '../drinks/types/dailyCheckIn'
import { hasValidCheckInCreation } from '../drinks/types/checkInCreation'
import type { DrinkingRecord } from '../drinks/types/drinkingRecord'
import { differenceInLocalCalendarDays, getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey,
  type LocalCalendarDateKey } from '../drinks/utils/localCalendarDate'
import { AWARDS, LIMITED_OCCASIONS, MONTHLY_ALCOHOL_FREE_TARGET, createLimitedAward,
  getAwardDefinition, getCurrentMonthlyAward, type AwardDefinition, type AwardId } from './awardDefinitions'

export { AWARDS } from './awardDefinitions'
export type { AwardDefinition, AwardId } from './awardDefinitions'

export type AwardEvaluationEvent =
  | { type: 'refresh' }
  | { type: 'trends-visit'; visitedAt: string }
  | { type: 'created-check-in'; checkIn: DrinkingRecord | AlcoholFreeCheckIn }

export interface AwardGoal {
  key: 'check-in-days' | 'consecutive-days' | 'alcohol-free-days'
  label: string
  current: number
  target: number
}

export interface AwardProgress extends AwardDefinition {
  progress: number
  goals: AwardGoal[]
  status: 'earned' | 'in-progress' | 'not-earned'
  qualifies: boolean
  newlyEarned: boolean
}

export interface AwardInput {
  records: readonly unknown[]
  checkIns: readonly unknown[]
  earnedIds: readonly AwardId[]
  now: Date
  events?: readonly AwardEvaluationEvent[]
}

/** Calendar boundaries, not elapsed 24-hour periods, determine consecutive days. */
export function longestConsecutiveDates(dates: Iterable<LocalCalendarDateKey>): number {
  const ordered = [...new Set(dates)].sort()
  let longest = 0
  let current = 0
  let previous: LocalCalendarDateKey | undefined
  for (const date of ordered) {
    current = previous && differenceInLocalCalendarDays(date, previous) === 1 ? current + 1 : 1
    longest = Math.max(longest, current)
    previous = date
  }
  return longest
}

/** Pure eligibility calculation; only a successful repository grant means earned. */
export function calculateAwards(input: AwardInput): AwardProgress[] {
  if (!Number.isFinite(input.now.getTime())) throw new Error('A valid current time is required.')
  const today = getCurrentLocalCalendarDateKey(input.now)
  const monthly = getCurrentMonthlyAward(input.now)
  const monthKey = monthly.id.slice('monthly:'.length)
  const recordedDates = new Set<LocalCalendarDateKey>()
  const firstCreatedAtByDate = new Map<string, number>()
  const drinkingDates = new Set<string>()
  const monthlyDates = new Set<string>()
  const monthlyAlcoholFreeDates = new Set<string>()

  for (const record of input.records) {
    if (!isDrinkingRecord(record) || Date.parse(record.createdAt) > input.now.getTime()) continue
    const date = getRecordLocalCalendarDateKey(record)
    if (!isCalendarDate(date) || date > today) continue
    recordedDates.add(date)
    firstCreatedAtByDate.set(date, Math.min(firstCreatedAtByDate.get(date) ?? Infinity, Date.parse(record.createdAt)))
    // Any valid positive consumption overrides a conflicting No alcohol row,
    // including amounts whose displayed standard-drink total rounds to zero.
    drinkingDates.add(date)
    if (date.startsWith(monthKey + '-') && hasValidCheckInCreation(record, record.createdAt)
      && record.createdLocalDate.startsWith(monthKey + '-')) monthlyDates.add(date)
  }

  for (const checkIn of input.checkIns) {
    if (!isDailyCheckIn(checkIn) || checkIn.kind !== 'alcohol-free' || !isCalendarDate(checkIn.date)
      || checkIn.date > today || Date.parse(checkIn.confirmedAt) > input.now.getTime()
      || drinkingDates.has(checkIn.date)) continue
    recordedDates.add(checkIn.date)
    firstCreatedAtByDate.set(checkIn.date, Math.min(firstCreatedAtByDate.get(checkIn.date) ?? Infinity, Date.parse(checkIn.confirmedAt)))
    if (checkIn.date.startsWith(monthKey + '-') && hasValidCheckInCreation(checkIn, checkIn.confirmedAt)
      && checkIn.createdLocalDate.startsWith(monthKey + '-')) {
      monthlyDates.add(checkIn.date)
      monthlyAlcoholFreeDates.add(checkIn.date)
    }
  }

  const earnedIds = new Set(input.earnedIds)
  const definitions = new Map<AwardId, AwardDefinition>([...AWARDS, monthly].map(award => [award.id, award]))
  for (const id of earnedIds) {
    const definition = getAwardDefinition(id)
    if (definition) definitions.set(definition.id, definition)
  }

  // A committed new-creation event is required. Loading history, editing, and
  // visiting the app never reconstruct a limited award from stored records.
  const eligibleLimitedIds = new Set<AwardId>()
  let newCheckInCreated = false
  for (const event of input.events ?? []) {
    if (event.type !== 'created-check-in') continue
    const checkIn = event.checkIn
    let timestamp: string
    let date: string
    if (isDrinkingRecord(checkIn)) {
      timestamp = checkIn.createdAt
      date = getRecordLocalCalendarDateKey(checkIn)
    } else if (isDailyCheckIn(checkIn) && checkIn.kind === 'alcohol-free') {
      timestamp = checkIn.confirmedAt
      date = checkIn.date
    } else continue
    if (!isCalendarDate(date) || date > today || Date.parse(timestamp) > input.now.getTime()
      || !hasValidCheckInCreation(checkIn, timestamp)) continue
    newCheckInCreated = true
    const [year, month, day] = checkIn.createdLocalDate.split('-').map(Number)
    for (const occasion of LIMITED_OCCASIONS) {
      if (occasion.month !== month || occasion.day !== day) continue
      const definition = createLimitedAward(occasion, year)
      definitions.set(definition.id, definition)
      eligibleLimitedIds.add(definition.id)
    }
  }

  const consecutiveDays = longestConsecutiveDates(recordedDates)
  const datesAtTrendsVisit = (input.events ?? []).reduce((count, event) => {
    if (event.type !== 'trends-visit') return count
    const visitedAt = Date.parse(event.visitedAt)
    if (!Number.isFinite(visitedAt) || visitedAt > input.now.getTime()) return count
    // A check-in committed after the navigation action cannot retroactively
    // turn an earlier, ineligible visit into an eligible one.
    return Math.max(count, [...firstCreatedAtByDate.values()].filter(createdAt => createdAt <= visitedAt).length)
  }, 0)
  return [...definitions.values()].map(award => {
    let progress = 0
    let qualifies = false
    let goals: AwardGoal[] = []
    switch (award.eligibility) {
      case 'first-check-in':
        progress = recordedDates.size > 0 || newCheckInCreated ? 1 : 0
        qualifies = progress === 1
        break
      case 'trends-visit':
        progress = Math.min(recordedDates.size, award.target)
        qualifies = datesAtTrendsVisit >= award.target
        goals = [{ key: 'check-in-days', label: 'Check-in dates', current: recordedDates.size, target: award.target }]
        break
      case 'consecutive-dates':
        progress = Math.min(consecutiveDays, award.target)
        qualifies = consecutiveDays >= award.target
        goals = [{ key: 'consecutive-days', label: 'Consecutive dates', current: consecutiveDays, target: award.target }]
        break
      case 'monthly':
        // Expired months remain collectibles, but are never evaluated for a grant.
        if (award.id === monthly.id) {
          progress = Math.min(monthlyDates.size, award.target)
          qualifies = monthlyDates.size >= award.target && monthlyAlcoholFreeDates.size >= MONTHLY_ALCOHOL_FREE_TARGET
          goals = [
            { key: 'check-in-days', label: 'Check-in days', current: monthlyDates.size, target: award.target },
            { key: 'alcohol-free-days', label: 'Alcohol-free days', current: monthlyAlcoholFreeDates.size, target: MONTHLY_ALCOHOL_FREE_TARGET },
          ]
        }
        break
      case 'limited-edition':
        qualifies = eligibleLimitedIds.has(award.id)
        progress = qualifies ? 1 : 0
        break
    }
    const earned = earnedIds.has(award.id)
    return {
      ...award, progress: earned ? award.target : progress, goals,
      status: earned ? 'earned' : progress > 0 ? 'in-progress' : 'not-earned',
      qualifies, newlyEarned: qualifies && !earned,
    }
  })
}
