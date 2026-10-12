import { Fragment } from 'react'
import { useStocks, useEthPrice } from '../hooks/useMarkets'

function fmtUsd(n) {
  if (n === null || n === undefined) return '…'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return `$${n.toFixed(2)}`
}

function HeroStats() {
  const { stocks } = useStocks()
  const ethPrice = useEthPrice()

  const stats = [
    ['Markets', stocks.length ? String(stocks.length) : '…'],
    ['ETH', fmtUsd(ethPrice)],
    ['Chain', '4663'],
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

function LiquidFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="nura-liquid" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.005 0.009"
            numOctaves="2"
            seed="7"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="40s"
              values="0.005 0.009; 0.009 0.005; 0.005 0.009"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="160"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-frame">
        <div className="hero-media" aria-hidden="true">
          <div className="hero-flow">
            <div className="hero-blob b1" />
            <div className="hero-blob b2" />
            <div className="hero-blob b3" />
            <div className="hero-blob b4" />
          </div>
          <div className="hero-grain" />
        </div>

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
      <LiquidFilter />
    </section>
  )
}
