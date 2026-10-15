import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { loadFavorites, saveFavorites, toggleFav } from '../lib/favorites'

const TABS = ['Markets', 'Swap', 'Bridge', 'Ask', 'Scan', 'Portfolio', 'History', 'News', 'Docs']

// URL routing: each tab lives at its own path (/market, /swap, /scan, …) so
// links are shareable and refresh/back keep the user where they were.
// '/token/0x…' resolves to the Token view with that address; '/' and anything
// unknown resolve to Markets.
const ADDR_RE = /^0x[a-fA-F0-9]{40}$/
const pathToRoute = (path) => {
  const seg = String(path || '').replace(/\/+$/, '').split('/').filter(Boolean)
  if ((seg[0] || '').toLowerCase() === 'token' && ADDR_RE.test(seg[1] || '')) {
    return { tab: 'Token', tokenAddress: seg[1] }
  }
  const tab = TABS.find((t) => t.toLowerCase() === (seg[0] || '').toLowerCase()) || 'Markets'
  return { tab, tokenAddress: null }
}
const tabToPath = (tab) => `/${tab.toLowerCase()}`

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [{ tab: activeTab, tokenAddress }, setRoute] = useState(() =>
    typeof window === 'undefined' ? { tab: 'Markets', tokenAddress: null } : pathToRoute(window.location.pathname)
  )
  const [swapPrefill, setSwapPrefill] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [favorites, setFavorites] = useState(loadFavorites)
  const notifId = useRef(0)

  useEffect(() => {
    const onPop = () => setRoute(pathToRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const setActiveTab = useCallback((tab) => {
    setRoute({ tab, tokenAddress: null })
    const path = tabToPath(tab)
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
  }, [])

  const openToken = useCallback((ca) => {
    if (!ADDR_RE.test(String(ca || ''))) return
    setRoute({ tab: 'Token', tokenAddress: ca })
    const path = `/token/${ca}`
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
  }, [])

  const toggleFavorite = useCallback((ca) => {
    setFavorites(prev => {
      const next = toggleFav(prev, ca)
      saveFavorites(next)
      return next
    })
  }, [])

  const isFavorite = useCallback((ca) => {
    const c = String(ca || '').toLowerCase()
    return c ? favorites.includes(c) : false
  }, [favorites])

  const notify = useCallback((title, message, type = 'info') => {
    const id = ++notifId.current
    const time = new Date().toLocaleTimeString()
    setNotifications(prev => [...prev, { id, title, message, type, time }])
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 7000)
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return (
    <AppContext.Provider value={{ activeTab, tokenAddress, setActiveTab, openToken, swapPrefill, setSwapPrefill, tabs: TABS, notifications, notify, dismissNotification, favorites, toggleFavorite, isFavorite }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
