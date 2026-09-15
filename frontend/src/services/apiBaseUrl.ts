/**
 * Choose the public API namespace for this build, without reading server secrets.
 * Production requests stay under the build's iteration prefix so stable pages
 * cannot accidentally call the moving backend. Only local development can opt
 * into a separate FastAPI origin; each client retains its existing /api contract.
 */
const localApiOrigin = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  : ''
const apiBaseUrl = localApiOrigin || import.meta.env.BASE_URL.replace(/\/$/, '')

export function buildApiUrl(path: `/${string}`): string {
  return `${apiBaseUrl}${path}`
}
