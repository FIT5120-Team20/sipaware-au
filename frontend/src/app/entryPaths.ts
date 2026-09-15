/**
 * Support retained /iteration1 bookmarks without changing data or the root mount.
 * Only application navigation is prefixed; API/source URLs and browser storage
 * retain their existing contracts. A frozen hostname is a separate deployment.
 */
export const RECORD_HOME_EVENT = 'sipaware:record-home'
const ENTRY_PATH = '/iteration1'
const APP_ROUTES = new Set(['/', '/record', '/trends', '/alcohol-guidelines'])

function hasEntryPath(pathname: string): boolean {
  return pathname === ENTRY_PATH || pathname.startsWith(ENTRY_PATH + '/')
}

export function applicationPath(pathname = window.location.pathname): string {
  if (!hasEntryPath(pathname)) return pathname
  return pathname.slice(ENTRY_PATH.length) || '/'
}

export function applicationHref(path: string): string {
  const route = path.split(/[?#]/, 1)[0]
  if (!hasEntryPath(window.location.pathname) || !APP_ROUTES.has(route)) return path
  return ENTRY_PATH + (route === '/' ? path.slice(1) : path)
}

/**
 * The teacher site serves this retained release at the root. Canonicalize only
 * known legacy /iteration1 bookmarks on the official hosts, keeping their query
 * and topic hash. Local/frozen hosts and other iteration paths stay independent.
 */
export function officialEntryRedirect(
  location: Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'> = window.location,
): string | null {
  if (!['sipaware.app', 'sipaware-au.vercel.app'].includes(location.hostname)
      || !hasEntryPath(location.pathname)) return null
  const path = applicationPath(location.pathname)
  if (!APP_ROUTES.has(path)) return null
  return path + location.search + location.hash
}
