import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId } from 'wagmi'
import { useAppState } from '../context/useAppState'
import { useNativeBalance } from '../hooks/useTokenBalance'
import CommandPalette from './CommandPalette'

const I = {
  Markets: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
  Swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7" />,
  Bridge: <path d="M3 17c3-8 15-8 18 0M3 17h3m12 0h3M9 17v-3m6 3v-3" />,
  Portfolio: <path d="M3 8h18v11H3zM8 8V5h8v3" />,
  History: <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-4v4h4M12 8v4l3 2" />,
  News: <path d="M5 4h12a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2V4zm4 4h6m-6 4h6m-6 4h3" />,
  Docs: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7m-7 4h5" />,
}

function Icon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {I[name]}
    </svg>
  )
}

const BAR = ['Markets', 'Swap', 'Bridge', 'Portfolio']

export default function Navbar() {
  const { activeTab, setActiveTab, tabs } = useAppState()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const native = useNativeBalance(chainId)
  const [more, setMore] = useState(false)
  const moreRef = useRef(null)
  const moreTabs = tabs.filter(t => !BAR.includes(t))
  const tabsRef = useRef(null)
  const [ind, setInd] = useState({ x: 0, w: 0, ready: false })

  // Sliding highlight behind the active tab
  useLayoutEffect(() => {
    const place = () => {
      const el = tabsRef.current?.querySelector('.nav-tab.active')
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth, ready: true })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [activeTab])

  useEffect(() => {
    const onDown = e => { if (moreRef.current && !moreRef.current.contains(e.target)) setMore(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function go(tab) { setActiveTab(tab); setMore(false) }

  return (
    <>
      <header className="nav-header">
        <a className="nav-brand" href="/" onClick={e => { e.preventDefault(); go('Markets') }}>
          <img className="nav-logo" src="/logo-nura.png" alt="" width="28" height="28" />
          <span className="wordmark">nura</span>
          <span className="nav-badge">Robinhood Chain</span>
        </a>

        <nav className="nav-tabs" aria-label="Main" ref={tabsRef}>
          <span className={`nav-indicator ${ind.ready ? 'ready' : ''}`} style={{ width: ind.w, transform: `translateX(${ind.x}px)` }} aria-hidden="true" />
          {tabs.map(tab => (
            <button key={tab} type="button" className={`nav-tab ${activeTab === tab ? 'active' : ''}`} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => go(tab)}>
              {tab}
            </button>
          ))}
        </nav>

        <div className="nav-right">
          <CommandPalette />
          {isConnected && native.balance > 0 && (
            <span className="nav-balance mono">{native.formatted.slice(0, 8)} ETH</span>
          )}
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
        </div>
      </header>

      <nav className="tabbar" aria-label="Main">
        {BAR.map(tab => (
          <button key={tab} type="button" className={`tabbar-btn ${activeTab === tab ? 'active' : ''}`} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => go(tab)}>
            <Icon name={tab} />
            <span>{tab}</span>
          </button>
        ))}
        <div className="tabbar-more" ref={moreRef}>
          <button type="button" className={`tabbar-btn ${moreTabs.includes(activeTab) ? 'active' : ''}`} aria-expanded={more} onClick={() => setMore(m => !m)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            <span>More</span>
          </button>
          {more && (
            <div className="tabbar-menu" role="menu">
              {moreTabs.map(tab => (
                <button key={tab} type="button" role="menuitem" className={activeTab === tab ? 'active' : ''} onClick={() => go(tab)}>
                  <Icon name={tab} /> {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
