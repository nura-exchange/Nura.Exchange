import { createContext, useContext, useState, useCallback, useRef } from 'react'

const TABS = ['Markets', 'Swap', 'Bridge', 'Portfolio', 'History', 'News', 'Docs']

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [activeTab, setActiveTab] = useState('Markets')
  const [swapPrefill, setSwapPrefill] = useState(null)
  const [notifications, setNotifications] = useState([])
  const notifId = useRef(0)

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
    <AppContext.Provider value={{ activeTab, setActiveTab, swapPrefill, setSwapPrefill, tabs: TABS, notifications, notify, dismissNotification }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
