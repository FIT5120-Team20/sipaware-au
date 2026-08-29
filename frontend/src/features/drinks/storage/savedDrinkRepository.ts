import type { IDBPTransaction } from 'idb'

import { isDrinkType } from '../config/drinkTypes'
import type { SavedDrink } from '../types/savedDrink'
import {
  openSipAwareDatabase,
  SAVED_DRINKS_STORE_NAME,
  type SipAwareDatabaseProvider,
  type SipAwareDatabaseSchema,
} from './indexedDb'

/**
 * Keeps UI code independent of the browser database technology while exposing
 * the asynchronous operations required by IndexedDB.
 */
export interface SavedDrinkRepository {
  /** Returns every reusable drink stored on this browser/device. */
  list(): Promise<SavedDrink[]>
  /** Persists a new reusable drink before returning the complete collection. */
  add(savedDrink: SavedDrink): Promise<SavedDrink[]>
  /** Replaces an existing reusable drink while preserving its identity. */
  update(savedDrink: SavedDrink): Promise<SavedDrink[]>
  /** Deletes one reusable drink without changing drinking-record history. */
  delete(savedDrinkId: string): Promise<SavedDrink[]>
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const parsedDate = new Date(value)
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString() === value
}

export function isSavedDrink(value: unknown): value is SavedDrink {
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
    isIsoTimestamp(candidate.createdAt) &&
    isIsoTimestamp(candidate.updatedAt)
  )
}

function sortSavedDrinks(savedDrinks: SavedDrink[]): SavedDrink[] {
  return savedDrinks.sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  )
}

type SavedDrinkWriteTransaction = IDBPTransaction<
  SipAwareDatabaseSchema,
  ['saved_drinks'],
  'readwrite'
>

async function listFromTransaction(
  transaction: SavedDrinkWriteTransaction,
): Promise<SavedDrink[]> {
  return sortSavedDrinks(await transaction.store.getAll())
}

/** IndexedDB implementation used by the active Epic 1 application runtime. */
export class IndexedDbSavedDrinkRepository implements SavedDrinkRepository {
  constructor(
    private readonly openDatabase: SipAwareDatabaseProvider =
      openSipAwareDatabase,
  ) {}

  async list(): Promise<SavedDrink[]> {
    const database = await this.openDatabase()
    return sortSavedDrinks(await database.getAll(SAVED_DRINKS_STORE_NAME))
  }

  async add(savedDrink: SavedDrink): Promise<SavedDrink[]> {
    if (!isSavedDrink(savedDrink)) {
      throw new Error('Cannot save an invalid saved drink.')
    }

    const database = await this.openDatabase()
    const transaction = database.transaction(
      SAVED_DRINKS_STORE_NAME,
      'readwrite',
    )

    // The mutation and returned snapshot share one transaction, so the UI is
    // never told about a value that failed to commit.
    await transaction.store.add(savedDrink)
    const savedDrinks = await listFromTransaction(transaction)
    await transaction.done
    return savedDrinks
  }

  async update(savedDrink: SavedDrink): Promise<SavedDrink[]> {
    if (!isSavedDrink(savedDrink)) {
      throw new Error('Cannot update an invalid saved drink.')
    }

    const database = await this.openDatabase()
    const transaction = database.transaction(
      SAVED_DRINKS_STORE_NAME,
      'readwrite',
    )
    const existingSavedDrink = await transaction.store.get(savedDrink.id)

    if (!existingSavedDrink) {
      transaction.abort()
      await transaction.done.catch(() => undefined)
      throw new Error('The saved drink no longer exists.')
    }

    if (savedDrink.createdAt !== existingSavedDrink.createdAt) {
      transaction.abort()
      await transaction.done.catch(() => undefined)
      throw new Error('A saved drink creation time cannot be changed.')
    }

    if (
      new Date(savedDrink.updatedAt).getTime() <=
      new Date(existingSavedDrink.updatedAt).getTime()
    ) {
      transaction.abort()
      await transaction.done.catch(() => undefined)
      throw new Error('A saved drink update time must move forward.')
    }

    await transaction.store.put(savedDrink)
    const savedDrinks = await listFromTransaction(transaction)
    await transaction.done
    return savedDrinks
  }

  async delete(savedDrinkId: string): Promise<SavedDrink[]> {
    if (!isNonEmptyString(savedDrinkId)) {
      throw new Error('A saved drink ID is required for deletion.')
    }

    const database = await this.openDatabase()
    const transaction = database.transaction(
      SAVED_DRINKS_STORE_NAME,
      'readwrite',
    )

    if (!(await transaction.store.get(savedDrinkId))) {
      transaction.abort()
      await transaction.done.catch(() => undefined)
      throw new Error('The saved drink no longer exists.')
    }

    await transaction.store.delete(savedDrinkId)
    const savedDrinks = await listFromTransaction(transaction)
    await transaction.done
    return savedDrinks
  }
}
