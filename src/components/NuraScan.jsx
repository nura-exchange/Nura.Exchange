import { useEffect, useState } from 'react'
import { addressUrl } from '../config'

const POLL_MS = 1500
const DEADLINE_MS = 75000

const BAND_LABEL = {
  CLEAN: 'Clean',
  OK: 'OK',
  RISKY: 'Risky',
  DANGER: 'Danger',
  TOO_EARLY_OR_LATE: 'Too early',
  TOO_ESTABLISHED: 'Too established',
  TOO_ACTIVE: 'Too active',
}
const BAND_CLS = {
  CLEAN: 'clean', OK: 'ok', RISKY: 'risky', DANGER: 'danger',
}

const RUG_KIND = { linked: 'linked wallets', transfer: 'received by transfer', virgin: 'fresh wallets', bundle: 'bundle / snipers' }

function short(a) {
  return typeof a === 'string' && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a || '')
}
function impactPhrase(impact) {
  if (impact == null) return '—'
  return impact < 0.01 ? '<1%' : `−${Math.round(impact * 100)}%`
}
function p1(x) { return x == null ? '—' : (x * 100).toFixed(1) }
function p0(x) { return x == null ? '—' : Math.round(x * 100) }

export default function NuraScan({ ca }) {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ status: 'starting' })

  useEffect(() => {
    let alive = true
    let timer
    setState({ status: 'starting' })
    ;(async () => {
      try {
        const start = await fetch(`/api/nurascan?ca=${encodeURIComponent(ca)}`).then(r => r.json())
        if (!alive) return
        if (start.error) { setState({ status: 'error', message: start.message || start.error }); return }
        const job = start.job
        const deadline = Date.now() + DEADLINE_MS
        const poll = async () => {
          if (!alive) return
          if (Date.now() > deadline) { setState({ status: 'error', message: 'The scan took too long. Try again.' }); return }
          const r = await fetch(`/api/nurascan?job=${encodeURIComponent(job)}`).then(x => x.json()).catch(() => ({ error: 'unreachable' }))
          if (!alive) return
          if (r.error && !r.done) { setState({ status: 'error', message: r.message || r.error }); return }
          if (r.done) {
            if (r.error || !r.result) { setState({ status: 'error', message: r.error || 'Scan failed.' }); return }
            setState({ status: 'done', result: r.result })
            return
          }
          setState({ status: 'crawling' })
          timer = setTimeout(poll, POLL_MS)
        }
        poll()
      } catch {
        if (alive) setState({ status: 'error', message: 'Scanner unreachable.' })
      }
    })()
    return () => { alive = false; clearTimeout(timer) }
  }, [ca, tick])

  const retry = () => setTick(t => t + 1)

  if (state.status === 'starting' || state.status === 'crawling') {
    return (
      <div className="nura">
        <div className="nura-head"><span className="nura-brand">NuraScan</span></div>
        <div className="nura-crawling"><span className="nura-spider" />Crawling top holders onchain…</div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="nura">
        <div className="nura-head"><span className="nura-brand">NuraScan</span></div>
        <div className="nura-error">
          {state.message}
          <button type="button" className="pill pill-ghost xs" onClick={retry}>Retry</button>
        </div>
      </div>
    )
  }

  const r = state.result
  const band = r.band
  const h = r.header || {}
  const m = r.metrics || {}
  const ops = r.operators || []
  const holders = r.holders || []
  const score = r.score

  const special = band === 'TOO_EARLY_OR_LATE' || band === 'TOO_ESTABLISHED' || band === 'TOO_ACTIVE'
  const cls = BAND_CLS[band] || 'neutral'

  return (
    <div className="nura">
      <div className="nura-head">
        <span className="nura-brand">NuraScan</span>
        <a className="nura-report" href={`https://crawlscan.fun/?ca=${r.token || ca}`} target="_blank" rel="noreferrer">Full report ↗</a>
      </div>

      {(h.ticker || h.name) && (
        <div className="nura-title">${h.ticker || h.name}{h.name && h.name !== h.ticker ? ` · ${h.name}` : ''}</div>
      )}

      {special ? (
        <div className="nura-special">
          <div className={`nura-band ${cls}`}>{BAND_LABEL[band] || band}</div>
          <p className="nura-note">{r.headline || r.reason || (band === 'TOO_EARLY_OR_LATE' ? `Only ${r.holders_total || 0} holders, too few to judge.` : '')}</p>
          {r.reason && r.headline && <p className="nura-note dim">{r.reason}</p>}
        </div>
      ) : (
        <>
          <div className="nura-scoreline">
            <div className={`nura-score ${cls}`}>{score != null ? score : '—'}<span>/100</span></div>
            <div className={`nura-band ${cls}`}>{BAND_LABEL[band] || band}</div>
          </div>

          <div className="nura-line">{(holders.length || r.holders_total || 0)} top holders → {ops.length} operator{ops.length === 1 ? '' : 's'}</div>

          {ops.length > 0 && (
            <div className="nura-line">
              {(() => {
                const n = (ops[0].wallets || []).length
                const who = n > 1 ? `Biggest operator (${n} wallets)` : 'Biggest operator'
                return m.impact == null
                  ? `${who} holds ${p1(m.operator)}% of float · liquidity not measured`
                  : `${who} could move price ${impactPhrase(m.impact)} if sold`
              })()}
            </div>
          )}

          {r.rug && (
            <div className="nura-rug">
              <div className="nura-rug-head">⚠ Probably rug: −{Math.round((r.rug.drop || 0) * 100)}% if suspicious holders sell</div>
              {(r.rug.parts || []).slice(0, 3).map((p, i) => (
                <div key={i} className="nura-rug-part">
                  {RUG_KIND[p.kind] || p.kind}: {p.wallets?.length || 0} wallet{(p.wallets?.length || 0) === 1 ? '' : 's'}, {p1(p.share)}% of float
                </div>
              ))}
            </div>
          )}

          <div className="nura-signals">
            {m.virgin > 0 && <span className="nura-chip">{p0(m.virgin)}% virgin wallets</span>}
            {m.transfer > 0 && <span className="nura-chip">{p1(m.transfer)}% received by transfer</span>}
            {m.sniper > 0 && <span className="nura-chip">snipers hold {p1(m.sniper)}%</span>}
          </div>

          {holders.length > 0 && (
            <div className="nura-holders">
              {holders.slice(0, 8).map((hd) => {
                const inOp = ops.some(o => (o.wallets || []).includes(hd.wallet))
                const flags = []
                if (inOp) flags.push('operator')
                if ((hd.signals || {}).virgin) flags.push('virgin')
                if (hd.is_deployer || hd.deployer) flags.push('dev')
                return (
                  <div key={hd.wallet} className="nura-holder">
                    <a className="nura-holder-addr mono" href={addressUrl(hd.wallet)} target="_blank" rel="noreferrer">{short(hd.wallet)} ↗</a>
                    <span className="nura-holder-share mono">{p1((hd.share != null ? hd.share : hd.share_supply) || 0)}%</span>
                    {flags.length > 0 && <span className="nura-holder-flags">{flags.join(' · ')}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {Array.isArray(r.gates) && r.gates.length > 0 && (
            <div className="nura-why">
              <div className="nura-why-title">Why</div>
              {r.gates.map((g, i) => (
                <div key={i} className="nura-why-line">{String(g).replace(/^soft:\s*/, '')}</div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="nura-source dim">Powered by CrawlScan engine · read-only · updated live</div>
    </div>
  )
}
