import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { robinhoodChain } from '../config'

export default function WrongNetworkBanner() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected || chainId === robinhoodChain.id) return null

  return (
    <div className="wrong-network">
      <span>Wrong network — this exchange runs on Robinhood Chain ({robinhoodChain.id}).</span>
      <button
        type="button"
        className="pill pill-ghost xs"
        onClick={() => switchChain({ chainId: robinhoodChain.id })}
        disabled={isPending}
      >
        {isPending ? 'Switching…' : 'Switch network'}
      </button>
    </div>
  )
}
