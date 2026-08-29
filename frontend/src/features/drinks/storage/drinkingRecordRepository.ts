/**
 * Persistence boundary for self-contained historical DrinkingRecord snapshots.
 * React code depends on this asynchronous contract rather than IndexedDB APIs,
 * and no operation in this module reads or mutates the SavedDrink store.
 */
import type { IDBPTransaction } from 'idb'

import { isDrinkType } from '../config/drinkTypes'
import type { DrinkingRecord } from '../types/drinkingRecord'
import {
  DRINKING_RECORDS_STORE_NAME,
  openSipAwareDatabase,
  type SipAwareDatabaseProvider,
  type SipAwareDatabaseSchema,
} from './indexedDb'

/**
 * Keeps UI code independent of the browser database technology while exposing
 * the asynchronous operations required by IndexedDB.
 */
export interface DrinkingRecordRepository {
  /** Returns every local drinking-history snapshot. */
  list(): Promise<DrinkingRecord[]>
  /** Persists a new independent history snapshot. */
  add(record: DrinkingRecord): Promise<DrinkingRecord[]>
  /** Replaces one corrected history snapshot without changing Saved Drinks. */
  update(record: DrinkingRecord): Promise<DrinkingRecord[]>
  /** Deletes one history snapshot without changing Saved Drinks. */
  delete(recordId: string): Promise<DrinkingRecord[]>
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

function sortRecords(records: DrinkingRecord[]): DrinkingRecord[] {
  return records.sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  )
}

type DrinkingRecordWriteTransaction = IDBPTransaction<
  SipAwareDatabaseSchema,
  ['drinking_records'],
  'readwrite'
>

async function listFromTransaction(
  transaction: DrinkingRecordWriteTransaction,
): Promise<DrinkingRecord[]> {
  return sortRecords(await transaction.store.getAll())
}

/** IndexedDB implementation used by the active Epic 1 application runtime. */
export class IndexedDbDrinkingRecordRepository
  implements DrinkingRecordRepository
{
  constructor(
    private readonly openDatabase: SipAwareDatabaseProvider =
      openSipAwareDatabase,
  ) {}

  async list(): Promise<DrinkingRecord[]> {
    const database = await this.openDatabase()
    return sortRecords(await database.getAll(DRINKING_RECORDS_STORE_NAME))
  }

  async add(record: DrinkingRecord): Promise<DrinkingRecord[]> {
    if (!isDrinkingRecord(record)) {
      throw new Error('Cannot save an invalid drinking record.')
    }

    const database = await this.openDatabase()
    const transaction = database.transaction(
      DRINKING_RECORDS_STORE_NAME,
      'readwrite',
    )

    // Keep the write and refreshed list in one transaction so UI state only
    // changes after IndexedDB has accepted the complete record snapshot.
    await transaction.store.add(record)
    const records = await listFromTransaction(transaction)
    await transaction.done
    return records
  }

  async update(record: DrinkingRecord): Promise<DrinkingRecord[]> {
    if (!isDrinkingRecord(record)) {
      throw new Error('Cannot update an invalid drinking record.')
    }

    const database = await this.openDatabase()
    const transaction = database.transaction(
      DRINKING_RECORDS_STORE_NAME,
      'readwrite',
    )
    // The ID selects the snapshot being corrected. createdAt remains immutable
    // so a correction cannot masquerade as a newly recorded occasion.
    const existingRecord = await transaction.store.get(record.id)

    if (!existingRecord) {
      transaction.abort()
      await transaction.done.catch(() => undefined)
      throw new Error('The drinking record no longer exists.')
    }

    if (record.createdAt !== existingRecord.createdAt) {
      transaction.abort()
      await transaction.done.catch(() => undefined)
      throw new Error('A drinking record creation time cannot be changed.')
    }

    await transaction.store.put(record)
    const records = await listFromTransaction(transaction)
    await transaction.done
    return records
  }

  async delete(recordId: string): Promise<DrinkingRecord[]> {
    if (!isNonEmptyString(recordId)) {
      throw new Error('A drinking record ID is required for deletion.')
    }

    // Only the history store participates in this transaction; deleting a
    // record therefore cannot remove or rewrite a My Drinks template.
    const database = await this.openDatabase()
    const transaction = database.transaction(
      DRINKING_RECORDS_STORE_NAME,
      'readwrite',
    )

    if (!(await transaction.store.get(recordId))) {
      transaction.abort()
      await transaction.done.catch(() => undefined)
      throw new Error('The drinking record no longer exists.')
    }

    await transaction.store.delete(recordId)
    const records = await listFromTransaction(transaction)
    await transaction.done
    return records
  }
}
