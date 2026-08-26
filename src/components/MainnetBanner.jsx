import { useState, useEffect } from 'react'

const MAINNET_DATE = new Date('2026-09-16T00:00:00Z')

function getCountdown() {
  const diff = MAINNET_DATE - new Date()
  if (diff <= 0) return { live: true, days: 0, hours: 0, mins: 0 }
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  return { live: false, days, hours, mins }
}

export default function MainnetBanner() {
  const [c, setC] = useState(getCountdown())
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setC(getCountdown()), 60000)
    return () => clearInterval(id)
  }, [])

  if (hidden) return null

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(0,229,160,0.14), rgba(107,139,255,0.14), rgba(167,139,250,0.12))',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: 13,
        position: 'relative',
      }}
    >
      <span
        style={{
          background: 'linear-gradient(135deg, #00e5a0, #6B8BFF)',
          color: '#000',
          fontSize: 10,
          fontWeight: 800,
          padding: '2px 8px',
          borderRadius: 20,
          letterSpacing: 0.6,
          whiteSpace: 'nowrap',
        }}
      >
        MAINNET SEP 16
      </span>
      <span style={{ color: 'var(--text)', fontWeight: 600 }}>
        {c.live ? (
          'Arc Public Mainnet is LIVE — permissionless, USDC-native L1'
        ) : (
          <>
            Arc Public Mainnet in{' '}
            <b style={{ fontFamily: 'DM Mono, monospace', color: '#fff' }}>
              {c.days}d {c.hours}h {c.mins}m
            </b>{' '}
            — 500M+ testnet txns · ~3M wallets · 100+ private mainnet builders · Uniswap v4 day-one
          </>
        )}
      </span>
      <a
        href="https://www.circle.com/pressroom/circle-announces-founding-validator-cohort-and-major-integrations-for-arc-ahead-of-september-16-mainnet-launch"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12, color: 'var(--accent2)', textDecoration: 'underline', whiteSpace: 'nowrap' }}
      >
        Announcement →
      </a>
      <button
        onClick={() => setHidden(true)}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          right: 10,
          background: 'none',
          border: 'none',
          color: 'var(--text3)',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
