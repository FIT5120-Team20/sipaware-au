import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

type ContainerScroll = { element: HTMLElement; top: number; left: number }

export type NavigationScrollPosition = {
  page: { top: number; left: number }
  containers: ContainerScroll[]
}

type ScrollIntent = { kind: 'top' } | { kind: 'restore'; position: NavigationScrollPosition } | { kind: 'preserve' }
type ScrollRequest = ScrollIntent & { id: number }
const scrollRequestEvent = 'sipaware:navigation-scroll'
let nextRequestId = 0
let cancelActiveNavigation: (() => void) | undefined

// Temporary, opt-in local diagnostics. No input values, query strings, record
// data or storage are inspected, and no samples are transmitted to a server.
export const scrollDiagnosticsEnabled = import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('scrollDebug') === '1'
const diagnosticSamples: ScrollDiagnosticSample[] = []
const navigationSamples: ScrollDiagnosticSample[] = []

function diagnosticRound(value: number) { return Math.round(value * 10) / 10 }

function diagnosticRect(element: Element | null) {
  if (!element) return null
  const bounds = element.getBoundingClientRect()
  return { top: diagnosticRound(bounds.top), bottom: diagnosticRound(bounds.bottom), height: diagnosticRound(bounds.height) }
}

function readScrollDiagnostic(event: string, root = document.querySelector<HTMLElement>('.reference-content')) {
  const viewport = window.visualViewport
  const page = document.scrollingElement
  const heading = Array.from(root?.querySelectorAll<HTMLElement>('h1, h2') ?? [])
    .find(element => element.getClientRects().length > 0)
  const back = Array.from(root?.querySelectorAll<HTMLElement>('.prototype-sticky-back') ?? [])
    .find(element => element.getClientRects().length > 0)
  const containers = []
  for (let element = root; element; element = element.parentElement) {
    const overflowY = window.getComputedStyle(element).overflowY
    if (/(auto|scroll|overlay)/.test(overflowY)) {
      containers.push({ tag: element.tagName, className: element.className,
        overflowY, scrollTop: diagnosticRound(element.scrollTop),
        height: element.clientHeight, scrollHeight: element.scrollHeight })
    }
  }
  return {
    event, ms: diagnosticRound(performance.now()), path: window.location.pathname,
    scrollY: diagnosticRound(window.scrollY), documentScrollTop: page ? diagnosticRound(page.scrollTop) : null,
    scrollingElement: page?.tagName ?? null,
    innerHeight: window.innerHeight, clientHeight: document.documentElement.clientHeight,
    viewport: viewport ? { offsetTop: diagnosticRound(viewport.offsetTop), pageTop: diagnosticRound(viewport.pageTop),
      height: diagnosticRound(viewport.height), scale: diagnosticRound(viewport.scale) } : null,
    document: diagnosticRect(document.documentElement), body: diagnosticRect(document.body),
    anchor: diagnosticRect(root?.querySelector('[data-navigation-scroll-start]') ?? null),
    heading: diagnosticRect(heading ?? null), backBar: diagnosticRect(back ?? null),
    backPosition: back ? window.getComputedStyle(back).position : null,
    ready: !root?.querySelector('[data-navigation-scroll-ready="false"]'),
    activeElement: document.activeElement?.tagName ?? null,
    containers,
  }
}

type ScrollDiagnosticSample = ReturnType<typeof readScrollDiagnostic>

function recordScrollDiagnostic(event: string) {
  if (!scrollDiagnosticsEnabled) return
  const sample = readScrollDiagnostic(event)
  diagnosticSamples.push(sample)
  if (diagnosticSamples.length > 48) diagnosticSamples.shift()
  if (event.startsWith('intent:') || event.startsWith('manager:')) {
    navigationSamples.push(sample)
    if (navigationSamples.length > 12) navigationSamples.shift()
  }
}

export function captureScrollDiagnostics(root: HTMLElement | null) {
  return { userAgent: navigator.userAgent, capture: readScrollDiagnostic('capture', root),
    navigation: [...navigationSamples], events: [...diagnosticSamples] }
}

