import { describe, expect, it, vi } from 'vitest'

import {
  createUpdatedSavedDrink,
  type SavedDrink,
} from '../types/savedDrink'
import { IndexedDbDrinkingRecordRepository } from './drinkingRecordRepository'
import { IndexedDbSavedDrinkRepository } from './savedDrinkRepository'

const firstSavedDrink: SavedDrink = {
  id: 'saved-drink-1',
  drinkType: 'beer',
  drinkName: 'Carlton Draught',
  servingVolumeMl: 375,
  abvPercent: 4.6,
  createdAt: '2026-08-26T09:30:00.000Z',
  updatedAt: '2026-08-26T09:30:00.000Z',
}

const secondSavedDrink: SavedDrink = {
  id: 'saved-drink-2',
  drinkType: 'wine',
  drinkName: 'Shiraz',
  servingVolumeMl: 150,
  abvPercent: 13.5,
  createdAt: '2026-08-27T09:30:00.000Z',
  updatedAt: '2026-08-27T09:30:00.000Z',
}

describe('IndexedDbSavedDrinkRepository', () => {
  it('returns an empty collection from an empty store', async () => {
    const repository = new IndexedDbSavedDrinkRepository()

    await expect(repository.list()).resolves.toEqual([])
  })

  it('persists multiple saved drinks and reloads them through a new repository', async () => {
    const firstRepository = new IndexedDbSavedDrinkRepository()
    await expect(firstRepository.add(firstSavedDrink)).resolves.toEqual([
      firstSavedDrink,
    ])

    const reloadedRepository = new IndexedDbSavedDrinkRepository()
    await expect(reloadedRepository.list()).resolves.toEqual([firstSavedDrink])
    await expect(reloadedRepository.add(secondSavedDrink)).resolves.toEqual([
      firstSavedDrink,
      secondSavedDrink,
    ])
    await expect(firstRepository.list()).resolves.toEqual([
      firstSavedDrink,
      secondSavedDrink,
    ])
  })

  it('updates one saved drink and preserves identity and unrelated values', async () => {
    const repository = new IndexedDbSavedDrinkRepository()
    await repository.add(firstSavedDrink)
    await repository.add(secondSavedDrink)
    const updatedFirstSavedDrink: SavedDrink = {
      ...firstSavedDrink,
      drinkName: 'Carlton Draught Large',
      servingVolumeMl: 500,
      abvPercent: 4.8,
      updatedAt: '2026-08-27T10:30:00.000Z',
    }

    await expect(repository.update(updatedFirstSavedDrink)).resolves.toEqual([
      updatedFirstSavedDrink,
      secondSavedDrink,
    ])
    await expect(new IndexedDbSavedDrinkRepository().list()).resolves.toEqual([
      updatedFirstSavedDrink,
      secondSavedDrink,
    ])
  })

  it('deletes only the requested saved drink and persists the remaining list', async () => {
    const repository = new IndexedDbSavedDrinkRepository()
    await repository.add(firstSavedDrink)
    await repository.add(secondSavedDrink)

    await expect(repository.delete(firstSavedDrink.id)).resolves.toEqual([
      secondSavedDrink,
    ])
    await expect(new IndexedDbSavedDrinkRepository().list()).resolves.toEqual([
      secondSavedDrink,
    ])
  })

  it('creates an updated value with unchanged identity and creation time', () => {
    const updatedSavedDrink = createUpdatedSavedDrink(firstSavedDrink, {
      drinkType: 'other',
      drinkName: 'Carlton Draught Large',
      servingVolumeMl: 500,
      abvPercent: 4.8,
    })

    expect(updatedSavedDrink).toMatchObject({
      id: firstSavedDrink.id,
      createdAt: firstSavedDrink.createdAt,
      drinkType: 'other',
      drinkName: 'Carlton Draught Large',
      servingVolumeMl: 500,
      abvPercent: 4.8,
    })
    expect(new Date(updatedSavedDrink.updatedAt).getTime()).toBeGreaterThan(
      new Date(firstSavedDrink.updatedAt).getTime(),
    )
  })

  it('rejects an invalid update without changing IndexedDB', async () => {
    const repository = new IndexedDbSavedDrinkRepository()
    await repository.add(firstSavedDrink)
    const invalidUpdate: SavedDrink = {
      ...firstSavedDrink,
      createdAt: '2026-08-27T09:30:00.000Z',
      updatedAt: '2026-08-27T10:30:00.000Z',
    }

    await expect(repository.update(invalidUpdate)).rejects.toThrow(
      'A saved drink creation time cannot be changed.',
    )
    await expect(repository.list()).resolves.toEqual([firstSavedDrink])
  })

  it('rejects invalid saved drinks without writing them', async () => {
    const repository = new IndexedDbSavedDrinkRepository()
    const invalidSavedDrink = { ...firstSavedDrink, abvPercent: 101 }

    await expect(repository.add(invalidSavedDrink)).rejects.toThrow(
      'Cannot save an invalid saved drink.',
    )
    await expect(repository.list()).resolves.toEqual([])
  })

  it('surfaces database failures instead of reporting an empty or saved state', async () => {
    const openFailedDatabase = vi.fn(async () => {
      throw new Error('IndexedDB unavailable')
    })
    const repository = new IndexedDbSavedDrinkRepository(openFailedDatabase)

    await expect(repository.list()).rejects.toThrow('IndexedDB unavailable')
    await expect(repository.add(firstSavedDrink)).rejects.toThrow(
      'IndexedDB unavailable',
    )
  })

  it('does not modify drinking-record history when saving a reusable drink', async () => {
    const recordRepository = new IndexedDbDrinkingRecordRepository()
    const existingRecord = {
      id: 'record-1',
      drinkType: 'beer' as const,
      drinkName: 'Historical beer',
      servingVolumeMl: 375,
      abvPercent: 4.5,
      amountConsumed: 1,
      consumedAt: '2026-08-26T09:30:00.000Z',
      consumedTimezoneOffsetMinutes: -600,
      createdAt: '2026-08-26T09:31:00.000Z',
    }
    await recordRepository.add(existingRecord)

    await new IndexedDbSavedDrinkRepository().add(firstSavedDrink)

    await expect(recordRepository.list()).resolves.toEqual([existingRecord])
  })
})
