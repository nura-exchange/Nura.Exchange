import { useEffect, useState, useCallback } from 'react'

const POLL_MS = 1500
const DEADLINE_MS = 75000

// CrawlScan only scores tokens from known launchpads (Pons V2 / Flap / Bankr).
// When it declines a token it says so deterministically — that's not a retryable
// error, so we fall back to our own on-chain analyzer (/api/analyze).
const isUnsupported = (msg) =>
  typeof msg === 'string' &&
  (/not a\s+\S+.*token/i.test(msg) || /unsupported|not recognized|unknown (launchpad|factory)/i.test(msg))

// Shape our analyzer's output like a CrawlScan result so the existing panel
// (band / score / holders / operators / rug / gates) renders unchanged.
function mapAnalyze(a, ca, symbol, name) {
  const largest = a.largest || null
  const reasons = Array.isArray(a.reasons) ? a.reasons : []
  // Rug only when the biggest holder is a single EOA whale (a contract is
  // usually a launchpad / locker, not a dump risk).
  const whale = largest && !a.largestIsContract && (a.largestShare || 0) >= 0.15
  return {
    token: ca,
    band: a.band,
    score: a.score,
    header: symbol || name ? { ticker: symbol, name: name || symbol } : {},
    holders_total: a.holders || 0,
    holders: (a.top || []).map(t => ({ wallet: t.wallet, share: t.share })),
    operators: largest ? [{ wallets: [largest] }] : [],
    metrics: { operator: a.largestShare || 0, impact: null, virgin: 0, transfer: 0, sniper: 0 },
    rug: whale ? { drop: a.largestShare, parts: [{ kind: 'whale', wallets: [largest], share: a.largestShare }] } : null,
    gates: reasons,
    headline: a.headline,
    reason: reasons[0],
    source: 'nura',
  }
}

// Starts a NuraScan for `ca` and polls until the verdict is ready. If CrawlScan
// doesn't cover the token we run our own analyzer as a fallback. Bumping `nonce`
// forces a fresh scan of the same address. Returns { status, result, message, retry }.
// status: idle | starting | crawling | done | unsupported | error
export function useNuraScan(ca, token, nonce = 0) {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ status: ca ? 'starting' : 'idle' })
  const symbol = token?.symbol || token?.ticker || null
  const name = token?.name || null

  useEffect(() => {
    if (!ca) { setState({ status: 'idle' }); return }
    let alive = true
    let timer
    setState({ status: 'starting' })
    ;(async () => {
      const fallback = async () => {
        try {
          const a = await fetch(`/api/analyze?ca=${encodeURIComponent(ca)}`).then(r => r.json())
          if (!alive) return
          if (a && !a.error) { setState({ status: 'done', result: mapAnalyze(a, ca, symbol, name) }); return }
          const msg = (a && a.error) || 'No automated scan for this token.'
          // Transient RPC failures are retryable; permanent ones (non-ERC20) aren't.
          if (/rate limit|try again|unreachable|http \d/i.test(msg)) setState({ status: 'error', message: msg })
          else setState({ status: 'unsupported', message: msg })
        } catch {
          if (alive) setState({ status: 'unsupported', message: 'No automated scan for this token.' })
        }
      }
      try {
        const start = await fetch(`/api/nurascan?ca=${encodeURIComponent(ca)}`).then(r => r.json())
        if (!alive) return
        if (start.error) {
          if (isUnsupported(start.message || start.error)) return fallback()
          setState({ status: 'error', message: start.message || start.error }); return
        }
        const job = start.job
        const deadline = Date.now() + DEADLINE_MS
        const poll = async () => {
          if (!alive) return
          if (Date.now() > deadline) { setState({ status: 'error', message: 'The scan took too long.' }); return }
          const r = await fetch(`/api/nurascan?job=${encodeURIComponent(job)}`).then(x => x.json()).catch(() => ({ error: 'unreachable' }))
          if (!alive) return
          if (r.error && !r.done) {
            if (isUnsupported(r.error)) return fallback()
            setState({ status: 'error', message: r.message || r.error }); return
          }
          if (r.done) {
            if (r.error || !r.result) {
              const msg = r.error || 'Scan failed.'
              if (isUnsupported(msg)) return fallback()
              setState({ status: 'error', message: msg }); return
            }
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
  }, [ca, symbol, name, nonce, tick])

  const retry = useCallback(() => setTick(t => t + 1), [])
  return { ...state, retry }
}
