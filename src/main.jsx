import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { aplicarPreferenciasGlobais } from './shared/utils/preferencias'

aplicarPreferenciasGlobais()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
