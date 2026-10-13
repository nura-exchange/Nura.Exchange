import { useAppState } from '../context/useAppState'

const CHECK = (
  <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export function VerifiedBadge({ token }) {
  if (!token || token.flagged || token.score == null || token.score < 7) return null
  return (
    <span className="verified-badge" title={`Verified · Quoro score ${token.score}/10`} aria-label="Verified">
      {CHECK}
    </span>
  )
}

export function StarButton({ ca, className = '' }) {
  const { isFavorite, toggleFavorite } = useAppState()
  if (!ca) return null
  const active = isFavorite(ca)
  return (
    <button
      type="button"
      className={`star-btn ${active ? 'active' : ''} ${className}`.trim()}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); toggleFavorite(ca) }}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
      </svg>
    </button>
  )
}

// Logo with an overlaid chain sticker (bottom-right) + optional verified shield.
export function TokenLogo({ token, symbol, showChain = true }) {
  const name = symbol || token?.symbol || token?.ticker || '?'
  const src = token?.logo
  return (
    <span className="tok-wrap">
      {src
        ? <img src={src} alt="" className="tok-logo" loading="lazy" />
        : <span className="tok-logo tok-logo-fallback">{name.slice(0, 2)}</span>}
      {showChain && (
        <span className="chain-badge" title="Robinhood Chain · 4663" aria-label="Robinhood Chain">
          <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" aria-hidden="true">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
          </svg>
        </span>
      )}
    </span>
  )
}
