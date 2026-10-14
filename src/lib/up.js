import { encodeFunctionData, parseAbi } from 'viem'
import { robinhoodChain, UP, WETH_ADDRESS, NATIVE } from '../config'
import { publicClientFor } from './trade'

const DEADLINE_S = 1200

const factoryAbi = parseAbi([
  'function getPool(address tokenA, address tokenB, bool stable) view returns (address pool)',
])

const routerAbi = parseAbi([
  'function getAmountsOut(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) view returns (uint256[] amounts)',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[] amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[] amounts)',
])

const ZERO = '0x0000000000000000000000000000000000000000'
const poolCache = new Map() // key: `${a}/${b}` → [{ stable, pool }]

function norm(addr) {
  return (addr || '').toLowerCase()
}

function pairKey(a, b) {
  const [x, y] = [norm(a), norm(b)].sort()
  return `${x}/${y}`
}

async function poolsFor(a, b) {
  const key = pairKey(a, b)
  if (poolCache.has(key)) return poolCache.get(key)
  const client = publicClientFor(robinhoodChain.id)
  const found = await Promise.all(
    [false, true].map(async stable => {
      try {
        const pool = await client.readContract({
          address: UP.v2Factory,
          abi: factoryAbi,
          functionName: 'getPool',
          args: [a, b, stable],
        })
        return pool && pool !== ZERO ? { stable, pool } : null
      } catch {
        return null
      }
    })
  )
  const list = found.filter(Boolean)
  poolCache.set(key, list)
  return list
}

/** All single-hop routes from → to that have a live up. v2 pool. */
async function directRoutes(from, to) {
  const pools = await poolsFor(from, to)
  return pools.map(p => ({ from, to, stable: p.stable, factory: ZERO }))
}

/** Two-hop routes via WETH or USDG when the pair has no direct pool. */
async function bestRoute(from, to) {
  const direct = await directRoutes(from, to)
  if (direct.length) return { routes: direct, kind: 'direct' }
  for (const hub of [WETH_ADDRESS, '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168']) {
    if (norm(hub) === norm(from) || norm(hub) === norm(to)) continue
    const [leg1, leg2] = await Promise.all([directRoutes(from, hub), directRoutes(hub, to)])
    if (leg1.length && leg2.length) return { routes: [...leg1[0], ...leg2[0]], kind: 'multi' }
  }
  return null
}

async function getAmountsOut(amountIn, routes) {
  const client = publicClientFor(robinhoodChain.id)
  return client.readContract({
    address: UP.v2Router,
    abi: routerAbi,
    functionName: 'getAmountsOut',
    args: [amountIn, routes],
  })
}

/**
 * Quotes a swap through up.'s v2 AMM (Aerodrome Router, Path[] with stable flag).
 * `tokenIn` may be NATIVE (quoted as WETH, swapped via swapExactETHForTokens).
 * Returns a LI.FI-shaped quote so the existing executeQuote path signs it as-is.
 * @param {{ tokenIn: string, tokenOut: string, amountIn: bigint, account?: string, slippage?: number }} p
 */
export async function getUpQuote({ tokenIn, tokenOut, amountIn, account, slippage = 1 }) {
  if (!tokenIn || !tokenOut || amountIn <= 0n) return null
  const isNativeIn = norm(tokenIn) === norm(NATIVE)
  const isNativeOut = norm(tokenOut) === norm(NATIVE)
  const quoteIn = isNativeIn ? WETH_ADDRESS : tokenIn
  const quoteOut = isNativeOut ? WETH_ADDRESS : tokenOut
  if (norm(quoteIn) === norm(quoteOut)) return null

  const route = await bestRoute(quoteIn, quoteOut)
  if (!route) return null

  let amounts
  try {
    amounts = await getAmountsOut(amountIn, route.routes)
  } catch {
    return null
  }
  const out = amounts[amounts.length - 1]
  if (!out || out <= 0n) return null

  const minOut = (out * BigInt(Math.round((100 - slippage) * 100))) / 10000n
  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_S
  const to = account || '0x000000000000000000000000000000000000dEaD'

  let txData
  if (isNativeIn) {
    txData = encodeFunctionData({
      abi: routerAbi,
      functionName: 'swapExactETHForTokens',
      args: [minOut, route.routes, to, deadline],
    })
  } else if (isNativeOut) {
    txData = encodeFunctionData({
      abi: routerAbi,
      functionName: 'swapExactTokensForETH',
      args: [amountIn, minOut, route.routes, to, deadline],
    })
  } else {
    txData = encodeFunctionData({
      abi: routerAbi,
      functionName: 'swapExactTokensForTokens',
      args: [amountIn, minOut, route.routes, to, deadline],
    })
  }

  return {
    action: {
      fromChainId: robinhoodChain.id,
      fromToken: { address: isNativeIn ? NATIVE : tokenIn },
      fromAmount: amountIn.toString(),
      approvalAddress: isNativeIn ? null : UP.v2Router,
    },
    estimate: {
      toAmount: out.toString(),
      toAmountMin: minOut.toString(),
      gasCosts: [],
      priceImpact: null,
    },
    transactionRequest: {
      to: UP.v2Router,
      data: txData,
      value: isNativeIn ? amountIn.toString() : '0',
    },
    toolDetails: { name: 'up.' },
    tool: 'up',
    up: true,
    routeInfo: { hops: route.routes.length, kind: route.kind },
  }
}

/** Human label for an up. quote in the ticket UI. */
export function upRouteLabel(q) {
  if (!q?.up) return null
  const hops = q.routeInfo?.hops || 1
  return hops > 1 ? 'up. (multi-hop)' : 'up. (AMM)'
}
