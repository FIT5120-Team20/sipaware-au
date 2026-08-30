/** Shared Vitest lifecycle setup for DOM cleanup and isolated IndexedDB state. */

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { deleteDB } from 'idb'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, vi } from 'vitest'

import {
  closeSipAwareDatabase,
  SIPAWARE_DATABASE_NAME,
} from '../../../frontend/src/features/drinks/storage/indexedDb'
import { DRINK_OPTIONS_RESPONSE } from '../../epic1/frontend/fixtures/drinkReferenceFixture'

beforeEach(() => {
  // Page tests receive the same public reference contract by default. Tests of
  // loading and failure states replace this mock explicitly.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(DRINK_OPTIONS_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
})

afterEach(async () => {
  cleanup()
  await closeSipAwareDatabase()
  await deleteDB(SIPAWARE_DATABASE_NAME)
  vi.unstubAllGlobals()
})
