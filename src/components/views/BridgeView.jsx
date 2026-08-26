import { useState, useEffect, useRef } from 'react'
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi'
import { parseUnits, maxUint256, parseGwei } from 'viem'
import { BRIDGE_SOURCES, ARC_BRIDGE } from '../../config'
import { ERC20_ABI, TOKEN_MESSENGER_ABI } from '../../abis'
import { useAppState } from '../../context/useAppState'

export default function BridgeView() {
  const { address } = useAccount()
  const { notify } = useAppState()
  const chainId = useChainId()
  const [sourceKey, setSourceKey] = useState('sepolia')
  const [destKey, setDestKey] = useState('arc')
  const [amount, setAmount] = useState('')
  const [approved, setApproved] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [lastBridgeHash, setLastBridgeHash] = useState(null)
  const actionRef = useRef(null)

  const ALL_OPTIONS = { ...BRIDGE_SOURCES, arc: ARC_BRIDGE }
  const source = ALL_OPTIONS[sourceKey]
  const dest = ALL_OPTIONS[destKey]
  const isSolanaRoute = sourceKey === 'solana' || destKey === 'solana'

  useEffect(() => {
    setApproved(false)
    setLastBridgeHash(null)
  }, [sourceKey, destKey])

  // Prevent same chain selected
  useEffect(() => {
    if (sourceKey === destKey) {
      const fallback = Object.keys(ALL_OPTIONS).find(k => k !== sourceKey)
      if (fallback) setDestKey(fallback)
    }
  }, [sourceKey, destKey])

  const { data: usdcBal } = useBalance({
    address,
    chainId: source.chain.id,
    token: sourceKey === 'solana' ? undefined : source.usdc,
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: source.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, source.tokenMessenger] : undefined,
    chainId: source.chain.id,
    query: { enabled: !!address && !source.comingSoon },
  })

  const { data: writeResult, writeContract, isPending } = useWriteContract()
  const { data: receipt } = useWaitForTransactionReceipt({ hash: writeResult })

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  const allowanceOk = allowance !== undefined && parsedAmount > 0n && allowance >= parsedAmount
  const needsApprove = !approved && !allowanceOk
  const onRightChain = chainId === source.chain.id

  useEffect(() => {
    if (!receipt) return
    if (actionRef.current === 'approve') {
      if (receipt.status === 'success') {
        setApproved(true)
        refetchAllowance()
        notify('Approval Confirmed', 'TokenMessenger approved for USDC', 'success')
      } else {
        notify('Approval Failed', 'Transaction reverted', 'error')
      }
    }
    if (actionRef.current === 'bridge') {
      if (receipt.status === 'success') {
        setLastBridgeHash(receipt.transactionHash)
        notify(
          'Bridge Initiated',
          `${amount} USDC sent via CCTP ${source.name} → ${dest.name}. Tokens arrive after attestation.`,
          'success'
        )
      } else {
        notify('Bridge Failed', 'Transaction reverted', 'error')
      }
    }
    actionRef.current = null
  }, [receipt])

  async function handleSwitch() {
    const provider = window.ethereum
    if (!provider) {
      notify('No Wallet', 'No wallet extension detected', 'error')
      return
    }
    setSwitching(true)
    const hexChain = '0x' + source.chain.id.toString(16)
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChain }],
      })
      notify('Switched', `Now on ${source.name}`, 'success')
    } catch (err) {
      if (err?.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: hexChain,
              chainName: source.chain.name,
              nativeCurrency: source.chain.nativeCurrency,
              rpcUrls: [source.rpc],
              blockExplorerUrls: source.chain.blockExplorers ? [source.chain.blockExplorers.default.url] : undefined,
            }],
          })
          notify('Network Added', `Added and switched to ${source.name}`, 'success')
        } catch (err2) {
          notify('Switch Failed', err2?.message || 'Could not add network', 'error')
        }
      } else {
        notify('Switch Failed', err?.message || 'Could not switch network', 'error')
      }
    } finally {
      setSwitching(false)
    }
  }

  function handleApprove() {
    if (!address || !amount) return
    actionRef.current = 'approve'
    writeContract({
      address: source.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [source.tokenMessenger, maxUint256],
      chainId: source.chain.id,
      gas: 200000n,
      maxFeePerGas: parseGwei('20'),
      maxPriorityFeePerGas: parseGwei('1'),
    })
    notify('Approve Submitted', 'Approving TokenMessenger...', 'info')
  }

  function handleBridge() {
    if (!address || !amount) return
    actionRef.current = 'bridge'
    writeContract({
      address: source.tokenMessenger,
      abi: TOKEN_MESSENGER_ABI,
      functionName: 'depositForBurn',
      args: [parsedAmount, dest.domain, address, source.usdc],
      chainId: source.chain.id,
      gas: 300000n,
      maxFeePerGas: parseGwei('20'),
      maxPriorityFeePerGas: parseGwei('1'),
    })
    notify('Bridge Submitted', `Burning ${amount} USDC on ${source.name} → ${dest.name}`, 'info')
  }

  function flipBridge() {
    const tmp = sourceKey
    setSourceKey(destKey)
    setDestKey(tmp)
    setAmount('')
    setApproved(false)
    setLastBridgeHash(null)
  }

  return (
    <div className="view-section">
      <div className="view-head">
        <h2>Bridge</h2>
        <span className="view-sub">CCTP · Cross-chain USDC · Powered by Circle</span>
      </div>

      <div className="anchor-card">
        <div className="anchor-card-header">
          <span className="anchor-card-label">Cross-Chain Transfer</span>
          <span className="anchor-settlement" style={{ color: 'var(--accent2)' }}>● CCTP</span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>From</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(ALL_OPTIONS).map(([key, s]) => (
              <button
                key={key}
                onClick={() => !s.comingSoon && setSourceKey(key)}
                disabled={!!s.comingSoon}
                title={s.comingSoon ? 'Solana support coming soon — requires Solana wallet' : undefined}
                style={{
                  flex: 1,
                  minWidth: 90,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: s.comingSoon ? 'not-allowed' : 'pointer',
                  background: sourceKey === key ? 'var(--accent2)' : 'var(--s2)',
                  color: sourceKey === key ? '#000' : s.comingSoon ? 'var(--text3)' : 'var(--text2)',
                  border: 'none',
                  fontWeight: 600,
                  opacity: s.comingSoon ? 0.6 : 1,
                }}
              >
                {s.name}{s.comingSoon ? ' · Soon' : ''}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={flipBridge}
          style={{
            display: 'block',
            margin: '0 auto 12px',
            background: 'var(--s2)',
            border: '0.5px solid var(--border)',
            color: 'var(--text2)',
            borderRadius: '50%',
            width: 32,
            height: 32,
            fontSize: 14,
            cursor: 'pointer',
          }}
          title="Flip direction"
        >
          ⇅
        </button>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>To</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(ALL_OPTIONS).map(([key, s]) => (
              <button
                key={key}
                onClick={() => !s.comingSoon && setDestKey(key)}
                disabled={!!s.comingSoon}
                title={s.comingSoon ? 'Solana support coming soon' : undefined}
                style={{
                  flex: 1,
                  minWidth: 90,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: s.comingSoon ? 'not-allowed' : 'pointer',
                  background: destKey === key ? 'var(--accent2)' : 'var(--s2)',
                  color: destKey === key ? '#000' : s.comingSoon ? 'var(--text3)' : 'var(--text2)',
                  border: 'none',
                  fontWeight: 600,
                  opacity: s.comingSoon ? 0.6 : 1,
                }}
              >
                {s.name}{s.comingSoon ? ' · Soon' : ''}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>USDC Balance ({source.name})</span>
          <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace' }}>
            {usdcBal ? parseFloat(usdcBal.formatted).toFixed(6) : '0.000000'} USDC
          </span>
        </div>

        <input
          className="anchor-input-sm"
          type="number"
          placeholder="Amount (USDC)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Route</span>
          <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
            {source.name} → {dest.name} · Domain {dest.domain}
          </span>
        </div>

        {isSolanaRoute ? (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fca5a5', marginBottom: 4 }}>Solana support coming soon</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
              Bridging to/from Solana requires a Solana wallet (Phantom) and is being integrated. For now, use Ethereum Sepolia or Base Sepolia ↔ Arc. Track progress on the Arc docs.
            </div>
          </div>
        ) : !onRightChain ? (
          <button className="anchor-swap-btn" onClick={handleSwitch} disabled={switching}>
            {switching ? 'Switching…' : `Switch to ${source.name}`}
          </button>
        ) : needsApprove ? (
          <button className="anchor-swap-btn" onClick={handleApprove} disabled={isPending || !amount}>
            {isPending ? 'Approving...' : `Approve USDC`}
          </button>
        ) : (
          <button className="anchor-swap-btn" onClick={handleBridge} disabled={isPending || !amount}>
            {isPending ? 'Bridging...' : `Bridge ${amount || '0'} USDC → ${dest.name}`}
          </button>
        )}

        {lastBridgeHash && (
          <a
            href={`https://testnet.arcscan.app/tx/${lastBridgeHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--accent2)', textDecoration: 'underline' }}
          >
            View bridge tx {lastBridgeHash.slice(0, 10)}…{lastBridgeHash.slice(-6)} on ArcScan ↗
          </a>
        )}

        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5 }}>
          CCTP burns USDC on the source chain and mints it on the destination. Settlement completes after the
          attestation service confirms the burn — typically under a minute on testnet. You need USDC + native gas on the source chain.
        </p>
      </div>
    </div>
  )
}
