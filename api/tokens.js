// Aggregates every reachable live market on Robinhood Chain:
//  - Quoro launches: scored memecoin launches (CORS-open), ranked by 24h volume
//  - LI.FI token registry: established tokens with prices, decimals, logos
//  - GeckoTerminal top pools: live pool prices, volumes, logos
//  - up. (native ve(3,3) DEX): v2 pairs + v3 Slipstream pools via Goldsky subgraphs
//  - DexScreener API (batches of 30): live price / 24h change / volume / liquidity for pooled tokens
//  - Multicall3 on the chain: totalSupply + decimals → price = mcap / supply for bonding-curve launches
// GET /api/tokens → { ok, tokens: [{ symbol, name, ca, decimals, priceUsd, change24h, vol24h, mcap, logo, score, flagged, ageMin, graduated, liq, src }] }

import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem'

const GT = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools'
const QUORO = 'https://quoro.exchange'
const LIFI = 'https://li.quest/v1/tokens?chain=4663'
const DS = 'https://api.dexscreener.com/tokens/v1/robinhood'
const RPC = 'https://rpc.mainnet.chain.robinhood.com'
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const UP_V2_SUBGRAPH = 'https://api.goldsky.com/api/public/project_cmhef02640198x7p2cz2w70u8/subgraphs/up-robinhood-v2-mainnet/0.1.0/gn'
const UP_V3_SUBGRAPH = 'https://api.goldsky.com/api/public/project_cmhef02640198x7p2cz2w70u8/subgraphs/up-robinhood-v3-mainnet/0.1.1/gn'
const GT_PAGES = 10
const SORTS = ['all', 'trending', 'recent']
const ZERO = '0x0000000000000000000000000000000000000000'
const SKIP = new Set(['WETH', 'USDG'])
const TOTAL_SUPPLY = '0x18160ddd'
const DECIMALS = '0x313ce567'
// NURA — our own launch on Pons. Pinned so it always shows in Markets even
// when Quoro hasn't indexed it yet. Curve contract from the launchpad page.
const NURA_CA = '0x11a2809ebf14653760c7b1136acdee7cf5c5a9c9'
const NURA_CURVE = '0xa426f8028e957adb03a111ce89830a1098a8bcd6'
const CURVE_ABI = parseAbi([
  'function getReserves() view returns (uint256, uint256)',
  'function graduated() view returns (bool)',
  'function graduationThreshold() view returns (uint256)',
])
const ERC20_ABI = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
])
const multicallAbi = parseAbi([
  'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) returns ((bool success, bytes returnData)[] returnData)',
])

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.json()
}

function addToken(map, t) {
  if (!t.ca || !t.symbol || SKIP.has(t.symbol)) return
  const key = t.ca.toLowerCase()
  if (key === ZERO || map.has(key)) return
  map.set(key, t)
}

async function fetchQuoro() {
  const [pulse, ...lists] = await Promise.all([
    getJson(`${QUORO}/api/pulse`).catch(() => null),
    ...SORTS.map(s => getJson(`${QUORO}/api/launches?sort=${s}&limit=300`).catch(() => null)),
  ])
  const ethUsd = parseFloat(pulse?.ethUsd) || null
  const map = new Map()
  for (const list of lists) {
    for (const row of list?.rows || []) {
      const spark = Array.isArray(row.spark) && row.spark.length ? row.spark : null
      const priceNative = spark ? parseFloat(spark[spark.length - 1]) : null
      addToken(map, {
        symbol: String(row.symbol || '').toUpperCase(),
        name: row.name || row.symbol,
        ca: row.ca,
        decimals: null,
        priceUsd: priceNative && ethUsd ? priceNative * ethUsd : null,
        change24h: row.change24h ?? row.change1h ?? null,
        vol24h: parseFloat(row.vol24hUsd) || 0,
        mcap: parseFloat(row.mcapUsd) || null,
        logo: row.logo ? new URL(row.logo, QUORO).href : null,
        score: typeof row.score === 'number' ? row.score : null,
        flagged: !!row.flagged,
        ageMin: typeof row.ageMin === 'number' ? row.ageMin : null,
        graduated: !!row.graduated,
        src: 'quoro',
      })
    }
  }
  return map
}

async function rpcCall(to, data) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
  })
  const j = await r.json()
  return j.result || null
}

