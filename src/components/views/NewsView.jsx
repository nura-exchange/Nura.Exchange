import { useState, useEffect, useCallback } from 'react'
import { ANCHOR_FX_ROUTER_ADDRESS } from '../../config'

const NEWS = [
  {
    date: '2026-08-18',
    title: 'Uniswap v4 live on Arc — hooks, pools & routing day-one',
    body: 'Uniswap deployed its v4 stack on Arc ahead of mainnet: AMM, liquidity pools, routing, SDK/API and hooks for custom fees and institutional rules. 100+ private-mainnet builders including Aave and Curve signal day-one liquidity.',
    tag: 'Ecosystem',
  },
  {
    date: '2026-08-05',
    title: 'Founding validators: BlackRock, Visa, Mastercard, DTCC & more',
    body: 'Circle unveiled Arc’s founding validator cohort — BlackRock, DTCC, Galaxy, Global Payments, ICE, Mastercard, MoneyGram, SBI, Standard Chartered, Sumitomo, Visa — a network secured by the institutions building on it. Private mainnet now >100 builders.',
    tag: 'Institutional',
  },
  {
    date: '2026-08-05',
    title: 'BlackRock BUIDL coming to Arc; DTCC tokenization on Arc in H2 2027',
    body: 'BlackRock will deploy its USD Institutional Digital Liquidity Fund (BUIDL) on Arc for single-environment subscribe/redeem/deploy. Circle + DTCC plan DTC-custodied asset tokenization on Arc starting H2 2027.',
    tag: 'Institutional',
  },
  {
    date: '2026-08',
    title: '500M+ testnet txns, ~3M wallets — public mainnet Sep 16',
    body: 'Arc private mainnet is live with 500M+ testnet txns and ~3M wallets. Public mainnet opens Sep 16, 2026 — open to all users/apps, permissioned PoA validators, USDC-denominated fees, EVM-compatible. Half-billion tx milestone signals institutional validation.',
    tag: 'Network',
  },
  {
    date: '2026-07',
    title: 'USDC as native gas',
    body: 'Arc uses USDC for transaction fees - predictable dollar-based costs, no volatile gas token. Native view is 18 decimals, ERC-20 view is 6 decimals, same pool.',
    tag: 'Core',
  },
  {
    date: '2026-07',
    title: 'Sub-second deterministic finality',
    body: 'Transactions finalize on inclusion - no challenge windows, no waiting for multiple confirmations. Sub-second blocks, deterministic settlement.',
    tag: 'Core',
  },
  {
    date: '2026-07',
    title: 'CCTP integration',
    body: 'Arc is part of Circle CCTP (domain 26). USDC moves natively between Arc, Ethereum, Base and more via burn-and-mint.',
    tag: 'Interop',
  },
  {
    date: '2026-07',
    title: 'Stablecoin FX',
    body: 'Native support for stablecoin FX between USDC, EURC and USYC with instant PvP settlement and predictable fees.',
    tag: 'FX',
  },
  {
    date: '2026-06-30',
    title: 'Gateway Forwarding — one-param cross-chain mint',
    body: 'New Gateway Forwarding Service auto-handles destination-chain minting for cross-chain USDC. Enable with a single query param — no multichain infra, no destination gas handling, better UX.',
    tag: 'Gateway',
  },
  {
    date: '2026-07',
    title: 'ERC-8183 agentic commerce',
    body: 'Onchain identity and job settlement for AI agents - escrow, deliverables and settlement without intermediaries.',
    tag: 'Agents',
  },
  {
    date: '2026-07',
    title: 'App Kit and Bridge Kit',
    body: 'Circle SDKs for Bridge, Swap, Send and Unified Balance give developers drop-in cross-chain stablecoin flows.',
    tag: 'Dev',
  },
]

function ago(ts) {
  const s = Math.floor(Date.now() / 1000) - ts
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NewsView() {
  const [stats, setStats] = useState({ block: null, avgTime: null })
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, tRes] = await Promise.all([
        fetch('https://testnet.arcscan.app/api?module=block&action=eth_block_number').then(r => r.json()),
        fetch(`https://testnet.arcscan.app/api?module=account&action=txlist&address=${ANCHOR_FX_ROUTER_ADDRESS}&sort=desc&page=1&offset=6`).then(r => r.json()),
      ])
      const block = parseInt(bRes.result, 16)
      setStats(s => ({ ...s, block }))
      if (Array.isArray(tRes.result)) {
        setTxns(tRes.result.slice(0, 5))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 10000)
    return () => clearInterval(interval)
  }, [fetchAll])

  return (
    <div className="view-section" style={{ maxWidth: 720 }}>
      <div className="view-head">
        <h2>Arc Testnet News</h2>
        <span className="view-sub">Live network activity + ecosystem updates</span>
      </div>

      <div className="pf-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="pf-card">
          <div className="pf-card-label">Latest Block</div>
          <div className="pf-card-val">{stats.block ? stats.block.toLocaleString() : '—'}</div>
          <div className="pf-card-sub">Arc Testnet · chainId 5042002</div>
        </div>
        <div className="pf-card">
          <div className="pf-card-label">Block Time</div>
          <div className="pf-card-val" style={{ color: 'var(--accent2)' }}>&lt;1s</div>
          <div className="pf-card-sub">Deterministic finality</div>
        </div>
      </div>

      <div className="pf-section-title">Live Router Activity</div>
      <div className="mkt-table-wrap" style={{ marginBottom: '1.5rem' }}>
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Tx</th>
              <th>Block</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {txns.length ? txns.map((t, i) => (
              <tr key={i}>
                <td className="mkt-price" style={{ fontSize: 12 }}>{t.hash.slice(0, 10)}…</td>
                <td>{Number(t.blockNumber).toLocaleString()}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{ago(Number(t.timeStamp))}</td>
                <td>
                  <span className="hist-status" style={{ color: t.txreceipt_status === '1' ? 'var(--green)' : 'var(--red)' }}>
                    {t.txreceipt_status === '1' ? 'Confirmed' : 'Failed'}
                  </span>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} style={{ color: 'var(--text3)', fontSize: 12 }}>{loading ? 'Loading…' : 'No activity yet'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pf-section-title">Ecosystem Updates</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {NEWS.map((n, i) => (
          <div
            key={i}
            className="pf-card"
            style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '0.9rem 1rem' }}
          >
            <span
              style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
                background: 'rgba(107,139,255,0.12)', color: 'var(--accent2)',
              }}
            >{n.tag}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{n.body}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{n.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
