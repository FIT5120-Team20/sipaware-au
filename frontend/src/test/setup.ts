import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { deleteDB } from 'idb'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

import {
  closeSipAwareDatabase,
  SIPAWARE_DATABASE_NAME,
} from '../features/drinks/storage/indexedDb'

afterEach(async () => {
  cleanup()
  await closeSipAwareDatabase()
  await deleteDB(SIPAWARE_DATABASE_NAME)
})
