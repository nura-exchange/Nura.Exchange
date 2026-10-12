// Aggregates every live market on Robinhood Chain from GeckoTerminal pools.
// GET /api/tokens → { ok, tokens: [{ symbol, name, ca, decimals, priceUsd, change24h, vol24h, mcap, logo }] }

const GT = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools'
const PAGES = 10
const ZERO = '0x0000000000000000000000000000000000000000'
// Core assets already offered in the pay side of the swap card.
const SKIP = new Set(['WETH', 'USDG'])

async function fetchPage(page) {
  const url = `${GT}?page=${page}&sort=h24_volume_usd_desc&include=base_token`
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`geckoterminal ${r.status}`)
  return r.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')

  try {
    const pages = await Promise.all(
      Array.from({ length: PAGES }, (_, i) => fetchPage(i + 1).catch(() => null))
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
        const baseId = pool.relationships?.base_token?.data?.id
        const tok = included.get(baseId)
        if (!tok) continue
        const ca = tok.address
        if (!ca || ca.toLowerCase() === ZERO) continue
        const symbol = String(tok.symbol || '').toUpperCase()
        if (!symbol || SKIP.has(symbol)) continue
        const key = ca.toLowerCase()
        if (tokens.has(key)) continue
        tokens.set(key, {
          symbol,
          name: tok.name || symbol,
          ca,
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

    const list = [...tokens.values()]
      .sort((a, b) => (b.vol24h || 0) - (a.vol24h || 0))
      .slice(0, 250)

    return res.status(200).json({ ok: true, count: list.length, tokens: list })
  } catch {
    return res.status(200).json({ ok: false, count: 0, tokens: [] })
  }
}
