import { useEffect, useState } from 'react'
import { publicClientFor } from '../lib/trade'
import { robinhoodChain } from '../config'
import { CHAINLINK_FEEDS } from '../data/chainlink'

// latestRoundData() -> (roundId, answer, startedAt, updatedAt, answeredInRound)
const ROUND_ABI = [
  {
    type: 'function',
    name: 'latestRoundData',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
  },
]

const client = publicClientFor(robinhoodChain.id)

// { NVDA: { price: 224.09, updatedAt: 1791850859 }, ... } — module-level cache
// so Markets, Hero and Swap share one poll.
let cache = null
let inflight = null

function readAll() {
  if (!inflight) {
    inflight = Promise.all(
      CHAINLINK_FEEDS.map(f =>
        client
          .readContract({ address: f.feed, abi: ROUND_ABI, functionName: 'latestRoundData' })
          .then(r => [f.symbol, { price: Number(r[1]) / 1e8, updatedAt: Number(r[3]) }])
          .catch(() => null)
      )
    )
      .then(rows => Object.fromEntries(rows.filter(Boolean)))
      .then(next => {
        cache = next
        inflight = null
        return next
      })
      .catch(e => {
        inflight = null
        throw e
      })
  }
  return inflight
}

/**
 * On-chain Chainlink prices for stock tokens and ETH/BTC on Robinhood Chain.
 * Independent of any off-chain API — works even when the price index is down.
 * Returns { prices: { SYMBOL: number }, updatedAt: { SYMBOL: unix }, loading }.
 */
export function useChainlinkPrices() {
  const [state, setState] = useState(() => ({
    prices: cache ? Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, v.price])) : {},
    updatedAt: cache ? Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, v.updatedAt])) : {},
    loading: !cache,
  }))

  useEffect(() => {
    let alive = true
    const apply = next => {
      if (!alive) return
      setState({
        prices: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v.price])),
        updatedAt: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v.updatedAt])),
        loading: false,
      })
    }
    if (cache) apply(cache)
    readAll().then(apply).catch(() => { if (alive) setState(s => ({ ...s, loading: false })) })
    const i = setInterval(() => readAll().then(apply).catch(() => {}), 60000)
    return () => { alive = false; clearInterval(i) }
  }, [])

  return state
}
