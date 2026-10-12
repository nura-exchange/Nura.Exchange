import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useAppState } from '../context/useAppState'
import { useNativeBalance } from '../hooks/useTokenBalance'

export default function Navbar() {
  const { activeTab, setActiveTab, tabs } = useAppState()
  const { isConnected } = useAccount()
  const native = useNativeBalance()

  return (
    <header className="nav-header">
      <a className="nav-brand" href="/" onClick={e => { e.preventDefault(); setActiveTab('Markets') }}>
        <span className="wordmark">nura</span>
        <span className="nav-badge">Robinhood Chain</span>
      </a>

      <nav className="nav-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="nav-right">
        {isConnected && native.balance > 0 && (
          <span className="nav-balance mono">{native.formatted.slice(0, 8)} ETH</span>
        )}
        <ConnectButton showBalance={false} />
      </div>
    </header>
  )
}
