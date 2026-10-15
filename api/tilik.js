// Proxy to the TILIK research engine (asktilik.com) so the browser never
// talks to it directly (no CORS, key stays server-side if we add one later).
// GET  /api/tilik/health → { ok, providers, tools }
// POST /api/tilik        → { message, history? } → TILIK /chat response

const TILIK = 'https://asktilik.com'

// Known tokens on Robinhood Chain — expanded into the message so TILIK's
// router always has a contract address to feed the on-chain / market tools.
const KNOWN = [
  { re: /\bnura(dex)?\b/i, ca: '0x11a2809ebf14653760c7b1136acdee7cf5c5a9c9', label: 'NURA (NURADEX)' },
  { re: /\busdg\b/i, ca: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', label: 'USDG (Global Dollar)' },
  { re: /\bpons\b/i, ca: '0xa9db6d3fb987257767b7227b7df5fad099004571', label: 'PONS' },
]

function enrich(message) {
  const needsChain = /\b(token|price|market|cap|liquidity|pool|swap|chain|robinhood|holders?|dex|launchpad)\b/i.test(message)
    || KNOWN.some(k => k.re.test(message))
  if (!needsChain) return message
  const hints = ['Asked from Nura Exchange (nuradex.xyz), a DEX on Robinhood Chain (chainId 4663). Prefer on-chain + GeckoTerminal tools for token/market questions.']
  for (const k of KNOWN) {
    if (k.re.test(message) && !message.toLowerCase().includes(k.ca.slice(2, 10))) {
      hints.push(`${k.label} contract: ${k.ca}`)
    }
  }
  return `${message}\n\n[${hints.join(' ')}]`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${TILIK}/health`, { signal: AbortSignal.timeout(8000) })
      const j = await r.json()
      return res.status(200).json({ ok: true, ...j })
    } catch {
      return res.status(200).json({ ok: false, providers: {}, tools: {} })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}')
    const message = enrich(String(body.message || '').slice(0, 4000))
    if (!message.trim()) return res.status(400).json({ error: 'message required' })

    const history = Array.isArray(body.history)
      ? body.history.slice(-8).map(m => ({
          role: m?.role === 'assistant' ? 'assistant' : 'user',
          content: String(m?.content || '').slice(0, 2000),
        }))
      : undefined

    const r = await fetch(`${TILIK}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, ...(history ? { history } : {}) }),
      signal: AbortSignal.timeout(45000),
    })
    const j = await r.json().catch(() => null)
    if (!j) return res.status(502).json({ error: 'tilik returned no data' })
    return res.status(200).json(j)
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 160)
    return res.status(502).json({ error: `tilik unreachable: ${msg}` })
  }
}
