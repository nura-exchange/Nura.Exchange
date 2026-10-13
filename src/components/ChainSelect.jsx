import { useState, useRef, useEffect } from 'react'
import ethereum from '../assets/chains/ethereum.svg'
import base from '../assets/chains/base.svg'
import arbitrum from '../assets/chains/arbitrum.svg'
import optimism from '../assets/chains/optimism.svg'
import bnb from '../assets/chains/bnb.svg'
import polygon from '../assets/chains/polygon.svg'
import unichain from '../assets/chains/unichain.svg'
import linea from '../assets/chains/linea.svg'
import zksync from '../assets/chains/zksync.svg'
import scroll from '../assets/chains/scroll.svg'
import blast from '../assets/chains/blast.svg'
import ink from '../assets/chains/ink.svg'
import worldchain from '../assets/chains/worldchain.svg'
import soneium from '../assets/chains/soneium.svg'
import abstract from '../assets/chains/abstract.svg'
import mode from '../assets/chains/mode.svg'

const ICONS = {
  ethereum, base, arbitrum, optimism, bnb, polygon, unichain, linea,
  zksync, scroll, blast, ink, worldchain, soneium, abstract, mode,
}

export function ChainIcon({ slug, name, size = 20 }) {
  const [err, setErr] = useState(false)
  const src = ICONS[slug]
  if (!src || err) {
    const letter = (name || '?').trim().slice(0, 1).toUpperCase()
    return (
      <span
        className="chain-ico chain-ico-fb"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      >
        {letter}
      </span>
    )
  }
  return (
    <img className="chain-ico" src={src} width={size} height={size} alt="" loading="lazy" onError={() => setErr(true)} />
  )
}

export default function ChainSelect({ chains, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = chains.find(c => c.key === value) || chains[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="chain-select" ref={ref}>
      <button
        type="button"
        className="chain-select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <ChainIcon slug={sel.key} name={sel.name} size={20} />
        <span className="chain-select-name">{sel.name}</span>
        <span className="chain-select-native">{sel.native}</span>
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="picker-menu chain-menu" role="listbox">
          <div className="picker-list">
            {chains.map(c => (
              <button
                key={c.key}
                type="button"
                role="option"
                aria-selected={c.key === value}
                className={`picker-item ${c.key === value ? 'active' : ''}`}
                onClick={() => { onChange(c.key); setOpen(false) }}
              >
                <ChainIcon slug={c.key} name={c.name} size={20} />
                <span className="picker-name">{c.name}</span>
                <span className="picker-price">{c.native}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
