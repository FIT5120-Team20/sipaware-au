import { ManualDrinkPage } from './features/drinks/pages/ManualDrinkPage'

// The root currently delegates all US1.1-US1.4 workflow orchestration to one
// feature page, keeping application bootstrap separate from domain behaviour.
function App() {
  return <ManualDrinkPage />
}

export default App
