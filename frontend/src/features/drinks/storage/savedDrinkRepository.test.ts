import { describe, expect, it, vi } from 'vitest'

import {
  createUpdatedSavedDrink,
  type SavedDrink,
} from '../types/savedDrink'
import { DRINKING_RECORDS_STORAGE_KEY } from './drinkingRecordRepository'
import {
  LocalStorageSavedDrinkRepository,
  SAVED_DRINKS_STORAGE_KEY,
} from './savedDrinkRepository'

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

describe('LocalStorageSavedDrinkRepository', () => {
  it('returns an empty collection when storage is missing', () => {
    const repository = new LocalStorageSavedDrinkRepository()

    expect(repository.list()).toEqual([])
  })

  it('preserves saved drinks across additions and repository reloads', () => {
    const firstRepository = new LocalStorageSavedDrinkRepository()
    firstRepository.add(firstSavedDrink)

    const reloadedRepository = new LocalStorageSavedDrinkRepository()
    expect(reloadedRepository.list()).toEqual([firstSavedDrink])

    reloadedRepository.add(secondSavedDrink)
    expect(firstRepository.list()).toEqual([
      firstSavedDrink,
      secondSavedDrink,
    ])
  })

  it('updates one saved drink, preserves identity and unrelated drinks, and reloads it', () => {
    const repository = new LocalStorageSavedDrinkRepository()
    repository.add(firstSavedDrink)
    repository.add(secondSavedDrink)
    const updatedFirstSavedDrink: SavedDrink = {
      ...firstSavedDrink,
      drinkName: 'Carlton Draught Large',
      servingVolumeMl: 500,
      abvPercent: 4.8,
      updatedAt: '2026-08-27T10:30:00.000Z',
    }

    expect(repository.update(updatedFirstSavedDrink)).toEqual([
      updatedFirstSavedDrink,
      secondSavedDrink,
    ])
    expect(new LocalStorageSavedDrinkRepository().list()).toEqual([
      updatedFirstSavedDrink,
      secondSavedDrink,
    ])
    expect(updatedFirstSavedDrink.id).toBe(firstSavedDrink.id)
    expect(updatedFirstSavedDrink.createdAt).toBe(firstSavedDrink.createdAt)
  })

  it('deletes only the requested saved drink and persists the remaining list', () => {
    const repository = new LocalStorageSavedDrinkRepository()
    repository.add(firstSavedDrink)
    repository.add(secondSavedDrink)

    expect(repository.delete(firstSavedDrink.id)).toEqual([secondSavedDrink])
    expect(new LocalStorageSavedDrinkRepository().list()).toEqual([
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

  it('rejects an update that changes createdAt without writing it', () => {
    const repository = new LocalStorageSavedDrinkRepository()
    repository.add(firstSavedDrink)
    const invalidUpdate: SavedDrink = {
      ...firstSavedDrink,
      createdAt: '2026-08-27T09:30:00.000Z',
      updatedAt: '2026-08-27T10:30:00.000Z',
    }

    expect(() => repository.update(invalidUpdate)).toThrow(
      'A saved drink creation time cannot be changed.',
    )
    expect(repository.list()).toEqual([firstSavedDrink])
  })

  it.each([
    ['malformed JSON', '{not-json'],
    ['a non-array value', JSON.stringify({ savedDrinks: [] })],
  ])('returns an empty collection for %s', (_caseName, storedValue) => {
    window.localStorage.setItem(SAVED_DRINKS_STORAGE_KEY, storedValue)

    const repository = new LocalStorageSavedDrinkRepository()

    expect(() => repository.list()).not.toThrow()
    expect(repository.list()).toEqual([])
  })

  it('filters malformed entries without discarding valid saved drinks', () => {
    window.localStorage.setItem(
      SAVED_DRINKS_STORAGE_KEY,
      JSON.stringify([firstSavedDrink, { id: 'incomplete-saved-drink' }]),
    )

    const repository = new LocalStorageSavedDrinkRepository()

    expect(repository.list()).toEqual([firstSavedDrink])
  })

  it('rejects invalid saved drinks without writing them', () => {
    const repository = new LocalStorageSavedDrinkRepository()
    const invalidSavedDrink = {
      ...firstSavedDrink,
      abvPercent: 101,
    }

    expect(() => repository.add(invalidSavedDrink)).toThrow(
      'Cannot save an invalid saved drink.',
    )
    expect(window.localStorage.getItem(SAVED_DRINKS_STORAGE_KEY)).toBeNull()
  })

  it('does not overwrite saved drinks when storage cannot be read', () => {
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
    const repository = new LocalStorageSavedDrinkRepository(throwingStorage)

    expect(repository.list()).toEqual([])
    expect(() => repository.add(firstSavedDrink)).toThrow('Storage read failed')
    expect(() => repository.update(firstSavedDrink)).toThrow(
      'Storage read failed',
    )
    expect(() => repository.delete(firstSavedDrink.id)).toThrow(
      'Storage read failed',
    )
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not modify drinking-record history when saving a reusable drink', () => {
    const existingHistory = '[{"id":"record-1"}]'
    window.localStorage.setItem(
      DRINKING_RECORDS_STORAGE_KEY,
      existingHistory,
    )

    new LocalStorageSavedDrinkRepository().add(firstSavedDrink)

    expect(window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY)).toBe(
      existingHistory,
    )
  })
})
