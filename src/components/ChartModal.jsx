import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../context/useAppState'

const RANGES = ['1H', '1D', '1W', '1M', '1Y']

const W = 800
const H = 300
const PL = 10
const PR = 66
const PT = 18
const PB = 28

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

function fmtTime(t, range) {
  const d = new Date(t * 1000)
  if (range === '1H' || range === '1D') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (range === '1Y') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Catmull-Rom → cubic bezier: smooth line without overshooting flat stretches much.
function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function ChartSvg({ candles, range }) {
  const [hover, setHover] = useState(null)
  const n = candles.length

  let lo = Math.min(...candles.map(c => c.l))
  let hi = Math.max(...candles.map(c => c.h))
  const span = (hi - lo) || Math.abs(hi * 0.04) || 1
  lo -= span * 0.08
  hi += span * 0.08

  const x = i => PL + (i / Math.max(1, n - 1)) * (W - PL - PR)
  const y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB)

  const pts = candles.map((c, i) => [x(i), y(c.c)])
  const line = smoothPath(pts)
  const area = `${line} L${x(n - 1).toFixed(1)},${H - PB} L${x(0).toFixed(1)},${H - PB} Z`
  const up = candles[n - 1].c >= candles[0].c
  const stroke = up ? 'var(--pine-bright)' : 'var(--neg)'
  const fillTop = up ? 'rgba(63, 158, 116, 0.32)' : 'rgba(229, 103, 91, 0.28)'

  const gridVals = [0, 1, 2, 3].map(k => lo + ((hi - lo) * k) / 3)
  const tickIdx = [...new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1])]
  const last = candles[n - 1]

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const rx = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((rx - PL) / (W - PL - PR)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const hv = hover != null ? candles[hover] : null

  return (
    <div className="chart-box">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillTop} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line className="cgrid" x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} />
            <text className="clabel" x={W - PR + 9} y={y(v) + 3.5}>{fmtPrice(v)}</text>
          </g>
        ))}

        {tickIdx.map((i, k) => (
          <text
            key={`t${k}`}
            className="clabel"
            x={x(i)}
            y={H - 8}
            textAnchor={k === 0 ? 'start' : k === tickIdx.length - 1 ? 'end' : 'middle'}
          >
            {fmtTime(candles[i].t, range)}
          </text>
        ))}

        <path className="chart-area" d={area} fill="url(#chartFill)" />
        <path className="chart-line" d={line} pathLength="1" stroke={stroke} />
        <circle className="chart-lastdot" cx={x(n - 1)} cy={y(last.c)} r="3.5" fill={stroke} />

        {hv && (
          <>
            <line className="chart-cross" x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} />
            <circle cx={x(hover)} cy={y(hv.c)} r="4.5" fill={stroke} stroke="var(--panel)" strokeWidth="2" />
          </>
        )}
      </svg>

      {hv && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hv.c) / H) * 100}%` }}>
          <span className="mono">{fmtPrice(hv.c)}</span>
          <span className="dim"> · {fmtTime(hv.t, range)}</span>
        </div>
      )}
    </div>
  )
}

export default function ChartModal({ token, onClose }) {
  const { setActiveTab, setSwapPrefill } = useAppState()
  const [range, setRange] = useState('1D')
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fetch(`/api/chart?ca=${token.ca}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        if (!d.ok) setState({ status: 'error' })
        else if (!Array.isArray(d.candles) || !d.candles.length) setState({ status: 'empty' })
        else setState({ status: 'ready', candles: d.candles, pool: d.pool })
      })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [token.ca, range, tick])

  function trade() {
    setSwapPrefill({ to: { ...token, symbol: token.symbol || token.ticker, address: token.ca, decimals: token.decimals ?? null } })
    setActiveTab('Swap')
    onClose()
  }

  const symbol = token.symbol || token.ticker
  const change = token.change24h

  return createPortal(
    <div className="chart-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="chart-panel" role="dialog" aria-label={`${symbol} chart`}>
        <div className="chart-head">
          {token.logo
            ? <img className="tok-logo" src={token.logo} alt="" />
            : <span className="tok-logo tok-logo-fallback">{symbol.slice(0, 2)}</span>}
          <div className="chart-id">
            <div className="chart-name"><strong>{symbol}</strong> <span className="muted">{token.name}</span></div>
            <div className="chart-addr mono dim">{token.ca.slice(0, 6)}…{token.ca.slice(-4)}</div>
          </div>
          <div className="chart-quote">
            <span className="chart-price mono">{fmtPrice(token.priceUsd)}</span>
            {change != null && (
              <span className={`chart-chip ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
                {change > 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
          <button type="button" className="pill pill-ghost xs chart-close" onClick={onClose} aria-label="Close chart">✕</button>
        </div>

        <div className="chart-stats">
          {token.vol24h != null && <span>Vol 24h <b className="mono">{fmtVol(token.vol24h)}</b></span>}
          {token.score != null && (
            <span>
              Data score{' '}
              <b className={`score-badge ${token.flagged ? 'flagged' : token.score >= 7 ? 'good' : token.score >= 4 ? 'mid' : 'low'}`}>
                {token.score}
              </b>
            </span>
          )}
          {state.pool && <span className="dim">Pool · {state.pool}</span>}
        </div>

        <div className="range-tabs">
          {RANGES.map(r => (
            <button
              key={r}
              type="button"
              className={`pill xs range-tab ${r === range ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="chart-stage">
          {state.status === 'loading' && <div className="chart-skel" />}
          {state.status === 'error' && (
            <div className="chart-empty">
              Chart failed to load.{' '}
              <button type="button" className="pill pill-ghost xs" onClick={() => setTick(t => t + 1)}>Retry</button>
            </div>
          )}
          {state.status === 'empty' && (
            <div className="chart-empty">
              No pool history yet — this token is still on the bonding curve.
              <br />
              <span className="dim">Live price only.</span>
            </div>
          )}
          {state.status === 'ready' && (
            <ChartSvg key={`${range}-${state.candles.length}-${tick}`} candles={state.candles} range={range} />
          )}
        </div>

        <div className="chart-foot">
          <span className="dim">Press any market row to open its chart · Esc to close</span>
          <button type="button" className="pill pill-primary" onClick={trade}>Trade {symbol}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
