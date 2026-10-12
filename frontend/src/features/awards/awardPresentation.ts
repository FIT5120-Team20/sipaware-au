import { AWARD_CATEGORIES, getCurrentMonthlyAward, type AwardCategory } from './awardDefinitions'
import type { EarnedAward } from './awardRepository'
import type { AwardProgress } from './awardRules'

export interface AwardPresentation extends AwardProgress {
  earnedAt?: string
  earnedLocalDate?: string
  medal: {
    assetId: string
    state: 'full-colour' | 'desaturated'
    month?: number
    year?: number
    // Phase 2 can supply a replaceable static SVG or PNG resource.
    source?: string
    format?: 'svg' | 'png'
  }
}

export interface AwardCollection {
  awards: AwardPresentation[]
  categories: Record<AwardCategory, AwardPresentation[]>
  currentMonthlyAward: AwardPresentation
  keepGoing: AwardPresentation[]
}

/** Filter before any catalogue, preview, detail, or progress-collection consumer. */
export function createAwardCollection(
  progress: readonly AwardProgress[], earned: readonly EarnedAward[], now: Date,
): AwardCollection {
  const currentId = getCurrentMonthlyAward(now).id
  const saved = new Map(earned.map(award => [award.id, award]))
  const visible = progress.filter(award => award.visibility === 'always'
    || (award.eligibility === 'monthly'
      ? award.id === currentId || (saved.has(award.id) && award.id < currentId)
      : saved.has(award.id)))
  const awards: AwardPresentation[] = visible.map(award => {
    const row = saved.get(award.id)
    return {
      ...award, earnedAt: row?.earnedAt, earnedLocalDate: row?.earnedLocalDate,
      medal: { assetId: award.medalAssetId, state: row ? 'full-colour' : 'desaturated', month: award.month, year: award.year },
    }
  })
  const categories = Object.fromEntries(AWARD_CATEGORIES.map(category => [
    category.id,
    awards.filter(award => award.category === category.id).sort((a, b) => {
      if (a.id === b.id) return 0
      if (category.id !== 'challenges') return a.order - b.order
      if (a.id === currentId) return -1
      if (b.id === currentId) return 1
      return (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') || a.id.localeCompare(b.id)
    }),
  ])) as Record<AwardCategory, AwardPresentation[]>
  const ordered = AWARD_CATEGORIES.flatMap(category => categories[category.id])
  return {
    awards: ordered, categories,
    currentMonthlyAward: categories.challenges.find(award => award.id === currentId)!,
    keepGoing: selectKeepGoing(ordered),
  }
}

/** Presentation priority only; eligibility remains owned by the rule calculator. */
function selectKeepGoing(awards: readonly AwardPresentation[]): AwardPresentation[] {
  const priority = (award: AwardPresentation) => award.goals.length > 0
    // A ranking only, never a displayed combined monthly completion percentage.
    ? award.goals.reduce((sum, goal) => sum + Math.min(goal.current / goal.target, 1), 0) / award.goals.length
    : award.progress / award.target
  return awards.filter(award => award.status !== 'earned' && award.eligibility !== 'limited-edition'
    && (award.progress > 0 || award.goals.some(goal => goal.current > 0)))
    .sort((a, b) => priority(b) - priority(a)
      || AWARD_CATEGORIES.findIndex(category => category.id === a.category) - AWARD_CATEGORIES.findIndex(category => category.id === b.category)
      || a.order - b.order || a.id.localeCompare(b.id))
}
