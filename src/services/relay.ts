// Relay Protocol API client — https://docs.relay.link
// POST /quote (v1) returns an executable recipe: steps[].items[].data → {to, data, value}.
// v2 (/quote/v2) requires an x-api-key since 2026-10-02, so we stay on v1 while it lives.

const RELAY_BASE = 'https://api.relay.link'
const ROBINHOOD_CHAIN_ID = 4663

export type RelayTradeType = 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'EXPECTED_OUTPUT'

export interface RelayQuoteParams {
  user: string
  originChainId: number
  destinationChainId?: number
  originCurrency: string
  destinationCurrency: string
  /** integer amount in origin-token wei as a decimal string */
  amount: string
  tradeType?: RelayTradeType
}

export interface RelayCurrency {
  chainId: number
  address: string
  symbol: string
  name?: string
  decimals: number
}

export interface RelayAmountDetail {
  currency?: RelayCurrency
  amount?: string
  amountFormatted?: string
  amountUsd?: string
  minimumAmount?: string
}

export interface RelayImpact {
  usd?: string
  percent?: string
}

export interface RelayTxData {
  from?: string
  to: string
  data: string
  value: string
  chainId: number
  gas?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
}

export interface RelayStepCheck {
  endpoint: string
  method: string
}

export interface RelayStepItem {
  status?: string
  data: RelayTxData
  check?: RelayStepCheck
}

export interface RelayStep {
  id: string
  action?: string
  description?: string
  kind?: string
  requestId?: string
  items: RelayStepItem[]
  depositAddress?: string
}

export interface RelayFeeEntry {
  amount?: string
  amountFormatted?: string
  amountUsd?: string
  currency?: RelayCurrency
  minimumAmount?: string
}

export interface RelayFees {
  gas?: RelayFeeEntry
  relayer?: RelayFeeEntry
  relayerGas?: RelayFeeEntry
  relayerService?: RelayFeeEntry
  app?: RelayFeeEntry
  subsidized?: RelayFeeEntry
  [key: string]: RelayFeeEntry | undefined
}

export interface RelayDetails {
  operation?: string
  sender?: string
  recipient?: string
  currencyIn?: RelayAmountDetail
  currencyOut?: RelayAmountDetail
  refundCurrency?: RelayAmountDetail
  totalImpact?: RelayImpact
  swapImpact?: RelayImpact
  expandedPriceImpact?: RelayImpact
  rate?: string
  slippageTolerance?: number
  timeEstimate?: number
  route?: string
}

export interface RelayQuoteResponse {
  requestId: string
  steps: RelayStep[]
  fees?: RelayFees
  details?: RelayDetails
  protocol?: unknown
}

/** Normalized quote the UI consumes. */
export interface RelayQuote {
  requestId: string
  steps: RelayStep[]
  /** exact output amount in destination-token wei */
  toAmount: string
  toDecimals: number
  toSymbol: string
  /** percent, e.g. -0.51; null when Relay omits impact */
  priceImpact: number | null
  /** combined fee in USD across all fee legs */
  feeUsd: number | null
  /** rough seconds until delivery on the destination chain */
  timeEstimate: number | null
  details: RelayDetails | null
  raw: RelayQuoteResponse
}

export type RelayErrorCode =
  | 'unsupported_currency'
  | 'no_route'
  | 'rate_limited'
  | 'bad_request'
  | 'network'

export class RelayError extends Error {
  code: RelayErrorCode
  constructor(code: RelayErrorCode, message: string) {
    super(message)
    this.name = 'RelayError'
    this.code = code
  }
}

export type RelayStatusValue =
  | 'waiting'
  | 'depositing'
  | 'pending'
  | 'submitted'
  | 'success'
  | 'delayed'
  | 'refund'
  | 'failure'
  | 'unknown'

