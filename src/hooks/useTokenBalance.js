import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { createPublicClient, http, formatUnits } from 'viem'
import { robinhoodChain, USDG_ADDRESS, WETH_ADDRESS, NATIVE } from '../config'
import { publicClientFor } from '../lib/trade'

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http('/api/rpc'),
})

const BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
]

export function useTokenBalance(tokenAddress, decimals = 18) {
  const { address } = useAccount()
  const [value, setValue] = useState(0n)

  const fetchBalance = useCallback(async () => {
    if (!address || !tokenAddress) return
    try {
      const data = await client.readContract({
        address: tokenAddress,
        abi: BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [address],
      })
      setValue(data)
    } catch {
      // ignore
    }
  }, [address, tokenAddress])

  useEffect(() => {
    if (!address || !tokenAddress) {
      setValue(0n)
      return
    }
    fetchBalance()
    const interval = setInterval(fetchBalance, 8000)
    return () => clearInterval(interval)
  }, [address, tokenAddress, fetchBalance])

  useEffect(() => {
    const handler = () => fetchBalance()
    window.addEventListener('nura:refresh', handler)
    return () => window.removeEventListener('nura:refresh', handler)
  }, [fetchBalance])

  if (!address) return { balance: 0, formatted: '0', value: 0n }

  const formatted = formatUnits(value, decimals)
  const balance = parseFloat(formatted) || 0
  return { balance, formatted, value }
}

export function useUsdgBalance() {
  return useTokenBalance(USDG_ADDRESS, 6)
}

export function useWethBalance() {
  return useTokenBalance(WETH_ADDRESS, 18)
}

/** Native balance on the given chain (defaults to Robinhood Chain). */
export function useNativeBalance(chainId = robinhoodChain.id) {
  const { address } = useAccount()
  const [value, setValue] = useState(0n)
  const client = useMemo(() => publicClientFor(chainId), [chainId])

  const fetchBalance = useCallback(async () => {
    if (!address) return
    try {
      const bal = await client.getBalance({ address })
      setValue(bal)
    } catch {
      // ignore
    }
  }, [address, client])

  useEffect(() => {
    if (!address) {
      setValue(0n)
      return
    }
    fetchBalance()
    const interval = setInterval(fetchBalance, 8000)
    return () => clearInterval(interval)
  }, [address, fetchBalance])

  useEffect(() => {
    const handler = () => fetchBalance()
    window.addEventListener('nura:refresh', handler)
    return () => window.removeEventListener('nura:refresh', handler)
  }, [fetchBalance])

  if (!address) return { balance: 0, formatted: '0', value: 0n }
  const formatted = formatUnits(value, 18)
  const balance = parseFloat(formatted) || 0
  return { balance, formatted, value }
}

export { NATIVE }
