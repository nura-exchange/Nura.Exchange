import { useState, useRef, useEffect } from 'react'

const iconUrl = (id) => `https://icons.llamao.fi/icons/chains/${id}.jpg`

export function ChainIcon({ id, name, size = 20 }) {
  const [err, setErr] = useState(false)
  const letter = (name || '?').trim().slice(0, 1).toUpperCase()
  if (err) {
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
    <img
      className="chain-ico"
      src={iconUrl(id)}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={() => setErr(true)}
    />
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
        <ChainIcon id={sel.chain.id} name={sel.name} size={20} />
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
                <ChainIcon id={c.chain.id} name={c.name} size={20} />
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
