import { describe, expect, it, vi } from 'vitest'

import { getAlcoholInformation } from '../../../../frontend/src/services/alcoholInformationApi'
import { ALCOHOL_INFORMATION_RESPONSE } from '../fixtures/alcoholInformationFixture'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function cloneFixture() {
  return structuredClone(ALCOHOL_INFORMATION_RESPONSE)
}

describe('getAlcoholInformation', () => {
  it('sends a bodyless same-origin GET and accepts six topics with many sources', async () => {
    const signal = new AbortController().signal
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse(ALCOHOL_INFORMATION_RESPONSE))

    const result = await getAlcoholInformation(signal)

    expect(result).toEqual(ALCOHOL_INFORMATION_RESPONSE)
    expect(result.topics).toHaveLength(6)
    expect(result.topics[0].content[0].sources).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reference/alcohol-information',
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal,
      },
    )
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body')
  })

  it.each([
    [
      'unknown topic',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[0].topicCode = 'UNKNOWN' as never
      },
    ],
    [
      'unknown content type',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[0].content[0].contentType = 'UNKNOWN' as never
      },
    ],
    [
      'unknown source role',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[0].content[0].sources[0].role = 'SECONDARY' as never
      },
    ],
    [
      'invalid date',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[0].content[0].lastVerified = '2026-02-30'
      },
    ],
    [
      'non-HTTP source URL',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[0].content[0].sources[0].url =
          'ftp://example.invalid/source'
      },
    ],
    [
      'blank required text',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[0].displayName = '   '
      },
    ],
  ])('rejects a payload with %s', async (_name, mutate) => {
    const payload = cloneFixture()
    mutate(payload)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload))

    await expect(getAlcoholInformation()).rejects.toThrow(
      /did not match the API contract/i,
    )
  })

  it.each([
    [
      'topic code',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[1].topicCode = payload.topics[0].topicCode
      },
    ],
    [
      'content ID',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[1].content[0].id = payload.topics[0].content[0].id
      },
    ],
    [
      'source ID within one content item',
      (payload: ReturnType<typeof cloneFixture>) => {
        payload.topics[0].content[0].sources[1].id =
          payload.topics[0].content[0].sources[0].id
      },
    ],
  ])('rejects duplicate %s identity', async (_name, mutate) => {
    const payload = cloneFixture()
    mutate(payload)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload))

    await expect(getAlcoholInformation()).rejects.toThrow(
      /did not match the API contract/i,
    )
  })

  it.each([
    null,
    {},
    { topics: [] },
    { topics: [{ topicCode: 'STANDARD_DRINK' }] },
  ])('rejects malformed response %#', async (payload) => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload))

    await expect(getAlcoholInformation()).rejects.toThrow(
      /did not match the API contract/i,
    )
  })

  it('surfaces a non-success HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 503))

    await expect(getAlcoholInformation()).rejects.toThrow(/status 503/i)
  })
})
