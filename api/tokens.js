// Aggregates every live market on Robinhood Chain:
//  - Quoro launches (scored memecoins & tokens, CORS-open, up to 300/sort)
//  - GeckoTerminal top pools by 24h volume (prices, decimals, logos)
// GET /api/tokens → { ok, tokens: [{ symbol, name, ca, decimals, priceUsd, change24h, vol24h, mcap, logo, score, flagged, ageMin }] }

const GT = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools'
const QUORO = 'https://quoro.exchange'
const PAGES = 10
const SORTS = ['all', 'trending', 'recent']
const ZERO = '0x0000000000000000000000000000000000000000'
// Core assets already offered in the pay side of the swap card.
const SKIP = new Set(['WETH', 'USDG'])

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.json()
}

async function fetchGtPage(page) {
  return getJson(`${GT}?page=${page}&sort=h24_volume_usd_desc&include=base_token`)
}

async function fetchQuoro() {
  const [pulse, ...lists] = await Promise.all([
    getJson(`${QUORO}/api/pulse`).catch(() => null),
    ...SORTS.map(s => getJson(`${QUORO}/api/launches?sort=${s}&limit=300`).catch(() => null)),
  ])
  const ethUsd = parseFloat(pulse?.ethUsd) || null
  const tokens = new Map()
  for (const list of lists) {
    for (const row of list?.rows || []) {
      const ca = row.ca
      if (!ca || ca.toLowerCase() === ZERO) continue
      const symbol = String(row.symbol || '').toUpperCase()
      if (!symbol || SKIP.has(symbol)) continue
      const key = ca.toLowerCase()
      if (tokens.has(key)) continue
      const spark = Array.isArray(row.spark) && row.spark.length ? row.spark : null
      const priceNative = spark ? parseFloat(spark[spark.length - 1]) : null
      tokens.set(key, {
        symbol,
        name: row.name || symbol,
        ca,
        decimals: null, // filled from GeckoTerminal or resolved client-side on selection
        priceUsd: priceNative && ethUsd ? priceNative * ethUsd : null,
        change24h: row.change24h ?? row.change1h ?? null,
        vol24h: parseFloat(row.vol24hUsd) || 0,
        mcap: parseFloat(row.mcapUsd) || null,
        logo: row.logo ? new URL(row.logo, QUORO).href : null,
        score: typeof row.score === 'number' ? row.score : null,
        flagged: !!row.flagged,
        ageMin: typeof row.ageMin === 'number' ? row.ageMin : null,
        graduated: !!row.graduated,
      })
    }
  }
  return tokens
}

async function fetchGt() {
  const pages = await Promise.all(
    Array.from({ length: PAGES }, (_, i) => fetchGtPage(i + 1).catch(() => null))
  )
  const tokens = new Map()
  for (const page of pages) {
    if (!page?.data?.length) continue
    const included = new Map()
    for (const inc of page.included || []) {
      if (inc.type === 'token') included.set(inc.id, inc.attributes || {})
    }
    for (const pool of page.data) {
      const attrs = pool.attributes || {}
      const tok = included.get(pool.relationships?.base_token?.data?.id)
      if (!tok?.address) continue
      const symbol = String(tok.symbol || '').toUpperCase()
      if (!symbol || SKIP.has(symbol)) continue
      const key = tok.address.toLowerCase()
      if (tokens.has(key)) continue
      tokens.set(key, {
        symbol,
        name: tok.name || symbol,
        ca: tok.address,
        decimals: parseInt(tok.decimals, 10) || 18,
        priceUsd: parseFloat(attrs.base_token_price_usd) || null,
        change24h: attrs.price_change_percentage?.h24 != null
          ? parseFloat(attrs.price_change_percentage.h24)
          : null,
        vol24h: parseFloat(attrs.volume_usd?.h24) || 0,
        mcap: parseFloat(attrs.market_cap_usd) || null,
        logo: tok.image_url || null,
      })
    }
  }
  return tokens
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')

  try {
    const [quoro, gt] = await Promise.all([fetchQuoro(), fetchGt()])
    // Quoro first (coverage), GeckoTerminal overlays live pool prices/decimals.
    const merged = new Map(quoro)
    for (const [key, t] of gt) {
      const prev = merged.get(key)
      if (!prev) {
        merged.set(key, t)
      } else {
        merged.set(key, {
          ...prev,
          priceUsd: t.priceUsd ?? prev.priceUsd,
          change24h: t.change24h ?? prev.change24h,
          vol24h: Math.max(t.vol24h || 0, prev.vol24h || 0) || prev.vol24h,
          mcap: t.mcap ?? prev.mcap,
          logo: prev.logo || t.logo,
          decimals: t.decimals ?? prev.decimals,
        })
      }
    }

    const list = [...merged.values()]
      .sort((a, b) => (b.vol24h || 0) - (a.vol24h || 0))
      .slice(0, 400)

    return res.status(200).json({ ok: true, count: list.length, tokens: list })
  } catch {
    return res.status(200).json({ ok: false, count: 0, tokens: [] })
  }
}
