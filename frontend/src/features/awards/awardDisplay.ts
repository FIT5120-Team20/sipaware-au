import type { AwardPresentation } from './awardPresentation'
import { MONTHLY_ALCOHOL_FREE_TARGET } from './awardDefinitions'

export function earnedDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function awardStatusLabel(award: AwardPresentation): string {
  if (award.status === 'earned') return award.earnedLocalDate ? `Earned ${earnedDateLabel(award.earnedLocalDate)}` : 'Earned'
  return award.status === 'in-progress' ? 'In progress' : 'Not yet earned'
}

/** Compact display of Phase 1 progress; never evaluates achievement criteria. */
export function compactAwardProgress(award: AwardPresentation): string {
  if (award.status === 'earned') return awardStatusLabel(award)
  if (award.eligibility === 'trends-visit' && award.progress >= award.target) return 'Ready — open Trends'
  if (award.eligibility === 'monthly') return award.goals
    .map(goal => `${Math.min(goal.current, goal.target)}/${goal.target} ${goal.key === 'alcohol-free-days' ? 'alcohol-free' : 'check-ins'}`).join(' · ')
  if (award.goals.length > 0) {
    const goal = award.goals[0]
    return `${Math.min(goal.current, goal.target)}/${goal.target} ${goal.key === 'consecutive-days' ? 'consecutive dates' : 'check-in dates'}`
  }
  return awardStatusLabel(award)
}

/** Detail copy describes the existing rule and committed earned state. */
export function awardDetailDescription(award: AwardPresentation): string {
  const earned = award.status === 'earned'
  switch (award.eligibility) {
    case 'first-check-in':
      return earned ? 'You completed your first valid check-in.' : award.condition
    case 'trends-visit':
      return earned ? `You opened Trends after recording check-ins for at least ${award.target} different dates.` : award.condition
    case 'consecutive-dates':
      return earned ? `You recorded check-ins for ${award.target} consecutive calendar dates.`
        : `Record check-ins for ${award.target} consecutive calendar dates.`
    case 'monthly':
      return earned ? `You completed at least ${award.target} check-in dates during the challenge month, including ${MONTHLY_ALCOHOL_FREE_TARGET} confirmed alcohol-free dates.`
        : `Record check-ins for at least ${award.target} dates this month, including ${MONTHLY_ALCOHOL_FREE_TARGET} confirmed alcohol-free dates.`
    case 'limited-edition':
      return 'You created a new valid check-in on this commemorative day. The date you recorded could be earlier.'
  }
}
