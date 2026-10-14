import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../context/useAppState'
import { useStocks, useChainTokens } from '../hooks/useMarkets'
import { isAddress } from '../hooks/useQuoro'
import TokenCheck from './TokenCheck'

const EXAMPLES = ['NVDA', 'TSLA', 'SPY', 'AAPL']

export default function HeroSearch() {
  const { setActiveTab, setSwapPrefill } = useAppState()
  const { stocks } = useStocks()
  const { chainTokens } = useChainTokens()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [checking, setChecking] = useState(null)
  const boxRef = useRef(null)

  const pool = useMemo(() => {
    const seen = new Set(stocks.map(s => (s.ca || '').toLowerCase()))
    const extra = chainTokens.filter(t => !seen.has((t.ca || '').toLowerCase()))
    return [...stocks, ...extra].map(t => ({
      ...t,
      sym: t.ticker || t.symbol || '',
      addr: (t.ca || t.address || '').toLowerCase(),
    }))
  }, [stocks, chainTokens])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const score = t => {
      const sym = t.sym.toLowerCase()
      if (sym === term || t.addr === term) return 0
      if (sym.startsWith(term)) return 1
      if ((t.name || '').toLowerCase().includes(term) || sym.includes(term)) return 2
      return 9
    }
    return pool
      .map(t => [score(t), t])
      .filter(([sc]) => sc < 9)
      .sort((a, b) => a[0] - b[0])
      .slice(0, 6)
      .map(([, t]) => t)
  }, [q, pool])

  useEffect(() => {
    const onDown = e => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pick(tok) {
    // stock tokens carry no decimals field — they're 18 on Robinhood Chain
    const decimals = tok.decimals ?? (tok.ticker && tok.ca ? 18 : null)
    setSwapPrefill({
      to: { ...tok, symbol: tok.sym, address: tok.ca || tok.address, decimals },
    })
    setActiveTab('Swap')
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && isAddr && !results[active]) { e.preventDefault(); check() }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const isAddr = isAddress(q)
  function check() { setChecking(q.trim()); setOpen(false) }

  const examples = EXAMPLES.filter(t => stocks.some(s => s.ticker === t))
  const showList = open && q.trim() && results.length > 0
  const showEmpty = open && q.trim() && results.length === 0 && !isAddr
  const showCheck = open && isAddr

  return (
    <div className="hero-search" ref={boxRef}>
      {checking && <TokenCheck address={checking} onClose={() => setChecking(null)} />}
      <div className="hs-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="hs-input"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls="hs-list"
          aria-activedescendant={showList ? `hs-opt-${active}` : undefined}
          aria-label="Search a token by name, ticker or contract address"
          placeholder="Search a token or paste address"
          autoComplete="off"
          spellCheck="false"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {showList && (
        <ul className="hs-list" id="hs-list" role="listbox">
          {results.map((t, i) => (
            <li
              key={t.addr || t.sym}
              id={`hs-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`hs-opt ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={e => { e.preventDefault(); pick(t) }}
            >
              <span className="tok-logo tok-logo-fallback">{t.sym.slice(0, 2)}</span>
              <strong>{t.sym}</strong>
              <span className="hs-name">{t.name}</span>
              <span className="hs-go">Trade →</span>
            </li>
          ))}
        </ul>
      )}
      {showCheck && (
        <ul className="hs-list" role="listbox">
          <li role="option" aria-selected="true" className="hs-opt active" onMouseDown={e => { e.preventDefault(); check() }}>
            <span className="tok-logo tok-logo-fallback">0x</span>
            <strong>Check token</strong>
            <span className="hs-name">Data score and flags before you buy</span>
            <span className="hs-go" style={{ opacity: 1 }}>Check →</span>
          </li>
        </ul>
      )}
      {showEmpty && <div className="hs-list hs-empty">No market matches “{q.trim()}”.</div>}

      {examples.length > 0 && (
        <div className="hs-try">
          <span>Try</span>
          {examples.map(t => (
            <button key={t} type="button" className="hs-chip" onClick={() => { setQ(t); setOpen(true); setActive(0) }}>{t}</button>
          ))}
        </div>
      )}
    </div>
  )
}
