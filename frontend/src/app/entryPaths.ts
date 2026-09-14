/**
 * Mount the approved live application at /iteration1 without renaming its data.
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
 * Keep existing bookmarks working on the two official live hostnames. Local and
 * isolated preview hosts retain root routes; unknown/future iteration paths are
 * not silently redirected to this release. No personal data is moved or read.
 */
export function officialEntryRedirect(
  location: Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'> = window.location,
): string | null {
  if (!['sipaware.app', 'sipaware-au.vercel.app'].includes(location.hostname)
      || !APP_ROUTES.has(location.pathname)) return null
  return ENTRY_PATH + (location.pathname === '/' ? '' : location.pathname)
    + location.search + location.hash
}
