import { useState, useEffect } from 'react'
import { useAppState } from '../../context/useAppState'
import { useStocks, useEthPrice } from '../../hooks/useMarkets'
import { TableSkeleton } from '../Skeleton'

function fmtPrice(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

function Spark({ data }) {
  if (!Array.isArray(data) || data.length < 2) return <span className="dim">—</span>
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 96
  const h = 26
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="spark" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export default function MarketsView() {
  const { setActiveTab, setSwapPrefill } = useAppState()
  const { stocks, loading } = useStocks()
  const ethPrice = useEthPrice()
  const [filter, setFilter] = useState('')
  const [updated, setUpdated] = useState(null)

  useEffect(() => {
    if (!loading) setUpdated(new Date().toLocaleTimeString())
  }, [loading, stocks])

  const rows = stocks
    .filter(s => !filter || s.ticker.toLowerCase().includes(filter.toLowerCase()) || s.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity))

  const gainers = stocks.filter(s => (s.change24h ?? 0) > 0).length
  const losers = stocks.filter(s => (s.change24h ?? 0) < 0).length

  function trade(tok) {
    setSwapPrefill({ to: { ...tok, address: tok.ca || tok.address, decimals: 18 } })
    setActiveTab('Swap')
  }

  return (
    <div className="container view">
      <div className="view-head row">
        <div>
          <h1 className="section-heading">Markets</h1>
          <p className="section-note">
            {stocks.length} tokenized stocks &amp; ETFs live on Robinhood Chain · ETH {ethPrice ? `$${fmtPrice(ethPrice)}` : '—'} ·
            {' '}{gainers} up / {losers} down · updated {updated || '…'}
          </p>
        </div>
        <input
          className="search-input"
          placeholder="Filter by ticker…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-wrap">
          <table className="editorial-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="hide-sm">Name</th>
                <th className="num">Price</th>
                <th className="num">24h</th>
                <th className="hide-sm">Trend</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.ca || s.ticker}>
                  <td>
                    <span className="ticker-cell">
                      {s.logo
                        ? <img src={s.logo} alt="" className="tok-logo" loading="lazy" />
                        : <span className="tok-logo tok-logo-fallback">{s.ticker.slice(0, 2)}</span>}
                      <strong>{s.ticker}</strong>
                    </span>
                  </td>
                  <td className="hide-sm muted">{s.name}</td>
                  <td className="num mono">{fmtPrice(s.priceUsd)}</td>
                  <td className={`num mono ${s.change24h > 0 ? 'up' : s.change24h < 0 ? 'down' : ''}`}>
                    {s.change24h == null ? '—' : `${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(2)}%`}
                  </td>
                  <td className="hide-sm"><Spark data={s.spark} /></td>
                  <td className="num">
                    <button type="button" className="pill pill-ghost xs" onClick={() => trade(s)}>Trade</button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="empty-cell">Nothing matches “{filter}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
