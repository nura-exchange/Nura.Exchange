import { useCallback, useEffect, useState } from 'react'

/** OHLCV candles for a Robinhood Chain token — GET /api/chart (GeckoTerminal). */
export function useCandles(ca, range) {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fetch(`/api/chart?ca=${ca}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        if (!d.ok) setState({ status: 'error' })
        else if (!Array.isArray(d.candles) || !d.candles.length) setState({ status: 'empty', reason: d.reason })
        else setState({ status: 'ready', candles: d.candles, pool: d.pool })
      })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [ca, range, tick])

  const retry = useCallback(() => setTick(t => t + 1), [])
  return { ...state, retry }
}
