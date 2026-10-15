// Proxy to the TILIK research engine (asktilik.com) so the browser never
// talks to it directly (no CORS, key stays server-side if we add one later).
// GET  /api/tilik/health → { ok, providers, tools }
// POST /api/tilik        → { message, history? } → TILIK /chat response

const TILIK = 'https://asktilik.com'

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
    const message = String(body.message || '').slice(0, 4000)
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