export function useScrollDiagnosticEvents() {
  useEffect(() => {
    if (!scrollDiagnosticsEnabled) return
    const viewport = window.visualViewport
    let frame = 0
    const pending = new Set<string>()
    const observe = (source: string) => (event: Event) => {
      pending.add(source + ':' + event.type)
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        recordScrollDiagnostic([...pending].join(','))
        pending.clear()
      })
    }
    const observeWindow = observe('window')
    const observeViewport = observe('viewport')
    const observeNavigation = (event: Event) => {
      const detail = (event as CustomEvent<ScrollRequest>).detail
      recordScrollDiagnostic('intent:' + detail.kind)
    }
    const events = ['scroll', 'resize', 'popstate', 'hashchange'] as const
    for (const event of events) window.addEventListener(event, observeWindow)
    viewport?.addEventListener('scroll', observeViewport)
    viewport?.addEventListener('resize', observeViewport)
    window.addEventListener(scrollRequestEvent, observeNavigation)
    recordScrollDiagnostic('diagnostics:ready')
    return () => {
      window.cancelAnimationFrame(frame)
      for (const event of events) window.removeEventListener(event, observeWindow)
      viewport?.removeEventListener('scroll', observeViewport)
      viewport?.removeEventListener('resize', observeViewport)
      window.removeEventListener(scrollRequestEvent, observeNavigation)
    }
  }, [])
}

/** Publish navigation intent; only the app manager performs navigation scrolling. */
export function requestNavigationScroll(intent: ScrollIntent) {
  window.dispatchEvent(new CustomEvent<ScrollRequest>(scrollRequestEvent, {
    detail: { ...intent, id: ++nextRequestId },
  }))
}

/** Release the outgoing control before React hides or removes its screen. */
export function prepareNavigationScroll() {
  cancelActiveNavigation?.()
  const focused = document.activeElement
  if (focused instanceof HTMLElement) focused.blur()
}

function scrollContainers(screen: HTMLElement | null, nested?: HTMLElement | null) {
  const containers = new Set<HTMLElement>()
  for (let element = screen; element; element = element.parentElement) {
    if (element === document.scrollingElement || element === document.body || element === document.documentElement) continue
    if (/(auto|scroll|overlay)/.test(window.getComputedStyle(element).overflowY)) containers.add(element)
  }
  if (nested && /(auto|scroll|overlay)/.test(window.getComputedStyle(nested).overflowY)) containers.add(nested)
  return [...containers]
}

/** Capture before hiding a screen, including an independently scrolling catalogue. */
export function captureNavigationScroll(screen: HTMLElement | null, nested?: HTMLElement | null): NavigationScrollPosition {
  const page = document.scrollingElement
  return {
    page: {
      top: window.visualViewport?.pageTop ?? page?.scrollTop ?? window.scrollY,
      left: window.visualViewport?.pageLeft ?? page?.scrollLeft ?? window.scrollX,
    },
    containers: scrollContainers(screen, nested).map(element => ({ element, top: element.scrollTop, left: element.scrollLeft })),
  }
}

function restorePosition(position: NavigationScrollPosition) {
  for (const { element, top, left } of position.containers) {
    if (element.isConnected) element.scrollTo(left, top)
  }
  window.scrollTo(position.page.left, position.page.top)
}

function scrollPageToTop() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  // WebKit's LocalDOMWindow::scrollTo returns early for (0, 0) if its
  // internal position is already zero, before updating the native scroll view.
  // On iOS, request -1 once: native range clamping lands at the actual top
  // without a down/up nudge, a timer, or changing the browser toolbar settings.
  const options: ScrollToOptions = { top: isIOS ? -1 : 0, left: 0, behavior: 'instant' }
  if (isIOS) recordScrollDiagnostic('manager:ios-top-boundary')
  const page = document.scrollingElement
  if (page instanceof HTMLElement) {
    page.scrollTo(options)
  } else {
    window.scrollTo(options)
  }
}

