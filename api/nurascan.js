// NuraScan — our-branded token scanner powered by the CrawlScan engine (MIT).
// We do not re-implement their crawler; this serverless proxies their public
// read-only API so the browser never talks to a third party directly (no CORS)
// and the panel can be branded NuraScan in our own palette.
//
//   GET /api/nurascan?ca=0x...   -> starts a scan, returns { job }
//   GET /api/nurascan?job=ID     -> { done } | { done, result } | { error }
//
// CrawlScan caches each token's result for 10 minutes, so repeat views are
// cheap and do not consume the per-IP "new scan" rate budget.

const BASE = 'https://crawlscan.fun'
const UA = 'nurascan/1.0 (+https://arcfx-app.vercel.app)'

const BUSY = { error: 'busy', message: 'Scanner is busy, try again in a few seconds.' }
const RATE = { error: 'rate_limited', message: 'Too many scans right now, try again in a minute.' }

async function cs(path, opts) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      'user-agent': UA,
      ...(opts && opts.headers ? opts.headers : {}),
    },
  })
  let data = null
  try { data = await r.json() } catch { /* non-json */ }
  if (r.status === 503) return { __busy: true, data }
  if (r.status === 429) return { __rate: true, data }
  return { __status: r.status, data }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const job = String(req.query.job || '').trim()
  const ca = String(req.query.ca || '').trim()

  // continue polling an existing job
  if (job) {
    try {
      const { __status, __busy, __rate, data } = await cs(`/api/result?job=${encodeURIComponent(job)}`)
      if (__busy) return res.status(200).json(BUSY)
      if (__rate) return res.status(200).json(RATE)
      if (__status !== 200 || !data) return res.status(200).json({ error: 'unreachable' })
      // pass through crawlscan's payload; the client reads `done` / `result` / `error`
      return res.status(200).json(data)
    } catch {
      return res.status(200).json({ error: 'unreachable' })
    }
  }

  // start a new scan
  if (!ca) return res.status(400).json({ error: 'need ca or job' })
  try {
    const { __status, __busy, __rate, data } = await cs('/api/scan', {
      method: 'POST',
      body: JSON.stringify({ token: ca }),
    })
    if (__busy) return res.status(200).json(BUSY)
    if (__rate) return res.status(200).json(RATE)
    if (__status !== 200 || !data || !data.job) {
      const msg = data && data.error ? data.error : 'scan rejected'
      return res.status(200).json({ error: msg })
    }
    return res.status(200).json({ job: data.job, token: ca })
  } catch {
    return res.status(200).json({ error: 'unreachable' })
  }
}
