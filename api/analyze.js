// Own on-chain analyzer — hybrid fallback for NuraScan.
// CrawlScan only scores Pons V2 / Flap / Bankr tokens. For every other token we
// gather likely holders from recent Transfer logs, then read their TRUE current
// balances via balanceOf (latest state — accurate, not reconstructed) to derive
// the largest holder, top-10 concentration and a score/band.

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const DEAD_ADDR = '0x000000000000000000000000000000000000dead'
const DEC_SELECTOR = '0x313ce567' // decimals()
const SUPPLY_SELECTOR = '0x18160ddd' // totalSupply()
const BAL_SELECTOR = '0x70a08231' // balanceOf(address)

const WINDOW = 3_000_000n // how far back we scan for candidate holders
const CHUNK = 400_000n // block span per top-level eth_getLogs (split further if dense)
const MAX_GATHER = 15000 // cap on Transfer logs we collect (recent-first) — plenty for top holders
const CANDIDATES = 30 // top recipients we check exact balances for
const BAL_CONCURRENCY = 10 // parallel balanceOf calls (avoid 429)
const CACHE_TTL = 10 * 60 * 1000
const CACHE = new Map()

const toHex = (n) => '0x' + n.toString(16)
const topicToAddr = (t) => '0x' + String(t).slice(26).toLowerCase()
const isZeroish = (a) => a === ZERO_ADDR || a === DEAD_ADDR
const share = (part, whole) => (whole > 0n ? Number((part * 10000n) / whole) / 10000 : 0)
const pct1 = (x) => (x * 100).toFixed(1)
const pct0 = (x) => Math.round(x * 100)

function targets() {
  const key = process.env.ALCHEMY_KEY
  return [
    key ? `https://robinhood-mainnet.g.alchemy.com/v2/${key}` : null,
    'https://rpc.mainnet.chain.robinhood.com',
  ].filter(Boolean)
}

async function rpcCall(url, method, params) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (r.status === 429 || r.status >= 500) { // rate-limited / transient — retry once
      if (attempt === 0) { await new Promise(res => setTimeout(res, 250)); continue }
      throw new Error(`rpc http ${r.status}`)
    }
    if (!r.ok) throw new Error(`rpc http ${r.status}`)
    const j = await r.json()
    if (j.error) throw new Error(j.error.message || 'rpc error')
    return j.result
  }
  throw new Error('rpc unavailable')
}

async function rpc(method, params) {
  let lastErr
  for (const url of targets()) {
    try { return await rpcCall(url, method, params) } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('rpc unavailable')
}

const ethCall = (to, data) => rpc('eth_call', [{ to, data }, 'latest'])
const getLogs = (fromBlock, toBlock, address) =>
  rpc('eth_getLogs', [{ fromBlock: toHex(fromBlock), toBlock: toHex(toBlock), address, topics: [TRANSFER_TOPIC] }])

async function balanceOf(token, holder) {
  const data = BAL_SELECTOR + holder.slice(2).toLowerCase().padStart(64, '0')
  const r = await ethCall(token, data)
  return r && r !== '0x' ? BigInt(r) : 0n
}

const isContract = async (a) => {
  try { const c = await rpc('eth_getCode', [a, 'latest']); return !!c && c !== '0x' } catch { return false }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx) }
  })
  await Promise.all(workers)
  return out
}

const isLogLimitError = (e) => /exceeds limit|limit of|too many|\b10000\b/i.test(String((e && e.message) || e))

// Fetch Transfer logs for [s, e], splitting the range in half whenever the
// provider rejects it for exceeding its per-query log limit (>10k). Stops once
// the shared collector hits MAX_GATHER. Newest-first so top recent holders win.
async function gatherChunk(state, ca, s, e, depth) {
  if (state.capped || state.logs.length >= MAX_GATHER) { state.capped = true; return }
  try {
    const logs = await getLogs(s, e, ca)
    for (const lg of logs) {
      state.logs.push(lg)
      if (state.logs.length >= MAX_GATHER) { state.capped = true; return }
    }
  } catch (err) {
    if (isLogLimitError(err) && e > s && depth < 16) {
      const mid = (s + e) / 2n
      await gatherChunk(state, ca, mid + 1n, e, depth + 1) // newer half first (prefer recent holders)
      await gatherChunk(state, ca, s, mid, depth + 1)
    }
    // non-limit errors: skip this slice (partial data is better than failing)
  }
}

