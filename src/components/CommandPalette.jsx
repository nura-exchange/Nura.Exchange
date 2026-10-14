import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppState } from '../context/useAppState'
import { useStocks, useChainTokens } from '../hooks/useMarkets'
import { isAddress } from '../hooks/useQuoro'
import TokenCheck from './TokenCheck'

export function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  )
}

// Global search: press "/" or Ctrl/Cmd+K anywhere. Jumps to pages, opens tokens in Swap, checks pasted addresses.
export default function CommandPalette() {
  const { tabs, setActiveTab, setSwapPrefill } = useAppState()
  const { stocks } = useStocks()
  const { chainTokens } = useChainTokens()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [checking, setChecking] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => { document.body.style.overflow = prev; clearTimeout(t) }
  }, [open])

  const pool = useMemo(() => {
    const seen = new Set(stocks.map(s => (s.ca || '').toLowerCase()))
    return [...stocks, ...chainTokens.filter(t => !seen.has((t.ca || '').toLowerCase()))].map(t => ({
      ...t, sym: t.ticker || t.symbol || '', addr: (t.ca || t.address || '').toLowerCase(),
    }))
  }, [stocks, chainTokens])

  const items = useMemo(() => {
    const term = q.trim().toLowerCase()
    const out = []
    if (isAddress(q)) out.push({ type: 'check', key: 'check', label: 'Check token', hint: `${q.trim().slice(0, 10)}… Data score and flags`, addr: q.trim() })
    const pages = tabs.filter(t => !term || t.toLowerCase().includes(term))
    const toks = (term
      ? pool.map(t => {
          const sym = t.sym.toLowerCase()
          const sc = sym === term ? 0 : sym.startsWith(term) ? 1 : (t.name || '').toLowerCase().includes(term) || sym.includes(term) ? 2 : 9
          return [sc, t]
        }).filter(([sc]) => sc < 9).sort((a, b) => a[0] - b[0]).map(([, t]) => t)
      : pool.slice(0, stocks.length).sort((a, b) => (b.vol24h || 0) - (a.vol24h || 0))
    ).slice(0, 7)
    const addToks = () => toks.slice(0, term ? 7 : 4).forEach(t => out.push({ type: 'token', key: `t-${t.addr || t.sym}`, tok: t, label: t.sym, hint: term ? t.name : `${t.name} · most traded` }))
    const addPages = () => pages.forEach(p => out.push({ type: 'page', key: `p-${p}`, label: p, hint: 'Go to page' }))
    if (term) { addToks(); addPages() } else { addPages(); addToks() }
    return out
  }, [q, pool, stocks.length, tabs])

  function choose(it) {
    if (!it) return
    if (it.type === 'page') setActiveTab(it.label)
    else if (it.type === 'check') { setChecking(it.addr); setOpen(false); return }
    else {
      const t = it.tok
      setSwapPrefill({ to: { ...t, symbol: t.sym, address: t.ca || t.address, decimals: t.decimals ?? null } })
      setActiveTab('Swap')
    }
    setOpen(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]) }
  }

  return (
    <>
      <button type="button" className="nav-search" onClick={() => setOpen(true)} aria-label="Search tokens and pages">
        <SearchIcon />
        <span className="nav-search-label">Search tokens or paste an address</span>
        <kbd className="nav-search-key">/</kbd>
      </button>
      {checking && <TokenCheck address={checking} onClose={() => setChecking(null)} />}
      {open && createPortal(
        <div className="palette-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
            <div className="palette-bar">
              <SearchIcon />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={items[active] ? `pal-${active}` : undefined}
                placeholder="Search tokens, pages, or paste a 0x address"
                value={q}
                onChange={e => { setQ(e.target.value); setActive(0) }}
                onKeyDown={onKeyDown}
                autoComplete="off"
                spellCheck="false"
              />
              <kbd>esc</kbd>
            </div>
            <ul className="palette-list" id="palette-list" role="listbox">
              {items.map((it, i) => (
                <li
                  key={it.key}
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`palette-item ${i === active ? 'active' : ''}`}
                  style={{ '--n': i }}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={e => { e.preventDefault(); choose(it) }}
                >
                  <span className={`palette-ic ${it.type}`}>{it.type === 'token' ? (it.label || '?').slice(0, 2) : it.type === 'check' ? '0x' : '→'}</span>
                  <strong>{it.label}</strong>
                  <span className="palette-hint">{it.hint}</span>
                  <span className="palette-kind">{it.type === 'token' ? 'Token' : it.type === 'check' ? 'Check' : 'Page'}</span>
                </li>
              ))}
              {!items.length && <li className="palette-none">Nothing matches “{q.trim()}”.</li>}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
