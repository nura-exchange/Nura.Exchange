// ERC-20 balances for a wallet on Robinhood Chain via Alchemy (key stays server-side).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const key = process.env.ALCHEMY_KEY
  if (!key) return res.status(500).json({ error: 'ALCHEMY_KEY not set' })

  const { address } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || '')) return res.status(400).json({ error: 'bad address' })

  const rpc = async (method, params) => {
    const r = await fetch(`https://robinhood-mainnet.g.alchemy.com/v2/${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const j = await r.json()
    if (j.error) throw new Error(j.error.message)
    return j.result
  }

  try {
    const balances = await rpc('alchemy_getTokenBalances', [address, 'erc20'])
    const held = balances.tokenBalances
      .filter(b => b.contractAddress && b.tokenBalance && BigInt(b.tokenBalance) > 0n)
      .slice(0, 40)

    const tokens = await Promise.all(held.map(async b => {
      try {
        const m = await rpc('alchemy_getTokenMetadata', [b.contractAddress])
        if (!m || !m.symbol || !m.decimals) return null
        return {
          address: b.contractAddress,
          symbol: m.symbol,
          name: m.name || m.symbol,
          decimals: m.decimals,
          logo: m.logo || null,
          raw: b.tokenBalance,
        }
      } catch {
        return null
      }
    }))

    return res.status(200).json({ tokens: tokens.filter(Boolean) })
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) })
  }
}
