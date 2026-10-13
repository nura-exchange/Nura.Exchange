import { useState } from 'react'
import { fmtPrice } from '../lib/chart'

const W = 800
const H = 300
const PL = 10
const PR = 66
const PT = 18
const PB = 28

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

export default function ChartSvg({ candles, range }) {
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
