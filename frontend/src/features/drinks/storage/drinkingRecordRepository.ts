import { isDrinkType } from '../config/drinkTypes'
import type { DrinkingRecord } from '../types/drinkingRecord'

export const DRINKING_RECORDS_STORAGE_KEY = 'sipaware.drinkingRecords.v1'

export interface DrinkingRecordRepository {
  list(): DrinkingRecord[]
  add(record: DrinkingRecord): DrinkingRecord[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const parsedDate = new Date(value)
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString() === value
}

export function isDrinkingRecord(value: unknown): value is DrinkingRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    isNonEmptyString(candidate.id) &&
    isDrinkType(candidate.drinkType) &&
    isNonEmptyString(candidate.drinkName) &&
    isPositiveFiniteNumber(candidate.servingVolumeMl) &&
    isPositiveFiniteNumber(candidate.abvPercent) &&
    candidate.abvPercent <= 100 &&
    isPositiveFiniteNumber(candidate.amountConsumed) &&
    isIsoTimestamp(candidate.consumedAt) &&
    isFiniteNumber(candidate.consumedTimezoneOffsetMinutes) &&
    isIsoTimestamp(candidate.createdAt)
  )
}

function parseStoredRecords(storedValue: string | null): DrinkingRecord[] {
  if (storedValue === null) {
    return []
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue)
    return Array.isArray(parsedValue)
      ? parsedValue.filter(isDrinkingRecord)
      : []
  } catch {
    return []
  }
}

export class LocalStorageDrinkingRecordRepository
  implements DrinkingRecordRepository
{
  constructor(
    private readonly storage: Storage | undefined = undefined,
    private readonly storageKey: string = DRINKING_RECORDS_STORAGE_KEY,
  ) {}

  private resolveStorage(): Storage {
    return this.storage ?? window.localStorage
  }

  private readFrom(storage: Storage): DrinkingRecord[] {
    return parseStoredRecords(storage.getItem(this.storageKey))
  }

  list(): DrinkingRecord[] {
    try {
      return this.readFrom(this.resolveStorage())
    } catch {
      return []
    }
  }

  add(record: DrinkingRecord): DrinkingRecord[] {
    if (!isDrinkingRecord(record)) {
      throw new Error('Cannot save an invalid drinking record.')
    }

    const storage = this.resolveStorage()
    const records = [...this.readFrom(storage), record]
    storage.setItem(this.storageKey, JSON.stringify(records))
    return records
  }
}
