import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LaunchBoundary from './components/LaunchBoundary.jsx'
import { startSessionRefresh } from './utils/sessionRefresh.js'

startSessionRefresh()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LaunchBoundary><App /></LaunchBoundary>
  </StrictMode>,
)
