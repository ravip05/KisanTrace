import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './styles/index.css'

// --- PWA Service Worker Registration ---
// We use the 'prompt' strategy so we can show our own update UI
// (Edge Case 6.7: Service Worker Update Conflicts).
const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch a custom event so the React App component can show the
    // "A critical update is ready. Tap to restart." modal.
    window.dispatchEvent(new CustomEvent('sw:updateReady', {
      detail: { updateSW }
    }))
  },
  onOfflineReady() {
    // The app is now fully cached and ready to run offline.
    // Dispatch an event so we can show a one-time "Ready offline" toast.
    window.dispatchEvent(new CustomEvent('sw:offlineReady'))
    console.log('[Kisan-Trace] App is ready for offline use.')
  },
  onRegistered(r: ServiceWorkerRegistration | undefined) {
    console.log('[Kisan-Trace] Service Worker registered:', r)
  },
  onRegisterError(error: Error) {
    console.error('[Kisan-Trace] Service Worker registration failed:', error)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
