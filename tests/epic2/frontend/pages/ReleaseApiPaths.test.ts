/** Production and local API origins must not mix stable and moving releases. */
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('release API namespace', () => {
  it('uses its build prefix in production, ignoring a development origin', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('BASE_URL', '/iteration3/')
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    const { buildApiUrl } = await import('../../../../frontend/src/services/apiBaseUrl')
    expect(buildApiUrl('/api/drinks/catalog?q=brasserie&offset=24')).toBe('/iteration3/api/drinks/catalog?q=brasserie&offset=24')
  })

  it('allows an explicit standalone API origin only in development', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('BASE_URL', '/iteration3/')
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000/')
    const { buildApiUrl } = await import('../../../../frontend/src/services/apiBaseUrl')
    expect(buildApiUrl('/api/health')).toBe('http://localhost:8000/api/health')
  })

  it('uses same-origin iteration API for development without an override', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('BASE_URL', '/iteration3/')
    vi.stubEnv('VITE_API_BASE_URL', '')
    const { buildApiUrl } = await import('../../../../frontend/src/services/apiBaseUrl')
    expect(buildApiUrl('/api/health')).toBe('/iteration3/api/health')
  })
})
