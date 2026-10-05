/** Check-in metadata lives separately so frozen releases can still open the v1 drink database. */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { openSipAwareDatabase, type SipAwareDatabaseSchema } from './indexedDb'
import { checkInId, isDailyCheckIn, type DailyCheckIn } from '../types/dailyCheckIn'

interface CheckInSchema extends DBSchema {
  daily_checkins: { key: string; value: DailyCheckIn }
  metadata: { key: string; value: boolean }
}
interface PreviewSchema extends SipAwareDatabaseSchema {
  daily_checkins: { key: string; value: DailyCheckIn }
}
export const CHECKIN_DATABASE_NAME = 'sipaware_daily_checkins'
export type CheckInDatabaseProvider = () => Promise<IDBPDatabase<CheckInSchema>>
let connection: Promise<IDBPDatabase<CheckInSchema>> | undefined

export function openCheckInDatabase(): Promise<IDBPDatabase<CheckInSchema>> {
  connection ??= (async () => {
    const db = await openDB<CheckInSchema>(CHECKIN_DATABASE_NAME, 1, {
      upgrade(database) {
        database.createObjectStore('daily_checkins', { keyPath: 'id' })
        database.createObjectStore('metadata')
      },
      blocking() { db.close(); connection = undefined },
      terminated() { connection = undefined },
    })
    try {
      if (!await db.get('metadata', 'preview-v2-imported')) {
        // Preserve check-ins created in the unpublished v2 preview. Read the
        // old store without downgrading, deleting or rewriting any old data.
        const original = await openSipAwareDatabase()
        const preview = original as unknown as IDBPDatabase<PreviewSchema>
        const rows = preview.objectStoreNames.contains('daily_checkins')
          ? (await preview.getAll('daily_checkins')).filter(isDailyCheckIn) : []
        const tx = db.transaction(['daily_checkins', 'metadata'], 'readwrite')
        void tx.done.catch(() => undefined)
        if (!await tx.objectStore('metadata').get('preview-v2-imported')) {
          for (const row of rows) {
            if (!await tx.objectStore('daily_checkins').get(row.id)) await tx.objectStore('daily_checkins').put(row)
          }
          await tx.objectStore('metadata').put(true, 'preview-v2-imported')
        }
        await tx.done
      }
      return db
    } catch (error) { db.close(); throw error }
  })().catch(error => { connection = undefined; throw error })
  return connection
}

export async function closeCheckInDatabase(): Promise<void> {
  const previous = connection; connection = undefined
  if (previous) (await previous).close()
}

// New tabs coordinate related writes across the two databases. Older releases
// do not join this lock, so readers must always give actual drinks precedence.
let pending: Promise<unknown> = Promise.resolve()
export function withDailyDataLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('sipaware-daily-data', work)
  const next = pending.then(work, work)
  pending = next.catch(() => undefined)
  return next
}

export async function clearAlcoholFree(date: string): Promise<void> {
  const db = await openCheckInDatabase()
  await db.delete('daily_checkins', checkInId(date))
}
