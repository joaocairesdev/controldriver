import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { aplicarPreferenciasGlobais } from './shared/utils/preferencias'

aplicarPreferenciasGlobais()

function sincronizarViewportVisual() {
  const viewport = window.visualViewport
  const raiz = document.documentElement
  raiz.style.setProperty('--cd-visual-viewport-height', `${viewport?.height || window.innerHeight}px`)
  raiz.style.setProperty('--cd-visual-viewport-top', `${viewport?.offsetTop || 0}px`)
}

sincronizarViewportVisual()
window.visualViewport?.addEventListener('resize', sincronizarViewportVisual)
window.visualViewport?.addEventListener('scroll', sincronizarViewportVisual)
window.addEventListener('resize', sincronizarViewportVisual)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
