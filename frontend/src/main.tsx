/**
 * React entry point for the current Epic 1 experience.
 *
 * Persistence is deliberately owned by the drinks feature below this boundary;
 * the application bootstrap does not read or write personal drinking data.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './app/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
