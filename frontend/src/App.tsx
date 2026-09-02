import { ManualDrinkPage } from './features/drinks/pages/ManualDrinkPage'
import { AlcoholInformationPage } from './features/drinks/pages/AlcoholInformationPage'

// Two exact native paths preserve ordinary anchor, history, and deployment SPA
// fallback behaviour without adding a routing abstraction to this small app.
function App() {
  if (window.location.pathname === '/') {
    return <ManualDrinkPage />
  }

  if (window.location.pathname === '/alcohol-guidelines') {
    return <AlcoholInformationPage />
  }

  return (
    <main className='manual-drink-page'>
      <div className='manual-drink-shell'>
        <header className='feature-header'>
          <p className='brand-name'>SipAware AU</p>
          <h1>Page not found</h1>
          <p>The requested page is not available.</p>
        </header>
        <a href='/'>Record a drink</a>
      </div>
    </main>
  )
}

export default App
