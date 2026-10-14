import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { loadFavorites, saveFavorites, toggleFav } from '../lib/favorites'

const TABS = ['Markets', 'Swap', 'Bridge', 'Scan', 'Portfolio', 'History', 'News', 'Docs']

// URL routing: each tab lives at its own path (/market, /swap, /scan, …) so
// links are shareable and refresh/back keep the user where they were.
// '/' and anything unknown resolve to Markets.
const pathToTab = (path) => {
  const seg = String(path || '').replace(/\/+$/, '').split('/').filter(Boolean)[0] || ''
  return TABS.find((t) => t.toLowerCase() === seg.toLowerCase()) || 'Markets'
}
const tabToPath = (tab) => `/${tab.toLowerCase()}`

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [activeTab, setActiveTabState] = useState(() =>
    typeof window === 'undefined' ? 'Markets' : pathToTab(window.location.pathname)
  )
  const [swapPrefill, setSwapPrefill] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [favorites, setFavorites] = useState(loadFavorites)
  const notifId = useRef(0)

  useEffect(() => {
    const onPop = () => setActiveTabState(pathToTab(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab)
    const path = tabToPath(tab)
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
    <AppContext.Provider value={{ activeTab, setActiveTab, swapPrefill, setSwapPrefill, tabs: TABS, notifications, notify, dismissNotification, favorites, toggleFavorite, isFavorite }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
