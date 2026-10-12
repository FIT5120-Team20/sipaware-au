import { useEffect, useRef, useState, type RefObject } from 'react'
import { applicationHref, applicationPath } from '../../app/entryPaths'
import { captureNavigationScroll, prepareNavigationScroll, requestNavigationScroll, type NavigationScrollPosition } from '../../app/navigationScroll'
import { AWARD_CATEGORIES, type AwardCategory, type AwardId } from './awardDefinitions'

export type AwardsCollectionView = AwardCategory | 'keep-going' | null
interface AwardsView { collection: AwardsCollectionView; awardId: string | null }
interface AwardsEntry { key: string; parentHref?: string }
interface AwardsSnapshot { position: NavigationScrollPosition; focusedHref?: string }
let entrySequence = 0
function newKey() { return `awards-${Date.now()}-${++entrySequence}` }
function currentHref() { return window.location.pathname + window.location.search + window.location.hash }
function readEntry(): AwardsEntry | undefined {
  const entry = window.history.state?.sipawareAwards
  return entry && typeof entry.key === 'string' ? entry : undefined
}
function readView(): AwardsView {
  let parts: string[]
  try { parts = decodeURIComponent(window.location.hash.slice(1)).split('/') } catch { parts = [] }
  const category = parts[0] === 'category' ? AWARD_CATEGORIES.find(item => item.id === parts[1])?.id ?? null : null
  if (parts[0] === 'keep-going') return { collection: 'keep-going', awardId: parts[1] || null }
  return { collection: category, awardId: category ? parts[2] || null : parts[0] === 'award' ? parts[1] || null : null }
}
export function awardsViewHref(collection: AwardsCollectionView, awardId?: AwardId): string {
  const hash = collection ? `${collection === 'keep-going' ? '#keep-going' : '#category/' + collection}${awardId ? '/' + encodeURIComponent(awardId) : ''}`
    : awardId ? '#award/' + encodeURIComponent(awardId) : ''
  return applicationHref('/awards' + hash)
}

/** App-level celebrations use the same detail URLs and committed navigation policy. */
export function openAwardDetail(category: AwardCategory, awardId: AwardId): void {
  prepareNavigationScroll()
  const nextHref = awardsViewHref(category, awardId)
  if (nextHref !== currentHref()) {
    const entry = { key: newKey(), parentHref: currentHref() }
    window.history.pushState({ sipawareAwards: entry }, '', nextHref)
    // Synchronise both the app route and a possibly mounted Awards collection.
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  requestNavigationScroll({ kind: 'top' })
}

/** Hash destinations keep Awards active in the existing app router. */
export function useAwardsNavigation(root: RefObject<HTMLElement | null>) {
  const [view, setView] = useState<AwardsView>(readView)
  const href = useRef(currentHref())
  const activeEntry = useRef(readEntry())
  // DOM references stay in memory, never in structured-cloned browser history.
  const snapshots = useRef(new Map<string, AwardsSnapshot>())
  const focusReturn = useRef<string | undefined>(undefined)
  const returning = useRef(false)

  useEffect(() => {
    const sync = () => {
      if (href.current === currentHref()) return
      // The outgoing view is still mounted when browser Back/Forward fires.
      if (activeEntry.current) rememberSnapshot(activeEntry.current)
      if (applicationPath() !== '/awards') return
      href.current = currentHref()
      returning.current = false
      setView(readView())
      const entry = readEntry()
      activeEntry.current = entry
      const snapshot = entry && snapshots.current.get(entry.key)
      focusReturn.current = snapshot?.focusedHref
      requestNavigationScroll(snapshot ? { kind: 'restore', position: snapshot.position } : { kind: 'preserve' })
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  useEffect(() => {
    if (!focusReturn.current || view.awardId) return
    const link = Array.from(root.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])
      .find(element => element.getAttribute('href') === focusReturn.current)
    link?.focus({ preventScroll: true })
    focusReturn.current = undefined
  }, [root, view])

  function rememberSnapshot(entry: AwardsEntry) {
    const focused = document.activeElement
    snapshots.current.set(entry.key, {
      position: captureNavigationScroll(root.current),
      focusedHref: focused instanceof HTMLAnchorElement ? focused.getAttribute('href') ?? undefined : undefined,
    })
  }

  function rememberPosition() {
    const entry = readEntry() ?? { key: newKey() }
    rememberSnapshot(entry)
    activeEntry.current = entry
    window.history.replaceState({ ...window.history.state, sipawareAwards: entry }, '')
  }

  function open(collection: AwardsCollectionView, awardId?: AwardId) {
    const nextHref = awardsViewHref(collection, awardId)
    if (nextHref === currentHref()) return
    rememberPosition()
    prepareNavigationScroll()
    const entry = { key: newKey(), parentHref: currentHref() }
    window.history.pushState({ sipawareAwards: entry }, '', nextHref)
    activeEntry.current = entry
    href.current = currentHref()
    setView(readView())
    requestNavigationScroll({ kind: 'top' })
  }

  function back(collection: AwardsCollectionView) {
    if (returning.current) return
    const nextHref = awardsViewHref(collection)
    const entry = readEntry()
    rememberPosition()
    prepareNavigationScroll()
    if (entry?.parentHref === nextHref) {
      returning.current = true
      window.history.back()
    } else {
      // A direct link has no in-app parent to return to.
      const fallbackEntry = { key: newKey() }
      window.history.replaceState({ ...window.history.state, sipawareAwards: fallbackEntry }, '', nextHref)
      activeEntry.current = fallbackEntry
      href.current = currentHref()
      setView(readView())
      requestNavigationScroll({ kind: 'top' })
    }
  }

  return { view, open, back }
}
