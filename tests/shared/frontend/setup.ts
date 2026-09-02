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
import { ALCOHOL_GUIDELINES_RESPONSE } from '../../epic2/frontend/fixtures/alcoholGuidelineFixture'

function publicReferenceResponse(input: RequestInfo | URL): Response {
  const url = input instanceof Request ? input.url : String(input)
  let payload: unknown

  if (url.endsWith('/api/reference/drink-options')) {
    payload = DRINK_OPTIONS_RESPONSE
  } else if (url.endsWith('/api/reference/alcohol-guidelines')) {
    payload = ALCOHOL_GUIDELINES_RESPONSE
  } else {
    return new Response(null, { status: 404 })
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  // Page tests receive the same public reference contract by default. Tests of
  // loading and failure states replace this mock explicitly.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => publicReferenceResponse(input)),
  )
})

afterEach(async () => {
  cleanup()
  await closeSipAwareDatabase()
  await deleteDB(SIPAWARE_DATABASE_NAME)
  vi.unstubAllGlobals()
})
