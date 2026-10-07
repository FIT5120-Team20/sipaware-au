import { afterEach, describe, expect, it } from 'vitest'
import { deleteDB, openDB } from 'idb'
import { AWARD_DATABASE_NAME, closeAwardDatabase, IndexedDbAwardRepository, openAwardDatabase, type AwardDatabaseSchema } from '../../../frontend/src/features/awards/awardRepository'
import { calculateAwards, type AwardId } from '../../../frontend/src/features/awards/awardRules'
import { openSipAwareDatabase } from '../../../frontend/src/features/drinks/storage/indexedDb'

const firstTime = new Date('2026-10-08T01:00:00.000Z')
const laterTime = new Date('2026-10-09T01:00:00.000Z')

afterEach(async () => {
  await closeAwardDatabase()
  await deleteDB(AWARD_DATABASE_NAME)
})

describe('earned award persistence', () => {
  it('starts empty without inventing earned awards', async () => {
    expect(await new IndexedDbAwardRepository().list()).toEqual([])
  })
  it('preserves grants and original timestamps after closing and reopening the database', async () => {
    await new IndexedDbAwardRepository().grant(['small-step'], firstTime)
    await closeAwardDatabase()
    expect(await new IndexedDbAwardRepository().list()).toEqual([{ id: 'small-step', earnedAt: firstTime.toISOString() }])
  })
  it('deduplicates repeated grants and only announces newly stored awards', async () => {
    const repository = new IndexedDbAwardRepository()
    expect((await repository.grant(['small-step', 'small-step'], firstTime)).newlyEarned).toHaveLength(1)
    const result = await repository.grant(['small-step', 'alcohol-free-start'], laterTime)
    expect(result.newlyEarned).toEqual([{ id: 'alcohol-free-start', earnedAt: laterTime.toISOString() }])
    expect(result.earned.find(row => row.id === 'small-step')?.earnedAt).toBe(firstTime.toISOString())
  })
  it('serializes separate database connections without duplicate grants or lost awards', async () => {
    await openAwardDatabase()
    const otherConnection = await openDB<AwardDatabaseSchema>(AWARD_DATABASE_NAME, 1)
    try {
      const results = await Promise.all([
        new IndexedDbAwardRepository().grant(['small-step', 'keeping-track'], firstTime),
        new IndexedDbAwardRepository(async () => otherConnection).grant(['small-step', 'alcohol-free-start'], laterTime),
      ])
      expect(results.flatMap(result => result.newlyEarned).filter(row => row.id === 'small-step')).toHaveLength(1)
      expect(await new IndexedDbAwardRepository().list()).toHaveLength(3)
    } finally { otherConnection.close() }
  })
  it('keeps previously earned awards when recalculation has no remaining history', async () => {
    const repository = new IndexedDbAwardRepository()
    await repository.grant(['alcohol-free-progress'], firstTime)
    const earned = await repository.list()
    const result = calculateAwards({ records: [], checkIns: [], earnedIds: earned.map(row => row.id), now: laterTime })
    expect(result.find(row => row.id === 'alcohol-free-progress')).toMatchObject({ status: 'earned', newlyEarned: false })
    expect((await repository.grant([], laterTime)).earned).toEqual(earned)
  })
  it('rejects invalid input before partially storing any award', async () => {
    const repository = new IndexedDbAwardRepository()
    await expect(repository.grant(['small-step', 'invalid' as AwardId], firstTime)).rejects.toThrow()
    await expect(repository.grant(['small-step'], new Date('invalid'))).rejects.toThrow()
    expect(await repository.list()).toEqual([])
  })
  it('propagates storage failures instead of reporting success', async () => {
    const repository = new IndexedDbAwardRepository(async () => { throw new Error('Storage unavailable') })
    await expect(repository.list()).rejects.toThrow('Storage unavailable')
    await expect(repository.grant(['small-step'], firstTime)).rejects.toThrow('Storage unavailable')
  })
  it('aborts the entire batch if IndexedDB fails after the first add', async () => {
    const db = await openAwardDatabase()
    // Hook the second add request to abort the real fake-indexeddb transaction.
    const originalTransaction = db.transaction.bind(db)
    const provider = async () => new Proxy(db, {
      get(target, property) {
        if (property !== 'transaction') return Reflect.get(target, property)
        return () => {
          const tx = originalTransaction('earned_awards', 'readwrite')
          const originalAdd = tx.store!.add.bind(tx.store!)
          let adds = 0
          tx.store!.add = async (...values: Parameters<typeof originalAdd>) => {
            adds++
            if (adds === 2) { tx.abort(); throw new Error('Write failed') }
            return originalAdd(...values)
          }
          return tx
        }
      },
    })
    await expect(new IndexedDbAwardRepository(provider).grant(['small-step', 'keeping-track'], firstTime)).rejects.toThrow('Write failed')
    expect(await new IndexedDbAwardRepository().list()).toEqual([])
  })
  it('does not silently overwrite corrupt persisted awards', async () => {
    const db = await openAwardDatabase()
    await db.put('earned_awards', { id: 'small-step', earnedAt: 'invalid' })
    const repository = new IndexedDbAwardRepository()
    await expect(repository.list()).rejects.toThrow('Saved awards could not be read')
    await expect(repository.grant(['small-step'], firstTime)).rejects.toThrow('Saved awards could not be read')
    expect((await db.get('earned_awards', 'small-step'))?.earnedAt).toBe('invalid')
  })
  it('leaves the existing personal database schema unchanged', async () => {
    const drinks = await openSipAwareDatabase()
    const before = { version: drinks.version, stores: Array.from(drinks.objectStoreNames) }
    await new IndexedDbAwardRepository().grant(['small-step'], firstTime)
    expect({ version: drinks.version, stores: Array.from(drinks.objectStoreNames) }).toEqual(before)
    expect(drinks.objectStoreNames.contains('earned_awards' as never)).toBe(false)
  })
})
