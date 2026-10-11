/** Device-only day confirmations; actual drink snapshots always take precedence. */
import { DRINKING_RECORDS_STORE_NAME, openSipAwareDatabase, type SipAwareDatabaseProvider } from './indexedDb'
import { openCheckInDatabase, withDailyDataLock, type CheckInDatabaseProvider } from './dailyCheckInDatabase'
import { checkInId, isCalendarDate, isDailyCheckIn, type DailyCheckInState } from '../types/dailyCheckIn'
import { getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey } from '../utils/localCalendarDate'

export class IndexedDbDailyCheckInRepository {
  constructor(private readonly openDatabase: SipAwareDatabaseProvider = openSipAwareDatabase,
    private readonly openCheckIns: CheckInDatabaseProvider = openCheckInDatabase) {}

  /** Read explicit confirmations; legacy tracking metadata never defines History. */
  async initialize(): Promise<DailyCheckInState> {
    return withDailyDataLock(async () => {
      const records = await (await this.openDatabase()).getAll(DRINKING_RECORDS_STORE_NAME)
      const drinkDates = new Set(records.map(getRecordLocalCalendarDateKey))
      const db = await this.openCheckIns()
      const tx = db.transaction('daily_checkins', 'readwrite')
      void tx.done.catch(() => undefined)
      // Reconcile records written by retained releases without creating or
      // replacing confirmations, metadata, or personal drinking snapshots.
      for (const date of drinkDates) await tx.store.delete(checkInId(date))
      const rows = (await tx.store.getAll()).filter(isDailyCheckIn)
      await tx.done
      return { alcoholFreeDates: rows.filter(row => row.kind === 'alcohol-free').map(row => row.date) }
    })
  }

  async confirmAlcoholFree(date: string): Promise<void> {
    if (!isCalendarDate(date) || date > getCurrentLocalCalendarDateKey()) throw new Error('Choose today or a valid past date.')
    return withDailyDataLock(async () => {
      const original = await this.openDatabase()
      const hasDrinks = async () => (await original.getAll(DRINKING_RECORDS_STORE_NAME))
        .some(record => getRecordLocalCalendarDateKey(record) === date)
      const conflict = () => new Error('This day already has drinking records. Review them in History before marking it alcohol-free.')
      if (await hasDrinks()) throw conflict()
      const db = await this.openCheckIns()
      const tx = db.transaction('daily_checkins', 'readwrite')
      void tx.done.catch(() => undefined)
      // Idempotent key preserves the original confirmation time on retries.
      if (!isDailyCheckIn(await tx.store.get(checkInId(date)))) {
        await tx.store.put({ id: checkInId(date), kind: 'alcohol-free', date, confirmedAt: new Date().toISOString() })
      }
      await tx.done
      if (await hasDrinks()) { await db.delete('daily_checkins', checkInId(date)); throw conflict() }
    })
  }
}
