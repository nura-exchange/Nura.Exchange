// Passthrough to LI.FI quotes (modeled on Quoro's quote flow, MIT).
// GET /api/quote?fromChain&toChain&fromToken&toToken&fromAmount&fromAddress&slippage
const ALLOWED = ['fromChain', 'toChain', 'fromToken', 'toToken', 'fromAmount', 'fromAddress', 'toAddress', 'slippage']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const q = req.query || {}
  const params = new URLSearchParams()
  for (const k of ALLOWED) if (q[k]) params.set(k, String(q[k]))
  // LI.FI rejects mixed-case addresses ("Invalid extended address") and requires fromAddress.
  const addr = v => (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) ? v.toLowerCase() : null)
  const from = addr(params.get('fromAddress')) || addr(params.get('toAddress')) || '0x0000000000000000000000000000000000000001'
  params.set('fromAddress', from)
  params.set('toAddress', addr(params.get('toAddress')) || from)

  try {
    const r = await fetch(`https://li.quest/v1/quote?${params.toString()}`, {
      headers: { accept: 'application/json' },
    })
    const data = await r.json().catch(() => null)
    res.setHeader('content-type', 'application/json')
    if (!r.ok) return res.status(r.status).json(data || { message: 'no route' })
    return res.status(200).json(data)
  } catch {
    return res.status(502).json({ message: 'quote service unavailable' })
  }
}
