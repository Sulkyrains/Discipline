import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { APP_VERSION } from './version'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/pages.css'

const VERSION_KEY = 'discipline-app-version'

if (!__SINGLE_FILE__) {
  try {
    const seen = localStorage.getItem(VERSION_KEY)
    if (seen !== APP_VERSION) {
      localStorage.setItem(VERSION_KEY, APP_VERSION)
      if ('caches' in window) {
        void window.caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => window.caches.delete(k))))
          .then(() => window.location.reload())
          .catch(() => {})
      }
    }
  } catch {
    // storage unavailable (private mode etc.); skip cache-busting
  }
  registerSW({ immediate: true })
}

const Router = __SINGLE_FILE__ ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
)
