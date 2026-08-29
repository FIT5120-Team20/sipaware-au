/** Provider-neutral API URL construction shared by frontend clients. */

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export function buildApiUrl(path: `/${string}`): string {
  /** An empty base keeps production-compatible same-origin `/api/...` URLs. */
  return `${apiBaseUrl}${path}`
}
