import { useNuraScan } from '../hooks/useNuraScan'
import { addressUrl } from '../config'

const BAND_LABEL = {
  CLEAN: 'Clean',
  OK: 'OK',
  RISKY: 'Risky',
  DANGER: 'Danger',
  TOO_EARLY_OR_LATE: 'Too early',
  TOO_ESTABLISHED: 'Too established',
  TOO_ACTIVE: 'Too active',
}
const BAND_CLS = { CLEAN: 'clean', OK: 'ok', RISKY: 'risky', DANGER: 'danger' }
const RUG_KIND = { linked: 'linked wallets', transfer: 'received by transfer', virgin: 'fresh wallets', bundle: 'bundle / snipers', whale: 'whale', deployer: 'deployer' }

const short = (a) => (typeof a === 'string' && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a || ''))
const impactPhrase = (impact) => (impact == null ? null : impact < 0.01 ? '<1%' : `−${Math.round(impact * 100)}%`)
const p1 = (x) => (x == null ? '—' : (x * 100).toFixed(1))
const p0 = (x) => (x == null ? '—' : Math.round(x * 100))

function Strip({ ca, token, onDetails }) {
  const { status, result, message, retry } = useNuraScan(ca, token)

  if (status === 'unsupported') {
    return (
      <div className="nura-strip nura-strip--note">
        <span>NuraScan: no automated scan for this token (not from a supported launchpad)</span>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="nura-strip nura-strip--error">
        <span>NuraScan: {message}</span>
        <button type="button" className="pill pill-ghost xs" onClick={retry}>Retry</button>
      </div>
    )
  }
  if (status !== 'done') {
    return (
      <div className="nura-strip">
        <span className="nura-spider" />
        <span className="nura-strip-label">NuraScan</span>
        <span className="dim">Crawling top holders…</span>
      </div>
    )
  }

  const band = result.band
  const cls = BAND_CLS[band] || 'neutral'
  const m = result.metrics || {}
  const ops = (result.operators || []).length
  const impact = impactPhrase(m.impact)
  const special = band === 'TOO_EARLY_OR_LATE' || band === 'TOO_ESTABLISHED' || band === 'TOO_ACTIVE'

  return (
    <div className="nura-strip">
      <span className="nura-strip-label">NuraScan</span>
      <span className={`nura-band ${cls}`}>{BAND_LABEL[band] || band}</span>
      {result.score != null && <span className="nura-strip-score mono">{result.score}/100</span>}
      {!special && (
        <>
          <span className="nura-strip-sep">·</span>
          <span className="dim">{(result.holders_total || 0)} holders → {ops} op{ops === 1 ? '' : 's'}</span>
          {impact && <><span className="nura-strip-sep">·</span><span className="dim">top op {impact}</span></>}
          {result.rug && <span className="nura-strip-rug">⚠ rug −{Math.round((result.rug.drop || 0) * 100)}%</span>}
        </>
      )}
      {onDetails && <button type="button" className="pill pill-ghost xs nura-strip-cta" onClick={onDetails}>Details</button>}
    </div>
  )
}

export default function NuraScan({ ca, token, compact, onDetails }) {
  if (compact) return <Strip ca={ca} token={token} onDetails={onDetails} />
  return <Full ca={ca} token={token} />
}

function Full({ ca, token }) {
  const scan = useNuraScan(ca, token)
  return <NuraScanPanel ca={ca} {...scan} />
}

// Presentational panel: renders a scan purely from state it is given, so a
// parent (e.g. the standalone Scan view) can drive the hook and reuse this UI.
export function NuraScanPanel({ ca, status, result, message, retry }) {
  // Any non-final state (idle / starting / crawling — and a 'done' that somehow
  // arrived without a payload) renders the in-progress view, never the result.
  if (status !== 'done' || !result) {
    if (status === 'unsupported') {
      return (
        <div className="nura">
          <div className="nura-head"><span className="nura-brand">NuraScan</span></div>
          <div className="nura-unsupported">
            <div className="nura-unsupported-title">Scan unavailable for this token</div>
            <p className="nura-note">{message}</p>
            <p className="nura-note dim">CrawlScan only covers Pons V2, Flap or Bankr launchpads, and our on-chain pass couldn’t read this contract (non-standard token or RPC unavailable).</p>
          </div>
        </div>
      )
    }
    if (status === 'error') {
      return (
        <div className="nura">
          <div className="nura-head"><span className="nura-brand">NuraScan</span></div>
          <div className="nura-error">{message}<button type="button" className="pill pill-ghost xs" onClick={retry}>Retry</button></div>
        </div>
      )
    }
    return (
      <div className="nura">
        <div className="nura-head"><span className="nura-brand">NuraScan</span></div>
        <div className="nura-crawling"><span className="nura-spider" />Crawling top holders onchain…</div>
      </div>
    )
  }

  const r = result
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
        {r.source !== 'nura' && (
          <a className="nura-report" href={`https://crawlscan.fun/?ca=${r.token || ca}`} target="_blank" rel="noreferrer">Full report ↗</a>
        )}
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

      <div className="nura-source dim">
        {r.source === 'nura'
          ? 'Nura on-chain analysis · read-only · updated live'
          : 'Powered by CrawlScan engine · read-only · updated live'}
      </div>
    </div>
  )
}
