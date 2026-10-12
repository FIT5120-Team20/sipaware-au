import { openSipAwareDatabase, DRINKING_RECORDS_STORE_NAME } from '../drinks/storage/indexedDb'
import { openCheckInDatabase, withDailyDataLock } from '../drinks/storage/dailyCheckInDatabase'
import { isDrinkingRecord } from '../drinks/storage/drinkingRecordRepository'
import { isDailyCheckIn, type AlcoholFreeCheckIn } from '../drinks/types/dailyCheckIn'
import type { DrinkingRecord } from '../drinks/types/drinkingRecord'
import { calculateAwards, type AwardEvaluationEvent } from './awardRules'
import { createAwardCollection, type AwardCollection } from './awardPresentation'
import { IndexedDbAwardRepository, type EarnedAward } from './awardRepository'

export interface AwardOverview extends AwardCollection {
  earned: EarnedAward[]
  newlyEarned: EarnedAward[]
}

/** Acknowledge only the creation event; never overwrite a concurrent correction. */
async function acknowledgeCreations(
  drinksDb: Awaited<ReturnType<typeof openSipAwareDatabase>>,
  checkInsDb: Awaited<ReturnType<typeof openCheckInDatabase>>,
  records: readonly DrinkingRecord[],
  checkIns: readonly AlcoholFreeCheckIn[],
): Promise<void> {
  const acknowledgeDrinks = async () => {
    if (records.length === 0) return
    const tx = drinksDb.transaction(DRINKING_RECORDS_STORE_NAME, 'readwrite')
    void tx.done.catch(() => undefined)
    for (const record of records) {
      const current = await tx.store.get(record.id)
      if (current && current.createdAt === record.createdAt && current.awardCreationPending === true) {
        await tx.store.put({ ...current, awardCreationPending: false })
      }
    }
    await tx.done
  }
  const acknowledgeCheckIns = async () => {
    if (checkIns.length === 0) return
    const tx = checkInsDb.transaction('daily_checkins', 'readwrite')
    void tx.done.catch(() => undefined)
    for (const checkIn of checkIns) {
      const current = await tx.store.get(checkIn.id)
      if (current && current.kind === 'alcohol-free' && current.confirmedAt === checkIn.confirmedAt
        && current.awardCreationPending === true) {
        await tx.store.put({ ...current, awardCreationPending: false })
      }
    }
    await tx.done
  }
  // Grants have already committed. A failed acknowledgement simply retries
  // the same creation later; the earned-ID transaction prevents another grant.
  await acknowledgeDrinks().catch(() => undefined)
  await acknowledgeCheckIns().catch(() => undefined)
}

/** Coordinate history reads, pure evaluation, committed grants and presentation. */
export function loadAwardOverview(event: AwardEvaluationEvent = { type: 'refresh' }): Promise<AwardOverview> {
  return withDailyDataLock(async () => {
    const repository = new IndexedDbAwardRepository()
    const [drinksDb, checkInsDb, previous] = await Promise.all([
      openSipAwareDatabase(), openCheckInDatabase(), repository.list(),
    ])
    const [records, checkIns] = await Promise.all([
      drinksDb.getAll(DRINKING_RECORDS_STORE_NAME), checkInsDb.getAll('daily_checkins'),
    ])
    // These flags are written atomically with genuinely new Check-ins.
    // Restart recovery processes those saved events, not historical date matches.
    const pendingRecords = records.filter(record => isDrinkingRecord(record) && record.awardCreationPending === true)
    const pendingCheckIns = checkIns.filter((checkIn): checkIn is AlcoholFreeCheckIn =>
      isDailyCheckIn(checkIn) && checkIn.kind === 'alcohol-free' && checkIn.awardCreationPending === true)
    const creations: AwardEvaluationEvent[] = [...pendingRecords, ...pendingCheckIns]
      .map(checkIn => ({ type: 'created-check-in', checkIn }))
    const input = {
      records, checkIns, earnedIds: previous.map(row => row.id), now: new Date(),
      events: [...creations, ...(event.type !== 'refresh' ? [event] : [])],
    }
    const eligible = calculateAwards(input).filter(award => award.newlyEarned).map(award => award.id)
    const saved = eligible.length > 0
      ? await repository.grant(eligible, input.now)
      : { earned: previous, newlyEarned: [] }
    await acknowledgeCreations(drinksDb, checkInsDb, pendingRecords, pendingCheckIns)
    return {
      ...createAwardCollection(calculateAwards({ ...input, earnedIds: saved.earned.map(row => row.id) }), saved.earned, input.now),
      ...saved,
    }
  })
}
