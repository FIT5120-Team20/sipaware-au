import { describe, expect, it, vi } from 'vitest'

import {
  createUpdatedDrinkingRecord,
  type DrinkingRecord,
} from '../types/drinkingRecord'
import { IndexedDbDrinkingRecordRepository } from './drinkingRecordRepository'

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
  consumedTimezoneOffsetMinutes: -600,
  createdAt: '2026-08-27T09:31:00.000Z',
}

describe('IndexedDbDrinkingRecordRepository', () => {
  it('returns an empty collection from an empty store', async () => {
    const repository = new IndexedDbDrinkingRecordRepository()

    await expect(repository.list()).resolves.toEqual([])
  })

  it('persists multiple records and reloads history through a new repository', async () => {
    const firstRepository = new IndexedDbDrinkingRecordRepository()
    await expect(firstRepository.add(firstRecord)).resolves.toEqual([
      firstRecord,
    ])

    const reloadedRepository = new IndexedDbDrinkingRecordRepository()
    await expect(reloadedRepository.list()).resolves.toEqual([firstRecord])
    await expect(reloadedRepository.add(secondRecord)).resolves.toEqual([
      firstRecord,
      secondRecord,
    ])
    await expect(firstRepository.list()).resolves.toEqual([
      firstRecord,
      secondRecord,
    ])
  })

  it('updates one record while preserving identity and unrelated history', async () => {
    const repository = new IndexedDbDrinkingRecordRepository()
    await repository.add(firstRecord)
    await repository.add(secondRecord)
    const updatedFirstRecord: DrinkingRecord = {
      ...firstRecord,
      drinkName: 'Corrected Pale Ale',
      servingVolumeMl: 500,
      amountConsumed: 1,
    }

    await expect(repository.update(updatedFirstRecord)).resolves.toEqual([
      updatedFirstRecord,
      secondRecord,
    ])
    await expect(
      new IndexedDbDrinkingRecordRepository().list(),
    ).resolves.toEqual([updatedFirstRecord, secondRecord])
  })

  it('deletes only the requested record and persists the remaining history', async () => {
    const repository = new IndexedDbDrinkingRecordRepository()
    await repository.add(firstRecord)
    await repository.add(secondRecord)

    await expect(repository.delete(firstRecord.id)).resolves.toEqual([
      secondRecord,
    ])
    await expect(
      new IndexedDbDrinkingRecordRepository().list(),
    ).resolves.toEqual([secondRecord])
  })

  it('creates a corrected record with identity, creation time, and timezone semantics intact', () => {
    const correctedRecord = createUpdatedDrinkingRecord(firstRecord, {
      drinkType: 'other',
      drinkName: 'Corrected record',
      servingVolumeMl: 500,
      abvPercent: 4.8,
      amountConsumed: 1,
      consumedAt: '2026-08-25T12:00:00.000Z',
      consumedTimezoneOffsetMinutes: -600,
    })

    expect(correctedRecord).toMatchObject({
      id: firstRecord.id,
      createdAt: firstRecord.createdAt,
      consumedAt: '2026-08-25T12:00:00.000Z',
      consumedTimezoneOffsetMinutes: -600,
    })
  })

  it('rejects an update that changes createdAt without changing IndexedDB', async () => {
    const repository = new IndexedDbDrinkingRecordRepository()
    await repository.add(firstRecord)
    const invalidUpdate = {
      ...firstRecord,
      createdAt: '2026-08-27T12:00:00.000Z',
    }

    await expect(repository.update(invalidUpdate)).rejects.toThrow(
      'A drinking record creation time cannot be changed.',
    )
    await expect(repository.list()).resolves.toEqual([firstRecord])
  })

  it('surfaces database read and write failures to its caller', async () => {
    const openFailedDatabase = vi.fn(async () => {
      throw new Error('IndexedDB unavailable')
    })
    const repository = new IndexedDbDrinkingRecordRepository(
      openFailedDatabase,
    )

    await expect(repository.list()).rejects.toThrow('IndexedDB unavailable')
    await expect(repository.add(firstRecord)).rejects.toThrow(
      'IndexedDB unavailable',
    )
    await expect(repository.update(firstRecord)).rejects.toThrow(
      'IndexedDB unavailable',
    )
    await expect(repository.delete(firstRecord.id)).rejects.toThrow(
      'IndexedDB unavailable',
    )
  })
})