// NURA is pinned: priced live from the Pons bonding curve (reserves) even when
// Quoro hasn't indexed the launch yet, so it always appears in Markets/Swap.
async function fetchNura() {
  const map = new Map()
  try {
    const [reserves, graduated, supply, decimals, pulse] = await Promise.all([
      rpcCall(NURA_CURVE, encodeFunctionData({ abi: CURVE_ABI, functionName: 'getReserves' })),
      rpcCall(NURA_CURVE, encodeFunctionData({ abi: CURVE_ABI, functionName: 'graduated' })),
      rpcCall(NURA_CA, encodeFunctionData({ abi: ERC20_ABI, functionName: 'totalSupply' })),
      rpcCall(NURA_CA, encodeFunctionData({ abi: ERC20_ABI, functionName: 'decimals' })),
      getJson(`${QUORO}/api/pulse`).catch(() => null),
    ])
    if (!reserves || !supply) return map
    const ethPriceUsd = parseFloat(pulse?.ethUsd) || null
    const [ethRes, tokRes] = decodeFunctionResult({ abi: CURVE_ABI, functionName: 'getReserves', data: reserves })
    const dec = decimals ? Number(BigInt(decimals)) : 18
    const supplyTokens = Number(BigInt(supply)) / 10 ** dec
    const tokResTokens = Number(tokRes) / 10 ** dec
    // spot price in ETH from the curve; × ETH/USD when we have it
    const priceEth = tokResTokens > 0 ? Number(ethRes) / Number(tokRes) : null
    const priceUsd = priceEth != null && ethPriceUsd ? priceEth * ethPriceUsd : null
    addToken(map, {
      symbol: 'NURA',
      name: 'NURADEX',
      ca: NURA_CA,
      decimals: dec,
      priceUsd,
      change24h: null,
      vol24h: 0,
      mcap: priceUsd != null && supplyTokens > 0 ? priceUsd * supplyTokens : null,
      logo: 'https://quoro.exchange/img?u=ipfs%3A%2F%2Fbafkreibmu4cbdclp6ncc2ugui37w2ay26j37myelwkegbzb47zt2impazm',
      score: 7,
      flagged: false,
      ageMin: null,
      graduated: graduated ? BigInt(graduated) !== 0n : false,
      src: 'nura',
    })
  } catch { /* curve unreachable — skip pin */ }
  return map
}

async function fetchLifi() {
  const map = new Map()
  try {
    const data = await getJson(LIFI)
    const rows = data?.tokens?.['4663'] || data?.['4663'] || []
    for (const t of rows) {
      addToken(map, {
        symbol: String(t.symbol || '').toUpperCase(),
        name: t.name || t.symbol,
        ca: t.address,
        decimals: parseInt(t.decimals, 10) || null,
        priceUsd: parseFloat(t.priceUSD) || null,
        change24h: null,
        vol24h: 0,
        mcap: null,
        logo: t.logoURI || null,
        score: null,
        flagged: null,
        ageMin: null,
        graduated: null,
        src: 'lifi',
      })
    }
  } catch { /* registry unavailable — continue without it */ }
  return map
}

async function fetchGt() {
  const pages = await Promise.all(
    Array.from({ length: GT_PAGES }, (_, i) =>
      getJson(`${GT}?page=${i + 1}&sort=h24_volume_usd_desc&include=base_token`).catch(() => null)
    )
  )
  const map = new Map()
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
      addToken(map, {
        symbol: String(tok.symbol || '').toUpperCase(),
        name: tok.name || tok.symbol,
        ca: tok.address,
        decimals: parseInt(tok.decimals, 10) || null,
        priceUsd: parseFloat(attrs.base_token_price_usd) || null,
        change24h: attrs.price_change_percentage?.h24 != null
          ? parseFloat(attrs.price_change_percentage.h24)
          : null,
        vol24h: parseFloat(attrs.volume_usd?.h24) || 0,
        mcap: parseFloat(attrs.market_cap_usd) || null,
        logo: tok.image_url || null,
        score: null,
        flagged: null,
        ageMin: null,
        graduated: null,
        src: 'gt',
      })
    }
  }
  return map
}

async function gql(url, query) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  const j = await r.json()
  if (j.errors) throw new Error(j.errors[0]?.message || 'subgraph error')
  return j.data
}

