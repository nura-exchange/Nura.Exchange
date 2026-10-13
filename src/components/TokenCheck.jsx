import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../context/useAppState'
import { fetchTokenCheck, scoreClass } from '../hooks/useQuoro'

const CAP_TEXT = {
  flag: 'a red flag in the launch caps the score at 5',
  dev: 'the creator holds over 10% of supply, which caps the score at 5',
  dev25: 'the creator holds over 25% of supply, which caps the score at 3',
  idle: 'there were no trades for over 24 hours, which caps the score at 4',
  age: 'the token launched under 10 minutes ago, which caps the score at 7',
  partial: 'the chain read was incomplete, which caps the score at 8',
}

const ERRORS = {
  not_found: 'No Robinhood Chain token found at this address.',
  rate_limited: 'Too many checks in a short time. Try again in a minute.',
  failed: 'The check failed. Try again in a moment.',
}

function ago(min) {
  if (min == null) return '—'
  if (min < 1) return 'under a minute ago'
  if (min < 60) return `${min} min ago`
  if (min < 1440) return `${Math.floor(min / 60)} h ago`
  return `${Math.floor(min / 1440)} d ago`
}

function fmtUsd(n) {
  if (n == null) return '—'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function humanize(k) {
  return String(k || '').replace(/_/g, ' ')
}

export default function TokenCheck({ address, onClose }) {
  const { setActiveTab, setSwapPrefill } = useAppState()
  const [state, setState] = useState({ loading: true, data: null, error: null })

  useEffect(() => {
    let alive = true
    fetchTokenCheck(address)
      .then(data => alive && setState({ loading: false, data, error: null }))
      .catch(e => alive && setState({ loading: false, data: null, error: ERRORS[e.message] ? e.message : 'failed' }))
    return () => { alive = false }
  }, [address])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const { loading, data: t, error } = state
  const s = t?.score
  const f = t?.facts
  const appliedCaps = (s?.caps || []).filter(c => c.applied)

  function trade() {
    setSwapPrefill({ to: { ...t, symbol: t.symbol, address: t.ca, decimals: t.decimals ?? 18 } })
    setActiveTab('Swap')
    onClose()
  }

  return createPortal(
    <div className="chart-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="chart-panel tc-panel" role="dialog" aria-modal="true" aria-label="Token check">
        <div className="chart-head">
          <div className="chart-id">
            <div className="chart-name">
              <strong>{t ? t.symbol : 'Checking token…'}</strong> <span className="muted">{t?.name}</span>
            </div>
            <div className="chart-addr mono dim">{address.slice(0, 10)}…{address.slice(-8)}</div>
          </div>
          <button type="button" className="pill pill-ghost xs chart-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading && <p className="tc-note">Reading the token from the chain…</p>}
        {error && <p className="tc-note tc-error" role="alert">{ERRORS[error]}</p>}

        {t && !s && (
          <p className="tc-note">
            {t.kind === 'stock'
              ? 'Stock tokens show facts but get no Data score.'
              : 'This token has no Data score. Only launches that Quoro tracks are scored.'}
          </p>
        )}

        {s && (
          <>
            <div className="tc-score-row">
              <div className={`tc-score ${scoreClass(s.value, s.caps?.some(c => c.applied && c.id === 'flag'))}`}>
                {s.value}<small>/10</small>
              </div>
              <div className="tc-score-text">
                <strong>Data score</strong>
                <span>
                  Launch {s.hygiene}/10 · Market {s.market}/10
                  {appliedCaps.length > 0 && ` · ${appliedCaps.length === 1 ? '1 cap' : `${appliedCaps.length} caps`} applied`}
                </span>
              </div>
            </div>

            {appliedCaps.length > 0 && (
              <ul className="tc-list">
                {appliedCaps.map(c => <li key={c.id}>Score limited: {CAP_TEXT[c.id] || c.id}.</li>)}
              </ul>
            )}

            <h3 className="tc-h">What held it back</h3>
            {s.flags?.length ? (
              <ul className="tc-list">
                {s.flags.map((x, i) => (
                  <li key={i}><span className="mono down">−{x.points}</span> {x.text || humanize(x.k)}</li>
                ))}
              </ul>
            ) : <p className="tc-note">No launch deductions.</p>}

            {s.credits?.length > 0 && (
              <>
                <h3 className="tc-h">In its favour</h3>
                <ul className="tc-list">
                  {s.credits.map((k, i) => <li key={i}><span className="mono up">+</span> {humanize(k)}</li>)}
                </ul>
              </>
            )}
          </>
        )}

        {f && (
          <dl className="tc-facts">
            {[
              ['Buyers', f.buyers ?? '—'],
              ['Sellers', f.sellers ?? '—'],
              ['Creator holds', f.devPct == null ? '—' : `${f.devPct}%`],
              ['Snipers, first blocks', `${f.snipersPct}%`],
              ['Tax-exempt wallets', f.taxExempt],
              ['Creator tax', `${(f.creatorTaxBps || 0) / 100}%`],
              ['Smart wallets', f.smartWallets],
              ['Last trade', ago(f.lastTradeMin)],
              ['Curve filled', t.graduated ? 'Graduated' : `${t.curvePct}%`],
              ['Market cap', fmtUsd(t.mcapUsd)],
            ].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>
            ))}
          </dl>
        )}

        {t && (
          <div className="tc-actions">
            <button type="button" className="pill pill-ghost" onClick={trade}>Trade {t.symbol}</button>
          </div>
        )}

        <p className="tc-legal">
          Data score by Quoro, computed from public on-chain data. It describes the launch and how it trades, not the
          future price. Not financial advice.
        </p>
      </div>
    </div>,
    document.body,
  )
}
