import { createWalletClient, createPublicClient, http, custom, parseUnits, formatUnits, isAddress, encodeFunctionData } from 'viem'
import { robinhoodChain, SOURCE_CHAINS, NATIVE, txUrl } from '../config'

const HISTORY_KEY = (addr) => `nura.history.${(addr || '').toLowerCase()}`

export function remember(addr, entry) {
  try {
    const list = getHistory(addr).filter(x => x.txHash !== entry.txHash)
    list.unshift(entry)
    localStorage.setItem(HISTORY_KEY(addr), JSON.stringify(list.slice(0, 50)))
  } catch {
    // private window
  }
}

export function getHistory(addr) {
  if (!addr) return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY(addr)) || '[]')
  } catch {
    return []
  }
}

const explorerFor = (chainId) =>
  chainId === robinhoodChain.id ? 'https://robinhoodchain.blockscout.com'
    : (SOURCE_CHAINS.find(s => s.chain.id === chainId)?.explorer || 'https://robinhoodchain.blockscout.com')

const rpcFor = (chainId) =>
  chainId === robinhoodChain.id ? '/api/rpc'
    : (SOURCE_CHAINS.find(s => s.chain.id === chainId)?.rpc || 'https://rpc.mainnet.chain.robinhood.com')

export function publicClientFor(chainId) {
  return createPublicClient({
    transport: chainId === robinhoodChain.id ? http('/api/rpc') : http(rpcFor(chainId)),
  })
}

export async function getQuote({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage = 1 }) {
  const params = new URLSearchParams({
    fromChain: String(fromChain),
    toChain: String(toChain),
    fromToken,
    toToken,
    fromAmount,
    fromAddress,
    slippage: String(slippage),
  })
  const r = await fetch(`/api/quote?${params.toString()}`)
  const data = await r.json().catch(() => null)
  if (!r.ok) {
    const err = new Error(data?.message || data?.errors?.[0]?.message || 'No route found')
    err.code = r.status === 404 || r.status === 400 ? 'no_route' : 'offline'
    throw err
  }
  return data
}

async function getEip1193(connector) {
  if (!connector) throw new Error('Connect a wallet first')
  return connector.getProvider()
}

export async function ensureChain(provider, chain) {
  const hexId = '0x' + chain.id.toString(16)
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
  } catch (e) {
    const code = e?.code ?? e?.data?.originalError?.code
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: hexId,
          chainName: chain.name,
          rpcUrls: [chain.rpcUrls.public?.http?.[0] || chain.rpcUrls.default.http[0]],
          nativeCurrency: chain.nativeCurrency,
          blockExplorerUrls: [chain.blockExplorers.default.url],
        }],
      })
    } else {
      throw e
    }
  }
}

const ALLOWANCE_ABI = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function waitForReceipt(chainId, hash, timeoutMs = 120000) {
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

// Signs exactly the quote the page showed: switch chain -> approve (exact amount, if asked) -> swap.
// onStatus({ phase, step, of, txHash }) drives the UI.
export async function executeQuote(quote, { connector, account, onStatus = () => {} }) {
  const q = quote
  const chainId = Number(q.action?.fromChainId || q.fromChainId)
  const tr = q.transactionRequest
  if (!tr?.to) throw new Error('Quote has no transaction')

  const provider = await getEip1193(connector)
  const chain = chainId === robinhoodChain.id
    ? robinhoodChain
    : (SOURCE_CHAINS.find(s => s.chain.id === chainId)?.chain)
  if (!chain) throw new Error('Unsupported source chain')

  onStatus({ phase: 'switch', chainId })
  await ensureChain(provider, chain)

  const wallet = createWalletClient({ chain, transport: custom(provider) })
  const explorer = explorerFor(chainId)
  let hash = null

  // Approval for ERC-20 input: exactly the quoted amount, only to the contract that then takes it.
  const fromToken = q.action?.fromToken?.address
  const approvalAddress = q.estimate?.approvalAddress || q.action?.approvalAddress
  const needsApproval = fromToken && fromToken.toLowerCase() !== NATIVE.toLowerCase() && approvalAddress
  if (needsApproval) {
    const pub = publicClientFor(chainId)
    let allowance = 0n
    try {
      allowance = await pub.readContract({
        address: fromToken,
        abi: ALLOWANCE_ABI,
        functionName: 'allowance',
        args: [account, approvalAddress],
      })
    } catch {
      allowance = 0n
    }
    const needed = BigInt(q.action.fromAmount)
    if (allowance < needed) {
      onStatus({ phase: 'approve', step: 1, of: 2 })
      const approveHash = await wallet.sendTransaction({
        account,
        to: fromToken,
        data: encodeFunctionData({
          abi: ALLOWANCE_ABI,
          functionName: 'approve',
          args: [approvalAddress, needed],
        }),
      })
      const rec = await waitForReceipt(chainId, approveHash)
      if (rec.status !== 'success') throw new Error('Approval reverted')
    }
  }

  onStatus({ phase: 'sign', step: 2, of: 2 })
  hash = await wallet.sendTransaction({
    account,
    to: tr.to,
    data: tr.data || '0x',
    value: tr.value ? BigInt(tr.value) : 0n,
    ...(tr.gasLimit || tr.gas ? { gas: BigInt(tr.gasLimit || tr.gas) } : {}),
  })
  onStatus({ phase: 'pending', txHash: hash, url: `${explorer}/tx/${hash}` })

  const rec = await waitForReceipt(chainId, hash)
  if (rec.status !== 'success') throw new Error('Transaction reverted')

  onStatus({ phase: 'done', txHash: hash, url: `${explorer}/tx/${hash}` })
  return hash
}

export function quoteError(e) {
  const m = String((e && (e.message || e.shortMessage)) || e || '').toLowerCase()
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED' || /reject|denied|cancel/.test(m)) return 'Request rejected'
  if (/insufficient funds|gas required exceeds/.test(m)) return 'Not enough ETH for gas'
  if (/no route|no_route/.test(m) || e?.code === 'no_route') return 'No route for this pair'
  return (e && (e.message || e.shortMessage)) || 'Transaction failed'
}

export { parseUnits, formatUnits, isAddress, txUrl, NATIVE }
