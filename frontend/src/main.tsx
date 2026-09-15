/**
 * React entry point for the reference-derived shell and retained drink features.
 *
 * Persistence is deliberately owned by the drinks feature below this boundary;
 * the application bootstrap does not read or write personal drinking data.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './app/styles.css'
import './app/reference-ui.css'

// Deployment routing selects this build; stable root traffic uses its pinned build.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
