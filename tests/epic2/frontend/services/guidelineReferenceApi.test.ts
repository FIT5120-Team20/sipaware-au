/** Protects the bodyless public guideline API contract and runtime validation. */

import { describe, expect, it, vi } from 'vitest'

import { getAlcoholGuidelines } from '../../../../frontend/src/services/guidelineReferenceApi'
import { ALCOHOL_GUIDELINES_RESPONSE } from '../fixtures/alcoholGuidelineFixture'

describe('guideline reference API client', () => {
  it('returns DAILY and WEEKLY through a bodyless credential-omitting GET', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, options?: RequestInit) => {
        void input
        void options
        return new Response(JSON.stringify(ALCOHOL_GUIDELINES_RESPONSE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getAlcoholGuidelines()).resolves.toEqual(
      ALCOHOL_GUIDELINES_RESPONSE,
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reference/alcohol-guidelines',
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      }),
    )
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body')
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('drinkName')
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('consumedAt')
  })

  it.each([
    { guidelines: [] },
    { guidelines: [ALCOHOL_GUIDELINES_RESPONSE.guidelines[0]] },
    {
      guidelines: [
        ALCOHOL_GUIDELINES_RESPONSE.guidelines[0],
        ALCOHOL_GUIDELINES_RESPONSE.guidelines[0],
      ],
    },
    {
      guidelines: [
        { ...ALCOHOL_GUIDELINES_RESPONSE.guidelines[0], thresholdStandardDrinks: 0 },
        ALCOHOL_GUIDELINES_RESPONSE.guidelines[1],
      ],
    },
  ])('rejects malformed or incomplete guideline data', async (payload) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(getAlcoholGuidelines()).rejects.toThrow(
      'Alcohol guideline response did not match the API contract',
    )
  })

  it('rejects an unavailable response without using fallback thresholds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    )

    await expect(getAlcoholGuidelines()).rejects.toThrow(
      'Alcohol guideline request failed with status 503',
    )
  })
})
