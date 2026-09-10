/**
 * Reference-derived Home/Learn/Record shell, with real native destinations.
 * The current mount resolves to Home; /record retains all Iteration 1 capture
 * behavior. No prototype history, product catalogue or localStorage is imported.
 */
import { applicationPath, applicationHref } from './app/entryPaths'
import { ManualDrinkPage } from './features/drinks/pages/ManualDrinkPage'
import { AlcoholInformationPage } from './features/drinks/pages/AlcoholInformationPage'
import { ReferenceNavigation } from './components/ReferenceNavigation'
import { HomePage } from './pages/HomePage'

function App() {
  const path = applicationPath()
  return (
    <div className="reference-app">
      <ReferenceNavigation />
      <div className="reference-content">
        {path === '/' ? <HomePage />
          : path === '/record' ? <ManualDrinkPage />
          : path === '/trends' ? <ManualDrinkPage initialView="history" />
          : path === '/alcohol-guidelines' ? <AlcoholInformationPage />
          : <main className="reference-home"><h1>Page not found</h1>
              <p>The requested page is not available.</p>
              <a href={applicationHref('/')}>Home</a> · <a href={applicationHref('/record')}>Record a drink</a></main>}
      </div>
    </div>
  )
}
export default App
