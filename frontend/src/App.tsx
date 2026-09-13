/**
 * Reference-derived Home/Learn/Record shell, with real native destinations.
 * Navigation updates the browser URL without reloading the React application.
 */
import { useEffect, useState } from 'react'

import { applicationPath, applicationHref } from './app/entryPaths'
import { ManualDrinkPage } from './features/drinks/pages/ManualDrinkPage'
import { AlcoholInformationPage } from './features/drinks/pages/AlcoholInformationPage'
import { ReferenceNavigation } from './components/ReferenceNavigation'
import { HomePage } from './pages/HomePage'

function App() {
  const [path, setPath] = useState(() => applicationPath())

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

  setPath(nextPath)

  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'auto',
  })
}

  return (
    <div className="reference-app">
      <ReferenceNavigation path={path} onNavigate={navigate} />

      <div className="reference-content">
        {path === '/' ? (
          <HomePage key="home" />
        ) : path === '/record' ? (
          <ManualDrinkPage key="record" />
        ) : path === '/trends' ? (
          <ManualDrinkPage key="trends" initialView="history" />
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

export default App
