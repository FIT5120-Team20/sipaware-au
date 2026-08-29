import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { DrinkingRecord } from '../types/drinkingRecord'
import type { SavedDrink } from '../types/savedDrink'

/**
 * Browser-local schema for SipAware's personal drink data.
 *
 * `idb` is only a small Promise-based wrapper. The records are stored by the
 * browser's native IndexedDB implementation and are never sent to a backend,
 * analytics service, or cloud database.
 */
export interface SipAwareDatabaseSchema extends DBSchema {
  saved_drinks: {
    key: string
    value: SavedDrink
  }
  drinking_records: {
    key: string
    value: DrinkingRecord
  }
}

export const SIPAWARE_DATABASE_NAME = 'alcohol_user_data'
export const SIPAWARE_DATABASE_VERSION = 1
export const SAVED_DRINKS_STORE_NAME = 'saved_drinks'
export const DRINKING_RECORDS_STORE_NAME = 'drinking_records'

export type SipAwareDatabase = IDBPDatabase<SipAwareDatabaseSchema>
export type SipAwareDatabaseProvider = () => Promise<SipAwareDatabase>

let databasePromise: Promise<SipAwareDatabase> | undefined

/**
 * Opens SipAware's browser-local personal-data database.
 *
 * Version 1 creates one store for reusable drinks and one for independent
 * drinking-history snapshots. Both use the application-generated `id` as the
 * IndexedDB primary key, keeping identity stable through later corrections.
 */
export function openSipAwareDatabase(): Promise<SipAwareDatabase> {
  // All repositories share one asynchronously opened connection, ensuring they
  // use the same versioned schema while still operating on separate stores.
  databasePromise ??= openDB<SipAwareDatabaseSchema>(
    SIPAWARE_DATABASE_NAME,
    SIPAWARE_DATABASE_VERSION,
    {
      upgrade(database) {
        if (!database.objectStoreNames.contains(SAVED_DRINKS_STORE_NAME)) {
          database.createObjectStore(SAVED_DRINKS_STORE_NAME, {
            keyPath: 'id',
          })
        }

        if (!database.objectStoreNames.contains(DRINKING_RECORDS_STORE_NAME)) {
          database.createObjectStore(DRINKING_RECORDS_STORE_NAME, {
            keyPath: 'id',
          })
        }
      },
    },
  )

  return databasePromise
}

/**
 * Closes the shared connection so tests or a future database upgrade can
 * safely delete/reopen the database without a blocked version-change request.
 */
export async function closeSipAwareDatabase(): Promise<void> {
  const openConnection = databasePromise
  databasePromise = undefined

  if (openConnection) {
    const database = await openConnection
    database.close()
  }
}
