import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../context/useAppState'
import { useStocks, useChainTokens } from '../../hooks/useMarkets'
import { TokenLogo } from '../TokenBadge'

const EXPLORER = 'https://robin.etherscan.io/address/'
const ADDR_RE = /^0x[a-fA-F0-9]{40}$/

function fmtPrice(n) {
  if (n == null) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (n >= 1) return n.toFixed(2)
  if (n === 0) return '0'
  return n.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

function fmtMcap(n) {
  if (n == null) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export default function TokenView() {
  const { tokenAddress, setActiveTab, setSwapPrefill, openToken } = useAppState()
  const { stocks } = useStocks()
  const { chainTokens } = useChainTokens()
  const [copied, setCopied] = useState(false)

  const addr = String(tokenAddress || '').toLowerCase()

  const meta = useMemo(() => {
    const ct = chainTokens.find(t => (t.ca || '').toLowerCase() === addr)
    if (ct) return { ...ct, symbol: ct.symbol, name: ct.name }
    const st = stocks.find(s => (s.ca || '').toLowerCase() === addr)
    if (st) return { ...st, symbol: st.ticker, name: st.name, priceUsd: st.priceUsd, change24h: st.change24h }
    return null
  }, [chainTokens, stocks, addr])

  const token = meta
    ? {
        ca: meta.ca || addr,
        symbol: meta.symbol,
        name: meta.name,
        logo: meta.logo || null,
        decimals: meta.decimals ?? 18,
        priceUsd: meta.priceUsd ?? null,
        change24h: meta.change24h ?? null,
        vol24h: meta.vol24h ?? null,
        mcap: meta.mcap ?? null,
        score: meta.score ?? null,
        flagged: meta.flagged ?? false,
      }
    : { ca: addr, symbol: null, name: null, logo: null, decimals: 18, priceUsd: null, change24h: null, vol24h: null, mcap: null, score: null, flagged: false }

  const loading = !meta && stocks.length === 0 && chainTokens.length === 0

  useEffect(() => {
    document.title = token.symbol ? `${token.symbol} · Nura` : 'Token · Nura'
    return () => { document.title = 'Nura Exchange' }
  }, [token.symbol])

  function copy() {
    navigator.clipboard?.writeText(addr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function trade() {
    setSwapPrefill({ to: { ...token, symbol: token.symbol, address: token.ca, decimals: token.decimals } })
    setActiveTab('Swap')
  }

  if (!ADDR_RE.test(addr)) return <div className="container view"><p className="dim">Invalid token address.</p></div>
  if (loading) return <div className="container view"><p className="dim">Loading token…</p></div>

  return (
    <div className="container view token-view">
      <div className="token-hero reveal">
        <TokenLogo token={token} symbol={token.symbol || '?'} showChain />
        <div className="token-id">
          <h1 className="section-heading">{token.symbol || 'Token'}</h1>
          <p className="token-name dim">{token.name || 'Unknown token'}</p>
        </div>
        <div className="token-price">
          {token.priceUsd != null && <span className="mono token-usd">${fmtPrice(token.priceUsd)}</span>}
          {token.change24h != null && (
            <span className={`mono ${token.change24h > 0 ? 'up' : token.change24h < 0 ? 'down' : ''}`}>
              {token.change24h > 0 ? '+' : ''}{token.change24h.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="token-actions">
          <button type="button" className="pill pill-primary" onClick={trade}>Trade {token.symbol || ''}</button>
          <a className="pill pill-ghost" href={`https://ponsfamily.com/launchpad/${addr}`} target="_blank" rel="noreferrer">
            Launchpad ↗
          </a>
          <a className="pill pill-ghost" href={`${EXPLORER}${addr}`} target="_blank" rel="noreferrer">
            Explorer ↗
          </a>
        </div>
      </div>

      <div className="token-grid reveal reveal-d1">
        <div className="token-card">
          <span className="label">Contract</span>
          <button type="button" className="token-addr mono" onClick={copy} title="Copy address">
            {addr.slice(0, 8)}…{addr.slice(-6)}
            <span className="token-copy">{copied ? '✓' : '⧉'}</span>
          </button>
        </div>
        <div className="token-card">
          <span className="label">Market cap</span>
          <span className="mono">{fmtMcap(token.mcap)}</span>
        </div>
        <div className="token-card">
          <span className="label">24h volume</span>
          <span className="mono">{fmtMcap(token.vol24h)}</span>
        </div>
        <div className="token-card">
          <span className="label">Network</span>
          <span>Robinhood Chain · 4663</span>
        </div>
      </div>

      <div className="token-links reveal reveal-d2">
        <a href="https://x.com/NuraExchange" target="_blank" rel="noreferrer">X / Twitter ↗</a>
        <button type="button" onClick={() => openToken(token.ca)}>Refresh</button>
      </div>
    </div>
  )
}
