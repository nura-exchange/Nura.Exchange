import { createWalletClient, custom } from 'viem'
import { robinhoodChain } from '../config'
import { ensureChain, publicClientFor } from './trade'

const QUORO = 'https://quoro.exchange'
const EXPLORER = 'https://robinhoodchain.blockscout.com'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function waitForReceipt(hash, timeoutMs = 120000) {
  const client = publicClientFor(robinhoodChain.id)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await client.getTransactionReceipt({ hash })
      if (receipt) return receipt
    } catch {
      // node may not know the hash yet
    }
    await sleep(1500)
  }
  throw new Error('Timed out waiting for confirmation')
}

/**
 * Quoro's server quotes both bonding-curve launches and v4 pools on Robinhood Chain
 * and returns ready-to-sign steps. `amount` is a decimal string in the input coin's
 * units (ETH for buys, token for sells).
 * @param {{ ca: string, side: 'buy'|'sell', amount: string, account?: string, slippage?: number }} p
 */
export async function getQuoroQuote({ ca, side, amount, account, slippage = 1 }) {
  const qs = side === 'sell'
    ? new URLSearchParams({ side: 'sell', ca, to: 'rh', amount, slippage: String(slippage) })
    : new URLSearchParams({ ca, from: 'rh', amount, slippage: String(slippage) })
  if (account) qs.set('account', account)
  const r = await fetch(`${QUORO}/api/quote?${qs.toString()}`)
  const d = await r.json().catch(() => null)
  if (!r.ok || !d || d.error) {
    const err = new Error(d?.error === 'no_route' ? 'No route for this pair' : (d?.error || 'Quote unavailable'))
    err.code = d?.error || (r.status === 429 ? 'rate_limited' : 'offline')
    throw err
  }
  return d
}

/** Compact view of a Quoro quote for the ticket UI. */
export function normalizeQuoro(q) {
  const fees = q.fees || {}
  return {
    out: q.out != null ? String(q.out) : null,
    outMin: q.outMin != null ? String(q.outMin) : null,
    feeUsd: (fees.networkUsd || 0) + (fees.routeUsd || 0) || null,
    taxPct: fees.creatorTaxPct || 0,
    taxUsd: fees.creatorTaxUsd || 0,
    impactPct: fees.impactPct ?? null,
    provider: q.route?.provider || null,
    label: q.route?.label || null,
    signable: Boolean(q.signable && q.steps?.length),
    raw: q,
  }
}

/**
 * Sends the quote's steps in order (approve, then swap) on Robinhood Chain.
 * onStatus({ phase, step, of, txHash, url }) mirrors useExecuteSwap's phases.
 * @param {any} q fresh quote fetched with the trading account
 * @param {{ connector: any, account: string, onStatus?: (s: any) => void }} opts
 */
export async function executeQuoroQuote(q, { connector, account, onStatus = () => {} }) {
  if (!q?.signable || !q.steps?.length) throw new Error('Quote expired — try again')
  const provider = await connector.getProvider()
  onStatus({ phase: 'switch', chainId: robinhoodChain.id })
  await ensureChain(provider, robinhoodChain)
  const wallet = createWalletClient({ chain: robinhoodChain, transport: custom(provider) })

  const of = q.steps.length
  let hash = null
  for (let i = 0; i < of; i++) {
    const s = q.steps[i]
    const approving = s.kind === 'approve'
    onStatus({ phase: approving ? 'approve' : 'sign', step: i + 1, of })
    try {
      hash = await wallet.sendTransaction({
        account,
        to: s.to,
        data: s.data || '0x',
        value: s.value ? BigInt(s.value) : 0n,
        ...(s.gas ? { gas: BigInt(s.gas) } : {}),
      })
    } catch (e) {
      const msg = String(e?.message || e || '')
      if (e?.code === 4001 || /reject|denied|cancel/i.test(msg)) throw new Error('Request rejected')
      throw e
    }
    const url = `${EXPLORER}/tx/${hash}`
    onStatus({ phase: 'pending', txHash: hash, url, approving })
    const rec = await waitForReceipt(hash)
    if (rec.status !== 'success') throw new Error(approving ? 'Approval reverted' : 'Transaction reverted')
  }
  const url = `${EXPLORER}/tx/${hash}`
  onStatus({ phase: 'done', txHash: hash, url })
  return hash
}
