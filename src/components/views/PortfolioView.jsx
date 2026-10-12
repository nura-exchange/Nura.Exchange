import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNativeBalance, useTokenBalance } from '../../hooks/useTokenBalance'
import { useStocks, useEthPrice } from '../../hooks/useMarkets'
import { USDG_ADDRESS, addressUrl } from '../../config'
import { formatUnits } from 'viem'

function fmt(n, d = 6) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(Math.min(d, 4))
  return n.toFixed(6)
}

export default function PortfolioView() {
  const { address, isConnected } = useAccount()
  const native = useNativeBalance()
  const usdg = useTokenBalance(USDG_ADDRESS, 6)
  const { stocks } = useStocks()
  const ethPrice = useEthPrice()
  const [tokens, setTokens] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) { setTokens(null); return }
    let alive = true
    setLoading(true)
    fetch('/api/balances', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    })
      .then(r => r.json())
      .then(d => { if (alive) setTokens(d.tokens || []) })
      .catch(() => { if (alive) setTokens([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [address])

  useEffect(() => {
    const h = () => {
      if (!address) return
      fetch('/api/balances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address }),
      }).then(r => r.json()).then(d => setTokens(d.tokens || [])).catch(() => {})
    }
    window.addEventListener('nura:refresh', h)
    return () => window.removeEventListener('nura:refresh', h)
  }, [address])

  if (!isConnected) {
    return (
      <div className="container view">
        <div className="view-head">
          <h1 className="section-heading">Portfolio</h1>
          <p className="section-note">Connect your wallet to see your holdings on Robinhood Chain.</p>
        </div>
      </div>
    )
  }

  const stockByAddr = Object.fromEntries(stocks.map(s => [(s.ca || '').toLowerCase(), s]))
  const usdValue = (sym, raw, dec, priceHint) => {
    const v = parseFloat(formatUnits(BigInt(raw), dec)) || 0
    if (priceHint != null) return v * priceHint
    if (sym === 'ETH' && ethPrice) return v * ethPrice
    if (sym === 'USDG') return v
    const st = stocks.find(s => s.ticker === sym)
    if (st?.priceUsd) return v * st.priceUsd
    return null
  }

  const rows = []
  rows.push({
    symbol: 'ETH', name: 'Ether', raw: native.value.toString(), decimals: 18,
    logo: null, usd: ethPrice ? native.balance * ethPrice : null,
  })
  rows.push({
    symbol: 'USDG', name: 'Global Dollar', raw: usdg.value.toString(), decimals: 6,
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/33793.png', usd: usdg.balance,
  })
  const seen = new Set(['eth', USDG_ADDRESS.toLowerCase()])
  for (const t of tokens || []) {
    const key = t.address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const st = stockByAddr[key]
    rows.push({
      symbol: t.symbol,
      name: t.name,
      raw: t.raw,
      decimals: t.decimals,
      logo: t.logo || st?.logo || null,
      usd: usdValue(t.symbol, t.raw, t.decimals, st?.priceUsd ?? null),
      address: t.address,
    })
  }

  const total = rows.reduce((s, r) => s + (r.usd || 0), 0)

  return (
    <div className="container view">
      <div className="view-head reveal">
        <h1 className="section-heading">Portfolio</h1>
        <p className="section-note">
          Holdings on Robinhood Chain · {address && <a className="inline-link" href={addressUrl(address)} target="_blank" rel="noreferrer">{address.slice(0, 6)}…{address.slice(-4)} ↗</a>}
        </p>
      </div>

      <div className="portfolio-total reveal reveal-d1">
        <span className="label">Total value</span>
        <span className="display-sm">${fmt(total, 2)}</span>
      </div>

      <div className="table-wrap reveal reveal-d2">
        <table className="editorial-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="num">Amount</th>
              <th className="num hide-sm">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const amt = parseFloat(formatUnits(BigInt(r.raw || '0'), r.decimals)) || 0
              if (amt === 0) return null
              return (
                <tr key={r.symbol + (r.address || '')}>
                  <td>
                    <span className="ticker-cell">
                      {r.logo
                        ? <img src={r.logo} alt="" className="tok-logo" loading="lazy" />
                        : <span className="tok-logo tok-logo-fallback">{r.symbol.slice(0, 2)}</span>}
                      <strong>{r.symbol}</strong>
                      <span className="muted hide-sm"> {r.name}</span>
                    </span>
                  </td>
                  <td className="num mono">{fmt(amt, 6)}</td>
                  <td className="num mono hide-sm">{r.usd != null ? `$${fmt(r.usd, 2)}` : '—'}</td>
                </tr>
              )
            })}
            {loading && <tr><td colSpan={3} className="empty-cell">Loading balances…</td></tr>}
            {!loading && rows.every(r => {
              const amt = parseFloat(formatUnits(BigInt(r.raw || '0'), r.decimals)) || 0
              return amt === 0
            }) && <tr><td colSpan={3} className="empty-cell">No holdings yet — bridge funds in, then swap.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
