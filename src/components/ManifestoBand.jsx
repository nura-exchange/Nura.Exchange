import { useAppState } from '../context/useAppState'

export default function ManifestoBand() {
  const { setActiveTab } = useAppState()

  return (
    <section className="manifesto">
      <div className="container manifesto-inner">
        <p className="manifesto-text">
          Own the market. Every share, self&#8209;custodied — one signature at a time.
        </p>
        <div className="manifesto-actions">
          <button type="button" className="pill pill-ghost-dark" onClick={() => setActiveTab('Swap')}>
            Start trading
          </button>
          <button type="button" className="pill pill-ghost-dark" onClick={() => setActiveTab('Bridge')}>
            Bridge funds
          </button>
        </div>
        <div className="manifesto-meta">
          <span>Chain 4663</span>
          <span>16 networks in</span>
          <span>0 custody</span>
        </div>
      </div>
    </section>
  )
}
