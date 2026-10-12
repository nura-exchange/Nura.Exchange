// Token price chart — OHLCV candles for any Robinhood Chain token via GeckoTerminal.
// GeckoTerminal's OHLCV route wants the RAW pool address (network-prefixed ids 404),
// timeframes are second|minute|hour|day and day only allows aggregate=1.
// GET /api/chart?ca=0x…&range=1H|1D|1W|1M|1Y → { ok, candles: [{ t, o, h, l, c }], pool }

const GT = 'https://api.geckoterminal.com/api/v2'
const NETWORK = 'robinhood'

const RANGES = {
  '1H': { tf: 'minute', agg: 1, limit: 60 },
  '1D': { tf: 'minute', agg: 15, limit: 96 },
  '1W': { tf: 'hour', agg: 4, limit: 42 },
  '1M': { tf: 'day', agg: 1, limit: 31 },
  '1Y': { tf: 'day', agg: 1, limit: 365 },
}

// Public GT API is 30 req/min per IP — one backoff retry smooths out shared-IP 429s.
async function gt(path, tries = 2) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${GT}${path}`, { headers: { Accept: 'application/json' } })
    if (r.ok) return r.json()
    const body = await r.text()
    if (r.status === 429 && i < tries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      continue
    }
    throw new Error(`GT ${r.status} ${body.slice(0, 160)}`)
  }
  throw new Error('GT fetch failed')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method not allowed' })
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')

  const ca = String(req.query.ca || '').toLowerCase()
  const range = RANGES[req.query.range] ? req.query.range : '1D'
  if (!/^0x[a-f0-9]{40}$/.test(ca)) return res.status(400).json({ ok: false, error: 'bad ca' })

  try {
    const pools = await gt(`/networks/${NETWORK}/tokens/${ca}/pools?page=1`)
    const list = Array.isArray(pools.data) ? pools.data : []
    if (!list.length) return res.status(200).json({ ok: true, range, candles: [], reason: 'no-pool' })

    let best = list[0]
    let bestScore = -1
    for (const p of list) {
      const score =
        parseFloat(p.attributes?.h24_volume_usd) ||
        parseFloat(p.attributes?.liquidity_usd) ||
        0
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }

    const poolAddr = String(best.id).replace(/^robinhood_/, '')
    const { tf, agg, limit } = RANGES[range]
    const ohlcv = await gt(`/networks/${NETWORK}/pools/${poolAddr}/ohlcv/${tf}?aggregate=${agg}&limit=${limit}`)
    const raw = ohlcv.data?.attributes?.ohlcv_list || []
    const candles = raw
      .map(r => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }))
      .sort((a, b) => a.t - b.t)

    return res.status(200).json({
      ok: true,
      range,
      pool: best.attributes?.name || null,
      count: candles.length,
      candles,
    })
  } catch (e) {
    return res.status(200).json({ ok: false, range, candles: [], error: String(e).slice(0, 200) })
  }
}
