/**
 * Provider-neutral API URL construction shared by frontend clients.
 *
 * This module owns only origin selection. Individual clients own endpoint
 * paths and request semantics, and no server secret is read or exposed here.
 */

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function buildApiUrl(path: `/${string}`): string {
  // An empty base keeps Vercel production calls on same-origin `/api/...`,
  // while local development may opt into a standalone FastAPI origin.
  return `${apiBaseUrl}${path}`
}
