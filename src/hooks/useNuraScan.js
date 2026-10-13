import { useEffect, useState, useCallback } from 'react'

const POLL_MS = 1500
const DEADLINE_MS = 75000

// Starts a NuraScan (CrawlScan engine) for `ca` and polls until the verdict
// is ready. Returns { status, result, message, retry }.
// status: idle | starting | crawling | done | error
export function useNuraScan(ca) {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ status: ca ? 'starting' : 'idle' })

  useEffect(() => {
    if (!ca) { setState({ status: 'idle' }); return }
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
          if (Date.now() > deadline) { setState({ status: 'error', message: 'The scan took too long.' }); return }
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

  const retry = useCallback(() => setTick(t => t + 1), [])
  return { ...state, retry }
}
