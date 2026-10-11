/** Migration and transaction tests protect real browser data, not UI snapshots. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDB } from 'idb'
import { closeCheckInDatabase, openCheckInDatabase, CHECKIN_DATABASE_NAME } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { closeSipAwareDatabase, openSipAwareDatabase, SIPAWARE_DATABASE_NAME } from '../../../frontend/src/features/drinks/storage/indexedDb'
import { IndexedDbDailyCheckInRepository } from '../../../frontend/src/features/drinks/storage/dailyCheckInRepository'
import { IndexedDbDrinkingRecordRepository } from '../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { checkInId, isCalendarDate } from '../../../frontend/src/features/drinks/types/dailyCheckIn'
import type { DrinkingRecord } from '../../../frontend/src/features/drinks/types/drinkingRecord'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 20)) })
afterEach(() => vi.useRealTimers())
function record(id = 'test', day = 3): DrinkingRecord {
  const date = new Date(2026, 9, day, 18)
  return { id, drinkType:'beer', drinkName:'Migration fixture', servingVolumeMl:330, abvPercent:5, amountConsumed:1,
    consumedAt:date.toISOString(), consumedTimezoneOffsetMinutes:date.getTimezoneOffset(), createdAt:date.toISOString() }
}

describe('local daily check-ins', () => {
  it('stops creating tracking metadata and leaves existing legacy metadata inert and intact', async () => {
    const repo = new IndexedDbDailyCheckInRepository()
    expect(await repo.initialize()).toEqual({ alcoholFreeDates: [] })
    const db = await openCheckInDatabase()
    expect(await db.get('daily_checkins', 'tracking-start')).toBeUndefined()
    const legacy = { id: 'tracking-start' as const, kind: 'tracking-start' as const, date: '2020-01-01' }
    await db.put('daily_checkins', legacy)
    await repo.confirmAlcoholFree('2026-10-04')
    expect(await repo.initialize()).toEqual({ alcoholFreeDates: ['2026-10-04'] })
    expect(await db.get('daily_checkins', 'tracking-start')).toEqual(legacy)
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([])
  })

  it('keeps the populated version-1 database readable by retained releases', async () => {
    const old = await openDB(SIPAWARE_DATABASE_NAME, 1, { upgrade(db) {
      db.createObjectStore('drinking_records', { keyPath:'id' }); db.createObjectStore('saved_drinks', { keyPath:'id' })
    } })
    const original = record()
    const template = { id:'template', drinkName:'Independent', drinkType:'beer', servingVolumeMl:500, abvPercent:4,
      createdAt:original.createdAt, updatedAt:original.createdAt }
    await old.put('drinking_records', original); await old.put('saved_drinks', template); old.close()
    const db = await openSipAwareDatabase()
    expect(db.version).toBe(1)
    expect(await db.getAll('drinking_records')).toEqual([original])
    expect(await db.getAll('saved_drinks')).toEqual([template])
    expect([...db.objectStoreNames]).toEqual(['drinking_records', 'saved_drinks'])
    const state = await new IndexedDbDailyCheckInRepository().initialize()
    expect(state).toEqual({ alcoholFreeDates:[] })
    const retained = await openDB(SIPAWARE_DATABASE_NAME, 1)
    expect(await retained.getAll('drinking_records')).toEqual([original])
    expect(await retained.getAll('saved_drinks')).toEqual([template])
    retained.close()
    expect((await openCheckInDatabase()).name).toBe(CHECKIN_DATABASE_NAME)
  })

  it('persists confirmed zero idempotently across repository and connection reloads', async () => {
    const repo = new IndexedDbDailyCheckInRepository()
    await repo.initialize(); await repo.confirmAlcoholFree('2026-10-04')
    const db = await openCheckInDatabase()
    const before = await db.get('daily_checkins', checkInId('2026-10-04'))
    vi.setSystemTime(new Date(2026, 9, 5, 21))
    await repo.confirmAlcoholFree('2026-10-04')
    expect(await db.get('daily_checkins', checkInId('2026-10-04'))).toEqual(before)
    await closeCheckInDatabase()
    await closeSipAwareDatabase()
    expect((await new IndexedDbDailyCheckInRepository().initialize()).alcoholFreeDates).toEqual(['2026-10-04'])
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([])
  })

  it('serializes competing zero/drink saves and removes zero only with a committed drink', async () => {
    const checkIns = new IndexedDbDailyCheckInRepository(); const drinks = new IndexedDbDrinkingRecordRepository()
    await checkIns.initialize()
    await Promise.allSettled([checkIns.confirmAlcoholFree('2026-10-03'), drinks.add(record())])
    expect(await drinks.list()).toEqual([record()])
    expect((await checkIns.initialize()).alcoholFreeDates).not.toContain('2026-10-03')
    await expect(checkIns.confirmAlcoholFree('2026-10-03')).rejects.toThrow('already has drinking records')
    await checkIns.confirmAlcoholFree('2026-10-04')
    await expect(drinks.add({ ...record('bad', 4), amountConsumed:0 })).rejects.toThrow()
    expect((await checkIns.initialize()).alcoholFreeDates).toContain('2026-10-04')
  })

  it('correcting a drink into a zero day clears that status, while deletion never confirms zero', async () => {
    const checkIns = new IndexedDbDailyCheckInRepository(); const drinks = new IndexedDbDrinkingRecordRepository()
    await drinks.add(record()); await checkIns.initialize(); await checkIns.confirmAlcoholFree('2026-10-04')
    await drinks.update({ ...record('test',4), createdAt:record().createdAt })
    expect((await checkIns.initialize()).alcoholFreeDates).toEqual([])
    await drinks.delete('test')
    expect(await checkIns.initialize()).toEqual({ alcoholFreeDates:[] })
  })

  it('keeps the zero status when a valid drink request aborts on a duplicate ID', async () => {
    const checkIns = new IndexedDbDailyCheckInRepository(); const drinks = new IndexedDbDrinkingRecordRepository()
    await drinks.add(record()); await checkIns.confirmAlcoholFree('2026-10-04')
    await expect(drinks.add(record('test',4))).rejects.toThrow()
    expect((await checkIns.initialize()).alcoholFreeDates).toEqual(['2026-10-04'])
    expect(await drinks.list()).toEqual([record()])
  })

  it('works beside an open retained v1 tab without requiring a database upgrade', async () => {
    const old = await openDB(SIPAWARE_DATABASE_NAME, 1, { upgrade(db) {
      db.createObjectStore('drinking_records', { keyPath:'id' }); db.createObjectStore('saved_drinks', { keyPath:'id' })
    } })
    await new IndexedDbDailyCheckInRepository().confirmAlcoholFree('2026-10-04')
    expect((await openSipAwareDatabase()).version).toBe(1)
    expect(old.version).toBe(1)
    old.close()
  })

  it('imports unpublished v2 check-ins once without changing the original records or version', async () => {
    const preview = await openDB(SIPAWARE_DATABASE_NAME, 2, { upgrade(db) {
      for (const name of ['drinking_records','saved_drinks','daily_checkins']) db.createObjectStore(name, { keyPath:'id' })
    } })
    const zero = { id:checkInId('2026-10-04'), kind:'alcohol-free', date:'2026-10-04', confirmedAt:new Date().toISOString() }
    await preview.put('drinking_records', record()); await preview.put('daily_checkins', zero)
    preview.close()
    const repo = new IndexedDbDailyCheckInRepository()
    expect((await repo.initialize()).alcoholFreeDates).toEqual(['2026-10-04'])
    expect((await openSipAwareDatabase()).version).toBe(2)
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([record()])
    await (await openCheckInDatabase()).delete('daily_checkins', zero.id)
    await closeCheckInDatabase()
    expect((await repo.initialize()).alcoholFreeDates).toEqual([])
  })

  it('does not report a committed drink as failed when secondary status cleanup fails', async () => {
    const repo = new IndexedDbDailyCheckInRepository(); const drinks = new IndexedDbDrinkingRecordRepository()
    await repo.confirmAlcoholFree('2026-10-03')
    const db = await openCheckInDatabase()
    const failure = vi.spyOn(db,'delete').mockRejectedValueOnce(new Error('Secondary storage unavailable'))
    await expect(drinks.add(record())).resolves.toEqual([record()])
    failure.mockRestore()
    await drinks.delete('test')
    expect((await repo.initialize()).alcoholFreeDates).toEqual([])
  })

  it('reconciles a drink written by a retained release before presenting zero confirmations', async () => {
    const repo = new IndexedDbDailyCheckInRepository()
    await repo.confirmAlcoholFree('2026-10-03')
    const retained = await openDB(SIPAWARE_DATABASE_NAME,1)
    await retained.put('drinking_records',record()); retained.close()
    expect((await repo.initialize()).alcoholFreeDates).toEqual([])
  })

  it('rejects invalid/future dates and unavailable storage without claiming a confirmation', async () => {
    const checkIns = new IndexedDbDailyCheckInRepository()
    for (const date of ['2026-02-30','2026-10-06','2026-1-01','not-a-date']) {
      await expect(checkIns.confirmAlcoholFree(date)).rejects.toThrow()
    }
    const broken = new IndexedDbDailyCheckInRepository(async () => { throw new Error('Storage denied') })
    await expect(broken.confirmAlcoholFree('2026-10-04')).rejects.toThrow('Storage denied')
    expect((await checkIns.initialize()).alcoholFreeDates).toEqual([])
  })

  it('validates exact local calendar keys, including leap years', () => {
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-10-04')).toBe(true)
  })
})
