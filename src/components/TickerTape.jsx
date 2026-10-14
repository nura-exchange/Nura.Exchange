import { useAppState } from '../context/useAppState'
import { useStocks } from '../hooks/useMarkets'

function price(n) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return n >= 1 ? n.toFixed(2) : n.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

// Endless strip of live stock-token prices. Pauses on hover, static for reduced motion.
export default function TickerTape() {
  const { setActiveTab, setSwapPrefill } = useAppState()
  const { stocks } = useStocks()
  const items = stocks.filter(s => s.priceUsd != null).slice(0, 36)
  if (items.length < 8) return null

  function open(s) {
    setSwapPrefill({ to: { ...s, symbol: s.ticker, address: s.ca, decimals: s.decimals ?? null } })
    setActiveTab('Swap')
  }

  return (
    <div className="tape" role="region" aria-label="Live stock token prices" style={{ '--n': items.length }}>
      <div className="tape-track">
        {[0, 1].map(copy => (
          <ul key={copy} className="tape-list" aria-hidden={copy === 1}>
            {items.map(s => (
              <li key={s.ca || s.ticker}>
                <button type="button" tabIndex={copy === 1 ? -1 : 0} className="tape-item" onClick={() => open(s)}>
                  <strong>{s.ticker}</strong>
                  <span className="mono">${price(s.priceUsd)}</span>
                  {s.change24h != null && (
                    <span className={`mono ${s.change24h > 0 ? 'up' : s.change24h < 0 ? 'down' : ''}`}>
                      {s.change24h > 0 ? '▲' : s.change24h < 0 ? '▼' : ''} {Math.abs(s.change24h).toFixed(2)}%
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
