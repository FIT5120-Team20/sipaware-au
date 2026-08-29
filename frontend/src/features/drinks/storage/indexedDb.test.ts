import { describe, expect, it } from 'vitest'

import {
  DRINKING_RECORDS_STORE_NAME,
  openSipAwareDatabase,
  SAVED_DRINKS_STORE_NAME,
  SIPAWARE_DATABASE_NAME,
  SIPAWARE_DATABASE_VERSION,
} from './indexedDb'

describe('SipAware IndexedDB database', () => {
  it('opens the Data Science browser database and creates both personal-data stores', async () => {
    const database = await openSipAwareDatabase()

    expect(database.name).toBe('alcohol_user_data')
    expect(database.name).toBe(SIPAWARE_DATABASE_NAME)
    expect(database.version).toBe(SIPAWARE_DATABASE_VERSION)
    expect(database.objectStoreNames.contains(SAVED_DRINKS_STORE_NAME)).toBe(
      true,
    )
    expect(
      database.objectStoreNames.contains(DRINKING_RECORDS_STORE_NAME),
    ).toBe(true)
  })
})
