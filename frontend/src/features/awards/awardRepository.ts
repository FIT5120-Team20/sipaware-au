import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { AWARDS, type AwardId } from './awardRules'

export interface EarnedAward {
  id: AwardId
  earnedAt: string
}

export interface AwardDatabaseSchema extends DBSchema {
  earned_awards: { key: AwardId; value: EarnedAward }
}

export const AWARD_DATABASE_NAME = 'sipaware_awards'
export type AwardDatabaseProvider = () => Promise<IDBPDatabase<AwardDatabaseSchema>>
let connection: Promise<IDBPDatabase<AwardDatabaseSchema>> | undefined

/** Separate database: never upgrades the drink database used by retained releases. */
export function openAwardDatabase(): Promise<IDBPDatabase<AwardDatabaseSchema>> {
  connection ??= openDB<AwardDatabaseSchema>(AWARD_DATABASE_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('earned_awards', { keyPath: 'id' })
    },
    blocking() {
      void closeAwardDatabase()
    },
    terminated() {
      connection = undefined
    },
  }).catch(error => {
    connection = undefined
    throw error
  })
  return connection
}

export async function closeAwardDatabase(): Promise<void> {
  const previous = connection
  connection = undefined
  if (previous) (await previous).close()
}

const knownIds = new Set<string>(AWARDS.map(award => award.id))
function isEarnedAward(value: unknown): value is EarnedAward {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<EarnedAward>
  if (typeof row.id !== 'string' || !knownIds.has(row.id) || typeof row.earnedAt !== 'string') return false
  const date = new Date(row.earnedAt)
  return Number.isFinite(date.getTime()) && date.toISOString() === row.earnedAt
}

export interface AwardGrantResult {
  earned: EarnedAward[]
  newlyEarned: EarnedAward[]
}

/** Append-only earned badges. Eligibility is the rule calculator's responsibility. */
export class IndexedDbAwardRepository {
  constructor(private readonly openDatabase: AwardDatabaseProvider = openAwardDatabase) {}

  async list(): Promise<EarnedAward[]> {
    const database = await this.openDatabase()
    const rows = await database.getAll('earned_awards')
    if (!rows.every(isEarnedAward)) throw new Error('Saved awards could not be read. No awards have been changed.')
    return rows
  }

  /**
   * One transaction serializes competing tabs. Repeated grants preserve the
   * original timestamp and do not repeat newly-earned feedback. No network or
   * other async work is allowed inside this IndexedDB transaction.
   */
  async grant(ids: readonly AwardId[], now: Date): Promise<AwardGrantResult> {
    if (!Number.isFinite(now.getTime()) || ids.some(id => !knownIds.has(id))) {
      throw new Error('Valid award IDs and a valid earning time are required.')
    }
    const earnedAt = now.toISOString()
    const database = await this.openDatabase()
    const tx = database.transaction('earned_awards', 'readwrite')
    void tx.done.catch(() => undefined)
    try {
      const existing = await tx.store.getAll()
      if (!existing.every(isEarnedAward)) throw new Error('Saved awards could not be read. No awards have been changed.')
      const earnedIds = new Set(existing.map(row => row.id))
      const newlyEarned: EarnedAward[] = []
      for (const id of new Set(ids)) {
        if (earnedIds.has(id)) continue
        const row = { id, earnedAt }
        await tx.store.add(row)
        newlyEarned.push(row)
      }
      const earned = await tx.store.getAll()
      await tx.done
      return { earned, newlyEarned }
    } catch (error) {
      // Never report a grant until the entire transaction is committed.
      try { tx.abort() } catch { /* It may already have aborted. */ }
      await tx.done.catch(() => undefined)
      throw error
    }
  }
}
