import { useState, useEffect } from 'react'
import { useStocks, useEthPrice, useChainTokens } from '../../hooks/useMarkets'
import { TableSkeleton } from '../Skeleton'
import TradeTerminal from '../TradeTerminal'
import { marketSession, SESSIONS } from '../../lib/session'
import { useAppState } from '../../context/useAppState'
import { TokenLogo, VerifiedBadge, StarButton } from '../TokenBadge'

const MARKETS = [
  { id: 'stocks', label: 'Stocks' },
  { id: 'chain', label: 'Memecoins' },
  { id: 'favorites', label: 'Favorites' },
]

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
      <polyline points={pts} pathLength="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export default function MarketsView() {
  const { stocks, loading } = useStocks()
  const { chainTokens, loading: chainLoading } = useChainTokens()
  const ethPrice = useEthPrice()
  const { isFavorite } = useAppState()
  const [market, setMarket] = useState('stocks')
  const [filter, setFilter] = useState('')
  const [updated, setUpdated] = useState(null)
  const [chainVisible, setChainVisible] = useState(150)
  const [termTok, setTermTok] = useState(null)
  const [session, setSession] = useState(() => marketSession())

  useEffect(() => {
    const i = setInterval(() => setSession(marketSession()), 60000)
    return () => clearInterval(i)
  }, [])

  function openChart(e, tok) {
    if (e.target.closest('button')) return
    setTermTok(tok)
  }
  function trade(tok) { setTermTok(tok) }

  useEffect(() => {
    if (!loading) setUpdated(new Date().toLocaleTimeString())
  }, [loading, stocks])

  const q = filter.trim().toLowerCase()
  const matchStock = (s) => !q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  const matchChain = (t) => !q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)

  const stockCas = new Set(stocks.map(s => (s.ca || '').toLowerCase()))
  const chainBase = chainTokens.filter(t => !stockCas.has((t.ca || '').toLowerCase()))
  const chainTotal = chainBase.length

  const stocksRows = stocks.filter(matchStock).sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity))
  const chainRows = chainBase.filter(matchChain)
  const favStocks = stocksRows.filter(s => isFavorite(s.ca))
  const favChain = chainRows.filter(t => isFavorite(t.ca))

  const gainers = stocks.filter(s => (s.change24h ?? 0) > 0).length
  const losers = stocks.filter(s => (s.change24h ?? 0) < 0).length

  const stocksTable = (list) => (
    <div className="table-wrap reveal reveal-d1">
      <table className="editorial-table">
        <thead>
          <tr>
            <th className="star-col"></th>
            <th>Ticker</th>
            <th className="hide-sm">Name</th>
            <th className="num">Price</th>
            <th className="num">24h</th>
            <th className="hide-sm">Trend</th>
            <th></th>
          </tr>
        </thead>
        <tbody key={`stocks-${filter}-${list.length}`}>
          {list.map((s, i) => (
            <tr key={s.ca || s.ticker} className="row-link" style={{ '--i': Math.min(i, 12) }} onClick={e => openChart(e, s)}>
              <td className="star-col"><StarButton ca={s.ca} /></td>
              <td>
                <span className="ticker-cell">
                  <TokenLogo token={s} symbol={s.ticker} />
                  <strong>{s.ticker}</strong>
                </span>
              </td>
              <td className="hide-sm muted">{s.name}</td>
              <td className="num mono">{fmtPrice(s.priceUsd)}</td>
              <td className={`num mono ${s.change24h > 0 ? 'up' : s.change24h < 0 ? 'down' : ''}`}>
                {s.change24h == null ? '—' : `${s.change24h > 0 ? '+' : ''}${s.change24h.toFixed(2)}%`}
              </td>
              <td className="hide-sm"><Spark data={s.spark} /></td>
              <td className="num"><button type="button" className="pill pill-ghost xs" onClick={() => trade(s)}>Trade</button></td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={7} className="empty-cell">{emptyMsg('stock')}</td></tr>}
        </tbody>
      </table>
    </div>
  )

  const chainTable = (list) => (
    <div className="table-wrap reveal">
      <table className="editorial-table">
        <thead>
          <tr>
            <th className="star-col"></th>
            <th>Token</th>
            <th className="hide-sm">Name</th>
            <th className="num">Price</th>
            <th className="num">24h</th>
            <th className="num hide-sm">Vol 24h</th>
            <th></th>
          </tr>
        </thead>
        <tbody key={`chain-${filter}-${list.length}`}>
          {list.map((t, i) => (
            <tr key={t.ca} className="row-link" style={{ '--i': Math.min(i, 12) }} onClick={e => openChart(e, t)}>
              <td className="star-col"><StarButton ca={t.ca} /></td>
              <td>
                <span className="ticker-cell">
                  <TokenLogo token={t} symbol={t.symbol} />
                  <strong>{t.symbol}</strong>
                  <VerifiedBadge token={t} />
                  {t.score != null && (
                    <span className={`score-badge ${t.flagged ? 'flagged' : t.score >= 7 ? 'good' : t.score >= 4 ? 'mid' : 'low'}`} title={`Data score from Quoro${t.flagged ? ' — flagged' : ''}`}>{t.score}</span>
                  )}
                </span>
              </td>
              <td className="hide-sm muted">{t.name}</td>
              <td className="num mono">{fmtPrice(t.priceUsd)}</td>
              <td className={`num mono ${t.change24h > 0 ? 'up' : t.change24h < 0 ? 'down' : ''}`}>
                {t.change24h == null ? '—' : `${t.change24h > 0 ? '+' : ''}${t.change24h.toFixed(2)}%`}
              </td>
              <td className="num mono hide-sm dim">{fmtVol(t.vol24h)}</td>
              <td className="num"><button type="button" className="pill pill-ghost xs" onClick={() => trade(t)}>Trade</button></td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={7} className="empty-cell">{emptyMsg('memecoin')}</td></tr>}
        </tbody>
      </table>
    </div>
  )

  function emptyMsg(kind) {
    if (market === 'favorites') return 'No favorites here yet — tap a ★ to save a token.'
    if (q) return `No ${kind} matches “${filter}”.`
    return `No ${kind} markets right now.`
  }

  const chainShown = chainRows.slice(0, chainVisible)
  const showFavStocks = market === 'favorites' && favStocks.length > 0
  const showFavChain = market === 'favorites' && favChain.length > 0

  return (
    <div className="container view">
      {termTok && <TradeTerminal token={termTok} onClose={() => setTermTok(null)} />}
      <div className="view-head row reveal">
        <div>
          <h1 className="section-heading">Markets</h1>
          <p className="section-note">
            {stocks.length} tokenized stocks &amp; ETFs{chainTotal > 0 ? ` + ${chainTotal} memecoins` : ''} on Robinhood Chain · ETH {ethPrice ? `$${fmtPrice(ethPrice)}` : '—'} ·
            {' '}{gainers} up / {losers} down · updated {updated || '…'}
            {' '}<span className={`session-badge sess-${session}`} title="US equity session (ET)">{SESSIONS[session].label}</span>
          </p>
        </div>
        <div className="markets-controls">
          <div className="market-seg" role="tablist" aria-label="Market type">
            {MARKETS.map(m => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={market === m.id}
                className={`market-seg-btn ${market === m.id ? 'active' : ''}`}
                onClick={() => setMarket(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <input
            className="search-input"
            placeholder="Filter by ticker…"
            value={filter}
            onChange={e => { setFilter(e.target.value); setChainVisible(150) }}
          />
        </div>
      </div>

      {market === 'stocks' && (loading ? <TableSkeleton /> : stocksTable(stocksRows))}

      {market === 'chain' && (chainLoading ? <TableSkeleton /> : chainTable(chainShown))}

      {market === 'chain' && !chainLoading && chainRows.length > chainShown.length && (
        <div className="chain-more reveal">
          <button type="button" className="pill pill-ghost" onClick={() => setChainVisible(v => v + 150)}>
            Show 150 more · {chainRows.length - chainShown.length} left
          </button>
        </div>
      )}

      {market === 'favorites' && (
        !showFavStocks && !showFavChain
          ? <div className="table-wrap reveal"><table className="editorial-table"><tbody><tr><td colSpan={7} className="empty-cell">{emptyMsg('')}</td></tr></tbody></table></div>
          : (
            <>
              {showFavStocks && (
                <>
                  <div className="view-head reveal chain-head"><div><h2 className="subheading">Stocks</h2></div></div>
                  {stocksTable(favStocks)}
                </>
              )}
              {showFavChain && (
                <>
                  <div className="view-head reveal chain-head"><div><h2 className="subheading">Memecoins</h2></div></div>
                  {chainTable(favChain)}
                </>
              )}
            </>
          )
      )}
    </div>
  )
}
