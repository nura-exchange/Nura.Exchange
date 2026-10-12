import { useState, useEffect } from 'react'
import { useAppState } from '../../context/useAppState'
import { useStocks, useEthPrice, useChainTokens } from '../../hooks/useMarkets'
import { TableSkeleton } from '../Skeleton'

function fmtPrice(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (n >= 1) return n.toFixed(2)
  if (n === 0) return '0'
  return n.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

function fmtVol(v) {
  if (!v) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
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
  const { chainTokens, loading: chainLoading } = useChainTokens()
  const ethPrice = useEthPrice()
  const [filter, setFilter] = useState('')
  const [updated, setUpdated] = useState(null)
  const [chainVisible, setChainVisible] = useState(150)

  useEffect(() => {
    if (!loading) setUpdated(new Date().toLocaleTimeString())
  }, [loading, stocks])

  const rows = stocks
    .filter(s => !filter || s.ticker.toLowerCase().includes(filter.toLowerCase()) || s.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity))

  const gainers = stocks.filter(s => (s.change24h ?? 0) > 0).length
  const losers = stocks.filter(s => (s.change24h ?? 0) < 0).length

  const stockCas = new Set(stocks.map(s => (s.ca || '').toLowerCase()))
  const chainRows = chainTokens
    .filter(t => !stockCas.has((t.ca || '').toLowerCase()))
    .filter(t => !filter || t.symbol.toLowerCase().includes(filter.toLowerCase()) || t.name.toLowerCase().includes(filter.toLowerCase()))
  const chainShown = chainRows.slice(0, chainVisible)

  function trade(tok) {
    setSwapPrefill({ to: { ...tok, symbol: tok.symbol || tok.ticker, address: tok.ca || tok.address, decimals: tok.decimals ?? null } })
    setActiveTab('Swap')
  }

  return (
    <div className="container view">
      <div className="view-head row reveal">
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
          onChange={e => { setFilter(e.target.value); setChainVisible(150) }}
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="table-wrap reveal reveal-d1">
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
              {rows.map((s, i) => (
                <tr key={s.ca || s.ticker} style={{ '--i': Math.min(i, 12) }}>
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

      {!chainLoading && chainRows.length > 0 && (
        <>
          <div className="view-head reveal chain-head">
            <div>
              <h2 className="subheading">Chain</h2>
              <p className="section-note">
                {chainRows.length} more live markets on Robinhood Chain — every launch and DEX pool, ranked by 24h volume. Scored by Quoro.
              </p>
            </div>
          </div>
          <div className="table-wrap reveal">
            <table className="editorial-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th className="hide-sm">Name</th>
                  <th className="num">Price</th>
                  <th className="num">24h</th>
                  <th className="num hide-sm">Vol 24h</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {chainShown.map((t, i) => (
                  <tr key={t.ca} style={{ '--i': Math.min(i, 12) }}>
                    <td>
                      <span className="ticker-cell">
                        {t.logo
                          ? <img src={t.logo} alt="" className="tok-logo" loading="lazy" />
                          : <span className="tok-logo tok-logo-fallback">{t.symbol.slice(0, 2)}</span>}
                        <strong>{t.symbol}</strong>
                        {t.score != null && (
                          <span
                            className={`score-badge ${t.flagged ? 'flagged' : t.score >= 7 ? 'good' : t.score >= 4 ? 'mid' : 'low'}`}
                            title={`Data score from Quoro${t.flagged ? ' — flagged' : ''}`}
                          >
                            {t.score}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="hide-sm muted">{t.name}</td>
                    <td className="num mono">{fmtPrice(t.priceUsd)}</td>
                    <td className={`num mono ${t.change24h > 0 ? 'up' : t.change24h < 0 ? 'down' : ''}`}>
                      {t.change24h == null ? '—' : `${t.change24h > 0 ? '+' : ''}${t.change24h.toFixed(2)}%`}
                    </td>
                    <td className="num mono hide-sm dim">{fmtVol(t.vol24h)}</td>
                    <td className="num">
                      <button type="button" className="pill pill-ghost xs" onClick={() => trade(t)}>Trade</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chainRows.length > chainShown.length && (
            <div className="chain-more reveal">
              <button
                type="button"
                className="pill pill-ghost"
                onClick={() => setChainVisible(v => v + 150)}
              >
                Show 150 more · {chainRows.length - chainShown.length} left
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
