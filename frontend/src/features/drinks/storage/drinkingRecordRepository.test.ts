import { describe, expect, it, vi } from 'vitest'

import type { DrinkingRecord } from '../types/drinkingRecord'
import {
  DRINKING_RECORDS_STORAGE_KEY,
  LocalStorageDrinkingRecordRepository,
} from './drinkingRecordRepository'

const firstRecord: DrinkingRecord = {
  id: 'record-1',
  drinkType: 'beer',
  drinkName: 'Pale Ale',
  servingVolumeMl: 375,
  abvPercent: 4.5,
  amountConsumed: 1.5,
  consumedAt: '2026-08-26T09:30:00.000Z',
  consumedTimezoneOffsetMinutes: 0,
  createdAt: '2026-08-26T09:31:00.000Z',
}

const secondRecord: DrinkingRecord = {
  id: 'record-2',
  drinkType: 'wine',
  drinkName: 'Shiraz',
  servingVolumeMl: 150,
  abvPercent: 13,
  amountConsumed: 1,
  consumedAt: '2026-08-27T09:30:00.000Z',
  consumedTimezoneOffsetMinutes: 0,
  createdAt: '2026-08-27T09:31:00.000Z',
}

describe('LocalStorageDrinkingRecordRepository', () => {
  it('returns an empty collection when storage is missing', () => {
    const repository = new LocalStorageDrinkingRecordRepository()

    expect(repository.list()).toEqual([])
  })

  it('preserves existing records and makes them available to a new instance', () => {
    const firstRepository = new LocalStorageDrinkingRecordRepository()
    firstRepository.add(firstRecord)

    const reloadedRepository = new LocalStorageDrinkingRecordRepository()
    expect(reloadedRepository.list()).toEqual([firstRecord])

    reloadedRepository.add(secondRecord)
    expect(firstRepository.list()).toEqual([firstRecord, secondRecord])
  })

  it.each([
    ['malformed JSON', '{not-json'],
    ['a non-array value', JSON.stringify({ records: [] })],
  ])('returns an empty collection for %s', (_caseName, storedValue) => {
    window.localStorage.setItem(DRINKING_RECORDS_STORAGE_KEY, storedValue)

    const repository = new LocalStorageDrinkingRecordRepository()

    expect(() => repository.list()).not.toThrow()
    expect(repository.list()).toEqual([])
  })

  it('filters malformed entries without discarding valid records', () => {
    window.localStorage.setItem(
      DRINKING_RECORDS_STORAGE_KEY,
      JSON.stringify([firstRecord, { id: 'incomplete-record' }]),
    )

    const repository = new LocalStorageDrinkingRecordRepository()

    expect(repository.list()).toEqual([firstRecord])
  })

  it('does not overwrite records when storage cannot be read', () => {
    const setItem = vi.fn()
    const throwingStorage: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => {
        throw new Error('Storage read failed')
      },
      key: () => null,
      removeItem: () => undefined,
      setItem,
    }
    const repository = new LocalStorageDrinkingRecordRepository(
      throwingStorage,
    )

    expect(repository.list()).toEqual([])
    expect(() => repository.add(firstRecord)).toThrow('Storage read failed')
    expect(setItem).not.toHaveBeenCalled()
  })
})
