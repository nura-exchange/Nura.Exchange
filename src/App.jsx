import { useEffect, useRef } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { config, robinhoodChain } from './config'
import { AppProvider, useAppState } from './context/useAppState'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Hero from './components/Hero'
import ManifestoBand from './components/ManifestoBand'
import MoversStrip from './components/MoversStrip'
import HowSection from './components/HowSection'
import LaunchesFeed from './components/LaunchesFeed'
import MarketsView from './components/views/MarketsView'
import PortfolioView from './components/views/PortfolioView'
import HistoryView from './components/views/HistoryView'
import SwapView from './components/views/SwapView'
import BridgeView from './components/views/BridgeView'
import NewsView from './components/views/NewsView'
import DocsView from './components/views/DocsView'

import { ErrorBoundary } from './components/ErrorBoundary'
import WrongNetworkBanner from './components/WrongNetworkBanner'

const queryClient = new QueryClient()

function Notifications() {
  const { notifications, dismissNotification } = useAppState()
  if (!notifications.length) return null
  return (
    <div className="toast-container">
      {notifications.map(n => (
        <div key={n.id} className={`toast toast-${n.type}`} onClick={() => dismissNotification(n.id)}>
          <div className="toast-head">
            <span className="toast-title">{n.title}</span>
            <span className="toast-time">{n.time}</span>
          </div>
          <span className="toast-msg">{n.message}</span>
        </div>
      ))}
    </div>
  )
}

function ScrollProgress() {
  const ref = useRef(null)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0 ? window.scrollY / max : 0
        if (ref.current) ref.current.style.transform = `scaleX(${Math.min(1, p)})`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return <div className="scroll-progress" ref={ref} aria-hidden="true" />
}

function Page() {
  const { activeTab } = useAppState()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [activeTab])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    const observe = el => {
      if (el.classList && el.classList.contains('reveal') && !el.classList.contains('is-visible')) io.observe(el)
      if (el.querySelectorAll) el.querySelectorAll('.reveal:not(.is-visible)').forEach(child => io.observe(child))
    }
    document.querySelectorAll('.reveal').forEach(observe)
    const mo = new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType === 1) observe(node)
      }))
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [activeTab])

  return (
    <div className="page">
      <ScrollProgress />
      <Navbar />
      <WrongNetworkBanner />
      <div className="page-body">
        {activeTab === 'Markets' && <Hero />}
        <ErrorBoundary>
          <div className="view-fade" key={activeTab}>
            {activeTab === 'Markets' && <MoversStrip />}
            {activeTab === 'Markets' && <LaunchesFeed />}
            {activeTab === 'Markets' && <MarketsView />}
            {activeTab === 'Markets' && <HowSection />}
            {activeTab === 'Markets' && <ManifestoBand />}
            {activeTab === 'Swap' && <SwapView />}
            {activeTab === 'Bridge' && <BridgeView />}
            {activeTab === 'Portfolio' && <PortfolioView />}
            {activeTab === 'History' && <HistoryView />}
            {activeTab === 'News' && <NewsView />}
            {activeTab === 'Docs' && <DocsView />}
          </div>
        </ErrorBoundary>
      </div>
      <Notifications />
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={robinhoodChain}
          theme={darkTheme({
            accentColor: '#ffffff',
            accentColorForeground: '#000000',
            borderRadius: 'none',
          })}
        >
          <AppProvider>
            <Page />
          </AppProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
