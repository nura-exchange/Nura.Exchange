export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const key = process.env.ALCHEMY_KEY
  const targets = [
    key ? `https://robinhood-mainnet.g.alchemy.com/v2/${key}` : null,
    'https://rpc.mainnet.chain.robinhood.com',
  ].filter(Boolean)

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})

  for (const url of targets) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      if (!r.ok) continue
      const data = await r.json()
      if (data.error && data.error.code === -32016) continue // rate-limited: try next
      res.setHeader('content-type', 'application/json')
      return res.status(200).json(data)
    } catch {
      // try next target
    }
  }
  return res.status(502).json({ error: 'rpc unavailable' })
}
