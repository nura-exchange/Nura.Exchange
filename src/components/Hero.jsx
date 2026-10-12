import { Fragment } from 'react'
import { useStocks, useEthPrice, useChainTokens } from '../hooks/useMarkets'

function fmtUsd(n) {
  if (n === null || n === undefined) return '…'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${n.toFixed(2)}`
}

function HeroStats() {
  const { stocks } = useStocks()
  const { chainTokens } = useChainTokens()
  const ethPrice = useEthPrice()

  const stockCas = new Set(stocks.map(s => (s.ca || '').toLowerCase()))
  const chainCount = chainTokens.filter(t => !stockCas.has((t.ca || '').toLowerCase())).length
  const stats = [
    ['Markets', String(stocks.length + chainCount)],
    ['ETH', fmtUsd(ethPrice)],
    ['Chain', '4663'],
    ['Networks', '16'],
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

        <span className="hero-dot" aria-hidden="true" />
      </div>
      <HeroStats />
    </section>
  )
}
