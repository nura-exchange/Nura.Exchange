import { Fragment, useEffect, useRef, useState } from 'react'
import { useStocks, useEthPrice, useChainTokens } from '../hooks/useMarkets'
import { useChainPulse } from '../hooks/useChainPulse'
import { usePulse } from '../hooks/useQuoro'
import HeroSearch from './HeroSearch'

function fmtUsd(n) {
  if (n === null || n === undefined) return '…'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${n.toFixed(2)}`
}

// Eased roll-up: values glide from their previous state to the new one (mount, data arrival, live ticks).
function useCountUp(target, dur = 900) {
  const [val, setVal] = useState(target == null ? null : 0)
  const fromRef = useRef(target == null ? null : 0)
  useEffect(() => {
    if (target == null) {
      setVal(null)
      fromRef.current = null
      return
    }
    const from = fromRef.current == null ? 0 : fromRef.current
    if (from === target) return
    let raf
    let start
    const step = ts => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(from + (target - from) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, dur])
  return val
}

function HeroStats() {
  const { stocks } = useStocks()
  const { chainTokens } = useChainTokens()
  const ethPrice = useEthPrice()
  const { block, blockTimeMs } = useChainPulse()
  const quoro = usePulse()

  const stockCas = new Set(stocks.map(s => (s.ca || '').toLowerCase()))
  const chainCount = chainTokens.filter(t => !stockCas.has((t.ca || '').toLowerCase())).length
  const total = stocks.length + chainCount

  const shownTotal = useCountUp(total)
  const shownEth = useCountUp(ethPrice)

  const stats = [
    ['Markets', shownTotal == null ? '—' : Math.round(shownTotal).toLocaleString('en-US')],
    ['ETH', ethPrice == null ? '—' : fmtUsd(shownEth)],
    ['Up / down 24h', stocks.some(s => s.change24h != null)
      ? `${stocks.filter(s => s.change24h > 0).length} / ${stocks.filter(s => s.change24h < 0).length}` : '—'],
    ['Red-flagged launches', quoro?.flagged == null ? '—' : `${quoro.flagged} of ${quoro.scored}`],
    ['New tokens 24h', quoro?.tokens == null ? '—' : quoro.tokens.toLocaleString('en-US')],
    ['Block', block == null ? '—' : `#${block.toLocaleString('en-US')}`],
    ['Block time', blockTimeMs == null ? '—' : blockTimeMs < 1000 ? `${Math.round(blockTimeMs)} ms` : `${(blockTimeMs / 1000).toFixed(1)} s`],
    ['Networks in', '16'],
  ]

  return (
    <div className="hero-stats reveal reveal-d2">
      {stats.map(([label, value], i) => (
        <Fragment key={label}>
          {i > 0 && <span className="hstat-div" aria-hidden="true" />}
          <span className="hstat">
            <span className="hstat-body">
              <span className="hstat-label">{label}</span>
              <span className="hstat-value mono">{value}</span>
            </span>
          </span>
        </Fragment>
      ))}
    </div>
  )
}

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-frame">
        <div className="hero-media" aria-hidden="true" />

        <h1 className="hero-slogan">Markets, unbound</h1>

        <div className="scroll-badge" aria-hidden="true">
          <svg viewBox="0 0 100 100" width="84" height="84">
            <defs>
              <path id="circlePath" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
            </defs>
            <text className="scroll-text">
              <textPath href="#circlePath">SCROLL DOWN · SCROLL DOWN · </textPath>
            </text>
          </svg>
        </div>

        <HeroSearch />
      </div>
      <HeroStats />
    </section>
  )
}
