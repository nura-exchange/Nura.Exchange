import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { createPublicClient, http, formatUnits } from 'viem'
import { arcTestnet, BRIDGE_SOURCES } from '../../config'

const ERC20_BAL = [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }]

const CHAINS = [
  { key: 'arc', label: 'Arc Testnet', chain: arcTestnet, rpc: 'https://rpc.drpc.testnet.arc.io', usdc: '0x3600000000000000000000000000000000000000' },
  { key: 'sepolia', label: 'Ethereum Sepolia', chain: BRIDGE_SOURCES.sepolia.chain, rpc: BRIDGE_SOURCES.sepolia.rpc, usdc: BRIDGE_SOURCES.sepolia.usdc },
  { key: 'baseSepolia', label: 'Base Sepolia', chain: BRIDGE_SOURCES.baseSepolia.chain, rpc: BRIDGE_SOURCES.baseSepolia.rpc, usdc: BRIDGE_SOURCES.baseSepolia.usdc },
]

export default function GatewayView() {
  const { address } = useAccount()
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(false)
  const [spendAmt, setSpendAmt] = useState('1.00')

  const fetchAll = useCallback(async () => {
    if (!address) return
    setLoading(true)
    const next = {}
    await Promise.all(
      CHAINS.map(async c => {
        try {
          const client = createPublicClient({ chain: c.chain, transport: http(c.rpc) })
          const bal = await client.readContract({ address: c.usdc, abi: ERC20_BAL, functionName: 'balanceOf', args: [address] })
          next[c.key] = Number(formatUnits(bal, 6))
        } catch {
          next[c.key] = 0
        }
      })
    )
    setBalances(next)
    setLoading(false)
  }, [address])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const unified = Object.values(balances).reduce((a, b) => a + (b || 0), 0)
  const spendNum = parseFloat(spendAmt) || 0
  const canSpend = spendNum > 0 && spendNum <= unified

  return (
    <div className="view-section" style={{ maxWidth: 720 }}>
      <div className="view-head">
        <h2>Gateway · Unified Balance</h2>
        <span className="view-sub">One USDC balance, spend instantly on any chain — &lt;500ms via Gateway</span>
      </div>

      <div className="anchor-card" style={{ maxWidth: 560 }}>
        <div className="anchor-card-header">
          <span className="anchor-card-label">Unified USDC Balance</span>
          <span className="anchor-settlement" style={{ color: 'var(--accent2)' }}>● Gateway</span>
        </div>

        <div style={{ textAlign: 'center', padding: '12px 0 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Total spendable</div>
          <div style={{ fontSize: 42, fontWeight: 800, fontFamily: 'DM Mono, monospace', background: 'linear-gradient(135deg,#00e5a0,#6B8BFF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ${unified.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>USDC across {CHAINS.length} chains · gas-free spend</div>
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          {CHAINS.map(c => (
            <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--text)' }}>
                {address ? (balances[c.key] !== undefined ? `$${balances[c.key].toFixed(2)}` : '…') : '—'}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className="anchor-input-sm" type="number" value={spendAmt} onChange={e => setSpendAmt(e.target.value)} placeholder="Amount" style={{ flex: 1 }} />
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text2)', padding: '0 8px' }}>USDC</span>
        </div>

        {!address ? (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text3)', fontSize: 13 }}>Connect wallet to view unified balance</div>
        ) : (
          <button
            className="anchor-swap-btn"
            disabled={!canSpend}
            onClick={() => {
              // Real Gateway spend: kit.unifiedBalance.spend({ amount: spendAmt, ... })
              // For demo, show the flow; actual spend requires Gateway deposit first (see docs)
              alert(`Gateway spend demo: would spend $${spendAmt} instantly on Arc (<500ms).\n\nReal flow:\n  kit.unifiedBalance.deposit({ chain: "Base_Sepolia", amount: "1.00" })\n  kit.unifiedBalance.spend({ chain: "Arc_Testnet", amount: "${spendAmt}" })\n\nSee docs.arc.io/app-kit/unified-balance`)
            }}
          >
            {canSpend ? `Spend $${spendAmt} instantly on Arc →` : 'Enter amount ≤ unified balance'}
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <div style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>Gateway vs CCTP</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
              CCTP: 8-20s fast / 15-19min standard<br />Gateway: <b style={{ color: 'var(--green)' }}>&lt;500ms</b> after deposit
            </div>
          </div>
          <div style={{ background: 'rgba(107,139,255,0.08)', border: '1px solid rgba(107,139,255,0.2)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent2)' }}>Non-custodial</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
              7-day trustless withdrawal. ERC-1271 for smart wallets. No sign-up.
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5 }}>
          Unified Balance is built on <a href="https://developers.circle.com/gateway" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'underline' }}>Circle Gateway</a>.
          Deposit once from any chain, spend anywhere. Refresh to reload balances.
        </p>
        <button onClick={fetchAll} disabled={loading} style={{ marginTop: 8, background: 'var(--s2)', border: '0.5px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
          {loading ? 'Refreshing…' : '↻ Refresh balances'}
        </button>
      </div>
    </div>
  )
}
