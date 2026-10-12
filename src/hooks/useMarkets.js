import { useState, useEffect } from 'react'
import localStocks from '../data/stocks.json'
import { USDG_ADDRESS, NATIVE } from '../config'

// 64 Robinhood Chain stock tokens with live prices (Quoro open API, MIT-licensed data mirrored in src/data).
export function useStocks() {
  const [stocks, setStocks] = useState(() =>
    localStocks.map(s => ({
      ticker: s.ticker,
      name: s.name,
      ca: s.token,
      logo: null,
      priceUsd: null,
      change24h: null,
      spark: [],
    }))
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('https://quoro.exchange/api/stocks')
      .then(r => r.json())
      .then(data => {
        if (!alive || !Array.isArray(data) || !data.length) return
        setStocks(data.map(s => ({
          ticker: s.ticker,
          name: s.name,
          ca: s.ca,
          logo: s.logo || null,
          priceUsd: s.priceUsd ?? null,
          change24h: s.change24h ?? null,
          spark: Array.isArray(s.spark) ? s.spark : [],
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => { alive = false }
  }, [])

  return { stocks, loading }
}

// Every other live market on Robinhood Chain (top pools by 24h volume via /api/tokens),
// cached once per session so Markets and Swap share one request.
let chainTokensPromise = null
function loadChainTokens() {
  if (!chainTokensPromise) {
    chainTokensPromise = fetch('/api/tokens')
      .then(r => r.json())
      .then(d => (Array.isArray(d?.tokens) ? d.tokens : []))
      .catch(() => {
        chainTokensPromise = null
        return []
      })
  }
  return chainTokensPromise
}

export function useChainTokens() {
  const [chainTokens, setChainTokens] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    loadChainTokens().then(list => {
      if (!alive) return
      setChainTokens(list)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  return { chainTokens, loading }
}

export function useEthPrice() {
  const [price, setPrice] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(`https://li.quest/v1/token?chain=4663&token=${NATIVE}`)
        .then(r => r.json())
        .then(d => { if (alive && d?.priceUSD) setPrice(parseFloat(d.priceUSD)) })
        .catch(() => {})
    load()
    const i = setInterval(load, 60000)
    return () => { alive = false; clearInterval(i) }
  }, [])
  return price
}

export const USDG = {
  address: USDG_ADDRESS,
  symbol: 'USDG',
  name: 'Global Dollar',
  decimals: 6,
  priceUsd: 1,
}

export const ETH_TOKEN = {
  address: NATIVE,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  priceUsd: null,
}
