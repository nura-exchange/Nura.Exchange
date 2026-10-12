import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { config, robinhoodChain } from './config'
import { AppProvider, useAppState } from './context/useAppState'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Hero from './components/Hero'
import ManifestoBand from './components/ManifestoBand'
import MarketsView from './components/views/MarketsView'
import PortfolioView from './components/views/PortfolioView'
import HistoryView from './components/views/HistoryView'
import SwapView from './components/views/SwapView'
import BridgeView from './components/views/BridgeView'
import NewsView from './components/views/NewsView'

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

function Page() {
  const { activeTab } = useAppState()

  return (
    <div className="page">
      <Navbar />
      <WrongNetworkBanner />
      <div className="page-body">
        {activeTab === 'Markets' && <Hero />}
        <ErrorBoundary>
          {activeTab === 'Markets' && <MarketsView />}
          {activeTab === 'Markets' && <ManifestoBand />}
          {activeTab === 'Swap' && <SwapView />}
          {activeTab === 'Bridge' && <BridgeView />}
          {activeTab === 'Portfolio' && <PortfolioView />}
          {activeTab === 'History' && <HistoryView />}
          {activeTab === 'News' && <NewsView />}
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
          theme={lightTheme({
            accentColor: '#000000',
            accentColorForeground: '#ffffff',
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
