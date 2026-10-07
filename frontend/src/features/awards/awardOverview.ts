import { openSipAwareDatabase, DRINKING_RECORDS_STORE_NAME } from '../drinks/storage/indexedDb'
import { openCheckInDatabase, withDailyDataLock } from '../drinks/storage/dailyCheckInDatabase'
import { calculateAwards, type AwardProgress } from './awardRules'
import { IndexedDbAwardRepository, type EarnedAward } from './awardRepository'

export interface AwardOverview {
  awards: AwardProgress[]
  earned: EarnedAward[]
  newlyEarned: EarnedAward[]
}

/** Load real local history, then persist qualified awards before displaying success. */
export function loadAwardOverview(options: { viewedTrends?: boolean } = {}): Promise<AwardOverview> {
  return withDailyDataLock(async () => {
    const repository = new IndexedDbAwardRepository()
    const [drinksDb, checkInsDb, previous] = await Promise.all([
      openSipAwareDatabase(), openCheckInDatabase(), repository.list(),
    ])
    const [records, checkIns] = await Promise.all([
      drinksDb.getAll(DRINKING_RECORDS_STORE_NAME), checkInsDb.getAll('daily_checkins'),
    ])
    const input = { records, checkIns, earnedIds: previous.map(row => row.id), now: new Date(), trendsMinimumDays: 7, viewedTrends: options.viewedTrends === true }
    const eligible = calculateAwards(input).filter(award => award.newlyEarned).map(award => award.id)
    const saved = await repository.grant(eligible, input.now)
    return {
      awards: calculateAwards({ ...input, earnedIds: saved.earned.map(row => row.id) }),
      ...saved,
    }
  })
}
