import { describe, expect, it, vi } from 'vitest'

import { DRINK_OPTIONS_RESPONSE } from '../test/drinkReferenceFixture'
import { getDrinkOptions } from './drinkReferenceApi'

describe('drink reference API client', () => {
  it('returns the typed public response through a bodyless same-origin GET', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, options?: RequestInit) => {
        void input
        void options
        return new Response(JSON.stringify(DRINK_OPTIONS_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getDrinkOptions()).resolves.toEqual(DRINK_OPTIONS_RESPONSE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reference/drink-options',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      }),
    )

    const requestOptions = fetchMock.mock.calls[0][1]
    expect(requestOptions).not.toHaveProperty('body')
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('drinkName')
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('consumedAt')
  })

  it('rejects malformed public data instead of silently corrupting options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ categories: [{ id: 'invalid' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(getDrinkOptions()).rejects.toThrow(
      'Drink reference response did not match the API contract',
    )
  })
})
