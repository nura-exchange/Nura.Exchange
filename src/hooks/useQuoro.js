import { useEffect, useState } from 'react'

// Quoro's documented public read API (callable from any site): https://quoro.exchange/docs
const BASE = 'https://quoro.exchange/api'
const ADDR = /^0x[0-9a-fA-F]{40}$/

export const isAddress = s => ADDR.test((s || '').trim())

const tokenCache = new Map() // ca -> { t, value }
export async function fetchTokenCheck(ca) {
  const key = ca.toLowerCase()
  const hit = tokenCache.get(key)
  if (hit && Date.now() - hit.t < 30000) return hit.value
  const r = await fetch(`${BASE}/token/${key}`)
  if (r.status === 404) throw new Error('not_found')
  if (r.status === 429) throw new Error('rate_limited')
  if (!r.ok) throw new Error('failed')
  const value = await r.json()
  tokenCache.set(key, { t: Date.now(), value })
  return value
}

const feedCache = {}
export function useLaunches(sort = 'recent', limit = 12) {
  const [rows, setRows] = useState(feedCache[sort] || [])
  const [loading, setLoading] = useState(!feedCache[sort])
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(`${BASE}/launches?sort=${sort}&limit=${limit}`)
        .then(r => r.json())
        .then(d => {
          if (!alive || !Array.isArray(d?.rows)) return
          feedCache[sort] = d.rows
          setRows(d.rows)
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false))
    load()
    const id = setInterval(load, 60000)
    return () => { alive = false; clearInterval(id) }
  }, [sort, limit])
  return { rows, loading }
}

export function usePulse() {
  const [pulse, setPulse] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(`${BASE}/pulse`)
        .then(r => r.json())
        .then(d => { if (alive && d) setPulse(d) })
        .catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return pulse
}

export function scoreClass(score, flagged) {
  if (flagged) return 'flagged'
  return score >= 7 ? 'good' : score >= 4 ? 'mid' : 'low'
}
