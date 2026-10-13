import { useMemo, useState } from 'react'
import { useAppState } from '../context/useAppState'
import { useStocks } from '../hooks/useMarkets'
import Spark from './Spark'

function price(n) {
  if (n == null) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (n >= 1) return n.toFixed(2)
  return n.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

const TABS = [
  ['gain', 'Gainers'],
  ['loss', 'Losers'],
  ['vol', 'Most traded'],
]

export default function MoversStrip() {
  const { setActiveTab, setSwapPrefill } = useAppState()
  const { stocks, loading } = useStocks()
  const [tab, setTab] = useState('gain')

  const hasVol = stocks.some(s => s.vol24h > 0)
  const tabs = TABS.filter(([k]) => k !== 'vol' || hasVol)

  const list = useMemo(() => {
    const withChange = stocks.filter(s => s.change24h != null)
    if (tab === 'gain') return [...withChange].sort((a, b) => b.change24h - a.change24h)
    if (tab === 'loss') return [...withChange].sort((a, b) => a.change24h - b.change24h)
    return [...stocks].filter(s => s.vol24h > 0).sort((a, b) => b.vol24h - a.vol24h)
  }, [stocks, tab])

  if (loading || !list.length) return null

  function trade(tok) {
    setSwapPrefill({ to: { ...tok, symbol: tok.ticker, address: tok.ca, decimals: tok.decimals ?? null } })
    setActiveTab('Swap')
  }

  return (
    <section className="container movers reveal" aria-label="Market movers">
      <div className="movers-head">
        <div>
          <h2 className="subheading">Moving now</h2>
          <p className="section-note">Stock tokens with the biggest moves in the last 24 hours.</p>
        </div>
        <div className="seg" role="group" aria-label="Movers view">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" className={`seg-btn ${tab === k ? 'active' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="movers-grid">
        {list.slice(0, 6).map(s => (
          <button key={s.ca || s.ticker} type="button" className="mover" onClick={() => trade(s)}>
            <span className="mover-top">
              <span className="tok-logo tok-logo-fallback">{s.ticker.slice(0, 2)}</span>
              <strong>{s.ticker}</strong>
              <span className={`mono mover-ch ${s.change24h > 0 ? 'up' : s.change24h < 0 ? 'down' : ''}`}>
                {s.change24h == null ? '—' : `${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(2)}%`}
              </span>
            </span>
            <span className="mover-name">{s.name}</span>
            <span className="mover-bottom">
              <span className="mono">${price(s.priceUsd)}</span>
              <Spark data={s.spark} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
