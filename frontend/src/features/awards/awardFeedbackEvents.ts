import { loadAwardOverview, type AwardOverview } from './awardOverview'
import type { AwardEvaluationEvent } from './awardRules'

export const AWARD_FEEDBACK_EVENT = 'sipaware:award-feedback'
export const AWARDS_CHANGED_EVENT = 'sipaware:awards-changed'

/** Only committed grants emit an unlock. The existing notice can display it. */
export function publishAwardResult(result: AwardOverview): void {
  window.dispatchEvent(new Event(AWARDS_CHANGED_EVENT))
  if (result.newlyEarned.length === 0) return
  const ids = new Set(result.newlyEarned.map(row => row.id))
  const awards = result.awards.filter(award => ids.has(award.id))
  const significance = awards.filter(award => award.eligibility === 'limited-edition')
    .map(award => award.significance).filter(Boolean).join(' ')
  window.dispatchEvent(new CustomEvent(AWARD_FEEDBACK_EVENT, {
    detail: {
      message: `New award earned: ${awards.map(award => award.name).join(', ')}.${significance ? ' ' + significance : ''}`,
      failed: false,
      // Phase 2 receives names, occasion explanations, earned dates and medal keys.
      awards,
    },
  }))
}

export async function refreshAwards(event: AwardEvaluationEvent = { type: 'refresh' }, historySaved = false): Promise<void> {
  try {
    publishAwardResult(await loadAwardOverview(event))
  } catch {
    window.dispatchEvent(new CustomEvent(AWARD_FEEDBACK_EVENT, {
      detail: {
        message: historySaved
          ? 'Your history change was saved, but awards could not be updated. Open Awards to retry. Do not record the same entry again.'
          : event.type === 'trends-visit'
            ? 'Awards could not be updated. Return to Trends to retry.'
            : 'Awards could not be updated. Open Awards to retry.',
        failed: true,
      },
    }))
  }
}

/** Called only after a history write commits; award failures never reject it. */
export async function updateAwardsAfterCheckIn(
  event: AwardEvaluationEvent = { type: 'refresh' },
): Promise<void> {
  // Existing Reminder integrations still receive exactly this history event.
  window.dispatchEvent(new Event('sipaware:history-committed'))
  await refreshAwards(event, true)
}

/** Call from a navigation action, never from record-dependent render effects. */
export function updateAwardsForTrendsVisit(): void {
  void refreshAwards({ type: 'trends-visit', visitedAt: new Date().toISOString() })
}