// up. (native ve(3,3) DEX, Aerodrome fork): v2 pairs + v3 Slipstream pools via Goldsky.
async function fetchUp() {
  const map = new Map()
  const volByToken = new Map()
  const [v2, v3] = await Promise.all([
    gql(UP_V2_SUBGRAPH, `{
      pairs(first: 100, orderBy: volumeUSD, orderDirection: desc) {
        stable volumeUSD totalValueLockedUSD
        token0 { id symbol name decimals }
        token1 { id symbol name decimals }
        token0Price token1Price
      }
    }`).catch(() => null),
    gql(UP_V3_SUBGRAPH, `{
      pools(first: 50, orderBy: totalValueLockedUSD, orderDirection: desc) {
        volumeUSD totalValueLockedUSD
        token0 { id symbol name decimals }
        token1 { id symbol name decimals }
        token0Price token1Price
      }
    }`).catch(() => null),
  ])
  const absorb = (tok, price, vol, liqShare) => {
    if (!tok?.id || !tok.symbol) return
    const key = tok.id.toLowerCase()
    volByToken.set(key, (volByToken.get(key) || 0) + (parseFloat(vol) || 0))
    if (map.has(key)) {
      const prev = map.get(key)
      prev.priceUsd = prev.priceUsd ?? price
      prev.liq = (prev.liq || 0) + liqShare
      return
    }
    addToken(map, {
      symbol: String(tok.symbol).toUpperCase(),
      name: tok.name || tok.symbol,
      ca: tok.id,
      decimals: parseInt(tok.decimals, 10) || null,
      priceUsd: price,
      change24h: null,
      vol24h: parseFloat(vol) || 0,
      mcap: null,
      logo: null,
      score: null,
      flagged: null,
      ageMin: null,
      graduated: null,
      liq: liqShare,
      src: 'up',
    })
  }
  for (const p of v2?.pairs || []) {
    const vol = p.volumeUSD
    const liq = (parseFloat(p.totalValueLockedUSD) || 0) / 2
    absorb(p.token0, parseFloat(p.token0Price) || null, vol, liq)
    absorb(p.token1, parseFloat(p.token1Price) || null, vol, liq)
  }
  for (const p of v3?.pools || []) {
    const vol = p.volumeUSD
    const liq = (parseFloat(p.totalValueLockedUSD) || 0) / 2
    absorb(p.token0, parseFloat(p.token0Price) || null, vol, liq)
    absorb(p.token1, parseFloat(p.token1Price) || null, vol, liq)
  }
  for (const [key, v] of volByToken) {
    const t = map.get(key)
    if (t) t.vol24h = v
  }
  return map
}

// Live pool data for known addresses: price, 24h change, volume, mcap, liquidity (base side only).
async function fetchDexScreener(addresses) {
  const chunks = []
  for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i + 30))
  const results = await Promise.all(
    chunks.map(chunk =>
      getJson(`${DS}/${chunk.join(',')}`).catch(() => null)
    )
  )
  const map = new Map()
  for (const pairs of results) {
    if (!Array.isArray(pairs)) continue
    for (const p of pairs) {
      const key = p.baseToken?.address?.toLowerCase()
      if (!key || p.chainId !== 'robinhood') continue
      const liq = parseFloat(p.liquidity?.usd) || 0
      const prev = map.get(key)
      if (prev && prev.liq >= liq) continue
      map.set(key, {
        priceUsd: parseFloat(p.priceUsd) || null,
        change24h: p.priceChange?.h24 != null ? parseFloat(p.priceChange.h24) : null,
        vol24h: parseFloat(p.volume?.h24) || 0,
        mcap: parseFloat(p.marketCap) || null,
        liq,
      })
    }
  }
  return map
}

