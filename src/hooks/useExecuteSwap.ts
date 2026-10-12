import { useCallback, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { createWalletClient, custom, type Address, type Chain, type EIP1193Provider, type Hash } from 'viem'
import { ensureChain, executeQuote, publicClientFor, quoteError, txUrl } from '../lib/trade'
import { SOURCE_CHAINS } from '../config'
import {
  waitForRelayDelivery,
  RelayError,
  ROBINHOOD_CHAIN_ID,
  type RelayQuote,
  type RelayStatusValue,
} from '../services/relay'

export type SwapPhase = 'switch' | 'approve' | 'sign' | 'pending' | 'delivering' | 'done'

export interface SwapStatus {
  phase: SwapPhase
  /** origin-chain tx hash */
  txHash?: string
  /** destination-chain fill hash once delivered */
  destTxHash?: string
  /** relay status while bridging: waiting/depositing/pending/submitted */
  relayStatus?: RelayStatusValue
  url?: string
}

/** Structural shape of a LI.FI quote as produced by /api/quote (see src/lib/trade.js). */
export interface LifiQuoteLike {
  action?: { fromChainId?: number | string; fromAmount?: string }
  fromChainId?: number | string
  transactionRequest?: { to?: string; data?: string; value?: string; gasLimit?: string; gas?: string }
  [key: string]: unknown
}

export interface ExecuteSwapInput {
  /** chain the user pays from: 4663 → local router, anything else → Relay */
  originChainId: number
  /** LI.FI quote — used for local swaps and as cross-chain fallback */
  quote: LifiQuoteLike | null
  relayQuote: RelayQuote | null
}

export interface ExecuteSwapResult {
  mode: 'local' | 'relay'
  txHash: Hash
  url: string
  destTxHash?: string
}

const explorerFor = (chainId: number): string => {
  if (chainId === ROBINHOOD_CHAIN_ID) return 'https://robinhoodchain.blockscout.com'
  return SOURCE_CHAINS.find(s => s.chain.id === chainId)?.explorer || 'https://robinhoodchain.blockscout.com'
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function waitForReceipt(chainId: number, hash: Hash, timeoutMs = 120000) {
  const client = publicClientFor(chainId)
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

/** Executes a swap: local router on Robinhood Chain, Relay cross-chain otherwise. */
export function useExecuteSwap() {
  const { address, connector } = useAccount()
  const [status, setStatus] = useState<SwapStatus | null>(null)
  const busy = status != null && status.phase !== 'done'
  const reqId = useRef(0)

  const execute = useCallback(
    async ({ originChainId, quote, relayQuote }: ExecuteSwapInput): Promise<ExecuteSwapResult> => {
      if (!address || !connector) throw new Error('Connect your wallet first')
      const id = ++reqId.current
      const emit = (s: SwapStatus) => {
        if (id === reqId.current) setStatus(s)
      }

      // ---- cross-chain via Relay ----
      if (relayQuote && originChainId !== ROBINHOOD_CHAIN_ID) {
        const txData = relayQuote.steps[0]?.items?.[0]?.data
        if (!txData?.to) throw new RelayError('no_route', 'Relay quote has no executable step')

        emit({ phase: 'switch' })
        const provider = (await connector.getProvider()) as EIP1193Provider
        const chain = SOURCE_CHAINS.find(s => s.chain.id === originChainId)?.chain as Chain | undefined
        if (!chain) throw new Error('Unsupported source chain')
        await ensureChain(provider, chain)

        const wallet = createWalletClient({ chain, transport: custom(provider) })
        const url = `${explorerFor(originChainId)}/tx/`

        emit({ phase: 'sign' })
        let hash: Hash
        try {
          hash = await wallet.sendTransaction({
            account: address as Address,
            to: txData.to as Address,
            data: (txData.data || '0x') as `0x${string}`,
            value: txData.value ? BigInt(txData.value) : 0n,
          })
        } catch (e) {
          throw new Error(quoteError(e))
        }

        emit({ phase: 'pending', txHash: hash, url: url + hash })
        const rec = await waitForReceipt(originChainId, hash)
        if (rec.status !== 'success') throw new Error('Transaction reverted')

        emit({ phase: 'delivering', txHash: hash, url: url + hash })
        const final = await waitForRelayDelivery(relayQuote.requestId, s => {
          emit({ phase: 'delivering', txHash: hash, url: url + hash, relayStatus: s.status })
        })
        const destTxHash = final.txHashes?.[0]
        emit({ phase: 'done', txHash: hash, url: url + hash, destTxHash })
        return { mode: 'relay', txHash: hash, url: url + hash, destTxHash }
      }

      // ---- local router (Robinhood Chain) or LI.FI fallback quote ----
      if (!quote) throw new Error('No quote to execute')
      const hash = await executeQuote(quote, {
        connector,
        account: address,
        onStatus: (s: { phase: string; txHash?: string; url?: string }) => {
          emit({ phase: s.phase as SwapPhase, txHash: s.txHash, url: s.url })
        },
      })
      emit({ phase: 'done', txHash: hash, url: txUrl(hash) })
      return { mode: 'local', txHash: hash, url: txUrl(hash) }
    },
    [address, connector],
  )

  const reset = useCallback(() => {
    reqId.current++
    setStatus(null)
  }, [])

  return { execute, status, busy, reset, phase: status?.phase ?? null }
}