/** One owner for forward, explicit return and intentional-scroll policies. */
export function useNavigationScrollManager(contentRef: RefObject<HTMLElement | null>) {
  const [request, setRequest] = useState<ScrollRequest | null>(null)

  useLayoutEffect(() => {
    const receive = (event: Event) => setRequest((event as CustomEvent<ScrollRequest>).detail)
    window.addEventListener(scrollRequestEvent, receive)
    return () => window.removeEventListener(scrollRequestEvent, receive)
  }, [])

  useLayoutEffect(() => {
    cancelActiveNavigation?.()
    if (!request || request.kind === 'preserve') return
    const content = contentRef.current
    if (!content) return
    const intent = request
    const root = content

    const viewport = window.visualViewport
    const previousAnchor = content.style.overflowAnchor
    content.style.overflowAnchor = 'none'
    let frame = 0
    let applied = false
    let cancelled = false
    const observer = new MutationObserver(afterCommit)
    const interactionEvents = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const

    function cancel(event?: Event) {
      if (cancelled) return
      recordScrollDiagnostic('manager:cancel:' + (event?.type ?? 'cleanup'))
      cancelled = true
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      for (const event of interactionEvents) document.removeEventListener(event, cancel, true)
      window.removeEventListener('popstate', cancel)
      window.removeEventListener('scroll', inspectViewport)
      viewport?.removeEventListener('resize', inspectViewport)
      viewport?.removeEventListener('scroll', inspectViewport)
      root.style.overflowAnchor = previousAnchor
      if (cancelActiveNavigation === cancel) cancelActiveNavigation = undefined
    }

    function apply() {
      recordScrollDiagnostic('manager:before:' + intent.kind)
      if (intent.kind === 'restore') {
        restorePosition(intent.position)
      } else {
        for (const element of scrollContainers(root)) {
          element.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        }
        // Forward navigation resets the scroll position, regardless of how much
        // of the destination heading is already visible.
        scrollPageToTop()
      }
      recordScrollDiagnostic('manager:after:' + intent.kind)
    }

    function isDisplaced() {
      if (intent.kind === 'restore') {
        const visibleTop = viewport?.pageTop ?? window.scrollY
        return Math.abs(visibleTop - intent.position.page.top) > 1
      }
      const page = document.scrollingElement
      const displaced = (value: number) => Math.abs(value) > 0.5
      return displaced(page?.scrollTop ?? window.scrollY) ||
        displaced(page?.scrollLeft ?? window.scrollX) ||
        displaced(viewport?.pageTop ?? 0) ||
        displaced(viewport?.pageLeft ?? 0) ||
        scrollContainers(root).some(element => displaced(element.scrollTop) || displaced(element.scrollLeft))
    }

    function inspectViewport() {
      if (!applied || cancelled) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (cancelled || !isDisplaced()) return
        recordScrollDiagnostic('manager:viewport-repair')
        // At most one repair for this navigation's delayed toolbar adjustment.
        // User input, Back and a new navigation cancel it before it can interfere.
        apply()
        cancel()
      })
    }

    function afterCommit() {
      if (cancelled || applied || root.querySelector('[data-navigation-scroll-ready="false"]')) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (cancelled || root.querySelector('[data-navigation-scroll-ready="false"]')) return
        apply()
        applied = true
        observer?.disconnect()
      })
    }

    cancelActiveNavigation = cancel
    for (const event of interactionEvents) document.addEventListener(event, cancel, { capture: true, passive: true })
    window.addEventListener('popstate', cancel)
    window.addEventListener('scroll', inspectViewport)
    viewport?.addEventListener('resize', inspectViewport)
    viewport?.addEventListener('scroll', inspectViewport)
    // Async Record hydration must commit its final view before scrolling.
    observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-navigation-scroll-ready'] })
    afterCommit()
    return cancel
  }, [request, contentRef])
}
