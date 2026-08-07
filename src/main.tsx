import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { APP_VERSION } from './version'
import { autoReloadOnce } from './lib/update'
import { useUpdateStore } from './stores/useUpdateStore'
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
  if ('serviceWorker' in navigator) {
    // When a fresh service worker takes control, reload immediately so the
    // page always switches to the newest precached assets.
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`, { updateViaCache: 'none' })
      .catch(() => {})
  }

  const check = async () => {
    const result = await useUpdateStore.getState().checkNow()
    if (result === 'outdated') {
      // First detection per session updates automatically; afterwards the
      // home banner stays visible so the update is never silent.
      autoReloadOnce()
      return
    }
    // Clean up the cache-busting query after a successful fresh load.
    if (result === 'current' && window.location.search.startsWith('?v=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
  }
  void check()
  window.setInterval(() => void check(), 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
  window.addEventListener('pageshow', () => void check())
}

// Static hosts (GitHub Pages / Gitee Pages) cannot rewrite arbitrary paths to
// index.html, so use hash routing there to avoid 404s on deep links.
// Netlify keeps clean URLs.
const isStaticPagesHost =
  typeof window !== 'undefined' &&
  (window.location.hostname.toLowerCase().includes('github.io') ||
    window.location.hostname.toLowerCase().includes('gitee.io') ||
    window.location.hostname.toLowerCase().includes('jsdelivr') ||
    window.location.hostname.toLowerCase().includes('pages.dev'))
const Router = __SINGLE_FILE__ || isStaticPagesHost ? HashRouter : BrowserRouter

if (!__SINGLE_FILE__ && isStaticPagesHost && typeof window !== 'undefined' && !window.location.hash) {
  // When the service worker serves index.html for a deep link, convert the
  // pathname into a hash route so the page matches the requested view.
  const path = window.location.pathname.replace(/\/$/, '')
  const route = path.replace(/^\/Discipline/, '')
  if (route && route !== '') {
    window.location.replace('/Discipline/#' + route)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
)
