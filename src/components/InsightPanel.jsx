import { useEffect, useState } from 'react'
import PriceChart from './PriceChart'
import { useCandles } from '../hooks/useCandles'
import ScoreRing from './ScoreRing'
import { fetchTokenCheck, scoreClass } from '../hooks/useQuoro'

const RANGES = ['1H', '1D', '1W', '1M']

function price(n) {
  if (n == null) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (n >= 1) return n.toFixed(2)
  if (n === 0) return '0'
  return n.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

function usd(v) {
  if (!v) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

function ago(min) {
  if (min == null) return '—'
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 1440) return `${Math.floor(min / 60)} h ago`
  return `${Math.floor(min / 1440)} d ago`
}

// Chart + Data score for whichever token is selected in Swap.
export default function InsightPanel({ token }) {
  const ca = token?.ca || token?.address || null
  const symbol = token?.symbol || token?.ticker
  const [range, setRange] = useState('1D')
  const [check, setCheck] = useState(null)

  const chart = useCandles(ca || '', range)

  useEffect(() => {
    setCheck(null)
    if (!ca) return
    let alive = true
    fetchTokenCheck(ca).then(v => alive && setCheck(v)).catch(() => {})
    return () => { alive = false }
  }, [ca])

  if (!token || !ca) {
    return (
      <div className="insight insight-empty">
        <h2>Pick a token</h2>
        <p>Choose what you want to buy and its chart and Data score appear here before you sign anything.</p>
      </div>
    )
  }

  const change = token.change24h
  const s = check?.score
  const f = check?.facts
  const flagged = s?.caps?.some(c => c.applied && c.id === 'flag')

  return (
    <div className="insight">
      <div className="insight-head">
        {token.logo
          ? <img className="tok-logo" src={token.logo} alt="" />
          : <span className="tok-logo tok-logo-fallback">{(symbol || '?').slice(0, 2)}</span>}
        <div className="insight-id">
          <strong>{symbol}</strong>
          <span className="muted">{token.name}</span>
        </div>
        <div className="insight-quote">
          <span className="mono insight-price">{token.priceUsd != null ? `$${price(token.priceUsd)}` : '—'}</span>
          {change != null && (
            <span className={`chip ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
              {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change).toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      <div className="insight-chart">
        {chart.status === 'loading' && <div className="chart-skel" />}
        {chart.status === 'ready' && <PriceChart key={`${ca}-${range}-${chart.candles.length}`} candles={chart.candles} range={range} />}
        {(chart.status === 'empty' || chart.status === 'error') && (
          <div className="chart-empty">
            {chart.status === 'empty' ? 'No pool history yet. This token is still on the bonding curve.' : 'Chart unavailable right now.'}
          </div>
        )}
      </div>
      <div className="seg insight-ranges" role="group" aria-label="Chart range">
        {RANGES.map(r => (
          <button key={r} type="button" className={`seg-btn ${r === range ? 'active' : ''}`} aria-pressed={r === range} onClick={() => setRange(r)}>{r}</button>
        ))}
      </div>

      {s ? (
        <div className="insight-score">
          <ScoreRing value={s.value} size={104} tone={scoreClass(s.value, flagged)} />
          <div className="insight-score-text">
            <strong>Data score</strong>
            <span>Launch {s.hygiene}/10 · Market {s.market}/10</span>
            {s.flags?.[0] && <p><span className="mono down">−{s.flags[0].points}</span> {s.flags[0].text}</p>}
            {!s.flags?.length && <p className="muted">No launch deductions.</p>}
          </div>
        </div>
      ) : (
        <dl className="insight-stats">
          <div><dt>24h volume</dt><dd className="mono">{usd(token.vol24h)}</dd></div>
          <div><dt>Market cap</dt><dd className="mono">{usd(token.mcap ?? check?.mcapUsd)}</dd></div>
          <div><dt>Type</dt><dd>{check?.kind === 'stock' ? 'Stock token' : 'Token'}</dd></div>
        </dl>
      )}

      {f && (
        <dl className="insight-stats">
          <div><dt>Buyers</dt><dd className="mono">{f.buyers ?? '—'}</dd></div>
          <div><dt>Creator holds</dt><dd className="mono">{f.devPct == null ? '—' : `${f.devPct}%`}</dd></div>
          <div><dt>Last trade</dt><dd className="mono">{ago(f.lastTradeMin)}</dd></div>
        </dl>
      )}
      <p className="insight-legal">Data score by Quoro. It describes the launch, not the future price. Not financial advice.</p>
    </div>
  )
}