// price = mcapUsd × 10^decimals / totalSupply — one aggregate3 call per chunk.
async function fetchSupplies(entries) {
  const calls = []
  for (const [key, t] of entries) {
    calls.push({ key, kind: 'supply', target: t.ca })
    calls.push({ key, kind: 'decimals', target: t.ca })
  }
  const out = new Map()
  const chunks = []
  for (let i = 0; i < calls.length; i += 60) chunks.push(calls.slice(i, i + 60))
  const results = await Promise.all(
    chunks.map(chunk => {
      const data = encodeFunctionData({
        abi: multicallAbi,
        functionName: 'aggregate3',
        args: [chunk.map(c => ({
          target: c.target,
          allowFailure: true,
          callData: c.kind === 'supply' ? TOTAL_SUPPLY : DECIMALS,
        }))],
      })
      return fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: MULTICALL3, data }, 'latest'] }),
      })
        .then(r => r.json())
        .then(j => {
          if (!j.result) return null
          const decoded = decodeFunctionResult({ abi: multicallAbi, functionName: 'aggregate3', data: j.result })
          return chunk.map((c, i) => ({ ...c, res: decoded[i] }))
        })
        .catch(() => null)
    })
  )
  for (const res of results) {
    if (!res) continue
    for (const { key, kind, res: r } of res) {
      if (!r?.success || !r.returnData) continue
      const v = BigInt(r.returnData)
      const rec = out.get(key) || {}
      if (kind === 'supply') rec.supply = v
      else rec.decimals = Number(v)
      out.set(key, rec)
    }
  }
  return out
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')

  try {
    const [quoro, lifi, gt, up, nura] = await Promise.all([fetchQuoro(), fetchLifi(), fetchGt(), fetchUp(), fetchNura()])

    // Union: pinned NURA first, then Quoro (scores), LI.FI, GeckoTerminal, up. — later sources fill the gaps.
    const merged = new Map(nura)
    for (const [key, t] of quoro) {
      const prev = merged.get(key)
      if (!prev) merged.set(key, t)
      else merged.set(key, {
        ...t,
        priceUsd: t.priceUsd ?? prev.priceUsd,
        change24h: t.change24h ?? prev.change24h,
        vol24h: Math.max(t.vol24h || 0, prev.vol24h || 0),
        mcap: t.mcap ?? prev.mcap,
        logo: t.logo || prev.logo,
        score: t.score ?? prev.score,
        flagged: t.flagged ?? prev.flagged,
        src: prev.src === 'nura' ? 'nura' : t.src,
      })
    }
    for (const [key, t] of lifi) {
      const prev = merged.get(key)
      if (!prev) merged.set(key, t)
      else merged.set(key, { ...prev, priceUsd: prev.priceUsd ?? t.priceUsd, decimals: prev.decimals ?? t.decimals, logo: prev.logo || t.logo })
    }
    for (const [key, t] of gt) {
      const prev = merged.get(key)
      if (!prev) merged.set(key, t)
      else merged.set(key, {
        ...prev,
        priceUsd: prev.priceUsd ?? t.priceUsd,
        change24h: prev.change24h ?? t.change24h,
        vol24h: Math.max(prev.vol24h || 0, t.vol24h || 0),
        mcap: prev.mcap ?? t.mcap,
        logo: prev.logo || t.logo,
        decimals: prev.decimals ?? t.decimals,
      })
    }
    for (const [key, t] of up) {
      const prev = merged.get(key)
      if (!prev) merged.set(key, t)
      else merged.set(key, {
        ...prev,
        priceUsd: prev.priceUsd ?? t.priceUsd,
        change24h: prev.change24h ?? t.change24h,
        vol24h: Math.max(prev.vol24h || 0, t.vol24h || 0),
        mcap: prev.mcap ?? t.mcap,
        logo: prev.logo || t.logo,
        decimals: prev.decimals ?? t.decimals,
        liq: prev.liq ?? t.liq,
      })
    }

    const addresses = [...merged.keys()]

    // Live market data for every pooled token (DexScreener: 30 addresses per call).
    const ds = await fetchDexScreener(addresses)
    for (const [key, m] of ds) {
      const t = merged.get(key)
      if (!t) continue
      merged.set(key, {
        ...t,
        priceUsd: m.priceUsd ?? t.priceUsd,
        change24h: m.change24h ?? t.change24h,
        vol24h: Math.max(t.vol24h || 0, m.vol24h || 0),
        mcap: t.mcap ?? m.mcap,
        liq: m.liq,
      })
    }

    // Bonding-curve launches have no pool yet — price them from mcap and on-chain supply.
    const needsSupply = [...merged.entries()].filter(([, t]) => t.priceUsd == null && t.mcap && t.mcap > 0)
    if (needsSupply.length) {
      const supplies = await fetchSupplies(needsSupply)
      for (const [key, t] of needsSupply) {
        const s = supplies.get(key)
        if (!s?.supply || s.supply === 0n || !Number.isFinite(s.decimals)) continue
        const supplyTokens = Number(s.supply) / 10 ** s.decimals
        if (!Number.isFinite(supplyTokens) || supplyTokens <= 0) continue
        merged.set(key, { ...t, decimals: t.decimals ?? s.decimals, priceUsd: t.mcap / supplyTokens })
      }
    }

    const list = [...merged.values()]
      .sort((a, b) => (b.vol24h || 0) - (a.vol24h || 0) || (b.mcap || 0) - (a.mcap || 0))
      .slice(0, 800)

    // Keep the pinned NURA launch at the top of Markets.
    const nuraIdx = list.findIndex(t => t.ca?.toLowerCase() === NURA_CA)
    if (nuraIdx > 0) list.unshift(...list.splice(nuraIdx, 1))

    return res.status(200).json({ ok: true, count: list.length, tokens: list })
  } catch (e) {
    return res.status(200).json({ ok: false, count: 0, tokens: [], error: String(e).slice(0, 200) })
  }
}
