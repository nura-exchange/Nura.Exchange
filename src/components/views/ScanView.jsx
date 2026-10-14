import { useState } from 'react'
import { useNuraScan } from '../../hooks/useNuraScan'
import { NuraScanPanel } from '../NuraScan'

const ADDR_RE = /0x[a-fA-F0-9]{40}/i

const EXAMPLES = [
  { label: 'PONS', ca: '0xa9db6d3fb987257767b7227b7df5fad099004571' },
  { label: 'HOUND', ca: '0xa3cc6b9a798573bb622fef64dd6f2bafdcfff71a' },
  { label: 'SWIFT', ca: '0x9c85bf153b0152c6638a9e8688f9aa62c84578f1' },
]

export default function ScanView() {
  const [input, setInput] = useState('')
  const [ca, setCa] = useState(null)
  const scan = useNuraScan(ca)
  const scanning = scan.status === 'starting' || scan.status === 'crawling'

  const submit = (raw, e) => {
    e?.preventDefault?.()
    const m = String(raw ?? input).match(ADDR_RE)
    if (!m) return
    setInput(m[0])
    setCa(m[0].toLowerCase())
  }

  const valid = ADDR_RE.test(input.trim())

  return (
    <div className="view container scan-view">
      <div className="scan-hero">
        <div className="scan-eyebrow"><span className="scan-eyebrow-dot" />On-chain security scanner</div>
        <h1 className="section-heading scan-title">NuraScan</h1>
        <p className="section-note scan-note">
          Paste any Robinhood Chain contract address to score top-holder concentration,
          the largest wallet and rug risk in seconds.
        </p>
      </div>

      <form className={`scan-bar ${scanning ? 'is-scanning' : ''}`} onSubmit={submit}>
        <div className="scan-input-wrap">
          <span className="scan-beam" aria-hidden="true" />
          <span className="scan-input-icon" aria-hidden="true">⌖</span>
          <input
            className="scan-input mono"
            placeholder="0x… paste a contract address"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            inputMode="text"
            aria-label="Contract address"
          />
        </div>
        <button type="submit" className="pill pill-primary scan-btn" disabled={!valid}>
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </form>

      <div className="scan-examples">
        <span className="dim">Try:</span>
        {EXAMPLES.map((x) => (
          <button key={x.ca} type="button" className="pill pill-ghost xs scan-example" onClick={() => submit(x.ca)}>
            {x.label}
          </button>
        ))}
      </div>

      {ca ? (
        <div className="scan-result" key={ca}>
          <div className="scan-result-addr mono dim">{ca.slice(0, 6)}…{ca.slice(-4)}</div>
          <NuraScanPanel ca={ca} {...scan} />
        </div>
      ) : (
        <div className="scan-idle">
          <div className="scan-radar" aria-hidden="true">
            <span className="scan-ring" />
            <span className="scan-ring" />
            <span className="scan-ring" />
            <span className="scan-sweep" />
            <span className="scan-core" />
          </div>
          <div className="scan-idle-text dim">Awaiting a contract — paste an address to begin</div>
        </div>
      )}
    </div>
  )
}
