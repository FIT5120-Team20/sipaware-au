/**
 * Small client for process-health checks; it owns no reference or personal data.
 * The shared URL helper keeps local overrides and same-origin Vercel calls aligned.
 */
import type { HealthResponse } from '../types/health'
import { buildApiUrl } from './apiBaseUrl'

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(buildApiUrl('/api/health'), {
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`)
  }

  const health = (await response.json()) as HealthResponse

  if (health.status !== 'ok' || health.service !== 'sipaware-au-api') {
    throw new Error('Health response did not match the expected service contract')
  }

  return health
}
