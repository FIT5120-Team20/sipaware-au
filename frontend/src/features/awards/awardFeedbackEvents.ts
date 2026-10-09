import { loadAwardOverview } from './awardOverview'

export const AWARD_FEEDBACK_EVENT = 'sipaware:award-feedback'

/** Called only AFTER a history write commits. Award failure must not reject that write. */
export async function updateAwardsAfterCheckIn(options: { viewedTrends?: boolean } = {}): Promise<void> {
  try {
    const result = await loadAwardOverview(options)
    if (result.newlyEarned.length === 0) return
    const names = result.newlyEarned.map(row => result.awards.find(award => award.id === row.id)!.name)
    window.dispatchEvent(new CustomEvent(AWARD_FEEDBACK_EVENT, {
      detail: { message: `New award earned: ${names.join(', ')}.`, failed: false },
    }))
  } catch {
    window.dispatchEvent(new CustomEvent(AWARD_FEEDBACK_EVENT, {
      detail: { message: options.viewedTrends ? 'Awards could not be updated. Open Awards, then return to Trends to retry.' : 'Your history change was saved, but awards could not be updated. Open Awards to retry. Do not record the same entry again.', failed: true },
    }))
  }
}
