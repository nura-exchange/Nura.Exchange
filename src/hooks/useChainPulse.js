import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { robinhoodChain } from '../config'

// Latest block height plus an average block time measured over the last ~200 blocks.
export function useChainPulse() {
  const client = usePublicClient({ chainId: robinhoodChain.id })
  const [pulse, setPulse] = useState({ block: null, blockTimeMs: null })

  useEffect(() => {
    if (!client) return
    let alive = true
    const load = async () => {
      try {
        const latest = await client.getBlock()
        const back = latest.number > 200n ? latest.number - 200n : 0n
        const prev = back < latest.number ? await client.getBlock({ blockNumber: back }) : null
        if (!alive) return
        const dn = prev ? Number(latest.number - prev.number) : 0
        const dt = prev ? Number(latest.timestamp - prev.timestamp) : 0
        setPulse({
          block: Number(latest.number),
          blockTimeMs: dn > 0 && dt > 0 ? (dt / dn) * 1000 : null,
        })
      } catch {
        // RPC hiccup: keep the last good values
      }
    }
    load()
    const id = setInterval(load, 12000)
    return () => { alive = false; clearInterval(id) }
  }, [client])

  return pulse
}
