/**
 * Navigate within the active development iteration. Vercel sends stable root
 * traffic to a pinned earlier deployment, including its own assets and API.
 * Bare routes still support isolated component tests and a standalone preview;
 * completed iterations must never become aliases of this moving application.
 */
export const RECORD_HOME_EVENT = 'sipaware:record-home'
const ENTRY_PATH = '/iteration2'
const LIVE_MOUNTS = [ENTRY_PATH]
const APP_ROUTES = new Set(['/', '/record', '/trends', '/alcohol-guidelines'])

function entryMount(pathname: string): string | undefined {
  return LIVE_MOUNTS.find(mount => pathname === mount || pathname.startsWith(mount + '/'))
}

export function applicationPath(pathname = window.location.pathname): string {
  const mount = entryMount(pathname)
  return mount ? pathname.slice(mount.length) || '/' : pathname
}

export function applicationHref(path: string): string {
  const mount = entryMount(window.location.pathname)
  const route = path.split(/[?#]/, 1)[0]
  if (!mount || !APP_ROUTES.has(route)) return path
  return mount + (route === '/' ? path.slice(1) : path)
}
