const BLOCKSCOUT = 'https://robinhoodchain.blockscout.com'

// Token-creating contracts, from Sinjoh-Finance/sinjoh-contracts mainnet-deployments@a831603.
// Keyed by the token's tx creator (Blockscout creator_address_hash).
const CREATORS = {
  // Pons v2 (current)
  '0x3711ceafeade896c913c68f01eda97cb06d1a42': { launchpad: 'Pons v2', factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' },
  '0x39701ef4704ce44957e0a8b6b802181ce4f635e2': { launchpad: 'Pons v2', factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' },
  '0x6b5e99b344c0671f77bac00c5adbe453ffa39100': { launchpad: 'Pons v2', factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' },
  // Pons v2 (historical generation)
  '0xa0bc05240f1cd1f3df7fefa35e48c19fff4c6ace': { launchpad: 'Pons v2', factory: '0x7DCeEaB0A53684b001A4900768a52eAcDb27294e' },
  '0x8f27b906f0b7562e51d1e9b23963fe738d90c0e8': { launchpad: 'Pons v2', factory: '0x7DCeEaB0A53684b001A4900768a52eAcDb27294e' },
  '0xbf9c48bd4784016065613fbbde7bbc2bca017fa7e': { launchpad: 'Pons v2', factory: '0x7DCeEaB0A53684b001A4900768a52eAcDb27294e' },
  // Pons v1
  '0xa5aab3f0c6eadf30ef1d3eb997108e976351feb': { launchpad: 'Pons', factory: '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB' },
  // letscash.fun
  '0x5bd1fbe78a78fe8236fa00cf48fbeba74ae34661': { launchpad: 'letscash.fun', factory: '0x5bd1Fbe78a78fe8236fa00CF48fbEBA74ae34661' },
  // Flap
  '0x77748d07cad323a7f6efa54968acf69de743be61': { launchpad: 'Flap', factory: '0x77748D07CAD323A7f6EFa54968aCF69de743be61' },
  // pools.trade
  '0x000000e200088d55c39a11f609e5f667729ad49b': { launchpad: 'pools.trade', factory: '0x000000e200088D55C39a11F609E5F667729ad49b' },
  '0x0000ffffbe8efe702c8703ae3477ff5de3d319c0': { launchpad: 'pools.trade', factory: '0x0000FffFBE8efE702c8703aE3477FF5dE3d319C0' },
}

// Fallback when the explorer withholds the creator: the token contract's own name.
const NAME_PATTERNS = [
  [/^PonsV2/i, 'Pons v2'],
  [/^Pons/i, 'Pons'],
  [/LetScash|LetsCash/i, 'letscash.fun'],
  [/^Flap/i, 'Flap'],
  [/PoolsTrade/i, 'pools.trade'],
]

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      },
    })
    if (!r.ok) return null
    const text = await r.text()
    if (text.startsWith('<')) return null // Cloudflare challenge page
    return JSON.parse(text)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })

  const ca = String(req.query?.ca || '').trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(ca)) return res.status(400).json({ error: 'bad_input' })

  let creator = null
  let contractName = null

  const addr = await fetchJson(`${BLOCKSCOUT}/api/v2/addresses/${ca}`)
  if (addr && typeof addr === 'object') {
    creator = addr.creator_address_hash || null
    contractName = addr.name || null
  }
  if (!creator) {
    const legacy = await fetchJson(
      `${BLOCKSCOUT}/api?module=contract&action=getcontractcreation&contractaddresses=${ca}`
    )
    const first = Array.isArray(legacy?.result) ? legacy.result[0] : null
    if (first?.contractCreator) creator = first.contractCreator
  }

  let launchpad = null
  let factory = null
  if (creator) {
    const hit = CREATORS[String(creator).toLowerCase()]
    if (hit) {
      launchpad = hit.launchpad
      factory = hit.factory
    }
  }
  if (!launchpad && contractName) {
    for (const [re, name] of NAME_PATTERNS) {
      if (re.test(contractName)) {
        launchpad = name
        break
      }
    }
  }

  // the creator address never changes — cache hard
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.setHeader('content-type', 'application/json')
  if (!creator && !contractName) return res.status(200).json({ ok: false, ca, creator: null, contractName: null, launchpad: null, factory: null })
  return res.status(200).json({ ok: true, ca, creator, contractName, launchpad, factory })
}
