import { useAppState } from '../context/useAppState'
import { useChainTokens } from '../hooks/useMarkets'

const NURA_CA = '0x11a2809ebf14653760c7b1136acdee7cf5c5a9c9'

function fmtPrice(n) {
  if (n == null) return '—'
  if (n >= 1) return n.toFixed(2)
  return n.toLocaleString('en-US', { maximumSignificantDigits: 3 })
}

// Featured card for our own NURA launch — always at the top of Markets.
export default function NuraBanner() {
  const { openToken, setActiveTab, setSwapPrefill } = useAppState()
  const { chainTokens } = useChainTokens()
  const nura = chainTokens.find(t => (t.ca || '').toLowerCase() === NURA_CA)

  function trade(e) {
    e.stopPropagation()
    setSwapPrefill({
      to: {
        ...nura,
        ca: NURA_CA,
        symbol: nura?.symbol || 'NURA',
        name: nura?.name || 'NURADEX',
        address: NURA_CA,
        decimals: nura?.decimals ?? 18,
        logo: nura?.logo || null,
        priceUsd: nura?.priceUsd ?? null,
      },
    })
    setActiveTab('Swap')
  }

  return (
    <div className="nura-banner reveal" role="region" aria-label="NURA token">
      <button type="button" className="nura-banner-main" onClick={() => openToken(NURA_CA)}>
        {nura?.logo
          ? <img src={nura.logo} alt="" className="tok-logo nura-banner-logo" loading="lazy" />
          : <span className="tok-logo tok-logo-fallback nura-banner-logo">NU</span>}
        <span className="nura-banner-id">
          <strong>NURADEX</strong>
          <span className="dim">NURA · our token on Robinhood Chain</span>
        </span>
        <span className="nura-banner-price mono">
          {nura?.priceUsd != null ? `$${fmtPrice(nura.priceUsd)}` : '—'}
        </span>
        <span className="nura-banner-addr mono dim">{NURA_CA.slice(0, 6)}…{NURA_CA.slice(-4)}</span>
      </button>
      <div className="nura-banner-actions">
        <button type="button" className="pill pill-primary" onClick={trade}>Trade</button>
        <a className="pill pill-ghost" href={`https://ponsfamily.com/launchpad/${NURA_CA}`} target="_blank" rel="noreferrer">
          Launchpad ↗
        </a>
      </div>
    </div>
  )
}