function scoreOf({ concentration, largestShare, largestIsContract, holderCount }) {
  let s = 100
  const reasons = []
  if (largestShare > 0.15) {
    if (largestIsContract) { s -= 15; reasons.push(`Largest holder is a contract holding ${pct1(largestShare)}% of supply (likely launchpad / locker)`) }
    else { s -= 35; reasons.push(`A single wallet holds ${pct1(largestShare)}% of supply`) }
  } else if (largestShare > 0.05) {
    s -= largestIsContract ? 5 : 12
    reasons.push(`Largest holder holds ${pct1(largestShare)}% of supply${largestIsContract ? ' (contract)' : ''}`)
  }
  if (concentration > 0.5) { s -= 30; reasons.push(`Top 10 holders control ${pct0(concentration)}% of supply`) }
  else if (concentration > 0.3) { s -= 18; reasons.push(`Top 10 holders control ${pct0(concentration)}% of supply`) }
  else if (concentration > 0.15) { s -= 8; reasons.push(`Top 10 holders hold ${pct0(concentration)}% of supply`) }
  if (holderCount < 15) { s -= 20; reasons.push(`Only ~${holderCount} holders — very early`) }
  else if (holderCount < 50) { s -= 6; reasons.push(`~${holderCount} holders — still early`) }

  s = Math.max(0, Math.min(100, s))
  let band
  if (holderCount < 10) band = 'TOO_EARLY_OR_LATE'
  else if (s >= 80) band = 'CLEAN'
  else if (s >= 60) band = 'OK'
  else if (s >= 35) band = 'RISKY'
  else band = 'DANGER'
  if (!reasons.length) reasons.push('Supply is widely distributed — no dominant holder')
  return { score: s, band, reasons }
}

async function analyze(ca) {
  const latest = BigInt(await rpc('eth_blockNumber', []))
  const [decRes, supRes] = await Promise.all([
    ethCall(ca, DEC_SELECTOR).catch(() => null),
    ethCall(ca, SUPPLY_SELECTOR).catch(() => null),
  ])
  if (supRes == null || supRes === '0x') throw new Error('not an ERC-20 token')
  const decimals = decRes && decRes !== '0x' ? Number(BigInt(decRes)) : 18
  const supply = BigInt(supRes)
  if (supply === 0n) {
    return {
      token: ca, source: 'nura', supply: '0', decimals,
      largest: null, largestShare: 0, largestIsContract: false, holders: 0,
      top: [], concentration: 0, score: null, band: 'TOO_EARLY_OR_LATE',
      reasons: ['Token has zero supply — nothing to analyze yet.'], headline: 'Zero supply — nothing to analyze yet.',
    }
  }

  // Gather recent recipients (candidates), newest-first, adaptively splitting
  // dense ranges so no single getLogs exceeds the provider's log limit.
  const start = latest > WINDOW ? latest - WINDOW : 0n
  const state = { logs: [], capped: false }
  let e = latest
  while (e > start && !state.capped) {
    let s = e >= CHUNK ? e - CHUNK + 1n : 0n
    if (s < start) s = start
    await gatherChunk(state, ca, s, e, 0)
    if (s <= start) break
    e = s - 1n
  }

  const received = new Map()
  for (const lg of state.logs) {
    const to = topicToAddr(lg.topics[2] || '0x')
    if (isZeroish(to)) continue
    let val = 0n
    try { val = BigInt(lg.data || '0x0') } catch { val = 0n }
    received.set(to, (received.get(to) || 0n) + val)
  }
  const cands = [...received.entries()]
    .sort((x, y) => (y[1] > x[1] ? 1 : y[1] < x[1] ? -1 : 0))
    .slice(0, CANDIDATES)
    .map(([a]) => a)

  const bals = await mapLimit(cands, BAL_CONCURRENCY, (a) => balanceOf(ca, a).catch(() => 0n))
  const held = cands
    .map((a, i) => ({ wallet: a, bal: bals[i] }))
    .filter((x) => x.bal > 0n)
    .sort((x, y) => (y.bal > x.bal ? 1 : y.bal < x.bal ? -1 : 0))

  const holderCount = received.size // ~active holders in the sampled window
  const top10sum = held.slice(0, 10).reduce((t, x) => t + x.bal, 0n)
  const concentration = share(top10sum, supply)
  const largest = held[0] || null
  const largestShare = largest ? share(largest.bal, supply) : 0
  const largestIsContract = largest ? await isContract(largest.wallet) : false
  const top = held.slice(0, 10).map((x) => ({ wallet: x.wallet, share: share(x.bal, supply) }))

  const { score, band, reasons } = scoreOf({ concentration, largestShare, largestIsContract, holderCount })
  const headline =
    band === 'TOO_EARLY_OR_LATE' ? `Only ~${holderCount} holders — too few to judge.`
      : band === 'CLEAN' ? `Widely distributed — top 10 hold ${pct0(concentration)}% of supply.`
        : band === 'DANGER' ? `High concentration — top 10 hold ${pct0(concentration)}% of supply.`
          : null

  return {
    token: ca, source: 'nura', supply: supply.toString(), decimals,
    largest: largest ? largest.wallet : null, largestShare, largestIsContract,
    holders: holderCount, top, concentration, score, band, reasons, headline,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })
  const ca = String((req.query && req.query.ca) || '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(ca)) return res.status(400).json({ error: 'bad ca' })

  const key = ca.toLowerCase()
  const hit = CACHE.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return res.status(200).json(hit.data)

  try {
    const data = await analyze(ca)
    CACHE.set(key, { ts: Date.now(), data })
    return res.status(200).json(data)
  } catch (e) {
    return res.status(200).json({ error: String((e && e.message) || e) })
  }
}
