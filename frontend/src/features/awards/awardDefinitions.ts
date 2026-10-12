export type AwardCategory = 'getting-started' | 'consistency' | 'challenges'
export type FixedAwardId = 'first-step' | 'know-your-patterns' | 'keeping-track' | '14-day-milestone' | 'building-a-habit'
export type LimitedOccasionId = 'world-health-day' | 'world-heart-day' | 'world-mental-health-day'
export type AwardId = FixedAwardId | `monthly:${string}` | `limited:${LimitedOccasionId}:${number}`
export type AwardEligibility = 'first-check-in' | 'trends-visit' | 'consecutive-dates' | 'monthly' | 'limited-edition'

export interface AwardDefinition {
  id: AwardId
  name: string
  category: AwardCategory
  order: number
  eligibility: AwardEligibility
  condition: string
  target: number
  medalAssetId: string
  visibility: 'always' | 'current-month-or-earned' | 'earned-only'
  month?: number
  year?: number
  significance?: string
}

export const AWARD_CATEGORIES: readonly { id: AwardCategory; name: string }[] = [
  { id: 'getting-started', name: 'Getting Started' },
  { id: 'consistency', name: 'Consistency' },
  { id: 'challenges', name: 'Challenges' },
]

export const AWARDS: readonly AwardDefinition[] = [
  { id: 'first-step', name: 'First Step', category: 'getting-started', order: 0,
    eligibility: 'first-check-in', condition: 'Create your first valid drinking record or No alcohol check-in. Past dates count.',
    target: 1, medalAssetId: 'first-step', visibility: 'always' },
  { id: 'know-your-patterns', name: 'Know Your Patterns', category: 'getting-started', order: 1,
    eligibility: 'trends-visit', condition: 'Record check-ins for at least 7 different calendar dates, then open Trends (Overview or History).',
    target: 7, medalAssetId: 'know-your-patterns', visibility: 'always' },
  ...([7, 14, 21] as const).map((target, order): AwardDefinition => ({
    id: target === 7 ? 'keeping-track' : target === 14 ? '14-day-milestone' : 'building-a-habit',
    name: target === 7 ? 'Keeping Track' : target === 14 ? '14-Day Milestone' : 'Building a Habit',
    category: 'consistency', order, eligibility: 'consecutive-dates',
    condition: `Record valid check-ins for ${target} consecutive calendar dates. Drinking and confirmed alcohol-free dates both count. Historical backfilling is allowed.`,
    target, medalAssetId: `consistency-${target}`, visibility: 'always',
  })),
]

export const MONTHLY_CHECK_IN_TARGET = 20
export const MONTHLY_ALCOHOL_FREE_TARGET = 5
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'] as const

/** A single definition factory serves every month and year. */
export function createMonthlyAward(year: number, month: number): AwardDefinition {
  if (!Number.isInteger(year) || year < 1000 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('A valid challenge year and month are required.')
  }
  return {
    id: `monthly:${year}-${String(month).padStart(2, '0')}`,
    name: `${MONTH_NAMES[month - 1]} Challenge ${year}`, category: 'challenges', order: 0,
    eligibility: 'monthly', target: MONTHLY_CHECK_IN_TARGET, month, year,
    condition: 'Record check-ins for at least 20 distinct dates in this month, including 5 explicitly confirmed alcohol-free dates with no drinking records. Both the recorded date and original creation date must be in this month. The challenge must be completed before the month ends.',
    medalAssetId: 'monthly-template', visibility: 'current-month-or-earned',
  }
}

export function getCurrentMonthlyAward(now = new Date()): AwardDefinition {
  return createMonthlyAward(now.getFullYear(), now.getMonth() + 1)
}

export const LIMITED_OCCASIONS: readonly {
  id: LimitedOccasionId; name: string; month: number; day: number; significance: string
}[] = [
  { id: 'world-health-day', name: 'World Health Day', month: 4, day: 7,
    significance: 'A day to raise awareness of health and wellbeing around the world.' },
  { id: 'world-heart-day', name: 'World Heart Day', month: 9, day: 29,
    significance: 'A day to raise awareness of heart health.' },
  { id: 'world-mental-health-day', name: 'World Mental Health Day', month: 10, day: 10,
    significance: 'A day to raise awareness of mental health and wellbeing.' },
]

export function createLimitedAward(occasion: typeof LIMITED_OCCASIONS[number], year: number): AwardDefinition {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error('A valid commemorative award year is required.')
  return {
    id: `limited:${occasion.id}:${year}`, name: `${occasion.name} ${year}`, category: 'challenges', order: 1,
    eligibility: 'limited-edition', target: 1, month: occasion.month, year,
    condition: `Create a new valid drinking record or No alcohol check-in on ${occasion.day} ${MONTH_NAMES[occasion.month - 1]} ${year}, using your local creation date. The date being recorded can be earlier. Editing or repeating a confirmation does not qualify.`,
    medalAssetId: occasion.id, visibility: 'earned-only', significance: occasion.significance,
  }
}

/** Resolve collectible instances without maintaining a per-month catalogue. */
export function getAwardDefinition(id: string): AwardDefinition | undefined {
  const fixed = AWARDS.find(award => award.id === id)
  if (fixed) return fixed
  const monthly = /^monthly:(\d{4})-(0[1-9]|1[0-2])$/.exec(id)
  if (monthly && Number(monthly[1]) >= 1000) return createMonthlyAward(Number(monthly[1]), Number(monthly[2]))
  const limited = /^limited:([a-z-]+):(\d{4})$/.exec(id)
  if (limited && Number(limited[2]) >= 1000) {
    const occasion = LIMITED_OCCASIONS.find(item => item.id === limited[1])
    if (occasion) return createLimitedAward(occasion, Number(limited[2]))
  }
  return undefined
}
