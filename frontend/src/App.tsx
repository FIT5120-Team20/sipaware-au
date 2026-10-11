/**
 * Reference-derived Home/Learn/Record shell, with real native destinations.
 * Navigation updates the browser URL without reloading the React application.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'

import { applicationPath, applicationHref, RECORD_HOME_EVENT } from './app/entryPaths'
import { captureScrollDiagnostics, prepareNavigationScroll, requestNavigationScroll, scrollDiagnosticsEnabled, useNavigationScrollManager, useScrollDiagnosticEvents } from './app/navigationScroll'
import { ReferenceDialog } from './features/drinks/components/ReferenceDialog'
import { ManualDrinkPage } from './features/drinks/pages/ManualDrinkPage'
import { AlcoholInformationPage } from './features/drinks/pages/AlcoholInformationPage'
import { ReferenceNavigation } from './components/ReferenceNavigation'
import { AwardFeedback } from './features/awards/AwardNotice'
import { AwardsPage } from './features/awards/AwardsPage'
import { HomePage } from './pages/HomePage'

function App() {
  const [path, setPath] = useState(() => applicationPath())
  const contentRef = useRef<HTMLDivElement>(null)
  useNavigationScrollManager(contentRef)

  useEffect(() => {
    function handlePopState() {
      setPath(applicationPath())
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  function navigate(nextPath: string) {
    prepareNavigationScroll()
    const nextHref = applicationHref(nextPath)
    const currentHref =
      window.location.pathname +
      window.location.search +
      window.location.hash
    const previousHash = window.location.hash

    if (currentHref !== nextHref) {
      window.history.pushState(null, '', nextHref)
    }

    if (previousHash !== window.location.hash) {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }

    if (nextPath === '/record') {
      window.dispatchEvent(new Event(RECORD_HOME_EVENT))
    }

    setPath(nextPath)
    requestNavigationScroll({ kind: 'top' })
  }

  return (
    <div className="reference-app">
      <ReferenceNavigation path={path} onNavigate={navigate} />
      <AwardFeedback />
      <NavigationScrollDiagnostics contentRef={contentRef} />

      <div className="reference-content" ref={contentRef}>
        <div className="navigation-scroll-start" data-navigation-scroll-start aria-hidden="true" />
        {path === '/' ? (
          <HomePage key="home" />
        ) : path === '/record' ? (
          <ManualDrinkPage key="record" />
        ) : path === '/trends' ? (
          <ManualDrinkPage key="trends" initialView="history" />
        ) : path === '/awards' ? (
          <AwardsPage key="awards" />
        ) : path === '/alcohol-guidelines' ? (
          <AlcoholInformationPage key="learn" />
        ) : (
          <main className="reference-home">
            <h1>Page not found</h1>
            <p>The requested page is not available.</p>

            <a
              href={applicationHref('/')}
              onClick={(event) => {
                event.preventDefault()
                navigate('/')
              }}
            >
              Home
            </a>

            {' · '}

            <a
              href={applicationHref('/record')}
              onClick={(event) => {
                event.preventDefault()
                navigate('/record')
              }}
            >
              Record a drink
            </a>
          </main>
        )}
      </div>
    </div>
  )
}

// This temporary sheet exists only in a local development session opened with
// ?scrollDebug=1. Capture happens before the dialog can change focus or viewport.
function NavigationScrollDiagnostics({ contentRef }: { contentRef: RefObject<HTMLElement | null> }) {
  const [capture, setCapture] = useState<ReturnType<typeof captureScrollDiagnostics> | null>(null)
  const [copied, setCopied] = useState(false)
  const beforeOpen = useRef<ReturnType<typeof captureScrollDiagnostics> | null>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)
  const [capturedText, setCapturedText] = useState('')
  useScrollDiagnosticEvents()

  if (!scrollDiagnosticsEnabled) return null

  function openCapture() {
    const snapshot = beforeOpen.current ?? captureScrollDiagnostics(contentRef.current)
    beforeOpen.current = null
    setCapturedText(JSON.stringify(snapshot, null, 2))
    setCopied(false)
    setCapture(snapshot)
  }

  async function copyCapture() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable on HTTP')
      await navigator.clipboard.writeText(capturedText)
      setCopied(true)
    } catch {
      // Safari on local HTTP may lack Clipboard API; expose native text selection.
      textArea.current?.focus({ preventScroll: true })
      textArea.current?.select()
    }
  }

  const snapshot = capture?.capture
  return <>
    <button type="button" className="secondary-button" aria-label="Capture scroll diagnostics"
      style={{ position: 'fixed', right: 12, bottom: 'calc(96px + env(safe-area-inset-bottom))',
        zIndex: 35, minHeight: 44, padding: '6px 12px', background: '#fff', fontSize: 14 }}
      onPointerDown={() => { beforeOpen.current = captureScrollDiagnostics(contentRef.current) }}
      onClick={openCapture}>Scroll info</button>
    {snapshot && <ReferenceDialog title="Scroll diagnostics" onClose={() => setCapture(null)}>
      <p>Captured before opening this sheet. No records or input values are included.</p>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 14 }}>
        <dt>Window scroll Y</dt><dd style={{ margin: 0 }}>{snapshot.scrollY}</dd>
        <dt>Document scroll top</dt><dd style={{ margin: 0 }}>{snapshot.documentScrollTop}</dd>
        <dt>Visible viewport offset</dt><dd style={{ margin: 0 }}>{snapshot.viewport?.offsetTop ?? 'N/A'}</dd>
        <dt>Heading top</dt><dd style={{ margin: 0 }}>{snapshot.heading?.top ?? 'N/A'}</dd>
        <dt>Back bar bottom</dt><dd style={{ margin: 0 }}>{snapshot.backBar?.bottom ?? 'N/A'}</dd>
        <dt>Window / visible height</dt><dd style={{ margin: 0 }}>{snapshot.innerHeight} / {snapshot.viewport?.height ?? 'N/A'}</dd>
      </dl>
      <textarea ref={textArea} readOnly rows={5} value={capturedText} aria-label="Diagnostic data to copy"
        style={{ width: '100%', fontSize: 12, fontFamily: 'monospace' }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button type="button" className="primary-button" style={{ flex: 1 }} onClick={() => { void copyCapture() }}>
          {copied ? 'Copied' : 'Copy diagnostics'}
        </button>
        <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setCapture(null)}>Close</button>
      </div>
    </ReferenceDialog>}
  </>
}

export default App