export interface RelayStatus {
  status: RelayStatusValue
  inTxHashes?: string[]
  txHashes?: string[]
  updatedAt?: number
  originChainId?: number
  destinationChainId?: number
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function relayFetch(path: string, init: RequestInit, retries = 1): Promise<Response> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${RELAY_BASE}${path}`, init)
      if (res.status === 429 && attempt < retries) {
        await sleep(1500)
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        await sleep(800)
        continue
      }
    }
  }
  throw new RelayError('network', lastErr instanceof Error ? lastErr.message : 'Network error')
}

function mapQuoteHttpError(status: number, body: { message?: string; errorCode?: string } | null): RelayError {
  const apiCode = body?.errorCode || ''
  const message = body?.message || ''
  if (apiCode === 'UNSUPPORTED_CURRENCY' || apiCode === 'INVALID_INPUT_CURRENCY') {
    return new RelayError('unsupported_currency', message || 'Token not supported by Relay')
  }
  if (status === 429) return new RelayError('rate_limited', 'Rate limited — try again in a moment')
  if (status === 404) return new RelayError('no_route', message || 'No route found')
  if (status >= 500) return new RelayError('network', message || 'Relay is unavailable')
  return new RelayError('bad_request', message || 'Relay quote rejected the request')
}

function sumFeeUsd(fees?: RelayFees): number | null {
  if (!fees) return null
  let total = 0
  let seen = false
  for (const entry of Object.values(fees)) {
    const usd = entry?.amountUsd != null ? parseFloat(entry.amountUsd) : NaN
    if (Number.isFinite(usd)) {
      total += usd
      seen = true
    }
  }
  return seen ? total : null
}

/** Prefer the requestId embedded in the executable step's check endpoint (docs), then step, then top-level. */
function pickRequestId(res: RelayQuoteResponse): string {
  const fromCheck = res.steps?.[0]?.items?.[0]?.check?.endpoint?.match(/requestId=([0-9a-fxA-F]+)/)?.[1]
  return fromCheck || res.steps?.[0]?.requestId || res.requestId
}

function normalizeQuote(res: RelayQuoteResponse): RelayQuote {
  const out = res.details?.currencyOut
  const impactRaw = res.details?.totalImpact?.percent ?? res.details?.expandedPriceImpact?.percent
  const impact = impactRaw != null && impactRaw !== '' ? parseFloat(impactRaw) : NaN
  const time = res.details?.timeEstimate
  return {
    requestId: pickRequestId(res),
    steps: res.steps ?? [],
    toAmount: out?.amount ?? '0',
    toDecimals: out?.currency?.decimals ?? 18,
    toSymbol: out?.currency?.symbol ?? '',
    priceImpact: Number.isFinite(impact) ? impact : null,
    feeUsd: sumFeeUsd(res.fees),
    timeEstimate: typeof time === 'number' && Number.isFinite(time) ? time : null,
    details: res.details ?? null,
    raw: res,
  }
}

/** Ask Relay for an executable cross-chain quote. Throws RelayError on failure. */
export async function getRelayQuote(params: RelayQuoteParams): Promise<RelayQuote> {
  const body = JSON.stringify({
    user: params.user,
    originChainId: params.originChainId,
    destinationChainId: params.destinationChainId ?? ROBINHOOD_CHAIN_ID,
    originCurrency: params.originCurrency,
    destinationCurrency: params.destinationCurrency,
    amount: params.amount,
    tradeType: params.tradeType ?? 'EXACT_INPUT',
  })
  const res = await relayFetch('/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw mapQuoteHttpError(res.status, json)
  }
  if (!json || !Array.isArray(json.steps) || json.steps.length === 0) {
    throw new RelayError('no_route', 'Relay returned no executable steps')
  }
  return normalizeQuote(json)
}

/** Poll this with the requestId from the quote until status is terminal. */
export async function getRelayStatus(requestId: string): Promise<RelayStatus> {
  const res = await relayFetch(`/intents/status?requestId=${encodeURIComponent(requestId)}`, {
    headers: { Accept: 'application/json' },
  }, 0)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json) {
    throw new RelayError('network', 'Failed to fetch relay status')
  }
  const known: RelayStatusValue[] = ['waiting', 'depositing', 'pending', 'submitted', 'success', 'delayed', 'refund', 'failure']
  const raw = String(json.status || '').toLowerCase() as RelayStatusValue
  return {
    status: known.includes(raw) ? raw : 'unknown',
    inTxHashes: Array.isArray(json.inTxHashes) ? json.inTxHashes : undefined,
    txHashes: Array.isArray(json.txHashes) ? json.txHashes : undefined,
    updatedAt: typeof json.updatedAt === 'number' ? json.updatedAt : undefined,
    originChainId: typeof json.originChainId === 'number' ? json.originChainId : undefined,
    destinationChainId: typeof json.destinationChainId === 'number' ? json.destinationChainId : undefined,
  }
}

/** Wait until Relay delivers on the destination chain (or fail/refund). */
export async function waitForRelayDelivery(
  requestId: string,
  onTick?: (s: RelayStatus) => void,
  { intervalMs = 2500, timeoutMs = 8 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<RelayStatus> {
  const start = Date.now()
  let last: RelayStatus = { status: 'waiting' }
  while (Date.now() - start < timeoutMs) {
    try {
      last = await getRelayStatus(requestId)
      onTick?.(last)
      if (last.status === 'success') return last
      if (last.status === 'refund' || last.status === 'failure') {
        throw new RelayError(
          'no_route',
          last.status === 'refund' ? 'Transfer refunded on the origin chain' : 'Cross-chain fill failed',
        )
      }
    } catch (e) {
      // transient status failures must not abort the wait
      if (e instanceof RelayError && e.code !== 'network' && e.code !== 'rate_limited') throw e
    }
    await sleep(intervalMs)
  }
  throw new RelayError('network', 'Delivery is taking longer than expected — track it in your wallet explorer')
}

export { ROBINHOOD_CHAIN_ID }
